import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

/*
 * Font di-host sendiri, bukan dari CDN pihak ketiga.
 *
 * Aplikasi ini menyimpan data keuangan. Memanggil server luar di setiap
 * pemuatan halaman memberi tahu pihak itu siapa memakai apa dan kapan —
 * metadata yang tidak perlu dibagikan untuk sekadar mendapat huruf. Berkasnya
 * ikut terbundel ke `dist/web` dan disajikan dari server yang sama.
 *
 * TIGA bobot: 400 badan teks, 500 penegasan dan item nav aktif, 600 judul.
 * Bobot lain tidak dirujuk design system mana pun, dan memuatnya menambah
 * berkas yang tidak akan pernah dipakai.
 *
 * Subset LATIN saja. Teks Indonesia tidak memerlukan Sirilik, Yunani, maupun
 * Vietnam, dan berkas subset itu tetap tersalin ke hasil build walau peramban
 * tidak pernah mengunduhnya.
 *
 * `font-display: swap` sudah ditetapkan berkas-berkas ini — teks tampil dengan
 * font sistem lebih dulu, lalu berganti. Halaman keuangan yang kosong selama
 * font dimuat lebih buruk daripada halaman yang hurufnya berganti sekali.
 */
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'

import '../../styles/tokens.css'
import '../../styles/base.css'

import { App } from './app.js'
import { i18n } from './i18n/index.js'

const root = document.getElementById('root')
if (root === null) throw new Error('Elemen #root tidak ditemukan.')

/*
 * i18n dipasang SEBELUM render pertama, bukan di dalam sebuah efek.
 *
 * `Suspense` dengan penanda pemuatan akan bekerja juga, tetapi menghasilkan
 * layar yang berkedip: shell tergambar tanpa teks, lalu terisi. Menunggu dua
 * berkas locale — keduanya kecil dan datang dari server yang sama — lebih
 * murah daripada kedipan itu.
 *
 * Bahasa yang dipakai di sini datang dari penyimpanan lokal sebagai TEBAKAN
 * awal. Sumber kebenarannya preferensi di server, yang tiba sesaat kemudian
 * lewat `/v1/me` dan menggantinya bila berbeda.
 */
await i18n()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
