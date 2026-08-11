import { calculateDocument } from '#shared/line-items'
import { evaluateConversion } from '#shared/document-conversion'

import type { OrderLineForReceipt } from './receipts'

/**
 * Dokumen pembelian — RFQ, pesanan pembelian, dan tagihan vendor.
 *
 * Satu tabel untuk ketiganya, sama seperti Penjualan: mereka punya kepala yang
 * sama, baris yang sama, dan siklus hidup yang sama. Yang berbeda hanya aturan
 * transisinya, dan itu sudah tinggal di `document_transitions`.
 *
 * Total dihitung dengan `calculateDocument` yang sama dengan editor baris dan
 * dengan Penjualan. Rumus kedua untuk angka yang sama akan menyimpang, dan yang
 * menyimpang adalah angka pajak.
 */

export type PurchaseDocType = 'rfq' | 'purchase_order' | 'bill'

export interface PurchaseDraftLine {
  readonly itemId: string | null
  readonly warehouseId: string | null
  readonly description: string
  readonly qty: number
  readonly uom: string
  readonly unitPrice: number
  readonly discountPercent?: number
  readonly taxRatePercent: number
  readonly taxCodeId?: string | null
  /** Baris pesanan yang ditagih atau di-RFQ-kan. Wajib untuk tagihan barang. */
  readonly sourceLineId?: string | null
}

export interface CreatePurchaseDocumentInput {
  readonly companyId: string
  readonly docType: PurchaseDocType
  readonly vendorId: string
  readonly issueDate: Date
  readonly currency: string
  readonly sourceDocumentId?: string | null
  readonly documentDiscountAmount?: number
  readonly lines: readonly PurchaseDraftLine[]
  /** Dipakai pemisahan tugas: pembuat tagihan tidak boleh memaafkan selisihnya. */
  readonly createdBy: string
}

export interface PurchaseWritePort {
  insertDocument(document: {
    id: string
    companyId: string
    docType: PurchaseDocType
    vendorId: string
    issueDate: Date
    currency: string
    sourceDocumentId: string | null
    subtotal: number
    documentDiscount: number
    taxBase: number
    taxTotal: number
    total: number
    createdBy: string
  }): Promise<void>
  insertLines(
    documentId: string,
    companyId: string,
    lines: readonly (PurchaseDraftLine & {
      id: string
      lineNo: number
      netAmount: number
      taxAmount: number
    })[],
  ): Promise<void>
  submit(
    documentId: string,
    companyId: string,
    docType: PurchaseDocType,
    periodKey: string,
    by: string,
  ): Promise<string>
  approve(documentId: string, by: string): Promise<void>
  loadOrderLines(
    purchaseOrderId: string,
  ): Promise<{ companyId: string; vendorId: string; currency: string; lines: readonly OrderLineForReceipt[] } | null>
}

export type CreateResult =
  | { readonly kind: 'created'; readonly documentId: string; readonly total: number }
  | { readonly kind: 'exceeds_remaining'; readonly reasons: readonly string[] }
  | { readonly kind: 'unknown_line'; readonly sourceLineId: string }
  | { readonly kind: 'source_not_found' }
  | { readonly kind: 'source_required' }

/**
 * Pengaju tidak menyetujui dokumennya sendiri — D-009, berlaku sama di sini.
 */
export function canApprove(document: { submittedBy: string | null }, approver: string): boolean {
  return document.submittedBy !== approver
}

/** Awalan nomor per jenis dokumen. Nomor diberikan saat submit — D-007. */
export const AWALAN_NOMOR: Record<PurchaseDocType, string> = {
  rfq: 'rfq',
  purchase_order: 'po',
  bill: 'bil',
}

export class PurchaseDocumentService {
  constructor(
    private readonly writes: PurchaseWritePort,
    private readonly newId: () => string,
  ) {}

  async create(input: CreatePurchaseDocumentInput): Promise<CreateResult> {
    // ── Tagihan tidak dibuat dari udara ───────────────────────────────────
    //
    // Tagihan barang selalu menunjuk ke pesanan, karena tanpa pesanan tidak ada
    // yang dapat dicocokkan — dan pencocokan yang tidak dapat dijalankan adalah
    // pencocokan yang tidak ada.
    if (input.docType === 'bill' && input.lines.some((baris) => baris.itemId !== null)) {
      if (input.sourceDocumentId === undefined || input.sourceDocumentId === null) {
        return { kind: 'source_required' }
      }

      const pesanan = await this.writes.loadOrderLines(input.sourceDocumentId)
      if (pesanan === null) return { kind: 'source_not_found' }

      const putusan = evaluateConversion(
        pesanan.lines,
        input.lines
          .filter((baris) => baris.sourceLineId != null)
          .map((baris) => ({ sourceLineId: baris.sourceLineId as string, qty: baris.qty })),
        'invoice',
      )

      if (putusan.kind === 'unknown_line') {
        return { kind: 'unknown_line', sourceLineId: putusan.sourceLineId }
      }
      if (putusan.kind === 'exceeds_remaining') {
        return {
          kind: 'exceeds_remaining',
          reasons: putusan.lines.map(
            (baris) =>
              `Baris ${baris.lineNo}: ditagih ${baris.requested}, sisa pesanan ${baris.remaining}.`,
          ),
        }
      }
    }

    const hasil = calculateDocument({
      currency: input.currency,
      lines: input.lines.map((line, index) => ({
        id: String(index),
        quantity: line.qty,
        unitPrice: line.unitPrice,
        ...(line.discountPercent === undefined ? {} : { discountPercent: line.discountPercent }),
        taxRatePercent: line.taxRatePercent,
      })),
      ...(input.documentDiscountAmount === undefined
        ? {}
        : { documentDiscountAmount: input.documentDiscountAmount }),
    })

    const documentId = this.newId()
    await this.writes.insertDocument({
      id: documentId,
      companyId: input.companyId,
      docType: input.docType,
      vendorId: input.vendorId,
      issueDate: input.issueDate,
      currency: input.currency,
      sourceDocumentId: input.sourceDocumentId ?? null,
      subtotal: hasil.subtotal,
      documentDiscount: hasil.documentDiscount,
      taxBase: hasil.taxBase,
      taxTotal: hasil.taxTotal,
      total: hasil.total,
      createdBy: input.createdBy,
    })

    await this.writes.insertLines(
      documentId,
      input.companyId,
      input.lines.map((line, index) => ({
        ...line,
        id: this.newId(),
        lineNo: index + 1,
        netAmount: hasil.lines[index]?.taxBase ?? 0,
        taxAmount: hasil.lines[index]?.tax ?? 0,
      })),
    )

    return { kind: 'created', documentId, total: hasil.total }
  }

  async submit(
    documentId: string,
    companyId: string,
    docType: PurchaseDocType,
    periodKey: string,
    by: string,
  ): Promise<string> {
    return this.writes.submit(documentId, companyId, docType, periodKey, by)
  }

  async approve(documentId: string, by: string): Promise<void> {
    await this.writes.approve(documentId, by)
  }
}
