/**
 * Kontrak idempotency — butir 12 Design_Handoff_Spec §2.
 *
 * Diletakkan di kernel bersama karena ia bukan milik modul mana pun: setiap
 * operasi tulis di seluruh produk memakainya. Antarmukanya di sini,
 * implementasinya di infrastruktur, pemakainya di lapisan HTTP.
 */

export interface IdempotentResponse {
  readonly status: number
  readonly body: unknown
}

export type IdempotencyOutcome =
  /** Kunci belum pernah dipakai. Penangan boleh berjalan. */
  | { state: 'fresh' }
  /** Kunci sudah selesai dengan muatan yang sama. Jawabannya diulang. */
  | { state: 'replay'; response: IdempotentResponse }
  /** Kunci sama, muatan berbeda. Ini kesalahan klien, bukan pengulangan. */
  | { state: 'conflict' }
  /** Permintaan pertama masih berjalan. Klien harus mencoba lagi nanti. */
  | { state: 'in_progress' }

export interface IdempotencyKey {
  readonly tenantId: string
  readonly companyId: string | null
  readonly key: string
  readonly endpoint: string
  readonly requestHash: string
}

export interface IdempotencyStore {
  begin(key: IdempotencyKey): Promise<IdempotencyOutcome>
  complete(key: IdempotencyKey, response: IdempotentResponse): Promise<void>
  /** Melepas kunci saat penangan gagal, supaya percobaan ulang tidak buntu. */
  abandon(key: IdempotencyKey): Promise<void>
}
