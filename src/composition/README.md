# Composition

**Satu-satunya tempat yang mengenal seluruh modul.** Semua folder lain hanya mengenal tetangganya lewat antarmuka.

Isinya: daftar manifest modul, perakitan ketergantungan, dan tiga titik masuk proses sesuai D-044 — `api`, `worker` untuk pekerjaan berat, dan `scheduler` untuk relay outbox, pekerjaan berjadwal, serta pemeriksaan invarian berkala.

Folder ini dikecualikan dari aturan batas modul, karena tugasnya memang menyilangkan batas itu. Bila kode selain di sini perlu mengenal dua modul sekaligus, itu tanda ada port yang belum dideklarasikan.

Ditentukan di Sesi A1 · lihat `docs/DECISIONS.md` D-040 dan D-044
