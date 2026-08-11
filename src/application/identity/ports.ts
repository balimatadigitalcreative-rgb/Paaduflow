/**
 * Port yang dibutuhkan autentikasi.
 *
 * Dideklarasikan di lapisan aplikasi dan diimplementasikan di infrastruktur —
 * arah ketergantungan tetap satu arah (D-040). Yang di sini adalah kebutuhan,
 * bukan teknologi: tidak ada satu pun nama tabel, algoritma, atau pustaka.
 */

export type UserStatus = 'active' | 'suspended' | 'deactivated'

export interface UserRecord {
  readonly id: string
  readonly email: string
  readonly fullName: string
  readonly status: UserStatus
  readonly emailVerifiedAt: Date | null
}

export interface CredentialRecord {
  readonly userId: string
  readonly passwordHash: string
  readonly passwordChangedAt: Date
  readonly failedAttempts: number
  readonly lockedUntil: Date | null
}

export interface SessionRecord {
  readonly id: string
  readonly userId: string
  readonly familyId: string
  readonly device: string | null
  readonly ip: string | null
  readonly userAgent: string | null
  readonly issuedAt: Date
  readonly lastSeenAt: Date
  readonly expiresAt: Date
  readonly revokedAt: Date | null
  readonly revokedReason: SessionRevokeReason | null
}

export interface MfaFactorRecord {
  readonly id: string
  readonly userId: string
  readonly secretEncrypted: string
  readonly confirmedAt: Date | null
  readonly lastUsedCounter: number | null
}

export interface TenantMembership {
  readonly tenantId: string
  readonly isOwner: boolean
}

export type SessionRevokeReason =
  | 'rotated'
  | 'logout'
  | 'revoked_by_user'
  | 'password_changed'
  | 'reuse_detected'
  | 'expired'

export interface NewSession {
  readonly id: string
  readonly userId: string
  readonly familyId: string
  readonly refreshTokenHash: string
  readonly device: string | null
  readonly ip: string | null
  readonly userAgent: string | null
  readonly expiresAt: Date
}

export interface AuthEvent {
  readonly userId: string | null
  readonly tenantId: string | null
  readonly type: string
  readonly ip: string | null
  readonly userAgent: string | null
  /**
   * `X-Request-Id`. Ia yang menyambungkan log, jejak, dan audit trail menjadi
   * satu rangkaian yang dapat ditelusuri — Resilience §7.
   */
  readonly requestId: string | null
  readonly metadata: Record<string, unknown>
}

/** Seluruh penyimpanan yang dibutuhkan modul identitas. */
export interface IdentityRepository {
  findUserByEmail(email: string): Promise<UserRecord | null>
  findUserById(id: string): Promise<UserRecord | null>
  createUser(user: {
    id: string
    email: string
    fullName: string
    passwordHash: string
  }): Promise<UserRecord>
  markEmailVerified(userId: string, at: Date): Promise<void>

  getCredential(userId: string): Promise<CredentialRecord | null>
  updatePasswordHash(userId: string, passwordHash: string, at: Date): Promise<void>
  recordFailedAttempt(userId: string, failedAttempts: number, lockedUntil: Date | null): Promise<void>
  resetFailedAttempts(userId: string): Promise<void>

  createVerificationToken(token: {
    id: string
    userId: string
    tokenHash: string
    expiresAt: Date
  }): Promise<void>
  consumeVerificationToken(tokenHash: string, at: Date): Promise<string | null>

  createSession(session: NewSession): Promise<SessionRecord>
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>
  revokeSession(sessionId: string, reason: SessionRevokeReason, at: Date): Promise<void>
  replaceSession(oldSessionId: string, newSessionId: string, at: Date): Promise<void>
  revokeFamily(familyId: string, reason: SessionRevokeReason, at: Date): Promise<number>
  revokeAllForUser(
    userId: string,
    reason: SessionRevokeReason,
    at: Date,
    exceptSessionId: string | null,
  ): Promise<number>
  listActiveSessions(userId: string, now: Date): Promise<SessionRecord[]>
  touchSession(sessionId: string, at: Date): Promise<void>

  getMfaFactor(userId: string): Promise<MfaFactorRecord | null>
  saveMfaFactor(factor: { id: string; userId: string; secretEncrypted: string }): Promise<void>
  confirmMfaFactor(userId: string, at: Date, counter: number): Promise<void>
  markMfaUsed(userId: string, at: Date, counter: number): Promise<void>
  replaceRecoveryCodes(userId: string, codes: { id: string; codeHash: string }[]): Promise<void>
  consumeRecoveryCode(userId: string, codeHash: string, at: Date): Promise<boolean>

  /**
   * Jumlah kegagalan autentikasi dari satu alamat sejak waktu tertentu.
   *
   * Dihitung dari catatan peristiwa yang memang sudah ditulis, bukan dari
   * penghitung terpisah — keadaan kedua yang harus dijaga tetap sinkron adalah
   * keadaan yang akan menyimpang.
   */
  countRecentFailuresByIp(ip: string, since: Date): Promise<number>

  listMemberships(userId: string): Promise<TenantMembership[]>

  appendAuthEvent(event: AuthEvent): Promise<void>
}

export interface PasswordHasher {
  hash(password: string): Promise<string>
  verify(hash: string, password: string): Promise<boolean>
  /**
   * Melakukan kerja sebanyak verifikasi sungguhan terhadap hash palsu.
   *
   * Dipanggil saat email tidak ditemukan, supaya waktu jawaban tidak
   * memberitahu penyerang bahwa akun itu tidak ada.
   */
  verifyDummy(): Promise<void>
}

export interface BreachedPasswordList {
  isBreached(password: string): Promise<boolean>
}

export interface TokenFactory {
  /** Token acak beserta hash-nya. Yang disimpan hanya hash. */
  create(): { token: string; hash: string }
  hash(token: string): string
}

export interface SecretCipher {
  encrypt(plaintext: string): string
  decrypt(ciphertext: string): string
}

export interface TotpService {
  generateSecret(): string
  provisioningUri(secret: string, email: string): string
  /** Mengembalikan counter jendela yang cocok, atau null bila kode salah. */
  verify(secret: string, code: string, at: Date): number | null
}

export interface AccessTokenClaims {
  readonly userId: string
  readonly email: string
  /** Sesi asal token ini. Dipakai menandai "perangkat ini" di daftar sesi. */
  readonly sessionId: string
  readonly memberships: readonly TenantMembership[]
}

export interface AccessTokenIssuer {
  /** Access token. TIDAK pernah memuat company_id — D-002. */
  issueAccessToken(claims: AccessTokenClaims, now: Date): Promise<string>
  /** Membaca access token. `null` untuk token rusak, kedaluwarsa, atau salah tujuan. */
  readAccessToken(token: string): Promise<AccessTokenClaims | null>
  /** Tantangan MFA berumur pendek, menggantikan penyimpanan tantangan di basis data. */
  issueMfaChallenge(userId: string, now: Date): Promise<string>
  readMfaChallenge(token: string): Promise<string | null>
}

export interface Mailer {
  sendEmailVerification(email: string, token: string): Promise<void>
  /**
   * Dikirim saat seseorang mencoba mendaftar dengan email yang sudah terdaftar.
   *
   * Inilah yang membuat jawaban registrasi dapat selalu sama tanpa membiarkan
   * pemilik akun buta terhadap upaya itu.
   */
  sendAccountAlreadyExists(email: string): Promise<void>
}

export interface IdentityDependencies {
  readonly repository: IdentityRepository
  readonly hasher: PasswordHasher
  readonly breachList: BreachedPasswordList
  readonly tokens: TokenFactory
  readonly cipher: SecretCipher
  readonly totp: TotpService
  readonly accessTokens: AccessTokenIssuer
  readonly mailer: Mailer
  readonly now: () => Date
  readonly newId: () => string
}

export interface RequestContext {
  readonly ip: string | null
  readonly userAgent: string | null
  readonly device: string | null
  readonly requestId?: string | null
}

export const ANONYMOUS_CONTEXT: RequestContext = {
  ip: null,
  userAgent: null,
  device: null,
  requestId: null,
}
