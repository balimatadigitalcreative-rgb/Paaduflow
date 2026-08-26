-- Migrasi CONTOH untuk menguji penjaga. TIDAK pernah dijalankan.
--
-- Berkas di direktori ini sengaja melanggar aturan `aturan-migrasi.js`. Ia
-- tinggal di luar `migrations/` supaya `npm run migrate` tidak pernah
-- melihatnya, dan supaya penjaga dapat diuji terhadap pelanggaran sungguhan
-- alih-alih terhadap teks yang dikarang di dalam test.

-- Up Migration
CREATE INDEX idx_sales_documents_customer ON sales_documents (customer_id);

-- Down Migration
DO $$ BEGIN RAISE EXCEPTION 'maju saja'; END $$;
