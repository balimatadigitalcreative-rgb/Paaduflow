import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, expect, test } from 'vitest'
import { Pool } from 'pg'

import { PostingService } from '#application/accounting/posting'
import { specificityOf, type DeterminationRule } from '#domain/accounting/determination'
import { PostgresUnitOfWork } from '#infrastructure/db/unit-of-work'
import { PostgresPostingRepository } from '#infrastructure/modules/accounting/postgres-posting-repository'
import { uuidv7 } from '#shared/uuid'

import { expectFailure, seedTenant, withClient, type Tenant } from './database.js'

/**
 * Invarian akuntansi — Module 07 §12.
 *
 * Dua ratus transaksi acak dijalankan lewat layanan aplikasi, bukan lewat
 * INSERT langsung, sehingga yang diuji adalah jalur yang benar-benar dipakai
 * produksi.
 *
 * Bibit acaknya tetap: kegagalan dapat diulang. Test properti yang tidak dapat
 * diulang adalah test yang akan dinonaktifkan orang.
 */

const BIBIT = 20260811
const JUMLAH_TRANSAKSI = 200

/** Pembangkit acak deterministik — cukup untuk membangkitkan kombinasi. */
function acak(bibit: number): () => number {
  let keadaan = bibit
  return () => {
    keadaan = (keadaan * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return keadaan / 4_294_967_296
  }
}

let admin: Pool
let app: Pool
let unitOfWork: PostgresUnitOfWork
let tenant: Tenant

const akun = {
  kas: randomUUID(),
  piutang: randomUUID(),
  persediaan: randomUUID(),
  pendapatan: randomUUID(),
  hpp: randomUUID(),
  ppnKeluaran: randomUUID(),
  induk: randomUUID(),
  anak: randomUUID(),
}

async function buatAkun(
  id: string,
  code: string,
  name: string,
  type: string,
  extra: { isControl?: boolean; controlOf?: string; parentId?: string } = {},
): Promise<void> {
  await admin.query(
    `INSERT INTO accounts (id, tenant_id, company_id, code, name, type, is_control, control_of, parent_id)
     VALUES ($1, $2, $3, $4, $5, $6::account_type, $7, $8::account_control_of, $9)`,
    [
      id,
      tenant.tenantId,
      tenant.companyId,
      code,
      name,
      type,
      extra.isControl ?? false,
      extra.controlOf ?? null,
      extra.parentId ?? null,
    ],
  )
}

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL
  admin = new Pool({ connectionString })
  app = new Pool({ connectionString, options: '-c role=paadu_app' })
  unitOfWork = new PostgresUnitOfWork(app)

  await withClient(async (client) => {
    tenant = await seedTenant(client, `neraca-${randomUUID().slice(0, 8)}`)
  })

  await buatAkun(akun.kas, '1100', 'Kas', 'asset')
  await buatAkun(akun.piutang, '1200', 'Piutang Usaha', 'asset', {
    isControl: true,
    controlOf: 'ar',
  })
  await buatAkun(akun.persediaan, '1300', 'Persediaan', 'asset')
  await buatAkun(akun.pendapatan, '4100', 'Pendapatan Penjualan', 'revenue')
  await buatAkun(akun.hpp, '5100', 'Harga Pokok Penjualan', 'expense')
  await buatAkun(akun.ppnKeluaran, '2100', 'PPN Keluaran', 'liability')
  await buatAkun(akun.induk, '6000', 'Beban Operasional', 'expense')
  await buatAkun(akun.anak, '6100', 'Beban Gaji', 'expense', { parentId: akun.induk })
})

afterAll(async () => {
  await admin.end()
  await app.end()
})

function layanan(db: Parameters<Parameters<PostgresUnitOfWork['inTenant']>[1]>[0]) {
  return new PostingService(new PostgresPostingRepository(db, tenant.tenantId), () => uuidv7())
}

test('dua ratus transaksi acak diposting lewat layanan aplikasi', async () => {
  const berikutnya = acak(BIBIT)
  let diposting = 0

  for (let nomor = 0; nomor < JUMLAH_TRANSAKSI; nomor += 1) {
    const nilai = Math.round(berikutnya() * 9_000_000) + 1_000
    const jenis = Math.floor(berikutnya() * 4)

    const baris =
      jenis === 0
        ? // Penjualan tunai dengan PPN
          [
            { accountId: akun.kas, debit: nilai * 1.11, credit: 0 },
            { accountId: akun.pendapatan, debit: 0, credit: nilai },
            { accountId: akun.ppnKeluaran, debit: 0, credit: nilai * 0.11 },
          ]
        : jenis === 1
          ? // Penjualan kredit — menyentuh akun kontrol, jadi jurnalnya `auto`
            [
              { accountId: akun.piutang, debit: nilai, credit: 0 },
              { accountId: akun.pendapatan, debit: 0, credit: nilai },
            ]
          : jenis === 2
            ? // Pengakuan HPP
              [
                { accountId: akun.hpp, debit: nilai, credit: 0 },
                { accountId: akun.persediaan, debit: 0, credit: nilai },
              ]
            : // Pembayaran piutang
              [
                { accountId: akun.kas, debit: nilai, credit: 0 },
                { accountId: akun.piutang, debit: 0, credit: nilai },
              ]

    const hasil = await unitOfWork.inTenant(
      { tenantId: tenant.tenantId, userId: null },
      async (db) =>
        layanan(db).post({
          companyId: tenant.companyId,
          journalDate: new Date(2026, 7, 1 + (nomor % 28)),
          fiscalYear: 2026,
          fiscalPeriod: 8,
          // Baris yang menyentuh akun kontrol tidak boleh berjenis `manual`.
          type: 'auto',
          currency: 'IDR',
          lines: baris.map((item) => ({
            ...item,
            debit: Math.round(item.debit * 100) / 100,
            credit: Math.round(item.credit * 100) / 100,
          })),
        }),
    )

    expect(hasil.kind).toBe('posted')
    diposting += 1
  }

  expect(diposting).toBe(JUMLAH_TRANSAKSI)
})

test('neraca saldo seimbang', async () => {
  const { rows } = await admin.query<{ debit: string; credit: string }>(
    `SELECT COALESCE(sum(l.debit), 0) AS debit, COALESCE(sum(l.credit), 0) AS credit
       FROM journal_lines l
       JOIN journals j ON j.tenant_id = l.tenant_id AND j.id = l.journal_id
      WHERE j.tenant_id = $1 AND j.company_id = $2`,
    [tenant.tenantId, tenant.companyId],
  )

  expect(Number(rows[0]?.debit)).toBe(Number(rows[0]?.credit))
  expect(Number(rows[0]?.debit)).toBeGreaterThan(0)
})

test('neraca saldo seimbang per periode fiskal, bukan hanya secara total', async () => {
  const { rows } = await admin.query<{ fiscal_period: number; selisih: string }>(
    `SELECT j.fiscal_period, COALESCE(sum(l.debit) - sum(l.credit), 0) AS selisih
       FROM journal_lines l
       JOIN journals j ON j.tenant_id = l.tenant_id AND j.id = l.journal_id
      WHERE j.tenant_id = $1
      GROUP BY j.fiscal_period`,
    [tenant.tenantId],
  )

  // Total yang seimbang dapat menutupi dua periode yang saling meniadakan.
  for (const baris of rows) expect(Number(baris.selisih)).toBe(0)
})

test('setiap jurnal punya minimal dua baris', async () => {
  const { rows } = await admin.query<{ id: string }>(
    `SELECT j.id
       FROM journals j
       LEFT JOIN journal_lines l ON l.tenant_id = j.tenant_id AND l.journal_id = j.id
      WHERE j.tenant_id = $1
      GROUP BY j.id
     HAVING count(l.id) < 2`,
    [tenant.tenantId],
  )

  // Jurnal satu baris bernilai nol lolos uji keseimbangan, dan itu bukan jurnal.
  expect(rows).toEqual([])
})

test('akun kontrol tidak dapat dijurnal manual', async () => {
  const kode = await expectFailure(() =>
    unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) =>
      layanan(db).post({
        companyId: tenant.companyId,
        journalDate: new Date(2026, 7, 10),
        fiscalYear: 2026,
        fiscalPeriod: 8,
        type: 'manual',
        currency: 'IDR',
        lines: [
          { accountId: akun.piutang, debit: 1_000, credit: 0 },
          { accountId: akun.kas, debit: 0, credit: 1_000 },
        ],
      }),
    ),
  )

  // Saldo akun kontrol hanya boleh berubah lewat modul asalnya.
  expect(kode).toBe('23514')
})

test('akun induk tidak dapat dijurnal sama sekali', async () => {
  const kode = await expectFailure(() =>
    unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) =>
      layanan(db).post({
        companyId: tenant.companyId,
        journalDate: new Date(2026, 7, 10),
        fiscalYear: 2026,
        fiscalPeriod: 8,
        type: 'auto',
        currency: 'IDR',
        lines: [
          { accountId: akun.induk, debit: 1_000, credit: 0 },
          { accountId: akun.kas, debit: 0, credit: 1_000 },
        ],
      }),
    ),
  )

  // Memposting ke akun induk membuat jumlah anak tidak sama dengan induknya.
  expect(kode).toBe('23514')
})

test('jurnal tidak berimbang ditolak layanan sebelum menyentuh basis data', async () => {
  const hasil = await unitOfWork.inTenant(
    { tenantId: tenant.tenantId, userId: null },
    async (db) =>
      layanan(db).post({
        companyId: tenant.companyId,
        journalDate: new Date(2026, 7, 10),
        fiscalYear: 2026,
        fiscalPeriod: 8,
        type: 'auto',
        currency: 'IDR',
        lines: [
          { accountId: akun.kas, debit: 1_000, credit: 0 },
          { accountId: akun.pendapatan, debit: 0, credit: 900 },
        ],
      }),
  )

  // Pesan yang dapat dibaca manusia, dengan selisihnya. Basis data tetap
  // menolaknya juga — yang di aplikasi menjelaskan, yang di basis data menjamin.
  expect(hasil).toEqual({ kind: 'unbalanced', debit: 1_000, credit: 900 })
})

test('spesifisitas yang dihitung basis data sama dengan yang dihitung domain', async () => {
  const bentuk: DeterminationRule[] = [
    { id: 'a', transactionType: 'sales.invoice.revenue', itemCategoryId: null, warehouseId: null, taxCodeId: null, partnerType: null, accountId: akun.pendapatan },
    { id: 'b', transactionType: 'sales.invoice.revenue', itemCategoryId: randomUUID(), warehouseId: null, taxCodeId: null, partnerType: null, accountId: akun.pendapatan },
    { id: 'c', transactionType: 'sales.invoice.revenue', itemCategoryId: null, warehouseId: randomUUID(), taxCodeId: randomUUID(), partnerType: 'perusahaan', accountId: akun.pendapatan },
  ]

  for (const aturan of bentuk) {
    await admin.query(
      `INSERT INTO account_determination_rules
         (id, tenant_id, company_id, transaction_type, item_category_id, warehouse_id,
          tax_code_id, partner_type, account_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        tenant.tenantId,
        tenant.companyId,
        aturan.transactionType,
        aturan.itemCategoryId,
        aturan.warehouseId,
        aturan.taxCodeId,
        aturan.partnerType,
        aturan.accountId,
      ],
    )
  }

  const { rows } = await admin.query<{ specificity: number; item_category_id: string | null }>(
    `SELECT specificity, item_category_id, warehouse_id, tax_code_id, partner_type
       FROM account_determination_rules WHERE tenant_id = $1 ORDER BY specificity`,
    [tenant.tenantId],
  )

  // Bobotnya hidup di dua tempat — kolom terhitung dan fungsi domain. Test ini
  // yang menjaga keduanya tidak menyimpang.
  const dariDomain = bentuk.map(specificityOf).sort((kiri, kanan) => kiri - kanan)
  expect(rows.map((baris) => baris.specificity)).toEqual(dariDomain)
})
