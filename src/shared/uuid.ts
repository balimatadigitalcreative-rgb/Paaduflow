import { randomBytes } from 'node:crypto'

/**
 * UUID versi 7 — D-048.
 *
 * Empat puluh delapan bit pertama adalah waktu dalam milidetik, sehingga id
 * yang dibangkitkan berurutan juga berdekatan di indeks. UUID v4 menyebar acak
 * ke seluruh B-tree; pada tabel yang tumbuh jutaan baris, selisihnya terasa
 * pada setiap penyisipan.
 *
 * Dibangkitkan aplikasi, bukan basis data, supaya id sudah diketahui sebelum
 * baris ditulis — peristiwa outbox dan jurnal perlu merujuknya dalam transaksi
 * yang sama.
 */

let lastTimestamp = -1
let sequence = 0

export function uuidv7(now: number = Date.now()): string {
  // Dua id dalam milidetik yang sama tetap harus terurut. Penghitung mengisi
  // dua belas bit rand_a; setelah penuh, ia menunggu milidetik berikutnya.
  if (now === lastTimestamp) {
    sequence += 1
    if (sequence > 0xfff) {
      sequence = 0
      lastTimestamp = now + 1
      return uuidv7(lastTimestamp)
    }
  } else {
    lastTimestamp = now
    sequence = 0
  }

  const bytes = randomBytes(16)

  bytes[0] = (now / 2 ** 40) & 0xff
  bytes[1] = (now / 2 ** 32) & 0xff
  bytes[2] = (now / 2 ** 24) & 0xff
  bytes[3] = (now / 2 ** 16) & 0xff
  bytes[4] = (now / 2 ** 8) & 0xff
  bytes[5] = now & 0xff

  bytes[6] = 0x70 | ((sequence >> 8) & 0x0f)
  bytes[7] = sequence & 0xff

  bytes[8] = 0x80 | (bytes[8]! & 0x3f)

  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
