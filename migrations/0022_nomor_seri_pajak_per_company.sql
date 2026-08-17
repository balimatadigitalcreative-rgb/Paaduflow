-- Up Migration
--
-- Keunikan nomor seri faktur pajak dipersempit ke company.
--
-- `tax_serial_usage` lahir di 0020 dengan dua aturan yang saling bertentangan:
--
--   PRIMARY KEY (tenant_id, company_id, serial_number)   -- per company
--   UNIQUE      (tenant_id, formatted_number)            -- per tenant
--
-- Yang kedua keliru. Nomor seri diberikan per PKP, dan dua company dalam satu
-- tenant adalah dua NPWP dengan deret nomor yang berdiri sendiri. Selama
-- constraint lama berlaku, satu tenant hanya dapat memiliki SATU company yang
-- menerbitkan faktur pajak — company kedua ditolak basis data pada nomor
-- pertamanya, dengan pesan yang tidak menyebut sebab sebenarnya.
--
-- Cacatnya lolos karena seluruh test menyeed satu company per tenant, sehingga
-- kasus dua company tidak pernah dilalui. Ia ditemukan saat `seed:tax-dev`
-- dijalankan untuk company kedua.
--
-- Melebarkan keunikan tidak merusak data yang ada: setiap baris yang tadinya
-- sah tetap sah, dan tidak ada baris yang perlu dipindahkan.

ALTER TABLE tax_serial_usage
  DROP CONSTRAINT tax_serial_usage_tenant_id_formatted_number_key;

ALTER TABLE tax_serial_usage
  ADD CONSTRAINT tax_serial_usage_nomor_unik_per_company
    UNIQUE (tenant_id, company_id, formatted_number);

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
