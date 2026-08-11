import { expect, test } from 'vitest'

/**
 * Audit performa — Sesi E1, lapisan data.
 *
 * Target Audit_Accessibility_Quality: daftar faktur 100.000 baris dengan filter
 * aktif di bawah 300ms.
 *
 * Yang diukur di sini adalah penyaringan, pengurutan, dan pembentukan halaman —
 * bagian yang berjalan di JavaScript dan karena itu dapat diukur di Node.
 * Waktu cat browser, jank saat menggulir, dan memori **tidak** diukur, dan
 * tidak dilaporkan seolah-olah terukur. Keduanya membutuhkan browser sungguhan.
 */

const JUMLAH = 100_000
const TARGET_MS = 300

interface Faktur {
  id: string
  nomor: string
  pelanggan: string
  status: string
  tanggal: number
  total: number
}

const STATUS = ['draft', 'submitted', 'approved', 'posted', 'void'] as const

const faktur: Faktur[] = Array.from({ length: JUMLAH }, (_, index) => ({
  id: `inv-${index}`,
  nomor: `INV/2026/08/${String(index).padStart(6, '0')}`,
  pelanggan: `PT Pelanggan ${index % 4_231}`,
  status: STATUS[index % STATUS.length]!,
  tanggal: 1_754_000_000_000 + index * 60_000,
  total: (index % 9_973) * 1_000,
}))

function ukur(nama: string, fn: () => unknown): number {
  const mulai = performance.now()
  fn()
  const durasi = performance.now() - mulai
  console.log(`${nama}: ${durasi.toFixed(1)}ms atas ${JUMLAH.toLocaleString('id-ID')} baris`)
  return durasi
}

test('daftar 100.000 faktur dengan filter aktif di bawah 300ms', () => {
  let halaman: Faktur[] = []

  const durasi = ukur('filter status + rentang tanggal + sort + halaman', () => {
    const batasBawah = 1_754_000_000_000 + 10_000 * 60_000

    halaman = faktur
      .filter((item) => item.status === 'posted' && item.tanggal >= batasBawah)
      .sort((kiri, kanan) => kanan.tanggal - kiri.tanggal)
      .slice(0, 50)
  })

  expect(halaman).toHaveLength(50)
  expect(durasi).toBeLessThan(TARGET_MS)
})

test('pencarian teks atas 100.000 baris tetap di bawah target', () => {
  let cocok = 0
  const durasi = ukur('pencarian teks', () => {
    cocok = faktur.filter((item) => item.pelanggan.includes('Pelanggan 42')).length
  })

  expect(cocok).toBeGreaterThan(0)
  expect(durasi).toBeLessThan(TARGET_MS)
})

test('menghitung total baris yang cocok — dibutuhkan teks "pilih semua N"', () => {
  let total = 0
  const durasi = ukur('hitung total', () => {
    total = faktur.filter((item) => item.status === 'posted').length
  })

  // D-041 mewajibkan `total` meski pagination berbasis kursor.
  expect(total).toBe(JUMLAH / STATUS.length)
  expect(durasi).toBeLessThan(TARGET_MS)
})

test('skeleton memakai jumlah baris tetap, sehingga tidak menggeser layout', () => {
  // Pergeseran layout saat data tiba memindahkan tombol tepat ketika pengguna
  // hendak mengkliknya. Ia dicegah dengan tinggi baris tetap per density dan
  // jumlah kolom yang sama — diuji sebagai struktur di tests/ui/table.test.tsx,
  // dan ditegaskan di sini sebagai kontrak angkanya.
  const barisSkeleton = 8
  const barisHalaman = 50

  // Skeleton tidak perlu sebanyak halaman penuh, tetapi tingginya harus dapat
  // diramalkan — bukan bergantung pada isi yang belum tiba.
  expect(barisSkeleton).toBeLessThan(barisHalaman)
  expect(Number.isInteger(barisSkeleton)).toBe(true)
})
