import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { DEFAULT_PREFERENCES, type Density, type Theme, type UserPreferences } from './types.js'

/**
 * Preferensi tersimpan **per pengguna**, bukan per perangkat — butir 8
 * Design_Handoff_Spec §2.
 *
 * Penyimpanan lokal hanya cache supaya tema tidak berkedip saat halaman dimuat;
 * kebenarannya ada di server, lewat `onPersist`.
 */

const STORAGE_KEY = 'paadu.preferences'

interface PreferencesValue {
  readonly preferences: UserPreferences
  setTheme(theme: Theme): void
  setDensity(density: Density): void
  toggleSidebar(): void
}

const PreferencesContext = createContext<PreferencesValue | null>(null)

function readCache(): UserPreferences {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (raw === null || raw === undefined) return DEFAULT_PREFERENCES
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<UserPreferences>) }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function PreferencesProvider({
  children,
  initial,
  onPersist,
}: {
  children: ReactNode
  initial?: UserPreferences
  onPersist?: (preferences: UserPreferences) => void
}): ReactNode {
  const [preferences, setPreferences] = useState<UserPreferences>(initial ?? readCache)

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(preferences))
    } catch {
      // Penyimpanan lokal dapat ditolak di mode privat. Preferensi yang tidak
      // tersimpan bukan alasan menggagalkan aplikasi.
    }
  }, [preferences])

  const ubah = useCallback(
    (patch: Partial<UserPreferences>) => {
      setPreferences((sebelumnya) => {
        const berikutnya = { ...sebelumnya, ...patch }
        onPersist?.(berikutnya)
        return berikutnya
      })
    },
    [onPersist],
  )

  const value = useMemo<PreferencesValue>(
    () => ({
      preferences,
      setTheme: (theme) => ubah({ theme }),
      setDensity: (density) => ubah({ density }),
      toggleSidebar: () => ubah({ sidebarCollapsed: !preferences.sidebarCollapsed }),
    }),
    [preferences, ubah],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext)
  if (value === null) throw new Error('usePreferences dipakai di luar PreferencesProvider.')
  return value
}

/**
 * `system` sengaja tidak memasang `data-theme`, sehingga `prefers-color-scheme`
 * yang menentukan. Memaksa nilai eksplisit akan mengabaikan preferensi sistem
 * pengguna, yang justru bawaan kami.
 */
export function themeAttribute(theme: Theme): Record<string, string> {
  return theme === 'system' ? {} : { 'data-theme': theme }
}
