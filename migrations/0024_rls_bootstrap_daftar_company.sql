-- Up Migration
--
-- Daftar company milik pengguna: memperbaiki jawaban kosong di bawah RLS.
--
-- `GET /v1/me/companies` menjawab 200 dengan daftar kosong meski baris
-- `company_access` ada. Sebabnya bukan kueri dan bukan kolam koneksi.
--
-- Kueri itu berjalan lewat `asUser`, yang memasang `app.user_id` TANPA
-- `app.tenant_id` — tenant-nya justru yang sedang dicari (D-064, masalah
-- ayam-telur). Dalam konteks itu `paadu.current_tenant_id()` bernilai NULL.
--
-- 0011 membuka `company_access` untuk keperluan ini, dan komentar di lapisan
-- kueri menyatakan `companies` dan `tenants` "ikut terbaca lewat join yang
-- dibatasi baris akses itu". **Itu tidak benar.** RLS dievaluasi per tabel dan
-- tidak menular lewat join: setiap tabel yang disebut disaring kebijakannya
-- sendiri, tanpa peduli tabel apa yang mengikatnya. Diukur dengan app.user_id
-- terpasang dan app.tenant_id kosong:
--
--   company_access  1 baris    ← punya jalur user_id
--   companies       0 baris    ← hanya mengenal app.tenant_id
--   tenants         0 baris    ← hanya mengenal app.tenant_id
--   roles           4 baris    ← lolos lewat `tenant_id IS NULL`
--   join lengkap    0 baris
--
-- Satu tabel yang memulangkan nol sudah cukup mengosongkan seluruh join.
--
-- Yang dibuka di sini persis sebesar yang sudah terbuka di `company_access`:
-- baris yang aksesnya memang sudah dimiliki pengguna itu. Tidak ada company
-- baru yang terlihat — yang berubah hanya bahwa company yang sudah boleh ia
-- akses kini dapat ia sebut namanya sebelum konteks tenant terbentuk.

-- Kebijakan TERPISAH, bukan pelonggaran `tenant_isolation`.
--
-- Melonggarkan USING pada kebijakan yang sudah ada akan ikut melonggarkan
-- UPDATE dan DELETE, karena USING menentukan baris mana yang boleh disasar.
-- Pengguna dengan konteks tenant T1 dan akses ke company di T2 lalu dapat
-- meng-UPDATE baris T2 itu dengan `tenant_id = T1` — WITH CHECK-nya lolos,
-- dan company berpindah tenant. `FOR SELECT` menutup seluruh kelas itu:
-- jalur baca melebar, jalur tulis tidak bergerak sama sekali.
--
-- Kebijakan permissive di-OR-kan, jadi `tenant_isolation` tetap utuh apa
-- adanya dan tidak perlu di-DROP.

CREATE POLICY bootstrap_akses_sendiri ON companies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_access ca
       WHERE ca.tenant_id = companies.tenant_id
         AND ca.company_id = companies.id
         AND ca.user_id = paadu.current_user_id()
    )
  );

CREATE POLICY bootstrap_akses_sendiri ON tenants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_access ca
       WHERE ca.tenant_id = tenants.id
         AND ca.user_id = paadu.current_user_id()
    )
  );

-- Tanpa `app.user_id`, `paadu.current_user_id()` bernilai NULL dan perbandingan
-- `ca.user_id = NULL` tidak pernah benar. Kebijakan ini lalu tidak menyumbang
-- baris apa pun — pekerjaan latar yang hanya berkonteks tenant tidak terpengaruh.
--
-- Subkueri tunduk pada RLS `company_access` itu sendiri, dan kebijakan
-- `company_access` tidak menyebut `companies` maupun `tenants`. Tidak ada
-- rekursi. Indeks `company_access_user_idx (tenant_id, user_id)` melayani
-- kedua subkueri.

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
