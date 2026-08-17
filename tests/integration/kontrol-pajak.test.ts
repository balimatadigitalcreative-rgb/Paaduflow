import { randomUUID } from 'node:crypto'

import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { createAppServices } from '#composition/http'
import { buildHttpApp, type PaaduServer } from '#interface/http/app'

import { FakeBreachList, FakeMailer, VALID_PASSWORD } from './harness.js'

/**
 * Kontrol pajak diuji lewat API, bukan lewat layanan.
 *
 * Empat penolakan wajib di Module 08 §12 semuanya ditembak sebagai permintaan
 * HTTP sungguhan: tarif yang diubah, company non-PKP yang menerbitkan, nomor di
 * luar rentang, dan nomor batal yang dipakai ulang.
 *
 * Seluruh angka tarif di berkas ini disuntikkan test. Kode produksi tidak
 * memuat satu pun.
 */

let admin: Pool
let appPool: Pool
let app: PaaduServer

let tenantId: string
let companyPkp: string
let companyNonPkp: string
let customerId: string
let salesDocumentId: string

let tokenAdminTenant: string
let tokenAdminCompany: string

const akun = { ppnKeluaran: randomUUID(), ppnMasukan: randomUUID() }
let kodePpnId: string

async function seedPengguna(email: string): Promise<string> {
  const daftar = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password: VALID_PASSWORD, full_name: 'Pengguna' },
  })
  expect(daftar.statusCode).toBe(202)
  const { rows } = await admin.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email])
  return rows[0]!.id
}

async function masuk(email: string): Promise<string> {
  const jawaban = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password: VALID_PASSWORD },
  })
  expect(jawaban.statusCode).toBe(200)
  return jawaban.json().data.access_token as string
}

async function panggil(
  method: 'POST' | 'GET' | 'PATCH',
  url: string,
  token: string,
  payload?: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const jawaban = await app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': randomUUID() },
    ...(method === 'GET' ? {} : { payload: payload ?? {} }),
  })
  return { status: jawaban.statusCode, body: jawaban.json() as Record<string, unknown> }
}

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL
  admin = new Pool({ connectionString })
  appPool = new Pool({ connectionString, options: '-c role=paadu_app' })

  app = await buildHttpApp({
    services: createAppServices({
      pool: appPool,
      tokenSigningSecret: 'rahasia-uji-yang-panjangnya-cukup-32-karakter',
      mfaEncryptionKeyBase64: Buffer.alloc(32, 5).toString('base64'),
      mailer: new FakeMailer(),
      breachList: new FakeBreachList(),
    }),
  })
  await app.ready()

  tenantId = randomUUID()
  companyPkp = randomUUID()
  companyNonPkp = randomUUID()
  const slug = `pajak-${randomUUID().slice(0, 8)}`

  await admin.query(`INSERT INTO tenants (id, name, slug, region) VALUES ($1, $2, $3, 'id-jkt')`, [
    tenantId,
    'Grup Pajak',
    slug,
  ])
  for (const [id, nama] of [
    [companyPkp, 'pkp'],
    [companyNonPkp, 'nonpkp'],
  ] as const) {
    await admin.query(
      `INSERT INTO companies (id, tenant_id, legal_name, slug, default_currency)
       VALUES ($1, $2, $3, $4, 'IDR')`,
      [id, tenantId, `PT ${nama}`, `${slug}-${nama}`],
    )
  }

  for (const [id, kode, nama, tipe] of [
    [akun.ppnKeluaran, '2100', 'PPN Keluaran', 'liability'],
    [akun.ppnMasukan, '1450', 'PPN Masukan', 'asset'],
  ] as const) {
    await admin.query(
      `INSERT INTO accounts (id, tenant_id, company_id, code, name, type)
       VALUES ($1, $2, $3, $4, $5, $6::account_type)`,
      [id, tenantId, companyPkp, kode, nama, tipe],
    )
  }

  // Hanya satu company yang PKP. Yang satunya sengaja dibiarkan tidak, dan
  // profilnya tetap dibuat supaya "belum PKP" berbeda dari "belum diisi".
  await admin.query(
    `INSERT INTO company_tax_profiles
       (tenant_id, company_id, npwp, is_pkp, pkp_effective_date, nppkp)
     VALUES ($1, $2, '00.000.000.0-000.000', true, DATE '2020-01-01', 'UJI')`,
    [tenantId, companyPkp],
  )
  await admin.query(
    `INSERT INTO company_tax_profiles (tenant_id, company_id, is_pkp) VALUES ($1, $2, false)`,
    [tenantId, companyNonPkp],
  )

  customerId = randomUUID()
  await admin.query(
    `INSERT INTO customers (id, tenant_id, company_id, code, name, tax_id, currency)
     VALUES ($1, $2, $3, 'C-01', 'PT Pembeli', '11.222.333.4-555.000', 'IDR')`,
    [customerId, tenantId, companyPkp],
  )

  salesDocumentId = randomUUID()
  await admin.query(
    `INSERT INTO sales_documents
       (id, tenant_id, company_id, doc_type, customer_id, document_date, currency, total)
     VALUES ($1, $2, $3, 'invoice', $4, DATE '2026-03-01', 'IDR', 1110000)`,
    [salesDocumentId, tenantId, companyPkp, customerId],
  )

  const idAdminTenant = await seedPengguna(`tenant-${slug}@paaduflow.test`)
  const idAdminCompany = await seedPengguna(`company-${slug}@paaduflow.test`)

  for (const [userId, companyId, peran] of [
    [idAdminTenant, companyPkp, 'tenant_admin'],
    [idAdminTenant, companyNonPkp, 'tenant_admin'],
    [idAdminCompany, companyPkp, 'company_admin'],
  ] as const) {
    await admin.query(
      `INSERT INTO company_access (id, tenant_id, company_id, user_id, role_id)
       SELECT $1, $2, $3, $4, id FROM roles WHERE key = $5 AND tenant_id IS NULL`,
      [randomUUID(), tenantId, companyId, userId, peran],
    )
  }

  tokenAdminTenant = await masuk(`tenant-${slug}@paaduflow.test`)
  tokenAdminCompany = await masuk(`company-${slug}@paaduflow.test`)
})

afterAll(async () => {
  await app.close()
  await appPool.end()
  await admin.end()
})

const pkp = () => `/v1/companies/${companyPkp}`

test('kode pajak dibuat lewat versi bertanggal, dan tarifnya datang dari permintaan', async () => {
  const hasil = await panggil('POST', `${pkp()}/tax-codes`, tokenAdminTenant, {
    code: 'PPN-OUT',
    name: 'PPN Keluaran',
    tax_type: 'vat_out',
    rate: 10,
    valid_from: '2022-01-01',
    calculation_base: 'net',
    gl_account_id: akun.ppnKeluaran,
    is_creditable: false,
  })

  expect(hasil.status).toBe(201)
  const data = hasil.body.data as { id: string; superseded_id: string | null }
  // Versi pertama tidak menutup apa pun.
  expect(data.superseded_id).toBeNull()
  kodePpnId = data.id
})

test('versi kedua menutup yang pertama, tanpa menyentuh tarifnya', async () => {
  const hasil = await panggil('POST', `${pkp()}/tax-codes`, tokenAdminTenant, {
    code: 'PPN-OUT',
    name: 'PPN Keluaran',
    tax_type: 'vat_out',
    rate: 11,
    valid_from: '2022-04-01',
    calculation_base: 'net',
    gl_account_id: akun.ppnKeluaran,
    is_creditable: false,
  })

  expect(hasil.status).toBe(201)
  expect((hasil.body.data as { superseded_id: string | null }).superseded_id).toBe(kodePpnId)

  const { rows } = await admin.query<{ rate: string }>(
    `SELECT rate FROM tax_codes WHERE tenant_id = $1 AND id = $2`,
    [tenantId, kodePpnId],
  )
  // Baris lama masih memegang tarif aslinya.
  expect(Number(rows[0]!.rate)).toBe(10)
})

test('daftar kode pajak menampilkan setiap versi beserta masa berlakunya', async () => {
  const hasil = await panggil('GET', `${pkp()}/tax-codes`, tokenAdminTenant)
  expect(hasil.status).toBe(200)

  const versi = (
    hasil.body.data as readonly {
      code: string
      rate: number
      validFrom: string
      validTo: string | null
      glAccountCode: string
    }[]
  ).filter((baris) => baris.code === 'PPN-OUT')

  // Dua baris, bukan satu baris "PPN-OUT" yang menyembunyikan riwayatnya.
  expect(versi).toHaveLength(2)

  // Terurut mundur: yang berlaku sekarang berada di atas.
  expect(versi.map((baris) => baris.rate)).toEqual([11, 10])

  // Versi lama tertutup tepat saat versi baru mulai berlaku — tidak ada hari
  // yang kehilangan tarif, dan tidak ada hari bertarif ganda.
  expect(versi[0]!.validFrom).toBe('2022-04-01')
  expect(versi[0]!.validTo).toBeNull()
  expect(versi[1]!.validFrom).toBe('2022-01-01')
  expect(versi[1]!.validTo).toBe('2022-04-01')

  // Akun buku besarnya keluar sebagai kode yang dapat dibaca, bukan UUID.
  expect(versi[0]!.glAccountCode).toBe('2100')
})

test('Company Admin boleh MELIHAT tarif meski tidak boleh mengubahnya', async () => {
  // Pasangan positif dari penolakan di bawah. Tanpa ini, "tidak boleh mengubah"
  // dapat dipenuhi dengan cara yang salah: menutup halamannya sama sekali.
  const hasil = await panggil('GET', `${pkp()}/tax-codes`, tokenAdminCompany)
  expect(hasil.status).toBe(200)
  expect((hasil.body.data as readonly unknown[]).length).toBeGreaterThan(0)
})

test('NEGATIF · tidak ada endpoint untuk mengubah tarif kode yang sudah ada', async () => {
  // Bukan 403, bukan 422 — 404, karena rutenya memang tidak ada. Kontrol yang
  // paling sulit dilewati adalah kontrol yang tidak punya permukaan.
  for (const [method, url] of [
    ['PATCH', `${pkp()}/tax-codes/${kodePpnId}`],
    ['PATCH', `${pkp()}/tax-codes/${kodePpnId}/rate`],
  ] as const) {
    const jawaban = await panggil(method, url, tokenAdminTenant, { rate: 99 })
    expect(jawaban.status).toBe(404)
  }

  // Dan lewat SQL langsung pun ditolak basis data.
  await expect(
    admin.query(`UPDATE tax_codes SET rate = 99 WHERE tenant_id = $1 AND id = $2`, [
      tenantId,
      kodePpnId,
    ]),
  ).rejects.toThrow(/tidak dapat diubah/)
})

test('NEGATIF · menyisipkan tarif mundur ke belakang versi yang ada ditolak', async () => {
  const hasil = await panggil('POST', `${pkp()}/tax-codes`, tokenAdminTenant, {
    code: 'PPN-OUT',
    name: 'PPN Keluaran',
    tax_type: 'vat_out',
    rate: 5,
    valid_from: '2021-01-01',
    calculation_base: 'net',
    gl_account_id: akun.ppnKeluaran,
    is_creditable: false,
  })

  expect(hasil.status).toBe(422)
  expect((hasil.body.errors as { code: string }[])[0]?.code).toBe('valid_from_not_after_previous')
})

test('NEGATIF · Company Admin tidak boleh mengubah kode dan tarif pajak', async () => {
  // Tarif yang salah menyebar ke seluruh transaksi berikutnya di seluruh
  // company — Module 08 §10. Karena itu izinnya hanya di tingkat tenant.
  const hasil = await panggil('POST', `${pkp()}/tax-codes`, tokenAdminCompany, {
    code: 'PPN-LAIN',
    name: 'Coba',
    tax_type: 'vat_out',
    rate: 1,
    valid_from: '2023-01-01',
    calculation_base: 'net',
    gl_account_id: akun.ppnKeluaran,
    is_creditable: false,
  })

  expect(hasil.status).toBe(403)
})

test('perhitungan memakai tarif pada tanggal dokumen, bukan tanggal hari ini', async () => {
  await admin.query(
    `INSERT INTO tax_determination_rules
       (id, tenant_id, company_id, transaction_type, tax_code)
     VALUES ($1, $2, $3, 'sales.invoice.tax', 'PPN-OUT')`,
    [randomUUID(), tenantId, companyPkp],
  )

  const lama = await panggil('POST', `${pkp()}/tax/calculate`, tokenAdminCompany, {
    transaction_type: 'sales.invoice.tax',
    document_date: '2022-02-15',
    amount: 1_000_000,
    currency: 'IDR',
  })
  const baru = await panggil('POST', `${pkp()}/tax/calculate`, tokenAdminCompany, {
    transaction_type: 'sales.invoice.tax',
    document_date: '2026-02-15',
    amount: 1_000_000,
    currency: 'IDR',
  })

  expect((lama.body.data as { tax: number }).tax).toBe(100_000)
  expect((baru.body.data as { tax: number }).tax).toBe(110_000)
})

test('penguji aturan menjawab kode dan aturan mana yang menang', async () => {
  const hasil = await panggil('POST', `${pkp()}/tax-rules/resolve`, tokenAdminCompany, {
    transaction_type: 'sales.invoice.tax',
    as_of: '2026-02-15',
  })

  expect(hasil.status).toBe(200)
  expect(hasil.body.data).toMatchObject({ tax_code: 'PPN-OUT', specificity: 0, rate: 11 })
})

test('NEGATIF · konteks tanpa aturan MENOLAK, bukan memakai tarif nol', async () => {
  const hasil = await panggil('POST', `${pkp()}/tax/calculate`, tokenAdminCompany, {
    transaction_type: 'sesuatu.yang.tidak_ada',
    document_date: '2026-02-15',
    amount: 1_000_000,
    currency: 'IDR',
  })

  expect(hasil.status).toBe(422)
  expect((hasil.body.errors as { code: string }[])[0]?.code).toBe('rule_not_found')
})

test('NEGATIF · company non-PKP tidak dapat menerbitkan faktur pajak', async () => {
  const hasil = await panggil(
    'POST',
    `/v1/companies/${companyNonPkp}/output-tax-invoices`,
    tokenAdminTenant,
    {
      customer_id: customerId,
      invoice_date: '2026-03-05',
      tax_code_id: kodePpnId,
      base_amount: 1_000_000,
      tax_amount: 110_000,
      sources: [
        { sales_document_id: salesDocumentId, base_amount: 1_000_000, tax_amount: 110_000 },
      ],
    },
  )

  expect(hasil.status).toBe(409)
  expect((hasil.body.errors as { code: string }[])[0]?.code).toBe('company_not_pkp')
})

test('NEGATIF · alokasi nomor seri di luar batas wajar ditolak', async () => {
  const terbalik = await panggil('POST', `${pkp()}/tax-serials`, tokenAdminCompany, {
    prefix: 'FP-',
    digits: 8,
    range_start: 500,
    range_end: 100,
  })
  expect(terbalik.status).toBe(422)
  expect((terbalik.body.errors as { code: string }[])[0]?.code).toBe('range_inverted')

  const raksasa = await panggil('POST', `${pkp()}/tax-serials`, tokenAdminCompany, {
    prefix: 'FP-',
    digits: 8,
    range_start: 1,
    range_end: 9_999_999,
  })
  expect(raksasa.status).toBe(422)
  expect((raksasa.body.errors as { code: string }[])[0]?.code).toBe('range_too_large')
})

test('penerbitan mengambil nomor, dan pembatalan tidak mengembalikannya', async () => {
  const alokasi = await panggil('POST', `${pkp()}/tax-serials`, tokenAdminCompany, {
    prefix: 'FP-',
    digits: 8,
    range_start: 1,
    range_end: 5,
  })
  expect(alokasi.status).toBe(201)

  const draf = await panggil('POST', `${pkp()}/output-tax-invoices`, tokenAdminCompany, {
    customer_id: customerId,
    invoice_date: '2026-03-05',
    tax_code_id: kodePpnId,
    base_amount: 1_000_000,
    tax_amount: 110_000,
    sources: [{ sales_document_id: salesDocumentId, base_amount: 1_000_000, tax_amount: 110_000 }],
  })
  expect(draf.status).toBe(201)
  const fakturId = (draf.body.data as { id: string }).id

  const terbit = await panggil(
    'POST',
    `${pkp()}/output-tax-invoices/${fakturId}/issue`,
    tokenAdminCompany,
  )
  expect(terbit.status).toBe(200)
  expect((terbit.body.data as { number: string }).number).toBe('FP-00000001')

  const batal = await panggil(
    'POST',
    `${pkp()}/output-tax-invoices/${fakturId}/cancel`,
    tokenAdminCompany,
    { reason: 'Nomor tertukar dengan faktur pelanggan lain; diterbitkan ulang dengan nomor baru.' },
  )
  expect(batal.status).toBe(200)

  const pakai = await panggil('GET', `${pkp()}/tax-serials/usage`, tokenAdminCompany)
  // Nomor batal tetap terhitung. Terpakai + batal + tersisa = total.
  expect(pakai.body.data).toEqual({
    allocated: 5,
    available: 4,
    used: 0,
    cancelled: 1,
    expired: 0,
  })
})

test('daftar faktur pajak keluaran menahan nomor pada faktur yang sudah batal', async () => {
  const hasil = await panggil('GET', `${pkp()}/output-tax-invoices`, tokenAdminCompany)
  expect(hasil.status).toBe(200)

  const baris = hasil.body.data as readonly {
    id: string
    formattedNumber: string | null
    status: string
    taxCode: string
  }[]
  expect(baris.length).toBeGreaterThan(0)

  const dibatalkan = baris.find((item) => item.status === 'cancelled')
  expect(dibatalkan).toBeDefined()
  // Nomornya tetap melekat. Faktur batal yang tampil tanpa nomor akan membuat
  // orang mengira nomor itu kembali tersedia.
  expect(dibatalkan!.formattedNumber).toBe('FP-00000001')
  expect(dibatalkan!.taxCode).toBe('PPN-OUT')
})

test('detail faktur pajak keluaran menyebut faktur penjualan sumbernya', async () => {
  const daftar = await panggil('GET', `${pkp()}/output-tax-invoices`, tokenAdminCompany)
  const pertama = (daftar.body.data as readonly { id: string }[])[0]!

  const hasil = await panggil(
    'GET',
    `${pkp()}/output-tax-invoices/${pertama.id}`,
    tokenAdminCompany,
  )
  expect(hasil.status).toBe(200)

  const detail = hasil.body.data as {
    taxRate: number
    cancelReason: string | null
    sources: readonly { salesDocumentId: string; taxAmount: number }[]
  }
  // Pertanyaan pertama di layar detail selalu "angka ini dari faktur mana".
  expect(detail.sources.map((item) => item.salesDocumentId)).toContain(salesDocumentId)
  expect(detail.taxRate).toBeGreaterThan(0)
  expect(detail.cancelReason).toContain('Nomor tertukar')
})

test('NEGATIF · faktur pajak keluaran yang tidak ada menjawab 404, bukan 200 kosong', async () => {
  const hasil = await panggil(
    'GET',
    `${pkp()}/output-tax-invoices/${randomUUID()}`,
    tokenAdminCompany,
  )
  expect(hasil.status).toBe(404)
})

test('NEGATIF · faktur yang sudah batal tidak dapat diterbitkan ulang', async () => {
  const { rows } = await admin.query<{ id: string }>(
    `SELECT id FROM output_tax_invoices WHERE tenant_id = $1 AND status = 'cancelled' LIMIT 1`,
    [tenantId],
  )

  const hasil = await panggil(
    'POST',
    `${pkp()}/output-tax-invoices/${rows[0]!.id}/issue`,
    tokenAdminCompany,
  )

  expect(hasil.status).toBe(409)
  expect((hasil.body.errors as { code: string }[])[0]?.code).toBe('not_draft')
})

test('NEGATIF · faktur pajak tanpa NPWP pelanggan ditolak, dengan cara melengkapinya', async () => {
  const tanpaNpwp = randomUUID()
  await admin.query(
    `INSERT INTO customers (id, tenant_id, company_id, code, name, currency)
     VALUES ($1, $2, $3, 'C-02', 'PT Tanpa NPWP', 'IDR')`,
    [tanpaNpwp, tenantId, companyPkp],
  )

  const hasil = await panggil('POST', `${pkp()}/output-tax-invoices`, tokenAdminCompany, {
    customer_id: tanpaNpwp,
    invoice_date: '2026-03-05',
    tax_code_id: kodePpnId,
    base_amount: 1_000_000,
    tax_amount: 110_000,
    sources: [{ sales_document_id: salesDocumentId, base_amount: 1_000_000, tax_amount: 110_000 }],
  })

  expect(hasil.status).toBe(422)
  expect(hasil.body.message).toContain('Pelanggan → Data Pajak')
})

test('faktur pajak masukan dari vendor non-PKP tidak dapat dikreditkan, dan alasannya disebut', async () => {
  const vendorNonPkp = randomUUID()
  await admin.query(
    `INSERT INTO vendors (id, tenant_id, company_id, code, name, is_pkp, currency)
     VALUES ($1, $2, $3, 'V-01', 'CV Kecil', false, 'IDR')`,
    [vendorNonPkp, tenantId, companyPkp],
  )

  const dicatat = await panggil('POST', `${pkp()}/input-tax-invoices`, tokenAdminCompany, {
    vendor_id: vendorNonPkp,
    supplier_number: '010.000-26.00000001',
    invoice_date: '2026-03-05',
    tax_code_id: kodePpnId,
    base_amount: 500_000,
    tax_amount: 55_000,
  })
  expect(dicatat.status).toBe(201)

  const divalidasi = await panggil(
    'POST',
    `${pkp()}/input-tax-invoices/${(dicatat.body.data as { id: string }).id}/validate`,
    tokenAdminCompany,
  )

  expect(divalidasi.status).toBe(200)
  const data = divalidasi.body.data as {
    is_creditable: boolean
    defects: { code: string; detail: string }[]
  }

  expect(data.is_creditable).toBe(false)
  // Apa yang kurang, bukan sekadar bendera merah — Module 08 §8.
  expect(data.defects.map((butir) => butir.code)).toContain('vendor_not_pkp')
  expect(data.defects.every((butir) => butir.detail.length > 20)).toBe(true)
})

test('daftar faktur pajak masukan menyebutkan APA yang kurang, bukan sekadar menandai', async () => {
  const hasil = await panggil('GET', `${pkp()}/input-tax-invoices`, tokenAdminCompany)
  expect(hasil.status).toBe(200)

  const baris = hasil.body.data as readonly {
    id: string
    supplierNumber: string
    vendorName: string
    vendorIsPkp: boolean
    isCreditable: boolean
    validatedAt: string | null
    defects: readonly { code: string; detail: string }[]
  }[]
  expect(baris.length).toBeGreaterThan(0)

  const bermasalah = baris.find((item) => item.defects.length > 0)
  expect(bermasalah).toBeDefined()
  expect(bermasalah!.defects.map((butir) => butir.code)).toContain('vendor_not_pkp')

  // Kalimat yang dapat dibaca, bukan kode yang harus diterjemahkan layar.
  // Inilah beda "penanda apa yang kurang" dengan "bendera merah".
  expect(bermasalah!.defects.every((butir) => butir.detail.length > 20)).toBe(true)

  expect(bermasalah!.isCreditable).toBe(false)
  expect(bermasalah!.validatedAt).not.toBeNull()
  expect(bermasalah!.vendorName).toBe('CV Kecil')
})

test('rekonsiliasi melaporkan selisih per kode, bukan satu angka gabungan', async () => {
  const hasil = await panggil(
    'GET',
    `${pkp()}/reports/tax-reconciliation?period=2026-03`,
    tokenAdminCompany,
  )

  expect(hasil.status).toBe(200)
  const data = hasil.body.data as {
    balanced: boolean
    rows: {
      gl_account_id: string
      difference: number
      codes: { tax_code: string; tax_ledger_total: number }[]
    }[]
  }
  expect(data.rows.length).toBeGreaterThan(0)
  expect(data.rows[0]).toHaveProperty('difference')

  // Satu akun muncul tepat sekali, berapa pun jumlah kode yang menunjuknya.
  // Company ini punya dua versi PPN-OUT, dan sebelum perbaikan keduanya
  // masing-masing membawa seluruh saldo akun.
  const akun = data.rows.map((baris) => baris.gl_account_id)
  expect(new Set(akun).size).toBe(akun.length)

  // Sisi buku pajak tetap dirinci per kode, karena tax_ledger memang
  // menyimpannya — selisih yang muncul tetap menunjuk ke suatu tempat.
  expect(data.rows[0]).toHaveProperty('codes')
})
