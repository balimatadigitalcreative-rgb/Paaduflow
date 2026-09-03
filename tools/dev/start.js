#!/usr/bin/env node
/**
 * Satu perintah untuk menyalakan seluruh lingkungan pengembangan.
 *
 * Alasannya praktis: mesin pengembangan tidak selalu punya PostgreSQL, dan
 * proyek ini sudah memutuskan untuk tidak bergantung pada Docker (test invarian
 * memakai `embedded-postgres` sejak Sesi A3). Menyuruh orang memasang Postgres
 * sendiri sebelum dapat melihat satu layar pun adalah cara paling pasti membuat
 * layar itu tidak pernah dilihat.
 *
 * Urutannya: basis data → migrasi → seed bila kosong → API → Vite.
 *
 * `DATABASE_URL` yang sudah dipasang selalu menang. Basis data sementara hanya
 * dinyalakan bila tidak ada, dan ia PERSISTEN di `.paadu-dev/` supaya faktur
 * yang dibuat kemarin masih ada hari ini.
 */

import { Buffer } from 'node:buffer'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { fileURLToPath } from 'node:url'

import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'

import { migrate } from '../db/migrate.js'
import { seed } from '../seed/pengembangan.js'

const AKAR = fileURLToPath(new URL('../..', import.meta.url))
const DIREKTORI_DATA = fileURLToPath(new URL('../../.paadu-dev/postgres', import.meta.url))
const PORT_DB = 55432
const NAMA_DB = 'paadu_dev'

/**
 * Rahasia pengembangan. Tetap antar-jalan supaya sesi tidak hangus setiap kali
 * server dinyalakan ulang, dan cukup berisik supaya tidak pernah disangka
 * rahasia sungguhan.
 */
const RAHASIA_PENGEMBANGAN = 'RAHASIA-PENGEMBANGAN-JANGAN-DIPAKAI-DI-PRODUKSI-32'
const KUNCI_MFA_PENGEMBANGAN = Buffer.alloc(32, 7).toString('base64')

let hentikanPostgres = null

/**
 * Galat yang pesannya sudah lengkap dan tidak perlu jejak tumpukan.
 *
 * Jejak tumpukan berguna untuk bug; ia hanya kebisingan untuk kalimat seperti
 * "porta 55432 sudah dipakai". Penanda ini yang membedakan keduanya di
 * penangan galat paling bawah.
 */
function galatJelas(pesan) {
  const galat = new Error(pesan)
  galat.jelas = true
  return galat
}

/** Apakah sudah ada yang mendengarkan di porta ini. */
function portaTerpakai(porta) {
  return new Promise((selesai) => {
    const soket = createConnection({ host: '127.0.0.1', port: porta })
    const jawab = (nilai) => {
      soket.destroy()
      selesai(nilai)
    }
    soket.setTimeout(1000)
    soket.once('connect', () => jawab(true))
    soket.once('timeout', () => jawab(false))
    soket.once('error', () => jawab(false))
  })
}

/**
 * Menolak lebih dulu bila lingkungannya sudah berjalan.
 *
 * Tanpa langkah ini, PostgreSQL kedua gagal mengikat porta lalu mati seketika,
 * dan `embedded-postgres` menolak janjinya dengan `reject()` TANPA argumen —
 * sehingga yang sampai ke layar hanya kata `undefined`. Kegagalannya wajar;
 * yang tidak wajar adalah tidak ada satu pun cara mengetahuinya.
 *
 * Porta Vite sengaja tidak diperiksa: ia berpindah sendiri ke porta berikutnya
 * bila yang default terpakai, jadi menolak karenanya akan salah.
 */
async function periksaPortaBebas({ perluDb }) {
  const bentrok = []

  if (perluDb && (await portaTerpakai(PORT_DB))) {
    bentrok.push(`${PORT_DB} — PostgreSQL pengembangan`)
  }

  const portaApi = Number(process.env.PORT ?? 3000)
  if (await portaTerpakai(portaApi)) bentrok.push(`${portaApi} — API`)

  if (bentrok.length === 0) return

  throw galatJelas(
    [
      'Lingkungan pengembangan sepertinya sudah berjalan.',
      '',
      '  Porta yang sudah dipakai:',
      ...bentrok.map((baris) => `      ${baris}`),
      '',
      '  Hentikan `npm run dev` yang sedang berjalan (Ctrl+C di terminalnya),',
      '  lalu ulangi. Untuk dua lingkungan sekaligus, pasang PORT dan',
      '  DATABASE_URL yang berbeda.',
    ].join('\n'),
  )
}

/**
 * Beberapa baris terakhir dari PostgreSQL, disimpan untuk saat ia gagal.
 *
 * Sebelumnya `onLog` dan `onError` keduanya fungsi kosong. Itu membuang
 * satu-satunya jalan keluar pesan dari PostgreSQL — termasuk kalimat yang
 * menyebut persis mengapa ia menolak menyala.
 */
const catatanPostgres = []
const BATAS_CATATAN = 20

function catatPostgres(pesan) {
  for (const baris of String(pesan).trimEnd().split('\n')) {
    if (baris.trim() !== '') catatanPostgres.push(baris.trimEnd())
  }
  if (catatanPostgres.length > BATAS_CATATAN) {
    catatanPostgres.splice(0, catatanPostgres.length - BATAS_CATATAN)
  }
}

async function nyalakanPostgresSementara() {
  const sudahAda = existsSync(DIREKTORI_DATA)
  await mkdir(DIREKTORI_DATA, { recursive: true })

  const postgres = new EmbeddedPostgres({
    databaseDir: DIREKTORI_DATA,
    user: 'postgres',
    password: 'postgres',
    port: PORT_DB,
    persistent: true,
    onLog: catatPostgres,
    onError: catatPostgres,
  })

  if (!sudahAda) {
    console.log('  Menyiapkan PostgreSQL sementara (sekali saja, mohon tunggu)…')
    await postgres.initialise()
  }

  try {
    await postgres.start()
  } catch {
    /*
     * Sengaja tidak memakai nilai yang dilempar: `embedded-postgres` memanggil
     * `reject()` tanpa argumen saat prosesnya mati lebih awal, jadi yang
     * ditangkap di sini selalu `undefined`. Yang berisi keterangan justru
     * catatan di atas.
     */
    throw galatJelas(
      [
        `PostgreSQL sementara gagal menyala di porta ${PORT_DB}.`,
        '',
        ...(catatanPostgres.length === 0
          ? ['  Ia berhenti tanpa mencetak satu baris pun.']
          : ['  Baris terakhir dari PostgreSQL:', ...catatanPostgres.map((b) => `      ${b}`)]),
      ].join('\n'),
    )
  }

  hentikanPostgres = async () => postgres.stop()

  const admin = new pg.Client({
    connectionString: `postgresql://postgres:postgres@127.0.0.1:${PORT_DB}/postgres`,
  })
  await admin.connect()
  try {
    const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [NAMA_DB])
    if (rows.length === 0) {
      // Bukan createDatabase() bawaan: di Windows, klaster mewarisi locale
      // sistem dan basis data barunya lahir ber-encoding WIN1252, yang tidak
      // dapat memuat teks yang dipakai produk ini (D-053).
      await admin.query(
        `CREATE DATABASE ${NAMA_DB}
           WITH ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`,
      )
    }
  } finally {
    await admin.end()
  }

  return `postgresql://postgres:postgres@127.0.0.1:${PORT_DB}/${NAMA_DB}`
}

/** Seed hanya bila belum ada tenant. Menjalankannya dua kali akan menggandakan. */
async function seedBilaKosong(databaseUrl) {
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  let kosong
  try {
    const { rows } = await client.query('SELECT count(*)::int AS jumlah FROM tenants')
    kosong = rows[0].jumlah === 0
  } finally {
    await client.end()
  }

  if (!kosong) {
    console.log('  Basis data sudah berisi. Seed dilewati.')
    return null
  }

  /*
   * Kata sandi seed dibangkitkan di sini bila belum dipasang.
   *
   * `seed()` menolak berjalan tanpa `SEED_PASSWORD` — nilai bawaan adalah nilai
   * yang suatu hari sampai ke produksi, dan itu sudah pernah terjadi. Tetapi
   * `npm run dev` menjanjikan satu perintah tanpa penyiapan, jadi di sini ia
   * dibangkitkan acak dan dicetak sekali bersama alamat servernya.
   *
   * Acak, bukan tetap: basis data pengembangan yang tak sengaja terpapar tidak
   * membawa kata sandi yang sama dengan mesin orang lain.
   */
  process.env.SEED_PASSWORD ??= randomBytes(12).toString('base64url')

  return seed(databaseUrl)
}

async function main() {
  console.log('\n  Paadu Flow — lingkungan pengembangan\n')

  const dariLuar = process.env.DATABASE_URL
  const pakaiDbSendiri = dariLuar === undefined || dariLuar === ''

  // Sebelum menyentuh apa pun. Menolak di sini jauh lebih murah daripada gagal
  // setelah migrasi berjalan setengah jalan.
  await periksaPortaBebas({ perluDb: pakaiDbSendiri })

  const databaseUrl = pakaiDbSendiri ? await nyalakanPostgresSementara() : dariLuar

  if (dariLuar !== undefined && dariLuar !== '') {
    console.log('  Memakai DATABASE_URL yang sudah dipasang.')
  }
  process.env.DATABASE_URL = databaseUrl

  console.log('  Menjalankan migrasi…')
  await migrate(databaseUrl)

  const akun = await seedBilaKosong(databaseUrl)

  process.env.TOKEN_SIGNING_SECRET ??= RAHASIA_PENGEMBANGAN
  process.env.MFA_ENCRYPTION_KEY ??= KUNCI_MFA_PENGEMBANGAN
  process.env.PORT ??= '3000'

  // Kode server ditulis TypeScript dan memakai alias `#`, yang tidak dikenal
  // Node saat berjalan — proyek ini belum pernah punya skrip yang menjalankan
  // servernya (D-134). Vite yang menyelesaikan keduanya, dengan konfigurasi
  // yang sama dengan yang dipakai web, sehingga tidak ada resolusi kedua yang
  // dapat menyimpang.
  const { createServer } = await import('vite')

  const pemuat = await createServer({
    configFile: `${AKAR}vite.config.ts`,
    root: AKAR,
    server: { middlewareMode: true },
    appType: 'custom',
  })
  const { startApi } = await pemuat.ssrLoadModule('/src/composition/api.ts')
  await startApi()

  const vite = await createServer({ configFile: `${AKAR}vite.config.ts` })
  await vite.listen()

  const alamat = vite.resolvedUrls?.local?.[0] ?? 'http://localhost:5173/'

  console.log(
    [
      '',
      '  ─────────────────────────────────────────────────────────────',
      `  Antarmuka  : ${alamat}`,
      `  API        : http://localhost:${process.env.PORT}`,
      `  OpenAPI    : http://localhost:${process.env.PORT}/openapi.json`,
      ...(akun === null
        ? ['', '  Akun contoh sudah ada dari jalan sebelumnya.']
        : [
            '',
            `  Masuk sebagai : ${akun.admin}  (Admin Company)`,
            `                  ${akun.staf}  (Anggota)`,
            `  Kata sandi    : ${akun.kataSandi}`,
          ]),
      '',
      '  Seluruh data adalah DATA CONTOH. Hentikan dengan Ctrl+C.',
      '  ─────────────────────────────────────────────────────────────',
      '',
    ].join('\n'),
  )
}

for (const sinyal of ['SIGINT', 'SIGTERM']) {
  process.on(sinyal, () => {
    // Postgres persisten yang tidak dimatikan akan menahan port dan membuat
    // jalan berikutnya gagal karena sebab yang salah.
    const selesai = hentikanPostgres === null ? Promise.resolve() : hentikanPostgres()
    void selesai.catch(() => undefined).then(() => process.exit(0))
  })
}

await main().catch(async (error) => {
  /*
   * Nilai yang dilempar TIDAK selalu berupa Error.
   *
   * `embedded-postgres` memanggil `reject()` tanpa argumen saat prosesnya mati
   * lebih awal, dan `console.error(undefined)` mencetak persis satu kata:
   * `undefined`. Pesannya jujur dan sama sekali tidak berguna — tidak ada nama
   * galat, tidak ada langkah, tidak ada sebab.
   */
  console.error('')
  if (error instanceof Error) {
    console.error(`  ${error.message}`)
    // Jejak tumpukan hanya untuk yang tidak terduga. Galat yang pesannya sudah
    // menjelaskan dirinya tidak dibuat lebih jelas oleh tumpukan pemanggilan.
    if (error.jelas !== true && error.stack !== undefined) console.error(`\n${error.stack}`)
  } else {
    console.error('  Lingkungan pengembangan gagal menyala, dan sebabnya tidak disebutkan.')
    console.error(`  Nilai yang dilempar: ${String(error)}`)
  }
  console.error('')

  if (hentikanPostgres !== null) await hentikanPostgres().catch(() => undefined)
  process.exit(1)
})
