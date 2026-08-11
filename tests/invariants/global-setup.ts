import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import { Client } from 'pg'

import { migrate } from '../../tools/db/migrate.js'

/**
 * Satu PostgreSQL sungguhan untuk seluruh test invarian.
 *
 * Row-level security dan pencabutan hak tidak dapat dipalsukan — basis data
 * tiruan akan meluluskan tepat kelas kesalahan yang paling mahal. Karena itu
 * test ini menolak berjalan tanpa Postgres nyata.
 *
 * Bila `TEST_DATABASE_URL` sudah dipasang, ia yang dipakai — itu jalur CI, tempat
 * Postgres berjalan sebagai service container. Bila tidak, sebuah instans
 * disalakan di direktori sementara. Keduanya tidak memerlukan Docker.
 */

let stop: (() => Promise<void>) | null = null

export async function setup(): Promise<void> {
  if (process.env.TEST_DATABASE_URL !== undefined && process.env.TEST_DATABASE_URL !== '') {
    await migrate(process.env.TEST_DATABASE_URL)
    return
  }

  const dataDir = await mkdtemp(join(tmpdir(), 'paadu-pg-'))
  const port = 55000 + Math.floor(Math.random() * 2000)

  const postgres = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  })

  await postgres.initialise()
  await postgres.start()

  stop = async () => {
    await postgres.stop()
    await rm(dataDir, { recursive: true, force: true })
  }

  // Sejak titik ini instans sudah berjalan. Kegagalan apa pun harus tetap
  // mematikannya — proses Postgres yang tertinggal akan menahan port dan
  // membuat jalannya test berikutnya gagal karena sebab yang salah.
  try {
    // Bukan createDatabase() bawaan: di Windows, klaster mewarisi locale sistem
    // dan basis data barunya lahir ber-encoding WIN1252. Encoding itu tidak dapat
    // memuat teks yang dipakai produk ini.
    const admin = new Client({
      connectionString: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`,
    })
    await admin.connect()
    await admin.query(
      `CREATE DATABASE paadu_test
         WITH ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`,
    )
    await admin.end()

    const url = `postgresql://postgres:postgres@127.0.0.1:${port}/paadu_test`
    await migrate(url)
    process.env.TEST_DATABASE_URL = url
  } catch (error) {
    await stop()
    stop = null
    throw error
  }
}

export async function teardown(): Promise<void> {
  if (stop !== null) await stop()
}
