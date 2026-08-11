-- Up Migration
--
-- Empat tabel platform yang menutup butir 8, 9, 10, dan 12.
-- Keempatnya bukan dokumen transaksional, jadi tidak memakai kontrak.

-- ── Butir 12: idempotency ──────────────────────────────────────────────────
--
-- Timeout tidak boleh menghasilkan faktur ganda. request_hash ikut disimpan
-- supaya kunci yang sama dengan muatan berbeda dapat ditolak, bukan diam-diam
-- mengembalikan jawaban permintaan lain.

CREATE TABLE idempotency_keys (
  id              uuid NOT NULL,
  tenant_id       uuid NOT NULL,
  company_id      uuid,
  idempotency_key text NOT NULL,
  endpoint        text NOT NULL,
  request_hash    text NOT NULL,
  response_status integer,
  response_body   jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, endpoint, idempotency_key)
);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON idempotency_keys
  USING (tenant_id = paadu.current_tenant_id())
  WITH CHECK (tenant_id = paadu.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON idempotency_keys TO paadu_app;

-- ── Butir 8: preferensi per pengguna ───────────────────────────────────────
--
-- Per pengguna, bukan per perangkat. Per tenant juga, karena modul yang
-- disematkan seseorang di grup usaha A tidak sama dengan di grup usaha B.

CREATE TABLE user_preferences (
  tenant_id        uuid NOT NULL,
  user_id          uuid NOT NULL REFERENCES users (id),
  theme            text NOT NULL DEFAULT 'system'
                   CHECK (theme IN ('light', 'dark', 'system')),
  density          text NOT NULL DEFAULT 'comfortable'
                   CHECK (density IN ('comfortable', 'compact')),
  sidebar_collapsed boolean NOT NULL DEFAULT false,
  pinned_modules   jsonb NOT NULL DEFAULT '[]'::jsonb,
  locale           text NOT NULL DEFAULT 'id-ID',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON user_preferences
  USING (tenant_id = paadu.current_tenant_id())
  WITH CHECK (tenant_id = paadu.current_tenant_id());

CREATE TRIGGER t20_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON user_preferences TO paadu_app;

-- ── Butir 9: saved views ───────────────────────────────────────────────────
--
-- Bercakupan pribadi atau company. Slug ada supaya view punya URL sendiri dan
-- tautannya dapat dikirim — itu seluruh alasan tabel ini ada.

CREATE TABLE saved_views (
  id         uuid NOT NULL,
  tenant_id  uuid NOT NULL,
  company_id uuid NOT NULL,
  owner_id   uuid NOT NULL REFERENCES users (id),
  scope      text NOT NULL CHECK (scope IN ('private', 'company')),
  module_id  text NOT NULL,
  entity     text NOT NULL,
  name       text NOT NULL,
  slug       text NOT NULL,
  -- filter + kolom + urutan + kepadatan, satu dokumen
  definition jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  UNIQUE (tenant_id, company_id, entity, owner_id, slug)
);

ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_views FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON saved_views
  USING (tenant_id = paadu.current_tenant_id())
  WITH CHECK (tenant_id = paadu.current_tenant_id());

CREATE TRIGGER t20_updated_at BEFORE UPDATE ON saved_views
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON saved_views TO paadu_app;

-- ── Butir 10: progres onboarding ───────────────────────────────────────────
--
-- Pengguna yang menutup browser melanjutkan, bukan mengulang.

CREATE TABLE onboarding_progress (
  tenant_id    uuid NOT NULL,
  user_id      uuid NOT NULL REFERENCES users (id),
  current_step text NOT NULL,
  completed    jsonb NOT NULL DEFAULT '[]'::jsonb,
  state        jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_progress FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON onboarding_progress
  USING (tenant_id = paadu.current_tenant_id())
  WITH CHECK (tenant_id = paadu.current_tenant_id());

CREATE TRIGGER t20_updated_at BEFORE UPDATE ON onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON onboarding_progress TO paadu_app;

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
