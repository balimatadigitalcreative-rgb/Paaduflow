import type { PostingRepository } from '#application/accounting/posting'
import type { Queryable } from '#infrastructure/db/queryable'

/**
 * Jurnal dan barisnya ditulis dalam satu pernyataan.
 *
 * CTE yang menulis bersifat atomik, jadi tidak mungkin ada jurnal tanpa baris —
 * keadaan yang justru ditolak constraint tertunda di `COMMIT`, dan yang tanpa
 * ini dapat terjadi bila koneksi putus di antara dua pernyataan.
 */
export class PostgresPostingRepository implements PostingRepository {
  constructor(
    private readonly db: Queryable,
    private readonly tenantId: string,
  ) {}

  async insertJournal(journal: Parameters<PostingRepository['insertJournal']>[0]): Promise<void> {
    await this.db.query(
      `WITH jurnal AS (
         INSERT INTO journals
           (id, tenant_id, company_id, journal_date, fiscal_year, fiscal_period,
            type, currency, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, tenant_id
       )
       INSERT INTO journal_lines
         (id, tenant_id, journal_id, line_no, account_id, debit, credit, currency, description)
       SELECT unnest($10::uuid[]), jurnal.tenant_id, jurnal.id, unnest($11::int[]),
              unnest($12::uuid[]), unnest($13::numeric[]), unnest($14::numeric[]),
              $8, unnest($15::text[])
         FROM jurnal`,
      [
        journal.id,
        this.tenantId,
        journal.companyId,
        journal.journalDate,
        journal.fiscalYear,
        journal.fiscalPeriod,
        journal.type,
        journal.currency,
        journal.description,
        journal.lines.map((line) => line.id),
        journal.lines.map((line) => line.lineNo),
        journal.lines.map((line) => line.accountId),
        journal.lines.map((line) => line.debit),
        journal.lines.map((line) => line.credit),
        journal.lines.map((line) => line.description ?? null),
      ],
    )
  }
}
