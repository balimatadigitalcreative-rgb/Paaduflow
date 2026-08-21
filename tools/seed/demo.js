#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   DATA DEMO — BUKAN DATA SUNGGUHAN
 *
 *   Seluruh nama perusahaan, pelanggan, vendor, NPWP, nominal, dan nomor akun
 *   di berkas ini KARANGAN. Tidak satu pun merujuk badan usaha atau orang yang
 *   benar-benar ada.
 *
 *   Berkas ini TERPISAH dari `seed:dev` dan tidak mengubahnya. Keduanya dapat
 *   hidup berdampingan di satu basis data: tenant, slug, dan alamat surel
 *   ketiganya berbeda.
 *
 *   Bedanya dengan seed:dev bukan jumlah data, melainkan tujuannya. seed:dev
 *   menyiapkan data induk secukupnya supaya alur dapat dijalankan. Berkas ini
 *   menyiapkan RIWAYAT — dua belas bulan yang angkanya berjumlah, supaya dasbor
 *   punya sesuatu yang benar untuk dihitung.
 *
 *   Cara menjalankan:
 *     DATABASE_URL=postgres://... npm run seed:demo
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { randomUUID } from 'node:crypto'

import { hash } from '@node-rs/argon2'
import pg from 'pg'

/**
 * Kata sandi demo. Panjang, dapat dibaca lewat telepon, dan tetap contoh.
 *
 * Dicetak keras di akhir bersama seluruh alamat surel. Kredensial demo yang
 * tidak tercetak di mana pun adalah kredensial yang akan hilang, dan yang
 * kehilangannya biasanya orang yang sedang berdiri di depan calon pelanggan.
 */
const KATA_SANDI = 'demo paadu flow 2026 yang panjang'

const SLUG_TENANT = 'paadu-demo'

const AKUN = [
  {
    email: 'budi@demo.paaduflow.id',
    nama: 'Budi Santoso',
    peran: 'tenant_owner',
    jabatan: 'Pemilik Tenant — melihat kedua company, menyetujui dokumen',
  },
  {
    email: 'sari@demo.paaduflow.id',
    nama: 'Sari Wijaya',
    peran: 'tenant_admin',
    jabatan: 'Admin Tenant — mengelola pengguna dan akses',
  },
  {
    email: 'rina@demo.paaduflow.id',
    nama: 'Rina Anggraini',
    peran: 'company_admin',
    jabatan: 'Admin Company — memposting ke buku besar, menelusuri laba rugi',
  },
  {
    email: 'agus@demo.paaduflow.id',
    nama: 'Agus Pratama',
    peran: 'member',
    jabatan: 'Anggota — membuat dan mengajukan faktur',
  },
]

/**
 * Dua company dengan tahun fiskal BERBEDA — Januari dan April.
 *
 * Ini bukan variasi kosmetik. Salah satu hal yang membedakan produk ini adalah
 * berpindah company sekaligus berpindah periode fiskal, dan itu hanya dapat
 * ditunjukkan bila keduanya memang berbeda.
 */
const COMPANY = [
  {
    slug: 'nusantara-jaya',
    nama: 'PT Nusantara Jaya Abadi',
    bulanAwalFiskal: 1,
    npwp: '01.234.567.8-901.000',
    gudang: [
      { kode: 'SBY', nama: 'Gudang Surabaya' },
      { kode: 'MLG', nama: 'Gudang Malang' },
    ],
  },
  {
    slug: 'nusantara-logistik',
    nama: 'PT Nusantara Logistik Prima',
    bulanAwalFiskal: 4,
    npwp: '02.876.543.2-109.000',
    gudang: [{ kode: 'SBY', nama: 'Gudang Surabaya' }],
  },
]

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

const PENENTUAN_AKUN = [
  ['sales.invoice.receivable', '1200'],
  ['sales.invoice.revenue', '4100'],
  ['sales.invoice.tax_output', '2200'],
  ['sales.invoice.cogs', '5100'],
  ['sales.invoice.inventory', '1300'],
  ['purchasing.receipt.inventory', '1300'],
  ['purchasing.receipt.accrual', '2150'],
  ['purchasing.bill.payable', '2100'],
  ['purchasing.bill.tax_input', '1450'],
  ['purchasing.bill.price_variance', '5900'],
]

/** Pelanggan — gaya dan nama mengikuti `docs/mock_data.json`. */
const PELANGGAN = [
  { kode: 'CUS-0001', nama: 'Kopi Kita', npwp: '17.231.479.4-021.000', termin: 30 },
  { kode: 'CUS-0002', nama: 'Warung Sedap', npwp: '24.362.858.7-032.000', termin: 30 },
  { kode: 'CUS-0003', nama: 'Toko Berkah Jaya', npwp: '31.493.337.1-043.000', termin: 30 },
  { kode: 'CUS-0004', nama: 'CV Mandiri Sentosa', npwp: null, termin: 30 },
  { kode: 'CUS-0005', nama: 'Kedai Nusantara', npwp: '45.755.195.7-065.000', termin: 30 },
  { kode: 'CUS-0006', nama: 'PT Rasa Bumi', npwp: '52.886.574.1-076.000', termin: 14 },
  { kode: 'CUS-0007', nama: 'Toko Sinar Abadi', npwp: '59.117.953.4-087.000', termin: 14 },
  { kode: 'CUS-0008', nama: 'CV Karya Mandiri', npwp: null, termin: 30 },
  { kode: 'CUS-0009', nama: 'Warung Bu Tini', npwp: '73.379.811.1-019.000', termin: 30 },
  { kode: 'CUS-0010', nama: 'PT Boga Utama', npwp: '80.510.290.4-030.000', termin: 30 },
  { kode: 'CUS-0011', nama: 'Kafe Senja', npwp: '87.641.669.7-041.000', termin: 30 },
  { kode: 'CUS-0012', nama: 'Toko Pangan Sejahtera', npwp: null, termin: 30 },
  { kode: 'CUS-0013', nama: 'CV Anugerah Rasa', npwp: '11.903.527.4-063.000', termin: 30 },
  { kode: 'CUS-0014', nama: 'PT Sumber Pangan', npwp: '18.134.906.7-074.000', termin: 30 },
  { kode: 'CUS-0015', nama: 'Warung Kopi Tugu', npwp: '25.265.385.1-085.000', termin: 30 },
  { kode: 'CUS-0016', nama: 'Toko Rejeki Baru', npwp: null, termin: 30 },
  { kode: 'CUS-0017', nama: 'CV Bintang Timur', npwp: '39.527.243.7-017.000', termin: 45 },
  { kode: 'CUS-0018', nama: 'PT Citra Boga', npwp: '46.658.622.1-028.000', termin: 30 },
  { kode: 'CUS-0019', nama: 'Kedai Kopi Merdeka', npwp: '53.789.101.4-039.000', termin: 14 },
  { kode: 'CUS-0020', nama: 'Toko Amanah', npwp: null, termin: 30 },
  { kode: 'CUS-0021', nama: 'CV Sejahtera Mulia', npwp: '67.151.859.1-061.000', termin: 30 },
  { kode: 'CUS-0022', nama: 'PT Delta Pangan', npwp: '74.282.338.4-072.000', termin: 30 },
  { kode: 'CUS-0023', nama: 'Warung Mbak Yuni', npwp: '81.413.717.7-083.000', termin: 30 },
  { kode: 'CUS-0024', nama: 'Toko Harapan Jaya', npwp: null, termin: 14 },
  { kode: 'CUS-0025', nama: 'CV Prima Rasa', npwp: '95.675.575.4-015.000', termin: 30 },
]

/** Vendor. Yang non-PKP sengaja ada — faktur pajaknya tidak dapat dikreditkan. */
const VENDOR = [
  { kode: 'VEN-0001', nama: 'PT Gayo Highland', npwp: '20.840.860.4-090.000', pkp: true, termin: 30 },
  { kode: 'VEN-0002', nama: 'CV Lampung Robusta', npwp: '27.971.339.7-011.000', pkp: true, termin: 45 },
  { kode: 'VEN-0003', nama: 'Koperasi Tani Kintamani', npwp: '34.202.718.1-022.000', pkp: true, termin: 14 },
  { kode: 'VEN-0004', nama: 'PT Toraja Prima', npwp: '41.333.197.4-033.000', pkp: true, termin: 30 },
  { kode: 'VEN-0005', nama: 'CV Flores Arabika', npwp: null, pkp: false, termin: 30 },
  { kode: 'VEN-0006', nama: 'PT Kemasan Nusantara', npwp: '55.595.955.1-055.000', pkp: true, termin: 45 },
  { kode: 'VEN-0007', nama: 'CV Label Cetak Jaya', npwp: '62.726.434.4-066.000', pkp: true, termin: 14 },
  { kode: 'VEN-0008', nama: 'PT Logistik Andal', npwp: '69.857.813.7-077.000', pkp: true, termin: 45 },
  { kode: 'VEN-0009', nama: 'CV Mesin Roasting', npwp: '76.988.292.1-088.000', pkp: true, termin: 14 },
  { kode: 'VEN-0010', nama: 'PT Gula Manis', npwp: null, pkp: false, termin: 45 },
  { kode: 'VEN-0011', nama: 'CV Susu Segar', npwp: '90.350.150.7-020.000', pkp: true, termin: 30 },
  { kode: 'VEN-0012', nama: 'PT Kardus Sejahtera', npwp: '97.481.529.1-031.000', pkp: true, termin: 30 },
  { kode: 'VEN-0013', nama: 'CV Bali Kintamani', npwp: '14.612.908.4-042.000', pkp: true, termin: 30 },
  { kode: 'VEN-0014', nama: 'PT Java Preanger', npwp: '21.743.387.7-053.000', pkp: true, termin: 30 },
  { kode: 'VEN-0015', nama: 'CV Papua Wamena', npwp: null, pkp: false, termin: 30 },
  { kode: 'VEN-0016', nama: 'PT Sumatra Mandheling', npwp: '35.105.245.4-075.000', pkp: true, termin: 30 },
  { kode: 'VEN-0017', nama: 'CV Aceh Gayo Tani', npwp: '42.236.624.7-086.000', pkp: true, termin: 30 },
  { kode: 'VEN-0018', nama: 'PT Rempah Nusantara', npwp: '49.367.103.1-097.000', pkp: true, termin: 14 },
  { kode: 'VEN-0019', nama: 'CV Plastik Kemas', npwp: '56.498.482.4-018.000', pkp: true, termin: 45 },
  { kode: 'VEN-0020', nama: 'PT Ekspedisi Cepat', npwp: null, pkp: false, termin: 45 },
]

/**
 * Barang dan jasa. Harga diambil dari `mock_data.json` apa adanya.
 *
 * Tidak ada yang bulat, dan itu disengaja: angka bulat sempurna
 * menyembunyikan masalah pembulatan yang baru muncul di produksi
 * (Screen_Specs, Aturan Kualitas).
 */
const BARANG = [
  { kode: 'BRG-0001', nama: 'Kopi Arabika Gayo 1 kg', uom: 'PCS', jual: 176500, pokok: 128250 },
  { kode: 'BRG-0002', nama: 'Kopi Arabika Gayo 500 g', uom: 'PCS', jual: 91500, pokok: 67500 },
  { kode: 'BRG-0003', nama: 'Kopi Arabika Gayo 250 g', uom: 'PCS', jual: 49500, pokok: 37750 },
  { kode: 'BRG-0004', nama: 'Kopi Arabika Gayo 200 g', uom: 'PCS', jual: 42000, pokok: 29750 },
  { kode: 'BRG-0005', nama: 'Kopi Robusta Lampung 1 kg', uom: 'PCS', jual: 178500, pokok: 135250 },
  { kode: 'BRG-0006', nama: 'Kopi Robusta Lampung 500 g', uom: 'PCS', jual: 91500, pokok: 62250 },
  { kode: 'BRG-0007', nama: 'Kopi Robusta Lampung 250 g', uom: 'PCS', jual: 57500, pokok: 42750 },
  { kode: 'BRG-0008', nama: 'Kopi Robusta Lampung 200 g', uom: 'PCS', jual: 44000, pokok: 33750 },
  { kode: 'BRG-0009', nama: 'Kopi Arabika Kintamani 1 kg', uom: 'PCS', jual: 218000, pokok: 159000 },
  { kode: 'BRG-0010', nama: 'Kopi Arabika Kintamani 500 g', uom: 'PCS', jual: 111000, pokok: 82500 },
  { kode: 'BRG-0011', nama: 'Kopi Arabika Kintamani 250 g', uom: 'PCS', jual: 53500, pokok: 34750 },
  { kode: 'BRG-0012', nama: 'Kopi Arabika Kintamani 200 g', uom: 'PCS', jual: 41500, pokok: 28250 },
  { kode: 'BRG-0013', nama: 'Kopi Arabika Toraja 1 kg', uom: 'PCS', jual: 183500, pokok: 140500 },
  { kode: 'BRG-0014', nama: 'Kopi Arabika Toraja 500 g', uom: 'PCS', jual: 112500, pokok: 81000 },
  { kode: 'BRG-0015', nama: 'Kopi Arabika Toraja 250 g', uom: 'PCS', jual: 48000, pokok: 32500 },
  { kode: 'BRG-0016', nama: 'Kopi Arabika Toraja 200 g', uom: 'PCS', jual: 39500, pokok: 27500 },
  { kode: 'BRG-0017', nama: 'Kopi Arabika Flores 1 kg', uom: 'PCS', jual: 207000, pokok: 151750 },
  { kode: 'BRG-0018', nama: 'Kopi Arabika Flores 500 g', uom: 'PCS', jual: 91500, pokok: 60000 },
  { kode: 'BRG-0019', nama: 'Kopi Arabika Flores 250 g', uom: 'PCS', jual: 58000, pokok: 44000 },
  { kode: 'BRG-0020', nama: 'Kopi Arabika Flores 200 g', uom: 'PCS', jual: 49000, pokok: 33250 },
  { kode: 'BRG-0021', nama: 'Kopi Robusta Temanggung 1 kg', uom: 'PCS', jual: 170500, pokok: 121500 },
  { kode: 'BRG-0022', nama: 'Kopi Robusta Temanggung 500 g', uom: 'PCS', jual: 114000, pokok: 86500 },
  { kode: 'BRG-0023', nama: 'Kopi Robusta Temanggung 250 g', uom: 'PCS', jual: 47000, pokok: 30750 },
  { kode: 'BRG-0024', nama: 'Kopi Robusta Temanggung 200 g', uom: 'PCS', jual: 43500, pokok: 33250 },
]

const JASA = [
  { kode: 'JSA-0041', nama: 'Jasa roasting custom', uom: 'UNIT', jual: 450000, pokok: 247500 },
  { kode: 'JSA-0042', nama: 'Jasa grinding', uom: 'UNIT', jual: 120000, pokok: 66000 },
  { kode: 'JSA-0043', nama: 'Biaya pengiriman', uom: 'UNIT', jual: 1250000, pokok: 687500 },
  { kode: 'JSA-0044', nama: 'Jasa cupping & QC', uom: 'UNIT', jual: 750000, pokok: 412500 },
]

const PPN = 11

function wajib(nama) {
  const nilai = process.env[nama]
  if (nilai === undefined || nilai === '') {
    throw new Error(`${nama} belum dipasang. Contoh: DATABASE_URL=postgres://... npm run seed:demo`)
  }
  return nilai
}

/**
 * Deret bulan, dari sebelas bulan lalu sampai bulan berjalan.
 *
 * Selalu dua belas, dan selalu berakhir di bulan ini — sama dengan sumbu yang
 * dibaca dasbor. Kalau keduanya berbeda, grafik akan memulai atau mengakhiri di
 * tempat yang tidak ada datanya.
 */
function deretBulan(hariIni) {
  const daftar = []
  for (let mundur = 11; mundur >= 0; mundur -= 1) {
    const tanggal = new Date(
      Date.UTC(hariIni.getUTCFullYear(), hariIni.getUTCMonth() - mundur, 1),
    )
    daftar.push({
      kunci: tanggal.toISOString().slice(0, 7),
      tahun: tanggal.getUTCFullYear(),
      bulan: tanggal.getUTCMonth() + 1,
      mundur,
    })
  }
  return daftar
}

/**
 * Tren yang masuk akal, dan sengaja TIDAK acak.
 *
 * Pertumbuhan sekitar 4% per bulan dengan dua puncak musiman — Ramadan dan
 * akhir tahun. Deterministik supaya dua kali menjalankan seed menghasilkan
 * grafik yang sama; demo yang angkanya berubah setiap kali dijalankan adalah
 * demo yang tidak dapat dilatih.
 */
function targetBulanan(indeks, bulan) {
  const dasar = 180_000_000 * Math.pow(1.04, indeks)
  const musiman = bulan === 3 || bulan === 4 ? 1.28 : bulan === 12 ? 1.18 : bulan === 1 ? 0.86 : 1
  // Riak kecil supaya garisnya tidak terlihat seperti rumus.
  const riak = 1 + ((indeks * 37) % 11) / 100 - 0.05
  return Math.round((dasar * musiman * riak) / 1000) * 1000
}

/** `YYYY-MM-DD` dari komponen tanggal, tanpa zona waktu. */
function tanggal(tahun, bulan, hari) {
  return `${tahun}-${String(bulan).padStart(2, '0')}-${String(hari).padStart(2, '0')}`
}

export async function seedDemo(connectionString) {
  const client = new pg.Client({ connectionString })
  await client.connect()

  try {
    const { rows: sudahAda } = await client.query(
      `SELECT id FROM tenants WHERE slug = $1`,
      [SLUG_TENANT],
    )

    /*
     * Menolak, bukan menimpa.
     *
     * `journals` dan `journal_lines` append-only: peran aplikasi tidak punya
     * DELETE di sana, dan itu memang disengaja. Seed yang "membersihkan lebih
     * dulu" akan menuntut hak yang seluruh sistem ini dibangun untuk menolak.
     * Lebih jujur berhenti dan menyebutkan apa yang harus dilakukan.
     */
    if (sudahAda.length > 0) {
      throw new Error(
        [
          `Tenant demo "${SLUG_TENANT}" sudah ada di basis data ini.`,
          '',
          '  Seed ini tidak menimpa apa pun. Jurnal bersifat append-only, dan',
          '  membersihkannya lebih dulu menuntut hak DELETE yang sengaja tidak',
          '  dimiliki peran aplikasi.',
          '',
          '  Pakai basis data kosong, atau buat ulang:',
          '    dropdb <nama> && createdb <nama> && npm run migrate && npm run seed:demo',
        ].join('\n'),
      )
    }

    await client.query('BEGIN')

    const hariIni = new Date()
    const bulanan = deretBulan(hariIni)
    const passwordHash = await hash(KATA_SANDI)

    const tenantId = randomUUID()
    await client.query(
      `INSERT INTO tenants (id, name, slug, region) VALUES ($1, $2, $3, 'id-jkt')`,
      [tenantId, 'Grup Demo Paadu', SLUG_TENANT],
    )

    const companies = COMPANY.map((spesifikasi) => ({ ...spesifikasi, id: randomUUID() }))
    for (const company of companies) {
      await client.query(
        `INSERT INTO companies
           (id, tenant_id, legal_name, slug, tax_id, default_currency, fiscal_year_start_month)
         VALUES ($1, $2, $3, $4, $5, 'IDR', $6)`,
        [company.id, tenantId, company.nama, company.slug, company.npwp, company.bulanAwalFiskal],
      )
    }

    for (const akun of AKUN) {
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
        [randomUUID(), userId, tenantId, akun.peran === 'tenant_owner'],
      )
      for (const company of companies) {
        await client.query(
          `INSERT INTO company_access (id, tenant_id, company_id, user_id, role_id)
           SELECT $1, $2, $3, $4, id FROM roles WHERE key = $5 AND tenant_id IS NULL`,
          [randomUUID(), tenantId, company.id, userId, akun.peran],
        )
      }
    }

    const ringkasan = []

    for (const [nomorCompany, company] of companies.entries()) {
      const akunPerKode = new Map()
      for (const akun of BAGAN_AKUN) {
        const id = randomUUID()
        await client.query(
          `INSERT INTO accounts
             (id, tenant_id, company_id, code, name, type, is_control, control_of)
           VALUES ($1, $2, $3, $4, $5, $6::account_type, $7, $8::account_control_of)`,
          [id, tenantId, company.id, akun.kode, akun.nama, akun.jenis,
           akun.kontrol !== undefined, akun.kontrol ?? null],
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

      // Gudang per company. Yang pertama punya dua, yang kedua satu - stok
      // multi-gudang hanya terlihat bila memang ada lebih dari satu.
      const gudang = []
      for (const spesifikasi of company.gudang) {
        const id = randomUUID()
        await client.query(
          `INSERT INTO warehouses (id, tenant_id, company_id, code, name)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, tenantId, company.id, spesifikasi.kode, spesifikasi.nama],
        )
        gudang.push({ ...spesifikasi, id })
      }

      const pelanggan = []
      for (const spesifikasi of PELANGGAN) {
        const id = randomUUID()
        await client.query(
          `INSERT INTO customers (id, tenant_id, company_id, code, name, tax_id, currency)
           VALUES ($1, $2, $3, $4, $5, $6, 'IDR')`,
          [id, tenantId, company.id, spesifikasi.kode, spesifikasi.nama, spesifikasi.npwp],
        )
        pelanggan.push({ ...spesifikasi, id })
      }

      const vendor = []
      for (const spesifikasi of VENDOR) {
        const id = randomUUID()
        await client.query(
          `INSERT INTO vendors (id, tenant_id, company_id, code, name, tax_id, is_pkp, currency)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'IDR')`,
          [id, tenantId, company.id, spesifikasi.kode, spesifikasi.nama, spesifikasi.npwp,
           spesifikasi.pkp],
        )
        vendor.push({ ...spesifikasi, id })
      }

      const barang = []
      for (const spesifikasi of BARANG) {
        const id = randomUUID()
        await client.query(
          `INSERT INTO items (id, tenant_id, company_id, code, name, type, base_uom)
           VALUES ($1, $2, $3, $4, $5, 'stock', $6)`,
          [id, tenantId, company.id, spesifikasi.kode, spesifikasi.nama, spesifikasi.uom],
        )
        barang.push({ ...spesifikasi, id })
      }

      const jasa = []
      for (const spesifikasi of JASA) {
        const id = randomUUID()
        await client.query(
          `INSERT INTO items (id, tenant_id, company_id, code, name, type, base_uom)
           VALUES ($1, $2, $3, $4, $5, 'service', $6)`,
          [id, tenantId, company.id, spesifikasi.kode, spesifikasi.nama, spesifikasi.uom],
        )
        jasa.push({ ...spesifikasi, id })
      }

      /*
       * Stok awal dibagi ke seluruh gudang, tidak rata.
       *
       * Tidak rata dengan sengaja: gudang yang isinya persis sama di setiap
       * item terlihat seperti data yang dibangkitkan, dan layar stok
       * multi-gudang tidak menguji apa pun bila setiap kolomnya kembar.
       */
      for (const [nomor, item] of barang.entries()) {
        for (const [nomorGudang, tempat] of gudang.entries()) {
          const qty = 1800 + ((nomor * 7 + nomorGudang * 13) % 9) * 200
          await client.query(
            `INSERT INTO stock_movements
               (id, tenant_id, company_id, item_id, warehouse_id, type, qty_base, unit_cost,
                sequence, source_type)
             VALUES ($1, $2, $3, $4, $5, 'receipt', $6, $7, nextval('stock_movement_sequence'),
                     'seed-demo')`,
            [randomUUID(), tenantId, company.id, item.id, tempat.id, qty, item.pokok],
          )
          await client.query(
            `INSERT INTO stock_balances
               (tenant_id, company_id, item_id, warehouse_id, qty_on_hand, value)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (tenant_id, item_id, warehouse_id)
               DO UPDATE SET qty_on_hand = stock_balances.qty_on_hand + EXCLUDED.qty_on_hand,
                             value = stock_balances.value + EXCLUDED.value`,
            [tenantId, company.id, item.id, tempat.id, qty, qty * item.pokok],
          )
        }
      }

      const hasil = await isiRiwayat(client, {
        tenantId,
        company,
        bulanan,
        pelanggan,
        vendor,
        barang,
        jasa,
        gudang,
        akunPerKode,
        // Company kedua dibuat lebih kecil, supaya berpindah company benar-benar
        // memindahkan angka dan bukan hanya nama di pojok atas.
        skala: nomorCompany === 0 ? 1 : 0.42,
        hariIni,
      })

      ringkasan.push({ company, ...hasil })
    }

    await client.query('COMMIT')

    return { tenantId, ringkasan, akun: AKUN, kataSandi: KATA_SANDI }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    await client.end()
  }
}

/**
 * Menyusun dua sampai empat baris yang jumlahnya mendekati target.
 *
 * Baris-baris awal memakai kuantitas "wajar" — kelipatan lusin, seperti orang
 * memesan sungguhan. Baris TERAKHIR menyerap sisanya, sehingga kuantitasnya
 * bisa berupa angka ganjil seperti 669. Itu bukan cacat: `mock_data.json`
 * memakai teknik yang sama persis, dan hasilnya justru lebih meyakinkan
 * daripada deretan angka bulat.
 *
 * Harga tidak pernah dikarang di sini. Ia selalu harga jual barangnya, karena
 * faktur yang harganya tidak cocok dengan daftar barang adalah hal pertama yang
 * ditanyakan orang keuangan.
 */
function susunBaris({ barang, jasa, targetDpp, persenDiskon, benih }) {
  // Target DPP dikembalikan ke bruto lebih dulu; diskon dihitung DARI subtotal.
  const targetBruto = Math.round(targetDpp / (1 - persenDiskon / 100))
  const jumlahBaris = 2 + (benih % 3)

  const dipakai = []
  const KUANTITAS = [12, 24, 36, 48, 60, 96, 120]

  for (let nomor = 0; nomor < jumlahBaris - 1; nomor += 1) {
    // Satu baris jasa sesekali, supaya faktur tidak selalu berisi barang saja.
    const pakaiJasa = nomor === 1 && (benih % 4) === 0
    const daftar = pakaiJasa ? jasa : barang
    const item = daftar[(benih * 3 + nomor * 11) % daftar.length]
    const qty = KUANTITAS[(benih + nomor * 5) % KUANTITAS.length]
    dipakai.push({ item, qty, bruto: qty * item.jual })
  }

  const sudah = dipakai.reduce((jumlah, satu) => jumlah + satu.bruto, 0)
  const penutup = barang[(benih * 7 + 3) % barang.length]
  const qtyPenutup = Math.max(1, Math.round((targetBruto - sudah) / penutup.jual))
  dipakai.push({ item: penutup, qty: qtyPenutup, bruto: qtyPenutup * penutup.jual })

  return dipakai
}

/**
 * Riwayat satu company: faktur terposting per bulan, lalu dokumen berstatus
 * lain di bulan berjalan.
 *
 * Setiap faktur terposting melahirkan jurnal yang seimbang — debit piutang,
 * kredit pendapatan, kredit PPN keluaran. Itu yang membuat dasbor benar:
 * angkanya dibaca dari jurnal, jadi faktur tanpa jurnal akan tampil sebagai
 * piutang yang tidak punya pendapatan.
 */
async function isiRiwayat(client, konteks) {
  const { tenantId, company, bulanan, pelanggan, vendor, barang, jasa, gudang, akunPerKode,
          skala, hariIni } = konteks

  let nomorUrut = 0
  let totalPendapatan = 0
  let piutangBeredar = 0
  let jumlahFaktur = 0

  for (const [indeks, bulan] of bulanan.entries()) {
    const target = Math.round(targetBulanan(indeks, bulan.bulan) * skala)
    const jumlahBulanIni = 3 + (indeks % 3)
    let tersisa = target

    for (let nomor = 0; nomor < jumlahBulanIni; nomor += 1) {
      const terakhir = nomor === jumlahBulanIni - 1
      const targetDpp = terakhir ? tersisa : Math.round(target / jumlahBulanIni / 1000) * 1000
      tersisa -= targetDpp
      if (targetDpp <= 0) continue

      const kepada = pelanggan[(indeks * 7 + nomor * 3) % pelanggan.length]

      /*
       * Diskon dokumen 5% pada sebagian faktur, mengikuti mock_data.json.
       *
       * Bukan hiasan: diskon dokumen dialokasikan PROPORSIONAL ke baris, bukan
       * dikurangkan di akhir (Archetype 4). Pajak dihitung per baris di atas
       * neto setelah alokasi, jadi dua cara itu menghasilkan angka pajak yang
       * berbeda — dan bedanya bukan selisih tampilan, melainkan selisih
       * pelaporan pajak.
       */
      const persenDiskon = (indeks + nomor) % 3 === 0 ? 5 : 0

      const baris = susunBaris({
        barang,
        jasa,
        targetDpp,
        persenDiskon,
        benih: indeks * 13 + nomor * 5,
      })

      const subtotal = baris.reduce((jumlah, satu) => jumlah + satu.bruto, 0)
      const diskon = Math.round((subtotal * persenDiskon) / 100)
      const dpp = subtotal - diskon

      // Alokasi proporsional, dengan baris terakhir menyerap sisa pembulatan.
      // Tanpa itu, jumlah neto per baris tidak sama dengan DPP dokumen, dan
      // selisih beberapa rupiah itulah yang akan dikejar akuntan berjam-jam.
      let sisaAlokasi = diskon
      let sisaPajak = 0
      baris.forEach((satu, nomorBaris) => {
        const bagian = nomorBaris === baris.length - 1
          ? sisaAlokasi
          : Math.round((diskon * satu.bruto) / subtotal)
        sisaAlokasi -= bagian
        satu.alokasi = bagian
        satu.neto = satu.bruto - bagian
      })

      const pajak = Math.round((dpp * PPN) / 100)
      baris.forEach((satu, nomorBaris) => {
        satu.pajak = nomorBaris === baris.length - 1
          ? pajak - sisaPajak
          : Math.round((satu.neto * PPN) / 100)
        if (nomorBaris < baris.length - 1) sisaPajak += satu.pajak
      })

      const total = dpp + pajak
      const hari = 3 + nomor * 5
      const tanggalDokumen = tanggal(bulan.tahun, bulan.bulan, Math.min(hari, 27))

      nomorUrut += 1
      const nomorFaktur = `INV/${bulan.tahun}/${String(bulan.bulan).padStart(2, '0')}/${String(nomorUrut).padStart(4, '0')}`

      /*
       * Pelunasan menurut umur, bukan acak.
       *
       * Faktur lama sudah lunas; dua bulan terakhir masih berjalan. Satu faktur
       * di bulan ketiga dari belakang sengaja dibiarkan menunggak dan sudah
       * lewat jatuh tempo, supaya kartu "piutang jatuh tempo" punya isi dan
       * bukan sekadar nol yang terlihat rapi.
       */
      const menunggak = bulan.mundur === 2 && nomor === 0
      const pelunasan = menunggak
        ? 'unpaid'
        : bulan.mundur >= 3
          ? 'paid'
          : bulan.mundur === 0 && terakhir
            ? 'partially_paid'
            : 'unpaid'

      const jatuhTempo = menunggak
        ? tanggal(bulan.tahun, bulan.bulan, Math.min(hari + 3, 28))
        : tambahHari(tanggalDokumen, kepada.termin)

      const documentId = randomUUID()
      await client.query(
        `INSERT INTO sales_documents
           (id, tenant_id, company_id, doc_type, number, customer_id, document_date, due_date,
            currency, subtotal, document_discount, tax_base, tax_total, total,
            lifecycle_status, settlement_status, fulfillment_status, posted_at)
         VALUES ($1, $2, $3, 'invoice', $4, $5, $6::date, $7::date, 'IDR',
                 $8, $9, $10, $11, $12, 'posted', $13::settlement_status, 'fulfilled',
                 $6::timestamptz)`,
        [documentId, tenantId, company.id, nomorFaktur, kepada.id, tanggalDokumen, jatuhTempo,
         subtotal, diskon, dpp, pajak, total, pelunasan],
      )

      for (const [nomorBaris, satu] of baris.entries()) {
        await client.query(
          `INSERT INTO sales_document_lines
             (id, tenant_id, company_id, document_id, line_no, item_id, description, qty, uom,
              unit_price, allocated_doc_discount, net_amount, tax_rate_pct, tax_amount,
              qty_delivered)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $8)`,
          [randomUUID(), tenantId, company.id, documentId, nomorBaris + 1, satu.item.id,
           satu.item.nama, satu.qty, satu.item.uom, satu.item.jual, satu.alokasi, satu.neto,
           PPN, satu.pajak],
        )
      }

      await jurnal(client, {
        tenantId,
        companyId: company.id,
        tanggal: tanggalDokumen,
        tahun: bulan.tahun,
        periode: bulan.bulan,
        deskripsi: `Faktur ${nomorFaktur} — ${kepada.nama}`,
        baris: [
          { akun: akunPerKode.get('1200'), debit: total, credit: 0 },
          { akun: akunPerKode.get('4100'), debit: 0, credit: dpp },
          { akun: akunPerKode.get('2200'), debit: 0, credit: pajak },
        ],
      })

      totalPendapatan += dpp
      jumlahFaktur += 1
      if (pelunasan !== 'paid') piutangBeredar += total
    }
  }

  // ── Dokumen berstatus lain, di bulan berjalan ────────────────────────────
  const bulanIni = bulanan[bulanan.length - 1]
  const statusLain = [
    { status: 'draft', pelanggan: pelanggan[1], dpp: Math.round(34_500_000 * skala) },
    { status: 'draft', pelanggan: pelanggan[3], dpp: Math.round(7_250_000 * skala) },
    { status: 'submitted', pelanggan: pelanggan[0], dpp: Math.round(128_000_000 * skala) },
    { status: 'pending_approval', pelanggan: pelanggan[2], dpp: Math.round(96_400_000 * skala) },
  ]

  for (const [nomor, spesifikasi] of statusLain.entries()) {
    const pajak = Math.round((spesifikasi.dpp * PPN) / 100)
    // Draf TIDAK bernomor — nomor diberikan saat submit (D-007). Ini salah satu
    // hal yang paling cepat terlihat salah oleh orang keuangan bila dilanggar.
    const bernomor = spesifikasi.status !== 'draft'
    nomorUrut += 1
    const tanggalDokumen = tanggal(bulanIni.tahun, bulanIni.bulan, Math.min(2 + nomor * 3, 27))

    const documentId = randomUUID()
    await client.query(
      `INSERT INTO sales_documents
         (id, tenant_id, company_id, doc_type, number, customer_id, document_date, due_date,
          currency, subtotal, tax_base, tax_total, total,
          lifecycle_status, settlement_status, fulfillment_status)
       VALUES ($1, $2, $3, 'invoice', $4, $5, $6::date, $7::date, 'IDR',
               $8, $8, $9, $10, $11::lifecycle_status, 'unpaid', 'not_fulfilled')`,
      [
        documentId, tenantId, company.id,
        bernomor
          ? `INV/${bulanIni.tahun}/${String(bulanIni.bulan).padStart(2, '0')}/${String(nomorUrut).padStart(4, '0')}`
          : null,
        spesifikasi.pelanggan.id, tanggalDokumen, tambahHari(tanggalDokumen, 30),
        spesifikasi.dpp, pajak, spesifikasi.dpp + pajak, spesifikasi.status,
      ],
    )
    await client.query(
      `INSERT INTO sales_document_lines
         (id, tenant_id, company_id, document_id, line_no, item_id, description, qty, uom,
          unit_price, net_amount, tax_rate_pct, tax_amount)
       VALUES ($1, $2, $3, $4, 1, $5, $6, 1, $7, $8, $8, $9, $10)`,
      [randomUUID(), tenantId, company.id, documentId, barang[nomor % barang.length].id,
       barang[nomor % barang.length].nama, barang[nomor % barang.length].uom,
       spesifikasi.dpp, PPN, pajak],
    )
  }

  // ── Pembelian: penerimaan sebagian dan satu tagihan exception ────────────
  const pembelian = await isiPembelian(client, {
    tenantId, company, vendor, barang, gudang, bulanIni, skala,
  })

  /*
   * Menunggu persetujuan dihitung dari KEDUA sisi.
   *
   * Uji menangkap ini: ringkasan seed sempat menyebut 2 sementara dasbor
   * menyebut 3, karena dasbor ikut menghitung pesanan pembelian. Dasbor yang
   * benar — dokumen yang menunggu keputusan tidak berhenti menunggu hanya
   * karena ia datang dari modul lain. Angka yang dilaporkan seed harus sama
   * dengan angka yang dilihat orang di layar, atau demo ini akan membantah
   * dirinya sendiri.
   */
  const menungguPenjualan = statusLain.filter(
    (satu) => satu.status === 'submitted' || satu.status === 'pending_approval',
  ).length

  return {
    jumlahFaktur,
    totalPendapatan,
    piutangBeredar,
    draf: statusLain.filter((satu) => satu.status === 'draft').length,
    ...pembelian,
    menungguPersetujuan: menungguPenjualan + pembelian.menungguPembelian,
    hariIni: hariIni.toISOString().slice(0, 10),
  }
}

/**
 * Tiga pesanan pembelian dan satu tagihan.
 *
 * Yang pertama diterima penuh, yang kedua BARU SEBAGIAN, yang ketiga belum
 * sama sekali. Penerimaan sebagian adalah keadaan yang paling sering terjadi di
 * gudang dan paling sering hilang dari demo — padahal justru itu yang membuat
 * pencocokan tiga arah terasa perlu.
 */
async function isiPembelian(client, konteks) {
  const { tenantId, company, vendor, barang, bulanIni, skala } = konteks

  const pesanan = [
    { vendor: vendor[0], item: barang[0], qty: 120, terima: 120, status: 'approved', hari: 3 },
    { vendor: vendor[1], item: barang[1], qty: 200, terima: 75, status: 'approved', hari: 9 },
    { vendor: vendor[2], item: barang[2], qty: 90, terima: 0, status: 'pending_approval', hari: 15 },
  ]

  for (const [nomor, spesifikasi] of pesanan.entries()) {
    // Harga beli adalah harga pokok barangnya, bukan turunan harga jual.
    const hargaBeli = spesifikasi.item.pokok
    const dpp = Math.round(hargaBeli * spesifikasi.qty * skala)
    const pajak = spesifikasi.vendor.pkp ? Math.round((dpp * PPN) / 100) : 0
    const tanggalDokumen = tanggal(bulanIni.tahun, bulanIni.bulan, spesifikasi.hari)

    const documentId = randomUUID()
    await client.query(
      `INSERT INTO purchase_documents
         (id, tenant_id, company_id, doc_type, number, vendor_id, issue_date, currency,
          subtotal, tax_base, tax_total, total, lifecycle_status, match_status)
       VALUES ($1, $2, $3, 'purchase_order', $4, $5, $6::date, 'IDR',
               $7, $7, $8, $9, $10::lifecycle_status, 'not_matched')`,
      [documentId, tenantId, company.id,
       `PO/${bulanIni.tahun}/${String(bulanIni.bulan).padStart(2, '0')}/${String(nomor + 1).padStart(4, '0')}`,
       spesifikasi.vendor.id, tanggalDokumen, dpp, pajak, dpp + pajak, spesifikasi.status],
    )
    await client.query(
      `INSERT INTO purchase_document_lines
         (id, tenant_id, company_id, document_id, line_no, item_id, description, qty, uom,
          unit_price, net_amount, tax_rate_pct, tax_amount, qty_received)
       VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [randomUUID(), tenantId, company.id, documentId, spesifikasi.item.id,
       spesifikasi.item.nama, spesifikasi.qty, spesifikasi.item.uom, hargaBeli, dpp, PPN, pajak,
       spesifikasi.terima],
    )
  }

  /*
   * Satu tagihan berstatus exception.
   *
   * Harganya lebih tinggi dari pesanan — kasus paling umum di dunia nyata, dan
   * kasus yang paling mahal bila lolos. Tagihan ini TIDAK diposting: ia
   * menunggu keputusan orang, dan itulah yang membuatnya layak ditunjukkan.
   */
  const item = barang[0]
  const hargaPesanan = item.pokok
  const hargaTagihan = Math.round(hargaPesanan * 1.14)
  const qty = 120
  const dpp = Math.round(hargaTagihan * qty * skala)
  const pajak = Math.round((dpp * PPN) / 100)
  const tanggalDokumen = tanggal(bulanIni.tahun, bulanIni.bulan, 18)

  const billId = randomUUID()
  await client.query(
    `INSERT INTO purchase_documents
       (id, tenant_id, company_id, doc_type, number, vendor_id, issue_date, due_date, currency,
        subtotal, tax_base, tax_total, total, lifecycle_status, match_status)
     VALUES ($1, $2, $3, 'bill', $4, $5, $6::date, $7::date, 'IDR',
             $8, $8, $9, $10, 'approved', 'exception')`,
    [billId, tenantId, company.id,
     `BILL/${bulanIni.tahun}/${String(bulanIni.bulan).padStart(2, '0')}/0001`,
     vendor[0].id, tanggalDokumen, tambahHari(tanggalDokumen, 30), dpp, pajak, dpp + pajak],
  )
  await client.query(
    `INSERT INTO purchase_document_lines
       (id, tenant_id, company_id, document_id, line_no, item_id, description, qty, uom,
        unit_price, net_amount, tax_rate_pct, tax_amount, qty_received)
     VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8, $9, $10, $11, $12, $7)`,
    [randomUUID(), tenantId, company.id, billId, item.id, item.nama, qty, item.uom,
     hargaTagihan, dpp, PPN, pajak],
  )

  return {
    pesanan: pesanan.length,
    penerimaanSebagian: pesanan.filter((satu) => satu.terima > 0 && satu.terima < satu.qty).length,
    menungguPembelian: pesanan.filter((satu) => satu.status === 'pending_approval').length,
    tagihanException: 1,
    selisihHarga: hargaTagihan - hargaPesanan,
  }
}

/** Jurnal seimbang. Trigger menolak yang tidak, dan itu memang gunanya. */
async function jurnal(client, konteks) {
  const journalId = randomUUID()
  await client.query(
    `INSERT INTO journals
       (id, tenant_id, company_id, journal_date, fiscal_year, fiscal_period, type,
        source_type, description, currency, posted_at)
     VALUES ($1, $2, $3, $4::date, $5, $6, 'auto', 'seed-demo', $7, 'IDR', $4::timestamptz)`,
    [journalId, konteks.tenantId, konteks.companyId, konteks.tanggal, konteks.tahun,
     konteks.periode, konteks.deskripsi],
  )

  for (const [nomor, baris] of konteks.baris.entries()) {
    await client.query(
      `INSERT INTO journal_lines
         (id, tenant_id, journal_id, line_no, account_id, debit, credit, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'IDR')`,
      [randomUUID(), konteks.tenantId, journalId, nomor + 1, baris.akun, baris.debit, baris.credit],
    )
  }
}

function tambahHari(iso, hari) {
  const tanggalBaru = new Date(`${iso}T00:00:00Z`)
  tanggalBaru.setUTCDate(tanggalBaru.getUTCDate() + hari)
  return tanggalBaru.toISOString().slice(0, 10)
}

function rupiah(nilai) {
  return `Rp ${Math.round(nilai).toLocaleString('id-ID')}`
}

if (process.argv[1]?.endsWith('demo.js') === true) {
  const hasil = await seedDemo(wajib('DATABASE_URL'))

  const garis = '  ' + '─'.repeat(72)

  console.warn(
    [
      '',
      garis,
      '  DATA DEMO terpasang. Seluruh isinya karangan.',
      garis,
      '',
      `  Tenant : Grup Demo Paadu (${hasil.tenantId})`,
      '',
      ...hasil.ringkasan.flatMap((baris) => [
        `  ${baris.company.nama}`,
        `    Tahun fiskal mulai bulan ${baris.company.bulanAwalFiskal}`,
        `    ${baris.jumlahFaktur} faktur terposting selama 12 bulan`,
        `    Pendapatan kumulatif   ${rupiah(baris.totalPendapatan)}`,
        `    Piutang beredar        ${rupiah(baris.piutangBeredar)}`,
        `    ${baris.draf} draf, ${baris.menungguPersetujuan} menunggu persetujuan`,
        `    ${baris.pesanan} pesanan pembelian, ${baris.penerimaanSebagian} diterima sebagian`,
        `    ${baris.tagihanException} tagihan exception — selisih harga ${rupiah(baris.selisihHarga)} per unit`,
        '',
      ]),
      garis,
      '  AKUN DEMO — catat sebelum menutup jendela ini',
      garis,
      '',
      ...hasil.akun.flatMap((akun) => [
        `  ${akun.email}`,
        `    ${akun.nama} · ${akun.jabatan}`,
        '',
      ]),
      `  Kata sandi untuk KETIGANYA:`,
      '',
      `      ${hasil.kataSandi}`,
      '',
      garis,
      '',
      '  Urutan demo sepuluh menit ada di docs/DEMO.md.',
      '  Jangan pernah memakai basis data ini sebagai basis data produksi.',
      '',
    ].join('\n'),
  )
}
