import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'

import { AgeingChart } from '#interface/web/components/ageing-chart'
import { KpiCard } from '#interface/web/components/kpi-card'

/**
 * Grafik dasbor — aturan mengikat dari Component_Specs_Composite §8 dan
 * Color_System §2.
 *
 * Ketiganya diperiksa mesin karena ketiganya mudah hilang tanpa terlihat:
 * tabel tersembunyi dapat dihapus tanpa merusak tampilan, pembeda selain warna
 * hanya terasa hilang oleh yang buta warna, dan grafik yang tidak dapat diklik
 * tetap terlihat baik dari luar.
 */

const EMBER = [
  { id: 'belum_tempo', label: 'Belum jatuh tempo', amount: 333_534_854, count: 5, overdue: false },
  { id: 'lewat_30', label: '1–30 hari', amount: 400_172_011, count: 5, overdue: true },
  { id: 'lewat_60', label: '31–60 hari', amount: 92_902_005, count: 1, overdue: true },
  { id: 'lewat_lebih', label: 'Lebih dari 60 hari', amount: 92_887_742, count: 1, overdue: true },
  { id: 'tanpa_tempo', label: 'Tanpa jatuh tempo', amount: 0, count: 0, overdue: false },
]

const rupiah = (nilai: number) => nilai.toLocaleString('id-ID')

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('grafik umur piutang membawa tabel tersembunyi berisi seluruh embernya', () => {
  render(<AgeingChart buckets={EMBER} caption="Umur piutang" format={rupiah} />)

  const tabel = screen.getByRole('table', { name: 'Umur piutang' })
  const baris = within(tabel).getAllByRole('row')

  // Kepala tabel + lima ember. Termasuk ember bernilai nol: yang hilang dari
  // tabel tidak dapat dibedakan dari yang tidak ada.
  expect(baris).toHaveLength(6)
  for (const ember of EMBER) {
    expect(within(tabel).getByRole('rowheader', { name: ember.label })).toBeDefined()
  }
})

test('warna bukan satu-satunya pembeda: yang lewat tempo diberi penanda sendiri', () => {
  const { container } = render(
    <AgeingChart buckets={EMBER} caption="Umur piutang" format={rupiah} />,
  )

  /*
   * `data-tempo` adalah kait CSS untuk arsir diagonal — pembeda kedua di
   * samping warna. Color_System §2 menyebutnya syarat WCAG 1.4.1, bukan
   * tambahan aksesibilitas.
   */
  const bertempo = container.querySelectorAll('[data-tempo="true"]')
  expect(bertempo.length).toBeGreaterThan(0)

  // Pembeda KETIGA: setiap ember membawa labelnya sendiri di legenda, jadi
  // grafik tetap terbaca bahkan bila warna dan arsir keduanya hilang.
  for (const ember of EMBER) {
    expect(screen.getAllByText(ember.label).length).toBeGreaterThan(0)
  }
})

test('setiap ember dapat diklik menuju rinciannya', async () => {
  const orang = userEvent.setup()
  const dipilih = vi.fn()

  render(
    <AgeingChart buckets={EMBER} caption="Umur piutang" format={rupiah} onPilih={dipilih} />,
  )

  await orang.click(screen.getByRole('button', { name: /1–30 hari/ }))
  expect(dipilih).toHaveBeenCalledWith('lewat_30')

  // Ember kosong tidak dapat diklik — ia tidak punya rincian untuk dibuka.
  // `jest-dom` tidak dipasang di repo ini, jadi diperiksa lewat properti DOM.
  const kosong = screen.getByRole('button', { name: /Tanpa jatuh tempo/ })
  expect((kosong as HTMLButtonElement).disabled).toBe(true)
})

test('grafik kosong berkata apa adanya, bukan menggambar batang nol', () => {
  render(
    <AgeingChart
      buckets={EMBER.map((ember) => ({ ...ember, amount: 0, count: 0 }))}
      caption="Umur piutang"
      format={rupiah}
    />,
  )

  // Batang nol terlihat seperti grafik yang rusak, bukan seperti buku yang bersih.
  expect(screen.getByRole('status').textContent).toMatch(/tidak ada piutang/i)
})

test('sparkline membawa tabel tersembunyi dan tidak digambar tanpa riwayat', () => {
  const { rerender } = render(
    <KpiCard
      label="Pendapatan bulan ini"
      value="300.481.850"
      changePercent={8.5}
      comparisonBasis="vs Juli 2026"
      higherIsBetter
      href="#/akuntansi/buku-besar"
      series={[10, 20, 15, 30]}
    />,
  )

  /*
   * Namanya kini LABEL kartunya, bukan "Riwayat <label>".
   *
   * Cadangan lamanya menempelkan kata Indonesia di dalam komponen, dan kata
   * itu tetap muncul di layar berbahasa Inggris. Yang memanggil komponen ini
   * mengirim `seriesLabel` yang sudah diterjemahkan; cadangannya kini hanya
   * mengulang label yang sudah diterjemahkan pula.
   */
  expect(screen.getByRole('table', { name: /Pendapatan bulan ini/i })).toBeDefined()
  expect(screen.getByRole('img', { name: /Pendapatan bulan ini/i })).toBeDefined()

  /*
   * Deret kosong berarti tidak ada riwayat yang bermakna. Menggambar garis
   * dari data yang tidak ada adalah grafik yang berbohong dengan meyakinkan —
   * dan sparkline berbohong lebih mudah daripada angka, karena tidak ada yang
   * memeriksanya.
   */
  rerender(
    <KpiCard
      label="Piutang jatuh tempo"
      value="185.789.747"
      changePercent={null}
      comparisonBasis="Posisi hari ini"
      higherIsBetter={false}
      href="#/penjualan"
      series={[]}
    />,
  )

  expect(screen.queryByRole('img', { name: /Piutang jatuh tempo/i })).toBeNull()
})

test('palet data-viz dibaca lewat token Lapis 2, bukan langsung dari primitif', () => {
  const css = readFileSync(
    join(process.cwd(), 'src/interface/web/components/primitives.module.css'),
    'utf8',
  )

  /*
   * Design_Tokens §1: komponen hanya membaca Lapis 2 atau 3. Membaca
   * `--dataviz-*` langsung mengunci komponen ke warna alih-alih ke peran, dan
   * saat brand tenant berubah setiap komponen harus disentuh satu per satu.
   *
   * Ada lint rule untuk ini; uji ini menjaga kalau rule-nya suatu hari
   * dilonggarkan.
   */
  expect(css).not.toMatch(/var\(--dataviz-\d\)/)
  expect(css).toMatch(/var\(--chart-series-\d\)/)
})
