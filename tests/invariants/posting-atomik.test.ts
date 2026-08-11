import { randomUUID } from 'node:crypto'

import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { createSalesPosting } from '#composition/sales'
import { PostgresUnitOfWork } from '#infrastructure/db/unit-of-work'

import { seedTenant, withClient, type Tenant } from './database.js'

/**
 * Posting atomik — Module 04 §12.
 *
 * "Jurnal gagal berarti faktur tidak jadi diposting." Diuji dengan benar-benar
 * membuat jurnalnya gagal, lalu memeriksa bahwa faktur, jurnal, dan mutasi
 * stok sama-sama tidak ada.
 */

let admin: Pool
let app: Pool
let unitOfWork: PostgresUnitOfWork
let tenant: Tenant

const akun = { piutang: randomUUID(), pendapatan: randomUUID(), ppn: randomUUID() }
let customerId: string
let itemId: string
let warehouseId: string

async function buatFaktur(options: { total: number; pajak: number; qty: number }): Promise<string> {
  const id = randomUUID()
  await admin.query(
    `INSERT INTO sales_documents
       (id, tenant_id, company_id, doc_type, number, customer_id, document_date, currency,
        subtotal, tax_base, tax_total, total, lifecycle_status)
     VALUES ($1, $2, $3, 'invoice', $4, $5, DATE '2026-08-11', 'IDR', $6, $6, $7, $8, 'approved')`,
    [
      id,
      tenant.tenantId,
      tenant.companyId,
      `INV-${id.slice(0, 8)}`,
      customerId,
      options.total - options.pajak,
      options.pajak,
      options.total,
    ],
  )
  await admin.query(
    `INSERT INTO sales_document_lines
       (id, tenant_id, company_id, document_id, line_no, item_id, description, qty, uom,
        unit_price, net_amount, tax_amount, warehouse_id)
     VALUES ($1, $2, $3, $4, 1, $5, 'Barang uji', $6, 'kg', 1000, $7, $8, $9)`,
    [
      randomUUID(),
      tenant.tenantId,
      tenant.companyId,
      id,
      itemId,
      options.qty,
      options.total - options.pajak,
      options.pajak,
      warehouseId,
    ],
  )
  return id
}

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL
  admin = new Pool({ connectionString })
  app = new Pool({ connectionString, options: '-c role=paadu_app', max: 10 })
  unitOfWork = new PostgresUnitOfWork(app)

  await withClient(async (client) => {
    tenant = await seedTenant(client, `posting-${randomUUID().slice(0, 8)}`)
  })

  for (const [id, kode, nama, tipe] of [
    [akun.piutang, '1200', 'Piutang Usaha', 'asset'],
    [akun.pendapatan, '4100', 'Pendapatan', 'revenue'],
    [akun.ppn, '2100', 'PPN Keluaran', 'liability'],
  ] as const) {
    await admin.query(
      `INSERT INTO accounts (id, tenant_id, company_id, code, name, type)
       VALUES ($1, $2, $3, $4, $5, $6::account_type)`,
      [id, tenant.tenantId, tenant.companyId, kode, nama, tipe],
    )
  }

  customerId = randomUUID()
  await admin.query(
    `INSERT INTO customers (id, tenant_id, company_id, code, name, currency)
     VALUES ($1, $2, $3, 'C-01', 'PT Pembeli', 'IDR')`,
    [customerId, tenant.tenantId, tenant.companyId],
  )

  itemId = randomUUID()
  await admin.query(
    `INSERT INTO items (id, tenant_id, company_id, code, name, type, base_uom)
     VALUES ($1, $2, $3, 'I-01', 'Barang', 'stock', 'kg')`,
    [itemId, tenant.tenantId, tenant.companyId],
  )

  warehouseId = randomUUID()
  await admin.query(
    `INSERT INTO warehouses (id, tenant_id, company_id, code, name)
     VALUES ($1, $2, $3, 'GD-01', 'Gudang')`,
    [warehouseId, tenant.tenantId, tenant.companyId],
  )
})

afterAll(async () => {
  await admin.end()
  await app.end()
})

test('tanpa aturan akun, posting ditolak — tidak ada akun cadangan', async () => {
  const faktur = await buatFaktur({ total: 111_000, pajak: 11_000, qty: 5 })

  const hasil = await unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) =>
    createSalesPosting(db, tenant.tenantId).post(faktur, randomUUID()),
  )

  expect(hasil.kind).toBe('account_unresolved')
  if (hasil.kind !== 'account_unresolved') throw new Error('tidak mungkin')
  // Pesannya menyebut aturan apa yang kurang dan ke mana harus menambahkannya.
  expect(hasil.reason).toContain('sales.invoice.receivable')
  expect(hasil.reason).toContain('Penentuan Akun')

  // Dan fakturnya tidak berubah status.
  const { rows } = await admin.query<{ lifecycle_status: string }>(
    'SELECT lifecycle_status FROM sales_documents WHERE id = $1',
    [faktur],
  )
  expect(rows[0]?.lifecycle_status).toBe('approved')
})

test('dengan aturan lengkap, dokumen, jurnal, dan mutasi stok terjadi bersama', async () => {
  for (const [jenis, akunId] of [
    ['sales.invoice.receivable', akun.piutang],
    ['sales.invoice.revenue', akun.pendapatan],
    ['sales.invoice.tax_output', akun.ppn],
  ] as const) {
    await admin.query(
      `INSERT INTO account_determination_rules
         (id, tenant_id, company_id, transaction_type, account_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
      [tenant.tenantId, tenant.companyId, jenis, akunId],
    )
  }

  const faktur = await buatFaktur({ total: 111_000, pajak: 11_000, qty: 5 })

  const hasil = await unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) =>
    createSalesPosting(db, tenant.tenantId).post(faktur, randomUUID()),
  )

  expect(hasil.kind).toBe('posted')

  const { rows: dokumen } = await admin.query<{ lifecycle_status: string; posted_at: Date | null }>(
    'SELECT lifecycle_status, posted_at FROM sales_documents WHERE id = $1',
    [faktur],
  )
  expect(dokumen[0]?.lifecycle_status).toBe('posted')
  expect(dokumen[0]?.posted_at).not.toBeNull()

  const { rows: jurnal } = await admin.query<{ debit: string; credit: string }>(
    `SELECT COALESCE(sum(l.debit), 0) AS debit, COALESCE(sum(l.credit), 0) AS credit
       FROM journal_lines l
       JOIN journals j ON j.tenant_id = l.tenant_id AND j.id = l.journal_id
      WHERE j.tenant_id = $1 AND j.source_id = $2`,
    [tenant.tenantId, faktur],
  )
  expect(Number(jurnal[0]?.debit)).toBe(111_000)
  expect(Number(jurnal[0]?.credit)).toBe(111_000)

  const { rows: mutasi } = await admin.query<{ qty_base: string }>(
    `SELECT qty_base FROM stock_movements WHERE tenant_id = $1 AND source_id = $2`,
    [tenant.tenantId, faktur],
  )
  // Pengiriman bernilai negatif: satu kolom bertanda, bukan dua kolom.
  expect(Number(mutasi[0]?.qty_base)).toBe(-5)
})

test('jurnal gagal berarti faktur tidak jadi diposting dan stok tidak berkurang', async () => {
  const faktur = await buatFaktur({ total: 111_000, pajak: 11_000, qty: 5 })

  // Jurnal dibuat tidak berimbang dengan mengubah total dokumen setelah
  // barisnya dibuat: sisi debit memakai total dokumen, sisi kredit memakai
  // nilai baris. Kegagalannya terjadi setelah dokumen dibaca dan sebelum stok
  // berkurang — persis titik yang harus dijamin atomik.
  await admin.query('UPDATE sales_documents SET total = 999000 WHERE id = $1', [faktur])

  const hasil = await unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) =>
    createSalesPosting(db, tenant.tenantId).post(faktur, randomUUID()),
  )

  expect(hasil.kind).toBe('ledger_rejected')
  if (hasil.kind !== 'ledger_rejected') throw new Error('tidak mungkin')
  expect(hasil.reason).toContain('tidak berimbang')

  const { rows: dokumen } = await admin.query<{ lifecycle_status: string }>(
    'SELECT lifecycle_status FROM sales_documents WHERE id = $1',
    [faktur],
  )
  expect(dokumen[0]?.lifecycle_status).toBe('approved')

  const { rows: mutasi } = await admin.query(
    'SELECT id FROM stock_movements WHERE tenant_id = $1 AND source_id = $2',
    [tenant.tenantId, faktur],
  )
  // Tidak ada satu pun mutasi stok yang tertinggal.
  expect(mutasi).toEqual([])

  const { rows: jurnal } = await admin.query(
    'SELECT id FROM journals WHERE tenant_id = $1 AND source_id = $2',
    [tenant.tenantId, faktur],
  )
  expect(jurnal).toEqual([])
})

test('faktur yang sudah diposting tidak dapat diposting ulang', async () => {
  const { rows } = await admin.query<{ id: string }>(
    `SELECT id FROM sales_documents
      WHERE tenant_id = $1 AND lifecycle_status = 'posted' LIMIT 1`,
    [tenant.tenantId],
  )
  const faktur = rows[0]!.id

  const hasil = await unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) =>
    createSalesPosting(db, tenant.tenantId).post(faktur, randomUUID()),
  )

  expect(hasil.kind).toBe('transition_rejected')
  if (hasil.kind !== 'transition_rejected') throw new Error('tidak mungkin')
  // Penolakan menyebut tujuan yang tersedia — void dan closed, bukan posted.
  expect(hasil.reason).toContain('void')
})
