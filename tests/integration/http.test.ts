import { randomUUID } from 'node:crypto'

import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { createAppServices } from '#composition/http'
import { buildHttpApp, type PaaduServer } from '#interface/http/app'

import { FakeBreachList, FakeMailer, VALID_PASSWORD } from './harness.js'

/**
 * Lapisan HTTP diuji lewat `inject`, tanpa soket.
 *
 * Yang diperiksa bukan hanya jalur bahagia, melainkan bentuk jawaban di jalur
 * gagal — karena di situlah kebocoran biasanya terjadi: dua penolakan yang
 * berbeda bentuknya sudah cukup untuk memetakan apa yang ada di sistem.
 */

let admin: Pool
let appPool: Pool
let app: PaaduServer

let tenantId: string
let companyA: string
let companyB: string

let adminEmail: string
let memberEmail: string
let adminToken: string
let memberToken: string
let adminUserId: string
let memberUserId: string
let orangBaru: string

async function seedPengguna(email: string): Promise<string> {
  const daftar = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password: VALID_PASSWORD, full_name: 'Pengguna' },
  })
  expect(daftar.statusCode).toBe(202)

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

async function beriAkses(userId: string, companyId: string, peran: string): Promise<void> {
  await admin.query(
    `INSERT INTO company_access (id, tenant_id, company_id, user_id, role_id)
     SELECT $1, $2, $3, $4, id FROM roles WHERE key = $5 AND tenant_id IS NULL`,
    [randomUUID(), tenantId, companyId, userId, peran],
  )
}

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL
  admin = new Pool({ connectionString })
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

  tenantId = randomUUID()
  companyA = randomUUID()
  companyB = randomUUID()
  const slug = `http-${randomUUID().slice(0, 8)}`

  await admin.query(`INSERT INTO tenants (id, name, slug, region) VALUES ($1, $2, $3, 'id-jkt')`, [
    tenantId,
    'Grup HTTP',
    slug,
  ])
  for (const [id, nama] of [
    [companyA, 'a'],
    [companyB, 'b'],
  ] as const) {
    await admin.query(
      `INSERT INTO companies (id, tenant_id, legal_name, slug, default_currency)
       VALUES ($1, $2, $3, $4, 'IDR')`,
      [id, tenantId, `PT ${nama}`, `${slug}-${nama}`],
    )
  }

  adminEmail = `admin-${slug}@paaduflow.test`
  memberEmail = `member-${slug}@paaduflow.test`
  adminUserId = await seedPengguna(adminEmail)
  memberUserId = await seedPengguna(memberEmail)
  orangBaru = await seedPengguna(`baru-${slug}@paaduflow.test`)

  await beriAkses(adminUserId, companyA, 'company_admin')
  await beriAkses(memberUserId, companyA, 'member')

  adminToken = await masuk(adminEmail)
  memberToken = await masuk(memberEmail)
})

afterAll(async () => {
  await app.close()
  await appPool.end()
  await admin.end()
})

test('X-Request-Id dikembalikan, dan dipakai apa adanya bila klien mengirimnya', async () => {
  const sendiri = await app.inject({ method: 'GET', url: '/v1/me/sessions' })
  expect(sendiri.headers['x-request-id']).toBeTruthy()

  const diteruskan = await app.inject({
    method: 'GET',
    url: '/v1/me/sessions',
    headers: { 'x-request-id': 'jejak-dari-gateway' },
  })
  // Rantai jejak yang dimulai di gateway tidak boleh putus di sini.
  expect(diteruskan.headers['x-request-id']).toBe('jejak-dari-gateway')
})

test('tanpa token, jawabannya 401 dalam amplop yang sama', async () => {
  const jawaban = await app.inject({ method: 'GET', url: '/v1/me/sessions' })

  expect(jawaban.statusCode).toBe(401)
  expect(jawaban.json()).toEqual({
    success: false,
    message: 'Diperlukan autentikasi.',
    errors: [{ code: 'unauthenticated' }],
  })
})

test('registrasi selalu 202, baik email baru maupun sudah terdaftar', async () => {
  const ulang = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email: adminEmail, password: 'kata sandi lain yang panjang', full_name: 'Penyerang' },
  })

  expect(ulang.statusCode).toBe(202)
  expect(ulang.json().message).toContain('Bila email tersebut dapat didaftarkan')
})

test('daftar sesi menandai perangkat yang sedang dipakai', async () => {
  const jawaban = await app.inject({
    method: 'GET',
    url: '/v1/me/sessions',
    headers: { authorization: `Bearer ${memberToken}` },
  })

  expect(jawaban.statusCode).toBe(200)
  const sesi = jawaban.json().data as { current: boolean }[]
  expect(sesi.filter((item) => item.current)).toHaveLength(1)
})

test('company yang tidak diakses dan company yang tidak ada menjawab sama persis', async () => {
  const companyLain = await app.inject({
    method: 'GET',
    url: `/v1/companies/${companyB}/access`,
    headers: { authorization: `Bearer ${memberToken}` },
  })
  const companyKarangan = await app.inject({
    method: 'GET',
    url: `/v1/companies/${randomUUID()}/access`,
    headers: { authorization: `Bearer ${memberToken}` },
  })

  expect(companyLain.statusCode).toBe(403)
  // Bentuk dan isinya identik. Mengganti id di path tidak memberi tahu apa pun
  // tentang company mana yang benar-benar ada.
  expect(companyKarangan.json()).toEqual(companyLain.json())
})

test('member boleh membaca daftar akses, dengan meta berbasis kursor', async () => {
  const jawaban = await app.inject({
    method: 'GET',
    url: `/v1/companies/${companyA}/access?per_page=1`,
    headers: { authorization: `Bearer ${memberToken}` },
  })

  expect(jawaban.statusCode).toBe(200)
  const badan = jawaban.json()
  expect(badan.data).toHaveLength(1)
  expect(badan.meta.total).toBe(2)
  expect(badan.meta.next_cursor).toBeTruthy()
  // Tidak ada `page` di mana pun — D-041.
  expect(Object.keys(badan.meta)).not.toContain('page')

  const halamanKedua = await app.inject({
    method: 'GET',
    url: `/v1/companies/${companyA}/access?per_page=1&cursor=${encodeURIComponent(badan.meta.next_cursor as string)}`,
    headers: { authorization: `Bearer ${memberToken}` },
  })
  expect(halamanKedua.json().data[0].id).not.toBe(badan.data[0].id)
})

test('member tidak boleh memberi akses — permission_denied, bukan 500', async () => {
  const jawaban = await app.inject({
    method: 'POST',
    url: `/v1/companies/${companyA}/access`,
    headers: { authorization: `Bearer ${memberToken}` },
    payload: { user_id: orangBaru, role: 'member' },
  })

  expect(jawaban.statusCode).toBe(403)
  expect(jawaban.json().errors[0]).toEqual({
    code: 'permission_denied',
    required: 'identitas.pengguna.kelola:company',
    ask: 'Admin Company',
  })
})

test('admin company tidak dapat memberikan peran di atas dirinya', async () => {
  const jawaban = await app.inject({
    method: 'POST',
    url: `/v1/companies/${companyA}/access`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { user_id: orangBaru, role: 'tenant_owner' },
  })

  expect(jawaban.statusCode).toBe(403)
})

test('idempotency: kunci yang sama tidak membuat akses dua kali', async () => {
  const kunci = randomUUID()
  const payload = { user_id: orangBaru, role: 'member' }

  const pertama = await app.inject({
    method: 'POST',
    url: `/v1/companies/${companyA}/access`,
    headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': kunci },
    payload,
  })
  expect(pertama.statusCode).toBe(201)

  const kedua = await app.inject({
    method: 'POST',
    url: `/v1/companies/${companyA}/access`,
    headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': kunci },
    payload,
  })
  expect(kedua.statusCode).toBe(201)
  expect(kedua.headers['idempotency-replayed']).toBe('true')
  expect(kedua.json()).toEqual(pertama.json())

  const { rows } = await admin.query(
    'SELECT id FROM company_access WHERE company_id = $1 AND user_id = $2',
    [companyA, orangBaru],
  )
  expect(rows).toHaveLength(1)
})

test('kunci idempotency yang sama dengan isi berbeda ditolak', async () => {
  const kunci = randomUUID()

  await app.inject({
    method: 'POST',
    url: `/v1/companies/${companyA}/access`,
    headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': kunci },
    payload: { user_id: orangBaru, role: 'member' },
  })

  const berbeda = await app.inject({
    method: 'POST',
    url: `/v1/companies/${companyA}/access`,
    headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': kunci },
    payload: { user_id: memberUserId, role: 'member' },
  })

  expect(berbeda.statusCode).toBe(422)
  expect(berbeda.json().errors[0].code).toBe('idempotency_key_reused')
})

test('badan permintaan yang tidak valid menjadi 400 dalam amplop yang sama', async () => {
  const jawaban = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: 'bukan-email', password: '' },
  })

  expect(jawaban.statusCode).toBe(400)
  expect(jawaban.json().errors[0].code).toBe('validation_failed')
})

test('OpenAPI dibangkitkan dari skema rute yang sama dengan yang memvalidasi', async () => {
  const jawaban = await app.inject({ method: 'GET', url: '/openapi.json' })

  expect(jawaban.statusCode).toBe(200)
  const dokumen = jawaban.json() as { paths: Record<string, unknown> }

  expect(Object.keys(dokumen.paths)).toEqual(
    expect.arrayContaining([
      '/v1/auth/register',
      '/v1/auth/login',
      '/v1/auth/refresh',
      '/v1/companies/{companyId}/access',
    ]),
  )
  // Dokumen tidak mendokumentasikan dirinya sendiri.
  expect(Object.keys(dokumen.paths)).not.toContain('/openapi.json')
})

test('alamat yang tidak dikenal juga memakai amplop yang sama', async () => {
  const jawaban = await app.inject({ method: 'GET', url: '/v1/tidak-ada' })

  expect(jawaban.statusCode).toBe(404)
  expect(jawaban.json().errors[0].code).toBe('not_found')
})
