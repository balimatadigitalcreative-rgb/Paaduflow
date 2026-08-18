import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { startApi } from './api.js'

/**
 * Titik masuk PRODUKSI.
 *
 * Yang paling penting di berkas ini adalah apa yang TIDAK ada:
 *
 * - Tidak menyalakan PostgreSQL. Basis data produksi berumur lebih panjang
 *   daripada proses yang memakainya.
 * - Tidak menjalankan migrasi. Perubahan skema adalah langkah deploy yang
 *   disengaja dan diawasi, bukan efek samping dari proses yang kebetulan
 *   dinyalakan ulang — dan koneksi runtime memang tidak berwenang membuat
 *   tabel (D-141).
 * - Tidak menjalankan Vite. Antarmuka disajikan sebagai berkas statis hasil
 *   `npm run build:web`.
 *
 * Ketiganya dilakukan `tools/dev/start.js`, dan ketiganya benar di sana.
 * Pemisahannya dicatat di D-142.
 */

const DIR = dirname(fileURLToPath(import.meta.url))

/** `dist/server/main.js` → akar repo. */
const AKAR = resolve(DIR, '..', '..')
const WEB = resolve(AKAR, 'dist', 'web')

/**
 * Variabel yang sudah ada di lingkungan TIDAK ditimpa berkas `.env`.
 *
 * Itu perilaku bawaan `process.loadEnvFile`, dan itulah yang benar di server:
 * di sana nilainya sering diberikan systemd, PM2, atau manajer rahasia, dan
 * berkas `.env` yang tertinggal dari penyiapan pertama tidak boleh diam-diam
 * mengalahkannya.
 */
function muatEnv(): void {
  const berkas = resolve(AKAR, '.env')
  if (!existsSync(berkas)) return
  process.loadEnvFile(berkas)
}

/** Gagal cepat, dengan pesan yang menyebutkan cara memperbaikinya. */
function periksaLingkungan(): void {
  const kurang: string[] = []
  for (const nama of ['DATABASE_URL', 'PORT', 'TOKEN_SIGNING_SECRET', 'MFA_ENCRYPTION_KEY']) {
    const nilai = process.env[nama]
    if (nilai === undefined || nilai === '') kurang.push(nama)
  }

  if (kurang.length > 0) {
    console.error(
      [
        '',
        `  Tidak dapat menyala: ${kurang.length} variabel lingkungan belum dipasang.`,
        '',
        ...kurang.map((nama) => `      ${nama}`),
        '',
        '  Pasang di berkas .env pada akar aplikasi, atau lewat manajer proses.',
        '  Contohnya ada di .env.example.',
        '',
        '  DATABASE_URL adalah kredensial RUNTIME (paadu_app) — bukan kredensial',
        '  migrasi. Migrasi dijalankan terpisah: npm run migrate.',
        '',
      ].join('\n'),
    )
    process.exit(1)
  }

  /**
   * Format, bukan sekadar keberadaan.
   *
   * Nilai yang ada tetapi salah bentuk dulu lolos pemeriksaan ini dan baru
   * meledak jauh di dalam — `AesSecretCipher` menolak kunci non-32-bait, dan
   * pesannya hanya terlihat di log PM2 setelah proses gagal menyala. Kunci hex
   * adalah kesalahan yang paling mudah dilakukan: ia tampak seperti rahasia
   * yang benar, dan base64 menerimanya tanpa protes sampai panjangnya dihitung.
   */
  const salah: string[][] = []

  const dbUrl = process.env.DATABASE_URL ?? ''
  if (!/^postgres(ql)?:\/\//.test(dbUrl)) {
    salah.push([
      'DATABASE_URL bukan URL koneksi PostgreSQL.',
      'Format : postgresql://pengguna:sandi@host:port/basis',
    ])
  }

  const port = Number(process.env.PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    salah.push([
      `PORT bernilai "${process.env.PORT}", bukan bilangan bulat 1–65535.`,
      'Format : bilangan bulat, mis. 3000',
    ])
  }

  const rahasiaToken = process.env.TOKEN_SIGNING_SECRET ?? ''
  if (rahasiaToken.length < 32) {
    salah.push([
      `TOKEN_SIGNING_SECRET hanya ${rahasiaToken.length} karakter, minimal 32.`,
      'Format : teks bebas, minimal 32 karakter, dipakai apa adanya sebagai UTF-8',
      'Buat   : openssl rand -base64 48',
    ])
  }

  const kunciMfa = process.env.MFA_ENCRYPTION_KEY ?? ''
  const baitMfa = Buffer.from(kunciMfa, 'base64').length
  if (baitMfa !== 32) {
    salah.push([
      `MFA_ENCRYPTION_KEY mendekode menjadi ${baitMfa} bait, seharusnya tepat 32.`,
      'Format : base64 yang mendekode menjadi 32 bait — 44 karakter, berakhir "="',
      'Buat   : openssl rand -base64 32',
      ...(/^[0-9a-fA-F]+$/.test(kunciMfa)
        ? ['', '  Nilainya tampak HEX. AES-256 di sini menuntut base64, bukan hex.']
        : []),
    ])
  }

  if (salah.length > 0) {
    console.error('')
    console.error(`  Tidak dapat menyala: ${salah.length} variabel salah format.`)
    for (const butir of salah) {
      console.error('')
      console.error(`      ${butir[0]}`)
      for (const baris of butir.slice(1)) {
        console.error(baris === '' ? '' : `        ${baris}`)
      }
    }
    console.error('')
    console.error('  Seluruh formatnya dijelaskan di .env.example.')
    console.error('')
    process.exit(1)
  }

  if (!existsSync(resolve(WEB, 'index.html'))) {
    console.error(
      [
        '',
        `  Tidak dapat menyala: ${WEB} tidak memuat index.html.`,
        '',
        '  Antarmuka belum dibangun. Jalankan:  npm run build',
        '',
      ].join('\n'),
    )
    process.exit(1)
  }
}

muatEnv()
periksaLingkungan()

await startApi({ webRoot: WEB })
