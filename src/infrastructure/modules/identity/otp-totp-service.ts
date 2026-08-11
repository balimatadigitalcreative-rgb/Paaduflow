import { Secret, TOTP } from 'otpauth'

import type { TotpService } from '#application/identity/ports'

const PERIOD_SECONDS = 30
const DIGITS = 6

/**
 * TOTP dengan jendela toleransi satu langkah ke belakang dan ke depan.
 *
 * Toleransi ada karena jam ponsel dan jam server tidak pernah persis sama.
 * Lebih lebar dari satu langkah berarti kode berlaku lebih dari satu setengah
 * menit, dan itu memperbesar jendela bagi kode yang terlihat orang lain.
 */
export class OtpTotpService implements TotpService {
  constructor(private readonly issuer = 'Paadu Flow') {}

  generateSecret(): string {
    return new Secret({ size: 20 }).base32
  }

  provisioningUri(secret: string, email: string): string {
    return this.build(secret, email).toString()
  }

  /**
   * Mengembalikan nomor langkah waktu yang cocok, bukan sekadar benar atau
   * salah. Nomor itulah yang dipakai menolak kode yang sama dipakai dua kali.
   */
  verify(secret: string, code: string, at: Date): number | null {
    const delta = this.build(secret, 'verify').validate({
      token: code.trim(),
      timestamp: at.getTime(),
      window: 1,
    })
    if (delta === null) return null

    return Math.floor(at.getTime() / 1000 / PERIOD_SECONDS) + delta
  }

  private build(secret: string, label: string): TOTP {
    return new TOTP({
      issuer: this.issuer,
      label,
      algorithm: 'SHA1',
      digits: DIGITS,
      period: PERIOD_SECONDS,
      secret: Secret.fromBase32(secret),
    })
  }
}
