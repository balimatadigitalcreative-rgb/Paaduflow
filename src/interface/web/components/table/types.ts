import type { ReactNode } from 'react'

/**
 * Data table — Component_Specs_Composite §1.
 *
 * Komponen ini muncul di setiap modul, jadi kesalahan di sini berlipat tiga
 * puluh kali. Karena itu keputusan yang paling berbahaya diselesaikan lewat
 * tipe, bukan lewat disiplin.
 */

export interface Column<T> {
  readonly id: string
  readonly header: string
  /** Angka rata kanan, teks rata kiri. Header mengikuti alignment isinya. */
  readonly align?: 'start' | 'end'
  /**
   * Kolom identifier membawa tautan pembuka baris dan tidak dapat
   * disembunyikan — ia satu-satunya jalan keyboard menuju detail.
   */
  readonly identifier?: boolean
  readonly sortable?: boolean
  cell(row: T): ReactNode
  /** Nilai untuk pengurutan. Tanpa ini kolom tidak dapat diurutkan. */
  sortValue?(row: T): string | number
}

export type SortDirection = 'asc' | 'desc'

export interface SortEntry {
  readonly columnId: string
  readonly direction: SortDirection
}

/** Maksimal tiga level — di atas itu tidak ada yang dapat menjelaskan urutannya. */
export const MAX_SORT_LEVELS = 3

export type FilterState = Readonly<Record<string, string>>

/**
 * Dua mode seleksi yang tidak dapat tertukar.
 *
 * Checkbox header **hanya** menghasilkan `page`. Tidak ada jalur kode dari
 * checkbox header menuju `query`; mode itu hanya lahir dari afordans kedua
 * yang menyebutkan jumlahnya secara eksplisit.
 */
export type Selection =
  | { readonly mode: 'none' }
  | { readonly mode: 'page'; readonly ids: ReadonlySet<string> }
  | { readonly mode: 'query'; readonly filter: FilterState; readonly total: number }

/**
 * Aksi massal menerima `Selection`, bukan daftar id.
 *
 * Untuk mode `query`, daftar id memang tidak ada di dalam tipenya — sehingga
 * "mengirim 1.284 id dari klien" tidak dapat ditulis, bukan sekadar tidak
 * dianjurkan.
 */
export interface BulkAction {
  readonly id: string
  readonly label: string
  readonly destructive?: boolean
  run(selection: Selection): void | Promise<void>
}

/** Empat keadaan kosong yang berbeda, plus keadaan siap — §1.8. */
export type TableState<T> =
  | { readonly kind: 'ready'; readonly rows: readonly T[]; readonly total: number; readonly nextCursor: string | null }
  | { readonly kind: 'loading' }
  /** Belum pernah ada data di company ini. */
  | { readonly kind: 'empty' }
  /** Ada data, tetapi filter tidak cocok. Wajib membawa ringkasan filternya. */
  | { readonly kind: 'no_match'; readonly activeFilters: readonly string[] }
  | { readonly kind: 'error'; readonly message: string }
