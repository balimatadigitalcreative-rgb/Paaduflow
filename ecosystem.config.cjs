/**
 * PM2 — produksi.
 *
 * Menjalankan `dist/server/main.js`, yang HANYA menyalakan server HTTP. Ia
 * tidak menyalakan basis data, tidak menjalankan migrasi, dan tidak menjalankan
 * Vite. Migrasi adalah langkah deploy tersendiri; lihat README bagian
 * "Menjalankan di server" dan D-142.
 *
 * `.cjs` dengan sengaja: package.json memakai `"type": "module"`, sedangkan PM2
 * memuat berkas ekosistem sebagai CommonJS.
 *
 * Seluruh path dibaca dari lingkungan. Berkas ini tidak boleh perlu disunting
 * hanya karena sebuah server memakai tata letak direktori yang berbeda —
 * suntingan lokal di berkas terversi akan bertabrakan pada `git pull`
 * berikutnya.
 */
const dir = process.env.PAADU_DIR || '/home/paadu/app'
const logDir = process.env.PAADU_LOG_DIR || `${dir}/log`
const nama = process.env.PAADU_PM2_NAME || 'paadu-api'
const instances = Number(process.env.PAADU_INSTANCES || 2)

module.exports = {
  apps: [
    {
      name: nama,
      cwd: dir,

      /*
       * Skrip langsung, BUKAN `npm start`.
       *
       * Ini syarat mode cluster, bukan pilihan gaya. Mode cluster menuntut PM2
       * mem-fork skripnya sendiri agar soket pendengar dapat dibagi antar
       * worker. `npm start` menyalakan `node dist/server/main.js` sebagai proses
       * CUCU, dan PM2 tidak dapat membagi soket ke sana — hasilnya setiap worker
       * mencoba mengikat porta yang sama dan seluruhnya kecuali satu mati
       * dengan EADDRINUSE.
       */
      script: 'dist/server/main.js',

      /*
       * Dua instance, mode cluster.
       *
       * Berkas ini dulu menuntut jawaban lebih dulu atas sesi, idempotency, dan
       * penomoran dokumen di bawah beberapa proses. Ketiganya sudah dijawab, dan
       * jawabannya sama: penjaganya ada di basis data, bukan di proses.
       *
       *   sesi              tabel `sessions`, dicari lewat hash refresh token
       *   idempotency       ON CONFLICT (tenant_id, endpoint, idempotency_key)
       *   nomor dokumen     paadu.next_document_number() dengan SELECT … FOR UPDATE
       *   urutan stok       nextval('stock_movement_sequence')
       *   throttle login    dihitung dari tabel `auth_events`
       *
       * Yang TIDAK dijaga basis data adalah cache izin di memori. Pembatalannya
       * kini disiarkan lewat LISTEN/NOTIFY — lihat `siaran-cache-izin.ts` dan
       * D-157. Tanpa siaran itu, dua instance berarti izin yang dicabut tetap
       * berlaku sampai tiga puluh detik di instance yang tidak menanganinya.
       *
       * Tidak ada pekerjaan terjadwal di proses ini. Relay outbox dan pemeriksa
       * invarian tinggal di proses `scheduler` yang belum dirakit (D-044), dan
       * proses itu TIDAK boleh dijalankan cluster saat kelak dibangun: pekerjaan
       * berjadwal yang menyala dua kali lebih buruk daripada restart sesaat.
       */
      instances,
      exec_mode: 'cluster',

      /*
       * PM2 menunggu `process.send('ready')`, bukan sekadar menunggu proses
       * lahir.
       *
       * Inilah yang membuat rolling restart berarti sesuatu. Tanpa ini, PM2
       * menganggap instance siap begitu prosesnya ada, lalu melanjutkan ke
       * instance berikutnya — dan sejenak tidak ada satu pun instance yang
       * benar-benar dapat melayani.
       *
       * Prosesnya mengirim 'ready' hanya setelah listen berhasil DAN basis data
       * terbukti terjangkau.
       */
      wait_ready: true,
      listen_timeout: 20_000,

      /*
       * Waktu yang diberikan sebelum SIGKILL.
       *
       * Wajib lebih besar daripada JEDA_DRAIN + BATAS_TUTUP di `penutupan.ts`
       * (2 detik + 15 detik). Bila lebih kecil, PM2 membunuh proses tepat di
       * tengah penutupan yang sedang rapi — dan seluruh pekerjaan graceful
       * shutdown menjadi sia-sia tanpa satu pun tanda di log.
       */
      kill_timeout: 25_000,

      // Restart bila proses mati, tetapi menyerah bila ia mati berulang cepat.
      // Tanpa batas ini, konfigurasi yang salah berubah menjadi proses yang
      // menyala dan mati ribuan kali semalaman, dan lognya menjadi tidak
      // terbaca justru saat paling dibutuhkan.
      autorestart: true,
      max_restarts: 10,
      min_uptime: '20s',
      restart_delay: 5000,

      max_memory_restart: '512M',

      env: {
        NODE_ENV: 'production',
      },

      // MIGRATION_DATABASE_URL sengaja TIDAK ada di sini. Kredensial pemilik
      // basis data tidak boleh berada di lingkungan proses runtime (D-141).
      // Sisa variabel dibaca dari <PAADU_DIR>/.env oleh titik masuknya.

      error_file: `${logDir}/api.error.log`,
      out_file: `${logDir}/api.out.log`,
      merge_logs: true,
      time: true,
    },
  ],
}
