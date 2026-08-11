import { randomUUID } from 'node:crypto'

import { Pool, type QueryResult, type QueryResultRow } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { AuthorizationService } from '#application/identity/authorization'
import { scopeToFilter } from '#domain/identity/permission'
import type { Queryable } from '#infrastructure/db/queryable'
import { ScopedStore, type EntityDescriptor } from '#infrastructure/db/scoped-store'
import { PostgresUnitOfWork } from '#infrastructure/db/unit-of-work'
import { PostgresAuthorizationRepository } from '#infrastructure/modules/identity/postgres-authorization-repository'

/**
 * Tiga jalur kebocoran lintas company, diuji terpisah — Modul 02 §12.
 *
 * Diuji terpisah karena ketiganya ditulis oleh orang yang berbeda pada waktu
 * yang berbeda. Endpoint utama hampir selalu benar; yang bocor adalah pencarian
 * global dan laporan, karena keduanya merakit kuerinya sendiri.
 */

const TABEL = 'kebocoran_probe'

const ENTITAS: EntityDescriptor = {
  name: 'dokumen',
  table: TABEL,
  labelColumn: 'judul',
  searchColumns: ['judul'],
}

const IZIN = { key: 'organisasi.company.baca', scope: 'company' as const }

/** Mencatat SQL yang benar-benar dikirim ke basis data. */
class PerekamKueri implements Queryable {
  readonly pernyataan: { text: string; values: readonly unknown[] }[] = []

  constructor(private readonly inner: Queryable) {}

  async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<R>> {
    this.pernyataan.push({ text, values: values ?? [] })
    return this.inner.query<R>(text, values)
  }

  terakhir(): { text: string; values: readonly unknown[] } {
    const akhir = this.pernyataan.at(-1)
    if (akhir === undefined) throw new Error('Belum ada kueri yang dijalankan.')
    return akhir
  }
}

let admin: Pool
let app: Pool
let unitOfWork: PostgresUnitOfWork

let tenantId: string
let companyA: string
let companyB: string
let userId: string

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL
  admin = new Pool({ connectionString })
  app = new Pool({ connectionString, options: '-c role=paadu_app' })
  unitOfWork = new PostgresUnitOfWork(app)

  tenantId = randomUUID()
  companyA = randomUUID()
  companyB = randomUUID()
  userId = randomUUID()
  const slug = `bocor-${randomUUID().slice(0, 8)}`

  await admin.query(`INSERT INTO tenants (id, name, slug, region) VALUES ($1, $2, $3, 'id-jkt')`, [
    tenantId,
    'Grup Uji',
    slug,
  ])
  for (const [id, nama] of [
    [companyA, 'a'],
    [companyB, 'b'],
  ] as const) {
    await admin.query(
      `INSERT INTO companies (id, tenant_id, legal_name, slug, default_currency)
       VALUES ($1, $2, $3, $4, 'IDR')`,
      [id, tenantId, `PT ${nama.toUpperCase()}`, `${slug}-${nama}`],
    )
  }
  await admin.query(
    `INSERT INTO users (id, email, full_name) VALUES ($1, $2, 'Pengguna A')`,
    [userId, `${slug}@paaduflow.test`],
  )
  await admin.query(
    `INSERT INTO company_access (id, tenant_id, company_id, user_id, role_id)
     SELECT $1, $2, $3, $4, id FROM roles WHERE key = 'member' AND tenant_id IS NULL`,
    [randomUUID(), tenantId, companyA, userId],
  )

  // Tabel probe dibuat lewat kontrak transaksional yang sama dengan modul mana
  // pun — supaya yang diuji adalah mekanismenya, bukan tabel istimewa.
  await admin.query(`
    CREATE TABLE ${TABEL} (
      id uuid NOT NULL,
      tenant_id uuid NOT NULL,
      judul text NOT NULL,
      nilai numeric(19,4) NOT NULL DEFAULT 0
    )
  `)
  await admin.query('SELECT paadu.apply_transactional_contract($1)', [TABEL])

  for (const [company, judul, nilai] of [
    [companyA, 'Faktur Terbuka A', 1_000_000],
    [companyA, 'Faktur Lunas A', 2_000_000],
    [companyB, 'Rahasia Perusahaan B', 9_000_000],
    [companyB, 'Rahasia Kedua B', 500_000],
  ] as const) {
    await admin.query(
      `INSERT INTO ${TABEL} (id, tenant_id, company_id, judul, nilai, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [randomUUID(), tenantId, company, judul, nilai, userId],
    )
  }
})

afterAll(async () => {
  await admin.query(`DROP TABLE IF EXISTS ${TABEL}`)
  await admin.query('DELETE FROM paadu.transactional_tables WHERE table_name = $1', [TABEL])
  await admin.end()
  await app.end()
})

async function dalamKonteks<T>(fn: (db: Queryable) => Promise<T>): Promise<T> {
  return unitOfWork.inTenant({ tenantId, userId }, fn)
}

function layanan(db: Queryable): AuthorizationService {
  return new AuthorizationService(new PostgresAuthorizationRepository(db))
}

test('dasar: pengguna melihat company yang memang boleh ia lihat', async () => {
  const hasil = await dalamKonteks(async (db) => {
    const filter = await layanan(db).filterFor({ userId, companyId: companyA }, IZIN)
    return new ScopedStore(db).list(ENTITAS, filter)
  })

  expect(hasil).toHaveLength(2)
  expect(hasil.map((baris) => baris.label).sort()).toEqual(['Faktur Lunas A', 'Faktur Terbuka A'])
})

test('jalur 1 — manipulasi path: meminta company B lewat id di path', async () => {
  const hasil = await dalamKonteks(async (db) => {
    // Persis yang terjadi bila seseorang mengganti id company di URL. Konteks
    // company adalah masukan pengguna, sama tidak tepercayanya dengan isian form.
    const filter = await layanan(db).filterFor({ userId, companyId: companyB }, IZIN)
    return new ScopedStore(db).list(ENTITAS, filter)
  })

  expect(hasil).toEqual([])
})

test('jalur 2 — pencarian global tidak mengakui keberadaan hasil terlarang', async () => {
  const { diizinkan, terlarang } = await dalamKonteks(async (db) => {
    const service = layanan(db)
    const store = new ScopedStore(db)

    const filterA = await service.filterFor({ userId, companyId: companyA }, IZIN)
    const filterB = await service.filterFor({ userId, companyId: companyB }, IZIN)

    return {
      diizinkan: await store.search([{ entity: ENTITAS, filter: filterA }], 'Faktur'),
      terlarang: await store.search([{ entity: ENTITAS, filter: filterB }], 'Rahasia'),
    }
  })

  expect(diizinkan).toHaveLength(2)

  // Bukan "2 hasil disembunyikan". Bagi pengguna ini, data itu tidak ada.
  expect(terlarang).toEqual([])
})

test('jalur 3 — laporan: satu angka total pun tidak boleh bocor', async () => {
  const { totalA, totalB } = await dalamKonteks(async (db) => {
    const service = layanan(db)
    const store = new ScopedStore(db)

    return {
      totalA: await store.sum(
        ENTITAS,
        await service.filterFor({ userId, companyId: companyA }, IZIN),
        'nilai',
      ),
      totalB: await store.sum(
        ENTITAS,
        await service.filterFor({ userId, companyId: companyB }, IZIN),
        'nilai',
      ),
    }
  })

  expect(totalA).toBe(3_000_000)

  // Angka total terasa seperti tidak mengungkapkan baris, padahal ia cukup
  // untuk menyimpulkan omzet company yang tidak boleh dilihat.
  expect(totalB).toBe(0)
})

test('penyaringan terjadi di basis data, bukan setelah data diambil', async () => {
  const { sql, values, jumlahBaris } = await dalamKonteks(async (db) => {
    const perekam = new PerekamKueri(db)
    const filter = await layanan(perekam).filterFor({ userId, companyId: companyA }, IZIN)
    const baris = await new ScopedStore(perekam).list(ENTITAS, filter)
    const terakhir = perekam.terakhir()
    return { sql: terakhir.text, values: terakhir.values, jumlahBaris: baris.length }
  })

  // SQL yang benar-benar dikirim, bukan hasil akhirnya.
  expect(sql).toContain('t.tenant_id = $1::uuid')
  expect(sql).toContain('t.company_id = ANY($2::uuid[])')
  expect(sql).toContain('t.deleted_at IS NULL')
  expect(values[0]).toBe(tenantId)
  expect(values[1]).toEqual([companyA])
  expect(jumlahBaris).toBe(2)
})

test('cakupan own menyempit ke baris yang dibuat pengguna itu sendiri', async () => {
  const oranglain = randomUUID()
  await admin.query(
    `INSERT INTO ${TABEL} (id, tenant_id, company_id, judul, nilai, created_by)
     VALUES ($1, $2, $3, 'Milik Orang Lain', 100, $4)`,
    [randomUUID(), tenantId, companyA, oranglain],
  )

  const hasil = await dalamKonteks(async (db) =>
    new ScopedStore(db).list(
      ENTITAS,
      scopeToFilter('own', {
        tenantId,
        userId,
        companyId: companyA,
        accessibleCompanyIds: [companyA],
      }),
    ),
  )

  expect(hasil).toHaveLength(2)
  expect(hasil.map((baris) => baris.label)).not.toContain('Milik Orang Lain')
})

test('izin yang tidak dimiliki menghasilkan permission_denied, bukan daftar kosong yang menjelaskan', async () => {
  const keputusan = await dalamKonteks(async (db) =>
    layanan(db).authorize(
      { userId, companyId: companyA },
      { key: 'organisasi.company.kelola', scope: 'company' },
    ),
  )

  expect(keputusan).toEqual({
    allowed: false,
    denial: {
      code: 'permission_denied',
      required: 'organisasi.company.kelola:company',
      ask: 'Admin Company',
    },
  })
})

test('izin yang tidak ada di katalog ditolak, bukan diterima', async () => {
  const keputusan = await dalamKonteks(async (db) =>
    layanan(db).authorize(
      { userId, companyId: companyA },
      { key: 'salah.ketik.saja', scope: 'company' },
    ),
  )

  expect(keputusan.allowed).toBe(false)
})
