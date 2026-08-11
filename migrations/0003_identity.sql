-- Up Migration
--
-- Identitas global. Satu-satunya tabel tanpa tenant_id, karena satu orang wajar
-- menjadi anggota lebih dari satu tenant — dan email unik lintas sistem
-- (Module 02 §6).
--
-- Sengaja minimal. Kata sandi, MFA, sesi, dan refresh token dibangun di Sesi B1
-- sebagai penambahan kolom dan tabel, bukan sebagai perubahan bentuk. Yang ada
-- di sini hanya yang dibutuhkan kolom audit untuk merujuk pelakunya.

CREATE TABLE users (
  id         uuid PRIMARY KEY,
  email      citext NOT NULL UNIQUE,
  full_name  text NOT NULL,
  status     text NOT NULL DEFAULT 'active'
             CHECK (status IN ('active', 'suspended', 'deactivated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE TRIGGER t20_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();

-- Tanpa RLS: tabel ini tidak punya tenant_id untuk disaring. Yang membatasi
-- siapa dapat melihat siapa adalah keanggotaan tenant di Sesi B2, bukan basis
-- data. Karena itu tabel ini sengaja tidak memuat data sensitif — kredensial
-- dan sesi masuk ke tabelnya sendiri di Sesi B1, dengan pembatasan tersendiri.
GRANT SELECT, INSERT, UPDATE ON users TO paadu_app;
GRANT SELECT ON users TO paadu_analytics;

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
