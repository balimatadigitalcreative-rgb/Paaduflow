-- Up Migration
--
-- Memperbaiki cacat konkurensi yang ditemukan gerbang Sesi D4.
--
-- `stock_movements.sequence` semula diambil dengan `max(sequence) + 1` di dalam
-- pernyataan penyisipan. Itu tidak selamat: dua transaksi bersamaan membaca
-- nilai maksimum yang sama dan sama-sama mencoba menulis nomor berikutnya.
-- Kekangan unik menangkapnya — sebagaimana dirancang — tetapi akibatnya
-- penyisipan bersamaan gagal, dan alur penjualan yang berjalan paralel ikut
-- gagal bersamanya.
--
-- Perbaikannya memakai SEQUENCE Postgres, yang aman terhadap konkurensi.
-- Konsekuensinya: nomor dapat berlubang bila transaksi dibatalkan.
--
-- Lubang di sini **tidak apa-apa**, dan itu keputusan yang perlu dinyatakan:
-- kolom ini adalah penanda posisi bagi proyeksi saldo, bukan nomor dokumen.
-- Larangan celah di D-007 berlaku untuk nomor yang dilihat auditor — nomor
-- faktur, bukan kursor internal.

CREATE SEQUENCE stock_movement_sequence AS bigint START 1;

GRANT USAGE, SELECT ON SEQUENCE stock_movement_sequence TO paadu_app;

-- Dimulai di atas nilai yang sudah terpakai, supaya data yang sudah ada tidak
-- bertabrakan dengan nomor yang baru diterbitkan.
SELECT setval(
  'stock_movement_sequence',
  GREATEST((SELECT COALESCE(max(sequence), 0) FROM stock_movements), 1)
);

COMMENT ON COLUMN stock_movements.sequence IS
  'Penanda posisi untuk proyeksi saldo. Monoton naik, boleh berlubang. Bukan nomor dokumen.';

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
