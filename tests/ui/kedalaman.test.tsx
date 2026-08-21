import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test } from 'vitest'

/**
 * Kedalaman permukaan, hierarki tipografi, dan batas motion.
 *
 * Diperiksa dari CSS, bukan dari tampilan — jsdom tidak menghitung tata letak.
 * Yang dapat dibuktikan mesin di sini adalah aturan yang mudah dilanggar tanpa
 * terlihat: bayangan yang bocor ke mode gelap, ukuran yang dikarang di luar
 * skala, dan animasi yang melewati batas produk.
 */

function baca(nama: string): string {
  return readFileSync(join(process.cwd(), nama), 'utf8')
}

const TOKENS = baca('src/styles/tokens.css')
const SHELL = baca('src/interface/web/shell/shell.module.css')
const PRIMITIF = baca('src/interface/web/components/primitives.module.css')
const HALAMAN = baca('src/interface/web/pages/pages.module.css')
const TABEL = baca('src/interface/web/components/table/table.module.css')

const SELURUH_CSS = [SHELL, PRIMITIF, HALAMAN, TABEL].join('\n')

function blok(css: string, selektor: string): string {
  const awal = css.indexOf(selektor)
  if (awal === -1) return ''
  const buka = css.indexOf('{', awal)
  let dalam = 0
  for (let i = buka; i < css.length; i += 1) {
    if (css[i] === '{') dalam += 1
    else if (css[i] === '}') {
      dalam -= 1
      if (dalam === 0) return css.slice(buka + 1, i)
    }
  }
  return ''
}

// ── Permukaan ──────────────────────────────────────────────────────────────

test('mode gelap tidak memakai bayangan, kecuali overlay', () => {
  const gelap = blok(TOKENS, '[data-theme="dark"]')

  /*
   * Color_System §4: bayangan hitam di atas latar hitam tidak terlihat, dan di
   * mode gelap elevasi dibawa oleh permukaan yang makin terang. Menyalin
   * bayangan ke sana menghasilkan lapisan yang tampak datar — pengguna
   * kehilangan hierarki tanpa ada yang tampak rusak.
   */
  expect(gelap).toMatch(/--shadow-raised:\s*none/)
  expect(gelap).toMatch(/--shadow-card:\s*none/)

  // Kecuali satu: overlay harus tetap terpisah dari backdrop gelap.
  expect(gelap).toMatch(/--shadow-overlay:\s*0 12px/)
})

test('hanya elemen yang melayang memakai surface-raised', () => {
  /*
   * Color_System §4: kalau elemen tidak dapat ditutup, ia bukan raised. Kartu
   * KPI sempat memakainya, dan di mode terang itu tidak terlihat salah —
   * raised dan surface kebetulan sama-sama putih.
   */
  expect(blok(PRIMITIF, '.kpiCard {')).toContain('var(--bg-surface)')
  expect(blok(PRIMITIF, '.kpiCard {')).not.toContain('var(--bg-surface-raised)')

  for (const melayang of ['.listbox {', '.tooltip {']) {
    expect(blok(PRIMITIF, melayang), melayang).toContain('var(--bg-surface-raised)')
  }
})

test('setiap lapisan mengambang punya bayangan', () => {
  // Tanpa bayangan, dropdown di mode terang tidak terpisah dari halaman di
  // belakangnya — raised dan surface keduanya putih.
  for (const [css, nama] of [
    [PRIMITIF, '.listbox {'],
    [PRIMITIF, '.tooltip {'],
    [SHELL, '.switcherPanel {'],
    [SHELL, '.menuPanel {'],
    [SHELL, '.palette {'],
  ] as const) {
    expect(blok(css, nama), nama).toMatch(/box-shadow: var\(--shadow-(raised|overlay)\)/)
  }
})

// ── Tipografi ──────────────────────────────────────────────────────────────

test('empat tingkat hierarki, seluruhnya dari skala yang ada', () => {
  const ukuran = [...SELURUH_CSS.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1]!.trim())

  /*
   * Tidak ada ukuran yang dikarang. Satu `font-size: 15px` cukup untuk
   * membuat skala berhenti berarti apa-apa, dan yang menambahkannya hampir
   * selalu punya alasan yang terdengar masuk akal saat itu.
   */
  const diluar = ukuran.filter((satu) => !satu.startsWith('var(--font-size-') && satu !== '1em' && satu !== 'inherit')
  expect(diluar, `ukuran di luar skala: ${diluar.join(', ')}`).toEqual([])

  // Judul halaman > judul seksi > badan > label.
  expect(blok(SHELL, '.pageTitle {')).toContain('var(--font-size-heading-1)')
  expect(blok(HALAMAN, '.stack h2 {')).toContain('var(--font-size-heading-3)')
  expect(blok(PRIMITIF, '.kpiValue {')).toContain('var(--font-size-heading-2)')
  expect(blok(PRIMITIF, '.kpiLabel {')).toContain('var(--font-size-overline)')
})

test('angka kunci lebih besar daripada labelnya', () => {
  // Kartu KPI: nilai heading-2 (24px), label overline (11px). Dua langkah
  // penuh, bukan satu — jarak satu langkah masih terbaca sebagai dua baris
  // teks biasa.
  expect(blok(PRIMITIF, '.kpiValue {')).toContain('heading-2')
  expect(blok(PRIMITIF, '.kpiLabel {')).toContain('overline')
})

// ── Ruang napas ────────────────────────────────────────────────────────────

test('mode padat tetap rapat; hanya mode lega yang dilonggarkan', () => {
  const lega = blok(SHELL, ".shell[data-density='comfortable'] .body {")
  const padat = blok(SHELL, ".shell[data-density='compact'] .body {")

  /*
   * Pengguna harian memilih mode padat, dan yang mereka cari adalah baris
   * sebanyak mungkin di satu layar. Melonggarkan keduanya berarti mengorbankan
   * pemakaian delapan jam demi satu demo tiga puluh menit.
   */
  expect(lega).toContain('var(--space-8)')
  expect(padat).toContain('var(--space-4)')
})

// ── Motion ─────────────────────────────────────────────────────────────────

test('tidak ada durasi di luar token, dan tidak ada yang melebihi batas produk', () => {
  const gerak = [...SELURUH_CSS.matchAll(/(?:transition|animation):\s*([^;]+);/g)].map(
    (m) => m[1]!,
  )

  for (const satu of gerak) {
    if (satu.trim() === 'none') continue
    expect(satu, `gerak tanpa token durasi: ${satu}`).toMatch(/var\(--duration-/)
  }

  // Design_Tokens §8: tidak ada animasi melebihi 320ms di produk. Nilai
  // literal dalam milidetik berarti seseorang melewati skalanya.
  expect(SELURUH_CSS).not.toMatch(/(?:transition|animation)[^;]*\b\d{3,}ms/)
})

test('prefers-reduced-motion dihormati di berkas yang menganimasikan', () => {
  for (const [css, nama] of [
    [PRIMITIF, 'primitives'],
    [SHELL, 'shell'],
  ] as const) {
    expect(css, nama).toContain('prefers-reduced-motion')
  }
})
