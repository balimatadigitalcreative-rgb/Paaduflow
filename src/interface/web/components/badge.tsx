import type { ReactNode } from 'react'

import styles from './primitives.module.css'

/**
 * Badge status dan tag — Component_Specs_Primitives §8.
 *
 * Warna tidak pernah menjadi satu-satunya pembeda: setiap badge membawa titik
 * indikator **dan** teks. Ini WCAG 1.4.1, bukan preferensi — dan itulah sebabnya
 * komponen ini tidak menyediakan varian "hanya titik".
 */

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

/**
 * Kosakata status dokumen tetap lintas modul. Ia ditetapkan sekali di sini,
 * bukan diputuskan ulang per modul — Information Architecture §4.
 */
export const DOCUMENT_STATUS_LABEL = {
  draft: 'Draf',
  submitted: 'Diajukan',
  pending_approval: 'Menunggu persetujuan',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  posted: 'Diposting',
  cancelled: 'Dibatalkan',
  void: 'Void',
  closed: 'Selesai',
} as const

export type DocumentStatus = keyof typeof DOCUMENT_STATUS_LABEL

const STATUS_TONE: Record<DocumentStatus, BadgeTone> = {
  draft: 'neutral',
  submitted: 'accent',
  pending_approval: 'warning',
  approved: 'accent',
  rejected: 'danger',
  posted: 'success',
  cancelled: 'neutral',
  void: 'danger',
  closed: 'neutral',
}

const TONES: Record<BadgeTone, string | undefined> = {
  neutral: undefined,
  accent: styles.toneAccent,
  success: styles.toneSuccess,
  warning: styles.toneWarning,
  danger: styles.toneDanger,
}

export function Badge({
  tone = 'neutral',
  children,
  ...rest
}: {
  readonly tone?: BadgeTone
  readonly children: ReactNode
  readonly 'data-testid'?: string
}): ReactNode {
  return (
    <span {...rest} className={[styles.badge, TONES[tone]].filter(Boolean).join(' ')}>
      <span className={styles.dot} aria-hidden="true" />
      {children}
    </span>
  )
}

export function StatusBadge({
  status,
  ...rest
}: {
  readonly status: DocumentStatus
  readonly 'data-testid'?: string
}): ReactNode {
  return (
    <Badge tone={STATUS_TONE[status]} {...rest}>
      {DOCUMENT_STATUS_LABEL[status]}
    </Badge>
  )
}

/** Label bebas pengguna. Gaya netral, tidak pernah warna semantik. */
export function Tag({ children }: { readonly children: ReactNode }): ReactNode {
  return <span className={styles.tag}>{children}</span>
}
