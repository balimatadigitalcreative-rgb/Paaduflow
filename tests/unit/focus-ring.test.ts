import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, test } from 'vitest'

/**
 * Setiap elemen interaktif punya focus ring yang terlihat.
 *
 * Ini penjaga, bukan uji tampilan. Komponen interaktif yang ditambahkan
 * belakangan gampang lupa diberi ring — dan yang kehilangan akses adalah orang
 * yang memakai keyboard, bukan orang yang menulis komponennya. Kerugiannya
 * senyap: tidak ada yang error, tidak ada yang merah, hanya seseorang yang
 * tidak dapat melihat di mana ia sedang berada.
 *
 * Empat kelas yang pernah luput — `.tab`, `.kpiCard`, `.filterChip`,
 * `.toastAction` — semuanya lahir dari sesi yang sama dan semuanya lolos
 * tinjauan. Karena itu daftarnya diperiksa mesin sekarang.
 */

const BERKAS = fileURLToPath(
  new URL('../../src/interface/web/components/primitives.module.css', import.meta.url),
)

/**
 * Kelas yang menandakan sesuatu dapat diklik atau difokus.
 *
 * Sengaja berbasis nama, bukan berbasis parsing HTML: kelas bernama `chip`,
 * `tab`, atau `action` hampir selalu berakhir sebagai `<button>` atau `<a>`,
 * dan penjaga yang menuntut analisis mendalam adalah penjaga yang akan dimatikan
 * orang saat ia mengganggu.
 */
const POLA_INTERAKTIF = /^\.(button|tab|kpiCard|filterChip|filterClear|toastAction|choiceInput|switchInput)$/

test('setiap kelas interaktif punya aturan focus-visible', () => {
  const css = readFileSync(BERKAS, 'utf8')

  // Seluruh nama kelas yang didefinisikan, tanpa pseudo dan tanpa atribut.
  const didefinisikan = new Set(
    [...css.matchAll(/^\.([a-zA-Z][a-zA-Z0-9]*)[\s,{[:]/gm)].map((cocok) => `.${cocok[1]}`),
  )

  // Seluruh kelas yang muncul di selector fokus mana pun.
  const berfokus = new Set(
    [...css.matchAll(/\.([a-zA-Z][a-zA-Z0-9]*):focus(-visible|-within)?/g)].map(
      (cocok) => `.${cocok[1]}`,
    ),
  )

  const interaktif = [...didefinisikan].filter((kelas) => POLA_INTERAKTIF.test(kelas))

  // Kalau daftar ini kosong, penjaganya yang rusak — bukan kodenya yang bersih.
  expect(interaktif.length).toBeGreaterThan(4)

  const tanpaRing = interaktif.filter((kelas) => !berfokus.has(kelas))
  expect(tanpaRing, `kelas interaktif tanpa focus-visible: ${tanpaRing.join(', ')}`).toEqual([])
})

test('tidak ada outline yang dimatikan tanpa penggantinya di elemen pembungkus', () => {
  const css = readFileSync(BERKAS, 'utf8')

  // `.input:focus { outline: none }` sah HANYA karena `.control:focus-within`
  // memindahkan ring ke pembungkusnya. Bila aturan itu hilang, field teks
  // berhenti menunjukkan fokus sama sekali.
  const mematikan = css.includes('.input:focus {\n  outline: none;\n}')
  const memindahkan = /\.control:focus-within[\s,{][^}]*outline:\s*var\(--border-width-focus\)/s.test(
    css.replace(/\n/g, '\n'),
  )

  if (mematikan) {
    expect(
      css.includes('.control:focus-within'),
      'outline .input dimatikan tetapi .control:focus-within tidak ada',
    ).toBe(true)
    expect(memindahkan || css.includes('.control:focus-within')).toBe(true)
  }
})
