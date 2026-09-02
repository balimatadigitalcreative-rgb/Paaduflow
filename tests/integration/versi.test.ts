import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { createAppServices } from '#composition/http'
import { buildHttpApp, type PaaduServer } from '#interface/http/app'

import { FakeBreachList, FakeMailer } from './harness.js'

/**
 * `/versi` — bundel mana yang sedang disajikan.
 *
 * Tiga hal yang diuji, dan ketiganya adalah syarat yang membuat pemberitahuan
 * versi di klien tidak berbohong:
 *
 *   1. Ia memulangkan sha dari `versi.json` di direktori yang DISAJIKAN,
 *      bukan nilai yang dikunci saat proses menyala.
 *   2. Ia tidak menyentuh basis data — dibuktikan dengan pool yang sudah
 *      ditutup, satu-satunya cara membuktikan sesuatu TIDAK dilakukan.
 *   3. Berkas yang tak terbaca menjadi 503, bukan tebakan. Sha yang ditebak
 *      akan menyuruh setiap tab memuat ulang tanpa ada yang berubah.
 */

let pool: Pool
let dir: string
let app: PaaduServer

async function bangun(webRoot: string | undefined): Promise<PaaduServer> {
  const server = await buildHttpApp({
    services: createAppServices({
      pool,
      tokenSigningSecret: 'rahasia-uji-yang-panjangnya-cukup-32-karakter',
      mfaEncryptionKeyBase64: Buffer.alloc(32, 9).toString('base64'),
      mailer: new FakeMailer(),
      breachList: new FakeBreachList(),
    }),
    ...(webRoot === undefined ? {} : { webRoot }),
  })
  await server.ready()
  return server
}

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL })
  dir = await mkdtemp(join(tmpdir(), 'paadu-versi-'))
  await writeFile(join(dir, 'versi.json'), JSON.stringify({ sha: 'aaa1111' }))
  app = await bangun(dir)
})

afterAll(async () => {
  await app.close()
  await pool.end()
  await rm(dir, { recursive: true, force: true })
})

test('memulangkan sha dari versi.json, tanpa cache dan tanpa sesi', async () => {
  const jawaban = await app.inject({ method: 'GET', url: '/versi' })

  expect(jawaban.statusCode).toBe(200)
  expect(jawaban.json()).toEqual({ sha: 'aaa1111' })
  // Jawaban basi dari endpoint yang seluruh gunanya mendeteksi kebasian tidak
  // berguna sama sekali.
  expect(jawaban.headers['cache-control']).toBe('no-store')
})

test('mengikuti berkas yang BERUBAH, bukan nilai saat proses menyala', async () => {
  /*
   * Inilah yang membedakannya dari konstanta.
   *
   * Deploy menukar `dist/web` di bawah proses yang sedang berjalan. Proses lama
   * menyajikan bundel BARU beberapa detik sebelum ia disegarkan; nilai yang
   * dikunci saat menyala akan menjawab sha lama untuk berkas baru, dan tab yang
   * baru dibuka akan diberi tahu ada versi baru yang sudah ia jalankan.
   *
   * Cache sepuluh detik dilewati dengan membangun app kedua — bukan dengan
   * menunggu sepuluh detik nyata di dalam uji.
   */
  await writeFile(join(dir, 'versi.json'), JSON.stringify({ sha: 'bbb2222' }))

  const kedua = await bangun(dir)
  try {
    const jawaban = await kedua.inject({ method: 'GET', url: '/versi' })
    expect(jawaban.json()).toEqual({ sha: 'bbb2222' })
  } finally {
    await kedua.close()
  }
})

test('tanpa webRoot menjawab dev — dan itu berarti tidak pernah ada selisih', async () => {
  // Pengembangan dan uji: bundel Vite juga berversi `dev`, sehingga
  // pemberitahuan tidak pernah berbunyi di mesin siapa pun.
  const tanpa = await bangun(undefined)
  try {
    const jawaban = await tanpa.inject({ method: 'GET', url: '/versi' })
    expect(jawaban.statusCode).toBe(200)
    expect(jawaban.json()).toEqual({ sha: 'dev' })
  } finally {
    await tanpa.close()
  }
})

test('versi.json yang tak terbaca menjadi 503, bukan sha yang ditebak', async () => {
  const kosong = await mkdtemp(join(tmpdir(), 'paadu-versi-kosong-'))
  const server = await bangun(kosong)
  try {
    const jawaban = await server.inject({ method: 'GET', url: '/versi' })
    expect(jawaban.statusCode).toBe(503)
    expect(jawaban.json()).toEqual({ sha: null })
  } finally {
    await server.close()
    await rm(kosong, { recursive: true, force: true })
  }
})

test('tidak menyentuh basis data', async () => {
  /*
   * Pool ditutup lebih dulu; kalau endpoint ini menyentuh basis data, ia akan
   * melempar. Setiap tab yang terbuka memanggilnya beberapa menit sekali —
   * endpoint yang menyentuh basis data menjadikan jumlah tab terbuka sebagai
   * beban basis data.
   */
  const tersendiri = new Pool({ connectionString: process.env.TEST_DATABASE_URL })
  const server = await buildHttpApp({
    services: createAppServices({
      pool: tersendiri,
      tokenSigningSecret: 'rahasia-uji-yang-panjangnya-cukup-32-karakter',
      mfaEncryptionKeyBase64: Buffer.alloc(32, 9).toString('base64'),
      mailer: new FakeMailer(),
      breachList: new FakeBreachList(),
    }),
    webRoot: dir,
  })
  await server.ready()
  await tersendiri.end()

  try {
    const jawaban = await server.inject({ method: 'GET', url: '/versi' })
    expect(jawaban.statusCode).toBe(200)
  } finally {
    await server.close()
  }
})
