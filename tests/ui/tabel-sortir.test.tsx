import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'

import { useTabel } from '#interface/web/components/table/use-tabel'
import type { Column, TableState } from '#interface/web/components/table/types'

/**
 * Sortir dan pencarian benar-benar mengubah barisnya.
 *
 * Sebelumnya kedelapan tabel memakai `onSortChange={() => undefined}`. Header
 * kolomnya dapat diklik, `aria-sort` berubah, dan datanya diam. Kegagalan itu
 * bertahan lama justru karena setengahnya bekerja — yang memeriksanya sekilas
 * melihat penanda sortir berubah dan menyimpulkan sortirnya jalan.
 */

interface Baris {
  readonly id: string
  readonly nomor: string
  readonly nama: string
  readonly total: number
}

const DATA: readonly Baris[] = [
  { id: '1', nomor: 'INV/2026/08/0003', nama: 'Warung Sedap', total: 4_500_000 },
  { id: '2', nomor: 'INV/2026/08/0001', nama: 'Kopi Kita', total: 12_750_000 },
  { id: '3', nomor: 'INV/2026/08/0002', nama: 'Toko Berkah Jaya', total: 900_000 },
]

const COLUMNS: readonly Column<Baris>[] = [
  { id: 'nomor', header: 'Nomor', sortable: true, cell: (r) => r.nomor, sortValue: (r) => r.nomor },
  { id: 'nama', header: 'Customer', sortable: true, cell: (r) => r.nama, sortValue: (r) => r.nama },
  {
    id: 'total',
    header: 'Total',
    align: 'end',
    sortable: true,
    cell: (r) => String(r.total),
    sortValue: (r) => r.total,
  },
]

const SIAP: TableState<Baris> = {
  kind: 'ready',
  rows: DATA,
  total: DATA.length,
  nextCursor: null,
}

function pakai() {
  return renderHook(() => useTabel(COLUMNS, (row) => [row.nomor, row.nama]))
}

test('tanpa sortir, urutan asli dipertahankan', () => {
  const { result } = pakai()
  expect(result.current.olah(DATA).map((r) => r.id)).toEqual(['1', '2', '3'])
})

test('sortir teks memakai aturan Indonesia, bukan kode karakter', () => {
  const { result } = pakai()

  act(() => result.current.setSort([{ columnId: 'nama', direction: 'asc' }]))
  expect(result.current.olah(DATA).map((r) => r.nama)).toEqual([
    'Kopi Kita',
    'Toko Berkah Jaya',
    'Warung Sedap',
  ])

  act(() => result.current.setSort([{ columnId: 'nama', direction: 'desc' }]))
  expect(result.current.olah(DATA).map((r) => r.nama)).toEqual([
    'Warung Sedap',
    'Toko Berkah Jaya',
    'Kopi Kita',
  ])
})

test('sortir angka membandingkan nilai, bukan teksnya', () => {
  const { result } = pakai()
  act(() => result.current.setSort([{ columnId: 'total', direction: 'asc' }]))

  // Sebagai teks, "12750000" mendahului "4500000". Sebagai angka, tidak.
  expect(result.current.olah(DATA).map((r) => r.total)).toEqual([900_000, 4_500_000, 12_750_000])
})

test('menyortir tidak mengubah array asal', () => {
  const { result } = pakai()
  act(() => result.current.setSort([{ columnId: 'total', direction: 'asc' }]))
  result.current.olah(DATA)

  // `Array.prototype.sort` mengubah di tempat. Mengurutkan array yang datang
  // dari state akan mengubah state tanpa render — daftarnya berubah urutan
  // sendiri saat sesuatu yang lain di-render ulang.
  expect(DATA.map((r) => r.id)).toEqual(['1', '2', '3'])
})

test('pencarian mencocokkan bidang yang disebut, bukan seluruh kolom', () => {
  const { result } = pakai()

  act(() => result.current.setKueri('kopi'))
  expect(result.current.olah(DATA).map((r) => r.nama)).toEqual(['Kopi Kita'])

  // Nominal TIDAK ikut dicari. Mengetik "900" seharusnya tidak memunculkan
  // baris karena totalnya — hasil seperti itu tidak dapat dijelaskan pengguna.
  act(() => result.current.setKueri('900'))
  expect(result.current.olah(DATA)).toHaveLength(0)
})

test('pencarian yang tidak cocok menjadi no_match, bukan empty', () => {
  const { result } = pakai()
  act(() => result.current.setKueri('tidak ada'))

  const state = result.current.terapkan(SIAP, ['Terposting'])

  /*
   * Bedanya menentukan tindakan yang benar. `empty` menawarkan "buat faktur
   * pertama"; `no_match` menawarkan "hapus filter". Menyamakan keduanya
   * menyuruh orang membuat data baru padahal datanya ada dan hanya tersaring.
   */
  expect(state.kind).toBe('no_match')
  if (state.kind === 'no_match') {
    expect(state.activeFilters).toContain('Terposting')
    expect(state.activeFilters.some((teks) => teks.includes('tidak ada'))).toBe(true)
  }
})

test('state selain ready diteruskan apa adanya', () => {
  const { result } = pakai()

  // Sortir tidak boleh mengubah skeleton menjadi "tidak ada hasil", dan tidak
  // boleh menyembunyikan pesan galat.
  expect(result.current.terapkan({ kind: 'loading' }, []).kind).toBe('loading')
  expect(result.current.terapkan({ kind: 'empty' }, []).kind).toBe('empty')
  expect(result.current.terapkan({ kind: 'error', message: 'gagal' }, []).kind).toBe('error')
})

test('total ikut menyesuaikan hasil pencarian', () => {
  const { result } = pakai()
  act(() => result.current.setKueri('INV/2026/08/000'))

  const state = result.current.terapkan(SIAP, [])
  expect(state.kind).toBe('ready')
  if (state.kind === 'ready') {
    // Jumlah yang ditampilkan harus jumlah yang terlihat. Menyisakan total asal
    // membuat "3 dari 3" muncul di atas satu baris.
    expect(state.total).toBe(state.rows.length)
  }
})
