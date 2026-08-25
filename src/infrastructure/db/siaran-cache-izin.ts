import type { Pool, PoolClient } from 'pg'

import type { PermissionCache } from '#application/identity/authorization'
import type { Queryable } from './queryable.js'

/**
 * Siaran pembatalan cache izin antar proses.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *   MENGAPA INI ADA
 *
 *   Cache izin adalah `Map` di memori proses. Selama hanya ada satu proses,
 *   `invalidate()` cukup: yang membatalkan dan yang menyimpan adalah objek
 *   yang sama.
 *
 *   Di mode cluster tidak lagi. Pencabutan akses yang ditangani instance A
 *   hanya membersihkan cache A; instance B terus menyajikan izin yang sudah
 *   dicabut sampai TTL-nya habis. Komentar di `authorization.ts` menamai
 *   kegagalan itu jauh sebelum cluster dinyalakan: cache izin yang basi adalah
 *   izin yang sudah dicabut tetapi masih berlaku.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Memakai `LISTEN`/`NOTIFY` bawaan PostgreSQL, bukan Redis atau antrean pesan.
 * Basis datanya sudah ada, sudah menjadi sumber kebenaran izin, dan sudah
 * menjadi titik gagal bersama — menambah infrastruktur baru di sini berarti
 * menambah hal yang dapat mati tanpa menambah jaminan apa pun.
 *
 * **Batasnya jujur:** `NOTIFY` tidak tahan mati. Instance yang sedang tidak
 * terhubung saat siaran dikirim tidak menerimanya. Itu dapat diterima justru
 * karena cache ini punya TTL: pesan yang hilang berarti kembali ke perilaku
 * lama — basi paling lama satu TTL — bukan basi selamanya. Siaran ini
 * mempersempit jendela dari "selalu 30 detik" menjadi "hampir selalu nol,
 * paling buruk 30 detik".
 */

/** Nama kanal. Satu untuk seluruh tenant; muatannya yang membedakan. */
export const KANAL_BATAL_IZIN = 'paadu_batal_izin'

/**
 * Mengirim siaran pembatalan LEWAT KONEKSI TRANSAKSI yang sedang berjalan.
 *
 * Ini bagian yang paling mudah salah, dan salahnya tidak terlihat sampai
 * diperiksa dengan cermat:
 *
 * PostgreSQL menyampaikan `NOTIFY` kepada pendengar **saat transaksinya
 * commit**, bukan saat perintahnya dijalankan. Mengirimnya lewat koneksi lain
 * — misalnya `pool.query` — akan menyampaikannya SEBELUM perubahan aksesnya
 * commit. Proses lain lalu membuang cache-nya, membaca ulang izin yang belum
 * berubah, dan menyimpannya kembali. Hasilnya lebih buruk daripada tidak
 * menyiarkan sama sekali: entri basi yang baru saja disegarkan bertahan satu
 * TTL penuh, terhitung sejak commit.
 *
 * Karena itu `db` di sini wajib klien transaksi yang sama dengan yang menulis
 * perubahannya.
 */
export async function siarkanPembatalan(
  db: Queryable,
  userId: string,
  companyId?: string,
): Promise<void> {
  // `pg_notify`, bukan `NOTIFY` literal: muatannya parameter, sehingga id
  // tidak pernah disambung ke dalam teks perintah.
  await db.query('SELECT pg_notify($1, $2)', [KANAL_BATAL_IZIN, muatan(userId, companyId)])
}

export interface PendengarCacheIzin {
  /** Menutup koneksi pendengar. Dipanggil saat proses dimatikan dengan rapi. */
  tutup(): Promise<void>
}

/**
 * Memasang pendengar pembatalan untuk proses ini.
 *
 * Koneksi pendengar diambil dari pool dan **tidak pernah dikembalikan**: klien
 * yang sedang `LISTEN` harus tetap memegang koneksinya, dan koneksi yang
 * dikembalikan ke pool akan dipakai kueri lain yang tidak mengharapkan
 * pemberitahuan. Ukuran pool efektif karena itu berkurang satu per proses —
 * disebut di sini supaya tidak dicari-cari saat pool terasa sempit.
 */
export async function pasangPendengarCacheIzin(
  pool: Pool,
  cache: PermissionCache,
  log: (pesan: string, galat?: unknown) => void = () => undefined,
): Promise<PendengarCacheIzin> {
  let pendengar: PoolClient | null = null
  let ditutup = false

  async function sambung(): Promise<void> {
    if (ditutup) return

    const klien = await pool.connect()
    pendengar = klien

    klien.on('notification', (pesan) => {
      if (pesan.channel !== KANAL_BATAL_IZIN || pesan.payload === undefined) return
      terapkan(cache, pesan.payload)
    })

    /*
     * Koneksi pendengar yang mati disambung ulang, bukan didiamkan.
     *
     * Bila tidak, proses ini berhenti menerima pembatalan tanpa satu pun tanda
     * — dan berhenti diam-diam persis pada mekanisme keamanan adalah bentuk
     * kegagalan yang paling lama tidak ketahuan.
     *
     * Cache dikosongkan seluruhnya saat itu terjadi. Selama tidak mendengar,
     * proses ini tidak dapat tahu pembatalan mana yang terlewat; membuang
     * semuanya mengembalikan jaminannya dengan ongkos beberapa pembacaan izin.
     */
    klien.on('error', (galat: unknown) => {
      log('Koneksi pendengar pembatalan izin terputus; menyambung ulang.', galat)
      cache.clear()
      klien.release(true)
      pendengar = null
      if (!ditutup) setTimeout(() => void sambung().catch(() => undefined), 1000).unref()
    })

    await klien.query(`LISTEN ${KANAL_BATAL_IZIN}`)
  }

  await sambung()

  return {
    async tutup() {
      ditutup = true
      if (pendengar === null) return
      const klien = pendengar
      pendengar = null
      try {
        await klien.query(`UNLISTEN ${KANAL_BATAL_IZIN}`)
      } catch {
        // Koneksi mungkin sudah putus. Yang penting ia dilepas.
      }
      klien.release(true)
    },
  }
}

/** Bentuk muatan sengaja sama dengan bentuk kunci cache — lihat `terapkan`. */
function muatan(userId: string, companyId?: string): string {
  return companyId === undefined ? userId : `${userId}:${companyId}`
}

/**
 * Menerapkan satu muatan siaran ke cache lokal.
 *
 * Muatan `user` membuang seluruh entri pengguna itu; `user:company` membuang
 * satu entri. Bentuknya sama dengan kunci cache, sehingga tidak ada pemetaan
 * kedua yang dapat menyimpang dari yang pertama.
 */
export function terapkan(cache: PermissionCache, muatanSiaran: string): void {
  if (muatanSiaran.includes(':')) {
    cache.delete(muatanSiaran)
    return
  }
  for (const kunci of cache.keys()) {
    if (kunci.startsWith(`${muatanSiaran}:`)) cache.delete(kunci)
  }
}
