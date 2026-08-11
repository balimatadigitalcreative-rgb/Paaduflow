import { describe, expect, test } from 'vitest'

import { checkAdditiveOnly, checkMigrations, checkNumbering } from '../../tools/db/check-migrations.js'

/**
 * Pemeriksa migrasi diuji dengan berkas fixture yang melanggar, sama seperti
 * aturan lint token. Aturan yang tidak punya kasus gagal adalah aturan yang
 * belum terbukti pernah menangkap apa pun.
 */

describe('additive-only', () => {
  const melanggar = [
    ['DROP COLUMN', 'ALTER TABLE invoices DROP COLUMN catatan;'],
    ['DROP TABLE', 'DROP TABLE invoices;'],
    ['RENAME', 'ALTER TABLE invoices RENAME COLUMN nomor TO number;'],
    ['ubah tipe', 'ALTER TABLE invoices ALTER COLUMN total TYPE bigint;'],
    ['SET NOT NULL', 'ALTER TABLE invoices ALTER COLUMN catatan SET NOT NULL;'],
    ['TRUNCATE', 'TRUNCATE journal_lines;'],
    ['DROP TYPE', 'DROP TYPE lifecycle_status;'],
  ]

  test.each(melanggar)('menolak %s', (_nama, sql) => {
    expect(checkAdditiveOnly('0099_uji.sql', sql)).toHaveLength(1)
  })

  test('penambahan biasa lolos', () => {
    const sql = `
      ALTER TABLE invoices ADD COLUMN catatan text;
      CREATE INDEX invoices_catatan_idx ON invoices (catatan);
    `
    expect(checkAdditiveOnly('0099_uji.sql', sql)).toEqual([])
  })

  test('bagian Down tidak diperiksa', () => {
    // Seluruh migrasi memuat RAISE di bagian Down, dan sebagian menyebut kata
    // yang dilarang di dalam pesannya. Memeriksanya akan menghasilkan kegagalan
    // palsu di setiap berkas.
    const sql = `
      ALTER TABLE invoices ADD COLUMN catatan text;
      -- Down Migration
      DROP TABLE invoices;
    `
    expect(checkAdditiveOnly('0099_uji.sql', sql)).toEqual([])
  })

  test('penanda darurat melewatkan satu pernyataan, bukan seluruh berkas', () => {
    const sql = `
      -- paadu:allow-breaking kolom ini tidak pernah terpakai di rilis mana pun
      ALTER TABLE invoices DROP COLUMN percobaan;
      ALTER TABLE invoices DROP COLUMN catatan;
    `
    // Yang kedua tetap tertangkap.
    expect(checkAdditiveOnly('0099_uji.sql', sql)).toHaveLength(1)
  })

  test('kata terlarang di dalam komentar tidak dihitung', () => {
    const sql = '-- kolom lama akan DROP COLUMN di rilis berikutnya\nALTER TABLE t ADD COLUMN a int;'
    expect(checkAdditiveOnly('0099_uji.sql', sql)).toEqual([])
  })
})

describe('penomoran', () => {
  test('berurutan tanpa celah lolos', () => {
    expect(checkNumbering(['0001_a.sql', '0002_b.sql', '0003_c.sql'])).toEqual([])
  })

  test('nomor yang melompat tertangkap', () => {
    expect(checkNumbering(['0001_a.sql', '0003_c.sql'])).toHaveLength(1)
  })

  test('nomor ganda tertangkap', () => {
    expect(checkNumbering(['0001_a.sql', '0001_b.sql'])).toHaveLength(1)
  })

  test('nama tanpa awalan angka tertangkap', () => {
    expect(checkNumbering(['tambahan.sql'])).toHaveLength(1)
  })
})

test('migrasi yang ada di repo lolos seluruh pemeriksaan', () => {
  expect(checkMigrations()).toEqual([])
})
