import type { AuthorizationDenial } from '#application/identity/authorization'
import { toErrorEnvelope } from '#application/identity/authorization'
import type { FastifyReply, FastifyRequest } from 'fastify'

/**
 * Konteks permintaan dan penerjemahan penolakan menjadi jawaban HTTP.
 */

export interface AuthenticatedUser {
  readonly userId: string
  readonly email: string
  readonly sessionId: string
}

export interface CompanyContext {
  readonly tenantId: string
  readonly companyId: string
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Terisi setelah `requireUser`. */
    authenticated: AuthenticatedUser | null
    /**
     * Terisi setelah `requireCompany`. Konteks company datang dari path URL,
     * bukan dari token — D-002.
     */
    company: CompanyContext | null
  }
}

/**
 * Setiap sebab punya status HTTP-nya sendiri.
 *
 * Kodenya tetap ada di badan jawaban — status hanya membantu klien yang
 * memutuskan sebelum membaca badan. `402` dipilih untuk `plan_restricted`
 * karena ia satu-satunya sebab yang jalan keluarnya adalah membayar.
 */
const STATUS: Record<AuthorizationDenial['code'], number> = {
  permission_denied: 403,
  plan_restricted: 402,
  state_restricted: 409,
}

export function sendDenial(reply: FastifyReply, denial: AuthorizationDenial): FastifyReply {
  return reply.status(STATUS[denial.code]).send(toErrorEnvelope(denial))
}

export function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): FastifyReply {
  return reply.status(status).send({
    success: false,
    message,
    errors: [{ code, ...extra }],
  })
}

export function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization
  if (typeof header !== 'string') return null
  const [skema, token] = header.split(' ')
  if (skema?.toLowerCase() !== 'bearer' || token === undefined || token === '') return null
  return token
}
