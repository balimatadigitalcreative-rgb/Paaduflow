#!/usr/bin/env node
/**
 * Menjalankan SATU migrasi di luar transaksi tunggal — untuk migrasi yang
 * mengunci tabel lama.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *   BEDANYA DENGAN `npm run migrate`
 *
 *   `migrate` membungkus seluruh migrasi dalam satu transaksi. Perintah ini
 *   TIDAK. Setiap pernyataan dijalankan sendiri, tanpa BEGIN, karena:
 *
 *     * `CREATE INDEX CONCURRENTLY` ditolak PostgreSQL di dalam transaksi
 *     * `VALIDATE CONSTRAINT` memindai lama, dan tidak perlu menahan kunci
 *       migrasi lain selama itu
 *
 *   Harganya jujur: bila pernyataan kelima gagal, empat yang pertama TETAP
 *   diterapkan. Tidak ada penggulungan balik. Karena itu perintah ini
 *   menyebutkan pernyataan mana yang sudah berhasil sebelum berhenti — supaya
 *   yang melanjutkan tahu persis dari mana.
 *
 *   Migrasi hanya dicatat sebagai diterapkan bila SELURUH pernyataannya
 *   berhasil.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Pemakaian:
 *   npm run migrate:manual -- 0026_indeks_faktur
 *   npm run migrate:manual -- 0026_indeks_faktur --lihat   (cetak saja, tidak menjalankan)
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

import { bagianNaik, pecahPernyataan, periksaIsiMigrasi } from './aturan-migrasi.js'
import { terapkanManual } from './terapkan-manual.js'

const DIREKTORI = fileURLToPath(new URL('../../migrations', import.meta.url))

const merah = (t) => (process.stdout.isTTY === true ? `[31m${t}[0m` : t)
const hijau = (t) => (process.stdout.isTTY === true ? `[32m${t}[0m` : t)
const redup = (t) => (process.stdout.isTTY === true ? `[2m${t}[0m` : t)

function berhenti(pesan) {
  console.error('')
  console.error(merah(`  ✕ ${pesan}`))
  console.error('')
  process.exit(1)
}

const argumen = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const lihatSaja = process.argv.includes('--lihat')
const nama = argumen[0]?.replace(/\.sql$/, '')

if (nama === undefined) {
  berhenti('Sebutkan nama migrasi. Contoh: npm run migrate:manual -- 0026_indeks_faktur')
}

let isi
try {
  isi = readFileSync(join(DIREKTORI, `${nama}.sql`), 'utf8')
} catch {
  berhenti(`migrations/${nama}.sql tidak ditemukan.`)
}

const { manual, lambat } = periksaIsiMigrasi(`${nama}.sql`, isi)

/*
 * Penanda WAJIB, meski migrasinya memang lambat.
 *
 * Perintah ini melewati perlindungan transaksi tunggal. Membiarkannya
 * dijalankan atas migrasi mana pun berarti menyediakan jalan memutar bagi
 * seluruh jaminan itu — dan jalan memutar yang tersedia adalah jalan memutar
 * yang akan dipakai saat sedang terburu-buru.
 */
if (!manual.ada) {
  berhenti(
    `${nama} tidak menyandang penanda paadu:jalankan-manual.\n\n` +
      '    Perintah ini melewati transaksi tunggal, dan itu hanya boleh untuk\n' +
      '    migrasi yang memang dirancang berjalan di luar deploy. Tambahkan di\n' +
      '    berkas migrasinya:\n\n' +
      '        -- paadu:jalankan-manual <alasan, minimal 20 karakter>\n\n' +
      '    Bila migrasi ini sebenarnya ringan, jalankan npm run migrate biasa.',
  )
}

if (!manual.cukup) {
  berhenti(`${nama} menyandang penanda jalankan-manual tanpa alasan yang dapat dibaca.`)
}

const pernyataan = pecahPernyataan(bagianNaik(isi))

console.log('')
console.log(`  ${nama}`)
console.log(redup(`  alasan: ${manual.alasan}`))
console.log('')
console.log(`  ${pernyataan.length} pernyataan, dijalankan DI LUAR transaksi:`)
console.log('')
pernyataan.forEach((satu, nomor) => {
  const ringkas = satu.sql.length > 96 ? `${satu.sql.slice(0, 93)}…` : satu.sql
  console.log(`    ${String(nomor + 1).padStart(2)}. ${ringkas}`)
})
console.log('')

if (lambat.length > 0) {
  console.log(redup('  Terdeteksi mengunci:'))
  for (const satu of lambat) console.log(redup(`    · ${satu.pesan.split('\n')[0].trim()}`))
  console.log('')
}

if (lihatSaja) {
  console.log(redup('  --lihat: tidak ada yang dijalankan.'))
  console.log('')
  process.exit(0)
}

const databaseUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL
if (databaseUrl === undefined || databaseUrl === '') {
  berhenti('MIGRATION_DATABASE_URL maupun DATABASE_URL belum dipasang.')
}

const klien = new pg.Client({ connectionString: databaseUrl })
await klien.connect()

try {
  const { rows: adaTabel } = await klien.query(
    `SELECT to_regclass('public.paadu_migrations') IS NOT NULL AS ada`,
  )
  if (adaTabel[0].ada !== true) {
    berhenti(
      'Tabel paadu_migrations belum ada. Jalankan npm run migrate lebih dulu\n' +
        '    supaya migrasi sebelum ini diterapkan.',
    )
  }

  const { rows: sudah } = await klien.query('SELECT 1 FROM paadu_migrations WHERE name = $1', [
    nama,
  ])
  if (sudah.length > 0) {
    console.log(hijau(`  ✓ ${nama} sudah tercatat diterapkan. Tidak ada yang dikerjakan.`))
    console.log('')
    process.exit(0)
  }

  const hasil = await terapkanManual(klien, nama, isi, {
    onPernyataan: (nomor, berhasil) => {
      console.log(`  ${String(nomor).padStart(2)}. ${berhasil ? hijau('selesai') : merah('GAGAL')}`)
    },
  })

  if (hasil.galat !== null) {
    const pesan = hasil.galat instanceof Error ? hasil.galat.message : String(hasil.galat)
    console.error('')
    console.error(merah(`  ✕ Pernyataan ${hasil.berhasil + 1} gagal:`))
    console.error(`      ${pesan}`)
    console.error('')
    console.error(
      `  ${hasil.berhasil} pernyataan sebelumnya SUDAH diterapkan dan tidak digulung balik.`,
    )
    console.error(`  ${nama} TIDAK dicatat sebagai diterapkan.`)
    console.error('')
    console.error('  Perbaiki penyebabnya, lalu jalankan ulang perintah ini. Pernyataan yang')
    console.error('  sudah berhasil akan dijalankan lagi — pastikan seluruhnya ditulis agar')
    console.error('  aman diulang (IF NOT EXISTS, dan sejenisnya).')
    console.error('')
    process.exit(1)
  }

  console.log('')
  console.log(hijau(`  ✓ ${nama} diterapkan dan dicatat.`))
  console.log(redup('     Ulangi npm run deploy; migrasi ini akan dilewati.'))
  console.log('')
} finally {
  await klien.end()
}
