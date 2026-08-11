/**
 * Izin dan cakupannya — Modul 02 §5 dan §6.
 *
 * Yang mengikat seluruh desain ini ada di satu kalimat Modul 02 §5: izin wajib
 * dapat diterjemahkan menjadi klausa `WHERE`. Mengambil seluruh baris lalu
 * menyaring di aplikasi akan gagal pada tenant besar, dan bocor lewat
 * penghitungan total jauh sebelum itu.
 *
 * Karena itu cakupan hanya ada tiga, dan ketiganya sederhana. Setiap cakupan
 * yang tidak dapat menjadi predikat adalah cakupan yang tidak boleh ada.
 */

export type PermissionScope = 'own' | 'company' | 'tenant'

/** `modul.entitas.aksi` — tanpa cakupan. Cakupan datang dari peran. */
const KEY_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/

export interface PermissionKeyParts {
  readonly moduleId: string
  readonly entity: string
  readonly action: string
}

export function parsePermissionKey(key: string): PermissionKeyParts | null {
  if (!KEY_PATTERN.test(key)) return null
  const [moduleId, entity, action] = key.split('.')
  return { moduleId: moduleId!, entity: entity!, action: action! }
}

/**
 * Bentuk lengkap yang dipakai di API dan pesan galat: `modul.entitas.aksi:cakupan`.
 */
export function formatPermission(key: string, scope: PermissionScope): string {
  return `${key}:${scope}`
}

/**
 * Cakupan yang lebih luas mencakup yang lebih sempit. Seseorang bercakupan
 * `tenant` otomatis memenuhi syarat yang meminta `company`.
 */
const BREADTH: Record<PermissionScope, number> = { own: 1, company: 2, tenant: 3 }

export function scopeSatisfies(granted: PermissionScope, required: PermissionScope): boolean {
  return BREADTH[granted] >= BREADTH[required]
}

/**
 * Predikat baris yang harus diterapkan basis data.
 *
 * Ini bukan SQL. Lapisan domain tidak mengenal SQL, dan menjadikannya struktur
 * membuatnya dapat diuji tanpa basis data sekaligus tidak dapat dirakit menjadi
 * kueri secara tidak sengaja.
 */
export interface ScopeFilter {
  readonly tenantId: string
  /**
   * Company yang boleh dilihat. Selalu daftar tertutup — termasuk untuk cakupan
   * `tenant`, karena "seluruh tenant" tetap berarti seluruh company yang
   * penggunanya punya akses, bukan seluruh company yang ada.
   */
  readonly companyIds: readonly string[]
  /** Bila terisi, hanya baris yang dibuat pengguna ini. */
  readonly ownerId: string | null
}

export interface ScopeContext {
  readonly tenantId: string
  readonly userId: string
  /** Company aktif, diambil dari path URL — D-002. */
  readonly companyId: string
  /** Seluruh company di tenant ini yang penggunanya punya akses. */
  readonly accessibleCompanyIds: readonly string[]
}

export function scopeToFilter(scope: PermissionScope, context: ScopeContext): ScopeFilter {
  switch (scope) {
    case 'tenant':
      return {
        tenantId: context.tenantId,
        companyIds: context.accessibleCompanyIds,
        ownerId: null,
      }
    case 'company':
      return { tenantId: context.tenantId, companyIds: [context.companyId], ownerId: null }
    case 'own':
      return {
        tenantId: context.tenantId,
        companyIds: [context.companyId],
        ownerId: context.userId,
      }
  }
}

/**
 * Filter yang tidak mengizinkan apa pun.
 *
 * Dipakai saat izin tidak dimiliki. Ia sengaja tetap berupa filter, bukan
 * pengecualian — supaya jalur pencarian dan laporan yang menggabungkan banyak
 * entitas dapat mengabaikan satu entitas tanpa menggagalkan seluruh permintaan,
 * dan tanpa pernah mengakui entitas itu ada.
 */
export function denyAll(tenantId: string): ScopeFilter {
  return { tenantId, companyIds: [], ownerId: null }
}

export function isDenyAll(filter: ScopeFilter): boolean {
  return filter.companyIds.length === 0
}
