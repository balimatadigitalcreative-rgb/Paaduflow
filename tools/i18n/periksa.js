#!/usr/bin/env node
/**
 * Dua penjaga i18n, keduanya menggagalkan CI.
 *
 * 1. **Kesamaan kunci.** Kunci yang ada di satu bahasa tetapi tidak di bahasa
 *    lain menghasilkan teks kosong di layar — dan teks kosong lolos tinjauan
 *    karena tidak terlihat seperti kesalahan.
 *
 * 2. **String keras di komponen.** Tanpa ini kode kembali melenceng dalam dua
 *    bulan, dan tidak ada satu momen pun yang dapat ditunjuk sebagai
 *    penyebabnya.
 *
 * Penjaga kedua memakai DAFTAR TUNGGU, bukan pengecualian permanen. Berkas
 * yang belum diekstraksi tercatat di sana beserta jumlah pelanggarannya, dan
 * jumlah itu hanya boleh TURUN. Berkas baru tidak pernah boleh masuk daftar
 * tanpa seseorang menambahkannya secara sadar — dan itu terlihat di tinjauan
 * kode sebagai baris yang berubah di berkas ini.
 *
 * Ini pilihan sadar: menuntut hampir empat ratus string diekstraksi sekaligus
 * sebelum penjaga dinyalakan berarti penjaganya tidak pernah menyala. Daftar
 * yang menyusut menghentikan kebocoran hari ini dan membuat sisa utangnya
 * terlihat setiap kali CI berjalan.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const AKAR = fileURLToPath(new URL('../..', import.meta.url))
const LOCALES = join(AKAR, 'src/interface/web/i18n/locales')
const WEB = join(AKAR, 'src/interface/web')

/**
 * Berkas yang stringnya belum diekstraksi, beserta jumlah pelanggarannya.
 *
 * Angkanya batas ATAS, dan diukur — bukan ditebak. Jalankan
 * `npm run check:i18n -- --ukur-ulang` untuk membangkitkannya kembali, dan
 * lakukan itu hanya bila Anda memang bermaksud menerima keadaan baru sebagai
 * batas.
 */
const DAFTAR_TUNGGU = {}

/**
 * Harness pengembangan — bukan layar produk.
 *
 * Kriterianya sempit dan dapat diperiksa: berkas ini TIDAK diimpor dari mana
 * pun yang dapat dicapai `main.tsx`; satu-satunya yang mengimpornya adalah
 * test. Isinya contoh komponen untuk audit aksesibilitas, dan teksnya memang
 * bahan uji.
 *
 * Bukan pengecualian permanen bagi berkas produk: begitu salah satu dirutekan
 * ke dalam aplikasi, ia harus keluar dari daftar ini dan stringnya diekstraksi.
 * Daftarnya pendek, dan setiap penambahan terlihat di tinjauan kode sebagai
 * baris yang berubah di berkas ini.
 */
const HARNESS = new Set(['gallery.tsx'])

function berkasDi(dir, filter) {
  const hasil = []
  for (const nama of readdirSync(dir)) {
    const jalur = join(dir, nama)
    if (statSync(jalur).isDirectory()) hasil.push(...berkasDi(jalur, filter))
    else if (filter(nama)) hasil.push(jalur)
  }
  return hasil
}

function namaRelatif(jalur) {
  return relative(WEB, jalur).split('\\').join('/')
}

function ratakan(obyek, awalan = '') {
  return Object.entries(obyek).flatMap(([kunci, nilai]) =>
    typeof nilai === 'object' && nilai !== null
      ? ratakan(nilai, `${awalan}${kunci}.`)
      : [`${awalan}${kunci}`],
  )
}

/**
 * Kunci plural dibandingkan menurut BASISNYA, bukan menurut sufiksnya.
 *
 * Indonesia hanya punya `_other`; Inggris punya `_one` dan `_other`. Menuntut
 * keduanya identik akan memaksa menulis `_one` di berkas Indonesia — kunci yang
 * tidak akan pernah dipakai, dan yang menyesatkan penerjemah berikutnya.
 *
 * Bahasa yang akan menyusul memperkuat ini: Melayu, Thai, dan Vietnam juga
 * hanya punya satu bentuk.
 */
function basisPlural(kunci) {
  return kunci.replace(/_(zero|one|two|few|many|other)$/, '')
}

function periksaLocale() {
  const bahasa = readdirSync(LOCALES)
  const masalah = []
  const perNamespace = new Map()

  for (const satu of bahasa) {
    for (const berkas of readdirSync(join(LOCALES, satu))) {
      const ns = berkas.replace(/\.json$/, '')
      const isi = JSON.parse(readFileSync(join(LOCALES, satu, berkas), 'utf8'))
      const daftar = perNamespace.get(ns) ?? new Map()
      daftar.set(satu, new Set(ratakan(isi).map(basisPlural)))
      perNamespace.set(ns, daftar)
    }
  }

  for (const [ns, perBahasa] of perNamespace) {
    if (perBahasa.size !== bahasa.length) {
      const hilang = bahasa.filter((satu) => !perBahasa.has(satu))
      masalah.push(`namespace "${ns}" tidak ada di bahasa: ${hilang.join(', ')}`)
      continue
    }

    const [acuan, ...sisanya] = [...perBahasa.entries()]
    for (const [lain, kunci] of sisanya) {
      for (const satu of acuan[1]) {
        if (!kunci.has(satu)) {
          masalah.push(`${ns}: "${satu}" ada di ${acuan[0]}, hilang di ${lain}`)
        }
      }
      for (const satu of kunci) {
        if (!acuan[1].has(satu)) {
          masalah.push(`${ns}: "${satu}" ada di ${lain}, hilang di ${acuan[0]}`)
        }
      }
    }
  }

  return masalah
}

/**
 * Pola string yang terlihat pengguna.
 *
 * Sengaja tidak sempurna: ia mencari teks yang diawali huruf kapital dan cukup
 * panjang untuk menjadi kalimat. Pemeriksa yang menuntut analisis sempurna
 * adalah pemeriksa yang akan dimatikan orang saat ia mengganggu — dan pemeriksa
 * yang dimatikan tidak menangkap apa pun.
 */
const POLA_JSX = />[\s]*[A-Z][a-zA-Z][^<>{}]{4,}[\s]*</g
const POLA_ATRIBUT =
  /\b(?:aria-label|title|placeholder|caption|label|message|header)=["'][A-Z][^"']{4,}["']/g

function hitungStringKeras(isi, adaJsx) {
  const tanpaKomentar = isi
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

  let jumlah = (tanpaKomentar.match(POLA_ATRIBUT) ?? []).length

  /*
   * Pola teks JSX hanya dipakai di berkas `.tsx`.
   *
   * Di `.ts` ia menangkap sintaks generik — `Promise<TableState<Baris>>`
   * terbaca sebagai `>TableState<` — dan pemeriksa yang menuduh hal yang jelas
   * bukan teks pengguna kehilangan wibawa, lalu dimatikan orang saat ia
   * mengganggu.
   */
  if (adaJsx) jumlah += (tanpaKomentar.match(POLA_JSX) ?? []).length

  return jumlah
}

function periksaStringKeras() {
  const masalah = []

  for (const jalur of berkasDi(WEB, (n) => n.endsWith('.tsx') || n.endsWith('.ts'))) {
    const nama = namaRelatif(jalur)
    if (nama.startsWith('i18n/')) continue
    if (HARNESS.has(nama)) continue

    const jumlah = hitungStringKeras(readFileSync(jalur, 'utf8'), nama.endsWith('.tsx'))
    const batas = DAFTAR_TUNGGU[nama]

    if (batas === undefined) {
      if (jumlah > 0) {
        masalah.push(
          `${nama}: ${jumlah} string keras di berkas yang TIDAK ada di daftar tunggu. ` +
            'Pakai t() dari i18next.',
        )
      }
      continue
    }

    if (jumlah > batas) {
      masalah.push(
        `${nama}: ${jumlah} string keras, naik dari batas ${batas}. ` +
          'Daftar tunggu hanya boleh menyusut.',
      )
    }
  }

  return masalah
}

export function periksaI18n() {
  return { locale: periksaLocale(), stringKeras: periksaStringKeras() }
}

export function ukurUlang() {
  const hasil = {}
  for (const jalur of berkasDi(WEB, (n) => n.endsWith('.tsx') || n.endsWith('.ts'))) {
    const nama = namaRelatif(jalur)
    if (nama.startsWith('i18n/')) continue
    if (HARNESS.has(nama)) continue
    const jumlah = hitungStringKeras(readFileSync(jalur, 'utf8'), nama.endsWith('.tsx'))
    if (jumlah > 0) hasil[nama] = jumlah
  }
  return Object.fromEntries(Object.entries(hasil).sort((a, b) => b[1] - a[1]))
}

const dijalankanLangsung = process.argv[1]?.endsWith('periksa.js') === true

if (dijalankanLangsung && process.argv.includes('--ukur-ulang')) {
  const diukur = ukurUlang()
  const baris = Object.entries(diukur).map(([k, v]) => `  ${JSON.stringify(k)}: ${v},`)
  const total = Object.values(diukur).reduce((a, b) => a + b, 0)

  console.log(['const DAFTAR_TUNGGU = {', ...baris, '}'].join('\n'))
  console.error(`\n  ${total} string di ${baris.length} berkas.\n`)
  process.exit(0)
}

if (dijalankanLangsung) {
  const { locale, stringKeras } = periksaI18n()
  const utang = Object.values(DAFTAR_TUNGGU).reduce((a, b) => a + b, 0)

  const keluaran = [
    '',
    '  PEMERIKSAAN i18n',
    '',
    `  Kesamaan kunci locale : ${locale.length === 0 ? 'lolos' : `${locale.length} masalah`}`,
    ...locale.map((satu) => `    ${satu}`),
    `  String keras baru     : ${stringKeras.length === 0 ? 'tidak ada' : `${stringKeras.length} masalah`}`,
    ...stringKeras.map((satu) => `    ${satu}`),
    '',
    utang === 0
      ? `  Utang ekstraksi tersisa: tidak ada. ${HARNESS.size} harness dikecualikan.`
      : `  Utang ekstraksi tersisa: ${utang} string di ${Object.keys(DAFTAR_TUNGGU).length} berkas`,
    '',
  ]

  console.log(keluaran.join('\n'))
  if (locale.length + stringKeras.length > 0) process.exitCode = 1
}
