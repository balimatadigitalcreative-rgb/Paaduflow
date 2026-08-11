/**
 * Kebijakan kata sandi — Modul 02 §11.
 *
 * Minimal 12 karakter, diperiksa terhadap daftar kata sandi bocor, dan
 * **tanpa aturan komposisi karakter**. Mewajibkan huruf besar, angka, dan
 * simbol menurunkan entropi nyata: orang menjawabnya dengan `Password1!`, pola
 * yang justru ada di setiap daftar bocor. Panjang yang menang, bukan variasi.
 */

export const PASSWORD_MIN_LENGTH = 12

/**
 * Batas atas ada untuk melindungi server, bukan pengguna. Argon2 pada masukan
 * sangat panjang adalah jalan mudah menuju penolakan layanan.
 */
export const PASSWORD_MAX_LENGTH = 1024

export type PasswordRejection = 'terlalu_pendek' | 'terlalu_panjang' | 'pernah_bocor'

export interface PasswordCheck {
  /** Hasil pemeriksaan terhadap daftar kata sandi bocor. */
  readonly breached: boolean
}

/**
 * Menormalkan kata sandi sebelum di-hash.
 *
 * NFKC menyamakan bentuk karakter yang tampak identik. Tanpa ini, kata sandi
 * yang diketik di iOS dan di Windows dapat menghasilkan byte berbeda, dan
 * pengguna melihat "kata sandi salah" untuk kata sandi yang benar.
 */
export function normalizePassword(password: string): string {
  return password.normalize('NFKC')
}

/** Mengembalikan alasan penolakan, atau null bila kata sandi diterima. */
export function checkPassword(password: string, check: PasswordCheck): PasswordRejection | null {
  const normalized = normalizePassword(password)

  // Panjang dihitung dalam titik kode, bukan unit UTF-16. Kata sandi berisi
  // emoji tidak boleh dihitung dua kali lipat.
  const length = [...normalized].length

  if (length < PASSWORD_MIN_LENGTH) return 'terlalu_pendek'
  if (length > PASSWORD_MAX_LENGTH) return 'terlalu_panjang'
  if (check.breached) return 'pernah_bocor'

  return null
}
