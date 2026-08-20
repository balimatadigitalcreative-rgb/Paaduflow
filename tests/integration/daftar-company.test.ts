import { randomUUID } from 'node:crypto'

import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { createAppServices } from '#composition/http'
import { buildHttpApp, type PaaduServer } from '#interface/http/app'

import { FakeBreachList, FakeMailer, VALID_PASSWORD } from './harness.js'

/**
 * `GET /v1/me/companies` — pintu masuk seluruh antarmuka.
 *
 * Alurnya dijalankan apa adanya: daftar, masuk, lalu ambil daftar company
 * memakai token yang dikembalikan. Test yang membaca tabel langsung tidak akan
 * menangkap apa pun di sini, karena yang diuji justru apa yang terlihat oleh
 * peran aplikasi di bawah RLS — bukan apa yang ada di tabel.
 *
 * Kueri ini berjalan lewat `asUser`, yang memasang `app.user_id` TANPA
 * `app.tenant_id` — tenant-nya justru yang sedang dicari. Setiap tabel yang
 * ikut di-join harus dapat dibaca dalam konteks itu. RLS diterapkan per tabel
 * dan tidak menular lewat join, jadi satu saja tabel yang hanya mengenal
 * `app.tenant_id` sudah cukup untuk memulangkan daftar kosong.
 */

let admin: Pool
let appPool: Pool
let app: PaaduServer

let tenantSatu: string
let tenantDua: string
let companyA: string
let companyB: string
let companyC: string

let emailAdmin: string
let emailStaf: string
let idAdmin: string
let idStaf: string

async function daftarkan(email: string): Promise<string> {
  const jawaban = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password: VALID_PASSWORD, full_name: 'Pengguna' },
  })
  expect(jawaban.statusCode).toBe(202)

  const { rows } = await admin.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [
    email,
  ])
  return rows[0]!.id
}

async function masuk(email: string): Promise<string> {
  const jawaban = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password: VALID_PASSWORD },
  })
  expect(jawaban.statusCode).toBe(200)
  return jawaban.json().data.access_token as string
}

async function beriAkses(userId: string, tenantId: string, companyId: string, peran: string) {
  await admin.query(
    `INSERT INTO company_access (id, tenant_id, company_id, user_id, role_id)
     SELECT $1, $2, $3, $4, id FROM roles WHERE key = $5 AND tenant_id IS NULL`,
    [randomUUID(), tenantId, companyId, userId, peran],
  )
}

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL
  admin = new Pool({ connectionString })

  // Peran aplikasi, bukan superuser. Inilah yang membuat RLS benar-benar
  // berlaku — sama seperti di produksi.
  appPool = new Pool({ connectionString, options: '-c role=paadu_app' })

  app = await buildHttpApp({
    services: createAppServices({
      pool: appPool,
      tokenSigningSecret: 'rahasia-uji-yang-panjangnya-cukup-32-karakter',
      mfaEncryptionKeyBase64: Buffer.alloc(32, 9).toString('base64'),
      mailer: new FakeMailer(),
      breachList: new FakeBreachList(),
    }),
  })
  await app.ready()

  const tanda = randomUUID().slice(0, 8)
  tenantSatu = randomUUID()
  tenantDua = randomUUID()
  companyA = randomUUID()
  companyB = randomUUID()
  companyC = randomUUID()

  await admin.query(`INSERT INTO tenants (id, name, slug, region) VALUES ($1, $2, $3, 'id-jkt')`, [
    tenantSatu,
    'Grup Merah',
    `merah-${tanda}`,
  ])
  await admin.query(`INSERT INTO tenants (id, name, slug, region) VALUES ($1, $2, $3, 'id-jkt')`, [
    tenantDua,
    'Grup Biru',
    `biru-${tanda}`,
  ])

  for (const [id, tenant, nama, slug] of [
    [companyA, tenantSatu, 'PT Merah Satu', `merah-satu-${tanda}`],
    [companyB, tenantSatu, 'PT Merah Dua', `merah-dua-${tanda}`],
    [companyC, tenantDua, 'PT Biru Satu', `biru-satu-${tanda}`],
  ] as const) {
    await admin.query(
      `INSERT INTO companies (id, tenant_id, legal_name, slug, default_currency)
       VALUES ($1, $2, $3, $4, 'IDR')`,
      [id, tenant, nama, slug],
    )
  }

  emailAdmin = `admin-${tanda}@paaduflow.test`
  emailStaf = `staf-${tanda}@paaduflow.test`
  idAdmin = await daftarkan(emailAdmin)
  idStaf = await daftarkan(emailStaf)

  // Admin: dua company di satu tenant. Staf: dua company yang menyeberang
  // tenant — bentuk yang membuktikan kueri tidak diam-diam bergantung pada
  // satu tenant saja.
  await beriAkses(idAdmin, tenantSatu, companyA, 'company_admin')
  await beriAkses(idAdmin, tenantSatu, companyB, 'company_admin')
  await beriAkses(idStaf, tenantSatu, companyA, 'member')
  await beriAkses(idStaf, tenantDua, companyC, 'member')
})

afterAll(async () => {
  await app.close()
  await appPool.end()
  await admin.end()
})

test('pengguna yang sudah masuk menerima company yang dapat diaksesnya', async () => {
  const token = await masuk(emailAdmin)

  const jawaban = await app.inject({
    method: 'GET',
    url: '/v1/me/companies',
    headers: { authorization: `Bearer ${token}` },
  })

  expect(jawaban.statusCode).toBe(200)
  const daftar = jawaban.json().data as Array<Record<string, string>>

  // Inti bug yang dilaporkan: 200 dengan daftar kosong, padahal barisnya ada.
  expect(daftar).toHaveLength(2)
  expect(daftar.map((baris) => baris.legal_name).sort()).toEqual(['PT Merah Dua', 'PT Merah Satu'])

  // Kolom yang datang dari tabel LAIN lewat join. Bila salah satunya tidak
  // terbaca di bawah RLS, barisnya hilang seluruhnya — bukan kolomnya kosong.
  for (const baris of daftar) {
    expect(baris.tenant_name).toBe('Grup Merah')
    expect(baris.role).toBe('company_admin')
    expect(baris.tenant_id).toBe(tenantSatu)
  }
})

test('daftar menyeberang tenant tanpa konteks tenant lebih dulu', async () => {
  const token = await masuk(emailStaf)

  const jawaban = await app.inject({
    method: 'GET',
    url: '/v1/me/companies',
    headers: { authorization: `Bearer ${token}` },
  })

  expect(jawaban.statusCode).toBe(200)
  const daftar = jawaban.json().data as Array<Record<string, string>>

  expect(daftar).toHaveLength(2)
  expect(daftar.map((baris) => baris.tenant_name).sort()).toEqual(['Grup Biru', 'Grup Merah'])
  expect(daftar.map((baris) => baris.legal_name).sort()).toEqual(['PT Biru Satu', 'PT Merah Satu'])
})

test('company yang tidak diakses tidak ikut terbawa', async () => {
  const token = await masuk(emailStaf)

  const jawaban = await app.inject({
    method: 'GET',
    url: '/v1/me/companies',
    headers: { authorization: `Bearer ${token}` },
  })

  const id = (jawaban.json().data as Array<{ id: string }>).map((baris) => baris.id)

  // Staf tidak diberi akses ke company B, meski ia satu tenant dengan company A
  // yang boleh ia lihat. Melonggarkan pembacaan untuk memperbaiki daftar kosong
  // tidak boleh sampai membuka seluruh tenant.
  expect(id).not.toContain(companyB)
})
