import type { IdempotencyStore } from '#shared/idempotency'

import type { AuthenticationService } from './identity/authentication.js'
import type { AuthorizationService } from './identity/authorization.js'
import type { CompanyAccessService } from './identity/company-access.js'
import type { SessionService } from './identity/sessions.js'

/**
 * Permukaan yang dilihat lapisan HTTP.
 *
 * Lapisan interface tidak boleh mengenal infrastruktur (D-045), termasuk kolam
 * koneksi dan transaksi. Karena itu ia tidak merakit layanan sendiri; ia
 * meminta konteks, dan composition root yang menyediakan transaksi beserta
 * konteks tenant di dalamnya.
 */

export interface CompanyScopedServices {
  readonly authorization: AuthorizationService
  readonly companyAccess: CompanyAccessService
}

export interface TenantContext {
  readonly tenantId: string
  readonly userId: string
}

export interface AppServices {
  readonly authentication: AuthenticationService
  readonly sessions: SessionService
  readonly idempotency: IdempotencyStore

  /**
   * Menentukan tenant dari company di path.
   *
   * Langkah ini berjalan sebelum konteks tenant ada — lihat D-064. Jawaban
   * `null` berarti pengguna tidak punya akses, dan jawabannya sama untuk
   * company yang tidak ada maupun company milik tenant lain.
   */
  resolveTenantForCompany(userId: string, companyId: string): Promise<string | null>

  /** Menjalankan sesuatu di dalam transaksi dengan konteks tenant terpasang. */
  withCompanyContext<T>(
    context: TenantContext,
    fn: (services: CompanyScopedServices) => Promise<T>,
  ): Promise<T>
}
