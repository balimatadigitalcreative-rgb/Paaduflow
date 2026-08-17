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
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
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

async function nyalakanPostgresSementara() {
  const sudahAda = existsSync(DIREKTORI_DATA)
  await mkdir(DIREKTORI_DATA, { recursive: true })

  const postgres = new EmbeddedPostgres({
    databaseDir: DIREKTORI_DATA,
    user: 'postgres',
    password: 'postgres',
    port: PORT_DB,
    persistent: true,
    onLog: () => {},
    onError: () => {},
  })

  if (!sudahAda) {
    console.log('  Menyiapkan PostgreSQL sementara (sekali saja, mohon tunggu)…')
    await postgres.initialise()
  }
  await postgres.start()
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
  return seed(databaseUrl)
}

async function main() {
  console.log('\n  Paadu Flow — lingkungan pengembangan\n')

  const dariLuar = process.env.DATABASE_URL
  const databaseUrl =
    dariLuar !== undefined && dariLuar !== '' ? dariLuar : await nyalakanPostgresSementara()

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
  console.error(error)
  if (hentikanPostgres !== null) await hentikanPostgres().catch(() => undefined)
  process.exit(1)
})
