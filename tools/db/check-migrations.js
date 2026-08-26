/**
 * Pemeriksa migrasi — menegakkan D-033 dan D-161.
 *
 * Empat hal yang dijaga, dan seluruhnya menggagalkan build:
 *
 * 1. Migrasi hanya menambah. Perubahan yang merusak kode yang sedang berjalan
 *    dipecah tiga rilis (D-161), bukan diselundupkan ke satu migrasi.
 * 2. Migrasi yang mengunci tabel lama tidak dijalankan sebaris dengan deploy.
 * 3. Nomor berurutan tanpa celah dan tanpa duplikat. Dua migrasi bernomor sama
 *    akan diterapkan dengan urutan yang bergantung sistem berkas.
 * 4. Migrasi yang sudah pernah tercatat tidak diubah lagi. Basis data yang
 *    sudah menerapkannya tidak akan pernah menerapkan versi barunya, sehingga
 *    skema produksi dan berkas di repo diam-diam berbeda.
 *
 * Aturan isinya tinggal di `aturan-migrasi.js` — dipisahkan supaya dapat diuji
 * satu per satu terhadap migrasi yang sengaja dibuat melanggar. Penjaga yang
 * tidak pernah diuji terhadap pelanggaran sungguhan biasanya tidak bekerja.
 *
 * Pintu darurat: `-- paadu:allow-breaking <alasan>` di komentar pernyataan yang
 * melanggar. Alasannya WAJIB, dan wajib cukup panjang untuk dibaca peninjau —
 * penanda yang dapat ditempel dalam dua kata adalah penanda yang akan ditempel
 * tanpa dipikirkan.
 */

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { AMBANG_PENJAGA, periksaIsiMigrasi } from './aturan-migrasi.js'

const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations', import.meta.url))
const LOCKFILE = join(MIGRATIONS_DIR, 'CHECKSUMS.txt')
function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
}

/**
 * Memeriksa isi satu migrasi terhadap aturan keamanan.
 *
 * Seluruh logikanya di `aturan-migrasi.js`; yang tersisa di sini hanya
 * meratakan hasilnya menjadi baris pesan.
 */
function periksaIsi(name, sql) {
  return periksaIsiMigrasi(name, sql).masalah.map((satu) => satu.pesan)
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
    ...files.flatMap(({ name, sql }) => periksaIsi(name, sql)),
    ...checkChecksums(files, update),
  ]
}

export { periksaIsi, checkNumbering }

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url)

if (isDirectRun) {
  const update = process.argv.includes('--update')
  const problems = checkMigrations({ update })

  if (problems.length > 0) {
    console.error('Pemeriksaan migrasi gagal:\n')
    for (const problem of problems) console.error(`  ${problem}`)
    console.error('\nRujukan: docs/DECISIONS.md D-033 dan D-161, serta migrations/README.md')
    process.exit(1)
  }

  if (update) {
    console.log('Sidik jari migrasi diperbarui.')
  } else {
    console.log(
      `Migrasi lolos pemeriksaan. Aturan isi berlaku sejak ` +
        `${String(AMBANG_PENJAGA + 1).padStart(4, '0')}; yang sebelumnya sudah diterapkan produksi.`,
    )
  }
}
