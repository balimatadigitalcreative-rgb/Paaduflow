import { randomUUID } from 'node:crypto'

import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import type { DashboardSummary } from '#application/queries'
import { createAppServices } from '#composition/http'
import { buildHttpApp, type PaaduServer } from '#interface/http/app'

import { FakeBreachList, FakeMailer, VALID_PASSWORD } from './harness.js'

/**
 * Dasbor — angka yang ditampilkan harus angka yang benar.
 *
 * Yang diuji di sini bukan tampilannya, melainkan tiga klaim yang membuat
 * dasbor layak dipercaya:
 *
 * 1. Pendapatan datang dari BUKU BESAR, bukan dari kolom total dokumen. Faktur
 *    draf tidak boleh ikut terhitung — dasbor yang melebih-lebihkan pendapatan
 *    lebih berbahaya daripada dasbor yang kosong.
 * 2. Sumbu dua belas bulan memuat bulan yang tidak punya transaksi. Bulan yang
 *    hilang akan memampatkan grafik dan membuat tren terlihat lebih mulus
 *    daripada kenyataannya.
 * 3. Setiap kartu KPI membawa basis pembanding dan jalur ke rinciannya —
 *    Component_Specs_Composite §8.
 */

let admin: Pool
let appPool: Pool
let app: PaaduServer

let tenantId: string
let companyId: string
let token: string
let akunPendapatan: string
let akunPiutang: string

/** Kunci bulan `YYYY-MM`, digeser mundur dari hari ini. */
function bulanLalu(mundur: number): string {
  const sekarang = new Date()
  const tanggal = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth() - mundur, 1))
  return tanggal.toISOString().slice(0, 7)
}

async function buatJurnal(bulan: string, nominal: number): Promise<void> {
  const journalId = randomUUID()

  /*
   * Jurnal dan barisnya dalam SATU transaksi.
   *
   * Ada trigger constraint yang menolak jurnal tanpa baris, dan ia benar:
   * jurnal kosong adalah jurnal yang tidak seimbang. Menyisipkan keduanya lewat
   * dua panggilan pool berarti dua transaksi, dan yang pertama akan ditolak
   * sebelum yang kedua sempat berjalan.
   */
  const klien = await admin.connect()
  try {
    await klien.query('BEGIN')
    await klien.query(
      `INSERT INTO journals
         (id, tenant_id, company_id, journal_date, fiscal_year, fiscal_period,
          type, description, currency)
       VALUES ($1, $2, $3, ($4 || '-15')::date, $5, $6, 'manual', 'Uji dasbor', 'IDR')`,
      [journalId, tenantId, companyId, bulan, Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7))],
    )

    // Debit piutang, kredit pendapatan. Berpasangan, supaya uji ini tidak
    // diam-diam menciptakan jurnal yang tidak seimbang.
    await klien.query(
      `INSERT INTO journal_lines
         (id, tenant_id, journal_id, line_no, account_id, debit, credit, currency)
       VALUES ($1, $2, $3, 1, $4, $5, 0, 'IDR'), ($6, $2, $3, 2, $7, 0, $5, 'IDR')`,
      [randomUUID(), tenantId, journalId, akunPiutang, nominal, randomUUID(), akunPendapatan],
    )
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
    'Grup Dasbor',
    `dasbor-${tanda}`,
  ])
  await admin.query(
    `INSERT INTO companies (id, tenant_id, legal_name, slug, default_currency)
     VALUES ($1, $2, 'PT Nusantara Dasbor', $3, 'IDR')`,
    [companyId, tenantId, `dasbor-${tanda}`],
  )

  akunPendapatan = randomUUID()
  akunPiutang = randomUUID()
  await admin.query(
    `INSERT INTO accounts (id, tenant_id, company_id, code, name, type, is_control)
     VALUES ($1, $2, $3, '4-1000', 'Pendapatan Penjualan', 'revenue', false),
            ($4, $2, $3, '1-1300', 'Piutang Usaha', 'asset', false)`,
    [akunPendapatan, tenantId, companyId, akunPiutang],
  )

  const email = `dasbor-${tanda}@paaduflow.test`
  const daftar = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password: VALID_PASSWORD, full_name: 'Pengguna Dasbor' },
  })
  expect(daftar.statusCode).toBe(202)

  const { rows } = await admin.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [
    email,
  ])
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

  // Bulan ini dan bulan lalu terisi; bulan sebelumnya sengaja DIBIARKAN kosong,
  // supaya klaim kedua benar-benar diuji.
  await buatJurnal(bulanLalu(0), 15_000_000)
  await buatJurnal(bulanLalu(1), 12_000_000)
})

afterAll(async () => {
  await app.close()
  await appPool.end()
  await admin.end()
})

async function dasbor(): Promise<DashboardSummary> {
  const jawaban = await app.inject({
    method: 'GET',
    url: `/v1/companies/${companyId}/dashboard`,
    headers: { authorization: `Bearer ${token}` },
  })
  expect(jawaban.statusCode).toBe(200)
  return jawaban.json().data as DashboardSummary
}

test('pendapatan dihitung dari buku besar, bukan dari kolom total dokumen', async () => {
  const data = await dasbor()

  const pendapatan = data.kpis.find((kartu) => kartu.id === 'pendapatan')
  expect(pendapatan).toBeDefined()
  expect(pendapatan!.value).toBe(15_000_000)

  // 15 juta terhadap 12 juta = +25%. Dihitung, bukan dikira-kira.
  expect(pendapatan!.changePercent).toBeCloseTo(25, 6)
  expect(data.currency).toBe('IDR')
})

test('faktur draf tidak ikut terhitung sebagai pendapatan', async () => {
  const sebelum = (await dasbor()).kpis.find((kartu) => kartu.id === 'pendapatan')!.value

  // Dokumen draf bernilai besar. Ia tidak pernah menyentuh buku besar, jadi ia
  // tidak boleh menggeser angka mana pun.
  const customerId = randomUUID()
  await admin.query(
    `INSERT INTO customers (id, tenant_id, company_id, code, name, currency)
     VALUES ($1, $2, $3, $4, 'PT Pelanggan Draf', 'IDR')`,
    [customerId, tenantId, companyId, `CUST-${customerId.slice(0, 8)}`],
  )

  await admin.query(
    `INSERT INTO sales_documents
       (id, tenant_id, company_id, doc_type, customer_id, document_date, currency,
        total, lifecycle_status, settlement_status, fulfillment_status)
     VALUES ($1, $2, $3, 'invoice', $4, CURRENT_DATE, 'IDR',
             900000000, 'draft', 'unpaid', 'not_fulfilled')`,
    [randomUUID(), tenantId, companyId, customerId],
  )

  const sesudah = await dasbor()
  expect(sesudah.kpis.find((kartu) => kartu.id === 'pendapatan')!.value).toBe(sebelum)

  // Piutang beredar juga hanya menghitung yang sudah diposting.
  expect(sesudah.kpis.find((kartu) => kartu.id === 'piutang')!.value).toBe(0)
})

test('sumbu dua belas bulan memuat bulan yang tidak punya transaksi', async () => {
  const data = await dasbor()

  expect(data.months).toHaveLength(12)
  expect(data.months[11]!.month).toBe(bulanLalu(0))
  expect(data.months[0]!.month).toBe(bulanLalu(11))

  // Bulan ketiga dari belakang sengaja tidak diisi. Ia harus tetap ada dengan
  // nilai nol, bukan hilang dari deret.
  expect(data.months[9]!.revenue).toBe(0)
  expect(data.months[11]!.revenue).toBe(15_000_000)
})

test('setiap kartu KPI membawa basis pembanding dan jalur ke rinciannya', async () => {
  const data = await dasbor()

  expect(data.kpis).toHaveLength(4)
  for (const kartu of data.kpis) {
    expect(kartu.comparisonBasis).not.toBe('')
    expect(kartu.href).toMatch(/^#\//)
  }

  /*
   * Piutang yang naik bukan kabar baik meski panahnya ke atas — §8. Nilai ini
   * yang memisahkan warna dari arah, dan salah menyetelnya menghasilkan biaya
   * naik yang tampil hijau.
   */
  expect(data.kpis.find((kartu) => kartu.id === 'piutang')!.higherIsBetter).toBe(false)
  expect(data.kpis.find((kartu) => kartu.id === 'pendapatan')!.higherIsBetter).toBe(true)

  // Jatuh tempo dihitung relatif terhadap hari ini, jadi tidak ada pembanding
  // yang jujur. Null, bukan nol.
  expect(data.kpis.find((kartu) => kartu.id === 'jatuh-tempo')!.changePercent).toBeNull()
})

test('umur piutang dibagi ke ember, dan seluruh ember dikembalikan', async () => {
  const data = await dasbor()

  /*
   * Lima ember, termasuk yang nol. Ember yang hilang membuat grafik berubah
   * bentuk antar company, dan orang membandingkan dua bentuk berbeda seolah
   * keduanya sebanding.
   */
  expect(data.ageing).toHaveLength(5)

  const id = data.ageing.map((ember) => ember.id)
  expect(id).toEqual([
    'belum_tempo',
    'lewat_30',
    'lewat_60',
    'lewat_lebih',
    'tanpa_tempo',
  ])

  // Yang lewat tempo ditandai, dan penandanya dipakai grafik untuk memberi
  // arsir — pembeda kedua di samping warna (WCAG 1.4.1).
  expect(data.ageing.filter((ember) => ember.overdue).map((ember) => ember.id)).toEqual([
    'lewat_30',
    'lewat_60',
    'lewat_lebih',
  ])
})

test('jumlah ember sama dengan piutang beredar di kartu KPI', async () => {
  const data = await dasbor()

  /*
   * Dua angka yang dihitung dengan cara berbeda harus sepakat. Kartu KPI
   * menjumlahkan seluruh faktur belum lunas; ember membaginya menurut umur.
   * Bila keduanya berbeda, salah satunya salah — dan yang salah adalah angka
   * yang dipakai menagih orang.
   */
  const dariEmber = data.ageing.reduce((jumlah, ember) => jumlah + ember.amount, 0)
  const dariKpi = data.kpis.find((kartu) => kartu.id === 'piutang')!.value

  expect(dariEmber).toBe(dariKpi)
})

test('sparkline hanya untuk kartu yang punya riwayat sungguhan', async () => {
  const data = await dasbor()

  // Pendapatan punya dua belas bulan.
  const pendapatan = data.kpis.find((kartu) => kartu.id === 'pendapatan')!
  expect(pendapatan.series).toHaveLength(12)
  expect(pendapatan.series).toEqual(data.months.map((bulan) => bulan.revenue))

  /*
   * Sisanya TIDAK. Yang disimpan adalah keadaan sekarang, bukan posisinya di
   * tiap akhir bulan — sparkline yang digambar dari data yang tidak ada adalah
   * grafik yang berbohong dengan meyakinkan.
   */
  for (const id of ['piutang', 'jatuh-tempo', 'menunggu']) {
    expect(data.kpis.find((kartu) => kartu.id === id)!.series, id).toEqual([])
  }
})
