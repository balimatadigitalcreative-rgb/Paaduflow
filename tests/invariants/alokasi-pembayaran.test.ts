import { randomUUID } from 'node:crypto'

import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { asApp, expectFailure, seedTenant, withClient, type Tenant } from './database.js'

/**
 * Invarian uang untuk penerimaan pembayaran.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *   YANG DIJAGA DI SINI ADALAH BASIS DATANYA, BUKAN LAYANANNYA
 *
 *   Layanan akan menolak lebih dulu dengan pesan yang menyebut sisa per faktur.
 *   Berkas ini menguji lapisan di bawahnya: apa yang terjadi bila ada jalur
 *   tulis yang lupa, atau dua orang menulis bersamaan.
 *
 *   Modul ini akan disalin belasan kali. Yang ikut tersalin adalah bentuk
 *   skemanya — jadi jaminannya harus melekat di sana, bukan di kode yang
 *   mungkin ditulis ulang.
 * ═══════════════════════════════════════════════════════════════════════════
 */

let tenant: Tenant
let customerId: string

/** Faktur terposting senilai `total`, siap dilunasi. */
async function buatFaktur(client: Client, total: number): Promise<string> {
  const id = randomUUID()
  await client.query(
    `INSERT INTO sales_documents
       (id, tenant_id, company_id, doc_type, number, customer_id, document_date,
        currency, total, lifecycle_status, posted_at)
     VALUES ($1, $2, $3, 'invoice', $4, $5, current_date, 'IDR', $6, 'posted', now())`,
    [id, tenant.tenantId, tenant.companyId, `INV-${id.slice(0, 8)}`, customerId, total],
  )
  return id
}

async function buatPenerimaan(
  client: Client,
  amount: number,
  lifecycle = 'draft',
): Promise<string> {
  const id = randomUUID()
  await client.query(
    `INSERT INTO payment_receipts
       (id, tenant_id, company_id, customer_id, received_date, currency, amount, lifecycle_status)
     VALUES ($1, $2, $3, $4, current_date, 'IDR', $5, $6)`,
    [id, tenant.tenantId, tenant.companyId, customerId, amount, lifecycle],
  )
  return id
}

async function alokasikan(
  client: Client,
  receiptId: string,
  dokumenId: string,
  jumlah: number,
): Promise<void> {
  await client.query(
    `INSERT INTO payment_allocations
       (id, tenant_id, company_id, receipt_id, sales_document_id, allocated_amount)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [randomUUID(), tenant.tenantId, tenant.companyId, receiptId, dokumenId, jumlah],
  )
}

beforeAll(async () => {
  await withClient(async (client) => {
    tenant = await seedTenant(client, `bayar-${randomUUID().slice(0, 8)}`)

    customerId = randomUUID()
    await client.query(
      `INSERT INTO customers (id, tenant_id, company_id, code, name, currency)
       VALUES ($1, $2, $3, $4, 'PT Wisata Nusantara', 'IDR')`,
      [customerId, tenant.tenantId, tenant.companyId, `CUST-${customerId.slice(0, 8)}`],
    )
  })
})

afterAll(async () => {
  // Basis data uji dibuang global-setup; tidak ada yang perlu dibersihkan.
})

// ── Penjaga dokumen terposting ──────────────────────────────────────────────

describe('faktur terposting', () => {
  test('settlement_status BOLEH berubah setelah posting', async () => {
    /*
     * Inilah yang membuat seluruh siklus mungkin. Faktur menjadi `paid` justru
     * SETELAH ia diposting — dan sebelum migrasi 0026, `reject_posted_edit`
     * menolak setiap perubahan pada dokumen terposting kecuali
     * `lifecycle_status`, sehingga pelunasan mustahil.
     *
     * Itu bukan celah di D-008 melainkan penjaganya yang terlalu lebar: D-008
     * melarang mengubah ISI, dan CLAUDE.md justru menuntut tiga sumbu status
     * yang bergerak sendiri-sendiri.
     */
    await withClient(async (client) => {
      await asApp(client, tenant.tenantId)
      const faktur = await buatFaktur(client, 1_000_000)

      await client.query(
        `UPDATE sales_documents SET settlement_status = 'paid'
          WHERE tenant_id = $1 AND id = $2`,
        [tenant.tenantId, faktur],
      )

      const { rows } = await client.query(
        `SELECT settlement_status FROM sales_documents WHERE tenant_id = $1 AND id = $2`,
        [tenant.tenantId, faktur],
      )
      expect(rows[0].settlement_status).toBe('paid')
    })
  })

  test('nilai faktur terposting TETAP tidak dapat diubah', async () => {
    /*
     * Setengah lain dari D-008, dan yang jauh lebih penting. Melonggarkan
     * penjaga untuk sumbu status tidak boleh ikut membuka isinya — angka faktur
     * yang berubah setelah masuk buku besar adalah audit trail yang berbohong.
     */
    await withClient(async (client) => {
      await asApp(client, tenant.tenantId)
      const faktur = await buatFaktur(client, 1_000_000)

      const kode = await expectFailure(() =>
        client.query(
          `UPDATE sales_documents SET total = 9_999_999
            WHERE tenant_id = $1 AND id = $2`,
          [tenant.tenantId, faktur],
        ),
      )
      expect(kode).toBe('42501')
    })
  })
})

// ── Batas alokasi ───────────────────────────────────────────────────────────

describe('alokasi tidak boleh melampaui uang yang diterima', () => {
  test('satu alokasi melebihi nilai penerimaan ditolak', async () => {
    await withClient(async (client) => {
      await asApp(client, tenant.tenantId)
      const faktur = await buatFaktur(client, 5_000_000)
      const terima = await buatPenerimaan(client, 1_000_000)

      const kode = await expectFailure(() => alokasikan(client, terima, faktur, 1_500_000))
      expect(kode).toBe('23514')
    })
  })

  test('beberapa alokasi yang JUMLAHNYA melebihi juga ditolak', async () => {
    /*
     * Ini yang tidak dapat ditangkap CHECK biasa: masing-masing baris sah,
     * jumlahnya tidak. Cara paling mudah membuat uang bertambah dari ketiadaan
     * adalah membaginya menjadi beberapa baris yang tampak wajar.
     */
    await withClient(async (client) => {
      await asApp(client, tenant.tenantId)
      const satu = await buatFaktur(client, 5_000_000)
      const dua = await buatFaktur(client, 5_000_000)
      const terima = await buatPenerimaan(client, 1_000_000)

      const kode = await expectFailure(async () => {
        await alokasikan(client, terima, satu, 600_000)
        await alokasikan(client, terima, dua, 600_000)
      })
      expect(kode).toBe('23514')
    })
  })

  test('alokasi yang PERSIS sama dengan nilai penerimaan diterima', async () => {
    // Batasnya `>`, bukan `>=`. Pelunasan penuh adalah kejadian paling biasa.
    await withClient(async (client) => {
      await asApp(client, tenant.tenantId)
      const faktur = await buatFaktur(client, 5_000_000)
      const terima = await buatPenerimaan(client, 1_000_000)

      await alokasikan(client, terima, faktur, 1_000_000)

      const { rows } = await client.query(
        `SELECT SUM(allocated_amount)::numeric AS jumlah FROM payment_allocations
          WHERE tenant_id = $1 AND receipt_id = $2`,
        [tenant.tenantId, terima],
      )
      expect(Number(rows[0].jumlah)).toBe(1_000_000)
    })
  })
})

describe('faktur tidak boleh dilunasi melebihi nilainya', () => {
  test('dua penerimaan yang bersama-sama melebihi total faktur ditolak', async () => {
    await withClient(async (client) => {
      await asApp(client, tenant.tenantId)
      const faktur = await buatFaktur(client, 1_000_000)
      const pertama = await buatPenerimaan(client, 800_000)
      const kedua = await buatPenerimaan(client, 800_000)

      await alokasikan(client, pertama, faktur, 800_000)

      const kode = await expectFailure(() => alokasikan(client, kedua, faktur, 300_000))
      expect(kode).toBe('23514')
    })
  })

  test('pembayaran sebentuk cicilan sampai lunas diterima', async () => {
    await withClient(async (client) => {
      await asApp(client, tenant.tenantId)
      const faktur = await buatFaktur(client, 1_000_000)

      for (const bagian of [400_000, 400_000, 200_000]) {
        const terima = await buatPenerimaan(client, bagian)
        await alokasikan(client, terima, faktur, bagian)
      }

      const { rows } = await client.query(
        `SELECT SUM(allocated_amount)::numeric AS jumlah FROM payment_allocations
          WHERE tenant_id = $1 AND sales_document_id = $2`,
        [tenant.tenantId, faktur],
      )
      expect(Number(rows[0].jumlah)).toBe(1_000_000)
    })
  })

  test('alokasi penerimaan yang DIBATALKAN tidak menahan fakturnya', async () => {
    /*
     * Tanpa pengecualian ini, satu penerimaan yang salah dan sudah dibatalkan
     * akan mengunci fakturnya selamanya — dan orang yang menemukannya akan
     * menyelesaikannya dengan menghapus baris langsung di basis data.
     */
    await withClient(async (client) => {
      await asApp(client, tenant.tenantId)
      const faktur = await buatFaktur(client, 1_000_000)

      const salah = await buatPenerimaan(client, 1_000_000)
      await alokasikan(client, salah, faktur, 1_000_000)
      await client.query(
        `UPDATE payment_receipts SET lifecycle_status = 'cancelled'
          WHERE tenant_id = $1 AND id = $2`,
        [tenant.tenantId, salah],
      )

      const benar = await buatPenerimaan(client, 1_000_000)
      await alokasikan(client, benar, faktur, 1_000_000)

      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS jumlah FROM payment_allocations
          WHERE tenant_id = $1 AND sales_document_id = $2`,
        [tenant.tenantId, faktur],
      )
      expect(rows[0].jumlah).toBe(2)
    })
  })
})

// ── Bentuk tabel ────────────────────────────────────────────────────────────

describe('bentuk yang akan disalin modul berikutnya', () => {
  test('satu faktur hanya boleh muncul sekali per penerimaan', async () => {
    // Dua baris untuk pasangan yang sama adalah cara paling mudah membuat
    // jumlahnya diam-diam berlipat.
    await withClient(async (client) => {
      await asApp(client, tenant.tenantId)
      const faktur = await buatFaktur(client, 1_000_000)
      const terima = await buatPenerimaan(client, 1_000_000)

      await alokasikan(client, terima, faktur, 400_000)
      const kode = await expectFailure(() => alokasikan(client, terima, faktur, 400_000))
      expect(kode).toBe('23505')
    })
  })

  test('alokasi bernilai nol atau negatif ditolak', async () => {
    await withClient(async (client) => {
      await asApp(client, tenant.tenantId)
      const faktur = await buatFaktur(client, 1_000_000)
      const terima = await buatPenerimaan(client, 1_000_000)

      expect(await expectFailure(() => alokasikan(client, terima, faktur, 0))).toBe('23514')
    })
  })

  test('penerimaan bernilai nol ditolak', async () => {
    await withClient(async (client) => {
      await asApp(client, tenant.tenantId)
      expect(await expectFailure(() => buatPenerimaan(client, 0))).toBe('23514')
    })
  })

  test('penerimaan terdaftar sebagai tabel transaksional', async () => {
    /*
     * Registry inilah yang memaksa, bukan fungsi kontraknya. Tabel
     * transaksional yang tidak terdaftar akan menggagalkan
     * `kontrak-tabel.test.ts`.
     */
    await withClient(async (client) => {
      const { rows } = await client.query(
        `SELECT has_settlement, has_fulfillment FROM paadu.transactional_tables
          WHERE table_name = 'payment_receipts'`,
      )
      expect(rows).toHaveLength(1)

      // Penerimaan pembayaran BUKAN dokumen yang menunggu dilunasi atau
      // dipenuhi — ia yang melunasi.
      expect(rows[0].has_settlement).toBe(false)
      expect(rows[0].has_fulfillment).toBe(false)
    })
  })
})
