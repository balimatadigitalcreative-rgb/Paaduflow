#!/usr/bin/env node
/**
 * Menjaga `.env.example` tetap sama dengan yang dituntut kode.
 *
 * Lahir dari deploy yang gagal sembilan kali: `.env.example` tidak menyebut
 * TOKEN_SIGNING_SECRET maupun MFA_ENCRYPTION_KEY, sehingga `.env` yang disusun
 * berdasarkan berkas itu kehilangan keduanya. Kesalahan berikutnya lebih halus
 * — MFA_ENCRYPTION_KEY diisi `openssl rand -hex 32`, dan formatnya memang tidak
 * tertulis di mana pun.
 *
 * Tiga hal yang diperiksa, dan ketiganya lahir dari kegagalan nyata:
 *
 * 1. Setiap variabel WAJIB di kode tercantum di `.env.example`.
 * 2. Setiap variabel wajib punya baris `Format` — nama saja tidak cukup untuk
 *    mengisinya dengan benar.
 * 3. Setiap RAHASIA punya baris `Buat` berisi perintah pembuatnya. "Isi dengan
 *    nilai acak" adalah instruksi yang tetap membiarkan orang memilih hex.
 *
 * Daftar wajibnya dibaca dari `src/composition/main.ts`, satu-satunya tempat
 * yang menolak proses menyala. Bila bentuknya berubah dan daftarnya tidak lagi
 * dapat dibaca, pemeriksaan ini GAGAL alih-alih diam — pemeriksa yang mati
 * diam-diam lebih buruk daripada tidak ada pemeriksa.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const AKAR = new URL('..', import.meta.url)
const baca = (relatif) => readFileSync(fileURLToPath(new URL(relatif, AKAR)), 'utf8')

/** Nama yang menandakan sebuah nilai adalah rahasia, bukan sekadar konfigurasi. */
const POLA_RAHASIA = /SECRET|KEY|PASSWORD|TOKEN/

const masalah = []

// ── Daftar wajib, dari kode ────────────────────────────────────────────────

const main = baca('src/composition/main.ts')
const cocok = main.match(/for \(const nama of \[([^\]]+)\]\)/)

if (cocok === null) {
  console.error('Tidak dapat membaca daftar variabel wajib dari src/composition/main.ts.')
  console.error('Bentuk `for (const nama of [...])` berubah — perbarui tools/check-env-example.js')
  console.error('agar pemeriksaan ini tidak mati diam-diam.')
  process.exit(1)
}

const wajib = [...cocok[1].matchAll(/'([A-Z_][A-Z0-9_]*)'/g)].map((bagian) => bagian[1])

if (wajib.length === 0) {
  console.error('Daftar variabel wajib terbaca kosong. Itu hampir pasti salah.')
  process.exit(1)
}

// ── Isi .env.example ───────────────────────────────────────────────────────

const contoh = baca('.env.example')
const baris = contoh.split('\n')

/** Blok komentar tepat di atas sebuah variabel, sampai baris kosong. */
function komentarDiAtas(indeks) {
  const kumpul = []
  for (let i = indeks - 1; i >= 0; i -= 1) {
    const teks = baris[i]
    if (teks.trim() === '') break
    if (!teks.trimStart().startsWith('#')) break
    kumpul.unshift(teks)
  }
  return kumpul.join('\n')
}

const ditemukan = new Map()
baris.forEach((teks, indeks) => {
  const nama = teks.match(/^([A-Z_][A-Z0-9_]*)=/)
  if (nama !== null) ditemukan.set(nama[1], komentarDiAtas(indeks))
})

for (const nama of wajib) {
  if (!ditemukan.has(nama)) {
    masalah.push([
      `${nama} dituntut kode tetapi tidak ada di .env.example.`,
      'Tambahkan beserta baris Format, dan baris Buat bila ia rahasia.',
    ])
    continue
  }

  const komentar = ditemukan.get(nama)

  if (!/^#\s*Format/m.test(komentar)) {
    masalah.push([
      `${nama} ada di .env.example tetapi tidak menyebutkan formatnya.`,
      'Tambahkan baris komentar yang diawali "# Format".',
    ])
  }

  if (POLA_RAHASIA.test(nama) && !/^#\s*Buat/m.test(komentar)) {
    masalah.push([
      `${nama} adalah rahasia tetapi tidak menyebutkan perintah pembuatnya.`,
      'Tambahkan baris komentar yang diawali "# Buat", mis. openssl rand -base64 32.',
    ])
  }
}

// ── Hasil ──────────────────────────────────────────────────────────────────

if (masalah.length > 0) {
  console.error('')
  console.error(`Pemeriksaan .env.example gagal: ${masalah.length} masalah.`)
  for (const [judul, saran] of masalah) {
    console.error('')
    console.error(`  ${judul}`)
    console.error(`      ${saran}`)
  }
  console.error('')
  console.error('  .env yang disusun dari .env.example yang tidak lengkap akan membuat')
  console.error('  `npm start` menolak menyala — dan itu baru terlihat di log manajer proses.')
  console.error('')
  process.exit(1)
}

console.log(
  `.env.example memuat ${wajib.length} variabel wajib, seluruhnya beserta format` +
    ` dan perintah pembuat untuk yang rahasia.`,
)
