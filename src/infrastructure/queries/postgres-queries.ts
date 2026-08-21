import type {
  DashboardQueryPort,
  DashboardSummary,
  ProfitLossQueryPort,
  ProfitLossReport,
  ProfitLossRow,
  AccountingQueryPort,
  AccountSummary,
  AccessibleCompany,
  CompanyDirectoryPort,
  GoodsReceiptSummary,
  ItemOption,
  LedgerEntry,
  MasterDataPort,
  FakturLayakPajak,
  InputTaxInvoiceSummary,
  MatchPanel,
  OutputTaxInvoiceDetail,
  OutputTaxInvoiceSummary,
  PartnerOption,
  Page,
  PageRequest,
  PurchaseDocumentDetail,
  PurchaseDocumentSummary,
  PurchaseQueryPort,
  SalesDocumentDetail,
  SalesDocumentSummary,
  SalesQueryPort,
  TaxCodeVersion,
  TaxQueryPort,
  WarehouseOption,
} from '#application/queries'
import { explainVariance, matchThreeWay, NO_TOLERANCE } from '#domain/purchasing/three-way-match'
import type { Queryable } from '#infrastructure/db/queryable'

/**
 * Jalur baca untuk layar.
 *
 * Tiga hal yang berlaku di seluruh berkas ini:
 *
 * 1. **Kursor, bukan offset** (D-024). Id dokumen adalah UUIDv7, yang terurut
 *    menurut waktu, sehingga `id < $cursor` sudah merupakan kursor yang benar
 *    tanpa kolom tambahan. Halaman berikutnya tidak bergeser saat baris baru
 *    lahir di depan.
 * 2. **Satu baris lebih diambil daripada yang diminta** untuk mengetahui apakah
 *    ada halaman berikutnya, tanpa `COUNT(*)` kedua atas seluruh tabel.
 * 3. **Tanggal keluar sebagai teks** `YYYY-MM-DD` — alasan yang sama dengan
 *    D-130: kolom `date` tidak punya zona waktu, dan membungkusnya jadi `Date`
 *    menggeser tanggalnya satu hari di server yang bukan UTC.
 */

const BATAS_BAWAAN = 50

function batas(page: PageRequest): number {
  return Math.min(Math.max(page.limit ?? BATAS_BAWAAN, 1), 200)
}

function halaman<T extends { id: string }>(rows: readonly T[], limit: number): Page<T> {
  const adaLagi = rows.length > limit
  const items = adaLagi ? rows.slice(0, limit) : rows
  return { items, nextCursor: adaLagi ? (items[items.length - 1]?.id ?? null) : null }
}

function tanggal(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 10)
  if (value instanceof Date) {
    const bulan = String(value.getMonth() + 1).padStart(2, '0')
    const hari = String(value.getDate()).padStart(2, '0')
    return `${value.getFullYear()}-${bulan}-${hari}`
  }
  return ''
}

// ── Direktori company ──────────────────────────────────────────────────────

export class PostgresCompanyDirectory implements CompanyDirectoryPort {
  constructor(private readonly db: Queryable) {}

  /**
   * Berjalan tanpa konteks tenant, karena tenant-nya justru yang dicari.
   *
   * Kebijakan RLS `company_access` mengizinkan pengguna membaca barisnya
   * sendiri untuk keperluan ini (D-064). `companies` dan `tenants` menuntut
   * kebijakannya SENDIRI — `bootstrap_akses_sendiri` di 0024 — karena RLS
   * dievaluasi per tabel dan tidak menular lewat join.
   *
   * Komentar di sini pernah menyatakan sebaliknya, dan kekeliruan itulah yang
   * membuat endpoint ini menjawab 200 dengan daftar kosong di produksi selama
   * pengujian lokal terus hijau. Setiap tabel yang ditambahkan ke join di bawah
   * harus dapat dibaca tanpa `app.tenant_id`, atau seluruh hasilnya kosong.
   */
  async listForUser(userId: string): Promise<readonly AccessibleCompany[]> {
    const { rows } = await this.db.query<{
      id: string
      tenant_id: string
      tenant_name: string
      legal_name: string
      slug: string
      fiscal_year_start_month: number
      role_key: string
    }>(
      `SELECT c.id, c.tenant_id, t.name AS tenant_name, c.legal_name, c.slug,
              c.fiscal_year_start_month, r.key AS role_key
         FROM company_access ca
         JOIN companies c ON c.tenant_id = ca.tenant_id AND c.id = ca.company_id
         JOIN tenants t ON t.id = ca.tenant_id
         JOIN roles r ON r.id = ca.role_id
        WHERE ca.user_id = $1 AND c.deleted_at IS NULL
        ORDER BY t.name, c.legal_name`,
      [userId],
    )

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      legalName: row.legal_name,
      slug: row.slug,
      fiscalYearStartMonth: row.fiscal_year_start_month,
      roleKey: row.role_key,
    }))
  }
}

// ── Data induk ─────────────────────────────────────────────────────────────

export class PostgresMasterData implements MasterDataPort {
  constructor(
    private readonly db: Queryable,
    private readonly tenantId: string,
  ) {}

  async customers(companyId: string): Promise<readonly PartnerOption[]> {
    const { rows } = await this.db.query<{ id: string; code: string; name: string; tax_id: string | null }>(
      `SELECT id, code, name, tax_id FROM customers
        WHERE tenant_id = $1 AND company_id = $2 AND deleted_at IS NULL AND status = 'active'
        ORDER BY name`,
      [this.tenantId, companyId],
    )
    return rows.map((row) => ({ id: row.id, code: row.code, name: row.name, taxId: row.tax_id }))
  }

  async vendors(companyId: string): Promise<readonly PartnerOption[]> {
    const { rows } = await this.db.query<{
      id: string
      code: string
      name: string
      tax_id: string | null
      is_pkp: boolean
    }>(
      `SELECT id, code, name, tax_id, is_pkp FROM vendors
        WHERE tenant_id = $1 AND company_id = $2 AND deleted_at IS NULL AND status = 'active'
        ORDER BY name`,
      [this.tenantId, companyId],
    )
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      taxId: row.tax_id,
      isPkp: row.is_pkp,
    }))
  }

  async items(companyId: string): Promise<readonly ItemOption[]> {
    const { rows } = await this.db.query<{
      id: string
      code: string
      name: string
      type: string
      base_uom: string
    }>(
      `SELECT id, code, name, type::text, base_uom FROM items
        WHERE tenant_id = $1 AND company_id = $2 AND deleted_at IS NULL AND status = 'active'
        ORDER BY code`,
      [this.tenantId, companyId],
    )
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      baseUom: row.base_uom,
    }))
  }

  async warehouses(companyId: string): Promise<readonly WarehouseOption[]> {
    const { rows } = await this.db.query<{ id: string; code: string; name: string }>(
      `SELECT id, code, name FROM warehouses
        WHERE tenant_id = $1 AND company_id = $2 AND deleted_at IS NULL AND status = 'active'
        ORDER BY code`,
      [this.tenantId, companyId],
    )
    return rows
  }
}

// ── Penjualan ──────────────────────────────────────────────────────────────

export class PostgresSalesQueries implements SalesQueryPort {
  constructor(
    private readonly db: Queryable,
    private readonly tenantId: string,
  ) {}

  async list(companyId: string, page: PageRequest): Promise<Page<SalesDocumentSummary>> {
    const limit = batas(page)
    const { rows } = await this.db.query<{
      id: string
      number: string | null
      doc_type: string
      customer_name: string
      document_date: unknown
      currency: string
      total: string
      lifecycle_status: string
      settlement_status: string
      fulfillment_status: string
    }>(
      `SELECT d.id, d.number, d.doc_type::text, c.name AS customer_name, d.document_date,
              d.currency, d.total, d.lifecycle_status::text, d.settlement_status::text,
              d.fulfillment_status::text
         FROM sales_documents d
         JOIN customers c ON c.tenant_id = d.tenant_id AND c.id = d.customer_id
        WHERE d.tenant_id = $1 AND d.company_id = $2 AND d.deleted_at IS NULL
          AND ($3::uuid IS NULL OR d.id < $3::uuid)
        ORDER BY d.id DESC
        LIMIT $4`,
      [this.tenantId, companyId, page.cursor ?? null, limit + 1],
    )

    return halaman(
      rows.map((row) => ({
        id: row.id,
        number: row.number,
        docType: row.doc_type,
        customerName: row.customer_name,
        documentDate: tanggal(row.document_date),
        currency: row.currency,
        total: Number(row.total),
        lifecycleStatus: row.lifecycle_status,
        settlementStatus: row.settlement_status,
        fulfillmentStatus: row.fulfillment_status,
      })),
      limit,
    )
  }

  async detail(companyId: string, documentId: string): Promise<SalesDocumentDetail | null> {
    const { rows } = await this.db.query<{
      id: string
      number: string | null
      doc_type: string
      customer_id: string
      customer_name: string
      document_date: unknown
      currency: string
      subtotal: string
      document_discount: string
      tax_base: string
      tax_total: string
      total: string
      lifecycle_status: string
      settlement_status: string
      fulfillment_status: string
      document_version: number
      posted_at: Date | null
      journal_id: string | null
    }>(
      `SELECT d.id, d.number, d.doc_type::text, d.customer_id, c.name AS customer_name,
              d.document_date, d.currency, d.subtotal, d.document_discount, d.tax_base,
              d.tax_total, d.total, d.lifecycle_status::text, d.settlement_status::text,
              d.fulfillment_status::text, d.document_version, d.posted_at,
              (SELECT j.id FROM journals j
                WHERE j.tenant_id = d.tenant_id
                  AND j.source_type = 'sales_document' AND j.source_id = d.id
                ORDER BY j.created_at LIMIT 1) AS journal_id
         FROM sales_documents d
         JOIN customers c ON c.tenant_id = d.tenant_id AND c.id = d.customer_id
        WHERE d.tenant_id = $1 AND d.company_id = $2 AND d.id = $3 AND d.deleted_at IS NULL`,
      [this.tenantId, companyId, documentId],
    )

    const row = rows[0]
    if (row === undefined) return null

    const { rows: baris } = await this.db.query<{
      id: string
      line_no: number
      item_code: string | null
      description: string
      qty: string
      uom: string
      unit_price: string
      discount_pct: string
      net_amount: string
      tax_rate_pct: string
      tax_amount: string
      warehouse_id: string | null
    }>(
      `SELECT l.id, l.line_no, i.code AS item_code, l.description, l.qty, l.uom,
              l.unit_price, l.discount_pct, l.net_amount, l.tax_rate_pct, l.tax_amount,
              l.warehouse_id
         FROM sales_document_lines l
         LEFT JOIN items i ON i.tenant_id = l.tenant_id AND i.id = l.item_id
        WHERE l.tenant_id = $1 AND l.document_id = $2
        ORDER BY l.line_no`,
      [this.tenantId, documentId],
    )

    return {
      id: row.id,
      number: row.number,
      docType: row.doc_type,
      customerId: row.customer_id,
      customerName: row.customer_name,
      documentDate: tanggal(row.document_date),
      currency: row.currency,
      subtotal: Number(row.subtotal),
      documentDiscount: Number(row.document_discount),
      taxBase: Number(row.tax_base),
      taxTotal: Number(row.tax_total),
      total: Number(row.total),
      lifecycleStatus: row.lifecycle_status,
      settlementStatus: row.settlement_status,
      fulfillmentStatus: row.fulfillment_status,
      documentVersion: row.document_version,
      postedAt: row.posted_at === null ? null : row.posted_at.toISOString(),
      journalId: row.journal_id,
      lines: baris.map((item) => ({
        id: item.id,
        lineNo: item.line_no,
        itemCode: item.item_code,
        description: item.description,
        qty: Number(item.qty),
        uom: item.uom,
        unitPrice: Number(item.unit_price),
        discountPercent: Number(item.discount_pct),
        netAmount: Number(item.net_amount),
        taxRatePercent: Number(item.tax_rate_pct),
        taxAmount: Number(item.tax_amount),
        warehouseId: item.warehouse_id,
      })),
    }
  }
}

// ── Pembelian ──────────────────────────────────────────────────────────────

export class PostgresPurchaseQueries implements PurchaseQueryPort {
  constructor(
    private readonly db: Queryable,
    private readonly tenantId: string,
  ) {}

  async list(
    companyId: string,
    docType: string | null,
    page: PageRequest,
  ): Promise<Page<PurchaseDocumentSummary>> {
    const limit = batas(page)
    const { rows } = await this.db.query<{
      id: string
      number: string | null
      doc_type: string
      vendor_name: string
      issue_date: unknown
      currency: string
      total: string
      lifecycle_status: string
      match_status: string
    }>(
      `SELECT d.id, d.number, d.doc_type::text, v.name AS vendor_name, d.issue_date,
              d.currency, d.total, d.lifecycle_status::text, d.match_status::text
         FROM purchase_documents d
         JOIN vendors v ON v.tenant_id = d.tenant_id AND v.id = d.vendor_id
        WHERE d.tenant_id = $1 AND d.company_id = $2 AND d.deleted_at IS NULL
          AND ($3::text IS NULL OR d.doc_type::text = $3::text)
          AND ($4::uuid IS NULL OR d.id < $4::uuid)
        ORDER BY d.id DESC
        LIMIT $5`,
      [this.tenantId, companyId, docType, page.cursor ?? null, limit + 1],
    )

    return halaman(
      rows.map((row) => ({
        id: row.id,
        number: row.number,
        docType: row.doc_type,
        vendorName: row.vendor_name,
        issueDate: tanggal(row.issue_date),
        currency: row.currency,
        total: Number(row.total),
        lifecycleStatus: row.lifecycle_status,
        matchStatus: row.match_status,
      })),
      limit,
    )
  }

  async detail(companyId: string, documentId: string): Promise<PurchaseDocumentDetail | null> {
    const { rows } = await this.db.query<{
      id: string
      number: string | null
      doc_type: string
      vendor_id: string
      vendor_name: string
      vendor_is_pkp: boolean
      issue_date: unknown
      currency: string
      subtotal: string
      tax_total: string
      total: string
      lifecycle_status: string
      match_status: string
      source_document_id: string | null
      override_reason: string | null
    }>(
      `SELECT d.id, d.number, d.doc_type::text, d.vendor_id, v.name AS vendor_name,
              v.is_pkp AS vendor_is_pkp, d.issue_date, d.currency, d.subtotal, d.tax_total,
              d.total, d.lifecycle_status::text, d.match_status::text, d.source_document_id,
              d.override_reason
         FROM purchase_documents d
         JOIN vendors v ON v.tenant_id = d.tenant_id AND v.id = d.vendor_id
        WHERE d.tenant_id = $1 AND d.company_id = $2 AND d.id = $3 AND d.deleted_at IS NULL`,
      [this.tenantId, companyId, documentId],
    )

    const row = rows[0]
    if (row === undefined) return null

    const { rows: baris } = await this.db.query<{
      id: string
      line_no: number
      item_id: string | null
      item_code: string | null
      description: string
      qty: string
      uom: string
      unit_price: string
      qty_received: string
      qty_billed: string
      net_amount: string
      tax_amount: string
    }>(
      `SELECT l.id, l.line_no, l.item_id, i.code AS item_code, l.description, l.qty, l.uom,
              l.unit_price, l.qty_received, l.qty_billed, l.net_amount, l.tax_amount
         FROM purchase_document_lines l
         LEFT JOIN items i ON i.tenant_id = l.tenant_id AND i.id = l.item_id
        WHERE l.tenant_id = $1 AND l.document_id = $2
        ORDER BY l.line_no`,
      [this.tenantId, documentId],
    )

    return {
      id: row.id,
      number: row.number,
      docType: row.doc_type,
      vendorId: row.vendor_id,
      vendorName: row.vendor_name,
      vendorIsPkp: row.vendor_is_pkp,
      issueDate: tanggal(row.issue_date),
      currency: row.currency,
      subtotal: Number(row.subtotal),
      taxTotal: Number(row.tax_total),
      total: Number(row.total),
      lifecycleStatus: row.lifecycle_status,
      matchStatus: row.match_status,
      sourceDocumentId: row.source_document_id,
      overrideReason: row.override_reason,
      lines: baris.map((item) => ({
        id: item.id,
        lineNo: item.line_no,
        itemId: item.item_id,
        itemCode: item.item_code,
        description: item.description,
        qty: Number(item.qty),
        uom: item.uom,
        unitPrice: Number(item.unit_price),
        qtyReceived: Number(item.qty_received),
        qtyBilled: Number(item.qty_billed),
        netAmount: Number(item.net_amount),
        taxAmount: Number(item.tax_amount),
      })),
    }
  }

  /**
   * Panel pencocokan: dipesan, diterima, dan ditagih berdampingan.
   *
   * Selisihnya dihitung dengan `matchThreeWay` yang sama dengan yang dipakai
   * posting — bukan dengan perbandingan kedua di sini. Panel yang memakai rumus
   * sendiri akan suatu hari menampilkan hijau pada tagihan yang ditolak
   * posting, dan orang akan percaya pada yang hijau.
   */
  async matchPanel(companyId: string, billId: string): Promise<MatchPanel | null> {
    const { rows } = await this.db.query<{
      id: string
      number: string | null
      lifecycle_status: string
      match_status: string
      override_reason: string | null
    }>(
      `SELECT id, number, lifecycle_status::text, match_status::text, override_reason
         FROM purchase_documents
        WHERE tenant_id = $1 AND company_id = $2 AND id = $3 AND doc_type = 'bill'
          AND deleted_at IS NULL`,
      [this.tenantId, companyId, billId],
    )

    const row = rows[0]
    if (row === undefined) return null

    const { rows: baris } = await this.db.query<{
      line_no: number
      description: string
      qty_billed: string
      billed_unit_price: string
      qty_ordered: string
      qty_received: string
      qty_billed_before: string
      ordered_unit_price: string
    }>(
      `SELECT bl.line_no, bl.description,
              bl.qty                                 AS qty_billed,
              bl.unit_price                          AS billed_unit_price,
              COALESCE(pl.qty, bl.qty)               AS qty_ordered,
              COALESCE(pl.qty_received, bl.qty)      AS qty_received,
              COALESCE(pl.qty_billed, 0)             AS qty_billed_before,
              COALESCE(pl.unit_price, bl.unit_price) AS ordered_unit_price
         FROM purchase_document_lines bl
         LEFT JOIN purchase_document_lines pl
                ON pl.tenant_id = bl.tenant_id AND pl.id = bl.source_line_id
        WHERE bl.tenant_id = $1 AND bl.document_id = $2
        ORDER BY bl.line_no`,
      [this.tenantId, billId],
    )

    const { rows: toleransi } = await this.db.query<{
      qty_over_receipt_pct: string
      price_variance_pct: string
      price_variance_amount: string
    }>(
      `SELECT qty_over_receipt_pct, price_variance_pct, price_variance_amount
         FROM match_tolerances WHERE tenant_id = $1 AND company_id = $2`,
      [this.tenantId, companyId],
    )

    const batasToleransi =
      toleransi[0] === undefined
        ? NO_TOLERANCE
        : {
            qtyOverReceiptPercent: Number(toleransi[0].qty_over_receipt_pct),
            priceVariancePercent: Number(toleransi[0].price_variance_pct),
            priceVarianceAmount: Number(toleransi[0].price_variance_amount),
          }

    const garis = baris.map((item) => ({
      lineNo: item.line_no,
      description: item.description,
      qtyOrdered: Number(item.qty_ordered),
      qtyReceived: Number(item.qty_received),
      qtyBilledBefore: Number(item.qty_billed_before),
      qtyBilled: Number(item.qty_billed),
      orderedUnitPrice: Number(item.ordered_unit_price),
      billedUnitPrice: Number(item.billed_unit_price),
    }))

    const hasil = matchThreeWay(garis, batasToleransi)

    return {
      billId: row.id,
      billNumber: row.number,
      lifecycleStatus: row.lifecycle_status,
      matchStatus: row.match_status,
      overrideReason: row.override_reason,
      matched: hasil.status === 'matched',
      lines: garis.map((item) => ({
        ...item,
        variances: hasil.variances
          .filter((selisih) => selisih.lineNo === item.lineNo)
          .map((selisih) => ({ kind: selisih.kind, message: explainVariance(selisih) })),
      })),
    }
  }

  async listReceipts(companyId: string, page: PageRequest): Promise<Page<GoodsReceiptSummary>> {
    const limit = batas(page)
    const { rows } = await this.db.query<{
      id: string
      number: string | null
      purchase_order_id: string
      po_number: string | null
      vendor_name: string
      received_date: unknown
      status: string
      line_count: string
    }>(
      `SELECT g.id, g.number, g.purchase_order_id, p.number AS po_number,
              v.name AS vendor_name, g.received_date, g.status,
              (SELECT count(*) FROM goods_receipt_lines l
                WHERE l.tenant_id = g.tenant_id AND l.receipt_id = g.id) AS line_count
         FROM goods_receipts g
         JOIN vendors v ON v.tenant_id = g.tenant_id AND v.id = g.vendor_id
         JOIN purchase_documents p ON p.tenant_id = g.tenant_id AND p.id = g.purchase_order_id
        WHERE g.tenant_id = $1 AND g.company_id = $2
          AND ($3::uuid IS NULL OR g.id < $3::uuid)
        ORDER BY g.id DESC
        LIMIT $4`,
      [this.tenantId, companyId, page.cursor ?? null, limit + 1],
    )

    return halaman(
      rows.map((row) => ({
        id: row.id,
        number: row.number,
        purchaseOrderId: row.purchase_order_id,
        purchaseOrderNumber: row.po_number,
        vendorName: row.vendor_name,
        receivedDate: tanggal(row.received_date),
        status: row.status,
        lineCount: Number(row.line_count),
      })),
      limit,
    )
  }
}

// ── Akuntansi ──────────────────────────────────────────────────────────────

/**
 * Dasbor eksekutif - Screen_Specs_HiFi section 3.
 *
 * Angkanya diambil dari BUKU BESAR, bukan dari daftar dokumen. Bedanya bukan
 * gaya: buku besar hanya berisi yang sudah diposting, dan itulah satu-satunya
 * angka yang boleh disebut "pendapatan". Menjumlahkan kolom total di
 * `sales_documents` akan ikut menghitung draf dan dokumen yang dibatalkan, dan
 * dasbor yang melebih-lebihkan pendapatan adalah dasbor yang berbahaya.
 *
 * Piutang adalah pengecualian yang disengaja, dan alasannya ada di bawah.
 */
export class PostgresDashboardQueries implements DashboardQueryPort {
  constructor(
    private readonly db: Queryable,
    private readonly tenantId: string,
  ) {}

  async summary(companyId: string, today: string): Promise<DashboardSummary> {
    const { rows: perusahaan } = await this.db.query<{ default_currency: string }>(
      `SELECT default_currency FROM companies WHERE tenant_id = $1 AND id = $2`,
      [this.tenantId, companyId],
    )
    const currency = perusahaan[0]?.default_currency ?? 'IDR'

    /*
     * Dua belas bulan pendapatan, dan bulan tanpa transaksi tetap muncul.
     *
     * `generate_series` yang di-LEFT JOIN, bukan GROUP BY atas jurnal saja.
     * Bulan yang hilang dari sumbu akan memampatkan grafik dan membuat tren
     * terlihat lebih mulus daripada kenyataannya - persis kebohongan visual
     * yang paling sulit disadari orang yang melihatnya.
     */
    const { rows: bulanan } = await this.db.query<{ month: string; revenue: string }>(
      `WITH sumbu AS (
         SELECT to_char(bulan, 'YYYY-MM') AS month, bulan
           FROM generate_series(
                  date_trunc('month', $3::date) - interval '11 months',
                  date_trunc('month', $3::date),
                  interval '1 month'
                ) AS bulan
       )
       SELECT s.month,
              COALESCE(SUM(l.credit - l.debit), 0) AS revenue
         FROM sumbu s
         LEFT JOIN journals j
                ON j.tenant_id = $1 AND j.company_id = $2
               AND date_trunc('month', j.journal_date) = s.bulan
         LEFT JOIN journal_lines l
                ON l.tenant_id = j.tenant_id AND l.journal_id = j.id
         LEFT JOIN accounts a
                ON a.tenant_id = l.tenant_id AND a.id = l.account_id
               AND a.type = 'revenue'
        WHERE a.id IS NOT NULL OR l.id IS NULL
        GROUP BY s.month, s.bulan
        ORDER BY s.bulan`,
      [this.tenantId, companyId, today],
    )

    const months = bulanan.map((row) => ({ month: row.month, revenue: Number(row.revenue) }))
    const bulanIni = months[months.length - 1]?.revenue ?? 0
    const bulanLalu = months[months.length - 2]?.revenue ?? 0

    /*
     * Piutang dibaca dari dokumen penjualan, bukan dari saldo akun piutang.
     *
     * Keduanya seharusnya sama, dan kalau berbeda itu temuan tersendiri.
     * Dokumen dipilih karena hanya di sana ada tanggal jatuh tempo per faktur -
     * saldo akun tidak tahu mana yang sudah lewat tempo, dan justru itu yang
     * perlu diketahui orang yang membuka dasbor.
     *
     * Hanya dokumen yang sudah diposting yang dihitung. Draf bukan piutang.
     */
    const { rows: piutang } = await this.db.query<{
      beredar: string
      jatuh_tempo: string
      beredar_bulan_lalu: string
    }>(
      `SELECT
         COALESCE(SUM(total) FILTER (
           WHERE settlement_status IN ('unpaid', 'partially_paid')
         ), 0) AS beredar,
         COALESCE(SUM(total) FILTER (
           WHERE settlement_status IN ('unpaid', 'partially_paid')
             AND due_date IS NOT NULL AND due_date < $3::date
         ), 0) AS jatuh_tempo,
         COALESCE(SUM(total) FILTER (
           WHERE settlement_status IN ('unpaid', 'partially_paid')
             AND document_date < date_trunc('month', $3::date)
         ), 0) AS beredar_bulan_lalu
       FROM sales_documents
      WHERE tenant_id = $1 AND company_id = $2
        AND lifecycle_status = 'posted'
        AND deleted_at IS NULL`,
      [this.tenantId, companyId, today],
    )

    const beredar = Number(piutang[0]?.beredar ?? 0)
    const beredarLalu = Number(piutang[0]?.beredar_bulan_lalu ?? 0)
    const jatuhTempo = Number(piutang[0]?.jatuh_tempo ?? 0)

    /*
     * Menunggu persetujuan dihitung dari kedua sisi, penjualan dan pembelian.
     *
     * "Perlu tindakan" berisi yang benar-benar butuh keputusan orang - bukan
     * "ada data baru" (Screen_Specs section 3). Dokumen yang menunggu
     * persetujuan adalah contoh paling murni dari itu.
     */
    const { rows: menunggu } = await this.db.query<{ jumlah: string }>(
      `SELECT (
         (SELECT count(*) FROM sales_documents
           WHERE tenant_id = $1 AND company_id = $2 AND deleted_at IS NULL
             AND lifecycle_status IN ('submitted', 'pending_approval'))
       + (SELECT count(*) FROM purchase_documents
           WHERE tenant_id = $1 AND company_id = $2 AND deleted_at IS NULL
             AND lifecycle_status IN ('submitted', 'pending_approval'))
       ) AS jumlah`,
      [this.tenantId, companyId],
    )
    const awaitingApproval = Number(menunggu[0]?.jumlah ?? 0)

    /*
     * Company yang belum punya satu pun jurnal tidak punya angka pendapatan —
     * bukan pendapatan nol. Bedanya terlihat di layar sebagai em dash, dan itu
     * pembedaan yang diminta Component_Specs_Composite section 8.
     */
    const { rows: adaJurnal } = await this.db.query<{ ada: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM journals WHERE tenant_id = $1 AND company_id = $2
       ) AS ada`,
      [this.tenantId, companyId],
    )
    const berjurnal = adaJurnal[0]?.ada === true

    const labelBulanLalu = namaBulan(months[months.length - 2]?.month ?? null)

    return {
      currency,
      months,
      awaitingApproval,
      kpis: [
        {
          id: 'pendapatan',
          label: 'Pendapatan bulan ini',
          value: berjurnal ? bulanIni : null,
          currency,
          changePercent: selisihPersen(bulanIni, bulanLalu),
          comparisonBasis: labelBulanLalu === null ? 'Tidak ada periode pembanding' : `vs ${labelBulanLalu}`,
          higherIsBetter: true,
          href: '#/akuntansi/buku-besar',
        },
        {
          id: 'piutang',
          label: 'Piutang beredar',
          value: beredar,
          currency,
          changePercent: selisihPersen(beredar, beredarLalu),
          comparisonBasis: 'vs akhir bulan lalu',
          // Piutang yang naik bukan kabar baik, meski panahnya ke atas.
          higherIsBetter: false,
          href: '#/penjualan',
        },
        {
          id: 'jatuh-tempo',
          label: 'Piutang jatuh tempo',
          value: jatuhTempo,
          currency,
          // Tidak ada pembanding yang jujur untuk ini: jatuh tempo dihitung
          // relatif terhadap hari ini, dan membandingkannya dengan bulan lalu
          // akan membandingkan dua definisi yang berbeda.
          changePercent: null,
          comparisonBasis: 'Posisi hari ini',
          higherIsBetter: false,
          href: '#/penjualan',
        },
        {
          id: 'menunggu',
          label: 'Menunggu persetujuan',
          value: awaitingApproval,
          currency: null,
          changePercent: null,
          comparisonBasis: 'Posisi hari ini',
          higherIsBetter: false,
          href: '#/penjualan',
        },
      ],
    }
  }
}

/**
 * Perubahan persen, dengan satu kasus yang sengaja dijawab null.
 *
 * Dari nol ke angka apa pun bukan "kenaikan tak hingga persen" - ia kenaikan
 * yang tidak punya basis pembanding. Menampilkan angka untuk itu, berapa pun
 * angkanya, adalah mengarang.
 */
function selisihPersen(sekarang: number, sebelumnya: number): number | null {
  if (sebelumnya === 0) return null
  return ((sekarang - sebelumnya) / Math.abs(sebelumnya)) * 100
}

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function namaBulan(kunci: string | null): string | null {
  if (kunci === null) return null
  const [tahun, bulan] = kunci.split('-')
  const indeks = Number(bulan) - 1
  const nama = NAMA_BULAN[indeks]
  return nama === undefined ? null : `${nama} ${tahun}`
}

/**
 * Laba rugi — Screen_Specs_HiFi section 9, Flow_Archetypes 6.
 *
 * Angkanya dari BUKU BESAR, sama seperti dasbor. Laporan laba rugi yang
 * dihitung dari daftar dokumen akan berbeda dari buku besar suatu hari, dan
 * yang berbeda dari buku besar adalah yang salah.
 *
 * SELURUH akun pendapatan dan beban dikembalikan, termasuk yang nol. Akun yang
 * hilang dari laporan tidak dapat dibedakan dari akun yang tidak ada, dan
 * akuntan yang mencari beban yang seharusnya muncul akan menyimpulkan
 * jurnalnya belum masuk.
 */
export class PostgresProfitLoss implements ProfitLossQueryPort {
  constructor(
    private readonly db: Queryable,
    private readonly tenantId: string,
  ) {}

  async report(
    companyId: string,
    period: { from: string; to: string },
    comparison: { from: string; to: string } | null,
  ): Promise<ProfitLossReport> {
    const { rows: perusahaan } = await this.db.query<{ default_currency: string }>(
      `SELECT default_currency FROM companies WHERE tenant_id = $1 AND id = $2`,
      [this.tenantId, companyId],
    )
    const currency = perusahaan[0]?.default_currency ?? 'IDR'

    /*
     * Tanda dihitung menurut jenis akun, bukan seragam.
     *
     * Pendapatan bertambah di kredit, beban bertambah di debit. Menampilkan
     * `debit - credit` untuk keduanya membuat seluruh pendapatan tampil negatif,
     * dan orang akan mengira laporannya rusak.
     *
     * Dua rentang dijumlahkan dalam SATU kueri lewat FILTER. Dua kueri terpisah
     * akan membaca jurnal dua kali dan, lebih buruk, dapat melihat keadaan yang
     * berbeda bila ada posting yang masuk di antaranya.
     */
    const { rows } = await this.db.query<{
      account_id: string
      code: string
      name: string
      type: string
      parent_id: string | null
      amount: string
      comparison: string | null
    }>(
      `SELECT a.id AS account_id, a.code, a.name, a.type::text, a.parent_id,
              COALESCE(SUM(
                CASE WHEN j.journal_date BETWEEN $3::date AND $4::date
                     THEN CASE WHEN a.type = 'revenue'
                               THEN l.credit - l.debit
                               ELSE l.debit - l.credit END
                     ELSE 0 END
              ), 0) AS amount,
              CASE WHEN $5::date IS NULL THEN NULL ELSE COALESCE(SUM(
                CASE WHEN j.journal_date BETWEEN $5::date AND $6::date
                     THEN CASE WHEN a.type = 'revenue'
                               THEN l.credit - l.debit
                               ELSE l.debit - l.credit END
                     ELSE 0 END
              ), 0) END AS comparison
         FROM accounts a
         LEFT JOIN journal_lines l
                ON l.tenant_id = a.tenant_id AND l.account_id = a.id
         LEFT JOIN journals j
                ON j.tenant_id = l.tenant_id AND j.id = l.journal_id
               AND j.company_id = a.company_id
        WHERE a.tenant_id = $1 AND a.company_id = $2
          AND a.type IN ('revenue', 'expense')
          AND a.deleted_at IS NULL
        GROUP BY a.id, a.code, a.name, a.type, a.parent_id
        ORDER BY a.code`,
      [
        this.tenantId,
        companyId,
        period.from,
        period.to,
        comparison?.from ?? null,
        comparison?.to ?? null,
      ],
    )

    const baris: ProfitLossRow[] = rows.map((row) => ({
      accountId: row.account_id,
      code: row.code,
      name: row.name,
      type: row.type,
      parentId: row.parent_id,
      amount: Number(row.amount),
      comparison: row.comparison === null ? null : Number(row.comparison),
    }))

    return {
      currency,
      period: { ...period, label: labelPeriode(period.from, period.to) },
      comparison:
        comparison === null
          ? null
          : { ...comparison, label: labelPeriode(comparison.from, comparison.to) },
      rows: baris,
      generatedAt: new Date().toISOString(),
    }
  }
}

/**
 * Label periode yang dapat dibaca manusia.
 *
 * Satu bulan penuh disebut namanya; rentang lain disebut kedua ujungnya. Ini
 * ikut tercetak di header laporan, dan "1 Agu 2026 – 31 Agu 2026" lebih sulit
 * dibaca sekilas daripada "Agustus 2026" untuk hal yang sama.
 */
function labelPeriode(dari: string, sampai: string): string {
  const [tahunDari, bulanDari, hariDari] = dari.split('-')
  const [tahunSampai, bulanSampai] = sampai.split('-')

  const nama = NAMA_BULAN[Number(bulanDari) - 1]
  const akhirBulan = new Date(Date.UTC(Number(tahunDari), Number(bulanDari), 0))
    .getUTCDate()
    .toString()

  const sebulanPenuh =
    tahunDari === tahunSampai &&
    bulanDari === bulanSampai &&
    hariDari === '01' &&
    sampai.endsWith(`-${akhirBulan.padStart(2, '0')}`)

  return sebulanPenuh && nama !== undefined ? `${nama} ${tahunDari}` : `${dari} - ${sampai}`
}

export class PostgresAccountingQueries implements AccountingQueryPort {
  constructor(
    private readonly db: Queryable,
    private readonly tenantId: string,
  ) {}

  /**
   * Saldo dihitung dengan tanda menurut jenis akun.
   *
   * Aset dan beban bertambah di debit; kewajiban, ekuitas, dan pendapatan
   * bertambah di kredit. Menampilkan `debit - kredit` untuk semuanya akan
   * membuat seluruh pendapatan tampil negatif, dan orang akan mengira ada yang
   * rusak.
   */
  async chartOfAccounts(companyId: string): Promise<readonly AccountSummary[]> {
    const { rows } = await this.db.query<{
      id: string
      code: string
      name: string
      type: string
      is_control: boolean
      balance: string
    }>(
      `SELECT a.id, a.code, a.name, a.type::text, a.is_control,
              COALESCE((
                SELECT CASE WHEN a.type IN ('asset', 'expense')
                            THEN sum(l.debit - l.credit)
                            ELSE sum(l.credit - l.debit) END
                  FROM journal_lines l
                 WHERE l.tenant_id = a.tenant_id AND l.account_id = a.id
              ), 0) AS balance
         FROM accounts a
        WHERE a.tenant_id = $1 AND a.company_id = $2 AND a.deleted_at IS NULL
        ORDER BY a.code`,
      [this.tenantId, companyId],
    )

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      isControl: row.is_control,
      balance: Number(row.balance),
    }))
  }

  async generalLedger(
    companyId: string,
    accountId: string | null,
    page: PageRequest,
  ): Promise<Page<LedgerEntry>> {
    const limit = batas(page)
    const { rows } = await this.db.query<{
      id: string
      journal_id: string
      journal_number: string | null
      journal_date: unknown
      account_code: string
      account_name: string
      description: string | null
      source_type: string | null
      source_id: string | null
      debit: string
      credit: string
    }>(
      `SELECT l.id, j.id AS journal_id, j.number AS journal_number, j.journal_date,
              a.code AS account_code, a.name AS account_name,
              COALESCE(l.description, j.description) AS description,
              j.source_type, j.source_id, l.debit, l.credit
         FROM journal_lines l
         JOIN journals j ON j.tenant_id = l.tenant_id AND j.id = l.journal_id
         JOIN accounts a ON a.tenant_id = l.tenant_id AND a.id = l.account_id
        WHERE l.tenant_id = $1 AND j.company_id = $2
          AND ($3::uuid IS NULL OR l.account_id = $3::uuid)
          AND ($4::uuid IS NULL OR l.id > $4::uuid)
        ORDER BY l.id
        LIMIT $5`,
      [this.tenantId, companyId, accountId, page.cursor ?? null, limit + 1],
    )

    // Saldo berjalan dihitung di sini, bukan di layar. Layar yang menjumlah
    // sendiri akan menampilkan angka berbeda saat halamannya berganti.
    let berjalan = 0
    const items = rows.map((row) => {
      const debit = Number(row.debit)
      const credit = Number(row.credit)
      berjalan = Math.round((berjalan + debit - credit) * 100) / 100
      return {
        id: row.id,
        journalId: row.journal_id,
        journalNumber: row.journal_number,
        journalDate: tanggal(row.journal_date),
        accountCode: row.account_code,
        accountName: row.account_name,
        description: row.description,
        sourceType: row.source_type,
        sourceId: row.source_id,
        debit,
        credit,
        runningBalance: berjalan,
      }
    })

    return halaman(items, limit)
  }
}

// ── Pajak ──────────────────────────────────────────────────────────────────

export class PostgresTaxQueries implements TaxQueryPort {
  constructor(
    private readonly db: Queryable,
    private readonly tenantId: string,
  ) {}

  /**
   * Seluruh versi, bukan hanya yang berlaku hari ini.
   *
   * Diurutkan per kode lalu mundur menurut `valid_from`, sehingga versi yang
   * sedang berlaku selalu berada tepat di bawah judul kodenya dan versi lama
   * terbaca sebagai riwayat. Akun buku besarnya ikut dibawa: pertanyaan "PPN
   * ini masuk ke akun mana" ditanyakan di layar yang sama, dan menjawabnya
   * dengan UUID berarti tidak menjawab.
   */
  async taxCodes(companyId: string): Promise<readonly TaxCodeVersion[]> {
    const { rows } = await this.db.query<{
      id: string
      code: string
      name: string
      tax_type: string
      rate: string
      valid_from: unknown
      valid_to: unknown
      calculation_base: string
      is_creditable: boolean
      status: string
      gl_account_id: string
      gl_account_code: string
      gl_account_name: string
    }>(
      `SELECT t.id, t.code, t.name, t.tax_type::text, t.rate,
              t.valid_from, t.valid_to, t.calculation_base::text,
              t.is_creditable, t.status, t.gl_account_id,
              a.code AS gl_account_code, a.name AS gl_account_name
         FROM tax_codes t
         JOIN accounts a ON a.tenant_id = t.tenant_id AND a.id = t.gl_account_id
        WHERE t.tenant_id = $1 AND t.company_id = $2
        ORDER BY t.code, t.valid_from DESC`,
      [this.tenantId, companyId],
    )

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      taxType: row.tax_type,
      rate: Number(row.rate),
      validFrom: tanggal(row.valid_from),
      validTo: row.valid_to === null ? null : tanggal(row.valid_to),
      calculationBase: row.calculation_base,
      isCreditable: row.is_creditable,
      status: row.status,
      glAccountId: row.gl_account_id,
      glAccountCode: row.gl_account_code,
      glAccountName: row.gl_account_name,
    }))
  }

  async outputInvoices(
    companyId: string,
    page: PageRequest,
  ): Promise<Page<OutputTaxInvoiceSummary>> {
    const limit = batas(page)
    const { rows } = await this.db.query<{
      id: string
      formatted_number: string | null
      customer_name: string
      customer_npwp: string | null
      invoice_date: unknown
      tax_period: string
      tax_code: string
      base_amount: string
      tax_amount: string
      status: string
    }>(
      `SELECT f.id, f.formatted_number, f.customer_name, f.customer_npwp,
              f.invoice_date, f.tax_period, c.code AS tax_code,
              f.base_amount, f.tax_amount, f.status::text
         FROM output_tax_invoices f
         JOIN tax_codes c ON c.tenant_id = f.tenant_id AND c.id = f.tax_code_id
        WHERE f.tenant_id = $1 AND f.company_id = $2
          AND ($3::uuid IS NULL OR f.id < $3::uuid)
        ORDER BY f.id DESC
        LIMIT $4`,
      [this.tenantId, companyId, page.cursor ?? null, limit + 1],
    )

    return halaman(
      rows.map((row) => ({
        id: row.id,
        formattedNumber: row.formatted_number,
        customerName: row.customer_name,
        customerNpwp: row.customer_npwp,
        invoiceDate: tanggal(row.invoice_date),
        taxPeriod: row.tax_period,
        taxCode: row.tax_code,
        baseAmount: Number(row.base_amount),
        taxAmount: Number(row.tax_amount),
        status: row.status,
      })),
      limit,
    )
  }

  /**
   * Faktur komersial sumbernya ikut dibawa.
   *
   * Satu faktur pajak dapat mencakup beberapa faktur penjualan (Module 08 §4),
   * dan tanpa daftar itu layar detail tidak dapat menjawab pertanyaan pertama
   * yang selalu muncul: angka ini berasal dari faktur yang mana.
   */
  async outputInvoice(
    companyId: string,
    invoiceId: string,
  ): Promise<OutputTaxInvoiceDetail | null> {
    const { rows } = await this.db.query<{
      id: string
      serial_number: string | null
      formatted_number: string | null
      customer_name: string
      customer_npwp: string | null
      invoice_date: unknown
      tax_period: string
      tax_code: string
      tax_rate: string
      base_amount: string
      tax_amount: string
      status: string
      issued_at: Date | null
      cancelled_at: Date | null
      cancel_reason: string | null
    }>(
      `SELECT f.id, f.serial_number, f.formatted_number, f.customer_name, f.customer_npwp,
              f.invoice_date, f.tax_period, c.code AS tax_code, c.rate AS tax_rate,
              f.base_amount, f.tax_amount, f.status::text,
              f.issued_at, f.cancelled_at, f.cancel_reason
         FROM output_tax_invoices f
         JOIN tax_codes c ON c.tenant_id = f.tenant_id AND c.id = f.tax_code_id
        WHERE f.tenant_id = $1 AND f.company_id = $2 AND f.id = $3`,
      [this.tenantId, companyId, invoiceId],
    )

    const faktur = rows[0]
    if (faktur === undefined) return null

    const { rows: sumber } = await this.db.query<{
      sales_document_id: string
      sales_document_number: string | null
      base_amount: string
      tax_amount: string
    }>(
      `SELECT s.sales_document_id, d.number AS sales_document_number,
              s.base_amount, s.tax_amount
         FROM output_tax_invoice_sources s
         LEFT JOIN sales_documents d
           ON d.tenant_id = s.tenant_id AND d.id = s.sales_document_id
        WHERE s.tenant_id = $1 AND s.output_tax_invoice_id = $2
        ORDER BY d.number NULLS LAST`,
      [this.tenantId, invoiceId],
    )

    return {
      id: faktur.id,
      serialNumber: faktur.serial_number === null ? null : Number(faktur.serial_number),
      formattedNumber: faktur.formatted_number,
      customerName: faktur.customer_name,
      customerNpwp: faktur.customer_npwp,
      invoiceDate: tanggal(faktur.invoice_date),
      taxPeriod: faktur.tax_period,
      taxCode: faktur.tax_code,
      taxRate: Number(faktur.tax_rate),
      baseAmount: Number(faktur.base_amount),
      taxAmount: Number(faktur.tax_amount),
      status: faktur.status,
      issuedAt: faktur.issued_at === null ? null : faktur.issued_at.toISOString(),
      cancelledAt: faktur.cancelled_at === null ? null : faktur.cancelled_at.toISOString(),
      cancelReason: faktur.cancel_reason,
      sources: sumber.map((row) => ({
        salesDocumentId: row.sales_document_id,
        salesDocumentNumber: row.sales_document_number,
        baseAmount: Number(row.base_amount),
        taxAmount: Number(row.tax_amount),
      })),
    }
  }

  /**
   * Cacat ikut dibawa bersama barisnya, bukan diambil layar satu per satu.
   *
   * Pertanyaan yang dibawa orang ke daftar ini adalah "mana yang belum lengkap,
   * dan apa yang kurang". Mengambil cacat lewat permintaan terpisah per faktur
   * membuat jawaban kedua datang belakangan — dan daftar yang sempat
   * menampilkan semuanya seolah lengkap adalah daftar yang menyesatkan.
   */
  async inputInvoices(
    companyId: string,
    page: PageRequest,
  ): Promise<Page<InputTaxInvoiceSummary>> {
    const limit = batas(page)
    const { rows } = await this.db.query<{
      id: string
      supplier_number: string
      vendor_name: string
      vendor_npwp: string | null
      vendor_is_pkp: boolean
      invoice_date: unknown
      tax_period: string
      credit_period: string | null
      tax_code: string
      base_amount: string
      tax_amount: string
      is_creditable: boolean
      validated_at: Date | null
      defects: readonly { code: string; detail: string }[]
    }>(
      `SELECT f.id, f.supplier_number, v.name AS vendor_name, f.vendor_npwp, f.vendor_is_pkp,
              f.invoice_date, f.tax_period, f.credit_period, c.code AS tax_code,
              f.base_amount, f.tax_amount, f.is_creditable, f.validated_at,
              COALESCE((
                SELECT json_agg(
                         json_build_object('code', d.defect_code, 'detail', d.detail)
                         ORDER BY d.defect_code
                       )
                  FROM input_tax_invoice_defects d
                 WHERE d.tenant_id = f.tenant_id AND d.input_tax_invoice_id = f.id
              ), '[]'::json) AS defects
         FROM input_tax_invoices f
         JOIN vendors v ON v.tenant_id = f.tenant_id AND v.id = f.vendor_id
         JOIN tax_codes c ON c.tenant_id = f.tenant_id AND c.id = f.tax_code_id
        WHERE f.tenant_id = $1 AND f.company_id = $2
          AND ($3::uuid IS NULL OR f.id < $3::uuid)
        ORDER BY f.id DESC
        LIMIT $4`,
      [this.tenantId, companyId, page.cursor ?? null, limit + 1],
    )

    return halaman(
      rows.map((row) => ({
        id: row.id,
        supplierNumber: row.supplier_number,
        vendorName: row.vendor_name,
        vendorNpwp: row.vendor_npwp,
        vendorIsPkp: row.vendor_is_pkp,
        invoiceDate: tanggal(row.invoice_date),
        taxPeriod: row.tax_period,
        creditPeriod: row.credit_period,
        taxCode: row.tax_code,
        baseAmount: Number(row.base_amount),
        taxAmount: Number(row.tax_amount),
        isCreditable: row.is_creditable,
        validatedAt: row.validated_at === null ? null : row.validated_at.toISOString(),
        defects: row.defects.map((item) => ({ code: item.code, detail: item.detail })),
      })),
      limit,
    )
  }

  /**
   * Kandidat sumber faktur pajak keluaran.
   *
   * `NOT EXISTS` terhadap faktur pajak yang belum dibatalkan — aturan yang sama
   * yang ditegakkan layanan saat membuat. Layar dan penolakan karena itu tidak
   * dapat berbeda pendapat: yang tidak muncul di daftar juga akan ditolak bila
   * dipaksa lewat API, dan sebaliknya.
   */
  async eligibleSalesInvoices(companyId: string): Promise<readonly FakturLayakPajak[]> {
    const { rows } = await this.db.query<{
      id: string
      number: string | null
      customer_id: string
      customer_name: string
      customer_npwp: string | null
      document_date: unknown
      tax_base: string
      tax_total: string
      currency: string
    }>(
      `SELECT d.id, d.number, d.customer_id, c.name AS customer_name, c.tax_id AS customer_npwp,
              d.document_date, d.tax_base, d.tax_total, d.currency
         FROM sales_documents d
         JOIN customers c ON c.tenant_id = d.tenant_id AND c.id = d.customer_id
        WHERE d.tenant_id = $1 AND d.company_id = $2
          AND d.doc_type = 'invoice'
          AND d.lifecycle_status = 'posted'
          AND d.tax_total > 0
          AND NOT EXISTS (
            SELECT 1
              FROM output_tax_invoice_sources s
              JOIN output_tax_invoices f
                ON f.tenant_id = s.tenant_id AND f.id = s.output_tax_invoice_id
             WHERE s.tenant_id = d.tenant_id
               AND s.sales_document_id = d.id
               AND f.status <> 'cancelled'
          )
        ORDER BY d.document_date, d.number`,
      [this.tenantId, companyId],
    )

    return rows.map((row) => ({
      id: row.id,
      number: row.number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerNpwp: row.customer_npwp,
      documentDate: tanggal(row.document_date),
      taxBase: Number(row.tax_base),
      taxTotal: Number(row.tax_total),
      currency: row.currency,
    }))
  }
}
