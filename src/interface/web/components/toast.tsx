import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import styles from './primitives.module.css'

/**
 * Toast — Component_Specs_Composite §6.
 *
 * Dua aturan yang membatasi kapan ia boleh dipakai:
 *
 * - **Tidak pernah untuk sesuatu yang harus ditindaklanjuti.** Toast yang
 *   menghilang membawa informasi yang tidak ada di tempat lain adalah bug —
 *   bila pengguna sedang melihat ke tempat lain, informasinya hilang selamanya.
 *   Untuk itu ada inline alert dan notification center.
 * - **Selalu menyebut objek spesifiknya.** "Tersimpan" tidak berguna;
 *   "Faktur INV/2026/08/0142 diposting" berguna. Karena itu `message` di sini
 *   dituntut memuat nama objeknya, dan `undo` adalah tempat yang tepat untuk
 *   aksi yang dapat diurungkan.
 *
 * Maksimal tiga bertumpuk; sisanya antre.
 */

const MAKSIMUM_TAMPIL = 3
const UMUR_MS = 6000

export interface ToastPesan {
  readonly id: string
  /** Wajib menyebut objeknya — lihat aturan kedua di atas. */
  readonly message: string
  readonly tone?: 'netral' | 'baik' | 'buruk'
  readonly undo?: { readonly label: string; onUndo(): void }
}

type Kirim = (pesan: Omit<ToastPesan, 'id'>) => void

const Konteks = createContext<Kirim | null>(null)

export function useToast(): Kirim {
  const kirim = useContext(Konteks)
  if (kirim === null) throw new Error('useToast dipakai di luar ToastProvider.')
  return kirim
}

export function ToastProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const [antrean, setAntrean] = useState<readonly ToastPesan[]>([])
  const nomor = useRef(0)

  const kirim = useCallback<Kirim>((pesan) => {
    nomor.current += 1
    const id = `toast-${nomor.current}`
    setAntrean((lama) => [...lama, { ...pesan, id }])
  }, [])

  const tampil = antrean.slice(0, MAKSIMUM_TAMPIL)

  useEffect(() => {
    if (tampil.length === 0) return undefined
    const tertua = tampil[0]
    if (tertua === undefined) return undefined

    const jam = setTimeout(() => {
      setAntrean((lama) => lama.filter((item) => item.id !== tertua.id))
    }, UMUR_MS)
    return () => clearTimeout(jam)
  }, [tampil])

  const nilai = useMemo(() => kirim, [kirim])

  return (
    <Konteks.Provider value={nilai}>
      {children}
      {/*
        `status`, bukan `alert`: toast tidak pernah membawa hal mendesak, dan
        `alert` menyela screen reader di tengah kalimat.
      */}
      <div className={styles.toastArea} role="status" aria-live="polite">
        {tampil.map((item) => (
          <div key={item.id} className={styles.toast} data-tone={item.tone ?? 'netral'}>
            <span>{item.message}</span>
            {item.undo === undefined ? null : (
              <button
                type="button"
                className={styles.toastAction}
                onClick={() => {
                  item.undo?.onUndo()
                  setAntrean((lama) => lama.filter((t) => t.id !== item.id))
                }}
              >
                {item.undo.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Konteks.Provider>
  )
}
