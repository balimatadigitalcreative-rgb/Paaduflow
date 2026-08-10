import { modules } from '#composition/modules'

/**
 * Proses `worker` (D-044). Pekerjaan berat: ekspor, impor massal, penggajian,
 * penyusutan, laporan besar.
 *
 * Terpisah dari `api` supaya kelebihan beban di sini tidak pernah menyentuh
 * orang yang sedang membuat faktur — Resilience §5.
 */
export function startWorker(): never {
  throw new Error(
    `Proses worker belum dirakit — antrean dibangun setelah skema fondasi ada. ${modules.length} modul terdaftar.`,
  )
}
