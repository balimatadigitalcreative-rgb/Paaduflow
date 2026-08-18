/**
 * PM2 — produksi.
 *
 * Menjalankan `npm start`, yang HANYA menyalakan server HTTP. Ia tidak
 * menyalakan basis data, tidak menjalankan migrasi, dan tidak menjalankan Vite.
 * Migrasi adalah langkah deploy tersendiri; lihat README bagian "Menjalankan di
 * server" dan D-142.
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

module.exports = {
  apps: [
    {
      name: nama,
      cwd: dir,
      script: 'npm',
      args: 'start',

      // Satu instance. Menaikkannya menuntut jawaban lebih dulu atas sesi,
      // idempotency, dan penomoran dokumen di bawah beberapa proses — bukan
      // sekadar mengubah angka di sini.
      instances: 1,
      exec_mode: 'fork',

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
