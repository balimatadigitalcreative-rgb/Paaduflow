-- Up Migration
--
-- Penjualan — Module 04. **Modul referensi.**
--
-- Bentuk di berkas ini akan disalin dua puluh modul berikutnya, jadi ia
-- mengikuti Flow Archetypes apa adanya dan tidak menciptakan dialek sendiri.

CREATE TYPE sales_doc_type AS ENUM ('quotation', 'order', 'invoice');

CREATE TABLE customers (
  id                uuid NOT NULL,
  tenant_id         uuid NOT NULL,
  company_id        uuid NOT NULL,
  code              text NOT NULL,
  name              text NOT NULL,
  legal_name        text,
  tax_id            text,
  payment_term_days integer NOT NULL DEFAULT 30 CHECK (payment_term_days >= 0),
  credit_limit      numeric(19, 4),
  currency          char(3) NOT NULL,
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid,
  deleted_at        timestamptz,
  deleted_by        uuid,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  UNIQUE (tenant_id, company_id, code)
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customers
  USING (tenant_id = paadu.current_tenant_id())
  WITH CHECK (tenant_id = paadu.current_tenant_id());
CREATE TRIGGER t20_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();
GRANT SELECT, INSERT, UPDATE ON customers TO paadu_app;
GRANT SELECT ON customers TO paadu_analytics;

-- ── Satu tabel untuk penawaran, pesanan, dan faktur ───────────────────────
--
-- Yang berbeda hanya transisi status yang diizinkan. Tiga tabel dengan bentuk
-- yang hampir sama berarti tiga tempat yang harus diubah setiap kali dokumen
-- bertambah kolom, dan tiga peluang mereka menyimpang.

CREATE TABLE sales_documents (
  id                uuid NOT NULL,
  tenant_id         uuid NOT NULL,
  doc_type          sales_doc_type NOT NULL,
  -- NULL sampai submit. Draf tidak punya nomor — D-007.
  number            text,
  customer_id       uuid NOT NULL,
  document_date     date NOT NULL,
  due_date          date,
  currency          char(3) NOT NULL,
  exchange_rate     numeric(19, 8) NOT NULL DEFAULT 1,
  converted_from_id uuid,
  subtotal          numeric(19, 4) NOT NULL DEFAULT 0,
  document_discount numeric(19, 4) NOT NULL DEFAULT 0,
  tax_base          numeric(19, 4) NOT NULL DEFAULT 0,
  tax_total         numeric(19, 4) NOT NULL DEFAULT 0,
  total             numeric(19, 4) NOT NULL DEFAULT 0,
  submitted_at      timestamptz,
  submitted_by      uuid,
  approved_at       timestamptz,
  approved_by       uuid,
  posted_at         timestamptz,
  posted_by         uuid
);

-- Kontrak tabel transaksional dari Sesi A3: kolom lintas modul, kunci komposit,
-- RLS, hak akses, document_version, dan penjaga dokumen terposting sekaligus.
SELECT paadu.apply_transactional_contract('sales_documents', true, true);

ALTER TABLE sales_documents
  ADD CONSTRAINT sales_documents_customer_fkey
    FOREIGN KEY (tenant_id, customer_id) REFERENCES customers (tenant_id, id),
  ADD CONSTRAINT sales_documents_source_fkey
    FOREIGN KEY (tenant_id, converted_from_id) REFERENCES sales_documents (tenant_id, id),
  -- Nomor unik per company dan jenis dokumen. NULL tidak ikut dibandingkan,
  -- sehingga banyak draf tanpa nomor tetap boleh hidup berdampingan.
  ADD CONSTRAINT sales_documents_number_unique
    UNIQUE (tenant_id, company_id, doc_type, number);

CREATE INDEX sales_documents_customer_idx
  ON sales_documents (tenant_id, company_id, customer_id, document_date DESC);

CREATE TABLE sales_document_lines (
  id                     uuid NOT NULL,
  tenant_id              uuid NOT NULL,
  company_id             uuid NOT NULL,
  document_id            uuid NOT NULL,
  line_no                integer NOT NULL CHECK (line_no > 0),
  item_id                uuid,
  description            text NOT NULL,
  qty                    numeric(18, 4) NOT NULL CHECK (qty >= 0),
  uom                    text NOT NULL,
  unit_price             numeric(19, 4) NOT NULL DEFAULT 0,
  discount_pct           numeric(9, 4) NOT NULL DEFAULT 0,
  discount_amount        numeric(19, 4) NOT NULL DEFAULT 0,
  allocated_doc_discount numeric(19, 4) NOT NULL DEFAULT 0,
  net_amount             numeric(19, 4) NOT NULL DEFAULT 0,
  tax_code_id            uuid,
  tax_rate_pct           numeric(9, 4) NOT NULL DEFAULT 0,
  tax_amount             numeric(19, 4) NOT NULL DEFAULT 0,
  warehouse_id           uuid,
  -- Per BARIS, bukan per dokumen. Inilah yang memungkinkan konversi parsial
  -- dan penjagaan konversi berlebih.
  qty_delivered          numeric(18, 4) NOT NULL DEFAULT 0 CHECK (qty_delivered >= 0),
  qty_invoiced           numeric(18, 4) NOT NULL DEFAULT 0 CHECK (qty_invoiced >= 0),
  qty_returned           numeric(18, 4) NOT NULL DEFAULT 0 CHECK (qty_returned >= 0),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES sales_documents (tenant_id, id),
  FOREIGN KEY (tenant_id, item_id) REFERENCES items (tenant_id, id),
  FOREIGN KEY (tenant_id, warehouse_id) REFERENCES warehouses (tenant_id, id),
  UNIQUE (tenant_id, document_id, line_no),
  -- Penjagaan konversi berlebih di basis data. Layanan menolak lebih dulu
  -- dengan pesan yang menyebut sisa per baris; ini yang menjamin bila ada
  -- jalur tulis yang lupa.
  CONSTRAINT lines_not_over_invoiced CHECK (qty_invoiced <= qty),
  CONSTRAINT lines_not_over_delivered CHECK (qty_delivered <= qty)
);

CREATE INDEX sales_document_lines_doc_idx ON sales_document_lines (tenant_id, document_id, line_no);

ALTER TABLE sales_document_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_document_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sales_document_lines
  USING (tenant_id = paadu.current_tenant_id())
  WITH CHECK (tenant_id = paadu.current_tenant_id());
CREATE TRIGGER t20_updated_at BEFORE UPDATE ON sales_document_lines
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_document_lines TO paadu_app;
GRANT SELECT ON sales_document_lines TO paadu_analytics;

-- ── Transisi sebagai data ─────────────────────────────────────────────────
--
-- Bukan `switch` di dalam kode modul. `switch` per modul adalah dialek, dan
-- dialek itulah yang menyebar ke dua puluh modul berikutnya.
--
-- Sebagai tabel, ia dapat dibaca, diaudit, dan ditanya "siapa yang boleh
-- mengubah faktur dari approved ke posted" tanpa membaca satu baris kode.

CREATE TABLE document_transitions (
  doc_type    sales_doc_type NOT NULL,
  from_status lifecycle_status NOT NULL,
  to_status   lifecycle_status NOT NULL,
  /** Syarat yang diperiksa layanan, mis. `credit_limit`, `fiscal_period_open`. */
  requires    text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (doc_type, from_status, to_status)
);

GRANT SELECT ON document_transitions TO paadu_app, paadu_analytics;

INSERT INTO document_transitions (doc_type, from_status, to_status, requires) VALUES
  ('quotation', 'draft',            'submitted',        '{}'),
  ('quotation', 'submitted',        'approved',         '{}'),
  ('quotation', 'submitted',        'rejected',         '{}'),
  ('quotation', 'rejected',         'draft',            '{}'),
  ('quotation', 'draft',            'cancelled',        '{}'),
  ('quotation', 'approved',         'closed',           '{}'),

  ('order',     'draft',            'submitted',        '{}'),
  ('order',     'submitted',        'pending_approval', '{}'),
  ('order',     'submitted',        'approved',         '{credit_limit}'),
  ('order',     'pending_approval', 'approved',         '{credit_limit,not_own_document}'),
  ('order',     'pending_approval', 'rejected',         '{not_own_document}'),
  ('order',     'rejected',         'draft',            '{}'),
  ('order',     'draft',            'cancelled',        '{}'),
  ('order',     'approved',         'closed',           '{}'),

  ('invoice',   'draft',            'submitted',        '{}'),
  ('invoice',   'submitted',        'pending_approval', '{}'),
  ('invoice',   'submitted',        'approved',         '{}'),
  ('invoice',   'pending_approval', 'approved',         '{not_own_document}'),
  ('invoice',   'pending_approval', 'rejected',         '{not_own_document}'),
  ('invoice',   'approved',         'posted',           '{fiscal_period_open}'),
  ('invoice',   'draft',            'cancelled',        '{}'),
  -- Setelah posted hanya void, lewat jurnal pembalik — D-008.
  ('invoice',   'posted',           'void',             '{reversal_journal}'),
  ('invoice',   'posted',           'closed',           '{}');

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
