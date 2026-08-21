import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import type { DashboardSummary } from '#application/queries'
import { monthLabel } from '#shared/fiscal-period'
import { formatAmount } from '#shared/money-format'

import { api, ApiError, perusahaan } from '../api/client.js'
import { Badge } from '../components/badge.js'
import { BarChart, type BarPoint } from '../components/bar-chart.js'
import { Button } from '../components/button.js'
import { KpiCard } from '../components/kpi-card.js'
import { href, pergiKe } from '../router.js'
import styles from './pages.module.css'

/**
 * Dasbor eksekutif — Screen_Specs_HiFi §3.
 *
 * Angkanya datang dari API, dan API mengambilnya dari buku besar. Itu bukan
 * detail implementasi: dasbor yang menjumlahkan kolom total di daftar dokumen
 * akan ikut menghitung draf, dan dasbor yang melebih-lebihkan pendapatan lebih
 * berbahaya daripada dasbor yang kosong.
 *
 * Tiga aturan §8 ditegakkan oleh tipe `KpiCard`, bukan oleh kedisiplinan di
 * sini: basis pembanding wajib, arah tren dibedakan panah dan tanda, dan setiap
 * kartu punya jalur ke rinciannya. Layar ini hanya meneruskan apa yang dikirim
 * server.
 */

export interface CompanyDapatDiakses {
  readonly id: string
  readonly tenant_name: string
  readonly legal_name: string
  readonly fiscal_year_start_month: number
  readonly role: string
}

const LABEL_PERAN: Record<string, string> = {
  tenant_owner: 'Pemilik Tenant',
  tenant_admin: 'Admin Tenant',
  company_admin: 'Admin Company',
  member: 'Anggota',
}

const SINGKAT_BULAN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]

type Muat =
  | { readonly kind: 'memuat' }
  | { readonly kind: 'siap'; readonly data: DashboardSummary }
  | { readonly kind: 'galat'; readonly pesan: string }

export function Dasbor({
  companies,
  activeCompanyId,
  onPilihCompany,
}: {
  readonly companies: readonly CompanyDapatDiakses[]
  readonly activeCompanyId: string
  readonly onPilihCompany: (id: string) => void
}): ReactNode {
  const [muat, setMuat] = useState<Muat>({ kind: 'memuat' })

  async function ambil(): Promise<void> {
    setMuat({ kind: 'memuat' })
    try {
      const jawaban = await api.get<DashboardSummary>(
        `${perusahaan(activeCompanyId)}/dashboard`,
      )
      setMuat({ kind: 'siap', data: jawaban.data })
    } catch (kesalahan) {
      setMuat({
        kind: 'galat',
        pesan: kesalahan instanceof ApiError ? kesalahan.message : 'Tidak dapat memuat dasbor.',
      })
    }
  }

  useEffect(() => {
    if (activeCompanyId !== '') void ambil()
  }, [activeCompanyId])

  return (
    <div className={styles.stack}>
      <RingkasanAngka muat={muat} onCobaLagi={() => void ambil()} />

      <section className={styles.stack}>
        <h2>Company yang dapat Anda akses</h2>
        <div className={styles.cards}>
          {companies.map((company) => (
            <div
              key={company.id}
              className={`${styles.card} ${company.id === activeCompanyId ? styles.cardActive : ''}`}
            >
              <strong>{company.legal_name}</strong>
              <span className={styles.metaLabel}>{company.tenant_name}</span>
              <span className={styles.metaLabel}>
                {/* Tahun fiskal ikut ditampilkan karena ia berbeda antar company
                    dan menentukan periode yang sedang berjalan. */}
                Tahun fiskal mulai {monthLabel(company.fiscal_year_start_month)}
              </span>
              <div>
                <Badge tone="accent">{LABEL_PERAN[company.role] ?? company.role}</Badge>
              </div>
              {company.id === activeCompanyId ? (
                <Badge tone="success">Sedang aktif</Badge>
              ) : (
                <Button variant="secondary" onClick={() => onPilihCompany(company.id)}>
                  Beralih ke company ini
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function RingkasanAngka({
  muat,
  onCobaLagi,
}: {
  readonly muat: Muat
  onCobaLagi: () => void
}): ReactNode {
  /*
   * Skeleton berbentuk konten akhir: empat kartu sebaris, lalu blok grafik
   * setinggi grafik sungguhan. Skeleton yang bentuknya salah memindahkan tombol
   * tepat saat orang hendak mengkliknya — Component_Specs_Composite §1.8.
   */
  if (muat.kind === 'memuat') {
    return (
      <section className={styles.stack} aria-busy="true">
        <h2>Ringkasan</h2>
        <div className={styles.kpiRow}>
          {[0, 1, 2, 3].map((nomor) => (
            <div key={nomor} className={styles.kpiSkeleton} aria-hidden="true" />
          ))}
        </div>
        <div className={styles.chartSkeleton} aria-hidden="true" />
        <p role="status" className={styles.metaLabel}>
          Memuat angka dasbor…
        </p>
      </section>
    )
  }

  if (muat.kind === 'galat') {
    return (
      <section className={styles.stack}>
        <h2>Ringkasan</h2>
        <p className={`${styles.notice} ${styles.noticeDanger}`} role="alert">
          {muat.pesan}
        </p>
        <div>
          <Button variant="secondary" onClick={onCobaLagi}>
            Coba lagi
          </Button>
        </div>
      </section>
    )
  }

  const { data } = muat
  const adaAngka = data.months.some((bulan) => bulan.revenue !== 0)

  const titik: readonly BarPoint[] = data.months.map((bulan) => {
    const [tahun, nomor] = bulan.month.split('-')
    return {
      label: `${SINGKAT_BULAN[Number(nomor) - 1] ?? bulan.month} ${(tahun ?? '').slice(2)}`,
      value: Math.max(bulan.revenue, 0),
      display: formatAmount(bulan.revenue, data.currency),
    }
  })

  return (
    <section className={styles.stack}>
      <h2>Ringkasan</h2>

      <div className={styles.kpiRow}>
        {data.kpis.map((kartu) => (
          <KpiCard
            key={kartu.id}
            label={kartu.label}
            value={
              kartu.currency === null
                ? kartu.value.toLocaleString('id-ID')
                : formatAmount(kartu.value, kartu.currency)
            }
            changePercent={kartu.changePercent}
            comparisonBasis={kartu.comparisonBasis}
            higherIsBetter={kartu.higherIsBetter}
            href={kartu.href}
          />
        ))}
      </div>

      {/*
        Company baru yang belum punya jurnal adalah keadaan sah, dan ia berbeda
        dari gagal memuat. Grafik dua belas batang nol akan terlihat seperti
        bisnis yang mati, bukan seperti buku yang belum dibuka.
      */}
      {adaAngka ? (
        <BarChart
          points={titik}
          caption={`Pendapatan dua belas bulan terakhir (${data.currency})`}
          valueHeader="Pendapatan"
        />
      ) : (
        <div className={styles.notice}>
          <strong>Belum ada pendapatan yang tercatat di buku besar.</strong>
          <p>
            Angka di sini lahir dari faktur yang sudah diposting, bukan dari draf. Buat satu
            faktur dan posting untuk melihatnya muncul.
          </p>
          <Button onClick={() => pergiKe('penjualan/baru')}>Buat faktur pertama</Button>
        </div>
      )}

      {data.awaitingApproval > 0 ? (
        <p className={styles.notice}>
          <strong>{data.awaitingApproval} dokumen menunggu keputusan Anda.</strong>{' '}
          <a href={href('penjualan')}>Buka daftar faktur</a>
        </p>
      ) : null}
    </section>
  )
}
