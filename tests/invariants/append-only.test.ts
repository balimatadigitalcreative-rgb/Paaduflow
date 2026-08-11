import { randomUUID } from 'node:crypto'

import { beforeAll, expect, test } from 'vitest'

import { APPEND_ONLY_TABLES, FORBIDDEN_PRIVILEGES } from '../../src/db/append-only-tables.js'
import { asApp, expectFailure, seedTenant, withClient, type Tenant } from './database.js'

/**
 * Invarian 2 — tabel append-only tidak dapat diubah maupun dihapus.
 *
 * Yang diuji bukan bahwa aplikasi tidak melakukannya, melainkan bahwa aplikasi
 * TIDAK DAPAT melakukannya. Karena itu penolakannya harus datang sebagai 42501
 * dari basis data, bukan sebagai galat validasi.
 */

let tenant: Tenant

beforeAll(async () => {
  await withClient(async (client) => {
    tenant = await seedTenant(client, `append-${randomUUID().slice(0, 8)}`)
  })
})

async function insertAuditRow(tenantId: string, sequence: number): Promise<string> {
  const id = randomUUID()
  await withClient(async (client) => {
    await asApp(client, tenantId)
    await client.query(
      `INSERT INTO audit_log (id, tenant_id, sequence, actor_type, action, entity_type, hash)
       VALUES ($1, $2, $3, 'human', 'company.created', 'company', 'h0')`,
      [id, tenantId, sequence],
    )
  })
  return id
}

test('peran aplikasi dapat menyisipkan ke audit_log', async () => {
  const id = await insertAuditRow(tenant.tenantId, 1)
  expect(id).toBeTruthy()
})

test('UPDATE pada audit_log ditolak basis data, bukan aplikasi', async () => {
  const id = await insertAuditRow(tenant.tenantId, 2)

  await withClient(async (client) => {
    await asApp(client, tenant.tenantId)

    const code = await expectFailure(() =>
      client.query('UPDATE audit_log SET action = $1 WHERE id = $2', ['diubah', id]),
    )

    expect(code).toBe('42501')
  })
})

test('DELETE pada audit_log ditolak basis data', async () => {
  const id = await insertAuditRow(tenant.tenantId, 3)

  await withClient(async (client) => {
    await asApp(client, tenant.tenantId)

    const code = await expectFailure(() =>
      client.query('DELETE FROM audit_log WHERE id = $1', [id]),
    )

    expect(code).toBe('42501')
  })
})

test('daftar di src/db/append-only-tables.ts sama dengan hak yang benar-benar diberikan', async () => {
  await withClient(async (client) => {
    for (const table of APPEND_ONLY_TABLES) {
      const { rows } = await client.query<{ privilege_type: string }>(
        `SELECT privilege_type
           FROM information_schema.role_table_grants
          WHERE grantee = 'paadu_app' AND table_name = $1`,
        [table],
      )
      const granted = rows.map((row) => row.privilege_type)

      // Tabel harus ada dan dapat dibaca serta ditulis —
      // daftar yang menyebut tabel yang tidak ada adalah daftar yang bohong.
      expect(granted, `${table} tidak punya hak apa pun`).toContain('SELECT')
      expect(granted).toContain('INSERT')

      for (const forbidden of FORBIDDEN_PRIVILEGES) {
        expect(granted, `${table} masih memberi ${forbidden} ke paadu_app`).not.toContain(forbidden)
      }
    }
  })
})

test('outbox_messages sengaja bukan append-only — relay harus menandainya terkirim', async () => {
  expect(APPEND_ONLY_TABLES as readonly string[]).not.toContain('outbox_messages')

  await withClient(async (client) => {
    const { rows } = await client.query<{ privilege_type: string }>(
      `SELECT privilege_type
         FROM information_schema.role_table_grants
        WHERE grantee = 'paadu_app' AND table_name = 'outbox_messages'`,
    )
    expect(rows.map((row) => row.privilege_type)).toContain('UPDATE')
  })
})
