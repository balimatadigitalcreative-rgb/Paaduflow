-- Up Migration
--
-- Pembatasan laju per IP — Modul 02 §5.
--
-- Penguncian bertahap per akun tidak menghentikan credential stuffing: satu
-- kata sandi umum dicoba ke ribuan akun berbeda, dan tidak ada satu akun pun
-- yang pernah mencapai ambang penguncian. Yang berulang di serangan itu bukan
-- akunnya, melainkan asalnya.
--
-- Tidak ada tabel baru. `auth_events` sudah mencatat setiap kegagalan beserta
-- IP-nya; yang kurang hanya indeks agar menghitungnya murah. Penghitung
-- terpisah akan menjadi keadaan kedua yang harus dijaga tetap sinkron dengan
-- catatan yang sudah ada.

CREATE INDEX auth_events_ip_failure_idx
  ON auth_events (ip, created_at DESC)
  WHERE type IN ('login.failed', 'mfa.failed');

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
