import { TaxCodeService } from '#application/tax/codes'
import { TaxEngineService } from '#application/tax/engine'
import { InputTaxInvoiceService, OutputTaxInvoiceService } from '#application/tax/invoices'
import type { PartnerTaxStatusPort } from '#application/tax/ports'
import { TaxSerialService } from '#application/tax/serials'
import type { Queryable } from '#infrastructure/db/queryable'
import { PostgresTaxRepository } from '#infrastructure/modules/tax/postgres-tax-repository'
import { uuidv7 } from '#shared/uuid'

/**
 * Penyambung modul Pajak.
 *
 * `PartnerTaxStatusPort` adalah alasan berkas ini ada. Status PKP vendor
 * tinggal di `vendors.is_pkp` milik Pembelian, dan NPWP pelanggan di
 * `customers.tax_id` milik Penjualan. Lint melarang Pajak mengimpor keduanya,
 * jadi keduanya masuk sebagai kueri di sini — satu-satunya berkas yang boleh
 * mengenal ketiga modul (D-040).
 *
 * Adapter di bawah membaca tabel milik modul lain secara langsung alih-alih
 * memanggil layanannya. Itu disengaja: yang dibutuhkan hanya dua kolom, dan
 * membangun layanan penuh modul Pembelian hanya untuk membaca satu boolean
 * akan menarik seluruh ketergantungannya ke jalur ini.
 */

export interface TaxServices {
  readonly engine: TaxEngineService
  readonly codes: TaxCodeService
  readonly serials: TaxSerialService
  readonly outputInvoices: OutputTaxInvoiceService
  readonly inputInvoices: InputTaxInvoiceService
  readonly repository: PostgresTaxRepository
}

export function createTax(db: Queryable, tenantId: string): TaxServices {
  const repository = new PostgresTaxRepository(db, tenantId)

  const partners: PartnerTaxStatusPort = {
    async vendor(vendorId) {
      const { rows } = await db.query<{ is_pkp: boolean; tax_id: string | null }>(
        'SELECT is_pkp, tax_id FROM vendors WHERE tenant_id = $1 AND id = $2',
        [tenantId, vendorId],
      )
      const row = rows[0]
      return row === undefined ? null : { isPkp: row.is_pkp, taxId: row.tax_id }
    },

    async customer(customerId) {
      const { rows } = await db.query<{ name: string; tax_id: string | null }>(
        'SELECT name, tax_id FROM customers WHERE tenant_id = $1 AND id = $2',
        [tenantId, customerId],
      )
      const row = rows[0]
      return row === undefined ? null : { name: row.name, taxId: row.tax_id }
    },
  }

  return {
    engine: new TaxEngineService(repository),
    codes: new TaxCodeService(repository, () => uuidv7()),
    serials: new TaxSerialService(repository, () => uuidv7()),
    outputInvoices: new OutputTaxInvoiceService(
      repository,
      repository,
      repository,
      partners,
      repository,
      () => uuidv7(),
    ),
    inputInvoices: new InputTaxInvoiceService(
      repository,
      repository,
      partners,
      repository,
      () => uuidv7(),
    ),
    repository,
  }
}
