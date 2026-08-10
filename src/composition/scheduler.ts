import { modules } from '#composition/modules'

/**
 * Proses `scheduler` (D-044). Relay outbox, pekerjaan berjadwal, dan
 * pemeriksaan invarian berkala.
 *
 * Pemeriksaan invarian punya tempat berjalan sejak hari pertama supaya D-028
 * menjadi pekerjaan terjadwal, bukan niat baik.
 */
export function startScheduler(): never {
  throw new Error(
    `Proses scheduler belum dirakit — relay outbox dibangun di Sesi A3. ${modules.length} modul terdaftar.`,
  )
}
