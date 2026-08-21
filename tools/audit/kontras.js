#!/usr/bin/env node
/**
 * Audit kontras WCAG 2.1 atas token yang BENAR-BENAR dipakai.
 *
 * Bukan atas seluruh token. Memeriksa semuanya menghasilkan kegagalan pada
 * pasangan yang tidak pernah bersinggungan di layar — dan laporan yang penuh
 * kegagalan palsu adalah laporan yang berhenti dibaca.
 *
 * Pasangan di bawah disusun dari pembacaan CSS: warna teks apa yang muncul di
 * atas latar apa. Bila sebuah pasangan baru muncul di kode, ia harus
 * ditambahkan di sini — dan itu disengaja, karena keputusan "pasangan ini
 * memang dipakai" tidak dapat disimpulkan mesin dari CSS saja.
 *
 * Metode: luminansi relatif WCAG, sRGB, dengan koreksi gamma. Sama dengan yang
 * dipakai di Step 8.1 supaya angkanya dapat dibandingkan langsung.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const TOKENS = fileURLToPath(new URL('../../src/styles/tokens.css', import.meta.url))

/**
 * Pasangan yang diperiksa, beserta ambangnya.
 *
 * 4,5 untuk teks biasa (WCAG 1.4.3). 3,0 untuk batas komponen dan teks besar
 * (1.4.11). Pembatas dekoratif TIDAK diperiksa: WCAG 1.4.11 mengatur batas yang
 * dibutuhkan untuk mengidentifikasi komponen, dan garis pemisah baris tabel
 * bukan salah satunya. Ambang yang salah di sini menghasilkan perbaikan yang
 * tidak perlu — pelajaran dari dua salah alarm di Step 8.1.
 */
const PASANGAN = [
  ['--text-primary', '--bg-canvas', 4.5, 'Teks utama di kanvas'],
  ['--text-primary', '--bg-surface', 4.5, 'Teks utama di permukaan'],
  ['--text-primary', '--bg-surface-raised', 4.5, 'Teks utama di permukaan terangkat'],
  ['--text-secondary', '--bg-surface', 4.5, 'Teks sekunder di permukaan'],
  ['--text-secondary', '--bg-surface-raised', 4.5, 'Teks sekunder di kartu'],
  ['--text-tertiary', '--bg-surface', 4.5, 'Teks tersier di permukaan'],
  ['--text-tertiary', '--bg-surface-sunken', 4.5, 'Teks tersier di permukaan cekung'],
  ['--text-accent', '--bg-surface', 4.5, 'Tautan dan aksen di permukaan'],
  ['--text-accent', '--bg-surface-raised', 4.5, 'Aksen di kartu KPI'],
  ['--text-success', '--bg-surface', 4.5, 'Status berhasil'],
  ['--text-warning', '--bg-surface', 4.5, 'Status peringatan'],
  ['--text-danger', '--bg-surface', 4.5, 'Status bahaya'],
  ['--border-focus', '--bg-surface', 3.0, 'Ring fokus di permukaan'],
  ['--border-focus', '--bg-canvas', 3.0, 'Ring fokus di kanvas'],
  /*
   * `--border-interactive`, BUKAN `--border-strong`.
   *
   * WCAG 1.4.11 mengatur batas yang dibutuhkan untuk MENGIDENTIFIKASI
   * komponen. `.control` — pembungkus setiap input teks — memakai
   * `--border-interactive`; `--border-strong` hanya dipakai untuk hover dan
   * pembatas subtotal, yang bersifat penegasan dan bukan penanda keberadaan
   * kontrol.
   *
   * Menguji yang salah menghasilkan kegagalan yang menuntut perbaikan pada
   * token yang memang tidak perlu berubah. Ini kesalahan yang sama dengan dua
   * salah alarm di Step 8.1, dan saya membuatnya lagi di sini.
   */
  ['--border-interactive', '--bg-surface', 3.0, 'Batas kontrol'],
  ['--text-on-accent', '--action-primary-bg', 4.5, 'Teks di tombol primer'],
]

function baca(css, mulai, selesai) {
  const potong = css.slice(mulai, selesai)
  const peta = new Map()
  for (const cocok of potong.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) {
    peta.set(cocok[1], cocok[2].trim())
  }
  return peta
}

/** Menelusuri `var(--x)` sampai ketemu hex. Alias berlapis wajar di token. */
function resolusi(peta, nama, kedalaman = 0) {
  if (kedalaman > 10) return null
  const nilai = peta.get(nama)
  if (nilai === undefined) return null
  const alias = /^var\((--[a-z0-9-]+)\)$/.exec(nilai)
  if (alias !== null) return resolusi(peta, alias[1], kedalaman + 1)
  return /^#[0-9A-Fa-f]{6}$/.test(nilai) ? nilai : null
}

function luminansi(hex) {
  const kanal = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = kanal.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function rasio(depan, belakang) {
  const a = luminansi(depan)
  const b = luminansi(belakang)
  const terang = Math.max(a, b)
  const gelap = Math.min(a, b)
  return (terang + 0.05) / (gelap + 0.05)
}

export function audit() {
  const css = readFileSync(TOKENS, 'utf8')
  const awalDark = css.indexOf('[data-theme="dark"]')

  const light = baca(css, css.indexOf(':root'), awalDark)
  const dark = new Map(light)
  for (const [k, v] of baca(css, awalDark, css.length)) dark.set(k, v)

  const hasil = []
  for (const [depan, belakang, ambang, keterangan] of PASANGAN) {
    for (const [mode, peta] of [['light', light], ['dark', dark]]) {
      const a = resolusi(peta, depan)
      const b = resolusi(peta, belakang)
      if (a === null || b === null) {
        hasil.push({ keterangan, mode, depan, belakang, ambang, nilai: null, lolos: false })
        continue
      }
      const nilai = rasio(a, b)
      hasil.push({
        keterangan, mode, depan, belakang, ambang,
        nilai: Math.round(nilai * 100) / 100,
        lolos: nilai >= ambang,
      })
    }
  }
  return hasil
}

if (process.argv[1]?.endsWith('kontras.js') === true) {
  const hasil = audit()
  const gagal = hasil.filter((satu) => !satu.lolos)

  const baris = hasil.map((satu) => {
    const nilai = satu.nilai === null ? 'TIDAK TERBACA' : `${satu.nilai.toFixed(2)}:1`
    const tanda = satu.lolos ? 'lolos ' : 'GAGAL '
    return `  ${tanda} ${satu.mode.padEnd(5)} ${nilai.padStart(13)}  (min ${satu.ambang})  ${satu.keterangan}`
  })

  console.log(
    ['', '  AUDIT KONTRAS — WCAG 2.1 AA', '', ...baris, '',
     `  ${hasil.length - gagal.length} lolos, ${gagal.length} gagal`, ''].join('\n'),
  )

  if (gagal.length > 0) process.exitCode = 1
}
