-- Up Migration
--
-- Lapisan penentuan akun — Module 07 §6, D-011.
--
-- Inilah yang membuat modul lain tidak pernah menyebut nomor akun. Modul
-- Penjualan menerbitkan "faktur diposting, kategori item X, gudang Y, kode
-- pajak Z"; lapisan ini yang menjawab akun mana.

CREATE TABLE dimensions (
  id         uuid NOT NULL,
  tenant_id  uuid NOT NULL,
  company_id uuid NOT NULL,
  slot       integer NOT NULL CHECK (slot BETWEEN 1 AND 3),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  UNIQUE (tenant_id, company_id, slot)
);

CREATE TABLE dimension_values (
  id           uuid NOT NULL,
  tenant_id    uuid NOT NULL,
  dimension_id uuid NOT NULL,
  code         text NOT NULL,
  name         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, dimension_id) REFERENCES dimensions (tenant_id, id),
  UNIQUE (tenant_id, dimension_id, code)
);

-- ── Aturan penentuan ──────────────────────────────────────────────────────
--
-- `specificity` adalah kolom TERHITUNG, bukan kolom yang diisi.
--
-- Bobotnya berjenjang, bukan hitungan rata: dengan bobot rata, aturan
-- ber-kategori-item dan aturan ber-gudang+pajak dapat berskor sama, dan
-- pemenangnya ditentukan urutan baris — yaitu tidak ditentukan sama sekali.
--
-- Karena dihitung basis data, dua orang tidak dapat memberi angka berbeda
-- untuk aturan yang bentuknya sama.

CREATE TABLE account_determination_rules (
  id               uuid NOT NULL,
  tenant_id        uuid NOT NULL,
  company_id       uuid NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  item_category_id uuid,
  warehouse_id     uuid,
  tax_code_id      uuid,
  partner_type     text,
  account_id       uuid NOT NULL,
  specificity      integer GENERATED ALWAYS AS (
                     (CASE WHEN item_category_id IS NOT NULL THEN 8 ELSE 0 END) +
                     (CASE WHEN warehouse_id     IS NOT NULL THEN 4 ELSE 0 END) +
                     (CASE WHEN tax_code_id      IS NOT NULL THEN 2 ELSE 0 END) +
                     (CASE WHEN partner_type     IS NOT NULL THEN 1 ELSE 0 END)
                   ) STORED,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  FOREIGN KEY (tenant_id, account_id) REFERENCES accounts (tenant_id, id),
  -- Dua aturan dengan bentuk yang persis sama tidak dapat hidup berdampingan;
  -- kalau boleh, resolver akan menghadapi seri yang tidak dapat dijelaskan.
  UNIQUE NULLS NOT DISTINCT (
    tenant_id, company_id, transaction_type,
    item_category_id, warehouse_id, tax_code_id, partner_type
  )
);

CREATE INDEX account_rules_lookup_idx
  ON account_determination_rules (tenant_id, company_id, transaction_type, specificity DESC);

CREATE TRIGGER t20_updated_at BEFORE UPDATE ON account_determination_rules
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['dimensions', 'dimension_values', 'account_determination_rules'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I
         USING (tenant_id = paadu.current_tenant_id())
         WITH CHECK (tenant_id = paadu.current_tenant_id())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO paadu_app', t);
    EXECUTE format('GRANT SELECT ON public.%I TO paadu_analytics', t);
  END LOOP;
END $$;

-- ── Template bagan akun ───────────────────────────────────────────────────
--
-- Company baru membutuhkan bagan akun awal, tetapi CLAUDE.md melarang modul
-- menyebut nomor akun. Jalan keluarnya: template adalah **data**, bukan kode
-- modul — pola yang sama dengan katalog izin.
--
-- Migrasi ini membangun mekanismenya saja. Isi template konkret memerlukan
-- akuntan, sama seperti V-01 memerlukan konsultan pajak.

CREATE TABLE chart_templates (
  id          uuid PRIMARY KEY,
  country     char(2) NOT NULL,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country, name)
);

CREATE TABLE chart_template_accounts (
  id          uuid PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES chart_templates (id),
  code        text NOT NULL,
  name        text NOT NULL,
  type        account_type NOT NULL,
  parent_code text,
  is_control  boolean NOT NULL DEFAULT false,
  control_of  account_control_of,
  UNIQUE (template_id, code)
);

GRANT SELECT ON chart_templates, chart_template_accounts TO paadu_app, paadu_analytics;

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
