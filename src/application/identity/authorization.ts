import type { AuthorizationDecision, GrantedPermission } from '#domain/identity/authorization'
import { authorize } from '#domain/identity/authorization'
import type { PermissionScope, ScopeFilter } from '#domain/identity/permission'
import { denyAll, scopeToFilter } from '#domain/identity/permission'

import type { AuthorizationRepository, CompanyAccess } from './authorization-ports.js'

/**
 * Resolusi izin efektif dan penurunannya menjadi filter baris.
 *
 * Dua hal yang dijaga di sini:
 *
 * 1. Konteks company selalu diverifikasi terhadap `company_access`. Company id
 *    datang dari path URL (D-002), jadi ia adalah masukan pengguna — sama tidak
 *    tepercayanya dengan isian form.
 *
 * 2. Izin yang tidak dimiliki tidak melempar pengecualian di jalur baca; ia
 *    menghasilkan filter yang tidak mencocokkan apa pun. Data yang tidak boleh
 *    dilihat tidak pernah diakui keberadaannya, termasuk lewat perbedaan bentuk
 *    galat (Information Architecture §6).
 */

export interface AuthorizationContext {
  readonly userId: string
  readonly companyId: string
}

export interface ResolvedAccess {
  readonly access: CompanyAccess
  readonly granted: readonly GrantedPermission[]
  readonly accessibleCompanyIds: readonly string[]
}

export interface Requirement {
  readonly key: string
  readonly scope: PermissionScope
  /** Peran yang biasanya memilikinya, untuk kalimat "minta ke siapa". */
  readonly ask?: string
}

const DEFAULT_TTL_MS = 30_000

interface CacheEntry {
  readonly value: ResolvedAccess
  readonly expiresAt: number
}

export class AuthorizationService {
  private readonly cache = new Map<string, CacheEntry>()

  constructor(
    private readonly repository: AuthorizationRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly ttlMs: number = DEFAULT_TTL_MS,
  ) {}

  /**
   * Izin efektif pengguna di satu company, atau null bila ia tidak punya akses
   * ke company itu.
   *
   * Disimpan di cache berumur pendek karena ia dipanggil di setiap permintaan
   * (Modul 02 §5). Umurnya pendek dan dapat diinvalidasi eksplisit — cache izin
   * yang basi adalah izin yang sudah dicabut tetapi masih berlaku.
   */
  async resolve(context: AuthorizationContext): Promise<ResolvedAccess | null> {
    const key = `${context.userId}:${context.companyId}`
    const cached = this.cache.get(key)
    if (cached !== undefined && cached.expiresAt > this.now().getTime()) return cached.value

    const access = await this.repository.findCompanyAccess(context.userId, context.companyId)
    if (access === null) {
      // Tidak di-cache. Akses yang baru diberikan harus langsung berlaku, dan
      // menyimpan jawaban "tidak punya akses" membuatnya tertunda tanpa alasan.
      this.cache.delete(key)
      return null
    }

    const [granted, accessibleCompanyIds] = await Promise.all([
      this.repository.listGrants(access.roleId),
      this.repository.listAccessibleCompanies(context.userId, access.tenantId),
    ])

    const value: ResolvedAccess = { access, granted, accessibleCompanyIds }
    this.cache.set(key, { value, expiresAt: this.now().getTime() + this.ttlMs })
    return value
  }

  /** Dipanggil saat peran atau akses berubah — Modul 02 §9. */
  invalidate(userId: string, companyId?: string): void {
    if (companyId !== undefined) {
      this.cache.delete(`${userId}:${companyId}`)
      return
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${userId}:`)) this.cache.delete(key)
    }
  }

  async authorize(
    context: AuthorizationContext,
    requirement: Requirement,
  ): Promise<AuthorizationDecision> {
    const resolved = await this.resolve(context)
    const meta = await this.repository.findPermission(requirement.key)

    // Izin yang tidak ada di katalog ditolak seperti izin yang tidak dimiliki.
    // Salah ketik nama izin tidak boleh berubah menjadi izin terbuka.
    if (resolved === null || meta === null) {
      return {
        allowed: false,
        denial: {
          code: 'permission_denied',
          required: `${requirement.key}:${requirement.scope}`,
          ask: requirement.ask ?? 'Admin Company',
        },
      }
    }

    return authorize(
      resolved.granted,
      {
        key: requirement.key,
        scope: requirement.scope,
        minPlan: meta.minPlan,
        ask: requirement.ask ?? 'Admin Company',
      },
      resolved.access.plan,
    )
  }

  /**
   * Filter baris untuk satu izin. Selalu mengembalikan filter — tidak pernah
   * melempar — sehingga jalur baca tidak punya cara membedakan "tidak ada data"
   * dari "tidak boleh melihat data".
   */
  async filterFor(context: AuthorizationContext, requirement: Requirement): Promise<ScopeFilter> {
    const resolved = await this.resolve(context)
    if (resolved === null) {
      // Tenant pun belum tentu diketahui saat akses ditolak. Filter buntu yang
      // aman: tenant kosong, company kosong.
      return denyAll('00000000-0000-0000-0000-000000000000')
    }

    const decision = await this.authorize(context, requirement)
    if (!decision.allowed) return denyAll(resolved.access.tenantId)

    return scopeToFilter(decision.scope, {
      tenantId: resolved.access.tenantId,
      userId: context.userId,
      companyId: resolved.access.companyId,
      accessibleCompanyIds: resolved.accessibleCompanyIds,
    })
  }
}
