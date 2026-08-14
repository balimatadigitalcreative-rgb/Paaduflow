import type { IsoDate } from '#domain/tax/rates'

import type { SerialUsageSummary, TaxSerialPort } from './ports'

/**
 * Nomor seri faktur pajak — Module 08 §4 dan §7.
 *
 * Alokasi dan pemakaian dipisah menjadi dua tabel, dan setiap nomor
 * dimaterialisasi sebagai satu baris saat alokasi dicatat. Alternatifnya
 * menyimpan rentang dan menghitung sisanya; ditolak karena pertanyaan "nomor
 * mana yang batal" lalu menjadi selisih dua himpunan yang harus disusun ulang
 * setiap kali ditanya — dan pertanyaan itu ditanyakan pemeriksa.
 *
 * Nomor yang dibatalkan tidak pernah kembali ke pool. Ia berstatus `cancelled`
 * dan tetap muncul di laporan pemakaian.
 */

export interface AllocateInput {
  readonly companyId: string
  readonly prefix: string
  readonly digits: number
  readonly rangeStart: number
  readonly rangeEnd: number
  readonly expiresAt?: IsoDate | null
  readonly sourceReference?: string | null
  readonly createdBy: string
}

export type AllocateResult =
  | { readonly kind: 'allocated'; readonly id: string; readonly count: number }
  | { readonly kind: 'range_inverted' }
  | { readonly kind: 'range_too_large'; readonly max: number }

/** Sesuai CHECK di basis data. Alokasi raksasa hampir selalu salah ketik. */
const MAKSIMUM_RENTANG = 100_000

export class TaxSerialService {
  constructor(
    private readonly serials: TaxSerialPort,
    private readonly newId: () => string,
  ) {}

  async allocate(input: AllocateInput): Promise<AllocateResult> {
    if (input.rangeEnd < input.rangeStart) return { kind: 'range_inverted' }
    if (input.rangeEnd - input.rangeStart >= MAKSIMUM_RENTANG) {
      return { kind: 'range_too_large', max: MAKSIMUM_RENTANG }
    }

    const id = this.newId()
    const count = await this.serials.allocate({
      id,
      companyId: input.companyId,
      prefix: input.prefix,
      digits: input.digits,
      rangeStart: input.rangeStart,
      rangeEnd: input.rangeEnd,
      expiresAt: input.expiresAt ?? null,
      sourceReference: input.sourceReference ?? null,
      createdBy: input.createdBy,
    })

    return { kind: 'allocated', id, count }
  }

  /**
   * Terpakai, batal, dan tersisa — dalam satu jawaban.
   *
   * `allocated` adalah jumlah seluruh baris, sehingga
   * `used + cancelled + expired + available = allocated` berlaku menurut
   * konstruksi, bukan menurut harapan. Invarian yang diuji di
   * `tests/invariants/nomor-seri-pajak.test.ts` memeriksanya terhadap basis
   * data sungguhan.
   */
  async usage(companyId: string): Promise<SerialUsageSummary> {
    return this.serials.usage(companyId)
  }

  /** Nomor di luar rentang yang dialokasikan ditolak — Module 08 §11. */
  async isWithinAllocation(companyId: string, serialNumber: number): Promise<boolean> {
    return this.serials.isWithinAllocation(companyId, serialNumber)
  }
}
