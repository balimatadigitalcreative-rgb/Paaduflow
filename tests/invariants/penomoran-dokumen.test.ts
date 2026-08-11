import { randomUUID } from 'node:crypto'

import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { PostgresUnitOfWork } from '#infrastructure/db/unit-of-work'

import { seedTenant, withClient, type Tenant } from './database.js'

/**
 * Penomoran dokumen — D-007, Module 04 §12.
 *
 * Sepuluh submit bersamaan harus menghasilkan sepuluh nomor berurutan tanpa
 * celah dan tanpa duplikat. Celah pada urutan nomor dokumen adalah temuan
 * audit, dan duplikat lebih buruk lagi.
 */

const BERSAMAAN = 10

let admin: Pool
let app: Pool
let unitOfWork: PostgresUnitOfWork
let tenant: Tenant

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL
  admin = new Pool({ connectionString })
  app = new Pool({ connectionString, options: '-c role=paadu_app', max: 20 })
  unitOfWork = new PostgresUnitOfWork(app)

  await withClient(async (client) => {
    tenant = await seedTenant(client, `nomor-${randomUUID().slice(0, 8)}`)
  })
})

afterAll(async () => {
  await admin.end()
  await app.end()
})

async function ambilNomor(jenis: string): Promise<string> {
  return unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) => {
    const { rows } = await db.query<{ nomor: string }>(
      'SELECT paadu.next_document_number($1, $2, $3) AS nomor',
      [tenant.companyId, jenis, '2026-08'],
    )
    return rows[0]!.nomor
  })
}

test('sepuluh submit bersamaan menghasilkan sepuluh nomor berurutan tanpa celah', async () => {
  const nomor = await Promise.all(
    Array.from({ length: BERSAMAAN }, () => ambilNomor('inv')),
  )

  expect(new Set(nomor).size).toBe(BERSAMAAN)

  const urutan = nomor
    .map((teks) => Number(teks.split('-').at(-1)))
    .sort((kiri, kanan) => kiri - kanan)

  // Berurutan dan tanpa celah: 1..10, bukan 1,2,4,5,…
  expect(urutan).toEqual(Array.from({ length: BERSAMAAN }, (_, index) => index + 1))
})

test('bentuk nomor memuat jenis dan periode', async () => {
  const nomor = await ambilNomor('so')
  expect(nomor).toMatch(/^SO-2026-08-\d{4}$/)
})

test('urutan terpisah per jenis dokumen', async () => {
  // Faktur dan pesanan tidak berbagi urutan; masing-masing mulai dari satu.
  const pertama = await ambilNomor('qt')
  expect(pertama.endsWith('0001')).toBe(true)
})

test('transaksi yang dibatalkan tidak membakar nomor', async () => {
  const sebelum = Number((await ambilNomor('cn')).split('-').at(-1))

  // Nomor diambil lalu transaksinya digagalkan.
  await unitOfWork
    .inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) => {
      await db.query('SELECT paadu.next_document_number($1, $2, $3)', [
        tenant.companyId,
        'cn',
        '2026-08',
      ])
      throw new Error('dibatalkan dengan sengaja')
    })
    .catch(() => undefined)

  const sesudah = Number((await ambilNomor('cn')).split('-').at(-1))

  // Inilah alasan penomoran memakai baris terkunci, bukan SEQUENCE: sequence
  // tidak ikut dibatalkan dan akan meninggalkan celah di sini.
  expect(sesudah).toBe(sebelum + 1)
})

test('penomoran menolak jalan tanpa konteks tenant', async () => {
  const client = await app.connect()
  try {
    const gagal = await client
      .query('SELECT paadu.next_document_number($1, $2, $3)', [tenant.companyId, 'inv', '2026-08'])
      .then(() => null)
      .catch((error: { code?: string }) => error.code)

    expect(gagal).toBe('42501')
  } finally {
    client.release()
  }
})
