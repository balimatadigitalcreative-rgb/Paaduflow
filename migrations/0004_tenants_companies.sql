-- Up Migration
--
-- Modul 01 — dependency root seluruh platform.

CREATE TYPE tenant_plan   AS ENUM ('trial', 'starter', 'business', 'enterprise');
CREATE TYPE tenant_status AS ENUM ('trial', 'active', 'suspended', 'churned');
CREATE TYPE company_status AS ENUM ('active', 'inactive');

CREATE TABLE tenants (
  id            uuid PRIMARY KEY,
  name          text NOT NULL,
  slug          citext NOT NULL UNIQUE
                CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  plan_type     tenant_plan NOT NULL DEFAULT 'trial',
  status        tenant_status NOT NULL DEFAULT 'trial',
  -- Satu region penulis per tenant — D-027. Region lain siaga, bukan penulis kedua.
  region        text NOT NULL,
  -- Butir 11: tenant mengirim maksud, bukan nilai token. Satu hex; sistem yang
  -- menurunkan sebelas stop dan memeriksa kontrasnya sebelum menerimanya.
  brand_hex     text CHECK (brand_hex ~* '^#[0-9a-f]{6}$'),
  trial_ends_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid,
  deleted_at    timestamptz,
  deleted_by    uuid
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenants
  USING (id = paadu.current_tenant_id())
  WITH CHECK (id = paadu.current_tenant_id());

CREATE TRIGGER t20_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON tenants TO paadu_app;
GRANT SELECT ON tenants TO paadu_analytics;

-- ── Companies ──────────────────────────────────────────────────────────────
--
-- Bukan tabel transaksional: ia tidak punya siklus hidup dokumen dan tidak
-- diposting ke buku besar. Karena itu ia tidak memakai kontrak transaksional,
-- tetapi tetap memakai kunci komposit — seluruh FK tabel lain menunjuk ke sini
-- lewat (tenant_id, id).

CREATE TABLE companies (
  id                      uuid NOT NULL,
  tenant_id               uuid NOT NULL REFERENCES tenants (id),
  legal_name              text NOT NULL,
  slug                    citext NOT NULL
                          CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  tax_id                  text,
  default_currency        char(3) NOT NULL,
  fiscal_year_start_month integer NOT NULL DEFAULT 1
                          CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  status                  company_status NOT NULL DEFAULT 'active',
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by              uuid,
  deleted_at              timestamptz,
  deleted_by              uuid,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, slug)
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON companies
  USING (tenant_id = paadu.current_tenant_id())
  WITH CHECK (tenant_id = paadu.current_tenant_id());

CREATE TRIGGER t20_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON companies TO paadu_app;
GRANT SELECT ON companies TO paadu_analytics;

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
