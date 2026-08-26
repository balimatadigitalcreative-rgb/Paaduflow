-- Migrasi CONTOH untuk menguji penjaga. TIDAK pernah dijalankan.
--
-- Berkas di direktori ini sengaja melanggar aturan `aturan-migrasi.js`. Ia
-- tinggal di luar `migrations/` supaya `npm run migrate` tidak pernah
-- melihatnya, dan supaya penjaga dapat diuji terhadap pelanggaran sungguhan
-- alih-alih terhadap teks yang dikarang di dalam test.

-- Up Migration
-- paadu:jalankan-manual Indeks atas sales_documents yang sudah berisi jutaan
-- baris; dibangun CONCURRENTLY di luar jam sibuk.
CREATE INDEX idx_sales_documents_tanggal ON sales_documents (document_date);

-- Down Migration
DO $$ BEGIN RAISE EXCEPTION 'maju saja'; END $$;
