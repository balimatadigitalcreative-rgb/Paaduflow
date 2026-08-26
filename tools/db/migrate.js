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

import { jelaskanTertahan, pisahkan } from './migrasi-lambat.js'

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
/**
 * Menolak koneksi migrasi yang bukan pemilik basis data.
 *
 * Migrasi membuat tabel, kebijakan, dan peran. Koneksi aplikasi tidak berwenang
 * melakukannya, dan kegagalannya muncul di tengah jalan sebagai "permission
 * denied for schema public" — pesan yang tidak menyebutkan bahwa yang salah
 * adalah kredensialnya, bukan migrasinya.
 *
 * Diperiksa di muka supaya deploy berhenti sebelum menyentuh apa pun. Superuser
 * dibolehkan meski bukan pemilik: ia memang dapat melakukan segalanya, dan itu
 * jalur yang dipakai pengembangan lokal.
 */
async function assertOwner(databaseUrl) {
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    const { rows } = await client.query(
      `SELECT current_user AS peran,
              current_database() AS basis,
              pg_get_userbyid(d.datdba) AS pemilik,
              (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser
         FROM pg_database d
        WHERE d.datname = current_database()`,
    )
    const { peran, basis, pemilik, superuser } = rows[0]

    if (superuser === true || peran === pemilik) return

    throw new Error(
      [
        `Koneksi migrasi memakai peran "${peran}", sedangkan pemilik basis data "${basis}" adalah "${pemilik}".`,
        '',
        'Migrasi membuat tabel, kebijakan, dan peran — koneksi aplikasi tidak berwenang.',
        'Pasang MIGRATION_DATABASE_URL dengan kredensial pemilik (paadu_owner),',
        'lalu jalankan ulang. Jangan sertakan variabel itu di lingkungan runtime.',
      ].join('\n'),
    )
  } finally {
    await client.end()
  }
}

/** Migrasi yang belum tercatat di basis data ini. */
async function tertunda(databaseUrl) {
  const { readdirSync } = await import('node:fs')
  const berkas = readdirSync(MIGRATIONS_DIR)
    .filter((nama) => /^\d{4}_.*\.sql$/.test(nama))
    .map((nama) => nama.replace(/\.sql$/, ''))
    .sort()

  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    const { rows: adaTabel } = await client.query(
      `SELECT to_regclass('public.paadu_migrations') IS NOT NULL AS ada`,
    )
    if (adaTabel[0].ada !== true) return berkas

    const { rows } = await client.query('SELECT name FROM paadu_migrations')
    const diterapkan = new Set(rows.map((baris) => baris.name))
    return berkas.filter((nama) => !diterapkan.has(nama))
  } finally {
    await client.end()
  }
}

export async function migrate(databaseUrl, options = {}) {
  await assertUtf8(databaseUrl)
  await assertOwner(databaseUrl)

  /*
   * Migrasi yang mengunci tabel lama DITOLAK di sini, bukan hanya di CI.
   *
   * CI memeriksa berkas di repo; jalur ini memeriksa apa yang benar-benar akan
   * dijalankan pada basis data ini. Keduanya perlu: berkas yang ditulis
   * langsung di server tidak pernah melewati CI, dan justru itulah yang terjadi
   * saat seseorang sedang memadamkan kebakaran.
   *
   * Penolakan terjadi SEBELUM satu pernyataan pun berjalan.
   */
  const { ditahan } = pisahkan(await tertunda(databaseUrl))
  if (ditahan.length > 0) {
    throw new Error(
      `Migrasi tertahan — tidak dijalankan sebaris dengan deploy.\n${jelaskanTertahan(ditahan)}`,
    )
  }

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
