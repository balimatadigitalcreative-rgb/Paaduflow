import type { ButtonHTMLAttributes, ReactNode } from 'react'

import styles from './primitives.module.css'

/**
 * Button — Component_Specs_Primitives §1.
 *
 * Dua keputusan yang terlihat di kode ini:
 *
 * 1. Memuat tidak mengubah lebar. Label tetap di tempatnya; spinner menempati
 *    slot ikon. Tombol yang menyusut saat diklik menggeser seluruh baris aksi.
 * 2. Disabled memakai `aria-disabled`, bukan atribut `disabled`. Tombol
 *    ber-`disabled` hilang dari urutan fokus, sehingga pengguna keyboard tidak
 *    pernah dapat membacanya — padahal justru mereka yang paling perlu tahu
 *    tombol itu ada.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  readonly variant?: ButtonVariant
  readonly size?: ButtonSize
  readonly loading?: boolean
  readonly disabled?: boolean
  readonly icon?: ReactNode
  readonly children?: ReactNode
  readonly 'data-testid'?: string
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: styles.primary!,
  secondary: styles.secondary!,
  ghost: styles.ghost!,
  danger: styles.danger!,
  link: styles.link!,
}

const SIZES: Record<ButtonSize, string | undefined> = {
  sm: styles.sizeSm,
  md: undefined,
  lg: styles.sizeLg,
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  children,
  onClick,
  ...rest
}: ButtonProps): ReactNode {
  const tidakAktif = disabled || loading

  return (
    <button
      type="button"
      {...rest}
      className={[styles.button, VARIANTS[variant], SIZES[size]].filter(Boolean).join(' ')}
      aria-disabled={tidakAktif || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        // `aria-disabled` tidak menghentikan klik seperti `disabled`, jadi
        // penghentiannya dilakukan di sini.
        if (tidakAktif) {
          event.preventDefault()
          return
        }
        onClick?.(event)
      }}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : icon !== undefined ? (
        <span aria-hidden="true">{icon}</span>
      ) : null}
      {children}
    </button>
  )
}
