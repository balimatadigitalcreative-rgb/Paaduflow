/**
 * Deskripsi diri sebuah modul, dibaca composition root.
 *
 * Manifest inilah yang membuat modul ke-30 hanya menambah folder: navigasi,
 * katalog izin, dan pendaftaran pekerjaan dibangun dari daftar ini, bukan dari
 * berkas terpusat yang harus diingat untuk diperbarui.
 */
export interface ModuleManifest {
  /** Pengenal stabil, kebab-case. Dipakai di katalog izin dan URL. */
  readonly id: string
  /** Nama yang ditampilkan. Bukan kunci i18n — itu ditambahkan di Sesi B3. */
  readonly name: string
  /** Izin berformat `modul.entitas.aksi:cakupan` yang diterbitkan modul ini. */
  readonly permissions: readonly string[]
  /** Nama pekerjaan latar yang didaftarkan modul ini. */
  readonly jobs: readonly string[]
  /** Peristiwa domain yang diterbitkan modul ini lewat outbox. */
  readonly events: readonly string[]
}

export function defineModule(manifest: ModuleManifest): ModuleManifest {
  return manifest
}
