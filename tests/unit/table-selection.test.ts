import { describe, expect, test } from 'vitest'

import {
  applySort,
  describeSelection,
  isPageFullySelected,
  isPagePartiallySelected,
  isRowSelected,
  NOTHING,
  selectAllMatching,
  selectionCount,
  togglePage,
  toggleRow,
} from '#interface/web/components/table/selection'
import { MAX_SORT_LEVELS } from '#interface/web/components/table/types'

/**
 * Seleksi baris adalah sumber kesalahan massal paling umum di aplikasi
 * enterprise. Logikanya murni, jadi ia diuji tanpa merender apa pun.
 */

const HALAMAN = ['a', 'b', 'c']

describe('checkbox header', () => {
  test('hanya memilih halaman ini, tidak pernah seluruh hasil', () => {
    const hasil = togglePage(NOTHING, HALAMAN)

    expect(hasil.mode).toBe('page')
    // Ini jaminan intinya: tidak ada jalur dari checkbox header menuju mode
    // query, berapa pun jumlah total baris yang cocok.
    expect(hasil.mode).not.toBe('query')
  })

  test('menekan ulang saat seluruh halaman terpilih akan mengosongkan', () => {
    const terpilih = togglePage(NOTHING, HALAMAN)
    expect(togglePage(terpilih, HALAMAN)).toEqual(NOTHING)
  })

  test('sebagian terpilih ditandai indeterminate, bukan tercentang', () => {
    const sebagian = toggleRow(NOTHING, 'a')

    expect(isPageFullySelected(sebagian, HALAMAN)).toBe(false)
    expect(isPagePartiallySelected(sebagian, HALAMAN)).toBe(true)
  })
})

describe('mode seluruh hasil', () => {
  test('hanya lahir dari selectAllMatching, dan membawa jumlahnya', () => {
    const seluruh = selectAllMatching({ status: 'draft' }, 1284)

    expect(seluruh).toEqual({ mode: 'query', filter: { status: 'draft' }, total: 1284 })
    expect(selectionCount(seluruh)).toBe(1284)
  })

  test('tidak memuat daftar id sama sekali', () => {
    const seluruh = selectAllMatching({}, 1284)

    // Karena idnya memang tidak ada di dalam tipenya, "mengirim 1.284 id dari
    // klien" tidak dapat ditulis — bukan sekadar tidak dianjurkan.
    expect('ids' in seluruh).toBe(false)
  })

  test('menganggap setiap baris terpilih, termasuk yang belum dimuat', () => {
    const seluruh = selectAllMatching({}, 1284)
    expect(isRowSelected(seluruh, 'baris-yang-belum-pernah-dimuat')).toBe(true)
  })

  test('mengubah satu baris menurunkan cakupan, bukan menyimpan "semua kecuali satu"', () => {
    // "Semua kecuali satu" tidak dapat dinyatakan sebagai kueri filter, jadi ia
    // tidak boleh diam-diam tetap berlaku sebagai seluruh hasil.
    const setelahnya = toggleRow(selectAllMatching({}, 1284), 'a')

    expect(setelahnya.mode).toBe('page')
    expect(selectionCount(setelahnya)).toBe(1)
  })
})

describe('kalimat pembeda', () => {
  test('kedua mode berbunyi berbeda', () => {
    const halaman = describeSelection(togglePage(NOTHING, HALAMAN))
    const seluruh = describeSelection(selectAllMatching({}, 1284))

    /*
     * Yang dikembalikan kini KUNCI, bukan kalimat.
     *
     * Kalimatnya dulu ditulis di berkas ini — `.ts`, tanpa satu pun tag — dan
     * bertahan lama tanpa diterjemahkan justru karena pemeriksa string keras
     * hanya melihat berkas `.tsx`.
     *
     * Yang diuji tetap hal yang sama: kedua mode harus berbunyi BERBEDA.
     * Konsekuensinya berbeda jauh, dan pengguna harus dapat membedakannya
     * kapan pun.
     */
    expect(halaman).toEqual({ kunci: 'tabel.terpilihHalaman', jumlah: 3 })
    expect(seluruh).toEqual({ kunci: 'tabel.terpilihSeluruh', jumlah: 1284 })
    expect(halaman!.kunci).not.toBe(seluruh!.kunci)
  })
})

describe('pengurutan', () => {
  test('klik biasa mengganti seluruh urutan', () => {
    const awal = applySort([], 'tanggal', false)
    expect(awal).toEqual([{ columnId: 'tanggal', direction: 'asc' }])

    expect(applySort(awal, 'nomor', false)).toEqual([{ columnId: 'nomor', direction: 'asc' }])
  })

  test('klik ulang membalik arah', () => {
    const naik = applySort([], 'tanggal', false)
    expect(applySort(naik, 'tanggal', false)[0]?.direction).toBe('desc')
  })

  test('shift menambah level, dibatasi tiga', () => {
    let sort = applySort([], 'a', false)
    for (const kolom of ['b', 'c', 'd']) sort = applySort(sort, kolom, true)

    expect(sort).toHaveLength(MAX_SORT_LEVELS)
    // Level tertua yang dibuang, bukan yang terbaru.
    expect(sort.map((entry) => entry.columnId)).toEqual(['b', 'c', 'd'])
  })
})
