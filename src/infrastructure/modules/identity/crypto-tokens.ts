import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

import type { SecretCipher, TokenFactory } from '#application/identity/ports'

/**
 * Token acak beserta hash-nya.
 *
 * Hash memakai SHA-256 polos, bukan Argon2. Itu bukan kelalaian: token ini
 * dibangkitkan sistem dengan 256 bit entropi, jadi tidak ada yang dapat
 * ditebak. Argon2 melindungi rahasia berentropi rendah — kata sandi manusia.
 * Memakainya di sini hanya menambah biaya pada jalur yang dipanggil setiap
 * penyegaran token.
 */
export class CryptoTokenFactory implements TokenFactory {
  create(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url')
    return { token, hash: this.hash(token) }
  }

  hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex')
  }
}

const IV_LENGTH = 12
const TAG_LENGTH = 16

/**
 * AES-256-GCM untuk rahasia yang harus dapat dibaca kembali — rahasia TOTP.
 *
 * Kunci datang dari lingkungan, tidak pernah dari kode. Bila kuncinya hilang,
 * seluruh faktor MFA harus didaftarkan ulang; itu konsekuensi yang disengaja
 * dan lebih baik daripada kunci yang ikut terbawa di repositori.
 */
export class AesSecretCipher implements SecretCipher {
  private readonly key: Buffer

  constructor(keyBase64: string) {
    const key = Buffer.from(keyBase64, 'base64')
    if (key.length !== 32) {
      throw new Error('Kunci enkripsi harus 32 byte dalam base64 (AES-256).')
    }
    this.key = key
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')
  }

  decrypt(payload: string): string {
    const raw = Buffer.from(payload, 'base64')
    const iv = raw.subarray(0, IV_LENGTH)
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH)

    const decipher = createDecipheriv('aes-256-gcm', this.key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  }
}
