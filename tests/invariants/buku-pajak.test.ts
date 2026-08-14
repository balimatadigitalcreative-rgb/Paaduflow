import { randomUUID } from 'node:crypto'

import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { PostingService } from '#application/accounting/posting'
import { createTax } from '#composition/tax'
import { PostgresUnitOfWork } from '#infrastructure/db/unit-of-work'
import { PostgresPostingRepository } from '#infrastructure/modules/accounting/postgres-posting-repository'
import { uuidv7 } from '#shared/uuid'

import { seedTenant, withClient, type Tenant } from './database.js'
import { seedAkunPajak, seedProfilPkp, seedTaxCode, type AkunPajak } from './tax-fixture.js'

/**
 * Invarian rekonsiliasi — Module 08 §5.
 *
 * Setelah rangkaian transaksi acak, jumlah buku pajak per kode harus sama
 * dengan saldo akun pajak terkait di buku besar. Selisihnya wajib nol, setiap
 * saat, tanpa perlu ditunggu sampai akhir masa.
 *
 * Buku pajak dan buku besar diisi lewat dua jalur yang berbeda — modul Pajak
 * dan modul Akuntansi — dan itu memang intinya: kalau keduanya diisi dari satu
 * sumber, invarian ini hanya menguji penjumlahan.
 *
 * Bibit acaknya tetap: kegagalan dapat diulang.
 */

const BIBIT = 20260812
const FAKTUR = 20
const MASA = '2026-03'

/** Menjumlah dua nilai dua desimal tanpa membawa serta debu pecahan biner. */
function bulat(nilai: number): number {
  return Math.round(nilai * 100) / 100
}

function acak(bibit: number): () => number {
  let keadaan = bibit
  return () => {
    keadaan = (keadaan * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return keadaan / 4_294_967_296
  }
}

let admin: Pool
let app: Pool
let unitOfWork: PostgresUnitOfWork
let tenant: Tenant
let akun: AkunPajak
let piutang: string
let pendapatan: string
let customerId: string
let kodePpn: string

async function terbitkanFaktur(nilai: number, pajak: number): Promise<string> {
  return unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) => {
    const layanan = createTax(db, tenant.tenantId)

    const dokumenPenjualan = randomUUID()
    await db.query(
      `INSERT INTO sales_documents
         (id, tenant_id, company_id, doc_type, customer_id, document_date, currency, total)
       VALUES ($1, $2, $3, 'invoice', $4, DATE '2026-03-05', 'IDR', $5)`,
      [dokumenPenjualan, tenant.tenantId, tenant.companyId, customerId, bulat(nilai + pajak)],
    )

    const draf = await layanan.outputInvoices.create({
      companyId: tenant.companyId,
      customerId,
      invoiceDate: '2026-03-05',
      taxCodeId: kodePpn,
      baseAmount: nilai,
      taxAmount: pajak,
      sources: [{ salesDocumentId: dokumenPenjualan, baseAmount: nilai, taxAmount: pajak }],
      createdBy: randomUUID(),
    })
    if (draf.kind !== 'created') throw new Error(`draf gagal: ${draf.kind}`)

    const terbit = await layanan.outputInvoices.issue(draf.id, randomUUID())
    if (terbit.kind !== 'issued') throw new Error(`terbit gagal: ${terbit.kind}`)

    // Jalur kedua: buku besar, lewat modul Akuntansi. Piutang di debit, PPN
    // keluaran di kredit — jurnal yang sama yang akan ditulis posting faktur.
    const posting = new PostingService(
      new PostgresPostingRepository(db, tenant.tenantId),
      () => uuidv7(),
    )
    const jurnal = await posting.post({
      companyId: tenant.companyId,
      journalDate: new Date('2026-03-05'),
      fiscalYear: 2026,
      fiscalPeriod: 3,
      type: 'auto',
      currency: 'IDR',
      description: `faktur pajak ${terbit.formattedNumber}`,
      sourceType: 'output_tax_invoice',
      sourceId: draf.id,
      lines: [
        { accountId: piutang, debit: bulat(nilai + pajak), credit: 0 },
        { accountId: pendapatan, debit: 0, credit: nilai },
        { accountId: akun.ppnKeluaran, debit: 0, credit: pajak },
      ],
    })
    if (jurnal.kind !== 'posted') throw new Error(`jurnal gagal: ${jurnal.kind}`)

    return draf.id
  })
}

async function rekonsiliasi() {
  return unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) =>
    createTax(db, tenant.tenantId).repository.reconcile(tenant.companyId, MASA),
  )
}

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL
  admin = new Pool({ connectionString })
  app = new Pool({ connectionString, options: '-c role=paadu_app', max: 10 })
  unitOfWork = new PostgresUnitOfWork(app)

  await withClient(async (client) => {
    tenant = await seedTenant(client, `bukupajak-${randomUUID().slice(0, 8)}`)
  })

  akun = await seedAkunPajak(admin, tenant.tenantId, tenant.companyId)
  await seedProfilPkp(admin, tenant.tenantId, tenant.companyId, { isPkp: true })

  piutang = randomUUID()
  pendapatan = randomUUID()
  for (const [id, kode, nama, tipe] of [
    [piutang, '1200', 'Piutang Usaha', 'asset'],
    [pendapatan, '4100', 'Pendapatan', 'revenue'],
  ] as const) {
    await admin.query(
      `INSERT INTO accounts (id, tenant_id, company_id, code, name, type)
       VALUES ($1, $2, $3, $4, $5, $6::account_type)`,
      [id, tenant.tenantId, tenant.companyId, kode, nama, tipe],
    )
  }

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

  await unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) => {
    await createTax(db, tenant.tenantId).serials.allocate({
      companyId: tenant.companyId,
      prefix: 'BP-',
      digits: 8,
      rangeStart: 1,
      rangeEnd: 200,
      createdBy: randomUUID(),
    })
  })
})

afterAll(async () => {
  await admin.end()
  await app.end()
})

test('buku pajak kosong dan buku besar kosong sama-sama nol', async () => {
  expect(await rekonsiliasi()).toEqual([])
})

test('setelah transaksi acak, buku pajak sama dengan akun pajak di buku besar', async () => {
  const berikutnya = acak(BIBIT)

  for (let nomor = 0; nomor < FAKTUR; nomor += 1) {
    // Nilai acak yang tidak bulat, supaya pembulatan ikut diuji.
    const nilai = Math.round((berikutnya() * 9_000_000 + 100_000) * 100) / 100
    const pajak = Math.round(nilai * 0.11 * 100) / 100

    await terbitkanFaktur(nilai, pajak)

    // Diperiksa setelah SETIAP faktur, bukan hanya di akhir. Invarian yang
    // hanya benar di akhir adalah invarian yang sudah pernah salah di tengah.
    const baris = await rekonsiliasi()
    expect(baris).toHaveLength(1)
    expect(baris[0]!.difference).toBe(0)
  }

  const akhir = await rekonsiliasi()
  expect(akhir[0]!.code).toBe('PPN-OUT')
  expect(akhir[0]!.taxLedgerTotal).toBeGreaterThan(0)
  expect(akhir[0]!.taxLedgerTotal).toBe(akhir[0]!.generalLedgerTotal)
})

test('pembatalan menjaga keduanya tetap sama, lewat baris pembalik di kedua buku', async () => {
  const { rows } = await admin.query<{ id: string; tax_amount: string; base_amount: string }>(
    `SELECT id, tax_amount, base_amount FROM output_tax_invoices
      WHERE tenant_id = $1 AND status = 'issued' ORDER BY created_at LIMIT 1`,
    [tenant.tenantId],
  )
  const faktur = rows[0]!
  const pajak = Number(faktur.tax_amount)
  const nilai = Number(faktur.base_amount)

  await unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) => {
    const hasil = await createTax(db, tenant.tenantId).outputInvoices.cancel(
      faktur.id,
      'Dibatalkan karena nomor pelanggan tertukar; diterbitkan ulang dengan nomor berikutnya.',
      randomUUID(),
    )
    expect(hasil.kind).toBe('cancelled')

    // Buku besar dibalik lewat jurnal, bukan lewat penghapusan barisnya —
    // journals dan journal_lines append-only (D-005).
    const posting = new PostingService(
      new PostgresPostingRepository(db, tenant.tenantId),
      () => uuidv7(),
    )
    const jurnal = await posting.post({
      companyId: tenant.companyId,
      journalDate: new Date('2026-03-20'),
      fiscalYear: 2026,
      fiscalPeriod: 3,
      type: 'reversal',
      currency: 'IDR',
      description: 'pembatalan faktur pajak',
      sourceType: 'output_tax_invoice_cancellation',
      sourceId: faktur.id,
      lines: [
        { accountId: akun.ppnKeluaran, debit: pajak, credit: 0 },
        { accountId: pendapatan, debit: nilai, credit: 0 },
        { accountId: piutang, debit: 0, credit: bulat(nilai + pajak) },
      ],
    })
    if (jurnal.kind !== 'posted') throw new Error(`jurnal gagal: ${jurnal.kind}`)
  })

  const baris = await rekonsiliasi()
  expect(baris[0]!.difference).toBe(0)
})

test('selisih terlihat per kode saat salah satu buku tertinggal', async () => {
  // Sengaja hanya menulis ke buku besar, tanpa baris buku pajaknya. Rekonsiliasi
  // yang tidak dapat menemukan keadaan ini tidak berguna sebagai rekonsiliasi.
  await unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) => {
    const posting = new PostingService(
      new PostgresPostingRepository(db, tenant.tenantId),
      () => uuidv7(),
    )
    await posting.post({
      companyId: tenant.companyId,
      journalDate: new Date('2026-03-25'),
      fiscalYear: 2026,
      fiscalPeriod: 3,
      type: 'manual',
      currency: 'IDR',
      description: 'jurnal manual yang lupa dicatat di buku pajak',
      lines: [
        { accountId: piutang, debit: 555_000, credit: 0 },
        { accountId: akun.ppnKeluaran, debit: 0, credit: 555_000 },
      ],
    })
  })

  const baris = await rekonsiliasi()
  expect(baris[0]!.difference).toBe(-555_000)
  // Dan ia disebutkan bersama kodenya, bukan sebagai satu angka gabungan yang
  // tidak memberi tahu siapa pun harus melihat ke mana.
  expect(baris[0]!.code).toBe('PPN-OUT')
})
