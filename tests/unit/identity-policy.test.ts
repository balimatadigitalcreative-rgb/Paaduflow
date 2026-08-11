import { describe, expect, test } from 'vitest'

import {
  afterFailedAttempt,
  isLocked,
  lockoutDurationMs,
  MAX_LOCKOUT_MS,
} from '#domain/identity/lockout-policy'
import {
  checkPassword,
  normalizePassword,
  PASSWORD_MIN_LENGTH,
} from '#domain/identity/password-policy'
import { judgeRefresh } from '#domain/identity/session-policy'

const TIDAK_BOCOR = { breached: false }

describe('kebijakan kata sandi', () => {
  test('menerima dua belas huruf kecil tanpa angka dan tanpa simbol', () => {
    expect(checkPassword('duabelaskarakter', TIDAK_BOCOR)).toBeNull()
  })

  test('menolak yang lebih pendek dari batas', () => {
    expect(checkPassword('a'.repeat(PASSWORD_MIN_LENGTH - 1), TIDAK_BOCOR)).toBe('terlalu_pendek')
  })

  test('menolak yang pernah bocor meski panjang', () => {
    expect(checkPassword('kata sandi yang sangat panjang', { breached: true })).toBe('pernah_bocor')
  })

  test('emoji dihitung satu karakter, bukan dua', () => {
    // Dua belas emoji adalah dua puluh empat unit UTF-16. Menghitung `.length`
    // akan meluluskannya lewat jalan yang salah.
    const duaBelasEmoji = '😀'.repeat(12)
    expect([...duaBelasEmoji].length).toBe(12)
    expect(duaBelasEmoji.length).toBe(24)
    expect(checkPassword(duaBelasEmoji, TIDAK_BOCOR)).toBeNull()
    expect(checkPassword('😀'.repeat(11), TIDAK_BOCOR)).toBe('terlalu_pendek')
  })

  test('normalisasi menyamakan bentuk karakter yang tampak identik', () => {
    // Bentuk terurai dan bentuk gabungan dari huruf yang sama harus menghasilkan
    // hash yang sama, kalau tidak pengguna melihat "kata sandi salah" untuk kata
    // sandi yang benar.
    expect(normalizePassword('kafé rahasia')).toBe(normalizePassword('kafé rahasia'))
  })
})

describe('penguncian bertahap', () => {
  test('dua kesalahan pertama tidak mengunci', () => {
    expect(lockoutDurationMs(1)).toBe(0)
    expect(lockoutDurationMs(2)).toBe(0)
  })

  test('jeda tumbuh, lalu berhenti di batas atas', () => {
    expect(lockoutDurationMs(3)).toBe(60_000)
    expect(lockoutDurationMs(4)).toBe(120_000)
    expect(lockoutDurationMs(5)).toBe(300_000)
    expect(lockoutDurationMs(6)).toBe(900_000)
    expect(lockoutDurationMs(7)).toBe(MAX_LOCKOUT_MS)
    expect(lockoutDurationMs(70)).toBe(MAX_LOCKOUT_MS)
  })

  test('kegagalan ketiga menghasilkan waktu buka yang konkret', () => {
    const sekarang = new Date('2026-08-11T00:00:00.000Z')
    const hasil = afterFailedAttempt(2, sekarang)

    expect(hasil.failedAttempts).toBe(3)
    expect(hasil.lockedUntil?.toISOString()).toBe('2026-08-11T00:01:00.000Z')
    expect(isLocked(hasil.lockedUntil, sekarang)).toBe(true)
    expect(isLocked(hasil.lockedUntil, new Date('2026-08-11T00:01:01.000Z'))).toBe(false)
  })
})

describe('penilaian refresh token', () => {
  const sekarang = new Date('2026-08-11T00:00:00.000Z')
  const besok = new Date('2026-08-12T00:00:00.000Z')

  test('token aktif boleh berotasi', () => {
    expect(
      judgeRefresh({ expiresAt: besok, revokedAt: null, revokedReason: null }, sekarang),
    ).toEqual({ kind: 'rotate' })
  })

  test('token hasil rotasi yang dipakai lagi adalah serangan', () => {
    expect(
      judgeRefresh({ expiresAt: besok, revokedAt: sekarang, revokedReason: 'rotated' }, sekarang),
    ).toEqual({ kind: 'reuse_detected' })
  })

  test('token yang dicabut karena logout bukan serangan', () => {
    for (const alasan of ['logout', 'revoked_by_user', 'password_changed']) {
      expect(
        judgeRefresh({ expiresAt: besok, revokedAt: sekarang, revokedReason: alasan }, sekarang),
      ).toEqual({ kind: 'revoked' })
    }
  })

  test('kedaluwarsa dinilai sebelum rotasi', () => {
    expect(
      judgeRefresh({ expiresAt: sekarang, revokedAt: null, revokedReason: null }, besok),
    ).toEqual({ kind: 'expired' })
  })
})
