/**
 * Langkah kedua penentuan pajak: kode ditambah tanggal menjawab versinya.
 *
 * Seluruh berkas ini ada karena satu kalimat di Module 08 §5: dokumen dihitung
 * dengan tarif yang berlaku **pada tanggal dokumen**, tidak pernah pada tanggal
 * hari ini. Menghitung ulang dokumen tahun lalu harus menghasilkan angka yang
 * sama persis seperti saat dilaporkan.
 *
 * Karena itu tidak ada satu pun panggilan jam di berkas ini, dan tidak ada satu
 * pun angka tarif. Keduanya masuk dari luar.
 */

export type TaxType = 'vat_out' | 'vat_in' | 'withholding' | 'exempt' | 'not_collected'
export type CalculationBase = 'net' | 'gross'

export interface TaxCodeVersion {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly taxType: TaxType
  readonly rate: number
  /** Berlaku pada [validFrom, validTo). `validTo` null berarti terbuka. */
  readonly validFrom: string
  readonly validTo: string | null
  readonly calculationBase: CalculationBase
  readonly glAccountId: string
  readonly isCreditable: boolean
  readonly status: 'active' | 'inactive'
}

/** Tanggal sebagai `YYYY-MM-DD`, dibandingkan sebagai string karena ISO urut. */
export type IsoDate = string

export function isEffectiveOn(version: TaxCodeVersion, date: IsoDate): boolean {
  if (date < version.validFrom) return false
  return version.validTo === null || date < version.validTo
}

export type VersionOutcome =
  | { readonly kind: 'resolved'; readonly version: TaxCodeVersion }
  /**
   * Kode ada, tetapi tidak ada versinya yang berlaku pada tanggal itu.
   *
   * Dibedakan dari "kode tidak ada" karena jalan keluarnya berbeda: yang satu
   * membuat kodenya, yang lain membuat versi bertanggal yang menutupi lubang.
   */
  | { readonly kind: 'no_version_on_date'; readonly code: string; readonly date: IsoDate }
  /**
   * Dua versi berlaku pada tanggal yang sama. Basis data seharusnya melarangnya
   * lewat constraint EXCLUDE; kalau ia sampai ke sini, yang rusak bukan datanya
   * melainkan penjaganya — dan itu harus berisik, bukan diam-diam diambil satu.
   */
  | { readonly kind: 'overlapping'; readonly versions: readonly TaxCodeVersion[] }

export function versionOn(
  versions: readonly TaxCodeVersion[],
  code: string,
  date: IsoDate,
): VersionOutcome {
  const berlaku = versions.filter(
    (version) => version.code === code && isEffectiveOn(version, date),
  )

  if (berlaku.length === 0) return { kind: 'no_version_on_date', code, date }
  if (berlaku.length > 1) return { kind: 'overlapping', versions: berlaku }
  return { kind: 'resolved', version: berlaku[0]! }
}

/**
 * Menutup versi lama saat versi baru lahir.
 *
 * Perubahan tarif adalah dua langkah yang tidak dapat dipisah: baris baru
 * dengan `validFrom`, dan baris lama ditutup dengan `validTo` yang sama.
 * Fungsi ini menghitung langkah kedua sehingga tidak ada yang perlu
 * mengingatnya, dan menolak tanggal yang membuat lubang atau tumpang tindih.
 */
export type SupersedeOutcome =
  | { readonly kind: 'closes'; readonly previousId: string; readonly validTo: IsoDate }
  /** Tidak ada versi sebelumnya — ini versi pertama kodenya. */
  | { readonly kind: 'first_version' }
  | { readonly kind: 'not_after_previous'; readonly previousValidFrom: IsoDate }
  | { readonly kind: 'previous_already_closed'; readonly previousValidTo: IsoDate }

export function supersede(
  versions: readonly TaxCodeVersion[],
  code: string,
  newValidFrom: IsoDate,
): SupersedeOutcome {
  const sekode = versions
    .filter((version) => version.code === code)
    .sort((a, b) => (a.validFrom < b.validFrom ? 1 : -1))

  const sebelumnya = sekode[0]
  if (sebelumnya === undefined) return { kind: 'first_version' }

  if (newValidFrom <= sebelumnya.validFrom) {
    return { kind: 'not_after_previous', previousValidFrom: sebelumnya.validFrom }
  }
  if (sebelumnya.validTo !== null && sebelumnya.validTo <= newValidFrom) {
    // Menutup yang sudah tertutup akan meninggalkan lubang tanggal di antara
    // keduanya, dan lubang berarti dokumen yang tidak dapat dihitung.
    return { kind: 'previous_already_closed', previousValidTo: sebelumnya.validTo }
  }

  return { kind: 'closes', previousId: sebelumnya.id, validTo: newValidFrom }
}
