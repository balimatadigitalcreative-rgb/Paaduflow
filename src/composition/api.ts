import { buildHttpApp } from '#interface/http/app'
import {
  ConsoleMailer,
  UncheckedBreachList,
} from '#infrastructure/modules/identity/dev-adapters'
import pg from 'pg'

import { createAppServices } from './http.js'
import { modules } from './modules.js'

/**
 * Proses `api` (D-044). Melayani permintaan pengguna dan integrasi.
 */

function required(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === '') {
    throw new Error(`Variabel lingkungan ${name} belum dipasang.`)
  }
  return value
}

export interface ApiOptions {
  /**
   * Direktori hasil `npm run build:web`. Bila diisi, proses ini juga menyajikan
   * antarmuka sebagai berkas statis — jalur produksi, tanpa Vite.
   *
   * Dibiarkan kosong saat pengembangan: di sana Vite yang menyajikannya, dengan
   * hot reload yang tidak mungkin diberikan berkas statis.
   */
  readonly webRoot?: string | undefined
}

export async function startApi(options: ApiOptions = {}): Promise<void> {
  const pool = new pg.Pool({ connectionString: required('DATABASE_URL') })

  const services = createAppServices({
    pool,
    tokenSigningSecret: required('TOKEN_SIGNING_SECRET'),
    mfaEncryptionKeyBase64: required('MFA_ENCRYPTION_KEY'),
    mailer: new ConsoleMailer(),
    breachList: new UncheckedBreachList(),
  })

  const app = await buildHttpApp({ services, logger: true })

  if (options.webRoot !== undefined && options.webRoot !== '') {
    const { default: fastifyStatic } = await import('@fastify/static')
    await app.register(fastifyStatic, { root: options.webRoot, wildcard: false })

    /**
     * Rute non-API diarahkan ke index.html.
     *
     * Ditulis sebagai rute penangkap, bukan `setNotFoundHandler`: `buildHttpApp`
     * sudah memasang penangan 404 miliknya sendiri, dan amplop galat yang
     * seragam itu justru yang harus tetap berlaku bagi API.
     *
     * Router web berbasis hash (`#/penjualan`), sehingga muat ulang halaman
     * tidak pernah meminta path dalam ke server. Pengalihan ini tetap
     * dibutuhkan untuk `/`, dan untuk saat router berpindah ke History API.
     *
     * `/v1` dan `/openapi.json` sengaja TIDAK ikut: API yang menjawab
     * index.html saat rutenya salah adalah API yang menyembunyikan kesalahan
     * pemanggilnya di balik HTML berstatus 200.
     */
    app.get('/*', async (request, reply) => {
      const url = request.raw.url ?? '/'
      if (url.startsWith('/v1') || url.startsWith('/openapi.json')) {
        return reply.status(404).send({
          success: false,
          message: 'Rute tidak ditemukan.',
          errors: [{ code: 'not_found' }],
        })
      }
      return reply.sendFile('index.html')
    })
  }

  // Diucapkan keras setiap kali proses menyala. Syarat yang belum terpenuhi
  // dan tidak terdengar adalah syarat yang akan sampai ke produksi.
  app.log.warn(
    'Daftar kata sandi bocor belum terpasang (UncheckedBreachList) — Modul 02 §11 belum terpenuhi.',
  )
  app.log.info(`${modules.length} modul terdaftar.`)

  const port = Number(process.env.PORT ?? 3000)
  await app.listen({ port, host: '0.0.0.0' })
}
