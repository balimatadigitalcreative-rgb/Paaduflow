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
 */
module.exports = {
  apps: [
    {
      name: 'paadu-api',
      cwd: '/srv/paadu',
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
      // Sisa variabel dibaca dari /srv/paadu/.env oleh titik masuknya.

      error_file: '/var/log/paadu/api.error.log',
      out_file: '/var/log/paadu/api.out.log',
      merge_logs: true,
      time: true,
    },
  ],
}
