import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'

import styles from './primitives.module.css'

/**
 * Checkbox, radio, dan switch — Component_Specs_Primitives §7.
 *
 * Ketiganya terus-menerus dipakai untuk hal yang salah, jadi aturannya
 * ditegakkan lewat tipe: `Switch` tidak menerima properti `name`, karena switch
 * berlaku seketika dan tidak pernah menjadi bagian dari form bertombol Simpan.
 * Switch di dalam form yang punya tombol Simpan adalah bug — ia menjanjikan
 * efek langsung lalu tidak menepatinya.
 */

interface ChoiceBase {
  readonly id?: string
  readonly label: string
  readonly disabled?: boolean
  readonly 'data-testid'?: string
}

export interface CheckboxProps extends ChoiceBase {
  readonly name?: string
  readonly checked: boolean
  /** Sebagian baris terpilih — dipakai checkbox di header tabel. */
  readonly indeterminate?: boolean
  onChange(checked: boolean): void
}

export function Checkbox(props: CheckboxProps): ReactNode {
  const generated = useId()
  const id = props.id ?? generated
  const ref = useRef<HTMLInputElement>(null)

  // `indeterminate` hanya ada sebagai properti DOM, tidak sebagai atribut.
  // Ia harus dipasang lewat ref, dan `aria-checked="mixed"` menyertainya supaya
  // screen reader ikut mengetahuinya.
  useEffect(() => {
    if (ref.current !== null) ref.current.indeterminate = props.indeterminate === true
  }, [props.indeterminate])

  return (
    <label className={styles.choice} htmlFor={id}>
      <input
        ref={ref}
        id={id}
        name={props.name}
        type="checkbox"
        className={styles.choiceInput}
        checked={props.checked}
        disabled={props.disabled}
        aria-checked={props.indeterminate === true ? 'mixed' : props.checked}
        data-testid={props['data-testid']}
        onChange={(event) => props.onChange(event.target.checked)}
      />
      {props.label}
    </label>
  )
}

export interface RadioProps extends ChoiceBase {
  readonly name: string
  readonly value: string
  readonly checked: boolean
  onChange(value: string): void
}

export function Radio(props: RadioProps): ReactNode {
  const generated = useId()
  const id = props.id ?? generated

  return (
    <label className={styles.choice} htmlFor={id}>
      <input
        id={id}
        name={props.name}
        type="radio"
        className={styles.choiceInput}
        value={props.value}
        checked={props.checked}
        disabled={props.disabled}
        data-testid={props['data-testid']}
        onChange={() => props.onChange(props.value)}
      />
      {props.label}
    </label>
  )
}

/**
 * Switch berlaku seketika. Ia sengaja tidak menerima `name`: nilainya tidak
 * pernah ikut dikirim bersama form.
 */
export interface SwitchProps extends ChoiceBase {
  readonly checked: boolean
  onChange(checked: boolean): void
}

export function Switch(props: SwitchProps): ReactNode {
  const generated = useId()
  const id = props.id ?? generated

  return (
    <label className={styles.choice} htmlFor={id}>
      <span className={styles.switchWrap}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          className={styles.switchInput}
          checked={props.checked}
          disabled={props.disabled}
          data-testid={props['data-testid']}
          onChange={(event) => props.onChange(event.target.checked)}
        />
        <span className={styles.switchTrack} aria-hidden="true">
          <span className={styles.switchThumb} />
        </span>
      </span>
      {props.label}
    </label>
  )
}
