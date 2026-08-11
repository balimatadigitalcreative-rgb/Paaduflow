import type { AppServices, CompanyScopedServices, TenantContext } from '#application/app-services'
import {
  AuthorizationService,
  createPermissionCache,
  type PermissionCache,
} from '#application/identity/authorization'
import { CompanyAccessService } from '#application/identity/company-access'
import type { BreachedPasswordList, Mailer } from '#application/identity/ports'
import { PostgresIdempotencyStore } from '#infrastructure/db/postgres-idempotency-store'
import { PostgresUnitOfWork } from '#infrastructure/db/unit-of-work'
import { PostgresAuthorizationRepository } from '#infrastructure/modules/identity/postgres-authorization-repository'
import { PostgresCompanyAccessRepository } from '#infrastructure/modules/identity/postgres-company-access-repository'
import { uuidv7 } from '#shared/uuid'
import type { Pool } from 'pg'

import { createIdentityModule } from './identity.js'
import { createPurchasing } from './purchasing.js'

export interface AppServicesOptions {
  readonly pool: Pool
  readonly tokenSigningSecret: string
  readonly mfaEncryptionKeyBase64: string
  readonly mailer: Mailer
  readonly breachList: BreachedPasswordList
  readonly now?: () => Date
}

/**
 * Merakit permukaan yang dipakai lapisan HTTP.
 *
 * Layanan bercakupan company dirakit ulang setiap permintaan karena
 * repository-nya terikat pada transaksi permintaan itu — di situlah konteks
 * tenant hidup (`SET LOCAL`). Yang dibagikan lintas permintaan hanya cache
 * izin, yang memang harus dibagikan supaya ada gunanya.
 */
export function createAppServices(options: AppServicesOptions): AppServices {
  const unitOfWork = new PostgresUnitOfWork(options.pool)
  const permissionCache: PermissionCache = createPermissionCache()
  const now = options.now ?? (() => new Date())

  const identity = createIdentityModule({
    db: options.pool,
    tokenSigningSecret: options.tokenSigningSecret,
    mfaEncryptionKeyBase64: options.mfaEncryptionKeyBase64,
    mailer: options.mailer,
    breachList: options.breachList,
    now,
  })

  return {
    authentication: identity.authentication,
    sessions: identity.sessions,
    idempotency: new PostgresIdempotencyStore(unitOfWork),

    async resolveTenantForCompany(userId: string, companyId: string): Promise<string | null> {
      // Berjalan sebelum konteks tenant ada. Kebijakan RLS `company_access`
      // mengizinkan pengguna membaca barisnya sendiri justru untuk langkah ini
      // — D-064.
      return unitOfWork.asUser(userId, async (db) => {
        const { rows } = await db.query<{ tenant_id: string }>(
          'SELECT tenant_id FROM company_access WHERE user_id = $1 AND company_id = $2',
          [userId, companyId],
        )
        return rows[0]?.tenant_id ?? null
      })
    },

    async withCompanyContext<T>(
      context: TenantContext,
      fn: (services: CompanyScopedServices) => Promise<T>,
    ): Promise<T> {
      return unitOfWork.inTenant(context, async (db) => {
        const authorization = new AuthorizationService(
          new PostgresAuthorizationRepository(db),
          now,
          undefined,
          permissionCache,
        )
        const companyAccess = new CompanyAccessService(
          new PostgresCompanyAccessRepository(db),
          authorization,
          () => uuidv7(),
        )
        return fn({ authorization, companyAccess, purchasing: createPurchasing(db, context.tenantId) })
      })
    },
  }
}
