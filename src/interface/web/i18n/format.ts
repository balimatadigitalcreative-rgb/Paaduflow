import { currencyDecimals } from '#shared/money-format'

/**
 * Pemformatan yang mengikuti locale.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *   PEMFORMATAN ADALAH PRESENTASI. TITIK.
 *
 *   Nilai tersimpan, muatan API, dan seluruh perhitungan TIDAK PERNAH berubah
 *   mengikuti locale. Angka yang tampil berbeda tetapi dihitung berbeda adalah
 *   cacat yang tidak muncul sampai audit — dan saat itu ia sudah ada di ribuan
 *   dokumen.
 *
 *   Berkas ini karena itu hanya menerima `number` dan mengembalikan `string`.
 *   Ia tidak punya jalan untuk mengembalikan angka, dan itu disengaja: fungsi
 *   yang mengembalikan number dari sini akan cepat atau lambat dipakai dalam
 *   perhitungan.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Peta bahasa aplikasi ke tag BCP 47 yang dikenal `Intl`. */
const LOCALE: Record<string, string> = {
  id: 'id-ID',
  en: 'en-US',
}

export function localeUntuk(bahasa: string): string {
  return LOCALE[bahasa] ?? LOCALE.id!
}

/**
 * Nominal tanpa simbol mata uang.
 *
 * Desimalnya ditetapkan MATA UANG, bukan bahasa. IDR nol desimal di kedua
 * bahasa; USD dua desimal di kedua bahasa. Yang berubah mengikuti bahasa hanya
 * pemisahnya — `1.234.567` di Indonesia, `1,234,567` di Inggris.
 *
 * Membiarkan bahasa menentukan jumlah desimal akan membuat nominal Rupiah yang
 * sama tampil `1.234` dan `1,234.00` di dua layar, dan yang membacanya akan
 * menyimpulkan salah satunya salah.
 */
export function angka(nilai: number, mataUang: string, bahasa: string): string {
  const desimal = currencyDecimals(mataUang)
  return new Intl.NumberFormat(localeUntuk(bahasa), {
    minimumFractionDigits: desimal,
    maximumFractionDigits: desimal,
  }).format(nilai)
}

/**
 * Nominal beserta simbolnya, dengan penempatan menurut locale.
 *
 * `Intl` yang menentukan posisinya: Indonesia menulis `Rp 1.234`, Inggris
 * menulis `Rp 1,234` untuk IDR dan `$1,234.00` untuk USD. Menuliskan simbol
 * sendiri di depan angka akan salah pada mata uang yang menaruhnya di belakang.
 */
export function uang(nilai: number, mataUang: string, bahasa: string): string {
  return new Intl.NumberFormat(localeUntuk(bahasa), {
    style: 'currency',
    currency: mataUang,
    minimumFractionDigits: currencyDecimals(mataUang),
    maximumFractionDigits: currencyDecimals(mataUang),
  }).format(nilai)
}

/**
 * Format akuntansi: negatif dalam kurung, nol dibedakan dari kosong.
 *
 * Aturannya sama di seluruh bahasa — kurung untuk negatif adalah konvensi
 * akuntansi internasional, bukan kebiasaan Indonesia. Yang berubah hanya
 * pemisah angkanya.
 */
export function akuntansi(
  nilai: number | null | undefined,
  mataUang: string,
  bahasa: string,
): string {
  if (nilai === null || nilai === undefined) return '—'
  const besaran = angka(Math.abs(nilai), mataUang, bahasa)
  return nilai < 0 ? `(${besaran})` : besaran
}

/**
 * Tanggal panjang: `20 Agustus 2026` versus `20 August 2026`.
 *
 * Menerima `YYYY-MM-DD` apa adanya dan MEMBACANYA SEBAGAI TANGGAL KALENDER,
 * bukan sebagai momen. Tanggal dokumen tidak punya jam dan tidak punya zona
 * waktu; menguraikannya sebagai momen UTC lalu menampilkannya di zona waktu
 * pembaca akan menggeser sebagian tanggal satu hari ke belakang — dan tanggal
 * faktur yang meleset satu hari dapat memindahkannya ke masa pajak yang salah.
 */
export function tanggal(iso: string, bahasa: string): string {
  const [tahun, bulan, hari] = iso.slice(0, 10).split('-').map(Number)
  if (tahun === undefined || bulan === undefined || hari === undefined) return iso

  return new Intl.DateTimeFormat(localeUntuk(bahasa), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(tahun, bulan - 1, hari)))
}

/** Tanggal pendek untuk tabel: `20 Agu 2026` / `20 Aug 2026`. */
export function tanggalPendek(iso: string, bahasa: string): string {
  const [tahun, bulan, hari] = iso.slice(0, 10).split('-').map(Number)
  if (tahun === undefined || bulan === undefined || hari === undefined) return iso

  return new Intl.DateTimeFormat(localeUntuk(bahasa), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(tahun, bulan - 1, hari)))
}

/** Nama bulan saja: `Agustus 2026` / `August 2026`. Dipakai header laporan. */
export function bulanTahun(kunci: string, bahasa: string): string {
  const [tahun, bulan] = kunci.split('-').map(Number)
  if (tahun === undefined || bulan === undefined) return kunci

  return new Intl.DateTimeFormat(localeUntuk(bahasa), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(tahun, bulan - 1, 1)))
}

/**
 * Label periode fiskal: `FY2026 P8`.
 *
 * TIDAK diterjemahkan, dan itu keputusan. `FY` dan `P` adalah notasi yang sama
 * di seluruh sistem akuntansi, dan orang keuangan Indonesia membacanya tanpa
 * terjemahan. Menerjemahkannya menjadi `TB2026 P8` hanya membuat dua orang di
 * ruangan yang sama menyebut periode yang sama dengan dua nama.
 */
export function periodeFiskal(tahun: number, periode: number): string {
  return `FY${tahun} P${periode}`
}

/**
 * Formatter untuk interpolasi di dalam kalimat.
 *
 * Dipanggil i18next saat kunci memuat `{{nilai, angka}}`. Ini yang membuat
 * kalimat seperti "Ekspor {{jumlah, angka}} baris" memformat angkanya menurut
 * bahasa kalimatnya, bukan menurut bahasa yang kebetulan aktif saat nilainya
 * dihitung.
 */
export function formatterUntuk(
  nilai: unknown,
  format: string | undefined,
  bahasa: string | undefined,
  opsi?: Record<string, unknown>,
): string {
  const lang = bahasa ?? 'id'
  const mataUang = typeof opsi?.mataUang === 'string' ? opsi.mataUang : 'IDR'

  if (typeof nilai === 'number') {
    if (format === 'angka') return angka(nilai, mataUang, lang)
    if (format === 'uang') return uang(nilai, mataUang, lang)
    if (format === 'akuntansi') return akuntansi(nilai, mataUang, lang)
    if (format === 'bilangan') return new Intl.NumberFormat(localeUntuk(lang)).format(nilai)
  }

  if (typeof nilai === 'string') {
    if (format === 'tanggal') return tanggal(nilai, lang)
    if (format === 'tanggalPendek') return tanggalPendek(nilai, lang)
    if (format === 'bulanTahun') return bulanTahun(nilai, lang)
  }

  return String(nilai)
}
