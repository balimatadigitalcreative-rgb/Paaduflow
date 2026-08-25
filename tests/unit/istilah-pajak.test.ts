import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test } from 'vitest'

/**
 * Istilah pajak Indonesia tidak pernah diterjemahkan — D-150.
 *
 * Diperiksa mesin, bukan diingat orang. Aturan yang hanya hidup di dokumen
 * bertahan sampai penerjemah pertama yang belum membacanya, dan "Tax Invoice"
 * di layar berbahasa Inggris terlihat benar bagi semua orang kecuali orang
 * pajak — yang baru melihatnya saat SPT ditolak.
 */

const LOCALES = join(process.cwd(), 'src/interface/web/i18n/locales')

/**
 * Istilah yang dilindungi.
 *
 * `Faktur Pajak` beserta turunannya ikut: keduanya nama kategori dokumen yang
 * ditetapkan peraturan, bukan deskripsi. `Keluaran` dan `Masukan` menempel
 * padanya sebagai bagian dari nama, bukan sebagai kata sifat yang berdiri
 * sendiri.
 */
const ISTILAH = [
  'NPWP',
  'NPPKP',
  'PKP',
  'e-Faktur',
  'Faktur Pajak',
  'DPP',
  'PPN',
  'PPh',
]

function berkasLocale(bahasa: string): Record<string, unknown> {
  const gabungan: Record<string, unknown> = {}
  for (const nama of readdirSync(join(LOCALES, bahasa))) {
    gabungan[nama] = JSON.parse(readFileSync(join(LOCALES, bahasa, nama), 'utf8'))
  }
  return gabungan
}

function ratakan(obyek: unknown, awalan = ''): readonly (readonly [string, string])[] {
  if (typeof obyek === 'string') return [[awalan, obyek] as const]
  if (typeof obyek !== 'object' || obyek === null) return []

  return Object.entries(obyek).flatMap(([kunci, nilai]) =>
    ratakan(nilai, awalan === '' ? kunci : `${awalan}.${kunci}`),
  )
}

const id = new Map(ratakan(berkasLocale('id')))
const en = new Map(ratakan(berkasLocale('en')))

test('setiap istilah pajak muncul sama persis di kedua bahasa', () => {
  const menyimpang: string[] = []

  for (const [kunci, teksId] of id) {
    const teksEn = en.get(kunci)
    if (teksEn === undefined) continue

    for (const istilah of ISTILAH) {
      /*
       * Batas kata di kedua sisi. Tanpa itu, "PPN" ikut tertangkap di dalam
       * kata lain dan pemeriksa mengeluh atas hal yang bukan istilah.
       *
       * `\\b`, bukan `\b`. Di dalam template literal `\b` adalah karakter
       * backspace, bukan batas kata — dan pola yang mencari backspace tidak
       * pernah cocok dengan apa pun. Uji ini sempat lolos justru karena itu,
       * meski datanya sengaja dirusak.
       */
      const pola = new RegExp(`\\b${istilah.replace('-', '\\-')}\\b`)
      if (!pola.test(teksId)) continue

      if (!pola.test(teksEn)) {
        menyimpang.push(`${kunci}: "${istilah}" ada di id, hilang di en — "${teksEn}"`)
      }
    }
  }

  expect(menyimpang, menyimpang.join('\n')).toEqual([])
})

test('istilah pajak tidak diterjemahkan menjadi padanan Inggris yang keliru', () => {
  /*
   * Terjemahan yang paling mungkin muncul, dan justru karena itu paling
   * berbahaya: masing-masing terdengar wajar dalam bahasa Inggris, dan tidak
   * satu pun merujuk dokumen yang sama di mata Direktorat Jenderal Pajak.
   */
  const TERLARANG = [
    'Tax Invoice',
    'Taxpayer Identification Number',
    'Value Added Tax',
    'Income Tax Article',
    'Tax Base',
  ]

  const ketemu: string[] = []
  for (const [kunci, teks] of en) {
    for (const salah of TERLARANG) {
      if (teks.includes(salah)) ketemu.push(`${kunci}: "${salah}"`)
    }
  }

  expect(ketemu, ketemu.join('\n')).toEqual([])
})

test('tidak ada nilai terjemahan yang kosong di bahasa mana pun', () => {
  /*
   * Kunci yang ada tetapi nilainya kosong lolos pemeriksa kesamaan kunci di
   * CI — ia memang ADA di kedua berkas. Yang terlihat pengguna adalah ruang
   * kosong, dan ruang kosong tidak pernah terbaca sebagai kesalahan.
   */
  for (const [nama, peta] of [
    ['id', id],
    ['en', en],
  ] as const) {
    const kosong = [...peta.entries()]
      .filter(([, teks]) => teks.trim() === '')
      .map(([kunci]) => kunci)

    expect(kosong, `${nama}: ${kosong.join(', ')}`).toEqual([])
  }
})

test('kedua bahasa memuat namespace yang sama', () => {
  expect(readdirSync(join(LOCALES, 'en')).sort()).toEqual(readdirSync(join(LOCALES, 'id')).sort())
})
