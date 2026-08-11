import type { ScopeFilter } from '#domain/identity/permission'

/**
 * Penerjemah cakupan izin menjadi klausa `WHERE`.
 *
 * Inilah tempat satu-satunya di seluruh sistem yang mengubah izin menjadi SQL.
 * Setiap jalur baca yang menyentuh data bertenant melewatinya — daftar,
 * pencarian, dan laporan sekalian — sehingga menambah jalur baca baru tidak
 * berarti menulis ulang penyaringannya, dan melupakannya berarti tidak punya
 * kueri sama sekali.
 */

export interface Predicate {
  readonly sql: string
  readonly params: readonly unknown[]
}

/**
 * @param alias   alias tabel di kueri pemanggil
 * @param offset  jumlah parameter yang sudah dipakai pemanggil sebelum ini
 */
export function scopePredicate(filter: ScopeFilter, alias: string, offset = 0): Predicate {
  const params: unknown[] = []
  const conditions: string[] = []

  params.push(filter.tenantId)
  conditions.push(`${alias}.tenant_id = $${offset + params.length}::uuid`)

  // Daftar kosong menghasilkan `= ANY('{}')` yang tidak pernah cocok. Izin yang
  // tidak dimiliki karena itu menghasilkan nol baris, bukan kueri tanpa filter —
  // gagal tertutup, seperti kebijakan RLS di fondasi.
  params.push([...filter.companyIds])
  conditions.push(`${alias}.company_id = ANY($${offset + params.length}::uuid[])`)

  if (filter.ownerId !== null) {
    params.push(filter.ownerId)
    conditions.push(`${alias}.created_by = $${offset + params.length}::uuid`)
  }

  // Baris terhapus lunak tidak pernah muncul di jalur baca mana pun.
  conditions.push(`${alias}.deleted_at IS NULL`)

  return { sql: conditions.join(' AND '), params }
}
