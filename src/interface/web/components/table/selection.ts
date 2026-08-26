import { MAX_SORT_LEVELS, type FilterState, type Selection, type SortEntry } from './types.js'

/**
 * Logika seleksi dan pengurutan, murni dan tanpa DOM.
 *
 * Diletakkan terpisah karena di sinilah kesalahan paling mahal terjadi: aksi
 * massal yang mengenai baris yang tidak dimaksud. Kode yang dapat diuji tanpa
 * merender apa pun akan benar-benar diuji.
 */

export const NOTHING: Selection = { mode: 'none' }

export function isRowSelected(selection: Selection, id: string): boolean {
  if (selection.mode === 'page') return selection.ids.has(id)
  // Mode query memilih seluruh hasil, termasuk baris yang belum dimuat.
  return selection.mode === 'query'
}

export function isPageFullySelected(
  selection: Selection,
  pageIds: readonly string[],
): boolean {
  if (selection.mode === 'query') return true
  if (selection.mode === 'none' || pageIds.length === 0) return false
  return pageIds.every((id) => selection.ids.has(id))
}

export function isPagePartiallySelected(
  selection: Selection,
  pageIds: readonly string[],
): boolean {
  if (selection.mode !== 'page') return false
  const terpilih = pageIds.filter((id) => selection.ids.has(id)).length
  return terpilih > 0 && terpilih < pageIds.length
}

/**
 * Checkbox header. Ia tidak pernah menghasilkan mode `query` — memilih seluruh
 * hasil harus melewati afordans terpisah yang menyebutkan jumlahnya.
 */
export function togglePage(selection: Selection, pageIds: readonly string[]): Selection {
  if (isPageFullySelected(selection, pageIds)) return NOTHING
  return { mode: 'page', ids: new Set(pageIds) }
}

export function toggleRow(selection: Selection, id: string): Selection {
  // Mengubah satu baris saat seluruh hasil terpilih akan menghasilkan
  // "semua kecuali satu", yang tidak dapat dinyatakan sebagai kueri filter.
  // Karena itu ia menurunkan seleksi ke halaman ini saja, bukan diam-diam
  // mempertahankan cakupan yang lebih luas.
  if (selection.mode === 'query') return { mode: 'page', ids: new Set([id]) }

  const ids = new Set(selection.mode === 'page' ? selection.ids : [])
  if (ids.has(id)) ids.delete(id)
  else ids.add(id)

  return ids.size === 0 ? NOTHING : { mode: 'page', ids }
}

/**
 * Satu-satunya jalan menuju mode `query`.
 *
 * Ia menerima jumlah total supaya afordansnya dapat menyebutkan angka itu —
 * "Pilih semua 1.284 baris" — dan supaya dialog konfirmasi tidak perlu
 * menghitung ulang.
 */
export function selectAllMatching(filter: FilterState, total: number): Selection {
  return { mode: 'query', filter, total }
}

export function selectionCount(selection: Selection): number {
  if (selection.mode === 'page') return selection.ids.size
  if (selection.mode === 'query') return selection.total
  return 0
}

/**
 * Kalimat yang membedakan kedua mode bagi pengguna.
 *
 * Keduanya harus dapat dibedakan kapan pun, karena konsekuensinya berbeda jauh.
 */
/**
 * Mengembalikan KUNCI terjemahan beserta jumlahnya, bukan kalimat jadi.
 *
 * Berkas ini tidak memuat satu pun tag, dan justru itu yang membuat kalimat di
 * dalamnya bertahan lama tanpa diterjemahkan: pemeriksa string keras semula
 * hanya melihat berkas `.tsx`. Kalimat yang dipindahkan ke fungsi pembantu
 * keluar dari jangkauan tanpa ada yang menyadarinya.
 *
 * `null` berarti tidak ada yang perlu dikatakan.
 */
export function describeSelection(
  selection: Selection,
): { readonly kunci: 'tabel.terpilihHalaman' | 'tabel.terpilihSeluruh'; readonly jumlah: number } | null {
  if (selection.mode === 'none') return null
  if (selection.mode === 'page') {
    return { kunci: 'tabel.terpilihHalaman', jumlah: selection.ids.size }
  }
  return { kunci: 'tabel.terpilihSeluruh', jumlah: selection.total }
}

/** `Shift`+klik menambah level; klik biasa mengganti seluruhnya. */
export function applySort(
  current: readonly SortEntry[],
  columnId: string,
  additive: boolean,
): SortEntry[] {
  const ada = current.find((entry) => entry.columnId === columnId)
  const berikutnya: SortEntry = {
    columnId,
    direction: ada?.direction === 'asc' ? 'desc' : 'asc',
  }

  if (!additive) return [berikutnya]

  const tanpaKolomIni = current.filter((entry) => entry.columnId !== columnId)
  return [...tanpaKolomIni, berikutnya].slice(-MAX_SORT_LEVELS)
}

export function sortDirectionOf(
  sort: readonly SortEntry[],
  columnId: string,
): SortEntry['direction'] | null {
  return sort.find((entry) => entry.columnId === columnId)?.direction ?? null
}
