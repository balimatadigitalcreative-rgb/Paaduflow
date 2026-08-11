import type { MovementInput, ReservationInput, StockRepository } from '#application/inventory/stock'
import type { Queryable } from '#infrastructure/db/queryable'

export class PostgresStockRepository implements StockRepository {
  constructor(
    private readonly db: Queryable,
    private readonly tenantId: string,
  ) {}

  /**
   * `SELECT … FOR UPDATE`, bukan `SELECT` biasa.
   *
   * Inilah satu baris yang membedakan "tepat satu pesanan berhasil" dari "dua
   * pesanan sama-sama berhasil atas stok yang sama".
   */
  async lockBalance(
    itemId: string,
    warehouseId: string,
  ): Promise<{ onHand: number; reserved: number } | null> {
    const { rows } = await this.db.query<{ qty_on_hand: string; qty_reserved: string }>(
      `SELECT qty_on_hand, qty_reserved
         FROM stock_balances
        WHERE tenant_id = $1 AND item_id = $2 AND warehouse_id = $3
          FOR UPDATE`,
      [this.tenantId, itemId, warehouseId],
    )
    const row = rows[0]
    if (row === undefined) return null
    return { onHand: Number(row.qty_on_hand), reserved: Number(row.qty_reserved) }
  }

  async appendMovement(movement: MovementInput & { id: string }): Promise<void> {
    // `nextval`, bukan `max(sequence) + 1`. Yang kedua membuat dua mutasi
    // bersamaan membaca nilai maksimum yang sama dan bertabrakan di kekangan
    // unik — cacat yang ditemukan gerbang Sesi D4.
    //
    // Nomor boleh berlubang: kolom ini penanda posisi bagi proyeksi saldo,
    // bukan nomor dokumen yang dilihat auditor.
    await this.db.query(
      `INSERT INTO stock_movements
         (id, tenant_id, company_id, item_id, warehouse_id, sequence, type, qty_base,
          unit_cost, source_type, source_id)
       VALUES ($1, $2, $3, $4, $5,
               nextval('stock_movement_sequence'),
               $6::stock_movement_type, $7, $8, $9, $10)`,
      [
        movement.id,
        this.tenantId,
        movement.companyId,
        movement.itemId,
        movement.warehouseId,
        movement.type,
        movement.qtyBase,
        movement.unitCost ?? null,
        movement.sourceType ?? null,
        movement.sourceId ?? null,
      ],
    )
  }

  async applyToBalance(input: {
    companyId: string
    itemId: string
    warehouseId: string
    qtyDelta: number
    valueDelta: number
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO stock_balances
         (tenant_id, company_id, item_id, warehouse_id, qty_on_hand, value, last_movement_sequence)
       VALUES ($1, $2, $3, $4, $5, $6,
               (SELECT COALESCE(max(sequence), 0) FROM stock_movements
                 WHERE tenant_id = $1 AND company_id = $2))
       ON CONFLICT (tenant_id, item_id, warehouse_id) DO UPDATE
         SET qty_on_hand = stock_balances.qty_on_hand + EXCLUDED.qty_on_hand,
             value = stock_balances.value + EXCLUDED.value,
             last_movement_sequence = EXCLUDED.last_movement_sequence,
             updated_at = now()`,
      [
        this.tenantId,
        input.companyId,
        input.itemId,
        input.warehouseId,
        input.qtyDelta,
        input.valueDelta,
      ],
    )
  }

  async insertReservation(input: ReservationInput & { id: string }): Promise<void> {
    await this.db.query(
      `INSERT INTO stock_reservations
         (id, tenant_id, company_id, item_id, warehouse_id, qty_base, source_type, source_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.id,
        this.tenantId,
        input.companyId,
        input.itemId,
        input.warehouseId,
        input.qtyBase,
        input.sourceType,
        input.sourceId ?? null,
      ],
    )
  }

  async addReserved(itemId: string, warehouseId: string, delta: number): Promise<void> {
    await this.db.query(
      `UPDATE stock_balances
          SET qty_reserved = qty_reserved + $4, updated_at = now()
        WHERE tenant_id = $1 AND item_id = $2 AND warehouse_id = $3`,
      [this.tenantId, itemId, warehouseId, delta],
    )
  }

  async releaseReservation(reservationId: string): Promise<number | null> {
    const { rows } = await this.db.query<{ qty_base: string }>(
      `UPDATE stock_reservations
          SET released_at = now()
        WHERE tenant_id = $1 AND id = $2 AND released_at IS NULL
        RETURNING qty_base`,
      [this.tenantId, reservationId],
    )
    return rows[0] === undefined ? null : Number(rows[0].qty_base)
  }
}
