import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

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
  /**
   * Pencarian teks bebas, bila daftarnya cukup besar untuk membutuhkannya.
   *
   * Diletakkan di sini, bukan di tiap halaman, supaya posisinya sama di seluruh
   * modul. Pencarian yang berpindah tempat antar layar adalah pencarian yang
   * dicari lebih dulu sebelum dipakai.
   */
  readonly search?: {
    readonly value: string
    readonly label: string
    onChange(value: string): void
  }
  onToggle(id: string): void
  onClearAll(): void
}

export function FilterBar({
  chips,
  activeIds,
  label,
  search,
  onToggle,
  onClearAll,
}: FilterBarProps): ReactNode {
  const { t } = useTranslation()

  const jumlah = activeIds.length

  return (
    <div className={styles.filterBar} role="group" aria-label={label}>
      {search === undefined ? null : (
        <input
          type="search"
          className={styles.filterSearch}
          value={search.value}
          aria-label={search.label}
          placeholder={search.label}
          onChange={(event) => search.onChange(event.target.value)}
        />
      )}

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
            {jumlah === 1 ? '1 filter aktif' : t('filter.aktif', { count: jumlah })}
          </span>
          <button type="button" className={styles.filterClear} onClick={onClearAll}>
        {t('aksi.hapusSemua')}
      </button>
        </>
      )}
    </div>
  )
}
