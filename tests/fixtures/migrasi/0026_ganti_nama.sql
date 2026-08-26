-- Migrasi CONTOH untuk menguji penjaga. TIDAK pernah dijalankan.
--
-- Berkas di direktori ini sengaja melanggar aturan `aturan-migrasi.js`. Ia
-- tinggal di luar `migrations/` supaya `npm run migrate` tidak pernah
-- melihatnya, dan supaya penjaga dapat diuji terhadap pelanggaran sungguhan
-- alih-alih terhadap teks yang dikarang di dalam test.

-- Up Migration
ALTER TABLE customers RENAME COLUMN npwp_lama TO npwp;

-- Down Migration
DO $$ BEGIN RAISE EXCEPTION 'maju saja'; END $$;
