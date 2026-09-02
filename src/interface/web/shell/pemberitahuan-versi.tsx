import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { VERSI_TERPASANG, versiDisajikan, type AmbilVersi } from '../api/versi.js'

import styles from './shell.module.css'

/**
 * Pemberitahuan versi baru.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *   IA TIDAK PERNAH MEMUAT ULANG SENDIRI
 *
 *   Orang yang sedang mengisi faktur penjualan dan halamannya dimuat ulang
 *   tanpa diminta kehilangan pekerjaannya. Sistem akuntansi adalah tempat
 *   terakhir yang boleh melakukan itu, jadi satu-satunya yang dilakukan berkas
 *   ini adalah memberi tahu; tombolnya milik orangnya.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **Banner, bukan toast — dan itu menyalahi tebakan pertama.** `toast.tsx`
 * melarang dirinya sendiri dipakai untuk hal yang harus ditindaklanjuti: ia
 * hilang setelah enam detik, dan pesan yang hilang membawa satu-satunya
 * salinan informasinya adalah bug menurut komponennya sendiri. Orang yang
 * kebetulan sedang melihat ke tempat lain tidak akan pernah tahu.
 *
 * Yang dipakai adalah `contextBanner` yang sudah ada di shell ini — selebar
 * konten, di atas halaman, tidak menutupi apa pun. Tidak ada komponen baru
 * yang dibuat.
 */

/**
 * Lima menit.
 *
 * Kapan memeriksa lebih menentukan daripada seberapa sering: yang paling sering
 * terjadi adalah tab yang ditinggal semalaman lalu kembali mendapat fokus, dan
 * itu ditangani pendengar `focus` di bawah tanpa menunggu jam apa pun. Jeda ini
 * hanya untuk tab yang dibiarkan terbuka DAN aktif — kasus yang lebih jarang,
 * dan tidak layak dibayar dengan permintaan setiap beberapa detik.
 */
const JEDA_PERIKSA_MS = 5 * 60 * 1000

/**
 * Diabaikan berarti ditunda tiga puluh menit, bukan dibuang.
 *
 * Orang yang menutup pemberitahuan ini tetap menjalankan versi lama. Membuatnya
 * hilang selamanya berarti fitur ini menyerah tepat pada orang yang paling
 * lama membiarkan tabnya terbuka — dan itu orang yang paling membutuhkannya.
 */
const JEDA_DIABAIKAN_MS = 30 * 60 * 1000

/**
 * Konstanta modul, bukan nilai bawaan tertulis di parameter.
 *
 * `sekarang = () => Date.now()` di daftar parameter melahirkan fungsi BARU
 * setiap render, dan efek yang bergantung padanya akan menyetel ulang jam
 * penundaan setiap kali apa pun di layar berubah — sehingga penundaan tiga
 * puluh menit tidak pernah benar-benar habis.
 */
const SEKARANG = (): number => Date.now()

export interface PemberitahuanVersiProps {
  /** Disuntik di uji. Produksi memakai bawaannya. */
  readonly ambil?: AmbilVersi
  readonly versiTerpasang?: string
  readonly sekarang?: () => number
}

export function PemberitahuanVersi({
  ambil = versiDisajikan,
  versiTerpasang = VERSI_TERPASANG,
  sekarang = SEKARANG,
}: PemberitahuanVersiProps = {}): ReactNode {
  const { t } = useTranslation('shell')
  const [tertinggal, setTertinggal] = useState(false)
  const [diabaikanPada, setDiabaikanPada] = useState<number | null>(null)

  /*
   * Referensi, bukan dependensi efek.
   *
   * `ambil` bawaannya stabil, tetapi pemanggil yang menulis `ambil={() => …}`
   * inline akan memberi fungsi baru setiap render — dan efek yang bergantung
   * padanya akan membongkar-pasang seluruh pendengar dan jamnya setiap kali
   * apa pun di layar berubah.
   */
  const ambilRef = useRef(ambil)
  ambilRef.current = ambil
  const versiRef = useRef(versiTerpasang)
  versiRef.current = versiTerpasang

  const periksa = useCallback(async () => {
    const disajikan = await ambilRef.current()

    // `null` berarti tidak terjawab. Bukan "tidak ada versi baru", dan bukan
    // alasan menampilkan apa pun — termasuk galat.
    if (disajikan === null) return
    if (disajikan !== versiRef.current) setTertinggal(true)
  }, [])

  useEffect(() => {
    let jam: ReturnType<typeof setInterval> | null = null

    function berhenti(): void {
      if (jam !== null) clearInterval(jam)
      jam = null
    }

    function mulai(): void {
      berhenti()
      jam = setInterval(() => void periksa(), JEDA_PERIKSA_MS)
    }

    /*
     * Tab tersembunyi tidak memeriksa apa pun — jamnya benar-benar dihentikan,
     * bukan sekadar dilewati isinya. Peramban memang melambatkan timer di tab
     * latar, tetapi "melambat" bukan "berhenti", dan seratus tab terbuka di
     * satu kantor tetap menjadi lalu lintas yang tidak menghasilkan apa-apa.
     */
    function saatTerlihat(): void {
      if (document.visibilityState === 'hidden') {
        berhenti()
        return
      }
      void periksa()
      mulai()
    }

    // Fungsi bernama, bukan literal di dalam pemanggilan: pendengar yang
    // didaftarkan sebagai `() => …` tidak dapat dicabut kembali, karena
    // `removeEventListener` menerima fungsi LAIN yang kebetulan serupa.
    function saatFokus(): void {
      void periksa()
    }

    // Pemeriksaan pertama langsung saat dipasang. Tab yang menerima index.html
    // basi dari cache peramban sudah tertinggal sejak detik pertama.
    saatTerlihat()

    window.addEventListener('focus', saatFokus)
    document.addEventListener('visibilitychange', saatTerlihat)

    return () => {
      berhenti()
      window.removeEventListener('focus', saatFokus)
      document.removeEventListener('visibilitychange', saatTerlihat)
    }
  }, [periksa])

  /*
   * Penundaan berakhir dengan sendirinya.
   *
   * Tanpa jam ini, `diabaikanPada` hanya dibandingkan saat komponen kebetulan
   * digambar ulang — sehingga pemberitahuan yang "ditunda tiga puluh menit"
   * sebenarnya ditunda sampai sesuatu yang lain memicu render. Di halaman yang
   * diam, itu selamanya.
   */
  useEffect(() => {
    if (diabaikanPada === null) return undefined
    const sisa = JEDA_DIABAIKAN_MS - (sekarang() - diabaikanPada)
    if (sisa <= 0) {
      setDiabaikanPada(null)
      return undefined
    }
    const jam = setTimeout(() => setDiabaikanPada(null), sisa)
    return () => clearTimeout(jam)
  }, [diabaikanPada, sekarang])

  if (!tertinggal || diabaikanPada !== null) return null

  return (
    /*
     * `polite`, bukan `assertive`. Tidak ada yang salah dan tidak ada yang
     * mendesak; menyela pembaca layar di tengah kalimat untuk mengabarkan
     * ketersediaan versi baru adalah gangguan, bukan bantuan.
     */
    <div aria-live="polite" aria-atomic="true">
      <div className={styles.contextBanner}>
        <span>{t('versi.tersedia')}</span>
        <button
          type="button"
          className={styles.navItem}
          onClick={() => window.location.reload()}
        >
          {t('aksi.muatUlang', { ns: 'umum' })}
        </button>
        <button
          type="button"
          className={styles.navItem}
          onClick={() => setDiabaikanPada(sekarang())}
        >
          {t('aksi.nanti', { ns: 'umum' })}
        </button>
      </div>
    </div>
  )
}
