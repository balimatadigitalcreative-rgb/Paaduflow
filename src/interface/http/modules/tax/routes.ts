import type { AppServices, CompanyScopedServices } from '#application/app-services'
import { Type } from '@sinclair/typebox'
import type { FastifyReply, FastifyRequest } from 'fastify'

import { requireCompany, requireUser, withIdempotency, type PaaduServer } from '../../app.js'

/**
 * Endpoint Pajak.
 *
 * Dua hal yang tidak ada di berkas ini, dan ketiadaannya disengaja:
 *
 * 1. **Tidak ada `PATCH /tax-codes/:id`.** Tarif tidak dapat diubah; ia
 *    ditutup dan digantikan versi baru. Rute yang tidak ada tidak dapat
 *    dipanggil, dan basis data menolaknya lagi lewat `t40_rate_immutable`.
 * 2. **`/tax/calculate` tidak menerima parameter tarif.** Ia menerima tanggal
 *    dokumen. Modul lain tidak pernah menyebut angka tarif.
 */

const JalurCompany = Type.Object({ companyId: Type.String({ format: 'uuid' }) })
const JalurDokumen = Type.Object({
  companyId: Type.String({ format: 'uuid' }),
  id: Type.String({ format: 'uuid' }),
})
const Tanggal = Type.String({ format: 'date' })
const Masa = Type.String({ pattern: '^\\d{4}-\\d{2}$' })

const KonteksPenentuan = Type.Object({
  transaction_type: Type.String({ minLength: 1, maxLength: 100 }),
  item_category_id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  partner_type: Type.Optional(Type.Union([Type.String({ maxLength: 50 }), Type.Null()])),
  partner_is_pkp: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
  region_code: Type.Optional(Type.Union([Type.String({ maxLength: 20 }), Type.Null()])),
})

type KonteksBadan = {
  transaction_type: string
  item_category_id?: string | null
  partner_type?: string | null
  partner_is_pkp?: boolean | null
  region_code?: string | null
}

function keKonteks(badan: KonteksBadan) {
  return {
    transactionType: badan.transaction_type,
    itemCategoryId: badan.item_category_id ?? null,
    partnerType: badan.partner_type ?? null,
    partnerIsPkp: badan.partner_is_pkp ?? null,
    regionCode: badan.region_code ?? null,
  }
}

interface Jawaban {
  status: number
  body: unknown
}

function tolak(status: number, code: string, message: string, extra: object = {}): Jawaban {
  return { status, body: { success: false, message, errors: [{ code, ...extra }] } }
}

export function registerTaxRoutes(app: PaaduServer, services: AppServices): void {
  /**
   * Kerangka yang sama untuk seluruh rute: autentikasi, konteks company dari
   * PATH (bukan dari token — D-002), lalu izin, lalu pekerjaannya.
   */
  async function jalankan(
    request: FastifyRequest,
    reply: FastifyReply,
    companyId: string,
    permission: string,
    ask: string,
    fn: (scoped: CompanyScopedServices, ctx: { userId: string; companyId: string }) => Promise<Jawaban>,
  ): Promise<FastifyReply> {
    if (!(await requireUser(request, reply, services))) return reply
    if (!(await requireCompany(request, reply, services, companyId))) return reply

    const user = request.authenticated!
    const company = request.company!

    return withIdempotency(request, reply, services, async () =>
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
      ),
    )
  }

  // ── Profil pajak ─────────────────────────────────────────────────────────

  app.get(
    '/v1/companies/:companyId/tax-profile',
    { schema: { params: JalurCompany } },
    async (request, reply) =>
      jalankan(
        request,
        reply,
        request.params.companyId,
        'pajak.laporan.baca',
        'Akuntan Pajak',
        async (scoped, ctx) => {
          const profil = await scoped.tax.repository.loadProfile(ctx.companyId)
          if (profil === null) {
            return tolak(404, 'not_found', 'Profil pajak company ini belum diisi.')
          }
          return {
            status: 200,
            body: {
              success: true,
              data: {
                npwp: profil.npwp,
                is_pkp: profil.isPkp,
                pkp_effective_date: profil.pkpEffectiveDate,
                nppkp: profil.nppkp,
              },
            },
          }
        },
      ),
  )

  // ── Kode pajak: versi baru, tidak pernah pengubahan ──────────────────────

  app.post(
    '/v1/companies/:companyId/tax-codes',
    {
      schema: {
        params: JalurCompany,
        body: Type.Object({
          code: Type.String({ pattern: '^[A-Z][A-Z0-9\\-]*$', maxLength: 30 }),
          name: Type.String({ minLength: 1, maxLength: 120 }),
          tax_type: Type.Union([
            Type.Literal('vat_out'),
            Type.Literal('vat_in'),
            Type.Literal('withholding'),
            Type.Literal('exempt'),
            Type.Literal('not_collected'),
          ]),
          // Tanpa nilai bawaan. Tarif adalah keputusan konsultan pajak, dan
          // nilai bawaan adalah keputusan yang tidak pernah diambil siapa pun.
          rate: Type.Number({ minimum: 0, maximum: 100 }),
          valid_from: Tanggal,
          calculation_base: Type.Union([Type.Literal('net'), Type.Literal('gross')]),
          gl_account_id: Type.String({ format: 'uuid' }),
          is_creditable: Type.Boolean(),
        }),
      },
    },
    async (request, reply) =>
      jalankan(
        request,
        reply,
        request.params.companyId,
        // Hanya tingkat tenant — Module 08 §10. Company Admin tidak memilikinya.
        'pajak.kode.kelola',
        'Admin Tenant',
        async (scoped, ctx) => {
          const hasil = await scoped.tax.codes.addVersion({
            companyId: ctx.companyId,
            code: request.body.code,
            name: request.body.name,
            taxType: request.body.tax_type,
            rate: request.body.rate,
            validFrom: request.body.valid_from,
            calculationBase: request.body.calculation_base,
            glAccountId: request.body.gl_account_id,
            isCreditable: request.body.is_creditable,
            createdBy: ctx.userId,
          })

          if (hasil.kind === 'created') {
            return {
              status: 201,
              body: {
                success: true,
                data: { id: hasil.id, superseded_id: hasil.supersededId },
              },
            }
          }
          if (hasil.kind === 'not_after_previous') {
            return tolak(
              422,
              'valid_from_not_after_previous',
              `Versi baru harus berlaku setelah ${hasil.previousValidFrom}. Tarif tidak dapat disisipkan mundur ke belakang versi yang sudah ada.`,
            )
          }
          return tolak(
            422,
            'previous_already_closed',
            `Versi sebelumnya sudah ditutup pada ${hasil.previousValidTo}. Menutupnya lagi akan meninggalkan tanggal yang tidak punya tarif.`,
          )
        },
      ),
  )

  // ── Penguji aturan ───────────────────────────────────────────────────────

  app.post(
    '/v1/companies/:companyId/tax-rules/resolve',
    {
      schema: {
        params: JalurCompany,
        body: Type.Intersect([KonteksPenentuan, Type.Object({ as_of: Tanggal })]),
      },
    },
    async (request, reply) =>
      jalankan(
        request,
        reply,
        request.params.companyId,
        'pajak.laporan.baca',
        'Akuntan Pajak',
        async (scoped, ctx) => {
          const hasil = await scoped.tax.engine.explain(
            ctx.companyId,
            keKonteks(request.body),
            request.body.as_of,
          )

          if (hasil.kind === 'unresolved') {
            return tolak(422, 'unresolved', hasil.reason)
          }
          return {
            status: 200,
            body: {
              success: true,
              data: {
                tax_code: hasil.code,
                rule_id: hasil.ruleId,
                specificity: hasil.specificity,
                rate: hasil.rate,
              },
            },
          }
        },
      ),
  )

  // ── Perhitungan ──────────────────────────────────────────────────────────

  app.post(
    '/v1/companies/:companyId/tax/calculate',
    {
      schema: {
        params: JalurCompany,
        body: Type.Intersect([
          KonteksPenentuan,
          Type.Object({
            // Tanggal DOKUMEN. Bukan tanggal hari ini, dan tidak ada parameter
            // untuk memaksa tarif tertentu — Module 08 §7.
            document_date: Tanggal,
            amount: Type.Number({ minimum: 0 }),
            currency: Type.String({ minLength: 3, maxLength: 3 }),
          }),
        ]),
      },
    },
    async (request, reply) =>
      jalankan(
        request,
        reply,
        request.params.companyId,
        'pajak.laporan.baca',
        'Akuntan Pajak',
        async (scoped, ctx) => {
          const hasil = await scoped.tax.engine.calculate({
            companyId: ctx.companyId,
            documentDate: request.body.document_date,
            amount: request.body.amount,
            currency: request.body.currency,
            context: keKonteks(request.body),
          })

          if (hasil.kind !== 'calculated') {
            return tolak(422, hasil.kind, hasil.reason)
          }
          return {
            status: 200,
            body: {
              success: true,
              data: {
                tax_code: hasil.code,
                tax_code_id: hasil.amount.taxCodeId,
                base: hasil.amount.base,
                rate: hasil.amount.rate,
                tax: hasil.amount.tax,
                gl_account_id: hasil.amount.glAccountId,
                is_creditable: hasil.amount.isCreditable,
              },
            },
          }
        },
      ),
  )

  // ── Nomor seri ───────────────────────────────────────────────────────────

  app.post(
    '/v1/companies/:companyId/tax-serials',
    {
      schema: {
        params: JalurCompany,
        body: Type.Object({
          prefix: Type.String({ maxLength: 20 }),
          digits: Type.Integer({ minimum: 1, maximum: 20 }),
          range_start: Type.Integer({ minimum: 1 }),
          range_end: Type.Integer({ minimum: 1 }),
          expires_at: Type.Optional(Type.Union([Tanggal, Type.Null()])),
          source_reference: Type.Optional(Type.Union([Type.String({ maxLength: 100 }), Type.Null()])),
        }),
      },
    },
    async (request, reply) =>
      jalankan(
        request,
        reply,
        request.params.companyId,
        'pajak.seri.kelola',
        'Akuntan Pajak',
        async (scoped, ctx) => {
          const hasil = await scoped.tax.serials.allocate({
            companyId: ctx.companyId,
            prefix: request.body.prefix,
            digits: request.body.digits,
            rangeStart: request.body.range_start,
            rangeEnd: request.body.range_end,
            expiresAt: request.body.expires_at ?? null,
            sourceReference: request.body.source_reference ?? null,
            createdBy: ctx.userId,
          })

          if (hasil.kind === 'range_inverted') {
            return tolak(422, 'range_inverted', 'Nomor akhir lebih kecil dari nomor awal.')
          }
          if (hasil.kind === 'range_too_large') {
            return tolak(
              422,
              'range_too_large',
              `Alokasi lebih dari ${hasil.max} nomor sekaligus ditolak; rentang sebesar itu hampir selalu salah ketik.`,
            )
          }
          return {
            status: 201,
            body: { success: true, data: { id: hasil.id, count: hasil.count } },
          }
        },
      ),
  )

  app.get(
    '/v1/companies/:companyId/tax-serials/usage',
    { schema: { params: JalurCompany } },
    async (request, reply) =>
      jalankan(
        request,
        reply,
        request.params.companyId,
        'pajak.laporan.baca',
        'Akuntan Pajak',
        async (scoped, ctx) => {
          const pakai = await scoped.tax.serials.usage(ctx.companyId)
          // Terpakai, batal, dan tersisa terpisah — Module 08 §8. Nomor batal
          // tetap muncul; ia tidak pernah kembali ke pool.
          return { status: 200, body: { success: true, data: pakai } }
        },
      ),
  )

  // ── Faktur pajak keluaran ────────────────────────────────────────────────

  app.post(
    '/v1/companies/:companyId/output-tax-invoices',
    {
      schema: {
        params: JalurCompany,
        body: Type.Object({
          customer_id: Type.String({ format: 'uuid' }),
          invoice_date: Tanggal,
          tax_code_id: Type.String({ format: 'uuid' }),
          base_amount: Type.Number({ minimum: 0 }),
          tax_amount: Type.Number({ minimum: 0 }),
          replaces_id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
          sources: Type.Array(
            Type.Object({
              sales_document_id: Type.String({ format: 'uuid' }),
              base_amount: Type.Number({ minimum: 0 }),
              tax_amount: Type.Number({ minimum: 0 }),
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
        'pajak.faktur.terbit',
        'Akuntan Pajak',
        async (scoped, ctx) => {
          const hasil = await scoped.tax.outputInvoices.create({
            companyId: ctx.companyId,
            customerId: request.body.customer_id,
            invoiceDate: request.body.invoice_date,
            taxCodeId: request.body.tax_code_id,
            baseAmount: request.body.base_amount,
            taxAmount: request.body.tax_amount,
            replacesId: request.body.replaces_id ?? null,
            sources: request.body.sources.map((sumber) => ({
              salesDocumentId: sumber.sales_document_id,
              baseAmount: sumber.base_amount,
              taxAmount: sumber.tax_amount,
            })),
            createdBy: ctx.userId,
          })

          if (hasil.kind === 'created') {
            return { status: 201, body: { success: true, data: { id: hasil.id } } }
          }
          if (hasil.kind === 'not_pkp') {
            // 409: keadaannya yang menghalangi, bukan bentuk permintaannya.
            return tolak(409, 'company_not_pkp', hasil.reason)
          }
          if (hasil.kind === 'customer_npwp_missing') {
            return tolak(422, 'customer_npwp_missing', hasil.reason)
          }
          if (hasil.kind === 'customer_not_found') {
            return tolak(404, 'customer_not_found', 'Pelanggan tidak ditemukan.')
          }
          if (hasil.kind === 'replaced_not_issued') {
            return tolak(
              409,
              'replaced_not_issued',
              'Faktur yang digantikan harus berstatus terbit.',
            )
          }
          return tolak(
            422,
            'no_sources',
            'Faktur pajak harus merujuk sedikitnya satu faktur komersial.',
          )
        },
      ),
  )

  app.post(
    '/v1/companies/:companyId/output-tax-invoices/:id/issue',
    { schema: { params: JalurDokumen } },
    async (request, reply) =>
      jalankan(
        request,
        reply,
        request.params.companyId,
        'pajak.faktur.terbit',
        'Akuntan Pajak',
        async (scoped, ctx) => {
          void ctx
          const hasil = await scoped.tax.outputInvoices.issue(request.params.id, ctx.userId)

          if (hasil.kind === 'issued') {
            return {
              status: 200,
              body: {
                success: true,
                data: { number: hasil.formattedNumber, serial_number: hasil.serialNumber },
              },
            }
          }
          if (hasil.kind === 'not_found') {
            return tolak(404, 'not_found', 'Faktur pajak tidak ditemukan.')
          }
          if (hasil.kind === 'not_pkp') {
            return tolak(409, 'company_not_pkp', hasil.reason)
          }
          if (hasil.kind === 'no_serial_available') {
            return tolak(409, 'no_serial_available', hasil.reason)
          }
          return tolak(
            409,
            'not_draft',
            `Faktur pajak berstatus ${hasil.status} tidak dapat diterbitkan lagi.`,
          )
        },
      ),
  )

  app.post(
    '/v1/companies/:companyId/output-tax-invoices/:id/cancel',
    {
      schema: {
        params: JalurDokumen,
        body: Type.Object({ reason: Type.String({ minLength: 20, maxLength: 500 }) }),
      },
    },
    async (request, reply) =>
      jalankan(
        request,
        reply,
        request.params.companyId,
        'pajak.faktur.batal',
        'Admin Company',
        async (scoped, ctx) => {
          const hasil = await scoped.tax.outputInvoices.cancel(
            request.params.id,
            request.body.reason,
            ctx.userId,
          )

          if (hasil.kind === 'cancelled') {
            return {
              status: 200,
              body: {
                success: true,
                // Dikatakan terang-terangan di jawaban, bukan hanya di dokumen.
                message: 'Faktur pajak dibatalkan. Nomor serinya tidak kembali ke pool.',
              },
            }
          }
          if (hasil.kind === 'not_found') {
            return tolak(404, 'not_found', 'Faktur pajak tidak ditemukan.')
          }
          if (hasil.kind === 'reason_required') {
            return tolak(422, 'reason_required', 'Alasan pembatalan wajib diisi.')
          }
          return tolak(
            409,
            'not_issued',
            `Faktur pajak berstatus ${hasil.status} tidak dapat dibatalkan.`,
          )
        },
      ),
  )

  // ── Faktur pajak masukan ─────────────────────────────────────────────────

  app.post(
    '/v1/companies/:companyId/input-tax-invoices',
    {
      schema: {
        params: JalurCompany,
        body: Type.Object({
          vendor_id: Type.String({ format: 'uuid' }),
          supplier_number: Type.String({ minLength: 1, maxLength: 50 }),
          invoice_date: Tanggal,
          purchase_document_id: Type.Optional(
            Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
          ),
          tax_code_id: Type.String({ format: 'uuid' }),
          base_amount: Type.Number({ minimum: 0 }),
          tax_amount: Type.Number({ minimum: 0 }),
        }),
      },
    },
    async (request, reply) =>
      jalankan(
        request,
        reply,
        request.params.companyId,
        'pajak.masukan.validasi',
        'Akuntan Pajak',
        async (scoped, ctx) => {
          const hasil = await scoped.tax.inputInvoices.record({
            companyId: ctx.companyId,
            vendorId: request.body.vendor_id,
            supplierNumber: request.body.supplier_number,
            invoiceDate: request.body.invoice_date,
            purchaseDocumentId: request.body.purchase_document_id ?? null,
            taxCodeId: request.body.tax_code_id,
            baseAmount: request.body.base_amount,
            taxAmount: request.body.tax_amount,
            createdBy: ctx.userId,
          })

          if (hasil.kind === 'vendor_not_found') {
            return tolak(404, 'vendor_not_found', 'Vendor tidak ditemukan.')
          }
          return { status: 201, body: { success: true, data: { id: hasil.id } } }
        },
      ),
  )

  app.post(
    '/v1/companies/:companyId/input-tax-invoices/:id/validate',
    { schema: { params: JalurDokumen } },
    async (request, reply) =>
      jalankan(
        request,
        reply,
        request.params.companyId,
        'pajak.masukan.validasi',
        'Akuntan Pajak',
        async (scoped) => {
          const hasil = await scoped.tax.inputInvoices.validate(request.params.id)
          if (hasil.kind === 'not_found') {
            return tolak(404, 'not_found', 'Faktur pajak masukan tidak ditemukan.')
          }
          return {
            status: 200,
            body: {
              success: true,
              data: {
                is_creditable: hasil.isCreditable,
                // Apa yang kurang, satu per satu — bukan satu bendera merah.
                defects: hasil.defects.map((butir) => ({
                  code: butir.code,
                  detail: butir.detail,
                })),
              },
            },
          }
        },
      ),
  )

  app.patch(
    '/v1/companies/:companyId/input-tax-invoices/:id/credit-period',
    { schema: { params: JalurDokumen, body: Type.Object({ credit_period: Masa }) } },
    async (request, reply) =>
      jalankan(
        request,
        reply,
        request.params.companyId,
        'pajak.masukan.validasi',
        'Akuntan Pajak',
        async (scoped) => {
          const hasil = await scoped.tax.inputInvoices.setCreditPeriod(
            request.params.id,
            request.body.credit_period,
          )
          if (hasil === 'not_found') {
            return tolak(404, 'not_found', 'Faktur pajak masukan tidak ditemukan.')
          }
          return { status: 200, body: { success: true } }
        },
      ),
  )

  // ── Rekonsiliasi ─────────────────────────────────────────────────────────

  app.get(
    '/v1/companies/:companyId/reports/tax-reconciliation',
    { schema: { params: JalurCompany, querystring: Type.Object({ period: Masa }) } },
    async (request, reply) =>
      jalankan(
        request,
        reply,
        request.params.companyId,
        'pajak.laporan.baca',
        'Akuntan Pajak',
        async (scoped, ctx) => {
          const baris = await scoped.tax.repository.reconcile(ctx.companyId, request.query.period)
          // Selisih per kode, bukan satu angka gabungan. Satu angka gabungan
          // yang bukan nol tidak memberi tahu siapa pun harus melihat ke mana.
          return {
            status: 200,
            body: {
              success: true,
              data: {
                period: request.query.period,
                balanced: baris.every((row) => row.difference === 0),
                rows: baris.map((row) => ({
                  tax_code: row.code,
                  tax_code_id: row.taxCodeId,
                  gl_account_id: row.glAccountId,
                  tax_ledger_total: row.taxLedgerTotal,
                  general_ledger_total: row.generalLedgerTotal,
                  difference: row.difference,
                })),
              },
            },
          }
        },
      ),
  )
}
