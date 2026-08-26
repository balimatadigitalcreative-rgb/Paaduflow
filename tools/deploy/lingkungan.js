/**
 * Yang dipakai bersama `deploy.js` dan `rollback.js`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *   SATU JALUR KODE, DUA TEMPAT MENJALANKAN
 *
 *   Perintah deploy dulu selalu ber-SSH ke server. Dijalankan DI server, ia
 *   mencoba ber-SSH ke dirinya sendiri dan gagal — kegagalan yang membingungkan
 *   justru karena perintahnya benar.
 *
 *   Yang berubah hanya PENGANGKUTNYA. `diServer()` menjalankan perintah lewat
 *   SSH bila dipanggil dari laptop, dan lewat shell setempat bila dipanggil di
 *   server. Seluruh urutan langkah — gerbang prasyarat, konfirmasi migrasi,
 *   cadangan, reload bergulir, verifikasi kesiapan — tetap satu rangkaian yang
 *   sama. Dua rangkaian akan lambat laun berbeda, dan yang berbeda selalu
 *   ketahuan di lingkungan yang paling mahal.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import os, { networkInterfaces } from 'node:os'
import { createInterface } from 'node:readline/promises'

export const SERVER = process.env.DEPLOY_SSH ?? 'paadu@72.61.124.95'
export const APP_DIR = process.env.DEPLOY_DIR ?? '/home/paadu/app'
export const BRANCH = process.env.DEPLOY_BRANCH ?? 'main'
export const PM2_NAME = process.env.DEPLOY_PM2 ?? 'paadu-api'

/**
 * Kesiapan, bukan sekadar hidup.
 *
 * `/healthz` hanya menyatakan event loop berjalan; ia menjawab 200 pada proses
 * yang belum pernah berhasil menyentuh basis data. Deploy yang memeriksanya
 * akan dinyatakan berhasil tepat ketika ia gagal — kekeliruan yang sama dengan
 * yang dicatat D-145, hanya bentuknya berbeda.
 */
export const HEALTH = process.env.DEPLOY_HEALTH ?? 'http://127.0.0.1:3000/readyz'

/**
 * Berkas berisi MIGRATION_DATABASE_URL, di LUAR direktori aplikasi.
 *
 * Sengaja bukan `app/.env`: berkas itu dimuat proses runtime, dan kredensial
 * pemilik basis data tidak boleh berada di lingkungan proses yang melayani
 * permintaan (D-141).
 */
export const MIGRATION_ENV = process.env.DEPLOY_MIGRATION_ENV ?? '/home/paadu/.env.deploy'

/** Tempat cadangan pra-migrasi. Di luar direktori aplikasi, sengaja. */
export const BACKUP_DIR = process.env.DEPLOY_BACKUP_DIR ?? '/home/paadu/cadangan'

/** Cadangan yang lebih tua dari ini dibuang. */
export const BACKUP_SIMPAN_HARI = Number(process.env.DEPLOY_BACKUP_HARI ?? 14)

/** Arsip rilis — hasil build tiap deploy, untuk rollback. */
export const RILIS_DIR = process.env.DEPLOY_RILIS_DIR ?? '/home/paadu/rilis'

/**
 * Berapa rilis disimpan.
 *
 * LIMA, dan yang menentukan bukan disk. Satu rilis hanya 1,1 MB — menyimpan
 * lima puluh pun tidak akan terasa.
 *
 * Yang membatasi adalah SKEMA BASIS DATA. Rollback tidak menggulung balik
 * migrasi (D-164), jadi ia hanya aman sejauh skema hari ini masih dapat
 * dilayani kode lama. Menyimpan dua puluh rilis akan menyiratkan bahwa mundur
 * dua puluh langkah itu mungkin — dan itu tidak benar; ia hanya menawarkan
 * kenyamanan palsu tepat pada saat orang paling percaya pada angka.
 *
 * Lima menutup keadaan yang benar-benar terjadi: rilis buruk, ditambah rilis
 * sebelumnya bila yang pertama dituju ternyata sama buruknya.
 */
export const RILIS_DISIMPAN = Number(process.env.DEPLOY_RILIS_SIMPAN ?? 5)

const WARNA = process.stdout.isTTY === true
export const merah = (teks) => (WARNA ? `[31m${teks}[0m` : teks)
export const hijau = (teks) => (WARNA ? `[32m${teks}[0m` : teks)
export const kuning = (teks) => (WARNA ? `[33m${teks}[0m` : teks)
export const redup = (teks) => (WARNA ? `[2m${teks}[0m` : teks)

/** Menjalankan perintah dan mengumpulkan keluarannya. Tidak pernah melempar. */
export function spawnKumpul(perintah, argumen, opsi = {}) {
  return new Promise((resolve) => {
    const anak = spawn(perintah, argumen, { ...opsi, shell: false })
    let keluaran = ''
    let galat = ''
    anak.stdout?.on('data', (potongan) => {
      keluaran += potongan
      if (opsi.tampilkan === true) process.stdout.write(redup(String(potongan)))
    })
    anak.stderr?.on('data', (potongan) => {
      galat += potongan
      if (opsi.tampilkan === true) process.stdout.write(redup(String(potongan)))
    })
    anak.on('error', (kesalahan) => resolve({ kode: 127, keluaran, galat: kesalahan.message }))
    anak.on('close', (kode) => resolve({ kode: kode ?? 1, keluaran, galat }))
  })
}

export const git = (argumen) => spawnKumpul('git', argumen)

// ── Deteksi lokasi ──────────────────────────────────────────────────────────

/** Alamat IP milik mesin ini, seluruh antarmuka. */
function alamatSendiri() {
  const hasil = new Set()
  for (const daftar of Object.values(networkInterfaces())) {
    for (const satu of daftar ?? []) hasil.add(satu.address)
  }
  return hasil
}

function inangDari(target) {
  const potong = target.split('@')
  return potong.length > 1 ? potong.slice(1).join('@') : target
}

function penggunaDari(target) {
  const potong = target.split('@')
  return potong.length > 1 ? potong[0] : null
}

/**
 * Menentukan apakah perintah ini berjalan DI server tujuan.
 *
 * Sinyal utamanya menentukan dan sulit keliru: apakah salah satu alamat IP
 * mesin ini sama dengan alamat server tujuan. Mesin tidak dapat memiliki
 * alamat itu tanpa menjadi mesin itu.
 *
 * Yang tidak dilakukan: menebak dari nama host, dari nama pengguna, atau dari
 * adanya direktori aplikasi. Ketiganya wajar dimiliki laptop pengembang yang
 * kebetulan meniru tata letak server — dan tebakan yang salah di sini berarti
 * deploy berjalan di tempat yang salah.
 *
 * Mengembalikan `{ mode, alasan }` atau melempar bila ambigu.
 */
export async function deteksiLokasi() {
  const paksa = process.env.DEPLOY_MODE
  if (paksa !== undefined && paksa !== '') {
    if (paksa !== 'lokal' && paksa !== 'jarak-jauh') {
      throw new Error(
        `DEPLOY_MODE bernilai "${paksa}". Yang dikenal hanya "lokal" dan "jarak-jauh".`,
      )
    }
    return { mode: paksa, alasan: 'dipaksa lewat DEPLOY_MODE' }
  }

  const inang = inangDari(SERVER)
  const milikSendiri = alamatSendiri()

  let alamatTujuan = []
  if (isIP(inang) !== 0) {
    alamatTujuan = [inang]
  } else {
    try {
      const jawaban = await lookup(inang, { all: true })
      alamatTujuan = jawaban.map((satu) => satu.address)
    } catch {
      /*
       * Nama yang tidak dapat diurai bukan alasan menebak.
       *
       * Tanpa alamat tujuan, satu-satunya sinyal yang tersisa adalah tebakan —
       * dan tebakan yang salah menjalankan deploy di tempat yang salah.
       */
      throw new Error(
        `Tidak dapat mengurai alamat "${inang}", sehingga tidak dapat diketahui apakah\n` +
          '  perintah ini berjalan di server atau di komputer lain.\n\n' +
          '  Pasang DEPLOY_MODE=lokal bila dijalankan DI server, atau\n' +
          '  DEPLOY_MODE=jarak-jauh bila dijalankan dari komputer lain.',
      )
    }
  }

  const cocok = alamatTujuan.find((satu) => milikSendiri.has(satu))

  if (cocok !== undefined) {
    // Bertentangan: alamatnya milik mesin ini, tetapi aplikasinya tidak ada.
    if (!existsSync(APP_DIR)) {
      throw new Error(
        `Mesin ini memegang alamat ${cocok}, jadi ia server tujuan — tetapi\n` +
          `  ${APP_DIR} tidak ada di sini.\n\n` +
          '  Salah satu keliru: DEPLOY_DIR menunjuk tempat yang salah, atau\n' +
          '  DEPLOY_SSH menunjuk server yang salah.',
      )
    }
    return { mode: 'lokal', alasan: `mesin ini memegang alamat ${cocok}` }
  }

  /*
   * Alamatnya tidak cocok, tetapi tata letaknya persis seperti server.
   *
   * Ini satu-satunya keadaan yang benar-benar ambigu: mesin di belakang NAT
   * yang alamat luarnya berbeda dari alamat antarmukanya akan terlihat seperti
   * ini, dan begitu pula laptop yang kebetulan memakai nama pengguna dan tata
   * letak direktori yang sama. Keduanya menuntut jawaban berbeda, dan tidak ada
   * satu pun sinyal yang dapat memisahkannya.
   */
  const penggunaTujuan = penggunaDari(SERVER)
  const penggunaSekarang = os.userInfo().username
  if (existsSync(`${APP_DIR}/.git`) && penggunaTujuan !== null && penggunaSekarang === penggunaTujuan) {
    throw new Error(
      `Tidak dapat dipastikan mesin ini server atau bukan.\n\n` +
        `  Alamat ${alamatTujuan.join(', ')} tidak dimiliki mesin ini, tetapi\n` +
        `  ${APP_DIR} ada di sini dan penggunanya "${penggunaSekarang}" — persis\n` +
        '  seperti di server. Mesin di belakang NAT terlihat begini, dan begitu\n' +
        '  pula tiruan lokal.\n\n' +
        '  Pasang DEPLOY_MODE=lokal bila ini memang servernya, atau\n' +
        '  DEPLOY_MODE=jarak-jauh bila bukan.',
    )
  }

  return { mode: 'jarak-jauh', alasan: `alamat ${alamatTujuan.join(', ')} bukan milik mesin ini` }
}

/**
 * Menjalankan satu perintah shell DI server, apa pun tempat perintah ini
 * dipanggil.
 *
 * Perintahnya identik di kedua mode — yang berbeda hanya siapa yang
 * menjalankannya. `bash -lc` dipakai di mode lokal supaya `npm`, `pm2`, dan
 * `node` ditemukan lewat profil pengguna, sama seperti pada sesi SSH.
 */
export function buatPenjalan(mode) {
  if (mode === 'lokal') {
    return (perintah, opsi = {}) => spawnKumpul('bash', ['-lc', perintah], opsi)
  }
  return (perintah, opsi = {}) =>
    spawnKumpul('ssh', ['-o', 'BatchMode=yes', SERVER, perintah], opsi)
}

// ── Tampilan dan penghentian ────────────────────────────────────────────────

export const langkah = (nomor, judul) => console.log(`\n  ${nomor}. ${judul}`)

/** Berhenti dengan pesan utuh. Kegagalan yang dipotong adalah kegagalan yang diulang. */
export function berhenti(namaLangkah, hasil, saran) {
  console.error('')
  console.error(merah(`  ✕ Gagal pada: ${namaLangkah}`))
  console.error('')
  const isi = [hasil?.galat, hasil?.keluaran].filter((bagian) => bagian && bagian.trim() !== '')
  for (const bagian of isi) {
    for (const baris of String(bagian).trimEnd().split('\n')) console.error(`      ${baris}`)
  }
  if (saran !== undefined) {
    console.error('')
    for (const baris of String(saran).split('\n')) console.error(`  ${baris}`)
  }
  console.error('')
  process.exit(1)
}

/**
 * Bertanya, dan menyerah bila masukannya berakhir.
 *
 * `question()` tidak pernah selesai bila stdin tertutup lebih dulu — prosesnya
 * lalu mati dengan "unsettled top-level await" tanpa satu pun pesan yang
 * berguna. Itu terjadi setiap kali perintah ini dijalankan tanpa terminal:
 * dari skrip, dari CI, atau dari pipa.
 *
 * Masukan yang berakhir diperlakukan sebagai PENOLAKAN, bukan persetujuan.
 */
export async function tanyakan(prompt) {
  const antarmuka = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const jawaban = await Promise.race([
      antarmuka.question(prompt),
      new Promise((selesai) => antarmuka.once('close', () => selesai(null))),
    ])
    return jawaban === null ? null : jawaban.trim()
  } finally {
    antarmuka.close()
  }
}

/**
 * Menunggu proses menyatakan siap.
 *
 * Dipakai deploy maupun rollback: keduanya menyegarkan proses, dan keduanya
 * harus membuktikan hasilnya melayani sebelum menyatakan selesai.
 */
export async function verifikasiKesiapan(diServer, percobaanMaks = 10) {
  for (let percobaan = 1; percobaan <= percobaanMaks; percobaan += 1) {
    const cek = await diServer(`curl -sS -o /dev/null -w '%{http_code}' --max-time 5 ${HEALTH}`)
    const kode = cek.keluaran.trim()
    if (kode === '200') return true

    process.stdout.write(
      redup(`     percobaan ${percobaan}: ${kode === '' ? 'tidak menjawab' : kode}\n`),
    )
    await new Promise((selesai) => setTimeout(selesai, 2000))
  }
  return false
}

/** Tiga puluh baris log PM2, untuk ditempelkan saat verifikasi gagal. */
export async function cetakLogPm2(diServer) {
  const log = await diServer(`pm2 logs ${PM2_NAME} --lines 30 --nostream`)
  const isi = `${log.keluaran}${log.galat}`.trimEnd()
  for (const baris of isi.split('\n')) console.error(`      ${baris}`)
}
