-- Up Migration
--
-- Penerimaan Pembayaran — Module 04 §"Penerimaan pembayaran".
--
-- Menutup satu-satunya celah di siklus faktur → pembayaran: sampai migrasi ini,
-- `settlement_status` ada di `sales_documents` dan TIDAK PERNAH diubah oleh satu
-- baris kode pun. Umur piutang menyaring kolom itu lalu menjumlahkan total
-- faktur, sehingga piutang hanya bisa naik — terlihat benar, dan tidak mungkin
-- benar.
--
-- ══════════════════════════════════════════════════════════════════════════
--   LINGKUP YANG SENGAJA DIPOTONG
--
--   Alokasi ke faktur WAJIB. Uang yang diterima sebelum fakturnya ada — uang
--   muka — tidak punya tempat di sini, dan itu keputusan sadar untuk trial 5
--   September, bukan kelalaian.
--
--   Konsekuensinya harus diketahui siapa pun yang membaca ini: agen perjalanan
--   lazim menerima DP sebelum keberangkatan. Bila kelak uang muka masuk
--   lingkup, ia menuntut `payment_allocations` boleh kosong, akun "Uang Muka
--   Pelanggan", dan jurnal yang berbeda — seluruhnya dapat ditambahkan secara
--   aditif di atas bentuk ini, tanpa mengubah tabel yang sudah ada.
--
--   `customer_credits` di Module 04 juga di luar lingkup, karena kelebihan
--   bayar tidak dapat terjadi: batas alokasi ditegakkan basis data di bawah.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE payment_receipts (
  id             uuid NOT NULL,
  tenant_id      uuid NOT NULL,
  -- NULL sampai submit. Draf tidak punya nomor — D-007, sama dengan faktur.
  number         text,
  customer_id    uuid NOT NULL,
  received_date  date NOT NULL,
  currency       char(3) NOT NULL,
  exchange_rate  numeric(19, 8) NOT NULL DEFAULT 1,
  -- Uang yang BENAR-BENAR diterima. Bukan jumlah alokasinya: keduanya boleh
  -- berbeda selama masih draf, dan selisihnya yang membuat pembayaran sebagian
  -- dapat dicatat jujur.
  amount         numeric(19, 4) NOT NULL CHECK (amount > 0),
  submitted_at   timestamptz,
  submitted_by   uuid,
  posted_at      timestamptz,
  posted_by      uuid,
  -- Jurnal yang lahir saat posting: Kas debit, Piutang kredit. Nomor akunnya
  -- TIDAK disebut di sini — ia datang dari lapisan penentuan di modul
  -- Akuntansi, seperti seluruh modul lain.
  journal_id     uuid
);

-- Kontrak tabel transaksional: company_id, document_version, lifecycle_status,
-- kolom audit, kunci komposit, RLS, hak akses, dan penjaga dokumen terposting.
--
-- Tanpa sumbu settlement maupun fulfillment: penerimaan pembayaran BUKAN
-- dokumen yang menunggu dilunasi atau dipenuhi — ia yang melunasi.
SELECT paadu.apply_transactional_contract('payment_receipts');

ALTER TABLE payment_receipts
  ADD CONSTRAINT payment_receipts_customer_fkey
    FOREIGN KEY (tenant_id, customer_id) REFERENCES customers (tenant_id, id),
  -- Nomor unik per company. NULL tidak ikut dibandingkan, sehingga banyak draf
  -- tanpa nomor tetap boleh hidup berdampingan.
  ADD CONSTRAINT payment_receipts_number_unique
    UNIQUE (tenant_id, company_id, number);

CREATE INDEX payment_receipts_customer_idx
  ON payment_receipts (tenant_id, company_id, customer_id, received_date DESC);

-- ── Alokasi ───────────────────────────────────────────────────────────────
--
-- Tabel tersendiri, bukan kolom `sales_document_id` di penerimaan. Module 04
-- menyebutnya apa adanya: satu penerimaan dapat melunasi banyak faktur, dan
-- satu faktur dapat dilunasi banyak penerimaan. Satu transfer yang membayar
-- tiga paket tur adalah kejadian biasa, bukan kasus tepi.

CREATE TABLE payment_allocations (
  id                uuid NOT NULL,
  tenant_id         uuid NOT NULL,
  company_id        uuid NOT NULL,
  receipt_id        uuid NOT NULL,
  sales_document_id uuid NOT NULL,
  allocated_amount  numeric(19, 4) NOT NULL CHECK (allocated_amount > 0),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  FOREIGN KEY (tenant_id, receipt_id) REFERENCES payment_receipts (tenant_id, id),
  FOREIGN KEY (tenant_id, sales_document_id) REFERENCES sales_documents (tenant_id, id),
  -- Satu baris per faktur per penerimaan. Dua baris untuk pasangan yang sama
  -- adalah cara paling mudah membuat jumlahnya diam-diam berlipat.
  UNIQUE (tenant_id, receipt_id, sales_document_id)
);

CREATE INDEX payment_allocations_receipt_idx
  ON payment_allocations (tenant_id, receipt_id);
CREATE INDEX payment_allocations_document_idx
  ON payment_allocations (tenant_id, sales_document_id);

ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payment_allocations
  USING (tenant_id = paadu.current_tenant_id())
  WITH CHECK (tenant_id = paadu.current_tenant_id());
CREATE TRIGGER t20_updated_at BEFORE UPDATE ON payment_allocations
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_allocations TO paadu_app;
GRANT SELECT ON payment_allocations TO paadu_analytics;

-- ── Dua batas yang dijaga basis data, bukan aplikasi ──────────────────────
--
-- Layanan akan menolak lebih dulu dengan pesan yang menyebut sisa per faktur;
-- ini yang menjamin bila ada jalur tulis yang lupa. Pola yang sama dipakai
-- `lines_not_over_invoiced` di 0015 — penjagaan keuangan tidak boleh hanya
-- hidup di satu lapisan.
--
-- Keduanya penjumlahan lintas baris, sehingga tidak dapat ditulis sebagai
-- CHECK. Trigger constraint yang DEFERRABLE membuat satu penerimaan dengan
-- banyak alokasi diperiksa setelah seluruh barisnya masuk, bukan di tengah.

CREATE FUNCTION paadu.periksa_alokasi_pembayaran() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_tenant    uuid;
  v_receipt   uuid;
  v_dokumen   uuid;
  v_terpakai  numeric(19, 4);
  v_tersedia  numeric(19, 4);
BEGIN
  v_tenant  := COALESCE(NEW.tenant_id, OLD.tenant_id);
  v_receipt := COALESCE(NEW.receipt_id, OLD.receipt_id);
  v_dokumen := COALESCE(NEW.sales_document_id, OLD.sales_document_id);

  -- 1 · Tidak boleh mengalokasikan uang yang tidak diterima.
  SELECT COALESCE(SUM(a.allocated_amount), 0) INTO v_terpakai
    FROM payment_allocations a
   WHERE a.tenant_id = v_tenant AND a.receipt_id = v_receipt;

  SELECT r.amount INTO v_tersedia
    FROM payment_receipts r
   WHERE r.tenant_id = v_tenant AND r.id = v_receipt;

  IF v_tersedia IS NOT NULL AND v_terpakai > v_tersedia THEN
    RAISE EXCEPTION
      'Alokasi % melampaui uang yang diterima % pada penerimaan %',
      v_terpakai, v_tersedia, v_receipt
      USING ERRCODE = 'check_violation';
  END IF;

  -- 2 · Faktur tidak boleh dilunasi melebihi nilainya.
  --
  -- Alokasi dari penerimaan yang dibatalkan atau di-void TIDAK dihitung. Tanpa
  -- pengecualian itu, satu penerimaan yang salah dan sudah dibatalkan akan
  -- menahan fakturnya selamanya.
  SELECT COALESCE(SUM(a.allocated_amount), 0) INTO v_terpakai
    FROM payment_allocations a
    JOIN payment_receipts r
      ON r.tenant_id = a.tenant_id AND r.id = a.receipt_id
   WHERE a.tenant_id = v_tenant
     AND a.sales_document_id = v_dokumen
     AND r.lifecycle_status NOT IN ('cancelled', 'void', 'rejected');

  SELECT d.total INTO v_tersedia
    FROM sales_documents d
   WHERE d.tenant_id = v_tenant AND d.id = v_dokumen;

  IF v_tersedia IS NOT NULL AND v_terpakai > v_tersedia THEN
    RAISE EXCEPTION
      'Pelunasan % melampaui nilai faktur % pada dokumen %',
      v_terpakai, v_tersedia, v_dokumen
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER t40_batas_alokasi
  AFTER INSERT OR UPDATE OR DELETE ON payment_allocations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION paadu.periksa_alokasi_pembayaran();

-- ── Penjaga dokumen terposting dilonggarkan, bukan dilewati ───────────────
--
-- ══════════════════════════════════════════════════════════════════════════
--   MENGAPA INI HARUS BERUBAH
--
--   `reject_posted_edit` menolak SETIAP perubahan pada dokumen terposting
--   kecuali `lifecycle_status`. Itu membuat pelunasan mustahil: faktur menjadi
--   `paid` justru SETELAH ia diposting, dan `settlement_status` adalah kolom
--   di dokumen yang sama.
--
--   Ini bukan celah di D-008, melainkan penjaganya yang terlalu lebar. D-008
--   melarang MENGUBAH ISI dokumen terposting — nilai, baris, tanggal, pelanggan
--   — karena itulah yang membuat audit trail bermakna. Ia tidak pernah
--   bermaksud membekukan sumbu status yang lain.
--
--   Justru sebaliknya: CLAUDE.md menuntut tiga kolom status TERPISAH, dan
--   seluruh gunanya pemisahan itu adalah agar ketiganya bergerak sendiri-
--   sendiri. `lifecycle_status` membeku di `posted`; `settlement_status` dan
--   `fulfillment_status` justru baru mulai bergerak di sana.
--
--   Yang TIDAK dilakukan: menulis pelunasan lewat fungsi SECURITY DEFINER, atau
--   mematikan trigger sementara. Keduanya membuat jalan memutar yang, sekali
--   ada, akan dipakai untuk hal lain.
-- ══════════════════════════════════════════════════════════════════════════
--
-- Perubahannya hanya MELONGGARKAN. Kode lama tidak pernah menulis
-- `settlement_status` pada dokumen terposting — tidak ada satu pun jalur tulis
-- yang melakukannya — sehingga ia aman selama reload bergulir maupun rollback.

CREATE OR REPLACE FUNCTION paadu.reject_posted_edit() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.lifecycle_status <> 'posted' THEN
    RETURN NEW;
  END IF;

  IF NEW.lifecycle_status NOT IN ('posted', 'void', 'closed') THEN
    RAISE EXCEPTION 'Dokumen berstatus posted tidak dapat diedit (D-008)'
      USING ERRCODE = '42501';
  END IF;

  -- Kolom yang boleh berubah setelah posting: sumbu status selain lifecycle,
  -- dan kolom pembukuan yang memang berubah setiap kali baris disentuh.
  IF (to_jsonb(NEW)
        - 'lifecycle_status' - 'settlement_status' - 'fulfillment_status'
        - 'document_version' - 'updated_at' - 'updated_by')
     IS DISTINCT FROM
     (to_jsonb(OLD)
        - 'lifecycle_status' - 'settlement_status' - 'fulfillment_status'
        - 'document_version' - 'updated_at' - 'updated_by')
  THEN
    RAISE EXCEPTION 'Dokumen posted hanya boleh berubah pada sumbu status (D-008)'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END
$$;

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
