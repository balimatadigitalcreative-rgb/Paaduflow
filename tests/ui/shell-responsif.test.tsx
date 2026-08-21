import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'

import { ShellDemo } from '#interface/web/shell-demo'

/**
 * Perilaku shell di empat breakpoint — Layout_System §5.
 *
 * **Batas yang jujur:** jsdom tidak menghitung tata letak. Ia tidak tahu lebar
 * elemen, tidak menerapkan media query, dan tidak dapat memberi tahu apakah
 * sesuatu meluber. Berkas ini karena itu menguji dua hal yang memang dapat
 * diperiksa mesin:
 *
 *   1. Media query-nya ADA dan angkanya persis seperti yang ditetapkan dokumen
 *   2. Komponen merender struktur yang benar pada tiap lebar
 *
 * Yang TIDAK dapat dibuktikan di sini: apakah hasilnya terlihat benar. Itu
 * menuntut peramban sungguhan, dan mengaku begitu lebih berguna daripada uji
 * yang terlihat meyakinkan tetapi tidak memeriksa apa pun.
 */

// Dibaca lewat cwd, bukan lewat `import.meta.url`: di lingkungan jsdom
// `import.meta.url` bukan URL berkas, dan `fileURLToPath` menolaknya.
const CSS = readFileSync(
  join(process.cwd(), 'src/interface/web/shell/shell.module.css'),
  'utf8',
)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  globalThis.localStorage.clear()
})

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

// ── 1 · Media query ada, dan angkanya persis ────────────────────────────────

test('empat breakpoint ada dengan angka yang ditetapkan Layout_System', () => {
  /*
   * Angkanya 1279/1023/767, bukan 1280/1024/768.
   *
   * Dokumen menyebut batas BAWAH tiap rentang (≥1280, 1024–1279, …), sedangkan
   * `max-width` menyebut batas ATAS rentang di bawahnya. Salah satu piksel di
   * sini menghasilkan lebar yang tidak tercakup aturan mana pun — dan 1280px
   * adalah lebar laptop yang sangat umum.
   */
  expect(CSS).toMatch(/@media\s*\(max-width:\s*1279px\)/)
  expect(CSS).toMatch(/@media\s*\(max-width:\s*1023px\)/)
  expect(CSS).toMatch(/@media\s*\(max-width:\s*767px\)/)
  expect(CSS).toMatch(/@media\s*\(pointer:\s*coarse\)/)
})

test('tidak ada lebar yang jatuh di antara dua aturan', () => {
  const batas = [...CSS.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)].map((m) => Number(m[1]))

  // Setiap batas harus tepat satu piksel di bawah breakpoint token, sehingga
  // rentangnya bersambung tanpa celah dan tanpa tumpang tindih.
  for (const nilai of batas) {
    expect([1279, 1023, 767]).toContain(nilai)
  }
  expect(new Set(batas).size).toBe(3)
})

test('target sentuh 44px ditegakkan lewat pointer coarse, bukan lewat lebar', () => {
  const blok = CSS.slice(CSS.indexOf('@media (pointer: coarse)'))

  // Lewat lebar akan salah di dua arah: tablet lebar tetap disentuh, dan
  // jendela peramban sempit di laptop tidak disentuh sama sekali.
  expect(blok).toContain('var(--size-touch-min)')
  expect(blok).toContain('.bottomItem')
  expect(blok).toContain('.railButton')

  // Density compact dimatikan di perangkat sentuh — Layout_System §6.
  expect(blok).toContain("data-density='compact'")
})

test('bottom bar memberi ruang untuk chrome sistem ponsel', () => {
  // Tanpa safe-area, tujuan terakhir tertimpa home indicator iOS dan tidak
  // dapat ditekan sama sekali. Ini kegagalan yang tidak terlihat di emulator.
  expect(CSS).toContain('env(safe-area-inset-bottom')
})

// ── 2 · Struktur yang dirender di tiap lebar ───────────────────────────────

test('1440px — rail inline, tanpa bottom bar', async () => {
  padaLebar(1440)
  render(<ShellDemo />)

  const navigasi = screen.getAllByRole('navigation', { name: 'Modul' })
  expect(navigasi).toHaveLength(1)
  expect(navigasi[0]!.id).toBe('navigasi-modul')

  // Rail berisi tombol modul; bottom bar tidak dirender sama sekali.
  expect(within(navigasi[0]!).getAllByRole('button').length).toBeGreaterThan(1)
})

test('390px — bottom bar menggantikan rail, tepat satu navigasi modul', async () => {
  padaLebar(390)
  render(<ShellDemo />)

  /*
   * Tepat SATU. Dua landmark navigasi bernama sama membuat screen reader
   * menyebutkan keduanya berurutan, dan pengguna tidak punya cara membedakan
   * mana yang sedang terlihat.
   */
  const navigasi = screen.getAllByRole('navigation', { name: 'Modul' })
  expect(navigasi).toHaveLength(1)

  // Maksimal lima tujuan — Layout_System §5.
  const tujuan = within(navigasi[0]!).getAllByRole('button')
  expect(tujuan.length).toBeLessThanOrEqual(5)

  // Label ikut ditampilkan. Di ponsel tidak ada hover untuk memunculkan
  // tooltip, jadi ikon tanpa label adalah teka-teki permanen.
  expect(navigasi[0]!.textContent).toMatch(/[A-Za-z]{3,}/)
})

test('pengalih company tetap ada di ponsel, tidak dipindah ke dalam menu', async () => {
  padaLebar(390)
  render(<ShellDemo />)

  // Component_Specs_AppShell §8 menyebut ini eksplisit. Menyembunyikannya di
  // balik menu adalah cara paling halus membuat orang salah konteks company.
  // Dicari lewat perannya sebagai pemicu dialog, bukan lewat namanya: nama
  // aksesibelnya adalah "Tenant / Company" itu sendiri, dan itu memang yang
  // seharusnya terdengar (§1).
  const pemicu = screen
    .getAllByRole('button')
    .filter((tombol) => tombol.getAttribute('aria-haspopup') === 'dialog')
  expect(pemicu).toHaveLength(1)
  expect(pemicu[0]!.textContent).toMatch(/\//)
})

test('drawer dibuka tombol menu, ditutup Escape, dan fokus kembali ke pemicunya', async () => {
  padaLebar(768)
  const orang = userEvent.setup()
  render(<ShellDemo />)

  const pemicu = screen.getByRole('button', { name: 'Navigasi' })
  expect(pemicu.getAttribute('aria-expanded')).toBe('false')

  await orang.click(pemicu)

  // Namanya tidak berubah; keadaannya yang berubah.
  expect(pemicu.getAttribute('aria-expanded')).toBe('true')
  expect(screen.getByRole('button', { name: 'Tutup navigasi' })).toBeDefined()

  await orang.keyboard('{Escape}')

  expect(pemicu.getAttribute('aria-expanded')).toBe('false')

  // Fokus kembali ke pemicu — tanpa ini pengguna keyboard terlempar ke awal
  // dokumen setiap kali menutup drawer.
  expect(document.activeElement).toBe(pemicu)
})

test('backdrop drawer dapat dicapai keyboard, bukan hanya diklik', async () => {
  padaLebar(768)
  const orang = userEvent.setup()
  render(<ShellDemo />)

  await orang.click(screen.getByRole('button', { name: 'Navigasi' }))

  // `div` dengan onClick tidak dapat dicapai keyboard maupun screen reader.
  // Menutup drawer adalah aksi, dan aksi harus punya elemen yang sesuai.
  //
  // Tepat satu: backdrop dan tombol menu tidak boleh bernama sama.
  const backdrop = screen.getAllByRole('button', { name: 'Tutup navigasi' })
  expect(backdrop).toHaveLength(1)
})
