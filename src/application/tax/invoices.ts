import type { IsoDate } from '#domain/tax/rates'

import type {
  InputTaxInvoicePort,
  OutputTaxInvoicePort,
  PartnerTaxStatusPort,
  TaxConfigPort,
  TaxLedgerPort,
  TaxSerialPort,
} from './ports'

/**
 * Faktur pajak keluaran dan masukan — Module 08 §4, §9, §11.
 *
 * Faktur pajak adalah dokumen tersendiri, bukan kolom di faktur komersial. Ia
 * punya nomor seri sendiri, siklus hidup sendiri, dan dapat mencakup beberapa
 * faktur komersial. Karena itu koreksi, penggantian, dan pembatalan punya
 * tempat — dan itulah seluruh alasan ia dipisahkan.
 */

function periodOf(date: IsoDate): string {
  return date.slice(0, 7)
}

export interface CreateOutputInput {
  readonly companyId: string
  readonly customerId: string
  readonly invoiceDate: IsoDate
  readonly taxCodeId: string
  readonly baseAmount: number
  readonly taxAmount: number
  readonly sources: readonly {
    salesDocumentId: string
    baseAmount: number
    taxAmount: number
  }[]
  readonly replacesId?: string | null
  readonly createdBy: string
}

export type CreateOutputResult =
  | { readonly kind: 'created'; readonly id: string }
  | { readonly kind: 'not_pkp'; readonly reason: string }
  | { readonly kind: 'customer_npwp_missing'; readonly reason: string }
  | { readonly kind: 'customer_not_found' }
  | { readonly kind: 'replaced_not_issued' }
  | { readonly kind: 'no_sources' }
  | { readonly kind: 'already_covered'; readonly reason: string }

export type IssueResult =
  | { readonly kind: 'issued'; readonly formattedNumber: string; readonly serialNumber: number }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'not_draft'; readonly status: string }
  | { readonly kind: 'no_serial_available'; readonly reason: string }
  | { readonly kind: 'not_pkp'; readonly reason: string }

export type CancelResult =
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'not_issued'; readonly status: string }
  | { readonly kind: 'reason_required' }

const PANJANG_ALASAN_MINIMUM = 20

export class OutputTaxInvoiceService {
  constructor(
    private readonly invoices: OutputTaxInvoicePort,
    private readonly serials: TaxSerialPort,
    private readonly config: TaxConfigPort,
    private readonly partners: PartnerTaxStatusPort,
    private readonly ledger: TaxLedgerPort,
    private readonly newId: () => string,
  ) {}

  /**
   * Status PKP diperiksa terhadap TANGGAL FAKTUR, bukan terhadap hari ini.
   *
   * Company yang dikukuhkan bulan lalu tidak dapat menerbitkan faktur pajak
   * bertanggal dua bulan lalu, dan pemeriksaan yang memakai tanggal sistem akan
   * meloloskannya.
   */
  private async pkpPada(companyId: string, date: IsoDate): Promise<string | null> {
    const profil = await this.config.loadProfile(companyId)
    if (profil === null || !profil.isPkp) {
      return 'Company ini belum berstatus PKP, sehingga tidak dapat menerbitkan faktur pajak keluaran.'
    }
    if (profil.pkpEffectiveDate !== null && date < profil.pkpEffectiveDate) {
      return `Company dikukuhkan sebagai PKP sejak ${profil.pkpEffectiveDate}; faktur pajak bertanggal ${date} tidak dapat diterbitkan.`
    }
    return null
  }

  async create(input: CreateOutputInput): Promise<CreateOutputResult> {
    const bukanPkp = await this.pkpPada(input.companyId, input.invoiceDate)
    if (bukanPkp !== null) return { kind: 'not_pkp', reason: bukanPkp }

    if (input.sources.length === 0) return { kind: 'no_sources' }

    const pelanggan = await this.partners.customer(input.customerId)
    if (pelanggan === null) return { kind: 'customer_not_found' }
    if (pelanggan.taxId === null || pelanggan.taxId.trim() === '') {
      // Menyebutkan cara melengkapinya, bukan hanya menolak — Module 08 §11.
      return {
        kind: 'customer_npwp_missing',
        reason:
          'Faktur pajak keluaran memerlukan NPWP pelanggan. Lengkapi di Pelanggan → Data Pajak, lalu ulangi.',
      }
    }

    if (input.replacesId != null) {
      const digantikan = await this.invoices.load(input.replacesId)
      if (digantikan === null || digantikan.status !== 'issued') {
        return { kind: 'replaced_not_issued' }
      }
    }

    // Satu faktur penjualan hanya boleh tercakup satu faktur pajak yang masih
    // berlaku. Tanpa pemeriksaan ini, PPN yang sama masuk buku pajak dua kali
    // dan rekonsiliasi melaporkan selisih yang tidak berasal dari kesalahan
    // pencatatan mana pun. Faktur pajak yang dibatalkan tidak menahan sumbernya.
    const sudah = await this.invoices.coveredSalesDocuments(
      input.sources.map((sumber) => sumber.salesDocumentId),
    )
    if (sudah.length > 0) {
      return {
        kind: 'already_covered',
        reason:
          `Faktur penjualan berikut sudah tercakup faktur pajak lain: ${sudah.map((item) => item.number ?? item.salesDocumentId).join(', ')}. ` +
          'Batalkan faktur pajak itu lebih dulu bila memang harus diterbitkan ulang.',
      }
    }

    const id = this.newId()
    await this.invoices.insert({
      id,
      companyId: input.companyId,
      customerId: input.customerId,
      // Disalin sekarang. NPWP pelanggan hari ini bukan NPWP-nya saat transaksi.
      customerNpwp: pelanggan.taxId,
      customerName: pelanggan.name,
      invoiceDate: input.invoiceDate,
      taxPeriod: periodOf(input.invoiceDate),
      taxCodeId: input.taxCodeId,
      baseAmount: input.baseAmount,
      taxAmount: input.taxAmount,
      replacesId: input.replacesId ?? null,
      createdBy: input.createdBy,
    })
    await this.invoices.linkSources(id, input.sources)

    return { kind: 'created', id }
  }

  /**
   * Penerbitan mengambil nomor seri, menandainya terpakai, dan mencatat baris
   * buku pajak — seluruhnya di dalam transaksi pemanggil.
   *
   * Nomor yang terambil tetapi fakturnya gagal terbit akan ikut dibatalkan
   * bersama transaksinya, sehingga tidak ada nomor yang hilang tanpa jejak.
   */
  async issue(invoiceId: string, by: string): Promise<IssueResult> {
    const faktur = await this.invoices.load(invoiceId)
    if (faktur === null) return { kind: 'not_found' }
    if (faktur.status !== 'draft') return { kind: 'not_draft', status: faktur.status }

    const bukanPkp = await this.pkpPada(faktur.companyId, faktur.invoiceDate)
    if (bukanPkp !== null) return { kind: 'not_pkp', reason: bukanPkp }

    const nomor = await this.serials.takeNextAvailable(faktur.companyId)
    if (nomor === null) {
      return {
        kind: 'no_serial_available',
        reason:
          'Tidak ada nomor seri tersisa. Catat alokasi baru di Pengaturan → Pajak → Nomor Seri.',
      }
    }

    await this.invoices.markIssued(invoiceId, nomor.serialNumber, nomor.formattedNumber, by)
    await this.serials.markUsed(faktur.companyId, nomor.serialNumber, invoiceId)

    if (faktur.replacesId !== null) {
      // Yang digantikan berubah status, bukan dihapus. Rantainya utuh.
      await this.invoices.markReplaced(faktur.replacesId)
    }

    await this.ledger.append({
      companyId: faktur.companyId,
      taxPeriod: faktur.taxPeriod,
      taxCodeId: faktur.taxCodeId,
      direction: 'out',
      documentType: 'output_tax_invoice',
      documentId: invoiceId,
      documentDate: faktur.invoiceDate,
      partnerId: faktur.customerId,
      partnerNpwp: faktur.customerNpwp,
      baseAmount: faktur.baseAmount,
      taxAmount: faktur.taxAmount,
      isCreditable: true,
      nonCreditableReason: null,
      createdBy: by,
    })

    return {
      kind: 'issued',
      formattedNumber: nomor.formattedNumber,
      serialNumber: nomor.serialNumber,
    }
  }

  /**
   * Pembatalan menandai nomornya `cancelled`. Ia TIDAK kembali ke pool.
   *
   * Nomor yang kembali ke pool membuat pertanyaan "nomor ini dipakai untuk apa"
   * punya dua jawaban, dan pemeriksa menanyakan pertanyaan itu.
   */
  async cancel(invoiceId: string, reason: string, by: string): Promise<CancelResult> {
    const faktur = await this.invoices.load(invoiceId)
    if (faktur === null) return { kind: 'not_found' }
    if (faktur.status !== 'issued') return { kind: 'not_issued', status: faktur.status }

    const bersih = reason.trim()
    if (bersih.length < PANJANG_ALASAN_MINIMUM) return { kind: 'reason_required' }

    await this.invoices.markCancelled(invoiceId, bersih, by)
    if (faktur.serialNumber !== null) {
      await this.serials.markSerialCancelled(faktur.companyId, faktur.serialNumber, bersih)
    }

    // Baris pembalik di buku pajak, bukan penghapusan barisnya: buku pajak
    // append-only, dan yang dibatalkan tetap harus terlihat di laporan.
    await this.ledger.append({
      companyId: faktur.companyId,
      taxPeriod: faktur.taxPeriod,
      taxCodeId: faktur.taxCodeId,
      direction: 'out',
      documentType: 'output_tax_invoice_cancellation',
      documentId: invoiceId,
      documentDate: faktur.invoiceDate,
      partnerId: faktur.customerId,
      partnerNpwp: faktur.customerNpwp,
      baseAmount: -faktur.baseAmount,
      taxAmount: -faktur.taxAmount,
      isCreditable: true,
      nonCreditableReason: null,
      createdBy: by,
    })

    return { kind: 'cancelled' }
  }
}

// ── Faktur pajak masukan ───────────────────────────────────────────────────

export interface RecordInputInput {
  readonly companyId: string
  readonly vendorId: string
  readonly supplierNumber: string
  readonly invoiceDate: IsoDate
  readonly purchaseDocumentId: string | null
  readonly taxCodeId: string
  readonly baseAmount: number
  readonly taxAmount: number
  readonly createdBy: string
}

export type RecordInputResult =
  | { readonly kind: 'recorded'; readonly id: string }
  | { readonly kind: 'vendor_not_found' }

export interface Defect {
  readonly code: string
  readonly detail: string
}

export type ValidateResult =
  | { readonly kind: 'validated'; readonly isCreditable: boolean; readonly defects: readonly Defect[] }
  | { readonly kind: 'not_found' }

export class InputTaxInvoiceService {
  constructor(
    private readonly invoices: InputTaxInvoicePort,
    private readonly config: TaxConfigPort,
    private readonly partners: PartnerTaxStatusPort,
    private readonly ledger: TaxLedgerPort,
    private readonly newId: () => string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async record(input: RecordInputInput): Promise<RecordInputResult> {
    const vendor = await this.partners.vendor(input.vendorId)
    if (vendor === null) return { kind: 'vendor_not_found' }

    const id = this.newId()
    await this.invoices.insertInput({
      id,
      companyId: input.companyId,
      vendorId: input.vendorId,
      // Disalin sekarang, dan tidak pernah dibaca ulang dari modul Pembelian.
      // Status PKP vendor hari ini bukan statusnya saat transaksi.
      vendorNpwp: vendor.taxId,
      vendorIsPkp: vendor.isPkp,
      supplierNumber: input.supplierNumber,
      invoiceDate: input.invoiceDate,
      taxPeriod: periodOf(input.invoiceDate),
      purchaseDocumentId: input.purchaseDocumentId,
      taxCodeId: input.taxCodeId,
      baseAmount: input.baseAmount,
      taxAmount: input.taxAmount,
      createdBy: input.createdBy,
    })

    return { kind: 'recorded', id }
  }

  /**
   * Validasi menghasilkan DAFTAR kekurangan, bukan satu bendera merah.
   *
   * Orang yang memperbaiki dua puluh faktur masukan tidak boleh menemukan satu
   * kekurangan per percobaan — Module 08 §8.
   *
   * Syarat formal selebihnya adalah konfigurasi yang menunggu konsultan pajak;
   * yang diperiksa di sini hanyalah syarat yang dapat diturunkan dari data yang
   * sudah kita punya, dan itu dinyatakan alih-alih dipura-purakan lengkap.
   */
  async validate(invoiceId: string): Promise<ValidateResult> {
    const faktur = await this.invoices.loadInput(invoiceId)
    if (faktur === null) return { kind: 'not_found' }

    const kekurangan: Defect[] = []

    const profil = await this.config.loadProfile(faktur.companyId)
    if (profil === null || !profil.isPkp) {
      kekurangan.push({
        code: 'company_not_pkp',
        detail:
          'Company belum berstatus PKP, sehingga pajak masukan tidak dapat dikreditkan sama sekali.',
      })
    }

    if (!faktur.vendorIsPkp) {
      kekurangan.push({
        code: 'vendor_not_pkp',
        detail:
          'Vendor tidak berstatus PKP saat transaksi, sehingga ia tidak dapat menerbitkan faktur pajak yang dapat dikreditkan.',
      })
    }

    if (faktur.vendorNpwp === null || faktur.vendorNpwp.trim() === '') {
      kekurangan.push({
        code: 'vendor_npwp_missing',
        detail: 'NPWP vendor kosong. Lengkapi di Vendor → Data Pajak, lalu validasi ulang.',
      })
    }

    if (faktur.supplierNumber.trim() === '') {
      kekurangan.push({
        code: 'supplier_number_missing',
        detail: 'Nomor faktur pajak dari vendor belum dicatat.',
      })
    }

    const versi = await this.config.findVersionById(faktur.taxCodeId)
    if (versi !== null && !versi.isCreditable) {
      kekurangan.push({
        code: 'tax_code_not_creditable',
        detail: `Kode pajak ${versi.code} ditandai tidak dapat dikreditkan.`,
      })
    }

    const dapatDikreditkan = kekurangan.length === 0
    await this.invoices.replaceDefects(invoiceId, kekurangan)
    await this.invoices.markValidated(invoiceId, dapatDikreditkan, this.now())

    await this.ledger.append({
      companyId: faktur.companyId,
      taxPeriod: faktur.creditPeriod ?? faktur.taxPeriod,
      taxCodeId: faktur.taxCodeId,
      direction: 'in',
      documentType: 'input_tax_invoice',
      documentId: invoiceId,
      documentDate: faktur.invoiceDate,
      partnerId: faktur.vendorId,
      partnerNpwp: faktur.vendorNpwp,
      baseAmount: faktur.baseAmount,
      taxAmount: faktur.taxAmount,
      isCreditable: dapatDikreditkan,
      nonCreditableReason: dapatDikreditkan
        ? null
        : kekurangan.map((butir) => butir.code).join(', '),
      createdBy: null,
    })

    return { kind: 'validated', isCreditable: dapatDikreditkan, defects: kekurangan }
  }

  /** Periode pengkreditan dapat berbeda dari periode fakturnya — Module 08 §4. */
  async setCreditPeriod(invoiceId: string, period: string): Promise<'ok' | 'not_found'> {
    const faktur = await this.invoices.loadInput(invoiceId)
    if (faktur === null) return 'not_found'
    await this.invoices.setCreditPeriod(invoiceId, period)
    return 'ok'
  }
}
