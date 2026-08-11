import { PostingService } from '#application/accounting/posting'
import { StockService } from '#application/inventory/stock'
import { SalesDocumentService } from '#application/sales/documents'
import {
  PostInvoiceService,
  type AccountResolverPort,
  type LedgerPort,
  type StockPort,
} from '#application/sales/posting'
import { explainNotFound, resolveAccount, type DeterminationRule } from '#domain/accounting/determination'
import type { Queryable } from '#infrastructure/db/queryable'
import { PostgresPostingRepository } from '#infrastructure/modules/accounting/postgres-posting-repository'
import { PostgresStockRepository } from '#infrastructure/modules/inventory/postgres-stock-repository'
import { PostgresSalesDocumentRepository } from '#infrastructure/modules/sales/postgres-sales-document-repository'
import { uuidv7 } from '#shared/uuid'

/**
 * Penyambung modul Penjualan ke Akuntansi dan Persediaan.
 *
 * Inilah satu-satunya berkas yang mengenal ketiganya. Modul Penjualan
 * mendeklarasikan port yang ia butuhkan; adapter di bawah menerjemahkannya ke
 * layanan modul lain. Batasnya ditegakkan lint — `application/sales` tidak
 * dapat mengimpor `application/accounting` (D-040).
 *
 * Mengangkat salah satu modul menjadi layanan terpisah kelak berarti mengganti
 * adapter di berkas ini, bukan membongkar kode modul.
 */
export function createSalesDocuments(db: Queryable, tenantId: string): SalesDocumentService {
  return new SalesDocumentService(
    new PostgresSalesDocumentRepository(db, tenantId),
    () => uuidv7(),
  )
}

export function createSalesPosting(db: Queryable, tenantId: string): PostInvoiceService {
  const documents = new PostgresSalesDocumentRepository(db, tenantId)

  const accounts: AccountResolverPort = {
    async resolve(context) {
      const { rows } = await db.query<{
        id: string
        transaction_type: string
        item_category_id: string | null
        warehouse_id: string | null
        tax_code_id: string | null
        partner_type: string | null
        account_id: string
      }>(
        `SELECT id, transaction_type, item_category_id, warehouse_id, tax_code_id,
                partner_type, account_id
           FROM account_determination_rules
          WHERE tenant_id = $1 AND transaction_type = $2`,
        [tenantId, context.transactionType],
      )

      const rules: DeterminationRule[] = rows.map((row) => ({
        id: row.id,
        transactionType: row.transaction_type,
        itemCategoryId: row.item_category_id,
        warehouseId: row.warehouse_id,
        taxCodeId: row.tax_code_id,
        partnerType: row.partner_type,
        accountId: row.account_id,
      }))

      const hasil = resolveAccount(rules, context)

      // Aturan tidak ditemukan MENOLAK posting, dengan pesan yang menyebutkan
      // aturan apa yang kurang. Tidak ada akun cadangan — D-011.
      if (hasil.kind === 'not_found') {
        return { kind: 'unresolved', reason: explainNotFound(hasil.context) }
      }
      if (hasil.kind === 'ambiguous') {
        return {
          kind: 'unresolved',
          reason: `Dua aturan akun sama-sama paling spesifik untuk ${context.transactionType}. Perbaiki salah satunya di Pengaturan → Penentuan Akun.`,
        }
      }

      return { kind: 'resolved', accountId: hasil.rule.accountId }
    },
  }

  const ledger: LedgerPort = {
    async postJournal(input) {
      const service = new PostingService(
        new PostgresPostingRepository(db, tenantId),
        () => uuidv7(),
      )

      const hasil = await service.post({
        companyId: input.companyId,
        journalDate: input.journalDate,
        fiscalYear: input.fiscalYear,
        fiscalPeriod: input.fiscalPeriod,
        type: 'auto',
        currency: input.currency,
        description: `${input.sourceType} ${input.sourceId}`,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        lines: input.lines,
      })

      if (hasil.kind === 'posted') return { kind: 'posted', journalId: hasil.journalId }
      if (hasil.kind === 'unbalanced') {
        return {
          kind: 'rejected',
          reason: `Jurnal tidak berimbang: debit ${hasil.debit}, kredit ${hasil.credit}.`,
        }
      }
      return { kind: 'rejected', reason: `Jurnal ditolak: ${hasil.kind}.` }
    },
  }

  const stock: StockPort = {
    /**
     * Rata-rata tertimbang dari proyeksi saldo: nilai dibagi kuantitas.
     *
     * Lapisan biaya FIFO sudah ada tabelnya sejak Sesi D2 tetapi belum ada yang
     * mengonsumsinya. Sampai itu dibangun, metode biaya yang benar-benar
     * berlaku adalah rata-rata tertimbang — dan itu dinyatakan di sini alih-alih
     * disembunyikan sebagai angka yang muncul entah dari mana.
     */
    async unitCost(itemId, warehouseId) {
      const { rows } = await db.query<{ qty_on_hand: string; value: string }>(
        `SELECT qty_on_hand, value FROM stock_balances
          WHERE tenant_id = $1 AND item_id = $2 AND warehouse_id = $3`,
        [tenantId, itemId, warehouseId],
      )
      const row = rows[0]
      if (row === undefined) return 0
      const qty = Number(row.qty_on_hand)
      return qty === 0 ? 0 : Math.round((Number(row.value) / qty) * 10_000) / 10_000
    },

    async ship(input) {
      const service = new StockService(new PostgresStockRepository(db, tenantId), () => uuidv7())
      await service.move({
        companyId: input.companyId,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        type: 'shipment',
        // Keluar bernilai negatif — buku besar stok memakai satu kolom bertanda,
        // bukan dua kolom masuk dan keluar.
        qtyBase: -input.qty,
        unitCost: input.unitCost,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      })
    },
  }

  return new PostInvoiceService(documents, accounts, ledger, stock)
}
