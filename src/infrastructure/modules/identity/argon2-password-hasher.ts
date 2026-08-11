import { hash, verify, type Algorithm } from '@node-rs/argon2'

import type { PasswordHasher } from '#application/identity/ports'

/**
 * `Algorithm.Argon2id`. Ditulis sebagai nilai supaya tidak perlu mengimpor
 * ambient const enum-nya, yang tidak dapat diakses saat berjalan. Ia memang
 * nilai bawaan pustaka, tetapi parameter keamanan tidak dititipkan ke bawaan —
 * bawaan dapat berubah di rilis berikutnya tanpa siapa pun menyadarinya.
 */
const ARGON2ID = 2 as Algorithm

/**
 * Argon2id — Modul 02 §4.
 *
 * Parameter mengikuti anjuran OWASP: 19 MiB memori, dua iterasi, paralelisme
 * satu. Yang menentukan bukan waktu di mesin pengembang melainkan biaya memori
 * bagi penyerang, karena di situlah GPU kehilangan keunggulannya.
 */
const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const

export class Argon2PasswordHasher implements PasswordHasher {
  /** Hash palsu untuk verifikasi tiruan. Dibuat sekali, dipakai berulang. */
  private dummyHash: Promise<string> | null = null

  async hash(password: string): Promise<string> {
    return hash(password, OPTIONS)
  }

  async verify(hashed: string, password: string): Promise<boolean> {
    try {
      return await verify(hashed, password, OPTIONS)
    } catch {
      // Hash yang rusak atau berformat asing berarti tidak cocok — bukan galat
      // yang perlu naik ke pemanggil dan membocorkan bentuk penyimpanannya.
      return false
    }
  }

  async verifyDummy(): Promise<void> {
    this.dummyHash ??= hash('kata sandi yang tidak pernah dipakai siapa pun', OPTIONS)
    await verify(await this.dummyHash, 'tebakan yang salah', OPTIONS).catch(() => false)
  }
}
