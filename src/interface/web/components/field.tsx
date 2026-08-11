import { useId } from 'react'
import type { ReactNode } from 'react'

import styles from './primitives.module.css'

/**
 * Kerangka bersama seluruh field: label di atas, lalu kontrol, lalu satu baris
 * keterangan — helper ATAU error, tidak pernah keduanya.
 *
 * Setiap komponen menerima `id`, `name`, `aria-describedby`, dan `data-testid`.
 * Tanpa `data-testid`, QA akan menulis selector berbasis kelas CSS dan setiap
 * perubahan desain mematahkan test suite.
 */

export interface BaseFieldProps {
  readonly id?: string
  readonly name?: string
  readonly label: string
  readonly helper?: string
  readonly error?: string
  readonly required?: boolean
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly 'aria-describedby'?: string
  readonly 'data-testid'?: string
}

export interface FieldIds {
  readonly controlId: string
  /** Gabungan describedby milik komponen dan milik pemanggil. */
  readonly describedBy: string | undefined
  readonly messageId: string
}

export function useFieldIds(props: BaseFieldProps): FieldIds {
  const generated = useId()
  const controlId = props.id ?? generated
  const messageId = `${controlId}-pesan`
  const punyaPesan = props.error !== undefined || props.helper !== undefined

  const daftar = [punyaPesan ? messageId : null, props['aria-describedby'] ?? null].filter(
    (item): item is string => item !== null,
  )

  return {
    controlId,
    describedBy: daftar.length === 0 ? undefined : daftar.join(' '),
    messageId,
  }
}

export function Field({
  props,
  ids,
  children,
}: {
  props: BaseFieldProps
  ids: FieldIds
  children: ReactNode
}): ReactNode {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={ids.controlId}>
        {props.label}
        {props.required === true ? (
          <span className={styles.required} aria-hidden="true">
            {' *'}
          </span>
        ) : null}
      </label>

      {children}

      {/* Satu baris, tidak pernah dua. Error menggantikan helper. */}
      {props.error !== undefined ? (
        <p id={ids.messageId} className={styles.error} role="alert">
          {props.error}
        </p>
      ) : props.helper !== undefined ? (
        <p id={ids.messageId} className={styles.helper}>
          {props.helper}
        </p>
      ) : null}
    </div>
  )
}
