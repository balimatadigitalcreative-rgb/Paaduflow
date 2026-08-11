import type { Pool } from 'pg'

import type { Queryable } from './queryable.js'

/**
 * Transaksi beserta konteks tenant dan penggunanya.
 *
 * `SET LOCAL` mengikat konteks ke transaksi, bukan ke koneksi. Ini bukan
 * detail: koneksi berasal dari kolam bersama, dan konteks yang menempel pada
 * koneksi akan terbawa ke permintaan pengguna berikutnya yang kebetulan
 * mendapat koneksi yang sama. Itu kelas bug yang tidak akan pernah muncul di
 * pengembangan dan selalu muncul di produksi.
 */
export class PostgresUnitOfWork {
  constructor(private readonly pool: Pool) {}

  async inTenant<T>(
    context: { tenantId: string; userId: string | null },
    fn: (db: Queryable) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', context.tenantId])
      await client.query('SELECT set_config($1, $2, true)', [
        'app.user_id',
        context.userId ?? '',
      ])
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Transaksi tanpa konteks tenant, hanya konteks pengguna.
   *
   * Dipakai satu kali di awal permintaan, untuk menentukan tenant dari company
   * di path. Kebijakan RLS `company_access` mengizinkan pengguna membaca baris
   * miliknya sendiri justru untuk langkah ini.
   */
  async asUser<T>(userId: string, fn: (db: Queryable) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT set_config($1, $2, true)', ['app.user_id', userId])
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }
}
