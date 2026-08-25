import { i18n } from '#interface/web/i18n/index'

/**
 * i18n dipasang sekali untuk seluruh test antarmuka.
 *
 * Di produksi ini terjadi di `main.tsx` sebelum render pertama. Test yang
 * merender komponen langsung melewati titik itu, dan tanpa pemasangan di sini
 * `t()` memulangkan kuncinya sendiri — setiap uji yang mencari teks nyata akan
 * gagal dengan pesan yang menunjuk ke arah yang salah.
 *
 * Berkas locale SUNGGUHAN yang dimuat, bukan tiruan. Kunci yang salah eja atau
 * hilang karena itu ikut tertangkap di sini, bukan hanya di pemeriksa CI.
 */
await i18n()
