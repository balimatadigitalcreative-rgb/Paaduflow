import type { AppServices, CompanyScopedServices } from '#application/app-services'
import { explainStateRestriction } from '#shared/document-lifecycle'
import { Type } from '@sinclair/typebox'
import type { FastifyReply, FastifyRequest } from 'fastify'

import { requireCompany, requireUser, withIdempotency, type PaaduServer } from '../../app.js'

/**
 * Endpoint Penjualan.
 *
 * Modul ini punya layanan lengkap sejak Sesi D3 dan **tidak punya satu rute pun**
 * sampai sesi ini. Ia lolos seluruh gerbang lewat test yang memanggil layanan
 * langsung — yang berarti gerbang itu tidak pernah menguji apa yang dapat
 * dilakukan seseorang yang memegang token.
 *
 * Dicatat sebagai D-133, bukan ditambal diam-diam.
 */

const JalurCompany = Type.Object({ companyId: Type.String({ format: 'uuid' }) })
const JalurDokumen = Type.Object({
  companyId: Type.String({ format: 'uuid' }),
  id: Type.String({ format: 'uuid' }),
})
const Halaman = Type.Object({
  cursor: Type.Optional(Type.String()),
  per_page: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
})

interface Jawaban {
  status: number
  body: unknown
}

function tolak(status: number, code: string, message: string, extra: object = {}): Jawaban {
  return { status, body: { success: false, message, errors: [{ code, ...extra }] } }
}

export function registerSalesRoutes(app: PaaduServer, services: AppServices): void {
  async function jalankan(
    request: FastifyRequest,
    reply: FastifyReply,
    companyId: string,
    permission: string,
    ask: string,
    fn: (scoped: CompanyScopedServices, ctx: { userId: string; companyId: string }) => Promise<Jawaban>,
    options: { idempotent?: boolean } = {},
  ): Promise<FastifyReply> {
    if (!(await requireUser(request, reply, services))) return reply
    if (!(await requireCompany(request, reply, services, companyId))) return reply

    const user = request.authenticated!
    const company = request.company!

    const kerja = async (): Promise<Jawaban> =>
      services.withCompanyContext(
        { tenantId: company.tenantId, userId: user.userId },
        async (scoped) => {
          const izin = await scoped.authorization.authorize(
            { userId: user.userId, companyId: company.companyId },
            { key: permission, scope: 'company', ask },
          )
          if (!izin.allowed) {
            return {
              status: 403,
              body: { success: false, message: 'Tidak diizinkan.', errors: [izin.denial] },
            }
          }
          return fn(scoped, { userId: user.userId, companyId: company.companyId })
        },
      )

    // Idempotency hanya untuk operasi tulis. Membungkus GET dengannya akan
    // menyimpan jawaban baca sebagai hasil yang diputar ulang.
    if (options.idempotent === false) {
      const hasil = await kerja()
      return reply.status(hasil.status).send(hasil.body)
    }
    return withIdempotency(request, reply, services, kerja)
  }

  // ── Daftar dan detail ────────────────────────────────────────────────────

  app.get(
    '/v1/companies/:companyId/sales-documents',
    { schema: { params: JalurCompany, querystring: Halaman } },
    async (request, reply) =>
      jalankan(
        request,
        reply,
        request.params.companyId,
        'penjualan.faktur.baca',
        'Admin Company',
        async (scoped, ctx) => {
          const hasil = await scoped.sales.queries.list(ctx.companyId, {
            cursor: request.query.cursor ?? null,
            limit: request.query.per_page ?? 50,
          })
          return {
            status: 200,
            body: {
              success: true,
              data: hasil.items,
              meta: { next_cursor: hasil.nextCursor },
            },
          }
        },
        { idempotent: false },
      ),
  )

  app.get(
    '/v1/companies/:companyId/sales-documents/:id',
    { schema: { params: JalurDokumen } },
    async (request, reply) =>
      jalankan(
        request,
        reply,
        request.params.companyId,
        'penjualan.faktur.baca',
        'Admin Company',
        async (scoped, ctx) => {
          const hasil = await scoped.sales.queries.detail(ctx.companyId, request.params.id)
          if (hasil === null) return tolak(404, 'not_found', 'Faktur tidak ditemukan.')
          return { status: 200, body: { success: true, data: hasil } }
        },
        { idempotent: false },
      ),
  )

  // ── Pembuatan ────────────────────────────────────────────────────────────

  app.post(
    '/v1/companies/:companyId/sales-documents',
    {
      schema: {
        params: JalurCompany,
        body: Type.Object({
          customer_id: Type.String({ format: 'uuid' }),
          document_date: Type.String({ format: 'date' }),
          currency: Type.String({ minLength: 3, maxLength: 3 }),
          document_discount_amount: Type.Optional(Type.Number({ minimum: 0 })),
          lines: Type.Array(
            Type.Object({
              item_id: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
              warehouse_id: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
              description: Type.String({ minLength: 1, maxLength: 500 }),
              qty: Type.Number({ minimum: 0 }),
              uom: Type.String({ minLength: 1, maxLength: 20 }),
              unit_price: Type.Number({ minimum: 0 }),
              discount_percent: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
              tax_rate_percent: Type.Number({ minimum: 0, maximum: 100 }),
              tax_code_id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
            }),
            { minItems: 1 },
          ),
        }),
      },
    },
    async (request, reply) =>
      jalankan(
        request,
        reply,
        request.params.companyId,
        'penjualan.faktur.kelola',
        'Admin Company',
        async (scoped, ctx) => {
          const hasil = await scoped.sales.documents.createInvoice({
            companyId: ctx.companyId,
            customerId: request.body.customer_id,
            documentDate: new Date(request.body.document_date),
            currency: request.body.currency,
            ...(request.body.document_discount_amount === undefined
              ? {}
              : { documentDiscountAmount: request.body.document_discount_amount }),
            lines: request.body.lines.map((baris) => ({
              itemId: baris.item_id,
              warehouseId: baris.warehouse_id,
              description: baris.description,
              qty: baris.qty,
              uom: baris.uom,
              unitPrice: baris.unit_price,
              ...(baris.discount_percent === undefined
                ? {}
                : { discountPercent: baris.discount_percent }),
              taxRatePercent: baris.tax_rate_percent,
              taxCodeId: baris.tax_code_id ?? null,
            })),
          })

          return {
            status: 201,
            body: { success: true, data: { id: hasil.documentId, total: hasil.total } },
          }
        },
      ),
  )

  // ── Siklus hidup ─────────────────────────────────────────────────────────

  app.post(
    '/v1/companies/:companyId/sales-documents/:id/submit',
    {
      schema: {
        params: JalurDokumen,
        body: Type.Object({ period_key: Type.String({ maxLength: 20 }) }),
      },
    },
    async (request, reply) =>
      jalankan(
        request,
        reply,
        request.params.companyId,
        'penjualan.faktur.kelola',
        'Admin Company',
        async (scoped, ctx) => {
          // Nomor diberikan di sini, bukan saat draf dibuat — D-007.
          const hasil = await scoped.sales.documents.submit(
            request.params.id,
            ctx.companyId,
            request.body.period_key,
            ctx.userId,
          )

          if (hasil.kind === 'not_found') return tolak(404, 'not_found', 'Faktur tidak ditemukan.')
          if (hasil.kind === 'state_restricted') {
            return tolak(
              409,
              'state_restricted',
              explainStateRestriction('diajukan', hasil.current, hasil.available),
            )
          }
          return { status: 200, body: { success: true, data: { number: hasil.number } } }
        },
      ),
  )

  app.post(
    '/v1/companies/:companyId/sales-documents/:id/approve',
    { schema: { params: JalurDokumen } },
    async (request, reply) =>
      jalankan(
        request,
        reply,
        request.params.companyId,
        'penjualan.faktur.setujui',
        'Admin Company',
        async (scoped, ctx) => {
          const dokumen = await scoped.sales.queries.detail(ctx.companyId, request.params.id)
          if (dokumen === null) return tolak(404, 'not_found', 'Faktur tidak ditemukan.')

          const hasil = await scoped.sales.documents.approve(request.params.id, ctx.userId)

          if (hasil.kind === 'not_found') return tolak(404, 'not_found', 'Faktur tidak ditemukan.')
          if (hasil.kind === 'state_restricted') {
            // 409: keadaannya yang menghalangi, bukan bentuk permintaannya —
            // sama dengan penolakan posting di bawah.
            return tolak(
              409,
              'state_restricted',
              explainStateRestriction('disetujui', hasil.current, hasil.available),
            )
          }
          return { status: 200, body: { success: true } }
        },
      ),
  )

  app.post(
    '/v1/companies/:companyId/sales-documents/:id/post',
    { schema: { params: JalurDokumen } },
    async (request, reply) =>
      jalankan(
        request,
        reply,
        request.params.companyId,
        'penjualan.faktur.posting',
        'Kepala Keuangan',
        async (scoped, ctx) => {
          void ctx
          const hasil = await scoped.sales.posting.post(request.params.id, ctx.userId)

          if (hasil.kind === 'posted') {
            return { status: 200, body: { success: true, data: { journal_id: hasil.journalId } } }
          }
          if (hasil.kind === 'not_found') {
            return tolak(404, 'not_found', 'Faktur tidak ditemukan.')
          }
          if (hasil.kind === 'transition_rejected') {
            // 409: keadaannya yang menghalangi, bukan bentuk permintaannya.
            return tolak(409, 'transition_rejected', hasil.reason)
          }
          if (hasil.kind === 'account_unresolved') {
            // Aturan akun yang tidak ditemukan MENOLAK posting — D-011. Pesannya
            // menyebutkan aturan apa yang kurang, supaya tidak perlu ditebak.
            return tolak(422, 'account_unresolved', hasil.reason)
          }
          return tolak(422, 'ledger_rejected', hasil.reason)
        },
      ),
  )
}
