import { randomUUID } from 'node:crypto'

import { Client } from 'pg'

/** Alamat basis data uji, dipasang `global-setup.ts`. */
export function databaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL
  if (url === undefined || url === '') {
    throw new Error('TEST_DATABASE_URL belum dipasang — jalankan lewat `npm test`.')
  }
  return url
}

export async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: databaseUrl() })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

/**
 * Berpindah ke peran aplikasi dan memasang konteks tenant.
 *
 * Sesudah ini, koneksi tunduk pada RLS dan pada hak akses `paadu_app` — sama
 * persis seperti runtime. Test yang menyeed data melakukannya SEBELUM memanggil
 * ini, selagi masih sebagai superuser.
 */
export async function asApp(client: Client, tenantId: string): Promise<void> {
  await client.query('SET ROLE paadu_app')
  await client.query('SELECT set_config($1, $2, false)', ['app.tenant_id', tenantId])
}

export async function asOwner(client: Client): Promise<void> {
  await client.query('RESET ROLE')
}

export interface Tenant {
  tenantId: string
  companyId: string
}

/** Menyeed satu tenant dengan satu company. Dijalankan sebagai superuser. */
export async function seedTenant(client: Client, slug: string): Promise<Tenant> {
  const tenantId = randomUUID()
  const companyId = randomUUID()

  await client.query(
    `INSERT INTO tenants (id, name, slug, region) VALUES ($1, $2, $3, 'id-jkt')`,
    [tenantId, `Tenant ${slug}`, slug],
  )
  await client.query(
    `INSERT INTO companies (id, tenant_id, legal_name, slug, default_currency)
     VALUES ($1, $2, $3, $4, 'IDR')`,
    [companyId, tenantId, `PT ${slug}`, `${slug}-utama`],
  )

  return { tenantId, companyId }
}

/** Kode SQLSTATE dari galat Postgres, atau null bila bukan galat basis data. */
export function sqlState(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code
    return typeof code === 'string' ? code : null
  }
  return null
}

/** Menjalankan sesuatu yang harus gagal, lalu mengembalikan SQLSTATE-nya. */
export async function expectFailure(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn()
  } catch (error) {
    const code = sqlState(error)
    if (code === null) throw error
    return code
  }
  throw new Error('Operasi ini seharusnya ditolak basis data, tetapi berhasil.')
}
