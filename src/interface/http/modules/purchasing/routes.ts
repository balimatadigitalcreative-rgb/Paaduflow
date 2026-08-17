import type { AppServices } from '#application/app-services'
import { Type } from '@sinclair/typebox'

import { requireCompany, requireUser, withIdempotency, type PaaduServer } from '../../app.js'

/**
 * Endpoint Pembelian.
 *
 * Yang paling penting di berkas ini adalah apa yang TIDAK ada: `POST .../post`
 * tidak menerima badan permintaan apa pun. Tidak ada `force`, tidak ada
 * `skip_match`, tidak ada `allow_exception`. Tagihan yang tidak cocok tidak
 * dapat diposting lewat API ini, bukan karena UI menyembunyikan tombolnya,
 * melainkan karena tidak ada bentuk permintaan yang dapat menyatakannya.
 *
 * Melewati pencocokan adalah endpoint lain, dengan izin lain, dan menuntut
 * alasan tertulis.
 */

const Baris = Type.Object({
  item_id: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  warehouse_id: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  source_line_id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  description: Type.String({ minLength: 1, maxLength: 500 }),
  qty: Type.Number({ minimum: 0 }),
  uom: Type.String({ minLength: 1, maxLength: 20 }),
  unit_price: Type.Number({ minimum: 0 }),
  discount_percent: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
  tax_rate_percent: Type.Number({ minimum: 0, maximum: 100 }),
  tax_code_id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
})

const JalurCompany = Type.Object({ companyId: Type.String({ format: 'uuid' }) })
const Halaman = Type.Object({
  cursor: Type.Optional(Type.String()),
  per_page: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
})
const JalurDokumen = Type.Object({
  companyId: Type.String({ format: 'uuid' }),
  id: Type.String({ format: 'uuid' }),
})

export function registerPurchasingRoutes(app: PaaduServer, services: AppServices): void {

  // ── Jalur baca ───────────────────────────────────────────────────────────
  //
  // Ditambahkan di sesi antarmuka. Modul ini sebelumnya hanya punya POST —
  // cukup untuk test, sama sekali tidak cukup untuk layar (D-133).

  async function baca(
    request: import('fastify').FastifyRequest,
    reply: import('fastify').FastifyReply,
    companyId: string,
    permission: string,
    fn: (
      scoped: import('#application/app-services').CompanyScopedServices,
      companyId: string,
    ) => Promise<{ status: number; body: unknown }>,
  ): Promise<import('fastify').FastifyReply> {
    if (!(await requireUser(request, reply, services))) return reply
    if (!(await requireCompany(request, reply, services, companyId))) return reply

    const user = request.authenticated!
    const company = request.company!

    const hasil = await services.withCompanyContext(
      { tenantId: company.tenantId, userId: user.userId },
      async (scoped) => {
        const izin = await scoped.authorization.authorize(
          { userId: user.userId, companyId: company.companyId },
          { key: permission, scope: 'company', ask: 'Admin Company' },
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

  app.get(
    '/v1/companies/:companyId/purchase-documents',
    {
      schema: {
        params: JalurCompany,
        querystring: Type.Intersect([
          Halaman,
          Type.Object({
            doc_type: Type.Optional(
              Type.Union([
                Type.Literal('rfq'),
                Type.Literal('purchase_order'),
                Type.Literal('bill'),
              ]),
            ),
          }),
        ]),
      },
    },
    async (request, reply) =>
      baca(
        request,
        reply,
        request.params.companyId,
        'pembelian.pesanan.kelola',
        async (scoped, companyId) => {
          const hasil = await scoped.purchasing.queries.list(
            companyId,
            request.query.doc_type ?? null,
            { cursor: request.query.cursor ?? null, limit: request.query.per_page ?? 50 },
          )
          return {
            status: 200,
            body: { success: true, data: hasil.items, meta: { next_cursor: hasil.nextCursor } },
          }
        },
      ),
  )

  app.get(
    '/v1/companies/:companyId/purchase-documents/:id',
    { schema: { params: JalurDokumen } },
    async (request, reply) =>
      baca(
        request,
        reply,
        request.params.companyId,
        'pembelian.pesanan.kelola',
        async (scoped, companyId) => {
          const hasil = await scoped.purchasing.queries.detail(companyId, request.params.id)
          if (hasil === null) {
            return {
              status: 404,
              body: {
                success: false,
                message: 'Dokumen pembelian tidak ditemukan.',
                errors: [{ code: 'not_found' }],
              },
            }
          }
          return { status: 200, body: { success: true, data: hasil } }
        },
      ),
  )

  /**
   * Panel pencocokan tiga arah — dipesan, diterima, dan ditagih berdampingan.
   *
   * Selisihnya dihitung server dengan fungsi yang SAMA dengan yang dipakai
   * posting. Panel yang menghitung sendiri di layar akan suatu hari menampilkan
   * hijau pada tagihan yang ditolak posting, dan orang akan percaya yang hijau.
   */
  app.get(
    '/v1/companies/:companyId/bills/:id/match',
    { schema: { params: JalurDokumen } },
    async (request, reply) =>
      baca(
        request,
        reply,
        request.params.companyId,
        'pembelian.tagihan.posting',
        async (scoped, companyId) => {
          const hasil = await scoped.purchasing.queries.matchPanel(companyId, request.params.id)
          if (hasil === null) {
            return {
              status: 404,
              body: {
                success: false,
                message: 'Tagihan tidak ditemukan.',
                errors: [{ code: 'not_found' }],
              },
            }
          }
          return { status: 200, body: { success: true, data: hasil } }
        },
      ),
  )

  app.get(
    '/v1/companies/:companyId/goods-receipts',
    { schema: { params: JalurCompany, querystring: Halaman } },
    async (request, reply) =>
      baca(
        request,
        reply,
        request.params.companyId,
        'pembelian.penerimaan.catat',
        async (scoped, companyId) => {
          const hasil = await scoped.purchasing.queries.listReceipts(companyId, {
            cursor: request.query.cursor ?? null,
            limit: request.query.per_page ?? 50,
          })
          return {
            status: 200,
            body: { success: true, data: hasil.items, meta: { next_cursor: hasil.nextCursor } },
          }
        },
      ),
  )

  // ── Dokumen: RFQ, pesanan, tagihan ───────────────────────────────────────

  app.post(
    '/v1/companies/:companyId/purchase-documents',
    {
      schema: {
        params: JalurCompany,
        body: Type.Object({
          doc_type: Type.Union([
            Type.Literal('rfq'),
            Type.Literal('purchase_order'),
            Type.Literal('bill'),
          ]),
          vendor_id: Type.String({ format: 'uuid' }),
          issue_date: Type.String({ format: 'date' }),
          currency: Type.String({ minLength: 3, maxLength: 3 }),
          source_document_id: Type.Optional(
            Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
          ),
          document_discount_amount: Type.Optional(Type.Number({ minimum: 0 })),
          lines: Type.Array(Baris, { minItems: 1 }),
        }),
      },
    },
    async (request, reply) => {
      if (!(await requireUser(request, reply, services))) return reply
      if (!(await requireCompany(request, reply, services, request.params.companyId))) return reply

      const user = request.authenticated!
      const company = request.company!
      const body = request.body

      return withIdempotency(request, reply, services, async () =>
        services.withCompanyContext(
          { tenantId: company.tenantId, userId: user.userId },
          async (scoped) => {
            const izin = await scoped.authorization.authorize(
              { userId: user.userId, companyId: company.companyId },
              { key: 'pembelian.pesanan.kelola', scope: 'company', ask: 'Admin Company' },
            )
            if (!izin.allowed) {
              return { status: 403, body: { success: false, message: 'Tidak diizinkan.', errors: [izin.denial] } }
            }

            const hasil = await scoped.purchasing.documents.create({
              companyId: company.companyId,
              docType: body.doc_type,
              vendorId: body.vendor_id,
              issueDate: new Date(body.issue_date),
              currency: body.currency,
              sourceDocumentId: body.source_document_id ?? null,
              ...(body.document_discount_amount === undefined
                ? {}
                : { documentDiscountAmount: body.document_discount_amount }),
              createdBy: user.userId,
              lines: body.lines.map((baris) => ({
                itemId: baris.item_id,
                warehouseId: baris.warehouse_id,
                sourceLineId: baris.source_line_id ?? null,
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

            if (hasil.kind === 'created') {
              return {
                status: 201,
                body: { success: true, data: { id: hasil.documentId, total: hasil.total } },
              }
            }

            const pesan: Record<string, string> = {
              source_required: 'Tagihan barang harus menunjuk pesanan pembelian.',
              source_not_found: 'Pesanan pembelian tidak ditemukan.',
              unknown_line: 'Ada baris yang tidak dikenal di pesanan sumber.',
              exceeds_remaining: 'Ada baris yang melebihi sisa pesanan.',
            }
            return {
              status: 422,
              body: {
                success: false,
                message: pesan[hasil.kind] ?? 'Dokumen tidak dapat dibuat.',
                errors: [{ code: hasil.kind, ...hasil }],
              },
            }
          },
        ),
      )
    },
  )

  app.post(
    '/v1/companies/:companyId/purchase-documents/:id/submit',
    {
      schema: {
        params: JalurDokumen,
        body: Type.Object({
          doc_type: Type.Union([
            Type.Literal('rfq'),
            Type.Literal('purchase_order'),
            Type.Literal('bill'),
          ]),
          period_key: Type.String({ maxLength: 20 }),
        }),
      },
    },
    async (request, reply) => {
      if (!(await requireUser(request, reply, services))) return reply
      if (!(await requireCompany(request, reply, services, request.params.companyId))) return reply

      const user = request.authenticated!
      const company = request.company!

      return withIdempotency(request, reply, services, async () =>
        services.withCompanyContext(
          { tenantId: company.tenantId, userId: user.userId },
          async (scoped) => {
            const izin = await scoped.authorization.authorize(
              { userId: user.userId, companyId: company.companyId },
              { key: 'pembelian.pesanan.kelola', scope: 'company', ask: 'Admin Company' },
            )
            if (!izin.allowed) {
              return { status: 403, body: { success: false, message: 'Tidak diizinkan.', errors: [izin.denial] } }
            }

            const nomor = await scoped.purchasing.documents.submit(
              request.params.id,
              company.companyId,
              request.body.doc_type,
              request.body.period_key,
              user.userId,
            )
            return { status: 200, body: { success: true, data: { number: nomor } } }
          },
        ),
      )
    },
  )

  app.post(
    '/v1/companies/:companyId/purchase-documents/:id/approve',
    { schema: { params: JalurDokumen } },
    async (request, reply) => {
      if (!(await requireUser(request, reply, services))) return reply
      if (!(await requireCompany(request, reply, services, request.params.companyId))) return reply

      const user = request.authenticated!
      const company = request.company!

      return withIdempotency(request, reply, services, async () =>
        services.withCompanyContext(
          { tenantId: company.tenantId, userId: user.userId },
          async (scoped) => {
            const izin = await scoped.authorization.authorize(
              { userId: user.userId, companyId: company.companyId },
              { key: 'pembelian.pesanan.kelola', scope: 'company', ask: 'Admin Company' },
            )
            if (!izin.allowed) {
              return { status: 403, body: { success: false, message: 'Tidak diizinkan.', errors: [izin.denial] } }
            }
            await scoped.purchasing.documents.approve(request.params.id, user.userId)
            return { status: 200, body: { success: true } }
          },
        ),
      )
    },
  )

  // ── Penerimaan barang ────────────────────────────────────────────────────

  app.post(
    '/v1/companies/:companyId/goods-receipts',
    {
      schema: {
        params: JalurCompany,
        body: Type.Object({
          purchase_order_id: Type.String({ format: 'uuid' }),
          warehouse_id: Type.String({ format: 'uuid' }),
          received_date: Type.String({ format: 'date' }),
          lines: Type.Array(
            Type.Object({
              po_line_id: Type.String({ format: 'uuid' }),
              qty_received: Type.Number({ minimum: 0 }),
              qty_rejected: Type.Optional(Type.Number({ minimum: 0 })),
              rejection_reason: Type.Optional(Type.String({ maxLength: 500 })),
            }),
            { minItems: 1 },
          ),
        }),
      },
    },
    async (request, reply) => {
      if (!(await requireUser(request, reply, services))) return reply
      if (!(await requireCompany(request, reply, services, request.params.companyId))) return reply

      const user = request.authenticated!
      const company = request.company!
      const body = request.body

      return withIdempotency(request, reply, services, async () =>
        services.withCompanyContext(
          { tenantId: company.tenantId, userId: user.userId },
          async (scoped) => {
            const izin = await scoped.authorization.authorize(
              { userId: user.userId, companyId: company.companyId },
              { key: 'pembelian.penerimaan.catat', scope: 'company', ask: 'Kepala Gudang' },
            )
            if (!izin.allowed) {
              return { status: 403, body: { success: false, message: 'Tidak diizinkan.', errors: [izin.denial] } }
            }

            const hasil = await scoped.purchasing.receipts.post(
              {
                companyId: company.companyId,
                purchaseOrderId: body.purchase_order_id,
                warehouseId: body.warehouse_id,
                receivedDate: new Date(body.received_date),
                lines: body.lines.map((baris) => ({
                  poLineId: baris.po_line_id,
                  qtyReceived: baris.qty_received,
                  ...(baris.qty_rejected === undefined ? {} : { qtyRejected: baris.qty_rejected }),
                  ...(baris.rejection_reason === undefined
                    ? {}
                    : { rejectionReason: baris.rejection_reason }),
                })),
              },
              user.userId,
            )

            if (hasil.kind === 'posted') {
              return {
                status: 201,
                body: {
                  success: true,
                  data: { id: hasil.receiptId, journal_id: hasil.journalId },
                },
              }
            }

            return {
              status: 422,
              body: {
                success: false,
                message: 'Penerimaan tidak dapat dicatat.',
                errors: [{ code: hasil.kind, ...hasil }],
              },
            }
          },
        ),
      )
    },
  )

  // ── Posting tagihan ──────────────────────────────────────────────────────
  //
  // Tanpa badan permintaan. Sengaja.

  app.post(
    '/v1/companies/:companyId/bills/:id/post',
    { schema: { params: JalurDokumen } },
    async (request, reply) => {
      if (!(await requireUser(request, reply, services))) return reply
      if (!(await requireCompany(request, reply, services, request.params.companyId))) return reply

      const user = request.authenticated!
      const company = request.company!

      return withIdempotency(request, reply, services, async () =>
        services.withCompanyContext(
          { tenantId: company.tenantId, userId: user.userId },
          async (scoped) => {
            const izin = await scoped.authorization.authorize(
              { userId: user.userId, companyId: company.companyId },
              { key: 'pembelian.tagihan.posting', scope: 'company', ask: 'Kepala Keuangan' },
            )
            if (!izin.allowed) {
              return { status: 403, body: { success: false, message: 'Tidak diizinkan.', errors: [izin.denial] } }
            }

            const hasil = await scoped.purchasing.bills.post(request.params.id, user.userId)

            if (hasil.kind === 'posted') {
              return { status: 200, body: { success: true, data: { journal_id: hasil.journalId } } }
            }
            if (hasil.kind === 'not_found') {
              return {
                status: 404,
                body: {
                  success: false,
                  message: 'Tagihan tidak ditemukan.',
                  errors: [{ code: 'not_found' }],
                },
              }
            }
            if (hasil.kind === 'match_failed') {
              // 409, bukan 422: keadaannya yang menghalangi, bukan bentuk
              // permintaannya. Tidak ada isian yang dapat diperbaiki klien.
              return {
                status: 409,
                body: {
                  success: false,
                  message: 'Tagihan tidak lolos pencocokan tiga arah.',
                  errors: hasil.variances.map((selisih, index) => ({
                    code: `match.${selisih.kind}`,
                    line_no: selisih.lineNo,
                    expected: selisih.expected,
                    actual: selisih.actual,
                    difference: selisih.difference,
                    message: hasil.reasons[index],
                  })),
                },
              }
            }
            if (hasil.kind === 'separation_of_duties') {
              return {
                status: 409,
                body: {
                  success: false,
                  message: hasil.reason,
                  errors: [{ code: 'separation_of_duties' }],
                },
              }
            }

            return {
              status: 422,
              body: {
                success: false,
                message: 'Tagihan tidak dapat diposting.',
                errors: [{ code: hasil.kind, ...hasil }],
              },
            }
          },
        ),
      )
    },
  )

  // ── Satu-satunya jalan melewati pencocokan ───────────────────────────────

  app.post(
    '/v1/companies/:companyId/bills/:id/override-match',
    {
      schema: {
        params: JalurDokumen,
        body: Type.Object({
          // Wajib, dan cukup panjang untuk memuat kalimat. Alasan yang dapat
          // diisi "ok" bukan alasan.
          reason: Type.String({ minLength: 20, maxLength: 1000 }),
        }),
      },
    },
    async (request, reply) => {
      if (!(await requireUser(request, reply, services))) return reply
      if (!(await requireCompany(request, reply, services, request.params.companyId))) return reply

      const user = request.authenticated!
      const company = request.company!

      return withIdempotency(request, reply, services, async () =>
        services.withCompanyContext(
          { tenantId: company.tenantId, userId: user.userId },
          async (scoped) => {
            // Izin yang berbeda dari izin posting. Seseorang yang boleh
            // memposting tagihan tidak otomatis boleh memaafkan selisihnya.
            const izin = await scoped.authorization.authorize(
              { userId: user.userId, companyId: company.companyId },
              { key: 'pembelian.pencocokan.override', scope: 'company', ask: 'Admin Company' },
            )
            if (!izin.allowed) {
              return { status: 403, body: { success: false, message: 'Tidak diizinkan.', errors: [izin.denial] } }
            }

            const hasil = await scoped.purchasing.override.override(
              request.params.id,
              user.userId,
              request.body.reason,
            )

            if (hasil.kind === 'overridden') return { status: 200, body: { success: true } }
            if (hasil.kind === 'not_found') {
              return {
                status: 404,
                body: {
                  success: false,
                  message: 'Tagihan tidak ditemukan.',
                  errors: [{ code: 'not_found' }],
                },
              }
            }
            if (hasil.kind === 'separation_of_duties') {
              return {
                status: 409,
                body: {
                  success: false,
                  message: hasil.reason,
                  errors: [{ code: 'separation_of_duties' }],
                },
              }
            }
            if (hasil.kind === 'not_overridable') {
              return {
                status: 409,
                body: {
                  success: false,
                  message:
                    'Menagih barang yang belum diterima tidak dapat disetujui siapa pun. Catat penerimaannya atau perbaiki tagihannya.',
                  errors: hasil.reasons.map((pesan) => ({
                    code: 'match.billed_over_received',
                    message: pesan,
                  })),
                },
              }
            }

            return {
              status: 422,
              body: {
                success: false,
                message: 'Pengecualian tidak dapat disetujui.',
                errors: [{ code: hasil.kind }],
              },
            }
          },
        ),
      )
    },
  )
}
