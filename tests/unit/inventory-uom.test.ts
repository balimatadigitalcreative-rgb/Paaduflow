import { describe, expect, test } from 'vitest'

import { availableQuantity, consumeFifo, fromBase, toBase } from '#domain/inventory/uom'

describe('konversi satuan', () => {
  test('bolak-balik tanpa kehilangan presisi', () => {
    // Satu karung = 25 kg. Beli per karung, jual per kilogram.
    for (const jumlah of [1, 2.5, 7, 13.25]) {
      expect(fromBase(toBase(jumlah, 25), 25)).toBe(jumlah)
    }
  })

  test('faktor pecahan tetap presisi pada empat desimal', () => {
    expect(toBase(3, 0.3333)).toBe(0.9999)
  })
})

describe('konsumsi FIFO', () => {
  const lapisan = [
    { id: 'l1', qtyRemaining: 10, unitCost: 1_000 },
    { id: 'l2', qtyRemaining: 5, unitCost: 1_200 },
  ]

  test('lapisan pertama habis lebih dulu', () => {
    const hasil = consumeFifo(lapisan, 10)

    expect(hasil.kind).toBe('consumed')
    if (hasil.kind !== 'consumed') throw new Error('tidak mungkin')
    expect(hasil.consumptions).toEqual([{ layerId: 'l1', quantity: 10, cost: 10_000 }])
    expect(hasil.totalCost).toBe(10_000)
  })

  test('lapisan terpotong: biaya dijumlahkan dari potongan, bukan dari rata-rata', () => {
    const hasil = consumeFifo(lapisan, 12)

    if (hasil.kind !== 'consumed') throw new Error('tidak mungkin')
    expect(hasil.consumptions).toEqual([
      { layerId: 'l1', quantity: 10, cost: 10_000 },
      { layerId: 'l2', quantity: 2, cost: 2_400 },
    ])
    // Rata-rata akan memberi 12 × 1.066,67 = 12.800,04 — meleset.
    expect(hasil.totalCost).toBe(12_400)
  })

  test('lapisan tidak cukup menghasilkan kekurangan, bukan biaya sebagian', () => {
    const hasil = consumeFifo(lapisan, 20)

    expect(hasil).toEqual({ kind: 'insufficient', short: 5 })
  })

  test('lapisan kosong dilewati, bukan menghentikan konsumsi', () => {
    const hasil = consumeFifo(
      [
        { id: 'habis', qtyRemaining: 0, unitCost: 900 },
        { id: 'isi', qtyRemaining: 3, unitCost: 1_000 },
      ],
      3,
    )

    if (hasil.kind !== 'consumed') throw new Error('tidak mungkin')
    expect(hasil.consumptions.map((item) => item.layerId)).toEqual(['isi'])
  })

  test('kuantitas nol tidak mengonsumsi apa pun', () => {
    expect(consumeFifo(lapisan, 0)).toEqual({ kind: 'consumed', consumptions: [], totalCost: 0 })
  })
})

describe('qty_available', () => {
  test('selalu on hand dikurangi reserved', () => {
    // Ia tidak pernah disimpan — fungsi ini ada supaya lapisan aplikasi memakai
    // definisi yang sama dengan kolom terhitung di basis data.
    expect(availableQuantity(100, 30)).toBe(70)
    expect(availableQuantity(100, 100)).toBe(0)
  })
})
