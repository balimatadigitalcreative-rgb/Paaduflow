import { describe, expect, test } from 'vitest'

import {
  explainVariance,
  matchThreeWay,
  NO_TOLERANCE,
  unbilledReceiptValue,
  type MatchLine,
  type MatchTolerance,
} from '#domain/purchasing/three-way-match'

/**
 * Seluruh kombinasi kuantitas dan harga.
 *
 * Yang dijaga paling ketat adalah satu baris: menagih melebihi yang diterima
 * tidak punya toleransi, berapa pun toleransi yang dipasang company.
 */

function baris(override: Partial<MatchLine> = {}): MatchLine {
  return {
    lineNo: 1,
    description: 'Semen 50kg',
    qtyOrdered: 100,
    qtyReceived: 100,
    qtyBilledBefore: 0,
    qtyBilled: 100,
    orderedUnitPrice: 65_000,
    billedUnitPrice: 65_000,
    ...override,
  }
}

const LONGGAR: MatchTolerance = {
  qtyOverReceiptPercent: 10,
  priceVariancePercent: 5,
  priceVarianceAmount: 50_000,
}

describe('pencocokan yang lolos', () => {
  test('ketiganya sepakat', () => {
    expect(matchThreeWay([baris()])).toEqual({ status: 'matched', variances: [] })
  })

  test('penagihan bertahap atas penerimaan penuh', () => {
    const hasil = matchThreeWay([baris({ qtyBilledBefore: 40, qtyBilled: 60 })])
    expect(hasil.status).toBe('matched')
  })

  test('penerimaan sebagian ditagih sebagian', () => {
    expect(matchThreeWay([baris({ qtyReceived: 40, qtyBilled: 40 })]).status).toBe('matched')
  })
})

describe('ditagih melebihi diterima', () => {
  test('ditolak walau hanya satu satuan', () => {
    const hasil = matchThreeWay([baris({ qtyReceived: 99, qtyBilled: 100 })])

    expect(hasil.status).toBe('exception')
    expect(hasil.variances).toEqual([
      {
        kind: 'billed_over_received',
        lineNo: 1,
        description: 'Semen 50kg',
        expected: 99,
        actual: 100,
        difference: 1,
      },
    ])
  })

  test('toleransi paling longgar pun tidak melonggarkannya', () => {
    // Ini yang membedakannya dari dua selisih lain. Barang yang belum datang
    // tidak menjadi datang karena company memasang toleransi 10 persen.
    const hasil = matchThreeWay([baris({ qtyReceived: 99, qtyBilled: 100 })], LONGGAR)
    expect(hasil.variances.map((selisih) => selisih.kind)).toContain('billed_over_received')
  })

  test('penagihan sebelumnya ikut dihitung', () => {
    // Dua tagihan masing-masing 60 atas penerimaan 100: yang kedua melebihi,
    // meski sendirian ia terlihat wajar.
    const hasil = matchThreeWay([baris({ qtyBilledBefore: 60, qtyBilled: 60 })])

    expect(hasil.status).toBe('exception')
    expect(hasil.variances[0]).toMatchObject({ actual: 120, expected: 100, difference: 20 })
  })

  test('belum ada penerimaan sama sekali', () => {
    const hasil = matchThreeWay([baris({ qtyReceived: 0 })])
    expect(hasil.variances[0]?.kind).toBe('billed_over_received')
  })
})

describe('diterima melebihi dipesan', () => {
  test('tanpa toleransi, kelebihan sekecil apa pun menjadi selisih', () => {
    const hasil = matchThreeWay([baris({ qtyReceived: 101, qtyBilled: 101 })], NO_TOLERANCE)
    expect(hasil.variances.map((selisih) => selisih.kind)).toEqual(['received_over_ordered'])
  })

  test('di dalam toleransi persen, diterima', () => {
    expect(
      matchThreeWay([baris({ qtyReceived: 110, qtyBilled: 110 })], LONGGAR).status,
    ).toBe('matched')
  })

  test('tepat di batas toleransi masih lolos', () => {
    const batas: MatchTolerance = { ...NO_TOLERANCE, qtyOverReceiptPercent: 5 }
    expect(matchThreeWay([baris({ qtyReceived: 105, qtyBilled: 105 })], batas).status).toBe(
      'matched',
    )
  })

  test('sedikit di atas batas ditolak', () => {
    const batas: MatchTolerance = { ...NO_TOLERANCE, qtyOverReceiptPercent: 5 }
    expect(matchThreeWay([baris({ qtyReceived: 106, qtyBilled: 106 })], batas).status).toBe(
      'exception',
    )
  })
})

describe('selisih harga', () => {
  test('harga naik di luar toleransi ditolak', () => {
    const hasil = matchThreeWay([baris({ billedUnitPrice: 70_000 })])

    expect(hasil.variances).toEqual([
      {
        kind: 'price_variance',
        lineNo: 1,
        description: 'Semen 50kg',
        expected: 65_000,
        actual: 70_000,
        difference: 500_000,
      },
    ])
  })

  test('harga TURUN pun menjadi selisih', () => {
    // Vendor yang menagih lebih murah dari pesanan tetap menyimpang dari
    // kesepakatan; sering ia gejala tertukarnya baris atau tertukarnya vendor.
    expect(matchThreeWay([baris({ billedUnitPrice: 60_000 })]).status).toBe('exception')
  })

  test('toleransi persen menyelamatkan baris bernilai besar', () => {
    // 66.000 atas 65.000 = 1,54 persen, di bawah 5 persen.
    expect(matchThreeWay([baris({ billedUnitPrice: 66_000 })], LONGGAR).status).toBe('matched')
  })

  test('toleransi nilai mutlak menyelamatkan baris bernilai kecil', () => {
    // 1.500 atas 1.000 = 50 persen — jauh di luar toleransi persen. Tetapi
    // seluruh selisihnya hanya Rp5.000 untuk sepuluh satuan.
    const kecil = baris({ qtyOrdered: 10, qtyReceived: 10, qtyBilled: 10, orderedUnitPrice: 1_000, billedUnitPrice: 1_500 })
    expect(matchThreeWay([kecil], LONGGAR).status).toBe('matched')
  })

  test('harga pesanan nol tidak membuat toleransi persen tak terhingga', () => {
    // Persen dari nol adalah nol. Baris yang dipesan gratis lalu ditagih
    // menjadi selisih, dan tidak ada perkalian yang dapat memaafkannya lewat
    // jalur persen.
    const persenSaja: MatchTolerance = { ...NO_TOLERANCE, priceVariancePercent: 5 }
    const gratis = baris({ orderedUnitPrice: 0, billedUnitPrice: 100 })
    expect(matchThreeWay([gratis], persenSaja).status).toBe('exception')
  })

  test('toleransi nilai mutlak tetap berlaku pada harga pesanan nol', () => {
    // Dan itu memang dimaksudkan: yang menjaga baris seperti ini adalah batas
    // rupiahnya, bukan batas persennya.
    const gratis = baris({ qtyBilled: 10, orderedUnitPrice: 0, billedUnitPrice: 100 })
    expect(matchThreeWay([gratis], LONGGAR).status).toBe('matched')
  })
})

describe('beberapa selisih sekaligus', () => {
  test('seluruh baris diperiksa, bukan berhenti di yang pertama', () => {
    const hasil = matchThreeWay([
      baris({ lineNo: 1, qtyReceived: 50, qtyBilled: 100 }),
      baris({ lineNo: 2, description: 'Pasir', billedUnitPrice: 90_000 }),
      baris({ lineNo: 3, description: 'Besi', qtyReceived: 200, qtyBilled: 200 }),
    ])

    expect(hasil.status).toBe('exception')
    expect(hasil.variances.map((selisih) => `${selisih.lineNo}:${selisih.kind}`)).toEqual([
      '1:billed_over_received',
      '2:price_variance',
      '3:received_over_ordered',
    ])
  })

  test('satu baris dapat punya dua selisih sekaligus', () => {
    const hasil = matchThreeWay([baris({ qtyReceived: 150, qtyBilled: 200, billedUnitPrice: 80_000 })])
    expect(hasil.variances.map((selisih) => selisih.kind)).toEqual([
      'billed_over_received',
      'received_over_ordered',
      'price_variance',
    ])
  })

  test('setiap selisih punya kalimat yang menyebutkan angkanya', () => {
    const hasil = matchThreeWay([baris({ qtyReceived: 99, qtyBilled: 100 })])
    const kalimat = explainVariance(hasil.variances[0]!)

    expect(kalimat).toContain('Semen 50kg')
    expect(kalimat).toContain('99')
    expect(kalimat).toContain('100')
  })
})

describe('nilai barang diterima belum ditagih', () => {
  test('nol saat semuanya sudah ditagih', () => {
    expect(
      unbilledReceiptValue([{ qtyReceived: 100, qtyBilled: 100, orderedUnitPrice: 65_000 }]),
    ).toBe(0)
  })

  test('memakai harga pesanan, bukan harga tagihan', () => {
    expect(
      unbilledReceiptValue([{ qtyReceived: 100, qtyBilled: 40, orderedUnitPrice: 65_000 }]),
    ).toBe(3_900_000)
  })

  test('menjumlah lintas baris', () => {
    expect(
      unbilledReceiptValue([
        { qtyReceived: 10, qtyBilled: 0, orderedUnitPrice: 1_000 },
        { qtyReceived: 5, qtyBilled: 5, orderedUnitPrice: 2_000 },
        { qtyReceived: 3, qtyBilled: 1, orderedUnitPrice: 500 },
      ]),
    ).toBe(11_000)
  })
})
