/**
 * Versi bundel — sisi klien.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *   TIDAK LEWAT `panggil()`, DAN ITU KEPUTUSAN
 *
 *   `panggil()` memutuskan sesi mati begitu ia melihat 401 pada permintaan
 *   yang membawa token (D-146). Pemeriksaan versi berjalan sendiri setiap
 *   beberapa menit di tab yang mungkin sudah menganggur semalaman — persis
 *   tab yang tokennya paling mungkin sudah mati.
 *
 *   Bila ia lewat jalur itu, fitur yang seluruh tugasnya memberi tahu akan
 *   melempar orang ke halaman masuk. Karena itu `fetch` di sini telanjang:
 *   tanpa token, tanpa amplop galat, tanpa satu pun efek samping.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Sha bundel YANG SEDANG BERJALAN di tab ini.
 *
 * Terpanggang saat build (`vite.config.ts`), bukan diambil dari jawaban server
 * pertama. Bedanya menentukan: masalah yang dipecahkan fitur ini adalah bundel
 * lama yang berjalan melawan server baru, dan hanya bundelnya sendiri yang
 * dapat bersaksi bundel mana ia. Tab yang memuat index.html basi dari cache
 * lalu mencatat jawaban server pertama sebagai "versi saya" tidak akan pernah
 * tahu ia tertinggal.
 *
 * `dev` saat berjalan di bawah Vitest maupun Vite dev, karena `define` tidak
 * ada di sana — dan `dev` di kedua sisi berarti tidak pernah ada selisih.
 */
export const VERSI_TERPASANG: string =
  typeof __VERSI_APLIKASI__ === 'undefined' ? 'dev' : __VERSI_APLIKASI__

/** `null` berarti TIDAK TERJAWAB — bukan "tidak ada versi baru". */
export type AmbilVersi = () => Promise<string | null>

/**
 * Menanyakan bundel mana yang sedang disajikan server.
 *
 * Setiap kegagalan menjadi `null`, dan pemanggilnya diam. Ini bukan fitur yang
 * layak menampilkan galat: kalau tidak terjawab, orang yang sedang bekerja
 * tidak kehilangan apa pun dengan tidak diberi tahu sekarang, dan pemeriksaan
 * berikutnya beberapa menit lagi.
 */
export const versiDisajikan: AmbilVersi = async () => {
  try {
    const jawaban = await fetch('/versi', {
      // Tanpa ini peramban boleh menjawab dari cache-nya sendiri, dan
      // pemeriksaan kebasian yang dijawab dari cache tidak memeriksa apa pun.
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!jawaban.ok) return null

    const isi = (await jawaban.json()) as { sha?: unknown }
    return typeof isi.sha === 'string' && isi.sha !== '' ? isi.sha : null
  } catch {
    return null
  }
}
