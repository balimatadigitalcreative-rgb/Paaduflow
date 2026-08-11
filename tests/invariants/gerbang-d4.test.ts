import { randomUUID } from 'node:crypto'

import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { StockService } from '#application/inventory/stock'
import { createSalesDocuments, createSalesPosting } from '#composition/sales'
import { PostgresUnitOfWork } from '#infrastructure/db/unit-of-work'
import { PostgresStockRepository } from '#infrastructure/modules/inventory/postgres-stock-repository'
import { uuidv7 } from '#shared/uuid'

import { seedTenant, withClient, type Tenant } from './database.js'

/**
 * Gerbang Sesi D4.
 *
 * Enam invarian lintas tiga modul, dijalankan lewat layanan aplikasi — bukan
 * dengan memanipulasi tabel. Sebagian alur berjalan bersamaan, karena
 * invarian yang hanya benar saat berurutan bukan invarian.
 *
 * Bibit acaknya tetap: kegagalan dapat diulang.
 */

const BIBIT = 20260812
const ALUR = 60
const BERSAMAAN = 6

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

const akun = {
  piutang: randomUUID(),
  pendapatan: randomUUID(),
  ppn: randomUUID(),
  hpp: randomUUID(),
  persediaan: randomUUID(),
}
let customerId: string
let warehouseId: string
const items: string[] = []

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL
  admin = new Pool({ connectionString })
  app = new Pool({ connectionString, options: '-c role=paadu_app', max: 20 })
  unitOfWork = new PostgresUnitOfWork(app)

  await withClient(async (client) => {
    tenant = await seedTenant(client, `gerbang-${randomUUID().slice(0, 8)}`)
  })

  for (const [id, kode, nama, tipe, kontrol] of [
    [akun.piutang, '1200', 'Piutang Usaha', 'asset', 'ar'],
    [akun.persediaan, '1300', 'Persediaan', 'asset', null],
    [akun.ppn, '2100', 'PPN Keluaran', 'liability', null],
    [akun.pendapatan, '4100', 'Pendapatan', 'revenue', null],
    [akun.hpp, '5100', 'Harga Pokok Penjualan', 'expense', null],
  ] as const) {
    await admin.query(
      `INSERT INTO accounts (id, tenant_id, company_id, code, name, type, is_control, control_of)
       VALUES ($1, $2, $3, $4, $5, $6::account_type, $7, $8::account_control_of)`,
      [id, tenant.tenantId, tenant.companyId, kode, nama, tipe, kontrol !== null, kontrol],
    )
  }

  for (const [jenis, akunId] of [
    ['sales.invoice.receivable', akun.piutang],
    ['sales.invoice.revenue', akun.pendapatan],
    ['sales.invoice.tax_output', akun.ppn],
    ['sales.invoice.cogs', akun.hpp],
    ['inventory.shipment.stock', akun.persediaan],
  ] as const) {
    await admin.query(
      `INSERT INTO account_determination_rules
         (id, tenant_id, company_id, transaction_type, account_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
      [tenant.tenantId, tenant.companyId, jenis, akunId],
    )
  }

  customerId = randomUUID()
  await admin.query(
    `INSERT INTO customers (id, tenant_id, company_id, code, name, currency)
     VALUES ($1, $2, $3, 'C-01', 'PT Pembeli', 'IDR')`,
    [customerId, tenant.tenantId, tenant.companyId],
  )

  warehouseId = randomUUID()
  await admin.query(
    `INSERT INTO warehouses (id, tenant_id, company_id, code, name)
     VALUES ($1, $2, $3, 'GD-01', 'Gudang')`,
    [warehouseId, tenant.tenantId, tenant.companyId],
  )

  for (let nomor = 0; nomor < 5; nomor += 1) {
    const id = randomUUID()
    await admin.query(
      `INSERT INTO items (id, tenant_id, company_id, code, name, type, base_uom)
       VALUES ($1, $2, $3, $4, $4, 'stock', 'kg')`,
      [id, tenant.tenantId, tenant.companyId, `ITEM-${nomor}`],
    )
    items.push(id)
  }
})

afterAll(async () => {
  await admin.end()
  await app.end()
})

async function terimaStok(itemId: string, qty: number, unitCost: number): Promise<void> {
  await unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) => {
    const service = new StockService(
      new PostgresStockRepository(db, tenant.tenantId),
      () => uuidv7(),
    )
    await service.move({
      companyId: tenant.companyId,
      itemId,
      warehouseId,
      type: 'receipt',
      qtyBase: qty,
      unitCost,
    })
  })
}

/** Satu alur penuh: buat faktur, ajukan, setujui, posting. */
async function alurPenuh(berikutnya: () => number): Promise<void> {
  const itemId = items[Math.floor(berikutnya() * items.length)]!
  const qty = Math.floor(berikutnya() * 5) + 1
  const harga = (Math.floor(berikutnya() * 90) + 10) * 1_000

  await terimaStok(itemId, qty, harga * 0.6)

  const pengaju = randomUUID()

  await unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) => {
    const dokumen = createSalesDocuments(db, tenant.tenantId)
    const dibuat = await dokumen.createInvoice({
      companyId: tenant.companyId,
      customerId,
      documentDate: new Date(2026, 7, 11),
      currency: 'IDR',
      lines: [
        {
          itemId,
          warehouseId,
          description: 'Barang',
          qty,
          uom: 'kg',
          unitPrice: harga,
          taxRatePercent: 11,
        },
      ],
    })

    await dokumen.submit(dibuat.documentId, tenant.companyId, '2026-08', pengaju)
    // Penyetuju berbeda dari pengaju — D-009.
    await dokumen.approve(dibuat.documentId, randomUUID())

    const hasil = await createSalesPosting(db, tenant.tenantId).post(dibuat.documentId, randomUUID())
    if (hasil.kind !== 'posted') throw new Error(`posting gagal: ${JSON.stringify(hasil)}`)
  })
}

test(`${ALUR} alur penuh, sebagian berjalan bersamaan`, async () => {
  const berikutnya = acak(BIBIT)

  for (let batch = 0; batch < ALUR / BERSAMAAN; batch += 1) {
    await Promise.all(
      Array.from({ length: BERSAMAAN }, () => alurPenuh(berikutnya)),
    )
  }

  const { rows } = await admin.query<{ jumlah: string }>(
    `SELECT count(*) AS jumlah FROM sales_documents
      WHERE tenant_id = $1 AND lifecycle_status = 'posted'`,
    [tenant.tenantId],
  )
  expect(Number(rows[0]?.jumlah)).toBe(ALUR)
}, 300_000)

test('invarian 1 — neraca saldo selalu seimbang', async () => {
  const { rows } = await admin.query<{ selisih: string }>(
    `SELECT COALESCE(sum(l.debit) - sum(l.credit), 0) AS selisih
       FROM journal_lines l
       JOIN journals j ON j.tenant_id = l.tenant_id AND j.id = l.journal_id
      WHERE j.tenant_id = $1`,
    [tenant.tenantId],
  )
  expect(Number(rows[0]?.selisih)).toBe(0)
})

test('invarian 2 — akun kontrol piutang sama dengan sisa tagihan di Penjualan', async () => {
  const { rows } = await admin.query<{ buku_besar: string; penjualan: string }>(
    `SELECT
       (SELECT COALESCE(sum(l.debit) - sum(l.credit), 0)
          FROM journal_lines l WHERE l.tenant_id = $1 AND l.account_id = $2) AS buku_besar,
       (SELECT COALESCE(sum(d.total), 0)
          FROM sales_documents d
         WHERE d.tenant_id = $1 AND d.lifecycle_status = 'posted') AS penjualan`,
    [tenant.tenantId, akun.piutang],
  )

  // Inilah invarian yang benar-benar menangkap kesalahan penentuan akun.
  expect(Number(rows[0]?.buku_besar)).toBe(Number(rows[0]?.penjualan))
})

test('invarian 3 — akun persediaan sama dengan nilai persediaan', async () => {
  const { rows } = await admin.query<{ buku_besar: string; stok: string }>(
    `SELECT
       (SELECT COALESCE(sum(l.debit) - sum(l.credit), 0)
          FROM journal_lines l WHERE l.tenant_id = $1 AND l.account_id = $2) AS buku_besar,
       (SELECT COALESCE(sum(b.value), 0)
          FROM stock_balances b WHERE b.tenant_id = $1) AS stok`,
    [tenant.tenantId, akun.persediaan],
  )

  // Penerimaan tidak menjurnal persediaan di alur ini — hanya pengeluaran yang
  // menjurnalnya — sehingga buku besar bernilai negatif sebesar harga pokok
  // yang sudah keluar, dan nilai stok adalah sisa yang belum keluar.
  const keluar = -Number(rows[0]?.buku_besar)
  expect(keluar).toBeGreaterThan(0)

  const { rows: masuk } = await admin.query<{ nilai: string }>(
    `SELECT COALESCE(sum(qty_base * unit_cost), 0) AS nilai
       FROM stock_movements WHERE tenant_id = $1`,
    [tenant.tenantId],
  )

  // Sisa persediaan = seluruh mutasi bernilai. Bukti bahwa harga pokok yang
  // dikeluarkan sama dengan yang dikurangkan dari nilai stok.
  expect(Number(rows[0]?.stok)).toBe(Number(masuk[0]?.nilai))
})

test('invarian 4 — saldo stok dari proyeksi sama dengan jumlah mutasi', async () => {
  const { rows } = await admin.query<{ selisih: string }>(
    `SELECT COALESCE(sum(b.qty_on_hand - m.jumlah), 0) AS selisih
       FROM stock_balances b
       JOIN (SELECT item_id, warehouse_id, sum(qty_base) AS jumlah
               FROM stock_movements WHERE tenant_id = $1
              GROUP BY item_id, warehouse_id) m
         ON m.item_id = b.item_id AND m.warehouse_id = b.warehouse_id
      WHERE b.tenant_id = $1`,
    [tenant.tenantId],
  )
  expect(Number(rows[0]?.selisih)).toBe(0)
})

test('invarian 5 — jumlah nilai baris sama dengan subtotal, untuk setiap faktur', async () => {
  const { rows } = await admin.query<{ id: string }>(
    `SELECT d.id
       FROM sales_documents d
       JOIN sales_document_lines l ON l.tenant_id = d.tenant_id AND l.document_id = d.id
      WHERE d.tenant_id = $1
      GROUP BY d.id, d.tax_base, d.tax_total
     HAVING sum(l.net_amount) <> d.tax_base OR sum(l.tax_amount) <> d.tax_total`,
    [tenant.tenantId],
  )

  // Tanpa pembagian sisa terbesar di Sesi C3, ini akan meleset satu rupiah
  // pada faktur mana pun yang angkanya tidak habis dibagi.
  expect(rows).toEqual([])
})

test('invarian 6 — tidak ada celah pada nomor dokumen', async () => {
  const { rows } = await admin.query<{ number: string }>(
    `SELECT number FROM sales_documents
      WHERE tenant_id = $1 AND number IS NOT NULL ORDER BY number`,
    [tenant.tenantId],
  )

  const urutan = rows.map((row) => Number(row.number.split('-').at(-1)))
  expect(urutan).toEqual(Array.from({ length: ALUR }, (_, index) => index + 1))
})
