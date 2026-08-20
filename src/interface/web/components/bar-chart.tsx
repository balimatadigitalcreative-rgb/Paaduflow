import type { ReactNode } from 'react'

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
}

const TINGGI = 160
const LEBAR_BATANG = 28
const JARAK = 12

export function BarChart({ points, caption, valueHeader }: BarChartProps): ReactNode {
  if (points.length === 0) {
    return (
      <p className={styles.chartEmpty} role="status">
        Belum ada data untuk periode ini.
      </p>
    )
  }

  const tertinggi = Math.max(...points.map((titik) => titik.value), 1)
  const lebar = points.length * LEBAR_BATANG + (points.length - 1) * JARAK

  return (
    <figure className={styles.chart}>
      <svg
        viewBox={`0 0 ${lebar} ${TINGGI}`}
        className={styles.chartSvg}
        role="img"
        aria-label={caption}
        preserveAspectRatio="none"
      >
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
            />
          )
        })}
      </svg>

      <div className={styles.chartLabels} aria-hidden="true">
        {points.map((titik) => (
          <span key={titik.label}>{titik.label}</span>
        ))}
      </div>

      {/* Representasi yang sebenarnya, untuk screen reader dan untuk disalin. */}
      <table className={styles.chartTable}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Bulan</th>
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
