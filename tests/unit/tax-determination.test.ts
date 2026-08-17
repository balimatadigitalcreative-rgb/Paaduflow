import { describe, expect, test } from 'vitest'

import {
  explainNotFound,
  resolveTaxCode,
  specificityOf,
  TAX_SPECIFICITY_WEIGHTS,
  type TaxDeterminationRule,
} from '#domain/tax/determination'

/**
 * Penentuan pajak — kembaran penentuan akun, dan diuji dengan tuntutan yang
 * sama: yang paling spesifik menang, seri ditolak, dan tidak ditemukan MENOLAK.
 */

function aturan(override: Partial<TaxDeterminationRule> = {}): TaxDeterminationRule {
  return {
    id: 'r1',
    transactionType: 'sales.invoice.tax',
    itemCategoryId: null,
    partnerType: null,
    partnerIsPkp: null,
    regionCode: null,
    taxCode: 'PPN-OUT',
    ...override,
  }
}

describe('spesifisitas', () => {
  test('aturan tangkap-semua berskor nol', () => {
    expect(specificityOf(aturan())).toBe(0)
  })

  test('bobotnya berjenjang, sehingga tidak ada dua bentuk berbeda yang berskor sama', () => {
    // Inti bobot berjenjang: dimensi paling menentukan lebih berat daripada
    // seluruh dimensi di bawahnya digabung.
    const { itemCategoryId, partnerIsPkp, regionCode, partnerType } = TAX_SPECIFICITY_WEIGHTS
    expect(itemCategoryId).toBeGreaterThan(partnerIsPkp + regionCode + partnerType)
    expect(partnerIsPkp).toBeGreaterThan(regionCode + partnerType)
    expect(regionCode).toBeGreaterThan(partnerType)
  })

  test('status PKP mitra lebih berat daripada jenis mitra', () => {
    // Status PKP menentukan apakah pajaknya ada sama sekali; jenis mitra hanya
    // menentukan perlakuannya.
    expect(specificityOf(aturan({ partnerIsPkp: true }))).toBeGreaterThan(
      specificityOf(aturan({ partnerType: 'vendor' })),
    )
  })
})

describe('pemilihan', () => {
  const semua: TaxDeterminationRule[] = [
    aturan({ id: 'umum' }),
    aturan({ id: 'pkp', partnerIsPkp: true, taxCode: 'PPN-IN' }),
    aturan({ id: 'non-pkp', partnerIsPkp: false, taxCode: 'PPN-BEBAS' }),
    aturan({ id: 'kategori', itemCategoryId: 'kat-1', taxCode: 'PPN-KHUSUS' }),
  ]

  test('tanpa dimensi, aturan umum yang menang', () => {
    const hasil = resolveTaxCode(semua, { transactionType: 'sales.invoice.tax' })
    expect(hasil.kind).toBe('resolved')
    if (hasil.kind !== 'resolved') throw new Error('tidak mungkin')
    expect(hasil.rule.id).toBe('umum')
  })

  test('status PKP mitra memilih kode yang berbeda', () => {
    const pkp = resolveTaxCode(semua, {
      transactionType: 'sales.invoice.tax',
      partnerIsPkp: true,
    })
    const bukan = resolveTaxCode(semua, {
      transactionType: 'sales.invoice.tax',
      partnerIsPkp: false,
    })

    if (pkp.kind !== 'resolved' || bukan.kind !== 'resolved') throw new Error('tidak mungkin')
    expect(pkp.rule.taxCode).toBe('PPN-IN')
    expect(bukan.rule.taxCode).toBe('PPN-BEBAS')
  })

  test('kategori item mengalahkan status PKP', () => {
    const hasil = resolveTaxCode(semua, {
      transactionType: 'sales.invoice.tax',
      itemCategoryId: 'kat-1',
      partnerIsPkp: true,
    })
    if (hasil.kind !== 'resolved') throw new Error('tidak mungkin')
    expect(hasil.rule.taxCode).toBe('PPN-KHUSUS')
  })

  test('jenis transaksi lain tidak mewarisi aturan', () => {
    expect(
      resolveTaxCode(semua, { transactionType: 'purchasing.bill.tax' }).kind,
    ).toBe('not_found')
  })
})

describe('penolakan', () => {
  test('tidak ada aturan berarti MENOLAK, bukan tarif nol', () => {
    // Tarif nol yang muncul dari ketiadaan aturan tidak dapat dibedakan dari
    // tarif nol yang memang diputuskan, dan perbedaan itu yang ditanyakan
    // pemeriksa.
    const hasil = resolveTaxCode([], { transactionType: 'sales.invoice.tax' })
    expect(hasil.kind).toBe('not_found')
  })

  test('dua aturan sama spesifik ditolak, bukan diambil yang pertama', () => {
    const seri = [
      aturan({ id: 'a', partnerIsPkp: true, taxCode: 'PPN-A' }),
      aturan({ id: 'b', partnerIsPkp: true, taxCode: 'PPN-B' }),
    ]

    const hasil = resolveTaxCode(seri, {
      transactionType: 'sales.invoice.tax',
      partnerIsPkp: true,
    })

    expect(hasil.kind).toBe('ambiguous')
    if (hasil.kind !== 'ambiguous') throw new Error('tidak mungkin')
    expect(hasil.candidates).toHaveLength(2)
  })

  test('pesan penolakan menyebutkan dimensi yang dicari', () => {
    const pesan = explainNotFound({
      transactionType: 'purchasing.bill.tax',
      partnerIsPkp: false,
      regionCode: 'ID-BA',
    })

    expect(pesan).toContain('purchasing.bill.tax')
    expect(pesan).toContain('non-PKP')
    expect(pesan).toContain('ID-BA')
    // Menyebutkan ke mana harus pergi. Yang menebak akan membuat aturan
    // tangkap-semua, dan itu mengembalikan masalah lewat pintu lain.
    expect(pesan).toContain('Penentuan Pajak')
  })
})
