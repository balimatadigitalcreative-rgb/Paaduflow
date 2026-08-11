import { judgeRefresh, REFRESH_TOKEN_TTL_MS } from '#domain/identity/session-policy'

import type { IdentityDependencies, RequestContext, SessionRecord } from './ports.js'

/**
 * Rotasi refresh token, daftar sesi, dan pencabutan.
 *
 * Yang paling penting di berkas ini adalah apa yang terjadi saat token yang
 * sudah dicabut dipakai lagi. Itu berarti salinannya ada di tangan orang lain,
 * dan kita tidak dapat tahu siapa yang memegang yang asli. Mencabut token itu
 * saja tidak menolong — yang dicabut adalah seluruh keluarganya.
 */

export type RefreshResult =
  | { kind: 'rotated'; accessToken: string; refreshToken: string; sessionId: string }
  | { kind: 'reuse_detected'; revokedSessions: number }
  | { kind: 'expired' }
  | { kind: 'invalid' }

export interface ActiveSession {
  readonly id: string
  readonly device: string | null
  readonly ip: string | null
  readonly userAgent: string | null
  readonly issuedAt: Date
  readonly lastSeenAt: Date
  readonly expiresAt: Date
  readonly current: boolean
}

export class SessionService {
  constructor(private readonly deps: IdentityDependencies) {}

  async refresh(input: { refreshToken: string }, context: RequestContext): Promise<RefreshResult> {
    const { repository, tokens, accessTokens, now, newId } = this.deps
    const at = now()

    const session = await repository.findSessionByTokenHash(tokens.hash(input.refreshToken))
    if (session === null) return { kind: 'invalid' }

    const verdict = judgeRefresh(session, at)

    if (verdict.kind === 'reuse_detected') {
      const revoked = await repository.revokeFamily(session.familyId, 'reuse_detected', at)
      await repository.appendAuthEvent({
        userId: session.userId,
        tenantId: null,
        type: 'session.reuse_detected',
        ip: context.ip,
        userAgent: context.userAgent,
        requestId: context.requestId ?? null,
        metadata: { familyId: session.familyId, revokedSessions: revoked },
      })
      return { kind: 'reuse_detected', revokedSessions: revoked }
    }

    if (verdict.kind === 'revoked') {
      // Bukan serangan: sesi memang sudah dicabut. Tidak ada yang perlu
      // dicabut lagi, dan tidak ada alarm yang perlu dibunyikan.
      return { kind: 'invalid' }
    }

    if (verdict.kind === 'expired') {
      await repository.revokeSession(session.id, 'expired', at)
      return { kind: 'expired' }
    }

    const user = await repository.findUserById(session.userId)
    if (user === null || user.status !== 'active') {
      await repository.revokeSession(session.id, 'revoked_by_user', at)
      return { kind: 'invalid' }
    }

    const refresh = tokens.create()
    const newSessionId = newId()
    await repository.createSession({
      id: newSessionId,
      userId: session.userId,
      familyId: session.familyId,
      refreshTokenHash: refresh.hash,
      device: session.device,
      ip: context.ip ?? session.ip,
      userAgent: context.userAgent ?? session.userAgent,
      // Umur keluarga tidak diperpanjang tanpa batas: kedaluwarsa mengikuti
      // sesi asalnya, bukan dihitung ulang dari sekarang.
      expiresAt: session.expiresAt,
    })
    await repository.revokeSession(session.id, 'rotated', at)
    await repository.replaceSession(session.id, newSessionId, at)

    const memberships = await repository.listMemberships(session.userId)
    const accessToken = await accessTokens.issueAccessToken(
      { userId: user.id, email: user.email, sessionId: newSessionId, memberships },
      at,
    )

    return {
      kind: 'rotated',
      accessToken,
      refreshToken: refresh.token,
      sessionId: newSessionId,
    }
  }

  async logout(input: { refreshToken: string }, context: RequestContext): Promise<boolean> {
    const { repository, tokens, now } = this.deps
    const at = now()

    const session = await repository.findSessionByTokenHash(tokens.hash(input.refreshToken))
    if (session === null || session.revokedAt !== null) return false

    await repository.revokeSession(session.id, 'logout', at)
    await repository.appendAuthEvent({
      userId: session.userId,
      tenantId: null,
      type: 'session.logout',
      ip: context.ip,
      userAgent: context.userAgent,
        requestId: context.requestId ?? null,
      metadata: { sessionId: session.id },
    })
    return true
  }

  async listSessions(userId: string, currentSessionId: string | null): Promise<ActiveSession[]> {
    const { repository, now } = this.deps
    const sessions = await repository.listActiveSessions(userId, now())
    return sessions.map((session: SessionRecord) => ({
      id: session.id,
      device: session.device,
      ip: session.ip,
      userAgent: session.userAgent,
      issuedAt: session.issuedAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      current: session.id === currentSessionId,
    }))
  }

  /**
   * Mencabut satu sesi. Mengembalikan false bila sesi itu bukan milik pengguna —
   * bukan melempar, karena keduanya harus terlihat sama dari luar. Jawaban yang
   * berbeda akan memberi tahu apakah sebuah id sesi ada.
   */
  async revokeSession(
    userId: string,
    sessionId: string,
    context: RequestContext,
  ): Promise<boolean> {
    const { repository, now } = this.deps
    const at = now()

    const sessions = await repository.listActiveSessions(userId, at)
    const target = sessions.find((session) => session.id === sessionId)
    if (target === undefined) return false

    await repository.revokeSession(sessionId, 'revoked_by_user', at)
    await repository.appendAuthEvent({
      userId,
      tenantId: null,
      type: 'session.revoked',
      ip: context.ip,
      userAgent: context.userAgent,
        requestId: context.requestId ?? null,
      metadata: { sessionId },
    })
    return true
  }

  /**
   * Menandai sesi masih hidup. Dipanggil saat refresh, bukan setiap permintaan —
   * satu tulisan per permintaan pada tabel yang dibaca setiap permintaan adalah
   * cara termudah membuat modul ini menjadi hambatan.
   */
  async touch(sessionId: string): Promise<void> {
    await this.deps.repository.touchSession(sessionId, this.deps.now())
  }
}

export { REFRESH_TOKEN_TTL_MS }
