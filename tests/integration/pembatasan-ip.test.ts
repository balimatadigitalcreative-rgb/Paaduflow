import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, expect, test } from 'vitest'

import { IP_FAILURE_THRESHOLD } from '#domain/identity/ip-throttle'

import { createIdentityHarness, VALID_PASSWORD, type IdentityHarness } from './harness.js'

/**
 * Pembatasan laju per IP.
 *
 * Serangan yang diuji di sini adalah credential stuffing: satu kata sandi umum
 * dicoba ke banyak akun berbeda dari satu tempat. Penguncian bertahap per akun
 * tidak melihatnya sama sekali — tidak ada satu akun pun yang mencapai
 * ambangnya, karena tiap akun hanya dicoba sekali.
 */

let h: IdentityHarness

/** Alamat unik per proses uji, supaya penghitungnya tidak tercampur. */
const IP = `203.0.113.${Math.floor(Math.random() * 200) + 10}`
const KONTEKS = { ip: IP, userAgent: 'uji', device: null }

beforeAll(() => {
  h = createIdentityHarness()
})

afterAll(async () => {
  await h.close()
})

test('satu penyerang yang mencoba banyak akun berbeda tetap dihentikan', async () => {
  // Setiap percobaan menyasar akun yang berbeda. Tidak ada satu akun pun yang
  // mendekati penguncian bertahap.
  for (let percobaan = 0; percobaan < IP_FAILURE_THRESHOLD; percobaan += 1) {
    const hasil = await h.module.authentication.login(
      { email: `korban-${randomUUID().slice(0, 8)}@paaduflow.test`, password: 'kata sandi umum sekali' },
      KONTEKS,
    )
    expect(hasil).toEqual({ kind: 'invalid_credentials' })
  }

  // Sekarang akun yang sungguhan ada, dengan kata sandi yang BENAR, dari IP itu.
  const alamat = `pemilik-${randomUUID().slice(0, 8)}@paaduflow.test`
  await h.module.authentication.register(
    { email: alamat, password: VALID_PASSWORD, fullName: 'Pemilik' },
    { ip: null, userAgent: null, device: null },
  )

  const ditolak = await h.module.authentication.login(
    { email: alamat, password: VALID_PASSWORD },
    KONTEKS,
  )
  expect(ditolak).toEqual({ kind: 'invalid_credentials' })

  const { rows } = await h.pool.query(
    `SELECT 1 FROM auth_events WHERE ip = $1::inet AND type = 'login.blocked_ip'`,
    [IP],
  )
  expect(rows.length).toBeGreaterThan(0)

  // Dari IP lain, kata sandi yang sama diterima — yang diblokir asalnya, bukan
  // akunnya.
  const diterima = await h.module.authentication.login(
    { email: alamat, password: VALID_PASSWORD },
    { ip: '198.51.100.7', userAgent: 'uji', device: null },
  )
  expect(diterima.kind).toBe('authenticated')
})

test('blokade tidak memperpanjang dirinya sendiri', async () => {
  // Peristiwa `login.blocked_ip` tidak boleh ikut terhitung sebagai kegagalan.
  // Bila ia terhitung, satu IP yang pernah diblokir akan terblokir selamanya
  // hanya karena terus mencoba.
  const { rows } = await h.pool.query<{ jumlah: string }>(
    `SELECT count(*) AS jumlah FROM auth_events
      WHERE ip = $1::inet AND type IN ('login.failed', 'mfa.failed')`,
    [IP],
  )
  expect(Number(rows[0]?.jumlah)).toBe(IP_FAILURE_THRESHOLD)
})
