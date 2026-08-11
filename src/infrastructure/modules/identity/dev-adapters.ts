import type { BreachedPasswordList, Mailer } from '#application/identity/ports'

/**
 * Adapter sementara untuk menjalankan proses sebelum layanannya ada.
 *
 * Keduanya sengaja diberi nama yang tidak enak dibaca di composition root.
 * Adapter pengganti yang bernama netral akan bertahan sampai produksi tanpa
 * ada yang menyadarinya.
 */

export class ConsoleMailer implements Mailer {
  async sendEmailVerification(email: string, token: string): Promise<void> {
    console.warn(`[surel-belum-terpasang] verifikasi untuk ${email}: token=${token}`)
  }

  async sendAccountAlreadyExists(email: string): Promise<void> {
    console.warn(`[surel-belum-terpasang] pemberitahuan akun sudah ada untuk ${email}`)
  }
}

/**
 * Tidak memeriksa apa pun.
 *
 * Modul 02 §11 mensyaratkan kata sandi diperiksa terhadap daftar kata sandi
 * bocor. Selama kelas ini yang terpasang, syarat itu TIDAK terpenuhi. Ia ada
 * supaya proses dapat berjalan, bukan supaya syaratnya dianggap selesai.
 */
export class UncheckedBreachList implements BreachedPasswordList {
  async isBreached(): Promise<boolean> {
    return false
  }
}
