import { randomUUID } from 'node:crypto'

import type { Pool } from 'pg'

/**
 * Penyeed bersama untuk test Pajak.
 *
 * Seluruh tarif yang dipakai test datang dari sini, dan **tidak satu pun**
 * datang dari kode produksi — karena kode produksi tidak memuat satu pun. Kalau
 * suatu hari sebuah test lulus tanpa memanggil `seedTaxCode`, itu berarti ada
 * tarif yang menyelinap masuk ke kode, dan test itu yang salah.
 */

export interface AkunPajak {
  ppnKeluaran: string
  ppnMasukan: string
}

export async function seedAkunPajak(
  admin: Pool,
  tenantId: string,
  companyId: string,
): Promise<AkunPajak> {
  const ppnKeluaran = randomUUID()
  const ppnMasukan = randomUUID()

  for (const [id, kode, nama, tipe] of [
    [ppnKeluaran, '2100', 'PPN Keluaran', 'liability'],
    [ppnMasukan, '1450', 'PPN Masukan', 'asset'],
  ] as const) {
    await admin.query(
      `INSERT INTO accounts (id, tenant_id, company_id, code, name, type)
       VALUES ($1, $2, $3, $4, $5, $6::account_type)`,
      [id, tenantId, companyId, kode, nama, tipe],
    )
  }

  return { ppnKeluaran, ppnMasukan }
}

export async function seedProfilPkp(
  admin: Pool,
  tenantId: string,
  companyId: string,
  options: { isPkp: boolean; effectiveDate?: string } = { isPkp: true },
): Promise<void> {
  await admin.query(
    `INSERT INTO company_tax_profiles
       (tenant_id, company_id, npwp, is_pkp, pkp_effective_date, nppkp)
     VALUES ($1, $2, $3, $4, $5::date, $6)`,
    [
      tenantId,
      companyId,
      options.isPkp ? '00.000.000.0-000.000' : null,
      options.isPkp,
      options.isPkp ? (options.effectiveDate ?? '2020-01-01') : null,
      options.isPkp ? 'UJI' : null,
    ],
  )
}

export interface KodePajakUji {
  readonly code: string
  readonly name?: string
  readonly taxType?: 'vat_out' | 'vat_in' | 'withholding' | 'exempt' | 'not_collected'
  /** Angka UJI. Bukan tarif yang berlaku di mana pun. */
  readonly rate: number
  readonly validFrom: string
  readonly validTo?: string | null
  readonly calculationBase?: 'net' | 'gross'
  readonly glAccountId: string
  readonly isCreditable?: boolean
}

export async function seedTaxCode(
  admin: Pool,
  tenantId: string,
  companyId: string,
  kode: KodePajakUji,
): Promise<string> {
  const id = randomUUID()
  await admin.query(
    `INSERT INTO tax_codes
       (id, tenant_id, company_id, code, name, tax_type, rate, valid_from, valid_to,
        calculation_base, gl_account_id, is_creditable)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9::date, $10, $11, $12)`,
    [
      id,
      tenantId,
      companyId,
      kode.code,
      kode.name ?? kode.code,
      kode.taxType ?? 'vat_out',
      kode.rate,
      kode.validFrom,
      kode.validTo ?? null,
      kode.calculationBase ?? 'net',
      kode.glAccountId,
      kode.isCreditable ?? false,
    ],
  )
  return id
}

export async function seedTaxRule(
  admin: Pool,
  tenantId: string,
  companyId: string,
  aturan: {
    transactionType: string
    taxCode: string
    itemCategoryId?: string | null
    partnerType?: string | null
    partnerIsPkp?: boolean | null
    regionCode?: string | null
  },
): Promise<string> {
  const id = randomUUID()
  await admin.query(
    `INSERT INTO tax_determination_rules
       (id, tenant_id, company_id, transaction_type, item_category_id, partner_type,
        partner_is_pkp, region_code, tax_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      tenantId,
      companyId,
      aturan.transactionType,
      aturan.itemCategoryId ?? null,
      aturan.partnerType ?? null,
      aturan.partnerIsPkp ?? null,
      aturan.regionCode ?? null,
      aturan.taxCode,
    ],
  )
  return id
}
