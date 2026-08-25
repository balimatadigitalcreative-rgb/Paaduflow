-- Up Migration
--
-- Bahasa pilihan pengguna, disimpan di server.
--
-- Kolom di `users`, bukan tabel preferensi tersendiri. Ada satu preferensi yang
-- perlu bertahan lintas peramban hari ini; membangun tabel kunci-nilai untuk
-- satu baris berarti menambah join di setiap pemuatan halaman demi keluwesan
-- yang belum ada yang meminta.
--
-- Di `users` — bukan di `company_access` — karena bahasa milik orangnya. Satu
-- orang yang memegang tiga company tidak berganti bahasa saat berpindah antar
-- company; ia hanya berpindah tempat kerja.
--
-- Tema dan kerapatan sengaja TIDAK ikut. Keduanya menyangkut layar yang sedang
-- dipakai — laptop terang di kantor, layar gelap di rumah — dan menyeragamkan-
-- nya lintas perangkat justru salah. Bahasa berbeda: ia menyangkut orangnya.

ALTER TABLE users
  ADD COLUMN preferred_language text NOT NULL DEFAULT 'id'
    CHECK (preferred_language IN ('id', 'en'));

-- Daftarnya dibatasi CHECK, dan itu disengaja. Menambah bahasa selalu menuntut
-- berkas locale baru ikut dikirim; membiarkan kolom menerima 'ms' sebelum
-- berkasnya ada hanya memindahkan kegagalan ke layar pengguna, di mana ia
-- muncul sebagai teks kosong alih-alih sebagai galat.

COMMENT ON COLUMN users.preferred_language IS
  'Bahasa antarmuka pilihan pengguna. Presentasi saja — tidak pernah mempengaruhi nilai tersimpan atau perhitungan (D-151).';

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
