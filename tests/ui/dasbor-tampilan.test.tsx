import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, render, screen, within } from '@testing-library/react'
import { IconFileInvoice, IconShoppingCart } from '@tabler/icons-react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { BarChart } from '#interface/web/components/bar-chart'
import { KpiCard } from '#interface/web/components/kpi-card'
import { gantiBahasa } from '#interface/web/i18n/index'
import { AppShell } from '#interface/web/shell/app-shell'
import { PreferencesProvider } from '#interface/web/shell/preferences'

/**
 * Tujuh keluhan dari tangkapan layar dasbor.
 *
 * Yang diuji di sini adalah hal yang dapat dibuktikan mesin: struktur yang
 * dirender, atribut yang membawa makna, dan aturan CSS yang mudah dilanggar
 * tanpa terlihat. jsdom tidak menghitung tata letak, jadi "apakah lubangnya
 * benar-benar tertutup" tetap menuntut mata — dan itu dikatakan apa adanya.
 */

const LEBAR = [1440, 1024, 768, 390] as const

const SHELL_CSS = readFileSync(
  join(process.cwd(), 'src/interface/web/shell/shell.module.css'),
  'utf8',
)
const PRIMITIF_CSS = readFileSync(
  join(process.cwd(), 'src/interface/web/components/primitives.module.css'),
  'utf8',
)
const HALAMAN_CSS = readFileSync(
  join(process.cwd(), 'src/interface/web/pages/pages.module.css'),
  'utf8',
)

const MODUL = [
  { id: 'penjualan', name: 'Penjualan', glyph: IconFileInvoice, permitted: true },
  { id: 'pembelian', name: 'Pembelian', glyph: IconShoppingCart, permitted: true },
]

function padaLebar(lebar: number): void {
  vi.stubGlobal('matchMedia', (kueri: string) => {
    const cocok = /max-width:\s*(\d+)px/.exec(kueri)
    return {
      matches: cocok === null ? false : lebar <= Number(cocok[1]),
      media: kueri,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }
  })
}

function pasangShell(sidebarItems: readonly { id: string; label: string; group: 'Transaksi' | 'Laporan'; permitted: boolean }[]) {
  return render(
    <PreferencesProvider>
      <AppShell
        switcher={{
          tenant: {
            id: 't1',
            name: 'Grup Merah',
            companies: [
              {
                id: 'c1',
                legalName: 'PT Merah Satu',
                taxId: null,
                currency: 'IDR',
                fiscalYearLabel: 'FY2026',
                status: 'active' as const,
              },
            ],
          },
          otherTenants: [],
          activeCompanyId: 'c1',
          onSwitch: () => undefined,
        }}
        modules={MODUL}
        activeModule={MODUL[0]!}
        sidebarItems={sidebarItems}
        activeItemId="dasbor"
        paletteItems={[]}
        pageTitle="Dasbor"
        breadcrumb={['Dasbor']}
        fiscalPeriod="FY2026 P8"
        userName="Siti Rahmawati"
        userRole="Admin Company"
        onSelectModule={() => undefined}
        onSelectItem={() => undefined}
      >
        <p>Area konten.</p>
      </AppShell>
    </PreferencesProvider>,
  )
}

const SATU = [{ id: 'dasbor', label: 'Ringkasan', group: 'Transaksi' as const, permitted: true }]
const DUA = [
  ...SATU,
  { id: 'laporan', label: 'Laba Rugi', group: 'Laporan' as const, permitted: true },
]

afterEach(async () => {
  cleanup()
  vi.unstubAllGlobals()
  globalThis.localStorage.clear()
  await gantiBahasa('id')
})

// ── 1 · Sidebar nyaris kosong ───────────────────────────────────────────────

describe('sidebar dengan satu tujuan', () => {
  test.each(LEBAR)('%ipx — tidak dirender sama sekali', (lebar) => {
    padaLebar(lebar)
    pasangShell(SATU)

    /*
     * Bukan dirender lalu disembunyikan CSS: kolom 240px yang berisi satu item
     * — dan item itu halaman yang sedang dibuka — tidak memberi tahu apa pun.
     * Rail sudah menunjukkan modulnya, page header sudah menyebut namanya.
     */
    expect(screen.queryByRole('navigation', { name: /Navigasi Penjualan/ })).toBeNull()

    // Rail modul TETAP ada — yang dibuang hanya kolom keduanya.
    expect(screen.getByRole('navigation', { name: 'Modul' })).toBeTruthy()
  })

  test.each(LEBAR)('%ipx — dua tujuan tetap memunculkannya', (lebar) => {
    padaLebar(lebar)
    pasangShell(DUA)

    expect(screen.getByRole('navigation', { name: /Navigasi Penjualan/ })).toBeTruthy()
  })
})

// ── 3 · Bahasa campur ───────────────────────────────────────────────────────

test('nama grup sidebar ikut berganti bahasa', async () => {
  padaLebar(1440)
  const { rerender } = pasangShell(DUA)

  const sidebar = screen.getByRole('navigation', { name: /Navigasi Penjualan/ })
  expect(within(sidebar).getByText('Transaksi')).toBeTruthy()

  /*
   * Inilah keluhan aslinya: "TRANSAKSI" berdiri di sebelah "Dashboard". Nama
   * grup dirender apa adanya dari konstanta, dan konstanta itu berbahasa
   * Indonesia.
   */
  await gantiBahasa('en')
  rerender(<div />)
  cleanup()
  pasangShell(DUA)

  const sesudah = screen.getByRole('navigation', { name: /navigation/i })
  expect(within(sesudah).getByText('Transactions')).toBeTruthy()
  expect(within(sesudah).queryByText('Transaksi')).toBeNull()
})

// ── 4 · Grafik batang tanpa sumbu nilai ─────────────────────────────────────

describe('sumbu nilai grafik batang', () => {
  const TITIK = [
    { label: 'Agu 25', value: 0, display: '0' },
    { label: 'Sep 25', value: 50_000_000, display: '50.000.000' },
    { label: 'Okt 25', value: 100_000_000, display: '100.000.000' },
  ]

  test.each(LEBAR)('%ipx — tiga tanda sumbu terbaca', (lebar) => {
    padaLebar(lebar)
    render(
      <BarChart
        points={TITIK}
        caption="Pendapatan dua belas bulan terakhir (IDR)"
        valueHeader="Pendapatan"
        format={(nilai) => new Intl.NumberFormat('id-ID').format(nilai)}
      />,
    )

    /*
     * Tanpa sumbu, dua belas batang hanya bentuk: tidak ada cara mengetahui
     * apakah yang tertinggi berarti lima juta atau lima ratus juta.
     */
    const figure = document.querySelector('figure')!
    const sumbu = figure.querySelector('[aria-hidden="true"]')!
    expect(sumbu.textContent).toContain('100.000.000')
    expect(sumbu.textContent).toContain('50.000.000')
    expect(sumbu.textContent).toContain('0')
  })

  test('setiap batang membawa nilainya sendiri saat disentuh kursor', () => {
    padaLebar(1440)
    const { container } = render(
      <BarChart
        points={TITIK}
        caption="Pendapatan"
        valueHeader="Pendapatan"
        format={(nilai) => String(nilai)}
      />,
    )

    const judul = [...container.querySelectorAll('rect title')].map((satu) => satu.textContent)
    expect(judul).toContain('Okt 25: 100.000.000')
  })
})

// ── 5 · Aksen kartu KPI ─────────────────────────────────────────────────────

describe('aksen kartu KPI', () => {
  function kartu(changePercent: number | null, higherIsBetter: boolean) {
    const { container } = render(
      <KpiCard
        label="Pendapatan bulan ini"
        value="300.481.850"
        changePercent={changePercent}
        comparisonBasis="vs Juli 2026"
        higherIsBetter={higherIsBetter}
        href="#/akuntansi/buku-besar"
      />,
    )
    return container.querySelector('a')!
  }

  test('warnanya menyatakan BAIK atau BURUK, bukan kategori kartu', () => {
    padaLebar(1440)

    // Naik, dan naik memang diinginkan.
    expect(kartu(8.5, true).getAttribute('data-nada')).toBe('baik')
    cleanup()

    // Naik, tetapi naik TIDAK diinginkan — piutang jatuh tempo yang bertambah.
    expect(kartu(8.5, false).getAttribute('data-nada')).toBe('buruk')
    cleanup()

    /*
     * Tanpa pembanding, tidak ada yang dapat dikatakan — jadi tidak ada yang
     * dikatakan. Sebelumnya kartu ini tetap berwarna menurut kategorinya, dan
     * warna itu terbaca sebagai penilaian yang tidak pernah dibuat siapa pun.
     */
    expect(kartu(null, true).getAttribute('data-nada')).toBe('netral')
  })

  test('kategori kartu tidak lagi menentukan warna apa pun', () => {
    expect(PRIMITIF_CSS).not.toMatch(/data-kategori/)
    expect(PRIMITIF_CSS).toMatch(/\.kpiCard\[data-nada='baik'\]::before/)
    expect(PRIMITIF_CSS).toMatch(/\.kpiCard\[data-nada='buruk'\]::before/)

    // Netral tidak punya aturan sendiri: bawaannya transparan.
    expect(PRIMITIF_CSS).toMatch(/\.kpiCard::before\s*\{[^}]*background:\s*transparent/)
  })
})

// ── 2, 6, 7 · Aturan CSS dan struktur ───────────────────────────────────────

describe('tata letak dan judul', () => {
  test('breadcrumb tidak menggambar penanda daftar', () => {
    /*
     * `<ol>` karena urutannya bermakna, tetapi item flex tetap berjenis
     * `list-item` dan penandanya tetap digambar — layar menampilkan
     * "1. DASHBOARD". Angka itu menghitung ruas jalur, bukan langkah.
     */
    expect(SHELL_CSS).toMatch(/\.breadcrumb\s*\{[\s\S]*?list-style:\s*none/)
  })

  test('kedua kolom baris tengah berakhir pada tinggi yang sama', () => {
    expect(HALAMAN_CSS).toMatch(/\.dasborTengah\s*\{[\s\S]*?align-items:\s*stretch/)

    // Meregangkan panel saja hanya memindahkan ruang kosong ke dalam kartunya;
    // yang menutupnya adalah grafik yang ikut memanjang.
    expect(PRIMITIF_CSS).toMatch(/\.chartArea\s*\{[\s\S]*?flex:\s*1/)
  })

  test('tinggi grafik diambil dari token, bukan dari angka yang dikarang', () => {
    expect(PRIMITIF_CSS).toMatch(/min-block-size:\s*var\(--size-chart-bar\)/)

    // Sebelumnya `--space-10`, yaitu 40px: dua belas batang setinggi 40px
    // terbaca sebagai satu garis bergerigi.
    expect(PRIMITIF_CSS).not.toMatch(/\.chartSvg\s*\{[^}]*block-size:\s*var\(--space-10\)/)
  })

  test('judul halaman tidak diulang tepat di bawahnya', () => {
    const dasbor = readFileSync(join(process.cwd(), 'src/interface/web/pages/dasbor.tsx'), 'utf8')

    /*
     * Page header sudah menyebut "Dasbor". `<h2>Ringkasan</h2>` tepat di
     * bawahnya mengulang hal yang sama dengan kata lain.
     *
     * Nama seksinya tetap ada sebagai `aria-label` — landmark yang bernama
     * tidak menuntut judul yang terlihat.
     */
    expect(dasbor).not.toMatch(/<h2>\{t\('ringkasan\.judul'\)\}<\/h2>/)
    expect(dasbor).toMatch(/aria-label=\{t\('ringkasan\.judul'\)\}/)
  })
})
