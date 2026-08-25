import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'

import { IconFileInvoice, IconShoppingCart } from '@tabler/icons-react'

import { AppShell } from '#interface/web/shell/app-shell'
import { PreferencesProvider } from '#interface/web/shell/preferences'
import { gantiBahasa, type Bahasa } from '#interface/web/i18n/index'

/**
 * Pengalih bahasa di menu profil.
 *
 * Yang diuji bukan bahwa tombolnya ada, melainkan bahwa MENGKLIKNYA benar-benar
 * mengganti teks di layar. Pengalih yang mengubah state tanpa mengubah tampilan
 * lolos tinjauan kode dengan mudah — dan gagal pada klik pertama saat demo.
 */

const MODUL = [
  { id: 'penjualan', name: 'Penjualan', glyph: IconFileInvoice, permitted: true },
  { id: 'pembelian', name: 'Pembelian', glyph: IconShoppingCart, permitted: true },
]

function bukaMenu(): Promise<void> {
  return userEvent.click(screen.getByRole('button', { name: /Menu pengguna|User menu/ }))
}

function render_(onPilihBahasa?: (bahasa: Bahasa) => void) {
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
        {...(onPilihBahasa === undefined ? {} : { onPilihBahasa })}
        onSelectModule={() => undefined}
        onSelectItem={() => undefined}
      >
        <p>Area konten.</p>
      </AppShell>
    </PreferencesProvider>,
  )
}

beforeEach(async () => {
  await gantiBahasa('id')
})

afterEach(() => {
  cleanup()
  globalThis.localStorage.clear()
})

test('pengalih bahasa berada di menu profil, bersama tema dan kepadatan', async () => {
  render_(() => undefined)
  await bukaMenu()

  /*
   * Component_Specs_AppShell §6: menu profil adalah tempat PENGATURAN. Bahasa
   * masuk ke sana bersama tema dan kepadatan, bukan berdiri sendiri di top bar
   * — setiap kontrol di top bar bersaing dengan pengalih company.
   */
  const menu = screen.getByRole('menu')
  for (const label of ['Tema', 'Kepadatan', 'Bahasa']) {
    expect(within(menu).getByRole('radiogroup', { name: label }), label).toBeTruthy()
  }
})

test('nama bahasa ditulis dalam bahasa itu sendiri', async () => {
  render_(() => undefined)
  await bukaMenu()

  const grup = screen.getByRole('radiogroup', { name: 'Bahasa' })

  /*
   * "English", bukan "Inggris". Orang yang tersesat di antarmuka berbahasa
   * asing mencari kata yang ia kenali; menerjemahkan nama bahasa justru
   * menyembunyikannya dari satu-satunya orang yang membutuhkannya.
   */
  expect(within(grup).getByRole('radio', { name: 'English' })).toBeTruthy()
  expect(within(grup).getByRole('radio', { name: 'Bahasa Indonesia' })).toBeTruthy()
})

test('mengklik English benar-benar mengganti teks di layar', async () => {
  render_((bahasa) => void gantiBahasa(bahasa))
  await bukaMenu()

  // Sebelum: navigasi berbahasa Indonesia.
  expect(screen.getByRole('navigation', { name: 'Modul' })).toBeTruthy()

  await userEvent.click(screen.getByRole('radio', { name: 'English' }))

  /*
   * Sesudah: label yang sama, bahasa berbeda. Ini yang membedakan pengalih
   * yang bekerja dari pengalih yang hanya menyimpan pilihan.
   */
  expect(await screen.findByRole('navigation', { name: 'Modules' })).toBeTruthy()
  expect(screen.queryByRole('navigation', { name: 'Modul' })).toBeNull()
})

test('tanpa penangan, pengalih tidak dirender sama sekali', async () => {
  render_()
  await bukaMenu()

  /*
   * Pengalih yang terlihat tetapi tidak menyimpan apa pun lebih buruk daripada
   * pengalih yang tidak ada: orang memilih, layar berganti, lalu kembali ke
   * bahasa lama saat halaman dimuat ulang — dan menyimpulkan sistemnya rusak.
   */
  expect(screen.queryByRole('radiogroup', { name: 'Bahasa' })).toBeNull()
  expect(screen.getByRole('radiogroup', { name: 'Tema' })).toBeTruthy()
})
