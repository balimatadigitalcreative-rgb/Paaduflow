import type { PermissionScope } from './permission.js'
import { scopeSatisfies } from './permission.js'

/**
 * Kontrak kesalahan tiga sebab — Modul 02 §7, Information Architecture §5.
 *
 * Tiga sebab, bukan satu, karena perlakuan UI-nya berbeda dan perbedaan itu
 * bukan kosmetik:
 *
 *   permission_denied → sembunyikan sepenuhnya. Menampilkannya mengajarkan
 *                       struktur internal organisasi, dan untuk data keuangan
 *                       eksistensinya sendiri bisa sensitif.
 *   plan_restricted   → tampilkan beserta tawaran upgrade. Ini keputusan
 *                       komersial, bukan batas keamanan; menyembunyikannya
 *                       berarti pelanggan tidak pernah tahu fitur itu ada.
 *   state_restricted  → tampilkan nonaktif dengan alasannya. Pengguna punya
 *                       izin; yang berubah hanya keadaannya.
 */

export type TenantPlan = 'trial' | 'starter' | 'business' | 'enterprise'

export type AuthorizationDenial =
  | { code: 'permission_denied'; required: string; ask: string }
  | { code: 'plan_restricted'; required: string; requiredPlan: TenantPlan }
  | { code: 'state_restricted'; reason: string }

export type AuthorizationDecision =
  | { allowed: true; scope: PermissionScope }
  | { allowed: false; denial: AuthorizationDenial }

export interface GrantedPermission {
  readonly key: string
  readonly scope: PermissionScope
}

export interface PermissionRequirement {
  readonly key: string
  readonly scope: PermissionScope
  readonly minPlan: TenantPlan
  /** Peran yang biasanya memilikinya, untuk kalimat "minta ke siapa". */
  readonly ask: string
}

const PLAN_RANK: Record<TenantPlan, number> = {
  trial: 0,
  starter: 1,
  business: 2,
  enterprise: 3,
}

export function planSatisfies(actual: TenantPlan, required: TenantPlan): boolean {
  return PLAN_RANK[actual] >= PLAN_RANK[required]
}

/**
 * Izin diperiksa SEBELUM paket.
 *
 * Urutannya penting dan tidak boleh dibalik. `plan_restricted` dirancang untuk
 * ditampilkan; bila ia dijawab kepada seseorang yang sebenarnya tidak berizin,
 * ia menjadi saluran yang mengakui keberadaan fitur — persis yang
 * `permission_denied` ada untuk sembunyikan.
 */
export function authorize(
  granted: readonly GrantedPermission[],
  requirement: PermissionRequirement,
  plan: TenantPlan,
): AuthorizationDecision {
  const match = granted.find(
    (permission) =>
      permission.key === requirement.key && scopeSatisfies(permission.scope, requirement.scope),
  )

  if (match === undefined) {
    return {
      allowed: false,
      denial: {
        code: 'permission_denied',
        required: `${requirement.key}:${requirement.scope}`,
        ask: requirement.ask,
      },
    }
  }

  if (!planSatisfies(plan, requirement.minPlan)) {
    return {
      allowed: false,
      denial: {
        code: 'plan_restricted',
        required: requirement.key,
        requiredPlan: requirement.minPlan,
      },
    }
  }

  return { allowed: true, scope: match.scope }
}

/**
 * Penolakan karena keadaan, bukan karena izin. Diterbitkan pemanggil yang
 * mengetahui keadaannya — periode fiskal tertutup, dokumen sudah diposting.
 */
export function stateRestricted(reason: string): AuthorizationDecision {
  return { allowed: false, denial: { code: 'state_restricted', reason } }
}

export interface ErrorEnvelope {
  readonly success: false
  readonly message: string
  readonly errors: readonly AuthorizationDenial[]
}

const MESSAGES: Record<AuthorizationDenial['code'], string> = {
  permission_denied: 'Anda tidak memiliki akses ke bagian ini.',
  plan_restricted: 'Fitur ini tersedia pada paket yang lebih tinggi.',
  state_restricted: 'Aksi ini tidak dapat dilakukan pada keadaan sekarang.',
}

export function toErrorEnvelope(denial: AuthorizationDenial): ErrorEnvelope {
  return { success: false, message: MESSAGES[denial.code], errors: [denial] }
}
