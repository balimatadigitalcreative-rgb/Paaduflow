import i18next, { type i18n as I18n } from 'i18next'
import { initReactI18next } from 'react-i18next'

import { formatterUntuk } from './format.js'

/**
 * Perakitan i18n.
 *
 * Dipilih i18next karena empat hal yang menjadi syarat produk ini, dan satu di
 * antaranya menentukan:
 *
 * **Plural.** Indonesia, Melayu, Thai, dan Vietnam masing-masing punya SATU
 * bentuk plural; Inggris punya dua. i18next membaca aturannya dari
 * `Intl.PluralRules` (CLDR), sehingga menambah bahasa tidak menuntut siapa pun
 * menulis aturan plural — ia sudah tahu. Pustaka yang menyimpan aturannya
 * sendiri akan salah pada bahasa yang belum pernah dipikirkan penulisnya.
 *
 * Tiga sisanya: namespace per modul, pemuatan malas per bahasa+namespace, dan
 * pengetikan kunci yang membuat kunci hilang gagal saat build.
 */

export const BAHASA = ['id', 'en'] as const
export type Bahasa = (typeof BAHASA)[number]

export const BAHASA_BAWAAN: Bahasa = 'id'

/**
 * Namespace = modul. Satu berkas per modul per bahasa.
 *
 * Pemisahan ini yang membuat pemuatan malas bermakna: seseorang yang tidak
 * pernah membuka modul Pajak tidak pernah mengunduh string Pajak, dalam bahasa
 * mana pun.
 */
export const NAMESPACE = [
  'umum',
  'shell',
  'dasbor',
  'penjualan',
  'pembelian',
  'akuntansi',
  'pajak',
] as const
export type Namespace = (typeof NAMESPACE)[number]

/**
 * Muat satu berkas terjemahan.
 *
 * `import()` dengan path templat, bukan peta statis. Vite membaca pola ini dan
 * memecah setiap berkas menjadi chunk-nya sendiri — itulah yang membuat
 * pemuatan malas benar-benar terjadi alih-alih hanya terlihat begitu di kode.
 */
async function muat(bahasa: Bahasa, namespace: Namespace): Promise<Record<string, unknown>> {
  const modul = (await import(`./locales/${bahasa}/${namespace}.json`)) as {
    default: Record<string, unknown>
  }
  return modul.default
}

/**
 * Backend pemuat berkas locale.
 *
 * Dipasang sebagai backend, bukan dipanggil tangan dari setiap halaman. Bedanya
 * bukan kerapian: dengan backend, `useTranslation('pajak')` MEMICU pemuatannya
 * sendiri, dan halaman baru yang lupa mendaftarkan namespace-nya tidak bisa ada.
 * Pemuatan manual bekerja sampai seseorang menambah halaman dan melewatkan satu
 * baris — lalu layarnya kosong, bukan gagal.
 *
 * `changeLanguage` juga ikut benar dengan sendirinya: i18next memuat ulang
 * seluruh namespace yang sedang dipakai dalam bahasa baru sebelum
 * menyelesaikan janjinya, sehingga layar tidak pernah tergambar setengah
 * berganti bahasa.
 */
const pemuat = {
  type: 'backend' as const,

  read(
    bahasa: string,
    namespace: string,
    selesai: (galat: unknown, data: Record<string, unknown> | false) => void,
  ): void {
    if (!BAHASA.includes(bahasa as Bahasa) || !NAMESPACE.includes(namespace as Namespace)) {
      // `false`, bukan galat: bahasa atau namespace yang tidak dikenal berarti
      // tidak ada apa-apa untuk dimuat, dan mencoba lagi tidak akan mengubahnya.
      selesai(null, false)
      return
    }

    muat(bahasa as Bahasa, namespace as Namespace).then(
      (isi) => selesai(null, isi),
      (galat: unknown) => selesai(galat, false),
    )
  },
}

let terpasang: Promise<I18n> | null = null

export function i18n(): Promise<I18n> {
  terpasang ??= pasang()
  return terpasang
}

async function pasang(): Promise<I18n> {
  const awal = bahasaTersimpan() ?? BAHASA_BAWAAN

  await i18next
    .use(pemuat)
    .use(initReactI18next)
    .init({
    lng: awal,
    fallbackLng: BAHASA_BAWAAN,

    /*
     * Hanya DUA namespace dimuat di awal. Sisanya menyusul saat modulnya
     * dibuka — itulah yang membuat pemisahan per modul berarti sesuatu.
     */
    ns: ['umum', 'shell'],
    defaultNS: 'umum',

    // React di sini menunggu lewat `ready`, bukan lewat Suspense: Suspense di
    // tengah shell membuang seluruh pohon dan mengembalikan fokus ke awal
    // halaman setiap kali satu namespace baru dimuat.
    react: { useSuspense: false },

    interpolation: {
      // React sudah meng-escape isi. Meng-escape dua kali membuat tanda kutip
      // di nama perusahaan muncul sebagai `&quot;` di layar.
      escapeValue: false,
    },

    /*
     * Kunci yang hilang TIDAK dikembalikan sebagai kuncinya sendiri.
     *
     * Bawaan i18next menampilkan `penjualan.daftar.judul` di layar bila
     * terjemahannya tidak ada. Itu terlihat seperti bug kecil dan lolos ke
     * produksi. Mengembalikan string kosong membuatnya terlihat seperti yang
     * sebenarnya — teks yang hilang — dan uji CI yang membandingkan kedua
     * berkas locale yang benar-benar mencegahnya.
     */
    parseMissingKeyHandler: () => '',

    returnNull: false,
    })

  /*
   * Formatter didaftarkan lewat `services.formatter`, bukan lewat
   * `interpolation.format`.
   *
   * i18next 23 memindahkannya ke sini dan menghapus opsi lama di 26. Bedanya
   * bukan gaya: formatter bernama dapat dipanggil terpisah di dalam satu
   * kalimat — `{{dpp, angka}} ditambah {{ppn, angka}}` — sedangkan fungsi
   * tunggal yang lama harus menebak format apa yang diminta dari argumennya.
   */
  for (const nama of ['angka', 'uang', 'akuntansi', 'bilangan', 'tanggal', 'tanggalPendek', 'bulanTahun'] as const) {
    i18next.services.formatter?.add(nama, (nilai, bahasa, opsi) =>
      formatterUntuk(nilai, nama, bahasa, opsi as Record<string, unknown>),
    )
  }

  return i18next
}

/**
 * Mengganti bahasa.
 *
 * `changeLanguage` memuat ulang seluruh namespace yang SEDANG dipakai dalam
 * bahasa baru sebelum janjinya selesai — tanpa itu, layar yang terbuka tetap
 * berbahasa lama sampai orang menavigasi ke tempat lain, dan setengah layar
 * berganti sementara setengahnya tidak.
 */
export async function gantiBahasa(bahasa: Bahasa): Promise<void> {
  await i18next.changeLanguage(bahasa)
}

const KUNCI_BAHASA = 'paadu.bahasa'

/**
 * Bahasa dari penyimpanan lokal — hanya sebagai CADANGAN.
 *
 * Sumber kebenarannya preferensi pengguna di server; ini dipakai supaya layar
 * pertama tidak berkedip dalam bahasa yang salah sebelum profilnya sampai.
 */
export function bahasaTersimpan(): Bahasa | null {
  if (typeof localStorage === 'undefined') return null
  const nilai = localStorage.getItem(KUNCI_BAHASA)
  return BAHASA.includes(nilai as Bahasa) ? (nilai as Bahasa) : null
}

export function simpanBahasa(bahasa: Bahasa): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KUNCI_BAHASA, bahasa)
}
