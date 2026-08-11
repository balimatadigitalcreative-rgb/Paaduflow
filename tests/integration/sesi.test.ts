import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, expect, test } from 'vitest'

import { ANONYMOUS_CONTEXT } from '#application/identity/ports'

import { createIdentityHarness, VALID_PASSWORD, type IdentityHarness } from './harness.js'

/**
 * Rotasi refresh token, deteksi penggunaan ulang, dan pencabutan.
 */

let h: IdentityHarness

beforeAll(() => {
  h = createIdentityHarness()
})

afterAll(async () => {
  await h.close()
})

interface Masuk {
  email: string
  userId: string
  accessToken: string
  refreshToken: string
  sessionId: string
}

async function penggunaYangMasuk(): Promise<Masuk> {
  const alamat = `sesi-${randomUUID().slice(0, 12)}@paaduflow.test`
  await h.module.authentication.register(
    { email: alamat, password: VALID_PASSWORD, fullName: 'Pengguna Sesi' },
    ANONYMOUS_CONTEXT,
  )
  const hasil = await h.module.authentication.login(
    { email: alamat, password: VALID_PASSWORD },
    ANONYMOUS_CONTEXT,
  )
  if (hasil.kind !== 'authenticated') throw new Error('seharusnya masuk')

  const { rows } = await h.pool.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [
    alamat,
  ])
  return {
    email: alamat,
    userId: rows[0]!.id,
    accessToken: hasil.accessToken,
    refreshToken: hasil.refreshToken,
    sessionId: hasil.sessionId,
  }
}

test('refresh token berotasi: token lama diganti token baru', async () => {
  const pengguna = await penggunaYangMasuk()

  const hasil = await h.module.sessions.refresh(
    { refreshToken: pengguna.refreshToken },
    ANONYMOUS_CONTEXT,
  )
  expect(hasil.kind).toBe('rotated')
  if (hasil.kind !== 'rotated') throw new Error('tidak mungkin')
  expect(hasil.refreshToken).not.toBe(pengguna.refreshToken)

  const sesi = await h.module.sessions.listSessions(pengguna.userId, hasil.sessionId)
  expect(sesi).toHaveLength(1)
  expect(sesi[0]?.current).toBe(true)
})

test('penggunaan ulang refresh token terdeteksi dan seluruh rantai dicabut', async () => {
  const pengguna = await penggunaYangMasuk()

  const pertama = await h.module.sessions.refresh(
    { refreshToken: pengguna.refreshToken },
    ANONYMOUS_CONTEXT,
  )
  if (pertama.kind !== 'rotated') throw new Error('rotasi pertama gagal')

  const kedua = await h.module.sessions.refresh(
    { refreshToken: pertama.refreshToken },
    ANONYMOUS_CONTEXT,
  )
  if (kedua.kind !== 'rotated') throw new Error('rotasi kedua gagal')

  // Token pertama dipakai lagi. Ia seharusnya sudah dibuang pemiliknya begitu
  // penggantinya diterima, jadi kemunculannya berarti ada salinannya.
  const diulang = await h.module.sessions.refresh(
    { refreshToken: pengguna.refreshToken },
    ANONYMOUS_CONTEXT,
  )
  expect(diulang.kind).toBe('reuse_detected')

  // Yang dicabut bukan hanya token itu — seluruh keluarganya, termasuk token
  // yang baru saja diterbitkan dan mungkin justru dipegang penyerang.
  const setelahnya = await h.module.sessions.refresh(
    { refreshToken: kedua.refreshToken },
    ANONYMOUS_CONTEXT,
  )
  expect(setelahnya.kind).toBe('invalid')

  const sesiAktif = await h.module.sessions.listSessions(pengguna.userId, null)
  expect(sesiAktif).toHaveLength(0)

  const { rows } = await h.pool.query<{ type: string }>(
    `SELECT type FROM auth_events WHERE user_id = $1 AND type = 'session.reuse_detected'`,
    [pengguna.userId],
  )
  expect(rows).toHaveLength(1)
})

test('sesi yang dicabut berhenti seketika', async () => {
  const pengguna = await penggunaYangMasuk()

  const dicabut = await h.module.sessions.revokeSession(
    pengguna.userId,
    pengguna.sessionId,
    ANONYMOUS_CONTEXT,
  )
  expect(dicabut).toBe(true)

  const hasil = await h.module.sessions.refresh(
    { refreshToken: pengguna.refreshToken },
    ANONYMOUS_CONTEXT,
  )
  expect(hasil.kind).toBe('invalid')

  expect(await h.module.sessions.listSessions(pengguna.userId, null)).toHaveLength(0)
})

test('logout bukan serangan: ia tidak memicu deteksi penggunaan ulang', async () => {
  const pengguna = await penggunaYangMasuk()

  expect(await h.module.sessions.logout({ refreshToken: pengguna.refreshToken }, ANONYMOUS_CONTEXT))
    .toBe(true)

  // Tab lama yang mencoba menyegarkan setelah logout hanya ditolak, bukan
  // membunyikan alarm keamanan.
  const hasil = await h.module.sessions.refresh(
    { refreshToken: pengguna.refreshToken },
    ANONYMOUS_CONTEXT,
  )
  expect(hasil.kind).toBe('invalid')

  const { rows } = await h.pool.query(
    `SELECT 1 FROM auth_events WHERE user_id = $1 AND type = 'session.reuse_detected'`,
    [pengguna.userId],
  )
  expect(rows).toHaveLength(0)
})

test('mencabut sesi milik orang lain gagal tanpa mengakui sesi itu ada', async () => {
  const korban = await penggunaYangMasuk()
  const penyerang = await penggunaYangMasuk()

  const hasil = await h.module.sessions.revokeSession(
    penyerang.userId,
    korban.sessionId,
    ANONYMOUS_CONTEXT,
  )
  expect(hasil).toBe(false)

  // Sesi korban tetap hidup.
  expect(await h.module.sessions.listSessions(korban.userId, null)).toHaveLength(1)
})

test('perubahan kata sandi mencabut seluruh sesi kecuali yang sedang berjalan', async () => {
  const pertama = await penggunaYangMasuk()

  const keduaLogin = await h.module.authentication.login(
    { email: pertama.email, password: VALID_PASSWORD },
    ANONYMOUS_CONTEXT,
  )
  if (keduaLogin.kind !== 'authenticated') throw new Error('login kedua gagal')

  expect(await h.module.sessions.listSessions(pertama.userId, null)).toHaveLength(2)

  const hasil = await h.module.authentication.changePassword(
    {
      userId: pertama.userId,
      currentPassword: VALID_PASSWORD,
      newPassword: 'kata sandi baru yang panjang',
      currentSessionId: keduaLogin.sessionId,
    },
    ANONYMOUS_CONTEXT,
  )
  expect(hasil).toEqual({ kind: 'changed', revokedSessions: 1 })

  // Sesi lain mati seketika.
  const sesiLama = await h.module.sessions.refresh(
    { refreshToken: pertama.refreshToken },
    ANONYMOUS_CONTEXT,
  )
  expect(sesiLama.kind).toBe('invalid')

  // Sesi yang sedang dipakai tetap hidup — orang yang mengganti kata sandinya
  // sendiri tidak ikut terlempar keluar.
  const sesiSekarang = await h.module.sessions.refresh(
    { refreshToken: keduaLogin.refreshToken },
    ANONYMOUS_CONTEXT,
  )
  expect(sesiSekarang.kind).toBe('rotated')

  // Kata sandi lama tidak berlaku lagi.
  const denganKataSandiLama = await h.module.authentication.login(
    { email: pertama.email, password: VALID_PASSWORD },
    ANONYMOUS_CONTEXT,
  )
  expect(denganKataSandiLama).toEqual({ kind: 'invalid_credentials' })
})

test('refresh token yang kedaluwarsa ditolak dan sesinya ditutup', async () => {
  const pengguna = await penggunaYangMasuk()

  h.setNow(new Date(Date.now() + 31 * 24 * 60 * 60 * 1000))
  const hasil = await h.module.sessions.refresh(
    { refreshToken: pengguna.refreshToken },
    ANONYMOUS_CONTEXT,
  )
  h.setNow(null)

  expect(hasil.kind).toBe('expired')
  expect(await h.module.sessions.listSessions(pengguna.userId, null)).toHaveLength(0)
})
