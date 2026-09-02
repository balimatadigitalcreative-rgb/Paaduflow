import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, test } from 'vitest'

// Relatif, seperti test perkakas lain di repo ini: `tools/` tidak punya alias.
import {
  AMBANG_PENJAGA,
  pecahPernyataan,
  periksaIsiMigrasi,
} from '../../tools/db/aturan-migrasi.js'
import { jelaskanTertahan, pisahkan } from '../../tools/db/migrasi-lambat.js'

/**
 * Penjaga migrasi, diuji terhadap pelanggaran SUNGGUHAN.
 *
 * Setiap aturan punya satu berkas migrasi di `tests/fixtures/migrasi/` yang
 * sengaja melanggarnya. Itu bukan kerapian: penjaga yang hanya diuji terhadap
 * teks yang dikarang di dalam test akan lolos meski polanya salah, karena
 * teksnya dikarang agar cocok dengan polanya.
 *
 * Fixture tinggal DI LUAR `migrations/` supaya `npm run migrate` tidak pernah
 * melihatnya, dan supaya pemeriksa nomor urut tidak mengeluh.
 */

const FIXTURE = join(process.cwd(), 'tests/fixtures/migrasi')

function periksa(berkas: string) {
  return periksaIsiMigrasi(berkas, readFileSync(join(FIXTURE, berkas), 'utf8'))
}

function kodeMasalah(berkas: string): string[] {
  return periksa(berkas).masalah.map((satu: { kode: string }) => satu.kode)
}

// ── Setiap aturan yang merusak menyala ──────────────────────────────────────

describe('aturan yang merusak kode berjalan', () => {
  const kasus: readonly (readonly [string, string, string])[] = [
    ['0026_hapus_kolom.sql', 'kolom-dihapus', 'DROP COLUMN'],
    ['0026_hapus_tabel.sql', 'tabel-dihapus', 'DROP TABLE'],
    ['0026_ganti_nama.sql', 'diganti-nama', 'RENAME'],
    ['0026_sempitkan_tipe.sql', 'tipe-diubah', 'ALTER COLUMN … TYPE'],
    ['0026_pasang_not_null.sql', 'not-null-dipasang', 'SET NOT NULL'],
    ['0026_kolom_not_null_tanpa_bawaan.sql', 'kolom-not-null-tanpa-bawaan', 'tanpa DEFAULT'],
    ['0026_batasan_check.sql', 'batasan-melanggar-baris-lama', 'ADD CONSTRAINT'],
    ['0026_batasan_unique.sql', 'batasan-melanggar-baris-lama', 'ADD CONSTRAINT'],
    ['0026_kosongkan_tabel.sql', 'tabel-dikosongkan', 'TRUNCATE'],
    ['0026_hapus_kebijakan.sql', 'objek-dihapus', 'DROP objek'],
  ]

  test.each(kasus)('%s ditolak sebagai %s', (berkas, kode, sebutan) => {
    const { masalah } = periksa(berkas)

    expect(masalah.length, `${berkas} tidak menghasilkan masalah apa pun`).toBeGreaterThan(0)
    expect(masalah.map((s: { kode: string }) => s.kode)).toContain(kode)

    /*
     * Pesannya menyebut pelanggaran yang SPESIFIK, bukan "migrasi tidak aman".
     * Pesan umum memaksa orang menebak baris mana yang salah, dan yang menebak
     * biasanya menempelkan pintu darurat alih-alih memperbaikinya.
     */
    const pesan = masalah.find((s: { kode: string }) => s.kode === kode)!.pesan
    expect(pesan).toContain(sebutan)
    expect(pesan).toContain(berkas)
    expect(pesan, 'pesan tidak menyebut akibatnya').toContain('Akibat')
    expect(pesan, 'pesan tidak menyebut jalan keluarnya').toContain('Lakukan')
  })
})

// ── Setiap aturan lambat menyala ────────────────────────────────────────────

describe('aturan yang mengunci tabel', () => {
  const kasus: readonly (readonly [string, string])[] = [
    ['0026_indeks_mengunci.sql', 'indeks-mengunci'],
    ['0026_sempitkan_tipe.sql', 'tabel-ditulis-ulang'],
    ['0026_batasan_check.sql', 'batasan-memindai'],
    ['0026_isi_data.sql', 'pengisian-data'],
    ['0026_tata_ulang.sql', 'penataan-ulang'],
    ['0026_bawaan_volatile.sql', 'bawaan-volatile'],
  ]

  test.each(kasus)('%s ditolak sebagai %s', (berkas, kode) => {
    const { masalah, lambat } = periksa(berkas)

    expect(lambat.map((s: { kode: string }) => s.kode)).toContain(kode)
    expect(masalah.map((s: { kode: string }) => s.kode)).toContain(kode)

    // Pesannya menyebutkan jalan keluarnya: tandai dan jalankan di luar deploy.
    const pesan = masalah.find((s: { kode: string }) => s.kode === kode)!.pesan
    expect(pesan).toContain('paadu:jalankan-manual')
  })
})

// ── Pintu darurat ───────────────────────────────────────────────────────────

describe('pintu darurat', () => {
  test('penanda beralasan membuka jalan', () => {
    expect(kodeMasalah('0026_darurat_beralasan.sql')).toEqual([])
  })

  test('penanda tanpa alasan yang dapat dibaca DITOLAK', () => {
    const { masalah } = periksa('0026_darurat_tanpa_alasan.sql')

    /*
     * Ditolak sebagai `alasan-kurang`, bukan diam-diam diperlakukan seolah
     * penandanya tidak ada. Penanda yang ditolak tanpa penjelasan akan dicoba
     * lagi dengan bentuk yang persis sama.
     */
    expect(masalah.map((s: { kode: string }) => s.kode)).toEqual(['alasan-kurang'])
    expect(masalah[0]!.pesan).toContain('paadu:allow-breaking')
    expect(masalah[0]!.pesan, 'alasan yang ditulis tidak dikutip kembali').toContain('"perlu"')
  })

  test('penanda jalankan-manual menerima migrasi lambat', () => {
    const { masalah, lambat, manual } = periksa('0026_manual_beralasan.sql')

    // Masih terdeteksi lambat — penandanya tidak membuatnya cepat.
    expect(lambat.map((s: { kode: string }) => s.kode)).toContain('indeks-mengunci')

    // Tetapi bukan lagi kesalahan: tanggung jawab menjalankannya sudah pindah.
    expect(masalah).toEqual([])
    expect(manual.ada).toBe(true)
    expect(manual.cukup).toBe(true)
  })
})

// ── Yang TIDAK boleh dikeluhkan ─────────────────────────────────────────────

describe('migrasi yang aman lolos tanpa keluhan', () => {
  test('ALTER TABLE atas tabel yang dibuat di migrasi yang sama lolos', () => {
    /*
     * Kontrak tabel transaksional menambah `company_id` lewat `ALTER`, sehingga
     * batasan yang menyebutnya HARUS menyusul dengan `ALTER` pula. Sintaksnya
     * identik dengan mengubah tabel lama, dan hanya yang terakhir berbahaya.
     *
     * Ditemukan saat menulis migrasi penerimaan pembayaran: penjaga menyala
     * atas migrasinya sendiri, dan menempelkan pintu darurat di sana akan
     * melatih setiap modul berikutnya melakukan hal yang sama.
     */
    const { masalah, lambat } = periksa('0026_batasan_tabel_baru.sql')

    expect(
      masalah,
      `keluhan palsu: ${masalah.map((s: { pesan: string }) => s.pesan).join(' | ')}`,
    ).toEqual([])
    expect(lambat).toEqual([])
  })

  test('CREATE TABLE berisi CHECK dan NOT NULL, indeks atas tabel baru, NOT VALID', () => {
    const { masalah, lambat } = periksa('0026_aman.sql')

    /*
     * Ini setengah lain dari pekerjaan penjaga, dan yang paling sering
     * terlupakan. Penjaga yang mengeluh atas migrasi yang benar akan dimatikan
     * orang dalam dua minggu — dan yang dimatikan tidak menangkap apa pun.
     */
    expect(masalah, `keluhan palsu: ${masalah.map((s: { pesan: string }) => s.pesan).join(' | ')}`).toEqual([])
    expect(lambat).toEqual([])
  })
})

// ── Sejarah tidak diperiksa ─────────────────────────────────────────────────

describe('cakupan penjaga', () => {
  test(`migrasi 0001–${String(AMBANG_PENJAGA).padStart(4, '0')} dilewati`, () => {
    /*
     * Isi yang sama persis: ditolak bernomor 0026, dilewati bernomor 0010.
     *
     * Bukan kelonggaran. Migrasi lama sudah diterapkan di produksi, dan
     * penjaga checksum melarang mengubahnya — menuntutnya patuh berarti
     * menuntut sejarah ditulis ulang.
     */
    const isi = readFileSync(join(FIXTURE, '0026_hapus_kolom.sql'), 'utf8')

    expect(periksaIsiMigrasi('0026_hapus_kolom.sql', isi).masalah.length).toBeGreaterThan(0)
    expect(periksaIsiMigrasi('0010_hapus_kolom.sql', isi).masalah).toEqual([])
  })

  test('seluruh migrasi nyata di repo lolos', () => {
    const dir = join(process.cwd(), 'migrations')
    const masalah = readdirSync(dir)
      .filter((n) => n.endsWith('.sql'))
      .flatMap((n) => periksaIsiMigrasi(n, readFileSync(join(dir, n), 'utf8')).masalah)

    expect(masalah.map((s: { pesan: string }) => s.pesan)).toEqual([])
  })
})

// ── Pemecah pernyataan ──────────────────────────────────────────────────────

describe('pemecah pernyataan', () => {
  test('titik koma di dalam literal dan blok dolar tidak memecah pernyataan', () => {
    const sql = [
      "INSERT INTO t (a) VALUES ('satu; dua');",
      'DO $$ BEGIN RAISE NOTICE $x$tiga; empat$x$; END $$;',
      'SELECT 1;',
    ].join('\n')

    /*
     * Ini yang membuat pemecah ini ditulis sendiri alih-alih `split(';')`.
     * Memecah dengan regex membelah blok `DO $$ … $$` di tengah, dan aturan
     * yang berjalan di atas potongan itu memeriksa hal yang bukan SQL.
     */
    expect(pecahPernyataan(sql)).toHaveLength(3)
  })

  test('komentar tidak ikut diperiksa aturan, tetapi tetap terbaca sebagai penanda', () => {
    const [pertama] = pecahPernyataan('-- DROP TABLE ini hanya komentar\nSELECT 1;')

    // `sql` adalah teks yang diperiksa aturan: tanpa komentar, tanpa titik koma
    // penutup. `komentar` disimpan terpisah justru supaya penanda pintu darurat
    // tetap terbaca tanpa membuat aturan mengeluh atas kata di dalam komentar.
    expect(pertama.sql).toBe('SELECT 1')
    expect(pertama.komentar).toContain('DROP TABLE')
  })

  test('nomor baris menunjuk awal pernyataan, bukan awal berkas', () => {
    const sql = ['SELECT 1;', '', '', 'DROP TABLE t;'].join('\n')
    const [, kedua] = pecahPernyataan(sql)

    expect(kedua.baris).toBe(4)
  })
})

// ── Penolakan menjalankan sebaris ───────────────────────────────────────────

describe('penolakan menjalankan sebaris dengan deploy', () => {
  test('migrasi yang mengunci ditahan, yang ringan diloloskan', () => {
    const { sebaris, ditahan } = pisahkan(
      ['0026_aman', '0026_indeks_mengunci', '0026_manual_beralasan'],
      FIXTURE,
    )

    expect(sebaris.map((s: { nama: string }) => s.nama)).toEqual(['0026_aman'])

    /*
     * Yang DITANDAI manual pun ikut ditahan, bukan diloloskan.
     *
     * Penandanya menyatakan "saya tahu ini mengunci", bukan "jalankan saja".
     * Ia memindahkan tanggung jawab ke operator, dan operator menjalankannya
     * lewat perintah tersendiri di luar jam sibuk.
     */
    expect(ditahan.map((s: { nama: string }) => s.nama)).toEqual([
      '0026_indeks_mengunci',
      '0026_manual_beralasan',
    ])
  })

  test('penjelasannya menyebut perintah yang harus dijalankan operator', () => {
    const { ditahan } = pisahkan(['0026_manual_beralasan'], FIXTURE)
    const penjelasan = jelaskanTertahan(ditahan)

    expect(penjelasan).toContain('npm run migrate:manual -- 0026_manual_beralasan')
    expect(penjelasan, 'alasan yang ditulis penulis migrasi tidak diteruskan').toContain(
      'di luar jam sibuk',
    )

    // Menyebutkan MENGAPA di luar transaksi, bukan hanya menyuruh.
    expect(penjelasan).toContain('CREATE INDEX CONCURRENTLY')
  })
})
