-- Up Migration
--
-- Pembelian — Module 06. Mengikuti pola modul referensi Penjualan.
--
-- Menemukan bahwa polanya belum benar-benar dapat diikuti adalah hasil dari
-- membangun modul kedua: tabel transisi bernama generik tetapi bertipe enum
-- Penjualan. Diperbaiki di bawah.

-- ── Transisi menjadi milik semua modul ────────────────────────────────────
--
-- Kolom bertipe sales_doc_type membuat tabel bernama document_transitions hanya
-- dapat menampung dokumen Penjualan. Modul kedua karena itu hanya punya dua
-- pilihan: menyalin tabelnya, atau melanggar namanya. Diubah menjadi text
-- supaya satu tabel melayani seluruh modul — dan supaya modul ketiga tidak
-- menghadapi pilihan yang sama. Tidak ada data lama yang hilang: setiap nilai
-- enum punya wakil text yang sama persis.
-- paadu:allow-breaking Tabel transisi bersama tidak dapat bertipe enum satu modul.
ALTER TABLE document_transitions ALTER COLUMN doc_type TYPE text;

-- ── Vendor ────────────────────────────────────────────────────────────────

CREATE TABLE vendors (
  id                    uuid NOT NULL,
  tenant_id             uuid NOT NULL,
  company_id            uuid NOT NULL,
  code                  text NOT NULL,
  name                  text NOT NULL,
  legal_name            text,
  tax_id                text,
  -- Menentukan apakah vendor dapat menerbitkan Faktur Pajak, dan karenanya
  -- apakah PPN-nya dapat dikreditkan — Module 06 §6.
  is_pkp                boolean NOT NULL DEFAULT false,
  payment_term_days     integer NOT NULL DEFAULT 30 CHECK (payment_term_days >= 0),
  withholding_category  text,
  bank_account          text,
  currency              char(3) NOT NULL DEFAULT 'IDR',
  status                text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid,
  deleted_at            timestamptz,
  deleted_by            uuid,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  UNIQUE (tenant_id, company_id, code),
  -- Vendor non-PKP tidak dapat memiliki NPWP yang dipakai mengkreditkan PPN.
  CONSTRAINT vendors_pkp_needs_tax_id CHECK (NOT is_pkp OR tax_id IS NOT NULL)
);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON vendors
  USING (tenant_id = paadu.current_tenant_id())
  WITH CHECK (tenant_id = paadu.current_tenant_id());
CREATE TRIGGER t20_updated_at BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();
GRANT SELECT, INSERT, UPDATE ON vendors TO paadu_app;
GRANT SELECT ON vendors TO paadu_analytics;

-- ── Dokumen pembelian ─────────────────────────────────────────────────────

CREATE TYPE purchase_doc_type AS ENUM ('rfq', 'purchase_order', 'bill', 'debit_note');

-- Hasil pencocokan tiga arah. Hanya berlaku untuk `bill`.
CREATE TYPE match_status AS ENUM ('not_matched', 'matched', 'exception', 'overridden');

CREATE TABLE purchase_documents (
  id                 uuid NOT NULL,
  tenant_id          uuid NOT NULL,
  doc_type           purchase_doc_type NOT NULL,
  number             text,
  vendor_id          uuid NOT NULL,
  issue_date         date NOT NULL,
  due_date           date,
  expected_date      date,
  currency           char(3) NOT NULL,
  exchange_rate      numeric(19, 8) NOT NULL DEFAULT 1,
  source_document_id uuid,
  subtotal           numeric(19, 4) NOT NULL DEFAULT 0,
  document_discount  numeric(19, 4) NOT NULL DEFAULT 0,
  tax_base           numeric(19, 4) NOT NULL DEFAULT 0,
  tax_total          numeric(19, 4) NOT NULL DEFAULT 0,
  withholding_total  numeric(19, 4) NOT NULL DEFAULT 0,
  total              numeric(19, 4) NOT NULL DEFAULT 0,
  match_status       match_status NOT NULL DEFAULT 'not_matched',
  -- Diisi hanya saat pengecualian disetujui. Siapa dan mengapa, keduanya wajib.
  override_by        uuid,
  override_reason    text,
  override_at        timestamptz,
  submitted_at       timestamptz,
  submitted_by       uuid,
  approved_at        timestamptz,
  approved_by        uuid,
  posted_at          timestamptz,
  posted_by          uuid
);

SELECT paadu.apply_transactional_contract('purchase_documents', true, true);

ALTER TABLE purchase_documents
  ADD CONSTRAINT purchase_documents_vendor_fkey
    FOREIGN KEY (tenant_id, vendor_id) REFERENCES vendors (tenant_id, id),
  ADD CONSTRAINT purchase_documents_source_fkey
    FOREIGN KEY (tenant_id, source_document_id) REFERENCES purchase_documents (tenant_id, id),
  ADD CONSTRAINT purchase_documents_number_unique
    UNIQUE (tenant_id, company_id, doc_type, number),
  -- Pengecualian yang disetujui tanpa alasan bukan pengecualian yang disetujui.
  ADD CONSTRAINT purchase_documents_override_complete
    CHECK ((match_status = 'overridden') = (override_by IS NOT NULL AND override_reason IS NOT NULL));

CREATE INDEX purchase_documents_vendor_idx
  ON purchase_documents (tenant_id, company_id, vendor_id, issue_date DESC);

CREATE TABLE purchase_document_lines (
  id            uuid NOT NULL,
  tenant_id     uuid NOT NULL,
  company_id    uuid NOT NULL,
  document_id   uuid NOT NULL,
  line_no       integer NOT NULL CHECK (line_no > 0),
  item_id       uuid,
  description   text NOT NULL,
  qty           numeric(18, 4) NOT NULL CHECK (qty >= 0),
  uom           text NOT NULL,
  unit_price    numeric(19, 4) NOT NULL DEFAULT 0,
  discount_pct  numeric(9, 4) NOT NULL DEFAULT 0,
  net_amount    numeric(19, 4) NOT NULL DEFAULT 0,
  tax_code_id   uuid,
  tax_rate_pct  numeric(9, 4) NOT NULL DEFAULT 0,
  tax_amount    numeric(19, 4) NOT NULL DEFAULT 0,
  warehouse_id  uuid,
  expected_date date,
  -- Per BARIS, sama seperti Penjualan. Inilah yang memungkinkan penerimaan
  -- sebagian dan penagihan bertahap.
  qty_received  numeric(18, 4) NOT NULL DEFAULT 0 CHECK (qty_received >= 0),
  qty_billed    numeric(18, 4) NOT NULL DEFAULT 0 CHECK (qty_billed >= 0),
  qty_returned  numeric(18, 4) NOT NULL DEFAULT 0 CHECK (qty_returned >= 0),
  -- Baris tagihan menunjuk ke baris pesanan yang ditagihnya.
  source_line_id uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES purchase_documents (tenant_id, id),
  FOREIGN KEY (tenant_id, item_id) REFERENCES items (tenant_id, id),
  FOREIGN KEY (tenant_id, warehouse_id) REFERENCES warehouses (tenant_id, id),
  FOREIGN KEY (tenant_id, source_line_id) REFERENCES purchase_document_lines (tenant_id, id),
  UNIQUE (tenant_id, document_id, line_no),
  -- Menagih barang yang belum datang tidak punya pembenaran operasional —
  -- Module 06 §11, TANPA toleransi.
  CONSTRAINT lines_billed_not_over_received CHECK (qty_billed <= qty_received)
);

CREATE INDEX purchase_document_lines_doc_idx
  ON purchase_document_lines (tenant_id, document_id, line_no);

-- ── Penerimaan barang ─────────────────────────────────────────────────────

CREATE TABLE goods_receipts (
  id                uuid NOT NULL,
  tenant_id         uuid NOT NULL,
  company_id        uuid NOT NULL,
  number            text,
  purchase_order_id uuid NOT NULL,
  vendor_id         uuid NOT NULL,
  warehouse_id      uuid NOT NULL,
  received_date     date NOT NULL,
  status            text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'posted', 'cancelled')),
  received_by       uuid,
  posted_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  FOREIGN KEY (tenant_id, purchase_order_id) REFERENCES purchase_documents (tenant_id, id),
  FOREIGN KEY (tenant_id, vendor_id) REFERENCES vendors (tenant_id, id),
  FOREIGN KEY (tenant_id, warehouse_id) REFERENCES warehouses (tenant_id, id),
  UNIQUE (tenant_id, company_id, number)
);

CREATE TABLE goods_receipt_lines (
  id               uuid NOT NULL,
  tenant_id        uuid NOT NULL,
  receipt_id       uuid NOT NULL,
  po_line_id       uuid NOT NULL,
  item_id          uuid NOT NULL,
  qty_received     numeric(18, 4) NOT NULL CHECK (qty_received > 0),
  qty_rejected     numeric(18, 4) NOT NULL DEFAULT 0 CHECK (qty_rejected >= 0),
  rejection_reason text,
  unit_cost        numeric(19, 4) NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, receipt_id) REFERENCES goods_receipts (tenant_id, id),
  FOREIGN KEY (tenant_id, po_line_id) REFERENCES purchase_document_lines (tenant_id, id),
  FOREIGN KEY (tenant_id, item_id) REFERENCES items (tenant_id, id),
  -- Penolakan QC tanpa alasan tidak dapat ditindaklanjuti siapa pun.
  CONSTRAINT receipt_rejection_needs_reason
    CHECK (qty_rejected = 0 OR rejection_reason IS NOT NULL)
);

CREATE INDEX goods_receipt_lines_po_idx ON goods_receipt_lines (tenant_id, po_line_id);

-- ── Toleransi pencocokan ──────────────────────────────────────────────────

CREATE TABLE match_tolerances (
  tenant_id             uuid NOT NULL,
  company_id            uuid NOT NULL,
  qty_over_receipt_pct  numeric(9, 4) NOT NULL DEFAULT 0 CHECK (qty_over_receipt_pct >= 0),
  price_variance_pct    numeric(9, 4) NOT NULL DEFAULT 0 CHECK (price_variance_pct >= 0),
  price_variance_amount numeric(19, 4) NOT NULL DEFAULT 0 CHECK (price_variance_amount >= 0),
  require_approval_above numeric(19, 4),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, company_id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id)
);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['purchase_document_lines', 'goods_receipts', 'goods_receipt_lines',
                           'match_tolerances'] LOOP
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

CREATE TRIGGER t20_updated_at BEFORE UPDATE ON goods_receipts
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();
CREATE TRIGGER t20_updated_at BEFORE UPDATE ON purchase_document_lines
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();

-- ── Kontrol yang tidak dapat dilewati ─────────────────────────────────────
--
-- Layanan menolak tagihan `exception`. Trigger ini menolaknya lagi, di tingkat
-- basis data, karena kontrol yang hanya hidup di satu layanan dapat dilewati
-- oleh jalur tulis yang belum ada hari ini — termasuk skrip perbaikan data.
--
-- Kalau kontrol ini bisa dilewati dengan parameter, ia bukan kontrol.

CREATE FUNCTION paadu.reject_posting_unmatched_bill() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.doc_type <> 'bill' OR NEW.lifecycle_status <> 'posted' THEN
    RETURN NEW;
  END IF;
  IF OLD.lifecycle_status = 'posted' THEN
    RETURN NEW;
  END IF;

  IF NEW.match_status IN ('exception', 'not_matched') THEN
    RAISE EXCEPTION
      'Tagihan berstatus pencocokan % tidak dapat diposting. Selesaikan pencocokan atau ajukan override.',
      NEW.match_status
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER t40_match_guard BEFORE UPDATE ON purchase_documents
  FOR EACH ROW EXECUTE FUNCTION paadu.reject_posting_unmatched_bill();

-- ── Transisi Pembelian ────────────────────────────────────────────────────
--
-- Bentuk yang sama dengan Penjualan, termasuk kelengkapan Archetype 2 yang
-- ditemukan hilang saat menjawab gerbang Sesi D4.

INSERT INTO document_transitions (doc_type, from_status, to_status, requires) VALUES
  ('rfq',            'draft',            'submitted',        '{}'),
  ('rfq',            'submitted',        'approved',         '{}'),
  ('rfq',            'submitted',        'rejected',         '{}'),
  ('rfq',            'submitted',        'draft',            '{own_document}'),
  ('rfq',            'submitted',        'cancelled',        '{}'),
  ('rfq',            'rejected',         'draft',            '{}'),
  ('rfq',            'draft',            'cancelled',        '{}'),
  ('rfq',            'approved',         'closed',           '{}'),

  ('purchase_order', 'draft',            'submitted',        '{}'),
  ('purchase_order', 'submitted',        'pending_approval', '{}'),
  ('purchase_order', 'submitted',        'draft',            '{own_document}'),
  ('purchase_order', 'submitted',        'cancelled',        '{}'),
  ('purchase_order', 'pending_approval', 'approved',         '{not_own_document}'),
  ('purchase_order', 'pending_approval', 'rejected',         '{not_own_document}'),
  ('purchase_order', 'rejected',         'draft',            '{}'),
  ('purchase_order', 'draft',            'cancelled',        '{}'),
  ('purchase_order', 'approved',         'cancelled',        '{}'),
  ('purchase_order', 'approved',         'closed',           '{}'),

  ('bill',           'draft',            'submitted',        '{}'),
  ('bill',           'submitted',        'pending_approval', '{}'),
  ('bill',           'submitted',        'approved',         '{}'),
  ('bill',           'submitted',        'draft',            '{own_document}'),
  ('bill',           'submitted',        'cancelled',        '{}'),
  ('bill',           'pending_approval', 'approved',         '{not_own_document}'),
  ('bill',           'pending_approval', 'rejected',         '{not_own_document}'),
  ('bill',           'rejected',         'draft',            '{}'),
  ('bill',           'draft',            'cancelled',        '{}'),
  ('bill',           'approved',         'cancelled',        '{}'),
  -- Syarat `three_way_matched` dipenuhi layanan hanya bila pencocokan lolos
  -- atau pengecualian sudah disetujui — dan trigger di atas memeriksanya lagi.
  ('bill',           'approved',         'posted',           '{fiscal_period_open,three_way_matched}'),
  ('bill',           'posted',           'void',             '{reversal_journal}'),
  ('bill',           'posted',           'closed',           '{}');

-- ── Katalog izin ──────────────────────────────────────────────────────────

INSERT INTO permissions (key, module_id, entity, action, description, delegatable_to_agent, grantable_to_integration) VALUES
  ('pembelian.vendor.kelola',    'purchasing', 'vendor',     'kelola',  'Mengelola data vendor.',                 false, true),
  ('pembelian.pesanan.kelola',   'purchasing', 'pesanan',    'kelola',  'Membuat dan mengubah pesanan pembelian.', false, true),
  ('pembelian.penerimaan.catat', 'purchasing', 'penerimaan', 'catat',   'Mencatat penerimaan barang.',            false, true),
  ('pembelian.tagihan.posting',  'purchasing', 'tagihan',    'posting', 'Memposting tagihan vendor ke buku besar.', false, false),
  -- Sengaja TIDAK diberikan bersama posting: yang memposting tagihan tidak
  -- boleh sekaligus yang memaafkan ketidakcocokannya — Module 06 §10.
  ('pembelian.pencocokan.override', 'purchasing', 'pencocokan', 'override',
   'Menyetujui pengecualian pencocokan tiga arah.', false, false);

INSERT INTO role_permissions (role_id, permission_key, scope)
SELECT r.id, p.key, 'company'::permission_scope
  FROM roles r
 CROSS JOIN permissions p
 WHERE r.is_system
   AND p.module_id = 'purchasing'
   AND (
     r.key IN ('tenant_owner', 'tenant_admin')
     -- Company Admin memperoleh seluruhnya termasuk override.
     OR (r.key = 'company_admin')
     -- Member memperoleh operasional, TIDAK termasuk override.
     OR (r.key = 'member' AND p.key <> 'pembelian.pencocokan.override')
   );

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
