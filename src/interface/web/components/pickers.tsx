import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { formatDate, parseDate } from '#shared/date-format'
import { formatPeriod, periodKey, periodsOfYear, type FiscalPeriod } from '#shared/fiscal-period'

import { Field, useFieldIds, type BaseFieldProps } from './field.js'
import styles from './primitives.module.css'

/**
 * Pemilih tanggal dan pemilih periode fiskal —
 * Component_Specs_Primitives §6.
 */

export interface DateFieldProps extends BaseFieldProps {
  readonly value: Date | null
  onChange(value: Date | null): void
}

/**
 * Pengetikan manual adalah jalur utama, bukan pelengkap. Akuntan mengetik
 * tanggal jauh lebih cepat daripada mengkliknya, jadi input teks menerima
 * `10/8/2026`, `2026-08-10`, dan `10 Agu 2026` — lalu merapikannya saat blur.
 */
export function DateField(props: DateFieldProps): ReactNode {
  const ids = useFieldIds(props)
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)

  const tampil = props.value === null ? '' : formatDate(props.value)

  useEffect(() => {
    if (!focused) setDraft(tampil)
  }, [focused, tampil])

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
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="10 Agu 2026"
          value={draft}
          readOnly={props.readOnly}
          disabled={props.disabled}
          aria-invalid={props.error !== undefined || undefined}
          aria-describedby={ids.describedBy}
          data-testid={props['data-testid']}
          onFocus={() => setFocused(true)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            setFocused(false)
            const tanggal = parseDate(draft)
            props.onChange(tanggal)
            setDraft(tanggal === null ? '' : formatDate(tanggal))
          }}
        />
      </div>
    </Field>
  )
}

export interface FiscalPeriodPickerProps extends BaseFieldProps {
  readonly fiscalYear: number
  readonly fiscalYearStartMonth: number
  readonly value: FiscalPeriod | null
  onChange(period: FiscalPeriod): void
}

/**
 * Komponen tersendiri, bukan varian pemilih tanggal.
 *
 * Setiap opsi menampilkan label fiskal **dan** bulan kalendernya:
 * `FY2026 P3 · Sep 2026`. Menampilkan `P3` saja memaksa setiap penggunanya
 * menghitung sendiri, dan sebagian akan salah — terutama pada company yang
 * tahun fiskalnya tidak dimulai Januari.
 */
export function FiscalPeriodPicker(props: FiscalPeriodPickerProps): ReactNode {
  const ids = useFieldIds(props)
  const periode = periodsOfYear(props.fiscalYear, props.fiscalYearStartMonth)

  return (
    <Field props={props} ids={ids}>
      <div className={styles.control} data-invalid={props.error !== undefined}>
        <select
          id={ids.controlId}
          name={props.name}
          className={styles.input}
          value={props.value === null ? '' : periodKey(props.value)}
          disabled={props.disabled}
          aria-describedby={ids.describedBy}
          data-testid={props['data-testid']}
          onChange={(event) => {
            const dipilih = periode.find((item) => periodKey(item) === event.target.value)
            if (dipilih !== undefined) props.onChange(dipilih)
          }}
        >
          {periode.map((item) => (
            <option key={periodKey(item)} value={periodKey(item)}>
              {formatPeriod(item)}
            </option>
          ))}
        </select>
      </div>
    </Field>
  )
}
