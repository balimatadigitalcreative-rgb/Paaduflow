import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { App } from '#interface/web/app'
import { api, onSesiHabis, sesi } from '#interface/web/api/client'

/**
 * Gerbang company — tiga keadaan yang dulu bertumpuk jadi satu.
 *
 * `companies` dulu hanya array yang dimulai kosong, sehingga "belum dijawab"
 * dan "dijawab, memang kosong" tidak dapat dibedakan. Pengguna yang akunnya
 * belum diberi company mana pun melihat "Memuat company…" selamanya.
 *
 * Berkas ini menguji keempat jalur yang berakhir di gerbang itu, karena tiga di
 * antaranya dulu menampilkan layar yang sama.
 */

function jawab(status: number, isi: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => isi,
  } as unknown as Response
}

beforeEach(() => {
  globalThis.localStorage.clear()
  sesi.simpan('token-uji', 'refresh-uji')
})

afterEach(() => {
  // Melepas pemasangan, bukan sekadar mengosongkan DOM: App mendaftarkan
  // penangan sesi global, dan komponen yang tidak dilepas akan membawanya ke
  // test berikutnya.
  cleanup()
  onSesiHabis(null)
  vi.unstubAllGlobals()
  globalThis.localStorage.clear()
})

test('daftar company kosong bagi pengguna yang sudah masuk berkata apa adanya', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jawab(200, { success: true, data: [] })),
  )

  render(<App />)

  expect(await screen.findByText(/belum ada company untuk akun ini/i)).toBeDefined()

  // Inti perbaikannya: indikator memuat tidak boleh bertahan setelah server
  // menjawab. Ia menjanjikan sesuatu yang tidak akan pernah datang.
  expect(screen.queryByText(/memuat company/i)).toBeNull()

  // Dan layarnya bukan jalan buntu.
  expect(screen.getByRole('button', { name: /periksa lagi/i })).toBeDefined()
  expect(screen.getByRole('button', { name: /keluar/i })).toBeDefined()
})

test('permintaan yang ditolak karena sesi mati mengarah ke halaman masuk', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      jawab(401, {
        success: false,
        message: 'Sesi tidak berlaku.',
        errors: [{ code: 'unauthenticated' }],
      }),
    ),
  )

  render(<App />)

  expect(await screen.findByText(/sesi anda berakhir/i)).toBeDefined()
  expect(screen.getByRole('button', { name: /^masuk$/i })).toBeDefined()

  // Token yang sudah ditolak tidak boleh tertinggal untuk dipakai lagi.
  expect(globalThis.localStorage.getItem('paadu.access_token')).toBeNull()
})

/**
 * Celah sebenarnya dari keluhan pertama.
 *
 * Permintaan `/v1/me/companies` yang ditolak memang sudah membawa pengguna ke
 * halaman masuk sejak dulu. Yang tidak: 401 dari permintaan halaman mana pun
 * setelah aplikasi terbuka — token yang mati di tengah pemakaian hanya
 * menghasilkan teks merah di layar itu, tanpa satu pun jalan ke halaman masuk.
 *
 * Diuji di tingkat klien karena di situlah keputusannya sekarang diambil, dan
 * karena yang perlu dibuktikan adalah pembedaannya: 401 saat memasukkan kata
 * sandi yang salah BUKAN sesi yang mati.
 */
test('401 pada permintaan bertoken memicu penangan sesi, 401 saat masuk tidak', async () => {
  const ditolak = vi.fn()
  onSesiHabis(ditolak)

  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      jawab(401, {
        success: false,
        message: 'Sesi tidak berlaku.',
        errors: [{ code: 'unauthenticated' }],
      }),
    ),
  )

  await expect(api.get('/v1/companies/abc/sales-invoices')).rejects.toThrow()
  expect(ditolak).toHaveBeenCalledTimes(1)
  expect(sesi.accessToken()).toBeNull()

  // Kata sandi salah juga menjawab 401. Token masih ada di penyimpanan, jadi
  // yang membedakan keduanya hanya `tanpaToken` — dan itu yang diuji di sini.
  sesi.simpan('token-uji', 'refresh-uji')
  ditolak.mockClear()

  await expect(api.masuk('orang@contoh.id', 'salah')).rejects.toThrow()
  expect(ditolak).not.toHaveBeenCalled()
  expect(sesi.accessToken()).toBe('token-uji')
})

test('kegagalan sementara tidak mengeluarkan pengguna', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      jawab(500, {
        success: false,
        message: 'Basis data tidak dapat dihubungi.',
        errors: [{ code: 'internal_error' }],
      }),
    ),
  )

  render(<App />)

  expect(await screen.findByText(/basis data tidak dapat dihubungi/i)).toBeDefined()
  expect(screen.getByRole('button', { name: /coba lagi/i })).toBeDefined()

  // Sesinya masih sah — yang gagal permintaannya. Membuangnya akan memaksa
  // masuk ulang karena satu gangguan jaringan sesaat.
  expect(globalThis.localStorage.getItem('paadu.access_token')).toBe('token-uji')
  expect(screen.queryByText(/sesi anda berakhir/i)).toBeNull()
})

test('indikator memuat hanya tampil selama server belum menjawab', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => undefined)),
  )

  render(<App />)

  expect(await screen.findByText(/memuat company…/i)).toBeDefined()
})
