import { randomUUID } from 'node:crypto'

import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { createAppServices } from '#composition/http'
import { buildHttpApp, type PaaduServer } from '#interface/http/app'

import { FakeBreachList, FakeMailer, VALID_PASSWORD } from './harness.js'

/**
 * Kontrol tagihan diuji lewat API, bukan lewat layanan.
 *
 * Alasannya satu kalimat: kontrol yang hanya diuji di lapisan layanan tidak
 * membuktikan apa pun tentang apa yang dapat dilakukan seseorang yang memegang
 * token dan curl. Seluruh test di berkas ini menembak endpoint sungguhan.
 */

let admin: Pool
let appPool: Pool
let app: PaaduServer

let tenantId: string
let companyId: string
let vendorId: string
let warehouseId: string
let itemId: string

let tokenPembeli: string
let tokenAtasan: string
let idPembeli: string
let idAtasan: string

const akun = {
  persediaan: randomUUID(),
  perantara: randomUUID(),
  utang: randomUUID(),
  ppnMasukan: randomUUID(),
  selisihHarga: randomUUID(),
  beban: randomUUID(),
}

async function seedPengguna(email: string): Promise<string> {
  const daftar = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password: VALID_PASSWORD, full_name: 'Pengguna' },
  })
  expect(daftar.statusCode).toBe(202)
  const { rows } = await admin.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email])
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

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL
  admin = new Pool({ connectionString })
  appPool = new Pool({ connectionString, options: '-c role=paadu_app' })

  app = await buildHttpApp({
    services: createAppServices({
      pool: appPool,
      tokenSigningSecret: 'rahasia-uji-yang-panjangnya-cukup-32-karakter',
      mfaEncryptionKeyBase64: Buffer.alloc(32, 7).toString('base64'),
      mailer: new FakeMailer(),
      breachList: new FakeBreachList(),
    }),
  })
  await app.ready()

  tenantId = randomUUID()
  companyId = randomUUID()
  const slug = `beli-${randomUUID().slice(0, 8)}`

  await admin.query(`INSERT INTO tenants (id, name, slug, region) VALUES ($1, $2, $3, 'id-jkt')`, [
    tenantId,
    'Grup Pembelian',
    slug,
  ])
  await admin.query(
    `INSERT INTO companies (id, tenant_id, legal_name, slug, default_currency)
     VALUES ($1, $2, 'PT Pembeli', $3, 'IDR')`,
    [companyId, tenantId, slug],
  )

  for (const [id, kode, nama, tipe] of [
    [akun.persediaan, '1300', 'Persediaan', 'asset'],
    [akun.perantara, '2150', 'Penerimaan Barang Belum Ditagih', 'liability'],
    [akun.utang, '2100', 'Utang Usaha', 'liability'],
    [akun.ppnMasukan, '1450', 'PPN Masukan', 'asset'],
    [akun.selisihHarga, '5900', 'Selisih Harga Pembelian', 'expense'],
    [akun.beban, '6100', 'Beban Operasional', 'expense'],
  ] as const) {
    await admin.query(
      `INSERT INTO accounts (id, tenant_id, company_id, code, name, type)
       VALUES ($1, $2, $3, $4, $5, $6::account_type)`,
      [id, tenantId, companyId, kode, nama, tipe],
    )
  }

  for (const [jenis, akunId] of [
    ['purchasing.receipt.stock', akun.persediaan],
    ['purchasing.receipt.clearing', akun.perantara],
    ['purchasing.bill.payable', akun.utang],
    ['purchasing.bill.tax_input', akun.ppnMasukan],
    ['purchasing.bill.price_variance', akun.selisihHarga],
    ['purchasing.bill.expense', akun.beban],
  ] as const) {
    await admin.query(
      `INSERT INTO account_determination_rules (id, tenant_id, company_id, transaction_type, account_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
      [tenantId, companyId, jenis, akunId],
    )
  }

  vendorId = randomUUID()
  await admin.query(
    `INSERT INTO vendors (id, tenant_id, company_id, code, name, tax_id, is_pkp, currency)
     VALUES ($1, $2, $3, 'V-01', 'PT Pemasok', '01.234.567.8-901.000', true, 'IDR')`,
    [vendorId, tenantId, companyId],
  )

  warehouseId = randomUUID()
  await admin.query(
    `INSERT INTO warehouses (id, tenant_id, company_id, code, name) VALUES ($1, $2, $3, 'GD-01', 'Gudang')`,
    [warehouseId, tenantId, companyId],
  )

  itemId = randomUUID()
  await admin.query(
    `INSERT INTO items (id, tenant_id, company_id, code, name, type, base_uom)
     VALUES ($1, $2, $3, 'SEMEN', 'Semen 50kg', 'stock', 'sak')`,
    [itemId, tenantId, companyId],
  )

  idPembeli = await seedPengguna(`pembeli-${slug}@paaduflow.test`)
  idAtasan = await seedPengguna(`atasan-${slug}@paaduflow.test`)

  for (const [userId, peran] of [
    [idPembeli, 'member'],
    [idAtasan, 'company_admin'],
  ] as const) {
    await admin.query(
      `INSERT INTO company_access (id, tenant_id, company_id, user_id, role_id)
       SELECT $1, $2, $3, $4, id FROM roles WHERE key = $5 AND tenant_id IS NULL`,
      [randomUUID(), tenantId, companyId, userId, peran],
    )
  }

  tokenPembeli = await masuk(`pembeli-${slug}@paaduflow.test`)
  tokenAtasan = await masuk(`atasan-${slug}@paaduflow.test`)
})

afterAll(async () => {
  await app.close()
  await appPool.end()
  await admin.end()
})

const dasar = () => `/v1/companies/${companyId}`

async function panggil(
  method: 'POST',
  url: string,
  token: string,
  payload?: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const jawaban = await app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': randomUUID() },
    payload: payload ?? {},
  })
  return { status: jawaban.statusCode, body: jawaban.json() as Record<string, unknown> }
}

/**
 * Satu siklus lengkap sampai tagihan siap diposting.
 *
 * `hargaTagihan` yang berbeda dari `hargaPesanan` menghasilkan selisih harga;
 * `qtyDiterima` yang lebih kecil dari `qtyDitagih` menghasilkan penagihan atas
 * barang yang belum datang.
 */
async function siapkanTagihan(options: {
  qtyPesan: number
  qtyTerima: number
  qtyTagih: number
  hargaPesanan: number
  hargaTagihan: number
}): Promise<string> {
  const pesanan = await panggil('POST', `${dasar()}/purchase-documents`, tokenPembeli, {
    doc_type: 'purchase_order',
    vendor_id: vendorId,
    issue_date: '2026-08-01',
    currency: 'IDR',
    lines: [
      {
        item_id: itemId,
        warehouse_id: warehouseId,
        description: 'Semen 50kg',
        qty: options.qtyPesan,
        uom: 'sak',
        unit_price: options.hargaPesanan,
        tax_rate_percent: 11,
      },
    ],
  })
  expect(pesanan.status).toBe(201)
  const pesananId = (pesanan.body.data as { id: string }).id

  expect(
    (
      await panggil('POST', `${dasar()}/purchase-documents/${pesananId}/submit`, tokenPembeli, {
        doc_type: 'purchase_order',
        period_key: '2026-08',
      })
    ).status,
  ).toBe(200)

  expect(
    (await panggil('POST', `${dasar()}/purchase-documents/${pesananId}/approve`, tokenAtasan))
      .status,
  ).toBe(200)

  const { rows: barisPesanan } = await admin.query<{ id: string }>(
    'SELECT id FROM purchase_document_lines WHERE tenant_id = $1 AND document_id = $2',
    [tenantId, pesananId],
  )
  const poLineId = barisPesanan[0]!.id

  if (options.qtyTerima > 0) {
    const penerimaan = await panggil('POST', `${dasar()}/goods-receipts`, tokenPembeli, {
      purchase_order_id: pesananId,
      warehouse_id: warehouseId,
      received_date: '2026-08-05',
      lines: [{ po_line_id: poLineId, qty_received: options.qtyTerima }],
    })
    expect(penerimaan.status).toBe(201)
  }

  const tagihan = await panggil('POST', `${dasar()}/purchase-documents`, tokenPembeli, {
    doc_type: 'bill',
    vendor_id: vendorId,
    issue_date: '2026-08-10',
    currency: 'IDR',
    source_document_id: pesananId,
    lines: [
      {
        item_id: itemId,
        warehouse_id: warehouseId,
        source_line_id: poLineId,
        description: 'Semen 50kg',
        qty: options.qtyTagih,
        uom: 'sak',
        unit_price: options.hargaTagihan,
        tax_rate_percent: 11,
      },
    ],
  })
  expect(tagihan.status).toBe(201)
  const tagihanId = (tagihan.body.data as { id: string }).id

  expect(
    (
      await panggil('POST', `${dasar()}/purchase-documents/${tagihanId}/submit`, tokenPembeli, {
        doc_type: 'bill',
        period_key: '2026-08',
      })
    ).status,
  ).toBe(200)
  expect(
    (await panggil('POST', `${dasar()}/purchase-documents/${tagihanId}/approve`, tokenAtasan))
      .status,
  ).toBe(200)

  return tagihanId
}

test('tagihan yang cocok dapat diposting, dan utang lahir di sana', async () => {
  const tagihanId = await siapkanTagihan({
    qtyPesan: 100,
    qtyTerima: 100,
    qtyTagih: 100,
    hargaPesanan: 65_000,
    hargaTagihan: 65_000,
  })

  const hasil = await panggil('POST', `${dasar()}/bills/${tagihanId}/post`, tokenPembeli)
  expect(hasil.status).toBe(200)

  const { rows } = await admin.query<{ debit: string; credit: string; account_id: string }>(
    `SELECT l.account_id, l.debit, l.credit
       FROM journal_lines l
       JOIN journals j ON j.tenant_id = l.tenant_id AND j.id = l.journal_id
      WHERE j.tenant_id = $1 AND j.source_id = $2`,
    [tenantId, tagihanId],
  )

  const utang = rows.find((baris) => baris.account_id === akun.utang)
  const perantara = rows.find((baris) => baris.account_id === akun.perantara)

  // Utang lahir di posting tagihan, bukan di penerimaan barang.
  expect(Number(utang?.credit)).toBeCloseTo(6_500_000 * 1.11, 2)
  // Dan akun perantara dikosongkan sebesar nilai yang dicocokkan.
  expect(Number(perantara?.debit)).toBeCloseTo(6_500_000, 2)
})

test('tagihan dengan selisih harga ditolak lewat API, bukan hanya lewat UI', async () => {
  const tagihanId = await siapkanTagihan({
    qtyPesan: 100,
    qtyTerima: 100,
    qtyTagih: 100,
    hargaPesanan: 65_000,
    hargaTagihan: 72_000,
  })

  const hasil = await panggil('POST', `${dasar()}/bills/${tagihanId}/post`, tokenPembeli)

  expect(hasil.status).toBe(409)
  expect((hasil.body.errors as { code: string }[])[0]?.code).toBe('match.price_variance')

  const { rows } = await admin.query<{ lifecycle_status: string; match_status: string }>(
    'SELECT lifecycle_status, match_status FROM purchase_documents WHERE tenant_id = $1 AND id = $2',
    [tenantId, tagihanId],
  )
  expect(rows[0]).toEqual({ lifecycle_status: 'approved', match_status: 'exception' })
})

test('parameter tambahan tidak membuka jalan pintas', async () => {
  const tagihanId = await siapkanTagihan({
    qtyPesan: 100,
    qtyTerima: 100,
    qtyTagih: 100,
    hargaPesanan: 65_000,
    hargaTagihan: 72_000,
  })

  // Empat nama yang biasanya dipakai orang untuk memaksa. Tidak satu pun ada
  // di skema, dan tidak satu pun mengubah jawaban.
  for (const paksaan of [
    { force: true },
    { skip_match: true },
    { allow_exception: true },
    { match_status: 'matched' },
  ]) {
    const hasil = await panggil('POST', `${dasar()}/bills/${tagihanId}/post`, tokenPembeli, paksaan)
    expect(hasil.status).toBe(409)
  }

  const { rows } = await admin.query<{ lifecycle_status: string }>(
    'SELECT lifecycle_status FROM purchase_documents WHERE tenant_id = $1 AND id = $2',
    [tenantId, tagihanId],
  )
  expect(rows[0]?.lifecycle_status).toBe('approved')
})

test('basis data menolak posting tagihan exception meski lewat SQL langsung', async () => {
  const tagihanId = await siapkanTagihan({
    qtyPesan: 100,
    qtyTerima: 100,
    qtyTagih: 100,
    hargaPesanan: 65_000,
    hargaTagihan: 72_000,
  })
  await panggil('POST', `${dasar()}/bills/${tagihanId}/post`, tokenPembeli)

  // Jalur tulis yang tidak lewat layanan pun tertutup. Kontrol yang hanya hidup
  // di satu lapisan bukan kontrol.
  await expect(
    admin.query(
      `UPDATE purchase_documents SET lifecycle_status = 'posted' WHERE tenant_id = $1 AND id = $2`,
      [tenantId, tagihanId],
    ),
  ).rejects.toThrow(/pencocokan/)
})

test('override menuntut izin tersendiri', async () => {
  const tagihanId = await siapkanTagihan({
    qtyPesan: 100,
    qtyTerima: 100,
    qtyTagih: 100,
    hargaPesanan: 65_000,
    hargaTagihan: 72_000,
  })

  // Pembeli boleh memposting tagihan, tetapi tidak boleh memaafkan selisihnya.
  const ditolak = await panggil('POST', `${dasar()}/bills/${tagihanId}/override-match`, tokenPembeli, {
    reason: 'Harga naik karena ongkos angkut, sudah disepakati lewat surel.',
  })
  expect(ditolak.status).toBe(403)
})

test('override menuntut alasan, dan alasan sependek "ok" ditolak', async () => {
  const tagihanId = await siapkanTagihan({
    qtyPesan: 100,
    qtyTerima: 100,
    qtyTagih: 100,
    hargaPesanan: 65_000,
    hargaTagihan: 72_000,
  })

  const kosong = await panggil('POST', `${dasar()}/bills/${tagihanId}/override-match`, tokenAtasan, {})
  expect(kosong.status).toBe(400)

  const pendek = await panggil('POST', `${dasar()}/bills/${tagihanId}/override-match`, tokenAtasan, {
    reason: 'ok',
  })
  expect(pendek.status).toBe(400)
})

test('override tercatat sebagai peristiwa audit tersendiri', async () => {
  const tagihanId = await siapkanTagihan({
    qtyPesan: 100,
    qtyTerima: 100,
    qtyTagih: 100,
    hargaPesanan: 65_000,
    hargaTagihan: 72_000,
  })

  const alasan = 'Harga naik karena ongkos angkut, sudah disepakati lewat surel dengan vendor.'
  const disetujui = await panggil(
    'POST',
    `${dasar()}/bills/${tagihanId}/override-match`,
    tokenAtasan,
    { reason: alasan },
  )
  expect(disetujui.status).toBe(200)

  const { rows } = await admin.query<{
    action: string
    actor_id: string
    changes: { reason: string; variances: { kind: string }[] }
  }>(
    `SELECT action, actor_id, changes FROM audit_log
      WHERE tenant_id = $1 AND entity_id = $2 AND action = 'pembelian.pencocokan.override'`,
    [tenantId, tagihanId],
  )

  expect(rows).toHaveLength(1)
  expect(rows[0]!.actor_id).toBe(idAtasan)
  expect(rows[0]!.changes.reason).toBe(alasan)
  // Selisih yang dimaafkan ikut tercatat — persetujuan tanpa keterangan apa
  // yang disetujui tidak dapat ditinjau siapa pun.
  expect(rows[0]!.changes.variances[0]?.kind).toBe('price_variance')
})

test('yang menyetujui pengecualian tidak boleh memposting tagihan yang sama', async () => {
  const tagihanId = await siapkanTagihan({
    qtyPesan: 100,
    qtyTerima: 100,
    qtyTagih: 100,
    hargaPesanan: 65_000,
    hargaTagihan: 72_000,
  })

  expect(
    (
      await panggil('POST', `${dasar()}/bills/${tagihanId}/override-match`, tokenAtasan, {
        reason: 'Kenaikan harga disepakati; selisihnya dibebankan ke selisih harga pembelian.',
      })
    ).status,
  ).toBe(200)

  // Atasan memegang izin posting DAN izin override. Ia tetap tidak dapat
  // memakai keduanya pada tagihan yang sama.
  const sendiri = await panggil('POST', `${dasar()}/bills/${tagihanId}/post`, tokenAtasan)
  expect(sendiri.status).toBe(409)
  expect((sendiri.body.errors as { code: string }[])[0]?.code).toBe('separation_of_duties')

  // Orang lain memposting, dan sekarang berhasil.
  const orangLain = await panggil('POST', `${dasar()}/bills/${tagihanId}/post`, tokenPembeli)
  expect(orangLain.status).toBe(200)

  const { rows } = await admin.query<{ account_id: string; debit: string }>(
    `SELECT l.account_id, l.debit FROM journal_lines l
       JOIN journals j ON j.tenant_id = l.tenant_id AND j.id = l.journal_id
      WHERE j.tenant_id = $1 AND j.source_id = $2 AND l.debit > 0`,
    [tenantId, tagihanId],
  )

  // Selisih yang dimaafkan tetap muncul sebagai baris jurnalnya sendiri.
  const selisih = rows.find((baris) => baris.account_id === akun.selisihHarga)
  expect(Number(selisih?.debit)).toBeCloseTo(700_000, 2)
})

test('menagih barang yang belum diterima tidak dapat disetujui siapa pun', async () => {
  const tagihanId = await siapkanTagihan({
    qtyPesan: 100,
    qtyTerima: 40,
    qtyTagih: 100,
    hargaPesanan: 65_000,
    hargaTagihan: 65_000,
  })

  const posting = await panggil('POST', `${dasar()}/bills/${tagihanId}/post`, tokenPembeli)
  expect(posting.status).toBe(409)
  expect((posting.body.errors as { code: string }[])[0]?.code).toBe('match.billed_over_received')

  // Bahkan pemegang izin override tidak punya jalan. Yang ada jalannya adalah
  // mencatat penerimaannya, bukan menyetujui ketiadaannya.
  const override = await panggil('POST', `${dasar()}/bills/${tagihanId}/override-match`, tokenAtasan, {
    reason: 'Vendor menjanjikan sisanya minggu depan; tolong diloloskan dulu.',
  })
  expect(override.status).toBe(409)
  expect((override.body.errors as { code: string }[])[0]?.code).toBe('match.billed_over_received')
})
