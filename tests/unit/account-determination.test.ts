import { describe, expect, test } from 'vitest'

import {
  explainNotFound,
  matches,
  resolveAccount,
  specificityOf,
  SPECIFICITY_WEIGHTS,
  type DeterminationRule,
} from '#domain/accounting/determination'

const KOSONG = {
  itemCategoryId: null,
  warehouseId: null,
  taxCodeId: null,
  partnerType: null,
}

function aturan(patch: Partial<DeterminationRule> & { id: string }): DeterminationRule {
  return {
    transactionType: 'sales.invoice.revenue',
    accountId: `akun-${patch.id}`,
    ...KOSONG,
    ...patch,
  }
}

describe('spesifisitas', () => {
  test('aturan umum berskor nol', () => {
    expect(specificityOf(aturan({ id: 'umum' }))).toBe(0)
  })

  test('bobotnya berjenjang, bukan hitungan rata', () => {
    // Inilah yang menentukan: satu kategori item mengalahkan gabungan gudang,
    // pajak, dan jenis mitra sekaligus. Dengan bobot rata, keduanya seri dan
    // pemenangnya ditentukan urutan baris.
    const kategori = specificityOf(aturan({ id: 'a', itemCategoryId: 'kat-1' }))
    const gabungan = specificityOf(
      aturan({ id: 'b', warehouseId: 'gd-1', taxCodeId: 'pjk-1', partnerType: 'perusahaan' }),
    )

    expect(kategori).toBe(SPECIFICITY_WEIGHTS.itemCategoryId)
    expect(gabungan).toBe(4 + 2 + 1)
    expect(kategori).toBeGreaterThan(gabungan)
  })
})

describe('pencocokan', () => {
  const konteks = {
    transactionType: 'sales.invoice.revenue',
    itemCategoryId: 'kat-1',
    warehouseId: 'gd-1',
    taxCodeId: null,
    partnerType: null,
  }

  test('dimensi kosong pada aturan berarti berlaku umum', () => {
    expect(matches(aturan({ id: 'umum' }), konteks)).toBe(true)
  })

  test('dimensi terisi harus sama persis', () => {
    expect(matches(aturan({ id: 'a', itemCategoryId: 'kat-1' }), konteks)).toBe(true)
    expect(matches(aturan({ id: 'b', itemCategoryId: 'kat-lain' }), konteks)).toBe(false)
  })

  test('jenis transaksi berbeda tidak pernah cocok', () => {
    expect(
      matches(aturan({ id: 'a', transactionType: 'purchase.receipt.clearing' }), konteks),
    ).toBe(false)
  })

  test('aturan yang menuntut dimensi yang tidak ada di konteks tidak cocok', () => {
    expect(matches(aturan({ id: 'a', taxCodeId: 'pjk-1' }), konteks)).toBe(false)
  })
})

describe('pemilihan', () => {
  const konteks = {
    transactionType: 'sales.invoice.revenue',
    itemCategoryId: 'kat-1',
    warehouseId: 'gd-1',
  }

  test('aturan paling spesifik menang', () => {
    const hasil = resolveAccount(
      [
        aturan({ id: 'umum' }),
        aturan({ id: 'gudang', warehouseId: 'gd-1' }),
        aturan({ id: 'kategori', warehouseId: 'gd-1', itemCategoryId: 'kat-1' }),
      ],
      konteks,
    )

    expect(hasil.kind).toBe('resolved')
    if (hasil.kind !== 'resolved') throw new Error('tidak mungkin')
    expect(hasil.rule.id).toBe('kategori')
    expect(hasil.specificity).toBe(12)
  })

  test('tidak ada yang cocok berarti ditolak, bukan jatuh ke akun cadangan', () => {
    const hasil = resolveAccount([aturan({ id: 'a', itemCategoryId: 'kat-lain' })], konteks)

    expect(hasil.kind).toBe('not_found')
  })

  test('daftar aturan kosong juga ditolak', () => {
    expect(resolveAccount([], konteks).kind).toBe('not_found')
  })

  test('dua aturan berskor sama tertinggi ditolak sebagai ambigu', () => {
    // Konfigurasi yang tidak dapat dijelaskan lebih baik ketahuan saat resolve
    // daripada saat tutup buku.
    const hasil = resolveAccount(
      [
        aturan({ id: 'a', warehouseId: 'gd-1' }),
        aturan({ id: 'b', itemCategoryId: null, warehouseId: 'gd-1' }),
      ],
      konteks,
    )

    expect(hasil.kind).toBe('ambiguous')
    if (hasil.kind !== 'ambiguous') throw new Error('tidak mungkin')
    expect(hasil.candidates).toHaveLength(2)
  })
})

describe('pesan penolakan', () => {
  test('menyebutkan jenis transaksi dan dimensi yang dipakai', () => {
    const pesan = explainNotFound({
      transactionType: 'sales.invoice.revenue',
      itemCategoryId: 'Jasa',
    })

    expect(pesan).toContain('sales.invoice.revenue')
    expect(pesan).toContain('kategori item Jasa')
    // Tanpa arah tindakan, orang yang membacanya akan membuat aturan
    // tangkap-semua — yang mengembalikan masalah akun cadangan lewat pintu lain.
    expect(pesan).toContain('Penentuan Akun')
  })

  test('konteks tanpa dimensi tetap menghasilkan kalimat yang dapat dibaca', () => {
    expect(explainNotFound({ transactionType: 'purchase.receipt.clearing' })).toContain(
      'tanpa dimensi tambahan',
    )
  })
})
