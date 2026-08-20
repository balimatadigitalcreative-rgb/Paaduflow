import type { ReactNode } from 'react'

import styles from './primitives.module.css'

/**
 * Filter bar — Component_Specs_Composite §2.
 *
 * Quick filter chips ditetapkan saat desain modul, bukan dipilih pengguna —
 * karena itu `chips` datang sebagai prop, bukan dari state internal.
 *
 * **Badge jumlah filter aktif selalu terlihat, dan "Hapus semua" selalu satu
 * klik.** Filter yang tersembunyi adalah penyebab paling umum orang
 * menyimpulkan datanya hilang — lalu melaporkannya sebagai kehilangan data.
 */

export interface FilterChip {
  readonly id: string
  readonly label: string
}

export interface FilterBarProps {
  readonly chips: readonly FilterChip[]
  readonly activeIds: readonly string[]
  readonly label: string
  onToggle(id: string): void
  onClearAll(): void
}

export function FilterBar({
  chips,
  activeIds,
  label,
  onToggle,
  onClearAll,
}: FilterBarProps): ReactNode {
  const jumlah = activeIds.length

  return (
    <div className={styles.filterBar} role="group" aria-label={label}>
      {chips.map((chip) => {
        const aktif = activeIds.includes(chip.id)
        return (
          <button
            key={chip.id}
            type="button"
            className={styles.filterChip}
            data-active={aktif}
            aria-pressed={aktif}
            onClick={() => onToggle(chip.id)}
          >
            {chip.label}
          </button>
        )
      })}

      {jumlah === 0 ? null : (
        <>
          <span className={styles.filterCount}>
            {jumlah === 1 ? '1 filter aktif' : `${jumlah} filter aktif`}
          </span>
          <button type="button" className={styles.filterClear} onClick={onClearAll}>
            Hapus semua
          </button>
        </>
      )}
    </div>
  )
}
