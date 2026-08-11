/**
 * Konversi dokumen — Flow_Archetypes Archetype 3.
 *
 * Dipindahkan dari `domain/sales/` bersama mesin siklus hidup, dan karena
 * alasan yang sama: Penawaran → Pesanan → Faktur dan RFQ → Pesanan → Penerimaan
 * → Tagihan adalah pola yang sama, dan pola yang sama tidak boleh punya dua
 * implementasi.
 */

export interface SourceLine {
  readonly id: string
  readonly lineNo: number
  readonly qty: number
  readonly qtyInvoiced: number
  readonly qtyDelivered: number
}

export interface ConversionRequest {
  readonly sourceLineId: string
  readonly qty: number
}

/**
 * `invoice` melacak apa yang sudah ditagih, `delivery` apa yang sudah bergerak
 * secara fisik. Di Pembelian keduanya berarti "ditagih" dan "diterima" — sisi
 * yang berbeda dari transaksi yang sama.
 */
export type ConversionTarget = 'invoice' | 'delivery'

export interface LineShortfall {
  readonly lineNo: number
  readonly requested: number
  readonly remaining: number
}

export type ConversionVerdict =
  | { readonly kind: 'allowed'; readonly total: number }
  | { readonly kind: 'exceeds_remaining'; readonly lines: readonly LineShortfall[] }
  | { readonly kind: 'unknown_line'; readonly sourceLineId: string }
  | { readonly kind: 'nothing_to_convert' }

export function remainingOf(line: SourceLine, target: ConversionTarget): number {
  const terpakai = target === 'invoice' ? line.qtyInvoiced : line.qtyDelivered
  return round4(line.qty - terpakai)
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

export function evaluateConversion(
  sourceLines: readonly SourceLine[],
  requests: readonly ConversionRequest[],
  target: ConversionTarget,
): ConversionVerdict {
  const diminta = requests.filter((item) => item.qty > 0)
  if (diminta.length === 0) return { kind: 'nothing_to_convert' }

  const kurang: LineShortfall[] = []
  let total = 0

  for (const permintaan of diminta) {
    const baris = sourceLines.find((item) => item.id === permintaan.sourceLineId)
    if (baris === undefined) {
      return { kind: 'unknown_line', sourceLineId: permintaan.sourceLineId }
    }

    const sisa = remainingOf(baris, target)
    if (permintaan.qty > sisa) {
      // Seluruh baris yang melebihi dikumpulkan, bukan berhenti di yang pertama.
      // Orang yang mengonversi lima puluh baris tidak boleh diberi tahu satu
      // kesalahan per percobaan.
      kurang.push({ lineNo: baris.lineNo, requested: permintaan.qty, remaining: sisa })
      continue
    }

    total = round4(total + permintaan.qty)
  }

  if (kurang.length > 0) return { kind: 'exceeds_remaining', lines: kurang }
  return { kind: 'allowed', total }
}

/** Dokumen sumber selesai bila seluruh barisnya habis terkonversi. */
export function isFullyConverted(
  sourceLines: readonly SourceLine[],
  target: ConversionTarget,
): boolean {
  return sourceLines.every((line) => remainingOf(line, target) === 0)
}
