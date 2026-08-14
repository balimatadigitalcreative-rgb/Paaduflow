import { currencyDecimals } from '#shared/money-format'

import type { CalculationBase, TaxCodeVersion } from './rates'

/**
 * Perhitungan nilai pajak dari satu versi kode pajak.
 *
 * Ia sengaja kecil. Urutan delapan langkah perhitungan dokumen — diskon baris,
 * alokasi diskon dokumen, dasar pengenaan — sudah tinggal di
 * `#shared/line-items` dan dipakai Penjualan maupun Pembelian. Berkas ini hanya
 * mengubah dasar yang sudah jadi menjadi nilai pajak, memakai tarif dari versi
 * yang berlaku pada tanggal dokumen.
 *
 * Dua rumus untuk angka yang sama akan menyimpang, dan yang menyimpang adalah
 * angka pajak.
 */

export interface TaxAmount {
  /** Dasar pengenaan pajak setelah seluruh diskon. */
  readonly base: number
  readonly rate: number
  readonly tax: number
  readonly taxCodeId: string
  readonly glAccountId: string
  readonly isCreditable: boolean
}

/**
 * Basis bruto berarti nilai yang diberikan sudah termasuk pajak, sehingga
 * dasarnya harus dikeluarkan kembali: `dasar = bruto ÷ (1 + tarif)`.
 *
 * Ini bukan pilihan tampilan. Harga jual yang diiklankan sudah termasuk PPN
 * adalah praktik yang lazim, dan sistem yang hanya mengenal basis neto akan
 * memaksa orang menghitung mundur sendiri — di kalkulator, dengan pembulatan
 * yang tidak sama dengan pembulatan sistem.
 */
export function baseFromGross(gross: number, rate: number, currency: string): number {
  if (rate <= -100) throw new RangeError('Tarif pajak membuat pembagi menjadi nol atau negatif.')
  const desimal = currencyDecimals(currency)
  return bulatkan(gross / (1 + rate / 100), desimal)
}

function bulatkan(nilai: number, desimal: number): number {
  const faktor = 10 ** desimal
  // Perkalian dulu, pembagian belakangan: pembulatan setengah ke atas pada
  // pecahan biner meleset satu satuan terkecil pada angka seperti 1.005.
  return Math.round((nilai + Number.EPSILON) * faktor) / faktor
}

export interface CalculateInput {
  /**
   * Nilai dasar bila `calculationBase` versi adalah `net`, atau nilai termasuk
   * pajak bila `gross`. Pemanggil tidak memilih; versi kode pajak yang memilih.
   */
  readonly amount: number
  readonly currency: string
}

/**
 * Tidak ada parameter tarif. Satu-satunya sumber tarif adalah versi kode pajak
 * yang sudah dipilih menurut tanggal dokumen — Module 08 §7.
 */
export function calculateTax(version: TaxCodeVersion, input: CalculateInput): TaxAmount {
  const desimal = currencyDecimals(input.currency)

  // Bebas dan tidak dipungut punya dasar pengenaan, tetapi nilai pajaknya nol.
  // Keduanya tetap masuk buku pajak: yang tidak tercatat tidak dapat
  // dilaporkan, dan transaksi bebas pajak tetap wajib dilaporkan.
  const tarif = version.taxType === 'exempt' || version.taxType === 'not_collected' ? 0 : version.rate

  const base = dasarMenurut(version.calculationBase, input.amount, tarif, input.currency)
  const tax = bulatkan((base * tarif) / 100, desimal)

  return {
    base,
    rate: tarif,
    tax,
    taxCodeId: version.id,
    glAccountId: version.glAccountId,
    isCreditable: version.isCreditable,
  }
}

function dasarMenurut(
  basis: CalculationBase,
  amount: number,
  rate: number,
  currency: string,
): number {
  return basis === 'gross'
    ? baseFromGross(amount, rate, currency)
    : bulatkan(amount, currencyDecimals(currency))
}
