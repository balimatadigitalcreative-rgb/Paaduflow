import { randomUUID } from 'node:crypto'

import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { createAppServices } from '#composition/http'
import { buildHttpApp, keadaanAwal, type PaaduServer } from '#interface/http/app'
import { createPermissionCache } from '#application/identity/authorization'
import {
  pasangPendengarCacheIzin,
  siarkanPembatalan,
} from '#infrastructure/db/siaran-cache-izin'

import { FakeBreachList, FakeMailer } from './harness.js'

/**
 * Kesiapan, liveness, dan siaran pembatalan izin lintas proses.
 *
 * Ketiganya syarat mode cluster. Yang diuji di sini bukan bahwa endpoint-nya
 * ada, melainkan bahwa ia menjawab BERBEDA pada keadaan yang berbeda — endpoint
 * kesiapan yang selalu 200 sama tidak bergunanya dengan tidak ada.
 */

let admin: Pool
let appPool: Pool
let app: PaaduServer
const keadaan = keadaanAwal()

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
    keadaan,
  })
  await app.ready()
})

afterAll(async () => {
  await app.close()
  await appPool.end()
  await admin.end()
})

// ── Liveness ────────────────────────────────────────────────────────────────

test('/healthz tidak menyentuh basis data', async () => {
  /*
   * Dibuktikan dengan pool yang SUDAH ditutup: kalau endpoint ini menyentuh
   * basis data, ia akan melempar. Ini satu-satunya cara membuktikan sesuatu
   * TIDAK dilakukan.
   */
  const poolMati = new Pool({ connectionString: process.env.TEST_DATABASE_URL })
  await poolMati.end()

  const sendiri = await buildHttpApp({
    services: createAppServices({
      pool: poolMati,
      tokenSigningSecret: 'rahasia-uji-yang-panjangnya-cukup-32-karakter',
      mfaEncryptionKeyBase64: Buffer.alloc(32, 9).toString('base64'),
      mailer: new FakeMailer(),
      breachList: new FakeBreachList(),
    }),
  })
  await sendiri.ready()

  const hidup = await sendiri.inject({ method: 'GET', url: '/healthz' })
  expect(hidup.statusCode).toBe(200)
  expect(hidup.json().status).toBe('hidup')

  // Dan kesiapan pada pool yang sama memang gagal — membuktikan pool-nya
  // benar-benar mati, sehingga 200 di atas bukan kebetulan.
  const siap = await sendiri.inject({ method: 'GET', url: '/readyz' })
  expect(siap.statusCode).toBe(503)

  await sendiri.close()
})

// ── Readiness ───────────────────────────────────────────────────────────────

test('/readyz menjawab 503 sebelum proses menyatakan siap', async () => {
  keadaan.siap = false
  keadaan.menutup = false

  const jawaban = await app.inject({ method: 'GET', url: '/readyz' })
  expect(jawaban.statusCode).toBe(503)
  expect(jawaban.json().status).toBe('menyala')
})

test('/readyz menjawab 200 setelah siap', async () => {
  keadaan.siap = true
  keadaan.menutup = false

  const jawaban = await app.inject({ method: 'GET', url: '/readyz' })
  expect(jawaban.statusCode).toBe(200)
  expect(jawaban.json().database).toBe('ok')
})

test('/readyz menjawab 503 saat menutup, sementara /healthz tetap 200', async () => {
  keadaan.siap = true
  keadaan.menutup = true

  const siap = await app.inject({ method: 'GET', url: '/readyz' })
  expect(siap.statusCode).toBe(503)
  expect(siap.json().status).toBe('menutup')

  /*
   * Inilah pembedaan yang membuat keduanya layak dipisahkan.
   *
   * Proses yang sedang menyelesaikan permintaan terakhirnya memang HIDUP.
   * Menjawab 503 di liveness akan mengundang pemantau membunuhnya lebih cepat
   * daripada ia sempat selesai — persis kebalikan dari yang diinginkan.
   */
  const hidup = await app.inject({ method: 'GET', url: '/healthz' })
  expect(hidup.statusCode).toBe(200)

  keadaan.menutup = false
})

test('kesiapan tidak menyentuh basis data saat sedang menutup', async () => {
  /*
   * Urutan pemeriksaannya penting: proses yang menutup DAN basis datanya
   * sedang tidak terjangkau harus tetap menjawab cepat. Menunggu timeout
   * koneksi di sini menahan penutupan tanpa memberi informasi apa pun —
   * jawabannya sudah pasti 503.
   */
  keadaan.siap = true
  keadaan.menutup = true

  const mulai = Date.now()
  const jawaban = await app.inject({ method: 'GET', url: '/readyz' })
  const lama = Date.now() - mulai

  expect(jawaban.json().database).toBe('tidak diperiksa')
  expect(lama).toBeLessThan(100)

  keadaan.menutup = false
})

// ── Siaran pembatalan izin lintas proses ────────────────────────────────────

test('pembatalan yang disiarkan satu koneksi sampai ke cache koneksi lain', async () => {
  /*
   * Dua cache terpisah meniru dua proses. Yang diuji adalah bahwa pembatalan
   * di satu sisi benar-benar membersihkan sisi lain — tanpa ini, mode cluster
   * berarti izin yang dicabut tetap berlaku sampai TTL habis di instance yang
   * tidak menanganinya.
   */
  const cacheB = createPermissionCache()
  const pendengarB = await pasangPendengarCacheIzin(appPool, cacheB)

  const userId = randomUUID()
  const companyId = randomUUID()
  const kunci = `${userId}:${companyId}`

  cacheB.set(kunci, {
    value: { access: null, granted: [], accessibleCompanyIds: [] } as never,
    expiresAt: Date.now() + 60_000,
  })
  expect(cacheB.has(kunci)).toBe(true)

  // Disiarkan dari koneksi lain, seperti proses lain akan melakukannya.
  const klien = await appPool.connect()
  try {
    await siarkanPembatalan(klien, userId, companyId)
  } finally {
    klien.release()
  }

  await tunggu(() => !cacheB.has(kunci))
  expect(cacheB.has(kunci)).toBe(false)

  await pendengarB.tutup()
})

test('siaran tanpa company membuang seluruh entri pengguna itu', async () => {
  const cacheB = createPermissionCache()
  const pendengarB = await pasangPendengarCacheIzin(appPool, cacheB)

  const userId = randomUUID()
  const lain = randomUUID()
  const isi = { value: {} as never, expiresAt: Date.now() + 60_000 }

  cacheB.set(`${userId}:${randomUUID()}`, isi)
  cacheB.set(`${userId}:${randomUUID()}`, isi)
  cacheB.set(`${lain}:${randomUUID()}`, isi)

  const klien = await appPool.connect()
  try {
    await siarkanPembatalan(klien, userId)
  } finally {
    klien.release()
  }

  await tunggu(() => cacheB.size === 1)

  // Entri pengguna lain tidak ikut terbuang. Pembatalan yang terlalu luas
  // aman, tetapi membuang cache orang lain di setiap perubahan akses akan
  // menghapus gunanya cache ini sama sekali.
  expect(cacheB.size).toBe(1)
  expect([...cacheB.keys()][0]!.startsWith(`${lain}:`)).toBe(true)

  await pendengarB.tutup()
})

test('siaran di dalam transaksi TIDAK sampai sebelum commit', async () => {
  /*
   * Ini jaminan yang membuat seluruh mekanisme benar, dan yang paling mudah
   * dirusak tanpa sadar.
   *
   * Bila pemberitahuan sampai sebelum perubahan aksesnya commit, proses lain
   * membuang cache-nya, membaca ulang izin yang BELUM berubah, dan
   * menyimpannya kembali. Hasilnya lebih buruk daripada tidak menyiarkan:
   * entri basi yang baru disegarkan bertahan satu TTL penuh sejak commit.
   */
  const cacheB = createPermissionCache()
  const pendengarB = await pasangPendengarCacheIzin(appPool, cacheB)

  const userId = randomUUID()
  const companyId = randomUUID()
  const kunci = `${userId}:${companyId}`
  cacheB.set(kunci, { value: {} as never, expiresAt: Date.now() + 60_000 })

  const klien = await appPool.connect()
  try {
    await klien.query('BEGIN')
    await siarkanPembatalan(klien, userId, companyId)

    // Masih di dalam transaksi: pemberitahuan belum boleh sampai ke mana pun.
    await new Promise((selesai) => setTimeout(selesai, 200))
    expect(cacheB.has(kunci), 'siaran bocor sebelum commit').toBe(true)

    await klien.query('COMMIT')
  } finally {
    klien.release()
  }

  await tunggu(() => !cacheB.has(kunci))
  expect(cacheB.has(kunci)).toBe(false)

  await pendengarB.tutup()
})

/** Menunggu sampai `syarat` terpenuhi, atau menyerah. */
async function tunggu(syarat: () => boolean, batasMs = 3000): Promise<void> {
  const akhir = Date.now() + batasMs
  while (Date.now() < akhir) {
    if (syarat()) return
    await new Promise((selesai) => setTimeout(selesai, 25))
  }
}
