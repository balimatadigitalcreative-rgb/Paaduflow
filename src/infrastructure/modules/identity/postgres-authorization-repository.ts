import type {
  AuthorizationRepository,
  CompanyAccess,
  PermissionMeta,
} from '#application/identity/authorization-ports'
import type { GrantedPermission } from '#domain/identity/authorization'
import type { TenantPlan } from '#domain/identity/authorization'
import type { PermissionScope } from '#domain/identity/permission'
import type { Queryable } from '#infrastructure/db/queryable'

export class PostgresAuthorizationRepository implements AuthorizationRepository {
  constructor(private readonly db: Queryable) {}

  /**
   * Satu kueri menjawab tiga pertanyaan sekaligus: apakah pengguna punya akses
   * ke company itu, peran apa, dan paket apa yang berlaku.
   *
   * Company yang tidak ada, company milik tenant lain, dan company yang ada
   * tetapi tidak diberikan kepadanya menghasilkan jawaban yang sama — `null`.
   * Membedakannya berarti mengubah id company menjadi alat pencacah.
   */
  async findCompanyAccess(userId: string, companyId: string): Promise<CompanyAccess | null> {
    const { rows } = await this.db.query<{
      tenant_id: string
      company_id: string
      role_id: string
      role_key: string
      role_rank: number
      plan: TenantPlan
    }>(
      `SELECT ca.tenant_id,
              ca.company_id,
              ca.role_id,
              r.key  AS role_key,
              r.rank AS role_rank,
              t.plan_type AS plan
         FROM company_access ca
         JOIN roles     r ON r.id = ca.role_id
         JOIN tenants   t ON t.id = ca.tenant_id
         JOIN companies c ON c.tenant_id = ca.tenant_id AND c.id = ca.company_id
        WHERE ca.user_id = $1
          AND ca.company_id = $2
          AND c.status = 'active'
          AND c.deleted_at IS NULL
          AND t.status IN ('trial', 'active')`,
      [userId, companyId],
    )

    const row = rows[0]
    if (row === undefined) return null
    return {
      tenantId: row.tenant_id,
      companyId: row.company_id,
      roleId: row.role_id,
      roleKey: row.role_key,
      roleRank: row.role_rank,
      plan: row.plan,
    }
  }

  async listAccessibleCompanies(userId: string, tenantId: string): Promise<string[]> {
    const { rows } = await this.db.query<{ company_id: string }>(
      `SELECT ca.company_id
         FROM company_access ca
         JOIN companies c ON c.tenant_id = ca.tenant_id AND c.id = ca.company_id
        WHERE ca.user_id = $1
          AND ca.tenant_id = $2
          AND c.status = 'active'
          AND c.deleted_at IS NULL
        ORDER BY ca.company_id`,
      [userId, tenantId],
    )
    return rows.map((row) => row.company_id)
  }

  async listGrants(roleId: string): Promise<GrantedPermission[]> {
    const { rows } = await this.db.query<{ permission_key: string; scope: PermissionScope }>(
      'SELECT permission_key, scope FROM role_permissions WHERE role_id = $1 ORDER BY permission_key',
      [roleId],
    )
    return rows.map((row) => ({ key: row.permission_key, scope: row.scope }))
  }

  async findPermission(key: string): Promise<PermissionMeta | null> {
    const { rows } = await this.db.query<{
      key: string
      min_plan: TenantPlan
      delegatable_to_agent: boolean
      grantable_to_integration: boolean
    }>(
      `SELECT key, min_plan, delegatable_to_agent, grantable_to_integration
         FROM permissions WHERE key = $1`,
      [key],
    )
    const row = rows[0]
    if (row === undefined) return null
    return {
      key: row.key,
      minPlan: row.min_plan,
      delegatableToAgent: row.delegatable_to_agent,
      grantableToIntegration: row.grantable_to_integration,
    }
  }
}
