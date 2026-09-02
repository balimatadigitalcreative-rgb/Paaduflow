-- Migrasi CONTOH untuk menguji penjaga. TIDAK pernah dijalankan.
--
-- Berkas ini HARUS LOLOS. Ia melengkapi tabel yang dibuat di migrasi yang sama
-- lewat `ALTER TABLE` — pola baku di repo ini, karena kontrak tabel
-- transaksional menambah kolomnya lebih dulu sehingga batasannya harus
-- menyusul.
--
-- Sintaksnya persis sama dengan mengubah tabel LAMA, dan hanya yang terakhir
-- berbahaya. Penjaga yang tidak membedakan keduanya memaksa setiap modul baru
-- memakai pintu darurat — dan pintu darurat yang dipakai setiap kali berhenti
-- berarti apa-apa.

-- Up Migration
CREATE TABLE payment_receipts (
  id        uuid NOT NULL,
  tenant_id uuid NOT NULL,
  number    text
);

SELECT paadu.apply_transactional_contract('payment_receipts');

ALTER TABLE payment_receipts
  ADD CONSTRAINT payment_receipts_customer_fkey
    FOREIGN KEY (tenant_id, customer_id) REFERENCES customers (tenant_id, id),
  ADD CONSTRAINT payment_receipts_number_unique
    UNIQUE (tenant_id, company_id, number);

-- Down Migration
DO $$ BEGIN RAISE EXCEPTION 'maju saja'; END $$;
