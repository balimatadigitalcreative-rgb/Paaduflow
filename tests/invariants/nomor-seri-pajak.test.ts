import { randomUUID } from 'node:crypto'

import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { createTax } from '#composition/tax'
import { PostgresUnitOfWork } from '#infrastructure/db/unit-of-work'

import { seedTenant, withClient, type Tenant } from './database.js'
import { seedAkunPajak, seedProfilPkp, seedTaxCode, type AkunPajak } from './tax-fixture.js'

/**
 * Nomor seri faktur pajak — konkurensi dan invarian pemakaian.
 *
 * Dua hal yang diuji di sini, dan keduanya adalah temuan pemeriksaan bila
 * salah:
 *
 * 1. Sepuluh penerbitan bersamaan menghasilkan sepuluh nomor **berurutan**,
 *    tanpa celah dan tanpa duplikat.
 * 2. Terpakai + batal + kedaluwarsa + tersisa selalu sama dengan total yang
 *    dialokasikan — nomor yang dibatalkan tidak pernah kembali ke pool.
 */

const BERSAMAAN = 10
const AWAL = 1
const AKHIR = 40

let admin: Pool
let app: Pool
let unitOfWork: PostgresUnitOfWork
let tenant: Tenant
let akun: AkunPajak
let customerId: string
let salesDocumentId: string
let kodePpn: string

/**
 * Faktur penjualan baru untuk setiap draf.
 *
 * Satu faktur penjualan hanya boleh tercakup satu faktur pajak yang masih
 * berlaku — kalau seluruh draf di berkas ini berbagi satu sumber, yang diuji
 * bukan lagi penomoran seri melainkan penolakan sumber ganda.
 */
async function fakturPenjualanBaru(): Promise<string> {
  const id = randomUUID()
  await admin.query(
    `INSERT INTO sales_documents
       (id, tenant_id, company_id, doc_type, customer_id, document_date, currency, total)
     VALUES ($1, $2, $3, 'invoice', $4, DATE '2026-03-01', 'IDR', 1110000)`,
    [id, tenant.tenantId, tenant.companyId, customerId],
  )
  return id
}

async function buatDraf(tanggal = '2026-03-10'): Promise<string> {
  const salesDocumentId = await fakturPenjualanBaru()
  return unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) => {
    const hasil = await createTax(db, tenant.tenantId).outputInvoices.create({
      companyId: tenant.companyId,
      customerId,
      invoiceDate: tanggal,
      taxCodeId: kodePpn,
      baseAmount: 1_000_000,
      taxAmount: 110_000,
      sources: [{ salesDocumentId, baseAmount: 1_000_000, taxAmount: 110_000 }],
      createdBy: randomUUID(),
    })
    if (hasil.kind !== 'created') throw new Error(`draf gagal: ${hasil.kind}`)
    return hasil.id
  })
}

async function terbitkan(invoiceId: string): Promise<string> {
  return unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) => {
    const hasil = await createTax(db, tenant.tenantId).outputInvoices.issue(invoiceId, randomUUID())
    if (hasil.kind !== 'issued') throw new Error(`terbit gagal: ${hasil.kind}`)
    return hasil.formattedNumber
  })
}

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL
  admin = new Pool({ connectionString })
  app = new Pool({ connectionString, options: '-c role=paadu_app', max: 20 })
  unitOfWork = new PostgresUnitOfWork(app)

  await withClient(async (client) => {
    tenant = await seedTenant(client, `seri-${randomUUID().slice(0, 8)}`)
  })

  akun = await seedAkunPajak(admin, tenant.tenantId, tenant.companyId)
  await seedProfilPkp(admin, tenant.tenantId, tenant.companyId, { isPkp: true })

  kodePpn = await seedTaxCode(admin, tenant.tenantId, tenant.companyId, {
    code: 'PPN-OUT',
    rate: 11,
    validFrom: '2020-01-01',
    glAccountId: akun.ppnKeluaran,
  })

  customerId = randomUUID()
  await admin.query(
    `INSERT INTO customers (id, tenant_id, company_id, code, name, tax_id, currency)
     VALUES ($1, $2, $3, 'C-01', 'PT Pembeli', '11.222.333.4-555.000', 'IDR')`,
    [customerId, tenant.tenantId, tenant.companyId],
  )

  salesDocumentId = randomUUID()
  await admin.query(
    `INSERT INTO sales_documents
       (id, tenant_id, company_id, doc_type, customer_id, document_date, currency, total)
     VALUES ($1, $2, $3, 'invoice', $4, DATE '2026-03-01', 'IDR', 1110000)`,
    [salesDocumentId, tenant.tenantId, tenant.companyId, customerId],
  )

  await unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) => {
    const hasil = await createTax(db, tenant.tenantId).serials.allocate({
      companyId: tenant.companyId,
      prefix: 'UJI-',
      digits: 8,
      rangeStart: AWAL,
      rangeEnd: AKHIR,
      createdBy: randomUUID(),
    })
    if (hasil.kind !== 'allocated') throw new Error(`alokasi gagal: ${hasil.kind}`)
    expect(hasil.count).toBe(AKHIR - AWAL + 1)
  })
})

afterAll(async () => {
  await admin.end()
  await app.end()
})

test('alokasi memateralisasi setiap nomor sebagai satu baris tersedia', async () => {
  const pakai = await unitOfWork.inTenant(
    { tenantId: tenant.tenantId, userId: null },
    async (db) => createTax(db, tenant.tenantId).serials.usage(tenant.companyId),
  )

  expect(pakai).toEqual({
    allocated: AKHIR - AWAL + 1,
    available: AKHIR - AWAL + 1,
    used: 0,
    cancelled: 0,
    expired: 0,
  })
})

test('sepuluh penerbitan bersamaan menghasilkan sepuluh nomor berurutan tanpa celah', async () => {
  const draf = await Promise.all(Array.from({ length: BERSAMAAN }, () => buatDraf()))

  // Benar-benar bersamaan: sepuluh transaksi terpisah, masing-masing dengan
  // koneksinya sendiri dari kolam.
  const nomor = await Promise.all(draf.map((id) => terbitkan(id)))

  expect(new Set(nomor).size).toBe(BERSAMAAN)

  const { rows } = await admin.query<{ serial_number: string }>(
    `SELECT serial_number FROM tax_serial_usage
      WHERE tenant_id = $1 AND company_id = $2 AND status = 'used'
      ORDER BY serial_number`,
    [tenant.tenantId, tenant.companyId],
  )

  const terpakai = rows.map((row) => Number(row.serial_number))
  expect(terpakai).toHaveLength(BERSAMAAN)
  // Berurutan dari nomor pertama alokasi, tanpa satu pun lompatan. Inilah yang
  // hilang bila pengambilannya memakai SKIP LOCKED.
  expect(terpakai).toEqual(Array.from({ length: BERSAMAAN }, (_, index) => AWAL + index))
})

test('pembatalan tidak mengembalikan nomor ke pool', async () => {
  const { rows: sebelum } = await admin.query<{ id: string; serial_number: string }>(
    `SELECT i.id, u.serial_number
       FROM output_tax_invoices i
       JOIN tax_serial_usage u
         ON u.tenant_id = i.tenant_id AND u.output_tax_invoice_id = i.id
      WHERE i.tenant_id = $1 AND i.status = 'issued'
      ORDER BY u.serial_number
      LIMIT 1`,
    [tenant.tenantId],
  )
  const faktur = sebelum[0]!

  await unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) => {
    const hasil = await createTax(db, tenant.tenantId).outputInvoices.cancel(
      faktur.id,
      'Nomor tertukar dengan faktur pelanggan lain; diterbitkan ulang dengan nomor berikutnya.',
      randomUUID(),
    )
    expect(hasil.kind).toBe('cancelled')
  })

  const { rows } = await admin.query<{ status: string }>(
    `SELECT status FROM tax_serial_usage
      WHERE tenant_id = $1 AND company_id = $2 AND serial_number = $3`,
    [tenant.tenantId, tenant.companyId, faktur.serial_number],
  )

  // Bukan 'available'. Nomor yang kembali ke pool membuat pertanyaan "nomor ini
  // dipakai untuk apa" punya dua jawaban.
  expect(rows[0]?.status).toBe('cancelled')

  // Dan penerbitan berikutnya melanjutkan ke nomor sesudahnya, bukan mengambil
  // yang barusan dibatalkan.
  const berikutnya = await terbitkan(await buatDraf())
  expect(berikutnya).toBe(`UJI-${String(AWAL + BERSAMAAN).padStart(8, '0')}`)
})

test('nomor batal tidak dapat dipakai ulang, bahkan lewat repository', async () => {
  const { rows } = await admin.query<{ serial_number: string }>(
    `SELECT serial_number FROM tax_serial_usage
      WHERE tenant_id = $1 AND company_id = $2 AND status = 'cancelled' LIMIT 1`,
    [tenant.tenantId, tenant.companyId],
  )
  const batal = Number(rows[0]!.serial_number)

  await expect(
    unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) =>
      createTax(db, tenant.tenantId).repository.markUsed(tenant.companyId, batal, randomUUID()),
    ),
  ).rejects.toThrow(/tidak tersedia/)
})

test('invarian: terpakai + batal + kedaluwarsa + tersisa = total dialokasikan', async () => {
  const pakai = await unitOfWork.inTenant(
    { tenantId: tenant.tenantId, userId: null },
    async (db) => createTax(db, tenant.tenantId).serials.usage(tenant.companyId),
  )

  expect(pakai.used + pakai.cancelled + pakai.expired + pakai.available).toBe(pakai.allocated)

  // Dan totalnya masih sebesar rentang yang dialokasikan — tidak ada nomor yang
  // lahir maupun lenyap di sepanjang rangkaian ini.
  expect(pakai.allocated).toBe(AKHIR - AWAL + 1)

  // Satu dibatalkan, sepuluh dipakai lalu satu di antaranya dibatalkan, dan
  // satu tambahan sesudahnya.
  expect(pakai.cancelled).toBe(1)
  expect(pakai.used).toBe(BERSAMAAN)
})

test('nomor di luar rentang yang dialokasikan dikenali sebagai di luar rentang', async () => {
  const cek = async (nomor: number) =>
    unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) =>
      createTax(db, tenant.tenantId).serials.isWithinAllocation(tenant.companyId, nomor),
    )

  expect(await cek(AWAL)).toBe(true)
  expect(await cek(AKHIR)).toBe(true)
  expect(await cek(AKHIR + 1)).toBe(false)
  expect(await cek(0)).toBe(false)
})

/**
 * Dijalankan paling akhir: ia menambah alokasi, dan pemeriksaan jumlah di atas
 * menghitung seluruh nomor milik company ini.
 */
test('dua company dalam satu tenant memakai deret nomor yang terpisah', async () => {
  // Nomor seri diberikan per PKP, dan dua company adalah dua NPWP. Deretnya
  // berdiri sendiri-sendiri, sehingga nomor terformat yang sama pada keduanya
  // bukan tabrakan — ia dua nomor berbeda dari dua penerima berbeda.
  const companyKedua = randomUUID()
  await admin.query(
    `INSERT INTO companies (id, tenant_id, legal_name, slug, default_currency)
     VALUES ($1, $2, 'PT Kedua Contoh', $3, 'IDR')`,
    [companyKedua, tenant.tenantId, `kedua-${companyKedua.slice(0, 8)}`],
  )

  const alokasikan = async (companyId: string): Promise<number> =>
    unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) => {
      const hasil = await createTax(db, tenant.tenantId).serials.allocate({
        companyId,
        prefix: 'SAMA-',
        digits: 8,
        // Jauh dari rentang di atas: yang diuji di sini tabrakan ANTAR company,
        // bukan tabrakan nomor di dalam satu company.
        rangeStart: 101,
        rangeEnd: 105,
        createdBy: randomUUID(),
      })
      if (hasil.kind !== 'allocated') throw new Error(`alokasi gagal: ${hasil.kind}`)
      return hasil.count
    })

  expect(await alokasikan(tenant.companyId)).toBe(5)
  expect(await alokasikan(companyKedua)).toBe(5)

  const { rows } = await admin.query(
    `SELECT company_id FROM tax_serial_usage
      WHERE tenant_id = $1 AND formatted_number = 'SAMA-00000101'
      ORDER BY company_id`,
    [tenant.tenantId],
  )
  expect(rows).toHaveLength(2)
})

test('alokasi yang rentangnya terbalik atau raksasa ditolak', async () => {
  const coba = async (rangeStart: number, rangeEnd: number) =>
    unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) =>
      createTax(db, tenant.tenantId).serials.allocate({
        companyId: tenant.companyId,
        prefix: 'X-',
        digits: 8,
        rangeStart,
        rangeEnd,
        createdBy: randomUUID(),
      }),
    )

  expect((await coba(100, 50)).kind).toBe('range_inverted')
  // Rentang sebesar ini hampir selalu salah ketik, dan biayanya satu baris per
  // nomor.
  expect((await coba(1_000, 9_999_999)).kind).toBe('range_too_large')
})
