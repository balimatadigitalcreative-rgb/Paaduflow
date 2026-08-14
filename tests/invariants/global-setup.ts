import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import EmbeddedPostgres from 'embedded-postgres'
import { Client } from 'pg'

import { migrate } from '../../tools/db/migrate.js'

const execFileAsync = promisify(execFile)

/**
 * Satu PostgreSQL sungguhan untuk seluruh test invarian.
 *
 * Row-level security dan pencabutan hak tidak dapat dipalsukan — basis data
 * tiruan akan meluluskan tepat kelas kesalahan yang paling mahal. Karena itu
 * test ini menolak berjalan tanpa Postgres nyata.
 *
 * Bila `TEST_DATABASE_URL` sudah dipasang, ia yang dipakai — itu jalur CI, tempat
 * Postgres berjalan sebagai service container. Bila tidak, sebuah instans
 * disalakan di direktori sementara. Keduanya tidak memerlukan Docker.
 */

let stop: (() => Promise<void>) | null = null

/**
 * Menghabisi proses klaster yang tertinggal setelah postmaster berhenti.
 *
 * `embedded-postgres` menembak `taskkill /f /t` tanpa pernah menunggunya, lalu
 * menganggap tugasnya selesai begitu postmaster keluar. Bila postmaster mati
 * lebih dulu daripada taskkill sempat mendata anaknya, satu proses `io_worker`
 * tertinggal sebagai yatim — dan itu terjadi kira-kira sekali per tiga jalan.
 *
 * Proses yatim itu mewarisi stdout dan stderr postmaster, yaitu dua pipa yang
 * dibuat Node saat men-spawn. Selama ia hidup, ujung tulis pipa tidak pernah
 * tertutup, Node tidak pernah menerima EOF, dan dua handle PipeWrap tetap
 * menahan event loop. Test lulus, lalu vitest berhenti dengan "close timed out
 * after 10000ms".
 *
 * Anak yatim tetap membawa ParentProcessId induknya yang sudah mati, jadi ia
 * masih dapat ditemukan sesudahnya. Penyaringan nama proses menjaga agar nomor
 * PID yang kebetulan dipakai ulang sistem tidak ikut terbunuh.
 *
 * Hanya Windows: di tempat lain postmaster menerima SIGINT dan menutup seluruh
 * anaknya sendiri.
 */
async function habisiSisaKlaster(postmasterPid: number): Promise<void> {
  if (process.platform !== 'win32') return

  const { stdout } = await execFileAsync('powershell', [
    '-NoProfile',
    '-Command',
    `Get-CimInstance Win32_Process -Filter "ParentProcessId=${postmasterPid} ` +
      `AND Name='postgres.exe'" | ForEach-Object { $_.ProcessId }`,
  ])

  const yatim = stdout.split(/\s+/).filter((baris) => /^\d+$/.test(baris))

  // taskkill menolak PID yang sudah keluar sendiri di sela pendataan dan
  // pembunuhan. Itu justru hasil yang diinginkan, bukan kegagalan.
  await Promise.all(
    yatim.map((pid) => execFileAsync('taskkill', ['/pid', pid, '/f', '/t']).catch(() => undefined)),
  )
}

export async function setup(): Promise<void> {
  if (process.env.TEST_DATABASE_URL !== undefined && process.env.TEST_DATABASE_URL !== '') {
    await migrate(process.env.TEST_DATABASE_URL)
    return
  }

  const dataDir = await mkdtemp(join(tmpdir(), 'paadu-pg-'))
  const port = 55000 + Math.floor(Math.random() * 2000)

  const postgres = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port,
    // Direktori sementara ini milik kita, dan kita yang menghapusnya di bawah.
    // Dengan `false`, pustaka menghapusnya sendiri di dalam `stop()` tanpa coba
    // ulang — tepat pada saat proses yatim masih mengunci berkas di dalamnya,
    // sehingga `stop()` gagal dengan EBUSY sebelum pembersihan sempat berjalan.
    persistent: true,
    onLog: () => {},
    onError: () => {},
  })

  await postgres.initialise()
  await postgres.start()

  // `process` privat di tipe pustaka, tetapi PID-nya yang menjadi satu-satunya
  // tali menuju anak-anak yang mungkin tertinggal setelah `stop()`.
  const postmasterPid = (postgres as unknown as { process?: { pid?: number } }).process?.pid

  stop = async () => {
    await postgres.stop()
    if (postmasterPid !== undefined) await habisiSisaKlaster(postmasterPid)
    // Windows masih memegang berkas beberapa saat setelah proses berhenti.
    // Direktori sementara yang tertinggal bukan alasan menggagalkan test yang
    // sudah lulus — sistem operasi yang akan membersihkannya.
    await rm(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(
      () => undefined,
    )
  }

  // Sejak titik ini instans sudah berjalan. Kegagalan apa pun harus tetap
  // mematikannya — proses Postgres yang tertinggal akan menahan port dan
  // membuat jalannya test berikutnya gagal karena sebab yang salah.
  try {
    // Bukan createDatabase() bawaan: di Windows, klaster mewarisi locale sistem
    // dan basis data barunya lahir ber-encoding WIN1252. Encoding itu tidak dapat
    // memuat teks yang dipakai produk ini.
    const admin = new Client({
      connectionString: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`,
    })
    await admin.connect()
    await admin.query(
      `CREATE DATABASE paadu_test
         WITH ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`,
    )
    await admin.end()

    const url = `postgresql://postgres:postgres@127.0.0.1:${port}/paadu_test`
    await migrate(url)
    process.env.TEST_DATABASE_URL = url
  } catch (error) {
    await stop()
    stop = null
    throw error
  }
}

export async function teardown(): Promise<void> {
  if (stop !== null) await stop()
}
