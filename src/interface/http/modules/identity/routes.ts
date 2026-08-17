import type { AppServices } from '#application/app-services'
import { Type } from '@sinclair/typebox'

import { requireCompany, requireUser, withIdempotency, type PaaduServer } from '../../app.js'
import { sendDenial, sendError } from '../../context.js'

/**
 * Endpoint autentikasi, sesi, dan akses company.
 *
 * Yang perlu diperhatikan saat membaca: seluruh jalur gagal menjawab dengan
 * bentuk yang sama, dan tidak satu pun membedakan "tidak ada" dari "tidak
 * boleh". Perbedaan itulah yang biasanya dipakai memetakan sistem sebelum
 * menyerangnya.
 */

const KonteksPermintaan = Type.Object({
  email: Type.String({ format: 'email', maxLength: 320 }),
  password: Type.String({ minLength: 1, maxLength: 1024 }),
})

export function registerIdentityRoutes(app: PaaduServer, services: AppServices): void {
  const konteks = (request: { ip: string; id: string; headers: Record<string, unknown> }) => ({
    ip: request.ip,
    userAgent: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : null,
    device: null,
    // Id permintaan ikut turun sampai ke audit trail, sehingga satu insiden
    // dapat ditelusuri dari log ke jejak ke catatan audit — Resilience §7.
    requestId: request.id,
  })

  app.post(
    '/v1/auth/register',
    {
      schema: {
        body: Type.Intersect([
          KonteksPermintaan,
          Type.Object({ full_name: Type.String({ minLength: 1, maxLength: 200 }) }),
        ]),
        response: { 202: Type.Object({ success: Type.Literal(true), message: Type.String() }) },
      },
    },
    async (request, reply) => {
      const hasil = await services.authentication.register(
        {
          email: request.body.email,
          password: request.body.password,
          fullName: request.body.full_name,
        },
        konteks(request),
      )

      if (hasil.kind === 'password_rejected') {
        return sendError(reply, 422, 'password_rejected', 'Kata sandi tidak memenuhi syarat.', {
          reason: hasil.reason,
        })
      }

      // 202, bukan 201. Kami tidak mengatakan apakah pengguna dibuat — dan itu
      // memang yang membuat email terdaftar tidak dapat dideteksi dari luar.
      return reply.status(202).send({
        success: true,
        message: 'Bila email tersebut dapat didaftarkan, tautan verifikasi sudah dikirim.',
      })
    },
  )

  app.post(
    '/v1/auth/login',
    { schema: { body: KonteksPermintaan } },
    async (request, reply) => {
      const hasil = await services.authentication.login(
        { email: request.body.email, password: request.body.password },
        konteks(request),
      )

      if (hasil.kind === 'invalid_credentials') {
        return sendError(reply, 401, 'invalid_credentials', 'Email atau kata sandi salah.')
      }
      if (hasil.kind === 'mfa_required') {
        return reply
          .status(200)
          .send({ success: true, data: { mfa_required: true, challenge_token: hasil.challengeToken } })
      }
      return reply.status(200).send({
        success: true,
        data: {
          access_token: hasil.accessToken,
          refresh_token: hasil.refreshToken,
          session_id: hasil.sessionId,
        },
      })
    },
  )

  app.post(
    '/v1/auth/mfa/verify',
    {
      schema: {
        body: Type.Object({
          challenge_token: Type.String({ minLength: 1 }),
          code: Type.String({ minLength: 1, maxLength: 64 }),
        }),
      },
    },
    async (request, reply) => {
      const hasil = await services.authentication.verifyMfa(
        { challengeToken: request.body.challenge_token, code: request.body.code },
        konteks(request),
      )
      if (hasil.kind !== 'authenticated') {
        return sendError(reply, 401, 'invalid_credentials', 'Kode tidak berlaku.')
      }
      return reply.status(200).send({
        success: true,
        data: {
          access_token: hasil.accessToken,
          refresh_token: hasil.refreshToken,
          session_id: hasil.sessionId,
        },
      })
    },
  )

  app.post(
    '/v1/auth/refresh',
    { schema: { body: Type.Object({ refresh_token: Type.String({ minLength: 1 }) }) } },
    async (request, reply) => {
      const hasil = await services.sessions.refresh(
        { refreshToken: request.body.refresh_token },
        konteks(request),
      )

      if (hasil.kind === 'rotated') {
        return reply.status(200).send({
          success: true,
          data: {
            access_token: hasil.accessToken,
            refresh_token: hasil.refreshToken,
            session_id: hasil.sessionId,
          },
        })
      }

      // Penggunaan ulang, kedaluwarsa, dan token asing menjawab sama. Yang
      // berbeda hanya apa yang terjadi di balik layar: penggunaan ulang
      // mencabut seluruh keluarga sesi.
      return sendError(reply, 401, 'invalid_refresh_token', 'Sesi tidak berlaku.')
    },
  )

  app.post(
    '/v1/auth/logout',
    { schema: { body: Type.Object({ refresh_token: Type.String({ minLength: 1 }) }) } },
    async (request, reply) => {
      await services.sessions.logout({ refreshToken: request.body.refresh_token }, konteks(request))
      return reply.status(204).send()
    },
  )

  app.get('/v1/me/sessions', async (request, reply) => {
    if (!(await requireUser(request, reply, services))) return reply
    const user = request.authenticated!

    const sesi = await services.sessions.listSessions(user.userId, user.sessionId)
    return reply.status(200).send({
      success: true,
      data: sesi.map((item) => ({
        id: item.id,
        device: item.device,
        ip: item.ip,
        last_seen_at: item.lastSeenAt.toISOString(),
        expires_at: item.expiresAt.toISOString(),
        current: item.current,
      })),
    })
  })

  app.delete(
    '/v1/me/sessions/:sessionId',
    { schema: { params: Type.Object({ sessionId: Type.String({ format: 'uuid' }) }) } },
    async (request, reply) => {
      if (!(await requireUser(request, reply, services))) return reply
      const user = request.authenticated!

      const dicabut = await services.sessions.revokeSession(
        user.userId,
        request.params.sessionId,
        konteks(request),
      )

      // Sesi milik orang lain dan sesi yang tidak ada menjawab sama.
      if (!dicabut) return sendError(reply, 404, 'not_found', 'Sesi tidak ditemukan.')
      return reply.status(204).send()
    },
  )

  /**
   * Company yang dapat diakses pengguna — pintu masuk seluruh antarmuka.
   *
   * Konteks company diambil dari path URL (D-002), yang berarti layar harus
   * tahu id-nya sebelum dapat meminta apa pun. Sampai sesi antarmuka, tidak ada
   * satu pun cara memperolehnya: `GET /v1/companies/:id/access` sudah menuntut
   * id yang dicari. Lihat D-133.
   */
  app.get(
    '/v1/me/companies',
    {
      schema: {
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Array(
              Type.Object({
                id: Type.String(),
                tenant_id: Type.String(),
                tenant_name: Type.String(),
                legal_name: Type.String(),
                slug: Type.String(),
                fiscal_year_start_month: Type.Integer(),
                role: Type.String(),
              }),
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      if (!(await requireUser(request, reply, services))) return reply

      const daftar = await services.listCompaniesForUser(request.authenticated!.userId)

      return reply.status(200).send({
        success: true,
        data: daftar.map((company) => ({
          id: company.id,
          tenant_id: company.tenantId,
          tenant_name: company.tenantName,
          legal_name: company.legalName,
          slug: company.slug,
          fiscal_year_start_month: company.fiscalYearStartMonth,
          role: company.roleKey,
        })),
      })
    },
  )

  app.get(
    '/v1/companies/:companyId/access',
    {
      schema: {
        params: Type.Object({ companyId: Type.String({ format: 'uuid' }) }),
        // Kosakata baku: kursor, bukan nomor halaman — D-041.
        querystring: Type.Object({
          cursor: Type.Optional(Type.String()),
          per_page: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
        }),
      },
    },
    async (request, reply) => {
      if (!(await requireUser(request, reply, services))) return reply
      if (!(await requireCompany(request, reply, services, request.params.companyId))) return reply

      const user = request.authenticated!
      const company = request.company!

      const hasil = await services.withCompanyContext(
        { tenantId: company.tenantId, userId: user.userId },
        async (scoped) =>
          scoped.companyAccess.list(
            { userId: user.userId, companyId: company.companyId },
            { cursor: request.query.cursor ?? null, limit: request.query.per_page ?? 50 },
          ),
      )

      if ('denied' in hasil) return sendDenial(reply, hasil.denied)

      return reply.status(200).send({
        success: true,
        data: hasil.items.map((item) => ({
          id: item.id,
          user_id: item.userId,
          email: item.email,
          full_name: item.fullName,
          role: item.roleKey,
          granted_at: item.grantedAt.toISOString(),
        })),
        meta: {
          total: hasil.total,
          per_page: request.query.per_page ?? 50,
          next_cursor: hasil.nextCursor,
        },
      })
    },
  )

  app.post(
    '/v1/companies/:companyId/access',
    {
      schema: {
        params: Type.Object({ companyId: Type.String({ format: 'uuid' }) }),
        body: Type.Object({
          user_id: Type.String({ format: 'uuid' }),
          role: Type.String({ minLength: 1, maxLength: 64 }),
        }),
      },
    },
    async (request, reply) => {
      if (!(await requireUser(request, reply, services))) return reply
      if (!(await requireCompany(request, reply, services, request.params.companyId))) return reply

      const user = request.authenticated!
      const company = request.company!

      return withIdempotency(request, reply, services, async () => {
        const hasil = await services.withCompanyContext(
          { tenantId: company.tenantId, userId: user.userId },
          async (scoped) =>
            scoped.companyAccess.grant(
              { userId: user.userId, companyId: company.companyId },
              { userId: request.body.user_id, roleKey: request.body.role },
            ),
        )

        switch (hasil.kind) {
          case 'granted':
            return { status: 201, body: { success: true, data: { id: hasil.id } } }
          case 'already_exists':
            return {
              status: 200,
              body: { success: true, message: 'Akses sudah ada sebelumnya.' },
            }
          case 'unknown_role':
            return {
              status: 422,
              body: {
                success: false,
                message: 'Peran tidak dikenal.',
                errors: [{ code: 'unknown_role', role: request.body.role }],
              },
            }
          case 'role_above_granter':
            return {
              status: 403,
              body: {
                success: false,
                message: 'Anda tidak dapat memberikan peran di atas peran Anda sendiri.',
                errors: [{ code: 'permission_denied', required: 'identitas.pengguna.kelola:company' }],
              },
            }
          case 'denied':
            return {
              status: hasil.denial.code === 'plan_restricted' ? 402 : 403,
              body: {
                success: false,
                message: 'Anda tidak memiliki akses ke bagian ini.',
                errors: [hasil.denial],
              },
            }
        }
      })
    },
  )
}
