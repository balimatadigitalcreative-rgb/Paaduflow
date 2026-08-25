/**
 * Jalur baca untuk layar.
 *
 * Sampai sesi ini, seluruh modul hanya punya jalur tulis: layanan yang membuat,
 * mengajukan, dan memposting. Itu cukup untuk test, dan sama sekali tidak cukup
 * untuk layar — sebuah temuan yang baru terlihat saat ada yang mencoba
 * memakainya lewat mata, bukan lewat `expect`.
 *
 * Port di sini sengaja dikumpulkan dalam satu berkas lintas modul, berbeda
 * dengan port tulis yang dideklarasikan tiap modul sendiri (D-097). Alasannya:
 * yang ini tidak dipanggil modul lain, melainkan dipanggil lapisan HTTP untuk
 * menyusun tampilan. Ia kontrak antara interface dan infrastruktur, bukan
 * kontrak antar modul.
 *
 * Seluruhnya baca-saja. Tidak ada satu pun metode di berkas ini yang menulis.
 */

/** Kursor, bukan offset — D-024 dan D-041. */
export interface Page<T> {
  readonly items: readonly T[]
  readonly nextCursor: string | null
}

export interface PageRequest {
  readonly cursor?: string | null
  readonly limit?: number
}

// ── Identitas ──────────────────────────────────────────────────────────────

export interface AccessibleCompany {
  readonly id: string
  readonly tenantId: string
  readonly tenantName: string
  readonly legalName: string
  readonly slug: string
  readonly fiscalYearStartMonth: number
  readonly roleKey: string
}

/**
 * Company yang dapat diakses pengguna, lintas tenant.
 *
 * Berjalan tanpa konteks tenant — sama seperti `resolveTenantForCompany`,
 * karena tenant-nya justru yang sedang dicari (D-064).
 */
export interface CompanyDirectoryPort {
  listForUser(userId: string): Promise<readonly AccessibleCompany[]>
}

/** Bahasa antarmuka yang didukung. Cerminan `BAHASA` di lapisan web. */
export type BahasaPengguna = 'id' | 'en'

export interface ProfilPengguna {
  readonly id: string
  readonly email: string
  readonly fullName: string
  readonly language: BahasaPengguna
}

/**
 * Profil orang yang sedang masuk, beserta preferensinya.
 *
 * Terpisah dari `CompanyDirectoryPort` meski keduanya berjalan tanpa konteks
 * tenant: yang satu menjawab "company mana yang boleh saya buka", yang ini
 * menjawab "siapa saya". Layar memanggil keduanya pada saat yang sama, tetapi
 * menggabungkannya akan membuat pengalih bahasa bergantung pada daftar company
 * — dan pengalih bahasa harus tetap bekerja bagi pengguna yang belum punya
 * company sama sekali.
 */
export interface ProfilPenggunaPort {
  baca(userId: string): Promise<ProfilPengguna | null>
  simpanBahasa(userId: string, bahasa: BahasaPengguna): Promise<void>
}

// ── Data induk ─────────────────────────────────────────────────────────────
//
// Dibutuhkan setiap form yang harus memilih partner atau barang. Tanpa ini,
// formulir faktur hanya dapat menampilkan kotak isian id — yang berarti tidak
// ada yang dapat memakainya tanpa membuka basis data lebih dulu.

export interface PartnerOption {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly taxId: string | null
  /** Hanya terisi untuk vendor. Menentukan apakah PPN-nya dapat dikreditkan. */
  readonly isPkp?: boolean
}

export interface ItemOption {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly type: string
  readonly baseUom: string
}

export interface WarehouseOption {
  readonly id: string
  readonly code: string
  readonly name: string
}

export interface MasterDataPort {
  customers(companyId: string): Promise<readonly PartnerOption[]>
  vendors(companyId: string): Promise<readonly PartnerOption[]>
  items(companyId: string): Promise<readonly ItemOption[]>
  warehouses(companyId: string): Promise<readonly WarehouseOption[]>
}

// ── Penjualan ──────────────────────────────────────────────────────────────

export interface SalesDocumentSummary {
  readonly id: string
  readonly number: string | null
  readonly docType: string
  readonly customerName: string
  readonly documentDate: string
  readonly currency: string
  readonly total: number
  readonly lifecycleStatus: string
  readonly settlementStatus: string
  readonly fulfillmentStatus: string
}

export interface SalesDocumentLine {
  readonly id: string
  readonly lineNo: number
  readonly itemCode: string | null
  readonly description: string
  readonly qty: number
  readonly uom: string
  readonly unitPrice: number
  readonly discountPercent: number
  readonly netAmount: number
  readonly taxRatePercent: number
  readonly taxAmount: number
  readonly warehouseId: string | null
}

export interface SalesDocumentDetail extends SalesDocumentSummary {
  readonly customerId: string
  readonly subtotal: number
  readonly documentDiscount: number
  readonly taxBase: number
  readonly taxTotal: number
  readonly documentVersion: number
  readonly postedAt: string | null
  readonly journalId: string | null
  readonly lines: readonly SalesDocumentLine[]
}

export interface SalesQueryPort {
  list(companyId: string, page: PageRequest): Promise<Page<SalesDocumentSummary>>
  detail(companyId: string, documentId: string): Promise<SalesDocumentDetail | null>
}

// ── Pembelian ──────────────────────────────────────────────────────────────

export interface PurchaseDocumentSummary {
  readonly id: string
  readonly number: string | null
  readonly docType: string
  readonly vendorName: string
  readonly issueDate: string
  readonly currency: string
  readonly total: number
  readonly lifecycleStatus: string
  readonly matchStatus: string
}

export interface PurchaseDocumentLine {
  readonly id: string
  readonly lineNo: number
  readonly itemId: string | null
  readonly itemCode: string | null
  readonly description: string
  readonly qty: number
  readonly uom: string
  readonly unitPrice: number
  readonly qtyReceived: number
  readonly qtyBilled: number
  readonly netAmount: number
  readonly taxAmount: number
}

export interface PurchaseDocumentDetail extends PurchaseDocumentSummary {
  readonly vendorId: string
  readonly vendorIsPkp: boolean
  readonly subtotal: number
  readonly taxTotal: number
  readonly sourceDocumentId: string | null
  readonly overrideReason: string | null
  readonly lines: readonly PurchaseDocumentLine[]
}

/**
 * Satu baris panel pencocokan tiga arah: dipesan, diterima, dan ditagih
 * berdampingan — Module 06 §11.
 *
 * Angkanya dikirim apa adanya beserta selisihnya. Layar tidak menghitung ulang;
 * dua rumus untuk angka yang sama akan menyimpang, dan yang menyimpang adalah
 * angka yang dipakai memutuskan pembayaran.
 */
export interface MatchPanelLine {
  readonly lineNo: number
  readonly description: string
  readonly qtyOrdered: number
  readonly qtyReceived: number
  readonly qtyBilledBefore: number
  readonly qtyBilled: number
  readonly orderedUnitPrice: number
  readonly billedUnitPrice: number
  readonly variances: readonly {
    readonly kind: string
    readonly message: string
  }[]
}

export interface MatchPanel {
  readonly billId: string
  readonly billNumber: string | null
  readonly lifecycleStatus: string
  readonly matchStatus: string
  readonly overrideReason: string | null
  readonly matched: boolean
  readonly lines: readonly MatchPanelLine[]
}

export interface GoodsReceiptSummary {
  readonly id: string
  readonly number: string | null
  readonly purchaseOrderId: string
  readonly purchaseOrderNumber: string | null
  readonly vendorName: string
  readonly receivedDate: string
  readonly status: string
  readonly lineCount: number
}

export interface PurchaseQueryPort {
  list(
    companyId: string,
    docType: string | null,
    page: PageRequest,
  ): Promise<Page<PurchaseDocumentSummary>>
  detail(companyId: string, documentId: string): Promise<PurchaseDocumentDetail | null>
  matchPanel(companyId: string, billId: string): Promise<MatchPanel | null>
  listReceipts(companyId: string, page: PageRequest): Promise<Page<GoodsReceiptSummary>>
}

// ── Akuntansi ──────────────────────────────────────────────────────────────

export interface AccountSummary {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly type: string
  readonly isControl: boolean
  readonly balance: number
}

export interface LedgerEntry {
  readonly id: string
  readonly journalId: string
  readonly journalNumber: string | null
  readonly journalDate: string
  readonly accountCode: string
  readonly accountName: string
  readonly description: string | null
  readonly sourceType: string | null
  readonly sourceId: string | null
  readonly debit: number
  readonly credit: number
  /** Saldo berjalan sejak awal daftar, supaya layar tidak menjumlah sendiri. */
  readonly runningBalance: number
}

// ── Dasbor ─────────────────────────────────────────────────────────────────

/**
 * Satu kartu KPI - Component_Specs_Composite section 8.
 *
 * `comparisonBasis` dan `href` WAJIB, dan itu disengaja pada tingkat tipe:
 * persentase tanpa pembanding tidak bermakna, dan angka agregat tanpa jalan ke
 * sumbernya melanggar pilar Terang. Keduanya tidak dapat lupa diisi karena
 * kompilasi menolak.
 *
 * `changePercent` boleh null - periode pembanding yang tidak ada adalah
 * keadaan sah, dan mengarang nol untuk itu akan menampilkan "0%" yang berbohong.
 */
export interface DashboardKpi {
  readonly id: string
  readonly label: string
  /**
   * Null berarti BELUM TERSEDIA, bukan nol.
   *
   * Nol adalah jawaban: tidak ada pendapatan bulan ini. Null adalah ketiadaan
   * jawaban: belum ada satu pun jurnal, jadi tidak ada yang dapat dihitung.
   * Menampilkan nol untuk yang kedua membuat company yang belum mulai memakai
   * sistem terlihat seperti company yang bangkrut.
   */
  readonly value: number | null
  readonly currency: string | null
  readonly changePercent: number | null
  readonly comparisonBasis: string
  readonly higherIsBetter: boolean
  readonly href: string
  /**
   * Deret untuk sparkline di dalam kartu, urut lama ke baru.
   *
   * Kosong bila kartu itu tidak punya riwayat yang bermakna — "piutang jatuh
   * tempo" dihitung relatif terhadap hari ini, dan menggambar garisnya berarti
   * menggambar dua belas definisi berbeda sebagai satu tren.
   */
  readonly series: readonly number[]
}

export interface DashboardMonth {
  /** `2026-08`. Bulan kalender, bukan periode fiskal. */
  readonly month: string
  readonly revenue: number
}

/**
 * Satu ember umur piutang.
 *
 * Embernya ditetapkan server, bukan klien. Batas 30/60 hari adalah keputusan
 * akuntansi, dan dua tempat yang menghitungnya sendiri akan menghasilkan dua
 * angka yang suatu hari berbeda — tepat saat seseorang membandingkan dasbor
 * dengan laporan umur piutang.
 */
export interface DashboardAgeing {
  readonly id: string
  readonly label: string
  readonly amount: number
  readonly count: number
  /** Sudah lewat jatuh tempo. Menentukan nada, dan diberi pola di grafik. */
  readonly overdue: boolean
}

export interface DashboardSummary {
  readonly currency: string
  readonly kpis: readonly DashboardKpi[]
  readonly months: readonly DashboardMonth[]
  /** Jumlah dokumen yang benar-benar menunggu keputusan orang. */
  readonly awaitingApproval: number
  readonly ageing: readonly DashboardAgeing[]
}

export interface DashboardQueryPort {
  summary(companyId: string, today: string): Promise<DashboardSummary>
}

// ── Laporan Laba Rugi ──────────────────────────────────────────────────────

/**
 * Satu baris laporan, beserta induknya — Screen_Specs_HiFi §9.
 *
 * Hierarkinya dikirim datar dengan `parentId`, bukan bersarang. Bersarang
 * memaksa klien menulis rekursi untuk melipat, memfilter, dan menjumlah; datar
 * membuat ketiganya menjadi operasi biasa atas daftar. Bentuk pohonnya disusun
 * sekali di layar, di tempat ia memang dibutuhkan.
 */
export interface ProfitLossRow {
  readonly accountId: string
  readonly code: string
  readonly name: string
  /** `revenue` atau `expense`. Menentukan kelompok dan tanda. */
  readonly type: string
  readonly parentId: string | null
  /** Nilai periode yang diminta. */
  readonly amount: number
  /** Nilai periode pembanding. Null bila pembandingnya tidak diminta. */
  readonly comparison: number | null
}

export interface ProfitLossPeriod {
  readonly from: string
  readonly to: string
  /** Disebut apa adanya di header laporan — "Agustus 2026". */
  readonly label: string
}

export interface ProfitLossReport {
  readonly currency: string
  readonly period: ProfitLossPeriod
  readonly comparison: ProfitLossPeriod | null
  readonly rows: readonly ProfitLossRow[]
  /**
   * Waktu laporan dibangkitkan, dari server.
   *
   * Laporan keuangan dicetak dan diedarkan; tanpa waktu generate, dua salinan
   * dengan angka berbeda tidak dapat diurutkan mana yang lebih baru
   * (Flow_Archetypes 6).
   */
  readonly generatedAt: string
}

export interface ProfitLossQueryPort {
  report(
    companyId: string,
    period: { from: string; to: string },
    comparison: { from: string; to: string } | null,
  ): Promise<ProfitLossReport>
}

export interface AccountingQueryPort {
  chartOfAccounts(companyId: string): Promise<readonly AccountSummary[]>
  generalLedger(
    companyId: string,
    accountId: string | null,
    page: PageRequest,
  ): Promise<Page<LedgerEntry>>
}

// ── Pajak ──────────────────────────────────────────────────────────────────

/**
 * Satu VERSI kode pajak, bukan satu kode pajak.
 *
 * Kode yang sama muncul beberapa kali dengan masa berlaku berbeda, dan itulah
 * bentuk sebenarnya di basis data — tarif tidak pernah diubah, ia ditutup dan
 * digantikan (D-124). Layar yang menampilkan satu baris per kode akan
 * menyembunyikan justru hal yang paling perlu dilihat sebelum tarif diganti:
 * sejak kapan yang berlaku sekarang berlaku.
 *
 * `validTo` null berarti versi ini masih terbuka.
 */
export interface TaxCodeVersion {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly taxType: string
  readonly rate: number
  readonly validFrom: string
  readonly validTo: string | null
  readonly calculationBase: string
  readonly isCreditable: boolean
  readonly status: string
  readonly glAccountId: string
  readonly glAccountCode: string
  readonly glAccountName: string
}

/**
 * Faktur pajak keluaran dalam bentuk daftar.
 *
 * `formattedNumber` null berarti draf — nomor seri baru melekat saat terbit,
 * dan itu invarian basis data, bukan kebiasaan (Module 08 §7).
 */
export interface OutputTaxInvoiceSummary {
  readonly id: string
  readonly formattedNumber: string | null
  readonly customerName: string
  readonly customerNpwp: string | null
  readonly invoiceDate: string
  readonly taxPeriod: string
  readonly taxCode: string
  readonly baseAmount: number
  readonly taxAmount: number
  readonly status: string
}

/** Satu faktur komersial yang tercakup faktur pajak — satu faktur pajak boleh mencakup beberapa. */
export interface OutputTaxInvoiceSource {
  readonly salesDocumentId: string
  readonly salesDocumentNumber: string | null
  readonly baseAmount: number
  readonly taxAmount: number
}

export interface OutputTaxInvoiceDetail extends OutputTaxInvoiceSummary {
  readonly serialNumber: number | null
  readonly taxRate: number
  readonly issuedAt: string | null
  readonly cancelledAt: string | null
  readonly cancelReason: string | null
  readonly sources: readonly OutputTaxInvoiceSource[]
}

/**
 * Satu syarat yang tidak terpenuhi pada faktur pajak masukan.
 *
 * `detail` adalah kalimat yang dapat dibaca, bukan kode yang harus
 * diterjemahkan layar. Ia ditulis saat validasi berjalan, sehingga daftar dapat
 * menyebutkan apa yang kurang tanpa menjalankan ulang validasinya.
 */
export interface InputTaxInvoiceDefect {
  readonly code: string
  readonly detail: string
}

export interface InputTaxInvoiceSummary {
  readonly id: string
  readonly supplierNumber: string
  readonly vendorName: string
  readonly vendorNpwp: string | null
  readonly vendorIsPkp: boolean
  readonly invoiceDate: string
  readonly taxPeriod: string
  /** Boleh berbeda dari masa fakturnya — Module 08 §4. */
  readonly creditPeriod: string | null
  readonly taxCode: string
  readonly baseAmount: number
  readonly taxAmount: number
  readonly isCreditable: boolean
  readonly validatedAt: string | null
  readonly defects: readonly InputTaxInvoiceDefect[]
}

/**
 * Faktur penjualan yang layak dicakup faktur pajak keluaran.
 *
 * Syaratnya dua: sudah `posted`, dan belum tercakup faktur pajak yang masih
 * berlaku. Yang tanpa NPWP pelanggan tetap ditampilkan — ditandai, bukan
 * disembunyikan, supaya orang tahu apa yang harus dilengkapi alih-alih
 * bertanya-tanya kenapa fakturnya tidak muncul.
 */
export interface FakturLayakPajak {
  readonly id: string
  readonly number: string | null
  readonly customerId: string
  readonly customerName: string
  readonly customerNpwp: string | null
  readonly documentDate: string
  readonly taxBase: number
  readonly taxTotal: number
  readonly currency: string
}

export interface TaxQueryPort {
  /** Seluruh versi, terurut per kode lalu mundur menurut masa berlaku. */
  taxCodes(companyId: string): Promise<readonly TaxCodeVersion[]>
  outputInvoices(companyId: string, page: PageRequest): Promise<Page<OutputTaxInvoiceSummary>>
  outputInvoice(companyId: string, invoiceId: string): Promise<OutputTaxInvoiceDetail | null>
  inputInvoices(companyId: string, page: PageRequest): Promise<Page<InputTaxInvoiceSummary>>
  /** Kandidat sumber faktur pajak keluaran — sudah posted, belum tercakup. */
  eligibleSalesInvoices(companyId: string): Promise<readonly FakturLayakPajak[]>
}
