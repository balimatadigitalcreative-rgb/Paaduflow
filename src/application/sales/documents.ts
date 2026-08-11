import { calculateDocument } from '#shared/line-items'

/**
 * Pembuatan dan pengajuan dokumen penjualan.
 *
 * Total dokumen dihitung dengan urutan delapan langkah yang sama dengan editor
 * baris (Sesi C3) — bukan dengan rumus kedua di sisi server. Dua rumus untuk
 * angka yang sama akan menyimpang, dan yang menyimpang adalah angka pajak.
 */

export interface DraftLine {
  readonly itemId: string | null
  readonly warehouseId: string | null
  readonly description: string
  readonly qty: number
  readonly uom: string
  readonly unitPrice: number
  readonly discountPercent?: number
  readonly taxRatePercent: number
  readonly taxCodeId?: string | null
}

export interface CreateInvoiceInput {
  readonly companyId: string
  readonly customerId: string
  readonly documentDate: Date
  readonly currency: string
  readonly documentDiscountAmount?: number
  readonly lines: readonly DraftLine[]
}

export interface SalesWritePort {
  insertDocument(document: {
    id: string
    companyId: string
    docType: 'invoice'
    customerId: string
    documentDate: Date
    currency: string
    subtotal: number
    documentDiscount: number
    taxBase: number
    taxTotal: number
    total: number
  }): Promise<void>
  insertLines(
    documentId: string,
    companyId: string,
    lines: readonly (DraftLine & {
      id: string
      lineNo: number
      netAmount: number
      taxAmount: number
      allocatedDocDiscount: number
    })[],
  ): Promise<void>
  /** Mengambil nomor dan memindahkan status. Nomor diberikan saat submit — D-007. */
  submit(documentId: string, companyId: string, periodKey: string, by: string): Promise<string>
  approve(documentId: string, by: string): Promise<void>
}

export class SalesDocumentService {
  constructor(
    private readonly writes: SalesWritePort,
    private readonly newId: () => string,
  ) {}

  async createInvoice(input: CreateInvoiceInput): Promise<{ documentId: string; total: number }> {
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
      docType: 'invoice',
      customerId: input.customerId,
      documentDate: input.documentDate,
      currency: input.currency,
      subtotal: hasil.subtotal,
      documentDiscount: hasil.documentDiscount,
      taxBase: hasil.taxBase,
      taxTotal: hasil.taxTotal,
      total: hasil.total,
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
        allocatedDocDiscount: hasil.lines[index]?.allocatedDocumentDiscount ?? 0,
      })),
    )

    return { documentId, total: hasil.total }
  }

  async submit(
    documentId: string,
    companyId: string,
    periodKey: string,
    by: string,
  ): Promise<string> {
    return this.writes.submit(documentId, companyId, periodKey, by)
  }

  async approve(documentId: string, by: string): Promise<void> {
    await this.writes.approve(documentId, by)
  }
}
