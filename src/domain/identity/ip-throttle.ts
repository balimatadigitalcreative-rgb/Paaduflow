/**
 * Pembatasan laju per asal permintaan — Modul 02 §5.
 *
 * Penguncian bertahap melindungi satu akun dari banyak tebakan. Ini melindungi
 * banyak akun dari satu penyerang: satu kata sandi umum dicoba ke ribuan alamat
 * email, dan tidak ada satu akun pun yang mencapai ambang penguncian sendiri.
 *
 * Ambangnya sengaja longgar. Satu kantor di belakang satu IP publik dapat
 * menghasilkan puluhan salah ketik yang sah dalam seperempat jam, dan memblokir
 * seluruh kantor karenanya adalah kegagalan yang lebih terlihat daripada
 * serangan yang dicegahnya.
 */

export const IP_FAILURE_WINDOW_MS = 15 * 60_000

export const IP_FAILURE_THRESHOLD = 20

export function ipWindowStart(now: Date): Date {
  return new Date(now.getTime() - IP_FAILURE_WINDOW_MS)
}

export function isIpThrottled(recentFailures: number): boolean {
  return recentFailures >= IP_FAILURE_THRESHOLD
}
