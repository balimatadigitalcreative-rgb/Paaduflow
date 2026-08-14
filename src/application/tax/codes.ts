import { supersede, type IsoDate, type TaxCodeVersion } from '#domain/tax/rates'

import type { TaxConfigPort } from './ports'

/**
 * Pengelolaan versi kode pajak — Module 08 §4 dan §11.
 *
 * Satu aturan menentukan seluruh bentuk berkas ini: **perubahan tarif adalah
 * baris baru, bukan pengubahan baris lama.** Tidak ada metode `updateRate`, dan
 * itu bukan kelalaian — ia tidak ada supaya tidak ada yang dapat memanggilnya.
 *
 * Basis data menegakkan hal yang sama lewat trigger `t40_rate_immutable`,
 * karena kontrol yang hanya hidup di satu lapisan dapat dilewati jalur tulis
 * yang belum ada hari ini.
 */

export interface NewVersionInput {
  readonly companyId: string
  readonly code: string
  readonly name: string
  readonly taxType: TaxCodeVersion['taxType']
  /** Nilai dari konfigurasi. Tidak ada nilai bawaan di kode mana pun. */
  readonly rate: number
  readonly validFrom: IsoDate
  readonly calculationBase: TaxCodeVersion['calculationBase']
  readonly glAccountId: string
  readonly isCreditable: boolean
  readonly createdBy: string
}

export type NewVersionResult =
  | {
      readonly kind: 'created'
      readonly id: string
      /** Versi yang ditutup, bila ada. Dilaporkan supaya dampaknya terlihat. */
      readonly supersededId: string | null
    }
  | { readonly kind: 'not_after_previous'; readonly previousValidFrom: IsoDate }
  | { readonly kind: 'previous_already_closed'; readonly previousValidTo: IsoDate }

export class TaxCodeService {
  constructor(
    private readonly config: TaxConfigPort,
    private readonly newId: () => string,
  ) {}

  /**
   * Menambahkan versi baru dan menutup yang lama dalam satu langkah.
   *
   * Keduanya tidak dapat dipisah. Versi baru tanpa penutupan versi lama
   * menghasilkan dua tarif yang sama-sama berlaku — yang ditolak basis data
   * lewat constraint EXCLUDE, tetapi lebih baik tidak pernah dicoba.
   */
  async addVersion(input: NewVersionInput): Promise<NewVersionResult> {
    const versi = await this.config.listVersions(input.companyId, input.code)
    const penutupan = supersede(versi, input.code, input.validFrom)

    if (penutupan.kind === 'not_after_previous') {
      return { kind: 'not_after_previous', previousValidFrom: penutupan.previousValidFrom }
    }
    if (penutupan.kind === 'previous_already_closed') {
      return { kind: 'previous_already_closed', previousValidTo: penutupan.previousValidTo }
    }

    // Menutup dulu, menyisipkan kemudian. Urutan sebaliknya membuat constraint
    // EXCLUDE menolak sisipan yang sebenarnya sah.
    if (penutupan.kind === 'closes') {
      await this.config.closeVersion(penutupan.previousId, penutupan.validTo)
    }

    const id = this.newId()
    await this.config.insertVersion({
      id,
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      taxType: input.taxType,
      rate: input.rate,
      validFrom: input.validFrom,
      calculationBase: input.calculationBase,
      glAccountId: input.glAccountId,
      isCreditable: input.isCreditable,
      createdBy: input.createdBy,
    })

    return {
      kind: 'created',
      id,
      supersededId: penutupan.kind === 'closes' ? penutupan.previousId : null,
    }
  }
}
