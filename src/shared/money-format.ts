/**
 * Format dan parsing nominal — Component_Specs_Primitives §3.
 *
 * Ditempatkan di kernel bersama karena setiap modul yang menyentuh uang
 * memakainya, dan karena parser-nya wajib dapat diuji tanpa DOM. Yang diuji di
 * sini adalah hal yang sering merusak data di aplikasi finansial: tempelan dari
 * Excel, WhatsApp, dan PDF yang memakai konvensi pemisah berbeda-beda.
 */

/** Mata uang tanpa pecahan. Rupiah menampilkan `Rp 185.000`, bukan `185.000,00`. */
const ZERO_DECIMAL = new Set(['IDR', 'JPY', 'KRW', 'VND'])

export function currencyDecimals(currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2
}

/**
 * Membaca angka dari teks apa pun yang mungkin ditempel pengguna.
 *
 * Aturan pemisah: bila titik dan koma sama-sama muncul, yang **terakhir**
 * adalah pemisah desimal. Indonesia memakai `1.234,56` dan Inggris memakai
 * `1,234.56`; keduanya harus diterima karena pengguna menyalin dari mana saja.
 *
 * Mengembalikan `null` bila teksnya bukan angka — bukan `0`. Nol adalah nilai
 * yang sah, dan menyamakannya dengan "tidak terbaca" akan diam-diam menyimpan
 * nominal yang salah.
 */
export function parseAmount(input: string): number | null {
  // Simbol mata uang, spasi biasa, dan spasi tak putus dibuang.
  const bersih = input.replace(/[^\d,.-]/g, '').trim()
  if (bersih === '' || bersih === '-') return null

  const titik = bersih.lastIndexOf('.')
  const koma = bersih.lastIndexOf(',')

  let normal: string
  if (titik !== -1 && koma !== -1) {
    const desimal = Math.max(titik, koma)
    normal = bersih.slice(0, desimal).replace(/[.,]/g, '') + '.' + bersih.slice(desimal + 1)
  } else if (titik !== -1 || koma !== -1) {
    const posisi = Math.max(titik, koma)
    const setelah = bersih.length - posisi - 1
    // Satu pemisah dengan tepat tiga angka di belakangnya adalah pemisah
    // ribuan — `185.000` berarti seratus delapan puluh lima ribu, bukan
    // seratus delapan puluh lima koma nol nol nol.
    normal =
      setelah === 3
        ? bersih.replace(/[.,]/g, '')
        : bersih.slice(0, posisi) + '.' + bersih.slice(posisi + 1)
  } else {
    normal = bersih
  }

  const angka = Number(normal)
  return Number.isFinite(angka) ? angka : null
}

/**
 * Menampilkan nominal terformat.
 *
 * Batas bawah pecahan nol, batas atas mengikuti mata uang — sehingga desimal
 * hanya muncul bila nilainya memang mengandungnya.
 */
export function formatAmount(value: number, currency: string, locale = 'id-ID'): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: currencyDecimals(currency),
  }).format(value)
}

/** Simbol mata uang sebagai affix — ia tidak pernah menjadi bagian dari nilai. */
export function currencyAffix(currency: string): string {
  return currency.toUpperCase() === 'IDR' ? 'Rp' : currency.toUpperCase()
}
