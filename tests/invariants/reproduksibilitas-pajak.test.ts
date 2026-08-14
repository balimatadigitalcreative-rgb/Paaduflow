import { randomUUID } from 'node:crypto'

import { Pool } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { createTax } from '#composition/tax'
import { PostgresUnitOfWork } from '#infrastructure/db/unit-of-work'

import { seedTenant, withClient, type Tenant } from './database.js'
import { seedAkunPajak, seedTaxCode, seedTaxRule, type AkunPajak } from './tax-fixture.js'

/**
 * Reproduksibilitas — yang terpenting di modul ini (Module 08 §12).
 *
 * Dokumen bertanggal sebelum perubahan tarif, dihitung ulang SETELAH tarif
 * berubah, harus menghasilkan angka yang sama persis. Karena itu tarifnya
 * benar-benar diubah di tengah rangkaian ini, bukan disimulasikan.
 *
 * Kalau berkas ini gagal, artinya laporan masa yang sudah dilaporkan akan
 * berubah sendiri setiap kali tarif berganti — dan itu bukan bug tampilan,
 * melainkan selisih dengan yang sudah disetor.
 *
 * Seluruh angka tarif di bawah adalah angka UJI dari `tax-fixture.ts`.
 */

let admin: Pool
let app: Pool
let unitOfWork: PostgresUnitOfWork
let tenant: Tenant
let akun: AkunPajak

const NILAI = 1_000_000
const SEBELUM = '2022-02-15'
const BATAS = '2022-04-01'
const SESUDAH = '2022-05-20'

async function hitung(documentDate: string, amount = NILAI) {
  return unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) => {
    const pajak = createTax(db, tenant.tenantId)
    return pajak.engine.calculate({
      companyId: tenant.companyId,
      documentDate,
      amount,
      currency: 'IDR',
      context: { transactionType: 'sales.invoice.tax' },
    })
  })
}

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL
  admin = new Pool({ connectionString })
  app = new Pool({ connectionString, options: '-c role=paadu_app' })
  unitOfWork = new PostgresUnitOfWork(app)

  await withClient(async (client) => {
    tenant = await seedTenant(client, `repro-${randomUUID().slice(0, 8)}`)
  })

  akun = await seedAkunPajak(admin, tenant.tenantId, tenant.companyId)

  // Satu versi, terbuka. Tarif 10 adalah angka uji.
  await seedTaxCode(admin, tenant.tenantId, tenant.companyId, {
    code: 'PPN-OUT',
    rate: 10,
    validFrom: '2022-01-01',
    glAccountId: akun.ppnKeluaran,
  })
  await seedTaxRule(admin, tenant.tenantId, tenant.companyId, {
    transactionType: 'sales.invoice.tax',
    taxCode: 'PPN-OUT',
  })
})

afterAll(async () => {
  await admin.end()
  await app.end()
})

/**
 * Dijalankan berurutan dan saling bergantung — itu memang bentuk pengujiannya.
 * Perubahan tarif harus terjadi DI ANTARA dua perhitungan yang sama.
 */

let sebelumPerubahan: { base: number; rate: number; tax: number; taxCodeId: string }

test('1 · dokumen lama dihitung dengan tarif yang berlaku saat itu', async () => {
  const hasil = await hitung(SEBELUM)

  expect(hasil.kind).toBe('calculated')
  if (hasil.kind !== 'calculated') throw new Error('tidak mungkin')

  sebelumPerubahan = {
    base: hasil.amount.base,
    rate: hasil.amount.rate,
    tax: hasil.amount.tax,
    taxCodeId: hasil.amount.taxCodeId,
  }

  expect(sebelumPerubahan.rate).toBe(10)
  expect(sebelumPerubahan.tax).toBe(100_000)
})

test('2 · tarif berubah: versi baru lahir, versi lama ditutup', async () => {
  const hasil = await unitOfWork.inTenant(
    { tenantId: tenant.tenantId, userId: null },
    async (db) => {
      const pajak = createTax(db, tenant.tenantId)
      return pajak.codes.addVersion({
        companyId: tenant.companyId,
        code: 'PPN-OUT',
        name: 'PPN Keluaran',
        taxType: 'vat_out',
        rate: 11,
        validFrom: BATAS,
        calculationBase: 'net',
        glAccountId: akun.ppnKeluaran,
        isCreditable: false,
        createdBy: randomUUID(),
      })
    },
  )

  expect(hasil.kind).toBe('created')
  if (hasil.kind !== 'created') throw new Error('tidak mungkin')
  // Versi lama ditutup, bukan diubah. Barisnya masih ada dengan tarif aslinya.
  expect(hasil.supersededId).not.toBeNull()

  const { rows } = await admin.query<{ rate: string; valid_from: Date; valid_to: Date | null }>(
    `SELECT rate, valid_from, valid_to FROM tax_codes
      WHERE tenant_id = $1 AND company_id = $2 AND code = 'PPN-OUT'
      ORDER BY valid_from`,
    [tenant.tenantId, tenant.companyId],
  )

  expect(rows).toHaveLength(2)
  expect(Number(rows[0]!.rate)).toBe(10)
  expect(rows[0]!.valid_to).not.toBeNull()
  expect(Number(rows[1]!.rate)).toBe(11)
})

test('3 · dokumen lama dihitung ULANG menghasilkan angka yang sama persis', async () => {
  const hasil = await hitung(SEBELUM)

  expect(hasil.kind).toBe('calculated')
  if (hasil.kind !== 'calculated') throw new Error('tidak mungkin')

  // Sama persis, termasuk baris kode pajak yang dipakai — bukan sekadar
  // nilainya kebetulan sama.
  expect({
    base: hasil.amount.base,
    rate: hasil.amount.rate,
    tax: hasil.amount.tax,
    taxCodeId: hasil.amount.taxCodeId,
  }).toEqual(sebelumPerubahan)
})

test('4 · dokumen baru memakai tarif baru', async () => {
  const hasil = await hitung(SESUDAH)
  if (hasil.kind !== 'calculated') throw new Error('tidak mungkin')

  expect(hasil.amount.rate).toBe(11)
  expect(hasil.amount.tax).toBe(110_000)
  expect(hasil.amount.taxCodeId).not.toBe(sebelumPerubahan.taxCodeId)
})

test('5 · batasnya setengah terbuka, tanpa hari yang bertarif ganda', async () => {
  const sehariSebelum = await hitung('2022-03-31')
  const tepatDiBatas = await hitung(BATAS)

  if (sehariSebelum.kind !== 'calculated' || tepatDiBatas.kind !== 'calculated') {
    throw new Error('tidak mungkin')
  }
  expect(sehariSebelum.amount.rate).toBe(10)
  expect(tepatDiBatas.amount.rate).toBe(11)
})

test('6 · tarif tidak dapat diubah di tempat, bahkan lewat SQL langsung', async () => {
  // Trigger t40_rate_immutable. Kalau ini lolos, seluruh berkas ini kehilangan
  // artinya: dokumen lama akan ikut terhitung ulang.
  await expect(
    admin.query(
      `UPDATE tax_codes SET rate = 99 WHERE tenant_id = $1 AND company_id = $2 AND rate = 10`,
      [tenant.tenantId, tenant.companyId],
    ),
  ).rejects.toThrow(/tidak dapat diubah/)

  // Dan angkanya masih yang lama sesudah upaya itu.
  const hasil = await hitung(SEBELUM)
  if (hasil.kind !== 'calculated') throw new Error('tidak mungkin')
  expect(hasil.amount.tax).toBe(sebelumPerubahan.tax)
})

test('7 · dokumen sebelum versi pertama ditolak, bukan diberi tarif terdekat', async () => {
  const hasil = await hitung('2021-06-01')

  expect(hasil.kind).toBe('no_rate_on_date')
  if (hasil.kind !== 'no_rate_on_date') throw new Error('tidak mungkin')
  expect(hasil.reason).toContain('2021-06-01')
})

test('8 · basis bruto juga reproduksibel di kedua sisi batas', async () => {
  await seedTaxCode(admin, tenant.tenantId, tenant.companyId, {
    code: 'PPN-BRUTO',
    rate: 10,
    validFrom: '2022-01-01',
    validTo: BATAS,
    calculationBase: 'gross',
    glAccountId: akun.ppnKeluaran,
  })
  await seedTaxCode(admin, tenant.tenantId, tenant.companyId, {
    code: 'PPN-BRUTO',
    rate: 11,
    validFrom: BATAS,
    calculationBase: 'gross',
    glAccountId: akun.ppnKeluaran,
  })
  await seedTaxRule(admin, tenant.tenantId, tenant.companyId, {
    transactionType: 'sales.invoice.gross',
    taxCode: 'PPN-BRUTO',
  })

  const hitungBruto = async (tanggal: string) =>
    unitOfWork.inTenant({ tenantId: tenant.tenantId, userId: null }, async (db) =>
      createTax(db, tenant.tenantId).engine.calculate({
        companyId: tenant.companyId,
        documentDate: tanggal,
        amount: 1_100_000,
        currency: 'IDR',
        context: { transactionType: 'sales.invoice.gross' },
      }),
    )

  const lama = await hitungBruto(SEBELUM)
  const baru = await hitungBruto(SESUDAH)
  if (lama.kind !== 'calculated' || baru.kind !== 'calculated') throw new Error('tidak mungkin')

  // 1.100.000 termasuk pajak 10% → dasar 1.000.000, pajak 100.000.
  expect(lama.amount.base).toBe(1_000_000)
  expect(lama.amount.tax).toBe(100_000)
  // Nilai bruto yang sama pada tarif 11% menghasilkan dasar yang lebih kecil.
  expect(baru.amount.base).toBeLessThan(lama.amount.base)
  expect(baru.amount.base + baru.amount.tax).toBeCloseTo(1_100_000, 0)

  // Dan yang lama tetap sama saat dihitung ulang sekarang.
  const lamaLagi = await hitungBruto(SEBELUM)
  if (lamaLagi.kind !== 'calculated') throw new Error('tidak mungkin')
  expect(lamaLagi.amount).toEqual(lama.amount)
})
