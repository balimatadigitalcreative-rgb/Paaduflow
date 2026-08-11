/**
 * Penguncian bertahap — Modul 02 §4.
 *
 * Bertahap, bukan biner. Mengunci akun selama satu jam setelah lima kesalahan
 * mengubah tebakan kata sandi menjadi serangan penolakan layanan terhadap
 * pemilik akun yang sah: penyerang yang tahu alamat email seseorang dapat
 * mengunci orang itu keluar kapan saja. Jeda yang tumbuh membuat penebakan
 * otomatis tidak sepadan, sementara orang yang benar-benar lupa hanya menunggu
 * beberapa detik pada percobaan pertamanya.
 */

const MINUTE = 60_000

/**
 * Lama penguncian menurut jumlah kegagalan berurutan.
 *
 * Indeks adalah jumlah kegagalan. Dua kesalahan pertama tidak mengunci sama
 * sekali — salah ketik adalah hal biasa dan bukan indikasi serangan.
 */
const SCHEDULE_MS: readonly number[] = [
  0, // 0 kegagalan
  0, // 1
  0, // 2
  1 * MINUTE, // 3
  2 * MINUTE, // 4
  5 * MINUTE, // 5
  15 * MINUTE, // 6
]

/** Batas atas. Di atas ini, jeda berhenti tumbuh. */
export const MAX_LOCKOUT_MS = 60 * MINUTE

/** Lama penguncian dalam milidetik. Nol berarti tidak dikunci. */
export function lockoutDurationMs(failedAttempts: number): number {
  if (failedAttempts <= 0) return 0
  return SCHEDULE_MS[failedAttempts] ?? MAX_LOCKOUT_MS
}

/**
 * Menghitung keadaan kredensial setelah satu kegagalan.
 *
 * Dipisahkan dari penyimpanan supaya dapat diuji tanpa basis data — kebijakan
 * penguncian adalah salah satu dari sedikit hal yang wajib diuji unit menurut
 * Modul 02 §12.
 */
export function afterFailedAttempt(
  failedAttempts: number,
  now: Date,
): { failedAttempts: number; lockedUntil: Date | null } {
  const next = failedAttempts + 1
  const duration = lockoutDurationMs(next)
  return {
    failedAttempts: next,
    lockedUntil: duration === 0 ? null : new Date(now.getTime() + duration),
  }
}

export function isLocked(lockedUntil: Date | null, now: Date): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > now.getTime()
}
