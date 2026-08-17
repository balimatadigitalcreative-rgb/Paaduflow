import { explainVariance, matchThreeWay, type Variance } from '#domain/purchasing/three-way-match'
import { evaluateTransition } from '#shared/document-lifecycle'

import type {
  AccountResolverPort,
  AuditPort,
  BillSnapshot,
  LedgerPort,
  PurchaseDocumentPort,
} from './ports'

/**
 * Posting tagihan vendor — Module 06 §11 dan §12.
 *
 * Dua hal yang tidak dapat ditawar di berkas ini:
 *
 * 1. `post()` tidak menerima satu pun parameter yang melonggarkan pencocokan.
 *    Tidak ada `force`, tidak ada `skipMatch`, tidak ada `allowException`.
 *    Kalau kontrol bisa dilewati dengan parameter, ia bukan kontrol. Satu-satunya
 *    jalan melewati pencocokan adalah `OverrideMatchService`, yang menuntut izin
 *    lain, alasan tertulis, dan meninggalkan peristiwa audit tersendiri.
 *
 * 2. Utang usaha lahir di sini dan hanya di sini. Penerimaan barang menulis ke
 *    akun perantara; posting tagihan yang memindahkannya menjadi utang. Selisih
 *    antara keduanya pada saat mana pun adalah barang yang sudah datang tetapi
 *    belum ditagih — angka yang dapat diperiksa, bukan angka yang harus dipercaya.
 */

export type PostBillResult =
  | { readonly kind: 'posted'; readonly journalId: string }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'transition_rejected'; readonly reason: string }
  | {
      readonly kind: 'match_failed'
      readonly variances: readonly Variance[]
      readonly reasons: readonly string[]
    }
  | { readonly kind: 'separation_of_duties'; readonly reason: string }
  | { readonly kind: 'account_unresolved'; readonly reason: string }
  | { readonly kind: 'ledger_rejected'; readonly reason: string }

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Yang memposting tagihan tidak boleh yang memaafkan ketidakcocokannya.
 *
 * Ditegakkan di layanan, bukan di katalog izin, karena ia bergantung pada
 * relasi pengguna dengan dokumen — sama alasannya dengan `canApprove` di
 * Penjualan (D-009). Seseorang yang memegang kedua izin tetap tidak dapat
 * memakai keduanya pada tagihan yang sama.
 */
export function canPostAfterOverride(bill: BillSnapshot, poster: string): boolean {
  return bill.overrideBy === null || bill.overrideBy !== poster
}

/** Pengaju tagihan tidak boleh memaafkan ketidakcocokan tagihannya sendiri. */
export function canOverrideMatch(bill: BillSnapshot, requester: string): boolean {
  return bill.createdBy !== requester && bill.submittedBy !== requester
}

export class PostBillService {
  constructor(
    private readonly documents: PurchaseDocumentPort,
    private readonly accounts: AccountResolverPort,
    private readonly ledger: LedgerPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * Tidak ada parameter keempat. Bentuk tanda tangan inilah kontrolnya —
   * penelepon tidak punya cara menyatakan "posting saja meski tidak cocok".
   */
  async post(billId: string, postedBy: string): Promise<PostBillResult> {
    const tagihan = await this.documents.loadBillForPosting(billId)
    if (tagihan === null) return { kind: 'not_found' }

    // ── Pencocokan dijalankan ulang di sini ───────────────────────────────
    //
    // Bukan dibaca dari kolom. Kolom `match_status` mungkin disetel jam lalu,
    // sebelum penerimaan dibatalkan atau baris diubah. Yang menentukan adalah
    // keadaan sekarang.
    const toleransi = await this.documents.loadTolerance(tagihan.companyId)
    const cocok = matchThreeWay(tagihan.lines, toleransi)

    if (cocok.status === 'exception') {
      // Pengecualian yang sudah disetujui tetap menghasilkan selisih; yang
      // membedakannya adalah adanya persetujuan, bukan hilangnya selisih.
      if (tagihan.matchStatus !== 'overridden') {
        await this.documents.setMatchStatus(billId, 'exception')
        return {
          kind: 'match_failed',
          variances: cocok.variances,
          reasons: cocok.variances.map(explainVariance),
        }
      }

      if (!canPostAfterOverride(tagihan, postedBy)) {
        return {
          kind: 'separation_of_duties',
          reason:
            'Pengguna yang menyetujui pengecualian pencocokan tidak dapat memposting tagihan yang sama.',
        }
      }
    } else if (tagihan.matchStatus !== 'overridden') {
      await this.documents.setMatchStatus(billId, 'matched')
    }

    const periodeTerbuka = await this.documents.isFiscalPeriodOpen(
      tagihan.companyId,
      tagihan.fiscalYear,
      tagihan.fiscalPeriod,
    )

    const transisi = evaluateTransition(await this.documents.listTransitions(), {
      docType: 'bill',
      from: tagihan.lifecycleStatus,
      to: 'posted',
      satisfied: [
        ...(periodeTerbuka ? ['fiscal_period_open'] : []),
        // Syarat ini hanya dipenuhi setelah pemeriksaan di atas lolos.
        'three_way_matched',
      ],
    })

    if (transisi.kind === 'not_permitted') {
      return {
        kind: 'transition_rejected',
        reason: `Tagihan berstatus ${tagihan.lifecycleStatus} tidak dapat diposting. Tujuan yang tersedia: ${transisi.available.join(', ') || 'tidak ada'}.`,
      }
    }
    if (transisi.kind === 'requirements_unmet') {
      return { kind: 'transition_rejected', reason: `Syarat belum terpenuhi: ${transisi.missing.join(', ')}.` }
    }

    // ── Jurnal ────────────────────────────────────────────────────────────
    //
    // Debit akun perantara sebesar nilai yang dicocokkan (kuantitas ditagih ×
    // harga PESANAN), bukan nilai tagihan. Itulah angka yang dulu dikredit
    // saat barang diterima; memakai angka lain akan meninggalkan sisa abadi
    // di akun perantara.
    const barisJurnal: { accountId: string; debit: number; credit: number }[] = []
    let nilaiPerantara = 0
    let selisihHarga = 0
    let beban = 0

    for (const baris of tagihan.lines) {
      const nilaiPesanan = round2(baris.qtyBilled * baris.orderedUnitPrice)
      const nilaiTagihan = round2(baris.qtyBilled * baris.billedUnitPrice)

      if (baris.itemId !== null) {
        nilaiPerantara = round2(nilaiPerantara + nilaiPesanan)
        selisihHarga = round2(selisihHarga + (nilaiTagihan - nilaiPesanan))
      } else {
        // Jasa dan barang non-persediaan tidak pernah melewati akun perantara:
        // tidak ada penerimaan fisik yang mendahuluinya.
        beban = round2(beban + nilaiTagihan)
      }
    }

    if (nilaiPerantara !== 0) {
      const perantara = await this.accounts.resolve({
        companyId: tagihan.companyId,
        transactionType: 'purchasing.receipt.clearing',
      })
      if (perantara.kind === 'unresolved') {
        return { kind: 'account_unresolved', reason: perantara.reason }
      }
      barisJurnal.push({ accountId: perantara.accountId, debit: nilaiPerantara, credit: 0 })
    }

    if (selisihHarga !== 0) {
      const varian = await this.accounts.resolve({
        companyId: tagihan.companyId,
        transactionType: 'purchasing.bill.price_variance',
      })
      if (varian.kind === 'unresolved') {
        return { kind: 'account_unresolved', reason: varian.reason }
      }
      barisJurnal.push(
        selisihHarga > 0
          ? { accountId: varian.accountId, debit: selisihHarga, credit: 0 }
          : { accountId: varian.accountId, debit: 0, credit: -selisihHarga },
      )
    }

    if (beban !== 0) {
      for (const baris of tagihan.lines) {
        if (baris.itemId !== null) continue
        const akun = await this.accounts.resolve({
          companyId: tagihan.companyId,
          transactionType: 'purchasing.bill.expense',
          itemCategoryId: baris.itemCategoryId,
          taxCodeId: baris.taxCodeId,
        })
        if (akun.kind === 'unresolved') {
          return { kind: 'account_unresolved', reason: akun.reason }
        }
        barisJurnal.push({
          accountId: akun.accountId,
          debit: round2(baris.qtyBilled * baris.billedUnitPrice),
          credit: 0,
        })
      }
    }

    if (tagihan.taxTotal > 0) {
      const pajak = await this.accounts.resolve({
        companyId: tagihan.companyId,
        transactionType: 'purchasing.bill.tax_input',
      })
      if (pajak.kind === 'unresolved') {
        return { kind: 'account_unresolved', reason: pajak.reason }
      }
      barisJurnal.push({ accountId: pajak.accountId, debit: tagihan.taxTotal, credit: 0 })
    }

    const utang = await this.accounts.resolve({
      companyId: tagihan.companyId,
      transactionType: 'purchasing.bill.payable',
    })
    if (utang.kind === 'unresolved') {
      return { kind: 'account_unresolved', reason: utang.reason }
    }
    barisJurnal.push({ accountId: utang.accountId, debit: 0, credit: tagihan.total })

    const jurnal = await this.ledger.postJournal({
      companyId: tagihan.companyId,
      journalDate: this.now(),
      fiscalYear: tagihan.fiscalYear,
      fiscalPeriod: tagihan.fiscalPeriod,
      currency: tagihan.currency,
      sourceType: 'purchase_document',
      sourceId: tagihan.id,
      lines: barisJurnal,
    })

    if (jurnal.kind === 'rejected') {
      return { kind: 'ledger_rejected', reason: jurnal.reason }
    }

    await this.documents.applyBilledQuantities(
      tagihan.lines
        .filter((baris) => baris.sourceLineId !== null && baris.qtyBilled > 0)
        .map((baris) => ({ sourceLineId: baris.sourceLineId as string, qty: baris.qtyBilled })),
    )

    await this.documents.markPosted(tagihan.id, postedBy, this.now())
    return { kind: 'posted', journalId: jurnal.journalId }
  }
}

export type OverrideResult =
  | { readonly kind: 'overridden' }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'nothing_to_override' }
  | { readonly kind: 'reason_required' }
  | { readonly kind: 'not_overridable'; readonly reasons: readonly string[] }
  | { readonly kind: 'separation_of_duties'; readonly reason: string }
  | { readonly kind: 'already_posted' }

/** Alasan sependek ini bukan alasan. Angka dipilih agar "ok" dan "sudah dicek" tertolak. */
const PANJANG_ALASAN_MINIMUM = 20

/**
 * Satu-satunya jalan melewati pencocokan tiga arah.
 *
 * Ia layanan tersendiri dengan izin tersendiri karena memaafkan selisih adalah
 * keputusan yang berbeda jenis dari memposting tagihan. Menyatukannya ke dalam
 * `post()` akan membuat setiap orang yang boleh memposting juga boleh memaafkan.
 */
export class OverrideMatchService {
  constructor(
    private readonly documents: PurchaseDocumentPort,
    private readonly audit: AuditPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async override(billId: string, requester: string, reason: string): Promise<OverrideResult> {
    const tagihan = await this.documents.loadBillForPosting(billId)
    if (tagihan === null) return { kind: 'not_found' }
    if (tagihan.lifecycleStatus === 'posted') return { kind: 'already_posted' }

    const bersih = reason.trim()
    if (bersih.length < PANJANG_ALASAN_MINIMUM) return { kind: 'reason_required' }

    if (!canOverrideMatch(tagihan, requester)) {
      return {
        kind: 'separation_of_duties',
        reason:
          'Pengguna yang membuat atau mengajukan tagihan tidak dapat menyetujui pengecualian pencocokannya.',
      }
    }

    const toleransi = await this.documents.loadTolerance(tagihan.companyId)
    const cocok = matchThreeWay(tagihan.lines, toleransi)
    // Override atas tagihan yang tidak bermasalah akan mencatat persetujuan
    // yang tidak pernah dibutuhkan, dan mengaburkan arti kolom override.
    if (cocok.status === 'matched') return { kind: 'nothing_to_override' }

    // Satu jenis selisih tidak dapat dimaafkan siapa pun: menagih barang yang
    // belum datang. Ia tidak punya toleransi di domain dan tidak punya
    // pengecualian di sini — jalan keluarnya adalah mencatat penerimaan atau
    // memperbaiki tagihan, bukan menyetujuinya.
    const takTermaafkan = cocok.variances.filter(
      (selisih) => selisih.kind === 'billed_over_received',
    )
    if (takTermaafkan.length > 0) {
      return { kind: 'not_overridable', reasons: takTermaafkan.map(explainVariance) }
    }

    const saat = this.now()
    await this.documents.recordOverride(billId, requester, bersih, saat)

    // Peristiwa tersendiri, bukan bagian dari peristiwa posting — supaya
    // "siapa memaafkan apa" dapat dicari tanpa membaca seluruh riwayat posting.
    await this.audit.record({
      companyId: tagihan.companyId,
      action: 'pembelian.pencocokan.override',
      entityType: 'purchase_document',
      entityId: billId,
      actorId: requester,
      payload: {
        reason: bersih,
        bill_number: tagihan.number,
        variances: cocok.variances.map((selisih) => ({
          kind: selisih.kind,
          line_no: selisih.lineNo,
          expected: selisih.expected,
          actual: selisih.actual,
          difference: selisih.difference,
        })),
      },
    })

    return { kind: 'overridden' }
  }
}
