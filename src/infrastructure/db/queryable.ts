import type { QueryResult, QueryResultRow } from 'pg'

/**
 * Apa pun yang dapat menjalankan kueri — kolam koneksi, satu koneksi di dalam
 * transaksi, atau pembungkus yang mencatat SQL untuk diperiksa test.
 *
 * Berupa antarmuka struktural, bukan tipe milik `pg`, justru supaya yang
 * terakhir mungkin: test yang membuktikan penyaringan terjadi di basis data
 * harus dapat melihat SQL yang benar-benar dikirim, bukan SQL yang katanya
 * dikirim.
 */
export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<R>>
}
