import { randomUUID } from 'node:crypto'

import { TOTP, Secret } from 'otpauth'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { ANONYMOUS_CONTEXT } from '#application/identity/ports'

import { createIdentityHarness, VALID_PASSWORD, type IdentityHarness } from './harness.js'

/**
 * Test negatif wajib Sesi B1 — Modul 02 §12.
 *
 * Yang diuji di sini bukan bahwa alur bahagia bekerja, melainkan bahwa jawaban
 * sistem tidak memberi tahu penyerang apa pun yang belum ia ketahui.
 */

let h: IdentityHarness

beforeAll(() => {
  h = createIdentityHarness(['kata sandi yang pernah bocor sekali'])
})

afterAll(async () => {
  await h.close()
})

function email(): string {
  return `uji-${randomUUID().slice(0, 12)}@paaduflow.test`
}

async function daftarkan(alamat: string): Promise<void> {
  const hasil = await h.module.authentication.register(
    { email: alamat, password: VALID_PASSWORD, fullName: 'Pengguna Uji' },
    ANONYMOUS_CONTEXT,
  )
  expect(hasil.kind).toBe('accepted')
}

test('registrasi dengan email terdaftar tidak membocorkan bahwa email itu ada', async () => {
  const alamat = email()
  await daftarkan(alamat)

  const kedua = await h.module.authentication.register(
    { email: alamat, password: 'kata sandi yang berbeda sekali', fullName: 'Penyerang' },
    ANONYMOUS_CONTEXT,
  )

  // Jawabannya identik dengan pendaftaran pertama — bentuk, jenis, dan isinya.
  expect(kedua).toEqual({ kind: 'accepted' })

  const { rows } = await h.pool.query('SELECT id, full_name FROM users WHERE email = $1', [alamat])
  expect(rows).toHaveLength(1)
  expect(rows[0]?.full_name).toBe('Pengguna Uji')

  // Yang diberi tahu adalah pemilik akun, lewat email — bukan pendaftarnya.
  expect(h.mailer.alreadyExists).toContain(alamat)
})

test('kata sandi yang pernah bocor ditolak, tanpa aturan komposisi karakter', async () => {
  const bocor = await h.module.authentication.register(
    { email: email(), password: 'kata sandi yang pernah bocor sekali', fullName: 'Uji' },
    ANONYMOUS_CONTEXT,
  )
  expect(bocor).toEqual({ kind: 'password_rejected', reason: 'pernah_bocor' })

  const pendek = await h.module.authentication.register(
    { email: email(), password: 'pendek', fullName: 'Uji' },
    ANONYMOUS_CONTEXT,
  )
  expect(pendek).toEqual({ kind: 'password_rejected', reason: 'terlalu_pendek' })

  // Dua belas karakter huruf kecil semua, tanpa angka dan tanpa simbol: diterima.
  const panjang = await h.module.authentication.register(
    { email: email(), password: 'duabelaskarakter', fullName: 'Uji' },
    ANONYMOUS_CONTEXT,
  )
  expect(panjang).toEqual({ kind: 'accepted' })
})

test('email tidak ditemukan dan kata sandi salah menghasilkan jawaban yang sama', async () => {
  const alamat = email()
  await daftarkan(alamat)

  const tidakAda = await h.module.authentication.login(
    { email: email(), password: VALID_PASSWORD },
    ANONYMOUS_CONTEXT,
  )
  const salah = await h.module.authentication.login(
    { email: alamat, password: 'kata sandi yang salah sekali' },
    ANONYMOUS_CONTEXT,
  )

  expect(tidakAda).toEqual({ kind: 'invalid_credentials' })
  expect(salah).toEqual({ kind: 'invalid_credentials' })
})

test('verifikasi email bekerja sekali, lalu tokennya mati', async () => {
  const alamat = email()
  await daftarkan(alamat)
  const token = h.mailer.verifications.get(alamat)
  expect(token).toBeTruthy()

  expect(await h.module.authentication.verifyEmail(token!)).toBe(true)
  expect(await h.module.authentication.verifyEmail(token!)).toBe(false)

  const { rows } = await h.pool.query('SELECT email_verified_at FROM users WHERE email = $1', [
    alamat,
  ])
  expect(rows[0]?.email_verified_at).not.toBeNull()
})

test('penguncian bertahap bekerja, dan tidak diumumkan', async () => {
  const alamat = email()
  await daftarkan(alamat)

  for (let percobaan = 1; percobaan <= 3; percobaan += 1) {
    const hasil = await h.module.authentication.login(
      { email: alamat, password: 'tebakan yang keliru terus' },
      ANONYMOUS_CONTEXT,
    )
    expect(hasil).toEqual({ kind: 'invalid_credentials' })
  }

  const { rows } = await h.pool.query<{ failed_attempts: number; locked_until: Date | null }>(
    `SELECT c.failed_attempts, c.locked_until
       FROM user_credentials c JOIN users u ON u.id = c.user_id
      WHERE u.email = $1`,
    [alamat],
  )
  expect(rows[0]?.failed_attempts).toBe(3)
  expect(rows[0]?.locked_until).not.toBeNull()

  // Kata sandi yang BENAR pun ditolak selama terkunci — dan jawabannya tetap
  // sama, supaya penyerang tidak belajar bahwa ia berhasil mengunci seseorang.
  const benarTapiTerkunci = await h.module.authentication.login(
    { email: alamat, password: VALID_PASSWORD },
    ANONYMOUS_CONTEXT,
  )
  expect(benarTapiTerkunci).toEqual({ kind: 'invalid_credentials' })

  // Setelah jeda lewat, kata sandi benar diterima kembali.
  h.setNow(new Date(Date.now() + 2 * 60_000))
  const setelahJeda = await h.module.authentication.login(
    { email: alamat, password: VALID_PASSWORD },
    ANONYMOUS_CONTEXT,
  )
  h.setNow(null)
  expect(setelahJeda.kind).toBe('authenticated')
})

test('MFA: kode TOTP sekali pakai, kode pemulihan juga', async () => {
  const alamat = email()
  await daftarkan(alamat)

  const { rows } = await h.pool.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [
    alamat,
  ])
  const userId = rows[0]!.id

  const { secret } = await h.module.authentication.enrollTotp(userId, alamat)
  const totp = new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 })

  const konfirmasi = await h.module.authentication.confirmTotp(userId, totp.generate())
  expect(konfirmasi?.recoveryCodes).toHaveLength(10)

  const masuk = await h.module.authentication.login(
    { email: alamat, password: VALID_PASSWORD },
    ANONYMOUS_CONTEXT,
  )
  expect(masuk.kind).toBe('mfa_required')
  if (masuk.kind !== 'mfa_required') throw new Error('tidak mungkin')

  // Kode yang sama sudah dipakai saat konfirmasi — memakainya lagi ditolak.
  const diulang = await h.module.authentication.verifyMfa(
    { challengeToken: masuk.challengeToken, code: totp.generate() },
    ANONYMOUS_CONTEXT,
  )
  expect(diulang).toEqual({ kind: 'invalid_credentials' })

  // Kode pemulihan menolongnya keluar — sekali, lalu mati.
  const kodePemulihan = konfirmasi!.recoveryCodes[0]!
  const pertama = await h.module.authentication.verifyMfa(
    { challengeToken: masuk.challengeToken, code: kodePemulihan },
    ANONYMOUS_CONTEXT,
  )
  expect(pertama.kind).toBe('authenticated')

  const kedua = await h.module.authentication.verifyMfa(
    { challengeToken: masuk.challengeToken, code: kodePemulihan },
    ANONYMOUS_CONTEXT,
  )
  expect(kedua).toEqual({ kind: 'invalid_credentials' })
})

test('tantangan MFA tidak dapat digantikan access token', async () => {
  const alamat = email()
  await daftarkan(alamat)

  const masuk = await h.module.authentication.login(
    { email: alamat, password: VALID_PASSWORD },
    ANONYMOUS_CONTEXT,
  )
  if (masuk.kind !== 'authenticated') throw new Error('seharusnya masuk tanpa MFA')

  // Access token ditandatangani kunci yang sama, tetapi tujuannya berbeda.
  const disalahgunakan = await h.module.authentication.verifyMfa(
    { challengeToken: masuk.accessToken, code: '000000' },
    ANONYMOUS_CONTEXT,
  )
  expect(disalahgunakan).toEqual({ kind: 'invalid_credentials' })
})

test('access token membawa keanggotaan tenant, tidak pernah company_id', async () => {
  const alamat = email()
  await daftarkan(alamat)

  const masuk = await h.module.authentication.login(
    { email: alamat, password: VALID_PASSWORD },
    ANONYMOUS_CONTEXT,
  )
  if (masuk.kind !== 'authenticated') throw new Error('seharusnya masuk')

  const payload = JSON.parse(
    Buffer.from(masuk.accessToken.split('.')[1]!, 'base64url').toString('utf8'),
  ) as Record<string, unknown>

  expect(payload).toHaveProperty('memberships')
  expect(JSON.stringify(payload)).not.toContain('company')
})
