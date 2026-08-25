import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'

import { Field, useFieldIds, type BaseFieldProps } from './field.js'
import styles from './primitives.module.css'

/**
 * Select dan combobox — Component_Specs_Primitives §5.
 *
 * Pemilihan komponen mengikuti jumlah opsi: 2–7 memakai `select` sederhana,
 * 8–50 memakai combobox berpencarian, dan di atas itu combobox async dengan
 * pencarian sisi server. Pelanggan, item, dan akun perkiraan **selalu** async —
 * jumlahnya tak terbatas dan memuat seluruhnya akan menggantung browser pada
 * tenant besar.
 */

export interface Option {
  readonly value: string
  readonly label: string
}

export interface SelectProps extends BaseFieldProps {
  readonly value: string
  readonly options: readonly Option[]
  onChange(value: string): void
}

export function Select(props: SelectProps): ReactNode {
  const ids = useFieldIds(props)

  return (
    <Field props={props} ids={ids}>
      <div className={styles.control} data-invalid={props.error !== undefined}>
        <select
          id={ids.controlId}
          name={props.name}
          className={styles.input}
          value={props.value}
          disabled={props.disabled}
          aria-invalid={props.error !== undefined || undefined}
          aria-describedby={ids.describedBy}
          data-testid={props['data-testid']}
          onChange={(event) => props.onChange(event.target.value)}
        >
          {props.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </Field>
  )
}

/**
 * Lima keadaan yang wajib dirancang, bukan muncul sendiri:
 * memuat · kosong · tidak ada hasil untuk pencarian ini · gagal memuat ·
 * opsi terpilih yang berada di luar halaman hasil saat ini.
 *
 * Keadaan ketiga berbeda dari kedua. "Belum ada pelanggan" dan "tidak ada
 * pelanggan bernama itu" menuntut tindakan yang berbeda dari pengguna.
 */
export type ComboboxState =
  | { kind: 'ready'; options: readonly Option[] }
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'no_match' }
  | { kind: 'error'; message: string }

export interface ComboboxProps extends BaseFieldProps {
  readonly value: Option | null
  readonly state: ComboboxState
  onSearch(query: string): void
  onChange(option: Option | null): void
}

export function Combobox(props: ComboboxProps): ReactNode {
  const { t } = useTranslation()

  const ids = useFieldIds(props)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = `${ids.controlId}-daftar`

  const options = props.state.kind === 'ready' ? props.state.options : []

  useEffect(() => {
    setHighlighted(0)
  }, [props.state])

  function pilih(option: Option): void {
    props.onChange(option)
    setOpen(false)
    setQuery('')
    inputRef.current?.focus()
  }

  function onKeyDown(event: React.KeyboardEvent): void {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setHighlighted((index) => Math.min(index + 1, options.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Enter' && open) {
      const dipilih = options[highlighted]
      if (dipilih !== undefined) {
        event.preventDefault()
        pilih(dipilih)
      }
    }
  }

  return (
    <Field props={props} ids={ids}>
      <div
        className={styles.control}
        data-invalid={props.error !== undefined}
        data-disabled={props.disabled === true}
      >
        <input
          ref={inputRef}
          id={ids.controlId}
          name={props.name}
          className={styles.input}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={props.error !== undefined || undefined}
          aria-describedby={ids.describedBy}
          data-testid={props['data-testid']}
          disabled={props.disabled}
          // Opsi terpilih tetap terbaca meski ia berada di luar halaman hasil
          // saat ini — nilainya datang dari `value`, bukan dari daftar.
          value={open ? query : (props.value?.label ?? '')}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            props.onSearch(event.target.value)
          }}
          onKeyDown={onKeyDown}
        />
      </div>

      {open ? (
        <div className={styles.listbox}>
          {props.state.kind === 'loading' ? (
            <p className={styles.listMessage}>{t('status.memuat')}</p>
          ) : props.state.kind === 'error' ? (
            <p className={styles.listMessage} role="alert">
              {props.state.message}
            </p>
          ) : props.state.kind === 'empty' ? (
            <p className={styles.listMessage}>{t('status.belumAdaPilihan')}</p>
          ) : props.state.kind === 'no_match' ? (
            // Berbeda dari kosong: yang satu berarti belum ada apa-apa, yang
            // lain berarti pencariannya yang tidak cocok.
            <p className={styles.listMessage}>{t('status.tidakAdaHasilPencarian')}</p>
          ) : (
            <ul id={listId} role="listbox" aria-label={props.label} className={styles.paletteList}>
              {options.map((option, index) => (
                <li key={option.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === highlighted}
                    className={styles.listOption}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => pilih(option)}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </Field>
  )
}
