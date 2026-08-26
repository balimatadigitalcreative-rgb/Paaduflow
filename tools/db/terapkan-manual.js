/**
 * Penerapan migrasi di luar transaksi.
 *
 * Dipisahkan dari perintahnya (`migrate-manual.js`) karena berkas perintah
 * MENJALANKAN dirinya saat diimpor — argumen dibaca, dan proses keluar bila
 * tidak ada. Test yang ingin menguji fungsi ini tidak dapat mengimpornya dari
 * sana tanpa ikut menjalankan perintahnya.
 */

import { bagianNaik, pecahPernyataan } from './aturan-migrasi.js'

/**
 * Menerapkan pernyataan satu per satu, TANPA transaksi pembungkus.
 *
 * Dipisahkan dari perintahnya supaya dapat diuji terhadap basis data
 * sungguhan. Ini kode yang paling berisiko di seluruh perkakas migrasi: ia
 * menulis ke skema tanpa jaring penggulungan balik, lalu mencatat migrasinya
 * sebagai diterapkan. Bagian yang tidak diuji di sini akan diuji pertama kali
 * oleh produksi.
 *
 * Mengembalikan `{ berhasil, total, galat }`. Migrasi dicatat HANYA bila
 * seluruh pernyataan berhasil — pencatatan sebagian akan membuat migrasi
 * setengah jalan tampak selesai, dan tidak ada yang akan menjalankan sisanya.
 *
 * @param {import('pg').ClientBase} klien
 * @param {string} nama nama migrasi tanpa `.sql`
 * @param {string} isi isi berkas migrasi
 * @param {{ onPernyataan?: (nomor: number, berhasil: boolean) => void }} [kait]
 */
export async function terapkanManual(klien, nama, isi, kait = {}) {
  const pernyataan = pecahPernyataan(bagianNaik(isi))

  for (const [nomor, satu] of pernyataan.entries()) {
    try {
      await klien.query(satu.sql)
      kait.onPernyataan?.(nomor + 1, true)
    } catch (galat) {
      kait.onPernyataan?.(nomor + 1, false)
      return { berhasil: nomor, total: pernyataan.length, galat }
    }
  }

  /*
   * `run_on` diisi eksplisit: kolom itu NOT NULL tanpa bawaan. node-pg-migrate
   * mengisinya sendiri, dan jalur ini tidak melewatinya.
   */
  await klien.query('INSERT INTO paadu_migrations (name, run_on) VALUES ($1, now())', [nama])

  return { berhasil: pernyataan.length, total: pernyataan.length, galat: null }
}
