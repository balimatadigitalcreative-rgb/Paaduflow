import { randomUUID } from 'node:crypto'

import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { createAppServices } from '#composition/http'
import { buildHttpApp, type PaaduServer } from '#interface/http/app'

import { FakeBreachList, FakeMailer, VALID_PASSWORD } from './harness.js'

/**
 * Profil pengguna dan bahasa pilihannya.
 *
 * Yang diuji di sini bukan bahwa kolomnya dapat ditulis — itu akan terbukti
 * dengan satu UPDATE. Yang diuji adalah bahwa pilihannya bertahan LINTAS SESI,
 * karena itulah yang membedakan preferensi di server dari preferensi di
 * peramban. Test yang menyimpan lalu membaca dengan token yang sama akan lulus
 * meski nilainya hanya tersimpan di memori proses.
 *
 * Dijalankan lewat peran `paadu_app` tanpa BYPASSRLS, sama seperti produksi.
 */

let admin: Pool
let appPool: Pool
let app: PaaduServer

let email: string
let emailLain: string

async function daftarkan(alamat: string, nama: string): Promise<string> {
  const jawaban = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email: alamat, password: VALID_PASSWORD, full_name: nama },
  })
  expect(jawaban.statusCode).toBe(202)

  const { rows } = await admin.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [
    alamat,
  ])
  return rows[0]!.id
}

async function masuk(alamat: string): Promise<string> {
  const jawaban = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: alamat, password: VALID_PASSWORD },
  })
  expect(jawaban.statusCode).toBe(200)
  return jawaban.json().data.access_token as string
}

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL
  admin = new Pool({ connectionString })
  appPool = new Pool({ connectionString, options: '-c role=paadu_app' })

  app = await buildHttpApp({
    services: createAppServices({
      pool: appPool,
      tokenSigningSecret: 'rahasia-uji-yang-panjangnya-cukup-32-karakter',
      mfaEncryptionKeyBase64: Buffer.alloc(32, 9).toString('base64'),
      mailer: new FakeMailer(),
      breachList: new FakeBreachList(),
    }),
  })
  await app.ready()

  const tanda = randomUUID().slice(0, 8)
  email = `siti-${tanda}@contoh.test`
  emailLain = `budi-${tanda}@contoh.test`

  await daftarkan(email, 'Siti Rahmawati')
  await daftarkan(emailLain, 'Budi Santoso')
})

afterAll(async () => {
  await app.close()
  await appPool.end()
  await admin.end()
})

test('profil membawa nama pengguna, yang sebelumnya tidak punya jalan baca sama sekali', async () => {
  const token = await masuk(email)

  const jawaban = await app.inject({
    method: 'GET',
    url: '/v1/me',
    headers: { authorization: `Bearer ${token}` },
  })

  expect(jawaban.statusCode).toBe(200)
  expect(jawaban.json().data.full_name).toBe('Siti Rahmawati')
  expect(jawaban.json().data.email).toBe(email)
})

test('bahasa bawaan adalah Indonesia', async () => {
  const token = await masuk(email)

  const jawaban = await app.inject({
    method: 'GET',
    url: '/v1/me',
    headers: { authorization: `Bearer ${token}` },
  })

  // Indonesia adalah sumber kebenaran makna, dan juga bawaannya. Pengguna baru
  // yang belum memilih apa pun mendapat bahasa Indonesia, bukan Inggris.
  expect(jawaban.json().data.language).toBe('id')
})

test('pilihan bahasa bertahan di sesi BARU, bukan hanya di sesi yang menyimpannya', async () => {
  const tokenLama = await masuk(email)

  const disimpan = await app.inject({
    method: 'PUT',
    url: '/v1/me/preferences/language',
    headers: { authorization: `Bearer ${tokenLama}` },
    payload: { language: 'en' },
  })
  expect(disimpan.statusCode).toBe(200)

  /*
   * Masuk lagi — sesi berbeda, token berbeda. Inilah yang membedakan
   * "tersimpan di server" dari "tersimpan di peramban": kalau nilainya hanya
   * ada di localStorage, langkah ini akan mengembalikan 'id'.
   */
  const tokenBaru = await masuk(email)
  const dibaca = await app.inject({
    method: 'GET',
    url: '/v1/me',
    headers: { authorization: `Bearer ${tokenBaru}` },
  })

  expect(dibaca.json().data.language).toBe('en')
})

test('bahasa satu pengguna tidak mengubah bahasa pengguna lain', async () => {
  const tokenLain = await masuk(emailLain)

  const jawaban = await app.inject({
    method: 'GET',
    url: '/v1/me',
    headers: { authorization: `Bearer ${tokenLain}` },
  })

  // Siti sudah beralih ke Inggris di test sebelumnya. Budi tidak ikut.
  expect(jawaban.json().data.language).toBe('id')
  expect(jawaban.json().data.full_name).toBe('Budi Santoso')
})

test('bahasa yang tidak dikenal ditolak, bukan disimpan diam-diam', async () => {
  const token = await masuk(email)

  const jawaban = await app.inject({
    method: 'PUT',
    url: '/v1/me/preferences/language',
    headers: { authorization: `Bearer ${token}` },
    payload: { language: 'ms' },
  })

  /*
   * Melayu memang direncanakan. Sampai berkas locale-nya ada, menerimanya
   * hanya memindahkan kegagalan ke layar pengguna — di mana ia muncul sebagai
   * teks kosong, bukan sebagai galat yang dapat ditelusuri.
   */
  expect(jawaban.statusCode).toBe(400)
})

test('tanpa token, profil tidak dapat dibaca maupun diubah', async () => {
  const dibaca = await app.inject({ method: 'GET', url: '/v1/me' })
  expect(dibaca.statusCode).toBe(401)

  const ditulis = await app.inject({
    method: 'PUT',
    url: '/v1/me/preferences/language',
    payload: { language: 'en' },
  })
  expect(ditulis.statusCode).toBe(401)
})
