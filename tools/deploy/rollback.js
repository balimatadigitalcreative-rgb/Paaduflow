#!/usr/bin/env node
/**
 * Kembali ke rilis sebelumnya, tanpa menyentuh basis data.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *   YANG PALING PENTING DARI PERINTAH INI ADALAH PERINGATANNYA
 *
 *   Rollback mengembalikan KODE. Ia tidak menggulung balik satu pun migrasi,
 *   dan tidak berpura-pura bisa.
 *
 *   Itu bukan keterbatasan yang belum sempat diselesaikan. Menggulung balik
 *   migrasi berarti membuang kolom yang mungkin sudah berisi data yang ditulis
 *   sejak migrasi berjalan — faktur yang diposting sepuluh menit lalu, nomor
 *   seri pajak yang sudah terpakai. Perintah yang melakukannya diam-diam
 *   sebagai bagian dari "kembalikan seperti semula" adalah perintah yang akan
 *   menghapus data seseorang pada saat semua orang sedang panik.
 *
 *   Karena itu: rollback aman sejauh kode lama masih dapat melayani skema hari
 *   ini. Aturan migrasi aditif (D-161) yang membuat itu benar hampir selalu —
 *   kolom baru diabaikan kode lama, dan tidak ada kolom yang hilang. Rollback
 *   melewati migrasi yang MERUSAK adalah keadaan yang harus diputuskan orang,
 *   bukan skrip.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Berjalan dari komputer pengembang maupun dari server, sama seperti deploy.
 *
 * Pemakaian:
 *   npm run rollback              kembali satu rilis
 *   npm run rollback -- <sha>     kembali ke rilis tertentu
 *   npm run rollback -- --daftar  hanya menampilkan rilis yang tersimpan
 */

import {
  APP_DIR,
  HEALTH,
  MIGRATION_ENV,
  PM2_NAME,
  RILIS_DIR,
  SERVER,
  berhenti,
  buatPenjalan,
  cetakLogPm2,
  deteksiLokasi,
  hijau,
  kuning,
  langkah,
  merah,
  redup,
  tanyakan,
  verifikasiKesiapan,
} from './lingkungan.js'

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

const argumen = process.argv.slice(2).filter((satu) => !satu.startsWith('--'))
const hanyaDaftar = process.argv.includes('--daftar')
const tujuanDiminta = argumen[0]

console.log(`\n  Rollback di ${SERVER}:${APP_DIR}`)
console.log(
  redup(`  Dijalankan ${diSini ? 'DI SERVER' : 'dari komputer ini lewat SSH'} - ${lokasi.alasan}`),
)

// ── Rilis yang tersimpan ────────────────────────────────────────────────────

langkah(1, 'Membaca rilis tersimpan')

const riwayat = await diServer(
  `test -f ${RILIS_DIR}/riwayat.txt && cat ${RILIS_DIR}/riwayat.txt || true`,
)
if (riwayat.kode !== 0) berhenti('membaca riwayat rilis', riwayat)

/**
 * Riwayat dibaca dari BAWAH: yang terakhir ditulis adalah yang paling baru.
 *
 * Hanya rilis yang arsipnya MASIH ADA yang dihitung. Riwayat menyebut lebih
 * banyak daripada yang tersimpan — pemangkasan membuang direktorinya, dan
 * menawarkan rilis yang direktorinya sudah hilang hanya akan gagal di tengah.
 */
const baris = riwayat.keluaran
  .trim()
  .split('\n')
  .map((satu) => satu.trim())
  .filter((satu) => satu !== '')
  .map((satu) => {
    const [sha, waktu] = satu.split(/\s+/)
    return { sha, waktu }
  })

const adaArsip = await diServer(`ls -1 ${RILIS_DIR} 2>/dev/null || true`)
const tersimpan = new Set(
  adaArsip.keluaran
    .trim()
    .split('\n')
    .map((satu) => satu.trim())
    .filter((satu) => satu !== '' && satu !== 'riwayat.txt'),
)

const rilis = baris.filter((satu) => tersimpan.has(satu.sha)).reverse()

if (rilis.length === 0) {
  berhenti(
    'membaca rilis tersimpan',
    { galat: `Tidak ada rilis terarsip di ${RILIS_DIR}.` },
    'Arsip rilis mulai terisi pada deploy berikutnya. Sebelum ada dua rilis,\n' +
      'jalan kembali satu-satunya adalah men-deploy ulang commit lama:\n' +
      '    git revert <commit> && git push && npm run deploy',
  )
}

const sekarang = (await diServer(`cd ${APP_DIR} && git rev-parse --short HEAD`)).keluaran.trim()

console.log('')
for (const satu of rilis) {
  const tanda = satu.sha === sekarang ? kuning(' <- sedang melayani') : ''
  console.log(`     ${satu.sha}  ${satu.waktu}${tanda}`)
}

if (hanyaDaftar) {
  console.log('')
  process.exit(0)
}

// ── Menentukan tujuan ───────────────────────────────────────────────────────

let tujuan
if (tujuanDiminta !== undefined) {
  tujuan = rilis.find((satu) => satu.sha === tujuanDiminta || satu.sha.startsWith(tujuanDiminta))
  if (tujuan === undefined) {
    berhenti(
      'menentukan tujuan',
      { galat: `Rilis "${tujuanDiminta}" tidak ada di arsip.` },
      'Daftar yang tersedia tercetak di atas.',
    )
  }
} else {
  const indeksSekarang = rilis.findIndex((satu) => satu.sha === sekarang)

  /*
   * Yang dituju adalah rilis SEBELUM yang sedang melayani.
   *
   * Bila yang sedang melayani tidak ada di arsip — misalnya karena sudah
   * terpangkas, atau karena seseorang mengubah checkout dengan tangan — yang
   * paling baru di arsip adalah tujuan yang benar.
   */
  tujuan = indeksSekarang === -1 ? rilis[0] : rilis[indeksSekarang + 1]

  if (tujuan === undefined) {
    berhenti(
      'menentukan tujuan',
      { galat: `${sekarang} adalah rilis terlama yang terarsip; tidak ada yang sebelumnya.` },
      'Sebutkan sha secara eksplisit bila memang bermaksud ke rilis lain:\n' +
        '    npm run rollback -- <sha>',
    )
  }
}

if (tujuan.sha === sekarang) {
  console.log('')
  console.log(hijau(`  ${sekarang} memang sudah yang melayani. Tidak ada yang dikerjakan.`))
  console.log('')
  process.exit(0)
}

// ── Peringatan migrasi ──────────────────────────────────────────────────────

langkah(2, 'Migrasi yang berjalan sejak rilis tujuan')

/**
 * Migrasi yang tercatat SESUDAH rilis tujuan di-deploy.
 *
 * Dibaca dari `paadu_migrations`, bukan dari berkas di repo: yang menentukan
 * adalah apa yang benar-benar sudah berjalan pada basis data ini.
 */
const migrasi = await diServer(
  `set -a && . ${MIGRATION_ENV} && set +a && ` +
    `psql "$MIGRATION_DATABASE_URL" -At -F'|' -c ` +
    `"SELECT name, run_on FROM paadu_migrations WHERE run_on > '${tujuan.waktu}' ORDER BY run_on"`,
)

const sesudah =
  migrasi.kode === 0
    ? migrasi.keluaran
        .trim()
        .split('\n')
        .map((satu) => satu.trim())
        .filter((satu) => satu !== '')
    : null

console.log('')
console.log(kuning('  ┌────────────────────────────────────────────────────────────────────┐'))
console.log(kuning('  │  ROLLBACK TIDAK MENGGULUNG BALIK MIGRASI                            │'))
console.log(kuning('  └────────────────────────────────────────────────────────────────────┘'))
console.log('')
console.log('  Perintah ini mengembalikan KODE dan menyegarkan proses. Basis data')
console.log('  tidak disentuh sama sekali — tidak ada kolom yang dibuang, tidak ada')
console.log('  data yang dipulihkan.')
console.log('')
console.log('  Membatalkan sebuah migrasi adalah keputusan tersendiri yang diambil')
console.log('  orang, bukan efek samping dari mengembalikan kode. Kolom yang dibuang')
console.log('  membawa serta data yang ditulis sejak migrasi itu berjalan.')
console.log('')

if (sesudah === null) {
  console.log(merah('  Daftar migrasi tidak dapat dibaca dari basis data.'))
  console.log(redup(`  ${(migrasi.galat || migrasi.keluaran).trim().split('\n')[0]}`))
  console.log('')
  console.log('  Lanjutkan hanya bila Anda tahu sendiri apa yang berubah sejak')
  console.log(`  ${tujuan.sha} di-deploy.`)
} else if (sesudah.length === 0) {
  console.log(hijau(`  Tidak ada migrasi yang berjalan sejak ${tujuan.sha} di-deploy.`))
  console.log(hijau('  Skema hari ini sama dengan skema yang dikenal rilis itu.'))
} else {
  console.log(merah(`  ${sesudah.length} migrasi berjalan sejak ${tujuan.sha} di-deploy:`))
  console.log('')
  for (const satu of sesudah) {
    const [nama, waktu] = satu.split('|')
    console.log(`      ${nama}   ${redup(waktu ?? '')}`)
  }
  console.log('')
  console.log('  Seluruhnya TETAP terpasang setelah rollback. Kode lama akan melayani')
  console.log('  skema yang lebih baru daripada yang dikenalnya.')
  console.log('')
  console.log('  Aturan migrasi aditif (D-161) membuat itu aman dalam keadaan biasa:')
  console.log('  kolom baru diabaikan kode lama, dan tidak ada kolom yang hilang.')
  console.log('  Bila salah satu migrasi di atas memakai pintu darurat')
  console.log('  paadu:allow-breaking, periksa alasannya lebih dulu.')
}

console.log('')
console.log(`  Dari : ${sekarang}`)
console.log(`  Ke   : ${tujuan.sha}  (${tujuan.waktu})`)
console.log('')

const jawab = await tanyakan('  Lanjutkan rollback? (ketik "ya") ')
if (jawab !== 'ya') {
  console.error('')
  console.error(merah('  x Dibatalkan. Tidak ada yang berubah.'))
  console.error('')
  process.exit(1)
}

// ── Mengembalikan kode ──────────────────────────────────────────────────────

langkah(3, `Mengembalikan sumber ke ${tujuan.sha}`)

const kembali = await diServer(`cd ${APP_DIR} && git checkout --detach ${tujuan.sha}`, {
  tampilkan: true,
})
if (kembali.kode !== 0) {
  berhenti(
    'mengembalikan sumber',
    kembali,
    'Belum ada yang disegarkan; proses masih melayani versi sebelumnya.',
  )
}

/*
 * `--detach`, bukan `reset --hard` pada branch.
 *
 * Rollback adalah keadaan sementara: server menjalankan commit lama sementara
 * `main` tetap menunjuk yang baru. Memindahkan branch akan membuat deploy
 * berikutnya mengira tidak ada yang perlu ditarik, dan perbaikan yang sudah
 * di-push akan tampak sudah terpasang padahal tidak.
 *
 * HEAD terlepas membuat keadaan itu terlihat: `git status` di server
 * menyebutkannya, dan deploy berikutnya menariknya kembali ke branch.
 */

langkah(4, 'Memeriksa dependensi')

const lockArsip = await diServer(`cat ${RILIS_DIR}/${tujuan.sha}/lock.txt 2>/dev/null || echo -`)
const lockSekarang = await diServer(`sha256sum ${APP_DIR}/package-lock.json | cut -c1-16`)

if (lockArsip.keluaran.trim() !== lockSekarang.keluaran.trim()) {
  /*
   * Dependensi berbeda antara rilis ini dan yang sedang terpasang.
   *
   * Bundel server memakai dependensi dari `node_modules`, bukan menyalinnya ke
   * dalam bundel. Melewatkan `npm ci` di sini berarti kode lama berjalan di
   * atas pustaka versi baru — bentuk kegagalan yang paling sulit dibaca dari
   * log mana pun.
   */
  console.log(redup('     package-lock.json berbeda — memasang ulang dependensi'))
  const pasang = await diServer(`cd ${APP_DIR} && npm ci --include=dev`, { tampilkan: true })
  if (pasang.kode !== 0) berhenti('npm ci', pasang)
} else {
  console.log(redup('     package-lock.json sama — tidak perlu memasang ulang'))
}

langkah(5, 'Memulihkan hasil build dari arsip')

/*
 * Ditukar, bukan dibangun ulang.
 *
 * Membangun ulang commit lama menuntut toolchain yang cocok, memakan waktu
 * build penuh, dan dapat gagal justru pada saat semuanya sedang salah. Arsip
 * berisi hasil build yang PERNAH melayani — itu bukti yang lebih kuat daripada
 * build baru mana pun.
 *
 * Penukarannya sama dengan di deploy: dua `mv` berurutan, jendelanya satu
 * operasi rename.
 */
const pulih = await diServer(
  [
    `test -d ${RILIS_DIR}/${tujuan.sha}/dist`,
    `cd ${APP_DIR}`,
    `rm -rf dist-baru dist-lama`,
    `cp -a ${RILIS_DIR}/${tujuan.sha}/dist dist-baru`,
    `if [ -d dist ]; then mv dist dist-lama; fi`,
    `mv dist-baru dist`,
    `rm -rf dist-lama`,
  ].join(' && '),
)
if (pulih.kode !== 0) {
  berhenti(
    'memulihkan hasil build',
    pulih,
    `Arsip ${RILIS_DIR}/${tujuan.sha}/dist tidak lengkap.\n` +
      'Sumber sudah dikembalikan tetapi proses BELUM disegarkan — yang melayani\n' +
      'masih versi sebelumnya. Bangun ulang di server, atau kembali ke depan:\n' +
      `    cd ${APP_DIR} && git checkout ${process.env.DEPLOY_BRANCH ?? 'main'} && npm run deploy`,
  )
}

langkah(6, `pm2 reload ${PM2_NAME}`)
const reload = await diServer(`pm2 reload ${PM2_NAME} --update-env`, { tampilkan: true })
if (reload.kode !== 0) berhenti('pm2 reload', reload)

langkah(7, 'Verifikasi kesiapan')

if (!(await verifikasiKesiapan(diServer))) {
  console.error('')
  console.error(merah('  x Gagal pada: verifikasi kesiapan'))
  console.error(`      ${HEALTH} tidak menjawab 200 setelah 10 percobaan.`)
  console.error('')
  console.error('  30 baris terakhir log PM2:')
  console.error('')
  await cetakLogPm2(diServer)
  console.error('')
  console.error('  Rilis yang dituju pun tidak siap. Coba rilis sebelumnya:')
  console.error('      npm run rollback -- --daftar')
  console.error('')
  process.exit(1)
}

const terpasang = (await diServer(`cd ${APP_DIR} && git rev-parse --short HEAD`)).keluaran.trim()

console.log('')
console.log(hijau(`  ✓ Rollback selesai — ${terpasang} melayani di ${SERVER}`))
console.log('')
console.log(kuning('     Basis data TIDAK disentuh. Migrasi yang sudah berjalan tetap terpasang.'))
console.log(
  redup(`     HEAD terlepas di server; deploy berikutnya menariknya kembali ke branch.`),
)
console.log('')
