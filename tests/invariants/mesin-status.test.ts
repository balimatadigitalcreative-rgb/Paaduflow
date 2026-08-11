import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

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

beforeAll(() => {
  admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL })
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
  expect(rows.map((row) => row.to_status).sort()).toEqual(['closed', 'void'])
})

test('void selalu mensyaratkan jurnal pembalik', async () => {
  const { rows } = await admin.query<{ requires: string[] }>(
    `SELECT requires FROM document_transitions WHERE to_status = 'void'`,
  )

  expect(rows.length).toBeGreaterThan(0)
  for (const row of rows) expect(row.requires).toContain('reversal_journal')
})

test('penarikan kembali hanya boleh dilakukan pengajunya sendiri', async () => {
  const { rows } = await admin.query<{ doc_type: string; requires: string[] }>(
    `SELECT doc_type, requires FROM document_transitions
      WHERE from_status = 'submitted' AND to_status = 'draft'`,
  )

  expect(rows.length).toBe(3)
  for (const row of rows) expect(row.requires).toContain('own_document')
})
