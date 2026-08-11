/**
 * Deteksi `UPDATE` atau `DELETE` pada tabel append-only **di kode mana pun** —
 * Resilience §6.
 *
 * Peran basis data sudah menolaknya saat berjalan (D-005). Pemeriksa ini
 * menolaknya lebih awal, di titik commit, karena kegagalan runtime pada jalur
 * yang jarang dilewati bisa berbulan-bulan tidak ketahuan.
 *
 * Daftar tabelnya dibaca dari `src/db/append-only-tables.ts` — satu daftar,
 * dibaca migrasi, test invarian, dan pemeriksa ini.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SOURCE = join(ROOT, 'src')
const LIST = join(SOURCE, 'db', 'append-only-tables.ts')
const ESCAPE = /--\s*paadu:allow-append-only-write\b/i

function appendOnlyTables() {
  const isi = readFileSync(LIST, 'utf8')
  const blok = /APPEND_ONLY_TABLES\s*=\s*\[([^\]]+)\]/s.exec(isi)
  if (blok === null) throw new Error('Daftar tabel append-only tidak terbaca.')
  return [...blok[1].matchAll(/'([^']+)'/g)].map((match) => match[1])
}

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx|js)$/.test(name) ? [path] : []
  })
}

/** Dipisahkan supaya aturannya dapat diuji tanpa menyentuh berkas nyata. */
export function findViolations(content, tables) {
  const problems = []
  const patterns = tables.flatMap((table) => [
    { table, regex: new RegExp(`\\bUPDATE\\s+(?:public\\.)?${table}\\b`, 'i'), verb: 'UPDATE' },
    {
      table,
      regex: new RegExp(`\\bDELETE\\s+FROM\\s+(?:public\\.)?${table}\\b`, 'i'),
      verb: 'DELETE',
    },
    { table, regex: new RegExp(`\\bTRUNCATE\\s+(?:public\\.)?${table}\\b`, 'i'), verb: 'TRUNCATE' },
  ])

  // Baris berikutnya ikut dibaca supaya SQL multi-baris di dalam template
  // literal tetap terbaca sebagai satu pernyataan.
  const baris = content.split('\n')

  baris.forEach((teks, index) => {
    const gabungan = `${teks} ${baris[index + 1] ?? ''}`
    for (const { table, regex, verb } of patterns) {
      if (!regex.test(gabungan)) continue
      if (ESCAPE.test(teks) || ESCAPE.test(baris[index - 1] ?? '')) continue
      problems.push({ line: index + 1, table, verb })
    }
  })

  return problems
}

export function checkAppendOnlyWrites() {
  const tables = appendOnlyTables()

  return sourceFiles(SOURCE).flatMap((file) =>
    findViolations(readFileSync(file, 'utf8'), tables).map(
      (item) =>
        `${file.slice(ROOT.length)}:${item.line} — ${item.verb} pada tabel append-only "${item.table}"`,
    ),
  )
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url)

if (isDirectRun) {
  const problems = checkAppendOnlyWrites()

  if (problems.length > 0) {
    console.error('Penulisan terlarang pada tabel append-only:\n')
    for (const problem of problems) console.error(`  ${problem}`)
    console.error('\nKoreksi dilakukan lewat baris lawan, bukan lewat pengubahan.')
    console.error('Rujukan: docs/DECISIONS.md D-005')
    process.exit(1)
  }

  console.log('Tidak ada penulisan terlarang pada tabel append-only.')
}
