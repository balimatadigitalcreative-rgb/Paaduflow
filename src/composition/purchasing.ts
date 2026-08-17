import { PostingService } from '#application/accounting/posting'
import { StockService } from '#application/inventory/stock'
import { OverrideMatchService, PostBillService } from '#application/purchasing/bills'
import { PurchaseDocumentService } from '#application/purchasing/documents'
import type {
  AccountResolverPort,
  AuditPort,
  LedgerPort,
  StockPort,
} from '#application/purchasing/ports'
import { PostReceiptService } from '#application/purchasing/receipts'
import {
  explainNotFound,
  resolveAccount,
  type DeterminationRule,
} from '#domain/accounting/determination'
import { PostgresAuditLog } from '#infrastructure/audit/postgres-audit-log'
import type { Queryable } from '#infrastructure/db/queryable'
import { PostgresPostingRepository } from '#infrastructure/modules/accounting/postgres-posting-repository'
import { PostgresStockRepository } from '#infrastructure/modules/inventory/postgres-stock-repository'
import { PostgresPurchaseRepository } from '#infrastructure/modules/purchasing/postgres-purchase-repository'
import { uuidv7 } from '#shared/uuid'

/**
 * Penyambung modul Pembelian ke Akuntansi, Persediaan, dan audit trail.
 *
 * Adapter di sini kembar dengan yang ada di `sales.ts`, dan itu memang belum
 * disatukan: aturan proyek melarang membuat abstraksi sebelum ia dibutuhkan di
 * dua tempat. Sekarang ia dibutuhkan di dua tempat — dicatat sebagai D-119,
 * dan penyatuannya dilakukan saat modul ketiga membutuhkannya, bukan sekarang,
 * karena bentuk yang benar baru terlihat setelah tiga contoh.
 */

export interface PurchasingServices {
  readonly documents: PurchaseDocumentService
  readonly receipts: PostReceiptService
  readonly bills: PostBillService
  readonly override: OverrideMatchService
}

function createAccountResolver(db: Queryable, tenantId: string): AccountResolverPort {
  return {
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
          WHERE tenant_id = $1 AND company_id = $2 AND transaction_type = $3`,
        [tenantId, context.companyId, context.transactionType],
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
}

function createLedger(db: Queryable, tenantId: string): LedgerPort {
  return {
    async postJournal(input) {
      const service = new PostingService(new PostgresPostingRepository(db, tenantId), () => uuidv7())
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
}

export function createPurchasing(db: Queryable, tenantId: string): PurchasingServices {
  const repository = new PostgresPurchaseRepository(db, tenantId)
  const accounts = createAccountResolver(db, tenantId)
  const ledger = createLedger(db, tenantId)

  const stock: StockPort = {
    async receive(input) {
      const service = new StockService(new PostgresStockRepository(db, tenantId), () => uuidv7())
      await service.move({
        companyId: input.companyId,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        type: 'receipt',
        // Masuk bernilai positif — satu kolom bertanda, bukan dua kolom.
        qtyBase: input.qty,
        unitCost: input.unitCost,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      })
    },
  }

  const audit: AuditPort = {
    async record(event) {
      const log = new PostgresAuditLog(db, tenantId)
      await log.record({
        companyId: event.companyId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        actorId: event.actorId,
        payload: event.payload,
      })
    },
  }

  return {
    documents: new PurchaseDocumentService(repository, () => uuidv7()),
    receipts: new PostReceiptService(repository, accounts, ledger, stock, () => uuidv7()),
    bills: new PostBillService(repository, accounts, ledger),
    override: new OverrideMatchService(repository, audit),
  }
}
