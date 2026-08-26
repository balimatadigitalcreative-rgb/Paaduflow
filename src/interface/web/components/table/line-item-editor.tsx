import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'

import { formatAmount } from '#shared/money-format'
import { calculateDocument } from '#shared/line-items'

import styles from './line-item-editor.module.css'

/**
 * Line-item editor — Flow_Archetypes §4.
 *
 * Dipakai di Faktur, Tagihan, Pesanan, Penawaran, Jurnal, Penyesuaian Stok,
 * dan BOM. Dibangun sekali, dengan benar.
 *
 * Keyboard-first bukan fitur tambahan: orang yang menginput empat puluh baris
 * faktur tidak akan menyentuh tetikus, dan editor yang memaksanya adalah editor
 * yang gagal.
 */

export interface EditableLine {
  readonly id: string
  readonly description: string
  readonly quantity: number
  readonly unitPrice: number
  readonly discountPercent: number
  readonly taxRatePercent: number
}

type FieldId = 'description' | 'quantity' | 'unitPrice' | 'discountPercent' | 'taxRatePercent'

const FIELDS: readonly { id: FieldId; label: string; numeric: boolean }[] = [
  { id: 'description', label: 'Deskripsi', numeric: false },
  { id: 'quantity', label: 'Kuantitas', numeric: true },
  { id: 'unitPrice', label: 'Harga satuan', numeric: true },
  { id: 'discountPercent', label: 'Diskon %', numeric: true },
  { id: 'taxRatePercent', label: 'Pajak %', numeric: true },
]

export function emptyLine(id: string): EditableLine {
  return { id, description: '', quantity: 1, unitPrice: 0, discountPercent: 0, taxRatePercent: 11 }
}

export interface LineItemEditorProps {
  readonly lines: readonly EditableLine[]
  readonly currency: string
  readonly documentDiscountAmount?: number
  readonly withholdingAmount?: number
  /** Dokumen terposting: baris tidak dapat dihapus, hanya lewat dokumen koreksi. */
  readonly locked?: boolean
  readonly newId: () => string
  onChange(lines: EditableLine[]): void
}

export function LineItemEditor(props: LineItemEditorProps): ReactNode {
  const { t } = useTranslation()

  const sel = useRef(new Map<string, HTMLInputElement>())

  const hasil = calculateDocument({
    currency: props.currency,
    lines: props.lines.map((line) => ({
      id: line.id,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountPercent: line.discountPercent,
      taxRatePercent: line.taxRatePercent,
    })),
    ...(props.documentDiscountAmount === undefined
      ? {}
      : { documentDiscountAmount: props.documentDiscountAmount }),
    ...(props.withholdingAmount === undefined
      ? {}
      : { withholdingAmount: props.withholdingAmount }),
  })

  const kunci = (row: number, field: FieldId): string => `${row}:${field}`

  function fokus(row: number, field: FieldId): void {
    // Ditunda satu tick supaya baris yang baru ditambahkan sudah terpasang.
    queueMicrotask(() => sel.current.get(kunci(row, field))?.focus())
  }

  function ubah(index: number, field: FieldId, value: string): void {
    const berikutnya = [...props.lines]
    const baris = berikutnya[index]
    if (baris === undefined) return

    berikutnya[index] =
      field === 'description'
        ? { ...baris, description: value }
        : { ...baris, [field]: Number(value.replace(',', '.')) || 0 }

    props.onChange(berikutnya)
  }

  function tambahBaris(setelah: number): void {
    const berikutnya = [...props.lines]
    berikutnya.splice(setelah + 1, 0, emptyLine(props.newId()))
    props.onChange(berikutnya)
    fokus(setelah + 1, 'description')
  }

  function onKeyDown(event: React.KeyboardEvent, index: number, field: FieldId): void {
    const kolomTerakhir = FIELDS[FIELDS.length - 1]!.id
    const barisTerakhir = index === props.lines.length - 1

    if (event.key === 'Enter') {
      event.preventDefault()
      // Enter di sel terakhir membuat baris baru; selain itu turun satu baris
      // pada kolom yang sama.
      if (field === kolomTerakhir && barisTerakhir) tambahBaris(index)
      else if (!barisTerakhir) fokus(index + 1, field)
      return
    }

    if (event.key.toLowerCase() === 'd' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      const atas = props.lines[index - 1]
      if (atas === undefined) return
      const berikutnya = [...props.lines]
      berikutnya[index] = { ...berikutnya[index]!, [field]: atas[field] }
      props.onChange(berikutnya)
      return
    }

    if (event.key === 'Backspace' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      // Dokumen terposting tidak boleh kehilangan baris — koreksi lewat
      // dokumen lain, bukan lewat penghapusan diam-diam.
      if (props.locked === true || props.lines.length <= 1) return
      props.onChange(props.lines.filter((_, posisi) => posisi !== index))
      fokus(Math.max(index - 1, 0), field)
    }
  }

  /**
   * Tempelan blok dari Excel mengisi banyak baris sekaligus.
   *
   * Baris yang kurang ditambahkan; kolom yang kurang diabaikan. Tanpa ini,
   * memindahkan dua ratus baris dari spreadsheet berarti dua ratus kali
   * mengetik ulang.
   */
  function onPaste(event: React.ClipboardEvent, index: number, field: FieldId): void {
    const teks = event.clipboardData.getData('text')
    if (!teks.includes('\t') && !teks.includes('\n')) return

    event.preventDefault()

    const blok = teks
      .replace(/\r/g, '')
      .split('\n')
      .filter((baris) => baris.trim() !== '')
      .map((baris) => baris.split('\t'))

    const mulaiKolom = FIELDS.findIndex((item) => item.id === field)
    const berikutnya = [...props.lines]

    blok.forEach((sel, offset) => {
      const posisi = index + offset
      if (berikutnya[posisi] === undefined) berikutnya[posisi] = emptyLine(props.newId())

      sel.forEach((nilai, kolom) => {
        const target = FIELDS[mulaiKolom + kolom]
        if (target === undefined) return
        const baris = berikutnya[posisi]!
        berikutnya[posisi] =
          target.id === 'description'
            ? { ...baris, description: nilai.trim() }
            : { ...baris, [target.id]: Number(nilai.trim().replace(/\./g, '').replace(',', '.')) || 0 }
      })
    })

    props.onChange(berikutnya)
  }

  return (
    <div className={styles.editor}>
      <table className={styles.grid}>
        <caption className={styles.srOnly}>
        {t('baris.petunjukPanjang')}
      </caption>
        <thead>
          <tr>
            {FIELDS.map((field) => (
              <th key={field.id} scope="col" className={field.numeric ? styles.numeric : undefined}>
                {field.label}
              </th>
            ))}
            <th scope="col" className={styles.numeric}>
              {t('baris.neto')}
            </th>
          </tr>
        </thead>
        <tbody>
          {props.lines.map((line, index) => (
            <tr key={line.id}>
              {FIELDS.map((field) => (
                <td key={field.id}>
                  <input
                    ref={(el) => {
                      if (el === null) sel.current.delete(kunci(index, field.id))
                      else sel.current.set(kunci(index, field.id), el)
                    }}
                    className={field.numeric ? styles.numericInput : styles.cellInput}
                    type="text"
                    inputMode={field.numeric ? 'decimal' : 'text'}
                    aria-label={t('baris.selBaris', { kolom: field.label, nomor: index + 1 })}
                    value={String(line[field.id])}
                    onChange={(event) => ubah(index, field.id, event.target.value)}
                    onKeyDown={(event) => onKeyDown(event, index, field.id)}
                    onPaste={(event) => onPaste(event, index, field.id)}
                  />
                </td>
              ))}
              <td className={styles.computed}>
                {formatAmount(hasil.lines[index]?.net ?? 0, props.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className={styles.hint}>
        {t('baris.petunjukPendek')}
      </p>

      <dl className={styles.totals}>
        <dt>{t('baris.subtotal')}</dt>
        <dd className={styles.totalValue}>{formatAmount(hasil.subtotal, props.currency)}</dd>
        <dt>{t('baris.diskonDokumen')}</dt>
        <dd className={styles.totalValue}>{formatAmount(hasil.documentDiscount, props.currency)}</dd>
        <dt>DPP</dt>
        <dd className={styles.totalValue}>{formatAmount(hasil.taxBase, props.currency)}</dd>
        <dt>{t('baris.pajak')}</dt>
        <dd className={styles.totalValue}>{formatAmount(hasil.taxTotal, props.currency)}</dd>
        <dt className={styles.grandTotal}>{t('baris.total')}</dt>
        <dd className={`${styles.totalValue} ${styles.grandTotal}`}>
          {formatAmount(hasil.total, props.currency)}
        </dd>
      </dl>
    </div>
  )
}
