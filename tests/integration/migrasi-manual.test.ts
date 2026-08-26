import { randomUUID } from 'node:crypto'

import { Client } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { terapkanManual } from '../../tools/db/terapkan-manual.js'

/**
 * Penerapan migrasi manual, terhadap basis data sungguhan.
 *
 * Ini kode paling berisiko di seluruh perkakas migrasi: ia menulis ke skema
 * TANPA transaksi pembungkus, lalu mencatat migrasinya sebagai diterapkan.
 * Tidak ada penggulungan balik yang menolong bila ia salah.
 *
 * Yang diuji karena itu bukan hanya jalur suksesnya. Yang lebih penting adalah
 * jalur gagalnya: pernyataan yang sudah berhasil TETAP diterapkan, dan
 * migrasinya TIDAK boleh tercatat — migrasi setengah jalan yang tampak selesai
 * tidak akan pernah dijalankan siapa pun sampai habis.
 */

let klien: Client
const dibuat: string[] = []

beforeAll(async () => {
  klien = new Client({ connectionString: process.env.TEST_DATABASE_URL })
  await klien.connect()
})

afterAll(async () => {
  for (const nama of dibuat) {
    await klien.query('DELETE FROM paadu_migrations WHERE name = $1', [nama])
  }
  await klien.query('DROP TABLE IF EXISTS uji_manual_satu, uji_manual_dua')
  await klien.end()
})

function namaUji(): string {
  const nama = `9999_uji_${randomUUID().slice(0, 8)}`
  dibuat.push(nama)
  return nama
}

test('seluruh pernyataan berhasil: diterapkan dan dicatat', async () => {
  const nama = namaUji()
  const isi = [
    '-- Up Migration',
    '-- paadu:jalankan-manual Uji penerapan manual terhadap basis data sungguhan.',
    'CREATE TABLE uji_manual_satu (id int PRIMARY KEY);',
    'INSERT INTO uji_manual_satu (id) VALUES (1);',
    '',
    '-- Down Migration',
    "DO $$ BEGIN RAISE EXCEPTION 'maju saja'; END $$;",
  ].join('\n')

  const hasil = await terapkanManual(klien, nama, isi)

  expect(hasil.galat).toBeNull()
  expect(hasil.berhasil).toBe(hasil.total)

  const { rows } = await klien.query('SELECT id FROM uji_manual_satu')
  expect(rows).toEqual([{ id: 1 }])

  const { rows: tercatat } = await klien.query(
    'SELECT name FROM paadu_migrations WHERE name = $1',
    [nama],
  )
  expect(tercatat).toHaveLength(1)
})

test('bagian Down TIDAK ikut dijalankan', async () => {
  /*
   * Bagian Down di repo ini selalu melempar. Menjalankannya akan menggagalkan
   * setiap migrasi manual — dan kegagalannya akan terlihat seperti masalah pada
   * migrasinya, bukan pada perkakasnya.
   */
  const nama = namaUji()
  const isi = [
    '-- Up Migration',
    '-- paadu:jalankan-manual Memastikan bagian Down tidak ikut dijalankan.',
    'CREATE TABLE uji_manual_dua (id int PRIMARY KEY);',
    '',
    '-- Down Migration',
    "DO $$ BEGIN RAISE EXCEPTION 'bagian ini tidak boleh berjalan'; END $$;",
  ].join('\n')

  const hasil = await terapkanManual(klien, nama, isi)
  expect(hasil.galat).toBeNull()
})

test('gagal di tengah: yang sebelumnya tetap diterapkan, migrasinya TIDAK dicatat', async () => {
  const nama = namaUji()
  const isi = [
    '-- Up Migration',
    '-- paadu:jalankan-manual Menguji kegagalan di tengah penerapan manual.',
    'ALTER TABLE uji_manual_satu ADD COLUMN catatan text;',
    'ALTER TABLE tabel_yang_tidak_ada ADD COLUMN apa_pun text;',
    'ALTER TABLE uji_manual_satu ADD COLUMN tidak_akan_ada text;',
    '',
    '-- Down Migration',
    "DO $$ BEGIN RAISE EXCEPTION 'maju saja'; END $$;",
  ].join('\n')

  const hasil = await terapkanManual(klien, nama, isi)

  expect(hasil.galat).not.toBeNull()
  expect(hasil.berhasil).toBe(1)
  expect(hasil.total).toBe(3)

  /*
   * Pernyataan pertama TETAP diterapkan. Ini harga yang dibayar untuk berjalan
   * di luar transaksi, dan perintahnya menyebutkannya terus terang alih-alih
   * berpura-pura tidak terjadi.
   */
  const { rows: kolom } = await klien.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'uji_manual_satu' ORDER BY column_name`,
  )
  expect(kolom.map((b) => b.column_name)).toEqual(['catatan', 'id'])

  // Yang sesudah kegagalan tidak dijalankan.
  expect(kolom.map((b) => b.column_name)).not.toContain('tidak_akan_ada')

  /*
   * Dan yang paling penting: TIDAK dicatat. Migrasi setengah jalan yang tampak
   * selesai adalah migrasi yang tidak akan pernah diselesaikan siapa pun.
   */
  const { rows: tercatat } = await klien.query(
    'SELECT name FROM paadu_migrations WHERE name = $1',
    [nama],
  )
  expect(tercatat).toEqual([])
})
