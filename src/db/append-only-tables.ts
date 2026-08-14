/**
 * Tabel yang tidak pernah di-UPDATE maupun di-DELETE — D-005.
 *
 * Daftar ini kembar dengan hak akses yang diberikan di `migrations/0005_ledger.sql`.
 * Yang menjaga keduanya tidak menyimpang bukan disiplin, melainkan test invarian
 * `tests/invariants/append-only.test.ts`: ia membaca daftar ini dan membandingkannya
 * dengan katalog Postgres. Menambah nama di sini tanpa mencabut haknya di migrasi
 * akan menggagalkan build, dan sebaliknya.
 *
 * `outbox_messages` sengaja TIDAK ada di sini. Relay harus menandai pesan terkirim
 * dan memangkas yang lama — lihat D-035.
 */
export const APPEND_ONLY_TABLES = [
  'audit_log',
  'journals',
  'journal_lines',
  // Dasar laporan masa. Dasar yang dapat disunting bukan dasar — Module 08 §6.
  'tax_ledger',
] as const

export type AppendOnlyTable = (typeof APPEND_ONLY_TABLES)[number]

/** Hak yang tidak boleh dimiliki peran aplikasi pada tabel di atas. */
export const FORBIDDEN_PRIVILEGES = ['UPDATE', 'DELETE', 'TRUNCATE'] as const
