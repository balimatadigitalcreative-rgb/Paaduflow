import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

import { Field, useFieldIds, type BaseFieldProps } from './field.js'
import styles from './primitives.module.css'

/**
 * Text input dan textarea — Component_Specs_Primitives §2 dan §4.
 */

export interface TextFieldProps extends BaseFieldProps {
  readonly value: string
  readonly placeholder?: string
  readonly type?: 'text' | 'email' | 'tel' | 'url'
  onChange(value: string): void
}

export function TextField(props: TextFieldProps): ReactNode {
  const ids = useFieldIds(props)

  return (
    <Field props={props} ids={ids}>
      <div
        className={styles.control}
        data-invalid={props.error !== undefined}
        data-disabled={props.disabled === true}
        data-readonly={props.readOnly === true}
      >
        <input
          id={ids.controlId}
          name={props.name}
          className={styles.input}
          type={props.type ?? 'text'}
          value={props.value}
          // Readonly tetap dapat difokus dan disalin; disabled tidak. Nomor
          // dokumen dan NPWP sering perlu disalin.
          readOnly={props.readOnly}
          disabled={props.disabled}
          required={props.required}
          aria-invalid={props.error !== undefined || undefined}
          aria-describedby={ids.describedBy}
          // Placeholder berisi contoh masukan yang valid, bukan pengulangan label.
          placeholder={props.placeholder}
          data-testid={props['data-testid']}
          onChange={(event) => props.onChange(event.target.value)}
        />
      </div>
    </Field>
  )
}

export interface TextAreaProps extends BaseFieldProps {
  readonly value: string
  readonly placeholder?: string
  readonly maxLength?: number
  onChange(value: string): void
}

const MAX_ROWS = 8
const NEAR_LIMIT = 0.1

export function TextArea(props: TextAreaProps): ReactNode {
  const ids = useFieldIds(props)
  const ref = useRef<HTMLTextAreaElement>(null)

  // Tinggi tumbuh mengikuti isi sampai delapan baris, lalu menggulir. Handle
  // resize dinonaktifkan — tinggi dikendalikan komponen.
  useEffect(() => {
    const el = ref.current
    if (el === null) return
    el.style.height = 'auto'
    const baris = Number.parseFloat(globalThis.getComputedStyle(el).lineHeight) || 20
    el.style.height = `${Math.min(el.scrollHeight, baris * MAX_ROWS)}px`
  }, [props.value])

  const sisa = props.maxLength === undefined ? null : props.maxLength - props.value.length
  const hampirHabis =
    sisa !== null && props.maxLength !== undefined && sisa <= props.maxLength * NEAR_LIMIT

  return (
    <Field props={props} ids={ids}>
      <div
        className={styles.control}
        data-invalid={props.error !== undefined}
        data-disabled={props.disabled === true}
        data-readonly={props.readOnly === true}
      >
        <textarea
          ref={ref}
          id={ids.controlId}
          name={props.name}
          className={styles.textarea}
          rows={2}
          value={props.value}
          readOnly={props.readOnly}
          disabled={props.disabled}
          maxLength={props.maxLength}
          aria-invalid={props.error !== undefined || undefined}
          aria-describedby={ids.describedBy}
          placeholder={props.placeholder}
          data-testid={props['data-testid']}
          onChange={(event) => props.onChange(event.target.value)}
        />
      </div>

      {/* Counter hanya muncul bila ada batas. */}
      {sisa === null ? null : (
        <p className={[styles.counter, hampirHabis ? styles.counterNearLimit : null].filter(Boolean).join(' ')}>
          {sisa} karakter tersisa
        </p>
      )}
    </Field>
  )
}
