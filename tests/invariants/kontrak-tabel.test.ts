import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, expect, test } from 'vitest'

import { asApp, expectFailure, seedTenant, withClient, type Tenant } from './database.js'

/**
 * Kontrak tabel transaksional.
 *
 * Fungsi `paadu.apply_transactional_contract` adalah bagian paling berkonsekuensi
 * di fondasi: setiap modul berikutnya bergantung padanya untuk tidak lupa. Test
 * ini membuat tabel sungguhan lewat kontrak itu, lalu memeriksa bahwa setiap
 * janjinya benar-benar terpasang.
 */

const TABLE = 'kontrak_probe'

let a: Tenant
let b: Tenant

beforeAll(async () => {
  await withClient(async (client) => {
    a = await seedTenant(client, `kontrak-a-${randomUUID().slice(0, 8)}`)
    b = await seedTenant(client, `kontrak-b-${randomUUID().slice(0, 8)}`)

    await client.query(`
      CREATE TABLE ${TABLE} (
        id uuid NOT NULL,
        tenant_id uuid NOT NULL,
        judul text NOT NULL
      )
    `)
    await client.query('SELECT paadu.apply_transactional_contract($1, true, true)', [TABLE])
  })
})

afterAll(async () => {
  await withClient(async (client) => {
    await client.query(`DROP TABLE IF EXISTS ${TABLE}`)
    await client.query('DELETE FROM paadu.transactional_tables WHERE table_name = $1', [TABLE])
  })
})

async function insertDocument(tenant: Tenant, id: string): Promise<void> {
  await withClient(async (client) => {
    await asApp(client, tenant.tenantId)
    await client.query(
      `INSERT INTO ${TABLE} (id, tenant_id, company_id, judul) VALUES ($1, $2, $3, 'Percobaan')`,
      [id, tenant.tenantId, tenant.companyId],
    )
  })
}

test('kontrak memasang seluruh kolom lintas modul', async () => {
  await withClient(async (client) => {
    const { rows } = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [TABLE],
    )
    const columns = rows.map((row) => row.column_name)

    for (const expected of [
      'company_id',
      'document_version',
      'lifecycle_status',
      'settlement_status',
      'fulfillment_status',
      'created_at',
      'created_by',
      'updated_at',
      'updated_by',
      'deleted_at',
      'deleted_by',
    ]) {
      expect(columns, `kolom ${expected} tidak terpasang`).toContain(expected)
    }
  })
})

test('kunci primer komposit dipimpin tenant_id', async () => {
  await withClient(async (client) => {
    const { rows } = await client.query<{ definition: string }>(
      `SELECT pg_get_constraintdef(oid) AS definition
         FROM pg_constraint
        WHERE conrelid = $1::regclass AND contype = 'p'`,
      [TABLE],
    )
    expect(rows[0]?.definition).toBe('PRIMARY KEY (tenant_id, id)')
  })
})

test('document_version naik sendiri dan tidak boleh ditulis aplikasi', async () => {
  const id = randomUUID()
  await insertDocument(a, id)

  await withClient(async (client) => {
    await asApp(client, a.tenantId)

    await client.query(`UPDATE ${TABLE} SET judul = 'Diubah' WHERE id = $1`, [id])
    const { rows } = await client.query<{ document_version: number }>(
      `SELECT document_version FROM ${TABLE} WHERE id = $1`,
      [id],
    )
    expect(rows[0]?.document_version).toBe(2)

    const code = await expectFailure(() =>
      client.query(`UPDATE ${TABLE} SET document_version = 99 WHERE id = $1`, [id]),
    )
    expect(code).toBe('23514')
  })
})

test('dokumen posted tidak dapat diedit, tetapi masih dapat di-void', async () => {
  const id = randomUUID()
  await insertDocument(a, id)

  await withClient(async (client) => {
    await asApp(client, a.tenantId)
    await client.query(`UPDATE ${TABLE} SET lifecycle_status = 'posted' WHERE id = $1`, [id])

    const code = await expectFailure(() =>
      client.query(`UPDATE ${TABLE} SET judul = 'Diam-diam' WHERE id = $1`, [id]),
    )
    expect(code).toBe('42501')

    const kembaliKeDraft = await expectFailure(() =>
      client.query(`UPDATE ${TABLE} SET lifecycle_status = 'draft' WHERE id = $1`, [id]),
    )
    expect(kembaliKeDraft).toBe('42501')

    await client.query(`UPDATE ${TABLE} SET lifecycle_status = 'void' WHERE id = $1`, [id])
    const { rows } = await client.query<{ lifecycle_status: string }>(
      `SELECT lifecycle_status FROM ${TABLE} WHERE id = $1`,
      [id],
    )
    expect(rows[0]?.lifecycle_status).toBe('void')
  })
})

test('foreign key dua kolom menolak rujukan company lintas tenant', async () => {
  await withClient(async (client) => {
    // Sebagai superuser, supaya yang menolak adalah foreign key — bukan RLS.
    const code = await expectFailure(() =>
      client.query(
        `INSERT INTO ${TABLE} (id, tenant_id, company_id, judul) VALUES ($1, $2, $3, 'Silang')`,
        [randomUUID(), a.tenantId, b.companyId],
      ),
    )
    expect(code).toBe('23503')
  })
})

test('setiap tabel bertanda document_version terdaftar di registry', async () => {
  await withClient(async (client) => {
    const { rows } = await client.query<{ table_name: string }>(
      `SELECT c.table_name
         FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.column_name = 'document_version'
          AND c.table_name NOT IN (SELECT table_name FROM paadu.transactional_tables)`,
    )
    expect(rows.map((row) => row.table_name)).toEqual([])
  })
})

test('tidak ada kolom overdue di mana pun — ia kondisi turunan, bukan status', async () => {
  await withClient(async (client) => {
    const { rows } = await client.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name IN ('overdue', 'is_overdue')`,
    )
    expect(rows).toEqual([])
  })
})
