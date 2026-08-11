/**
 * Konversi satuan dan konsumsi lapisan biaya — Module 05 §4 dan §12.
 *
 * Murni, karena keduanya termasuk hal yang wajib diuji unit menurut §12:
 * konversi bolak-balik tanpa kehilangan presisi, dan konsumsi FIFO termasuk
 * kasus lapisan terpotong.
 */

/**
 * Seluruh mutasi disimpan dalam satuan dasar. Konversi hanya terjadi di lapis
 * tampilan dan input — begitu sebuah angka masuk ke buku besar, ia sudah dalam
 * satuan dasar dan tidak pernah dikonversi lagi.
 */
export function toBase(quantity: number, factorToBase: number): number {
  return round4(quantity * factorToBase)
}

export function fromBase(quantityBase: number, factorToBase: number): number {
  return round4(quantityBase / factorToBase)
}

/** Empat angka desimal, sama dengan `numeric(18,4)` di basis data. */
function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

export interface CostLayer {
  readonly id: string
  readonly qtyRemaining: number
  readonly unitCost: number
}

export interface LayerConsumption {
  readonly layerId: string
  readonly quantity: number
  readonly cost: number
}

export type ConsumeResult =
  | { readonly kind: 'consumed'; readonly consumptions: readonly LayerConsumption[]; readonly totalCost: number }
  /** Lapisan tidak cukup. Nilai kekurangannya disertakan supaya pesannya berguna. */
  | { readonly kind: 'insufficient'; readonly short: number }

/**
 * Konsumsi FIFO. Lapisan dipakai berurutan; lapisan terakhir boleh terpotong.
 *
 * Biaya dijumlahkan dari potongan, bukan dari rata-rata — rata-rata akan
 * meleset begitu dua penerimaan berharga berbeda bertemu dalam satu pengeluaran.
 */
export function consumeFifo(layers: readonly CostLayer[], quantity: number): ConsumeResult {
  if (quantity <= 0) return { kind: 'consumed', consumptions: [], totalCost: 0 }

  const consumptions: LayerConsumption[] = []
  let sisa = quantity
  let biaya = 0

  for (const layer of layers) {
    if (sisa <= 0) break
    if (layer.qtyRemaining <= 0) continue

    const diambil = round4(Math.min(sisa, layer.qtyRemaining))
    const biayaPotongan = round4(diambil * layer.unitCost)

    consumptions.push({ layerId: layer.id, quantity: diambil, cost: biayaPotongan })
    biaya = round4(biaya + biayaPotongan)
    sisa = round4(sisa - diambil)
  }

  if (sisa > 0) return { kind: 'insufficient', short: sisa }
  return { kind: 'consumed', consumptions, totalCost: biaya }
}

/**
 * `qty_available` tidak pernah disimpan — D-014.
 *
 * Fungsi ini ada supaya lapisan aplikasi memakai definisi yang sama dengan
 * kolom terhitung di basis data, bukan supaya nilainya ditulis ke mana pun.
 */
export function availableQuantity(onHand: number, reserved: number): number {
  return round4(onHand - reserved)
}
