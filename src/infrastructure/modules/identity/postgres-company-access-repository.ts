import type {
  CompanyAccessRepository,
  CompanyAccessRow,
} from '#application/identity/company-access'
import type { ScopeFilter } from '#domain/identity/permission'
import type { Queryable } from '#infrastructure/db/queryable'
import { scopePredicate } from '#infrastructure/db/scoped-query'

/**
 * Kursor adalah `granted_at` dan `id` dari baris terakhir, dikodekan base64url.
 *
 * Bukan nomor halaman. Membaca sambil data ditulis bersamaan tidak melewatkan
 * maupun menggandakan baris — itu seluruh alasan D-024 melarang `offset`.
 */
function encodeCursor(row: { grantedAt: Date; id: string }): string {
  return Buffer.from(`${row.grantedAt.toISOString()}|${row.id}`, 'utf8').toString('base64url')
}

function decodeCursor(cursor: string): { grantedAt: string; id: string } | null {
  try {
    const [grantedAt, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|')
    if (grantedAt === undefined || id === undefined) return null
    return { grantedAt, id }
  } catch {
    return null
  }
}

interface Row {
  id: string
  user_id: string
  email: string
  full_name: string
  role_key: string
  granted_at: Date
}

function toRow(row: Row): CompanyAccessRow {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    roleKey: row.role_key,
    grantedAt: row.granted_at,
  }
}

export class PostgresCompanyAccessRepository implements CompanyAccessRepository {
  constructor(private readonly db: Queryable) {}

  async list(
    filter: ScopeFilter,
    cursor: string | null,
    limit: number,
  ): Promise<{ rows: CompanyAccessRow[]; total: number; nextCursor: string | null }> {
    // `company_access` tidak punya `deleted_at`; predikat bersama menyertakannya,
    // jadi tabel ini memakai bentuk yang sama tanpa kolom itu.
    const predicate = scopePredicate({ ...filter, ownerId: null }, 'ca')
    const sql = predicate.sql.replace(' AND ca.deleted_at IS NULL', '')
    const params: unknown[] = [...predicate.params]

    let keyset = ''
    const decoded = cursor === null ? null : decodeCursor(cursor)
    if (decoded !== null) {
      params.push(decoded.grantedAt, decoded.id)
      keyset = ` AND (ca.granted_at, ca.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`
    }

    params.push(limit + 1)

    const { rows } = await this.db.query<Row>(
      `SELECT ca.id, ca.user_id, u.email, u.full_name, r.key AS role_key, ca.granted_at
         FROM company_access ca
         JOIN users u ON u.id = ca.user_id
         JOIN roles r ON r.id = ca.role_id
        WHERE ${sql}${keyset}
        ORDER BY ca.granted_at DESC, ca.id DESC
        LIMIT $${params.length}`,
      params,
    )

    // `total` tetap wajib meski pagination berbasis kursor — teks "Pilih semua
    // N baris yang cocok" bergantung padanya (D-041). Ia dihitung dengan
    // predikat yang sama, jadi ia tidak pernah menghitung baris terlarang.
    const { rows: hitung } = await this.db.query<{ total: string }>(
      `SELECT count(*) AS total FROM company_access ca WHERE ${sql}`,
      predicate.params,
    )

    const halaman = rows.slice(0, limit).map(toRow)
    const berikutnya =
      rows.length > limit && halaman.length > 0 ? encodeCursor(halaman[halaman.length - 1]!) : null

    return { rows: halaman, total: Number(hitung[0]?.total ?? 0), nextCursor: berikutnya }
  }

  async findRoleByKey(
    tenantId: string,
    key: string,
  ): Promise<{ id: string; rank: number } | null> {
    const { rows } = await this.db.query<{ id: string; rank: number }>(
      `SELECT id, rank FROM roles
        WHERE key = $1 AND (tenant_id IS NULL OR tenant_id = $2)
        ORDER BY tenant_id NULLS LAST
        LIMIT 1`,
      [key, tenantId],
    )
    return rows[0] ?? null
  }

  async grant(input: {
    id: string
    tenantId: string
    companyId: string
    userId: string
    roleId: string
    grantedBy: string
  }): Promise<'granted' | 'already_exists'> {
    const { rowCount } = await this.db.query(
      `INSERT INTO company_access (id, tenant_id, company_id, user_id, role_id, granted_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, company_id, user_id) DO NOTHING`,
      [input.id, input.tenantId, input.companyId, input.userId, input.roleId, input.grantedBy],
    )
    return (rowCount ?? 0) > 0 ? 'granted' : 'already_exists'
  }
}
