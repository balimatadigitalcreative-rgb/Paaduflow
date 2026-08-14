import { calculateTax, type TaxAmount } from '#domain/tax/calculation'
import {
  explainNotFound,
  resolveTaxCode,
  type TaxDeterminationContext,
} from '#domain/tax/determination'
import { versionOn, type IsoDate } from '#domain/tax/rates'

import type { TaxConfigPort } from './ports'

/**
 * Mesin penentuan dan perhitungan pajak — Module 08 §4 dan §7.
 *
 * Inilah satu-satunya pintu tempat modul lain memperoleh angka pajak, dan ia
 * **tidak punya parameter tarif**. Modul lain mengirim konteks dan tanggal
 * dokumen; yang menjawab adalah aturan penentuan lalu versi kode pajak yang
 * berlaku pada tanggal itu.
 *
 * Tidak ada jalan memaksa tarif tertentu. Kalau ada, "hitung ulang dokumen
 * tahun lalu menghasilkan angka yang sama" berhenti menjadi jaminan dan
 * berubah menjadi harapan.
 */

export interface TaxCalculationRequest {
  readonly companyId: string
  /** Tanggal DOKUMEN, bukan tanggal hari ini. Inti seluruh modul ini. */
  readonly documentDate: IsoDate
  readonly amount: number
  readonly currency: string
  readonly context: TaxDeterminationContext
}

export type TaxCalculationResult =
  | { readonly kind: 'calculated'; readonly code: string; readonly amount: TaxAmount }
  | { readonly kind: 'rule_not_found'; readonly reason: string }
  | { readonly kind: 'rule_ambiguous'; readonly reason: string }
  | { readonly kind: 'no_rate_on_date'; readonly reason: string }
  | { readonly kind: 'overlapping_versions'; readonly reason: string }

export class TaxEngineService {
  constructor(private readonly config: TaxConfigPort) {}

  async calculate(request: TaxCalculationRequest): Promise<TaxCalculationResult> {
    // ── Langkah satu: konteks menjawab kode ───────────────────────────────
    const aturan = await this.config.listRules(
      request.companyId,
      request.context.transactionType,
    )
    const penentuan = resolveTaxCode(aturan, request.context)

    if (penentuan.kind === 'not_found') {
      return { kind: 'rule_not_found', reason: explainNotFound(penentuan.context) }
    }
    if (penentuan.kind === 'ambiguous') {
      return {
        kind: 'rule_ambiguous',
        reason: `Dua aturan pajak sama-sama paling spesifik untuk ${request.context.transactionType}. Perbaiki salah satunya di Pengaturan → Penentuan Pajak.`,
      }
    }

    // ── Langkah dua: kode dan TANGGAL DOKUMEN menjawab versinya ───────────
    const versi = versionOn(
      await this.config.listVersions(request.companyId, penentuan.rule.taxCode),
      penentuan.rule.taxCode,
      request.documentDate,
    )

    if (versi.kind === 'no_version_on_date') {
      return {
        kind: 'no_rate_on_date',
        reason: `Kode pajak ${versi.code} tidak punya tarif yang berlaku pada ${versi.date}. Tambahkan versi bertanggal yang mencakupinya.`,
      }
    }
    if (versi.kind === 'overlapping') {
      // Basis data melarangnya lewat constraint EXCLUDE. Sampai di sini berarti
      // penjaganya yang rusak, bukan datanya — dan itu harus berisik.
      return {
        kind: 'overlapping_versions',
        reason: `Dua versi kode pajak ${penentuan.rule.taxCode} sama-sama berlaku pada ${request.documentDate}. Ini seharusnya tidak mungkin; laporkan sebagai kerusakan data.`,
      }
    }

    return {
      kind: 'calculated',
      code: penentuan.rule.taxCode,
      amount: calculateTax(versi.version, {
        amount: request.amount,
        currency: request.currency,
      }),
    }
  }

  /**
   * Penguji aturan — Module 08 §8.
   *
   * Menjawab "konteks ini kena kode apa, dan aturan mana yang menang" tanpa
   * menghitung apa pun. Aturan yang tidak dapat diuji sebelum dipakai adalah
   * aturan yang akan diuji oleh dokumen sungguhan.
   */
  async explain(
    companyId: string,
    context: TaxDeterminationContext,
    documentDate: IsoDate,
  ): Promise<
    | { kind: 'resolved'; code: string; ruleId: string; specificity: number; rate: number }
    | { kind: 'unresolved'; reason: string }
  > {
    const aturan = await this.config.listRules(companyId, context.transactionType)
    const penentuan = resolveTaxCode(aturan, context)

    if (penentuan.kind === 'not_found') {
      return { kind: 'unresolved', reason: explainNotFound(penentuan.context) }
    }
    if (penentuan.kind === 'ambiguous') {
      return {
        kind: 'unresolved',
        reason: `Seri antara ${penentuan.candidates.length} aturan yang sama spesifiknya.`,
      }
    }

    const versi = versionOn(
      await this.config.listVersions(companyId, penentuan.rule.taxCode),
      penentuan.rule.taxCode,
      documentDate,
    )
    if (versi.kind !== 'resolved') {
      return {
        kind: 'unresolved',
        reason: `Aturan menunjuk ${penentuan.rule.taxCode}, tetapi tidak ada tarif yang berlaku pada ${documentDate}.`,
      }
    }

    return {
      kind: 'resolved',
      code: penentuan.rule.taxCode,
      ruleId: penentuan.rule.id,
      specificity: penentuan.specificity,
      rate: versi.version.rate,
    }
  }
}
