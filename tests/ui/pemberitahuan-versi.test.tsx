import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'

import { PemberitahuanVersi } from '#interface/web/shell/pemberitahuan-versi'

/**
 * Pemberitahuan versi baru.
 *
 * Tiga keadaan yang membedakan fitur ini dari fitur yang mengganggu:
 *
 *   versi sama          → tidak ada apa pun di layar
 *   versi berbeda       → pemberitahuan, dan hanya pemberitahuan
 *   tidak terjawab      → tidak ada apa pun di layar, termasuk galat
 *
 * Yang ketiga yang paling mudah salah. Pemeriksaan yang gagal karena jaringan
 * sesaat tidak boleh menghasilkan satu piksel pun: ia bukan kegagalan yang
 * berarti apa-apa bagi orang yang sedang mengisi faktur.
 *
 * Yang TIDAK diuji di sini, dan tidak dapat diuji di sini: bahwa deploy
 * sungguhan memunculkannya di tab yang sudah terbuka. Itu dibuktikan dengan
 * menjalankannya, bukan dengan jsdom — lihat catatan gerbang di D-172.
 */

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const PESAN = /Versi baru Paadu Flow|A new version of Paadu Flow/

test('versi yang sama tidak memunculkan apa pun', async () => {
  const ambil = vi.fn().mockResolvedValue('abc1234')

  render(<PemberitahuanVersi ambil={ambil} versiTerpasang="abc1234" />)

  await waitFor(() => expect(ambil).toHaveBeenCalled())
  expect(screen.queryByText(PESAN)).toBeNull()
})

test('versi yang berbeda memunculkan pemberitahuan dengan tombol muat ulang', async () => {
  const ambil = vi.fn().mockResolvedValue('def5678')

  render(<PemberitahuanVersi ambil={ambil} versiTerpasang="abc1234" />)

  expect(await screen.findByText(PESAN)).toBeTruthy()
  expect(screen.getByRole('button', { name: /Muat ulang|Reload/ })).toBeTruthy()
})

test('pemeriksaan yang gagal tidak memunculkan apa pun', async () => {
  /*
   * `null` adalah cara `versiDisajikan` melaporkan setiap kegagalan — jaringan
   * putus, 503, JSON rusak. Ketiganya berarti "belum tahu", dan belum tahu
   * bukan alasan mengatakan apa pun kepada siapa pun.
   */
  const ambil = vi.fn().mockResolvedValue(null)

  render(<PemberitahuanVersi ambil={ambil} versiTerpasang="abc1234" />)

  await waitFor(() => expect(ambil).toHaveBeenCalled())
  expect(screen.queryByText(PESAN)).toBeNull()
})

test('yang diabaikan kembali setelah penundaannya habis', async () => {
  /*
   * Orang yang menutup pemberitahuan ini tetap menjalankan versi lama. Kalau ia
   * hilang selamanya, fitur ini menyerah tepat pada tab yang paling lama
   * terbuka — tab yang paling membutuhkannya.
   */
  vi.useFakeTimers({ shouldAdvanceTime: true })
  try {
    const ambil = vi.fn().mockResolvedValue('def5678')
    const pengguna = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<PemberitahuanVersi ambil={ambil} versiTerpasang="abc1234" />)

    await screen.findByText(PESAN)
    await pengguna.click(screen.getByRole('button', { name: /Nanti saja|Later/ }))
    expect(screen.queryByText(PESAN)).toBeNull()

    await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 1000)
    await waitFor(() => expect(screen.queryByText(PESAN)).not.toBeNull())
  } finally {
    vi.useRealTimers()
  }
})

test('pemberitahuan hilang bila server kembali ke versi tab ini', async () => {
  /*
   * Rollback. Tab yang sudah melihat pemberitahuan lalu ditarik kembali ke
   * versinya sendiri tidak boleh terus disuruh memuat ulang untuk sesuatu yang
   * tidak lagi berbeda — itu memberi tahu padahal tidak ada versi baru.
   */
  vi.useFakeTimers({ shouldAdvanceTime: true })
  try {
    const ambil = vi
      .fn()
      .mockResolvedValueOnce('def5678')
      .mockResolvedValue('abc1234')

    render(<PemberitahuanVersi ambil={ambil} versiTerpasang="abc1234" />)
    await screen.findByText(PESAN)

    await vi.advanceTimersByTimeAsync(6 * 60 * 1000)
    await waitFor(() => expect(screen.queryByText(PESAN)).toBeNull())
  } finally {
    vi.useRealTimers()
  }
})

test('jaringan yang putus tidak menghapus pemberitahuan yang sudah benar', async () => {
  // `null` berarti belum tahu. Belum tahu tidak boleh membatalkan sesuatu yang
  // sudah diketahui.
  vi.useFakeTimers({ shouldAdvanceTime: true })
  try {
    const ambil = vi.fn().mockResolvedValueOnce('def5678').mockResolvedValue(null)

    render(<PemberitahuanVersi ambil={ambil} versiTerpasang="abc1234" />)
    await screen.findByText(PESAN)

    await vi.advanceTimersByTimeAsync(11 * 60 * 1000)
    expect(screen.queryByText(PESAN)).not.toBeNull()
  } finally {
    vi.useRealTimers()
  }
})

test('tab yang tersembunyi berhenti memeriksa', async () => {
  /*
   * Bukan "melambat" — berhenti. Peramban memang melambatkan timer di tab
   * latar, tetapi seratus tab terbuka di satu kantor tetap menjadi lalu lintas
   * yang tidak menghasilkan apa-apa.
   */
  vi.useFakeTimers({ shouldAdvanceTime: true })
  try {
    const ambil = vi.fn().mockResolvedValue('abc1234')
    render(<PemberitahuanVersi ambil={ambil} versiTerpasang="abc1234" />)

    await waitFor(() => expect(ambil).toHaveBeenCalledTimes(1))

    // Kontrol positif lebih dulu: selama terlihat, jamnya MEMANG berdetak.
    // Tanpa langkah ini, uji di bawah lolos meski jamnya tidak pernah hidup.
    await vi.advanceTimersByTimeAsync(11 * 60 * 1000)
    const saatTerlihat = ambil.mock.calls.length
    expect(saatTerlihat).toBeGreaterThan(1)

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))

    await vi.advanceTimersByTimeAsync(20 * 60 * 1000)
    expect(ambil).toHaveBeenCalledTimes(saatTerlihat)
  } finally {
    vi.useRealTimers()
  }
})
