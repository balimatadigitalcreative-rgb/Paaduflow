-- Up Migration
--
-- Konvensi bersama. Berkas ini yang membuat modul berikutnya tidak dapat lupa.
--
-- Butir 1 dan 2 dari dua belas keputusan skema (Design_Handoff_Spec.md §2)
-- ditetapkan di sini, bukan di tabel mana pun — supaya keduanya tidak dapat
-- ditambal belakangan di empat puluh tabel.

-- ── Tiga sumbu status, sebagai tipe yang dapat dipakai ulang ───────────────
--
-- Terpisah, bukan satu enum gabungan. Sebuah faktur dapat sekaligus diposting,
-- dibayar sebagian, dan jatuh tempo (Information_Architecture §3).

CREATE TYPE lifecycle_status AS ENUM (
  'draft',
  'submitted',
  'pending_approval',
  'approved',
  'rejected',
  'posted',
  'cancelled',
  'void',
  'closed'
);

CREATE TYPE settlement_status AS ENUM (
  'unpaid',
  'partially_paid',
  'paid',
  'overpaid',
  'written_off'
);

CREATE TYPE fulfillment_status AS ENUM (
  'not_fulfilled',
  'partially_fulfilled',
  'fulfilled',
  'returned'
);

-- Jenis pelaku — butir 6. Aksi AI harus dapat dibedakan dari aksi manusia,
-- dan menebaknya dari actor_id tidak cukup.
CREATE TYPE actor_type AS ENUM ('human', 'ai', 'system');

-- `overdue` sengaja tidak ada di mana pun. Ia kondisi turunan dari due_date dan
-- settlement_status — butir 3. Test invarian menolak kolom bernama overdue.

-- ── Konteks tenant ─────────────────────────────────────────────────────────
--
-- Dipasang UnitOfWork lewat SET LOCAL di dalam transaksi. Bila belum dipasang,
-- fungsi ini mengembalikan NULL dan seluruh kebijakan RLS menghasilkan nol
-- baris. Gagal tertutup, bukan gagal terbuka.

CREATE FUNCTION paadu.current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

-- ── Trigger konvensi ───────────────────────────────────────────────────────

CREATE FUNCTION paadu.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

-- Optimistic concurrency — butir 1.
--
-- Aplikasi tidak pernah menulis document_version. Ia menyertakannya di klausa
-- WHERE (`If-Match`); nol baris terpengaruh berarti konflik, dan API menjawab
-- 409. Trigger inilah yang menaikkannya, sehingga tidak ada jalur tulis yang
-- dapat lupa.
CREATE FUNCTION paadu.bump_document_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.document_version IS DISTINCT FROM OLD.document_version THEN
    RAISE EXCEPTION 'document_version tidak boleh ditulis aplikasi; ia dinaikkan trigger'
      USING ERRCODE = '23514';
  END IF;
  NEW.document_version := OLD.document_version + 1;
  RETURN NEW;
END
$$;

-- Dokumen terposting tidak dapat diedit peran mana pun — D-008.
--
-- Satu-satunya perubahan yang lolos adalah lifecycle_status dari `posted` ke
-- `void` atau `closed`. Perbandingan memakai to_jsonb supaya aturan ini berlaku
-- untuk tabel apa pun tanpa perlu tahu kolomnya.
CREATE FUNCTION paadu.reject_posted_edit() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.lifecycle_status <> 'posted' THEN
    RETURN NEW;
  END IF;

  IF NEW.lifecycle_status NOT IN ('void', 'closed') THEN
    RAISE EXCEPTION 'Dokumen berstatus posted tidak dapat diedit (D-008)'
      USING ERRCODE = '42501';
  END IF;

  IF (to_jsonb(NEW) - 'lifecycle_status' - 'document_version' - 'updated_at' - 'updated_by')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'lifecycle_status' - 'document_version' - 'updated_at' - 'updated_by')
  THEN
    RAISE EXCEPTION 'Dokumen posted hanya boleh berubah pada lifecycle_status (D-008)'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END
$$;

-- ── Registry tabel transaksional ───────────────────────────────────────────
--
-- Fungsi kontrak di bawah memudahkan; registry inilah yang memaksa. Test
-- invarian memindai katalog Postgres dan menggagalkan build bila ada tabel
-- transaksional yang tidak terdaftar di sini.

CREATE TABLE paadu.transactional_tables (
  table_name      text PRIMARY KEY,
  has_settlement  boolean NOT NULL,
  has_fulfillment boolean NOT NULL,
  registered_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON paadu.transactional_tables TO paadu_app, paadu_analytics;

-- ── Kontrak tabel transaksional ────────────────────────────────────────────
--
-- Modul menulis kolom bisnisnya saja, lalu memanggil fungsi ini. Seluruh kolom
-- lintas modul, kunci, indeks, kebijakan RLS, hak akses, dan trigger dipasang
-- sekaligus.
--
-- Tabel pemanggil wajib sudah punya kolom `id uuid NOT NULL` dan
-- `tenant_id uuid NOT NULL`. Kunci primer komposit (tenant_id, id) dipasang di
-- sini: ia yang membuka jalan partisi per tenant, dan membuat foreign key dua
-- kolom sehingga rujukan lintas tenant mustahil.

CREATE FUNCTION paadu.apply_transactional_contract(
  p_table           text,
  p_has_settlement  boolean DEFAULT false,
  p_has_fulfillment boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format($sql$
    ALTER TABLE public.%1$I
      ADD COLUMN company_id        uuid NOT NULL,
      ADD COLUMN document_version  integer NOT NULL DEFAULT 1,
      ADD COLUMN lifecycle_status  lifecycle_status NOT NULL DEFAULT 'draft',
      ADD COLUMN created_at        timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN created_by        uuid,
      ADD COLUMN updated_at        timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN updated_by        uuid,
      ADD COLUMN deleted_at        timestamptz,
      ADD COLUMN deleted_by        uuid
  $sql$, p_table);

  IF p_has_settlement THEN
    EXECUTE format(
      'ALTER TABLE public.%1$I ADD COLUMN settlement_status settlement_status NOT NULL DEFAULT ''unpaid''',
      p_table);
  END IF;

  IF p_has_fulfillment THEN
    EXECUTE format(
      'ALTER TABLE public.%1$I ADD COLUMN fulfillment_status fulfillment_status NOT NULL DEFAULT ''not_fulfilled''',
      p_table);
  END IF;

  EXECUTE format('ALTER TABLE public.%1$I ADD PRIMARY KEY (tenant_id, id)', p_table);

  -- Foreign key dua kolom. Baris tenant A tidak dapat merujuk company tenant B —
  -- basis data yang menolak, bukan kode.
  EXECUTE format($sql$
    ALTER TABLE public.%1$I
      ADD CONSTRAINT %1$s_company_fkey
      FOREIGN KEY (tenant_id, company_id) REFERENCES public.companies (tenant_id, id)
  $sql$, p_table);

  EXECUTE format(
    'CREATE INDEX %1$s_tenant_company_idx ON public.%1$I (tenant_id, company_id, created_at DESC)',
    p_table);

  EXECUTE format('ALTER TABLE public.%1$I ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('ALTER TABLE public.%1$I FORCE ROW LEVEL SECURITY', p_table);
  EXECUTE format($sql$
    CREATE POLICY tenant_isolation ON public.%1$I
      USING (tenant_id = paadu.current_tenant_id())
      WITH CHECK (tenant_id = paadu.current_tenant_id())
  $sql$, p_table);

  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%1$I TO paadu_app', p_table);
  EXECUTE format('GRANT SELECT ON public.%1$I TO paadu_analytics', p_table);

  -- Nama trigger diawali angka supaya urutan jalannya pasti — Postgres
  -- menjalankannya menurut abjad nama.
  EXECUTE format($sql$
    CREATE TRIGGER t10_document_version BEFORE UPDATE ON public.%1$I
      FOR EACH ROW EXECUTE FUNCTION paadu.bump_document_version()
  $sql$, p_table);

  EXECUTE format($sql$
    CREATE TRIGGER t20_updated_at BEFORE UPDATE ON public.%1$I
      FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at()
  $sql$, p_table);

  EXECUTE format($sql$
    CREATE TRIGGER t30_posted_guard BEFORE UPDATE ON public.%1$I
      FOR EACH ROW EXECUTE FUNCTION paadu.reject_posted_edit()
  $sql$, p_table);

  INSERT INTO paadu.transactional_tables (table_name, has_settlement, has_fulfillment)
  VALUES (p_table, p_has_settlement, p_has_fulfillment);
END
$$;

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
