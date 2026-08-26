-- Migrasi CONTOH untuk menguji penjaga. TIDAK pernah dijalankan.
--
-- Berkas di direktori ini sengaja melanggar aturan `aturan-migrasi.js`. Ia
-- tinggal di luar `migrations/` supaya `npm run migrate` tidak pernah
-- melihatnya, dan supaya penjaga dapat diuji terhadap pelanggaran sungguhan
-- alih-alih terhadap teks yang dikarang di dalam test.

-- Up Migration
--
-- Seluruh isi berkas ini aman, dan setiap bagiannya mewakili satu cara yang
-- mudah dikira melanggar:
--
--   * CHECK dan NOT NULL di dalam CREATE TABLE — tidak ada baris lama
--   * indeks atas tabel yang baru dibuat di migrasi yang sama — tabelnya kosong
--   * ADD COLUMN nullable, dan ADD COLUMN NOT NULL yang berbawaan
--   * CHECK dengan NOT VALID, dan UNIQUE lewat indeks yang sudah ada
--   * titik koma di dalam literal dan di dalam blok $$ … $$

CREATE TABLE wilayah (
  id         uuid PRIMARY KEY,
  tenant_id  uuid NOT NULL,
  kode       text NOT NULL,
  CONSTRAINT wilayah_kode_wajar CHECK (char_length(kode) BETWEEN 2 AND 8)
);

CREATE INDEX idx_wilayah_tenant ON wilayah (tenant_id);

ALTER TABLE customers ADD COLUMN catatan_wilayah text;
ALTER TABLE customers ADD COLUMN aktif boolean NOT NULL DEFAULT true;

ALTER TABLE customers
  ADD CONSTRAINT customers_catatan_wajar CHECK (char_length(catatan_wilayah) < 200) NOT VALID;

ALTER TABLE customers
  ADD CONSTRAINT customers_kode_unik UNIQUE USING INDEX idx_customers_kode;

INSERT INTO wilayah (id, tenant_id, kode)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'ID-BA');

DO $$
BEGIN
  RAISE NOTICE 'titik koma di sini; tidak memecah pernyataan';
END $$;

-- Down Migration
DO $$ BEGIN RAISE EXCEPTION 'maju saja'; END $$;
