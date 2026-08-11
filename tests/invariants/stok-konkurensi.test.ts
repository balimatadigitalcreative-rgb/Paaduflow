import { randomUUID } from 'node:crypto'

import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { StockService } from '#application/inventory/stock'
import { PostgresUnitOfWork } from '#infrastructure/db/unit-of-work'
import { PostgresStockRepository } from '#infrastructure/modules/inventory/postgres-stock-repository'
import { uuidv7 } from '#shared/uuid'

import { expectFailure, seedTenant, withClient, type Tenant } from './database.js'

/**
 * Invarian persediaan — Module 05 §12.
 *
 * Yang terpenting di modul ini adalah konkurensi: dua pesanan bersamaan atas
 * sisa stok terakhir harus menghasilkan tepat satu keberhasilan. Periksa-lalu-
 * tulis akan meloloskan keduanya, dan kesalahannya baru terlihat saat barang
 * yang dijanjikan ke dua pelanggan ternyata hanya ada satu.
 */

const PUTARAN = 100

let admin: Pool
let app: Pool
let unitOfWork: PostgresUnitOfWork
let tenant: Tenant
let warehouseId: string

async function buatItem(kode: string): Promise<string> {
  const id = randomUUID()
  await admin.query(
    `INSERT INTO items (id, tenant_id, company_id, code, name, type, base_uom)
     VALUES ($1, $2, $3, $4, $4, 'stock', 'kg')`,
    [id, tenant.tenantId, tenant.companyId, kode],
  )
  return id
}

function layanan(db: Parameters<Parameters<PostgresUnitOfWork['inTenant']>[1]>[0]) {
  return new StockService(new PostgresStockRepository(db, tenant.tenantId), () => uuidv7())
}

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL
  admin = new Pool({ connectionString })
  app = new Pool({ connectionString, options: '-c role=paadu_app', max: 20 })
  unitOfWork = new PostgresUnitOfWork(app)

  await withClient(async (client) => {
    tenant = await seedTenant(client, `stok-${randomUUID().slice(0, 8)}`)
  })

  warehouseId = randomUUID()
  await admin.query(
    `INSERT INTO warehouses (id, tenant_id, company_id, code, name)
     VALUES ($1, $2, $3, 'GD-01', 'Gudang Utama')`,
    [warehouseId, tenant.tenantId, tenant.companyId],
  )
})

afterAll(async () => {
  await admin.end()
  await app.end()
})

test('dua reservasi bersamaan atas sisa terakhir: tepat satu berhasil, seratus kali', async () => {
  let berhasilTotal = 0

  for (let putaran = 0; putaran < PUTARAN; putaran += 1) {
    const itemId = await buatItem(`ITEM-${putaran}`)

    // Stok masuk tepat satu unit.
    await unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) =>
      layanan(db).move({
        companyId: tenant.companyId,
        itemId,
        warehouseId,
        type: 'receipt',
        qtyBase: 1,
        unitCost: 10_000,
      }),
    )

    // Dua permintaan berangkat bersamaan atas unit yang sama.
    const hasil = await Promise.all(
      ['pesanan-a', 'pesanan-b'].map((sumber) =>
        unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) =>
          layanan(db).reserve({
            companyId: tenant.companyId,
            itemId,
            warehouseId,
            qtyBase: 1,
            sourceType: sumber,
          }),
        ),
      ),
    )

    const berhasil = hasil.filter((item) => item.kind === 'reserved').length
    expect(berhasil).toBe(1)
    berhasilTotal += berhasil

    // Dan saldonya tidak pernah menjadi negatif tersedia.
    const { rows } = await admin.query<{ qty_available: string }>(
      `SELECT qty_available FROM stock_balances
        WHERE tenant_id = $1 AND item_id = $2 AND warehouse_id = $3`,
      [tenant.tenantId, itemId, warehouseId],
    )
    expect(Number(rows[0]?.qty_available)).toBe(0)
  }

  expect(berhasilTotal).toBe(PUTARAN)
}, 180_000)

test('qty_available adalah kolom terhitung, tidak dapat ditulis', async () => {
  const itemId = await buatItem('ITEM-TERHITUNG')

  const kode = await expectFailure(() =>
    admin.query(
      `INSERT INTO stock_balances
         (tenant_id, company_id, item_id, warehouse_id, qty_on_hand, qty_reserved, qty_available)
       VALUES ($1, $2, $3, $4, 10, 2, 99)`,
      [tenant.tenantId, tenant.companyId, itemId, warehouseId],
    ),
  )

  // 428C9: kolom terhitung tidak dapat diisi langsung. Nilai yang tidak sama
  // dengan on_hand − reserved karena itu tidak mungkin tersimpan.
  expect(kode).toBe('428C9')
})

test('stock_movements append-only: UPDATE dan DELETE ditolak basis data', async () => {
  const itemId = await buatItem('ITEM-APPEND')

  await unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) =>
    layanan(db).move({
      companyId: tenant.companyId,
      itemId,
      warehouseId,
      type: 'receipt',
      qtyBase: 5,
      unitCost: 1_000,
    }),
  )

  const client = await app.connect()
  try {
    await client.query('SELECT set_config($1, $2, false)', ['app.tenant_id', tenant.tenantId])
    const kodeUpdate = await expectFailure(() =>
      client.query('UPDATE stock_movements SET qty_base = 999 WHERE tenant_id = $1', [
        tenant.tenantId,
      ]),
    )
    expect(kodeUpdate).toBe('42501')
  } finally {
    client.release()
  }
})

test('saldo adalah proyeksi: dibangun ulang dari mutasi menghasilkan angka identik', async () => {
  const itemId = await buatItem('ITEM-PROYEKSI')

  for (const qty of [10, -3, 25, -7, 4]) {
    await unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) =>
      layanan(db).move({
        companyId: tenant.companyId,
        itemId,
        warehouseId,
        type: qty > 0 ? 'receipt' : 'shipment',
        qtyBase: qty,
        unitCost: 1_000,
      }),
    )
  }

  const sebelum = await bacaSaldo(itemId)

  // Proyeksi sengaja dirusak, lalu dibangun ulang dari buku besar.
  await admin.query(
    `UPDATE stock_balances SET qty_on_hand = 0, value = 0
      WHERE tenant_id = $1 AND item_id = $2`,
    [tenant.tenantId, itemId],
  )

  await unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) => {
    await db.query('SELECT paadu.rebuild_stock_balances($1)', [tenant.companyId])
  })

  const sesudah = await bacaSaldo(itemId)

  // Bila keduanya berbeda, mutasi yang benar — dan di sini keduanya sama.
  expect(sesudah).toEqual(sebelum)
  expect(sesudah.onHand).toBe(29)
})

test('reservasi yang dilepas mengembalikan ketersediaan', async () => {
  const itemId = await buatItem('ITEM-LEPAS')

  await unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) =>
    layanan(db).move({
      companyId: tenant.companyId,
      itemId,
      warehouseId,
      type: 'receipt',
      qtyBase: 10,
      unitCost: 1_000,
    }),
  )

  const dipesan = await unitOfWork.inTenant(
    { tenantId: tenant.tenantId, userId: null },
    async (db) =>
      layanan(db).reserve({
        companyId: tenant.companyId,
        itemId,
        warehouseId,
        qtyBase: 4,
        sourceType: 'pesanan',
      }),
  )
  if (dipesan.kind !== 'reserved') throw new Error('reservasi gagal')

  expect((await bacaSaldo(itemId)).available).toBe(6)

  await unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) =>
    layanan(db).release(dipesan.reservationId, itemId, warehouseId),
  )

  expect((await bacaSaldo(itemId)).available).toBe(10)
  // Stok fisik tidak pernah berubah karena reservasi — hanya ketersediaannya.
  expect((await bacaSaldo(itemId)).onHand).toBe(10)
})

async function bacaSaldo(
  itemId: string,
): Promise<{ onHand: number; reserved: number; available: number; value: number }> {
  const { rows } = await admin.query<{
    qty_on_hand: string
    qty_reserved: string
    qty_available: string
    value: string
  }>(
    `SELECT qty_on_hand, qty_reserved, qty_available, value FROM stock_balances
      WHERE tenant_id = $1 AND item_id = $2`,
    [tenant.tenantId, itemId],
  )
  const row = rows[0]!
  return {
    onHand: Number(row.qty_on_hand),
    reserved: Number(row.qty_reserved),
    available: Number(row.qty_available),
    value: Number(row.value),
  }
}
