import { monthLabel } from './fiscal-period.js'

/**
 * Tanggal — Component_Specs_Primitives §6.
 *
 * Format tampilan `10 Agu 2026`. Pengetikan manual tetap diterima dalam
 * berbagai bentuk: akuntan mengetik tanggal jauh lebih cepat daripada
 * mengkliknya, dan pemilih kalender adalah pelengkap, bukan satu-satunya jalan.
 */

const NAMA_BULAN = new Map<string, number>([
  ['jan', 1],
  ['feb', 2],
  ['mar', 3],
  ['apr', 4],
  ['mei', 5],
  ['may', 5],
  ['jun', 6],
  ['jul', 7],
  ['agu', 8],
  ['aug', 8],
  ['sep', 9],
  ['okt', 10],
  ['oct', 10],
  ['nov', 11],
  ['des', 12],
  ['dec', 12],
])

export function formatDate(date: Date): string {
  return `${date.getDate()} ${monthLabel(date.getMonth() + 1)} ${date.getFullYear()}`
}

function build(day: number, month: number, year: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(year, month - 1, day)
  // Menolak 31 Februari dan sejenisnya: konstruktor Date diam-diam menggulungnya
  // ke bulan berikutnya, dan tanggal yang bergeser sendiri adalah bug senyap.
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

/** Mengembalikan null bila tidak terbaca — tidak pernah menebak. */
export function parseDate(input: string): Date | null {
  const teks = input.trim().toLowerCase()
  if (teks === '') return null

  // 2026-08-10
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(teks)
  if (iso !== null) return build(Number(iso[3]), Number(iso[2]), Number(iso[1]))

  // 10/8/2026 dan 10-8-2026
  const angka = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(teks)
  if (angka !== null) {
    const tahun = Number(angka[3])
    return build(Number(angka[1]), Number(angka[2]), tahun < 100 ? 2000 + tahun : tahun)
  }

  // 10 Agu 2026
  const nama = /^(\d{1,2})\s+([a-z]{3,})\s+(\d{4})$/.exec(teks)
  if (nama !== null) {
    const bulan = NAMA_BULAN.get(nama[2]!.slice(0, 3))
    if (bulan === undefined) return null
    return build(Number(nama[1]), bulan, Number(nama[3]))
  }

  return null
}
