import type {
  PostingDocument,
  PostingLine,
  SalesDocumentPort,
} from '#application/sales/posting'
import type { LifecycleStatus, Transition } from '#domain/sales/transitions'
import type { Queryable } from '#infrastructure/db/queryable'

export class PostgresSalesDocumentRepository implements SalesDocumentPort {
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

  async markPosted(documentId: string, postedBy: string, at: Date): Promise<void> {
    await this.db.query(
      `UPDATE sales_documents
          SET lifecycle_status = 'posted', posted_at = $3, posted_by = $4
        WHERE tenant_id = $1 AND id = $2`,
      [this.tenantId, documentId, at, postedBy],
    )
  }
}
