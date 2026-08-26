import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import styles from './primitives.module.css'

/**
 * Grafik batang 12 bulan — Screen_Specs_HiFi §3.
 *
 * SVG inline, tanpa pustaka grafik. Satu grafik batang tidak sebanding dengan
 * 100 kB dependensi yang membawa seluruh tata bahasa visualisasi.
 *
 * **Tabel tersembunyi adalah representasi sebenarnya.** SVG hanya gambar; yang
 * dibaca screen reader adalah tabelnya, lengkap dengan angka per bulan. Grafik
 * yang hanya dapat dilihat mata bukan grafik yang dapat dipertanggungjawabkan.
 */

export interface BarPoint {
  readonly label: string
  readonly value: number
  /** Sudah terformat untuk dibaca manusia, mis. "Rp 50,3 jt". */
  readonly display: string
}

export interface BarChartProps {
  readonly points: readonly BarPoint[]
  readonly caption: string
  readonly valueHeader: string
  /**
   * Memformat nilai sumbu. Wajib — tanpa ini tinggi batang tidak berarti apa
   * pun, dan grafik yang tidak dapat dibaca angkanya hanya menghias halaman.
   *
   * Komponen ini sengaja tidak tahu mata uang maupun bahasa; yang memanggilnya
   * sudah memegang keduanya.
   */
  format(nilai: number): string
}

const TINGGI = 160
const LEBAR_BATANG = 28
const JARAK = 12

export function BarChart({ points, caption, valueHeader, format }: BarChartProps): ReactNode {
  const { t } = useTranslation()

  if (points.length === 0) {
    return (
      <p className={styles.chartEmpty} role="status">
        {t('grafik.belumAdaPeriode')}
      </p>
    )
  }

  const tertinggi = Math.max(...points.map((titik) => titik.value), 1)
  const lebar = points.length * LEBAR_BATANG + (points.length - 1) * JARAK

  /*
   * Tiga tanda sumbu: nol, tengah, tertinggi.
   *
   * Bukan lima atau tujuh. Yang dijawab sumbu di sini adalah "sebesar apa
   * kira-kira", bukan "berapa persisnya" — angka persisnya ada di tabel di
   * bawah, dan pada tooltip batangnya. Tanda yang terlalu rapat justru
   * membuat dua belas batang tenggelam di antara garis.
   *
   * Urut dari atas ke bawah, karena begitulah ia digambar.
   */
  const tanda = [tertinggi, tertinggi / 2, 0]

  return (
    <figure className={styles.chart}>
      <div className={styles.chartArea}>
        <div className={styles.chartAxis} aria-hidden="true">
          {tanda.map((nilai) => (
            <span key={nilai}>{format(nilai)}</span>
          ))}
        </div>

      <svg
        viewBox={`0 0 ${lebar} ${TINGGI}`}
        className={styles.chartSvg}
        role="img"
        aria-label={caption}
        preserveAspectRatio="none"
      >
        {tanda.map((nilai) => {
          const y = TINGGI - (nilai / tertinggi) * TINGGI
          return (
            <line
              key={`garis-${nilai}`}
              x1={0}
              x2={lebar}
              y1={y}
              y2={y}
              className={styles.chartGrid}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}

        {points.map((titik, indeks) => {
          const tinggi = Math.max((titik.value / tertinggi) * TINGGI, 1)
          return (
            <rect
              key={titik.label}
              x={indeks * (LEBAR_BATANG + JARAK)}
              y={TINGGI - tinggi}
              width={LEBAR_BATANG}
              height={tinggi}
              className={styles.chartBar}
            >
              <title>{`${titik.label}: ${titik.display}`}</title>
            </rect>
          )
        })}
      </svg>

        {/*
          Label bulan berada DI DALAM grid yang sama dengan batangnya, pada
          kolom yang sama. Diletakkan di luar, ia bergeser sebesar lebar sumbu
          dan setiap label menunjuk bulan yang salah.
        */}
        <div className={styles.chartLabels} aria-hidden="true">
          {points.map((titik) => (
            <span key={titik.label}>{titik.label}</span>
          ))}
        </div>
      </div>

      {/* Representasi yang sebenarnya, untuk screen reader dan untuk disalin. */}
      <table className={styles.chartTable}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t('grafik.bulan')}</th>
            <th scope="col">{valueHeader}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((titik) => (
            <tr key={titik.label}>
              <th scope="row">{titik.label}</th>
              <td>{titik.display}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
