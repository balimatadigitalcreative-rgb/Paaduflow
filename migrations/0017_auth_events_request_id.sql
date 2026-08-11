-- Up Migration
--
-- `X-Request-Id` di peristiwa autentikasi — Resilience §7.
--
-- `audit_log` sudah membawanya sejak migrasi 0005, tetapi `auth_events` tidak.
-- Akibatnya satu insiden autentikasi tidak dapat ditelusuri dari log ke jejak
-- ke catatan — dan justru peristiwa autentikasi yang paling sering perlu
-- ditelusuri saat insiden keamanan.
--
-- Nullable dengan sengaja: peristiwa yang lahir di luar permintaan HTTP —
-- pekerjaan terjadwal, relay outbox — tidak punya id permintaan, dan memaksa
-- nilai palsu di sana akan membuat penelusuran menunjuk ke tempat yang salah.

ALTER TABLE auth_events ADD COLUMN request_id text;

CREATE INDEX auth_events_request_idx
  ON auth_events (request_id)
  WHERE request_id IS NOT NULL;

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
