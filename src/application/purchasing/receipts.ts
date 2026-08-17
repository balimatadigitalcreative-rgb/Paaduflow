import { evaluateConversion, type SourceLine } from '#shared/document-conversion'

import type { AccountResolverPort, LedgerPort, StockPort } from './ports'

/**
 * Penerimaan barang — Module 06 §9.
 *
 * Barang masuk gudang sebelum tagihan datang, dan sering sebelum harganya
 * pasti. Karena itu penerimaan TIDAK menimbulkan utang usaha: ia mendebit
 * persediaan dan mengkredit akun perantara penerimaan barang.
 *
 * Saldo akun perantara pada saat mana pun adalah nilai barang yang sudah
 * diterima tetapi belum ditagih. Utang usaha baru lahir saat tagihan diposting,
 * dan langkah itu pula yang mengosongkan akun perantara sebesar nilai yang
 * dicocokkan.
 *
 * Kalau penerimaan langsung menulis ke utang usaha, laporan utang akan memuat
 * angka yang belum pernah ditagih vendor mana pun — dan tidak akan ada satu
 * saldo pun yang dapat dipakai membuktikan berapa yang belum tertagih.
 */

export interface ReceiptLineInput {
  readonly poLineId: string
  readonly qtyReceived: number
  readonly qtyRejected?: number
  readonly rejectionReason?: string
}

export interface PostReceiptInput {
  readonly companyId: string
  readonly purchaseOrderId: string
  readonly warehouseId: string
  readonly receivedDate: Date
  readonly lines: readonly ReceiptLineInput[]
}

export interface OrderLineForReceipt extends SourceLine {
  readonly itemId: string | null
  readonly warehouseId: string | null
  readonly unitPrice: number
  readonly itemCategoryId: string | null
}

export interface ReceiptWritePort {
  loadOrderLines(
    purchaseOrderId: string,
  ): Promise<{
    companyId: string
    vendorId: string
    currency: string
    lifecycleStatus: string
    lines: readonly OrderLineForReceipt[]
  } | null>
  insertReceipt(receipt: {
    id: string
    companyId: string
    purchaseOrderId: string
    vendorId: string
    warehouseId: string
    receivedDate: Date
    receivedBy: string
  }): Promise<string>
  insertReceiptLines(
    receiptId: string,
    lines: readonly {
      id: string
      poLineId: string
      itemId: string
      qtyReceived: number
      qtyRejected: number
      rejectionReason: string | null
      unitCost: number
    }[],
  ): Promise<void>
  /** Menaikkan qty_received pada baris pesanan. */
  applyReceivedQuantities(lines: readonly { poLineId: string; qty: number }[]): Promise<void>
  markReceiptPosted(receiptId: string, at: Date): Promise<void>
}

export type PostReceiptResult =
  | { readonly kind: 'posted'; readonly receiptId: string; readonly journalId: string }
  | { readonly kind: 'order_not_found' }
  | { readonly kind: 'order_not_approved'; readonly status: string }
  | { readonly kind: 'exceeds_ordered'; readonly reasons: readonly string[] }
  | { readonly kind: 'unknown_line'; readonly poLineId: string }
  | { readonly kind: 'nothing_to_receive' }
  | { readonly kind: 'rejection_reason_required'; readonly poLineId: string }
  | { readonly kind: 'account_unresolved'; readonly reason: string }
  | { readonly kind: 'ledger_rejected'; readonly reason: string }

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export class PostReceiptService {
  constructor(
    private readonly writes: ReceiptWritePort,
    private readonly accounts: AccountResolverPort,
    private readonly ledger: LedgerPort,
    private readonly stock: StockPort,
    private readonly newId: () => string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async post(input: PostReceiptInput, receivedBy: string): Promise<PostReceiptResult> {
    const pesanan = await this.writes.loadOrderLines(input.purchaseOrderId)
    if (pesanan === null) return { kind: 'order_not_found' }
    if (pesanan.lifecycleStatus !== 'approved') {
      return { kind: 'order_not_approved', status: pesanan.lifecycleStatus }
    }

    // Sisa penerimaan dihitung dengan mesin konversi yang sama dengan Penjualan
    // — `delivery` di sana berarti "sudah bergerak fisik", dan di sini itu
    // berarti "sudah diterima".
    const putusan = evaluateConversion(
      pesanan.lines,
      input.lines.map((baris) => ({ sourceLineId: baris.poLineId, qty: baris.qtyReceived })),
      'delivery',
    )

    if (putusan.kind === 'unknown_line') {
      return { kind: 'unknown_line', poLineId: putusan.sourceLineId }
    }
    if (putusan.kind === 'nothing_to_convert') return { kind: 'nothing_to_receive' }
    if (putusan.kind === 'exceeds_remaining') {
      return {
        kind: 'exceeds_ordered',
        reasons: putusan.lines.map(
          (baris) =>
            `Baris ${baris.lineNo}: diterima ${baris.requested}, sisa pesanan ${baris.remaining}.`,
        ),
      }
    }

    for (const baris of input.lines) {
      if ((baris.qtyRejected ?? 0) > 0 && (baris.rejectionReason ?? '').trim() === '') {
        return { kind: 'rejection_reason_required', poLineId: baris.poLineId }
      }
    }

    const receiptId = this.newId()
    await this.writes.insertReceipt({
      id: receiptId,
      companyId: input.companyId,
      purchaseOrderId: input.purchaseOrderId,
      vendorId: pesanan.vendorId,
      warehouseId: input.warehouseId,
      receivedDate: input.receivedDate,
      receivedBy,
    })

    const barisPenerimaan: {
      id: string
      poLineId: string
      itemId: string
      qtyReceived: number
      qtyRejected: number
      rejectionReason: string | null
      unitCost: number
    }[] = []
    const mutasiStok: { itemId: string; qty: number; unitCost: number }[] = []
    let nilaiPersediaan = 0

    for (const permintaan of input.lines) {
      if (permintaan.qtyReceived <= 0) continue
      const barisPesanan = pesanan.lines.find((item) => item.id === permintaan.poLineId)
      if (barisPesanan === undefined || barisPesanan.itemId === null) continue

      // Harga pesanan, bukan harga tagihan. Tagihan belum ada saat barang datang.
      const nilai = round2(permintaan.qtyReceived * barisPesanan.unitPrice)
      nilaiPersediaan = round2(nilaiPersediaan + nilai)

      barisPenerimaan.push({
        id: this.newId(),
        poLineId: permintaan.poLineId,
        itemId: barisPesanan.itemId,
        qtyReceived: permintaan.qtyReceived,
        qtyRejected: permintaan.qtyRejected ?? 0,
        rejectionReason: permintaan.rejectionReason ?? null,
        unitCost: barisPesanan.unitPrice,
      })
      mutasiStok.push({
        itemId: barisPesanan.itemId,
        qty: permintaan.qtyReceived,
        unitCost: barisPesanan.unitPrice,
      })
    }

    if (barisPenerimaan.length === 0) return { kind: 'nothing_to_receive' }
    await this.writes.insertReceiptLines(receiptId, barisPenerimaan)

    const persediaan = await this.accounts.resolve({
      companyId: input.companyId,
      transactionType: 'purchasing.receipt.stock',
    })
    if (persediaan.kind === 'unresolved') {
      return { kind: 'account_unresolved', reason: persediaan.reason }
    }
    const perantara = await this.accounts.resolve({
      companyId: input.companyId,
      transactionType: 'purchasing.receipt.clearing',
    })
    if (perantara.kind === 'unresolved') {
      return { kind: 'account_unresolved', reason: perantara.reason }
    }

    const tanggal = input.receivedDate
    const jurnal = await this.ledger.postJournal({
      companyId: input.companyId,
      journalDate: tanggal,
      fiscalYear: tanggal.getFullYear(),
      fiscalPeriod: tanggal.getMonth() + 1,
      currency: pesanan.currency,
      sourceType: 'goods_receipt',
      sourceId: receiptId,
      lines: [
        { accountId: persediaan.accountId, debit: nilaiPersediaan, credit: 0 },
        // Bukan utang usaha. Vendor belum menagih apa pun.
        { accountId: perantara.accountId, debit: 0, credit: nilaiPersediaan },
      ],
    })

    if (jurnal.kind === 'rejected') return { kind: 'ledger_rejected', reason: jurnal.reason }

    for (const mutasi of mutasiStok) {
      await this.stock.receive({
        companyId: input.companyId,
        itemId: mutasi.itemId,
        warehouseId: input.warehouseId,
        qty: mutasi.qty,
        unitCost: mutasi.unitCost,
        sourceType: 'goods_receipt',
        sourceId: receiptId,
      })
    }

    await this.writes.applyReceivedQuantities(
      barisPenerimaan.map((baris) => ({ poLineId: baris.poLineId, qty: baris.qtyReceived })),
    )
    await this.writes.markReceiptPosted(receiptId, this.now())

    return { kind: 'posted', receiptId, journalId: jurnal.journalId }
  }
}
