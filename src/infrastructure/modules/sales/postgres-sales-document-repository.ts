import type { DraftLine, SalesWritePort } from '#application/sales/documents'
import type {
  PostingDocument,
  PostingLine,
  SalesDocumentPort,
} from '#application/sales/posting'
import type { LifecycleStatus, Transition } from '#domain/sales/transitions'
import type { Queryable } from '#infrastructure/db/queryable'

export class PostgresSalesDocumentRepository implements SalesDocumentPort, SalesWritePort {
  constructor(
    private readonly db: Queryable,
    private readonly tenantId: string,
  ) {}

  /** Mengunci dokumen: posting tidak boleh berjalan dua kali bersamaan. */
  async loadForPosting(documentId: string): Promise<PostingDocument | null> {
    const { rows } = await this.db.query<{
      id: string
      company_id: string
      customer_id: string
      lifecycle_status: LifecycleStatus
      document_version: number
      number: string | null
      currency: string
      total: string
      tax_total: string
      document_date: Date
    }>(
      `SELECT id, company_id, customer_id, lifecycle_status, document_version, number,
              currency, total, tax_total, document_date
         FROM sales_documents
        WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
          FOR UPDATE`,
      [this.tenantId, documentId],
    )

    const row = rows[0]
    if (row === undefined) return null

    const { rows: baris } = await this.db.query<{
      id: string
      item_id: string | null
      warehouse_id: string | null
      qty: string
      net_amount: string
      tax_amount: string
      tax_code_id: string | null
      category_id: string | null
    }>(
      `SELECT l.id, l.item_id, l.warehouse_id, l.qty, l.net_amount, l.tax_amount,
              l.tax_code_id, i.category_id
         FROM sales_document_lines l
         LEFT JOIN items i ON i.tenant_id = l.tenant_id AND i.id = l.item_id
        WHERE l.tenant_id = $1 AND l.document_id = $2
        ORDER BY l.line_no`,
      [this.tenantId, documentId],
    )

    const lines: PostingLine[] = baris.map((item) => ({
      id: item.id,
      itemId: item.item_id,
      warehouseId: item.warehouse_id,
      qty: Number(item.qty),
      netAmount: Number(item.net_amount),
      taxAmount: Number(item.tax_amount),
      itemCategoryId: item.category_id,
      taxCodeId: item.tax_code_id,
    }))

    const tanggal = row.document_date
    return {
      id: row.id,
      companyId: row.company_id,
      customerId: row.customer_id,
      lifecycleStatus: row.lifecycle_status,
      documentVersion: row.document_version,
      number: row.number,
      currency: row.currency,
      fiscalYear: tanggal.getFullYear(),
      fiscalPeriod: tanggal.getMonth() + 1,
      total: Number(row.total),
      taxTotal: Number(row.tax_total),
      lines,
    }
  }

  async listTransitions(): Promise<readonly Transition[]> {
    const { rows } = await this.db.query<{
      doc_type: Transition['docType']
      from_status: LifecycleStatus
      to_status: LifecycleStatus
      requires: string[]
    }>('SELECT doc_type, from_status, to_status, requires FROM document_transitions')

    return rows.map((row) => ({
      docType: row.doc_type,
      from: row.from_status,
      to: row.to_status,
      requires: row.requires,
    }))
  }

  /**
   * `fiscal_periods` belum dibangun — tutup periode adalah Sesi D1 lanjutan.
   * Sampai ia ada, seluruh periode dianggap terbuka, dan itu dinyatakan di
   * sini alih-alih disembunyikan sebagai `true` tanpa keterangan.
   */
  async isFiscalPeriodOpen(): Promise<boolean> {
    return true
  }

  async insertDocument(document: Parameters<SalesWritePort['insertDocument']>[0]): Promise<void> {
    await this.db.query(
      `INSERT INTO sales_documents
         (id, tenant_id, company_id, doc_type, customer_id, document_date, currency,
          subtotal, document_discount, tax_base, tax_total, total)
       VALUES ($1, $2, $3, 'invoice', $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        document.id,
        this.tenantId,
        document.companyId,
        document.customerId,
        document.documentDate,
        document.currency,
        document.subtotal,
        document.documentDiscount,
        document.taxBase,
        document.taxTotal,
        document.total,
      ],
    )
  }

  async insertLines(
    documentId: string,
    companyId: string,
    lines: readonly (DraftLine & {
      id: string
      lineNo: number
      netAmount: number
      taxAmount: number
      allocatedDocDiscount: number
    })[],
  ): Promise<void> {
    for (const line of lines) {
      await this.db.query(
        `INSERT INTO sales_document_lines
           (id, tenant_id, company_id, document_id, line_no, item_id, description, qty, uom,
            unit_price, discount_pct, allocated_doc_discount, net_amount, tax_code_id,
            tax_rate_pct, tax_amount, warehouse_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          line.id,
          this.tenantId,
          companyId,
          documentId,
          line.lineNo,
          line.itemId,
          line.description,
          line.qty,
          line.uom,
          line.unitPrice,
          line.discountPercent ?? 0,
          line.allocatedDocDiscount,
          line.netAmount,
          line.taxCodeId ?? null,
          line.taxRatePercent,
          line.taxAmount,
          line.warehouseId,
        ],
      )
    }
  }

  /** Nomor diambil dan status berpindah dalam satu langkah — D-007. */
  async submit(
    documentId: string,
    companyId: string,
    periodKey: string,
    by: string,
  ): Promise<string> {
    const { rows } = await this.db.query<{ nomor: string }>(
      'SELECT paadu.next_document_number($1, $2, $3) AS nomor',
      [companyId, 'inv', periodKey],
    )
    const nomor = rows[0]!.nomor

    await this.db.query(
      `UPDATE sales_documents
          SET number = $3, lifecycle_status = 'submitted', submitted_at = now(), submitted_by = $4
        WHERE tenant_id = $1 AND id = $2`,
      [this.tenantId, documentId, nomor, by],
    )
    return nomor
  }

  async approve(documentId: string, by: string): Promise<void> {
    await this.db.query(
      `UPDATE sales_documents
          SET lifecycle_status = 'approved', approved_at = now(), approved_by = $3
        WHERE tenant_id = $1 AND id = $2`,
      [this.tenantId, documentId, by],
    )
  }

  async markPosted(documentId: string, postedBy: string, at: Date): Promise<void> {
    await this.db.query(
      `UPDATE sales_documents
          SET lifecycle_status = 'posted', posted_at = $3, posted_by = $4
        WHERE tenant_id = $1 AND id = $2`,
      [this.tenantId, documentId, at, postedBy],
    )
  }
}
