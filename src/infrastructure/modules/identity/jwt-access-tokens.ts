import { jwtVerify, SignJWT } from 'jose'

import type { AccessTokenClaims, AccessTokenIssuer } from '#application/identity/ports'
import { ACCESS_TOKEN_TTL_MS } from '#domain/identity/session-policy'

const MFA_CHALLENGE_TTL_MS = 5 * 60_000

const ACCESS_PURPOSE = 'access'
const MFA_PURPOSE = 'mfa_challenge'

/**
 * Access token dan tantangan MFA, keduanya JWT bertanda tangan HS256.
 *
 * Token membawa identitas dan keanggotaan tenant, **tidak** membawa
 * `company_id` — D-002. Konteks company datang dari path URL dan diotorisasi
 * per permintaan, sehingga berpindah company tidak memerlukan token baru dan
 * tautan lintas company dapat dibuka orang lain.
 *
 * Tantangan MFA sengaja berupa token bertanda tangan, bukan baris di basis
 * data. Ia berumur lima menit, sekali pakai secara praktis karena hanya berguna
 * bersama kode yang benar, dan tidak meninggalkan sampah yang harus dipangkas.
 */
export class JwtAccessTokenIssuer implements AccessTokenIssuer {
  private readonly key: Uint8Array

  constructor(secret: string) {
    if (secret.length < 32) {
      throw new Error('Rahasia penanda tangan token minimal 32 karakter.')
    }
    this.key = new TextEncoder().encode(secret)
  }

  async issueAccessToken(claims: AccessTokenClaims, now: Date): Promise<string> {
    return new SignJWT({
      purpose: ACCESS_PURPOSE,
      email: claims.email,
      sid: claims.sessionId,
      memberships: claims.memberships.map((membership) => ({
        tenant_id: membership.tenantId,
        is_owner: membership.isOwner,
      })),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuedAt(Math.floor(now.getTime() / 1000))
      .setExpirationTime(Math.floor((now.getTime() + ACCESS_TOKEN_TTL_MS) / 1000))
      .sign(this.key)
  }

  async readAccessToken(token: string): Promise<AccessTokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key)
      if (payload.purpose !== ACCESS_PURPOSE) return null
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.sid !== 'string'
      ) {
        return null
      }

      const raw = Array.isArray(payload.memberships) ? payload.memberships : []
      return {
        userId: payload.sub,
        email: payload.email,
        sessionId: payload.sid,
        memberships: raw.flatMap((entry: unknown) => {
          if (typeof entry !== 'object' || entry === null) return []
          const record = entry as Record<string, unknown>
          if (typeof record.tenant_id !== 'string') return []
          return [{ tenantId: record.tenant_id, isOwner: record.is_owner === true }]
        }),
      }
    } catch {
      return null
    }
  }

  async issueMfaChallenge(userId: string, now: Date): Promise<string> {
    return new SignJWT({ purpose: MFA_PURPOSE })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt(Math.floor(now.getTime() / 1000))
      .setExpirationTime(Math.floor((now.getTime() + MFA_CHALLENGE_TTL_MS) / 1000))
      .sign(this.key)
  }

  async readMfaChallenge(token: string): Promise<string | null> {
    try {
      const { payload } = await jwtVerify(token, this.key)
      // Tanpa pemeriksaan ini, access token dapat dipakai sebagai tantangan MFA
      // dan sebaliknya — dua tujuan berbeda dengan kunci yang sama.
      if (payload.purpose !== MFA_PURPOSE) return null
      return typeof payload.sub === 'string' ? payload.sub : null
    } catch {
      return null
    }
  }
}
