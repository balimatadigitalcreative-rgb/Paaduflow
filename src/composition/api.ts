import { modules } from '#composition/modules'

/**
 * Proses `api` (D-044). Melayani permintaan pengguna dan integrasi.
 *
 * Perakitan Fastify, konteks tenant per permintaan, dan pendaftaran rute modul
 * masuk di Sesi A3 — setelah skema fondasi ada.
 */
export function startApi(): never {
  throw new Error(
    `Proses api belum dirakit — dijadwalkan di Sesi A3. ${modules.length} modul terdaftar.`,
  )
}
