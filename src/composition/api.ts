import { buildHttpApp } from '#interface/http/app'
import {
  ConsoleMailer,
  UncheckedBreachList,
} from '#infrastructure/modules/identity/dev-adapters'
import pg from 'pg'

import { createAppServices } from './http.js'
import { modules } from './modules.js'

/**
 * Proses `api` (D-044). Melayani permintaan pengguna dan integrasi.
 */

function required(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === '') {
    throw new Error(`Variabel lingkungan ${name} belum dipasang.`)
  }
  return value
}

export async function startApi(): Promise<void> {
  const pool = new pg.Pool({ connectionString: required('DATABASE_URL') })

  const services = createAppServices({
    pool,
    tokenSigningSecret: required('TOKEN_SIGNING_SECRET'),
    mfaEncryptionKeyBase64: required('MFA_ENCRYPTION_KEY'),
    mailer: new ConsoleMailer(),
    breachList: new UncheckedBreachList(),
  })

  const app = await buildHttpApp({ services, logger: true })

  // Diucapkan keras setiap kali proses menyala. Syarat yang belum terpenuhi
  // dan tidak terdengar adalah syarat yang akan sampai ke produksi.
  app.log.warn(
    'Daftar kata sandi bocor belum terpasang (UncheckedBreachList) — Modul 02 §11 belum terpenuhi.',
  )
  app.log.info(`${modules.length} modul terdaftar.`)

  const port = Number(process.env.PORT ?? 3000)
  await app.listen({ port, host: '0.0.0.0' })
}
