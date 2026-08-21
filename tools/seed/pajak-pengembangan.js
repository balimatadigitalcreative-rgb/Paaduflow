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
 *     DATABASE_URL=... npm run seed:tax-dev
 *
 *   Tenant, company, dan kedua akun PPN dicari sendiri bila tidak disebut.
 *   Bila kandidatnya lebih dari satu — misalnya `seed:dev` yang memasang dua
 *   company — ia berhenti dan menyebutkan kandidatnya, bukan memilih salah satu.
 *   Untuk menyebut sendiri:
 *     DATABASE_URL=... TENANT_ID=... COMPANY_ID=... \
 *     AKUN_PPN_KELUARAN=... AKUN_PPN_MASUKAN=... npm run seed:tax-dev
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import pg from 'pg'

import { pasangKonteks } from './konteks.js'

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

function opsional(nama) {
  const nilai = process.env[nama]
  return nilai === undefined || nilai === '' ? null : nilai
}

/**
 * Menemukan tepat satu baris, atau berhenti sambil menyebutkan kandidatnya.
 *
 * Menebak ketika ada dua kandidat adalah cara paling halus untuk menaruh data
 * pajak di company yang salah. Kesalahan itu tidak menggagalkan apa pun hari
 * ini; ia baru muncul di rekonsiliasi, sebagai selisih yang tidak ada sebabnya.
 */
async function tepatSatu(client, { sql, params, apa, variabel, catatanRls = false }) {
  const { rows } = await client.query(sql, params)

  if (rows.length === 1) return rows[0].id

  if (rows.length === 0) {
    /*
     * Nol baris punya DUA sebab, dan menyamakannya menyesatkan.
     *
     * Basis data memang kosong — atau barisnya ada tetapi tersembunyi RLS
     * karena konteks tenant belum terpasang. Yang kedua tidak dapat dihindari
     * pada pencarian tenant itu sendiri: konteksnya membutuhkan tenantId yang
     * justru sedang dicari.
     *
     * Pesan "tidak ada tenant di basis data ini" pada kasus kedua adalah
     * kebohongan yang mahal — orang akan menjalankan seed:dev lagi dan
     * menggandakan datanya.
     */
    if (catatanRls) {
      const { rows: peran } = await client.query(
        `SELECT current_user AS peran,
                COALESCE((SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user), false)
                  AS bypassrls`,
      )

      if (peran[0].bypassrls === false) {
        throw new Error(
          [
            `Tidak menemukan ${apa} sebagai peran "${peran[0].peran}".`,
            '',
            '  Ada dua kemungkinan, dan keduanya terlihat sama dari sini:',
            '',
            '    1. Basis data memang belum diisi — jalankan `npm run seed:dev`.',
            '    2. Datanya ada, tetapi tersembunyi RLS karena konteks tenant',
            '       belum terpasang. Pencarian tenant tidak dapat memasang',
            '       konteks lebih dulu: konteksnya membutuhkan tenant yang',
            '       justru sedang dicari.',
            '',
            `  Untuk kasus kedua, sebutkan tenant-nya langsung lewat ${variabel}.`,
            '  `npm run seed:dev` mencetak nilainya di akhir.',
          ].join('\n'),
        )
      }
    }

    throw new Error(
      `Tidak ada ${apa} di basis data ini. Jalankan \`npm run seed:dev\` lebih dulu.`,
    )
  }

  const kandidat = rows.map((baris) => `      ${baris.id}  ${baris.label}`).join('\n')
  throw new Error(
    `Ada ${rows.length} ${apa}, dan seed ini tidak menebak.\n\n` +
      `  Kandidat:\n${kandidat}\n\n` +
      `  Pilih satu, lalu sebutkan lewat ${variabel}.`,
  )
}

/**
 * Akun pajak dicari lewat aturan penentuan, bukan lewat nomor akun.
 *
 * Modul tidak pernah menyebut nomor akun, dan seed yang menyebutnya akan
 * berbeda dari bagan akun begitu bagan itu berubah.
 */
function akunPenentuan(client, tenantId, companyId, jenisTransaksi, variabel) {
  return tepatSatu(client, {
    sql: `SELECT a.id, a.code || ' — ' || a.name AS label
            FROM account_determination_rules r
            JOIN accounts a ON a.id = r.account_id
           WHERE r.tenant_id = $1 AND r.company_id = $2 AND r.transaction_type = $3`,
    params: [tenantId, companyId, jenisTransaksi],
    apa: `aturan akun untuk ${jenisTransaksi}`,
    variabel,
  })
}

async function main() {
  const client = new pg.Client({ connectionString: wajib('DATABASE_URL') })
  await client.connect()

  try {
    /*
     * Penemuan otomatis berjalan SEBELUM konteks dipasang, dan itu tidak dapat
     * dihindari: konteks membutuhkan tenantId, sedangkan tenantId justru yang
     * sedang dicari.
     *
     * Di bawah RLS, `SELECT ... FROM tenants` tanpa konteks memulangkan nol
     * baris — bukan galat, melainkan daftar kosong. Tanpa penjelasan di bawah,
     * pesannya akan berbunyi "tidak ada tenant di basis data ini", yang salah
     * dan menyesatkan: tenant-nya ada, ia hanya tidak terlihat.
     */
    const tenantId =
      opsional('TENANT_ID') ??
      (await tepatSatu(client, {
        sql: 'SELECT id, name AS label FROM tenants ORDER BY name',
        params: [],
        apa: 'tenant',
        variabel: 'TENANT_ID',
        catatanRls: true,
      }))

    /*
     * Transaksi dibuka SEBELUM konteks dipasang, dan urutannya tidak boleh
     * dibalik.
     *
     * `set_config(..., true)` adalah SET LOCAL — ia terikat transaksi yang
     * sedang berjalan. Di luar transaksi, setiap pernyataan adalah transaksinya
     * sendiri, jadi konteksnya hilang seketika setelah dipasang dan seluruh
     * kueri berikutnya kembali tidak melihat apa-apa. Kegagalannya sunyi:
     * bukan galat, melainkan nol baris.
     */
    await client.query('BEGIN')
    await pasangKonteks(client, { tenantId })

    const companyId =
      opsional('COMPANY_ID') ??
      (await tepatSatu(client, {
        sql: `SELECT id, legal_name AS label FROM companies
               WHERE tenant_id = $1 ORDER BY legal_name`,
        params: [tenantId],
        apa: 'company pada tenant ini',
        variabel: 'COMPANY_ID',
      }))

    const config = {
      tenantId,
      companyId,
      akun: {
        keluaran:
          opsional('AKUN_PPN_KELUARAN') ??
          (await akunPenentuan(
            client, tenantId, companyId, 'sales.invoice.tax_output', 'AKUN_PPN_KELUARAN',
          )),
        masukan:
          opsional('AKUN_PPN_MASUKAN') ??
          (await akunPenentuan(
            client, tenantId, companyId, 'purchasing.bill.tax_input', 'AKUN_PPN_MASUKAN',
          )),
      },
    }

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
      [
        `Seed pajak PENGEMBANGAN terpasang: ${TARIF_SEMENTARA.length} versi kode, ` +
          `${ATURAN.length} aturan, ${ALOKASI.rangeEnd - ALOKASI.rangeStart + 1} nomor seri.`,
        // Disebutkan supaya terlihat ke MANA ia terpasang — terutama saat
        // keempatnya ditemukan sendiri dan tidak ada yang mengetiknya.
        `  Tenant            : ${config.tenantId}`,
        `  Company           : ${config.companyId}`,
        `  Akun PPN Keluaran : ${config.akun.keluaran}`,
        `  Akun PPN Masukan  : ${config.akun.masukan}`,
        'Seluruh tarifnya adalah angka isian yang BELUM divalidasi konsultan pajak.',
      ].join('\n'),
    )
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    await client.end()
  }
}

await main()
