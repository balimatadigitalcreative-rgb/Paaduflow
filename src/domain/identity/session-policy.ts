/**
 * Umur sesi dan aturan rotasi — Modul 02 §4.
 */

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/**
 * Access token berumur pendek karena ia tidak dapat dicabut sebelum kedaluwarsa.
 * Lima belas menit adalah lama sebuah sesi yang dicabut masih dapat membaca
 * data — itulah harga yang sedang ditetapkan angka ini.
 */
export const ACCESS_TOKEN_TTL_MS = 15 * MINUTE

/** Refresh token berumur panjang, tetapi berotasi setiap kali dipakai. */
export const REFRESH_TOKEN_TTL_MS = 30 * DAY

export interface SessionState {
  readonly expiresAt: Date
  readonly revokedAt: Date | null
  /** Alasan pencabutan. Inilah yang membedakan serangan dari pemakaian biasa. */
  readonly revokedReason: string | null
}

export type RefreshVerdict =
  /** Token sah dan aktif. Rotasi boleh berjalan. */
  | { kind: 'rotate' }
  /**
   * Token hasil rotasi dipakai lagi. Ia seharusnya sudah dibuang pemiliknya
   * begitu penggantinya diterima, jadi kemunculannya berarti salinannya ada di
   * tangan orang lain. Mencabut token itu saja tidak menolong — penyerang bisa
   * jadi justru pemegang token yang sekarang aktif.
   */
  | { kind: 'reuse_detected' }
  /**
   * Dicabut dengan sengaja: logout, pencabutan manual, atau perubahan kata
   * sandi. Tab lama yang mencoba menyegarkan bukan serangan, dan tidak boleh
   * memicu pencabutan seluruh keluarga.
   */
  | { kind: 'revoked' }
  | { kind: 'expired' }

export function judgeRefresh(session: SessionState, now: Date): RefreshVerdict {
  if (session.revokedAt !== null) {
    return session.revokedReason === 'rotated' ? { kind: 'reuse_detected' } : { kind: 'revoked' }
  }
  if (session.expiresAt.getTime() <= now.getTime()) return { kind: 'expired' }
  return { kind: 'rotate' }
}
