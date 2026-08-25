import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IconFileInvoice, IconShoppingCart } from '@tabler/icons-react'
import { afterEach, expect, test, vi } from 'vitest'

import { AppShell } from '#interface/web/shell/app-shell'
import { PreferencesProvider } from '#interface/web/shell/preferences'

/**
 * Top bar hanya memuat kroma permanen; pengaturan tinggal di menu profil.
 *
 * Component_Specs_AppShell §6. Top bar adalah satu-satunya baris yang hadir di
 * setiap layar: tiap piksel di sana diambil dari data, dan tiap kontrol di sana
 * bersaing dengan pengalih company — kontrol yang paling tidak boleh terlewat.
 *
 * Yang diuji di sini adalah KOMPOSISINYA, bukan tampilannya. jsdom tidak
 * menghitung tata letak; yang dapat dibuktikan mesin adalah kontrol mana yang
 * ada dan di mana ia berada.
 */

const MODUL = [
  { id: 'penjualan', name: 'Penjualan', glyph: IconFileInvoice, permitted: true },
  { id: 'pembelian', name: 'Pembelian', glyph: IconShoppingCart, permitted: true },
]

const LEBAR = [1440, 1024, 768, 390] as const

/** Memalsukan lebar viewport lewat matchMedia, satu-satunya yang dibaca shell. */
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

function pasang(tambahan: { onKeluar?: () => void } = {}) {
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
        sidebarItems={[]}
        activeItemId="faktur"
        paletteItems={[]}
        pageTitle="Faktur Penjualan"
        breadcrumb={['Penjualan']}
        fiscalPeriod="FY2026 P8"
        userName="Siti Rahmawati"
        userRole="Admin Company"
        {...tambahan}
        onSelectModule={() => undefined}
        onSelectItem={() => undefined}
      >
        <p>Area konten.</p>
      </AppShell>
    </PreferencesProvider>,
  )
}

function topBar(): HTMLElement {
  const header = document.querySelector('header')
  expect(header, 'top bar tidak ditemukan').not.toBeNull()
  return header as HTMLElement
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  globalThis.localStorage.clear()
})

// ── Komposisi top bar ───────────────────────────────────────────────────────

test.each(LEBAR)('%ipx — top bar tidak memuat kontrol tema maupun kepadatan', (lebar) => {
  padaLebar(lebar)
  pasang()

  const bar = topBar()

  /*
   * Diperiksa dua lapis, karena keduanya pernah menjadi cara yang sama
   * salahnya: `select` mentah (bentuk lamanya) DAN radiogroup yang bocor
   * keluar dari panel menu.
   */
  expect(bar.querySelectorAll('select')).toHaveLength(0)
  expect(within(bar).queryByRole('radiogroup', { name: 'Tema' })).toBeNull()
  expect(within(bar).queryByRole('radiogroup', { name: 'Kepadatan' })).toBeNull()

  // Teksnya pun tidak boleh muncul di baris ini dalam bentuk apa pun.
  expect(bar.textContent).not.toContain('Tema')
  expect(bar.textContent).not.toContain('Kepadatan')
})

test.each(LEBAR)('%ipx — top bar memuat tepat lima kontrol yang diizinkan', (lebar) => {
  padaLebar(lebar)
  pasang({ onKeluar: () => undefined })

  const bar = topBar()

  /*
   * Logo, pengalih company, cari, notifikasi, avatar.
   *
   * Tombol menu navigasi ikut ada di bawah 1024px — ia navigasi, bukan
   * pengaturan, dan §8 memang menempatkannya di sana saat rail keluar dari
   * aliran dokumen. Karena itu ia dikecualikan dari hitungan, bukan dilarang.
   */
  expect(within(bar).getByRole('link', { name: 'Paadu' })).toBeTruthy()

  // Namanya "Cari ⌘K": pintasannya ikut diumumkan, dan itu disengaja — yang
  // memakai screen reader juga berhak tahu pintasannya.
  expect(within(bar).getByRole('button', { name: /^Cari/ })).toBeTruthy()
  expect(within(bar).getByRole('button', { name: 'Notifikasi' })).toBeTruthy()
  expect(within(bar).getByRole('button', { name: /Menu pengguna/ })).toBeTruthy()

  /*
   * Pengalih company dikenali dari `aria-haspopup="dialog"`, bukan dari label
   * tetap: nama yang diumumkannya adalah company yang sedang aktif — itu
   * memang perilaku yang benar, dan mencocokkannya dengan teks tetap justru
   * akan mengunci perilaku yang salah.
   */
  const pengalih = bar.querySelector('button[aria-haspopup="dialog"]')
  expect(pengalih, 'pengalih company tidak ada di top bar').not.toBeNull()
  expect(pengalih?.textContent).toContain('PT Merah Satu')

  const diizinkan = /PT Merah Satu|Cari|Notifikasi|Menu pengguna|Navigasi/
  const menyimpang = within(bar)
    .getAllByRole('button')
    .map((satu) => satu.getAttribute('aria-label') ?? satu.textContent ?? '')
    .filter((label) => !diizinkan.test(label))

  expect(menyimpang, `kontrol asing di top bar: ${menyimpang.join(', ')}`).toEqual([])
})

// ── Isi menu profil ─────────────────────────────────────────────────────────

test.each(LEBAR)('%ipx — menu profil memuat nama, tema, kepadatan, dan keluar', async (lebar) => {
  padaLebar(lebar)
  pasang({ onKeluar: () => undefined })

  await userEvent.click(screen.getByRole('button', { name: /Menu pengguna/ }))
  const menu = screen.getByRole('menu')

  // Nama pengguna beserta perannya — §6 menuntut peran ikut disebut, karena
  // pertanyaan "mengapa menu ini tidak terlihat" hampir selalu berjawab peran.
  expect(within(menu).getByText('Siti Rahmawati')).toBeTruthy()
  expect(within(menu).getByText('Admin Company')).toBeTruthy()

  expect(within(menu).getByRole('radiogroup', { name: 'Tema' })).toBeTruthy()
  expect(within(menu).getByRole('radiogroup', { name: 'Kepadatan' })).toBeTruthy()
  expect(within(menu).getByRole('menuitem', { name: 'Keluar' })).toBeTruthy()
})

test.each(LEBAR)('%ipx — memilih tema di menu mengubah preferensi shell', async (lebar) => {
  padaLebar(lebar)
  const { container } = pasang()

  await userEvent.click(screen.getByRole('button', { name: /Menu pengguna/ }))
  await userEvent.click(screen.getByRole('radio', { name: 'Gelap' }))

  /*
   * Preferensi mendarat di atribut yang benar-benar dibaca CSS, bukan sekadar
   * di state React. Pengalih yang mengubah state tanpa mengubah `data-theme`
   * lolos tinjauan kode dan gagal pada klik pertama.
   */
  const shell = container.querySelector('[data-theme]')
  expect(shell?.getAttribute('data-theme')).toBe('dark')
})

test.each(LEBAR)('%ipx — memilih kepadatan di menu mengubah preferensi shell', async (lebar) => {
  padaLebar(lebar)
  const { container } = pasang()

  await userEvent.click(screen.getByRole('button', { name: /Menu pengguna/ }))
  await userEvent.click(screen.getByRole('radio', { name: 'Padat' }))

  const shell = container.querySelector('[data-density]')
  expect(shell?.getAttribute('data-density')).toBe('compact')
})

// ── Keluar ──────────────────────────────────────────────────────────────────

test('Keluar memanggil penangannya, dan menutup menu lebih dulu', async () => {
  padaLebar(1440)
  const keluar = vi.fn()
  pasang({ onKeluar: keluar })

  await userEvent.click(screen.getByRole('button', { name: /Menu pengguna/ }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Keluar' }))

  expect(keluar).toHaveBeenCalledTimes(1)

  /*
   * Panel tertutup SEBELUM keluar dijalankan. Keluar mengganti seluruh pohon
   * dengan layar masuk; panel yang masih terbuka meninggalkan backdrop-nya di
   * atas form — layar masuk yang tampil tetapi tidak dapat diklik.
   */
  expect(screen.queryByRole('menu')).toBeNull()
})

test('tanpa penangan, item Keluar tidak dirender sama sekali', async () => {
  padaLebar(1440)
  pasang()

  await userEvent.click(screen.getByRole('button', { name: /Menu pengguna/ }))

  /*
   * Bukan dirender lalu diam. Tombol yang diklik tanpa akibat mengajarkan
   * bahwa aplikasi ini kadang menggantung — dan orang yang percaya begitu
   * berhenti mempercayai tombol lain juga.
   */
  expect(screen.queryByRole('menuitem', { name: 'Keluar' })).toBeNull()
  expect(screen.getByRole('radiogroup', { name: 'Tema' })).toBeTruthy()
})
