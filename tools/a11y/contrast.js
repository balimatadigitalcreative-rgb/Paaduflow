/**
 * Perhitungan rasio kontras — WCAG 2.1 SC 1.4.3 dan 1.4.11.
 *
 * Audit prototype melaporkan lulus atau gagal. Yang diminta Sesi E1 adalah
 * **angkanya**, karena angka menunjukkan seberapa dekat sebuah pasangan dengan
 * ambang — dan pasangan yang lulus di 4,52 adalah pasangan yang akan gagal
 * begitu hex brand asli menggantikan perkiraan.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const TOKENS = fileURLToPath(new URL('../../docs/tokens.json', import.meta.url))

function loadTokens() {
  return JSON.parse(readFileSync(TOKENS, 'utf8'))
}

/** Menelusuri rujukan `{neutral.900}` sampai menemukan hex. */
function resolve(tokens, value, depth = 0) {
  if (depth > 10) throw new Error(`Rujukan token berputar: ${value}`)
  const match = /^\{([^}]+)\}$/.exec(value)
  if (match === null) return value

  const node = match[1].split('.').reduce((current, part) => current?.[part], tokens)
  if (node === undefined) throw new Error(`Token tidak ditemukan: ${value}`)
  return resolve(tokens, node.$value, depth + 1)
}

function channel(component) {
  const normalized = component / 255
  return normalized <= 0.039_28
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

export function luminance(hex) {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((char) => char + char)
          .join('')
      : clean

  const [merah, hijau, biru] = [0, 2, 4].map((offset) =>
    Number.parseInt(full.slice(offset, offset + 2), 16),
  )

  return 0.2126 * channel(merah) + 0.7152 * channel(hijau) + 0.0722 * channel(biru)
}

export function contrastRatio(foreground, background) {
  const terang = Math.max(luminance(foreground), luminance(background))
  const gelap = Math.min(luminance(foreground), luminance(background))
  return Math.round(((terang + 0.05) / (gelap + 0.05)) * 100) / 100
}

/**
 * Pasangan yang benar-benar dipakai komponen, bukan seluruh kombinasi yang
 * mungkin. Mengaudit kombinasi yang tidak pernah dirender hanya menghasilkan
 * kegagalan yang tidak berarti.
 */
export const PAIRS = [
  // Teks pada latar — ambang 4,5:1.
  { fg: 'text-primary', bg: 'bg-canvas', min: 4.5, kind: 'teks' },
  { fg: 'text-primary', bg: 'bg-surface', min: 4.5, kind: 'teks' },
  { fg: 'text-primary', bg: 'bg-surface-sunken', min: 4.5, kind: 'teks' },
  { fg: 'text-secondary', bg: 'bg-canvas', min: 4.5, kind: 'teks' },
  { fg: 'text-secondary', bg: 'bg-surface', min: 4.5, kind: 'teks' },
  { fg: 'text-secondary', bg: 'bg-surface-sunken', min: 4.5, kind: 'teks' },
  { fg: 'text-tertiary', bg: 'bg-surface', min: 4.5, kind: 'teks' },
  { fg: 'text-accent', bg: 'bg-surface', min: 4.5, kind: 'teks' },
  { fg: 'text-accent', bg: 'bg-accent-subtle', min: 4.5, kind: 'teks' },
  { fg: 'text-danger', bg: 'bg-surface', min: 4.5, kind: 'teks' },
  { fg: 'text-success', bg: 'bg-surface', min: 4.5, kind: 'teks' },
  { fg: 'text-warning', bg: 'bg-surface', min: 4.5, kind: 'teks' },
  { fg: 'text-on-accent', bg: 'action-primary-bg', min: 4.5, kind: 'teks' },
  { fg: 'text-on-accent', bg: 'action-danger-bg', min: 4.5, kind: 'teks' },

  // Batas dan kontrol — ambang 3:1 (SC 1.4.11).
  { fg: 'border-interactive', bg: 'bg-surface', min: 3, kind: 'komponen' },
  { fg: 'border-focus', bg: 'bg-surface', min: 3, kind: 'komponen' },
  { fg: 'border-focus', bg: 'bg-canvas', min: 3, kind: 'komponen' },
  { fg: 'action-primary-bg', bg: 'bg-surface', min: 3, kind: 'komponen' },
]

/**
 * `text-disabled` sengaja tidak diaudit: WCAG 1.4.3 mengecualikan kontrol
 * nonaktif. Mengauditnya akan menghasilkan kegagalan yang benar secara angka
 * tetapi salah secara aturan — dan kegagalan semacam itu mengajari orang
 * mengabaikan laporan.
 */
export const EXEMPT = ['text-disabled']

export function auditContrast() {
  const tokens = loadTokens()
  const hasil = []

  for (const mode of ['light', 'dark']) {
    const semantic = tokens.semantic[mode]
    for (const pair of PAIRS) {
      const fg = resolve(tokens, semantic[pair.fg].$value)
      const bg = resolve(tokens, semantic[pair.bg].$value)
      const ratio = contrastRatio(fg, bg)

      hasil.push({
        mode,
        pair: `${pair.fg} / ${pair.bg}`,
        kind: pair.kind,
        fg,
        bg,
        ratio,
        min: pair.min,
        passes: ratio >= pair.min,
      })
    }
  }

  return hasil
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url)

if (isDirectRun) {
  const hasil = auditContrast()
  const lebar = Math.max(...hasil.map((item) => item.pair.length))

  for (const mode of ['light', 'dark']) {
    console.log(`\n${mode.toUpperCase()}`)
    for (const item of hasil.filter((row) => row.mode === mode)) {
      const tanda = item.passes ? ' ' : '✗'
      console.log(
        `${tanda} ${item.pair.padEnd(lebar)}  ${String(item.ratio).padStart(6)}:1  (min ${item.min})`,
      )
    }
  }

  const gagal = hasil.filter((item) => !item.passes)
  console.log(`\n${hasil.length} pasangan diperiksa, ${gagal.length} gagal.`)
  if (gagal.length > 0) process.exit(1)
}
