import type { AuthorizationDenial } from '#domain/identity/authorization'
import type { ScopeFilter } from '#domain/identity/permission'

import type { AuthorizationContext, AuthorizationService } from './authorization.js'

/**
 * Daftar dan pemberian akses company.
 *
 * Dua perlakuan berbeda terhadap penolakan, dan perbedaannya disengaja:
 *
 * - Endpoint yang diminta pengguna secara eksplisit menjawab `permission_denied`.
 *   Jawabannya seragam untuk company yang tidak ada, company milik tenant lain,
 *   dan company yang tidak diberikan kepadanya — jadi tidak ada yang bocor.
 * - Baris di dalam daftar disaring predikat (D-062). Yang tidak boleh dilihat
 *   tidak pernah muncul, dan tidak pernah dihitung di `total`.
 */

export interface CompanyAccessRow {
  readonly id: string
  readonly userId: string
  readonly email: string
  readonly fullName: string
  readonly roleKey: string
  readonly grantedAt: Date
}

export interface CompanyAccessPage {
  readonly items: readonly CompanyAccessRow[]
  readonly total: number
  readonly nextCursor: string | null
}

export interface CompanyAccessRepository {
  /** Pagination berbasis kursor — D-041. Tidak ada `offset` di mana pun. */
  list(
    filter: ScopeFilter,
    cursor: string | null,
    limit: number,
  ): Promise<{ rows: CompanyAccessRow[]; total: number; nextCursor: string | null }>
  findRoleByKey(tenantId: string, key: string): Promise<{ id: string; rank: number } | null>
  grant(input: {
    id: string
    tenantId: string
    companyId: string
    userId: string
    roleId: string
    grantedBy: string
  }): Promise<'granted' | 'already_exists'>
}

export type GrantResult =
  | { kind: 'granted'; id: string }
  | { kind: 'already_exists' }
  | { kind: 'unknown_role' }
  | { kind: 'denied'; denial: AuthorizationDenial }
  /** Modul 02 §10: tidak ada peran yang dapat menaikkan dirinya sendiri. */
  | { kind: 'role_above_granter' }

const BACA = { key: 'identitas.pengguna.baca', scope: 'company' as const, ask: 'Admin Company' }
const KELOLA = { key: 'identitas.pengguna.kelola', scope: 'company' as const, ask: 'Admin Company' }

export class CompanyAccessService {
  constructor(
    private readonly repository: CompanyAccessRepository,
    private readonly authorization: AuthorizationService,
    private readonly newId: () => string,
  ) {}

  async list(
    context: AuthorizationContext,
    page: { cursor: string | null; limit: number },
  ): Promise<CompanyAccessPage | { denied: AuthorizationDenial }> {
    const decision = await this.authorization.authorize(context, BACA)
    if (!decision.allowed) return { denied: decision.denial }

    const filter = await this.authorization.filterFor(context, BACA)
    const result = await this.repository.list(filter, page.cursor, page.limit)
    return { items: result.rows, total: result.total, nextCursor: result.nextCursor }
  }

  async grant(
    context: AuthorizationContext,
    input: { userId: string; roleKey: string },
  ): Promise<GrantResult> {
    const decision = await this.authorization.authorize(context, KELOLA)
    if (!decision.allowed) return { kind: 'denied', denial: decision.denial }

    const resolved = await this.authorization.resolve(context)
    if (resolved === null) {
      return {
        kind: 'denied',
        denial: {
          code: 'permission_denied',
          required: `${KELOLA.key}:${KELOLA.scope}`,
          ask: KELOLA.ask,
        },
      }
    }

    const role = await this.repository.findRoleByKey(resolved.access.tenantId, input.roleKey)
    if (role === null) return { kind: 'unknown_role' }

    // Angka kecil berarti lebih berwenang. Pemberi tidak boleh memberikan peran
    // yang lebih tinggi daripada dirinya — tanpa aturan ini, seorang Admin
    // Company dapat mengangkat dirinya menjadi Pemilik Tenant lewat akun kedua.
    if (role.rank < resolved.access.roleRank) return { kind: 'role_above_granter' }

    const id = this.newId()
    const outcome = await this.repository.grant({
      id,
      tenantId: resolved.access.tenantId,
      companyId: resolved.access.companyId,
      userId: input.userId,
      roleId: role.id,
      grantedBy: context.userId,
    })

    if (outcome === 'already_exists') return { kind: 'already_exists' }

    // Izin efektif orang yang baru diberi akses harus langsung berlaku.
    this.authorization.invalidate(input.userId, resolved.access.companyId)
    return { kind: 'granted', id }
  }
}
