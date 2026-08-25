import type { Pool } from 'pg'

import type { PendengarCacheIzin } from '#infrastructure/db/siaran-cache-izin'
import type { PaaduServer } from '#interface/http/app'

/**
 * Menutup proses dengan rapi.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *   MENGAPA URUTANNYA BEGINI
 *
 *   Faktur yang sedang diposting saat proses dimatikan tidak boleh berhenti di
 *   tengah. Posting menulis ke jurnal, baris jurnal, dan buku pajak dalam satu
 *   transaksi — transaksinya sendiri akan rollback bila koneksinya putus, jadi
 *   basis datanya tidak rusak. Yang rusak adalah kepercayaan orangnya: ia
 *   menekan "Posting", melihat galat, dan tidak tahu apakah fakturnya terposting
 *   atau tidak.
 *
 *   Karena itu prosesnya menyelesaikan apa yang sudah diterimanya, lalu keluar.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Urutannya:
 *
 *   1. **Berhenti menyatakan siap.** `/readyz` menjawab 503 sejak detik ini,
 *      sehingga pengarah lalu lintas berhenti mengirim permintaan baru ke
 *      proses ini SEBELUM ia berhenti mendengarkan.
 *   2. **Jeda.** Memberi waktu pengarah lalu lintas membaca perubahan itu.
 *      Tanpa jeda, langkah 1 tidak ada gunanya — soketnya tertutup pada saat
 *      yang sama dengan jawaban 503 pertama.
 *   3. **Tutup server HTTP.** Fastify berhenti menerima koneksi baru dan
 *      menunggu permintaan yang sedang berjalan selesai.
 *   4. **Tutup pendengar pembatalan izin, lalu pool basis data.** Sesudah HTTP
 *      berhenti, bukan sebelumnya: pool yang ditutup lebih dulu membuat
 *      permintaan yang masih berjalan gagal justru di ujungnya.
 *
 * Setiap langkah punya batas waktu. Penutupan rapi yang menggantung selamanya
 * bukan penutupan rapi — ia hanya cara lain untuk tidak pernah selesai.
 */

export interface OpsiPenutupan {
  readonly app: PaaduServer
  readonly pool: Pool
  readonly pendengar: PendengarCacheIzin | null
  /** Dipanggil untuk menyatakan proses tidak lagi menerima pekerjaan baru. */
  tandaiMenutup(): void
  /** Diganti di test supaya tidak benar-benar mematikan proses uji. */
  keluar?(kode: number): void
}

/**
 * Jeda antara "berhenti menyatakan siap" dan "berhenti mendengarkan".
 *
 * Dua detik cukup bagi Nginx dan PM2. Bila kelak ada pengarah lalu lintas yang
 * memeriksa kesiapan setiap N detik, angka ini harus lebih besar daripada N —
 * kalau tidak, ia mengirim permintaan ke soket yang sudah tertutup.
 */
const JEDA_DRAIN_MS = Number(process.env.PAADU_JEDA_DRAIN_MS ?? 2000)

/**
 * Batas menunggu permintaan yang sedang berjalan.
 *
 * Lima belas detik, terhadap ekor terukur 3,3 detik di produksi — login dengan
 * argon2 saat threadpool libuv penuh. Angka ini sengaja berjarak jauh dari
 * ekornya, bukan pas-pasan: yang dipotong batas ini adalah permintaan seseorang
 * yang sedang bekerja.
 *
 * `kill_timeout` PM2 harus lebih besar daripada JEDA_DRAIN + batas ini, atau
 * PM2 akan mengirim SIGKILL tepat di tengah penutupan yang sedang rapi.
 */
const BATAS_TUTUP_MS = Number(process.env.PAADU_BATAS_TUTUP_MS ?? 15_000)

/** Batas menutup koneksi basis data. Pendek: tidak ada pekerjaan tersisa. */
const BATAS_POOL_MS = 5000

function jeda(ms: number): Promise<void> {
  return new Promise((selesai) => {
    setTimeout(selesai, ms).unref()
  })
}

/**
 * Menjalankan `kerja`, atau menyerah setelah `batas`.
 *
 * Mengembalikan `true` bila selesai tepat waktu. Yang gagal tidak dilempar:
 * pemanggilnya sedang menutup proses, dan satu langkah yang macet tidak boleh
 * menghalangi langkah berikutnya.
 */
async function dalamBatas(kerja: Promise<unknown>, batas: number): Promise<boolean> {
  const hasil = await Promise.race([
    kerja.then(() => 'selesai' as const).catch(() => 'gagal' as const),
    jeda(batas).then(() => 'lewat' as const),
  ])
  return hasil === 'selesai'
}

let sedangMenutup = false

/**
 * Memasang penangan SIGTERM dan SIGINT.
 *
 * Keduanya, karena keduanya benar-benar dipakai: PM2 mengirim SIGINT saat
 * `reload` dan `restart`, sedangkan systemd, Docker, dan `kill` bawaan
 * mengirim SIGTERM. Menangani satu saja berarti setengah dari cara proses ini
 * dimatikan tetap memutus permintaan di tengah.
 */
export function pasangPenutupanRapi(opsi: OpsiPenutupan): void {
  const keluar = opsi.keluar ?? ((kode: number) => process.exit(kode))

  const tangani = (sinyal: string): void => {
    // Sinyal kedua saat sedang menutup diabaikan. Menekan Ctrl+C dua kali tidak
    // boleh membatalkan penutupan yang sudah berjalan separuh.
    if (sedangMenutup) {
      opsi.app.log.warn(`${sinyal} diterima lagi; penutupan sudah berjalan.`)
      return
    }
    sedangMenutup = true
    void tutup(sinyal, opsi, keluar)
  }

  process.on('SIGTERM', () => tangani('SIGTERM'))
  process.on('SIGINT', () => tangani('SIGINT'))
}

async function tutup(
  sinyal: string,
  opsi: OpsiPenutupan,
  keluar: (kode: number) => void,
): Promise<void> {
  const log = opsi.app.log
  log.info(`${sinyal} diterima; berhenti menyatakan siap.`)

  // 1 & 2 — berhenti siap, lalu beri waktu pengarah lalu lintas membacanya.
  opsi.tandaiMenutup()
  await jeda(JEDA_DRAIN_MS)

  // 3 — tutup HTTP, tunggu permintaan yang sedang berjalan.
  log.info('Menutup server HTTP; menunggu permintaan yang sedang berjalan.')
  const httpSelesai = await dalamBatas(opsi.app.close(), BATAS_TUTUP_MS)
  if (!httpSelesai) {
    log.warn(
      `Masih ada permintaan berjalan setelah ${BATAS_TUTUP_MS}ms; dilanjutkan. ` +
        'Bila ini berulang, ada permintaan yang lebih lambat daripada perkiraan.',
    )
  }

  // 4 — pendengar dulu, baru pool. Pendengar memegang koneksi dari pool ini.
  if (opsi.pendengar !== null) await dalamBatas(opsi.pendengar.tutup(), BATAS_POOL_MS)

  const poolSelesai = await dalamBatas(opsi.pool.end(), BATAS_POOL_MS)
  if (!poolSelesai) log.warn('Pool basis data tidak menutup tepat waktu.')

  log.info('Penutupan selesai.')

  /*
   * Keluar dengan 0, termasuk saat ada langkah yang lewat batas.
   *
   * Kode selain 0 memberi tahu PM2 bahwa proses ini MATI, dan PM2 akan
   * menyalakannya kembali — di tengah reload yang justru sedang mematikannya
   * dengan sengaja. Yang tidak selesai tepat waktu sudah tercatat di log
   * sebagai peringatan; itu tempat yang benar untuknya.
   */
  keluar(0)
}

/** Hanya untuk test: mengembalikan penjaga sinyal ke keadaan awal. */
export function _setelUlangPenutupan(): void {
  sedangMenutup = false
}
