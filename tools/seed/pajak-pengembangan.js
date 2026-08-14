#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   NILAI SEMENTARA UNTUK PENGEMBANGAN — BUKAN NILAI YANG DAPAT DIPAKAI
 *
 *   Seluruh tarif dan kategori di berkas ini adalah ANGKA ISIAN yang dipilih
 *   agar layar dan pengembangan punya sesuatu untuk ditampilkan. Tidak satu pun
 *   sudah divalidasi konsultan pajak. Lihat V-07 di docs/DECISIONS.md.
 *
 *   Berkas ini BUKAN migrasi. Ia tidak ada di `migrations/`, tidak ikut
 *   `npm run migrate`, dan tidak akan pernah berjalan di produksi. Itulah
 *   seluruh alasan ia diletakkan di sini alih-alih di sana.
 *
 *   Sebelum rilis: hapus data yang dihasilkan berkas ini, lalu masukkan nilai
 *   sungguhan lewat Pengaturan → Pajak → Kode Pajak.
 *
 *   Cara menjalankan:
 *     DATABASE_URL=... TENANT_ID=... COMPANY_ID=... \
 *     AKUN_PPN_KELUARAN=... AKUN_PPN_MASUKAN=... npm run seed:tax-dev
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import pg from 'pg'

/**
 * Angka isian. Dikumpulkan di satu tempat supaya siapa pun yang membaca berkas
 * ini melihatnya sebagai daftar yang harus diganti, bukan sebagai angka yang
 * tersebar di antara SQL.
 *
 * Dua versi PPN keluaran dengan sengaja, supaya jalur "tarif berubah di tengah
 * tahun" punya data untuk dilalui saat pengembangan. Angka 10 dan 11 dipilih
 * karena berbeda satu sama lain, bukan karena keduanya benar.
 */
const TARIF_SEMENTARA = [
  { code: 'PPN-OUT', name: 'PPN Keluaran (sementara)', taxType: 'vat_out', rate: 10,
    validFrom: '2020-01-01', validTo: '2022-04-01', akun: 'keluaran', creditable: false },
  { code: 'PPN-OUT', name: 'PPN Keluaran (sementara)', taxType: 'vat_out', rate: 11,
    validFrom: '2022-04-01', validTo: null, akun: 'keluaran', creditable: false },
  { code: 'PPN-IN', name: 'PPN Masukan (sementara)', taxType: 'vat_in', rate: 11,
    validFrom: '2022-04-01', validTo: null, akun: 'masukan', creditable: true },
  { code: 'PPN-BEBAS', name: 'Dibebaskan (sementara)', taxType: 'exempt', rate: 0,
    validFrom: '2020-01-01', validTo: null, akun: 'keluaran', creditable: false },
]

/**
 * Aturan menunjuk KODE, bukan versi. Perubahan tarif karena itu tidak menyentuh
 * satu pun baris di bawah — D-125.
 */
const ATURAN = [
  { transactionType: 'sales.invoice.tax', partnerIsPkp: null, taxCode: 'PPN-OUT' },
  { transactionType: 'purchasing.bill.tax', partnerIsPkp: true, taxCode: 'PPN-IN' },
  // Vendor non-PKP tidak menerbitkan faktur pajak, jadi tidak ada yang dapat
  // dikreditkan. Aturannya eksplisit supaya penolakannya punya sebab bernama,
  // bukan sekadar "tidak ada aturan".
  { transactionType: 'purchasing.bill.tax', partnerIsPkp: false, taxCode: 'PPN-BEBAS' },
]

/** Seratus nomor: cukup untuk pengembangan, cukup kecil untuk dapat dihabiskan. */
const ALOKASI = { prefix: 'DEV-', digits: 8, rangeStart: 1, rangeEnd: 100 }

function wajib(nama) {
  const nilai = process.env[nama]
  if (nilai === undefined || nilai === '') {
    throw new Error(`Variabel lingkungan ${nama} belum dipasang.`)
  }
  return nilai
}

async function main() {
  const config = {
    tenantId: wajib('TENANT_ID'),
    companyId: wajib('COMPANY_ID'),
    akun: { keluaran: wajib('AKUN_PPN_KELUARAN'), masukan: wajib('AKUN_PPN_MASUKAN') },
  }

  const client = new pg.Client({ connectionString: wajib('DATABASE_URL') })
  await client.connect()

  try {
    await client.query('BEGIN')

    await client.query(
      `INSERT INTO company_tax_profiles
         (tenant_id, company_id, npwp, is_pkp, pkp_effective_date, nppkp, tax_office_code)
       VALUES ($1, $2, '00.000.000.0-000.000', true, DATE '2020-01-01', 'PENGEMBANGAN', '000')
       ON CONFLICT (tenant_id, company_id) DO NOTHING`,
      [config.tenantId, config.companyId],
    )

    for (const kode of TARIF_SEMENTARA) {
      await client.query(
        `INSERT INTO tax_codes
           (id, tenant_id, company_id, code, name, tax_type, rate, valid_from, valid_to,
            calculation_base, gl_account_id, is_creditable)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::date, $8::date, 'net', $9, $10)`,
        [
          config.tenantId, config.companyId, kode.code, kode.name, kode.taxType,
          kode.rate, kode.validFrom, kode.validTo, config.akun[kode.akun], kode.creditable,
        ],
      )
    }

    for (const aturan of ATURAN) {
      await client.query(
        `INSERT INTO tax_determination_rules
           (id, tenant_id, company_id, transaction_type, partner_is_pkp, tax_code)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [config.tenantId, config.companyId, aturan.transactionType, aturan.partnerIsPkp, aturan.taxCode],
      )
    }

    const { rows } = await client.query(
      `INSERT INTO tax_serial_allocations
         (id, tenant_id, company_id, prefix, digits, range_start, range_end, source_reference)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'seed pengembangan')
       RETURNING id`,
      [
        config.tenantId, config.companyId,
        ALOKASI.prefix, ALOKASI.digits, ALOKASI.rangeStart, ALOKASI.rangeEnd,
      ],
    )

    await client.query(
      `INSERT INTO tax_serial_usage
         (tenant_id, company_id, allocation_id, serial_number, formatted_number)
       SELECT $1, $2, $3, nomor, $4 || lpad(nomor::text, $5, '0')
         FROM generate_series($6::bigint, $7::bigint) AS nomor`,
      [
        config.tenantId, config.companyId, rows[0].id,
        ALOKASI.prefix, ALOKASI.digits, ALOKASI.rangeStart, ALOKASI.rangeEnd,
      ],
    )

    await client.query('COMMIT')

    // Diucapkan keras setiap kali. Nilai sementara yang tidak terdengar adalah
    // nilai sementara yang akan sampai ke produksi.
    console.warn(
      `Seed pajak PENGEMBANGAN terpasang: ${TARIF_SEMENTARA.length} versi kode, ` +
        `${ATURAN.length} aturan, ${ALOKASI.rangeEnd - ALOKASI.rangeStart + 1} nomor seri.\n` +
        'Seluruh tarifnya adalah angka isian yang BELUM divalidasi konsultan pajak.',
    )
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    await client.end()
  }
}

await main()
