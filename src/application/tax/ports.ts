import type { TaxDeterminationRule } from '#domain/tax/determination'
import type { IsoDate, TaxCodeVersion } from '#domain/tax/rates'

/**
 * Port modul Pajak — D-097.
 *
 * Yang paling penting di berkas ini adalah `PartnerTaxStatusPort`. Status PKP
 * vendor tinggal di `vendors.is_pkp` milik modul Pembelian, dan lint melarang
 * Pajak mengimpornya. Ia masuk lewat adapter di composition root, lalu
 * **disalin** ke `input_tax_invoices` saat pencatatan — karena status PKP mitra
 * hari ini bukan statusnya saat transaksi, dan yang menentukan hak kredit
 * adalah yang saat transaksi.
 */

export interface CompanyTaxProfile {
  readonly companyId: string
  readonly npwp: string | null
  readonly isPkp: boolean
  readonly pkpEffectiveDate: IsoDate | null
  readonly nppkp: string | null
}

export interface TaxConfigPort {
  loadProfile(companyId: string): Promise<CompanyTaxProfile | null>
  listRules(companyId: string, transactionType: string): Promise<readonly TaxDeterminationRule[]>
  /** Seluruh versi satu kode. Penyaringan tanggal terjadi di domain, bukan di SQL. */
  listVersions(companyId: string, code: string): Promise<readonly TaxCodeVersion[]>
  findVersionById(taxCodeId: string): Promise<TaxCodeVersion | null>
  insertVersion(version: {
    id: string
    companyId: string
    code: string
    name: string
    taxType: TaxCodeVersion['taxType']
    rate: number
    validFrom: IsoDate
    calculationBase: TaxCodeVersion['calculationBase']
    glAccountId: string
    isCreditable: boolean
    createdBy: string
  }): Promise<void>
  closeVersion(taxCodeId: string, validTo: IsoDate): Promise<void>
  isCodeUsed(taxCodeId: string): Promise<boolean>
}

/** Status pajak mitra. Diimplementasikan modul Pembelian dan Penjualan. */
export interface PartnerTaxStatusPort {
  vendor(vendorId: string): Promise<{ isPkp: boolean; taxId: string | null } | null>
  customer(customerId: string): Promise<{ name: string; taxId: string | null } | null>
}

export interface SerialUsageSummary {
  readonly allocated: number
  readonly available: number
  readonly used: number
  readonly cancelled: number
  readonly expired: number
}

export interface TaxSerialPort {
  allocate(allocation: {
    id: string
    companyId: string
    prefix: string
    digits: number
    rangeStart: number
    rangeEnd: number
    expiresAt: IsoDate | null
    sourceReference: string | null
    createdBy: string
  }): Promise<number>
  /**
   * Mengambil nomor `available` terendah dan menguncinya.
   *
   * Memblokir, bukan `SKIP LOCKED`. Sepuluh penerbitan bersamaan harus
   * menghasilkan sepuluh nomor **berurutan**; `SKIP LOCKED` akan memberi nomor
   * melompat, dan lompatan pada nomor seri faktur pajak adalah temuan.
   */
  takeNextAvailable(
    companyId: string,
  ): Promise<{ serialNumber: number; formattedNumber: string } | null>
  markUsed(companyId: string, serialNumber: number, outputTaxInvoiceId: string): Promise<void>
  /** Dinamai lengkap supaya tidak bentrok dengan pembatalan faktur pajaknya. */
  markSerialCancelled(companyId: string, serialNumber: number, reason: string): Promise<void>
  isWithinAllocation(companyId: string, serialNumber: number): Promise<boolean>
  usage(companyId: string): Promise<SerialUsageSummary>
}

export interface OutputTaxInvoiceRecord {
  readonly id: string
  readonly companyId: string
  readonly serialNumber: number | null
  readonly formattedNumber: string | null
  readonly customerId: string
  readonly customerNpwp: string | null
  readonly invoiceDate: IsoDate
  readonly taxPeriod: string
  readonly taxCodeId: string
  readonly baseAmount: number
  readonly taxAmount: number
  readonly status: 'draft' | 'issued' | 'cancelled' | 'replaced'
  readonly replacesId: string | null
}

export interface OutputTaxInvoicePort {
  insert(invoice: {
    id: string
    companyId: string
    customerId: string
    customerNpwp: string | null
    customerName: string
    invoiceDate: IsoDate
    taxPeriod: string
    taxCodeId: string
    baseAmount: number
    taxAmount: number
    replacesId: string | null
    createdBy: string
  }): Promise<void>
  linkSources(
    invoiceId: string,
    sources: readonly { salesDocumentId: string; baseAmount: number; taxAmount: number }[],
  ): Promise<void>
  /**
   * Faktur penjualan yang sudah tercakup faktur pajak yang masih berlaku.
   *
   * Faktur pajak yang dibatalkan tidak ikut menahan sumbernya — nomornya hangus
   * (Module 08 §8), tetapi transaksi penjualannya tetap perlu difakturpajakkan.
   */
  coveredSalesDocuments(
    salesDocumentIds: readonly string[],
  ): Promise<readonly { salesDocumentId: string; number: string | null }[]>
  load(invoiceId: string): Promise<OutputTaxInvoiceRecord | null>
  markIssued(
    invoiceId: string,
    serialNumber: number,
    formattedNumber: string,
    by: string,
  ): Promise<void>
  markCancelled(invoiceId: string, reason: string, by: string): Promise<void>
  markReplaced(invoiceId: string): Promise<void>
}

export interface InputTaxInvoiceRecord {
  readonly id: string
  readonly companyId: string
  readonly vendorId: string
  readonly vendorNpwp: string | null
  readonly vendorIsPkp: boolean
  readonly supplierNumber: string
  readonly invoiceDate: IsoDate
  readonly taxPeriod: string
  readonly creditPeriod: string | null
  readonly taxCodeId: string
  readonly baseAmount: number
  readonly taxAmount: number
  readonly isCreditable: boolean
}

export interface InputTaxInvoicePort {
  /**
   * Dinamai `insertInput`, bukan `insert`. Satu kelas repository melayani
   * faktur keluaran dan masukan sekaligus, dan dua metode bernama sama pada
   * satu kelas memaksa salah satunya dibungkus adapter yang tidak menambah apa
   * pun selain nama.
   */
  insertInput(invoice: {
    id: string
    companyId: string
    vendorId: string
    vendorNpwp: string | null
    vendorIsPkp: boolean
    supplierNumber: string
    invoiceDate: IsoDate
    taxPeriod: string
    purchaseDocumentId: string | null
    taxCodeId: string
    baseAmount: number
    taxAmount: number
    createdBy: string
  }): Promise<void>
  loadInput(invoiceId: string): Promise<InputTaxInvoiceRecord | null>
  replaceDefects(
    invoiceId: string,
    defects: readonly { code: string; detail: string }[],
  ): Promise<void>
  markValidated(invoiceId: string, isCreditable: boolean, at: Date): Promise<void>
  setCreditPeriod(invoiceId: string, period: string): Promise<void>
}

export interface TaxLedgerEntry {
  readonly companyId: string
  readonly taxPeriod: string
  readonly taxCodeId: string
  readonly direction: 'out' | 'in' | 'withheld'
  readonly documentType: string
  readonly documentId: string
  readonly documentDate: IsoDate
  readonly partnerId: string | null
  readonly partnerNpwp: string | null
  readonly baseAmount: number
  readonly taxAmount: number
  readonly isCreditable: boolean
  readonly nonCreditableReason: string | null
  /** null untuk baris yang lahir dari proses, bukan dari orang. */
  readonly createdBy: string | null
}

export interface ReconciliationCode {
  readonly taxCodeId: string
  readonly code: string
  readonly taxLedgerTotal: number
}

/**
 * Satu baris rekonsiliasi = satu AKUN buku besar, bukan satu kode pajak.
 *
 * Grainnya ditentukan oleh apa yang benar-benar tersimpan: `journal_lines`
 * hanya memuat `account_id` dan tidak pernah menyebut kode pajak. Saldo akun
 * karena itu tidak dapat dibagi per kode — dan versi sebelumnya melakukannya
 * dengan cara yang salah, yaitu menyalin seluruh saldo akun ke setiap kode
 * yang menunjuknya. Dua versi dari satu kode sudah cukup membuat angkanya
 * berlipat, padahal versi berganda justru keadaan normal di modul ini.
 *
 * Sisi buku pajak tetap dirinci per kode lewat `codes`, karena `tax_ledger`
 * memang menyimpan `tax_code_id`. Jadi selisih dihitung pada grain yang dapat
 * dipertanggungjawabkan, sedangkan penunjuk arah "kode mana" tetap ada.
 */
export interface ReconciliationRow {
  readonly glAccountId: string
  readonly taxLedgerTotal: number
  readonly generalLedgerTotal: number
  readonly difference: number
  readonly codes: readonly ReconciliationCode[]
}

export interface TaxLedgerPort {
  append(entry: TaxLedgerEntry): Promise<void>
  reconcile(companyId: string, period: string): Promise<readonly ReconciliationRow[]>
}
