import type {
  IdempotencyKey,
  IdempotencyOutcome,
  IdempotencyStore,
  IdempotentResponse,
} from '#shared/idempotency'

import type { PostgresUnitOfWork } from './unit-of-work.js'

/**
 * Idempotency di atas `idempotency_keys`.
 *
 * Yang menentukan bukan pemeriksaan "sudah ada belum", melainkan `INSERT`
 * dengan `ON CONFLICT DO NOTHING`. Dua permintaan bersamaan dengan kunci sama
 * akan berlomba; hanya satu yang menyisipkan baris, dan yang kalah membaca
 * baris pemenang. Periksa-lalu-tulis akan meloloskan keduanya.
 */
export class PostgresIdempotencyStore implements IdempotencyStore {
  constructor(private readonly unitOfWork: PostgresUnitOfWork) {}

  async begin(key: IdempotencyKey): Promise<IdempotencyOutcome> {
    return this.unitOfWork.inTenant({ tenantId: key.tenantId, userId: null }, async (db) => {
      const { rowCount } = await db.query(
        `INSERT INTO idempotency_keys
           (id, tenant_id, company_id, idempotency_key, endpoint, request_hash)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, endpoint, idempotency_key) DO NOTHING`,
        [key.tenantId, key.companyId, key.key, key.endpoint, key.requestHash],
      )

      if ((rowCount ?? 0) > 0) return { state: 'fresh' }

      const { rows } = await db.query<{
        request_hash: string
        response_status: number | null
        response_body: unknown
        completed_at: Date | null
      }>(
        `SELECT request_hash, response_status, response_body, completed_at
           FROM idempotency_keys
          WHERE tenant_id = $1 AND endpoint = $2 AND idempotency_key = $3`,
        [key.tenantId, key.endpoint, key.key],
      )

      const row = rows[0]
      if (row === undefined) return { state: 'fresh' }

      // Kunci yang sama dengan muatan berbeda adalah kesalahan klien, bukan
      // pengulangan. Mengembalikan jawaban permintaan lain justru berbahaya:
      // klien akan mengira operasinya berhasil padahal yang berhasil operasi
      // yang berbeda.
      if (row.request_hash !== key.requestHash) return { state: 'conflict' }

      if (row.completed_at === null || row.response_status === null) return { state: 'in_progress' }

      return {
        state: 'replay',
        response: { status: row.response_status, body: row.response_body },
      }
    })
  }

  async complete(key: IdempotencyKey, response: IdempotentResponse): Promise<void> {
    await this.unitOfWork.inTenant({ tenantId: key.tenantId, userId: null }, async (db) => {
      await db.query(
        `UPDATE idempotency_keys
            SET response_status = $4, response_body = $5, completed_at = now()
          WHERE tenant_id = $1 AND endpoint = $2 AND idempotency_key = $3`,
        [key.tenantId, key.endpoint, key.key, response.status, JSON.stringify(response.body)],
      )
    })
  }

  async abandon(key: IdempotencyKey): Promise<void> {
    await this.unitOfWork.inTenant({ tenantId: key.tenantId, userId: null }, async (db) => {
      await db.query(
        `DELETE FROM idempotency_keys
          WHERE tenant_id = $1 AND endpoint = $2 AND idempotency_key = $3 AND completed_at IS NULL`,
        [key.tenantId, key.endpoint, key.key],
      )
    })
  }
}
