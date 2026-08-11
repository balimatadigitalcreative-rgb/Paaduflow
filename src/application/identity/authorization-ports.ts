import type { TenantPlan } from '#domain/identity/authorization'
import type { GrantedPermission } from '#domain/identity/authorization'

/**
 * Port untuk resolusi izin. Terpisah dari `ports.ts` karena autentikasi dan
 * otorisasi punya siklus hidup yang berbeda: yang pertama dipanggil sekali per
 * sesi, yang kedua di setiap permintaan.
 */

export interface CompanyAccess {
  readonly tenantId: string
  readonly companyId: string
  readonly roleId: string
  readonly roleKey: string
  readonly roleRank: number
  readonly plan: TenantPlan
}

export interface PermissionMeta {
  readonly key: string
  readonly minPlan: TenantPlan
  readonly delegatableToAgent: boolean
  readonly grantableToIntegration: boolean
}

export interface AuthorizationRepository {
  /**
   * Akses pengguna ke satu company. `null` berarti tidak punya akses — dan itu
   * jawaban yang sama untuk company yang tidak ada, company milik tenant lain,
   * dan company yang ada tetapi tidak diberikan kepadanya.
   */
  findCompanyAccess(userId: string, companyId: string): Promise<CompanyAccess | null>

  /** Company di satu tenant yang penggunanya punya akses. */
  listAccessibleCompanies(userId: string, tenantId: string): Promise<string[]>

  listGrants(roleId: string): Promise<GrantedPermission[]>

  findPermission(key: string): Promise<PermissionMeta | null>
}
