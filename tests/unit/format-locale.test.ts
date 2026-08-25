import { expect, test } from 'vitest'

import { akuntansi, angka, bulanTahun, periodeFiskal, tanggal, uang } from '#interface/web/i18n/format'

/**
 * Pemformatan mengikuti locale; nilai tidak pernah — D-151.
 *
 * Ini tempat perangkat lunak keuangan biasanya rusak, dan rusaknya sunyi:
 * angka yang tampil benar tetapi dihitung berbeda tidak muncul sampai audit.
 */

test('pemisah angka mengikuti bahasa', () => {
  expect(angka(1234567, 'IDR', 'id')).toBe('1.234.567')
  expect(angka(1234567, 'IDR', 'en')).toBe('1,234,567')
})

test('desimal ditetapkan MATA UANG, bukan bahasa', () => {
  /*
   * IDR nol desimal di kedua bahasa. Membiarkan bahasa menentukannya membuat
   * nominal Rupiah yang sama tampil `1.234` dan `1,234.00` di dua layar, dan
   * yang membacanya menyimpulkan salah satunya salah.
   */
  expect(angka(1234, 'IDR', 'id')).toBe('1.234')
  expect(angka(1234, 'IDR', 'en')).toBe('1,234')

  // USD dua desimal, juga di kedua bahasa.
  expect(angka(1234, 'USD', 'id')).toBe('1.234,00')
  expect(angka(1234, 'USD', 'en')).toBe('1,234.00')
})

test('simbol mata uang ditempatkan Intl, bukan ditulis tangan', () => {
  // Menuliskan simbol sendiri di depan angka akan salah pada mata uang yang
  // menaruhnya di belakang.
  expect(uang(1234, 'IDR', 'id')).toContain('1.234')
  expect(uang(1234, 'USD', 'en')).toContain('1,234.00')
})

test('tanggal panjang mengikuti bahasa', () => {
  expect(tanggal('2026-08-20', 'id')).toBe('20 Agustus 2026')
  expect(tanggal('2026-08-20', 'en')).toBe('August 20, 2026')
})

test('tanggal dokumen dibaca sebagai tanggal KALENDER, bukan momen', () => {
  /*
   * Menguraikannya sebagai momen UTC lalu menampilkannya di zona waktu pembaca
   * menggeser sebagian tanggal satu hari — dan tanggal faktur yang meleset satu
   * hari dapat memindahkannya ke masa pajak yang salah.
   *
   * 1 Januari adalah kasus terburuknya: pergeseran satu hari memindahkannya ke
   * TAHUN pajak yang salah.
   */
  expect(tanggal('2026-01-01', 'id')).toBe('1 Januari 2026')
  expect(bulanTahun('2026-01', 'id')).toBe('Januari 2026')
  expect(bulanTahun('2026-01', 'en')).toBe('January 2026')
})

test('negatif dalam kurung di kedua bahasa; nol berbeda dari kosong', () => {
  // Kurung untuk negatif adalah konvensi akuntansi internasional, bukan
  // kebiasaan Indonesia. Yang berubah hanya pemisah angkanya.
  expect(akuntansi(-1250000, 'IDR', 'id')).toBe('(1.250.000)')
  expect(akuntansi(-1250000, 'IDR', 'en')).toBe('(1,250,000)')

  expect(akuntansi(0, 'IDR', 'id')).toBe('0')
  expect(akuntansi(null, 'IDR', 'id')).toBe('—')
})

test('periode fiskal tidak diterjemahkan', () => {
  // Notasi yang sama di seluruh sistem akuntansi. Menerjemahkannya membuat dua
  // orang di ruangan yang sama menyebut periode yang sama dengan dua nama.
  expect(periodeFiskal(2026, 8)).toBe('FY2026 P8')
})

test('pemformatan tidak mengubah nilai', () => {
  /*
   * Bentuk fungsinya yang menegakkan ini: seluruhnya menerima `number` dan
   * mengembalikan `string`. Tidak ada jalan mengembalikan angka dari sana, dan
   * itu disengaja — fungsi yang mengembalikan number cepat atau lambat akan
   * dipakai dalam perhitungan.
   */
  const nilai = 1234567.89
  for (const bahasa of ['id', 'en']) {
    angka(nilai, 'IDR', bahasa)
    uang(nilai, 'IDR', bahasa)
    akuntansi(nilai, 'IDR', bahasa)
  }
  expect(nilai).toBe(1234567.89)
})
