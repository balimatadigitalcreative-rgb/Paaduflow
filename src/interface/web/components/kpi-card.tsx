import type { ReactNode } from 'react'

import styles from './primitives.module.css'

/**
 * KPI Card — Component_Specs_Composite §8.
 *
 * Tiga aturan yang membentuk komponen ini, dan ketiganya lahir dari kesalahan
 * yang mahal:
 *
 * 1. **Persentase tren tidak pernah tampil tanpa pembandingnya.** "+12%" tidak
 *    bermakna; "+12% vs Juli 2026" bermakna. Karena itu `comparisonBasis`
 *    wajib — tipe ini menolak dikompilasi tanpanya.
 * 2. **Arah tren dibedakan panah dan tanda, bukan hanya warna** (WCAG 1.4.1).
 *    Dan naik tidak selalu berarti baik: biaya yang naik 12% berwarna hijau
 *    adalah salah baca yang mahal. Karena itu `higherIsBetter` dipisahkan dari
 *    arah panahnya.
 * 3. **Setiap kartu punya jalur ke rinciannya.** Angka agregat tanpa jalan ke
 *    sumbernya melanggar pilar Terang, jadi `href` juga wajib.
 */

export interface KpiCardProps {
  readonly label: string
  /** Sudah terformat — komponen ini tidak tahu mata uang maupun lokal. */
  readonly value: string
  /** Persen perubahan. Null berarti tidak ada pembanding, dan tren disembunyikan. */
  readonly changePercent: number | null
  /** Disebut apa adanya, mis. "vs Juli 2026". Wajib bila `changePercent` ada. */
  readonly comparisonBasis: string
  /**
   * Apakah naik itu kabar baik. Piutang jatuh tempo yang naik: false.
   * Pendapatan yang naik: true.
   */
  readonly higherIsBetter: boolean
  /** Jalur ke rinciannya. Wajib — lihat aturan 3 di atas. */
  readonly href: string
}

export function KpiCard(props: KpiCardProps): ReactNode {
  const { changePercent } = props
  const naik = changePercent !== null && changePercent > 0
  const datar = changePercent !== null && changePercent === 0

  // Nada dihitung dari arah DAN dari apakah arah itu diinginkan — bukan dari
  // arah saja.
  const nada =
    changePercent === null || datar ? 'netral' : naik === props.higherIsBetter ? 'baik' : 'buruk'

  const panah = datar ? '→' : naik ? '↑' : '↓'
  const tanda = changePercent === null ? '' : changePercent > 0 ? '+' : ''

  return (
    <a className={styles.kpiCard} href={props.href}>
      <span className={styles.kpiLabel}>{props.label}</span>
      <strong className={styles.kpiValue}>{props.value}</strong>

      {changePercent === null ? (
        <span className={styles.kpiBasis}>Tidak ada periode pembanding</span>
      ) : (
        <span className={styles.kpiTrend} data-tone={nada}>
          <span aria-hidden="true">{panah}</span>
          {/* Tanda dan panah keduanya ada, sehingga arah terbaca tanpa warna. */}
          <span>{`${tanda}${changePercent.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`}</span>
          <span className={styles.kpiBasis}>{props.comparisonBasis}</span>
        </span>
      )}
    </a>
  )
}
