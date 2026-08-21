import type { Icon } from '@tabler/icons-react'

/**
 * Bentuk data yang dibutuhkan shell.
 *
 * Seluruhnya diterima sebagai properti. Shell tidak mengambil data sendiri —
 * itu membuatnya dapat diuji tanpa server, dan membuat penyaringan izin tetap
 * menjadi urusan lapisan yang memang memegangnya.
 */

export interface CompanySummary {
  readonly id: string
  readonly legalName: string
  /** Dipakai membedakan dua company bernama mirip — Component_Specs_AppShell §1. */
  readonly taxId: string | null
  readonly currency: string
  readonly fiscalYearLabel: string
  readonly status: 'active' | 'inactive'
}

export interface TenantSummary {
  readonly id: string
  readonly name: string
  readonly companies: readonly CompanySummary[]
}

export interface ModuleLink {
  readonly id: string
  readonly name: string
  /**
   * Ikon Tabler, outline — Design_Tokens dan Component_Specs_AppShell §2.
   *
   * Komponen, bukan nama string. Nama string menuntut peta nama-ke-ikon di
   * suatu tempat, dan peta itu memaksa SELURUH set ikon ikut terbundel karena
   * bundler tidak dapat tahu mana yang benar-benar dipakai. Komponen yang
   * diimpor langsung dapat di-tree-shake.
   *
   * Ikon tidak pernah berdiri sendiri: `name` selalu ikut sebagai `aria-label`
   * dan tooltip. Ikon tanpa label adalah teka-teki (§2).
   */
  readonly glyph: Icon
  /** Hanya untuk hal yang menunggu tindakan pengguna, bukan "ada data baru". */
  readonly pendingCount?: number
}

export type SidebarGroupName = 'Transaksi' | 'Data induk' | 'Laporan' | 'Pengaturan'

export interface SidebarItem {
  readonly id: string
  readonly label: string
  readonly group: SidebarGroupName
  /** Item tanpa izin disembunyikan, bukan dinonaktifkan — Information Architecture §5. */
  readonly permitted: boolean
}

export type PaletteGroup = 'Navigasi' | 'Aksi' | 'Entitas' | 'AI'

export interface PaletteItem {
  readonly id: string
  readonly label: string
  readonly group: PaletteGroup
  readonly hint?: string
  readonly permitted: boolean
  readonly run: () => void
}

export type Theme = 'light' | 'dark' | 'system'
export type Density = 'comfortable' | 'compact'

export interface UserPreferences {
  readonly theme: Theme
  readonly density: Density
  readonly sidebarCollapsed: boolean
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  density: 'comfortable',
  sidebarCollapsed: false,
}

/** Urutan tetap kelompok hasil pencarian — Information Architecture §6. */
export const PALETTE_ORDER: readonly PaletteGroup[] = ['Navigasi', 'Aksi', 'Entitas', 'AI']

export const SIDEBAR_ORDER: readonly SidebarGroupName[] = [
  'Transaksi',
  'Data induk',
  'Laporan',
  'Pengaturan',
]

/** Melebihi ini, ikon berhenti terhafalkan — Layout_System §2. */
export const MAX_PINNED_MODULES = 8
