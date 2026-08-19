#!/usr/bin/env node
/**
 * Commit, push, lalu deploy — satu perintah.
 *
 * `npm run deploy` sengaja MENOLAK berjalan bila ada perubahan belum
 * di-commit: yang ter-deploy harus dapat ditunjuk di GitHub. Aturan itu benar
 * dan tidak dilonggarkan di sini. Yang dilakukan berkas ini hanya menutup
 * langkah manual di depannya — meminta konfirmasi, meng-commit, mendorong —
 * lalu menyerahkan sisanya utuh.
 *
 * Seluruh logika server tetap milik `deploy.js` dan dipanggil apa adanya:
 * gerbang prasyarat, konfirmasi migrasi terpisah, verifikasi kesehatan, dan
 * berhenti di kegagalan pertama. Menyalinnya ke sini berarti dua urutan deploy
 * yang lambat laun berbeda — dan yang menyimpang adalah yang jarang dijalankan.
 *
 * Tanpa perubahan untuk di-commit, langkah 1 dan 2 dilewati. Itu keadaan wajar
 * saat mengulang deploy yang gagal atau sesudah rollback.
 */

import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const WARNA = process.stdout.isTTY === true
const merah = (teks) => (WARNA ? `[31m${teks}[0m` : teks)
const hijau = (teks) => (WARNA ? `[32m${teks}[0m` : teks)
const redup = (teks) => (WARNA ? `[2m${teks}[0m` : teks)

function jalankan(perintah, argumen, opsi = {}) {
  return new Promise((resolve) => {
    const anak = spawn(perintah, argumen, { shell: false, ...opsi })
    let keluaran = ''
    let galat = ''
    anak.stdout?.on('data', (potongan) => (keluaran += potongan))
    anak.stderr?.on('data', (potongan) => (galat += potongan))
    anak.on('error', (kesalahan) => resolve({ kode: 127, keluaran, galat: kesalahan.message }))
    anak.on('close', (kode) => resolve({ kode: kode ?? 1, keluaran, galat }))
  })
}

const git = (argumen) => jalankan('git', argumen)

/**
 * Bertanya, dan menyerah bila masukannya berakhir.
 *
 * `question()` tidak pernah selesai bila stdin tertutup lebih dulu — prosesnya
 * lalu mati dengan "unsettled top-level await" tanpa satu pun pesan yang
 * berguna. Itu terjadi setiap kali perintah ini dijalankan tanpa terminal:
 * dari skrip, dari CI, atau dari pipa.
 *
 * Masukan yang berakhir diperlakukan sebagai penolakan, bukan persetujuan.
 */
async function tanyakan(antarmuka, prompt) {
  const jawaban = await Promise.race([
    antarmuka.question(prompt),
    new Promise((selesai) => antarmuka.once('close', () => selesai(null))),
  ])
  return jawaban === null ? null : jawaban.trim()
}


function berhenti(langkah, hasil, saran) {
  console.error('')
  console.error(merah(`  ✕ Gagal pada: ${langkah}`))
  console.error('')
  const isi = [hasil?.galat, hasil?.keluaran].filter((bagian) => bagian && bagian.trim() !== '')
  for (const bagian of isi) {
    for (const baris of String(bagian).trimEnd().split('\n')) console.error(`      ${baris}`)
  }
  if (saran !== undefined) {
    console.error('')
    console.error(`  ${saran}`)
  }
  console.error('')
  process.exit(1)
}

/**
 * Pesan commit yang disusun dari perubahannya sendiri.
 *
 * Ia menyebutkan APA yang berubah dan tidak pernah mengarang KENAPA — alasannya
 * hanya diketahui yang mengubahnya. Karena itu pesan ini selalu dapat ditolak
 * atau diganti sebelum dipakai, dan ia mengaku dibangkitkan.
 */
function susunPesan(status, ringkas) {
  const berkas = status
    .trim()
    .split('\n')
    .map((baris) => baris.slice(3).trim())
    .filter((nama) => nama !== '')

  const area = new Set()
  for (const nama of berkas) {
    if (nama.startsWith('src/')) area.add('kode')
    else if (nama.startsWith('tests/')) area.add('test')
    else if (nama.startsWith('migrations/')) area.add('migrasi')
    else if (nama.startsWith('docs/')) area.add('dokumen')
    else if (nama.startsWith('tools/')) area.add('tooling')
    else area.add('konfigurasi')
  }

  const judul =
    area.size === 0 ? 'Perubahan' : `Perubahan pada ${[...area].join(', ')} (${berkas.length} berkas)`

  return [
    judul,
    '',
    'Pesan ini dibangkitkan `npm run ship` dari daftar perubahannya. Ia',
    'menyebutkan apa yang berubah, bukan alasannya.',
    '',
    ringkas.trimEnd(),
    '',
  ].join('\n')
}

// ── 1 · Perubahan lokal ────────────────────────────────────────────────────

console.log('\n  ship — commit, push, lalu deploy')

const status = await git(['status', '--porcelain'])
if (status.kode !== 0) berhenti('git status', status)

if (status.keluaran.trim() === '') {
  console.log(redup('\n  1. Tidak ada perubahan untuk di-commit — dilewati'))
  console.log(redup('  2. Tidak ada yang perlu di-push — dilewati'))
} else {
  const ringkas = await git(['diff', '--stat', 'HEAD'])
  const cabang = (await git(['branch', '--show-current'])).keluaran.trim()

  console.log(`\n  1. Perubahan belum di-commit pada branch ${cabang}\n`)
  for (const baris of status.keluaran.trimEnd().split('\n')) console.log(`      ${baris}`)

  const barisRingkas = ringkas.keluaran.trim().split('\n')
  const total = barisRingkas[barisRingkas.length - 1]
  if (total !== undefined && total !== '') console.log(redup(`\n      ${total.trim()}`))

  let pesan = susunPesan(status.keluaran, ringkas.keluaran)

  console.log('\n  Pesan commit yang diusulkan:\n')
  for (const baris of pesan.trimEnd().split('\n')) console.log(redup(`      ${baris}`))
  console.log('')

  const tanya = createInterface({ input: process.stdin, output: process.stdout })
  const mentah = await tanyakan(tanya, '  Pakai pesan ini? (ya / ubah / batal) ')
  const jawab = mentah === null ? 'batal' : mentah.toLowerCase()

  if (jawab === 'batal' || jawab === '') {
    tanya.close()
    console.error('')
    console.error(merah('  ✕ Dibatalkan. Tidak ada yang di-commit, di-push, maupun di-deploy.'))
    console.error('')
    process.exit(1)
  }

  if (jawab === 'ubah') {
    const sendiri = await tanyakan(tanya, '  Pesan commit: ')
    tanya.close()
    if (sendiri === null || sendiri === '') {
      berhenti('menyusun pesan commit', {
        galat: 'Pesan kosong atau masukan berakhir. Tidak ada yang di-commit.',
      })
    }
    pesan = sendiri ?? ''
  } else if (jawab === 'ya') {
    tanya.close()
  } else {
    tanya.close()
    berhenti('konfirmasi', {
      galat: `Jawaban "${jawab}" tidak dikenal. Ketik ya, ubah, atau batal.`,
    })
  }

  const tambah = await git(['add', '-A'])
  if (tambah.kode !== 0) berhenti('git add', tambah)

  const commit = await git(['commit', '-m', pesan])
  if (commit.kode !== 0) {
    berhenti(
      'git commit',
      commit,
      'Hook pre-commit menolak. Perbaiki lalu jalankan `npm run ship` lagi — tidak ada yang terlanjur ter-push.',
    )
  }

  const sidik = (await git(['rev-parse', '--short', 'HEAD'])).keluaran.trim()
  console.log(hijau(`\n     ${sidik} ter-commit`))

  // ── 2 · Push ─────────────────────────────────────────────────────────────

  console.log('\n  2. Push ke origin')
  const dorong = await git(['push'])
  if (dorong.kode !== 0) {
    berhenti(
      'git push',
      dorong,
      'Commit-nya sudah ada di lokal, server belum tersentuh. Perbaiki lalu ulangi.',
    )
  }
  console.log(hijau('     terkirim'))
}

// ── 3 · Deploy ─────────────────────────────────────────────────────────────
//
// Dipanggil apa adanya, dengan stdio diwariskan supaya konfirmasi migrasinya
// tetap dapat dijawab. Seluruh gerbangnya tetap berjalan — termasuk gerbang
// lokal, yang kini lolos justru karena langkah 1 dan 2 sudah membereskannya.

console.log(redup('\n  3. Menyerahkan ke npm run deploy'))

// Dipanggil sebagai skrip Node langsung, bukan lewat `npm run deploy`.
// Isinya sama persis — `npm run deploy` hanya alias tipis ke berkas ini —
// tetapi menjalankannya lewat npm menuntut `shell: true` di Windows, karena
// Node menolak men-spawn `.cmd` tanpa shell. Shell dengan argumen terpisah
// menggabungkannya tanpa escape, dan Node memperingatkannya sebagai celah.
const skrip = fileURLToPath(new URL('deploy.js', import.meta.url))
const deploy = spawn(process.execPath, [skrip], { stdio: 'inherit' })

// Tanpa ini, kegagalan spawn berlalu tanpa satu baris pun keluaran — persis
// yang terjadi saat `npm.cmd` ditolak Node, dan butuh penelusuran untuk
// menemukannya.
deploy.on('error', (kesalahan) => {
  berhenti('menjalankan deploy', { galat: `${kesalahan.code ?? ''} ${kesalahan.message}`.trim() })
})

deploy.on('close', (kode) => process.exit(kode ?? 1))
