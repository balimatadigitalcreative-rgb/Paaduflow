import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'

import { Button } from '../button.js'
import styles from './form.module.css'

/**
 * Tiga bagian Form Layout — Component_Specs_Composite §3.
 *
 * Ketiganya dibutuhkan modul referensi Penjualan, dan ketiganya dibangun
 * sebagai komponen library — bukan sebagai bagian modul — supaya modul
 * berikutnya mewarisinya alih-alih menyalinnya.
 */

export interface FieldError {
  /** `id` field yang bermasalah, dipakai untuk memindahkan fokus ke sana. */
  readonly fieldId: string
  readonly label: string
  readonly message: string
}

/**
 * Ringkasan error di atas form, dengan tautan ke tiap field.
 *
 * Untuk form pajak berisi tiga puluh field, meminta pengguna menggulir mencari
 * border merah adalah tidak manusiawi.
 */
export function ErrorSummary({ errors }: { readonly errors: readonly FieldError[] }): ReactNode {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Fokus dipindahkan ke ringkasan saat ia muncul, supaya pengguna keyboard
    // dan screen reader tahu form gagal disimpan — bukan menemukan sendiri.
    if (errors.length > 0) ref.current?.focus()
  }, [errors])

  if (errors.length === 0) return null

  return (
    <div ref={ref} className={styles.errorSummary} role="alert" tabIndex={-1}>
      <p className={styles.errorTitle}>
        {`Ada ${errors.length} isian yang perlu diperbaiki`}
      </p>
      <ul className={styles.errorList}>
        {errors.map((error) => (
          <li key={error.fieldId}>
            <a
              className={styles.errorLink}
              href={`#${error.fieldId}`}
              onClick={(event) => {
                event.preventDefault()
                document.getElementById(error.fieldId)?.focus()
              }}
            >
              {error.label}
            </a>
            {`: ${error.message}`}
          </li>
        ))}
      </ul>
    </div>
  )
}

export interface ActionFooterProps {
  readonly dirty: boolean
  readonly saving?: boolean
  readonly children?: ReactNode
  onSave(): void
  onCancel(): void
}

export function ActionFooter(props: ActionFooterProps): ReactNode {
  const { t } = useTranslation()

  return (
    <div className={styles.footer}>
      {props.dirty ? <span className={styles.dirtyNote}>{t('status.adaPerubahan')}</span> : null}
      <div className={styles.footerActions}>
        {props.children}
        <Button variant="ghost" onClick={props.onCancel}>
          {t('aksi.batal')}
        </Button>
        <Button loading={props.saving === true} onClick={props.onSave}>
          {t('aksi.simpan')}
        </Button>
      </div>
    </div>
  )
}

export interface UnsavedChangesGuardProps {
  readonly dirty: boolean
  /** Terisi bila penjaga sedang menahan sebuah perpindahan. */
  readonly pending: { readonly reason: 'navigate' | 'switch_company'; readonly label: string } | null
  onDiscard(): void
  onStay(): void
}

/**
 * Penjaga perubahan belum tersimpan.
 *
 * Berlaku juga untuk berpindah company — dan pada kasus itu konfirmasinya
 * **wajib menyebut bahwa konteks akan berubah**, karena akibatnya bukan sekadar
 * kehilangan ketikan melainkan bekerja di entitas legal yang berbeda.
 */
export function UnsavedChangesGuard(props: UnsavedChangesGuardProps): ReactNode {
  const { t } = useTranslation()

  useEffect(() => {
    if (!props.dirty) return

    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      // Menutup tab juga ditahan. Browser hanya menampilkan pesan bawaannya,
      // dan itu memang batasnya.
      event.preventDefault()
    }

    globalThis.addEventListener?.('beforeunload', onBeforeUnload)
    return () => globalThis.removeEventListener?.('beforeunload', onBeforeUnload)
  }, [props.dirty])

  if (props.pending === null) return null

  return (
    <div role="alertdialog" aria-label={t('status.adaPerubahan')} className={styles.guard}>
      <p>
        {props.pending.reason === 'switch_company'
          ? `Perubahan pada dokumen ini belum tersimpan. Berpindah ke ${props.pending.label} juga mengubah konteks company — dokumen ini tidak akan terbawa.`
          : `Perubahan pada dokumen ini belum tersimpan. Tinggalkan halaman dan buang perubahannya?`}
      </p>
      <div className={styles.guardActions}>
        <Button variant="ghost" onClick={props.onStay}>
          {t('aksi.tetapDiSini')}
        </Button>
        <Button variant="danger" onClick={props.onDiscard}>
          {t('aksi.buangPerubahan')}
        </Button>
      </div>
    </div>
  )
}
