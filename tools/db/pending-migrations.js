#!/usr/bin/env node
/**
 * Migrasi yang belum diterapkan pada sebuah basis data.
 *
 * Dipakai `npm run deploy` untuk menjawab satu pertanyaan sebelum meminta
 * konfirmasi: apa yang akan berjalan. Deploy yang bertanya "jalankan migrasi?"
 * tanpa menyebutkan migrasi apa hanya memindahkan tebakan ke manusia.
 *
 * Membaca saja. Ia tidak pernah menerapkan apa pun.
 *
 * Keluaran: satu nama per baris di stdout, kosong bila tidak ada. Status keluar
 * tetap 0 dalam kedua keadaan — "tidak ada migrasi baru" bukan kegagalan.
 */

import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations', import.meta.url))

/** Sama dengan `ignorePattern` di migrate.js: hanya `0001_nama.sql`. */
const BERNOMOR = /^\d{4}_.*\.sql$/

const databaseUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL
if (databaseUrl === undefined || databaseUrl === '') {
  console.error('MIGRATION_DATABASE_URL maupun DATABASE_URL belum dipasang.')
  process.exit(1)
}

const berkas = (await readdir(MIGRATIONS_DIR))
  .filter((nama) => BERNOMOR.test(nama))
  .map((nama) => nama.replace(/\.sql$/, ''))
  .sort()

const client = new pg.Client({ connectionString: databaseUrl })
await client.connect()

try {
  // Tabelnya belum ada pada basis data yang belum pernah dimigrasikan. Itu
  // bukan galat — artinya SELURUH migrasi masih tertunda.
  const { rows: adaTabel } = await client.query(
    `SELECT to_regclass('public.paadu_migrations') IS NOT NULL AS ada`,
  )

  const diterapkan = new Set()
  if (adaTabel[0].ada === true) {
    const { rows } = await client.query('SELECT name FROM paadu_migrations')
    for (const baris of rows) diterapkan.add(baris.name)
  }

  for (const nama of berkas) {
    if (!diterapkan.has(nama)) console.log(nama)
  }
} finally {
  await client.end()
}
