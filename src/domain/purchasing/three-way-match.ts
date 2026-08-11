/**
 * Pencocokan tiga arah — Module 06 §11.
 *
 * Pesanan mengatakan apa yang dipesan dan dengan harga berapa. Penerimaan
 * mengatakan apa yang benar-benar datang. Tagihan mengatakan apa yang diminta
 * dibayar vendor. Ketiganya harus sepakat sebelum uang bergerak.
 *
 * Fungsi ini murni: tanpa basis data, tanpa jam, tanpa pengguna. Ia hanya
 * membandingkan angka dan menyatakan hasilnya. Keputusan tentang siapa boleh
 * memaafkan hasil itu adalah urusan lapisan aplikasi, bukan urusan di sini.
 */

export interface MatchLine {
  readonly lineNo: number
  readonly description: string
  /** Kuantitas yang dipesan pada baris pesanan. */
  readonly qtyOrdered: number
  /** Kuantitas yang sudah diterima dan lolos QC pada baris pesanan itu. */
  readonly qtyReceived: number
  /** Kuantitas yang sudah pernah ditagih sebelum tagihan ini. */
  readonly qtyBilledBefore: number
  /** Kuantitas yang diminta tagihan ini. */
  readonly qtyBilled: number
  /** Harga satuan di pesanan. */
  readonly orderedUnitPrice: number
  /** Harga satuan di tagihan. */
  readonly billedUnitPrice: number
}

export interface MatchTolerance {
  /** Berapa persen kelebihan penerimaan atas pesanan yang masih diterima. */
  readonly qtyOverReceiptPercent: number
  /** Selisih harga yang masih diterima, dalam persen. */
  readonly priceVariancePercent: number
  /** Selisih harga yang masih diterima, dalam nilai mutlak per baris. */
  readonly priceVarianceAmount: number
}

export const NO_TOLERANCE: MatchTolerance = {
  qtyOverReceiptPercent: 0,
  priceVariancePercent: 0,
  priceVarianceAmount: 0,
}

export type VarianceKind =
  /**
   * Ditagih melebihi yang diterima. TIDAK punya toleransi: menagih barang yang
   * belum datang tidak punya pembenaran operasional, sekecil apa pun angkanya.
   */
  | 'billed_over_received'
  /** Diterima melebihi yang dipesan di luar toleransi. */
  | 'received_over_ordered'
  /** Harga tagihan berbeda dari harga pesanan di luar toleransi. */
  | 'price_variance'

export interface Variance {
  readonly kind: VarianceKind
  readonly lineNo: number
  readonly description: string
  readonly expected: number
  readonly actual: number
  /** Selisih mutlak. Nilai untuk `price_variance` adalah selisih per baris. */
  readonly difference: number
}

export type MatchStatus = 'not_matched' | 'matched' | 'exception' | 'overridden'

export interface MatchResult {
  readonly status: Extract<MatchStatus, 'matched' | 'exception'>
  readonly variances: readonly Variance[]
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Membandingkan satu tagihan dengan pesanan dan penerimaannya.
 *
 * Seluruh baris diperiksa dan seluruh selisih dikumpulkan — orang yang
 * memperbaiki tagihan dua puluh baris tidak boleh menemukan satu kesalahan per
 * percobaan.
 */
export function matchThreeWay(
  lines: readonly MatchLine[],
  tolerance: MatchTolerance = NO_TOLERANCE,
): MatchResult {
  const variances: Variance[] = []

  for (const line of lines) {
    // ── Ditagih melawan diterima, tanpa toleransi ────────────────────────
    const totalDitagih = round4(line.qtyBilledBefore + line.qtyBilled)
    if (totalDitagih > line.qtyReceived) {
      variances.push({
        kind: 'billed_over_received',
        lineNo: line.lineNo,
        description: line.description,
        expected: line.qtyReceived,
        actual: totalDitagih,
        difference: round4(totalDitagih - line.qtyReceived),
      })
    }

    // ── Diterima melawan dipesan, dengan toleransi ───────────────────────
    const batasTerima = round4(line.qtyOrdered * (1 + tolerance.qtyOverReceiptPercent / 100))
    if (line.qtyReceived > batasTerima) {
      variances.push({
        kind: 'received_over_ordered',
        lineNo: line.lineNo,
        description: line.description,
        expected: line.qtyOrdered,
        actual: line.qtyReceived,
        difference: round4(line.qtyReceived - line.qtyOrdered),
      })
    }

    // ── Harga tagihan melawan harga pesanan ──────────────────────────────
    //
    // Dua toleransi, dan yang longgar yang menang: persentase melindungi baris
    // bernilai besar, nilai mutlak melindungi baris bernilai kecil yang
    // persentasenya besar hanya karena pembaginya kecil.
    const selisihSatuan = round4(Math.abs(line.billedUnitPrice - line.orderedUnitPrice))
    if (selisihSatuan > 0) {
      const qty = line.qtyBilled
      const selisihBaris = round2(selisihSatuan * qty)
      const batasPersen =
        line.orderedUnitPrice === 0
          ? 0
          : round4((Math.abs(line.orderedUnitPrice) * tolerance.priceVariancePercent) / 100)

      const dalamPersen = selisihSatuan <= batasPersen
      const dalamNilai = selisihBaris <= tolerance.priceVarianceAmount

      if (!dalamPersen && !dalamNilai) {
        variances.push({
          kind: 'price_variance',
          lineNo: line.lineNo,
          description: line.description,
          expected: line.orderedUnitPrice,
          actual: line.billedUnitPrice,
          difference: selisihBaris,
        })
      }
    }
  }

  return variances.length === 0
    ? { status: 'matched', variances: [] }
    : { status: 'exception', variances }
}

/**
 * Nilai barang yang sudah diterima tetapi belum ditagih, pada harga pesanan.
 *
 * Inilah yang harus sama dengan saldo akun perantara penerimaan barang di
 * setiap saat — invarian yang diuji di `tests/invariants/akun-perantara.test.ts`.
 */
export function unbilledReceiptValue(
  lines: readonly { qtyReceived: number; qtyBilled: number; orderedUnitPrice: number }[],
): number {
  return round2(
    lines.reduce(
      (total, line) => total + (line.qtyReceived - line.qtyBilled) * line.orderedUnitPrice,
      0,
    ),
  )
}

/** Penjelasan selisih dalam bahasa manusia, dipakai UI dan pesan galat API. */
export function explainVariance(variance: Variance): string {
  switch (variance.kind) {
    case 'billed_over_received':
      return `Baris ${variance.lineNo} (${variance.description}): ditagih ${variance.actual}, baru diterima ${variance.expected}. Selisih ${variance.difference} belum datang.`
    case 'received_over_ordered':
      return `Baris ${variance.lineNo} (${variance.description}): diterima ${variance.actual}, dipesan ${variance.expected}. Kelebihan ${variance.difference} di luar toleransi.`
    case 'price_variance':
      return `Baris ${variance.lineNo} (${variance.description}): harga tagihan ${variance.actual}, harga pesanan ${variance.expected}. Selisih ${variance.difference} di luar toleransi.`
  }
}
