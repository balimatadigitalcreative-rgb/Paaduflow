import type { IdempotencyStore } from '#shared/idempotency'

import type {
  AccessibleCompany,
  AccountingQueryPort,
  MasterDataPort,
  PurchaseQueryPort,
  SalesQueryPort,
  TaxQueryPort,
} from './queries.js'
import type { SalesDocumentService } from './sales/documents.js'
import type { PostInvoiceService } from './sales/posting.js'

import type { TaxCodeService } from './tax/codes.js'
import type { TaxEngineService } from './tax/engine.js'
import type { InputTaxInvoiceService, OutputTaxInvoiceService } from './tax/invoices.js'
import type { ReconciliationRow } from './tax/ports.js'
import type { TaxSerialService } from './tax/serials.js'

import type { OverrideMatchService, PostBillService } from './purchasing/bills.js'
import type { PurchaseDocumentService } from './purchasing/documents.js'
import type { PostReceiptService } from './purchasing/receipts.js'

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

/**
 * Modul Pembelian sebagaimana dilihat lapisan HTTP.
 *
 * `bills.post` dan `override.override` sengaja dua pintu terpisah. Menyatukan
 * keduanya di sini akan membuat rute mana pun yang memegang salah satunya
 * memegang keduanya.
 */
export interface PurchasingScopedServices {
  readonly documents: PurchaseDocumentService
  readonly receipts: PostReceiptService
  readonly bills: PostBillService
  readonly override: OverrideMatchService
  readonly queries: PurchaseQueryPort
}

/**
 * Modul Penjualan sebagaimana dilihat lapisan HTTP.
 *
 * Baru ada di sesi antarmuka. Sebelumnya modul ini punya layanan lengkap dan
 * nol rute — lihat D-133.
 */
export interface SalesScopedServices {
  readonly documents: SalesDocumentService
  readonly posting: PostInvoiceService
  readonly queries: SalesQueryPort
}

export interface AccountingScopedServices {
  readonly queries: AccountingQueryPort
}

/**
 * Modul Pajak sebagaimana dilihat lapisan HTTP.
 *
 * Tidak ada `updateRate` di mana pun, dan itu bukan kelalaian: perubahan tarif
 * adalah versi baru lewat `codes.addVersion`, tidak pernah pengubahan.
 */
export interface TaxScopedServices {
  readonly engine: TaxEngineService
  readonly codes: TaxCodeService
  readonly serials: TaxSerialService
  readonly outputInvoices: OutputTaxInvoiceService
  readonly inputInvoices: InputTaxInvoiceService
  /** Jalur baca untuk layar — sama bentuknya dengan modul lain. */
  readonly queries: TaxQueryPort
  /** Pembacaan yang tidak punya layanan sendiri: profil dan rekonsiliasi. */
  readonly repository: {
    loadProfile(companyId: string): Promise<{
      npwp: string | null
      isPkp: boolean
      pkpEffectiveDate: string | null
      nppkp: string | null
    } | null>
    reconcile(companyId: string, period: string): Promise<readonly ReconciliationRow[]>
  }
}

export interface CompanyScopedServices {
  readonly authorization: AuthorizationService
  readonly companyAccess: CompanyAccessService
  readonly purchasing: PurchasingScopedServices
  readonly sales: SalesScopedServices
  readonly accounting: AccountingScopedServices
  /** Pelanggan, vendor, barang, gudang — dibutuhkan setiap formulir. */
  readonly masterData: MasterDataPort
  readonly tax: TaxScopedServices
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

  /**
   * Company yang dapat diakses pengguna, lintas tenant.
   *
   * Berjalan tanpa konteks tenant, karena tenant-nya justru yang sedang dicari
   * — sama seperti `resolveTenantForCompany` (D-064). Tanpa ini, layar tidak
   * punya cara mengetahui id company mana pun untuk dimasukkan ke path.
   */
  listCompaniesForUser(userId: string): Promise<readonly AccessibleCompany[]>

  /** Menjalankan sesuatu di dalam transaksi dengan konteks tenant terpasang. */
  withCompanyContext<T>(
    context: TenantContext,
    fn: (services: CompanyScopedServices) => Promise<T>,
  ): Promise<T>
}
