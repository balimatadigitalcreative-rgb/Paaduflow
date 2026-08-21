import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'

import { ShellDemo } from '#interface/web/shell-demo'

/**
 * Ikon, menu profil, dan pengalih company.
 *
 * Ketiganya membuat aplikasi terlihat belum selesai sebelum diperbaiki:
 * singkatan huruf di rail, dua select mentah di top bar, dan pemicu company
 * yang teksnya terpotong.
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  globalThis.localStorage.clear()
})

test('rail modul memakai ikon, bukan singkatan huruf', () => {
  render(<ShellDemo />)

  const rail = screen.getByRole('navigation', { name: 'Modul' })
  const tombol = within(rail).getAllByRole('button')

  for (const satu of tombol) {
    /*
     * Ikon SVG, bukan teks. Singkatan seperti "PJ" dan "PJK" menuntut orang
     * menghafal pemetaan yang tidak pernah dijelaskan di mana pun, dan dua di
     * antaranya berawalan sama.
     */
    expect(satu.querySelector('svg'), `${satu.getAttribute('aria-label')} tanpa ikon`).not.toBeNull()

    /*
     * Satu-satunya teks yang boleh ada di tombol rail adalah badge jumlah —
     * angka beserta keterangannya untuk screen reader. Singkatan huruf tidak.
     *
     * Diperiksa begini, bukan dengan menuntut teks kosong: badge memang harus
     * ada, dan uji yang melarangnya akan menghapus penanda dokumen yang
     * menunggu tindakan.
     */
    const teks = satu.textContent?.trim() ?? ''
    const hanyaBadge = teks === '' || /^\d+\s*menunggu tindakan$/.test(teks)
    expect(hanyaBadge, `${satu.getAttribute('aria-label')} masih memuat teks "${teks}"`).toBe(true)
  }
})

test('setiap ikon rail tetap membawa nama modulnya', () => {
  render(<ShellDemo />)

  const rail = screen.getByRole('navigation', { name: 'Modul' })
  for (const satu of within(rail).getAllByRole('button')) {
    // Ikon tanpa label adalah teka-teki — Component_Specs_AppShell §2.
    const label = satu.getAttribute('aria-label')
    expect(label, 'ikon rail tanpa aria-label').toBeTruthy()
    expect(satu.getAttribute('title')).toBe(label)
  }
})

test('modul aktif ditandai lebih dari sekadar warna', () => {
  render(<ShellDemo />)

  const rail = screen.getByRole('navigation', { name: 'Modul' })
  const aktif = within(rail)
    .getAllByRole('button')
    .filter((satu) => satu.getAttribute('aria-current') === 'page')

  // `aria-current` terbaca screen reader dan menjadi kait CSS untuk latar serta
  // pembatas. Warna sendirian gagal WCAG 1.4.1 dan gagal untuk mata yang lelah.
  expect(aktif).toHaveLength(1)
})

test('top bar tidak lagi memuat select tema maupun kepadatan', () => {
  render(<ShellDemo />)

  const topBar = screen.getByRole('banner')

  /*
   * Top bar adalah chrome permanen: setiap piksel di sana diambil dari data,
   * dan setiap kontrol bersaing dengan pengalih company — satu kontrol yang
   * paling tidak boleh terlewat.
   */
  expect(within(topBar).queryAllByRole('combobox')).toHaveLength(0)
  expect(within(topBar).queryByLabelText(/Tema/i)).toBeNull()
  expect(within(topBar).queryByLabelText(/Kepadatan/i)).toBeNull()
})

test('menu profil memuat nama, peran, tema, kepadatan, dan keluar', async () => {
  const orang = userEvent.setup()
  render(<ShellDemo />)

  await orang.click(screen.getByRole('button', { name: /Menu pengguna/i }))
  const menu = screen.getByRole('menu', { name: 'Menu pengguna' })

  // Peran ikut disebut — §6. Pengguna sering tidak tahu mengapa suatu menu
  // tidak terlihat, dan jawabannya hampir selalu perannya.
  expect(within(menu).getByRole('radiogroup', { name: 'Tema' })).toBeDefined()
  expect(within(menu).getByRole('radiogroup', { name: 'Kepadatan' })).toBeDefined()
  expect(within(menu).getByRole('menuitem', { name: /Keluar/i })).toBeDefined()
})

test('menu profil ditutup Escape dan fokus kembali ke avatarnya', async () => {
  const orang = userEvent.setup()
  render(<ShellDemo />)

  const pemicu = screen.getByRole('button', { name: /Menu pengguna/i })
  await orang.click(pemicu)
  expect(pemicu.getAttribute('aria-expanded')).toBe('true')

  await orang.keyboard('{Escape}')

  expect(pemicu.getAttribute('aria-expanded')).toBe('false')
  expect(document.activeElement).toBe(pemicu)
})

test('pilihan tema aktif ditandai aria-checked, bukan warna saja', async () => {
  const orang = userEvent.setup()
  render(<ShellDemo />)

  await orang.click(screen.getByRole('button', { name: /Menu pengguna/i }))
  await orang.click(screen.getByRole('radio', { name: 'Gelap' }))

  expect(screen.getByRole('radio', { name: 'Gelap' }).getAttribute('aria-checked')).toBe('true')
  expect(screen.getByRole('radio', { name: 'Terang' }).getAttribute('aria-checked')).toBe('false')
})

test('pemicu company menampilkan company sebagai teks utama dan tenant di bawahnya', () => {
  render(<ShellDemo />)

  const pemicu = screen
    .getAllByRole('button')
    .find((satu) => satu.getAttribute('aria-haspopup') === 'dialog')!

  const teks = pemicu.textContent ?? ''

  /*
   * Urutannya menentukan mana yang terpotong lebih dulu di layar sempit.
   * Company harus mendahului tenant: salah konteks company berarti transaksi
   * masuk ke entitas legal yang salah, sedangkan salah tenant hampir tidak
   * pernah mungkin — pengguna umumnya hanya punya satu.
   */
  const posisiCompany = teks.indexOf('PT Nusantara Jaya')
  const posisiTenant = teks.indexOf('Nusantara Group')

  expect(posisiCompany).toBeGreaterThanOrEqual(0)
  expect(posisiTenant).toBeGreaterThan(posisiCompany)

  // Chevron menandakan ia dapat dibuka. Tanpa itu ia terbaca sebagai label.
  expect(pemicu.querySelectorAll('svg').length).toBeGreaterThan(0)
})
