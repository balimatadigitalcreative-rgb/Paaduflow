import { currencyDecimals } from './money-format.js'

/**
 * Urutan perhitungan baris dokumen — Flow_Archetypes §4.
 *
 * Ditetapkan sekali dan dipakai di Faktur, Tagihan, Pesanan, Penawaran,
 * Jurnal, Penyesuaian Stok, dan BOM. Karena itu ia tinggal di kernel bersama:
 * ia dipakai banyak modul dan tidak dimiliki satu pun.
 *
 * Dua hal yang menentukan kebenarannya:
 *
 * 1. **Diskon dokumen dialokasikan proporsional ke setiap baris, bukan
 *    dikurangkan di akhir.** Pajak dihitung per baris dan tarifnya dapat
 *    berbeda antar baris; mengurangkan diskon di akhir menghasilkan DPP dan
 *    pajak yang salah. Itu bukan kesalahan tampilan — itu kesalahan pelaporan
 *    pajak.
 *
 * 2. **Pembulatan hanya di langkah terakhir.** Seluruh hitungan antara berjalan
 *    sebagai bilangan bulat berskala mikro (enam angka penjaga), tidak pernah
 *    sebagai pecahan biner. Pembulatan bertahap menciptakan selisih beberapa
 *    rupiah yang akan dikejar akuntan selama berjam-jam.
 *
 * Status: urutan ini adalah **V-01** di docs/DECISIONS.md — menunggu validasi
 * konsultan pajak. Implementasi boleh berjalan; rilis tidak.
 */

/** Satu unit mata uang = sejuta mikro. Enam angka penjaga di bawah minor unit. */
const MICRO = 1_000_000n

function toMicro(value: number): bigint {
  return BigInt(Math.round(value * 1_000_000))
}

function fromMicro(value: bigint): number {
  return Number(value) / 1_000_000
}

export interface LineInput {
  readonly id: string
  readonly quantity: number
  readonly unitPrice: number
  /** Persen 0–100. Diabaikan bila `discountAmount` terisi. */
  readonly discountPercent?: number
  readonly discountAmount?: number
  /** Tarif pajak baris. Boleh berbeda antar baris dalam satu dokumen. */
  readonly taxRatePercent: number
}

export interface DocumentInput {
  readonly currency: string
  readonly lines: readonly LineInput[]
  readonly documentDiscountAmount?: number
  readonly documentDiscountPercent?: number
  /** Pemotongan PPh, dikurangkan di langkah terakhir. */
  readonly withholdingAmount?: number
}

export interface LineResult {
  readonly id: string
  readonly gross: number
  readonly discount: number
  readonly net: number
  readonly allocatedDocumentDiscount: number
  readonly taxBase: number
  readonly tax: number
}

export interface DocumentResult {
  readonly lines: readonly LineResult[]
  readonly subtotal: number
  readonly documentDiscount: number
  readonly taxBase: number
  readonly taxTotal: number
  readonly withholding: number
  readonly total: number
}

/**
 * Membagi sisa pembulatan memakai sisa terbesar.
 *
 * Tanpa ini, jumlah baris yang dibulatkan tidak sama dengan total yang
 * dibulatkan — dan invarian "jumlah nilai baris faktur sama dengan subtotalnya"
 * akan gagal pada dokumen mana pun yang angkanya tidak habis dibagi.
 */
function roundParts(parts: readonly bigint[], decimals: number): { rounded: bigint[]; total: bigint } {
  const faktor = 10n ** BigInt(decimals)
  const jumlah = parts.reduce((akumulasi, nilai) => akumulasi + nilai, 0n)
  const totalMinor = divideRound(jumlah * faktor, MICRO)

  const dasar = parts.map((nilai) => (nilai * faktor) / MICRO)
  const sisa = parts.map((nilai, index) => ({
    index,
    sisa: nilai * faktor - dasar[index]! * MICRO,
  }))

  let kekurangan = totalMinor - dasar.reduce((akumulasi, nilai) => akumulasi + nilai, 0n)
  const hasil = [...dasar]

  // Kekurangan dibagikan ke baris dengan sisa terbesar lebih dulu.
  sisa.sort((kiri, kanan) => (kanan.sisa > kiri.sisa ? 1 : kanan.sisa < kiri.sisa ? -1 : 0))
  for (const { index } of sisa) {
    if (kekurangan === 0n) break
    const langkah = kekurangan > 0n ? 1n : -1n
    hasil[index] = hasil[index]! + langkah
    kekurangan -= langkah
  }

  return { rounded: hasil, total: totalMinor }
}

function divideRound(pembilang: bigint, penyebut: bigint): bigint {
  const setengah = penyebut / 2n
  return pembilang >= 0n
    ? (pembilang + setengah) / penyebut
    : (pembilang - setengah) / penyebut
}

function toCurrency(minor: bigint, decimals: number): number {
  return Number(minor) / 10 ** decimals
}

export function calculateDocument(input: DocumentInput): DocumentResult {
  const decimals = currencyDecimals(input.currency)

  // Langkah 1–3: bruto, diskon baris, neto baris.
  const bruto = input.lines.map((line) => (toMicro(line.quantity) * toMicro(line.unitPrice)) / MICRO)

  const diskonBaris = input.lines.map((line, index) => {
    if (line.discountAmount !== undefined) return toMicro(line.discountAmount)
    if (line.discountPercent === undefined) return 0n
    return (bruto[index]! * toMicro(line.discountPercent)) / (100n * MICRO)
  })

  const neto = bruto.map((nilai, index) => nilai - diskonBaris[index]!)

  // Langkah 4: subtotal dokumen.
  const subtotal = neto.reduce((akumulasi, nilai) => akumulasi + nilai, 0n)

  // Langkah 5: diskon dokumen dialokasikan proporsional ke setiap baris.
  const diskonDokumen =
    input.documentDiscountAmount !== undefined
      ? toMicro(input.documentDiscountAmount)
      : input.documentDiscountPercent !== undefined
        ? (subtotal * toMicro(input.documentDiscountPercent)) / (100n * MICRO)
        : 0n

  const alokasi = neto.map((nilai) =>
    subtotal === 0n ? 0n : (diskonDokumen * nilai) / subtotal,
  )

  // Sisa pembagian diberikan ke baris pertama yang punya nilai, supaya jumlah
  // alokasi persis sama dengan diskon dokumen — bukan kurang beberapa mikro.
  const selisihAlokasi = diskonDokumen - alokasi.reduce((a, b) => a + b, 0n)
  if (selisihAlokasi !== 0n) {
    const target = neto.findIndex((nilai) => nilai !== 0n)
    if (target >= 0) alokasi[target] = alokasi[target]! + selisihAlokasi
  }

  // Langkah 6: DPP per baris, setelah alokasi.
  const dpp = neto.map((nilai, index) => nilai - alokasi[index]!)

  // Langkah 7: pajak dihitung PER BARIS di atas DPP baris itu.
  const pajak = dpp.map(
    (nilai, index) => (nilai * toMicro(input.lines[index]!.taxRatePercent)) / (100n * MICRO),
  )

  // Langkah 8: pembulatan — dan baru di sini.
  const netoBulat = roundParts(neto, decimals)
  const dppBulat = roundParts(dpp, decimals)
  const pajakBulat = roundParts(pajak, decimals)
  const alokasiBulat = roundParts(alokasi, decimals)
  const diskonBarisBulat = roundParts(diskonBaris, decimals)
  const brutoBulat = roundParts(bruto, decimals)

  const potongan = divideRound(toMicro(input.withholdingAmount ?? 0) * 10n ** BigInt(decimals), MICRO)
  const total = dppBulat.total + pajakBulat.total - potongan

  return {
    lines: input.lines.map((line, index) => ({
      id: line.id,
      gross: toCurrency(brutoBulat.rounded[index]!, decimals),
      discount: toCurrency(diskonBarisBulat.rounded[index]!, decimals),
      net: toCurrency(netoBulat.rounded[index]!, decimals),
      allocatedDocumentDiscount: toCurrency(alokasiBulat.rounded[index]!, decimals),
      taxBase: toCurrency(dppBulat.rounded[index]!, decimals),
      tax: toCurrency(pajakBulat.rounded[index]!, decimals),
    })),
    subtotal: toCurrency(netoBulat.total, decimals),
    documentDiscount: toCurrency(alokasiBulat.total, decimals),
    taxBase: toCurrency(dppBulat.total, decimals),
    taxTotal: toCurrency(pajakBulat.total, decimals),
    withholding: toCurrency(potongan, decimals),
    total: toCurrency(total, decimals),
  }
}

export { fromMicro }
