import { randomUUID } from 'node:crypto'

import { beforeAll, expect, test } from 'vitest'

import { asApp, expectFailure, seedTenant, withClient, type Tenant } from './database.js'

/**
 * Invarian 3 — jurnal tidak berimbang tidak pernah dapat tersimpan.
 *
 * Pemeriksaannya tertunda sampai COMMIT: jurnal dan barisnya disisipkan dalam
 * satu transaksi, jadi setelah baris pertama jurnalnya memang belum berimbang.
 * Test ini karena itu harus memeriksa titik commit, bukan titik insert.
 */

let tenant: Tenant

beforeAll(async () => {
  await withClient(async (client) => {
    tenant = await seedTenant(client, `jurnal-${randomUUID().slice(0, 8)}`)
  })
})

interface Line {
  debit: number
  credit: number
}

async function postJournal(lines: Line[]): Promise<string> {
  const journalId = randomUUID()

  await withClient(async (client) => {
    await asApp(client, tenant.tenantId)
    await client.query('BEGIN')

    await client.query(
      `INSERT INTO journals
         (id, tenant_id, company_id, journal_date, fiscal_year, fiscal_period, type, currency)
       VALUES ($1, $2, $3, current_date, 2026, 8, 'manual', 'IDR')`,
      [journalId, tenant.tenantId, tenant.companyId],
    )

    for (const [index, line] of lines.entries()) {
      await client.query(
        `INSERT INTO journal_lines
           (id, tenant_id, journal_id, line_no, account_id, debit, credit, currency)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'IDR')`,
        [randomUUID(), tenant.tenantId, journalId, index + 1, randomUUID(), line.debit, line.credit],
      )
    }

    await client.query('COMMIT')
  })

  return journalId
}

test('jurnal berimbang tersimpan', async () => {
  const journalId = await postJournal([
    { debit: 1_500_000, credit: 0 },
    { debit: 0, credit: 1_500_000 },
  ])

  await withClient(async (client) => {
    await asApp(client, tenant.tenantId)
    const { rows } = await client.query('SELECT id FROM journals WHERE id = $1', [journalId])
    expect(rows).toHaveLength(1)
  })
})

test('jurnal tidak berimbang gagal di titik commit', async () => {
  const code = await expectFailure(() =>
    postJournal([
      { debit: 1_500_000, credit: 0 },
      { debit: 0, credit: 1_000_000 },
    ]),
  )

  expect(code).toBe('23514')
})

test('selisih satu rupiah pun tetap ditolak', async () => {
  const code = await expectFailure(() =>
    postJournal([
      { debit: 1_500_000, credit: 0 },
      { debit: 0, credit: 1_499_999 },
    ]),
  )

  expect(code).toBe('23514')
})

test('jurnal tanpa satu pun baris ditolak', async () => {
  // Trigger di journal_lines saja tidak akan pernah menyala untuk kasus ini.
  const code = await expectFailure(() => postJournal([]))

  expect(code).toBe('23514')
})

test('satu baris tidak boleh memuat debit dan kredit sekaligus', async () => {
  const code = await expectFailure(() =>
    postJournal([
      { debit: 500_000, credit: 500_000 },
      { debit: 0, credit: 0 },
    ]),
  )

  expect(code).toBe('23514')
})

test('jurnal yang gagal tidak meninggalkan baris apa pun', async () => {
  const journalId = randomUUID()

  await withClient(async (client) => {
    await asApp(client, tenant.tenantId)
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO journals
         (id, tenant_id, company_id, journal_date, fiscal_year, fiscal_period, type, currency)
       VALUES ($1, $2, $3, current_date, 2026, 8, 'manual', 'IDR')`,
      [journalId, tenant.tenantId, tenant.companyId],
    )
    await client.query(
      `INSERT INTO journal_lines
         (id, tenant_id, journal_id, line_no, account_id, debit, credit, currency)
       VALUES ($1, $2, $3, 1, $4, 100, 0, 'IDR')`,
      [randomUUID(), tenant.tenantId, journalId, randomUUID()],
    )
    await expectFailure(() => client.query('COMMIT'))
  })

  await withClient(async (client) => {
    await asApp(client, tenant.tenantId)
    const { rows } = await client.query('SELECT id FROM journal_lines WHERE journal_id = $1', [
      journalId,
    ])
    expect(rows).toHaveLength(0)
  })
})
