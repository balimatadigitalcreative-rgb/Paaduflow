import { describe, expect, test } from 'vitest'

import { calculateDocument, type LineInput } from '#shared/line-items'

/**
 * Urutan perhitungan Flow_Archetypes §4.
 *
 * Yang diuji di sini bukan bahwa angkanya keluar, melainkan bahwa urutannya
 * benar — khususnya bahwa diskon dokumen dialokasikan ke baris SEBELUM pajak,
 * bukan dikurangkan setelahnya.
 */

function baris(patch: Partial<LineInput> & { id: string }): LineInput {
  return { quantity: 1, unitPrice: 0, taxRatePercent: 11, ...patch }
}

describe('urutan perhitungan', () => {
  test('bruto, diskon baris, neto', () => {
    const hasil = calculateDocument({
      currency: 'IDR',
      lines: [baris({ id: 'a', quantity: 3, unitPrice: 100_000, discountPercent: 10 })],
    })

    expect(hasil.lines[0]).toMatchObject({ gross: 300_000, discount: 30_000, net: 270_000 })
  })

  test('diskon baris nominal mengalahkan persen', () => {
    const hasil = calculateDocument({
      currency: 'IDR',
      lines: [
        baris({ id: 'a', unitPrice: 100_000, discountPercent: 50, discountAmount: 25_000 }),
      ],
    })

    expect(hasil.lines[0]?.discount).toBe(25_000)
  })

  test('diskon dokumen dialokasikan proporsional, bukan dikurangkan di akhir', () => {
    // Dua baris dengan tarif pajak BERBEDA. Inilah kasus yang membedakan
    // urutan yang benar dari yang salah.
    const hasil = calculateDocument({
      currency: 'IDR',
      documentDiscountAmount: 100_000,
      lines: [
        baris({ id: 'kena-pajak', unitPrice: 600_000, taxRatePercent: 11 }),
        baris({ id: 'bebas-pajak', unitPrice: 400_000, taxRatePercent: 0 }),
      ],
    })

    // Alokasi mengikuti proporsi neto: 60% dan 40%.
    expect(hasil.lines[0]?.allocatedDocumentDiscount).toBe(60_000)
    expect(hasil.lines[1]?.allocatedDocumentDiscount).toBe(40_000)

    // DPP baris pertama 540.000, pajaknya 11% dari situ — bukan 11% dari
    // 600.000, dan bukan 11% dari (1.000.000 − 100.000).
    expect(hasil.lines[0]?.taxBase).toBe(540_000)
    expect(hasil.lines[0]?.tax).toBe(59_400)
    expect(hasil.lines[1]?.tax).toBe(0)

    expect(hasil.taxBase).toBe(900_000)
    expect(hasil.taxTotal).toBe(59_400)
    expect(hasil.total).toBe(959_400)
  })

  test('mengurangkan diskon di akhir akan menghasilkan angka yang berbeda', () => {
    // Pembanding: bila diskon dikurangkan setelah pajak dihitung atas neto
    // penuh, pajaknya menjadi 11% × 600.000 = 66.000 — selisih 6.600 dari
    // hasil yang benar. Selisih itu masuk ke pelaporan pajak.
    const salah = 600_000 * 0.11
    const hasil = calculateDocument({
      currency: 'IDR',
      documentDiscountAmount: 100_000,
      lines: [
        baris({ id: 'a', unitPrice: 600_000, taxRatePercent: 11 }),
        baris({ id: 'b', unitPrice: 400_000, taxRatePercent: 0 }),
      ],
    })

    expect(hasil.lines[0]?.tax).not.toBe(salah)
    expect(salah - (hasil.lines[0]?.tax ?? 0)).toBe(6_600)
  })

  test('pemotongan PPh dikurangkan di langkah terakhir', () => {
    const hasil = calculateDocument({
      currency: 'IDR',
      withholdingAmount: 20_000,
      lines: [baris({ id: 'a', unitPrice: 1_000_000, taxRatePercent: 11 })],
    })

    expect(hasil.taxTotal).toBe(110_000)
    expect(hasil.total).toBe(1_090_000)
  })
})

describe('pembulatan', () => {
  test('jumlah baris selalu sama dengan subtotal, meski tidak habis dibagi', () => {
    // Tiga baris yang membagi diskon 100 rupiah — 33,33 per baris.
    const hasil = calculateDocument({
      currency: 'IDR',
      documentDiscountAmount: 100,
      lines: ['a', 'b', 'c'].map((id) => baris({ id, unitPrice: 1_000, taxRatePercent: 0 })),
    })

    const jumlahAlokasi = hasil.lines.reduce(
      (akumulasi, item) => akumulasi + item.allocatedDocumentDiscount,
      0,
    )
    // Invarian: jumlah nilai baris sama dengan nilai dokumen. Tanpa pembagian
    // sisa terbesar, ini akan meleset satu rupiah.
    expect(jumlahAlokasi).toBe(hasil.documentDiscount)
    expect(jumlahAlokasi).toBe(100)

    const jumlahDpp = hasil.lines.reduce((akumulasi, item) => akumulasi + item.taxBase, 0)
    expect(jumlahDpp).toBe(hasil.taxBase)
  })

  test('pembulatan hanya di akhir, bukan bertahap', () => {
    // 3 × 333,33 = 999,99 → 1.000 setelah dibulatkan sekali.
    // Bila tiap baris dibulatkan lebih dulu: 3 × 333 = 999.
    const hasil = calculateDocument({
      currency: 'IDR',
      lines: ['a', 'b', 'c'].map((id) =>
        baris({ id, unitPrice: 333.33, taxRatePercent: 0 }),
      ),
    })

    expect(hasil.subtotal).toBe(1_000)
  })

  test('mata uang berdesimal dua dihormati', () => {
    const hasil = calculateDocument({
      currency: 'USD',
      lines: [baris({ id: 'a', quantity: 3, unitPrice: 19.99, taxRatePercent: 0 })],
    })

    expect(hasil.subtotal).toBe(59.97)
  })
})

describe('kasus batas', () => {
  test('diskon nol tidak mengubah apa pun', () => {
    const hasil = calculateDocument({
      currency: 'IDR',
      documentDiscountAmount: 0,
      lines: [baris({ id: 'a', unitPrice: 500_000, taxRatePercent: 11 })],
    })

    expect(hasil.lines[0]?.allocatedDocumentDiscount).toBe(0)
    expect(hasil.taxBase).toBe(500_000)
  })

  test('baris berkuantitas nol tidak menerima alokasi diskon', () => {
    const hasil = calculateDocument({
      currency: 'IDR',
      documentDiscountAmount: 50_000,
      lines: [
        baris({ id: 'kosong', quantity: 0, unitPrice: 100_000 }),
        baris({ id: 'isi', quantity: 1, unitPrice: 100_000 }),
      ],
    })

    expect(hasil.lines[0]?.net).toBe(0)
    expect(hasil.lines[0]?.allocatedDocumentDiscount).toBe(0)
    // Seluruh diskon jatuh ke baris yang punya nilai.
    expect(hasil.lines[1]?.allocatedDocumentDiscount).toBe(50_000)
  })

  test('dokumen tanpa baris tidak meledak', () => {
    const hasil = calculateDocument({ currency: 'IDR', lines: [], documentDiscountAmount: 1_000 })

    expect(hasil.subtotal).toBe(0)
    expect(hasil.total).toBe(0)
  })

  test('seluruh dokumen bebas pajak', () => {
    const hasil = calculateDocument({
      currency: 'IDR',
      lines: [baris({ id: 'a', unitPrice: 250_000, taxRatePercent: 0 })],
    })

    expect(hasil.taxTotal).toBe(0)
    expect(hasil.total).toBe(250_000)
  })

  test('kuantitas pecahan, misalnya 2,5 kg', () => {
    const hasil = calculateDocument({
      currency: 'IDR',
      lines: [baris({ id: 'a', quantity: 2.5, unitPrice: 12_000, taxRatePercent: 0 })],
    })

    expect(hasil.subtotal).toBe(30_000)
  })
})
