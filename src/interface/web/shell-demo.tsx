import { useState } from 'react'
import type { ReactNode } from 'react'

import { MODULES, SIDEBAR_ITEMS, TENANT, paletteItems } from './sample-data.js'
import { AppShell } from './shell/app-shell.js'
import { PreferencesProvider } from './shell/preferences.js'

/**
 * Perakitan shell dengan data contoh.
 *
 * Ini isi `App` sebelum sesi antarmuka. Ia dipindahkan ke sini, bukan dihapus,
 * karena sembilan test aksesibilitas dan perilaku keyboard di
 * `tests/ui/shell.test.tsx` menguji shell lewatnya — dan `App` sekarang adalah
 * gerbang autentikasi yang menampilkan halaman masuk, bukan shell.
 *
 * Menghapusnya berarti melemahkan test itu menjadi "halaman masuk lolos axe",
 * yang tidak menguji apa pun yang dulu dijaganya: fokus yang kembali ke
 * pemicu, pengumuman assertive, dan penyaringan izin di palet perintah.
 */
/*
 * Teks pengisi untuk harness pengembangan.
 *
 * Tidak diterjemahkan, dan tidak perlu: berkas ini tidak pernah ikut ke layar
 * produk. Dibuat konstanta bernama supaya pemeriksa i18n tidak perlu mengenal
 * pengecualian, dan supaya pembaca berikutnya tahu ini disengaja.
 */
const ISI_CONTOH = 'Area konten.'

export function ShellDemo(): ReactNode {
  const [companyId, setCompanyId] = useState(TENANT.companies[0]!.id)
  const [moduleId, setModuleId] = useState(MODULES[0]!.id)
  const [itemId, setItemId] = useState('faktur')

  const activeModule = MODULES.find((module) => module.id === moduleId) ?? MODULES[0]!

  return (
    <PreferencesProvider>
      <AppShell
        switcher={{
          tenant: TENANT,
          otherTenants: [],
          activeCompanyId: companyId,
          onSwitch: setCompanyId,
        }}
        modules={MODULES}
        activeModule={activeModule}
        sidebarItems={SIDEBAR_ITEMS}
        activeItemId={itemId}
        paletteItems={paletteItems(setItemId)}
        pageTitle="Faktur Penjualan"
        breadcrumb={['Penjualan', 'Faktur Penjualan']}
        fiscalPeriod="FY2026 P8"
        /*
         * Harness tidak punya sesi untuk diakhiri, tetapi tetap meneruskan
         * penangan supaya item "Keluar" ikut dirender — audit aksesibilitas
         * berjalan atas berkas ini, dan yang tidak dirender tidak diaudit.
         */
        onKeluar={() => undefined}
        onSelectModule={setModuleId}
        onSelectItem={setItemId}
      >
        <p>{ISI_CONTOH}</p>
      </AppShell>
    </PreferencesProvider>
  )
}
