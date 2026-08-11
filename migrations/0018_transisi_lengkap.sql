-- Up Migration
--
-- Melengkapi mesin status — Flow_Archetypes §2.
--
-- Ditemukan saat menjawab gerbang Sesi D4. Tabel transisi di migrasi 0015
-- kehilangan empat perpindahan yang ditetapkan Archetype 2, dan salah satunya
-- membuat faktur yang ditolak terkunci selamanya.
--
-- Ini modul referensi. Mesin status yang bolong di sini akan disalin ke dua
-- puluh modul berikutnya beserta bolongnya.

INSERT INTO document_transitions (doc_type, from_status, to_status, requires) VALUES
  -- Archetype 2: "rejected → draft". Ada untuk penawaran dan pesanan, hilang
  -- untuk faktur — sehingga faktur yang ditolak tidak punya jalan kembali.
  ('invoice', 'rejected', 'draft', '{}'),

  -- Archetype 2: "draft | submitted | approved → cancelled", selama belum
  -- menyentuh buku besar. Hanya `draft` yang terpasang sebelumnya.
  ('quotation', 'submitted', 'cancelled', '{}'),
  ('order',     'submitted', 'cancelled', '{}'),
  ('order',     'approved',  'cancelled', '{}'),
  ('invoice',   'submitted', 'cancelled', '{}'),
  ('invoice',   'approved',  'cancelled', '{}'),

  -- Tarik kembali: pengaju dapat menarik selama belum ada yang menyetujui.
  -- Syarat `own_document` adalah kebalikan `not_own_document` — hanya pengaju
  -- yang boleh menarik pengajuannya sendiri.
  ('quotation', 'submitted', 'draft', '{own_document}'),
  ('order',     'submitted', 'draft', '{own_document}'),
  ('invoice',   'submitted', 'draft', '{own_document}');

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
