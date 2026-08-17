import type {
  CompanyTaxProfile,
  InputTaxInvoicePort,
  InputTaxInvoiceRecord,
  OutputTaxInvoicePort,
  OutputTaxInvoiceRecord,
  ReconciliationRow,
  SerialUsageSummary,
  TaxConfigPort,
  TaxLedgerEntry,
  TaxLedgerPort,
  TaxSerialPort,
} from '#application/tax/ports'
import type { TaxDeterminationRule } from '#domain/tax/determination'
import type { IsoDate, TaxCodeVersion } from '#domain/tax/rates'
import type { Queryable } from '#infrastructure/db/queryable'
import { uuidv7 } from '#shared/uuid'

/**
 * Repository Pajak.
 *
 * Satu hal yang perlu diperhatikan saat membaca: tanggal keluar sebagai
 * **teks**, bukan sebagai `Date`. Kolom `date` di Postgres tidak punya zona
 * waktu; membungkusnya menjadi `Date` di Node akan menempelkan zona waktu
 * server, dan dokumen tanggal 1 April di server UTC+7 berubah menjadi 31 Maret
 * saat dibandingkan. Di modul yang seluruh kebenarannya bergantung pada
 * "tarif mana yang berlaku pada tanggal dokumen", itu bukan detail.
 */

function tanggal(value: unknown): IsoDate {
  if (typeof value === 'string') return value.slice(0, 10)
  if (value instanceof Date) {
    const bulan = String(value.getMonth() + 1).padStart(2, '0')
    const hari = String(value.getDate()).padStart(2, '0')
    return `${value.getFullYear()}-${bulan}-${hari}`
  }
  throw new TypeError('Nilai tanggal tidak dikenali.')
}

function tanggalAtauNull(value: unknown): IsoDate | null {
  return value === null || value === undefined ? null : tanggal(value)
}

interface BarisVersi {
  id: string
  code: string
  name: string
  tax_type: TaxCodeVersion['taxType']
  rate: string
  valid_from: unknown
  valid_to: unknown
  calculation_base: TaxCodeVersion['calculationBase']
  gl_account_id: string
  is_creditable: boolean
  status: 'active' | 'inactive'
}

function keVersi(row: BarisVersi): TaxCodeVersion {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    taxType: row.tax_type,
    rate: Number(row.rate),
    validFrom: tanggal(row.valid_from),
    validTo: tanggalAtauNull(row.valid_to),
    calculationBase: row.calculation_base,
    glAccountId: row.gl_account_id,
    isCreditable: row.is_creditable,
    status: row.status,
  }
}

const KOLOM_VERSI = `id, code, name, tax_type, rate, valid_from, valid_to,
                     calculation_base, gl_account_id, is_creditable, status`

export class PostgresTaxRepository
  implements TaxConfigPort, TaxSerialPort, OutputTaxInvoicePort, InputTaxInvoicePort, TaxLedgerPort
{
  constructor(
    private readonly db: Queryable,
    private readonly tenantId: string,
  ) {}

  // ── TaxConfigPort ───────────────────────────────────────────────────────

  async loadProfile(companyId: string): Promise<CompanyTaxProfile | null> {
    const { rows } = await this.db.query<{
      npwp: string | null
      is_pkp: boolean
      pkp_effective_date: unknown
      nppkp: string | null
    }>(
      `SELECT npwp, is_pkp, pkp_effective_date, nppkp
         FROM company_tax_profiles WHERE tenant_id = $1 AND company_id = $2`,
      [this.tenantId, companyId],
    )

    const row = rows[0]
    if (row === undefined) return null

    return {
      companyId,
      npwp: row.npwp,
      isPkp: row.is_pkp,
      pkpEffectiveDate: tanggalAtauNull(row.pkp_effective_date),
      nppkp: row.nppkp,
    }
  }

  async listRules(
    companyId: string,
    transactionType: string,
  ): Promise<readonly TaxDeterminationRule[]> {
    const { rows } = await this.db.query<{
      id: string
      transaction_type: string
      item_category_id: string | null
      partner_type: string | null
      partner_is_pkp: boolean | null
      region_code: string | null
      tax_code: string
    }>(
      `SELECT id, transaction_type, item_category_id, partner_type, partner_is_pkp,
              region_code, tax_code
         FROM tax_determination_rules
        WHERE tenant_id = $1 AND company_id = $2 AND transaction_type = $3`,
      [this.tenantId, companyId, transactionType],
    )

    return rows.map((row) => ({
      id: row.id,
      transactionType: row.transaction_type,
      itemCategoryId: row.item_category_id,
      partnerType: row.partner_type,
      partnerIsPkp: row.partner_is_pkp,
      regionCode: row.region_code,
      taxCode: row.tax_code,
    }))
  }

  /**
   * Seluruh versi satu kode, tanpa penyaringan tanggal.
   *
   * Penyaringannya milik domain (`versionOn`), bukan SQL. Dua alasan: ia dapat
   * diuji tanpa basis data, dan "dua versi berlaku bersamaan" menjadi keadaan
   * yang dapat dilaporkan alih-alih baris yang diam-diam terpilih oleh LIMIT 1.
   */
  async listVersions(companyId: string, code: string): Promise<readonly TaxCodeVersion[]> {
    const { rows } = await this.db.query<BarisVersi>(
      `SELECT ${KOLOM_VERSI} FROM tax_codes
        WHERE tenant_id = $1 AND company_id = $2 AND code = $3
        ORDER BY valid_from`,
      [this.tenantId, companyId, code],
    )
    return rows.map(keVersi)
  }

  async findVersionById(taxCodeId: string): Promise<TaxCodeVersion | null> {
    const { rows } = await this.db.query<BarisVersi>(
      `SELECT ${KOLOM_VERSI} FROM tax_codes WHERE tenant_id = $1 AND id = $2`,
      [this.tenantId, taxCodeId],
    )
    const row = rows[0]
    return row === undefined ? null : keVersi(row)
  }

  async insertVersion(version: Parameters<TaxConfigPort['insertVersion']>[0]): Promise<void> {
    await this.db.query(
      `INSERT INTO tax_codes
         (id, tenant_id, company_id, code, name, tax_type, rate, valid_from,
          calculation_base, gl_account_id, is_creditable, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10, $11, $12)`,
      [
        version.id,
        this.tenantId,
        version.companyId,
        version.code,
        version.name,
        version.taxType,
        version.rate,
        version.validFrom,
        version.calculationBase,
        version.glAccountId,
        version.isCreditable,
        version.createdBy,
      ],
    )
  }

  /** Satu-satunya perubahan yang diizinkan trigger `t40_rate_immutable`. */
  async closeVersion(taxCodeId: string, validTo: IsoDate): Promise<void> {
    await this.db.query(
      `UPDATE tax_codes SET valid_to = $3::date WHERE tenant_id = $1 AND id = $2`,
      [this.tenantId, taxCodeId, validTo],
    )
  }

  async isCodeUsed(taxCodeId: string): Promise<boolean> {
    const { rows } = await this.db.query<{ ada: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM tax_ledger WHERE tenant_id = $1 AND tax_code_id = $2
       ) AS ada`,
      [this.tenantId, taxCodeId],
    )
    return rows[0]?.ada ?? false
  }

  // ── TaxSerialPort ───────────────────────────────────────────────────────

  async allocate(allocation: Parameters<TaxSerialPort['allocate']>[0]): Promise<number> {
    await this.db.query(
      `INSERT INTO tax_serial_allocations
         (id, tenant_id, company_id, prefix, digits, range_start, range_end,
          expires_at, source_reference, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10)`,
      [
        allocation.id,
        this.tenantId,
        allocation.companyId,
        allocation.prefix,
        allocation.digits,
        allocation.rangeStart,
        allocation.rangeEnd,
        allocation.expiresAt,
        allocation.sourceReference,
        allocation.createdBy,
      ],
    )

    // Setiap nomor menjadi satu baris. `generate_series` melakukannya dalam
    // satu perjalanan ke basis data alih-alih ribuan.
    const { rowCount } = await this.db.query(
      `INSERT INTO tax_serial_usage
         (tenant_id, company_id, allocation_id, serial_number, formatted_number)
       SELECT $1, $2, $3, nomor,
              $4 || lpad(nomor::text, $5, '0')
         FROM generate_series($6::bigint, $7::bigint) AS nomor`,
      [
        this.tenantId,
        allocation.companyId,
        allocation.id,
        allocation.prefix,
        allocation.digits,
        allocation.rangeStart,
        allocation.rangeEnd,
      ],
    )

    return rowCount ?? 0
  }

  /**
   * Mengambil nomor tersedia terendah, dengan kunci yang MEMBLOKIR.
   *
   * Bukan `SKIP LOCKED`. Sepuluh penerbitan bersamaan harus menghasilkan
   * sepuluh nomor berurutan; `SKIP LOCKED` akan membuat masing-masing melompati
   * nomor yang sedang dipegang yang lain, dan lompatan pada nomor seri faktur
   * pajak adalah temuan pemeriksaan.
   *
   * Harganya nyata dan disengaja: penerbitan menjadi serial per company —
   * pertukaran yang sama dengan penomoran dokumen di D-007.
   */
  async takeNextAvailable(
    companyId: string,
  ): Promise<{ serialNumber: number; formattedNumber: string } | null> {
    const { rows } = await this.db.query<{ serial_number: string; formatted_number: string }>(
      `SELECT serial_number, formatted_number
         FROM tax_serial_usage
        WHERE tenant_id = $1 AND company_id = $2 AND status = 'available'
        ORDER BY serial_number
        LIMIT 1
          FOR UPDATE`,
      [this.tenantId, companyId],
    )

    const row = rows[0]
    if (row === undefined) return null
    return { serialNumber: Number(row.serial_number), formattedNumber: row.formatted_number }
  }

  async markUsed(
    companyId: string,
    serialNumber: number,
    outputTaxInvoiceId: string,
  ): Promise<void> {
    // Syarat `status = 'available'` bukan hiasan: ia yang membuat pemakaian
    // ulang nomor batal tidak berpengaruh apa pun, bahkan bila layanan keliru.
    const { rowCount } = await this.db.query(
      `UPDATE tax_serial_usage
          SET status = 'used', output_tax_invoice_id = $4, used_at = now()
        WHERE tenant_id = $1 AND company_id = $2 AND serial_number = $3
          AND status = 'available'`,
      [this.tenantId, companyId, serialNumber, outputTaxInvoiceId],
    )

    if (rowCount === 0) {
      throw new Error(
        `Nomor seri ${serialNumber} tidak tersedia. Nomor yang sudah terpakai atau dibatalkan tidak dapat dipakai ulang.`,
      )
    }
  }

  async markSerialCancelled(companyId: string, serialNumber: number, reason: string): Promise<void> {
    await this.db.query(
      `UPDATE tax_serial_usage
          SET status = 'cancelled', cancelled_at = now(), cancel_reason = $4
        WHERE tenant_id = $1 AND company_id = $2 AND serial_number = $3`,
      [this.tenantId, companyId, serialNumber, reason],
    )
  }

  async isWithinAllocation(companyId: string, serialNumber: number): Promise<boolean> {
    const { rows } = await this.db.query<{ ada: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM tax_serial_allocations
          WHERE tenant_id = $1 AND company_id = $2
            AND $3::bigint BETWEEN range_start AND range_end
       ) AS ada`,
      [this.tenantId, companyId, serialNumber],
    )
    return rows[0]?.ada ?? false
  }

  async usage(companyId: string): Promise<SerialUsageSummary> {
    const { rows } = await this.db.query<{ status: string; jumlah: string }>(
      `SELECT status, count(*) AS jumlah
         FROM tax_serial_usage
        WHERE tenant_id = $1 AND company_id = $2
        GROUP BY status`,
      [this.tenantId, companyId],
    )

    const hitung = (status: string): number =>
      Number(rows.find((row) => row.status === status)?.jumlah ?? 0)

    const available = hitung('available')
    const used = hitung('used')
    const cancelled = hitung('cancelled')
    const expired = hitung('expired')

    return { allocated: available + used + cancelled + expired, available, used, cancelled, expired }
  }

  // ── OutputTaxInvoicePort ────────────────────────────────────────────────

  async insert(invoice: Parameters<OutputTaxInvoicePort['insert']>[0]): Promise<void> {
    await this.db.query(
      `INSERT INTO output_tax_invoices
         (id, tenant_id, company_id, customer_id, customer_npwp, customer_name,
          invoice_date, tax_period, tax_code_id, base_amount, tax_amount, replaces_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10, $11, $12, $13)`,
      [
        invoice.id,
        this.tenantId,
        invoice.companyId,
        invoice.customerId,
        invoice.customerNpwp,
        invoice.customerName,
        invoice.invoiceDate,
        invoice.taxPeriod,
        invoice.taxCodeId,
        invoice.baseAmount,
        invoice.taxAmount,
        invoice.replacesId,
        invoice.createdBy,
      ],
    )
  }

  async linkSources(
    invoiceId: string,
    sources: readonly { salesDocumentId: string; baseAmount: number; taxAmount: number }[],
  ): Promise<void> {
    for (const sumber of sources) {
      await this.db.query(
        `INSERT INTO output_tax_invoice_sources
           (tenant_id, output_tax_invoice_id, sales_document_id, base_amount, tax_amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [this.tenantId, invoiceId, sumber.salesDocumentId, sumber.baseAmount, sumber.taxAmount],
      )
    }
  }

  async load(invoiceId: string): Promise<OutputTaxInvoiceRecord | null> {
    const { rows } = await this.db.query<{
      id: string
      company_id: string
      serial_number: string | null
      formatted_number: string | null
      customer_id: string
      customer_npwp: string | null
      invoice_date: unknown
      tax_period: string
      tax_code_id: string
      base_amount: string
      tax_amount: string
      status: OutputTaxInvoiceRecord['status']
      replaces_id: string | null
    }>(
      `SELECT id, company_id, serial_number, formatted_number, customer_id, customer_npwp,
              invoice_date, tax_period, tax_code_id, base_amount, tax_amount, status, replaces_id
         FROM output_tax_invoices
        WHERE tenant_id = $1 AND id = $2
          FOR UPDATE`,
      [this.tenantId, invoiceId],
    )

    const row = rows[0]
    if (row === undefined) return null

    return {
      id: row.id,
      companyId: row.company_id,
      serialNumber: row.serial_number === null ? null : Number(row.serial_number),
      formattedNumber: row.formatted_number,
      customerId: row.customer_id,
      customerNpwp: row.customer_npwp,
      invoiceDate: tanggal(row.invoice_date),
      taxPeriod: row.tax_period,
      taxCodeId: row.tax_code_id,
      baseAmount: Number(row.base_amount),
      taxAmount: Number(row.tax_amount),
      status: row.status,
      replacesId: row.replaces_id,
    }
  }

  async markIssued(
    invoiceId: string,
    serialNumber: number,
    formattedNumber: string,
    by: string,
  ): Promise<void> {
    await this.db.query(
      `UPDATE output_tax_invoices
          SET status = 'issued', serial_number = $3, formatted_number = $4,
              issued_at = now(), issued_by = $5
        WHERE tenant_id = $1 AND id = $2 AND status = 'draft'`,
      [this.tenantId, invoiceId, serialNumber, formattedNumber, by],
    )
  }

  async markCancelled(invoiceId: string, reason: string, by: string): Promise<void> {
    await this.db.query(
      `UPDATE output_tax_invoices
          SET status = 'cancelled', cancel_reason = $3, cancelled_at = now(), cancelled_by = $4
        WHERE tenant_id = $1 AND id = $2 AND status = 'issued'`,
      [this.tenantId, invoiceId, reason, by],
    )
  }

  async markReplaced(invoiceId: string): Promise<void> {
    await this.db.query(
      `UPDATE output_tax_invoices SET status = 'replaced'
        WHERE tenant_id = $1 AND id = $2 AND status = 'issued'`,
      [this.tenantId, invoiceId],
    )
  }

  // ── InputTaxInvoicePort ─────────────────────────────────────────────────

  async insertInput(invoice: Parameters<InputTaxInvoicePort['insertInput']>[0]): Promise<void> {
    await this.db.query(
      `INSERT INTO input_tax_invoices
         (id, tenant_id, company_id, vendor_id, vendor_npwp, vendor_is_pkp, supplier_number,
          invoice_date, tax_period, purchase_document_id, tax_code_id, base_amount,
          tax_amount, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10, $11, $12, $13, $14)`,
      [
        invoice.id,
        this.tenantId,
        invoice.companyId,
        invoice.vendorId,
        invoice.vendorNpwp,
        invoice.vendorIsPkp,
        invoice.supplierNumber,
        invoice.invoiceDate,
        invoice.taxPeriod,
        invoice.purchaseDocumentId,
        invoice.taxCodeId,
        invoice.baseAmount,
        invoice.taxAmount,
        invoice.createdBy,
      ],
    )
  }

  async loadInput(invoiceId: string): Promise<InputTaxInvoiceRecord | null> {
    const { rows } = await this.db.query<{
      id: string
      company_id: string
      vendor_id: string
      vendor_npwp: string | null
      vendor_is_pkp: boolean
      supplier_number: string
      invoice_date: unknown
      tax_period: string
      credit_period: string | null
      tax_code_id: string
      base_amount: string
      tax_amount: string
      is_creditable: boolean
    }>(
      `SELECT id, company_id, vendor_id, vendor_npwp, vendor_is_pkp, supplier_number,
              invoice_date, tax_period, credit_period, tax_code_id, base_amount,
              tax_amount, is_creditable
         FROM input_tax_invoices
        WHERE tenant_id = $1 AND id = $2
          FOR UPDATE`,
      [this.tenantId, invoiceId],
    )

    const row = rows[0]
    if (row === undefined) return null

    return {
      id: row.id,
      companyId: row.company_id,
      vendorId: row.vendor_id,
      vendorNpwp: row.vendor_npwp,
      vendorIsPkp: row.vendor_is_pkp,
      supplierNumber: row.supplier_number,
      invoiceDate: tanggal(row.invoice_date),
      taxPeriod: row.tax_period,
      creditPeriod: row.credit_period,
      taxCodeId: row.tax_code_id,
      baseAmount: Number(row.base_amount),
      taxAmount: Number(row.tax_amount),
      isCreditable: row.is_creditable,
    }
  }

  async replaceDefects(
    invoiceId: string,
    defects: readonly { code: string; detail: string }[],
  ): Promise<void> {
    await this.db.query(
      'DELETE FROM input_tax_invoice_defects WHERE tenant_id = $1 AND input_tax_invoice_id = $2',
      [this.tenantId, invoiceId],
    )
    for (const kekurangan of defects) {
      await this.db.query(
        `INSERT INTO input_tax_invoice_defects
           (tenant_id, input_tax_invoice_id, defect_code, detail)
         VALUES ($1, $2, $3, $4)`,
        [this.tenantId, invoiceId, kekurangan.code, kekurangan.detail],
      )
    }
  }

  async markValidated(invoiceId: string, isCreditable: boolean, at: Date): Promise<void> {
    await this.db.query(
      `UPDATE input_tax_invoices SET is_creditable = $3, validated_at = $4
        WHERE tenant_id = $1 AND id = $2`,
      [this.tenantId, invoiceId, isCreditable, at],
    )
  }

  async setCreditPeriod(invoiceId: string, period: string): Promise<void> {
    await this.db.query(
      `UPDATE input_tax_invoices SET credit_period = $3 WHERE tenant_id = $1 AND id = $2`,
      [this.tenantId, invoiceId, period],
    )
  }

  // ── TaxLedgerPort ───────────────────────────────────────────────────────

  async append(entry: TaxLedgerEntry): Promise<void> {
    await this.db.query(
      `INSERT INTO tax_ledger
         (id, tenant_id, company_id, tax_period, tax_code_id, direction, document_type,
          document_id, document_date, partner_id, partner_npwp, base_amount, tax_amount,
          is_creditable, non_creditable_reason, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10, $11, $12, $13, $14, $15, $16)`,
      [
        uuidv7(),
        this.tenantId,
        entry.companyId,
        entry.taxPeriod,
        entry.taxCodeId,
        entry.direction,
        entry.documentType,
        entry.documentId,
        entry.documentDate,
        entry.partnerId,
        entry.partnerNpwp,
        entry.baseAmount,
        entry.taxAmount,
        entry.isCreditable,
        entry.nonCreditableReason,
        entry.createdBy,
      ],
    )
  }

  /**
   * Buku pajak berdampingan dengan akun pajaknya di buku besar, per AKUN.
   *
   * Tanda dinormalkan supaya keduanya dapat dibandingkan langsung: PPN keluaran
   * berdiri di sisi kredit, PPN masukan di sisi debit.
   *
   * Grainnya akun, bukan kode. Alasannya struktural, bukan selera: buku besar
   * tidak menyimpan kode pajak, hanya `account_id`. Mengelompokkan saldo akun
   * per kode — seperti versi sebelumnya — berarti menyalin saldo yang sama ke
   * setiap kode yang menunjuk akun itu, sehingga dua versi dari satu kode saja
   * sudah melipatgandakan angkanya.
   *
   * Sisi buku pajak tetap dirinci per kode di `codes`, karena `tax_ledger`
   * memang menyimpannya. Yang tidak dapat dirinci tidak dipaksa dirinci.
   */
  async reconcile(companyId: string, period: string): Promise<readonly ReconciliationRow[]> {
    const { rows } = await this.db.query<{
      gl_account_id: string
      tax_total: string
      gl_total: string
      codes: readonly { taxCodeId: string; code: string; taxLedgerTotal: number }[]
    }>(
      `WITH kode AS (
         SELECT id, code, gl_account_id
           FROM tax_codes
          WHERE tenant_id = $1 AND company_id = $2
       ),
       akun AS (SELECT DISTINCT gl_account_id FROM kode),
       buku_pajak_kode AS (
         SELECT k.gl_account_id, k.id AS tax_code_id, k.code,
                sum(CASE WHEN l.direction = 'out' THEN l.tax_amount ELSE -l.tax_amount END) AS total
           FROM tax_ledger l
           JOIN kode k ON k.id = l.tax_code_id
          WHERE l.tenant_id = $1 AND l.company_id = $2 AND l.tax_period = $3
          GROUP BY k.gl_account_id, k.id, k.code
       ),
       buku_pajak AS (
         SELECT gl_account_id,
                sum(total) AS total,
                json_agg(
                  json_build_object(
                    'taxCodeId', tax_code_id, 'code', code, 'taxLedgerTotal', total
                  ) ORDER BY code
                ) AS codes
           FROM buku_pajak_kode
          GROUP BY gl_account_id
       ),
       buku_besar AS (
         SELECT a.gl_account_id, sum(jl.credit - jl.debit) AS total
           FROM akun a
           JOIN journal_lines jl ON jl.tenant_id = $1 AND jl.account_id = a.gl_account_id
           JOIN journals j ON j.tenant_id = jl.tenant_id AND j.id = jl.journal_id
          WHERE to_char(j.journal_date, 'YYYY-MM') = $3
          GROUP BY a.gl_account_id
       )
       SELECT a.gl_account_id,
              COALESCE(bp.total, 0) AS tax_total,
              COALESCE(bb.total, 0) AS gl_total,
              COALESCE(bp.codes, '[]'::json) AS codes
         FROM akun a
         LEFT JOIN buku_pajak bp ON bp.gl_account_id = a.gl_account_id
         LEFT JOIN buku_besar bb ON bb.gl_account_id = a.gl_account_id
        WHERE bp.total IS NOT NULL OR bb.total IS NOT NULL
        ORDER BY a.gl_account_id`,
      [this.tenantId, companyId, period],
    )

    return rows.map((row) => {
      const bukuPajak = Number(row.tax_total)
      const bukuBesar = Number(row.gl_total)
      return {
        glAccountId: row.gl_account_id,
        taxLedgerTotal: bukuPajak,
        generalLedgerTotal: bukuBesar,
        difference: Math.round((bukuPajak - bukuBesar) * 100) / 100,
        codes: row.codes.map((item) => ({
          taxCodeId: item.taxCodeId,
          code: item.code,
          taxLedgerTotal: Number(item.taxLedgerTotal),
        })),
      }
    })
  }
}
