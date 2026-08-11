# DB

Kontrak tingkat basis data yang dipakai lintas modul. Saat ini isinya satu: daftar tabel append-only.

Yang layak di sini adalah konstanta dan tipe yang **menjelaskan aturan basis data** — hal yang perlu dibaca kode aplikasi maupun test, dan yang salah bila hidup di satu modul saja.

Yang tidak layak: kueri modul, koneksi, dan repository. Ketiganya milik `src/infrastructure/db`. Folder ini tidak pernah membuka koneksi.

Daftar di sini kembar dengan hak akses yang diberikan migrasi. Yang menjaga keduanya tidak menyimpang adalah test invarian, bukan disiplin — lihat `docs/DECISIONS.md` D-005.
