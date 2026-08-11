/**
 * Mesin transisi dokumen — Flow_Archetypes §2.
 *
 * Transisi adalah **data**, bukan `switch`. Fungsi di berkas ini menerima
 * daftar transisi yang dimuat dari basis data dan memutuskan; ia tidak memuat
 * satu pun aturan modul di dalamnya.
 *
 * Alasannya: `switch` per modul adalah dialek, dan dialek itu akan menyebar ke
 * dua puluh modul berikutnya.
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

export type SalesDocType = 'quotation' | 'order' | 'invoice'

export interface Transition {
  readonly docType: SalesDocType
  readonly from: LifecycleStatus
  readonly to: LifecycleStatus
  /** Syarat yang diperiksa layanan, mis. `credit_limit`, `not_own_document`. */
  readonly requires: readonly string[]
}

export interface TransitionRequest {
  readonly docType: SalesDocType
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
