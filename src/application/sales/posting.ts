import { evaluateTransition, type LifecycleStatus, type Transition } from '#domain/sales/transitions'

/**
 * Posting faktur — Module 04 §9, Flow_Archetypes §2.
 *
 * Dokumen, jurnal, dan mutasi stok berhasil bersama atau gagal bersama. Satu
 * transaksi milik pemanggil; layanan ini tidak membukanya sendiri, supaya
 * pemanggil dapat menyertakan hal lain ke dalam atomisitas yang sama.
 *
 * Seluruh kebutuhan lintas modul dideklarasikan **di sini sebagai port** dan
 * disuntik composition root — D-040. Modul Penjualan tidak pernah mengimpor
 * modul Akuntansi maupun Persediaan, dan lint yang menegakkannya.
 */

export interface PostingLine {
  readonly id: string
  readonly itemId: string | null
  readonly warehouseId: string | null
  readonly qty: number
  readonly netAmount: number
  readonly taxAmount: number
  readonly itemCategoryId: string | null
  readonly taxCodeId: string | null
}

export interface PostingDocument {
  readonly id: string
  readonly companyId: string
  readonly customerId: string
  readonly lifecycleStatus: LifecycleStatus
  readonly documentVersion: number
  readonly number: string | null
  readonly currency: string
  readonly fiscalYear: number
  readonly fiscalPeriod: number
  readonly total: number
  readonly taxTotal: number
  readonly lines: readonly PostingLine[]
}

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

/** Mengurangi stok. Diimplementasikan modul Persediaan. */
export interface StockPort {
  ship(input: {
    companyId: string
    itemId: string
    warehouseId: string
    qty: number
    sourceType: string
    sourceId: string
  }): Promise<void>
}

export interface SalesDocumentPort {
  loadForPosting(documentId: string): Promise<PostingDocument | null>
  listTransitions(): Promise<readonly Transition[]>
  isFiscalPeriodOpen(companyId: string, year: number, period: number): Promise<boolean>
  markPosted(documentId: string, postedBy: string, at: Date): Promise<void>
}

export type PostInvoiceResult =
  | { readonly kind: 'posted'; readonly journalId: string }
  | { readonly kind: 'transition_rejected'; readonly reason: string }
  | { readonly kind: 'account_unresolved'; readonly reason: string }
  | { readonly kind: 'ledger_rejected'; readonly reason: string }
  | { readonly kind: 'not_found' }

export class PostInvoiceService {
  constructor(
    private readonly documents: SalesDocumentPort,
    private readonly accounts: AccountResolverPort,
    private readonly ledger: LedgerPort,
    private readonly stock: StockPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async post(documentId: string, postedBy: string): Promise<PostInvoiceResult> {
    const dokumen = await this.documents.loadForPosting(documentId)
    if (dokumen === null) return { kind: 'not_found' }

    const periodeTerbuka = await this.documents.isFiscalPeriodOpen(
      dokumen.companyId,
      dokumen.fiscalYear,
      dokumen.fiscalPeriod,
    )

    const transisi = evaluateTransition(await this.documents.listTransitions(), {
      docType: 'invoice',
      from: dokumen.lifecycleStatus,
      to: 'posted',
      satisfied: periodeTerbuka ? ['fiscal_period_open'] : [],
    })

    if (transisi.kind === 'not_permitted') {
      return {
        kind: 'transition_rejected',
        reason: `Faktur berstatus ${dokumen.lifecycleStatus} tidak dapat diposting. Tujuan yang tersedia: ${transisi.available.join(', ') || 'tidak ada'}.`,
      }
    }
    if (transisi.kind === 'requirements_unmet') {
      return {
        kind: 'transition_rejected',
        reason: `Syarat belum terpenuhi: ${transisi.missing.join(', ')}.`,
      }
    }

    // ── Penentuan akun ────────────────────────────────────────────────────
    // Modul ini tidak pernah menyebut nomor akun. Ia mengirim konteks; lapisan
    // penentuan yang menjawab. Aturan yang tidak ditemukan MENOLAK posting —
    // tidak ada akun cadangan (D-011).
    const piutang = await this.accounts.resolve({ transactionType: 'sales.invoice.receivable' })
    if (piutang.kind === 'unresolved') {
      return { kind: 'account_unresolved', reason: piutang.reason }
    }

    const barisJurnal: { accountId: string; debit: number; credit: number }[] = [
      { accountId: piutang.accountId, debit: dokumen.total, credit: 0 },
    ]

    for (const baris of dokumen.lines) {
      const pendapatan = await this.accounts.resolve({
        transactionType: 'sales.invoice.revenue',
        itemCategoryId: baris.itemCategoryId,
        taxCodeId: baris.taxCodeId,
      })
      if (pendapatan.kind === 'unresolved') {
        return { kind: 'account_unresolved', reason: pendapatan.reason }
      }
      barisJurnal.push({ accountId: pendapatan.accountId, debit: 0, credit: baris.netAmount })
    }

    if (dokumen.taxTotal > 0) {
      const pajak = await this.accounts.resolve({ transactionType: 'sales.invoice.tax_output' })
      if (pajak.kind === 'unresolved') {
        return { kind: 'account_unresolved', reason: pajak.reason }
      }
      barisJurnal.push({ accountId: pajak.accountId, debit: 0, credit: dokumen.taxTotal })
    }

    const jurnal = await this.ledger.postJournal({
      companyId: dokumen.companyId,
      journalDate: this.now(),
      fiscalYear: dokumen.fiscalYear,
      fiscalPeriod: dokumen.fiscalPeriod,
      currency: dokumen.currency,
      sourceType: 'sales_document',
      sourceId: dokumen.id,
      lines: barisJurnal,
    })

    // Jurnal gagal berarti faktur tidak jadi diposting. Pemanggil membatalkan
    // transaksinya, dan tidak ada satu pun mutasi stok yang tertinggal.
    if (jurnal.kind === 'rejected') {
      return { kind: 'ledger_rejected', reason: jurnal.reason }
    }

    for (const baris of dokumen.lines) {
      if (baris.itemId === null || baris.warehouseId === null || baris.qty <= 0) continue
      await this.stock.ship({
        companyId: dokumen.companyId,
        itemId: baris.itemId,
        warehouseId: baris.warehouseId,
        qty: baris.qty,
        sourceType: 'sales_document',
        sourceId: dokumen.id,
      })
    }

    await this.documents.markPosted(dokumen.id, postedBy, this.now())
    return { kind: 'posted', journalId: jurnal.journalId }
  }
}

/**
 * Pengaju tidak dapat menyetujui dokumennya sendiri, meski punya izin — D-009.
 *
 * Ditegakkan di layanan, bukan di model izin: ia bergantung pada relasi
 * pengguna dengan dokumen, bukan pada peran. Menyandikannya ke katalog izin
 * akan meledakkan jumlah peran.
 */
export function canApprove(document: { submittedBy: string | null }, approver: string): boolean {
  return document.submittedBy !== approver
}
