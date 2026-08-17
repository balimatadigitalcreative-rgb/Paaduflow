import { randomUUID } from 'node:crypto'

import { Client } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { migrate } from '../../tools/db/migrate.js'

import { databaseUrl } from './database.js'

/**
 * Migrasi dijalankan sebagai peran NON-superuser, tanpa BYPASSRLS.
 *
 * Seluruh test lain terhubung sebagai superuser, dan superuser melewati Row
 * Level Security sepenuhnya — termasuk kebijakan yang menolak barisnya sendiri.
 * Akibatnya satu kelas bug tidak pernah terlihat di lokal dan baru muncul saat
 * deploy, ketika migrasi berjalan sebagai `paadu_owner` sebagaimana dirancang.
 *
 * Itu persis yang terjadi pada `roles` di 0011: WITH CHECK menolak `tenant_id`
 * NULL yang USING-nya izinkan, dan karena tabelnya FORCE ROW LEVEL SECURITY,
 * pemilik tabel pun tunduk. Diperbaiki 0023; test ini yang menjaga agar kelas
 * bug itu tidak lolos lagi.
 *
 * Yang diuji bukan satu kebijakan, melainkan bahwa SELURUH migrasi dapat
 * dijalani peran yang tunduk RLS — dari basis data kosong sampai selesai.
 */

const PERAN = `paadu_migrasi_uji_${randomUUID().slice(0, 8)}`
const SANDI = 'sandi-uji-migrasi'
const BASIS = `paadu_migrasi_uji_${randomUUID().slice(0, 8)}`

let admin: Client
let urlNonSuperuser: string

/** URL yang sama dengan test lain, tetapi menunjuk basis data dan peran lain. */
function gantiKredensial(asal: string, peran: string, sandi: string, basis: string): string {
  const url = new URL(asal)
  url.username = peran
  url.password = sandi
  url.pathname = `/${basis}`
  return url.toString()
}

beforeAll(async () => {
  admin = new Client({ connectionString: databaseUrl() })
  await admin.connect()

  // NOSUPERUSER dan NOBYPASSRLS ditulis eksplisit meski itu bawaan — merekalah
  // seluruh alasan test ini ada, dan bawaan yang tidak tertulis adalah bawaan
  // yang suatu hari berubah tanpa ada yang sadar.
  //
  // CREATEROLE dibutuhkan karena 0001 membuat paadu_app dan paadu_analytics.
  await admin.query(
    `CREATE ROLE ${PERAN} LOGIN PASSWORD '${SANDI}' NOSUPERUSER NOBYPASSRLS CREATEROLE`,
  )
  await admin.query(`CREATE DATABASE ${BASIS} OWNER ${PERAN} ENCODING 'UTF8' TEMPLATE template0`)

  urlNonSuperuser = gantiKredensial(databaseUrl(), PERAN, SANDI, BASIS)
}, 120_000)

afterAll(async () => {
  // Basis data dilepas lebih dulu; peran tidak dapat dihapus selagi memiliki
  // objek. Kegagalan pembersihan bukan alasan menggagalkan test yang lulus.
  await admin.query(`DROP DATABASE IF EXISTS ${BASIS} WITH (FORCE)`).catch(() => undefined)
  await admin.query(`DROP ROLE IF EXISTS ${PERAN}`).catch(() => undefined)
  await admin.end()
})

test('peran ujinya benar-benar tanpa superuser dan tanpa BYPASSRLS', async () => {
  const { rows } = await admin.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
    'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1',
    [PERAN],
  )

  // Bila salah satu true, seluruh test di bawah menjadi teater: ia akan lulus
  // justru karena RLS tidak pernah diterapkan.
  expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false })
})

test('seluruh migrasi berjalan dari basis data kosong sebagai peran non-superuser', async () => {
  const diterapkan = await migrate(urlNonSuperuser)

  // Bukan sekadar "tidak melempar": seluruh berkas migrasi harus terpakai.
  expect(diterapkan.length).toBeGreaterThan(0)
  expect(diterapkan).toContain('0011_authorization')
  expect(diterapkan).toContain('0023_rls_peran_bawaan')
}, 180_000)

test('peran bawaan sistem benar-benar tersisip, bukan diam-diam terlewat', async () => {
  const klien = new Client({ connectionString: urlNonSuperuser })
  await klien.connect()
  try {
    const { rows } = await klien.query<{ key: string }>(
      `SELECT key FROM roles WHERE tenant_id IS NULL AND is_system ORDER BY key`,
    )
    // Inilah baris yang dulu ditolak kebijakannya sendiri.
    expect(rows.map((baris) => baris.key)).toContain('tenant_owner')
    expect(rows.length).toBeGreaterThan(1)
  } finally {
    await klien.end()
  }
})

test('paadu_app tetap tidak dapat membuat peran global maupun peran sistem', async () => {
  await admin.query(`GRANT paadu_app TO ${PERAN}`)

  // Tenant diseed superuser. Peran migrasi pun tunduk RLS pada `tenants`, dan
  // yang sedang diuji di bawah bukan itu.
  const tenantId = randomUUID()
  const seeder = new Client({
    connectionString: gantiKredensial(databaseUrl(), 'postgres', 'postgres', BASIS),
  })
  await seeder.connect()
  await seeder.query(
    `INSERT INTO tenants (id, name, slug, region) VALUES ($1, 'Tenant Uji', $2, 'id-jkt')`,
    [tenantId, `uji-${tenantId.slice(0, 8)}`],
  )
  await seeder.end()

  const klien = new Client({ connectionString: urlNonSuperuser })
  await klien.connect()
  try {
    await klien.query('SET ROLE paadu_app')
    await klien.query('SELECT set_config($1, $2, false)', ['app.tenant_id', tenantId])

    // Peran global: terlihat SELURUH tenant bila lolos.
    await expect(
      klien.query(
        `INSERT INTO roles (id, tenant_id, key, name, rank) VALUES ($1, NULL, 'curang', 'Curang', 99)`,
        [randomUUID()],
      ),
    ).rejects.toThrow(/row-level security/i)

    // Peran sistem milik tenant sendiri: tetap ditolak.
    await expect(
      klien.query(
        `INSERT INTO roles (id, tenant_id, key, name, is_system, rank)
         VALUES ($1, $2, 'palsu', 'Palsu', true, 98)`,
        [randomUUID(), tenantId],
      ),
    ).rejects.toThrow(/row-level security/i)

    // Peran biasa milik tenant sendiri tetap boleh — pembatasannya tidak
    // menutup jalur yang sah.
    await klien.query(
      `INSERT INTO roles (id, tenant_id, key, name, rank) VALUES ($1, $2, 'kustom', 'Kustom', 50)`,
      [randomUUID(), tenantId],
    )
  } finally {
    await klien.end()
  }
})

test('paadu_app tetap dapat MEMBACA peran bawaan sistem', async () => {
  // Keanggotaan diberikan superuser setelah 0001 membuat perannya. Di produksi
  // paadu_app dipakai lewat koneksi tersendiri, bukan lewat SET ROLE.
  await admin.query(`GRANT paadu_app TO ${PERAN}`)

  const klien = new Client({ connectionString: urlNonSuperuser })
  await klien.connect()
  try {
    await klien.query('SET ROLE paadu_app')
    const { rows } = await klien.query<{ n: string }>(
      `SELECT count(1) AS n FROM roles WHERE tenant_id IS NULL`,
    )
    // Menutup baca akan mematahkan pemberian akses company, yang mencari peran
    // bawaan justru lewat `WHERE tenant_id IS NULL`.
    expect(Number(rows[0]!.n)).toBeGreaterThan(0)
  } finally {
    await klien.end()
  }
})
