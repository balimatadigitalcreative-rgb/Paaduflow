import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Column, SortEntry, TableState } from './types.js'

/**
 * Sortir dan pencarian untuk halaman daftar.
 *
 * Ada karena delapan tabel membutuhkan hal yang sama persis, dan sebelumnya
 * kedelapannya membuang hasil sortir: `onSortChange={() => undefined}`. Header
 * kolomnya dapat diklik, `aria-sort` berubah, dan tidak ada yang terjadi pada
 * datanya — kegagalan yang terlihat meyakinkan justru karena setengahnya
 * bekerja.
 *
 * Menyortir di klien adalah keputusan sadar untuk sekarang: seluruh daftar
 * dimuat sekaligus, jadi menyortir di server berarti perjalanan bolak-balik
 * untuk data yang sudah ada di tangan. Bila suatu hari daftar dipaginasi
 * sungguhan, sortir harus ikut pindah ke server — menyortir satu halaman dari
 * seribu baris adalah sortir yang salah, dan salahnya tidak terlihat.
 */

export interface Tabel<T> {
  readonly sort: readonly SortEntry[]
  readonly kueri: string
  setSort: (berikut: readonly SortEntry[]) => void
  setKueri: (berikut: string) => void
  /** Menerapkan pencarian lalu sortir, dalam urutan itu. */
  olah: (baris: readonly T[]) => readonly T[]
  /**
   * Menerapkan keduanya pada `TableState`, di waktu render.
   *
   * Harus di waktu render, bukan di dalam pemuatan: sortir berubah tanpa
   * memuat ulang apa pun, dan menerapkannya di `muat()` berarti mengklik header
   * kolom mengubah `aria-sort` sambil membiarkan barisnya persis seperti semula.
   *
   * Pencarian yang tidak menghasilkan apa pun menjadi `no_match`, bukan
   * `empty` — ada datanya, kueri yang tidak cocok. Tindakan yang benar untuk
   * keduanya berbeda (§1.8).
   */
  terapkan: (state: TableState<T>, filterAktif: readonly string[]) => TableState<T>
}

/**
 * `cariDi` menghasilkan teks yang dicocokkan dengan kueri.
 *
 * Disebut pemanggil, bukan diambil dari seluruh kolom. Kolom status berisi
 * elemen React, kolom nominal berisi angka terformat, dan mencocokkan kueri ke
 * keduanya menghasilkan hasil yang tidak dapat dijelaskan — mengetik "11"
 * memunculkan baris karena tarif pajaknya, bukan karena nomornya.
 */
export function useTabel<T>(
  columns: readonly Column<T>[],
  cariDi: (row: T) => readonly (string | null)[],
): Tabel<T> {
  const { t } = useTranslation()
  const [sort, setSort] = useState<readonly SortEntry[]>([])
  const [kueri, setKueri] = useState('')

  function olah(baris: readonly T[]): readonly T[] {
    const dicari = kueri.trim().toLowerCase()

    const cocok =
      dicari === ''
        ? baris
        : baris.filter((row) =>
            cariDi(row).some((teks) => (teks ?? '').toLowerCase().includes(dicari)),
          )

    if (sort.length === 0) return cocok

    /*
     * Salinan sebelum diurutkan. `Array.prototype.sort` mengubah di tempat, dan
     * mengurutkan array yang datang dari state akan mengubah state tanpa render
     * — bug yang muncul sebagai daftar yang urutannya berubah sendiri saat
     * sesuatu yang lain di-render ulang.
     */
    const urut = [...cocok]

    urut.sort((kiri, kanan) => {
      for (const entri of sort) {
        const kolom = columns.find((satu) => satu.id === entri.columnId)
        if (kolom?.sortValue === undefined) continue

        const a = kolom.sortValue(kiri)
        const b = kolom.sortValue(kanan)
        if (a === b) continue

        // Teks dibandingkan menurut aturan Indonesia, bukan menurut kode
        // karakter: tanpa itu "Ö" mendarat setelah "Z", dan nama perusahaan
        // beraksen terlempar ke ujung daftar.
        const beda =
          typeof a === 'string' && typeof b === 'string'
            ? a.localeCompare(b, 'id-ID')
            : Number(a) - Number(b)

        if (beda !== 0) return entri.direction === 'asc' ? beda : -beda
      }
      return 0
    })

    return urut
  }

  function terapkan(state: TableState<T>, filterAktif: readonly string[]): TableState<T> {
    if (state.kind !== 'ready') return state

    const baris = olah(state.rows)
    const dicari = kueri.trim()

    if (baris.length === 0) {
      return {
        kind: 'no_match',
        activeFilters:
          dicari === '' ? filterAktif : [...filterAktif, t('tabel.pencarian', { kata: dicari })],
      }
    }

    return { ...state, rows: baris, total: baris.length }
  }

  return { sort, kueri, setSort, setKueri, olah, terapkan }
}
