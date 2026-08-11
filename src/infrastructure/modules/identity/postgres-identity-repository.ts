import type {
  AuthEvent,
  CredentialRecord,
  IdentityRepository,
  MfaFactorRecord,
  NewSession,
  SessionRecord,
  SessionRevokeReason,
  TenantMembership,
  UserRecord,
  UserStatus,
} from '#application/identity/ports'
import type { Queryable } from '#infrastructure/db/queryable'

interface UserRow {
  id: string
  email: string
  full_name: string
  status: UserStatus
  email_verified_at: Date | null
}

interface SessionRow {
  id: string
  user_id: string
  family_id: string
  device: string | null
  ip: string | null
  user_agent: string | null
  issued_at: Date
  last_seen_at: Date
  expires_at: Date
  revoked_at: Date | null
  revoked_reason: SessionRevokeReason | null
}

function toUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    status: row.status,
    emailVerifiedAt: row.email_verified_at,
  }
}

function toSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    familyId: row.family_id,
    device: row.device,
    ip: row.ip,
    userAgent: row.user_agent,
    issuedAt: row.issued_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
  }
}

const USER_COLUMNS = 'id, email, full_name, status, email_verified_at'
const SESSION_COLUMNS =
  'id, user_id, family_id, device, ip, user_agent, issued_at, last_seen_at, expires_at, revoked_at, revoked_reason'

export class PostgresIdentityRepository implements IdentityRepository {
  constructor(private readonly db: Queryable) {}

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const { rows } = await this.db.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email],
    )
    return rows[0] === undefined ? null : toUser(rows[0])
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const { rows } = await this.db.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    )
    return rows[0] === undefined ? null : toUser(rows[0])
  }

  /**
   * Pengguna dan kredensialnya lahir dalam satu pernyataan.
   *
   * CTE yang menulis bersifat atomik: tidak mungkin ada pengguna tanpa
   * kredensial, bahkan bila koneksi putus di tengah.
   */
  async createUser(user: {
    id: string
    email: string
    fullName: string
    passwordHash: string
  }): Promise<UserRecord> {
    const { rows } = await this.db.query<UserRow>(
      `WITH dibuat AS (
         INSERT INTO users (id, email, full_name)
         VALUES ($1, $2, $3)
         RETURNING ${USER_COLUMNS}
       ), kredensial AS (
         INSERT INTO user_credentials (user_id, password_hash)
         SELECT id, $4 FROM dibuat
       )
       SELECT * FROM dibuat`,
      [user.id, user.email, user.fullName, user.passwordHash],
    )
    const row = rows[0]
    if (row === undefined) throw new Error('Pembuatan pengguna tidak mengembalikan baris.')
    return toUser(row)
  }

  async markEmailVerified(userId: string, at: Date): Promise<void> {
    await this.db.query('UPDATE users SET email_verified_at = $2 WHERE id = $1', [userId, at])
  }

  async getCredential(userId: string): Promise<CredentialRecord | null> {
    const { rows } = await this.db.query<{
      user_id: string
      password_hash: string
      password_changed_at: Date
      failed_attempts: number
      locked_until: Date | null
    }>(
      `SELECT user_id, password_hash, password_changed_at, failed_attempts, locked_until
         FROM user_credentials WHERE user_id = $1`,
      [userId],
    )
    const row = rows[0]
    if (row === undefined) return null
    return {
      userId: row.user_id,
      passwordHash: row.password_hash,
      passwordChangedAt: row.password_changed_at,
      failedAttempts: row.failed_attempts,
      lockedUntil: row.locked_until,
    }
  }

  async updatePasswordHash(userId: string, passwordHash: string, at: Date): Promise<void> {
    await this.db.query(
      `UPDATE user_credentials
          SET password_hash = $2, password_changed_at = $3, failed_attempts = 0, locked_until = NULL
        WHERE user_id = $1`,
      [userId, passwordHash, at],
    )
  }

  async recordFailedAttempt(
    userId: string,
    failedAttempts: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    await this.db.query(
      'UPDATE user_credentials SET failed_attempts = $2, locked_until = $3 WHERE user_id = $1',
      [userId, failedAttempts, lockedUntil],
    )
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE user_credentials SET failed_attempts = 0, locked_until = NULL
        WHERE user_id = $1 AND (failed_attempts <> 0 OR locked_until IS NOT NULL)`,
      [userId],
    )
  }

  async createVerificationToken(token: {
    id: string
    userId: string
    tokenHash: string
    expiresAt: Date
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [token.id, token.userId, token.tokenHash, token.expiresAt],
    )
  }

  async consumeVerificationToken(tokenHash: string, at: Date): Promise<string | null> {
    const { rows } = await this.db.query<{ user_id: string }>(
      `UPDATE email_verification_tokens
          SET consumed_at = $2
        WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > $2
        RETURNING user_id`,
      [tokenHash, at],
    )
    return rows[0]?.user_id ?? null
  }

  async createSession(session: NewSession): Promise<SessionRecord> {
    const { rows } = await this.db.query<SessionRow>(
      `INSERT INTO sessions
         (id, user_id, family_id, refresh_token_hash, device, ip, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${SESSION_COLUMNS}`,
      [
        session.id,
        session.userId,
        session.familyId,
        session.refreshTokenHash,
        session.device,
        session.ip,
        session.userAgent,
        session.expiresAt,
      ],
    )
    const row = rows[0]
    if (row === undefined) throw new Error('Pembuatan sesi tidak mengembalikan baris.')
    return toSession(row)
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const { rows } = await this.db.query<SessionRow>(
      `SELECT ${SESSION_COLUMNS} FROM sessions WHERE refresh_token_hash = $1`,
      [tokenHash],
    )
    return rows[0] === undefined ? null : toSession(rows[0])
  }

  async revokeSession(sessionId: string, reason: SessionRevokeReason, at: Date): Promise<void> {
    await this.db.query(
      `UPDATE sessions SET revoked_at = $2, revoked_reason = $3
        WHERE id = $1 AND revoked_at IS NULL`,
      [sessionId, at, reason],
    )
  }

  async replaceSession(oldSessionId: string, newSessionId: string): Promise<void> {
    await this.db.query('UPDATE sessions SET replaced_by = $2 WHERE id = $1', [
      oldSessionId,
      newSessionId,
    ])
  }

  async revokeFamily(familyId: string, reason: SessionRevokeReason, at: Date): Promise<number> {
    const { rowCount } = await this.db.query(
      `UPDATE sessions SET revoked_at = $2, revoked_reason = $3
        WHERE family_id = $1 AND revoked_at IS NULL`,
      [familyId, at, reason],
    )
    return rowCount ?? 0
  }

  async revokeAllForUser(
    userId: string,
    reason: SessionRevokeReason,
    at: Date,
    exceptSessionId: string | null,
  ): Promise<number> {
    const { rowCount } = await this.db.query(
      `UPDATE sessions SET revoked_at = $2, revoked_reason = $3
        WHERE user_id = $1 AND revoked_at IS NULL AND ($4::uuid IS NULL OR id <> $4::uuid)`,
      [userId, at, reason, exceptSessionId],
    )
    return rowCount ?? 0
  }

  async listActiveSessions(userId: string, now: Date): Promise<SessionRecord[]> {
    const { rows } = await this.db.query<SessionRow>(
      `SELECT ${SESSION_COLUMNS} FROM sessions
        WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > $2
        ORDER BY last_seen_at DESC`,
      [userId, now],
    )
    return rows.map(toSession)
  }

  async touchSession(sessionId: string, at: Date): Promise<void> {
    await this.db.query('UPDATE sessions SET last_seen_at = $2 WHERE id = $1', [sessionId, at])
  }

  async getMfaFactor(userId: string): Promise<MfaFactorRecord | null> {
    const { rows } = await this.db.query<{
      id: string
      user_id: string
      secret_encrypted: string
      confirmed_at: Date | null
      last_used_counter: string | null
    }>(
      `SELECT id, user_id, secret_encrypted, confirmed_at, last_used_counter
         FROM mfa_factors WHERE user_id = $1 AND type = 'totp'`,
      [userId],
    )
    const row = rows[0]
    if (row === undefined) return null
    return {
      id: row.id,
      userId: row.user_id,
      secretEncrypted: row.secret_encrypted,
      confirmedAt: row.confirmed_at,
      // bigint kembali sebagai string dari pg — dikonversi di batas ini, bukan
      // dibiarkan merembes ke lapisan aplikasi sebagai tipe yang mengejutkan.
      lastUsedCounter: row.last_used_counter === null ? null : Number(row.last_used_counter),
    }
  }

  async saveMfaFactor(factor: {
    id: string
    userId: string
    secretEncrypted: string
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO mfa_factors (id, user_id, type, secret_encrypted)
       VALUES ($1, $2, 'totp', $3)
       ON CONFLICT (user_id, type)
       DO UPDATE SET secret_encrypted = EXCLUDED.secret_encrypted,
                     confirmed_at = NULL,
                     last_used_counter = NULL`,
      [factor.id, factor.userId, factor.secretEncrypted],
    )
  }

  async confirmMfaFactor(userId: string, at: Date, counter: number): Promise<void> {
    await this.db.query(
      `UPDATE mfa_factors SET confirmed_at = $2, last_used_at = $2, last_used_counter = $3
        WHERE user_id = $1 AND type = 'totp'`,
      [userId, at, counter],
    )
  }

  async markMfaUsed(userId: string, at: Date, counter: number): Promise<void> {
    await this.db.query(
      `UPDATE mfa_factors SET last_used_at = $2, last_used_counter = $3
        WHERE user_id = $1 AND type = 'totp'`,
      [userId, at, counter],
    )
  }

  async replaceRecoveryCodes(
    userId: string,
    codes: { id: string; codeHash: string }[],
  ): Promise<void> {
    await this.db.query(
      `WITH dihapus AS (
         DELETE FROM mfa_recovery_codes WHERE user_id = $1
       )
       INSERT INTO mfa_recovery_codes (id, user_id, code_hash)
       SELECT unnest($2::uuid[]), $1, unnest($3::text[])`,
      [userId, codes.map((code) => code.id), codes.map((code) => code.codeHash)],
    )
  }

  async consumeRecoveryCode(userId: string, codeHash: string, at: Date): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `UPDATE mfa_recovery_codes SET used_at = $3
        WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL`,
      [userId, codeHash, at],
    )
    return (rowCount ?? 0) > 0
  }

  async countRecentFailuresByIp(ip: string, since: Date): Promise<number> {
    const { rows } = await this.db.query<{ jumlah: string }>(
      `SELECT count(*) AS jumlah FROM auth_events
        WHERE ip = $1::inet
          AND created_at > $2
          AND type IN ('login.failed', 'mfa.failed')`,
      [ip, since],
    )
    return Number(rows[0]?.jumlah ?? 0)
  }

  async listMemberships(userId: string): Promise<TenantMembership[]> {
    const { rows } = await this.db.query<{ tenant_id: string; is_owner: boolean }>(
      `SELECT tenant_id, is_owner FROM tenant_memberships
        WHERE user_id = $1 AND status = 'active'
        ORDER BY tenant_id`,
      [userId],
    )
    return rows.map((row) => ({ tenantId: row.tenant_id, isOwner: row.is_owner }))
  }

  async appendAuthEvent(event: AuthEvent): Promise<void> {
    await this.db.query(
      `INSERT INTO auth_events (id, user_id, tenant_id, type, ip, user_agent, metadata)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
      [
        event.userId,
        event.tenantId,
        event.type,
        event.ip,
        event.userAgent,
        JSON.stringify(event.metadata),
      ],
    )
  }
}
