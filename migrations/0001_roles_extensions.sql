-- Up Migration
--
-- Peran, skema, dan ekstensi. Tidak ada tabel di sini.
--
-- Tiga peran, karena pemisahannya yang membuat penegakan append-only dan RLS
-- mungkin sama sekali:
--   paadu_owner     — pemilik objek, menjalankan migrasi. Peran koneksi migrasi.
--   paadu_app       — dipakai runtime. Bukan pemilik, tanpa BYPASSRLS.
--   paadu_analytics — hanya baca, untuk replika analitik.
--
-- paadu_app sengaja bukan pemilik tabel. Pemilik tabel lolos dari kebijakan RLS
-- kecuali tabelnya memakai FORCE ROW LEVEL SECURITY — dan mengandalkan FORCE
-- saja berarti satu tabel yang lupa memasangnya menjadi lubang senyap.

CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS paadu;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'paadu_app') THEN
    CREATE ROLE paadu_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'paadu_analytics') THEN
    CREATE ROLE paadu_analytics NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO paadu_app, paadu_analytics;
GRANT USAGE ON SCHEMA paadu TO paadu_app, paadu_analytics;

-- Down Migration
--
-- Migrasi bersifat maju saja. Pembatalan dilakukan lewat migrasi baru yang
-- mencabut, bukan lewat `down` — lihat migrations/README.md dan D-033.
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
