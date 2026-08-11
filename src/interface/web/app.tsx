import { useState } from 'react'
import type { ReactNode } from 'react'

import { MODULES, SIDEBAR_ITEMS, TENANT, paletteItems } from './sample-data.js'
import { AppShell } from './shell/app-shell.js'
import { PreferencesProvider } from './shell/preferences.js'

/**
 * Perakitan shell.
 *
 * Belum ada router: rute lahir bersama modul pertama yang punya halaman nyata,
 * dan memasangnya sekarang berarti merancang bentuk URL sebelum ada yang
 * menempatinya (D-037 tetap berlaku — TanStack Router yang akan dipakai).
 */
export function App(): ReactNode {
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
        onSelectModule={setModuleId}
        onSelectItem={setItemId}
      >
        <p>
          Area konten. Tabel dan formulir modul mengisi ruang ini mulai Fase C.
        </p>
      </AppShell>
    </PreferencesProvider>
  )
}
