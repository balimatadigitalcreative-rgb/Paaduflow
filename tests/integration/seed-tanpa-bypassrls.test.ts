import { randomUUID } from 'node:crypto'

import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { jelaskanKekurangan, pasangKonteks, periksaKemampuan } from '../../tools/seed/konteks.js'
import { seed } from '../../tools/seed/pengembangan.js'

/**
 * Seed tidak menuntut kredensial pemilik basis data.
 *
 * Mengisi data contoh adalah pekerjaan biasa. Menuntut BYPASSRLS untuk itu
 * berarti setiap orang yang ingin menjalankan demo harus memegang kredensial
 * yang dapat membaca dan menulis seluruh tenant di server — hak yang jauh
 * lebih besar daripada pekerjaannya.
 *
 * Kedua seed sebelumnya memang begitu, dan tidak pernah ketahuan karena
 * seluruh uji menyemai lewat koneksi superuser. Titik buta yang sama dengan
 * D-148: RLS dilewati, jadi kebijakannya tidak pernah benar-benar diuji.
 */

let admin: Pool
let peranTerbatas: string

function sebagaiPeran(peran: string): string {
  const dasar = process.env.TEST_DATABASE_URL ?? ''
  return `${dasar}${dasar.includes('?') ? '&' : '?'}options=-c%20role%3D${peran}`
}

beforeAll(async () => {
  admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL })

  // Peran yang boleh membaca tetapi tidak boleh menulis. Dipakai membuktikan
  // bahwa pemeriksaan awal benar-benar menangkap kekurangan hak.
  peranTerbatas = `seed_terbatas_${randomUUID().slice(0, 8)}`
  await admin.query(`CREATE ROLE ${peranTerbatas} NOLOGIN NOINHERIT`)
  await admin.query(`GRANT USAGE ON SCHEMA public, paadu TO ${peranTerbatas}`)
  await admin.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${peranTerbatas}`)
  await admin.query(`GRANT ${peranTerbatas} TO CURRENT_USER`)
}, 120_000)

afterAll(async () => {
  await admin.query(`REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM ${peranTerbatas}`)
  await admin.query(`REVOKE USAGE ON SCHEMA public, paadu FROM ${peranTerbatas}`)
  await admin.query(`DROP ROLE IF EXISTS ${peranTerbatas}`)
  await admin.end()
})

test('peran aplikasi memang tidak punya BYPASSRLS', async () => {
  const app = new Pool({ connectionString: process.env.TEST_DATABASE_URL, options: '-c role=paadu_app' })
  try {
    const { rows } = await app.query<{ peran: string; bypassrls: boolean }>(
      `SELECT current_user AS peran,
              (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypassrls`,
    )
    // Kalau ini gagal, seluruh berkas ini berhenti membuktikan apa pun.
    expect(rows[0]!.peran).toBe('paadu_app')
    expect(rows[0]!.bypassrls).toBe(false)
  } finally {
    await app.end()
  }
})

test('seed:dev berjalan penuh sebagai peran aplikasi', async () => {
  // Seed menolak tanpa `SEED_PASSWORD`. Yang diuji di sini adalah hak akses,
  // bukan kata sandinya.
  process.env.SEED_PASSWORD ??= 'sandi seed untuk pengujian'

  const hasil = await seed(sebagaiPeran('paadu_app'))

  expect(hasil.tenantId).toBeTruthy()
  expect(hasil.companies).toHaveLength(2)
  expect(hasil.kataSandi).toBeTruthy()

  // Data benar-benar tertulis, bukan sekadar tidak melempar galat.
  const { rows } = await admin.query<{ jumlah: string }>(
    `SELECT count(*) AS jumlah FROM companies WHERE tenant_id = $1`,
    [hasil.tenantId],
  )
  expect(Number(rows[0]!.jumlah)).toBe(2)
}, 180_000)

test('konteks tenant dipasang sebagai SET LOCAL, bukan menempel di koneksi', async () => {
  /*
   * Diuji langsung pada mekanismenya, bukan lewat seed.
   *
   * Konteks yang menempel pada KONEKSI akan terbawa ke pekerjaan berikutnya
   * yang kebetulan mendapat koneksi yang sama dari kolam. Itu kelas bug yang
   * tidak pernah muncul di pengembangan dan selalu muncul di produksi, dan
   * satu-satunya yang mencegahnya adalah argumen ketiga `set_config`.
   */
  const app = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    options: '-c role=paadu_app',
    max: 1,
  })

  try {
    const klien = await app.connect()
    try {
      await klien.query('BEGIN')
      await pasangKonteks(klien, { tenantId: randomUUID() })

      const { rows: didalam } = await klien.query<{ tenant: string }>(
        `SELECT current_setting('app.tenant_id', true) AS tenant`,
      )
      expect(didalam[0]!.tenant).toBeTruthy()

      await klien.query('COMMIT')

      // Transaksi selesai — konteksnya harus ikut hilang. Kolam dibatasi satu
      // koneksi, jadi ini benar-benar koneksi yang sama.
      const { rows: sesudah } = await klien.query<{ tenant: string | null }>(
        `SELECT current_setting('app.tenant_id', true) AS tenant`,
      )
      expect(sesudah[0]!.tenant === null || sesudah[0]!.tenant === '').toBe(true)
    } finally {
      klien.release()
    }
  } finally {
    await app.end()
  }
})

test('kekurangan hak dijelaskan di awal, bukan sebagai galat RLS mentah', async () => {
  const terbatas = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    options: `-c role=${peranTerbatas}`,
  })

  try {
    const klien = await terbatas.connect()
    try {
      const hasil = await periksaKemampuan(klien)
      const pesan = jelaskanKekurangan(hasil, 'npm run seed:dev')

      expect(hasil.peran).toBe(peranTerbatas)
      expect(hasil.bypassRls).toBe(false)
      expect(hasil.tabelTanpaInsert.length).toBeGreaterThan(0)

      // Pesannya harus menyebut tiga hal: peran yang dipakai, tabel yang
      // ditolak, dan perintah yang memperbaikinya. Pesan yang hanya menyebut
      // kegagalan memaksa pembacanya menebak langkah berikutnya.
      expect(pesan).toContain(peranTerbatas)
      expect(pesan).toContain('tenants')
      expect(pesan).toContain('GRANT INSERT')
      expect(pesan).not.toMatch(/row-level security/i)
    } finally {
      klien.release()
    }
  } finally {
    await terbatas.end()
  }
})
