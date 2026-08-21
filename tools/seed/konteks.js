/**
 * Konteks tenant dan pemeriksaan kemampuan untuk seed.
 *
 * Dipakai `seed:dev` dan `seed:demo`. Keduanya menulis ke tabel ber-RLS, dan
 * keduanya sebelumnya menuntut koneksi ber-BYPASSRLS untuk melakukannya —
 * artinya mengisi data contoh menuntut kredensial pemilik basis data. Itu
 * salah: hak yang dibutuhkan sebuah alat harus sebesar pekerjaannya, tidak
 * lebih.
 *
 * Yang diperlukan sebenarnya hanya memasang konteks, persis seperti yang
 * dilakukan `src/infrastructure/db/unit-of-work.ts` di setiap permintaan.
 */

/**
 * Memasang konteks tenant pada transaksi yang sedang berjalan.
 *
 * `set_config(..., true)` adalah SET LOCAL — terikat transaksi, bukan koneksi.
 * Ini bukan detail: koneksi berasal dari kolam bersama, dan konteks yang
 * menempel pada koneksi akan terbawa ke pekerjaan berikutnya yang kebetulan
 * mendapat koneksi yang sama.
 *
 * Harus dipanggil SEBELUM baris tenant disisipkan. Kebijakan `tenants`
 * menuntut `id = paadu.current_tenant_id()` pada WITH CHECK-nya, jadi konteks
 * yang dipasang sesudahnya sudah terlambat — barisnya ditolak lebih dulu.
 */
export async function pasangKonteks(client, { tenantId, userId = null }) {
  await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId])
  await client.query('SELECT set_config($1, $2, true)', ['app.user_id', userId ?? ''])
}

/**
 * Tabel yang benar-benar ditulis seed, beserta hak yang dibutuhkannya.
 *
 * Daftar ini sengaja eksplisit dan sengaja pendek. Memeriksa "semua tabel"
 * akan ikut menuntut hak yang tidak dipakai, dan pemeriksaan yang menuntut
 * lebih dari yang dibutuhkan adalah pemeriksaan yang akan dimatikan orang.
 */
const TABEL_DITULIS = [
  'tenants',
  'companies',
  'users',
  'user_credentials',
  'tenant_memberships',
  'company_access',
  'accounts',
  'account_determination_rules',
  'warehouses',
  'customers',
  'vendors',
  'items',
  'stock_movements',
  'stock_balances',
  'sales_documents',
  'sales_document_lines',
  'purchase_documents',
  'purchase_document_lines',
  'journals',
  'journal_lines',
]

/**
 * Memeriksa di AWAL apakah koneksi ini benar-benar dapat menjalankan seed.
 *
 * Alasannya bukan kerapian. Seed berjalan dalam satu transaksi panjang; tanpa
 * pemeriksaan ini, kekurangan hak baru terlihat di tengah sebagai galat RLS
 * mentah — setelah beberapa ratus baris ditulis dan langsung di-rollback,
 * dengan pesan yang tidak menyebutkan apa pun tentang cara memperbaikinya.
 *
 * Yang diperiksa hanya INSERT. Seed tidak pernah UPDATE maupun DELETE, dan
 * menuntut keduanya akan menutup pintu untuk peran aplikasi di tabel
 * append-only yang memang tidak memilikinya.
 */
export async function periksaKemampuan(client) {
  const { rows } = await client.query(
    `SELECT t.nama,
            to_regclass('public.' || t.nama) IS NOT NULL AS ada,
            COALESCE(
              has_table_privilege(current_user, 'public.' || t.nama, 'INSERT'),
              false
            ) AS boleh_insert
       FROM unnest($1::text[]) AS t(nama)`,
    [TABEL_DITULIS],
  )

  const hilang = rows.filter((baris) => baris.ada && baris.boleh_insert === false)
  const belumMigrasi = rows.filter((baris) => baris.ada === false)

  const { rows: peran } = await client.query(
    `SELECT current_user AS peran,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypassrls`,
  )

  return {
    peran: peran[0].peran,
    bypassRls: peran[0].bypassrls === true,
    tabelTanpaInsert: hilang.map((baris) => baris.nama),
    tabelBelumAda: belumMigrasi.map((baris) => baris.nama),
  }
}

/**
 * Menerjemahkan hasil pemeriksaan menjadi pesan yang dapat ditindaklanjuti,
 * atau `null` bila tidak ada masalah.
 *
 * Pesan yang hanya menyebut apa yang gagal memaksa pembacanya menebak langkah
 * berikutnya. Yang di bawah menyebut sebabnya, peran yang sedang dipakai, dan
 * perintah yang memperbaikinya.
 */
export function jelaskanKekurangan(hasil, namaPerintah) {
  if (hasil.tabelBelumAda.length > 0) {
    return [
      `Skema belum lengkap: ${hasil.tabelBelumAda.length} tabel belum ada.`,
      '',
      `  Yang hilang: ${hasil.tabelBelumAda.slice(0, 5).join(', ')}${hasil.tabelBelumAda.length > 5 ? ', …' : ''}`,
      '',
      '  Jalankan migrasi lebih dulu:',
      '    npm run migrate',
    ].join('\n')
  }

  if (hasil.tabelTanpaInsert.length === 0) return null

  return [
    `Peran "${hasil.peran}" tidak dapat menyisipkan ke ${hasil.tabelTanpaInsert.length} tabel yang dibutuhkan.`,
    '',
    `  Yang ditolak: ${hasil.tabelTanpaInsert.join(', ')}`,
    '',
    '  Ini kekurangan HAK, bukan kekurangan konteks. RLS sendiri sudah',
    '  ditangani seed dengan memasang app.tenant_id, jadi peran aplikasi biasa',
    '  seharusnya cukup.',
    '',
    '  Periksa DATABASE_URL menunjuk peran yang benar, atau berikan haknya:',
    `    GRANT INSERT ON ${hasil.tabelTanpaInsert[0]} TO ${hasil.peran};`,
    '',
    `  Perintah: ${namaPerintah}`,
  ].join('\n')
}
