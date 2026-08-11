/**
 * Posting jurnal.
 *
 * Layanan ini adalah satu-satunya jalan menulis ke buku besar dari aplikasi.
 * Ia memeriksa keseimbangan lebih dulu supaya pesan galatnya dapat dibaca
 * manusia — basis data tetap menolak jurnal tidak berimbang di titik `COMMIT`,
 * tetapi pesannya bicara tentang constraint, bukan tentang selisih.
 *
 * Dua lapis yang sama sekali tidak berlebihan: yang di aplikasi menjelaskan,
 * yang di basis data menjamin.
 */

export interface JournalLineInput {
  readonly accountId: string
  readonly debit: number
  readonly credit: number
  readonly description?: string
}

export interface PostJournalInput {
  readonly companyId: string
  readonly journalDate: Date
  readonly fiscalYear: number
  readonly fiscalPeriod: number
  readonly type: 'auto' | 'manual' | 'adjustment' | 'closing' | 'opening' | 'reversal'
  readonly currency: string
  readonly description?: string
  readonly lines: readonly JournalLineInput[]
}

export interface PostingRepository {
  insertJournal(journal: {
    id: string
    companyId: string
    journalDate: Date
    fiscalYear: number
    fiscalPeriod: number
    type: PostJournalInput['type']
    currency: string
    description: string | null
    lines: readonly (JournalLineInput & { id: string; lineNo: number })[]
  }): Promise<void>
}

export type PostResult =
  | { readonly kind: 'posted'; readonly journalId: string }
  | { readonly kind: 'unbalanced'; readonly debit: number; readonly credit: number }
  | { readonly kind: 'empty' }
  | { readonly kind: 'line_has_both_sides'; readonly lineNo: number }

/** Bekerja dalam sen supaya penjumlahan tidak memakai pecahan biner — D-039. */
function toMinor(value: number): number {
  return Math.round(value * 100)
}

export class PostingService {
  constructor(
    private readonly repository: PostingRepository,
    private readonly newId: () => string,
  ) {}

  async post(input: PostJournalInput): Promise<PostResult> {
    if (input.lines.length === 0) return { kind: 'empty' }

    for (const [index, line] of input.lines.entries()) {
      // Satu baris tidak boleh memuat debit dan kredit sekaligus. Ia juga
      // ditolak basis data; di sini ia ditolak dengan nomor barisnya.
      if (line.debit !== 0 && line.credit !== 0) {
        return { kind: 'line_has_both_sides', lineNo: index + 1 }
      }
    }

    const debit = input.lines.reduce((jumlah, line) => jumlah + toMinor(line.debit), 0)
    const credit = input.lines.reduce((jumlah, line) => jumlah + toMinor(line.credit), 0)
    if (debit !== credit) {
      return { kind: 'unbalanced', debit: debit / 100, credit: credit / 100 }
    }

    const id = this.newId()
    await this.repository.insertJournal({
      id,
      companyId: input.companyId,
      journalDate: input.journalDate,
      fiscalYear: input.fiscalYear,
      fiscalPeriod: input.fiscalPeriod,
      type: input.type,
      currency: input.currency,
      description: input.description ?? null,
      lines: input.lines.map((line, index) => ({
        ...line,
        id: this.newId(),
        lineNo: index + 1,
      })),
    })

    return { kind: 'posted', journalId: id }
  }
}
