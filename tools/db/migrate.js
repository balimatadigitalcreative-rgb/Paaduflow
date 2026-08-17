/**
 * Penjalan migrasi — D-033.
 *
 * Satu jalur untuk semua: skrip `npm run migrate`, test invarian, dan CI
 * memanggil fungsi yang sama. Dua jalur berarti dua perilaku yang lambat laun
 * berbeda, dan yang berbeda selalu ketahuan di lingkungan yang paling mahal.
 */

import { fileURLToPath } from 'node:url'

import { runner } from 'node-pg-migrate'
import pg from 'pg'

const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations', import.meta.url))

/**
 * Menolak basis data yang tidak ber-encoding UTF8.
 *
 * Tanpa pemeriksaan ini, kegagalannya muncul sebagai galat konversi karakter di
 * tengah migrasi — pesan yang tidak menyebutkan sebab sebenarnya. Nama pelanggan,
 * alamat, dan pesan galat berbahasa Indonesia semuanya memerlukan UTF8.
 */
async function assertUtf8(databaseUrl) {
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    const { rows } = await client.query('SHOW server_encoding')
    const encoding = rows[0]?.server_encoding
    if (encoding !== 'UTF8') {
      throw new Error(
        `Basis data ber-encoding ${encoding}, bukan UTF8. Buat ulang dengan ` +
          `ENCODING 'UTF8' TEMPLATE template0.`,
      )
    }
  } finally {
    await client.end()
  }
}

/**
 * Menjalankan seluruh migrasi yang belum diterapkan.
 *
 * @param {string} databaseUrl
 * @param {{ log?: (message: string) => void }} [options]
 */
export async function migrate(databaseUrl, options = {}) {
  await assertUtf8(databaseUrl)

  const applied = await runner({
    databaseUrl,
    dir: MIGRATIONS_DIR,
    direction: 'up',
    migrationsTable: 'paadu_migrations',
    // Daftar putih, bukan daftar hitam: apa pun yang bukan `0001_nama.sql`
    // diabaikan. Folder migrasi juga memuat README dan berkas sidik jari, dan
    // daftar hitam akan tertinggal setiap kali ada berkas pendamping baru.
    ignorePattern: '^(?!\\d{4}_.*\\.sql$).*',
    // Seluruh migrasi dalam satu transaksi: bila salah satu gagal, tidak ada
    // yang setengah diterapkan. Postgres mendukung DDL transaksional, jadi ini
    // gratis — dan tanpanya, migrasi gagal meninggalkan skema yang tidak dapat
    // dijelaskan oleh berkas mana pun.
    singleTransaction: true,
    log: options.log ?? (() => {}),
  })
  return applied.map((migration) => migration.name)
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url)

if (isDirectRun) {
  /**
   * Kredensial migrasi terpisah dari kredensial runtime.
   *
   * Migrasi berjalan sebagai `paadu_owner` — pemilik objek, yang boleh membuat
   * tabel, kebijakan, dan peran. Runtime berjalan sebagai `paadu_app`, yang
   * tunduk RLS dan sengaja bukan pemilik. Bila keduanya memakai satu variabel,
   * satu-satunya kredensial yang tersedia bagi proses runtime adalah kredensial
   * yang dapat membongkar seluruh skema.
   *
   * `MIGRATION_DATABASE_URL` karena itu dibaca lebih dulu, dan tidak dimuat
   * proses runtime mana pun. `DATABASE_URL` tetap dipakai bila ia tidak ada,
   * supaya pengembangan lokal tidak menuntut dua variabel untuk satu basis data
   * yang pemiliknya memang superuser.
   */
  const databaseUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL
  if (databaseUrl === undefined || databaseUrl === '') {
    console.error('MIGRATION_DATABASE_URL maupun DATABASE_URL belum dipasang.')
    process.exit(1)
  }
  if (process.env.MIGRATION_DATABASE_URL === undefined || process.env.MIGRATION_DATABASE_URL === '') {
    console.warn(
      'Memakai DATABASE_URL untuk migrasi. Di produksi, pasang MIGRATION_DATABASE_URL\n' +
        'dengan kredensial paadu_owner dan jangan sertakan ia di lingkungan runtime.',
    )
  }
  const applied = await migrate(databaseUrl, { log: (message) => console.log(message) })
  console.log(
    applied.length === 0
      ? 'Tidak ada migrasi baru.'
      : `${applied.length} migrasi diterapkan: ${applied.join(', ')}`,
  )
}
