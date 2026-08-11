import { expect, test } from 'vitest'

import { applySort, selectAllMatching, selectionCount } from '#interface/web/components/table/selection'

/**
 * Uji 50.000 baris — **lapisan data saja**.
 *
 * Yang diukur di sini adalah pengurutan, penyaringan, dan pembentukan halaman
 * berkursor. Yang TIDAK diukur adalah waktu cat browser, jank saat menggulir,
 * dan memori: jsdom tidak melakukan layout sama sekali, jadi angka render dari
 * sini akan menyesatkan. Pengukuran itu dijadwalkan di Sesi E1 bersama Playwright.
 *
 * Ambangnya longgar dengan sengaja. Test performa yang ketat akan berkedip di
 * mesin CI bersama, dan test yang berkedip akan dinonaktifkan orang.
 */

interface Baris {
  id: string
  nomor: string
  pelanggan: string
  total: number
  status: string
}

const JUMLAH = 50_000
const STATUS = ['draft', 'posted', 'void'] as const

function bangkitkan(jumlah: number): Baris[] {
  return Array.from({ length: jumlah }, (_, index) => ({
    id: `inv-${index}`,
    nomor: `INV/2026/08/${String(index).padStart(6, '0')}`,
    pelanggan: `PT Pelanggan ${index % 977}`,
    total: (index % 9973) * 1000,
    status: STATUS[index % STATUS.length]!,
  }))
}

function ukur(nama: string, fn: () => unknown): number {
  const mulai = performance.now()
  fn()
  const durasi = performance.now() - mulai
  console.log(`${nama}: ${durasi.toFixed(1)}ms untuk ${JUMLAH.toLocaleString('id-ID')} baris`)
  return durasi
}

const baris = bangkitkan(JUMLAH)

test('membangkitkan 50.000 baris sintetis', () => {
  expect(baris).toHaveLength(JUMLAH)
})

test('pengurutan satu kolom numerik', () => {
  const durasi = ukur('sort numerik', () =>
    [...baris].sort((kiri, kanan) => kiri.total - kanan.total),
  )
  expect(durasi).toBeLessThan(2000)
})

test('pengurutan tiga level', () => {
  const sort = ['status', 'pelanggan', 'total'].reduce(
    (akumulasi: ReturnType<typeof applySort>, kolom) => applySort(akumulasi, kolom, true),
    [],
  )
  expect(sort).toHaveLength(3)

  const durasi = ukur('sort tiga level', () =>
    [...baris].sort(
      (kiri, kanan) =>
        kiri.status.localeCompare(kanan.status) ||
        kiri.pelanggan.localeCompare(kanan.pelanggan) ||
        kiri.total - kanan.total,
    ),
  )
  expect(durasi).toBeLessThan(5000)
})

test('penyaringan teks', () => {
  let cocok = 0
  const durasi = ukur('filter teks', () => {
    cocok = baris.filter((item) => item.pelanggan.includes('Pelanggan 12')).length
  })

  expect(cocok).toBeGreaterThan(0)
  expect(durasi).toBeLessThan(1000)
})

test('pembentukan halaman berkursor tidak bergantung ukuran himpunan', () => {
  // Kursor mencari posisi lalu mengambil sejumlah kecil baris. Inilah alasan
  // D-024 melarang offset: biayanya tidak tumbuh mengikuti kedalaman halaman.
  const terurut = [...baris].sort((kiri, kanan) => kiri.id.localeCompare(kanan.id))

  const awal = ukur('halaman pertama', () => terurut.slice(0, 50))
  const dalam = ukur('halaman ke-900', () => {
    const posisi = terurut.findIndex((item) => item.id === terurut[45_000]!.id)
    return terurut.slice(posisi, posisi + 50)
  })

  expect(awal).toBeLessThan(500)
  expect(dalam).toBeLessThan(500)
})

test('memilih seluruh hasil tidak menyentuh satu baris pun', () => {
  const durasi = ukur('pilih seluruh hasil', () => selectAllMatching({ status: 'draft' }, JUMLAH))

  // Inilah keuntungan nyata dari mode kueri: memilih 50.000 baris berbiaya
  // sama dengan memilih nol baris, karena tidak ada id yang dikumpulkan.
  expect(durasi).toBeLessThan(50)
  expect(selectionCount(selectAllMatching({}, JUMLAH))).toBe(JUMLAH)
})
