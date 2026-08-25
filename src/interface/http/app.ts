import { createHash, randomUUID } from 'node:crypto'

import type { AppServices } from '#application/app-services'
import type { IdempotencyKey } from '#shared/idempotency'
import swagger from '@fastify/swagger'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'

import { bearerToken, sendError } from './context.js'
import { registerIdentityRoutes } from './modules/identity/routes.js'
import { registerAccountingRoutes } from './modules/accounting/routes.js'
import { registerMasterDataRoutes } from './modules/master-data/routes.js'
import { registerPurchasingRoutes } from './modules/purchasing/routes.js'
import { registerSalesRoutes } from './modules/sales/routes.js'
import { registerTaxRoutes } from './modules/tax/routes.js'

export type PaaduServer = FastifyInstance<
  import('node:http').Server,
  import('node:http').IncomingMessage,
  import('node:http').ServerResponse,
  import('fastify').FastifyBaseLogger,
  TypeBoxTypeProvider
>

/**
 * Keadaan proses, dibaca `/readyz`.
 *
 * Objek yang dapat diubah, bukan nilai: yang menyalakan proses dan yang
 * menjawab permintaan adalah dua tempat berbeda, dan keduanya harus melihat
 * bendera yang sama.
 */
export interface KeadaanProses {
  /** Menjadi true setelah listen berhasil dan basis data terbukti terjangkau. */
  siap: boolean
  /** Menjadi true saat sinyal penutupan diterima. */
  menutup: boolean
}

export function keadaanAwal(): KeadaanProses {
  return { siap: false, menutup: false }
}

export interface HttpOptions {
  readonly services: AppServices
  readonly logger?: boolean
  /**
   * Dibiarkan kosong di test: tanpa ini `/readyz` menganggap proses selalu
   * siap, yang benar untuk `app.inject()` — di sana tidak ada fase menyala.
   */
  readonly keadaan?: KeadaanProses
}

/**
 * Perakitan HTTP.
 *
 * Yang ditegakkan di sini dan tidak di tempat lain:
 *
 * - `X-Request-Id` menyambungkan log, jejak, dan audit trail menjadi satu
 *   rangkaian (Modul 17, Resilience §7). Ia diterima dari klien bila ada,
 *   supaya jejak lintas layanan tidak putus.
 * - Konteks company diambil dari path, bukan dari token (D-002).
 * - Seluruh galat keluar dalam satu bentuk amplop.
 */
export async function buildHttpApp(options: HttpOptions): Promise<PaaduServer> {
  const app = Fastify({
    logger: options.logger ?? false,

    /*
     * Koneksi keep-alive yang MENGANGGUR ditutup paksa saat `app.close()`.
     *
     * Nginx memegang koneksi upstream tetap terbuka di antara permintaan.
     * Tanpa opsi ini, `close()` menunggu koneksi-koneksi itu kedaluwarsa
     * sendiri — penutupan yang seharusnya selesai dalam milidetik menggantung
     * sampai batas waktu, dan reload yang seharusnya mulus menjadi lambat
     * tepat saat instance berikutnya menunggu giliran.
     *
     * `'idle'`, bukan `true`: `true` memutus koneksi yang SEDANG melayani
     * permintaan, yang persis kebalikan dari yang diinginkan di sini.
     */
    forceCloseConnections: 'idle',

    // Header klien dipakai apa adanya bila ada. Rantai jejak yang dimulai di
    // gateway tidak boleh putus hanya karena layanan ini membuat id baru.
    genReqId: (request) => {
      const header = request.headers['x-request-id']
      return typeof header === 'string' && header !== '' ? header : randomUUID()
    },
  }).withTypeProvider<TypeBoxTypeProvider>()

  // OpenAPI dibangkitkan dari skema rute yang sama dengan yang memvalidasi
  // permintaan (D-031). Dokumen terpisah akan basi dalam hitungan minggu;
  // dokumen yang lahir dari kode yang berjalan tidak bisa basi.
  // Ditunggu, bukan sekadar didaftarkan: kait `onRoute` milik plugin baru
  // terpasang setelah ia selesai dimuat, dan rute yang terdaftar sebelum itu
  // tidak akan pernah muncul di dokumen.
  await app.register(swagger, {
    openapi: {
      info: { title: 'Paadu Flow API', version: '1.0.0' },
      servers: [{ url: '/' }],
    },
  })

  app.decorateRequest('authenticated', null)
  app.decorateRequest('company', null)

  app.addHook('onSend', async (request, reply) => {
    reply.header('X-Request-Id', request.id)
  })

  // Satu bentuk amplop untuk seluruh galat. Klien tidak boleh perlu menebak
  // apakah sebuah galat datang dari validasi, dari otorisasi, atau dari kode
  // yang meledak.
  app.setErrorHandler((error: import('fastify').FastifyError, request, reply) => {
    if (error.validation !== undefined) {
      return sendError(reply, 400, 'validation_failed', 'Permintaan tidak valid.', {
        detail: error.message,
      })
    }
    request.log.error({ err: error, requestId: request.id }, 'permintaan gagal')
    return sendError(reply, 500, 'internal_error', 'Terjadi kesalahan di sistem kami.')
  })

  app.setNotFoundHandler((request, reply) =>
    sendError(reply, 404, 'not_found', 'Alamat tidak ditemukan.'),
  )

  registerIdentityRoutes(app, options.services)
  registerPurchasingRoutes(app, options.services)
  registerSalesRoutes(app, options.services)
  registerAccountingRoutes(app, options.services)
  registerMasterDataRoutes(app, options.services)
  registerTaxRoutes(app, options.services)

  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger())

  /*
   * ═════════════════════════════════════════════════════════════════════════
   *   DUA ENDPOINT, DUA PERTANYAAN BERBEDA
   *
   *   `/healthz`  — "apakah proses ini hidup?"      → restart bila gagal
   *   `/readyz`   — "boleh dikirimi permintaan?"    → alihkan bila gagal
   *
   *   Sebelumnya keduanya satu endpoint yang ikut menyentuh basis data.
   *   Akibatnya: gangguan basis data sesaat membuat liveness gagal, dan
   *   pemantau yang me-restart saat liveness gagal akan membunuh proses yang
   *   sebenarnya sehat — tepat pada saat basis datanya sedang pulih dan
   *   restart adalah hal terakhir yang menolong.
   *
   *   Keduanya tanpa autentikasi, dan sengaja demikian: yang memanggilnya
   *   adalah skrip deploy dan pemantau, dan keduanya tidak punya token.
   *   Tidak ada yang bocor — hanya "hidup" dan "siap".
   * ═════════════════════════════════════════════════════════════════════════
   */

  /**
   * Liveness. TIDAK menyentuh basis data, dan itu keputusan.
   *
   * Yang dijawab endpoint ini hanya satu hal: event loop masih berjalan dan
   * dapat membalas. Proses yang menjawab ini tidak perlu di-restart, apa pun
   * keadaan basis datanya.
   *
   * Tetap 200 saat proses sedang menutup. Proses yang sedang menyelesaikan
   * permintaan terakhirnya memang hidup; menjawab 503 di sini hanya akan
   * mengundang pemantau membunuhnya lebih cepat daripada ia sempat selesai.
   */
  app.get('/healthz', { schema: { hide: true } }, async (_request, reply) =>
    reply.status(200).send({ status: 'hidup' }),
  )

  /**
   * Readiness. Menyentuh basis data, dan tahu kapan proses sedang menutup.
   *
   * Menjawab 503 dalam tiga keadaan, dan ketiganya berarti hal yang sama bagi
   * pengarah lalu lintas — jangan kirim ke sini:
   *
   *   1. Proses belum selesai menyala (`siap` masih false)
   *   2. Proses sedang menutup (`menutup` sudah true)
   *   3. Basis data tidak terjangkau
   *
   * Keadaan 2 yang membuat reload berjalan mulus: instance yang akan dimatikan
   * berhenti menyatakan siap SEBELUM ia berhenti mendengarkan.
   */
  app.get('/readyz', { schema: { hide: true } }, async (_request, reply) => {
    const keadaan = options.keadaan

    if (keadaan !== undefined && keadaan.menutup) {
      return reply.status(503).send({ status: 'menutup', database: 'tidak diperiksa' })
    }

    if (keadaan !== undefined && !keadaan.siap) {
      return reply.status(503).send({ status: 'menyala', database: 'tidak diperiksa' })
    }

    try {
      await options.services.ping()
      return reply.status(200).send({ status: 'siap', database: 'ok' })
    } catch (galat) {
      // 503, bukan 500: keadaannya sementara dan pemanggilnya boleh mencoba
      // lagi. Pesannya ikut supaya deploy tidak perlu menebak.
      return reply.status(503).send({
        status: 'belum siap',
        database: 'unreachable',
        message: galat instanceof Error ? galat.message : 'Basis data tidak terjangkau.',
      })
    }
  })

  return app
}

/** Memastikan permintaan membawa access token yang sah. */
export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
  services: AppServices,
): Promise<boolean> {
  const token = bearerToken(request)
  if (token === null) {
    await sendError(reply, 401, 'unauthenticated', 'Diperlukan autentikasi.')
    return false
  }

  const claims = await services.authentication.readAccessToken(token)
  if (claims === null) {
    await sendError(reply, 401, 'unauthenticated', 'Sesi tidak berlaku.')
    return false
  }

  request.authenticated = {
    userId: claims.userId,
    email: claims.email,
    sessionId: claims.sessionId,
  }
  return true
}

/**
 * Menentukan tenant dari company di path, lalu memastikan penggunanya berakses.
 *
 * Jawaban yang sama — 403 — untuk company yang tidak ada, company milik tenant
 * lain, dan company yang ada tetapi tidak diberikan kepadanya. Membedakannya
 * mengubah id company menjadi alat pencacah.
 */
export async function requireCompany(
  request: FastifyRequest,
  reply: FastifyReply,
  services: AppServices,
  companyId: string,
): Promise<boolean> {
  const user = request.authenticated
  if (user === null) {
    await sendError(reply, 401, 'unauthenticated', 'Diperlukan autentikasi.')
    return false
  }

  const tenantId = await services.resolveTenantForCompany(user.userId, companyId)
  if (tenantId === null) {
    await sendError(reply, 403, 'permission_denied', 'Anda tidak memiliki akses ke bagian ini.', {
      required: 'organisasi.company.baca:company',
      ask: 'Admin Company',
    })
    return false
  }

  request.company = { tenantId, companyId }
  return true
}

/**
 * Menjalankan operasi tulis paling banyak satu kali per kunci idempotency.
 *
 * Tanpa kunci, operasi berjalan seperti biasa — kunci wajib bagi klien yang
 * peduli, tidak wajib bagi yang tidak. Timeout tidak boleh menghasilkan faktur
 * ganda; itu seluruh alasannya ada.
 */
export async function withIdempotency(
  request: FastifyRequest,
  reply: FastifyReply,
  services: AppServices,
  handler: () => Promise<{ status: number; body: unknown }>,
): Promise<FastifyReply> {
  const header = request.headers['idempotency-key']
  const company = request.company

  if (typeof header !== 'string' || header === '' || company === null) {
    const hasil = await handler()
    return reply.status(hasil.status).send(hasil.body)
  }

  const key: IdempotencyKey = {
    tenantId: company.tenantId,
    companyId: company.companyId,
    key: header,
    endpoint: `${request.method} ${request.routeOptions.url ?? request.url}`,
    requestHash: createHash('sha256')
      .update(JSON.stringify(request.body ?? null))
      .digest('hex'),
  }

  const outcome = await services.idempotency.begin(key)

  if (outcome.state === 'replay') {
    return reply
      .status(outcome.response.status)
      .header('Idempotency-Replayed', 'true')
      .send(outcome.response.body)
  }

  if (outcome.state === 'conflict') {
    return sendError(
      reply,
      422,
      'idempotency_key_reused',
      'Kunci idempotency ini sudah dipakai untuk permintaan dengan isi berbeda.',
    )
  }

  if (outcome.state === 'in_progress') {
    return sendError(
      reply,
      409,
      'idempotency_in_progress',
      'Permintaan dengan kunci yang sama sedang diproses.',
    )
  }

  try {
    const hasil = await handler()
    await services.idempotency.complete(key, { status: hasil.status, body: hasil.body })
    return reply.status(hasil.status).send(hasil.body)
  } catch (error) {
    // Kunci dilepas supaya percobaan ulang tidak buntu selamanya karena satu
    // kegagalan yang bahkan tidak menghasilkan jawaban.
    await services.idempotency.abandon(key)
    throw error
  }
}
