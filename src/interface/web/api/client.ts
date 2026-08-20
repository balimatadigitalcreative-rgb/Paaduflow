/**
 * Klien API.
 *
 * Tiga hal yang ditegakkan di sini dan tidak di tempat lain:
 *
 * 1. **Konteks company masuk lewat path, bukan lewat header** (D-002). Fungsi
 *    `perusahaan()` membentuk awalan URL-nya, sehingga tidak ada pemanggil yang
 *    dapat lupa menyertakannya.
 * 2. **Satu bentuk amplop galat.** Server menjawab `{success:false, message,
 *    errors:[{code,…}]}` untuk seluruh jalur gagal; `ApiError` membawa ketiganya
 *    apa adanya, supaya layar dapat menampilkan pesan server alih-alih
 *    mengarang pesannya sendiri.
 * 3. **Operasi tulis membawa `Idempotency-Key`.** Timeout tidak boleh
 *    menghasilkan faktur ganda; itu seluruh alasannya ada.
 */

export interface ApiErrorDetail {
  readonly code: string
  readonly message?: string
  readonly [key: string]: unknown
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly errors: readonly ApiErrorDetail[],
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** Kode galat pertama. Dipakai layar untuk membedakan sebab tanpa mengurai pesan. */
  get code(): string | null {
    return this.errors[0]?.code ?? null
  }
}

const KUNCI_TOKEN = 'paadu.access_token'
const KUNCI_REFRESH = 'paadu.refresh_token'

export const sesi = {
  accessToken(): string | null {
    return localStorage.getItem(KUNCI_TOKEN)
  },
  simpan(access: string, refresh: string): void {
    localStorage.setItem(KUNCI_TOKEN, access)
    localStorage.setItem(KUNCI_REFRESH, refresh)
    // Sesi baru berarti pemberitahuan berikutnya boleh lewat lagi.
    sudahDiberitahu = false
  },
  hapus(): void {
    localStorage.removeItem(KUNCI_TOKEN)
    localStorage.removeItem(KUNCI_REFRESH)
  },
  refreshToken(): string | null {
    return localStorage.getItem(KUNCI_REFRESH)
  },
}

/**
 * Sesi yang ditolak server ditangani di satu tempat, bukan di tiap layar.
 *
 * Sebelumnya setiap halaman menangkap galatnya sendiri dan menampilkan "Sesi
 * tidak berlaku." sebagai teks merah di tengah halaman. Pengguna membacanya,
 * menekan "Coba lagi", dan mendapat pesan yang sama — tanpa satu pun jalan ke
 * halaman masuk. Token yang mati di tengah pemakaian adalah kondisi aplikasi,
 * bukan kegagalan satu layar, jadi ia diputuskan di sini.
 */
type SesiHabis = () => void

let saatSesiHabis: SesiHabis | null = null
let sudahDiberitahu = false

export function onSesiHabis(penangan: SesiHabis | null): void {
  saatSesiHabis = penangan
}

interface Opsi {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  readonly body?: unknown
  readonly tanpaToken?: boolean
}

async function panggil<T>(path: string, opsi: Opsi = {}): Promise<T> {
  const method = opsi.method ?? 'GET'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  const token = sesi.accessToken()
  if (token !== null && opsi.tanpaToken !== true) headers.Authorization = `Bearer ${token}`

  // Hanya untuk operasi tulis. Membungkus GET dengannya akan menyimpan jawaban
  // baca sebagai hasil yang diputar ulang.
  if (method !== 'GET') headers['Idempotency-Key'] = crypto.randomUUID()

  const jawaban = await fetch(path, {
    method,
    headers,
    ...(opsi.body === undefined ? {} : { body: JSON.stringify(opsi.body) }),
  })

  if (jawaban.status === 204) return undefined as T

  const isi = (await jawaban.json().catch(() => null)) as
    | { success: boolean; message?: string; data?: unknown; errors?: ApiErrorDetail[] }
    | null

  /*
   * 401 pada permintaan yang MEMBAWA token berarti sesinya sudah mati.
   *
   * 401 pada permintaan tanpa token bukan hal yang sama: itu jawaban wajar
   * untuk kata sandi yang salah di halaman masuk, dan layar itu yang berhak
   * menampilkannya. Membedakan keduanya di sini mencegah kegagalan masuk
   * memicu "sesi Anda berakhir" pada orang yang memang belum pernah masuk.
   *
   * Galatnya tetap dilempar. Pemanggil berhak tahu permintaannya gagal;
   * yang berubah hanya siapa yang memutuskan ke mana pengguna dibawa.
   */
  if (jawaban.status === 401 && opsi.tanpaToken !== true && token !== null) {
    sesi.hapus()
    if (!sudahDiberitahu) {
      sudahDiberitahu = true
      saatSesiHabis?.()
    }
  }

  if (!jawaban.ok || isi === null || isi.success === false) {
    throw new ApiError(
      jawaban.status,
      isi?.message ?? 'Permintaan gagal tanpa keterangan dari server.',
      isi?.errors ?? [],
    )
  }

  return isi as T
}

export interface Amplop<T> {
  readonly success: true
  readonly data: T
  readonly meta?: { readonly next_cursor: string | null }
}

export const api = {
  async masuk(email: string, password: string): Promise<void> {
    const jawaban = await panggil<{
      data: { access_token: string; refresh_token: string }
    }>('/v1/auth/login', { method: 'POST', body: { email, password }, tanpaToken: true })

    sesi.simpan(jawaban.data.access_token, jawaban.data.refresh_token)
  },

  async keluar(): Promise<void> {
    const refresh = sesi.refreshToken()
    if (refresh !== null) {
      await panggil('/v1/auth/logout', {
        method: 'POST',
        body: { refresh_token: refresh },
      }).catch(() => undefined)
    }
    sesi.hapus()
  },

  get<T>(path: string): Promise<Amplop<T>> {
    return panggil<Amplop<T>>(path)
  },

  post<T>(path: string, body?: unknown): Promise<Amplop<T>> {
    return panggil<Amplop<T>>(path, { method: 'POST', ...(body === undefined ? {} : { body }) })
  },
}

/** Awalan URL bercakupan company. Konteks company datang dari path — D-002. */
export function perusahaan(companyId: string): string {
  return `/v1/companies/${companyId}`
}
