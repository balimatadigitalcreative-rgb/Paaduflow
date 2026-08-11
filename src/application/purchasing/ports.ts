import type { LifecycleStatus, Transition } from '#shared/document-lifecycle'
import type { MatchLine, MatchStatus, MatchTolerance } from '#domain/purchasing/three-way-match'

/**
 * Port yang dideklarasikan modul Pembelian — D-097.
 *
 * Bentuknya mirip port modul Penjualan dan itu disengaja: keduanya berbicara
 * dengan Akuntansi dan Persediaan, bukan satu sama lain. Menyatukannya menjadi
 * satu port bersama akan membuat perubahan kebutuhan Penjualan memaksa
 * perubahan di Pembelian — persis kopling yang dilarang D-040.
 */

/** Menerjemahkan konteks menjadi akun. Diimplementasikan modul Akuntansi. */
export interface AccountResolverPort {
  resolve(context: {
    transactionType: string
    itemCategoryId?: string | null
    taxCodeId?: string | null
  }): Promise<{ kind: 'resolved'; accountId: string } | { kind: 'unresolved'; reason: string }>
}

/** Menulis ke buku besar. Diimplementasikan modul Akuntansi. */
export interface LedgerPort {
  postJournal(input: {
    companyId: string
    journalDate: Date
    fiscalYear: number
    fiscalPeriod: number
    currency: string
    sourceType: string
    sourceId: string
    lines: readonly { accountId: string; debit: number; credit: number }[]
  }): Promise<{ kind: 'posted'; journalId: string } | { kind: 'rejected'; reason: string }>
}

/** Menambah stok. Diimplementasikan modul Persediaan. */
export interface StockPort {
  receive(input: {
    companyId: string
    itemId: string
    warehouseId: string
    qty: number
    unitCost: number
    sourceType: string
    sourceId: string
  }): Promise<void>
}

/**
 * Mencatat peristiwa audit. Override pencocokan adalah peristiwa tersendiri,
 * bukan catatan tambahan di peristiwa posting — Module 06 §11.
 */
export interface AuditPort {
  record(event: {
    companyId: string
    action: string
    entityType: string
    entityId: string
    actorId: string
    payload: Record<string, unknown>
  }): Promise<void>
}

export interface PurchaseLineSnapshot extends MatchLine {
  readonly id: string
  readonly sourceLineId: string | null
  readonly itemId: string | null
  readonly warehouseId: string | null
  readonly itemCategoryId: string | null
  readonly taxCodeId: string | null
  readonly netAmount: number
  readonly taxAmount: number
}

export interface BillSnapshot {
  readonly id: string
  readonly companyId: string
  readonly vendorId: string
  readonly number: string | null
  readonly lifecycleStatus: LifecycleStatus
  readonly matchStatus: MatchStatus
  readonly documentVersion: number
  readonly currency: string
  readonly issueDate: Date
  readonly fiscalYear: number
  readonly fiscalPeriod: number
  readonly total: number
  readonly taxTotal: number
  readonly createdBy: string | null
  readonly submittedBy: string | null
  readonly overrideBy: string | null
  readonly lines: readonly PurchaseLineSnapshot[]
}

export interface PurchaseDocumentPort {
  /** Mengunci tagihan beserta baris pesanan dan penerimaan yang dicocokkan. */
  loadBillForPosting(billId: string): Promise<BillSnapshot | null>
  loadTolerance(companyId: string): Promise<MatchTolerance>
  listTransitions(): Promise<readonly Transition[]>
  isFiscalPeriodOpen(companyId: string, year: number, period: number): Promise<boolean>
  setMatchStatus(billId: string, status: MatchStatus): Promise<void>
  recordOverride(billId: string, by: string, reason: string, at: Date): Promise<void>
  /** Menaikkan qty_billed pada baris pesanan yang ditagih. */
  applyBilledQuantities(
    lines: readonly { sourceLineId: string; qty: number }[],
  ): Promise<void>
  markPosted(billId: string, postedBy: string, at: Date): Promise<void>
}
