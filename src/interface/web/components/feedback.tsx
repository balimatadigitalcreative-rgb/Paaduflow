import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import styles from './primitives.module.css'

/**
 * Avatar, tooltip, dan indikator pemuatan —
 * Component_Specs_Primitives §9, §10, §11.
 */

const UKURAN = { sm: styles.avatarSm, md: styles.avatarMd, lg: styles.avatarLg } as const

/**
 * Latar berwarna per identitas — §9 memintanya diturunkan deterministik dari
 * id — **belum diterapkan**. Ia memerlukan palet warna identitas yang tidak ada
 * di `tokens.json`, dan mengarang warna di komponen persis yang dilarang D-025.
 * Sampai paletnya ada, seluruh avatar memakai satu latar netral. Pembeda
 * identitas untuk sementara adalah inisial dan bentuk.
 */
export function Avatar({
  name,
  shape = 'circle',
  size = 'md',
}: {
  readonly name: string
  /** Company memakai rounded square; orang memakai lingkaran. */
  readonly shape?: 'circle' | 'square'
  readonly size?: keyof typeof UKURAN
}): ReactNode {
  const inisial = name
    .split(/\s+/)
    .slice(0, 2)
    .map((kata) => kata.charAt(0).toUpperCase())
    .join('')

  return (
    <span
      className={[styles.avatar, UKURAN[size], shape === 'square' ? styles.avatarSquare : null]
        .filter(Boolean)
        .join(' ')}
      title={name}
    >
      <span aria-hidden="true">{inisial}</span>
      <span className={styles.srOnly}>{name}</span>
    </span>
  )
}

const TOOLTIP_DELAY_MS = 400

/**
 * Tooltip muncul setelah 400ms dan menghilang seketika.
 *
 * Ia tidak pernah berisi informasi yang hanya ada di sana: perangkat sentuh
 * tidak dapat menampilkannya sama sekali. Informasi penting masuk ke helper text.
 */
export function Tooltip({
  label,
  children,
}: {
  readonly label: string
  readonly children: ReactNode
}): ReactNode {
  const [tampil, setTampil] = useState(false)
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => (timer === null ? undefined : clearTimeout(timer)), [timer])

  function mulai(): void {
    setTimer(setTimeout(() => setTampil(true), TOOLTIP_DELAY_MS))
  }

  function berhenti(): void {
    if (timer !== null) clearTimeout(timer)
    setTampil(false)
  }

  return (
    <span
      className={styles.tooltipWrap}
      onMouseEnter={mulai}
      onMouseLeave={berhenti}
      onFocus={mulai}
      onBlur={berhenti}
      onKeyDown={(event) => {
        if (event.key === 'Escape') berhenti()
      }}
    >
      {children}
      {tampil ? (
        <span role="tooltip" className={styles.tooltip}>
          {label}
        </span>
      ) : null}
    </span>
  )
}

export function Spinner({ label }: { readonly label: string }): ReactNode {
  return (
    <span role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <span className={styles.srOnly}>{label}</span>
    </span>
  )
}

/**
 * Skeleton wajib menyerupai bentuk konten akhir, bukan kotak abu generik.
 * Skeleton yang bentuknya salah menyebabkan pergeseran layout saat data tiba —
 * dan itu memindahkan tombol tepat saat pengguna hendak mengkliknya.
 */
export function SkeletonText({ lines = 3 }: { readonly lines?: number }): ReactNode {
  return (
    <span aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className={styles.skeletonLine} />
      ))}
    </span>
  )
}

const AMBANG_TAMPIL_MS = 300

/**
 * Ambang pemuatan — §11.
 *
 * Di bawah 300ms tidak menampilkan apa pun: indikator yang berkedip lebih
 * mengganggu daripada jeda singkat yang tidak terlihat.
 */
export function DelayedLoading({
  loading,
  children,
  skeleton,
}: {
  readonly loading: boolean
  readonly children: ReactNode
  readonly skeleton: ReactNode
}): ReactNode {
  const [tampilkan, setTampilkan] = useState(false)

  useEffect(() => {
    if (!loading) {
      setTampilkan(false)
      return
    }
    const timer = setTimeout(() => setTampilkan(true), AMBANG_TAMPIL_MS)
    return () => clearTimeout(timer)
  }, [loading])

  if (!loading) return children
  return tampilkan ? skeleton : null
}
