import { randomUUID } from 'node:crypto'

import { beforeAll, expect, test } from 'vitest'

import { asApp, expectFailure, seedTenant, withClient, type Tenant } from './database.js'

/**
 * Invarian 1 — data satu tenant tidak pernah terlihat oleh tenant lain.
 *
 * Diuji terhadap peran aplikasi sungguhan, bukan terhadap lapisan repository.
 * Yang dijanjikan D-003 adalah bahwa kueri yang LUPA menyaring pun tetap tidak
 * dapat membocorkan — jadi test ini sengaja tidak menyaring.
 */

let a: Tenant
let b: Tenant

beforeAll(async () => {
  await withClient(async (client) => {
    a = await seedTenant(client, `iso-a-${randomUUID().slice(0, 8)}`)
    b = await seedTenant(client, `iso-b-${randomUUID().slice(0, 8)}`)
  })
})

test('kueri tanpa filter hanya mengembalikan baris tenant sendiri', async () => {
  await withClient(async (client) => {
    await asApp(client, a.tenantId)

    const { rows } = await client.query<{ tenant_id: string }>('SELECT tenant_id FROM companies')

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.tenant_id === a.tenantId)).toBe(true)
    expect(rows.some((row) => row.tenant_id === b.tenantId)).toBe(false)
  })
})

test('membaca baris tenant lain dengan menyebut id-nya langsung tetap nol baris', async () => {
  await withClient(async (client) => {
    await asApp(client, a.tenantId)

    const { rows } = await client.query('SELECT id FROM companies WHERE id = $1', [b.companyId])

    expect(rows).toHaveLength(0)
  })
})

test('menulis baris ber-tenant_id milik tenant lain ditolak WITH CHECK', async () => {
  await withClient(async (client) => {
    await asApp(client, a.tenantId)

    const code = await expectFailure(() =>
      client.query(
        `INSERT INTO companies (id, tenant_id, legal_name, slug, default_currency)
         VALUES ($1, $2, 'PT Selundupan', 'selundupan', 'IDR')`,
        [randomUUID(), b.tenantId],
      ),
    )

    expect(code).toBe('42501')
  })
})

test('tanpa konteks tenant, tidak ada satu baris pun yang terlihat', async () => {
  await withClient(async (client) => {
    await client.query('SET ROLE paadu_app')

    // Konteks sengaja tidak dipasang. Kebijakan RLS membandingkan dengan NULL,
    // dan hasilnya menolak — gagal tertutup, bukan gagal terbuka.
    const { rows } = await client.query('SELECT id FROM companies')

    expect(rows).toHaveLength(0)
  })
})
