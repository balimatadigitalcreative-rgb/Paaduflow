import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import type { ProfitLossReport, ProfitLossRow } from '#application/queries'
import { formatAccounting } from '#shared/money-format'

import { api, ApiError, perusahaan } from '../api/client.js'
import { Button } from '../components/button.js'
import { DateField } from '../components/pickers.js'
import { href } from '../router.js'
import styles from './pages.module.css'

/**
 * Laba Rugi — Screen_Specs_HiFi §9, Flow_Archetypes 6.
 *
 * Struktur bakunya: panel parameter → hasil → drill-down → ekspor. Ekspor belum
 * ada, dan disebut apa adanya di layar alih-alih dihilangkan diam-diam.
 *
 * Tiga aturan yang membentuk tampilannya, dan ketiganya lahir dari cara laporan
 * ini dipakai — dicetak, diedarkan, lalu ditanyakan seseorang tiga minggu
 * kemudian:
 *
 * 1. **Header menyebut company, periode, mata uang, dan waktu generate.**
 *    Laporan tanpa itu tidak dapat dipertanggungjawabkan, dan dua salinan
 *    dengan angka berbeda tidak dapat diurutkan mana yang lebih baru.
 * 2. **Angka negatif dalam kurung**, bukan tanda minus.
 * 3. **Setiap baris dapat ditelusuri sampai ke transaksinya.** Ini pilar Terang
 *    dan tidak opsional.
 */

interface Konteks {
  readonly companyId: string
  readonly companyName: string
  readonly currency: string
}

type Muat =
  | { readonly kind: 'memuat' }
  | { readonly kind: 'siap'; readonly data: ProfitLossReport }
  | { readonly kind: 'galat'; readonly pesan: string }

/** Awal dan akhir bulan kalender yang memuat tanggal ini. */
function bulanDari(tanggal: Date): { from: string; to: string } {
  const awal = new Date(Date.UTC(tanggal.getUTCFullYear(), tanggal.getUTCMonth(), 1))
  const akhir = new Date(Date.UTC(tanggal.getUTCFullYear(), tanggal.getUTCMonth() + 1, 0))
  return { from: awal.toISOString().slice(0, 10), to: akhir.toISOString().slice(0, 10) }
}

function bulanSebelum(dari: string): { from: string; to: string } {
  const acuan = new Date(`${dari}T00:00:00Z`)
  return bulanDari(new Date(Date.UTC(acuan.getUTCFullYear(), acuan.getUTCMonth() - 1, 1)))
}

/**
 * Menyusun pohon dari daftar datar, lalu meratakannya kembali menurut urutan
 * tampil dengan kedalaman tiap baris.
 *
 * Dilakukan di sini, bukan di server, karena bentuk pohon hanya dibutuhkan
 * untuk menggambar. Mengirim data bersarang memaksa setiap pemakainya menulis
 * rekursi untuk hal-hal biasa seperti menjumlah dan memfilter.
 */
interface BarisTampil {
  readonly baris: ProfitLossRow
  readonly kedalaman: number
  readonly punyaAnak: boolean
  readonly jumlah: number
  readonly jumlahBanding: number | null
}

function susun(
  rows: readonly ProfitLossRow[],
  jenis: string,
  dilipat: ReadonlySet<string>,
): readonly BarisTampil[] {
  const milikJenis = rows.filter((row) => row.type === jenis)
  const anakDari = new Map<string | null, ProfitLossRow[]>()
  for (const row of milikJenis) {
    const kunci = milikJenis.some((lain) => lain.accountId === row.parentId) ? row.parentId : null
    const daftar = anakDari.get(kunci) ?? []
    daftar.push(row)
    anakDari.set(kunci, daftar)
  }

  /*
   * Subtotal induk = nilainya sendiri + seluruh keturunannya.
   *
   * Dihitung, bukan diambil dari server: server mengirim nilai per akun apa
   * adanya, dan menjumlahkan di dua tempat menghasilkan dua angka yang suatu
   * hari akan berbeda.
   */
  function total(row: ProfitLossRow, ambil: (r: ProfitLossRow) => number | null): number {
    const anak = anakDari.get(row.accountId) ?? []
    return (ambil(row) ?? 0) + anak.reduce((jumlah, satu) => jumlah + total(satu, ambil), 0)
  }

  const hasil: BarisTampil[] = []

  function turun(induk: string | null, kedalaman: number): void {
    for (const row of anakDari.get(induk) ?? []) {
      const anak = anakDari.get(row.accountId) ?? []
      hasil.push({
        baris: row,
        kedalaman,
        punyaAnak: anak.length > 0,
        jumlah: total(row, (r) => r.amount),
        jumlahBanding: row.comparison === null ? null : total(row, (r) => r.comparison),
      })
      if (!dilipat.has(row.accountId)) turun(row.accountId, kedalaman + 1)
    }
  }

  turun(null, 0)
  return hasil
}

function jumlahkan(rows: readonly ProfitLossRow[], jenis: string, banding: boolean): number | null {
  const milik = rows.filter((row) => row.type === jenis)
  if (banding && milik.some((row) => row.comparison === null)) return null
  return milik.reduce((jumlah, row) => jumlah + (banding ? (row.comparison ?? 0) : row.amount), 0)
}

export function LabaRugi({ konteks }: { readonly konteks: Konteks }): ReactNode {
  const bulanIni = bulanDari(new Date())
  const [dari, setDari] = useState(bulanIni.from)
  const [sampai, setSampai] = useState(bulanIni.to)
  const [bandingkan, setBandingkan] = useState(true)
  const [dilipat, setDilipat] = useState<ReadonlySet<string>>(new Set())
  const [muat, setMuat] = useState<Muat>({ kind: 'memuat' })

  async function ambil(): Promise<void> {
    setMuat({ kind: 'memuat' })
    try {
      const banding = bandingkan ? bulanSebelum(dari) : null
      const kueri = new URLSearchParams({ from: dari, to: sampai })
      if (banding !== null) {
        kueri.set('compare_from', banding.from)
        kueri.set('compare_to', banding.to)
      }

      const jawaban = await api.get<ProfitLossReport>(
        `${perusahaan(konteks.companyId)}/reports/profit-loss?${kueri.toString()}`,
      )
      setMuat({ kind: 'siap', data: jawaban.data })
    } catch (kesalahan) {
      setMuat({
        kind: 'galat',
        pesan:
          kesalahan instanceof ApiError ? kesalahan.message : 'Tidak dapat memuat laba rugi.',
      })
    }
  }

  useEffect(() => {
    void ambil()
  }, [konteks.companyId])

  function lipat(accountId: string): void {
    setDilipat((lama) => {
      const berikut = new Set(lama)
      if (berikut.has(accountId)) berikut.delete(accountId)
      else berikut.add(accountId)
      return berikut
    })
  }

  return (
    <div className={styles.stack}>
      {/*
        Panel parameter — Flow_Archetypes 6. Selalu terlihat bersama hasilnya,
        bukan di balik dialog: laporan yang dicetak tanpa menyebut periodenya
        tidak berguna, dan parameter yang tersembunyi tidak ikut tercetak.
      */}
      <div className={`${styles.notice} ${styles.row}`}>
        {/*
          DateField bekerja dengan `Date`, sedangkan API dan URL memakai
          `YYYY-MM-DD`. Konversi dilakukan di batas ini, sekali, alih-alih
          menyimpan dua bentuk tanggal yang harus dijaga tetap sepakat.
        */}
        <DateField
          label="Dari"
          value={new Date(`${dari}T00:00:00Z`)}
          onChange={(nilai) => {
            if (nilai !== null) setDari(nilai.toISOString().slice(0, 10))
          }}
        />
        <DateField
          label="Sampai"
          value={new Date(`${sampai}T00:00:00Z`)}
          onChange={(nilai) => {
            if (nilai !== null) setSampai(nilai.toISOString().slice(0, 10))
          }}
        />
        <label className={styles.metaLabel}>
          <input
            type="checkbox"
            checked={bandingkan}
            onChange={(event) => setBandingkan(event.target.checked)}
          />{' '}
          Bandingkan dengan bulan sebelumnya
        </label>
        <Button onClick={() => void ambil()}>Terapkan</Button>
      </div>

      {/*
        Laporan lebar di layar sempit disebut apa adanya, bukan diperas.
        Layout_System §5: modul desktop-only menampilkan pesan jujur dan
        menawarkan tindakan yang mungkin.
      */}
      <p className={`${styles.notice} ${styles.hanyaSempit}`} role="status">
        <strong>Laporan ini dirancang untuk layar lebih lebar.</strong> Kolom
        perbandingan dan selisihnya tidak muat dibaca di sini. Buka di tablet atau
        laptop untuk membacanya utuh — angkanya tetap dapat dilihat di bawah, tetapi
        akan memerlukan gulir mendatar.
      </p>

      <Hasil
        muat={muat}
        konteks={konteks}
        dilipat={dilipat}
        onLipat={lipat}
        onCobaLagi={() => void ambil()}
      />
    </div>
  )
}

function Hasil({
  muat,
  konteks,
  dilipat,
  onLipat,
  onCobaLagi,
}: {
  readonly muat: Muat
  readonly konteks: Konteks
  readonly dilipat: ReadonlySet<string>
  onLipat: (accountId: string) => void
  onCobaLagi: () => void
}): ReactNode {
  if (muat.kind === 'memuat') {
    return (
      <p role="status" className={styles.metaLabel}>
        Sedang menghitung…
      </p>
    )
  }

  if (muat.kind === 'galat') {
    return (
      <div className={styles.stack}>
        <p className={`${styles.notice} ${styles.noticeDanger}`} role="alert">
          {muat.pesan}
        </p>
        <div>
          <Button variant="secondary" onClick={onCobaLagi}>
            Coba lagi
          </Button>
        </div>
      </div>
    )
  }

  const { data } = muat
  const adaAngka = data.rows.some((row) => row.amount !== 0 || (row.comparison ?? 0) !== 0)

  if (!adaAngka) {
    return (
      <div className={styles.notice}>
        <strong>Tidak ada transaksi pada periode ini.</strong>
        <p>
          Laporan dihitung dari jurnal yang sudah diposting. Coba periode lain, atau posting
          faktur lebih dulu.
        </p>
      </div>
    )
  }

  const pendapatan = jumlahkan(data.rows, 'revenue', false) ?? 0
  const beban = jumlahkan(data.rows, 'expense', false) ?? 0
  const pendapatanBanding = jumlahkan(data.rows, 'revenue', true)
  const bebanBanding = jumlahkan(data.rows, 'expense', true)
  const laba = pendapatan - beban
  const labaBanding =
    pendapatanBanding === null || bebanBanding === null ? null : pendapatanBanding - bebanBanding

  return (
    <div className={styles.stack}>
      {/*
        Header laporan — Flow_Archetypes 6. Company, periode, mata uang, dan
        waktu generate, keempatnya. Laporan ini dicetak dan diedarkan, jadi
        konteksnya harus ikut di kertasnya.
      */}
      <div className={styles.meta}>
        <div>
          <div className={styles.metaLabel}>Company</div>
          <div className={styles.metaValue}>{konteks.companyName}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>Periode</div>
          <div className={styles.metaValue}>{data.period.label}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>Mata uang</div>
          <div className={styles.metaValue}>{data.currency}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>Dibangkitkan</div>
          <div className={styles.metaValue}>{data.generatedAt.slice(0, 16).replace('T', ' ')}</div>
        </div>
      </div>

      <div className={styles.laporanGulir}>
        <table className={styles.matchTable}>
          <caption>
            Laba Rugi — {konteks.companyName}, {data.period.label}
            {data.comparison === null ? '' : ` dibandingkan ${data.comparison.label}`}
          </caption>
          <thead>
            <tr>
              <th scope="col">Akun</th>
              <th scope="col" data-numeric="true">
                {data.period.label}
              </th>
              {data.comparison === null ? null : (
                <>
                  <th scope="col" data-numeric="true">
                    {data.comparison.label}
                  </th>
                  <th scope="col" data-numeric="true">
                    Selisih
                  </th>
                </>
              )}
            </tr>
          </thead>

          <Kelompok
            judul="Pendapatan"
            jenis="revenue"
            data={data}
            dilipat={dilipat}
            onLipat={onLipat}
            total={pendapatan}
            totalBanding={pendapatanBanding}
          />

          <Kelompok
            judul="Beban"
            jenis="expense"
            data={data}
            dilipat={dilipat}
            onLipat={onLipat}
            total={beban}
            totalBanding={bebanBanding}
          />

          <tfoot>
            <tr>
              <th scope="row">Laba bersih</th>
              <td data-numeric="true">{formatAccounting(laba, data.currency)}</td>
              {data.comparison === null ? null : (
                <>
                  <td data-numeric="true">{formatAccounting(labaBanding, data.currency)}</td>
                  <td data-numeric="true">
                    {formatAccounting(
                      labaBanding === null ? null : laba - labaBanding,
                      data.currency,
                    )}
                  </td>
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className={styles.metaLabel}>
        Ekspor belum tersedia. Angka di layar ini dapat disalin apa adanya; ekspor XLSX yang
        mengirim angka sebagai angka menyusul.
      </p>
    </div>
  )
}

function Kelompok({
  judul,
  jenis,
  data,
  dilipat,
  onLipat,
  total,
  totalBanding,
}: {
  readonly judul: string
  readonly jenis: string
  readonly data: ProfitLossReport
  readonly dilipat: ReadonlySet<string>
  onLipat: (accountId: string) => void
  readonly total: number
  readonly totalBanding: number | null
}): ReactNode {
  const baris = susun(data.rows, jenis, dilipat)
  const adaBanding = data.comparison !== null

  return (
    <tbody>
      <tr>
        <th scope="rowgroup" colSpan={adaBanding ? 4 : 2}>
          {judul}
        </th>
      </tr>

      {baris.map((satu) => (
        <tr key={satu.baris.accountId}>
          {/*
            Kedalaman lewat atribut data, bukan prop `style`.

            Jaraknya nilai visual, dan nilai visual tinggal di CSS Module tempat
            aturan token berlaku. Empat tingkat sudah cukup: bagan akun yang
            lebih dalam dari itu tidak dapat dibaca siapa pun, dan Breadcrumb
            membatasi dirinya di angka yang sama karena alasan yang sama.
          */}
          <td className={styles.barisLaporan} data-kedalaman={Math.min(satu.kedalaman, 3)}>
            {satu.punyaAnak ? (
              <button
                type="button"
                className={styles.lipat}
                aria-expanded={!dilipat.has(satu.baris.accountId)}
                onClick={() => onLipat(satu.baris.accountId)}
              >
                <span aria-hidden="true">{dilipat.has(satu.baris.accountId) ? '▸' : '▾'}</span>
                <span className={styles.visuallyHiddenInline}>
                  {dilipat.has(satu.baris.accountId) ? 'Buka' : 'Lipat'} {satu.baris.name}
                </span>
              </button>
            ) : null}{' '}
            {/*
              Setiap baris menaut ke buku besar akun itu — pilar Terang,
              Flow_Archetypes 6. Dari sana satu klik lagi sampai ke fakturnya.
            */}
            <a href={href(`akuntansi/buku-besar/${satu.baris.accountId}`)}>
              {satu.baris.code} — {satu.baris.name}
            </a>
          </td>
          <td data-numeric="true">{formatAccounting(satu.jumlah, data.currency)}</td>
          {adaBanding ? (
            <>
              <td data-numeric="true">{formatAccounting(satu.jumlahBanding, data.currency)}</td>
              <td data-numeric="true">
                {formatAccounting(
                  satu.jumlahBanding === null ? null : satu.jumlah - satu.jumlahBanding,
                  data.currency,
                )}
              </td>
            </>
          ) : null}
        </tr>
      ))}

      <tr data-subtotal="true">
        <th scope="row">Jumlah {judul.toLowerCase()}</th>
        <td data-numeric="true">{formatAccounting(total, data.currency)}</td>
        {adaBanding ? (
          <>
            <td data-numeric="true">{formatAccounting(totalBanding, data.currency)}</td>
            <td data-numeric="true">
              {formatAccounting(
                totalBanding === null ? null : total - totalBanding,
                data.currency,
              )}
            </td>
          </>
        ) : null}
      </tr>
    </tbody>
  )
}
