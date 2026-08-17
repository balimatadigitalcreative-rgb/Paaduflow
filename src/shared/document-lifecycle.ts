/**
 * Mesin siklus hidup dokumen — Flow_Archetypes Archetype 2.
 *
 * Dipindahkan dari `domain/sales/` di Sesi Pembelian. Ia tidak pernah menjadi
 * logika Penjualan: ia kontrak desain untuk setiap modul yang punya dokumen
 * bersiklus. Selama ia tinggal di rumah satu modul, modul kedua hanya punya dua
 * pilihan — menyalinnya atau melanggar batas modul, dan keduanya menghasilkan
 * dialek yang Flow_Archetypes ada untuk mencegah.
 *
 * Jenis dokumen bertipe `string`, bukan union per modul. Mesinnya tidak perlu
 * tahu ada berapa jenis dokumen di produk ini; tabel transisi yang tahu.
 */

export type LifecycleStatus =
  | 'draft'
  | 'submitted'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'posted'
  | 'cancelled'
  | 'void'
  | 'closed'

export interface Transition {
  readonly docType: string
  readonly from: LifecycleStatus
  readonly to: LifecycleStatus
  /** Syarat yang diperiksa layanan, mis. `credit_limit`, `not_own_document`. */
  readonly requires: readonly string[]
}

export interface TransitionRequest {
  readonly docType: string
  readonly from: LifecycleStatus
  readonly to: LifecycleStatus
  /** Syarat yang sudah dipenuhi pemanggil. */
  readonly satisfied: readonly string[]
}

export type TransitionVerdict =
  | { readonly kind: 'allowed' }
  /** Perpindahan itu tidak ada di tabel — bukan "belum boleh", melainkan tidak pernah boleh. */
  | { readonly kind: 'not_permitted'; readonly available: readonly LifecycleStatus[] }
  /** Perpindahannya sah, tetapi syaratnya belum dipenuhi. */
  | { readonly kind: 'requirements_unmet'; readonly missing: readonly string[] }

export function evaluateTransition(
  transitions: readonly Transition[],
  request: TransitionRequest,
): TransitionVerdict {
  const cocok = transitions.find(
    (item) =>
      item.docType === request.docType && item.from === request.from && item.to === request.to,
  )

  if (cocok === undefined) {
    // Menyebutkan tujuan yang tersedia mengubah penolakan menjadi petunjuk.
    const tersedia = transitions
      .filter((item) => item.docType === request.docType && item.from === request.from)
      .map((item) => item.to)
    return { kind: 'not_permitted', available: tersedia }
  }

  const kurang = cocok.requires.filter((syarat) => !request.satisfied.includes(syarat))
  if (kurang.length > 0) return { kind: 'requirements_unmet', missing: kurang }

  return { kind: 'allowed' }
}

/** Status yang menandai dokumen sudah menyentuh buku besar. */
export const POSTED_STATUSES: readonly LifecycleStatus[] = ['posted', 'void']

export function isEditable(status: LifecycleStatus): boolean {
  // Dokumen terposting tidak dapat diedit oleh peran mana pun — D-008.
  return status === 'draft' || status === 'rejected'
}

/** Nomor diberikan saat submit, bukan saat draf dibuat — D-007. */
export function needsNumber(to: LifecycleStatus): boolean {
  return to === 'submitted'
}

/**
 * Hasil perpindahan status yang dijaga basis data.
 *
 * `evaluateTransition` di atas menjaga di lapisan layanan, dengan pesan yang
 * menuntun. Tipe ini menjaga di lapisan kedua: UPDATE-nya sendiri menolak
 * bergerak bila status asalnya tidak sah, sehingga layanan yang lupa memeriksa
 * tidak dapat menggeser dokumen diam-diam.
 *
 * Dua lapis dengan sengaja. Yang pertama menjelaskan, yang kedua menjamin.
 */
export type StatusGuardResult =
  | { readonly kind: 'applied' }
  | {
      readonly kind: 'state_restricted'
      readonly current: LifecycleStatus
      readonly available: readonly LifecycleStatus[]
    }
  | { readonly kind: 'not_found' }

/** Kalimat penolakan yang menyebutkan keadaan sekarang dan jalan yang tersisa. */
export function explainStateRestriction(
  action: string,
  current: LifecycleStatus,
  available: readonly LifecycleStatus[],
): string {
  const jalan = available.length === 0 ? 'tidak ada' : available.join(', ')
  return `Dokumen berstatus ${current} tidak dapat ${action}. Tujuan yang tersedia dari status ini: ${jalan}.`
}
