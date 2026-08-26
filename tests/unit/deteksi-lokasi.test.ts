import { afterEach, expect, test, vi } from 'vitest'

/**
 * Deteksi tempat perintah deploy berjalan.
 *
 * Ini satu-satunya bagian perkakas deploy yang MENEBAK sesuatu, dan tebakan
 * yang salah menjalankan deploy di tempat yang salah. Karena itu yang diuji
 * bukan hanya jawaban benarnya, melainkan juga bahwa ia BERHENTI saat tidak
 * yakin — diam-diam memilih salah satu adalah kegagalan yang paling mahal di
 * berkas ini.
 *
 * Modulnya membaca lingkungan saat diimpor, jadi setiap kasus memuatnya ulang.
 */

const ASLI = { ...process.env }

afterEach(() => {
  process.env = { ...ASLI }
  vi.resetModules()
})

async function muat() {
  vi.resetModules()
  return import('../../tools/deploy/lingkungan.js')
}

test('DEPLOY_MODE dihormati apa adanya', async () => {
  process.env.DEPLOY_MODE = 'lokal'
  expect((await (await muat()).deteksiLokasi()).mode).toBe('lokal')

  process.env.DEPLOY_MODE = 'jarak-jauh'
  expect((await (await muat()).deteksiLokasi()).mode).toBe('jarak-jauh')
})

test('DEPLOY_MODE bernilai asing ditolak, bukan diabaikan', async () => {
  process.env.DEPLOY_MODE = 'server'

  /*
   * Nilai yang salah eja lebih berbahaya daripada nilai yang kosong: yang
   * menulisnya percaya sudah memaksa mode tertentu. Mengabaikannya diam-diam
   * berarti deteksi otomatis berjalan justru ketika seseorang bermaksud
   * mematikannya.
   */
  await expect((await muat()).deteksiLokasi()).rejects.toThrow(/hanya "lokal" dan "jarak-jauh"/)
})

test('alamat milik mesin ini berarti perintah berjalan DI server', async () => {
  process.env.DEPLOY_MODE = ''
  process.env.DEPLOY_SSH = 'paadu@127.0.0.1'
  process.env.DEPLOY_DIR = process.cwd()

  const hasil = await (await muat()).deteksiLokasi()

  expect(hasil.mode).toBe('lokal')
  expect(hasil.alasan).toContain('127.0.0.1')
})

test('alamat yang bukan milik mesin ini berarti perintah berjalan dari jauh', async () => {
  process.env.DEPLOY_MODE = ''
  // Alamat dokumentasi RFC 5737 — tidak akan pernah dimiliki mesin mana pun.
  process.env.DEPLOY_SSH = 'paadu@192.0.2.1'

  const hasil = await (await muat()).deteksiLokasi()

  expect(hasil.mode).toBe('jarak-jauh')
  expect(hasil.alasan).toContain('192.0.2.1')
})

test('alamat milik sendiri tetapi direktori aplikasi tidak ada: BERHENTI', async () => {
  process.env.DEPLOY_MODE = ''
  process.env.DEPLOY_SSH = 'paadu@127.0.0.1'
  process.env.DEPLOY_DIR = '/direktori/yang/tidak/pernah/ada'

  /*
   * Dua sinyal yang bertentangan. Melanjutkan sebagai "lokal" akan menjalankan
   * seluruh urutan di direktori yang tidak ada, dan gagal di langkah pertama
   * dengan pesan yang tidak menyebutkan sebab sebenarnya.
   */
  await expect((await muat()).deteksiLokasi()).rejects.toThrow(/tidak ada di sini/)
})

test('nama host yang tidak dapat diurai: BERHENTI, bukan menebak', async () => {
  process.env.DEPLOY_MODE = ''
  process.env.DEPLOY_SSH = 'paadu@inang-yang-pasti-tidak-ada.invalid'

  const galat = await (await muat()).deteksiLokasi().catch((e: Error) => e)

  expect(galat).toBeInstanceOf(Error)
  expect((galat as Error).message).toContain('DEPLOY_MODE=lokal')
  expect(
    (galat as Error).message,
    'pesannya tidak menyebutkan cara keluar dari keadaan ini',
  ).toContain('DEPLOY_MODE=jarak-jauh')
})

test('pengangkutnya berbeda, perintahnya sama persis', async () => {
  const { buatPenjalan } = await muat()

  /*
   * Yang membuat "satu jalur kode" benar bukan niat, melainkan bentuk ini:
   * kedua mode menerima STRING PERINTAH yang sama dan hanya berbeda cara
   * mengirimnya. Tidak ada tempat bagi salah satu mode untuk lambat laun
   * menjalankan urutan yang berbeda.
   */
  expect(typeof buatPenjalan('lokal')).toBe('function')
  expect(typeof buatPenjalan('jarak-jauh')).toBe('function')
  expect(buatPenjalan('lokal').length).toBe(buatPenjalan('jarak-jauh').length)
})
