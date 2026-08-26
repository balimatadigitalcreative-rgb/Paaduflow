/**
 * Memisahkan migrasi yang boleh berjalan sebaris dengan deploy dari yang tidak.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *   MENGAPA SEBARIS ITU BERBAHAYA
 *
 *   `npm run migrate` membungkus SELURUH migrasi dalam satu transaksi
 *   (`singleTransaction: true`). Itu benar untuk migrasi kecil: bila salah satu
 *   gagal, tidak ada yang setengah diterapkan.
 *
 *   Tetapi transaksi itu memegang kunci sampai commit. `CREATE INDEX` atas
 *   tabel berisi jutaan baris menahan seluruh penulisan ke tabel itu selama ia
 *   dibangun — dan deploy menunggu, dan aplikasi menunggu, dan orang yang
 *   sedang memposting faktur menunggu.
 *
 *   Lebih dari itu: `CREATE INDEX CONCURRENTLY` — obatnya — TIDAK DAPAT
 *   berjalan di dalam transaksi sama sekali. PostgreSQL menolaknya. Jadi jalan
 *   keluarnya bukan menulis migrasi yang lebih baik; jalan keluarnya adalah
 *   menjalankannya di luar deploy.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { periksaIsiMigrasi } from './aturan-migrasi.js'

const DIREKTORI = fileURLToPath(new URL('../../migrations', import.meta.url))

/**
 * Menilai satu migrasi tertunda.
 *
 * @param {string} nama nama tanpa `.sql`, seperti yang dikembalikan pending-migrations
 * @param {string} [direktori] diganti test supaya penolakannya dapat diuji
 *   terhadap migrasi contoh, bukan terhadap migrasi sungguhan di repo
 */
export function nilaiMigrasi(nama, direktori = DIREKTORI) {
  const isi = readFileSync(join(direktori, `${nama}.sql`), 'utf8')
  const { masalah, lambat, manual } = periksaIsiMigrasi(`${nama}.sql`, isi)

  return {
    nama,
    lambat,
    manual,
    masalah,
    /** Boleh berjalan sebaris hanya bila tidak lambat DAN tidak ditandai manual. */
    bolehSebaris: lambat.length === 0 && !manual.ada,
  }
}

/**
 * Menyaring daftar migrasi tertunda menjadi dua kelompok.
 *
 * @param {readonly string[]} tertunda
 */
export function pisahkan(tertunda, direktori = DIREKTORI) {
  const penilaian = tertunda.map((nama) => nilaiMigrasi(nama, direktori))
  return {
    sebaris: penilaian.filter((satu) => satu.bolehSebaris),
    ditahan: penilaian.filter((satu) => !satu.bolehSebaris),
  }
}

/**
 * Menyusun penjelasan bagi operator.
 *
 * Ditulis sebagai fungsi terpisah supaya pesan yang sama muncul di penjalan
 * migrasi maupun di skrip deploy. Dua pesan yang berbeda untuk keadaan yang
 * sama akan lambat laun mengatakan hal yang berbeda pula.
 */
export function jelaskanTertahan(ditahan) {
  const baris = ['']

  baris.push(`  ${ditahan.length} migrasi TIDAK dijalankan sebaris dengan deploy.`)
  baris.push('')

  for (const satu of ditahan) {
    baris.push(`  ${satu.nama}`)

    if (satu.manual.ada) {
      baris.push(`      ditandai jalankan-manual: ${satu.manual.alasan}`)
    } else {
      baris.push('      TIDAK ditandai, tetapi terdeteksi mengunci:')
    }

    for (const temuan of satu.lambat) {
      for (const potong of temuan.pesan.split('\n')) baris.push(`      ${potong.trim()}`)
    }
    baris.push('')
  }

  baris.push('  Jalankan satu per satu, di luar jam sibuk, dari sesi tersendiri:')
  baris.push('')
  for (const satu of ditahan) baris.push(`      npm run migrate:manual -- ${satu.nama}`)
  baris.push('')
  baris.push('  Perintah itu menjalankannya DI LUAR transaksi tunggal, sehingga')
  baris.push('  CREATE INDEX CONCURRENTLY dan VALIDATE CONSTRAINT bekerja — dan')
  baris.push('  sehingga kegagalan di tengah tidak menggulung balik migrasi lain.')
  baris.push('')
  baris.push('  Sesudahnya, ulangi deploy. Migrasi yang sudah tercatat dilewati.')
  baris.push('')

  return baris.join('\n')
}
