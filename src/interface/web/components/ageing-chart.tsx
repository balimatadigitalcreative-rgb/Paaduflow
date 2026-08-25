import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import styles from './primitives.module.css'

/**
 * Umur piutang sebagai batang bertumpuk — Component_Specs_Composite §8.
 *
 * **Batang bertumpuk, bukan donat.** Keduanya menunjukkan komposisi, tetapi
 * hanya batang yang menjaga urutan embernya. Umur piutang punya urutan alami —
 * belum jatuh tempo, 1–30, 31–60, lebih dari 60 — dan donat memaksa mata
 * mencari urutan itu di sekeliling lingkaran. Perbandingan panjang juga lebih
 * akurat dibaca manusia daripada perbandingan sudut.
 *
 * **Warna tidak pernah menjadi satu-satunya pembeda** (WCAG 1.4.1, dan
 * Color_System §2 menyebutnya syarat, bukan tambahan). Tiga pembeda dipakai
 * sekaligus: warna dari palet Okabe–Ito, ARSIR DIAGONAL pada ember yang sudah
 * lewat tempo, dan label langsung di legenda beserta nominalnya.
 *
 * Paletnya sudah aman untuk deuteranopia dan protanopia. Ia tidak diganti.
 */

export interface AgeingBucket {
  readonly id: string
  readonly label: string
  readonly amount: number
  readonly count: number
  readonly overdue: boolean
}

export interface AgeingChartProps {
  readonly buckets: readonly AgeingBucket[]
  readonly caption: string
  /** Sudah terformat — komponen ini tidak tahu mata uang maupun lokal. */
  readonly format: (nilai: number) => string
  /** Membuka rincian ember. Tanpa ini, grafik menjadi jalan buntu. */
  onPilih?: (id: string) => void
}

export function AgeingChart({
  buckets,
  caption,
  format,
  onPilih,
}: AgeingChartProps): ReactNode {
  const { t } = useTranslation()

  const total = buckets.reduce((jumlah, satu) => jumlah + satu.amount, 0)

  if (total === 0) {
    return (
      <p className={styles.chartEmpty} role="status">
        {t('grafik.piutangLunas')}
      </p>
    )
  }

  const terpakai = buckets.filter((satu) => satu.amount > 0)

  return (
    <figure className={styles.ageing}>
      {/*
        Arsir diagonal didefinisikan sekali dan dirujuk tiap ember lewat tempo.
        `patternUnits` memakai ruang pengguna supaya sudut arsirnya tetap sama
        di batang lebar maupun sempit — arsir yang ikut meregang terbaca sebagai
        pola yang berbeda.
      */}
      <svg width="0" height="0" aria-hidden="true" className={styles.ageingDefs}>
        <defs>
          <pattern id="arsir-tempo" patternUnits="userSpaceOnUse" width="6" height="6">
            <path d="M0,6 L6,0" className={styles.ageingArsir} />
          </pattern>
        </defs>
      </svg>

      <div className={styles.ageingBatang} role="img" aria-label={caption}>
        {terpakai.map((satu, indeks) => (
          <span
            key={satu.id}
            className={styles.ageingSegmen}
            data-seri={indeks + 1}
            data-tempo={satu.overdue}
            style={{ '--bagian': satu.amount }}
          />
        ))}
      </div>

      {/*
        Legenda memuat label DAN nominal DAN jumlah dokumen. Legenda yang hanya
        berisi warna memaksa mata bolak-balik antara batang dan keterangannya,
        dan pada empat ember itu sudah cukup untuk salah baca.
      */}
      <ul className={styles.ageingLegenda}>
        {buckets.map((satu, indeks) => (
          <li key={satu.id}>
            <button
              type="button"
              className={styles.ageingItem}
              disabled={satu.amount === 0 || onPilih === undefined}
              onClick={() => onPilih?.(satu.id)}
            >
              <span
                className={styles.ageingPenanda}
                data-seri={(terpakai.findIndex((t) => t.id === satu.id) + 1) || indeks + 1}
                data-tempo={satu.overdue}
                aria-hidden="true"
              />
              <span className={styles.ageingLabel}>{satu.label}</span>
              <span className={styles.ageingNilai}>{format(satu.amount)}</span>
              <span className={styles.ageingJumlah}>
                {satu.count === 0 ? '—' : `${satu.count} faktur`}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Representasi yang sebenarnya, untuk screen reader dan untuk disalin. */}
      <table className={styles.chartTable}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Umur</th>
            <th scope="col">Nilai</th>
            <th scope="col">{t('grafik.jumlahFaktur')}</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((satu) => (
            <tr key={satu.id}>
              <th scope="row">{satu.label}</th>
              <td>{format(satu.amount)}</td>
              <td>{satu.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
