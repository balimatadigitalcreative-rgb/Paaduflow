#!/usr/bin/env node
/**
 * Deploy ke VPS, satu perintah dari komputer pengembang.
 *
 * Tidak memuat satu pun kredensial. SSH memakai kunci yang sudah terpasang,
 * dan kredensial basis data tetap tinggal di server — skrip ini tidak pernah
 * mengirim, membaca, maupun mencetaknya.
 *
 * Aturan yang membentuknya:
 *
 * 1. **Berhenti di kegagalan pertama.** Deploy yang melanjutkan setelah `npm
 *    ci` gagal akan merestart proses di atas node_modules yang setengah jadi,
 *    dan gejalanya muncul jauh dari sebabnya.
 * 2. **Menolak berjalan bila kode lokal tidak sama dengan origin.** Yang
 *    ter-deploy harus dapat ditunjuk di GitHub, kalau tidak "versi berapa yang
 *    jalan di server" menjadi pertanyaan tanpa jawaban.
 * 3. **Migrasi tidak pernah berjalan diam-diam.** Ia menyebutkan apa yang akan
 *    dijalankan lebih dulu dan menunggu konfirmasi.
 * 4. **Kegagalan verifikasi membawa lognya sendiri.** Deploy yang gagal dan
 *    hanya berkata "gagal" memaksa SSH manual justru saat sedang panik.
 */

import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline/promises'

const SERVER = process.env.DEPLOY_SSH ?? 'paadu@72.61.124.95'
const APP_DIR = process.env.DEPLOY_DIR ?? '/home/paadu/app'
const BRANCH = process.env.DEPLOY_BRANCH ?? 'main'
const PM2_NAME = process.env.DEPLOY_PM2 ?? 'paadu-api'
const HEALTH = process.env.DEPLOY_HEALTH ?? 'http://127.0.0.1:3000/healthz'

/**
 * Berkas berisi MIGRATION_DATABASE_URL, di LUAR direktori aplikasi.
 *
 * Sengaja bukan `app/.env`: berkas itu dimuat proses runtime, dan kredensial
 * pemilik basis data tidak boleh berada di lingkungan proses yang melayani
 * permintaan (D-141).
 */
const MIGRATION_ENV = process.env.DEPLOY_MIGRATION_ENV ?? '/home/paadu/.env.deploy'

const WARNA = process.stdout.isTTY === true
const merah = (teks) => (WARNA ? `[31m${teks}[0m` : teks)
const hijau = (teks) => (WARNA ? `[32m${teks}[0m` : teks)
const redup = (teks) => (WARNA ? `[2m${teks}[0m` : teks)

/** Menjalankan perintah dan mengumpulkan keluarannya. Tidak pernah melempar. */
function jalankan(perintah, argumen, opsi = {}) {
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

const ssh = (perintah, opsi = {}) =>
  jalankan('ssh', ['-o', 'BatchMode=yes', SERVER, perintah], opsi)

const lokal = (argumen) => jalankan('git', argumen)

/** Berhenti dengan pesan utuh. Kegagalan yang dipotong adalah kegagalan yang diulang. */
function berhenti(langkah, hasil, saran) {
  console.error('')
  console.error(merah(`  ✕ Gagal pada: ${langkah}`))
  console.error('')
  const isi = [hasil?.galat, hasil?.keluaran].filter((bagian) => bagian && bagian.trim() !== '')
  for (const bagian of isi) {
    for (const baris of String(bagian).trimEnd().split('\n')) console.error(`      ${baris}`)
  }
  if (saran !== undefined) {
    console.error('')
    console.error(`  ${saran}`)
  }
  console.error('')
  process.exit(1)
}

const langkah = (nomor, judul) => console.log(`\n  ${nomor}. ${judul}`)

// ── Pemeriksaan lokal ──────────────────────────────────────────────────────
//
// Seluruhnya sebelum menyentuh server. Deploy yang ditolak setelah setengah
// berjalan lebih buruk daripada deploy yang tidak pernah dimulai.

console.log(`\n  Deploy ke ${SERVER}:${APP_DIR} (branch ${BRANCH})`)

langkah(0, 'Memeriksa kode lokal')

const kotor = await lokal(['status', '--porcelain'])
if (kotor.kode !== 0) berhenti('git status', kotor)
if (kotor.keluaran.trim() !== '') {
  berhenti(
    'pemeriksaan kode lokal',
    { galat: `Ada perubahan yang belum di-commit:\n${kotor.keluaran.trimEnd()}` },
    'Commit atau simpan perubahannya dulu. Yang ter-deploy harus dapat ditunjuk di GitHub.',
  )
}

const cabang = (await lokal(['branch', '--show-current'])).keluaran.trim()
if (cabang !== BRANCH) {
  berhenti(
    'pemeriksaan kode lokal',
    { galat: `Branch lokal "${cabang}", sedangkan yang di-deploy "${BRANCH}".` },
    `Pindah ke ${BRANCH} lebih dulu, atau pasang DEPLOY_BRANCH bila memang disengaja.`,
  )
}

const ambil = await lokal(['fetch', 'origin', BRANCH])
if (ambil.kode !== 0) berhenti('git fetch', ambil)

const tertinggal = (await lokal(['rev-list', '--count', `${BRANCH}..origin/${BRANCH}`])).keluaran.trim()
const mendahului = (await lokal(['rev-list', '--count', `origin/${BRANCH}..${BRANCH}`])).keluaran.trim()

if (tertinggal !== '0') {
  berhenti(
    'pemeriksaan kode lokal',
    { galat: `Branch lokal tertinggal ${tertinggal} commit dari origin/${BRANCH}.` },
    'Jalankan `git pull` dulu. Server akan menarik dari origin, bukan dari komputer ini.',
  )
}
if (mendahului !== '0') {
  berhenti(
    'pemeriksaan kode lokal',
    { galat: `Ada ${mendahului} commit lokal yang belum di-push ke origin/${BRANCH}.` },
    'Jalankan `git push` dulu, kalau tidak server akan men-deploy kode yang lebih lama.',
  )
}

const komit = (await lokal(['rev-parse', '--short', BRANCH])).keluaran.trim()
console.log(hijau(`     bersih, sejajar dengan origin/${BRANCH} pada ${komit}`))

// ── Prasyarat di server ────────────────────────────────────────────────────
//
// Seluruhnya diperiksa dalam SATU sambungan SSH, sebelum menyentuh apa pun.
// Gagal di detik pertama dengan daftar lengkap lebih baik daripada gagal di
// langkah 4 setelah `git pull` — dan lebih baik daripada memperbaiki satu
// syarat, mengulang, lalu menemukan syarat berikutnya.

langkah('0b', 'Memeriksa prasyarat server')

const laporan = await ssh(
  [
    `test -d ${APP_DIR}/.git && echo dir:ok || echo dir:kurang`,
    `test -f ${APP_DIR}/.env && echo env:ok || echo env:kurang`,
    `test -f ${MIGRATION_ENV} && echo envdeploy:ok || echo envdeploy:kurang`,
    `grep -qE '^MIGRATION_DATABASE_URL=.+' ${MIGRATION_ENV} 2>/dev/null && echo migurl:ok || echo migurl:kurang`,
    `command -v pm2 >/dev/null && echo pm2:ok || echo pm2:kurang`,
    `command -v curl >/dev/null && echo curl:ok || echo curl:kurang`,
    `pm2 describe ${PM2_NAME} >/dev/null 2>&1 && echo proses:ok || echo proses:kurang`,
  ].join('; '),
)

if (laporan.kode !== 0 && laporan.keluaran.trim() === '') {
  berhenti(
    'menyambung ke server',
    laporan,
    `Pastikan \`ssh ${SERVER}\` berhasil dari komputer ini tanpa menanyakan kata sandi.`,
  )
}

const hasilPeriksa = new Map(
  laporan.keluaran
    .trim()
    .split('\n')
    .map((baris) => baris.trim().split(':'))
    .filter((bagian) => bagian.length === 2)
    .map(([kunci, nilai]) => [kunci, nilai]),
)

const kurang = []
const perlu = (kunci, judul, perbaikan) => {
  if (hasilPeriksa.get(kunci) !== 'ok') kurang.push({ judul, perbaikan })
}

perlu('dir', `${APP_DIR} bukan repositori git`, [
  `git clone <repo> ${APP_DIR}`,
  `cd ${APP_DIR} && git checkout ${BRANCH}`,
])
perlu('env', `${APP_DIR}/.env tidak ada — kredensial RUNTIME`, [
  `cp ${APP_DIR}/.env.example ${APP_DIR}/.env`,
  '',
  '  lalu isi minimal empat baris ini:',
  '      DATABASE_URL=postgresql://paadu_app:...@localhost:5432/paadu',
  '      PORT=3000',
  '      TOKEN_SIGNING_SECRET=<acak, minimal 32 karakter>',
  '      MFA_ENCRYPTION_KEY=<32 bait base64>',
])
perlu('envdeploy', `${MIGRATION_ENV} tidak ada — kredensial MIGRASI`, [
  `cat > ${MIGRATION_ENV} <<'ENV'`,
  'MIGRATION_DATABASE_URL=postgresql://paadu_owner:...@localhost:5432/paadu',
  'ENV',
  `chmod 600 ${MIGRATION_ENV}`,
  '',
  '  Sengaja di LUAR direktori aplikasi: berkas .env di dalamnya dimuat',
  '  proses runtime, dan kredensial pemilik basis data tidak boleh berada',
  '  di lingkungan proses yang melayani permintaan (D-141).',
])
perlu('migurl', `${MIGRATION_ENV} ada tetapi tidak memuat MIGRATION_DATABASE_URL`, [
  `echo 'MIGRATION_DATABASE_URL=postgresql://paadu_owner:...@localhost:5432/paadu' >> ${MIGRATION_ENV}`,
])
perlu('pm2', 'pm2 tidak terpasang', ['npm install -g pm2', 'pm2 startup   # agar hidup lagi setelah reboot'])
perlu('curl', 'curl tidak terpasang — dipakai verifikasi kesehatan', [
  'sudo apt-get install -y curl',
])
perlu('proses', `PM2 belum punya proses bernama "${PM2_NAME}"`, [
  `cd ${APP_DIR} && npm ci --include=dev && npm run build`,
  `PAADU_DIR=${APP_DIR} pm2 start ecosystem.config.cjs`,
  'pm2 save',
  '',
  `  Bila proses lama masih bernama lain, hapus dulu: pm2 delete <nama-lama>`,
  `  Atau pakai nama yang sudah ada: DEPLOY_PM2=<nama> npm run deploy`,
])

if (kurang.length > 0) {
  console.error('')
  console.error(merah(`  ✕ Server belum siap — ${kurang.length} prasyarat belum terpenuhi.`))
  console.error(redup('     Belum ada satu pun perubahan di server.'))
  for (const { judul, perbaikan } of kurang) {
    console.error('')
    console.error(`  • ${judul}`)
    console.error('')
    for (const baris of perbaikan) {
      console.error(baris === '' ? '' : `      ${baris}`)
    }
  }
  console.error('')
  console.error(`  Seluruhnya dijalankan di server: ssh ${SERVER}`)
  console.error('')
  process.exit(1)
}

console.log(hijau('     berkas .env, kredensial migrasi, pm2, dan proses siap'))

// ── Di server ──────────────────────────────────────────────────────────────

langkah(1, 'git pull')
const tarik = await ssh(`cd ${APP_DIR} && git fetch origin ${BRANCH} && git reset --hard origin/${BRANCH}`, {
  tampilkan: true,
})
if (tarik.kode !== 0) berhenti('git pull di server', tarik)

langkah(2, 'npm ci --include=dev')
const pasang = await ssh(`cd ${APP_DIR} && npm ci --include=dev`, { tampilkan: true })
if (pasang.kode !== 0) berhenti('npm ci', pasang)

langkah(3, 'npm run build:web')
const bangun = await ssh(`cd ${APP_DIR} && npm run build:web`, { tampilkan: true })
if (bangun.kode !== 0) berhenti('npm run build:web', bangun)

langkah(4, 'Memeriksa migrasi tertunda')
const tertunda = await ssh(
  `cd ${APP_DIR} && set -a && . ${MIGRATION_ENV} && set +a && node tools/db/pending-migrations.js`,
)
if (tertunda.kode !== 0) {
  berhenti(
    'pemeriksaan migrasi',
    tertunda,
    `Pastikan ${MIGRATION_ENV} ada di server dan memuat MIGRATION_DATABASE_URL.`,
  )
}

const daftar = tertunda.keluaran.trim().split('\n').filter((baris) => baris.trim() !== '')

if (daftar.length === 0) {
  console.log(redup('     tidak ada migrasi baru — dilewati'))
} else {
  console.log('')
  console.log(`     ${daftar.length} migrasi akan dijalankan:`)
  for (const nama of daftar) console.log(`         ${nama}`)
  console.log('')

  const tanya = createInterface({ input: process.stdin, output: process.stdout })
  const jawab = (await tanya.question('     Jalankan migrasi ini? (ketik "ya") ')).trim()
  tanya.close()

  if (jawab !== 'ya') {
    console.error('')
    console.error(merah('  ✕ Dibatalkan sebelum migrasi. Server belum di-restart.'))
    console.error('')
    process.exit(1)
  }

  const migrasi = await ssh(
    `cd ${APP_DIR} && set -a && . ${MIGRATION_ENV} && set +a && npm run migrate`,
    { tampilkan: true },
  )
  if (migrasi.kode !== 0) {
    berhenti(
      'npm run migrate',
      migrasi,
      'Server BELUM di-restart, sehingga kode lama masih melayani. Perbaiki lalu ulangi.',
    )
  }
}

langkah(5, `pm2 restart ${PM2_NAME}`)
const restart = await ssh(`pm2 restart ${PM2_NAME} --update-env`, { tampilkan: true })
if (restart.kode !== 0) berhenti('pm2 restart', restart)

langkah(6, 'Verifikasi kesehatan')

/** Beberapa kali, karena proses butuh sesaat untuk mendengarkan. */
let sehat = null
for (let percobaan = 1; percobaan <= 10; percobaan += 1) {
  const cek = await ssh(`curl -sS -o /dev/null -w '%{http_code}' --max-time 5 ${HEALTH}`)
  const kode = cek.keluaran.trim()
  if (kode === '200') {
    sehat = kode
    break
  }
  process.stdout.write(redup(`     percobaan ${percobaan}: ${kode === '' ? 'tidak menjawab' : kode}\n`))
  await new Promise((selesai) => setTimeout(selesai, 2000))
}

if (sehat === null) {
  console.error('')
  console.error(merah('  ✕ Gagal pada: verifikasi kesehatan'))
  console.error(`      ${HEALTH} tidak menjawab 200 setelah 10 percobaan.`)
  console.error('')
  console.error('  30 baris terakhir log PM2:')
  console.error('')

  const log = await ssh(`pm2 logs ${PM2_NAME} --lines 30 --nostream`)
  const isi = `${log.keluaran}${log.galat}`.trimEnd()
  for (const baris of isi.split('\n')) console.error(`      ${baris}`)

  console.error('')
  console.error('  Proses mungkin masih melayani versi lama. Periksa log di atas sebelum mengulang.')
  console.error('')
  process.exit(1)
}

const terpasang = (await ssh(`cd ${APP_DIR} && git rev-parse --short HEAD`)).keluaran.trim()

console.log('')
console.log(hijau(`  ✓ Deploy selesai — ${terpasang} melayani di ${SERVER}`))
console.log(redup(`     kesehatan 200, ${daftar.length} migrasi dijalankan`))
console.log('')
