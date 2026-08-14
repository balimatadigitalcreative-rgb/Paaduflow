import { describe, expect, test } from 'vitest'

import { baseFromGross, calculateTax } from '#domain/tax/calculation'
import { isEffectiveOn, supersede, versionOn, type TaxCodeVersion } from '#domain/tax/rates'

/**
 * Tarif bertanggal berlaku.
 *
 * Seluruh angka di berkas ini adalah angka UJI, dipilih supaya batasnya terlihat
 * — bukan tarif yang berlaku di mana pun. Tidak ada satu pun yang datang dari
 * kode produksi, karena kode produksi tidak memuat satu pun.
 */

function versi(override: Partial<TaxCodeVersion> = {}): TaxCodeVersion {
  return {
    id: 'v1',
    code: 'PPN-OUT',
    name: 'PPN Keluaran',
    taxType: 'vat_out',
    rate: 10,
    validFrom: '2022-01-01',
    validTo: null,
    calculationBase: 'net',
    glAccountId: 'akun-1',
    isCreditable: false,
    status: 'active',
    ...override,
  }
}

describe('keberlakuan tanggal', () => {
  const lama = versi({ id: 'lama', rate: 10, validFrom: '2022-01-01', validTo: '2022-04-01' })
  const baru = versi({ id: 'baru', rate: 11, validFrom: '2022-04-01', validTo: null })

  test('batasnya setengah terbuka: valid_from termasuk, valid_to tidak', () => {
    // Tanpa aturan ini, dokumen tanggal 1 April punya dua tarif yang sama-sama
    // dapat dibenarkan.
    expect(isEffectiveOn(lama, '2022-03-31')).toBe(true)
    expect(isEffectiveOn(lama, '2022-04-01')).toBe(false)
    expect(isEffectiveOn(baru, '2022-04-01')).toBe(true)
  })

  test('sehari sebelum dan sehari sesudah batas memilih versi berbeda', () => {
    const sebelum = versionOn([lama, baru], 'PPN-OUT', '2022-03-31')
    const sesudah = versionOn([lama, baru], 'PPN-OUT', '2022-04-01')

    if (sebelum.kind !== 'resolved' || sesudah.kind !== 'resolved') throw new Error('tidak mungkin')
    expect(sebelum.version.rate).toBe(10)
    expect(sesudah.version.rate).toBe(11)
  })

  test('tanggal sebelum versi pertama tidak memilih apa pun', () => {
    // Bukan "pakai yang paling awal". Dokumen bertanggal sebelum ada tarif
    // adalah dokumen yang tidak dapat dihitung, dan itu harus terdengar.
    const hasil = versionOn([lama, baru], 'PPN-OUT', '2021-12-31')
    expect(hasil.kind).toBe('no_version_on_date')
  })

  test('versi terbuka berlaku sampai kapan pun', () => {
    expect(isEffectiveOn(baru, '2099-12-31')).toBe(true)
  })

  test('dua versi tumpang tindih dilaporkan, bukan dipilih diam-diam', () => {
    const tumpang = versi({ id: 'tumpang', rate: 12, validFrom: '2022-02-01', validTo: null })
    const hasil = versionOn([lama, tumpang], 'PPN-OUT', '2022-03-01')

    expect(hasil.kind).toBe('overlapping')
  })

  test('kode lain tidak ikut terpilih', () => {
    const lainnya = versi({ id: 'lain', code: 'PPN-IN' })
    expect(versionOn([lainnya], 'PPN-OUT', '2022-06-01').kind).toBe('no_version_on_date')
  })
})

describe('penutupan versi lama', () => {
  const lama = versi({ id: 'lama', validFrom: '2022-01-01', validTo: null })

  test('versi pertama tidak menutup apa pun', () => {
    expect(supersede([], 'PPN-OUT', '2022-01-01')).toEqual({ kind: 'first_version' })
  })

  test('versi baru menutup versi lama tepat di tanggal berlakunya', () => {
    // Menutup di tanggal yang sama dengan berlakunya yang baru: tidak ada
    // lubang, tidak ada tumpang tindih.
    expect(supersede([lama], 'PPN-OUT', '2022-04-01')).toEqual({
      kind: 'closes',
      previousId: 'lama',
      validTo: '2022-04-01',
    })
  })

  test('tarif tidak dapat disisipkan mundur ke belakang versi yang ada', () => {
    const hasil = supersede([lama], 'PPN-OUT', '2021-06-01')
    expect(hasil.kind).toBe('not_after_previous')
  })

  test('tanggal yang sama dengan versi terakhir ditolak', () => {
    expect(supersede([lama], 'PPN-OUT', '2022-01-01').kind).toBe('not_after_previous')
  })

  test('versi yang sudah tertutup tidak ditutup dua kali', () => {
    const tertutup = versi({ id: 'tertutup', validFrom: '2022-01-01', validTo: '2022-04-01' })
    const hasil = supersede([tertutup], 'PPN-OUT', '2022-07-01')

    // Menutupnya lagi akan meninggalkan April sampai Juli tanpa tarif.
    expect(hasil).toEqual({ kind: 'previous_already_closed', previousValidTo: '2022-04-01' })
  })
})

describe('perhitungan', () => {
  test('basis neto mengalikan tarif ke dasar', () => {
    const hasil = calculateTax(versi({ rate: 11 }), { amount: 1_000_000, currency: 'IDR' })

    expect(hasil.base).toBe(1_000_000)
    expect(hasil.tax).toBe(110_000)
    expect(hasil.rate).toBe(11)
  })

  test('basis bruto mengeluarkan dasar dari nilai yang sudah termasuk pajak', () => {
    const hasil = calculateTax(versi({ rate: 11, calculationBase: 'gross' }), {
      amount: 1_110_000,
      currency: 'IDR',
    })

    expect(hasil.base).toBe(1_000_000)
    expect(hasil.tax).toBe(110_000)
  })

  test('bruto dan neto bertemu di angka yang sama', () => {
    // Kalau keduanya tidak bertemu, salah satunya salah — dan yang salah akan
    // ketahuan sebagai selisih beberapa rupiah di laporan masa.
    const dasar = baseFromGross(1_110_000, 11, 'IDR')
    expect(calculateTax(versi({ rate: 11 }), { amount: dasar, currency: 'IDR' }).tax).toBe(110_000)
  })

  test('bebas dan tidak dipungut punya dasar tetapi nilainya nol', () => {
    // Keduanya tetap masuk buku pajak: yang tidak tercatat tidak dapat
    // dilaporkan, dan transaksi bebas pajak tetap wajib dilaporkan.
    for (const jenis of ['exempt', 'not_collected'] as const) {
      const hasil = calculateTax(versi({ taxType: jenis, rate: 11 }), {
        amount: 1_000_000,
        currency: 'IDR',
      })
      expect(hasil.base).toBe(1_000_000)
      expect(hasil.tax).toBe(0)
    }
  })

  test('IDR dibulatkan tanpa desimal, mata uang berdesimal tidak', () => {
    expect(calculateTax(versi({ rate: 11 }), { amount: 333, currency: 'IDR' }).tax).toBe(37)
    expect(calculateTax(versi({ rate: 11 }), { amount: 333, currency: 'USD' }).tax).toBe(36.63)
  })

  test('akun buku besar ikut keluar, sehingga jurnal tidak menebak', () => {
    const hasil = calculateTax(versi({ glAccountId: 'akun-ppn' }), {
      amount: 100,
      currency: 'IDR',
    })
    expect(hasil.glAccountId).toBe('akun-ppn')
  })
})
