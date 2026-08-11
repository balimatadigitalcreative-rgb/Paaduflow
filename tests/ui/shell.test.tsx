import axe from 'axe-core'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test } from 'vitest'

import { App } from '#interface/web/app'

/**
 * Audit aksesibilitas otomatis dan perilaku keyboard shell.
 *
 * Audit otomatis menangkap sekitar sepertiga masalah aksesibilitas nyata;
 * sisanya butuh screen reader sungguhan (masih terbuka di Design_Handoff §10).
 * Karena itu berkas ini juga menguji perilaku yang tidak dapat dilihat axe:
 * fokus yang kembali ke pemicu, pengumuman assertive, dan hasil yang disaring
 * izin.
 */

afterEach(() => {
  document.body.innerHTML = ''
  // Preferensi disimpan di penyimpanan lokal. Tanpa dibersihkan, test yang
  // mengubah tema akan mewariskannya ke test berikutnya di berkas yang sama.
  globalThis.localStorage.clear()
})

test('shell lolos audit aksesibilitas otomatis', async () => {
  const { container } = render(<App />)

  const hasil = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })

  if (hasil.violations.length > 0) {
    console.error(
      hasil.violations
        .map(
          (pelanggaran) =>
            `[${pelanggaran.impact ?? 'tanpa-severity'}] ${pelanggaran.id}: ${pelanggaran.help} (${pelanggaran.nodes.length} simpul)`,
        )
        .join('\n'),
    )
  }

  expect(hasil.violations).toEqual([])
})

test('skip link adalah elemen pertama yang menerima fokus', async () => {
  const pengguna = userEvent.setup()
  render(<App />)

  await pengguna.tab()

  expect(document.activeElement).toHaveProperty('textContent', 'Lewati ke konten utama')
})

test('landmark lengkap dan diberi nama', () => {
  render(<App />)

  expect(screen.getByRole('banner')).toBeDefined()
  expect(screen.getByRole('main')).toBeDefined()
  expect(screen.getByRole('navigation', { name: 'Modul' })).toBeDefined()
  expect(screen.getByRole('navigation', { name: 'Navigasi Penjualan' })).toBeDefined()
})

test('lapis 2 indikator konteks: company diulang di page header', () => {
  render(<App />)

  const utama = screen.getByRole('main')
  // Bukan hanya di top bar. Orang yang menginput faktur menatap form, bukan chrome.
  expect(within(utama).getByText(/PT Nusantara Jaya/)).toBeDefined()
  expect(within(utama).getByText(/FY2026 P8/)).toBeDefined()
})

test('pengalih company: keyboard penuh, banner assertive, fokus kembali ke pemicu', async () => {
  const pengguna = userEvent.setup()
  render(<App />)

  const pemicu = screen.getByRole('button', { name: /Nusantara Group/ })
  // Pemicu menyatakan tenant dan company sekaligus, tidak pernah di balik ikon.
  expect(pemicu.textContent).toContain('PT Nusantara Jaya')
  await pengguna.click(pemicu)

  const panel = screen.getByRole('dialog', { name: 'Pilih company' })
  expect(panel).toBeDefined()

  // Panah lalu Enter — tanpa menyentuh tetikus sama sekali.
  await pengguna.keyboard('{ArrowDown}{Enter}')

  const pengumuman = document.querySelector('[aria-live="assertive"]')
  expect(pengumuman?.textContent).toContain('PT Nusantara Sentosa')

  // Fokus kembali ke pemicu, bukan terlempar ke awal dokumen.
  expect(document.activeElement?.getAttribute('aria-haspopup')).toBe('dialog')
})

test('Esc menutup pengalih dan mengembalikan fokus', async () => {
  const pengguna = userEvent.setup()
  render(<App />)

  const pemicu = screen.getByRole('button', { name: /Nusantara Group/ })
  await pengguna.click(pemicu)
  await pengguna.keyboard('{Escape}')

  expect(screen.queryByRole('dialog', { name: 'Pilih company' })).toBeNull()
  expect(document.activeElement).toBe(pemicu)
})

test('command palette terbuka dengan pintasan dan menyaring menurut izin', async () => {
  const pengguna = userEvent.setup()
  render(<App />)

  await pengguna.keyboard('{Control>}k{/Control}')

  const palet = screen.getByRole('dialog', { name: 'Perintah dan pencarian' })
  const opsi = within(palet).getAllByRole('option')

  // "Posting Jurnal" tidak diizinkan bagi pengguna ini. Ia tidak muncul, dan
  // tidak dihitung — tidak ada "1 hasil disembunyikan".
  expect(opsi.map((item) => item.textContent)).not.toContain('Posting Jurnal')
  expect(within(palet).queryByText(/disembunyikan/)).toBeNull()

  // Empat kelompok dengan urutan tetap.
  const kelompok = within(palet)
    .getAllByText(/^(Navigasi|Aksi|Entitas|AI)$/)
    .map((item) => item.textContent)
  expect(kelompok).toEqual(['Navigasi', 'Aksi', 'Entitas', 'AI'])
})

test('pintasan tidak aktif saat mengetik di field', async () => {
  const pengguna = userEvent.setup()
  render(<App />)

  const pemicu = screen.getByRole('button', { name: /Nusantara Group/ })
  await pengguna.click(pemicu)
  const pencarian = screen.getByRole('searchbox', { name: 'Cari company' })

  // "[" seharusnya menciutkan sidebar — tetapi tidak saat sedang mengetik.
  // Digandakan karena user-event memakai "[" sebagai awalan deskriptor tombol.
  await pengguna.type(pencarian, 'PT [[')

  expect((pencarian as HTMLInputElement).value).toContain('[')
  expect(screen.getByRole('navigation', { name: 'Navigasi Penjualan' }).dataset.collapsed).toBe(
    'false',
  )
})

test('item sidebar tanpa izin tidak dirender sama sekali', () => {
  render(<App />)

  const sidebar = screen.getByRole('navigation', { name: 'Navigasi Penjualan' })
  expect(within(sidebar).queryByText('Pengaturan Penjualan')).toBeNull()
  // Grup yang menjadi kosong ikut hilang — menu tidak pernah berisi nol item.
  expect(within(sidebar).queryByText('Pengaturan')).toBeNull()
})

test('kepadatan dan tema tersimpan sebagai preferensi pengguna', async () => {
  const pengguna = userEvent.setup()
  const { container } = render(<App />)

  await pengguna.selectOptions(screen.getByLabelText(/Kepadatan/), 'compact')
  await pengguna.selectOptions(screen.getByLabelText(/Tema/), 'dark')

  const shell = container.firstElementChild as HTMLElement
  expect(shell.dataset.density).toBe('compact')
  expect(shell.dataset.theme).toBe('dark')

  const tersimpan = JSON.parse(globalThis.localStorage.getItem('paadu.preferences') ?? '{}')
  expect(tersimpan).toMatchObject({ density: 'compact', theme: 'dark' })
})

test('tema system tidak memaksa nilai, sehingga preferensi sistem menang', () => {
  const { container } = render(<App />)
  const shell = container.firstElementChild as HTMLElement

  expect(shell.dataset.theme).toBeUndefined()
})
