import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { ReactNode } from 'react'

import type { DashboardSummary } from '#application/queries'

import { api, ApiError, perusahaan } from '../api/client.js'
import { Badge } from '../components/badge.js'
import { AgeingChart } from '../components/ageing-chart.js'
import { BarChart, type BarPoint } from '../components/bar-chart.js'
import { Button } from '../components/button.js'
import { KpiCard } from '../components/kpi-card.js'
import { useFormat } from '../i18n/use-format.js'
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

/**
 * Peta kartu ke kategori aksennya.
 *
 * Di sini, bukan di server: warna adalah keputusan tampilan, dan port dasbor
 * tidak boleh tahu apa pun tentang garis di tepi kartu.
 */
const KATEGORI_KARTU: Record<string, 'pendapatan' | 'piutang' | 'tempo' | 'tindakan'> = {
  pendapatan: 'pendapatan',
  piutang: 'piutang',
  'jatuh-tempo': 'tempo',
  menunggu: 'tindakan',
}

/**
 * Basis pembanding dari server dipetakan ke kunci terjemahan.
 *
 * Port dasbor mengirimkan kalimat jadi — "vs Juli 2026", "Posisi hari ini" —
 * karena ia dirancang sebelum ada bahasa kedua. Memindahkan pemetaan ini ke
 * server berarti server harus tahu bahasa pembacanya, dan itu menyeret locale
 * ke dalam lapisan yang tidak boleh mengenalnya sama sekali (D-151).
 *
 * Teks aslinya tetap dipakai sebagai cadangan, sehingga basis baru yang belum
 * dikenal muncul apa adanya alih-alih hilang.
 */
function basisPembanding(t: TFunction<'dasbor'>, basis: string): string {
  if (basis === 'Tidak ada periode pembanding') return t('kpi.tanpaPembanding')
  if (basis === 'vs akhir bulan lalu') return t('kpi.vsAkhirBulanLalu')
  if (basis === 'Posisi hari ini') return t('kpi.posisiHariIni')

  const bulanLalu = /^vs (.+)$/.exec(basis)
  if (bulanLalu !== null) return t('kpi.vsBulanLalu', { bulan: bulanLalu[1] })

  return basis
}

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
  const { t } = useTranslation('dasbor')
  const { namaBulan } = useFormat()
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
        pesan: kesalahan instanceof ApiError ? kesalahan.message : t('ringkasan.gagal'),
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
        <h2>{t('company.judul')}</h2>
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
                {t('company.tahunFiskal', {
                  bulan: namaBulan(company.fiscal_year_start_month),
                })}
              </span>
              <div>
                <Badge tone="accent">
                  {t(`peran.${company.role}`, { ns: 'shell', defaultValue: company.role })}
                </Badge>
              </div>
              {company.id === activeCompanyId ? (
                <Badge tone="success">{t('company.sedangAktif')}</Badge>
              ) : (
                <Button variant="secondary" onClick={() => onPilihCompany(company.id)}>
                  {t('company.beralih')}
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
  const { t } = useTranslation('dasbor')
  const format = useFormat()

  /*
   * Skeleton berbentuk konten akhir: empat kartu sebaris, lalu blok grafik
   * setinggi grafik sungguhan. Skeleton yang bentuknya salah memindahkan tombol
   * tepat saat orang hendak mengkliknya — Component_Specs_Composite §1.8.
   */
  if (muat.kind === 'memuat') {
    return (
      <section className={styles.stack} aria-busy="true">
        <h2>{t('ringkasan.judul')}</h2>
        <div className={styles.kpiRow}>
          {[0, 1, 2, 3].map((nomor) => (
            <div key={nomor} className={styles.kpiSkeleton} aria-hidden="true" />
          ))}
        </div>
        <div className={styles.chartSkeleton} aria-hidden="true" />
        <p role="status" className={styles.metaLabel}>
          {t('ringkasan.memuat')}
        </p>
      </section>
    )
  }

  if (muat.kind === 'galat') {
    return (
      <section className={styles.stack}>
        <h2>{t('ringkasan.judul')}</h2>
        <p className={`${styles.notice} ${styles.noticeDanger}`} role="alert">
          {muat.pesan}
        </p>
        <div>
          <Button variant="secondary" onClick={onCobaLagi}>
            {t('aksi.cobaLagi', { ns: 'umum' })}
          </Button>
        </div>
      </section>
    )
  }

  const { data } = muat
  const adaAngka = data.months.some((bulan) => bulan.revenue !== 0)

  // Diturunkan dari ember yang sama yang digambar grafik, bukan dihitung ulang.
  // Dua sumber untuk angka yang sama akan menyimpang, dan yang menyimpang
  // adalah angka yang dipakai menagih orang.
  const emberTempo = data.ageing.filter((ember) => ember.overdue)
  const jatuhTempo = emberTempo.reduce((jumlah, ember) => jumlah + ember.count, 0)
  const nilaiJatuhTempo = emberTempo.reduce((jumlah, ember) => jumlah + ember.amount, 0)

  const titik: readonly BarPoint[] = data.months.map((bulan) => ({
    label: format.bulanSingkat(bulan.month),
    value: Math.max(bulan.revenue, 0),
    display: format.angka(bulan.revenue, data.currency),
  }))

  return (
    <section className={styles.stack}>
      <h2>{t('ringkasan.judul')}</h2>

      <div className={styles.kpiRow}>
        {data.kpis.map((kartu) => (
          <KpiCard
            key={kartu.id}
            label={t(`kpi.${kartu.id}`, { defaultValue: kartu.label })}
            value={
              kartu.value === null
                ? '—'
                : kartu.currency === null
                  ? format.bilangan(kartu.value)
                  : format.angka(kartu.value, kartu.currency)
            }
            changePercent={kartu.changePercent}
            comparisonBasis={basisPembanding(t, kartu.comparisonBasis)}
            higherIsBetter={kartu.higherIsBetter}
            href={kartu.href}
            kategori={KATEGORI_KARTU[kartu.id] ?? 'tindakan'}
            series={kartu.series}
            seriesLabel={t('kpi.riwayat', {
              label: t(`kpi.${kartu.id}`, { defaultValue: kartu.label }).toLowerCase(),
            })}
          />
        ))}
      </div>

      {/*
        Baris tengah: grafik pendapatan di kiri, umur piutang di kanan.

        Pendapatan mendapat ruang lebih besar karena ia dibaca sebagai bentuk
        sepanjang waktu — dua belas titik butuh lebar. Umur piutang dibaca
        sebagai komposisi pada satu saat, dan komposisi terbaca baik di kolom
        sempit.
      */}
      <div className={styles.dasborTengah}>
        <section className={styles.panelDasbor} aria-labelledby="judul-pendapatan">
          <h3 id="judul-pendapatan" className={styles.panelJudul}>
            {t('pendapatan.judul')}
          </h3>

          {adaAngka ? (
            <BarChart
              points={titik}
              caption={t('pendapatan.keterangan', { mataUang: data.currency })}
              valueHeader={t('pendapatan.kolomNilai')}
            />
          ) : (
            <div className={styles.notice}>
              <strong>{t('pendapatan.kosongJudul')}</strong>
              <p>{t('pendapatan.kosongPenjelasan')}</p>
              <Button onClick={() => pergiKe('penjualan/baru')}>
                {t('pendapatan.kosongAksi')}
              </Button>
            </div>
          )}
        </section>

        <section className={styles.panelDasbor} aria-labelledby="judul-umur">
          <h3 id="judul-umur" className={styles.panelJudul}>
            {t('umurPiutang.judul')}
          </h3>

          {/* Setiap ember dapat diklik menuju daftar fakturnya — grafik yang
              tidak dapat ditelusuri adalah jalan buntu (Flow_Archetypes 6). */}
          <AgeingChart
            buckets={data.ageing.map((ember) => ({
              ...ember,
              // Label dari server hanya cadangan: ia lahir dalam satu bahasa,
              // dan `id`-nya yang stabil — bukan teksnya — yang menghubungkannya
              // ke terjemahan.
              label: t(`umurPiutang.ember.${ember.id}`, { defaultValue: ember.label }),
            }))}
            caption={t('umurPiutang.keterangan', { mataUang: data.currency })}
            format={(nilai) => format.angka(nilai, data.currency)}
            onPilih={() => pergiKe('penjualan')}
          />
        </section>
      </div>

      {/*
        Baris bawah: daftar ringkas yang menuntut tindakan.

        Diletakkan paling bawah bukan karena paling tidak penting, melainkan
        karena ia paling spesifik — mata membaca dari agregat ke rincian, dan
        daftar tindakan hanya bermakna setelah orang tahu keadaan umumnya.
      */}
      <div className={styles.dasborBawah}>
        <section className={styles.panelDasbor} aria-labelledby="judul-tempo">
          <h3 id="judul-tempo" className={styles.panelJudul}>
            {t('jatuhTempo.judul')}
          </h3>
          {jatuhTempo === 0 ? (
            <p className={styles.metaLabel}>{t('jatuhTempo.kosong')}</p>
          ) : (
            <p className={styles.notice}>
              {/*
                Satu kunci untuk SELURUH kalimat, bukan potongan yang dirangkai.
                Bahasa Inggris mengubah kata kerjanya mengikuti jumlah — "1
                invoice IS past due" — dan kesepakatan itu tidak dapat dirakit
                dari potongan tanpa salah di salah satu bahasa.
              */}
              <Trans
                t={t}
                i18nKey="jatuhTempo.pesan"
                count={jatuhTempo}
                values={{ nilai: format.angka(nilaiJatuhTempo, data.currency) }}
                components={[<strong key="jumlah" />]}
              />{' '}
              <a href={href('penjualan')}>{t('jatuhTempo.tautan')}</a>
            </p>
          )}
        </section>

        <section className={styles.panelDasbor} aria-labelledby="judul-persetujuan">
          <h3 id="judul-persetujuan" className={styles.panelJudul}>
            {t('persetujuan.judul')}
          </h3>
          {data.awaitingApproval === 0 ? (
            <p className={styles.metaLabel}>{t('persetujuan.kosong')}</p>
          ) : (
            <p className={styles.notice}>
              <Trans
                t={t}
                i18nKey="persetujuan.pesan"
                count={data.awaitingApproval}
                components={[<strong key="jumlah" />]}
              />{' '}
              <a href={href('penjualan')}>{t('persetujuan.tautan')}</a>
            </p>
          )}
        </section>
      </div>
    </section>
  )
}
