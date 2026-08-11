-- Up Migration
--
-- Autentikasi dan sesi — Modul 02, bagian pertama. Belum izin, belum peran.
--
-- Seluruh tabel di sini melekat pada identitas, bukan pada tenant. Satu orang
-- punya satu kata sandi dan satu daftar sesi lintas seluruh tenant yang ia
-- akses — itulah arti "satu identitas per orang" di Modul 02 §2. Karena itu
-- tabel-tabel ini termasuk pengecualian tabel identitas global: tanpa
-- `tenant_id`, tanpa RLS.

ALTER TABLE users
  ADD COLUMN email_verified_at timestamptz;

-- ── Kredensial ─────────────────────────────────────────────────────────────
--
-- Terpisah dari `users` supaya kueri profil tidak pernah ikut membawa hash kata
-- sandi. Kolom yang tidak pernah diambil tidak dapat bocor lewat serializer
-- yang lupa menyaring.

CREATE TABLE user_credentials (
  user_id             uuid PRIMARY KEY REFERENCES users (id),
  password_hash       text NOT NULL,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  failed_attempts     integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER t20_updated_at BEFORE UPDATE ON user_credentials
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON user_credentials TO paadu_app;

-- ── Verifikasi email ───────────────────────────────────────────────────────
--
-- Yang disimpan hash, bukan token. Basis data yang bocor tidak boleh memberi
-- penyerang tautan verifikasi yang masih dapat dipakai.

CREATE TABLE email_verification_tokens (
  id         uuid PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users (id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_verification_user_idx ON email_verification_tokens (user_id);

GRANT SELECT, INSERT, UPDATE ON email_verification_tokens TO paadu_app;

-- ── MFA ────────────────────────────────────────────────────────────────────

CREATE TYPE mfa_factor_type AS ENUM ('totp');

CREATE TABLE mfa_factors (
  id               uuid PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES users (id),
  type             mfa_factor_type NOT NULL,
  secret_encrypted text NOT NULL,
  confirmed_at     timestamptz,
  last_used_at     timestamptz,
  -- Menolak kode TOTP yang sama dipakai dua kali dalam jendela waktunya.
  last_used_counter bigint,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, type)
);

CREATE TRIGGER t20_updated_at BEFORE UPDATE ON mfa_factors
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON mfa_factors TO paadu_app;

-- Kode pemulihan sekali pakai. Satu baris per kode, karena "sekali pakai" harus
-- dapat ditegakkan per kode — bukan per kumpulan.
CREATE TABLE mfa_recovery_codes (
  id        uuid PRIMARY KEY,
  user_id   uuid NOT NULL REFERENCES users (id),
  code_hash text NOT NULL UNIQUE,
  used_at   timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mfa_recovery_user_idx ON mfa_recovery_codes (user_id) WHERE used_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON mfa_recovery_codes TO paadu_app;

-- ── Keanggotaan tenant ─────────────────────────────────────────────────────
--
-- Dibutuhkan sekarang karena access token membawa keanggotaan tenant. Peran dan
-- akses company menyusul di Sesi B2; tabel ini tidak berubah bentuk saat itu.

CREATE TYPE membership_status AS ENUM ('invited', 'active', 'suspended', 'removed');

CREATE TABLE tenant_memberships (
  id         uuid PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users (id),
  tenant_id  uuid NOT NULL REFERENCES tenants (id),
  status     membership_status NOT NULL DEFAULT 'invited',
  is_owner   boolean NOT NULL DEFAULT false,
  joined_at  timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

CREATE TRIGGER t20_updated_at BEFORE UPDATE ON tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON tenant_memberships TO paadu_app;

-- ── Sesi ───────────────────────────────────────────────────────────────────
--
-- Rotasi refresh token dengan deteksi penggunaan ulang.
--
-- `family_id` mengikat seluruh rantai rotasi yang berasal dari satu login.
-- Setiap rotasi mencabut baris lama dan menerbitkan baris baru dengan
-- `family_id` yang sama. Bila token yang SUDAH dicabut dipakai lagi, itu berarti
-- salinannya ada di tangan orang lain — dan satu-satunya jawaban yang aman
-- adalah mencabut seluruh keluarga, bukan hanya token itu.

CREATE TYPE session_revoke_reason AS ENUM (
  'rotated',
  'logout',
  'revoked_by_user',
  'password_changed',
  'reuse_detected',
  'expired'
);

CREATE TABLE sessions (
  id                 uuid PRIMARY KEY,
  user_id            uuid NOT NULL REFERENCES users (id),
  family_id          uuid NOT NULL,
  refresh_token_hash text NOT NULL UNIQUE,
  device             text,
  ip                 inet,
  user_agent         text,
  issued_at          timestamptz NOT NULL DEFAULT now(),
  last_seen_at       timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL,
  revoked_at         timestamptz,
  revoked_reason     session_revoke_reason,
  replaced_by        uuid REFERENCES sessions (id),
  CONSTRAINT sessions_revocation_complete
    CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL))
);

CREATE INDEX sessions_user_active_idx ON sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX sessions_family_idx ON sessions (family_id);

GRANT SELECT, INSERT, UPDATE ON sessions TO paadu_app;

-- ── Peristiwa autentikasi ──────────────────────────────────────────────────
--
-- Append-only. Ia yang menjawab "apa yang terjadi pada akun ini" saat insiden,
-- dan jawaban itu tidak berguna bila dapat diubah.

CREATE TABLE auth_events (
  id          uuid PRIMARY KEY,
  user_id     uuid REFERENCES users (id),
  tenant_id   uuid REFERENCES tenants (id),
  type        text NOT NULL,
  actor_type  actor_type NOT NULL DEFAULT 'human',
  ip          inet,
  user_agent  text,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_events_user_idx ON auth_events (user_id, created_at DESC);

GRANT SELECT, INSERT ON auth_events TO paadu_app;
GRANT SELECT ON auth_events TO paadu_analytics;

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
