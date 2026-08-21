#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   DATA CONTOH UNTUK PENGEMBANGAN — BUKAN DATA SUNGGUHAN
 *
 *   Seluruh nama perusahaan, pelanggan, vendor, NPWP, harga, dan nomor akun di
 *   berkas ini adalah KARANGAN. Tidak satu pun merujuk badan usaha atau orang
 *   yang benar-benar ada. Bagan akunnya disusun agar alur faktur dapat berjalan
 *   dari layar sampai buku besar, bukan agar sesuai standar akuntansi mana pun.
 *
 *   Berkas ini BUKAN migrasi. Ia tidak ada di `migrations/`, tidak ikut
 *   `npm run migrate`, dan tidak akan pernah berjalan di produksi.
 *
 *   Kata sandi kedua akun sengaja sama dan sengaja lemah untuk kemudahan
 *   pengembangan. Jangan pernah memakai basis data yang pernah diisi berkas ini
 *   sebagai basis data produksi.
 *
 *   Cara menjalankan:
 *     DATABASE_URL=postgres://... npm run seed:dev
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { randomUUID } from 'node:crypto'

import { hash } from '@node-rs/argon2'
import pg from 'pg'

import { jelaskanKekurangan, pasangKonteks, periksaKemampuan } from './konteks.js'

const KATA_SANDI = 'kata sandi contoh yang panjang'

const AKUN_ADMIN = { email: 'admin@contoh.test', nama: 'Ayu Admin', peran: 'company_admin' }
const AKUN_STAF = { email: 'staf@contoh.test', nama: 'Budi Staf', peran: 'member' }

/**
 * Dua company dengan tahun fiskal BERBEDA — Januari dan April.
 *
 * Sengaja berbeda: pengalih company yang hanya diuji pada company bertahun
 * fiskal sama tidak pernah membuktikan bahwa periode berjalan ikut berpindah.
 */
const COMPANY = [
  { slug: 'nusantara', nama: 'PT Nusantara Contoh', bulanAwalFiskal: 1 },
  { slug: 'samudra', nama: 'PT Samudra Contoh', bulanAwalFiskal: 4 },
]

/** Bagan akun minimum agar posting faktur menemukan seluruh akun yang dicarinya. */
const BAGAN_AKUN = [
  { kode: '1100', nama: 'Kas dan Bank', jenis: 'asset' },
  { kode: '1200', nama: 'Piutang Usaha', jenis: 'asset', kontrol: 'ar' },
  { kode: '1300', nama: 'Persediaan', jenis: 'asset' },
  { kode: '1450', nama: 'PPN Masukan', jenis: 'asset' },
  { kode: '2100', nama: 'Utang Usaha', jenis: 'liability', kontrol: 'ap' },
  { kode: '2150', nama: 'Penerimaan Barang Belum Ditagih', jenis: 'liability' },
  { kode: '2200', nama: 'PPN Keluaran', jenis: 'liability' },
  { kode: '3100', nama: 'Modal Disetor', jenis: 'equity' },
  { kode: '4100', nama: 'Pendapatan Penjualan', jenis: 'revenue' },
  { kode: '5100', nama: 'Harga Pokok Penjualan', jenis: 'expense' },
  { kode: '5900', nama: 'Selisih Harga Pembelian', jenis: 'expense' },
  { kode: '6100', nama: 'Beban Operasional', jenis: 'expense' },
]

/**
 * Aturan penentuan akun.
 *
 * Modul tidak pernah menyebut nomor akun; ia mengirim jenis transaksi dan
 * lapisan inilah yang menjawab. Tanpa baris di bawah, posting akan MENOLAK
 * dengan pesan yang menyebutkan aturan apa yang kurang — bukan diam-diam
 * memakai akun cadangan (D-011).
 */
const PENENTUAN_AKUN = [
  ['sales.invoice.receivable', '1200'],
  ['sales.invoice.revenue', '4100'],
  ['sales.invoice.tax_output', '2200'],
  ['sales.invoice.cogs', '5100'],
  ['inventory.shipment.stock', '1300'],
  ['purchasing.receipt.stock', '1300'],
  ['purchasing.receipt.clearing', '2150'],
  ['purchasing.bill.payable', '2100'],
  ['purchasing.bill.tax_input', '1450'],
  ['purchasing.bill.price_variance', '5900'],
  ['purchasing.bill.expense', '6100'],
]

const PELANGGAN = [
  { kode: 'C-001', nama: 'PT Cendana Contoh', npwp: '01.111.222.3-444.000' },
  { kode: 'C-002', nama: 'CV Melati Contoh', npwp: '02.222.333.4-555.000' },
  // Sengaja tanpa NPWP: jalur "faktur pajak ditolak karena NPWP kosong" perlu
  // data untuk dilalui.
  { kode: 'C-003', nama: 'Toko Kenanga Contoh', npwp: null },
]

const VENDOR = [
  { kode: 'V-001', nama: 'PT Baja Contoh', npwp: '03.333.444.5-666.000', pkp: true },
  { kode: 'V-002', nama: 'CV Kayu Contoh', npwp: '04.444.555.6-777.000', pkp: true },
  // Vendor non-PKP: PPN dari tagihannya tidak dapat dikreditkan.
  { kode: 'V-003', nama: 'UD Pasir Contoh', npwp: null, pkp: false },
]

const BARANG = [
  { kode: 'SMN-50', nama: 'Semen 50 kg', uom: 'sak', harga: 65_000 },
  { kode: 'BSI-10', nama: 'Besi Beton 10 mm', uom: 'batang', harga: 82_500 },
  { kode: 'PSR-M3', nama: 'Pasir Urug', uom: 'm3', harga: 310_000 },
  { kode: 'CAT-5L', nama: 'Cat Tembok 5 L', uom: 'kaleng', harga: 178_000 },
]

const JASA = { kode: 'JSA-ANG', nama: 'Jasa Angkut', uom: 'rit', harga: 450_000 }

function wajib(nama) {
  const nilai = process.env[nama]
  if (nilai === undefined || nilai === '') {
    throw new Error(`Variabel lingkungan ${nama} belum dipasang.`)
  }
  return nilai
}

/**
 * Dapat dipanggil sebagai fungsi maupun dijalankan langsung.
 *
 * `tools/dev/start.js` memanggilnya sebagai fungsi supaya ia dapat menunggu
 * selesainya dan menampilkan akunnya bersama alamat server — satu keluaran,
 * bukan dua yang harus disatukan pembacanya.
 */
export async function seed(databaseUrl) {
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    // Diperiksa DI AWAL, sebelum satu baris pun ditulis. Kekurangan hak yang
    // baru terlihat di tengah transaksi panjang hanya menghasilkan galat RLS
    // mentah yang tidak menyebutkan cara memperbaikinya.
    const kemampuan = await periksaKemampuan(client)
    const kekurangan = jelaskanKekurangan(kemampuan, 'npm run seed:dev')
    if (kekurangan !== null) throw new Error(kekurangan)

    await client.query('BEGIN')

    // ── Tenant dan company ───────────────────────────────────────────────
    const tenantId = randomUUID()

    /*
     * Konteks dipasang SEBELUM baris tenant disisipkan — mekanisme yang sama
     * dengan `unit-of-work.ts`. Kebijakan `tenants` menuntut
     * `id = paadu.current_tenant_id()` pada WITH CHECK-nya, jadi konteks yang
     * dipasang sesudahnya sudah terlambat.
     */
    await pasangKonteks(client, { tenantId })

    await client.query(
      `INSERT INTO tenants (id, name, slug, region) VALUES ($1, $2, $3, 'id-jkt')`,
      [tenantId, 'Grup Contoh', `contoh-${tenantId.slice(0, 8)}`],
    )

    const companies = []
    for (const spesifikasi of COMPANY) {
      const id = randomUUID()
      await client.query(
        `INSERT INTO companies
           (id, tenant_id, legal_name, slug, default_currency, fiscal_year_start_month)
         VALUES ($1, $2, $3, $4, 'IDR', $5)`,
        [id, tenantId, spesifikasi.nama, `${spesifikasi.slug}-${id.slice(0, 8)}`, spesifikasi.bulanAwalFiskal],
      )
      companies.push({ ...spesifikasi, id })
    }

    // ── Pengguna ─────────────────────────────────────────────────────────
    const passwordHash = await hash(KATA_SANDI, {
      algorithm: 2,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    })

    for (const akun of [AKUN_ADMIN, AKUN_STAF]) {
      const userId = randomUUID()
      await client.query(
        `INSERT INTO users (id, email, full_name, status) VALUES ($1, $2, $3, 'active')`,
        [userId, akun.email, akun.nama],
      )
      await client.query(
        `INSERT INTO user_credentials (user_id, password_hash) VALUES ($1, $2)`,
        [userId, passwordHash],
      )
      await client.query(
        `INSERT INTO tenant_memberships (id, user_id, tenant_id, status, is_owner, joined_at)
         VALUES ($1, $2, $3, 'active', $4, now())`,
        [randomUUID(), userId, tenantId, akun.peran === 'company_admin'],
      )

      // Keduanya diberi akses ke KEDUA company, supaya pengalih company punya
      // sesuatu untuk dialihkan.
      for (const company of companies) {
        await client.query(
          `INSERT INTO company_access (id, tenant_id, company_id, user_id, role_id)
           SELECT $1, $2, $3, $4, id FROM roles WHERE key = $5 AND tenant_id IS NULL`,
          [randomUUID(), tenantId, company.id, userId, akun.peran],
        )
      }
    }

    // ── Isi tiap company ─────────────────────────────────────────────────
    for (const company of companies) {
      const akunPerKode = new Map()
      for (const akun of BAGAN_AKUN) {
        const id = randomUUID()
        await client.query(
          `INSERT INTO accounts
             (id, tenant_id, company_id, code, name, type, is_control, control_of)
           VALUES ($1, $2, $3, $4, $5, $6::account_type, $7, $8::account_control_of)`,
          [
            id, tenantId, company.id, akun.kode, akun.nama, akun.jenis,
            akun.kontrol !== undefined, akun.kontrol ?? null,
          ],
        )
        akunPerKode.set(akun.kode, id)
      }

      for (const [jenisTransaksi, kodeAkun] of PENENTUAN_AKUN) {
        await client.query(
          `INSERT INTO account_determination_rules
             (id, tenant_id, company_id, transaction_type, account_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [randomUUID(), tenantId, company.id, jenisTransaksi, akunPerKode.get(kodeAkun)],
        )
      }

      // Dua akun inilah yang diminta `seed:tax-dev`. Diambil lewat aturan
      // penentuan, bukan dengan menulis ulang nomor akunnya di sini: nomor itu
      // sudah hidup di PENENTUAN_AKUN, dan dua tempat akan berbeda suatu hari.
      const penentuan = new Map(PENENTUAN_AKUN)
      company.akunPajak = {
        keluaran: akunPerKode.get(penentuan.get('sales.invoice.tax_output')),
        masukan: akunPerKode.get(penentuan.get('purchasing.bill.tax_input')),
      }

      const gudangId = randomUUID()
      await client.query(
        `INSERT INTO warehouses (id, tenant_id, company_id, code, name)
         VALUES ($1, $2, $3, 'GD-01', 'Gudang Utama')`,
        [gudangId, tenantId, company.id],
      )

      for (const pelanggan of PELANGGAN) {
        await client.query(
          `INSERT INTO customers (id, tenant_id, company_id, code, name, tax_id, currency)
           VALUES ($1, $2, $3, $4, $5, $6, 'IDR')`,
          [randomUUID(), tenantId, company.id, pelanggan.kode, pelanggan.nama, pelanggan.npwp],
        )
      }

      for (const vendor of VENDOR) {
        await client.query(
          `INSERT INTO vendors (id, tenant_id, company_id, code, name, tax_id, is_pkp, currency)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'IDR')`,
          [randomUUID(), tenantId, company.id, vendor.kode, vendor.nama, vendor.npwp, vendor.pkp],
        )
      }

      for (const barang of [...BARANG, JASA]) {
        await client.query(
          `INSERT INTO items (id, tenant_id, company_id, code, name, type, base_uom)
           VALUES ($1, $2, $3, $4, $5, $6::item_type, $7)`,
          [
            randomUUID(), tenantId, company.id, barang.kode, barang.nama,
            barang.kode === JASA.kode ? 'service' : 'stock', barang.uom,
          ],
        )
      }

      // Stok awal, supaya posting faktur punya barang untuk dikeluarkan dan
      // harga pokok yang bukan nol.
      const { rows: barangStok } = await client.query(
        `SELECT id, code FROM items
          WHERE tenant_id = $1 AND company_id = $2 AND type = 'stock'`,
        [tenantId, company.id],
      )

      for (const barang of barangStok) {
        const spesifikasi = BARANG.find((item) => item.kode === barang.code)
        const qty = 500
        const hargaPokok = Math.round(spesifikasi.harga * 0.7)

        await client.query(
          `INSERT INTO stock_movements
             (id, tenant_id, company_id, item_id, warehouse_id, type, qty_base, unit_cost,
              sequence, source_type)
           VALUES ($1, $2, $3, $4, $5, 'receipt', $6, $7, nextval('stock_movement_sequence'),
                   'seed')`,
          [randomUUID(), tenantId, company.id, barang.id, gudangId, qty, hargaPokok],
        )
        await client.query(
          `INSERT INTO stock_balances
             (tenant_id, company_id, item_id, warehouse_id, qty_on_hand, value)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (tenant_id, item_id, warehouse_id)
             DO UPDATE SET qty_on_hand = stock_balances.qty_on_hand + EXCLUDED.qty_on_hand,
                           value = stock_balances.value + EXCLUDED.value`,
          [tenantId, company.id, barang.id, gudangId, qty, qty * hargaPokok],
        )
      }
    }

    await client.query('COMMIT')

    // Mengembalikan, bukan mencetak. Pemanggilnya yang memutuskan bagaimana
    // menampilkannya — `tools/dev/start.js` menggabungkannya dengan alamat
    // server menjadi satu keluaran.
    return {
      tenantId,
      companies: companies.map((company) => ({
        id: company.id,
        nama: company.nama,
        bulanAwalFiskal: company.bulanAwalFiskal,
        // Ikut dikembalikan supaya rantai ke `seed:tax-dev` tidak menuntut
        // siapa pun membuka basis data untuk mencari empat UUID.
        akunPajak: company.akunPajak,
      })),
      admin: AKUN_ADMIN.email,
      staf: AKUN_STAF.email,
      kataSandi: KATA_SANDI,
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    await client.end()
  }
}

/**
 * Satu baris siap tempel untuk menyalakan `seed:tax-dev` pada satu company.
 *
 * Bentuknya mengikuti shell yang sedang dipakai. Mencetak bentuk bash di
 * PowerShell berarti pembacanya tetap harus menerjemahkan sendiri, dan rantai
 * yang menuntut terjemahan adalah rantai yang tetap putus.
 */
function barisLingkungan(variabel) {
  const pasangan = Object.entries(variabel)
  const awalan =
    process.platform === 'win32'
      ? pasangan.map(([nama, nilai]) => `$env:${nama}="${nilai}"`).join('; ') + '; '
      : pasangan.map(([nama, nilai]) => `${nama}=${nilai}`).join(' ') + ' '
  return `${awalan}npm run seed:tax-dev`
}

/**
 * Dijalankan langsung lewat `npm run seed:dev`.
 *
 * `tools/dev/start.js` mengimpornya sebagai modul, dan blok di bawah tidak
 * boleh ikut jalan saat itu — seed akan berjalan dua kali dan menggandakan
 * seluruh data contoh.
 */
if (process.argv[1]?.endsWith('pengembangan.js') === true) {
  const hasil = await seed(wajib('DATABASE_URL'))

  // Diucapkan keras. Data contoh yang tidak terdengar adalah data contoh yang
  // suatu hari akan disangka sungguhan.
  console.warn(
    [
      '',
      '  DATA CONTOH terpasang. Seluruh isinya karangan.',
      '',
      `  Tenant     : Grup Contoh (${hasil.tenantId})`,
      ...hasil.companies.map(
        (company) => `  Company    : ${company.nama} — tahun fiskal mulai bulan ${company.bulanAwalFiskal}`,
      ),
      '',
      `  Masuk sebagai : ${hasil.admin}  (Admin Company)`,
      `                  ${hasil.staf}  (Anggota)`,
      `  Kata sandi    : ${hasil.kataSandi}`,
      '',
      '  Seed pajak — salin satu baris, sesuai company yang dituju:',
      '',
      ...hasil.companies.flatMap((company) => [
        `    ${company.nama}`,
        `      ${barisLingkungan({
          TENANT_ID: hasil.tenantId,
          COMPANY_ID: company.id,
          AKUN_PPN_KELUARAN: company.akunPajak.keluaran,
          AKUN_PPN_MASUKAN: company.akunPajak.masukan,
        })}`,
        '',
      ]),
      '  Keempatnya juga dapat ditemukan sendiri oleh seed:tax-dev. Yang benar-benar',
      '  perlu disebut hanya COMPANY_ID, dan itu pun karena company di sini ada dua.',
      '',
      '  Jangan pernah memakai basis data ini sebagai basis data produksi.',
      '',
    ].join('\n'),
  )
}
