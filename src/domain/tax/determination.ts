/**
 * Pemilihan aturan penentuan pajak — Module 08 §6.
 *
 * Kembaran `domain/accounting/determination.ts`, dengan satu penyimpangan yang
 * disengaja: aturan menjawab **kode** (`PPN-OUT`), bukan baris `tax_codes`.
 *
 * Kalau ia menjawab baris, maka setiap perubahan tarif — yang selalu berarti
 * baris baru — memaksa seluruh aturan penentuan ditulis ulang, dan aturan yang
 * harus ditulis ulang setiap kali tarif berubah adalah aturan yang akan
 * tertinggal. Resolusi karena itu dua langkah, dan langkah kedua ada di
 * `rates.ts`: kode ditambah tanggal dokumen menjawab versinya.
 *
 * Murni dan tanpa basis data. Tanpa jam, juga: satu-satunya tanggal yang
 * dikenal berkas ini adalah tanggal yang diberikan pemanggil.
 */

export interface TaxDeterminationContext {
  readonly transactionType: string
  readonly itemCategoryId?: string | null
  readonly partnerType?: string | null
  /** Status PKP mitra pada saat transaksi, bukan pada hari ini. */
  readonly partnerIsPkp?: boolean | null
  readonly regionCode?: string | null
}

export interface TaxDeterminationRule {
  readonly id: string
  readonly transactionType: string
  readonly itemCategoryId: string | null
  readonly partnerType: string | null
  readonly partnerIsPkp: boolean | null
  readonly regionCode: string | null
  readonly taxCode: string
}

/**
 * Bobot berjenjang, bukan hitungan rata — alasannya sama dengan D-011.
 *
 * `partnerIsPkp` diberi bobot lebih tinggi daripada `partnerType` karena ia
 * yang menentukan apakah pajaknya ada sama sekali, sedangkan jenis mitra hanya
 * menentukan perlakuannya.
 *
 * Nilainya kembar dengan kolom terhitung di `tax_determination_rules`. Test
 * membandingkan keduanya terhadap basis data sungguhan.
 */
export const TAX_SPECIFICITY_WEIGHTS = {
  itemCategoryId: 8,
  partnerIsPkp: 4,
  regionCode: 2,
  partnerType: 1,
} as const

export function specificityOf(rule: TaxDeterminationRule): number {
  return (
    (rule.itemCategoryId === null ? 0 : TAX_SPECIFICITY_WEIGHTS.itemCategoryId) +
    (rule.partnerIsPkp === null ? 0 : TAX_SPECIFICITY_WEIGHTS.partnerIsPkp) +
    (rule.regionCode === null ? 0 : TAX_SPECIFICITY_WEIGHTS.regionCode) +
    (rule.partnerType === null ? 0 : TAX_SPECIFICITY_WEIGHTS.partnerType)
  )
}

/** Sebuah aturan cocok bila setiap dimensinya yang terisi sama dengan konteks. */
export function matches(rule: TaxDeterminationRule, context: TaxDeterminationContext): boolean {
  if (rule.transactionType !== context.transactionType) return false

  const cocok = <T>(nilaiAturan: T | null, nilaiKonteks: T | null | undefined): boolean =>
    nilaiAturan === null || nilaiAturan === (nilaiKonteks ?? null)

  return (
    cocok(rule.itemCategoryId, context.itemCategoryId) &&
    cocok(rule.partnerIsPkp, context.partnerIsPkp) &&
    cocok(rule.regionCode, context.regionCode) &&
    cocok(rule.partnerType, context.partnerType)
  )
}

export type TaxDeterminationOutcome =
  | { readonly kind: 'resolved'; readonly rule: TaxDeterminationRule; readonly specificity: number }
  /**
   * Tidak ada aturan yang cocok. Perhitungan ditolak — tidak ada kode pajak
   * cadangan dan tidak ada tarif nol yang diam-diam dipakai. Tarif nol yang
   * muncul dari ketiadaan aturan tidak dapat dibedakan dari tarif nol yang
   * memang diputuskan, dan perbedaan itu yang ditanyakan pemeriksa.
   */
  | { readonly kind: 'not_found'; readonly context: TaxDeterminationContext }
  /**
   * Dua aturan berskor sama-sama tertinggi. Ditolak, bukan diambil yang
   * pertama: dua tarif yang sama-sama dapat dibenarkan adalah dua tarif yang
   * tidak dapat dipertanggungjawabkan.
   */
  | { readonly kind: 'ambiguous'; readonly candidates: readonly TaxDeterminationRule[] }

export function resolveTaxCode(
  rules: readonly TaxDeterminationRule[],
  context: TaxDeterminationContext,
): TaxDeterminationOutcome {
  const cocok = rules.filter((rule) => matches(rule, context))
  if (cocok.length === 0) return { kind: 'not_found', context }

  const tertinggi = Math.max(...cocok.map(specificityOf))
  const kandidat = cocok.filter((rule) => specificityOf(rule) === tertinggi)

  if (kandidat.length > 1) return { kind: 'ambiguous', candidates: kandidat }
  return { kind: 'resolved', rule: kandidat[0]!, specificity: tertinggi }
}

/** Pesan penolakan menyebutkan dimensi apa yang dicari, supaya tidak ditebak. */
export function explainNotFound(context: TaxDeterminationContext): string {
  const dimensi = [
    context.itemCategoryId == null ? null : `kategori item ${context.itemCategoryId}`,
    context.partnerIsPkp == null
      ? null
      : `mitra ${context.partnerIsPkp ? 'PKP' : 'non-PKP'}`,
    context.regionCode == null ? null : `wilayah ${context.regionCode}`,
    context.partnerType == null ? null : `jenis mitra ${context.partnerType}`,
  ].filter((bagian): bagian is string => bagian !== null)

  const konteks = dimensi.length === 0 ? 'tanpa dimensi tambahan' : dimensi.join(', ')
  return `Tidak ada aturan pajak untuk ${context.transactionType} dengan ${konteks}. Tambahkan aturan di Pengaturan → Penentuan Pajak.`
}
