import type {
  PurchaseDocType,
  PurchaseDraftLine,
  PurchaseWritePort,
} from '#application/purchasing/documents'
import type {
  BillSnapshot,
  PurchaseDocumentPort,
  PurchaseLineSnapshot,
} from '#application/purchasing/ports'
import type { OrderLineForReceipt, ReceiptWritePort } from '#application/purchasing/receipts'
import type { MatchStatus, MatchTolerance } from '#domain/purchasing/three-way-match'
import { NO_TOLERANCE } from '#domain/purchasing/three-way-match'
import type { Queryable } from '#infrastructure/db/queryable'
import type { LifecycleStatus, Transition } from '#shared/document-lifecycle'

/**
 * Repository Pembelian.
 *
 * Satu kelas untuk ketiga port karena ketiganya berbicara ke tabel yang sama
 * dalam transaksi yang sama; memisahkannya hanya menambah tiga konstruktor yang
 * menerima argumen identik.
 */

const AWALAN: Record<PurchaseDocType, string> = {
  rfq: 'rfq',
  purchase_order: 'po',
  bill: 'bil',
}

interface BarisTagihan {
  id: string
  line_no: number
  description: string
  qty_billed: string
  billed_unit_price: string
  qty_ordered: string
  qty_received: string
  qty_billed_before: string
  ordered_unit_price: string
  item_id: string | null
  warehouse_id: string | null
  tax_code_id: string | null
  category_id: string | null
  net_amount: string
  tax_amount: string
  source_line_id: string | null
}

export class PostgresPurchaseRepository
  implements PurchaseDocumentPort, PurchaseWritePort, ReceiptWritePort
{
  constructor(
    private readonly db: Queryable,
    private readonly tenantId: string,
  ) {}

  // ── PurchaseDocumentPort ────────────────────────────────────────────────

  async loadBillForPosting(billId: string): Promise<BillSnapshot | null> {
    const { rows } = await this.db.query<{
      id: string
      company_id: string
      vendor_id: string
      number: string | null
      lifecycle_status: LifecycleStatus
      match_status: MatchStatus
      document_version: number
      currency: string
      issue_date: Date
      total: string
      tax_total: string
      created_by: string | null
      submitted_by: string | null
      override_by: string | null
    }>(
      `SELECT id, company_id, vendor_id, number, lifecycle_status, match_status,
              document_version, currency, issue_date, total, tax_total,
              created_by, submitted_by, override_by
         FROM purchase_documents
        WHERE tenant_id = $1 AND id = $2 AND doc_type = 'bill' AND deleted_at IS NULL
          FOR UPDATE`,
      [this.tenantId, billId],
    )

    const row = rows[0]
    if (row === undefined) return null

    // Baris tagihan dijodohkan dengan baris pesanan yang ditagihnya. Baris jasa
    // tidak punya pasangan; COALESCE membuatnya membandingkan dirinya dengan
    // dirinya sendiri, sehingga ia tidak pernah menjadi selisih — tidak ada
    // penerimaan fisik yang dapat dicocokkan dengan jasa.
    const { rows: baris } = await this.db.query<BarisTagihan>(
      `SELECT bl.id, bl.line_no, bl.description,
              bl.qty                                   AS qty_billed,
              bl.unit_price                            AS billed_unit_price,
              COALESCE(pl.qty, bl.qty)                 AS qty_ordered,
              COALESCE(pl.qty_received, bl.qty)        AS qty_received,
              COALESCE(pl.qty_billed, 0)               AS qty_billed_before,
              COALESCE(pl.unit_price, bl.unit_price)   AS ordered_unit_price,
              bl.item_id, bl.warehouse_id, bl.tax_code_id, bl.net_amount, bl.tax_amount,
              bl.source_line_id, i.category_id
         FROM purchase_document_lines bl
         LEFT JOIN purchase_document_lines pl
                ON pl.tenant_id = bl.tenant_id AND pl.id = bl.source_line_id
         LEFT JOIN items i ON i.tenant_id = bl.tenant_id AND i.id = bl.item_id
        WHERE bl.tenant_id = $1 AND bl.document_id = $2
        ORDER BY bl.line_no`,
      [this.tenantId, billId],
    )

    const lines: PurchaseLineSnapshot[] = baris.map((item) => ({
      id: item.id,
      lineNo: item.line_no,
      description: item.description,
      qtyOrdered: Number(item.qty_ordered),
      qtyReceived: Number(item.qty_received),
      qtyBilledBefore: Number(item.qty_billed_before),
      qtyBilled: Number(item.qty_billed),
      orderedUnitPrice: Number(item.ordered_unit_price),
      billedUnitPrice: Number(item.billed_unit_price),
      sourceLineId: item.source_line_id,
      itemId: item.item_id,
      warehouseId: item.warehouse_id,
      itemCategoryId: item.category_id,
      taxCodeId: item.tax_code_id,
      netAmount: Number(item.net_amount),
      taxAmount: Number(item.tax_amount),
    }))

    const tanggal = row.issue_date
    return {
      id: row.id,
      companyId: row.company_id,
      vendorId: row.vendor_id,
      number: row.number,
      lifecycleStatus: row.lifecycle_status,
      matchStatus: row.match_status,
      documentVersion: row.document_version,
      currency: row.currency,
      issueDate: tanggal,
      fiscalYear: tanggal.getFullYear(),
      fiscalPeriod: tanggal.getMonth() + 1,
      total: Number(row.total),
      taxTotal: Number(row.tax_total),
      createdBy: row.created_by,
      submittedBy: row.submitted_by,
      overrideBy: row.override_by,
      lines,
    }
  }

  async loadTolerance(companyId: string): Promise<MatchTolerance> {
    const { rows } = await this.db.query<{
      qty_over_receipt_pct: string
      price_variance_pct: string
      price_variance_amount: string
    }>(
      `SELECT qty_over_receipt_pct, price_variance_pct, price_variance_amount
         FROM match_tolerances WHERE tenant_id = $1 AND company_id = $2`,
      [this.tenantId, companyId],
    )

    const row = rows[0]
    // Company yang belum menyetel toleransi memakai nol, bukan angka bawaan
    // yang murah hati. Toleransi adalah keputusan, dan keputusan yang tidak
    // pernah diambil tidak boleh diam-diam diambilkan.
    if (row === undefined) return NO_TOLERANCE

    return {
      qtyOverReceiptPercent: Number(row.qty_over_receipt_pct),
      priceVariancePercent: Number(row.price_variance_pct),
      priceVarianceAmount: Number(row.price_variance_amount),
    }
  }

  async listTransitions(): Promise<readonly Transition[]> {
    const { rows } = await this.db.query<{
      doc_type: string
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

  /** Sama dengan Penjualan: `fiscal_periods` belum ada — D-110. */
  async isFiscalPeriodOpen(): Promise<boolean> {
    return true
  }

  async setMatchStatus(billId: string, status: MatchStatus): Promise<void> {
    await this.db.query(
      `UPDATE purchase_documents SET match_status = $3
        WHERE tenant_id = $1 AND id = $2 AND lifecycle_status <> 'posted'`,
      [this.tenantId, billId, status],
    )
  }

  async recordOverride(billId: string, by: string, reason: string, at: Date): Promise<void> {
    await this.db.query(
      `UPDATE purchase_documents
          SET match_status = 'overridden', override_by = $3, override_reason = $4, override_at = $5
        WHERE tenant_id = $1 AND id = $2 AND lifecycle_status <> 'posted'`,
      [this.tenantId, billId, by, reason, at],
    )
  }

  async applyBilledQuantities(
    lines: readonly { sourceLineId: string; qty: number }[],
  ): Promise<void> {
    for (const baris of lines) {
      // CHECK `qty_billed <= qty_received` yang menjaga baris ini. Kalau layanan
      // pernah keliru meloloskan tagihan atas barang yang belum datang, basis
      // data yang menolaknya — dan transaksi posting ikut batal seluruhnya.
      await this.db.query(
        `UPDATE purchase_document_lines SET qty_billed = qty_billed + $3
          WHERE tenant_id = $1 AND id = $2`,
        [this.tenantId, baris.sourceLineId, baris.qty],
      )
    }
  }

  async markPosted(billId: string, postedBy: string, at: Date): Promise<void> {
    await this.db.query(
      `UPDATE purchase_documents
          SET lifecycle_status = 'posted', posted_at = $3, posted_by = $4
        WHERE tenant_id = $1 AND id = $2`,
      [this.tenantId, billId, at, postedBy],
    )
  }

  // ── PurchaseWritePort ───────────────────────────────────────────────────

  async insertDocument(document: Parameters<PurchaseWritePort['insertDocument']>[0]): Promise<void> {
    await this.db.query(
      `INSERT INTO purchase_documents
         (id, tenant_id, company_id, doc_type, vendor_id, issue_date, currency,
          source_document_id, subtotal, document_discount, tax_base, tax_total, total, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        document.id,
        this.tenantId,
        document.companyId,
        document.docType,
        document.vendorId,
        document.issueDate,
        document.currency,
        document.sourceDocumentId,
        document.subtotal,
        document.documentDiscount,
        document.taxBase,
        document.taxTotal,
        document.total,
        document.createdBy,
      ],
    )
  }

  async insertLines(
    documentId: string,
    companyId: string,
    lines: readonly (PurchaseDraftLine & {
      id: string
      lineNo: number
      netAmount: number
      taxAmount: number
    })[],
  ): Promise<void> {
    for (const line of lines) {
      await this.db.query(
        `INSERT INTO purchase_document_lines
           (id, tenant_id, company_id, document_id, line_no, item_id, description, qty, uom,
            unit_price, discount_pct, net_amount, tax_code_id, tax_rate_pct, tax_amount,
            warehouse_id, source_line_id)
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
          line.netAmount,
          line.taxCodeId ?? null,
          line.taxRatePercent,
          line.taxAmount,
          line.warehouseId,
          line.sourceLineId ?? null,
        ],
      )
    }
  }

  async submit(
    documentId: string,
    companyId: string,
    docType: PurchaseDocType,
    periodKey: string,
    by: string,
  ): Promise<string> {
    const { rows } = await this.db.query<{ nomor: string }>(
      'SELECT paadu.next_document_number($1, $2, $3) AS nomor',
      [companyId, AWALAN[docType], periodKey],
    )
    const nomor = rows[0]!.nomor

    await this.db.query(
      `UPDATE purchase_documents
          SET number = $3, lifecycle_status = 'submitted', submitted_at = now(), submitted_by = $4
        WHERE tenant_id = $1 AND id = $2`,
      [this.tenantId, documentId, nomor, by],
    )
    return nomor
  }

  async approve(documentId: string, by: string): Promise<void> {
    await this.db.query(
      `UPDATE purchase_documents
          SET lifecycle_status = 'approved', approved_at = now(), approved_by = $3
        WHERE tenant_id = $1 AND id = $2`,
      [this.tenantId, documentId, by],
    )
  }

  // ── ReceiptWritePort ────────────────────────────────────────────────────

  async loadOrderLines(purchaseOrderId: string): Promise<{
    companyId: string
    vendorId: string
    currency: string
    lifecycleStatus: string
    lines: readonly OrderLineForReceipt[]
  } | null> {
    const { rows } = await this.db.query<{
      company_id: string
      vendor_id: string
      currency: string
      lifecycle_status: string
    }>(
      `SELECT company_id, vendor_id, currency, lifecycle_status
         FROM purchase_documents
        WHERE tenant_id = $1 AND id = $2 AND doc_type = 'purchase_order' AND deleted_at IS NULL
          FOR UPDATE`,
      [this.tenantId, purchaseOrderId],
    )

    const row = rows[0]
    if (row === undefined) return null

    const { rows: baris } = await this.db.query<{
      id: string
      line_no: number
      qty: string
      qty_received: string
      qty_billed: string
      unit_price: string
      item_id: string | null
      warehouse_id: string | null
      category_id: string | null
    }>(
      `SELECT l.id, l.line_no, l.qty, l.qty_received, l.qty_billed, l.unit_price,
              l.item_id, l.warehouse_id, i.category_id
         FROM purchase_document_lines l
         LEFT JOIN items i ON i.tenant_id = l.tenant_id AND i.id = l.item_id
        WHERE l.tenant_id = $1 AND l.document_id = $2
        ORDER BY l.line_no`,
      [this.tenantId, purchaseOrderId],
    )

    return {
      companyId: row.company_id,
      vendorId: row.vendor_id,
      currency: row.currency,
      lifecycleStatus: row.lifecycle_status,
      lines: baris.map((item) => ({
        id: item.id,
        lineNo: item.line_no,
        qty: Number(item.qty),
        // Mesin konversi memakai dua sumbu: `invoice` untuk yang sudah ditagih,
        // `delivery` untuk yang sudah bergerak fisik. Di Pembelian keduanya
        // berarti ditagih dan diterima.
        qtyInvoiced: Number(item.qty_billed),
        qtyDelivered: Number(item.qty_received),
        unitPrice: Number(item.unit_price),
        itemId: item.item_id,
        warehouseId: item.warehouse_id,
        itemCategoryId: item.category_id,
      })),
    }
  }

  async insertReceipt(receipt: Parameters<ReceiptWritePort['insertReceipt']>[0]): Promise<string> {
    const { rows } = await this.db.query<{ nomor: string }>(
      'SELECT paadu.next_document_number($1, $2, $3) AS nomor',
      [
        receipt.companyId,
        'grn',
        `${receipt.receivedDate.getFullYear()}-${String(receipt.receivedDate.getMonth() + 1).padStart(2, '0')}`,
      ],
    )

    await this.db.query(
      `INSERT INTO goods_receipts
         (id, tenant_id, company_id, number, purchase_order_id, vendor_id, warehouse_id,
          received_date, received_by, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
      [
        receipt.id,
        this.tenantId,
        receipt.companyId,
        rows[0]!.nomor,
        receipt.purchaseOrderId,
        receipt.vendorId,
        receipt.warehouseId,
        receipt.receivedDate,
        receipt.receivedBy,
      ],
    )
    return receipt.id
  }

  async insertReceiptLines(
    receiptId: string,
    lines: Parameters<ReceiptWritePort['insertReceiptLines']>[1],
  ): Promise<void> {
    for (const line of lines) {
      await this.db.query(
        `INSERT INTO goods_receipt_lines
           (id, tenant_id, receipt_id, po_line_id, item_id, qty_received, qty_rejected,
            rejection_reason, unit_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          line.id,
          this.tenantId,
          receiptId,
          line.poLineId,
          line.itemId,
          line.qtyReceived,
          line.qtyRejected,
          line.rejectionReason,
          line.unitCost,
        ],
      )
    }
  }

  async applyReceivedQuantities(lines: readonly { poLineId: string; qty: number }[]): Promise<void> {
    for (const baris of lines) {
      await this.db.query(
        `UPDATE purchase_document_lines SET qty_received = qty_received + $3
          WHERE tenant_id = $1 AND id = $2`,
        [this.tenantId, baris.poLineId, baris.qty],
      )
    }
  }

  async markReceiptPosted(receiptId: string, at: Date): Promise<void> {
    await this.db.query(
      `UPDATE goods_receipts SET status = 'posted', posted_at = $3
        WHERE tenant_id = $1 AND id = $2`,
      [this.tenantId, receiptId, at],
    )
  }
}
