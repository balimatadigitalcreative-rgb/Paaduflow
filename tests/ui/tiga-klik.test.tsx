import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test } from 'vitest'

/**
 * Aturan tiga klik, diukur terhadap RUTE YANG BENAR-BENAR ADA.
 *
 * Step 8.1 mengukurnya di prototype. Prototype punya menu yang belum tentu ada
 * di aplikasi, dan aplikasi punya menu yang tidak ada di prototype — angka
 * dari sana tidak berlaku di sini.
 *
 * Ukurannya: berapa kali seseorang menekan sesuatu, dimulai dari dasbor.
 * Memilih modul di rail dihitung satu, memilih item di sidebar dihitung satu.
 * Yang dihitung tekanan, bukan halaman: chip filter dan tombol di page header
 * ikut dihitung karena jari yang menekannya sama saja.
 */

const APP = readFileSync(join(process.cwd(), 'src/interface/web/app.tsx'), 'utf8')

/** Item sidebar per modul, dibaca dari sumbernya supaya tidak ikut basi. */
function sidebar(modul: string): string[] {
  const awal = APP.indexOf(`  ${modul}: [`)
  if (awal === -1) return []
  const akhir = APP.indexOf('\n  ],', awal)
  return [...APP.slice(awal, akhir).matchAll(/id: '([^']+)'/g)].map((m) => m[1]!)
}

/**
 * Klik untuk mencapai sebuah item sidebar dari dasbor.
 *
 * Satu untuk modulnya di rail, satu untuk itemnya di sidebar. Item PERTAMA
 * setiap modul hanya butuh satu klik: memilih modul langsung membukanya
 * (`onSelectModule` menuju item pertama).
 */
function klikKeItem(modul: string, item: string): number {
  const daftar = sidebar(modul)
  const posisi = daftar.indexOf(item)
  if (posisi === -1) return Infinity
  return posisi === 0 ? 1 : 2
}

const TUGAS: readonly { nama: string; klik: number; batas: number; catatan?: string }[] = [
  { nama: 'Buka daftar Faktur Penjualan', klik: klikKeItem('penjualan', 'penjualan'), batas: 3 },
  { nama: 'Buat faktur baru', klik: klikKeItem('penjualan', 'penjualan/baru'), batas: 3 },
  {
    nama: 'Lihat faktur menunggu persetujuan',
    // Modul → daftar (1 klik, item pertama) → chip "Menunggu persetujuan".
    klik: klikKeItem('penjualan', 'penjualan') + 1,
    batas: 3,
  },
  { nama: 'Buka Laba Rugi', klik: klikKeItem('akuntansi', 'akuntansi/laba-rugi'), batas: 3 },
  { nama: 'Buka Buku Besar', klik: klikKeItem('akuntansi', 'akuntansi/buku-besar'), batas: 3 },
  { nama: 'Buka Bagan Akun', klik: klikKeItem('akuntansi', 'akuntansi/bagan-akun'), batas: 3 },
  { nama: 'Buka Pesanan Pembelian', klik: klikKeItem('pembelian', 'pembelian/pesanan'), batas: 3 },
  { nama: 'Buka Faktur Pembelian', klik: klikKeItem('pembelian', 'pembelian/tagihan'), batas: 3 },
  { nama: 'Buka Faktur Pajak Keluaran', klik: klikKeItem('pajak', 'pajak/keluaran'), batas: 3 },
  { nama: 'Terbitkan faktur pajak', klik: klikKeItem('pajak', 'pajak/terbitkan'), batas: 3 },
  { nama: 'Buka Rekonsiliasi Pajak', klik: klikKeItem('pajak', 'pajak/rekonsiliasi'), batas: 3 },
  {
    nama: 'Telusuri Laba Rugi sampai akun di Buku Besar',
    // Modul → Laba Rugi → baris akun.
    klik: klikKeItem('akuntansi', 'akuntansi/laba-rugi') + 1,
    batas: 3,
  },
  {
    nama: 'Telusuri Laba Rugi sampai FAKTUR sumbernya',
    // Modul → Laba Rugi → baris akun → baris jurnal.
    klik: klikKeItem('akuntansi', 'akuntansi/laba-rugi') + 2,
    batas: 3,
    catatan:
      'Melintasi tiga tingkat hierarki data: laporan, jurnal, dokumen. ' +
      'Memaksanya jadi tiga klik berarti menghapus tingkat jurnal, dan itu ' +
      'justru tingkat yang dicari auditor. Pengecualian sadar, sama dengan ' +
      'yang dicatat Step 8.1 §4.',
  },
]

test('seluruh tugas utama tercapai dalam tiga klik, kecuali yang dicatat', () => {
  const melebihi = TUGAS.filter((tugas) => tugas.klik > tugas.batas)
  const tanpaAlasan = melebihi.filter((tugas) => tugas.catatan === undefined)

  const laporan = TUGAS.map(
    (tugas) => `  ${String(tugas.klik).padStart(2)} klik  ${tugas.nama}`,
  ).join('\n')

  expect(
    tanpaAlasan.map((tugas) => tugas.nama),
    `Tugas melebihi tiga klik tanpa alasan tercatat:\n${laporan}`,
  ).toEqual([])
})

test('tidak ada tugas yang tak terjangkau', () => {
  // Infinity berarti item sidebar-nya tidak ada — rute yang disebut uji ini
  // sudah berganti nama atau dihapus, dan ujinya berhenti mengukur apa pun.
  const hilang = TUGAS.filter((tugas) => !Number.isFinite(tugas.klik))
  expect(hilang.map((tugas) => tugas.nama)).toEqual([])
})

test('setiap modul punya paling banyak satu tujuan berjarak satu klik', () => {
  /*
   * Item pertama setiap modul terbuka begitu modulnya dipilih. Kalau suatu
   * hari ada dua item yang mengklaim posisi itu, salah satunya tidak akan
   * pernah tercapai dalam satu klik dan pengukuran di atas menjadi salah.
   */
  for (const modul of ['penjualan', 'pembelian', 'akuntansi', 'pajak']) {
    const daftar = sidebar(modul)
    expect(daftar.length, `modul ${modul} tidak punya item sidebar`).toBeGreaterThan(0)
    expect(new Set(daftar).size, `modul ${modul} punya item ganda`).toBe(daftar.length)
  }
})
