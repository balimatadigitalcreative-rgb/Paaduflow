import { useState } from 'react'

import axe from 'axe-core'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'

import { DataTable } from '#interface/web/components/table/data-table'
import type { Column, Selection, TableState } from '#interface/web/components/table/types'

interface Faktur {
  id: string
  nomor: string
  pelanggan: string
  total: number
}

const BARIS: Faktur[] = [
  { id: 'inv-1', nomor: 'INV/2026/08/0001', pelanggan: 'PT Satu', total: 1_000_000 },
  { id: 'inv-2', nomor: 'INV/2026/08/0002', pelanggan: 'PT Dua', total: 2_000_000 },
  { id: 'inv-3', nomor: 'INV/2026/08/0003', pelanggan: 'PT Tiga', total: 3_000_000 },
]

const KOLOM: Column<Faktur>[] = [
  { id: 'nomor', header: 'Nomor', identifier: true, sortable: true, cell: (row) => row.nomor },
  { id: 'pelanggan', header: 'Customer', sortable: true, cell: (row) => row.pelanggan },
  {
    id: 'total',
    header: 'Total',
    align: 'end',
    sortable: true,
    cell: (row) => row.total.toLocaleString('id-ID'),
  },
]

function Tabel({
  state,
  onBulk,
}: {
  state: TableState<Faktur>
  onBulk?: (selection: Selection) => void
}) {
  const [sort, setSort] = useState<Parameters<typeof setSortHelper>[0]>([])
  function setSortHelper(next: readonly { columnId: string; direction: 'asc' | 'desc' }[]) {
    setSort([...next])
  }

  return (
    <DataTable
      caption="Daftar Faktur Penjualan"
      columns={KOLOM}
      state={state}
      rowId={(row) => row.id}
      rowHref={(row) => `/faktur/${row.id}`}
      filter={{ status: 'draft' }}
      sort={sort}
      companyName="PT Nusantara Jaya"
      bulkActions={
        onBulk === undefined
          ? []
          : [{ id: 'batalkan', label: 'Batalkan', destructive: true, run: onBulk }]
      }
      onSortChange={setSortHelper}
    />
  )
}

const SIAP: TableState<Faktur> = { kind: 'ready', rows: BARIS, total: 1284, nextCursor: 'kursor-2' }

afterEach(() => {
  document.body.innerHTML = ''
})

test('tabel lolos audit aksesibilitas otomatis', async () => {
  const { container } = render(<Tabel state={SIAP} />)

  const hasil = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })

  if (hasil.violations.length > 0) {
    console.error(
      hasil.violations
        .map((v) => `[${v.impact ?? 'tanpa-severity'}] ${v.id}: ${v.help} (${v.nodes.length} simpul)`)
        .join('\n'),
    )
  }

  expect(hasil.violations).toEqual([])
})

test('seluruh header memakai scope col, dan yang dapat diurut berupa button', () => {
  render(<Tabel state={SIAP} />)

  for (const header of screen.getAllByRole('columnheader')) {
    expect(header.getAttribute('scope')).toBe('col')
  }

  // onClick di th tidak dapat dijangkau keyboard — temuan Major di audit prototype.
  expect(within(screen.getByRole('columnheader', { name: /Nomor/ })).getByRole('button')).toBeDefined()
})

test('sort dapat dioperasikan keyboard dan mengumumkan arahnya', async () => {
  const pengguna = userEvent.setup()
  render(<Tabel state={SIAP} />)

  const tombol = within(screen.getByRole('columnheader', { name: /Total/ })).getByRole('button')
  tombol.focus()
  await pengguna.keyboard('{Enter}')

  expect(screen.getByRole('columnheader', { name: /Total/ }).getAttribute('aria-sort')).toBe(
    'ascending',
  )

  await pengguna.keyboard('{Enter}')
  expect(screen.getByRole('columnheader', { name: /Total/ }).getAttribute('aria-sort')).toBe(
    'descending',
  )
})

test('baris dibuka lewat tautan, bukan hanya lewat klik pada tr', () => {
  render(<Tabel state={SIAP} />)

  const tautan = screen.getByRole('link', { name: 'INV/2026/08/0001' })
  expect(tautan.getAttribute('href')).toBe('/faktur/inv-1')
})

test('checkbox header hanya memilih halaman ini, dan menawarkan seluruh hasil terpisah', async () => {
  const pengguna = userEvent.setup()
  render(<Tabel state={SIAP} onBulk={() => undefined} />)

  await pengguna.click(screen.getByRole('checkbox', { name: 'Pilih baris di halaman ini' }))

  // Tiga baris, bukan 1.284.
  expect(screen.getByText('3 baris di halaman ini terpilih')).toBeDefined()

  // Afordans kedua muncul, terpisah, dan menyebutkan angkanya.
  const seluruh = screen.getByRole('button', {
    name: 'Pilih semua 1284 baris yang cocok dengan filter',
  })
  await pengguna.click(seluruh)

  expect(screen.getByText('Seluruh 1284 baris yang cocok dengan filter terpilih')).toBeDefined()
})

test('aksi massal atas seluruh hasil mengirim filter, bukan daftar id', async () => {
  const pengguna = userEvent.setup()
  const dijalankan = vi.fn()
  render(<Tabel state={SIAP} onBulk={dijalankan} />)

  await pengguna.click(screen.getByRole('checkbox', { name: 'Pilih baris di halaman ini' }))
  await pengguna.click(
    screen.getByRole('button', { name: 'Pilih semua 1284 baris yang cocok dengan filter' }),
  )
  await pengguna.click(screen.getByRole('button', { name: 'Batalkan' }))

  // Konfirmasi menyebut jumlah DAN nama company — lapis 4 indikator konteks.
  const dialog = screen.getByRole('alertdialog')
  expect(dialog.textContent).toContain('1284')
  expect(dialog.textContent).toContain('PT Nusantara Jaya')

  await pengguna.click(within(dialog).getByRole('button', { name: 'Lanjutkan' }))

  const seleksi = dijalankan.mock.calls[0]![0] as Selection
  expect(seleksi.mode).toBe('query')
  expect(seleksi).toEqual({ mode: 'query', filter: { status: 'draft' }, total: 1284 })
  // Mengirim 1.284 id dari klien akan gagal diam-diam pada tenant besar.
  expect('ids' in seleksi).toBe(false)
})

test('empat keadaan kosong berbunyi berbeda dan menawarkan aksi berbeda', () => {
  const { rerender } = render(<Tabel state={{ kind: 'empty' }} />)
  expect(screen.getByText('Belum ada data di sini')).toBeDefined()

  rerender(<Tabel state={{ kind: 'no_match', activeFilters: ['Status: Draf', 'Bulan: Agustus'] }} />)
  expect(screen.getByText('Tidak ada hasil untuk filter ini')).toBeDefined()
  // Ringkasan filter wajib ada: tanpanya pengguna menyimpulkan datanya hilang.
  expect(screen.getByText('Status: Draf')).toBeDefined()
  expect(screen.getByRole('button', { name: 'Hapus filter' })).toBeDefined()

  rerender(<Tabel state={{ kind: 'error', message: 'Koneksi terputus.' }} />)
  expect(screen.getByRole('alert').textContent).toContain('Koneksi terputus.')
  expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeDefined()
})

test('skeleton memakai jumlah kolom yang sama dengan tabel terisi', () => {
  const { rerender, container } = render(<Tabel state={{ kind: 'loading' }} />)
  const kolomSkeleton = container.querySelectorAll('tbody tr')[0]?.querySelectorAll('td').length

  rerender(<Tabel state={SIAP} />)
  const kolomTerisi = container.querySelectorAll('tbody tr')[0]?.querySelectorAll('td').length

  // Skeleton yang bentuknya salah memindahkan tombol tepat saat pengguna
  // hendak mengkliknya.
  expect(kolomSkeleton).toBe(kolomTerisi)
})

test('footer menyebut total, karena teks "pilih semua N" bergantung padanya', () => {
  render(<Tabel state={SIAP} />)
  expect(screen.getByText('3 dari 1284 baris')).toBeDefined()
})
