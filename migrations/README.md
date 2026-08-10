# Migrations

Migrasi basis data, berurutan dan hanya bersifat menambah.

Aturan yang mengikat:
- Kolom baru selalu nullable atau punya nilai bawaan
- Kolom tidak pernah dihapus atau diubah artinya dalam satu versi
- Perubahan yang merusak dipecah tiga tahap di rilis terpisah

Migrasi pertama dibuat di Sesi A3 dan wajib memuat dua belas keputusan skema di `docs/Design_Handoff_Spec.md` bagian 2.
