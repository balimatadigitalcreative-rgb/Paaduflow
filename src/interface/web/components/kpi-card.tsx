import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

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
  /**
   * Deret sparkline, urut lama ke baru. Kosong berarti tidak ada riwayat yang
   * bermakna, dan sparkline-nya tidak digambar sama sekali.
   *
   * Sparkline TIDAK menggantikan angka tren di atasnya. Ia menunjukkan bentuk
   * perjalanannya — naik lalu turun tidak sama dengan naik terus, meski
   * persentase akhirnya identik.
   */
  readonly series?: readonly number[]
  /** Dibaca screen reader sebagai keterangan tabel sparkline. */
  readonly seriesLabel?: string
  /**
   * Kategori kartu, menentukan warna garis aksen di tepi atasnya.
   *
   * Bukan warna, melainkan PERAN. Kartu tidak tahu warna apa pun; CSS yang
   * memetakannya ke token peran, sehingga mode gelap dan brand tenant tidak
   * perlu menyentuh komponen ini.
   */
  readonly kategori?: 'pendapatan' | 'piutang' | 'tempo' | 'tindakan'
}

export function KpiCard(props: KpiCardProps): ReactNode {
  const { t } = useTranslation()

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
    <a className={styles.kpiCard} href={props.href} data-kategori={props.kategori ?? 'tindakan'}>
      <span className={styles.kpiLabel}>{props.label}</span>
      <strong className={styles.kpiValue}>{props.value}</strong>

      {changePercent === null ? (
        <span className={styles.kpiBasis}>{t('grafik.tanpaPeriodePembanding')}</span>
      ) : (
        <span className={styles.kpiTrend} data-tone={nada}>
          <span aria-hidden="true">{panah}</span>
          {/* Tanda dan panah keduanya ada, sehingga arah terbaca tanpa warna. */}
          <span>{`${tanda}${changePercent.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`}</span>
          <span className={styles.kpiBasis}>{props.comparisonBasis}</span>
        </span>
      )}

      {props.series === undefined || props.series.length < 2 ? null : (
        <Sparkline
          nilai={props.series}
          nada={nada}
          keterangan={props.seriesLabel ?? `Riwayat ${props.label}`}
        />
      )}
    </a>
  )
}


/**
 * Sparkline — garis kecil tanpa sumbu, di dalam kartu KPI.
 *
 * Tanpa sumbu dengan sengaja: pada 40px tinggi, label sumbu tidak terbaca dan
 * hanya menambah derau. Yang dibaca dari sparkline adalah BENTUK, bukan nilai —
 * nilainya sudah ada sebagai angka besar di atasnya.
 *
 * Tabel tersembunyi membawa angkanya untuk screen reader. Grafik yang hanya
 * dapat dilihat mata bukan grafik yang dapat dipertanggungjawabkan.
 */
function Sparkline({
  nilai,
  nada,
  keterangan,
}: {
  readonly nilai: readonly number[]
  readonly nada: string
  readonly keterangan: string
}): ReactNode {
  const { t } = useTranslation()

  const tertinggi = Math.max(...nilai)
  const terendah = Math.min(...nilai)
  const rentang = tertinggi - terendah || 1

  const titik = nilai
    .map((satu, indeks) => {
      const x = (indeks / (nilai.length - 1)) * 100
      const y = 100 - ((satu - terendah) / rentang) * 100
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  const terakhir = nilai[nilai.length - 1] ?? 0
  const akhirX = 100
  const akhirY = 100 - ((terakhir - terendah) / rentang) * 100

  return (
    <span className={styles.sparkline}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className={styles.sparklineSvg}
        data-tone={nada}
        role="img"
        aria-label={keterangan}
      >
        <polyline className={styles.sparklineGaris} points={titik} vectorEffect="non-scaling-stroke" />
        {/*
          Titik di ujung kanan menandai nilai TERKINI. Tanpa itu, garis yang
          berakhir di tengah tinggi tidak dapat dibedakan dari garis yang
          terpotong — dan arah terakhir adalah hal pertama yang dicari mata.
        */}
        <circle className={styles.sparklineUjung} cx={akhirX} cy={akhirY} r="3" />
      </svg>

      <table className={styles.sparklineTabel}>
        <caption>{keterangan}</caption>
        <thead>
          <tr>
            <th scope="col">{t('grafik.periode')}</th>
            <th scope="col">Nilai</th>
          </tr>
        </thead>
        <tbody>
          {nilai.map((satu, indeks) => (
            <tr key={`${indeks}-${satu}`}>
              <th scope="row">{`Periode ${indeks + 1}`}</th>
              <td>{satu.toLocaleString('id-ID')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </span>
  )
}
