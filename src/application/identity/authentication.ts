import { ipWindowStart, isIpThrottled } from '#domain/identity/ip-throttle'
import { afterFailedAttempt, isLocked } from '#domain/identity/lockout-policy'
import { checkPassword, normalizePassword, type PasswordRejection } from '#domain/identity/password-policy'
import { ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS } from '#domain/identity/session-policy'

import type {
  AccessTokenClaims,
  IdentityDependencies,
  RequestContext,
  SessionRecord,
  UserRecord,
} from './ports.js'

/**
 * Registrasi, verifikasi email, masuk, dan MFA.
 *
 * Satu hal berulang di seluruh berkas ini: jawaban tidak boleh memberi tahu
 * penyerang apa pun yang belum ia ketahui. Registrasi tidak mengakui email
 * terdaftar, masuk tidak membedakan email tidak ada dari kata sandi salah, dan
 * akun terkunci tidak diumumkan.
 */

export type RegisterResult =
  | { kind: 'accepted' }
  | { kind: 'password_rejected'; reason: PasswordRejection }

export type LoginResult =
  | { kind: 'authenticated'; accessToken: string; refreshToken: string; sessionId: string }
  | { kind: 'mfa_required'; challengeToken: string }
  | { kind: 'invalid_credentials' }

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000

export class AuthenticationService {
  constructor(private readonly deps: IdentityDependencies) {}

  /**
   * Registrasi selalu menjawab `accepted`.
   *
   * Email yang sudah terdaftar tidak menghasilkan jawaban berbeda, tidak
   * menghasilkan galat, dan tidak menghasilkan pengguna baru — pemiliknya yang
   * diberi tahu lewat email, bukan pendaftarnya lewat jawaban HTTP.
   */
  async register(
    input: { email: string; password: string; fullName: string },
    context: RequestContext,
  ): Promise<RegisterResult> {
    const { repository, hasher, breachList, tokens, mailer, now, newId } = this.deps
    const email = normalizeEmail(input.email)

    // Kata sandi diperiksa lebih dulu, tanpa menyentuh basis data. Penolakan di
    // sini tidak menyiratkan apa pun tentang email.
    const rejection = checkPassword(input.password, {
      breached: await breachList.isBreached(input.password),
    })
    if (rejection !== null) return { kind: 'password_rejected', reason: rejection }

    const existing = await repository.findUserByEmail(email)
    if (existing !== null) {
      await repository.appendAuthEvent({
        userId: existing.id,
        tenantId: null,
        type: 'register.duplicate_email',
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: {},
      })
      await mailer.sendAccountAlreadyExists(email)
      return { kind: 'accepted' }
    }

    const passwordHash = await hasher.hash(normalizePassword(input.password))
    const user = await repository.createUser({
      id: newId(),
      email,
      fullName: input.fullName,
      passwordHash,
    })

    const verification = tokens.create()
    await repository.createVerificationToken({
      id: newId(),
      userId: user.id,
      tokenHash: verification.hash,
      expiresAt: new Date(now().getTime() + VERIFICATION_TTL_MS),
    })
    await mailer.sendEmailVerification(email, verification.token)

    await repository.appendAuthEvent({
      userId: user.id,
      tenantId: null,
      type: 'register.created',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: {},
    })

    return { kind: 'accepted' }
  }

  /** Membaca access token. Lapisan HTTP memakainya di setiap permintaan. */
  async readAccessToken(token: string): Promise<AccessTokenClaims | null> {
    return this.deps.accessTokens.readAccessToken(token)
  }

  async verifyEmail(token: string): Promise<boolean> {
    const { repository, tokens, now } = this.deps
    const at = now()
    const userId = await repository.consumeVerificationToken(tokens.hash(token), at)
    if (userId === null) return false

    await repository.markEmailVerified(userId, at)
    await repository.appendAuthEvent({
      userId,
      tenantId: null,
      type: 'email.verified',
      ip: null,
      userAgent: null,
      metadata: {},
    })
    return true
  }

  async login(
    input: { email: string; password: string },
    context: RequestContext,
  ): Promise<LoginResult> {
    const { repository, hasher, now } = this.deps
    const at = now()

    // Diperiksa sebelum apa pun yang menyentuh kata sandi. Argon2 dirancang
    // mahal; membiarkan permintaan yang sudah pasti ditolak tetap memicunya
    // mengubah pembatasan laju menjadi jalan masuk kehabisan sumber daya.
    if (context.ip !== null) {
      const kegagalan = await repository.countRecentFailuresByIp(context.ip, ipWindowStart(at))
      if (isIpThrottled(kegagalan)) {
        await repository.appendAuthEvent({
          userId: null,
          tenantId: null,
          // Sengaja bukan `login.failed`: peristiwa ini tidak boleh ikut
          // menghitung dirinya sendiri dan memperpanjang blokade selamanya.
          type: 'login.blocked_ip',
          ip: context.ip,
          userAgent: context.userAgent,
          metadata: { recentFailures: kegagalan },
        })
        return { kind: 'invalid_credentials' }
      }
    }

    const email = normalizeEmail(input.email)
    const user = await repository.findUserByEmail(email)

    if (user === null) {
      // Kerja yang sama banyaknya dengan verifikasi sungguhan, supaya waktu
      // jawaban tidak menjadi oracle keberadaan akun.
      await hasher.verifyDummy()
      // Dicatat meski akunnya tidak ada. Justru inilah bentuk credential
      // stuffing: ribuan email yang ditebak, hampir semuanya tidak terdaftar.
      // Tanpa baris ini, serangan yang paling umum tidak terlihat sama sekali
      // oleh pembatasan laju.
      await repository.appendAuthEvent({
        userId: null,
        tenantId: null,
        type: 'login.failed',
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { reason: 'unknown_email' },
      })
      return { kind: 'invalid_credentials' }
    }

    const credential = await repository.getCredential(user.id)
    if (credential === null) {
      await hasher.verifyDummy()
      await repository.appendAuthEvent({
        userId: user.id,
        tenantId: null,
        type: 'login.failed',
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { reason: 'no_credential' },
      })
      return { kind: 'invalid_credentials' }
    }

    if (isLocked(credential.lockedUntil, at)) {
      // Penguncian tidak diumumkan. Memberitahu penyerang bahwa akun terkunci
      // sama saja dengan mengakui akun itu ada — dan memberi tahu bahwa
      // serangannya berhasil menimbulkan efek.
      await repository.appendAuthEvent({
        userId: user.id,
        tenantId: null,
        type: 'login.blocked_locked',
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { lockedUntil: credential.lockedUntil?.toISOString() ?? null },
      })
      return { kind: 'invalid_credentials' }
    }

    const ok = await hasher.verify(credential.passwordHash, normalizePassword(input.password))
    if (!ok) {
      const next = afterFailedAttempt(credential.failedAttempts, at)
      await repository.recordFailedAttempt(user.id, next.failedAttempts, next.lockedUntil)
      await repository.appendAuthEvent({
        userId: user.id,
        tenantId: null,
        type: 'login.failed',
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { failedAttempts: next.failedAttempts },
      })
      return { kind: 'invalid_credentials' }
    }

    await repository.resetFailedAttempts(user.id)

    if (user.status !== 'active') {
      await repository.appendAuthEvent({
        userId: user.id,
        tenantId: null,
        type: 'login.blocked_status',
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { status: user.status },
      })
      return { kind: 'invalid_credentials' }
    }

    const factor = await repository.getMfaFactor(user.id)
    if (factor !== null && factor.confirmedAt !== null) {
      const challengeToken = await this.deps.accessTokens.issueMfaChallenge(user.id, at)
      return { kind: 'mfa_required', challengeToken }
    }

    return this.startSession(user, context)
  }

  /** Verifikasi MFA menerima kode TOTP maupun kode pemulihan sekali pakai. */
  async verifyMfa(
    input: { challengeToken: string; code: string },
    context: RequestContext,
  ): Promise<LoginResult> {
    const { repository, accessTokens, cipher, totp, tokens, now } = this.deps
    const at = now()

    const userId = await accessTokens.readMfaChallenge(input.challengeToken)
    if (userId === null) return { kind: 'invalid_credentials' }

    const user = await repository.findUserById(userId)
    if (user === null || user.status !== 'active') return { kind: 'invalid_credentials' }

    const factor = await repository.getMfaFactor(userId)
    if (factor === null || factor.confirmedAt === null) return { kind: 'invalid_credentials' }

    const counter = totp.verify(cipher.decrypt(factor.secretEncrypted), input.code, at)
    if (counter !== null) {
      // Kode TOTP yang sudah dipakai tidak boleh dipakai lagi di jendela yang
      // sama — tanpa ini, kode yang terlihat di bahu orang masih berlaku sampai
      // tiga puluh detik berikutnya.
      if (factor.lastUsedCounter !== null && counter <= factor.lastUsedCounter) {
        await repository.appendAuthEvent({
          userId,
          tenantId: null,
          type: 'mfa.replay_rejected',
          ip: context.ip,
          userAgent: context.userAgent,
          metadata: {},
        })
        return { kind: 'invalid_credentials' }
      }
      await repository.markMfaUsed(userId, at, counter)
      return this.startSession(user, context)
    }

    const consumed = await repository.consumeRecoveryCode(userId, tokens.hash(input.code), at)
    if (consumed) {
      await repository.appendAuthEvent({
        userId,
        tenantId: null,
        type: 'mfa.recovery_code_used',
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: {},
      })
      return this.startSession(user, context)
    }

    await repository.appendAuthEvent({
      userId,
      tenantId: null,
      type: 'mfa.failed',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: {},
    })
    return { kind: 'invalid_credentials' }
  }

  /** Mendaftarkan TOTP. Faktor belum berlaku sampai dikonfirmasi dengan kode. */
  async enrollTotp(userId: string, email: string): Promise<{ secret: string; uri: string }> {
    const { repository, cipher, totp, newId } = this.deps
    const secret = totp.generateSecret()
    await repository.saveMfaFactor({
      id: newId(),
      userId,
      secretEncrypted: cipher.encrypt(secret),
    })
    return { secret, uri: totp.provisioningUri(secret, email) }
  }

  /** Mengonfirmasi TOTP dan menerbitkan kode pemulihan sekali pakai. */
  async confirmTotp(userId: string, code: string): Promise<{ recoveryCodes: string[] } | null> {
    const { repository, cipher, totp, tokens, now, newId } = this.deps
    const at = now()

    const factor = await repository.getMfaFactor(userId)
    if (factor === null) return null

    const counter = totp.verify(cipher.decrypt(factor.secretEncrypted), code, at)
    if (counter === null) return null

    await repository.confirmMfaFactor(userId, at, counter)

    const codes = Array.from({ length: 10 }, () => tokens.create())
    await repository.replaceRecoveryCodes(
      userId,
      codes.map((code) => ({ id: newId(), codeHash: code.hash })),
    )

    return { recoveryCodes: codes.map((code) => code.token) }
  }

  /**
   * Perubahan kata sandi mencabut seluruh sesi kecuali yang sedang berjalan —
   * Modul 02 §11. Orang yang mengganti kata sandi karena curiga akunnya diambil
   * alih harus benar-benar mengeluarkan penyusupnya, bukan hanya menyulitkannya.
   */
  async changePassword(
    input: {
      userId: string
      currentPassword: string
      newPassword: string
      currentSessionId: string | null
    },
    context: RequestContext,
  ): Promise<{ kind: 'changed'; revokedSessions: number } | { kind: 'invalid_current_password' } | { kind: 'password_rejected'; reason: PasswordRejection }> {
    const { repository, hasher, breachList, now } = this.deps
    const at = now()

    const credential = await repository.getCredential(input.userId)
    if (credential === null) return { kind: 'invalid_current_password' }

    const ok = await hasher.verify(
      credential.passwordHash,
      normalizePassword(input.currentPassword),
    )
    if (!ok) return { kind: 'invalid_current_password' }

    const rejection = checkPassword(input.newPassword, {
      breached: await breachList.isBreached(input.newPassword),
    })
    if (rejection !== null) return { kind: 'password_rejected', reason: rejection }

    await repository.updatePasswordHash(
      input.userId,
      await hasher.hash(normalizePassword(input.newPassword)),
      at,
    )
    const revoked = await repository.revokeAllForUser(
      input.userId,
      'password_changed',
      at,
      input.currentSessionId,
    )

    await repository.appendAuthEvent({
      userId: input.userId,
      tenantId: null,
      type: 'password.changed',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { revokedSessions: revoked },
    })

    return { kind: 'changed', revokedSessions: revoked }
  }

  private async startSession(user: UserRecord, context: RequestContext): Promise<LoginResult> {
    const { repository, tokens, accessTokens, now, newId } = this.deps
    const at = now()

    const refresh = tokens.create()
    const sessionId = newId()
    const session: SessionRecord = await repository.createSession({
      id: sessionId,
      userId: user.id,
      // Login baru memulai keluarga baru. Rotasi mempertahankan keluarganya.
      familyId: sessionId,
      refreshTokenHash: refresh.hash,
      device: context.device,
      ip: context.ip,
      userAgent: context.userAgent,
      expiresAt: new Date(at.getTime() + REFRESH_TOKEN_TTL_MS),
    })

    const memberships = await repository.listMemberships(user.id)
    const accessToken = await accessTokens.issueAccessToken(
      { userId: user.id, email: user.email, sessionId: session.id, memberships },
      at,
    )

    await repository.appendAuthEvent({
      userId: user.id,
      tenantId: null,
      type: 'login.succeeded',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { sessionId: session.id, accessTokenTtlMs: ACCESS_TOKEN_TTL_MS },
    })

    return {
      kind: 'authenticated',
      accessToken,
      refreshToken: refresh.token,
      sessionId: session.id,
    }
  }
}

/** Email dibandingkan sebagai citext di basis data; di sini cukup dirapikan. */
export function normalizeEmail(email: string): string {
  return email.trim().normalize('NFKC')
}
