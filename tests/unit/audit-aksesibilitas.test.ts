import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from 'vitest'

import { auditContrast, contrastRatio } from '../../tools/a11y/contrast.js'

/**
 * Audit aksesibilitas terhadap kode nyata — Sesi E1.
 *
 * Yang di berkas ini adalah bagian yang dapat diukur tanpa browser: kontras
 * token dan struktur JSX. Yang membutuhkan browser sungguhan — zoom 200%,
 * screen reader, dan waktu cat — dinyatakan tidak diukur di ringkasan sesi,
 * bukan diselundupkan sebagai lulus.
 */

const WEB = fileURLToPath(new URL('../../src/interface/web', import.meta.url))

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return tsxFiles(path)
    return name.endsWith('.tsx') ? [path] : []
  })
}

test('rasio kontras: seluruh pasangan yang dipakai lolos di kedua mode', () => {
  const hasil = auditContrast()

  const gagal = hasil.filter((item) => !item.passes)
  if (gagal.length > 0) {
    console.error(
      gagal
        .map((item) => `[${item.mode}] ${item.pair}: ${item.ratio}:1 (min ${item.min})`)
        .join('\n'),
    )
  }

  expect(gagal).toEqual([])
  // Angkanya, bukan hanya lulus atau gagal — 18 pasangan × 2 mode.
  expect(hasil).toHaveLength(36)
})

test('rasio kontras dihitung benar terhadap nilai rujukan WCAG', () => {
  // Memeriksa asumsi alat ukurnya sendiri. Audit yang alat ukurnya salah akan
  // meluluskan warna yang tidak terbaca dengan penuh keyakinan.
  expect(contrastRatio('#000000', '#FFFFFF')).toBe(21)
  expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1)
  // Nilai rujukan yang banyak dipakai: #767676 di atas putih tepat 4,54:1.
  expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 1)
})

test('tidak ada onClick pada th maupun tr', () => {
  // Ini pola yang menghasilkan seluruh temuan Major di audit prototype:
  // elemen non-interaktif yang tidak dapat dijangkau keyboard.
  const pelanggaran: string[] = []

  for (const file of tsxFiles(WEB)) {
    const isi = readFileSync(file, 'utf8')
    const baris = isi.split('\n')

    baris.forEach((teks, index) => {
      const cocok = /<(th|tr)\b[^>]*\bonClick\b/.exec(teks)
      if (cocok !== null) pelanggaran.push(`${file}:${index + 1} — onClick pada <${cocok[1]}>`)
    })
  }

  expect(pelanggaran).toEqual([])
})

test('setiap elemen interaktif memakai tag interaktif, bukan div ber-onClick', () => {
  const pelanggaran: string[] = []

  for (const file of tsxFiles(WEB)) {
    const isi = readFileSync(file, 'utf8')
    isi.split('\n').forEach((teks, index) => {
      const cocok = /<(div|span|li|td)\b[^>]*\bonClick\b/.exec(teks)
      if (cocok === null) return
      // Backdrop yang menutup lapisan mengambang adalah pengecualian sah: ia
      // ber-aria-hidden dan tindakannya selalu punya jalur keyboard lain (Esc).
      if (teks.includes('aria-hidden')) return
      pelanggaran.push(`${file}:${index + 1} — onClick pada <${cocok[1]}>`)
    })
  }

  expect(pelanggaran).toEqual([])
})

test('target sentuh dinaikkan ke minimum di viewport sentuh', () => {
  // Kontrol sm dan md tidak tersedia di perangkat sentuh — target 44px mutlak.
  const css = readFileSync(
    fileURLToPath(new URL('../../src/interface/web/components/primitives.module.css', import.meta.url)),
    'utf8',
  )

  expect(css).toContain('@media (pointer: coarse)')
  expect(css).toContain('var(--size-touch-min)')
})
