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

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  APP_DIR,
  HEALTH,
  BACKUP_DIR,
  BACKUP_SIMPAN_HARI,
  BRANCH,
  MIGRATION_ENV,
  PM2_NAME,
  RILIS_DIR,
  RILIS_DISIMPAN,
  SERVER,
  berhenti,
  buatPenjalan,
  cetakLogPm2,
  deteksiLokasi,
  git,
  hijau,
  langkah,
  merah,
  redup,
  tanyakan,
  verifikasiKesiapan,
} from './lingkungan.js'

// ── Di mana perintah ini berjalan ──────────────────────────────────────────
//
// Ditentukan lebih dulu, sebelum apa pun. Seluruh langkah sesudahnya memakai
// `diServer()` dan tidak perlu tahu jawabannya.

let lokasi
try {
  lokasi = await deteksiLokasi()
} catch (kesalahan) {
  console.error('')
  console.error(merah('  x Tidak dapat menentukan tempat perintah ini berjalan.'))
  console.error('')
  for (const baris of String(kesalahan.message).split('\n')) console.error(`  ${baris}`)
  console.error('')
  process.exit(1)
}

const diServer = buatPenjalan(lokasi.mode)
const diSini = lokasi.mode === 'lokal'


// ── Pemeriksaan lokal ──────────────────────────────────────────────────────
//
// Seluruhnya sebelum menyentuh server. Deploy yang ditolak setelah setengah
// berjalan lebih buruk daripada deploy yang tidak pernah dimulai.

console.log(`\n  Deploy ke ${SERVER}:${APP_DIR} (branch ${BRANCH})`)
console.log(
  redup(`  Dijalankan ${diSini ? 'DI SERVER' : 'dari komputer ini lewat SSH'} - ${lokasi.alasan}`),
)

/*
 * Pemeriksaan kode lokal hanya bermakna dari komputer pengembang.
 *
 * Di sana ada DUA salinan repo - milik pengembang dan milik server - dan
 * langkah ini menjawab satu pertanyaan: apakah yang akan di-deploy sudah
 * di-push. Dijalankan DI server, kedua salinan itu satu dan sama, dan langkah 1
 * akan menimpanya dengan origin beberapa detik kemudian. Memeriksanya di sana
 * hanya menanyakan hal yang sudah pasti.
 *
 * Yang tetap diperiksa di KEDUA mode: apakah ada suntingan yang belum
 * di-commit di direktori aplikasi server. Itu bagian dari gerbang prasyarat,
 * karena `git reset --hard` akan membuangnya tanpa bertanya.
 */
if (diSini) {
  langkah(0, 'Memeriksa kode lokal')
  console.log(redup('     dilewati - di server, repo ini SENDIRI yang akan ditimpa origin'))
} else {

langkah(0, 'Memeriksa kode lokal')

const kotor = await git(['status', '--porcelain'])
if (kotor.kode !== 0) berhenti('git status', kotor)
if (kotor.keluaran.trim() !== '') {
  berhenti(
    'pemeriksaan kode lokal',
    { galat: `Ada perubahan yang belum di-commit:\n${kotor.keluaran.trimEnd()}` },
    'Commit atau simpan perubahannya dulu. Yang ter-deploy harus dapat ditunjuk di GitHub.',
  )
}

const cabang = (await git(['branch', '--show-current'])).keluaran.trim()
if (cabang !== BRANCH) {
  berhenti(
    'pemeriksaan kode lokal',
    { galat: `Branch lokal "${cabang}", sedangkan yang di-deploy "${BRANCH}".` },
    `Pindah ke ${BRANCH} lebih dulu, atau pasang DEPLOY_BRANCH bila memang disengaja.`,
  )
}

const ambil = await git(['fetch', 'origin', BRANCH])
if (ambil.kode !== 0) berhenti('git fetch', ambil)

const tertinggal = (await git(['rev-list', '--count', `${BRANCH}..origin/${BRANCH}`])).keluaran.trim()
const mendahului = (await git(['rev-list', '--count', `origin/${BRANCH}..${BRANCH}`])).keluaran.trim()

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

const komit = (await git(['rev-parse', '--short', BRANCH])).keluaran.trim()
console.log(hijau(`     bersih, sejajar dengan origin/${BRANCH} pada ${komit}`))

}

// ── Prasyarat di server ────────────────────────────────────────────────────
//
// Seluruhnya diperiksa dalam SATU sambungan SSH, sebelum menyentuh apa pun.
// Gagal di detik pertama dengan daftar lengkap lebih baik daripada gagal di
// langkah 4 setelah `git pull` — dan lebih baik daripada memperbaiki satu
// syarat, mengulang, lalu menemukan syarat berikutnya.

langkah('0b', 'Memeriksa prasyarat server')

const laporan = await diServer(
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

/**
 * Sidik jari skrip deploy itu sendiri.
 *
 * Hanya berarti di mode lokal, dan di sana ia menutup jebakan yang halus:
 * langkah 1 menimpa direktori aplikasi dengan origin — TERMASUK berkas skrip
 * yang sedang berjalan ini. Node sudah memuatnya ke memori, jadi ia melanjutkan
 * dengan versi LAMA sementara repo sudah berisi versi baru.
 *
 * Akibatnya deploy berjalan dengan urutan langkah versi lama atas kode versi
 * baru, dan tidak ada satu pun tanda di layar bahwa itu terjadi.
 */
function sidikSkrip() {
  const berkas = ['deploy.js', 'lingkungan.js'].map((nama) =>
    fileURLToPath(new URL(nama, import.meta.url)),
  )
  const isi = berkas.map((satu) => readFileSync(satu, 'utf8')).join('\n')
  return createHash('sha256').update(isi).digest('hex').slice(0, 12)
}

const sidikSebelum = diSini ? sidikSkrip() : null

/*
 * Sha yang sedang melayani, dibaca SEBELUM tarikan menimpanya.
 *
 * Dipakai mengarsipkan rilis yang sedang KELUAR. Tanpa langkah itu, rollback
 * baru tersedia setelah deploy KEDUA — dan deploy pertama justru salah satu
 * saat yang paling mungkin memerlukannya.
 */
const shaKeluar = (await diServer(`cd ${APP_DIR} && git rev-parse --short HEAD`)).keluaran.trim()

langkah(1, 'git pull')
/*
 * `checkout` sebelum `reset`, dan itu bukan kelebihan langkah.
 *
 * Sesudah rollback, HEAD di server TERLEPAS. `git reset --hard` pada HEAD
 * terlepas memindahkan HEAD itu sendiri dan membiarkannya tetap terlepas —
 * commit-nya benar, tetapi server tidak pernah kembali ke branch.
 *
 * Ini terlihat hanya saat diperiksa sesudah rollback sungguhan; deploy
 * melaporkan sha yang benar dan tampak sepenuhnya berhasil.
 */
const tarik = await diServer(
  `cd ${APP_DIR} && git fetch origin ${BRANCH} && git checkout ${BRANCH} && git reset --hard origin/${BRANCH}`,
  {
    tampilkan: true,
  },
)
if (tarik.kode !== 0) berhenti('git pull di server', tarik)

if (diSini && sidikSkrip() !== sidikSebelum) {
  console.error('')
  console.error(merah('  ! Skrip deploy ikut berubah pada tarikan barusan.'))
  console.error('')
  console.error('  Proses ini masih menjalankan versi LAMA dari memori. Melanjutkan berarti')
  console.error('  menjalankan urutan langkah lama atas kode baru, tanpa satu pun tanda di')
  console.error('  layar bahwa itu terjadi.')
  console.error('')
  console.error('  Kode sumber sudah diperbarui; belum ada yang dibangun atau disegarkan,')
  console.error('  dan proses lama masih melayani. Jalankan ulang perintah yang sama:')
  console.error('')
  console.error('      npm run deploy')
  console.error('')
  process.exit(1)
}

/*
 * Hasil build yang sedang melayani diarsipkan SEBELUM ditimpa.
 *
 * Sumbernya sudah berpindah ke commit baru pada langkah 1, tetapi `dist/` di
 * disk masih hasil build lama — itulah yang disalin. Dilewati bila sudah
 * terarsip pada deploy sebelumnya.
 */
if (shaKeluar !== '') {
  const arsipKeluar = await diServer(
    [
      `test ! -d ${RILIS_DIR}/${shaKeluar}/dist`,
      `test -d ${APP_DIR}/dist`,
      `mkdir -p ${RILIS_DIR}/${shaKeluar}`,
      `cp -a ${APP_DIR}/dist ${RILIS_DIR}/${shaKeluar}/dist`,
      `sha256sum ${APP_DIR}/package-lock.json | cut -c1-16 > ${RILIS_DIR}/${shaKeluar}/lock.txt`,
      `date -u +%Y-%m-%dT%H:%M:%SZ > ${RILIS_DIR}/${shaKeluar}/waktu.txt`,
      `echo "${shaKeluar} $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> ${RILIS_DIR}/riwayat.txt`,
    ].join(' && '),
  )
  if (arsipKeluar.kode === 0) {
    console.log(redup(`     rilis yang sedang melayani (${shaKeluar}) ikut diarsipkan`))
  }
}

langkah(2, 'npm ci --include=dev')
const pasang = await diServer(`cd ${APP_DIR} && npm ci --include=dev`, { tampilkan: true })
if (pasang.kode !== 0) berhenti('npm ci', pasang)

/*
 * `npm run build`, bukan `build:web`.
 *
 * Sampai 20 Agustus 2026 langkah ini hanya membangun frontend, sehingga
 * `dist/server/main.js` di server tertinggal dari commit yang baru ditarik.
 * Deploy berakhir hijau — kesehatan 200 — sementara yang melayani adalah
 * bundel lama. Setiap perubahan backend hilang tanpa suara.
 *
 * Verifikasi kesehatan tidak menangkapnya, dan tidak bisa: ia membuktikan ada
 * yang menjawab, bukan bahwa yang menjawab adalah commit ini.
 */
langkah(3, 'Build (web ke samping, lalu ditukar)')

/*
 * Antarmuka dibangun ke DIREKTORI LAIN, lalu ditukar. Bukan langsung ke
 * tempatnya.
 *
 * `emptyOutDir: true` di vite.config.ts membuat Vite MENGOSONGKAN `dist/web`
 * sebelum menulis isinya yang baru. Proses lama masih menyajikan direktori itu
 * selama enam detik berikutnya, sehingga setiap pemuatan halaman di jendela itu
 * menjawab 404 — index.html memang sedang tidak ada.
 *
 * Ini terukur, bukan dugaan: pemantauan pertama mencatat 404 pada `/` dan
 * `/readyz` tepat pada detik build berjalan, sementara `/healthz` — yang tidak
 * menyentuh berkas — tetap 200. Mode cluster tidak menutup celah ini sama
 * sekali; ia terjadi jauh sebelum proses mana pun disegarkan.
 *
 * Penukarannya dua `mv` berurutan. Jendela di antara keduanya adalah satu
 * operasi rename pada filesystem yang sama — mikrodetik, bukan detik.
 *
 * `dist/server` tidak perlu diperlakukan begini: proses lama sudah memuat
 * bundelnya ke memori, jadi menulis ulang berkasnya tidak mempengaruhi apa yang
 * sedang berjalan.
 */
const bangun = await diServer(
  [
    `cd ${APP_DIR}`,
    `rm -rf dist/web-baru dist/web-lama`,
    /*
     * `tokens:build` dipanggil EKSPLISIT.
     *
     * Ia biasanya menyala sendiri sebagai `prebuild:web`, tetapi kait
     * `pre<skrip>` npm hanya berjalan lewat `npm run build:web`. Langkah ini
     * memanggil `npx vite build` langsung — demi `--outDir` — sehingga kaitnya
     * dilewati tanpa satu pun tanda.
     *
     * Akibatnya `src/styles/tokens.css` di server tertinggal pada versi deploy
     * sebelumnya. Token BARU tidak pernah sampai: variabelnya dipakai komponen,
     * deklarasinya tidak ada, dan `var(--token)` yang tidak terdefinisi tidak
     * melempar apa pun — ia hanya diam.
     *
     * Ditemukan saat `--size-chart-bar` tidak muncul di CSS produksi meskipun
     * deploy berakhir hijau. Ini bentuk lain dari D-145.
     */
    `npm run tokens:build`,
    /*
     * `PAADU_SHA` menyuntikkan sha commit ke dalam build.
     *
     * Dari satu nilai ini `vite.config.ts` menulis dua hal: konstanta
     * `__VERSI_APLIKASI__` di dalam bundel, dan `versi.json` di direktori
     * hasil. Yang pertama membuat tab dapat mengatakan bundel mana yang
     * sedang ia jalankan; yang kedua membuat server dapat mengatakan bundel
     * mana yang sedang ia sajikan. Pemberitahuan "ada versi baru" adalah
     * selisih keduanya.
     *
     * Dibaca di sini, bukan di dalam Vite lewat `git rev-parse`: build
     * berjalan di direktori aplikasi yang memang repo git, tetapi menaruh
     * pemanggilan git di dalam konfigurasi build membuat build gagal di
     * tempat yang tidak punya git — dan CI adalah tempat seperti itu.
     */
    `PAADU_SHA=$(git rev-parse --short HEAD) npx vite build --outDir ${APP_DIR}/dist/web-baru --emptyOutDir`,
    `npm run build:server`,
    /*
     * Token yang dipakai tanpa deklarasi diperiksa DI SINI, atas hasil build
     * di server — bukan di CI. Di kode sumber semuanya selalu benar; yang
     * tertinggal adalah berkas bangkitan, dan hanya server yang tahu itu.
     */
    `node tools/audit/token-terdeklarasi.js ${APP_DIR}/dist/web-baru`,
    `if [ -d dist/web ]; then mv dist/web dist/web-lama; fi`,
    `mv dist/web-baru dist/web`,
    `rm -rf dist/web-lama`,
  ].join(' && '),
  { tampilkan: true },
)
if (bangun.kode !== 0) berhenti('build', bangun)

/*
 * ═════════════════════════════════════════════════════════════════════════
 *   HASIL BUILD DIARSIPKAN, BUKAN DITIMPA
 *
 *   Tanpa ini, rollback berarti membangun ulang commit lama — yang menuntut
 *   node_modules yang cocok, memakan waktu build penuh, dan dapat gagal
 *   justru pada saat semuanya sedang salah.
 *
 *   Dengan arsip, rollback hanya menukar direktori dan menyegarkan proses.
 *   Satu rilis 1,1 MB; lima rilis tidak terasa di disk mana pun.
 *
 *   Sidik `package-lock.json` ikut dicatat. Rollback melewati commit yang
 *   mengubah dependensi menuntut `npm ci` ulang — tanpa catatan ini, tidak
 *   ada cara mengetahuinya selain menjalankan `npm ci` setiap kali.
 * ═════════════════════════════════════════════════════════════════════════
 */
langkah('3b', 'Mengarsipkan rilis')

const shaBaru = (await diServer(`cd ${APP_DIR} && git rev-parse --short HEAD`)).keluaran.trim()

const arsip = await diServer(
  [
    `mkdir -p ${RILIS_DIR}/${shaBaru}`,
    `rm -rf ${RILIS_DIR}/${shaBaru}/dist`,
    `cp -a ${APP_DIR}/dist ${RILIS_DIR}/${shaBaru}/dist`,
    `sha256sum ${APP_DIR}/package-lock.json | cut -c1-16 > ${RILIS_DIR}/${shaBaru}/lock.txt`,
    `date -u +%Y-%m-%dT%H:%M:%SZ > ${RILIS_DIR}/${shaBaru}/waktu.txt`,
    // Riwayat ditambah di AKHIR: yang paling bawah adalah yang paling baru.
    `echo "${shaBaru} $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> ${RILIS_DIR}/riwayat.txt`,
    `du -sh ${RILIS_DIR}/${shaBaru} | cut -f1`,
  ].join(' && '),
)

if (arsip.kode !== 0) {
  /*
   * Arsip gagal TIDAK menghentikan deploy.
   *
   * Yang hilang hanya kemampuan rollback cepat ke rilis ini — bukan
   * kemampuan melayani. Menghentikan deploy karena arsipnya gagal berarti
   * menahan perbaikan yang mungkin justru sedang mendesak.
   */
  console.log(merah('     gagal mengarsipkan; rollback ke rilis ini tidak akan tersedia'))
  for (const baris of `${arsip.galat}${arsip.keluaran}`.trimEnd().split('\n')) {
    console.log(redup(`     ${baris}`))
  }
} else {
  const ukuranArsip = arsip.keluaran.trim().split('\n').pop()
  console.log(hijau(`     ${RILIS_DIR}/${shaBaru}  (${ukuranArsip})`))

  // Rilis lama dibuang di sini, bukan lewat cron: yang membuatnya adalah
  // deploy, jadi yang membersihkannya juga deploy.
  const pangkas = await diServer(
    [
      `cd ${RILIS_DIR}`,
      `ls -1dt */ 2>/dev/null | tail -n +${RILIS_DISIMPAN + 1} | xargs -r rm -rf`,
      `tail -n ${RILIS_DISIMPAN * 2} riwayat.txt > riwayat.tmp && mv riwayat.tmp riwayat.txt`,
    ].join(' && '),
  )
  if (pangkas.kode === 0) {
    console.log(redup(`     ${RILIS_DISIMPAN} rilis terakhir disimpan`))
  }
}

langkah(4, 'Memeriksa migrasi tertunda')
const tertunda = await diServer(
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

  const jawab = await tanyakan('     Jalankan migrasi ini? (ketik "ya") ')

  if (jawab !== 'ya') {
    console.error('')
    console.error(merah('  ✕ Dibatalkan sebelum migrasi. Server belum di-restart.'))
    console.error('')
    process.exit(1)
  }

  /*
   * ═══════════════════════════════════════════════════════════════════════
   *   CADANGAN, TEPAT SEBELUM MIGRASI
   *
   *   Bukan cadangan harian, dan bukan cadangan sebelum deploy. Tepat sebelum
   *   MIGRASI — karena migrasi adalah satu-satunya langkah deploy yang dapat
   *   mengubah data, dan satu-satunya yang tidak dapat dibatalkan dengan
   *   menyalakan kembali versi lama.
   *
   *   Titik pulihnya karena itu berumur detik, bukan jam.
   *
   *   `-Fc` (format custom): terkompresi, dan `pg_restore` dapat memulihkan
   *   satu tabel saja darinya. Cadangan SQL polos memaksa memulihkan
   *   semuanya atau tidak sama sekali.
   * ═══════════════════════════════════════════════════════════════════════
   */
  langkah('4b', 'Cadangan pra-migrasi')

  const cap = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const berkasCadangan = `${BACKUP_DIR}/pramigrasi-${cap}.dump`

  const cadangan = await diServer(
    [
      `mkdir -p ${BACKUP_DIR}`,
      `set -a && . ${MIGRATION_ENV} && set +a`,
      // `--no-owner` supaya dapat dipulihkan ke basis data mana pun saat
      // menyelidiki, bukan hanya ke yang pemiliknya persis sama.
      `pg_dump "$MIGRATION_DATABASE_URL" -Fc --no-owner -f ${berkasCadangan}`,
      `ls -l ${berkasCadangan} | awk '{print $5}'`,
    ].join(' && '),
  )

  if (cadangan.kode !== 0) {
    /*
     * Cadangan gagal berarti migrasi TIDAK berjalan.
     *
     * Melanjutkan tanpa titik pulih persis membuang gunanya langkah ini —
     * dan yang paling mungkin membuat pg_dump gagal (disk penuh, kredensial
     * salah) juga akan membuat migrasinya bermasalah.
     */
    berhenti(
      'cadangan pra-migrasi',
      cadangan,
      `Migrasi TIDAK dijalankan; basis data belum tersentuh.\n` +
        `      Periksa ruang disk dan izin tulis di ${BACKUP_DIR}.`,
    )
  }

  const bait = Number(cadangan.keluaran.trim().split('\n').pop())
  const ukuran = Number.isFinite(bait)
    ? `${(bait / 1024 / 1024).toFixed(1)} MB`
    : 'ukuran tidak terbaca'

  console.log(hijau(`     ✓ ${berkasCadangan}`))
  console.log(redup(`       ${ukuran}`))
  console.log(
    redup(`       Pulihkan: pg_restore -d "$MIGRATION_DATABASE_URL" --clean ${berkasCadangan}`),
  )

  // Cadangan lama dibuang di sini, bukan lewat cron: yang membuatnya adalah
  // deploy, jadi yang membersihkannya juga deploy. Cron terpisah adalah hal
  // lain yang dapat mati tanpa ada yang menyadarinya.
  await diServer(
    `find ${BACKUP_DIR} -name 'pramigrasi-*.dump' -mtime +${BACKUP_SIMPAN_HARI} -delete 2>/dev/null || true`,
  )

  langkah('4c', 'Menjalankan migrasi')

  const migrasi = await diServer(
    `cd ${APP_DIR} && set -a && . ${MIGRATION_ENV} && set +a && npm run migrate`,
    { tampilkan: true },
  )
  if (migrasi.kode !== 0) {
    berhenti(
      'npm run migrate',
      migrasi,
      'Server BELUM di-restart, sehingga kode lama masih melayani.\n' +
        `      Titik pulih: ${berkasCadangan}\n` +
        `      Pulihkan   : pg_restore -d "$MIGRATION_DATABASE_URL" --clean ${berkasCadangan}`,
    )
  }
}

langkah(5, 'Menyegarkan proses')

/*
 * `reload`, bukan `restart` — tetapi hanya bila prosesnya SUDAH cluster.
 *
 * `pm2 reload` mengganti instance satu per satu, sehingga selalu ada yang
 * melayani. Yang tidak dapat dilakukannya adalah mengubah `exec_mode`: proses
 * yang berjalan dalam mode fork akan tetap fork setelah reload, tanpa satu pun
 * peringatan, dan seluruh niat rolling restart lenyap diam-diam.
 *
 * Karena itu modenya diperiksa lebih dulu. Perpindahan fork → cluster menuntut
 * `delete` lalu `start`, dan itu SATU-SATUNYA penyegaran yang memutus layanan
 * sesaat. Disebut keras di layar supaya tidak mengejutkan siapa pun.
 */
const rupa = await diServer(
  `pm2 jlist 2>/dev/null | node -e "` +
    `let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{` +
    `try{const a=JSON.parse(d).find(x=>x.name==='${PM2_NAME}');` +
    `console.log(a?a.pm2_env.exec_mode:'tidak-ada')}catch{console.log('tidak-terbaca')}})"`,
)
const modeSekarang = rupa.keluaran.trim()

if (modeSekarang === 'cluster_mode') {
  console.log(redup(`     mode cluster terdeteksi — pm2 reload (satu per satu)`))
  const reload = await diServer(`pm2 reload ${PM2_NAME} --update-env`, { tampilkan: true })
  if (reload.kode !== 0) berhenti('pm2 reload', reload)
} else {
  console.log('')
  console.log(
    merah(`     Proses berjalan dalam mode "${modeSekarang}", bukan cluster.`),
  )
  console.log('     Perpindahan mode menuntut delete lalu start, dan itu MEMUTUS')
  console.log('     layanan beberapa detik. Ini terjadi sekali; deploy berikutnya')
  console.log('     memakai reload dan tidak memutus apa pun.')
  console.log('')

  const pindah = await diServer(
    `cd ${APP_DIR} && pm2 delete ${PM2_NAME} 2>/dev/null; ` +
      `PAADU_DIR=${APP_DIR} pm2 start ecosystem.config.cjs && pm2 save`,
    { tampilkan: true },
  )
  if (pindah.kode !== 0) berhenti('pm2 start (pindah ke cluster)', pindah)
}

langkah(6, 'Verifikasi kesiapan')

if (!(await verifikasiKesiapan(diServer))) {
  console.error('')
  console.error(merah('  x Gagal pada: verifikasi kesiapan'))
  console.error(`      ${HEALTH} tidak menjawab 200 setelah 10 percobaan.`)
  console.error('')
  console.error('  30 baris terakhir log PM2:')
  console.error('')
  await cetakLogPm2(diServer)
  console.error('')
  console.error('  Proses mungkin masih melayani versi lama. Periksa log di atas sebelum mengulang.')
  console.error(`  Untuk kembali ke rilis sebelumnya: npm run rollback`)
  console.error('')
  process.exit(1)
}

const terpasang = (await diServer(`cd ${APP_DIR} && git rev-parse --short HEAD`)).keluaran.trim()

/*
 * ═══════════════════════════════════════════════════════════════════════════
 *   YANG MELAYANI ADALAH COMMIT INI — DIBUKTIKAN, BUKAN DIANGGAP
 *
 *   Verifikasi kesiapan membuktikan ADA yang menjawab. Ia tidak membuktikan
 *   bahwa yang menjawab dibangun dari commit yang baru saja ditarik — dan
 *   repo ini sudah dua kali menemukan deploy yang berakhir hijau sambil
 *   menyajikan hasil build lama: `dist/server` yang tidak ikut dibangun, dan
 *   `tokens.css` yang tidak ikut dibangkitkan.
 *
 *   `/versi` menutup kelas kesalahan itu dengan satu perbandingan. Ia membaca
 *   `versi.json` di direktori yang benar-benar disajikan, jadi ia menjawab
 *   tentang berkas, bukan tentang niat.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const versiDisajikan = (
  await diServer(`curl -sS --max-time 5 ${HEALTH.replace(/\/readyz$/, '/versi')}`)
).keluaran.trim()

let catatanVersi = ''
try {
  const sha = JSON.parse(versiDisajikan).sha
  catatanVersi =
    sha === terpasang
      ? `versi disajikan ${sha} — cocok`
      : merah(`versi disajikan ${sha}, TIDAK cocok dengan ${terpasang}`)
} catch {
  // Tidak menghentikan deploy. Prosesnya melayani dan kesehatannya 200; yang
  // hilang hanya kepastian bundel mana — dan itu dikatakan, bukan didiamkan.
  catatanVersi = merah('versi tidak dapat dibaca dari /versi')
}

console.log('')
console.log(hijau(`  ✓ Deploy selesai — ${terpasang} melayani di ${SERVER}`))
console.log(redup(`     kesehatan 200, ${daftar.length} migrasi dijalankan`))
console.log(redup(`     ${catatanVersi}`))
console.log('')
