# Paadu Flow — Business Operating System

Platform multi-tenant, multi-company untuk individu, UMKM, hingga enterprise Indonesia.

Dokumentasi lengkap ada di `docs/`. Indeks: `docs/README.md`.
Keputusan arsitektur dan penyimpangan dari dokumen dicatat di `docs/DECISIONS.md`.

## Aturan yang selalu berlaku

- `docs/tokens.json` adalah sumber kebenaran tunggal untuk seluruh nilai visual.
  `src/styles/tokens.css` dibangkitkan Style Dictionary — jangan diedit tangan.
- Setiap tabel membawa `tenant_id` dan `company_id`, kecuali tabel identitas global.
- Setiap tabel transaksional membawa `document_version` untuk optimistic concurrency.
- Status dokumen memakai tiga kolom terpisah: `lifecycle_status`, `settlement_status`,
  `fulfillment_status`. Tidak pernah satu enum gabungan.
- Tabel append-only tidak pernah di-UPDATE atau DELETE. Peran aplikasi hanya punya
  INSERT dan SELECT di sana. Daftarnya di `src/db/append-only-tables.ts`.
- Modul tidak pernah menyebut nomor akun atau tarif pajak. Keduanya lewat lapisan
  penentuan di modul Akuntansi dan Pajak.
- Nomor dokumen diberikan saat submit, bukan saat draf dibuat.
- Dokumen berstatus `posted` tidak dapat diedit oleh peran mana pun.
- Operasi tulis di API wajib mendukung `Idempotency-Key`.
- Pagination berbasis kursor. Tidak ada parameter `offset`.
- Konteks company diambil dari path URL, bukan dari token.

## Deploy

- "ship" berarti `npm run ship` (commit → push → deploy). "deploy" berarti
  `npm run deploy` (deploy saja). Jalankan perintahnya apa adanya.
- "rollback" berarti `npm run rollback`. Ia meminta konfirmasi `ya`, dan ia
  TIDAK menggulung balik migrasi. Sampaikan peringatan itu utuh — jangan
  diringkas sampai hilang.
- Jangan pernah menyusun sendiri rangkaian `git add`/`commit`/`push` atau
  perintah deploy manual. Seluruh gerbang sudah tertanam di script itu.
- Laporkan hasilnya ringkas, termasuk sha bundel yang melayani. Baris terakhir
  `deploy` mencetaknya sebagai `versi disajikan <sha>`.
- Bila sha itu sama dengan deploy sebelumnya, katakan perubahannya kemungkinan
  belum tayang.
- `rollback` tidak mencetak baris itu — ia hanya menyebut `git rev-parse` di
  server. Periksa `/versi` sendiri sesudahnya sebelum menyebut sha yang melayani.
- Bila gerbang menolak, tampilkan pelanggarannya dan berhenti. Jangan mencari
  jalan lain melewatinya.

## Sebelum menyatakan selesai

- Jalankan `npm run lint` dan `npm test`
- Untuk perubahan skema: jalankan `npm test -- tests/invariants`
- Jangan buat abstraksi yang belum dibutuhkan di dua tempat
- Bila implementasi menyimpang dari dokumen, catat di `docs/DECISIONS.md`

## Glosarium

Customer (bukan Client) · Vendor (bukan Supplier) · Item (bukan Product) ·
Invoice = sisi penjualan · Bill = sisi pembelian · User ≠ Employee ·
"Akun Perkiraan" untuk GL account, "Akun Pengguna" untuk login ·
"Faktur Penjualan" dan "Faktur Pembelian" selalu lengkap, tidak pernah "Faktur" saja.

## Urutan membaca dokumen

Untuk pekerjaan skema: `docs/Design_Handoff_Spec.md` bagian 2 lebih dulu.
Untuk pekerjaan modul: dokumen modulnya, lalu `docs/Flow_Archetypes.md`.
Untuk pekerjaan UI: `docs/Design_Tokens.md`, lalu spesifikasi komponen terkait.
