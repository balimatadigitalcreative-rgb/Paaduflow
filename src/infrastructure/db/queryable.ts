import type { Pool, PoolClient } from 'pg'

/**
 * Apa pun yang dapat menjalankan kueri — kolam koneksi maupun satu koneksi di
 * dalam transaksi.
 *
 * Repository menerima ini, bukan `Pool`, supaya use case yang perlu atomik
 * dapat menyerahkan koneksi transaksinya sendiri tanpa repository mengetahui
 * ada transaksi (D-032).
 */
export type Queryable = Pool | PoolClient
