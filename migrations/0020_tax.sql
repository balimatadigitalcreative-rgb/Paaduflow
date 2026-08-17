-- Up Migration
--
-- Pajak — Module 08.
--
-- Tidak ada satu pun angka tarif di berkas ini. Seluruh tarif, batas, dan
-- syarat formal adalah konfigurasi yang belum divalidasi konsultan pajak;
-- nilai untuk pengembangan ada di `tools/seed/pajak-pengembangan.sql`, yang
-- bukan migrasi dan karena itu tidak pernah ikut ke produksi.

-- Dipakai constraint EXCLUDE di bawah: ia perlu membandingkan kolom biasa
-- (tenant, company, kode) dengan operator kesamaan di dalam indeks GiST.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── Profil pajak company ──────────────────────────────────────────────────
--
-- Status PKP mengubah perilaku seluruh produk, jadi ia punya tabelnya sendiri
-- alih-alih menumpang sebagai kolom di `companies`: ia bertanggal, ia
-- berkas audit, dan ia akan tumbuh.

CREATE TABLE company_tax_profiles (
  tenant_id          uuid NOT NULL,
  company_id         uuid NOT NULL,
  npwp               text,
  is_pkp             boolean NOT NULL DEFAULT false,
  -- Sejak kapan PKP. Faktur pajak bertanggal sebelum ini tidak dapat terbit.
  pkp_effective_date date,
  nppkp              text,
  tax_office_code    text,
  applicable_taxes   jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  PRIMARY KEY (tenant_id, company_id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  -- PKP tanpa NPWP dan tanpa tanggal pengukuhan bukan PKP yang dapat
  -- menerbitkan apa pun.
  CONSTRAINT tax_profile_pkp_complete
    CHECK (NOT is_pkp OR (npwp IS NOT NULL AND pkp_effective_date IS NOT NULL))
);

-- ── Kode pajak ────────────────────────────────────────────────────────────

CREATE TYPE tax_type AS ENUM ('vat_out', 'vat_in', 'withholding', 'exempt', 'not_collected');
CREATE TYPE tax_calculation_base AS ENUM ('net', 'gross');

CREATE TABLE tax_codes (
  id               uuid NOT NULL,
  tenant_id        uuid NOT NULL,
  company_id       uuid NOT NULL,
  code             text NOT NULL CHECK (code ~ '^[A-Z][A-Z0-9\-]*$'),
  name             text NOT NULL,
  tax_type         tax_type NOT NULL,
  -- Tanpa DEFAULT. Tarif adalah keputusan konsultan pajak; kolom bertarif nol
  -- yang muncul sendiri adalah tarif yang tidak pernah diputuskan siapa pun.
  rate             numeric(7, 4) NOT NULL CHECK (rate >= 0),
  valid_from       date NOT NULL,
  -- Eksklusif: baris berlaku pada [valid_from, valid_to). NULL berarti terbuka.
  valid_to         date,
  calculation_base tax_calculation_base NOT NULL DEFAULT 'net',
  gl_account_id    uuid NOT NULL,
  is_creditable    boolean NOT NULL DEFAULT false,
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  FOREIGN KEY (tenant_id, gl_account_id) REFERENCES accounts (tenant_id, id),
  UNIQUE (tenant_id, company_id, code, valid_from),
  CONSTRAINT tax_codes_period_ordered CHECK (valid_to IS NULL OR valid_to > valid_from)
);

-- Dua versi kode yang sama tidak dapat berlaku pada tanggal yang sama.
--
-- Ditegakkan basis data, bukan aplikasi: pertanyaan "tarif mana yang berlaku
-- pada tanggal ini" harus punya tepat satu jawaban, dan jawaban ganda pada
-- pajak berarti dua angka yang sama-sama dapat dibenarkan di depan pemeriksa.
ALTER TABLE tax_codes ADD CONSTRAINT tax_codes_no_overlap
  EXCLUDE USING gist (
    tenant_id WITH =,
    company_id WITH =,
    code WITH =,
    daterange(valid_from, valid_to, '[)') WITH &&
  );

-- Tarif tidak dapat diubah. Titik.
--
-- Bukan "tidak dapat diubah bila sudah dipakai": "sudah dipakai" adalah
-- keadaan yang berubah, dan kontrol yang bergantung pada keadaan punya jendela
-- di mana ia belum berlaku. Kode yang salah dan belum masuk buku pajak tetap
-- dapat dihapus; yang sudah masuk tidak dapat dihapus maupun diubah tarifnya.
--
-- Yang boleh berubah hanya `valid_to` (menutup versi lama), `status`, dan
-- `name`. Selebihnya membuat dokumen lama terhitung ulang, dan laporan yang
-- sudah dilaporkan berhenti cocok.
CREATE FUNCTION paadu.reject_tax_rate_edit() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.rate IS DISTINCT FROM OLD.rate
     OR NEW.tax_type IS DISTINCT FROM OLD.tax_type
     OR NEW.calculation_base IS DISTINCT FROM OLD.calculation_base
     OR NEW.valid_from IS DISTINCT FROM OLD.valid_from
     OR NEW.is_creditable IS DISTINCT FROM OLD.is_creditable
     OR NEW.gl_account_id IS DISTINCT FROM OLD.gl_account_id THEN
    RAISE EXCEPTION
      'Tarif dan sifat kode pajak tidak dapat diubah. Tutup versi ini dengan valid_to, lalu buat versi baru dengan valid_from.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER t20_updated_at BEFORE UPDATE ON tax_codes
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();
CREATE TRIGGER t40_rate_immutable BEFORE UPDATE ON tax_codes
  FOR EACH ROW EXECUTE FUNCTION paadu.reject_tax_rate_edit();

-- ── Aturan penentuan pajak ────────────────────────────────────────────────
--
-- Kembar dengan `account_determination_rules`, dengan satu penyimpangan yang
-- disengaja: aturan menunjuk KODE (`PPN-OUT`), bukan baris `tax_codes`.
--
-- Kalau ia menunjuk baris, maka setiap perubahan tarif — yang selalu berarti
-- baris baru — memaksa seluruh aturan penentuan ditulis ulang. Resolusi karena
-- itu berjalan dua langkah: aturan menjawab kode, lalu kode dan tanggal
-- dokumen menjawab versinya.

CREATE TABLE tax_determination_rules (
  id                uuid NOT NULL,
  tenant_id         uuid NOT NULL,
  company_id        uuid NOT NULL,
  transaction_type  text NOT NULL CHECK (transaction_type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  item_category_id  uuid,
  partner_type      text,
  -- null berarti aturan berlaku untuk mitra PKP maupun bukan.
  partner_is_pkp    boolean,
  region_code       text,
  tax_code          text NOT NULL,
  specificity       integer GENERATED ALWAYS AS (
                      (CASE WHEN item_category_id IS NOT NULL THEN 8 ELSE 0 END) +
                      (CASE WHEN partner_is_pkp   IS NOT NULL THEN 4 ELSE 0 END) +
                      (CASE WHEN region_code      IS NOT NULL THEN 2 ELSE 0 END) +
                      (CASE WHEN partner_type     IS NOT NULL THEN 1 ELSE 0 END)
                    ) STORED,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  UNIQUE NULLS NOT DISTINCT (
    tenant_id, company_id, transaction_type,
    item_category_id, partner_type, partner_is_pkp, region_code
  )
);

CREATE INDEX tax_rules_lookup_idx
  ON tax_determination_rules (tenant_id, company_id, transaction_type, specificity DESC);

CREATE TRIGGER t20_updated_at BEFORE UPDATE ON tax_determination_rules
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();

-- ── Nomor seri ────────────────────────────────────────────────────────────

CREATE TABLE tax_serial_allocations (
  id               uuid NOT NULL,
  tenant_id        uuid NOT NULL,
  company_id       uuid NOT NULL,
  -- Awalan dan lebar disimpan supaya nomor dapat dibentuk kembali persis,
  -- termasuk nol di depan.
  prefix           text NOT NULL DEFAULT '',
  digits           integer NOT NULL DEFAULT 8 CHECK (digits BETWEEN 1 AND 20),
  range_start      bigint NOT NULL CHECK (range_start > 0),
  range_end        bigint NOT NULL,
  allocated_at     timestamptz NOT NULL DEFAULT now(),
  expires_at       date,
  source_reference text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  CONSTRAINT allocation_range_ordered CHECK (range_end >= range_start),
  -- Alokasi raksasa biasanya salah ketik, dan biayanya satu baris per nomor.
  CONSTRAINT allocation_range_bounded CHECK (range_end - range_start < 100000)
);

CREATE TYPE tax_serial_status AS ENUM ('available', 'used', 'cancelled', 'expired');

-- Setiap nomor satu baris, dimaterialisasi saat alokasi.
--
-- Alternatifnya menyimpan rentang dan menghitung sisanya. Ditolak: pertanyaan
-- "nomor mana yang batal" lalu menjadi selisih antara dua himpunan yang harus
-- disusun ulang setiap kali ditanya, dan pertanyaan itu ditanyakan pemeriksa.
CREATE TABLE tax_serial_usage (
  tenant_id             uuid NOT NULL,
  company_id            uuid NOT NULL,
  allocation_id         uuid NOT NULL,
  serial_number         bigint NOT NULL,
  formatted_number      text NOT NULL,
  status                tax_serial_status NOT NULL DEFAULT 'available',
  output_tax_invoice_id uuid,
  used_at               timestamptz,
  cancelled_at          timestamptz,
  cancel_reason         text,
  PRIMARY KEY (tenant_id, company_id, serial_number),
  FOREIGN KEY (tenant_id, allocation_id) REFERENCES tax_serial_allocations (tenant_id, id),
  UNIQUE (tenant_id, formatted_number),
  -- Nomor tersedia belum menunjuk apa pun; nomor terpakai selalu menunjuk
  -- faktur pajaknya.
  --
  -- Nomor BATAL sengaja tidak dibatasi: ia justru harus tetap menunjuk faktur
  -- yang dulu memakainya. Di situlah pertanggungjawabannya — "nomor ini
  -- dibatalkan" tanpa "dibatalkan dari faktur mana" tidak menjawab pertanyaan
  -- yang ditanyakan pemeriksa.
  CONSTRAINT serial_available_has_no_invoice
    CHECK (status <> 'available' OR output_tax_invoice_id IS NULL),
  CONSTRAINT serial_used_has_invoice
    CHECK (status <> 'used' OR output_tax_invoice_id IS NOT NULL),
  CONSTRAINT serial_cancelled_has_reason
    CHECK (status <> 'cancelled' OR cancel_reason IS NOT NULL)
);

CREATE INDEX tax_serial_available_idx
  ON tax_serial_usage (tenant_id, company_id, serial_number)
  WHERE status = 'available';

-- ── Faktur pajak keluaran ─────────────────────────────────────────────────
--
-- Dokumen tersendiri, bukan kolom di faktur penjualan. Ia punya nomor seri
-- sendiri, siklus hidup sendiri, dan dapat mencakup beberapa faktur komersial.
--
-- Siklusnya SENGAJA tidak memakai `lifecycle_status` maupun
-- `document_transitions`: faktur pajak tidak pernah disetujui dan tidak pernah
-- diposting ke buku besar. Memaksakannya ke Archetype 2 berarti memetakan
-- `issued` ke `posted` dan `replaced` ke `void` — dua kebohongan kecil yang
-- akan dibaca orang berikutnya sebagai kebenaran.

CREATE TYPE tax_invoice_status AS ENUM ('draft', 'issued', 'cancelled', 'replaced');

CREATE TABLE output_tax_invoices (
  id               uuid NOT NULL,
  tenant_id        uuid NOT NULL,
  company_id       uuid NOT NULL,
  serial_number    bigint,
  formatted_number text,
  customer_id      uuid NOT NULL,
  -- Disalin saat terbit. NPWP pelanggan hari ini bukan NPWP-nya saat transaksi.
  customer_npwp    text,
  customer_name    text NOT NULL,
  invoice_date     date NOT NULL,
  tax_period       text NOT NULL CHECK (tax_period ~ '^\d{4}-\d{2}$'),
  tax_code_id      uuid NOT NULL,
  base_amount      numeric(19, 4) NOT NULL DEFAULT 0,
  tax_amount       numeric(19, 4) NOT NULL DEFAULT 0,
  status           tax_invoice_status NOT NULL DEFAULT 'draft',
  -- Faktur pengganti menunjuk yang digantikan; yang digantikan menjadi
  -- `replaced`. Rantainya utuh dan dapat ditelusuri dua arah.
  replaces_id      uuid,
  issued_at        timestamptz,
  issued_by        uuid,
  cancelled_at     timestamptz,
  cancelled_by     uuid,
  cancel_reason    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  FOREIGN KEY (tenant_id, customer_id) REFERENCES customers (tenant_id, id),
  FOREIGN KEY (tenant_id, tax_code_id) REFERENCES tax_codes (tenant_id, id),
  FOREIGN KEY (tenant_id, replaces_id) REFERENCES output_tax_invoices (tenant_id, id),
  UNIQUE (tenant_id, formatted_number),
  -- Terbit berarti bernomor. Draf tidak pernah memegang nomor seri.
  CONSTRAINT output_issued_has_serial
    CHECK ((status = 'draft') = (serial_number IS NULL)),
  CONSTRAINT output_cancelled_has_reason
    CHECK (status <> 'cancelled' OR cancel_reason IS NOT NULL)
);

CREATE INDEX output_tax_invoices_period_idx
  ON output_tax_invoices (tenant_id, company_id, tax_period, status);

-- Satu faktur pajak dapat mencakup beberapa faktur komersial — Module 08 §4.
CREATE TABLE output_tax_invoice_sources (
  tenant_id             uuid NOT NULL,
  output_tax_invoice_id uuid NOT NULL,
  sales_document_id     uuid NOT NULL,
  base_amount           numeric(19, 4) NOT NULL DEFAULT 0,
  tax_amount            numeric(19, 4) NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, output_tax_invoice_id, sales_document_id),
  FOREIGN KEY (tenant_id, output_tax_invoice_id) REFERENCES output_tax_invoices (tenant_id, id),
  FOREIGN KEY (tenant_id, sales_document_id) REFERENCES sales_documents (tenant_id, id)
);

-- ── Faktur pajak masukan ──────────────────────────────────────────────────

CREATE TABLE input_tax_invoices (
  id                    uuid NOT NULL,
  tenant_id             uuid NOT NULL,
  company_id            uuid NOT NULL,
  vendor_id             uuid NOT NULL,
  -- Disalin saat pencatatan. Status PKP vendor hari ini bukan statusnya saat
  -- transaksi, dan yang menentukan kredit adalah yang saat transaksi.
  vendor_npwp           text,
  vendor_is_pkp         boolean NOT NULL,
  supplier_number       text NOT NULL,
  invoice_date          date NOT NULL,
  tax_period            text NOT NULL CHECK (tax_period ~ '^\d{4}-\d{2}$'),
  -- Periode pengkreditan dapat berbeda dari periode fakturnya — Module 08 §4.
  credit_period         text CHECK (credit_period ~ '^\d{4}-\d{2}$'),
  purchase_document_id  uuid,
  tax_code_id           uuid NOT NULL,
  base_amount           numeric(19, 4) NOT NULL DEFAULT 0,
  tax_amount            numeric(19, 4) NOT NULL DEFAULT 0,
  is_creditable         boolean NOT NULL DEFAULT false,
  validated_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  FOREIGN KEY (tenant_id, vendor_id) REFERENCES vendors (tenant_id, id),
  FOREIGN KEY (tenant_id, purchase_document_id) REFERENCES purchase_documents (tenant_id, id),
  FOREIGN KEY (tenant_id, tax_code_id) REFERENCES tax_codes (tenant_id, id),
  UNIQUE (tenant_id, company_id, vendor_id, supplier_number)
);

-- Apa yang kurang, bukan sekadar bendera merah — Module 08 §8.
--
-- Satu baris per syarat yang tidak terpenuhi, sehingga daftar faktur masukan
-- dapat menampilkan alasannya tanpa menjalankan ulang validasi.
CREATE TABLE input_tax_invoice_defects (
  tenant_id            uuid NOT NULL,
  input_tax_invoice_id uuid NOT NULL,
  defect_code          text NOT NULL,
  detail               text NOT NULL,
  detected_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, input_tax_invoice_id, defect_code),
  FOREIGN KEY (tenant_id, input_tax_invoice_id) REFERENCES input_tax_invoices (tenant_id, id)
);

-- ── Buku pajak ────────────────────────────────────────────────────────────
--
-- Append-only. Ia dasar laporan masa, dan dasar yang dapat disunting bukan
-- dasar. Didaftarkan di `src/db/append-only-tables.ts`, dan test invarian
-- membandingkan daftar itu dengan katalog Postgres.

CREATE TYPE tax_direction AS ENUM ('out', 'in', 'withheld');

CREATE TABLE tax_ledger (
  id                    uuid NOT NULL,
  tenant_id             uuid NOT NULL,
  company_id            uuid NOT NULL,
  tax_period            text NOT NULL CHECK (tax_period ~ '^\d{4}-\d{2}$'),
  tax_code_id           uuid NOT NULL,
  direction             tax_direction NOT NULL,
  document_type         text NOT NULL,
  document_id           uuid NOT NULL,
  document_date         date NOT NULL,
  partner_id            uuid,
  partner_npwp          text,
  base_amount           numeric(19, 4) NOT NULL,
  tax_amount            numeric(19, 4) NOT NULL,
  is_creditable         boolean NOT NULL DEFAULT true,
  non_creditable_reason text,
  posted_at             timestamptz NOT NULL DEFAULT now(),
  created_by            uuid,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  FOREIGN KEY (tenant_id, tax_code_id) REFERENCES tax_codes (tenant_id, id),
  -- Satu dokumen menyumbang paling banyak satu baris per kode dan arah.
  -- Tanpa ini, posting yang diulang menggandakan buku pajak diam-diam.
  UNIQUE (tenant_id, document_type, document_id, tax_code_id, direction),
  CONSTRAINT tax_ledger_reason_when_not_creditable
    CHECK (is_creditable OR non_creditable_reason IS NOT NULL)
);

CREATE INDEX tax_ledger_period_idx
  ON tax_ledger (tenant_id, company_id, tax_period, tax_code_id, direction);

-- ── RLS dan hak akses ─────────────────────────────────────────────────────

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'company_tax_profiles', 'tax_codes', 'tax_determination_rules',
    'tax_serial_allocations', 'tax_serial_usage',
    'output_tax_invoices', 'output_tax_invoice_sources',
    'input_tax_invoices', 'input_tax_invoice_defects', 'tax_ledger'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I
         USING (tenant_id = paadu.current_tenant_id())
         WITH CHECK (tenant_id = paadu.current_tenant_id())', t);
    EXECUTE format('GRANT SELECT ON public.%I TO paadu_analytics', t);
  END LOOP;

  -- Seluruhnya boleh ditulis dan diubah, KECUALI buku pajak.
  FOREACH t IN ARRAY ARRAY[
    'company_tax_profiles', 'tax_codes', 'tax_determination_rules',
    'tax_serial_allocations', 'tax_serial_usage',
    'output_tax_invoices', 'output_tax_invoice_sources',
    'input_tax_invoices', 'input_tax_invoice_defects'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO paadu_app', t);
  END LOOP;
END $$;

-- Buku pajak hanya menerima sisipan. Tidak ada UPDATE, tidak ada DELETE —
-- D-005, dan daftarnya di src/db/append-only-tables.ts.
GRANT SELECT, INSERT ON tax_ledger TO paadu_app;

CREATE TRIGGER t20_updated_at BEFORE UPDATE ON company_tax_profiles
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();
CREATE TRIGGER t20_updated_at BEFORE UPDATE ON output_tax_invoices
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();
CREATE TRIGGER t20_updated_at BEFORE UPDATE ON input_tax_invoices
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();

-- Kode pajak yang sudah masuk buku pajak tidak dapat dihapus — Module 08 §11.
-- Foreign key dari `tax_ledger` sudah melarangnya, dan pesan di bawah membuat
-- penolakannya terbaca oleh manusia alih-alih sebagai galat constraint.
CREATE FUNCTION paadu.reject_used_tax_code_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM tax_ledger
     WHERE tenant_id = OLD.tenant_id AND tax_code_id = OLD.id
  ) THEN
    RAISE EXCEPTION
      'Kode pajak % sudah masuk buku pajak dan tidak dapat dihapus. Tutup masa berlakunya dengan valid_to.',
      OLD.code
      USING ERRCODE = '23503';
  END IF;
  RETURN OLD;
END
$$;

CREATE TRIGGER t40_used_code_undeletable BEFORE DELETE ON tax_codes
  FOR EACH ROW EXECUTE FUNCTION paadu.reject_used_tax_code_delete();

-- ── Katalog izin ──────────────────────────────────────────────────────────

INSERT INTO permissions (key, module_id, entity, action, description, delegatable_to_agent, grantable_to_integration) VALUES
  ('pajak.laporan.baca',      'tax', 'laporan',    'baca',     'Melihat buku pajak dan rekonsiliasi.',        true,  true),
  ('pajak.profil.kelola',     'tax', 'profil',     'kelola',   'Mengubah profil pajak company.',              false, false),
  -- Hanya tingkat tenant. Tarif yang salah menyebar ke seluruh transaksi
  -- berikutnya di seluruh company, dan efeknya baru terlihat di laporan masa
  -- berikutnya — Module 08 §10.
  ('pajak.kode.kelola',       'tax', 'kode',       'kelola',   'Membuat dan menutup versi kode pajak.',       false, false),
  ('pajak.aturan.kelola',     'tax', 'aturan',     'kelola',   'Mengubah aturan penentuan pajak.',            false, false),
  ('pajak.seri.kelola',       'tax', 'seri',       'kelola',   'Mencatat alokasi nomor seri faktur pajak.',   false, false),
  ('pajak.faktur.terbit',     'tax', 'faktur',     'terbit',   'Menerbitkan faktur pajak keluaran.',          false, false),
  ('pajak.faktur.batal',      'tax', 'faktur',     'batal',    'Membatalkan faktur pajak keluaran.',          false, false),
  ('pajak.masukan.validasi',  'tax', 'masukan',    'validasi', 'Memvalidasi faktur pajak masukan.',           false, false);

INSERT INTO role_permissions (role_id, permission_key, scope)
SELECT r.id, p.key, 'company'::permission_scope
  FROM roles r
 CROSS JOIN permissions p
 WHERE r.is_system
   AND p.module_id = 'tax'
   AND (
     -- Tarif hanya di tingkat tenant. Company Admin tidak memperolehnya.
     r.key IN ('tenant_owner', 'tenant_admin')
     OR (r.key = 'company_admin' AND p.key <> 'pajak.kode.kelola')
     OR (r.key = 'member' AND p.key = 'pajak.laporan.baca')
   );

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
