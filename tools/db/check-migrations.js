/**
 * Pemeriksa migrasi — menegakkan D-033.
 *
 * Tiga hal yang dijaga, dan ketiganya menggagalkan build:
 *
 * 1. Migrasi hanya menambah. Perubahan yang merusak dipecah tiga rilis
 *    (Resilience §6), bukan diselundupkan ke satu migrasi.
 * 2. Nomor berurutan tanpa celah dan tanpa duplikat. Dua migrasi bernomor sama
 *    akan diterapkan dengan urutan yang bergantung sistem berkas.
 * 3. Migrasi yang sudah pernah tercatat tidak diubah lagi. Basis data yang
 *    sudah menerapkannya tidak akan pernah menerapkan versi barunya, sehingga
 *    skema produksi dan berkas di repo diam-diam berbeda.
 *
 * Pintu darurat: baris `-- paadu:allow-breaking <alasan>` tepat sebelum
 * pernyataan yang melanggar. Ia sengaja jelek dibaca dan ikut terlihat di
 * tinjauan kode — pengecualian yang mudah ditulis adalah pengecualian yang
 * akan sering ditulis.
 */

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations', import.meta.url))
const LOCKFILE = join(MIGRATIONS_DIR, 'CHECKSUMS.txt')
const ESCAPE = /--\s*paadu:allow-breaking\b/i

/** Pola yang merusak kompatibilitas dua arah. */
const FORBIDDEN = [
  { pattern: /\bDROP\s+COLUMN\b/i, reason: 'DROP COLUMN' },
  { pattern: /\bDROP\s+TABLE\b/i, reason: 'DROP TABLE' },
  { pattern: /\bRENAME\s+(COLUMN|TO)\b/i, reason: 'RENAME' },
  { pattern: /\bALTER\s+COLUMN\s+\w+\s+(SET\s+DATA\s+)?TYPE\b/i, reason: 'ALTER COLUMN … TYPE' },
  { pattern: /\bALTER\s+COLUMN\s+\w+\s+SET\s+NOT\s+NULL\b/i, reason: 'SET NOT NULL' },
  { pattern: /\bTRUNCATE\b/i, reason: 'TRUNCATE' },
  { pattern: /\bDROP\s+(TYPE|SCHEMA|FUNCTION|POLICY|TRIGGER)\b/i, reason: 'DROP objek' },
]

/** Bagian `-- Down Migration` sengaja memuat RAISE, bukan DDL. Ia tidak diperiksa. */
function upSection(sql) {
  const marker = sql.search(/^\s*--\s*Down Migration/im)
  return marker === -1 ? sql : sql.slice(0, marker)
}

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
}

function checkAdditiveOnly(name, sql) {
  const problems = []
  const lines = upSection(sql).split(/\r?\n/)

  lines.forEach((line, index) => {
    const bare = line.replace(/--.*$/, '')
    for (const { pattern, reason } of FORBIDDEN) {
      if (!pattern.test(bare)) continue
      const previous = lines[index - 1] ?? ''
      if (ESCAPE.test(previous) || ESCAPE.test(line)) continue
      problems.push(`${name}:${index + 1} — ${reason} tanpa penanda paadu:allow-breaking`)
    }
  })

  return problems
}

function checkNumbering(names) {
  const problems = []
  const seen = new Map()

  names.forEach((name) => {
    const match = /^(\d{4})_/.exec(name)
    if (match === null) {
      problems.push(`${name} — nama migrasi harus diawali empat angka, misal 0012_nama.sql`)
      return
    }
    const number = Number(match[1])
    if (seen.has(number)) {
      problems.push(`${name} — nomor ${match[1]} sudah dipakai ${seen.get(number)}`)
      return
    }
    seen.set(number, name)
  })

  const numbers = [...seen.keys()].sort((a, b) => a - b)
  numbers.forEach((number, index) => {
    if (number !== index + 1) {
      problems.push(`Nomor migrasi melompat: ${String(number).padStart(4, '0')} setelah ${index}`)
    }
  })

  return problems
}

function digest(sql) {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n'), 'utf8').digest('hex').slice(0, 16)
}

function readLockfile() {
  try {
    return new Map(
      readFileSync(LOCKFILE, 'utf8')
        .split(/\r?\n/)
        .filter((line) => line.trim() !== '' && !line.startsWith('#'))
        .map((line) => {
          const [name, hash] = line.split(/\s+/)
          return [name, hash]
        }),
    )
  } catch {
    return new Map()
  }
}

function checkChecksums(files, update) {
  const previous = readLockfile()
  const problems = []
  const lines = [
    '# Sidik jari migrasi yang sudah tercatat.',
    '# Mengubah migrasi yang sudah diterapkan berarti skema produksi dan berkas',
    '# di repo diam-diam berbeda. Perbaikan dilakukan lewat migrasi baru.',
    '# Perbarui dengan: npm run check:migrations -- --update',
  ]

  for (const { name, sql } of files) {
    const hash = digest(sql)
    const before = previous.get(name)
    if (before !== undefined && before !== hash && !update) {
      problems.push(`${name} — sudah tercatat tetapi isinya berubah. Tulis migrasi baru.`)
    }
    lines.push(`${name} ${hash}`)
  }

  if (update) writeFileSync(LOCKFILE, `${lines.join('\n')}\n`, 'utf8')
  return problems
}

export function checkMigrations({ update = false } = {}) {
  const names = migrationFiles()
  const files = names.map((name) => ({
    name,
    sql: readFileSync(join(MIGRATIONS_DIR, name), 'utf8'),
  }))

  return [
    ...checkNumbering(names),
    ...files.flatMap(({ name, sql }) => checkAdditiveOnly(name, sql)),
    ...checkChecksums(files, update),
  ]
}

export { checkAdditiveOnly, checkNumbering }

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url)

if (isDirectRun) {
  const update = process.argv.includes('--update')
  const problems = checkMigrations({ update })

  if (problems.length > 0) {
    console.error('Pemeriksaan migrasi gagal:\n')
    for (const problem of problems) console.error(`  ${problem}`)
    console.error('\nRujukan: docs/DECISIONS.md D-033 dan migrations/README.md')
    process.exit(1)
  }

  console.log(update ? 'Sidik jari migrasi diperbarui.' : 'Migrasi lolos pemeriksaan.')
}
