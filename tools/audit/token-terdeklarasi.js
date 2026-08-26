#!/usr/bin/env node
/**
 * Setiap `var(--token)` di CSS hasil build harus punya deklarasinya.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *   MENGAPA INI ADA
 *
 *   `var(--yang-tidak-ada)` tidak melempar apa pun. Ia tidak muncul di konsol,
 *   tidak menggagalkan build, dan tidak meninggalkan satu pun jejak. Properti
 *   yang memakainya sekadar tidak berlaku — dan hasilnya terlihat seperti
 *   keputusan desain yang memang begitu.
 *
 *   Itu yang terjadi pada `--size-chart-bar`. Deploy berakhir hijau, CSS
 *   tersaji, komponennya memakai variabelnya — dan grafiknya tetap setinggi
 *   apa adanya karena deklarasinya tidak pernah ikut. Sebabnya: `tokens:build`
 *   adalah kait `prebuild:web`, dan langkah deploy memanggil `npx vite build`
 *   langsung sehingga kaitnya dilewati.
 *
 *   Pemeriksa ini berjalan atas HASIL BUILD, bukan atas kode sumber. Di sumber,
 *   semuanya selalu benar — yang tertinggal adalah berkas bangkitan di server.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Pemakaian:
 *   node tools/audit/token-terdeklarasi.js [direktori dist/web]
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AKAR = fileURLToPath(new URL('../..', import.meta.url))
const BAWAAN = join(AKAR, 'dist', 'web')

/**
 * Variabel yang memang tidak dideklarasikan di CSS.
 *
 * Daftarnya pendek dan disebut satu per satu. Yang ada di sini hanya variabel
 * yang dipasang JavaScript saat berjalan, atau yang memang milik peramban.
 */
const DILUAR_CSS = new Set([])

function berkasCss(dir) {
  const hasil = []
  for (const nama of readdirSync(dir)) {
    const jalur = join(dir, nama)
    if (statSync(jalur).isDirectory()) hasil.push(...berkasCss(jalur))
    else if (nama.endsWith('.css')) hasil.push(jalur)
  }
  return hasil
}

/**
 * Memeriksa satu kumpulan CSS.
 *
 * Dipakai dari baris perintah maupun dari test, sehingga penjaga ini sendiri
 * dapat diuji terhadap pelanggaran sungguhan.
 */
export function periksaToken(daftarIsi) {
  const gabungan = daftarIsi.join('\n')

  const dideklarasikan = new Set(
    [...gabungan.matchAll(/(--[\w-]+)\s*:/g)].map((cocok) => cocok[1]),
  )

  const dipakai = new Map()
  for (const cocok of gabungan.matchAll(/var\(\s*(--[\w-]+)\s*(?:,([^)]*))?\)/g)) {
    const nama = cocok[1]
    // `var(--x, fallback)` tetap berfungsi tanpa deklarasi. Itu memang gunanya
    // cadangan, jadi ia bukan pelanggaran.
    if (cocok[2] !== undefined) continue
    if (!dipakai.has(nama)) dipakai.set(nama, 0)
    dipakai.set(nama, dipakai.get(nama) + 1)
  }

  const hilang = []
  for (const [nama, jumlah] of dipakai) {
    if (dideklarasikan.has(nama) || DILUAR_CSS.has(nama)) continue
    hilang.push({ nama, jumlah })
  }

  return { hilang, jumlahDipakai: dipakai.size, jumlahDideklarasikan: dideklarasikan.size }
}

const dijalankanLangsung = process.argv[1]?.endsWith('token-terdeklarasi.js') === true

if (dijalankanLangsung) {
  const dir = process.argv[2] ?? BAWAAN

  let daftar
  try {
    daftar = berkasCss(dir)
  } catch {
    console.error(`\n  Tidak dapat membaca ${dir}. Jalankan build lebih dulu.\n`)
    process.exit(1)
  }

  if (daftar.length === 0) {
    console.error(`\n  Tidak ada berkas CSS di ${dir}. Jalankan build lebih dulu.\n`)
    process.exit(1)
  }

  const { hilang, jumlahDipakai, jumlahDideklarasikan } = periksaToken(
    daftar.map((satu) => readFileSync(satu, 'utf8')),
  )

  console.log('')
  console.log('  AUDIT TOKEN TERDEKLARASI')
  console.log('')
  console.log(`  ${jumlahDipakai} token dipakai, ${jumlahDideklarasikan} dideklarasikan`)

  if (hilang.length > 0) {
    console.error('')
    console.error(`  ${hilang.length} token DIPAKAI tanpa deklarasi:`)
    console.error('')
    for (const { nama, jumlah } of hilang) {
      console.error(`      ${nama}  (${jumlah}×)`)
    }
    console.error('')
    console.error('  `var()` tanpa deklarasi tidak melempar apa pun — propertinya sekadar')
    console.error('  tidak berlaku, dan hasilnya terlihat seperti keputusan desain.')
    console.error('')
    console.error('  Bila token ini baru: jalankan `npm run tokens:build`, dan pastikan')
    console.error('  langkah build di server ikut menjalankannya.')
    console.error('')
    process.exit(1)
  }

  console.log('  Seluruhnya terdeklarasi.')
  console.log('')
}
