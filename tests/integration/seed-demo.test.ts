import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import type { DashboardSummary } from '#application/queries'
import { createAppServices } from '#composition/http'
import { buildHttpApp, type PaaduServer } from '#interface/http/app'

import { FakeBreachList, FakeMailer } from './harness.js'

// @ts-expect-error — alat, bukan bagian aplikasi. Tidak punya deklarasi tipe.
import { seedDemo } from '../../tools/seed/demo.js'

/**
 * `seed:demo` — angkanya harus berjumlah.
 *
 * Ini satu-satunya persyaratan yang tidak dapat diperiksa dengan melihat layar.
 * Dasbor menghitung dari data ini, jadi data yang tidak konsisten menghasilkan
 * demo yang angkanya saling bertentangan di depan calon pelanggan — dan yang
 * pertama menyadarinya biasanya orang keuangan yang sedang dijual produk.
 *
 * Yang diuji: seed berjalan sampai selesai, jurnalnya seimbang, dan angka yang
 * dibaca dasbor sama dengan yang dilaporkan seed.
 */

let admin: Pool
let appPool: Pool
let app: PaaduServer
let hasil: {
  tenantId: string
  ringkasan: readonly {
    company: { id: string; nama: string; bulanAwalFiskal: number }
    jumlahFaktur: number
    totalPendapatan: number
    piutangBeredar: number
    menungguPersetujuan: number
  }[]
  akun: readonly { email: string; nama: string; jabatan: string }[]
  kataSandi: string
}
let token: string

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

  hasil = await seedDemo(connectionString)

  const masuk = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: hasil.akun[0]!.email, password: hasil.kataSandi },
  })
  expect(masuk.statusCode).toBe(200)
  token = masuk.json().data.access_token as string
}, 180_000)

afterAll(async () => {
  await app.close()
  await appPool.end()
  await admin.end()
})

async function dasbor(companyId: string): Promise<DashboardSummary> {
  const jawaban = await app.inject({
    method: 'GET',
    url: `/v1/companies/${companyId}/dashboard`,
    headers: { authorization: `Bearer ${token}` },
  })
  expect(jawaban.statusCode).toBe(200)
  return jawaban.json().data as DashboardSummary
}

test('akun demo dapat dipakai masuk, dan ketiganya memakai kata sandi yang sama', async () => {
  expect(hasil.akun).toHaveLength(3)

  for (const akun of hasil.akun) {
    const jawaban = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: akun.email, password: hasil.kataSandi },
    })
    // Kredensial yang dicetak seed harus benar-benar bekerja. Kalau tidak,
    // yang kehilangan akses adalah orang yang sedang berdiri di depan calon
    // pelanggan.
    expect(jawaban.statusCode, `${akun.email} gagal masuk`).toBe(200)
  }
})

test('setiap jurnal yang dibuat seed seimbang', async () => {
  const { rows } = await admin.query<{ journal_id: string; selisih: string }>(
    `SELECT j.id AS journal_id, SUM(l.debit) - SUM(l.credit) AS selisih
       FROM journals j
       JOIN journal_lines l ON l.tenant_id = j.tenant_id AND l.journal_id = j.id
      WHERE j.tenant_id = $1
      GROUP BY j.id
     HAVING SUM(l.debit) <> SUM(l.credit)`,
    [hasil.tenantId],
  )

  expect(rows, 'ada jurnal yang tidak seimbang').toEqual([])
})

test('pendapatan yang dibaca dasbor sama dengan yang dilaporkan seed', async () => {
  for (const baris of hasil.ringkasan) {
    const data = await dasbor(baris.company.id)

    // Jumlah seluruh bulan di sumbu dasbor = pendapatan kumulatif dari seed.
    // Keduanya dihitung dengan cara berbeda — satu dari jurnal lewat SQL, satu
    // dari akumulasi saat menulis — jadi kesamaannya bukan tautologi.
    const jumlahSumbu = data.months.reduce((jumlah, bulan) => jumlah + bulan.revenue, 0)
    expect(jumlahSumbu, `${baris.company.nama}: sumbu dasbor`).toBe(baris.totalPendapatan)

    const piutang = data.kpis.find((kartu) => kartu.id === 'piutang')!
    expect(piutang.value, `${baris.company.nama}: piutang`).toBe(baris.piutangBeredar)

    const menunggu = data.kpis.find((kartu) => kartu.id === 'menunggu')!
    expect(menunggu.value, `${baris.company.nama}: menunggu persetujuan`).toBe(
      baris.menungguPersetujuan,
    )
  }
})

test('dua belas bulan terisi seluruhnya, dengan tren yang tumbuh', async () => {
  const data = await dasbor(hasil.ringkasan[0]!.company.id)

  expect(data.months).toHaveLength(12)
  for (const bulan of data.months) {
    expect(bulan.revenue, `bulan ${bulan.month} kosong`).toBeGreaterThan(0)
  }

  // Tumbuh secara keseluruhan, bukan naik setiap bulan — musiman membuat
  // beberapa bulan turun, dan grafik yang naik lurus dua belas kali terlihat
  // seperti data karangan. Yang memang benar, tetapi tidak perlu terlihat.
  const paruhAwal = data.months.slice(0, 6).reduce((jumlah, bulan) => jumlah + bulan.revenue, 0)
  const paruhAkhir = data.months.slice(6).reduce((jumlah, bulan) => jumlah + bulan.revenue, 0)
  expect(paruhAkhir).toBeGreaterThan(paruhAwal)
})

test('faktur ada di berbagai status, dan draf tidak pernah bernomor', async () => {
  const companyId = hasil.ringkasan[0]!.company.id

  const { rows } = await admin.query<{ lifecycle_status: string; jumlah: string; tanpa_nomor: string }>(
    `SELECT lifecycle_status,
            count(*) AS jumlah,
            count(*) FILTER (WHERE number IS NULL) AS tanpa_nomor
       FROM sales_documents
      WHERE tenant_id = $1 AND company_id = $2
      GROUP BY lifecycle_status`,
    [hasil.tenantId, companyId],
  )

  const perStatus = new Map(rows.map((row) => [row.lifecycle_status, row]))
  expect(perStatus.has('posted')).toBe(true)
  expect(perStatus.has('draft')).toBe(true)
  expect(perStatus.has('submitted')).toBe(true)
  expect(perStatus.has('pending_approval')).toBe(true)

  // Nomor diberikan saat submit, bukan saat draf dibuat — D-007. Draf bernomor
  // adalah hal yang paling cepat terlihat salah oleh orang keuangan.
  expect(Number(perStatus.get('draft')!.tanpa_nomor)).toBe(
    Number(perStatus.get('draft')!.jumlah),
  )
  expect(Number(perStatus.get('posted')!.tanpa_nomor)).toBe(0)
})

test('pembelian punya penerimaan sebagian dan satu tagihan exception', async () => {
  const companyId = hasil.ringkasan[0]!.company.id

  const { rows: sebagian } = await admin.query<{ jumlah: string }>(
    `SELECT count(*) AS jumlah
       FROM purchase_document_lines
      WHERE tenant_id = $1 AND company_id = $2
        AND qty_received > 0 AND qty_received < qty`,
    [hasil.tenantId, companyId],
  )
  expect(Number(sebagian[0]!.jumlah)).toBeGreaterThan(0)

  const { rows: exception } = await admin.query<{ jumlah: string }>(
    `SELECT count(*) AS jumlah
       FROM purchase_documents
      WHERE tenant_id = $1 AND company_id = $2
        AND doc_type = 'bill' AND match_status = 'exception'`,
    [hasil.tenantId, companyId],
  )
  expect(Number(exception[0]!.jumlah)).toBe(1)
})

test('menolak berjalan dua kali, alih-alih menimpa jurnal', async () => {
  // Jurnal append-only. Seed yang "membersihkan lebih dulu" menuntut hak DELETE
  // yang seluruh sistem ini dibangun untuk menolak.
  await expect(seedDemo(process.env.TEST_DATABASE_URL)).rejects.toThrow(/sudah ada/i)
})

test('kedua company punya tahun fiskal berbeda', () => {
  const bulan = hasil.ringkasan.map((baris) => baris.company.bulanAwalFiskal)
  expect(new Set(bulan).size).toBe(2)
})
