import type { ScopeFilter } from '#domain/identity/permission'

import type { Queryable } from './queryable.js'
import { scopePredicate } from './scoped-query.js'

/**
 * Satu-satunya jalan membaca data bertenant.
 *
 * Daftar, pencarian, dan laporan melewati kelas yang sama, sehingga ketiganya
 * memakai penyaringan yang sama persis. Kebocoran lintas company hampir tidak
 * pernah terjadi di endpoint utama — ia terjadi di pencarian global dan di
 * laporan, karena keduanya biasanya ditulis belakangan oleh orang lain dengan
 * kueri yang dirakit sendiri.
 *
 * Di sini tidak ada jalan merakit kueri tanpa filter: setiap metode menerima
 * `ScopeFilter` sebagai argumen wajib, dan tidak ada metode yang menerima SQL
 * mentah.
 */

export interface EntityDescriptor {
  /** Nama yang muncul di hasil pencarian. */
  readonly name: string
  readonly table: string
  readonly labelColumn: string
  readonly searchColumns: readonly string[]
}

export interface SearchHit {
  readonly entity: string
  readonly id: string
  readonly companyId: string
  readonly label: string
}

export interface ScopedRequest {
  readonly entity: EntityDescriptor
  readonly filter: ScopeFilter
}

export class ScopedStore {
  constructor(private readonly db: Queryable) {}

  async list(
    entity: EntityDescriptor,
    filter: ScopeFilter,
    limit = 50,
  ): Promise<{ id: string; companyId: string; label: string }[]> {
    const predicate = scopePredicate(filter, 't')
    const { rows } = await this.db.query<{ id: string; company_id: string; label: string }>(
      `SELECT t.id, t.company_id, t.${entity.labelColumn} AS label
         FROM ${entity.table} t
        WHERE ${predicate.sql}
        ORDER BY t.created_at DESC
        LIMIT $${predicate.params.length + 1}`,
      [...predicate.params, limit],
    )
    return rows.map((row) => ({ id: row.id, companyId: row.company_id, label: row.label }))
  }

  /**
   * Pencarian lintas entitas.
   *
   * Hasil yang tidak diizinkan tidak pernah diakui keberadaannya — tidak ada
   * "3 hasil disembunyikan", dan tidak ada jumlah total yang menyertakannya
   * (Information Architecture §6). Entitas yang izinnya tidak dimiliki
   * menghasilkan filter buntu, jadi ia ikut dikueri dan mengembalikan nol baris.
   */
  async search(requests: readonly ScopedRequest[], term: string, limit = 20): Promise<SearchHit[]> {
    const hits: SearchHit[] = []

    for (const request of requests) {
      const predicate = scopePredicate(request.filter, 't')
      const termParam = predicate.params.length + 1
      const limitParam = predicate.params.length + 2

      const matches = request.entity.searchColumns
        .map((column) => `t.${column} ILIKE '%' || $${termParam} || '%'`)
        .join(' OR ')

      const { rows } = await this.db.query<{ id: string; company_id: string; label: string }>(
        `SELECT t.id, t.company_id, t.${request.entity.labelColumn} AS label
           FROM ${request.entity.table} t
          WHERE ${predicate.sql}
            AND (${matches})
          ORDER BY t.created_at DESC
          LIMIT $${limitParam}`,
        [...predicate.params, term, limit],
      )

      for (const row of rows) {
        hits.push({
          entity: request.entity.name,
          id: row.id,
          companyId: row.company_id,
          label: row.label,
        })
      }
    }

    return hits
  }

  /**
   * Penjumlahan untuk laporan.
   *
   * Jalur inilah yang paling sering bocor: angka total terasa "tidak
   * mengungkapkan baris", padahal satu angka sudah cukup untuk menyimpulkan
   * omzet company yang tidak boleh dilihat.
   */
  async sum(entity: EntityDescriptor, filter: ScopeFilter, column: string): Promise<number> {
    const predicate = scopePredicate(filter, 't')
    const { rows } = await this.db.query<{ total: string | null }>(
      `SELECT COALESCE(sum(t.${column}), 0) AS total
         FROM ${entity.table} t
        WHERE ${predicate.sql}`,
      [...predicate.params],
    )
    return Number(rows[0]?.total ?? 0)
  }
}
