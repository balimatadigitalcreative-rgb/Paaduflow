-- Up Migration
--
-- Bagan akun — Module 07 §6.
--
-- Migrasi ini juga memasang foreign key `journal_lines.account_id` yang sengaja
-- dikosongkan di Sesi A3, karena tabel `accounts` memang baru lahir sekarang.
-- Penambahan, bukan perubahan bentuk.

CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

-- Akun kontrol menjaga buku besar tetap sama dengan buku pembantunya.
CREATE TYPE account_control_of AS ENUM ('ar', 'ap', 'inventory');

CREATE TABLE accounts (
  id                 uuid NOT NULL,
  tenant_id          uuid NOT NULL,
  company_id         uuid NOT NULL,
  code               text NOT NULL CHECK (code ~ '^[0-9][0-9.\-]*$'),
  name               text NOT NULL,
  type               account_type NOT NULL,
  subtype            text,
  parent_id          uuid,
  currency           char(3),
  is_control         boolean NOT NULL DEFAULT false,
  control_of         account_control_of,
  -- Dimensi yang wajib terisi saat menjurnal ke akun ini.
  requires_dimension jsonb NOT NULL DEFAULT '[]'::jsonb,
  status             text NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'inactive')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  deleted_at         timestamptz,
  deleted_by         uuid,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  FOREIGN KEY (tenant_id, parent_id) REFERENCES accounts (tenant_id, id),
  UNIQUE (tenant_id, company_id, code),
  -- Penanda kontrol dan jenis kontrolnya harus terisi bersamaan; akun kontrol
  -- tanpa keterangan kontrol apa tidak dapat diperiksa siapa pun.
  CONSTRAINT accounts_control_complete CHECK ((is_control) = (control_of IS NOT NULL))
);

CREATE INDEX accounts_company_idx ON accounts (tenant_id, company_id, code);
CREATE INDEX accounts_parent_idx ON accounts (tenant_id, parent_id);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON accounts
  USING (tenant_id = paadu.current_tenant_id())
  WITH CHECK (tenant_id = paadu.current_tenant_id());

CREATE TRIGGER t20_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON accounts TO paadu_app;
GRANT SELECT ON accounts TO paadu_analytics;

-- Foreign key yang ditunda dari Sesi A3.
ALTER TABLE journal_lines
  ADD CONSTRAINT journal_lines_account_fkey
  FOREIGN KEY (tenant_id, account_id) REFERENCES accounts (tenant_id, id);

-- ── Akun yang tidak boleh dijurnal ────────────────────────────────────────
--
-- Dua larangan, keduanya di basis data karena keduanya harus berlaku juga
-- untuk jalur tulis yang belum ada hari ini.
--
-- 1. Akun kontrol tidak dapat dijurnal manual. Saldonya hanya boleh berubah
--    lewat modul asalnya — itulah yang menjaga kontrol tetap sama dengan
--    buku pembantu.
-- 2. Akun yang punya anak tidak dapat dijurnal sama sekali. Memposting ke akun
--    induk membuat jumlah anak tidak sama dengan induknya, dan laporan menjadi
--    tidak dapat dijelaskan.

CREATE FUNCTION paadu.reject_untouchable_account() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_control  boolean;
  v_code     text;
  v_type     journal_type;
  v_children bigint;
BEGIN
  SELECT a.is_control, a.code INTO v_control, v_code
    FROM accounts a
   WHERE a.tenant_id = NEW.tenant_id AND a.id = NEW.account_id;

  SELECT count(*) INTO v_children
    FROM accounts a
   WHERE a.tenant_id = NEW.tenant_id AND a.parent_id = NEW.account_id;

  IF v_children > 0 THEN
    RAISE EXCEPTION 'Akun % adalah akun induk dan tidak dapat dijurnal', v_code
      USING ERRCODE = '23514';
  END IF;

  SELECT j.type INTO v_type
    FROM journals j
   WHERE j.tenant_id = NEW.tenant_id AND j.id = NEW.journal_id;

  IF v_control AND v_type = 'manual' THEN
    RAISE EXCEPTION 'Akun kontrol % tidak dapat dijurnal manual', v_code
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER t10_untouchable_account BEFORE INSERT ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION paadu.reject_untouchable_account();

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
