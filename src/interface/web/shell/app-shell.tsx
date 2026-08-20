import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { CommandPalette } from './command-palette.js'
import { CompanySwitcher, type CompanySwitcherProps } from './company-switcher.js'
import { usePreferences } from './preferences.js'
import styles from './shell.module.css'
import {
  MAX_PINNED_MODULES,
  SIDEBAR_ORDER,
  type ModuleLink,
  type PaletteItem,
  type SidebarItem,
} from './types.js'

/**
 * App shell — Layout_System §3, Component_Specs_AppShell §7.
 *
 * Urutan fokus mengikuti struktur visual: top bar → rail → sidebar → konten →
 * panel kanan. Ia tidak pernah diatur dengan `tabindex` positif; urutan DOM
 * yang menentukan, karena itulah satu-satunya urutan yang tidak akan menyimpang
 * saat tata letak berubah.
 */

export interface AppShellProps {
  readonly switcher: CompanySwitcherProps
  readonly modules: readonly ModuleLink[]
  readonly activeModule: ModuleLink
  readonly sidebarItems: readonly SidebarItem[]
  readonly activeItemId: string
  readonly paletteItems: readonly PaletteItem[]
  readonly pageTitle: string
  readonly breadcrumb: readonly string[]
  /** Lapis 2: konteks diulang di titik kerja. */
  readonly fiscalPeriod: string
  /**
   * Susunan page header ditetapkan Component_Specs_Composite §7 dan sama di
   * seluruh produk: breadcrumb → judul → badge status → baris konteks → aksi
   * primer → tab. Slot berikut mengisi tiga yang belum ada.
   *
   * Ketiganya opsional karena tidak setiap halaman punya status atau tab —
   * tetapi urutannya tidak dapat diubah halaman, dan itulah gunanya di sini
   * alih-alih digambar ulang per layar.
   */
  readonly statusBadges?: ReactNode
  /** Satu saja. Bila terasa ada dua, hierarkinya belum diputuskan (§7). */
  readonly primaryAction?: ReactNode
  readonly tabs?: ReactNode
  readonly children: ReactNode
  readonly panel?: ReactNode
  onSelectModule(moduleId: string): void
  onSelectItem(itemId: string): void
}

export function AppShell(props: AppShellProps): ReactNode {
  const { preferences, setTheme, setDensity, toggleSidebar } = usePreferences()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [contextMessage, setContextMessage] = useState<string | null>(null)

  const tersemat = props.modules.slice(0, MAX_PINNED_MODULES)
  const companyAktif =
    props.switcher.tenant.companies.find((c) => c.id === props.switcher.activeCompanyId) ??
    props.switcher.tenant.companies[0]

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null
      const sedangMengetik =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      // Pintasan tidak aktif saat fokus berada di field input —
      // Component_Specs_AppShell §7.
      if (sedangMengetik === true && event.key !== 'Escape') return

      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (event.key === '[') {
        event.preventDefault()
        toggleSidebar()
      }
    }

    globalThis.addEventListener?.('keydown', onKeyDown)
    return () => globalThis.removeEventListener?.('keydown', onKeyDown)
  }, [toggleSidebar])

  function pindahCompany(companyId: string): void {
    props.switcher.onSwitch(companyId)
    const company = props.switcher.tenant.companies.find((item) => item.id === companyId)
    setContextMessage(`Konteks berpindah ke ${company?.legalName ?? 'company lain'}.`)
  }

  return (
    <div
      className={styles.shell}
      data-density={preferences.density}
      {...(preferences.theme === 'system' ? {} : { 'data-theme': preferences.theme })}
    >
      <div className={styles.skipLinks}>
        <a href="#konten-utama" className={styles.skipLink}>
          Lewati ke konten utama
        </a>
        <a href="#navigasi-modul" className={styles.skipLink}>
          Lewati ke navigasi modul
        </a>
      </div>

      <header className={styles.topBar}>
        <a href="#beranda" className={styles.mark}>
          Paadu
        </a>

        <CompanySwitcher {...props.switcher} onSwitch={pindahCompany} />

        <button type="button" className={styles.navItem} onClick={() => setPaletteOpen(true)}>
          Cari <span className={styles.paletteHint}>⌘K</span>
        </button>

        <span className={styles.topBarSpacer} />

        <label className={styles.paletteHint}>
          Tema
          <select
            value={preferences.theme}
            onChange={(event) => setTheme(event.target.value as typeof preferences.theme)}
          >
            <option value="system">Ikuti sistem</option>
            <option value="light">Terang</option>
            <option value="dark">Gelap</option>
          </select>
        </label>

        <label className={styles.paletteHint}>
          Kepadatan
          <select
            value={preferences.density}
            onChange={(event) => setDensity(event.target.value as typeof preferences.density)}
          >
            <option value="comfortable">Lega</option>
            <option value="compact">Padat</option>
          </select>
        </label>

        <span className={styles.userAvatar} aria-hidden="true">
          AS
        </span>
      </header>

      <nav id="navigasi-modul" className={styles.rail} aria-label="Modul">
        {tersemat.map((module) => (
          <button
            key={module.id}
            type="button"
            className={styles.railButton}
            // Ikon wajib punya label. Ikon tanpa label adalah teka-teki.
            aria-label={module.name}
            title={module.name}
            aria-current={module.id === props.activeModule.id ? 'page' : undefined}
            onClick={() => props.onSelectModule(module.id)}
          >
            <span aria-hidden="true">{module.glyph}</span>
            {module.pendingCount !== undefined && module.pendingCount > 0 ? (
              <span className={styles.railBadge}>
                {module.pendingCount}
                <span className={styles.visuallyHidden}> menunggu tindakan</span>
              </span>
            ) : null}
          </button>
        ))}
        <button type="button" className={styles.railButton} aria-label="Semua modul" title="Semua modul">
          <span aria-hidden="true">⋮⋮</span>
        </button>
      </nav>

      <nav
        className={styles.sidebar}
        data-collapsed={preferences.sidebarCollapsed}
        aria-label={`Navigasi ${props.activeModule.name}`}
      >
        {SIDEBAR_ORDER.map((group) => {
          // Item tanpa izin disembunyikan, bukan dinonaktifkan. Grup yang
          // menjadi kosong ikut hilang — menu tidak pernah tampil berisi nol item.
          const isi = props.sidebarItems.filter((item) => item.group === group && item.permitted)
          if (isi.length === 0) return null
          return (
            <div key={group}>
              <p className={styles.groupLabel}>{group}</p>
              <ul role="list" className={styles.paletteList}>
                {isi.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={styles.navItem}
                      aria-current={item.id === props.activeItemId ? 'page' : undefined}
                      onClick={() => props.onSelectItem(item.id)}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className={styles.content}>
        {/* Perpindahan konteks diumumkan assertive, bukan polite. Ia memengaruhi
            kebenaran seluruh data di layar, jadi ia harus menyela. */}
        <div aria-live="assertive" aria-atomic="true">
          {contextMessage === null ? null : (
            <div className={styles.contextBanner}>
              <span>{contextMessage}</span>
              <button
                type="button"
                className={styles.navItem}
                onClick={() => setContextMessage(null)}
              >
                Tutup
              </button>
            </div>
          )}
        </div>

        <div className={styles.contentRow}>
          <main id="konten-utama" className={styles.content} tabIndex={-1}>
            <div className={styles.pageHeader}>
              <nav aria-label="Breadcrumb">
                <ol role="list" className={styles.breadcrumb}>
                  {props.breadcrumb.map((segment, index) => (
                    <li key={segment}>
                      {index === props.breadcrumb.length - 1 ? (
                        <span aria-current="page">{segment}</span>
                      ) : (
                        <a href={`#${segment}`}>{segment}</a>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>

              <div className={styles.titleRow}>
                <div className={styles.titleGroup}>
                  <h1 className={styles.pageTitle}>{props.pageTitle}</h1>
                  {props.statusBadges}
                </div>
                {props.primaryAction === undefined ? null : (
                  <div className={styles.primaryAction}>{props.primaryAction}</div>
                )}
              </div>

              <p className={styles.contextRow}>
                <strong>{companyAktif?.legalName}</strong> · {props.fiscalPeriod} ·{' '}
                {companyAktif?.currency}
              </p>

              {props.tabs}
            </div>

            <div className={styles.body}>{props.children}</div>
          </main>

          {props.panel === undefined ? null : (
            <aside className={styles.panel} aria-label="Detail">
              {props.panel}
            </aside>
          )}
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        items={props.paletteItems}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  )
}
