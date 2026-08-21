import { randomUUID } from 'node:crypto'

import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import type { ProfitLossReport } from '#application/queries'
import { createAppServices } from '#composition/http'
import { buildHttpApp, type PaaduServer } from '#interface/http/app'

import { FakeBreachList, FakeMailer, VALID_PASSWORD } from './harness.js'

/**
 * Laba rugi — Flow_Archetypes 6.
 *
 * Yang diuji bukan tampilannya melainkan tiga hal yang membuat laporan ini
 * layak dicetak dan diedarkan:
 *
 * 1. Tandanya benar per jenis akun. Pendapatan bertambah di kredit, beban di
 *    debit; menyamakan keduanya membuat seluruh pendapatan tampil negatif.
 * 2. Periode membatasi. Jurnal di luar rentang tidak boleh ikut terhitung —
 *    kesalahan yang menghasilkan laporan yang selalu terlihat wajar.
 * 3. Perbandingan periode dibaca dari keadaan yang SAMA dengan periode utama.
 */

let admin: Pool
let appPool: Pool
let app: PaaduServer

let tenantId: string
let companyId: string
let token: string

async function jurnal(bulan: string, baris: readonly { akun: string; debit: number; credit: number }[]) {
  const klien = await admin.connect()
  try {
    await klien.query('BEGIN')
    const journalId = randomUUID()
    await klien.query(
      `INSERT INTO journals
         (id, tenant_id, company_id, journal_date, fiscal_year, fiscal_period, type,
          description, currency)
       VALUES ($1, $2, $3, ($4 || '-15')::date, $5, $6, 'manual', 'Uji laba rugi', 'IDR')`,
      [journalId, tenantId, companyId, bulan, Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7))],
    )
    for (const [nomor, satu] of baris.entries()) {
      await klien.query(
        `INSERT INTO journal_lines
           (id, tenant_id, journal_id, line_no, account_id, debit, credit, currency)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'IDR')`,
        [randomUUID(), tenantId, journalId, nomor + 1, satu.akun, satu.debit, satu.credit],
      )
    }
    await klien.query('COMMIT')
  } catch (kesalahan) {
    await klien.query('ROLLBACK')
    throw kesalahan
  } finally {
    klien.release()
  }
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
  tenantId = randomUUID()
  companyId = randomUUID()

  await admin.query(`INSERT INTO tenants (id, name, slug, region) VALUES ($1, $2, $3, 'id-jkt')`, [
    tenantId,
    'Grup Laba Rugi',
    `lr-${tanda}`,
  ])
  await admin.query(
    `INSERT INTO companies (id, tenant_id, legal_name, slug, default_currency)
     VALUES ($1, $2, 'PT Uji Laba Rugi', $3, 'IDR')`,
    [companyId, tenantId, `lr-${tanda}`],
  )

  // Satu induk beban dengan dua anak — hierarki yang dapat dilipat.
  const id = {
    pendapatan: randomUUID(),
    beban: randomUUID(),
    gaji: randomUUID(),
    sewa: randomUUID(),
    kas: randomUUID(),
  }
  await admin.query(
    `INSERT INTO accounts (id, tenant_id, company_id, code, name, type, is_control, parent_id)
     VALUES ($1, $6, $7, '4-1000', 'Pendapatan Penjualan', 'revenue', false, NULL),
            ($2, $6, $7, '6-0000', 'Beban Operasional', 'expense', false, NULL),
            ($3, $6, $7, '6-1000', 'Gaji dan Tunjangan', 'expense', false, $2),
            ($4, $6, $7, '6-2000', 'Sewa dan Utilitas', 'expense', false, $2),
            ($5, $6, $7, '1-1000', 'Kas dan Bank', 'asset', false, NULL)`,
    [id.pendapatan, id.beban, id.gaji, id.sewa, id.kas, tenantId, companyId],
  )

  const email = `lr-${tanda}@paaduflow.test`
  const daftar = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password: VALID_PASSWORD, full_name: 'Akuntan' },
  })
  expect(daftar.statusCode).toBe(202)
  const { rows } = await admin.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email])
  await admin.query(
    `INSERT INTO company_access (id, tenant_id, company_id, user_id, role_id)
     SELECT $1, $2, $3, $4, id FROM roles WHERE key = 'tenant_owner' AND tenant_id IS NULL`,
    [randomUUID(), tenantId, companyId, rows[0]!.id],
  )
  const masuk = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password: VALID_PASSWORD },
  })
  token = masuk.json().data.access_token as string

  /*
   * Setiap jurnal berimbang sendiri. Trigger menolak yang tidak, dan itu
   * memang gunanya — jurnal tak berimbang di data uji akan menghasilkan
   * laporan yang tidak dapat dipercaya sekaligus uji yang lolos.
   *
   * Agustus: pendapatan bruto 100jt, retur 40jt (neto 60jt), gaji 30jt,
   * sewa 10jt.
   */
  await jurnal('2026-08', [
    { akun: id.kas, debit: 100_000_000, credit: 0 },
    { akun: id.pendapatan, debit: 0, credit: 100_000_000 },
  ])
  await jurnal('2026-08', [
    { akun: id.pendapatan, debit: 40_000_000, credit: 0 },
    { akun: id.kas, debit: 0, credit: 40_000_000 },
  ])
  await jurnal('2026-08', [
    { akun: id.gaji, debit: 30_000_000, credit: 0 },
    { akun: id.sewa, debit: 10_000_000, credit: 0 },
    { akun: id.kas, debit: 0, credit: 40_000_000 },
  ])

  // Juli: pendapatan 80jt, gaji 30jt, sewa 50jt.
  await jurnal('2026-07', [
    { akun: id.kas, debit: 80_000_000, credit: 0 },
    { akun: id.pendapatan, debit: 0, credit: 80_000_000 },
  ])
  await jurnal('2026-07', [
    { akun: id.gaji, debit: 30_000_000, credit: 0 },
    { akun: id.sewa, debit: 50_000_000, credit: 0 },
    { akun: id.kas, debit: 0, credit: 80_000_000 },
  ])
})

afterAll(async () => {
  await app.close()
  await appPool.end()
  await admin.end()
})

async function laporan(dari: string, sampai: string, banding?: [string, string]) {
  const kueri = new URLSearchParams({ from: dari, to: sampai })
  if (banding !== undefined) {
    kueri.set('compare_from', banding[0])
    kueri.set('compare_to', banding[1])
  }
  const jawaban = await app.inject({
    method: 'GET',
    url: `/v1/companies/${companyId}/reports/profit-loss?${kueri.toString()}`,
    headers: { authorization: `Bearer ${token}` },
  })
  expect(jawaban.statusCode, jawaban.body).toBe(200)
  return jawaban.json().data as ProfitLossReport
}

test('tanda dihitung per jenis akun, bukan seragam', async () => {
  const data = await laporan('2026-08-01', '2026-08-31')

  const pendapatan = data.rows.find((row) => row.code === '4-1000')!
  const gaji = data.rows.find((row) => row.code === '6-1000')!

  /*
   * Pendapatan = kredit - debit. 100jt kredit dikurangi 40jt debit = 60jt,
   * dan hasilnya POSITIF. Memakai `debit - credit` untuk semua akun akan
   * memberi -60jt, dan seluruh laporan tampil terbalik.
   */
  expect(pendapatan.amount).toBe(60_000_000)
  expect(gaji.amount).toBe(30_000_000)
})

test('periode benar-benar membatasi', async () => {
  const agustus = await laporan('2026-08-01', '2026-08-31')
  const juli = await laporan('2026-07-01', '2026-07-31')

  // Sewa berbeda jauh antar bulan; kalau periodenya tidak membatasi, keduanya
  // akan sama dan tidak ada yang menyadarinya karena angkanya tetap wajar.
  expect(agustus.rows.find((row) => row.code === '6-2000')!.amount).toBe(10_000_000)
  expect(juli.rows.find((row) => row.code === '6-2000')!.amount).toBe(50_000_000)
})

test('perbandingan periode datang dalam satu jawaban', async () => {
  const data = await laporan('2026-08-01', '2026-08-31', ['2026-07-01', '2026-07-31'])

  expect(data.comparison).not.toBeNull()
  const sewa = data.rows.find((row) => row.code === '6-2000')!
  expect(sewa.amount).toBe(10_000_000)
  expect(sewa.comparison).toBe(50_000_000)
})

test('tanpa parameter pembanding, kolomnya null — bukan nol', async () => {
  const data = await laporan('2026-08-01', '2026-08-31')

  expect(data.comparison).toBeNull()
  for (const row of data.rows) {
    // Nol berarti "tidak ada transaksi di periode pembanding". Null berarti
    // "tidak ada periode pembanding". Menyamakannya membuat kolom selisih
    // menampilkan angka yang tidak dibandingkan dengan apa pun.
    expect(row.comparison).toBeNull()
  }
})

test('seluruh akun dikembalikan, termasuk yang nol', async () => {
  // Akun yang hilang dari laporan tidak dapat dibedakan dari akun yang tidak
  // ada, dan akuntan yang mencari beban yang seharusnya muncul akan
  // menyimpulkan jurnalnya belum masuk.
  const data = await laporan('2026-09-01', '2026-09-30')

  expect(data.rows).toHaveLength(4)
  for (const row of data.rows) expect(row.amount).toBe(0)
})

test('hierarki akun ikut dikirim, sehingga baris dapat dilipat', async () => {
  const data = await laporan('2026-08-01', '2026-08-31')

  const gaji = data.rows.find((row) => row.code === '6-1000')!
  const induk = data.rows.find((row) => row.code === '6-0000')!

  expect(gaji.parentId).toBe(induk.accountId)
  expect(induk.parentId).toBeNull()
})

test('header laporan membawa konteks yang ikut tercetak', async () => {
  const data = await laporan('2026-08-01', '2026-08-31')

  // Laporan dicetak dan diedarkan; tanpa keempatnya ia tidak dapat
  // dipertanggungjawabkan (Flow_Archetypes 6).
  expect(data.currency).toBe('IDR')
  expect(data.period.label).toBe('Agustus 2026')
  expect(data.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
})

test('setiap baris membawa accountId untuk ditelusuri ke buku besar', async () => {
  const data = await laporan('2026-08-01', '2026-08-31')

  /*
   * Ini yang membuat penelusuran mulus: baris laporan tahu akunnya, dan buku
   * besar menerima akun lewat segmen path. Tanpa accountId, satu-satunya jalan
   * dari laporan ke transaksinya adalah mencari sendiri di daftar akun.
   */
  for (const row of data.rows) {
    expect(row.accountId).toMatch(/^[0-9a-f-]{36}$/)
  }

  const { rows: cocok } = await admin.query<{ jumlah: string }>(
    `SELECT count(*) AS jumlah FROM accounts
      WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
    [tenantId, data.rows.map((row) => row.accountId)],
  )
  expect(Number(cocok[0]!.jumlah)).toBe(data.rows.length)
})
