import { Pool } from 'pg'

import type { BreachedPasswordList, Mailer } from '#application/identity/ports'
import { createIdentityModule, type IdentityModule } from '#composition/identity'

/**
 * Merakit modul identitas sungguhan di atas basis data sungguhan.
 *
 * Perakitannya memakai `createIdentityModule` yang sama dengan proses `api`.
 * Test yang merakit sendiri hanya membuktikan rakitannya sendiri bekerja.
 */

/** Kunci uji. Kunci produksi datang dari lingkungan, tidak pernah dari kode. */
const TEST_SIGNING_SECRET = 'rahasia-uji-yang-panjangnya-cukup-32-karakter'
const TEST_MFA_KEY = Buffer.alloc(32, 7).toString('base64')

export class FakeMailer implements Mailer {
  readonly verifications = new Map<string, string>()
  readonly alreadyExists: string[] = []

  async sendEmailVerification(email: string, token: string): Promise<void> {
    this.verifications.set(email, token)
  }

  async sendAccountAlreadyExists(email: string): Promise<void> {
    this.alreadyExists.push(email)
  }
}

export class FakeBreachList implements BreachedPasswordList {
  constructor(private readonly breached = new Set<string>()) {}

  async isBreached(password: string): Promise<boolean> {
    return this.breached.has(password)
  }
}

export interface IdentityHarness {
  readonly module: IdentityModule
  readonly mailer: FakeMailer
  readonly pool: Pool
  /** Waktu yang dikendalikan test — penguncian dan kedaluwarsa perlu digeser. */
  setNow(at: Date | null): void
  close(): Promise<void>
}

export function createIdentityHarness(breached: string[] = []): IdentityHarness {
  const connectionString = process.env.TEST_DATABASE_URL
  if (connectionString === undefined || connectionString === '') {
    throw new Error('TEST_DATABASE_URL belum dipasang — jalankan lewat `npm test`.')
  }

  // Koneksi memakai peran aplikasi, bukan superuser. Bila sebuah hak lupa
  // diberikan di migrasi, test inilah yang menemukannya — bukan produksi.
  const pool = new Pool({ connectionString, options: '-c role=paadu_app' })

  const mailer = new FakeMailer()
  let frozen: Date | null = null

  const module = createIdentityModule({
    db: pool,
    tokenSigningSecret: TEST_SIGNING_SECRET,
    mfaEncryptionKeyBase64: TEST_MFA_KEY,
    mailer,
    breachList: new FakeBreachList(new Set(breached)),
    now: () => frozen ?? new Date(),
  })

  return {
    module,
    mailer,
    pool,
    setNow: (at) => {
      frozen = at
    },
    close: () => pool.end(),
  }
}

/** Kata sandi uji: dua belas karakter, tanpa aturan komposisi. */
export const VALID_PASSWORD = 'kata sandi yang cukup panjang'
