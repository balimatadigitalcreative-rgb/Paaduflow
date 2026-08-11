import { randomUUID } from 'node:crypto'

import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { createPurchasing } from '#composition/purchasing'
import { unbilledReceiptValue } from '#domain/purchasing/three-way-match'
import { PostgresUnitOfWork } from '#infrastructure/db/unit-of-work'

import { seedTenant, withClient, type Tenant } from './database.js'

/**
 * Invarian akun perantara penerimaan barang.
 *
 * Saldo akun perantara harus selalu sama dengan nilai barang yang sudah
 * diterima tetapi belum ditagih — pada harga pesanan, karena itulah angka yang
 * dipakai saat barang masuk.
 *
 * Diuji dengan transaksi acak berbibit tetap: pesanan dengan jumlah baris
 * berbeda, penerimaan sebagian atau penuh, penagihan sebagian atau penuh, dalam
 * urutan yang tidak rapi. Invarian yang hanya benar pada urutan rapi bukan
 * invarian.
 */

const BIBIT = 20260812
const SIKLUS = 25

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
  persediaan: randomUUID(),
  perantara: randomUUID(),
  utang: randomUUID(),
  ppnMasukan: randomUUID(),
  selisihHarga: randomUUID(),
}

let vendorId: string
let warehouseId: string
const items: string[] = []

const PEMBUAT = randomUUID()
const PENYETUJU = randomUUID()
const PEMOSTING = randomUUID()

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL
  admin = new Pool({ connectionString })
  app = new Pool({ connectionString, options: '-c role=paadu_app', max: 10 })
  unitOfWork = new PostgresUnitOfWork(app)

  await withClient(async (client) => {
    tenant = await seedTenant(client, `perantara-${randomUUID().slice(0, 8)}`)
  })

  for (const [id, kode, nama, tipe] of [
    [akun.persediaan, '1300', 'Persediaan', 'asset'],
    [akun.perantara, '2150', 'Penerimaan Barang Belum Ditagih', 'liability'],
    [akun.utang, '2100', 'Utang Usaha', 'liability'],
    [akun.ppnMasukan, '1450', 'PPN Masukan', 'asset'],
    [akun.selisihHarga, '5900', 'Selisih Harga Pembelian', 'expense'],
  ] as const) {
    await admin.query(
      `INSERT INTO accounts (id, tenant_id, company_id, code, name, type)
       VALUES ($1, $2, $3, $4, $5, $6::account_type)`,
      [id, tenant.tenantId, tenant.companyId, kode, nama, tipe],
    )
  }

  for (const [jenis, akunId] of [
    ['purchasing.receipt.stock', akun.persediaan],
    ['purchasing.receipt.clearing', akun.perantara],
    ['purchasing.bill.payable', akun.utang],
    ['purchasing.bill.tax_input', akun.ppnMasukan],
    ['purchasing.bill.price_variance', akun.selisihHarga],
  ] as const) {
    await admin.query(
      `INSERT INTO account_determination_rules (id, tenant_id, company_id, transaction_type, account_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
      [tenant.tenantId, tenant.companyId, jenis, akunId],
    )
  }

  vendorId = randomUUID()
  await admin.query(
    `INSERT INTO vendors (id, tenant_id, company_id, code, name, currency)
     VALUES ($1, $2, $3, 'V-01', 'PT Pemasok', 'IDR')`,
    [vendorId, tenant.tenantId, tenant.companyId],
  )

  warehouseId = randomUUID()
  await admin.query(
    `INSERT INTO warehouses (id, tenant_id, company_id, code, name) VALUES ($1, $2, $3, 'GD-01', 'Gudang')`,
    [warehouseId, tenant.tenantId, tenant.companyId],
  )

  for (let nomor = 0; nomor < 4; nomor += 1) {
    const id = randomUUID()
    await admin.query(
      `INSERT INTO items (id, tenant_id, company_id, code, name, type, base_uom)
       VALUES ($1, $2, $3, $4, $4, 'stock', 'unit')`,
      [id, tenant.tenantId, tenant.companyId, `BARANG-${nomor}`],
    )
    items.push(id)
  }
})

afterAll(async () => {
  await admin.end()
  await app.end()
})

/** Saldo akun perantara menurut buku besar: kredit dikurangi debit. */
async function saldoPerantara(): Promise<number> {
  const { rows } = await admin.query<{ saldo: string | null }>(
    `SELECT COALESCE(SUM(credit) - SUM(debit), 0) AS saldo
       FROM journal_lines
      WHERE tenant_id = $1 AND account_id = $2`,
    [tenant.tenantId, akun.perantara],
  )
  return Number(rows[0]?.saldo ?? 0)
}

/** Nilai barang diterima belum ditagih menurut baris pesanan. */
async function nilaiBelumDitagih(): Promise<number> {
  const { rows } = await admin.query<{
    qty_received: string
    qty_billed: string
    unit_price: string
  }>(
    `SELECT l.qty_received, l.qty_billed, l.unit_price
       FROM purchase_document_lines l
       JOIN purchase_documents d ON d.tenant_id = l.tenant_id AND d.id = l.document_id
      WHERE l.tenant_id = $1 AND d.doc_type = 'purchase_order'`,
    [tenant.tenantId],
  )

  return unbilledReceiptValue(
    rows.map((baris) => ({
      qtyReceived: Number(baris.qty_received),
      qtyBilled: Number(baris.qty_billed),
      orderedUnitPrice: Number(baris.unit_price),
    })),
  )
}

interface Siklus {
  readonly baris: readonly { itemId: string; qty: number; harga: number }[]
  readonly qtyTerima: readonly number[]
  readonly qtyTagih: readonly number[]
}

function rancangSiklus(berikutnya: () => number): Siklus {
  const jumlahBaris = Math.floor(berikutnya() * 3) + 1
  const baris = Array.from({ length: jumlahBaris }, () => ({
    itemId: items[Math.floor(berikutnya() * items.length)]!,
    qty: Math.floor(berikutnya() * 20) + 1,
    // Harga bulat ribuan supaya pembulatan dua desimal tidak menutupi selisih
    // yang seharusnya terlihat.
    harga: (Math.floor(berikutnya() * 50) + 1) * 1_000,
  }))

  // Terima sebagian atau penuh; tagih sebagian dari yang diterima. Penagihan
  // melebihi penerimaan tidak dirancang di sini karena ia memang tidak boleh
  // pernah terjadi — itu diuji di tempat lain.
  const qtyTerima = baris.map((item) => Math.max(1, Math.floor(item.qty * (0.3 + berikutnya() * 0.7))))
  const qtyTagih = qtyTerima.map((terima) => Math.max(1, Math.floor(terima * (0.3 + berikutnya() * 0.7))))

  return { baris, qtyTerima, qtyTagih }
}

async function jalankan(siklus: Siklus, periode: string): Promise<void> {
  await unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) => {
    const layanan = createPurchasing(db, tenant.tenantId)

    const pesanan = await layanan.documents.create({
      companyId: tenant.companyId,
      docType: 'purchase_order',
      vendorId,
      issueDate: new Date('2026-08-01'),
      currency: 'IDR',
      createdBy: PEMBUAT,
      lines: siklus.baris.map((baris) => ({
        itemId: baris.itemId,
        warehouseId,
        description: 'Barang',
        qty: baris.qty,
        uom: 'unit',
        unitPrice: baris.harga,
        taxRatePercent: 11,
      })),
    })
    if (pesanan.kind !== 'created') throw new Error(`pesanan gagal: ${pesanan.kind}`)

    await layanan.documents.submit(
      pesanan.documentId,
      tenant.companyId,
      'purchase_order',
      periode,
      PEMBUAT,
    )
    await layanan.documents.approve(pesanan.documentId, PENYETUJU)

    const { rows: barisPesanan } = await db.query<{ id: string; line_no: number }>(
      `SELECT id, line_no FROM purchase_document_lines
        WHERE tenant_id = $1 AND document_id = $2 ORDER BY line_no`,
      [tenant.tenantId, pesanan.documentId],
    )

    const penerimaan = await layanan.receipts.post(
      {
        companyId: tenant.companyId,
        purchaseOrderId: pesanan.documentId,
        warehouseId,
        receivedDate: new Date('2026-08-05'),
        lines: barisPesanan.map((baris, index) => ({
          poLineId: baris.id,
          qtyReceived: siklus.qtyTerima[index]!,
        })),
      },
      PEMBUAT,
    )
    if (penerimaan.kind !== 'posted') throw new Error(`penerimaan gagal: ${penerimaan.kind}`)

    const tagihan = await layanan.documents.create({
      companyId: tenant.companyId,
      docType: 'bill',
      vendorId,
      issueDate: new Date('2026-08-10'),
      currency: 'IDR',
      sourceDocumentId: pesanan.documentId,
      createdBy: PEMBUAT,
      lines: barisPesanan.map((baris, index) => ({
        itemId: siklus.baris[index]!.itemId,
        warehouseId,
        sourceLineId: baris.id,
        description: 'Barang',
        qty: siklus.qtyTagih[index]!,
        uom: 'unit',
        unitPrice: siklus.baris[index]!.harga,
        taxRatePercent: 11,
      })),
    })
    if (tagihan.kind !== 'created') throw new Error(`tagihan gagal: ${tagihan.kind}`)

    await layanan.documents.submit(tagihan.documentId, tenant.companyId, 'bill', periode, PEMBUAT)
    await layanan.documents.approve(tagihan.documentId, PENYETUJU)

    const diposting = await layanan.bills.post(tagihan.documentId, PEMOSTING)
    if (diposting.kind !== 'posted') {
      throw new Error(`posting gagal: ${diposting.kind} ${JSON.stringify(diposting)}`)
    }
  })
}

test('saldo akun perantara selalu sama dengan nilai barang diterima belum ditagih', async () => {
  const berikutnya = acak(BIBIT)

  expect(await saldoPerantara()).toBe(0)

  for (let putaran = 0; putaran < SIKLUS; putaran += 1) {
    await jalankan(rancangSiklus(berikutnya), `2026-${String((putaran % 12) + 1).padStart(2, '0')}`)

    // Diperiksa setelah SETIAP siklus, bukan hanya di akhir. Invarian yang
    // hanya benar di akhir adalah invarian yang sudah pernah salah di tengah.
    const buku = await saldoPerantara()
    const dokumen = await nilaiBelumDitagih()
    expect(buku).toBeCloseTo(dokumen, 2)
  }

  // Dan ia bukan nol karena tidak ada apa-apa: penagihan sebagian memang
  // meninggalkan sisa.
  expect(await saldoPerantara()).toBeGreaterThan(0)
})

test('menagih habis mengosongkan akun perantara', async () => {
  const berikutnya = acak(BIBIT + 1)
  const siklus = rancangSiklus(berikutnya)
  // Terima penuh, tagih penuh: tidak ada yang tersisa dari siklus ini.
  const penuh: Siklus = {
    baris: siklus.baris,
    qtyTerima: siklus.baris.map((baris) => baris.qty),
    qtyTagih: siklus.baris.map((baris) => baris.qty),
  }

  const sebelum = await saldoPerantara()
  await jalankan(penuh, '2026-12')
  const sesudah = await saldoPerantara()

  expect(sesudah).toBeCloseTo(sebelum, 2)
  expect(sesudah).toBeCloseTo(await nilaiBelumDitagih(), 2)
})
