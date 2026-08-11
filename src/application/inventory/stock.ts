import { availableQuantity } from '#domain/inventory/uom'

/**
 * Mutasi stok dan reservasi.
 *
 * Reservasi memakai **penguncian baris**, bukan periksa-lalu-tulis. Perbedaan
 * itu adalah seluruh isi uji konkurensi modul ini: dua pesanan bersamaan atas
 * sisa stok terakhir harus menghasilkan tepat satu keberhasilan, dan
 * periksa-lalu-tulis akan meloloskan keduanya.
 */

export interface MovementInput {
  readonly companyId: string
  readonly itemId: string
  readonly warehouseId: string
  readonly type: 'receipt' | 'shipment' | 'adjustment' | 'production' | 'consumption'
  /** Positif masuk, negatif keluar. Selalu satuan dasar. */
  readonly qtyBase: number
  readonly unitCost?: number
  readonly sourceType?: string
  readonly sourceId?: string
}

export interface ReservationInput {
  readonly companyId: string
  readonly itemId: string
  readonly warehouseId: string
  readonly qtyBase: number
  readonly sourceType: string
  readonly sourceId?: string
}

export interface StockRepository {
  /**
   * Mengunci baris saldo dan mengembalikan angkanya.
   *
   * Penguncian terjadi di sini, bukan di layanan — layanan tidak boleh punya
   * jalan membaca saldo tanpa menguncinya lebih dulu.
   */
  lockBalance(
    itemId: string,
    warehouseId: string,
  ): Promise<{ onHand: number; reserved: number } | null>
  appendMovement(movement: MovementInput & { id: string }): Promise<void>
  applyToBalance(input: {
    companyId: string
    itemId: string
    warehouseId: string
    qtyDelta: number
    valueDelta: number
  }): Promise<void>
  insertReservation(input: ReservationInput & { id: string }): Promise<void>
  addReserved(itemId: string, warehouseId: string, delta: number): Promise<void>
  releaseReservation(reservationId: string): Promise<number | null>
}

export type ReserveResult =
  | { readonly kind: 'reserved'; readonly reservationId: string }
  /** Reservasi tidak boleh melebihi `qty_available` — Module 05 §11. */
  | { readonly kind: 'insufficient'; readonly available: number }
  | { readonly kind: 'unknown_position' }

export class StockService {
  constructor(
    private readonly repository: StockRepository,
    private readonly newId: () => string,
  ) {}

  /**
   * Mencatat mutasi lalu memajukan proyeksi saldo.
   *
   * Keduanya dalam satu transaksi milik pemanggil. Bila proyeksi tertinggal
   * karena apa pun, ia dapat dibangun ulang dari mutasi — mutasi yang benar.
   */
  async move(input: MovementInput): Promise<{ movementId: string }> {
    const id = this.newId()
    await this.repository.appendMovement({ ...input, id })
    await this.repository.applyToBalance({
      companyId: input.companyId,
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      qtyDelta: input.qtyBase,
      valueDelta: input.qtyBase * (input.unitCost ?? 0),
    })
    return { movementId: id }
  }

  async reserve(input: ReservationInput): Promise<ReserveResult> {
    // Baris dikunci lebih dulu. Dua permintaan bersamaan akan berbaris di sini,
    // bukan sama-sama membaca saldo lama lalu sama-sama menyimpan.
    const saldo = await this.repository.lockBalance(input.itemId, input.warehouseId)
    if (saldo === null) return { kind: 'unknown_position' }

    const tersedia = availableQuantity(saldo.onHand, saldo.reserved)
    if (input.qtyBase > tersedia) return { kind: 'insufficient', available: tersedia }

    const id = this.newId()
    await this.repository.insertReservation({ ...input, id })
    await this.repository.addReserved(input.itemId, input.warehouseId, input.qtyBase)
    return { kind: 'reserved', reservationId: id }
  }

  /** Melepas reservasi. Idempoten: reservasi yang sudah lepas menjawab false. */
  async release(reservationId: string, itemId: string, warehouseId: string): Promise<boolean> {
    const qty = await this.repository.releaseReservation(reservationId)
    if (qty === null) return false
    await this.repository.addReserved(itemId, warehouseId, -qty)
    return true
  }
}
