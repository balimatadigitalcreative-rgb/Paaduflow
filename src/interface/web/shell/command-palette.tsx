import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import styles from './shell.module.css'
import { PALETTE_ORDER, type PaletteItem } from './types.js'

/**
 * Command palette — Information Architecture §6.
 *
 * Empat kelompok dengan urutan tetap: navigasi, aksi, entitas, AI.
 *
 * Hasil yang tidak diizinkan **tidak pernah diakui keberadaannya**. Tidak ada
 * "3 hasil disembunyikan", dan jumlah hasil tidak pernah menyertakannya —
 * penyaringan terjadi sebelum apa pun dihitung.
 */

export interface CommandPaletteProps {
  readonly open: boolean
  readonly items: readonly PaletteItem[]
  onClose(): void
}

export function CommandPalette({ open, items, onClose }: CommandPaletteProps): ReactNode {
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const hasil = useMemo(() => {
    const kata = query.trim().toLowerCase()
    const diizinkan = items.filter((item) => item.permitted)
    const cocok =
      kata === '' ? diizinkan : diizinkan.filter((item) => item.label.toLowerCase().includes(kata))

    return PALETTE_ORDER.flatMap((group) => cocok.filter((item) => item.group === group))
  }, [items, query])

  /*
   * Fokus dikembalikan ke tempat asalnya saat palette ditutup — §7.
   *
   * Yang diingat adalah elemen yang sedang fokus saat palette DIBUKA, bukan
   * tombol pemicunya. Palette punya dua jalur masuk: tombol "Cari" di top bar
   * dan pintasan Cmd+K dari mana saja. Mengembalikan fokus ke tombol pemicu
   * pada jalur kedua akan melempar pengguna keyboard dari tengah tabel ke top
   * bar — hukuman untuk memakai pintasan.
   */
  const asalFokus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      asalFokus.current = document.activeElement as HTMLElement | null
      return undefined
    }

    // Hanya dikembalikan bila elemennya masih ada di dokumen. Rute yang
    // berganti saat palette terbuka membuat elemen asalnya hilang, dan
    // memanggil focus() pada simpul yang sudah dilepas tidak melakukan apa pun
    // sekaligus menyembunyikan bahwa fokus kini berada di body.
    const asal = asalFokus.current
    if (asal !== null && document.contains(asal)) asal.focus()
    return undefined
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery('')
      setHighlighted(0)
      inputRef.current?.focus()
    }
  }, [open])

  if (!open) return null

  function jalankan(item: PaletteItem | undefined): void {
    if (item === undefined) return
    item.run()
    onClose()
  }

  function onKeyDown(event: React.KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((index) => Math.min(index + 1, hasil.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      jalankan(hasil[highlighted])
      return
    }
    if (event.key === 'Tab') {
      // Jebakan fokus. Lapisan mengambang tanpa jebakan akan melempar pengguna
      // keyboard ke halaman di belakangnya, yang secara visual tidak aktif.
      const fokusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])',
      )
      if (fokusable === undefined || fokusable.length === 0) return
      const pertama = fokusable[0]!
      const terakhir = fokusable[fokusable.length - 1]!
      if (event.shiftKey && document.activeElement === pertama) {
        event.preventDefault()
        terakhir.focus()
      } else if (!event.shiftKey && document.activeElement === terakhir) {
        event.preventDefault()
        pertama.focus()
      }
    }
  }

  let kelompokTerakhir: string | null = null

  return (
    <>
      <div className={styles.paletteBackdrop} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Perintah dan pencarian"
        className={styles.palette}
        onKeyDown={onKeyDown}
      >
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          className={styles.paletteInput}
          placeholder="Cari perintah, halaman, atau dokumen"
          aria-label="Cari perintah, halaman, atau dokumen"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={hasil[highlighted] ? `${listId}-${highlighted}` : undefined}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setHighlighted(0)
          }}
        />

        {hasil.length === 0 ? (
          <p className={styles.paletteEmpty}>Tidak ada hasil.</p>
        ) : (
          <ul id={listId} role="listbox" aria-label="Hasil" className={styles.paletteList}>
            {hasil.map((item, index) => {
              const kelompokBaru = item.group !== kelompokTerakhir
              kelompokTerakhir = item.group
              return (
                <li key={item.id} role="presentation">
                  {kelompokBaru ? (
                    <p className={styles.groupLabel} role="presentation">
                      {item.group}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === highlighted}
                    className={styles.paletteItem}
                    onClick={() => jalankan(item)}
                    onMouseEnter={() => setHighlighted(index)}
                  >
                    <span>{item.label}</span>
                    {item.hint === undefined ? null : (
                      <span className={styles.paletteHint}>{item.hint}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
