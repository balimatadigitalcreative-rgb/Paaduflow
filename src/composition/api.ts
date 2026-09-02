import { buildHttpApp, keadaanAwal } from '#interface/http/app'
import {
  ConsoleMailer,
  UncheckedBreachList,
} from '#infrastructure/modules/identity/dev-adapters'
import { createPermissionCache } from '#application/identity/authorization'
import pg from 'pg'

import { pasangPendengarCacheIzin } from '#infrastructure/db/siaran-cache-izin'

import { createAppServices } from './http.js'
import { modules } from './modules.js'
import { pasangPenutupanRapi } from './penutupan.js'

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

  /*
   * Satu objek keadaan dipegang bersama oleh yang menyalakan proses dan yang
   * menjawab `/readyz`. Nilai salinan tidak bisa: keduanya harus melihat
   * bendera yang sama.
   */
  const keadaan = keadaanAwal()

  const cacheIzin = createPermissionCache()
  const services = createAppServices({
    pool,
    tokenSigningSecret: required('TOKEN_SIGNING_SECRET'),
    mfaEncryptionKeyBase64: required('MFA_ENCRYPTION_KEY'),
    mailer: new ConsoleMailer(),
    breachList: new UncheckedBreachList(),
    permissionCache: cacheIzin,
  })

  const app = await buildHttpApp({ services, logger: true, keadaan, webRoot: options.webRoot })

  if (options.webRoot !== undefined && options.webRoot !== '') {
    const { default: fastifyStatic } = await import('@fastify/static')
    await app.register(fastifyStatic, {
      root: options.webRoot,
      wildcard: false,

      /**
       * Dua kelas berkas, dua umur cache — dan hanya satu yang perlu diatur.
       *
       * Bawaan `@fastify/static` mengirim `cache-control: public, max-age=0`
       * beserta ETag untuk SEMUANYA. Diperiksa di produksi, bukan disimpulkan
       * dari dokumentasi.
       *
       * Untuk `index.html` itu sudah benar dan tidak diubah: `max-age=0`
       * memaksa peramban bertanya ulang setiap kali, dan ETag membuat
       * jawabannya 304 tanpa isi. Ia tidak pernah tersaji basi, dan biayanya
       * satu perjalanan bolak-balik yang memang harus terjadi.
       *
       * Untuk `assets/` itu salah, dan biayanya nyata: bundel 392 KB
       * divalidasi ulang pada setiap pemuatan halaman meskipun namanya sudah
       * mengandung sidik isinya. Nama berubah setiap kali isi berubah, jadi
       * berkas itu tidak akan pernah menjadi basi — menyimpannya setahun
       * bukan sekadar aman, ia yang diinginkan. `immutable` menghapus
       * revalidasinya sama sekali.
       *
       * Perubahan ini sekaligus yang membuat pemberitahuan versi bermakna:
       * tanpa `immutable`, tab yang memuat ulang tetap membayar ulang seluruh
       * bundel yang sudah ia punya.
       */
      setHeaders(reply, path) {
        // Kedua pemisah jalur diterima: yang datang ke sini adalah jalur
        // filesystem, dan ia memakai `\` di Windows.
        if (/[\\/]assets[\\/]/.test(path)) {
          reply.header('cache-control', 'public, max-age=31536000, immutable')
        }
      },
    })

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

  /*
   * Pendengar pembatalan izin dipasang SEBELUM mendengarkan HTTP.
   *
   * Bila dipasang sesudah, ada jendela pendek ketika proses ini sudah melayani
   * permintaan tetapi belum menerima pembatalan — dan pembatalan yang terlewat
   * di jendela itu berlaku sampai TTL cache habis.
   */
  const pendengar = await pasangPendengarCacheIzin(pool, cacheIzin, (pesan, galat) => {
    app.log.error({ err: galat }, pesan)
  })

  const port = Number(process.env.PORT ?? 3000)
  await app.listen({ port, host: '0.0.0.0' })

  /*
   * Basis data dibuktikan terjangkau SEBELUM proses menyatakan diri siap.
   *
   * Tanpa langkah ini, `/readyz` menjawab 200 pada proses yang baru saja
   * mendengarkan tetapi belum pernah berhasil menyentuh basis data — dan
   * pengarah lalu lintas akan mengirim permintaan pertama pengguna ke sana.
   * Ini bagian yang membuat `wait_ready` PM2 berarti sesuatu.
   */
  try {
    await services.ping()
  } catch (galat) {
    app.log.error({ err: galat }, 'Basis data tidak terjangkau saat menyala; proses berhenti.')
    await app.close()
    await pendengar.tutup()
    await pool.end()
    process.exit(1)
  }

  keadaan.siap = true

  pasangPenutupanRapi({
    app,
    pool,
    pendengar,
    tandaiMenutup: () => {
      keadaan.menutup = true
    },
  })

  /*
   * Memberi tahu PM2 bahwa instance ini benar-benar siap.
   *
   * Dipasangkan dengan `wait_ready: true` di ecosystem.config.cjs. Tanpa
   * pasangan itu, PM2 menganggap instance siap begitu prosesnya lahir, dan
   * `reload` melanjutkan ke instance berikutnya sebelum yang ini dapat
   * melayani apa pun — yang menghapus seluruh gunanya rolling restart.
   *
   * `process.send` hanya ada saat proses lahir sebagai anak (mode cluster).
   * Dijalankan langsung dari terminal, ia undefined, dan itu bukan kesalahan.
   */
  process.send?.('ready')

  app.log.info(`Siap melayani di porta ${port}.`)
}
