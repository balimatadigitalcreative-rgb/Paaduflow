/**
 * Pemilihan aturan penentuan akun — Module 07 §6, D-011.
 *
 * Murni dan tanpa basis data, karena di sinilah logika yang paling mahal bila
 * salah: akun yang keliru tidak terlihat di layar mana pun sampai tutup buku.
 */

export interface DeterminationContext {
  readonly transactionType: string
  readonly itemCategoryId?: string | null
  readonly warehouseId?: string | null
  readonly taxCodeId?: string | null
  readonly partnerType?: string | null
}

export interface DeterminationRule {
  readonly id: string
  readonly transactionType: string
  readonly itemCategoryId: string | null
  readonly warehouseId: string | null
  readonly taxCodeId: string | null
  readonly partnerType: string | null
  readonly accountId: string
}

/**
 * Bobot berjenjang, bukan hitungan rata.
 *
 * Dengan bobot rata, aturan ber-kategori-item dan aturan
 * ber-gudang+pajak+partner dapat berskor sama — dan pemenangnya ditentukan
 * urutan baris, yaitu tidak ditentukan sama sekali. Bobot berjenjang membuat
 * dimensi yang lebih menentukan selalu menang.
 *
 * Nilainya kembar dengan kolom terhitung di `account_determination_rules`.
 * Test membandingkan keduanya terhadap basis data sungguhan.
 */
export const SPECIFICITY_WEIGHTS = {
  itemCategoryId: 8,
  warehouseId: 4,
  taxCodeId: 2,
  partnerType: 1,
} as const

export function specificityOf(rule: DeterminationRule): number {
  return (
    (rule.itemCategoryId === null ? 0 : SPECIFICITY_WEIGHTS.itemCategoryId) +
    (rule.warehouseId === null ? 0 : SPECIFICITY_WEIGHTS.warehouseId) +
    (rule.taxCodeId === null ? 0 : SPECIFICITY_WEIGHTS.taxCodeId) +
    (rule.partnerType === null ? 0 : SPECIFICITY_WEIGHTS.partnerType)
  )
}

/** Sebuah aturan cocok bila setiap dimensinya yang terisi sama dengan konteks. */
export function matches(rule: DeterminationRule, context: DeterminationContext): boolean {
  if (rule.transactionType !== context.transactionType) return false

  const cocok = (nilaiAturan: string | null, nilaiKonteks: string | null | undefined): boolean =>
    nilaiAturan === null || nilaiAturan === (nilaiKonteks ?? null)

  return (
    cocok(rule.itemCategoryId, context.itemCategoryId) &&
    cocok(rule.warehouseId, context.warehouseId) &&
    cocok(rule.taxCodeId, context.taxCodeId) &&
    cocok(rule.partnerType, context.partnerType)
  )
}

export type DeterminationOutcome =
  | { readonly kind: 'resolved'; readonly rule: DeterminationRule; readonly specificity: number }
  /**
   * Tidak ada aturan yang cocok. Posting ditolak — tidak ada akun cadangan.
   * Akun cadangan menyembunyikan salah konfigurasi sampai tutup buku, dan pada
   * titik itu ratusan jurnal sudah salah.
   */
  | { readonly kind: 'not_found'; readonly context: DeterminationContext }
  /**
   * Dua aturan berskor sama-sama tertinggi. Ditolak, bukan diambil yang
   * pertama: konfigurasi yang tidak dapat dijelaskan lebih baik ketahuan saat
   * resolve daripada saat tutup buku.
   */
  | { readonly kind: 'ambiguous'; readonly candidates: readonly DeterminationRule[] }

export function resolveAccount(
  rules: readonly DeterminationRule[],
  context: DeterminationContext,
): DeterminationOutcome {
  const cocok = rules.filter((rule) => matches(rule, context))
  if (cocok.length === 0) return { kind: 'not_found', context }

  const tertinggi = Math.max(...cocok.map(specificityOf))
  const kandidat = cocok.filter((rule) => specificityOf(rule) === tertinggi)

  if (kandidat.length > 1) return { kind: 'ambiguous', candidates: kandidat }
  return { kind: 'resolved', rule: kandidat[0]!, specificity: tertinggi }
}

/**
 * Pesan penolakan menyebutkan aturan apa yang kurang.
 *
 * "Tidak ada aturan akun" tanpa menyebut konteksnya memaksa orang menebak, dan
 * yang menebak akan membuat aturan tangkap-semua — yang mengembalikan masalah
 * akun cadangan lewat pintu lain.
 */
export function explainNotFound(context: DeterminationContext): string {
  const dimensi = [
    context.itemCategoryId == null ? null : `kategori item ${context.itemCategoryId}`,
    context.warehouseId == null ? null : `gudang ${context.warehouseId}`,
    context.taxCodeId == null ? null : `kode pajak ${context.taxCodeId}`,
    context.partnerType == null ? null : `jenis mitra ${context.partnerType}`,
  ].filter((bagian): bagian is string => bagian !== null)

  const konteks = dimensi.length === 0 ? 'tanpa dimensi tambahan' : dimensi.join(', ')
  return `Tidak ada aturan akun untuk ${context.transactionType} dengan ${konteks}. Tambahkan aturan di Pengaturan → Penentuan Akun.`
}
