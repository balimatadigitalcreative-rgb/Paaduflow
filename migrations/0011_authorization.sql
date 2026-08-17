-- Up Migration
--
-- Model izin — Modul 02 §6, direvisi Modul 17 §1.
--
-- Peran melekat pada pasangan pengguna–company, bukan pada pengguna. Satu orang
-- wajar menjadi Direktur di satu PT dan staf gudang di PT lain dalam grup yang
-- sama; model yang menempelkan peran pada pengguna tidak dapat menyatakan itu.

-- Cakupan izin. Sengaja hanya tiga: cakupan yang rumit tidak dapat
-- diterjemahkan menjadi klausa WHERE, dan izin yang tidak dapat menjadi
-- predikat kueri akan berakhir sebagai penyaringan di aplikasi — yang gagal
-- pada tenant besar dan bocor lewat penghitungan total (Modul 02 §5).
CREATE TYPE permission_scope AS ENUM ('own', 'company', 'tenant');

-- ── Katalog izin ───────────────────────────────────────────────────────────
--
-- Global, bukan per tenant. Ia bagian dari produk, bukan data pelanggan. Setiap
-- modul menyisipkan barisnya lewat migrasinya sendiri.

CREATE TABLE permissions (
  key         text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  module_id   text NOT NULL,
  entity      text NOT NULL,
  action      text NOT NULL,
  description text NOT NULL,
  min_plan    tenant_plan NOT NULL DEFAULT 'trial',

  -- Dua penanda, bukan satu — Modul 17 §1 merevisi Modul 02.
  --
  -- Agen dalam produk menyimpulkan kewenangannya dari izin penggunanya, jadi ia
  -- tidak boleh menyentuh aksi sensitif sama sekali. Integrasi terkonfigurasi
  -- punya identitas bernama yang diberi izin satu per satu dan dapat dicabut —
  -- melarangnya total justru memaksa orang menempelkan kredensial manusia ke
  -- skrip, yang jauh lebih berbahaya.
  delegatable_to_agent       boolean NOT NULL DEFAULT false,
  grantable_to_integration   boolean NOT NULL DEFAULT false,

  created_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON permissions TO paadu_app, paadu_analytics;

-- ── Peran ──────────────────────────────────────────────────────────────────
--
-- `tenant_id` NULL berarti peran bawaan sistem. Karena kolomnya dapat NULL,
-- kunci primernya tunggal — pengecualian sadar terhadap D-048, yang berlaku
-- untuk tabel bertenant.

CREATE TABLE roles (
  id          uuid PRIMARY KEY,
  tenant_id   uuid REFERENCES tenants (id),
  key         text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_system   boolean NOT NULL DEFAULT false,
  -- Tingkat dipakai untuk aturan "tidak ada peran yang dapat menaikkan dirinya
  -- sendiri": pemberi hanya boleh memberikan peran bertingkat sama atau di
  -- bawahnya. Angka kecil berarti lebih berwenang.
  rank        integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (tenant_id, key)
);

CREATE TRIGGER t20_updated_at BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();

-- Peran bawaan sistem tidak dapat diubah atau dihapus oleh peran mana pun.
CREATE FUNCTION paadu.protect_system_roles() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_system THEN
    RAISE EXCEPTION 'Peran bawaan sistem tidak dapat diubah atau dihapus'
      USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$$;

CREATE TRIGGER t10_protect_system BEFORE UPDATE OR DELETE ON roles
  FOR EACH ROW EXECUTE FUNCTION paadu.protect_system_roles();

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;

-- Peran bawaan terlihat oleh semua tenant; peran kustom hanya oleh pemiliknya.
--
-- paadu:allow-breaking WITH CHECK versi pertama menolak `tenant_id` NULL yang USING-nya izinkan, sehingga migrasi ini gagal pada peran non-superuser dan tidak dapat dijalankan sama sekali di pemasangan baru — lihat D-141 dan migrasi 0023.
CREATE POLICY tenant_isolation ON roles
  USING (tenant_id IS NULL OR tenant_id = paadu.current_tenant_id())
  WITH CHECK (tenant_id IS NULL OR tenant_id = paadu.current_tenant_id());

-- Melonggarkan WITH CHECK saja akan membuka pintu lain: paadu_app dapat
-- menyisipkan peran ber-`tenant_id` NULL, yang terlihat oleh SELURUH tenant.
-- Pembatasannya karena itu diletakkan per peran basis data, bukan per baris.
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

GRANT SELECT, INSERT, UPDATE, DELETE ON roles TO paadu_app;

-- ── Izin per peran ─────────────────────────────────────────────────────────

CREATE TABLE role_permissions (
  role_id        uuid NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES permissions (key),
  scope          permission_scope NOT NULL,
  PRIMARY KEY (role_id, permission_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON role_permissions TO paadu_app;

-- ── Akses company ──────────────────────────────────────────────────────────
--
-- Inti model ini. Satu peran per pasangan pengguna–company: menumpuk banyak
-- peran membuat izin efektif sulit dijelaskan dan sulit diaudit.

CREATE TABLE company_access (
  id         uuid NOT NULL,
  tenant_id  uuid NOT NULL,
  company_id uuid NOT NULL,
  user_id    uuid NOT NULL REFERENCES users (id),
  role_id    uuid NOT NULL REFERENCES roles (id),
  granted_by uuid REFERENCES users (id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  UNIQUE (tenant_id, company_id, user_id)
);

CREATE INDEX company_access_user_idx ON company_access (tenant_id, user_id);

CREATE TRIGGER t20_updated_at BEFORE UPDATE ON company_access
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();

-- Konteks pengguna, dipasang bersamaan dengan konteks tenant.
CREATE FUNCTION paadu.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;

ALTER TABLE company_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_access FORCE ROW LEVEL SECURITY;

-- Dua jalan, dan yang kedua memecahkan masalah ayam-telur.
--
-- Saat permintaan baru tiba, sistem belum tahu tenant mana yang dimaksud — ia
-- baru tahu penggunanya. Membaca barisnya sendiri diizinkan tanpa konteks
-- tenant, dan dari baris itulah tenant ditentukan. Yang terbuka hanyalah daftar
-- akses milik pengguna itu sendiri.
CREATE POLICY tenant_isolation ON company_access
  USING (
    tenant_id = paadu.current_tenant_id()
    OR user_id = paadu.current_user_id()
  )
  WITH CHECK (tenant_id = paadu.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON company_access TO paadu_app;

-- ── Peran bawaan sistem ────────────────────────────────────────────────────

INSERT INTO roles (id, tenant_id, key, name, description, is_system, rank) VALUES
  ('00000000-0000-7000-8000-000000000001', NULL, 'tenant_owner',   'Pemilik Tenant',  'Kewenangan penuh atas seluruh company di tenant.', true, 10),
  ('00000000-0000-7000-8000-000000000002', NULL, 'tenant_admin',   'Admin Tenant',    'Mengelola pengguna, akses, dan peran di seluruh company.', true, 20),
  ('00000000-0000-7000-8000-000000000003', NULL, 'company_admin',  'Admin Company',   'Mengelola satu company beserta penggunanya.', true, 30),
  ('00000000-0000-7000-8000-000000000004', NULL, 'member',         'Anggota',         'Akses operasional sesuai izin yang diberikan.', true, 40);

-- Katalog izin modul fondasi. Modul berikutnya menyisipkan barisnya sendiri
-- lewat migrasinya sendiri — katalog terpusat yang harus diperbarui manual
-- setiap kali modul lahir adalah katalog yang akan tertinggal.
INSERT INTO permissions (key, module_id, entity, action, description, delegatable_to_agent, grantable_to_integration) VALUES
  ('organisasi.company.baca',    'organization', 'company', 'baca',    'Melihat data company.',                 true,  true),
  ('organisasi.company.kelola',  'organization', 'company', 'kelola',  'Mengubah pengaturan company.',          false, false),
  ('identitas.pengguna.baca',    'identity',     'pengguna', 'baca',   'Melihat daftar pengguna dan aksesnya.', true,  true),
  ('identitas.pengguna.kelola',  'identity',     'pengguna', 'kelola', 'Memberi dan mencabut akses company.',   false, false),
  ('identitas.sesi.cabut',       'identity',     'sesi',     'cabut',  'Mencabut sesi pengguna lain.',          false, false);

INSERT INTO role_permissions (role_id, permission_key, scope)
SELECT r.id, p.key,
       CASE
         WHEN r.key IN ('tenant_owner', 'tenant_admin') THEN 'tenant'::permission_scope
         ELSE 'company'::permission_scope
       END
  FROM roles r
 CROSS JOIN permissions p
 WHERE r.is_system
   AND (
     r.key IN ('tenant_owner', 'tenant_admin')
     OR (r.key = 'company_admin' AND p.key <> 'identitas.sesi.cabut')
     OR (r.key = 'member' AND p.action = 'baca')
   );

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
