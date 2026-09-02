/**
 * Sha commit yang terpanggang ke dalam bundel ini oleh `vite.config.ts`.
 *
 * Bukan variabel lingkungan dan bukan hasil pembacaan apa pun saat berjalan:
 * ia konstanta yang ditulis saat build, sehingga nilainya melekat pada bundel
 * dan bukan pada proses yang menyajikannya.
 *
 * Tidak ada saat berjalan di bawah Vitest — konfigurasi uji tidak membawa
 * `define`. Karena itu setiap pembacaan wajib lewat `VERSI_TERPASANG` di
 * `api/versi.ts`, yang memulangkan `dev` bila ia tidak terdefinisi.
 */
declare const __VERSI_APLIKASI__: string
