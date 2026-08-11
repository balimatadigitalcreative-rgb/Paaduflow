import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { currencyAffix, formatAmount, parseAmount } from '#shared/money-format'

import { Field, useFieldIds, type BaseFieldProps } from './field.js'
import styles from './primitives.module.css'

/**
 * Input nominal — Component_Specs_Primitives §3, komponen dengan keputusan
 * terbanyak karena ia menyentuh uang.
 *
 * Empat aturan yang seluruhnya terlihat di kode ini:
 *
 * 1. Pemisah ribuan diterapkan saat **blur**, bukan saat mengetik. Memformat
 *    ulang di setiap ketukan memindahkan kursor, dan itu salah satu interaksi
 *    paling dibenci di aplikasi finansial.
 * 2. Simbol mata uang adalah affix di luar input, sehingga ia tidak pernah ikut
 *    terpilih saat pengguna menekan Ctrl+A.
 * 3. Nilai yang dilaporkan ke atas selalu numerik mentah, tidak pernah string
 *    terformat.
 * 4. Tanpa stepper naik/turun — panah tidak berguna untuk nominal finansial dan
 *    menjadi target salah klik.
 */

export interface CurrencyInputProps extends BaseFieldProps {
  readonly value: number | null
  readonly currency: string
  readonly locale?: string
  onChange(value: number | null): void
}

export function CurrencyInput(props: CurrencyInputProps): ReactNode {
  const ids = useFieldIds(props)
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')

  const terformat = props.value === null ? '' : formatAmount(props.value, props.currency, props.locale)

  // Saat tidak fokus, tampilan mengikuti nilai dari luar. Saat fokus, yang
  // ditampilkan adalah apa yang sedang diketik — tanpa disentuh formatter.
  useEffect(() => {
    if (!focused) setDraft(terformat)
  }, [focused, terformat])

  return (
    <Field props={props} ids={ids}>
      <div
        className={styles.control}
        data-invalid={props.error !== undefined}
        data-disabled={props.disabled === true}
        data-readonly={props.readOnly === true}
      >
        <span className={styles.affix} aria-hidden="true">
          {currencyAffix(props.currency)}
        </span>

        <input
          id={ids.controlId}
          name={props.name}
          className={styles.amount}
          // `text`, bukan `number`: `number` membawa stepper, menolak pemisah
          // ribuan, dan berperilaku berbeda di setiap locale.
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={draft}
          readOnly={props.readOnly}
          disabled={props.disabled}
          required={props.required}
          aria-invalid={props.error !== undefined || undefined}
          aria-describedby={ids.describedBy}
          data-testid={props['data-testid']}
          onFocus={() => {
            setFocused(true)
            // Angka mentah saat fokus — pengguna mengedit angka, bukan teks
            // terformat.
            setDraft(props.value === null ? '' : String(props.value))
          }}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            setFocused(false)
            const angka = parseAmount(draft)
            props.onChange(angka)
            setDraft(angka === null ? '' : formatAmount(angka, props.currency, props.locale))
          }}
        />
      </div>
    </Field>
  )
}
