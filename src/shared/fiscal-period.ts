/**
 * Periode fiskal — Component_Specs_Primitives §6.
 *
 * `fiscal_year_start_month` di Modul 01 dapat bukan Januari, sehingga "P3"
 * tidak bermakna bagi siapa pun tanpa bulan kalendernya. Komponen pemilih wajib
 * menampilkan keduanya sekaligus: `FY2026 P3 · Sep 2026`.
 */

const BULAN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const

export interface FiscalPeriod {
  /** Tahun kalender saat tahun fiskal itu DIMULAI. */
  readonly fiscalYear: number
  /** 1–12. */
  readonly period: number
  readonly calendarMonth: number
  readonly calendarYear: number
}

export function periodOf(date: Date, fiscalYearStartMonth: number): FiscalPeriod {
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  const period = ((month - fiscalYearStartMonth + 12) % 12) + 1
  const fiscalYear = month >= fiscalYearStartMonth ? year : year - 1

  return { fiscalYear, period, calendarMonth: month, calendarYear: year }
}

/** Seluruh dua belas periode dalam satu tahun fiskal, berurutan. */
export function periodsOfYear(fiscalYear: number, fiscalYearStartMonth: number): FiscalPeriod[] {
  return Array.from({ length: 12 }, (_, index) => {
    const absolut = fiscalYearStartMonth + index
    const calendarMonth = ((absolut - 1) % 12) + 1
    const calendarYear = fiscalYear + Math.floor((absolut - 1) / 12)
    return { fiscalYear, period: index + 1, calendarMonth, calendarYear }
  })
}

/**
 * `FY2026 P3 · Sep 2026`.
 *
 * Label fiskal DAN bulan kalender, selalu bersamaan. Menampilkan `P3` saja
 * memaksa setiap penggunanya menghitung sendiri, dan sebagian akan salah.
 */
export function formatPeriod(period: FiscalPeriod): string {
  return `FY${period.fiscalYear} P${period.period} · ${monthLabel(period.calendarMonth)} ${period.calendarYear}`
}

export function monthLabel(month: number): string {
  return BULAN[month - 1] ?? '—'
}

export function periodKey(period: FiscalPeriod): string {
  return `${period.fiscalYear}-${String(period.period).padStart(2, '0')}`
}
