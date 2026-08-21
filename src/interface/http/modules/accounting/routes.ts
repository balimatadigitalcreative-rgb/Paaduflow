import type { AppServices, CompanyScopedServices } from '#application/app-services'
import { Type } from '@sinclair/typebox'
import type { FastifyReply, FastifyRequest } from 'fastify'

import { requireCompany, requireUser, type PaaduServer } from '../../app.js'

/**
 * Endpoint Akuntansi — baca saja.
 *
 * Penjurnalan tidak punya rute, dan itu disengaja untuk sekarang: seluruh
 * jurnal lahir dari posting dokumen. Jurnal manual lewat API akan menjadi pintu
 * kedua ke buku besar sebelum ada yang menjaga pintu pertama.
 */

const JalurCompany = Type.Object({ companyId: Type.String({ format: 'uuid' }) })

interface Jawaban {
  status: number
  body: unknown
}

export function registerAccountingRoutes(app: PaaduServer, services: AppServices): void {
  async function baca(
    request: FastifyRequest,
    reply: FastifyReply,
    companyId: string,
    permission: string,
    fn: (scoped: CompanyScopedServices, companyId: string) => Promise<Jawaban>,
  ): Promise<FastifyReply> {
    if (!(await requireUser(request, reply, services))) return reply
    if (!(await requireCompany(request, reply, services, companyId))) return reply

    const user = request.authenticated!
    const company = request.company!

    const hasil = await services.withCompanyContext(
      { tenantId: company.tenantId, userId: user.userId },
      async (scoped) => {
        const izin = await scoped.authorization.authorize(
          { userId: user.userId, companyId: company.companyId },
          { key: permission, scope: 'company', ask: 'Akuntan' },
        )
        if (!izin.allowed) {
          return {
            status: 403,
            body: { success: false, message: 'Tidak diizinkan.', errors: [izin.denial] },
          }
        }
        return fn(scoped, company.companyId)
      },
    )

    return reply.status(hasil.status).send(hasil.body)
  }

  /**
   * Dasbor - Screen_Specs_HiFi section 3.
   *
   * Izin yang dituntut sama dengan bagan akun. Itu disengaja: dasbor
   * menampilkan angka pendapatan dan piutang agregat, dan siapa pun yang boleh
   * melihat angka itu di sini boleh melihatnya di buku besar. Izin yang lebih
   * longgar di dasbor akan menjadi pintu belakang ke laporan keuangan.
   *
   * `today` datang dari server, bukan dari klien. Tanggal yang dikirim browser
   * dapat diatur, dan "piutang jatuh tempo" yang dihitung dari tanggal palsu
   * adalah angka yang salah tanpa jejak.
   */
  /**
   * Laba rugi — Flow_Archetypes 6.
   *
   * Periode dan pembandingnya adalah PARAMETER, bukan dua laporan terpisah.
   * Memisahkannya menjadi dua endpoint akan menggandakan laporan setiap kali
   * ada cara membandingkan yang baru, dan tidak satu pun dari keduanya dapat
   * menjamin kedua angkanya dibaca dari keadaan basis data yang sama.
   */
  app.get(
    '/v1/companies/:companyId/reports/profit-loss',
    {
      schema: {
        params: JalurCompany,
        querystring: Type.Object({
          from: Type.String({ format: 'date' }),
          to: Type.String({ format: 'date' }),
          compare_from: Type.Optional(Type.String({ format: 'date' })),
          compare_to: Type.Optional(Type.String({ format: 'date' })),
        }),
      },
    },
    async (request, reply) =>
      baca(
        request,
        reply,
        request.params.companyId,
        'akuntansi.bagan.baca',
        async (scoped, companyId) => {
          const { from, to, compare_from: dariBanding, compare_to: sampaiBanding } =
            request.query

          // Pembanding hanya dipakai bila KEDUA ujungnya disebut. Satu ujung
          // saja adalah permintaan yang tidak lengkap, dan menebak ujung yang
          // lain menghasilkan rentang yang tidak diminta siapa pun.
          const banding =
            dariBanding !== undefined && sampaiBanding !== undefined
              ? { from: dariBanding, to: sampaiBanding }
              : null

          return {
            status: 200,
            body: {
              success: true,
              data: await scoped.profitLoss.report(companyId, { from, to }, banding),
            },
          }
        },
      ),
  )

  app.get(
    '/v1/companies/:companyId/dashboard',
    { schema: { params: JalurCompany } },
    async (request, reply) =>
      baca(
        request,
        reply,
        request.params.companyId,
        'akuntansi.bagan.baca',
        async (scoped, companyId) => ({
          status: 200,
          body: {
            success: true,
            data: await scoped.dashboard.summary(
              companyId,
              new Date().toISOString().slice(0, 10),
            ),
          },
        }),
      ),
  )

  app.get(
    '/v1/companies/:companyId/accounts',
    { schema: { params: JalurCompany } },
    async (request, reply) =>
      baca(
        request,
        reply,
        request.params.companyId,
        'akuntansi.bagan.baca',
        async (scoped, companyId) => ({
          status: 200,
          body: {
            success: true,
            data: await scoped.accounting.queries.chartOfAccounts(companyId),
          },
        }),
      ),
  )

  app.get(
    '/v1/companies/:companyId/general-ledger',
    {
      schema: {
        params: JalurCompany,
        querystring: Type.Object({
          account_id: Type.Optional(Type.String({ format: 'uuid' })),
          cursor: Type.Optional(Type.String()),
          per_page: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
        }),
      },
    },
    async (request, reply) =>
      baca(
        request,
        reply,
        request.params.companyId,
        'akuntansi.buku.baca',
        async (scoped, companyId) => {
          const hasil = await scoped.accounting.queries.generalLedger(
            companyId,
            request.query.account_id ?? null,
            { cursor: request.query.cursor ?? null, limit: request.query.per_page ?? 100 },
          )
          return {
            status: 200,
            body: { success: true, data: hasil.items, meta: { next_cursor: hasil.nextCursor } },
          }
        },
      ),
  )
}
