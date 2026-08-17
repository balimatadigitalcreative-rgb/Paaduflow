-- Up Migration
--
-- Izin modul Penjualan dan Akuntansi.
--
-- Keduanya dibangun sebelum lapisan HTTP ada, jadi katalog izinnya tidak pernah
-- terisi: tidak ada rute yang memerlukannya. Sesi antarmuka yang menemukannya —
-- lihat D-133.
--
-- Ditambahkan di migrasi tersendiri, bukan disisipkan ke 0015 atau 0018, karena
-- migrasi yang sudah tercatat tidak diubah lagi (D-033).

INSERT INTO permissions (key, module_id, entity, action, description, delegatable_to_agent, grantable_to_integration) VALUES
  ('penjualan.faktur.baca',    'sales', 'faktur', 'baca',    'Melihat faktur penjualan.',              true,  true),
  ('penjualan.faktur.kelola',  'sales', 'faktur', 'kelola',  'Membuat dan mengajukan faktur penjualan.', false, true),
  ('penjualan.faktur.setujui', 'sales', 'faktur', 'setujui', 'Menyetujui faktur penjualan.',           false, false),
  ('penjualan.faktur.posting', 'sales', 'faktur', 'posting', 'Memposting faktur penjualan ke buku besar.', false, false),
  ('akuntansi.bagan.baca',     'accounting', 'bagan', 'baca', 'Melihat bagan akun.',                   true,  true),
  ('akuntansi.buku.baca',      'accounting', 'buku',  'baca', 'Melihat buku besar.',                   true,  true);

INSERT INTO role_permissions (role_id, permission_key, scope)
SELECT r.id, p.key, 'company'::permission_scope
  FROM roles r
 CROSS JOIN permissions p
 WHERE r.is_system
   AND p.module_id IN ('sales', 'accounting')
   AND (
     r.key IN ('tenant_owner', 'tenant_admin', 'company_admin')
     -- Member memperoleh operasional dan baca, TIDAK termasuk persetujuan.
     -- Pengaju tidak menyetujui dokumennya sendiri (D-009), dan memberikan izin
     -- setujui ke peran yang sama dengan pengaju membuat aturan itu bergantung
     -- pada kebetulan siapa yang menekan tombolnya.
     OR (r.key = 'member' AND p.key <> 'penjualan.faktur.setujui')
   );

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
