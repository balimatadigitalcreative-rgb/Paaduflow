-- Up Migration
--
-- Kebijakan RLS pada `roles` menolak barisnya sendiri.
--
-- 0011 memasang kebijakan yang USING dan WITH CHECK-nya tidak sepakat:
--
--   USING      (tenant_id IS NULL OR tenant_id = paadu.current_tenant_id())
--   WITH CHECK (tenant_id = paadu.current_tenant_id())
--
-- Peran bawaan sistem disisipkan dengan `tenant_id` NULL, dan `NULL = apa pun`
-- bernilai NULL — bukan true. WITH CHECK karena itu menolak baris yang USING-nya
-- sendiri mengizinkan untuk dibaca. Karena tabelnya memakai FORCE ROW LEVEL
-- SECURITY, pemilik tabel pun tunduk; hanya superuser dan peran ber-BYPASSRLS
-- yang lolos.
--
-- Akibatnya dua:
--   1. Migrasi 0011 gagal bila dijalankan peran non-superuser — yaitu justru
--      `paadu_owner` yang dirancang untuk menjalankannya.
--   2. Baris `tenant_id IS NULL` tidak dapat ditulis siapa pun sesudahnya.
--
-- Tidak tertangkap di lokal karena test menjalankan migrasi sebagai superuser,
-- dan superuser melewati RLS sepenuhnya. Lihat D-141.

-- Migrasi ini memperbaiki basis data yang TERLANJUR menerapkan 0011 versi lama
-- — yaitu setiap basis data yang migrasinya dijalankan sebagai superuser.
-- Pemasangan baru sudah memperoleh kebijakan yang benar langsung dari 0011,
-- karena migrasi yang mustahil dijalankan tidak dapat diperbaiki belakangan.
-- Karena itu seluruh pernyataan di bawah ditulis idempoten.

-- paadu:allow-breaking Kebijakan yang menolak barisnya sendiri harus diganti utuh; PostgreSQL tidak punya ALTER POLICY untuk WITH CHECK tanpa menulis ulang keduanya.
DROP POLICY IF EXISTS tenant_isolation ON roles;
-- paadu:allow-breaking Ditulis ulang di bawah; IF EXISTS supaya migrasi ini juga aman di basis data yang sudah memperolehnya dari 0011.
DROP POLICY IF EXISTS app_tanpa_peran_global_insert ON roles;
-- paadu:allow-breaking Alasan yang sama dengan di atas.
DROP POLICY IF EXISTS app_tanpa_peran_global_update ON roles;
-- paadu:allow-breaking Alasan yang sama dengan di atas.
DROP POLICY IF EXISTS app_tanpa_peran_global_delete ON roles;

-- WITH CHECK kini sepakat dengan USING: yang boleh dibaca juga boleh ditulis.
CREATE POLICY tenant_isolation ON roles
  USING (tenant_id IS NULL OR tenant_id = paadu.current_tenant_id())
  WITH CHECK (tenant_id IS NULL OR tenant_id = paadu.current_tenant_id());

-- Melonggarkan WITH CHECK saja akan membuka pintu lain: paadu_app dapat
-- menyisipkan peran ber-`tenant_id` NULL, yang menurut kebijakan di atas
-- terlihat oleh SELURUH tenant. Karena itu pembatasannya dipindah ke tempat
-- yang tepat — dibatasi per peran basis data, bukan per baris.
--
-- Kebijakan RESTRICTIVE di-AND-kan dengan yang permissive, dan hanya berlaku
-- bagi paadu_app. Peran migrasi tidak terkena, sehingga penyisipan peran bawaan
-- di 0011 dapat berjalan.
--
-- Dipecah per perintah dengan sengaja. Satu kebijakan FOR ALL akan ikut
-- membatasi SELECT, dan paadu_app justru HARUS dapat membaca peran bawaan —
-- setiap pemberian akses company mencarinya lewat `WHERE tenant_id IS NULL`.

CREATE POLICY app_tanpa_peran_global_insert ON roles
  AS RESTRICTIVE FOR INSERT TO paadu_app
  WITH CHECK (tenant_id IS NOT NULL AND NOT is_system);

CREATE POLICY app_tanpa_peran_global_update ON roles
  AS RESTRICTIVE FOR UPDATE TO paadu_app
  USING (tenant_id IS NOT NULL)
  WITH CHECK (tenant_id IS NOT NULL AND NOT is_system);

CREATE POLICY app_tanpa_peran_global_delete ON roles
  AS RESTRICTIVE FOR DELETE TO paadu_app
  USING (tenant_id IS NOT NULL);

-- Trigger `protect_system_roles` dari 0011 tetap berlaku dan tetap dibutuhkan:
-- ia menahan pengubahan baris `is_system` oleh peran mana pun, termasuk peran
-- migrasi. Kebijakan di atas menahan paadu_app membuat baris global yang baru.
-- Dua kontrol berbeda untuk dua kelas serangan berbeda.

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
