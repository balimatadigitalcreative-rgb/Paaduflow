-- Up Migration
--
-- Outbox — D-034 dan D-035.
--
-- Ditulis dalam transaksi yang sama dengan dokumennya, sehingga peristiwa dan
-- perubahan data berhasil atau gagal bersama. Inilah alasan antrean tinggal di
-- basis data: antrean di luar tidak dapat ikut komit.
--
-- Tabel ini SENGAJA BUKAN append-only. Relay harus menandai pesan terkirim, dan
-- pesan lama dipangkas. Catatan yang harus abadi ditulis konsumen ke audit_log,
-- yang append-only. Karena itu outbox_messages tidak pernah muncul di
-- src/db/append-only-tables.ts.

CREATE TABLE outbox_messages (
  id             uuid NOT NULL,
  tenant_id      uuid NOT NULL,
  company_id     uuid,
  aggregate_type text NOT NULL,
  aggregate_id   uuid,
  event_type     text NOT NULL,
  payload        jsonb NOT NULL,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  published_at   timestamptz,
  attempts       integer NOT NULL DEFAULT 0,
  last_error     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  PRIMARY KEY (tenant_id, id)
);

-- Relay hanya peduli pesan yang belum terkirim. Indeks parsial menjaga
-- ukurannya tetap kecil meski tabelnya besar.
CREATE INDEX outbox_unpublished_idx
  ON outbox_messages (occurred_at)
  WHERE published_at IS NULL;

ALTER TABLE outbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_messages FORCE ROW LEVEL SECURITY;

-- Kebijakan tenant seperti tabel lain, untuk jalur penulisan dari modul.
CREATE POLICY tenant_isolation ON outbox_messages
  USING (tenant_id = paadu.current_tenant_id())
  WITH CHECK (tenant_id = paadu.current_tenant_id());

-- Relay berjalan lintas tenant — ia memang harus melihat seluruh antrean.
-- Karena itu ia memakai peran sendiri, bukan menonaktifkan RLS untuk semua.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'paadu_relay') THEN
    CREATE ROLE paadu_relay NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO paadu_relay;

CREATE POLICY relay_all_tenants ON outbox_messages
  TO paadu_relay
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON outbox_messages TO paadu_app;
GRANT SELECT, UPDATE, DELETE ON outbox_messages TO paadu_relay;

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
