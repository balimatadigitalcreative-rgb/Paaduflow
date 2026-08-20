import type { ReactNode } from 'react'

import styles from './primitives.module.css'

/**
 * Tab — Flow_Archetypes 1.
 *
 * Urutan empat tab pertama BAKU di seluruh produk: Ringkasan · Baris ·
 * Dokumen terkait · Aktivitas. Modul boleh menambah, tidak boleh mengubah
 * urutan keempatnya. Keseragaman itulah gunanya: yang hafal satu modul hafal
 * semuanya.
 *
 * Dipakai di page header, bukan di dalam badan halaman — Layout_System §3.
 */

export interface TabItem {
  readonly id: string
  readonly label: string
  /** Angka di sebelah label, mis. jumlah baris. Nol tetap ditampilkan. */
  readonly count?: number
}

export interface TabsProps {
  readonly items: readonly TabItem[]
  readonly activeId: string
  readonly label: string
  onSelect(id: string): void
}

export function Tabs({ items, activeId, label, onSelect }: TabsProps): ReactNode {
  /**
   * Panah kiri/kanan memindah tab, sesuai pola tablist WAI-ARIA. Tanpa ini,
   * pengguna keyboard harus menekan Tab melewati setiap tab untuk mencapai
   * kontennya.
   */
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const arah = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (arah === 0) return
    event.preventDefault()

    const sekarang = items.findIndex((item) => item.id === activeId)
    const berikut = (sekarang + arah + items.length) % items.length
    const tujuan = items[berikut]
    if (tujuan !== undefined) onSelect(tujuan.id)
  }

  return (
    <div role="tablist" aria-label={label} className={styles.tabs} onKeyDown={onKeyDown}>
      {items.map((item) => {
        const aktif = item.id === activeId
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={aktif}
            aria-controls={`panel-${item.id}`}
            tabIndex={aktif ? 0 : -1}
            className={styles.tab}
            data-active={aktif}
            onClick={() => onSelect(item.id)}
          >
            {item.label}
            {item.count === undefined ? null : (
              <span className={styles.tabCount}>{item.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({
  id,
  activeId,
  children,
}: {
  readonly id: string
  readonly activeId: string
  readonly children: ReactNode
}): ReactNode {
  if (id !== activeId) return null
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={0}>
      {children}
    </div>
  )
}
