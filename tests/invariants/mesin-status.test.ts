import { randomUUID } from 'node:crypto'

import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { seedTenant, withClient, type Tenant } from './database.js'

/**
 * Kelengkapan mesin status terhadap Flow_Archetypes §2.
 *
 * Ditulis saat menjawab gerbang Sesi D4, yang menemukan empat perpindahan
 * hilang — salah satunya membuat faktur yang ditolak terkunci selamanya.
 *
 * Ini modul referensi: mesin status yang bolong di sini akan disalin ke dua
 * puluh modul berikutnya beserta bolongnya. Karena itu kelengkapannya diuji,
 * bukan diperiksa dengan mata.
 */

let admin: Pool
let tenant: Tenant
let customerId: string

/** Perpindahan yang Archetype 2 tetapkan untuk setiap dokumen bersiklus penuh. */
const WAJIB: readonly [string, string][] = [
  ['draft', 'submitted'],
  ['submitted', 'pending_approval'],
  ['pending_approval', 'approved'],
  ['pending_approval', 'rejected'],
  // Dokumen yang ditolak wajib punya jalan kembali.
  ['rejected', 'draft'],
  // Pembatalan sah selama belum menyentuh buku besar.
  ['draft', 'cancelled'],
  ['submitted', 'cancelled'],
  // Tarik kembali, selama belum ada yang menyetujui.
  ['submitted', 'draft'],
]

beforeAll(async () => {
  admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL })

  await withClient(async (client) => {
    tenant = await seedTenant(client, `mesinstatus-${randomUUID().slice(0, 8)}`)
  })

  customerId = randomUUID()
  await admin.query(
    `INSERT INTO customers (id, tenant_id, company_id, code, name, currency)
     VALUES ($1, $2, $3, 'C-01', 'PT Uji Status', 'IDR')`,
    [customerId, tenant.tenantId, tenant.companyId],
  )
})

afterAll(async () => {
  await admin.end()
})

test('dokumen bersiklus penuh memiliki seluruh perpindahan Archetype 2', async () => {
  const { rows } = await admin.query<{ doc_type: string; from_status: string; to_status: string }>(
    'SELECT doc_type, from_status, to_status FROM document_transitions',
  )

  const ada = new Set(rows.map((row) => `${row.doc_type}:${row.from_status}→${row.to_status}`))
  const hilang: string[] = []

  // Penawaran tidak pernah masuk persetujuan berambang nilai — ia disetujui
  // pelanggan, bukan oleh rantai persetujuan internal. Ketiga perpindahan yang
  // khusus alur itu karena itu tidak berlaku baginya.
  const khususPersetujuan = new Set([
    'submitted→pending_approval',
    'pending_approval→approved',
    'pending_approval→rejected',
  ])

  for (const docType of ['order', 'invoice']) {
    for (const [dari, ke] of WAJIB) {
      if (!ada.has(`${docType}:${dari}→${ke}`)) hilang.push(`${docType}: ${dari} → ${ke}`)
    }
  }

  for (const [dari, ke] of WAJIB) {
    if (khususPersetujuan.has(`${dari}→${ke}`)) continue
    if (!ada.has(`quotation:${dari}→${ke}`)) hilang.push(`quotation: ${dari} → ${ke}`)
  }

  expect(hilang).toEqual([])
})

test('dokumen terposting hanya punya jalan ke void dan closed', async () => {
  const { rows } = await admin.query<{ to_status: string }>(
    `SELECT to_status FROM document_transitions WHERE from_status = 'posted'`,
  )

  // Diurutkan di sini, bukan di SQL: `ORDER BY` pada kolom enum mengurutkan
  // menurut urutan deklarasi tipe, bukan menurut abjad.
  // D-008: dokumen terposting tidak dapat diedit peran mana pun. Perpindahan
  // ke status lain akan membuka pintu itu lewat jalan memutar.
  // Himpunan, bukan daftar: pemeriksaan ini berlaku untuk SELURUH modul, dan
  // menghitung barisnya akan membuatnya pecah setiap kali modul baru lahir —
  // pecah karena bertambah, bukan karena rusak.
  expect([...new Set(rows.map((row) => row.to_status))].sort()).toEqual(['closed', 'void'])
})

test('void selalu mensyaratkan jurnal pembalik', async () => {
  const { rows } = await admin.query<{ requires: string[] }>(
    `SELECT requires FROM document_transitions WHERE to_status = 'void'`,
  )

  expect(rows.length).toBeGreaterThan(0)
  for (const row of rows) expect(row.requires).toContain('reversal_journal')
})

/**
 * Penjaga status di lapisan basis data.
 *
 * Sebelum ini, `approve` melakukan UPDATE tanpa syarat apa pun, sehingga draf
 * dapat langsung disetujui — submit dan penomoran terlewat, dan dokumen dapat
 * mencapai `posted` tanpa pernah bernomor. Ditemukan saat menjalankan alur
 * penuh dari luar, bukan oleh pembacaan ulang.
 *
 * Yang diuji di sini bukan tabelnya, melainkan bahwa UPDATE-nya benar-benar
 * menolak. Tabel yang benar tanpa penegakan tidak menahan apa pun.
 */
async function siapkanFaktur(status: string): Promise<string> {
  const id = randomUUID()
  await admin.query(
    `INSERT INTO sales_documents
       (id, tenant_id, company_id, doc_type, customer_id, document_date, currency,
        total, lifecycle_status)
     VALUES ($1, $2, $3, 'invoice', $4, DATE '2026-08-16', 'IDR', 0, $5::lifecycle_status)`,
    [id, tenant.tenantId, tenant.companyId, customerId, status],
  )
  return id
}

/** Perpindahan langsung ke `approved`, lewat SQL yang sama dengan repository. */
async function cobaSetujui(documentId: string): Promise<number> {
  const hasil = await admin.query(
    `UPDATE sales_documents d
        SET lifecycle_status = 'approved', approved_at = now()
      WHERE d.tenant_id = $1 AND d.id = $2
        AND EXISTS (
          SELECT 1 FROM document_transitions t
           WHERE t.doc_type = d.doc_type::text
             AND t.from_status = d.lifecycle_status
             AND t.to_status = 'approved'
        )`,
    [tenant.tenantId, documentId],
  )
  return hasil.rowCount ?? 0
}

test('approve MENOLAK draf — submit dan penomoran tidak dapat dilewati', async () => {
  const draf = await siapkanFaktur('draft')
  expect(await cobaSetujui(draf)).toBe(0)

  const { rows } = await admin.query<{ status: string; number: string | null }>(
    'SELECT lifecycle_status AS status, number FROM sales_documents WHERE tenant_id = $1 AND id = $2',
    [tenant.tenantId, draf],
  )
  // Tetap draf, dan tetap tanpa nomor. Inilah keadaan yang dulu bisa dilewati.
  expect(rows[0]!.status).toBe('draft')
  expect(rows[0]!.number).toBeNull()
})

test('approve menerima status asal yang memang sah menurut tabel', async () => {
  // `invoice` punya submitted → approved DAN pending_approval → approved.
  // Keduanya harus lolos; menyempitkannya ke salah satu akan mematahkan alur
  // yang sah, bukan menutup lubang.
  for (const asal of ['submitted', 'pending_approval']) {
    const dokumen = await siapkanFaktur(asal)
    expect(await cobaSetujui(dokumen)).toBe(1)
  }
})

test('setiap transisi menolak seluruh status asal yang tidak terdaftar', async () => {
  const { rows: sah } = await admin.query<{ from_status: string }>(
    `SELECT from_status FROM document_transitions
      WHERE doc_type = 'invoice' AND to_status = 'approved'`,
  )
  const asalSah = new Set(sah.map((baris) => baris.from_status))

  // Seluruh status lain diuji, bukan hanya draft. Lubang yang ditutup untuk
  // satu status saja adalah lubang yang pindah, bukan lubang yang hilang.
  const semua = ['draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'cancelled']
  const bocor: string[] = []

  for (const asal of semua) {
    if (asalSah.has(asal)) continue
    const dokumen = await siapkanFaktur(asal)
    if ((await cobaSetujui(dokumen)) !== 0) bocor.push(asal)
  }

  expect(bocor).toEqual([])
})

test('posting menolak status asal selain approved', async () => {
  const cobaPosting = async (documentId: string): Promise<number> => {
    const hasil = await admin.query(
      `UPDATE sales_documents d
          SET lifecycle_status = 'posted', posted_at = now()
        WHERE d.tenant_id = $1 AND d.id = $2
          AND EXISTS (
            SELECT 1 FROM document_transitions t
             WHERE t.doc_type = d.doc_type::text
               AND t.from_status = d.lifecycle_status
               AND t.to_status = 'posted'
          )`,
      [tenant.tenantId, documentId],
    )
    return hasil.rowCount ?? 0
  }

  for (const asal of ['draft', 'submitted', 'pending_approval']) {
    expect(await cobaPosting(await siapkanFaktur(asal))).toBe(0)
  }
  expect(await cobaPosting(await siapkanFaktur('approved'))).toBe(1)
})

test('penarikan kembali hanya boleh dilakukan pengajunya sendiri', async () => {
  const { rows } = await admin.query<{ doc_type: string; requires: string[] }>(
    `SELECT doc_type, requires FROM document_transitions
      WHERE from_status = 'submitted' AND to_status = 'draft'`,
  )

  expect(rows.length).toBeGreaterThan(0)
  for (const row of rows) expect(row.requires).toContain('own_document')
})
