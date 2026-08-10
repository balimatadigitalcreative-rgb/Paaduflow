# Paadu Flow — High-Fidelity Screen Specs
### Step 6.1 · Fase 6 — High-Fidelity Screen Design

**Input:** Design Tokens (2.1), Layout System (2.2), Component Specs (3.1–3.4), Information Architecture (4.1), Flow Archetypes (5.2).

**Aturan mutlak:** hanya memakai komponen dan token yang sudah didefinisikan. Tidak ada gaya baru. Bila sebuah layar membutuhkan komponen yang belum ada, hentikan dan tambahkan ke Fase 3 — jangan diam-diam membuat varian baru di layar.

> ⚠️ **Hex brand asli masih perkiraan.** Layar hi-fi adalah artefak pertama yang benar-benar mahal untuk dibuat ulang bila warnanya berubah. Kunci hex sebelum memproduksi kesepuluh layar sisanya.

---

## Aturan Kualitas untuk Seluruh Layar

**Data harus realistis.** Nama perusahaan Indonesia, nominal Rupiah berformat benar, tanggal `10 Agu 2026`, NPWP, nomor dokumen yang masuk akal (`INV/2026/08/0142`). **Dilarang lorem ipsum, "Company A", atau angka bulat sempurna.** Data palsu menyembunyikan masalah layout yang baru muncul di produksi — nama panjang, angka besar, kolom kosong.

**Setiap layar menampilkan konteks company aktif** di page header, sesuai Lapis 2 indikator konteks (Layout System §4).

**Setiap layar dibuat dalam light dan dark mode.** Dark mode dirancang, bukan diinversi.

**Bukan hanya happy path.** Set 12 layar wajib memuat minimal: satu layar dengan skeleton, satu dengan empty state, satu dengan error validasi, satu dengan permission denied.

---

## Status Produksi

| # | Layar | Status |
|---|---|---|
| 1 | Masuk (login) | Spesifikasi |
| 2 | Onboarding — buat company pertama | Spesifikasi |
| 3 | **Dashboard eksekutif** | ✅ **Dirender** |
| 4 | Penjualan — daftar faktur | Spesifikasi (varian awal sudah dirender di Step 2.2) |
| 5 | Penjualan — detail faktur | Spesifikasi (spesimen tipografi sudah dirender di Step 1.3) |
| 6 | Penjualan — form faktur baru | Spesifikasi |
| 7 | **CRM — pipeline peluang** | ✅ **Dirender** |
| 8 | Persediaan — stok multi-gudang | Spesifikasi |
| 9 | Akuntansi — laba rugi | Spesifikasi |
| 10 | Pengaturan — tenant & company | Spesifikasi |
| 11 | Command palette terbuka | Spesifikasi |
| 12 | Panel AI assistant | Spesifikasi |

---

## 1 · Masuk

**Layout:** dua kolom di ≥1024px — kiri form (`container-narrow` 480px, rata tengah vertikal), kanan bidang warna brand dengan lockup vertikal. Satu kolom di bawah 1024px.

**Komponen:** input email, input kata sandi dengan toggle lihat, tombol primary `lg`, tombol SSO secondary, tautan lupa kata sandi.

**State wajib:** default · kredensial salah · akun terkunci · tantangan MFA · SSO redirect.

**Catatan:** pesan kredensial salah **tidak pernah** membedakan "email tidak ditemukan" dari "kata sandi salah" — itu membocorkan siapa yang punya akun (Step 5.1 §2).

---

## 2 · Onboarding — Buat Company Pertama

**Layout:** satu kolom `container-form` 640px, rata tengah. Progress indicator di atas (langkah 2 dari 4).

**Komponen:** input teks, input NPWP dengan masking, combobox mata uang, select bulan fiskal, textarea alamat, tombol primary.

**Copy:** seluruhnya sudah ditulis di `Flow_Onboarding_Provisioning.md` §4. **Pakai apa adanya, jangan tulis ulang.**

**State wajib:** kosong · terisi · error NPWP · menyimpan.

**Catatan:** field bulan fiskal membawa helper text peringatan bahwa ia sulit diubah setelah ada transaksi. Ini satu-satunya field di layar ini yang punya konsekuensi permanen.

---

## 3 · Dashboard Eksekutif ✅

**Layout:** page header → 4 kartu KPI sebaris → grafik penjualan 12 bulan → dua kolom (Perlu tindakan · Aktivitas terkini).

**Keputusan yang diterapkan:**

- **Setiap tren menyebut basis pembandingnya.** "+10,1% vs Juli 2026", bukan "+10,1%"
- **Arah tren dibedakan panah dan tanda, bukan hanya warna.** Piutang jatuh tempo yang naik 18,4% ditandai merah meski panahnya ke atas — "naik" tidak selalu berarti "baik"
- **Aktivitas membedakan tiga jenis pelaku secara visual:** manusia (inisial), AI (ikon sparkles dengan latar aksen), sistem (ikon roda gigi). Ini penerapan langsung Archetype 8
- "Perlu tindakan" berisi item yang benar-benar butuh keputusan pengguna, bukan "ada data baru"

**State wajib:** skeleton pemuatan · company baru tanpa data · gagal memuat sebagian kartu.

---

## 4 · Penjualan — Daftar Faktur

**Layout:** page header dengan baris konteks → filter bar → data table lebar penuh (tanpa container) → pagination.

**Komponen:** data table penuh (Step 3.2 §1), filter chips + advanced builder, bulk action bar.

**Konfigurasi kolom:** Nomor · Pelanggan · Tanggal · Jatuh tempo · Status · Jumlah. Kolom Nomor di-pin kiri.

**State wajib:** data normal · 3 baris terpilih dengan bulk bar · filter aktif tanpa hasil · skeleton · gagal memuat.

**Catatan:** default filter adalah periode berjalan, sehingga Ekspor menjadi klik ketiga (Step 5.1 §6).

---

## 5 · Penjualan — Detail Faktur

**Layout:** page header → tab (Ringkasan · Baris · Dokumen terkait · Aktivitas) → konten → panel kanan 360px berisi aktivitas.

**Komponen:** page header dengan badge status, tabel line item baca-saja, blok total, timeline aktivitas.

**State wajib:** `draft` (dapat diedit) · `pending_approval` (baca saja, tombol tarik kembali) · `posted` (baca saja permanen, tombol void).

**Catatan:** ketiga sumbu status ditampilkan terpisah dengan label jelas — `lifecycle`, `settlement`, `fulfillment` (Information Architecture §3). Di daftar hanya gabungan dua yang pertama; di detail ketiganya.

---

## 6 · Penjualan — Form Faktur Baru

Layar paling kompleks di set ini.

**Layout:** page header → blok header dokumen (pelanggan, tanggal, syarat pembayaran, mata uang) → **line-item editor** → blok total rata kanan → sticky action footer.

**Komponen:** line-item editor (Archetype 4), combobox pelanggan async, combobox item async, currency input, date picker, sticky footer.

**State wajib:** kosong · terisi 4 baris · error validasi baris · menghitung · menyimpan.

**Catatan penting:** urutan perhitungan mengikuti Archetype 4 secara persis — diskon dokumen **dialokasikan proporsional ke baris**, bukan dikurangkan di akhir. Pembulatan hanya di langkah terakhir.

---

## 7 · CRM — Pipeline Peluang ✅

**Layout:** page header dengan toggle Tabel/Kanban → 5 kolom tahap → kartu peluang.

**Keputusan yang diterapkan:**

- **Setiap kolom menampilkan jumlah deal dan nilai totalnya.** Kanban tanpa agregat hanya cantik, tidak berguna untuk keputusan
- **Indikator deal mengendap** ("diam 18 hari") — sinyal yang dapat ditindaklanjuti, bukan sekadar tanggal
- Toggle ke tampilan tabel selalu tersedia. Kanban baik untuk melihat aliran, buruk untuk membandingkan 200 deal

**State wajib:** kolom kosong · drag sedang berlangsung · pipeline kosong sepenuhnya.

**Catatan:** ini **satu-satunya kanban di seluruh produk**. Modul lain tidak memakainya, agar ia tetap bermakna sebagai penanda "alur berbasis tahap".

---

## 8 · Persediaan — Stok Multi-Gudang

**Layout:** page header → filter (gudang, kategori, status stok) → data table dengan kolom dinamis per gudang.

**Komponen:** data table dengan grouping per kategori dan subtotal, kolom pinned kiri (kode + nama item), kolom kuantitas per gudang.

**State wajib:** normal · stok minus (ditandai) · item tanpa pergerakan (em dash, bukan nol) · satu gudang saja.

**Catatan:** kolom stok memakai `—` untuk item yang belum pernah masuk gudang itu, dan `0` untuk yang pernah ada lalu habis. Pembedaan ini adalah kebenaran data, bukan gaya (Typography System §3.4).

---

## 9 · Akuntansi — Laba Rugi

**Layout:** panel parameter (periode, company, tingkat perbandingan) → tabel laporan hierarkis → aksi ekspor.

**Komponen:** tabel dengan baris yang dapat dilipat, subtotal per kelompok, kolom perbandingan periode, kolom selisih nominal dan persen.

**State wajib:** normal · periode tanpa transaksi · perbandingan dua periode · sedang menghitung.

**Catatan:**
- **Angka negatif dalam kurung**, bukan tanda minus (Typography System §3.4)
- **Setiap baris dapat di-drill sampai ke jurnal sumbernya.** Ini pilar Terang, dan ia tidak opsional
- Header laporan menyebut company, periode, mata uang, dan waktu generate — laporan dicetak dan diedarkan, jadi konteksnya harus ikut

---

## 10 · Pengaturan — Tenant & Company

**Layout:** dua tab terpisah (Tenant Settings · Company Settings), form `container-form` 640px.

**Komponen:** form multi-seksi dengan anchor nav, sticky action footer, indikator asal nilai.

**State wajib:** nilai diwarisi dari tenant · nilai ditimpa di company · field terkunci karena sudah ada transaksi · permission denied.

**Catatan:** setiap field menampilkan asal nilainya — "Diwarisi dari Tenant" atau "Diubah di Company ini" — dengan tombol kembali ke default (Archetype 7).

Layar ini adalah tempat yang tepat untuk merender **state permission denied** dari daftar wajib: pengguna dengan peran Member yang membuka Tenant Settings.

---

## 11 · Command Palette Terbuka

**Layout:** overlay tengah atas, lebar 600px, `z-modal`. Backdrop dengan scrim.

**Komponen:** input pencarian, hasil berkelompok (Navigasi · Aksi · Entitas · AI), footer petunjuk keyboard.

**State wajib:** kosong dengan riwayat terakhir · hasil dari kueri · tidak ada hasil · memuat pencarian async · hasil dari company lain di grup terpisah.

**Catatan:** hasil dari company lain wajib menampilkan **nama company-nya**, dan memilihnya memicu perpindahan konteks yang dikonfirmasi (Information Architecture §6).

---

## 12 · Panel AI Assistant

**Layout:** panel kanan 360px, inline di ≥1280px, overlay di bawahnya. **Bukan modal** — pengguna harus tetap melihat data yang ditanyakan.

**Komponen:** header dengan indikator konteks, riwayat percakapan, area komposisi, chip saran.

**State wajib:** kosong dengan saran awal · sedang menjawab · jawaban dengan sumber · jawaban dengan tabel · konfirmasi sebelum mengubah data · AI menyatakan tidak tahu.

**Catatan — ini layar yang paling mudah dirancang salah:**

- Header menampilkan konteks eksplisit: `Konteks: Faktur INV/2026/08/0142`
- Setiap jawaban menyertakan **sumber dan cakupan data**, dengan tautan ke datanya
- Aksi yang mengubah data memerlukan **konfirmasi yang menampilkan persis apa yang akan berubah**
- Tanpa emoji. Tanpa nada terlalu meyakinkan. Copy mengikuti aturan AI di Brand Strategy §4

---

## Urutan Produksi yang Disarankan

Bukan urutan nomor. Urutan berdasarkan berapa banyak keputusan yang dikunci tiap layar.

1. **Form faktur baru (6)** — paling kompleks, menguji line-item editor, currency input, dan sticky footer sekaligus
2. **Daftar faktur (4)** — menguji data table penuh
3. **Detail faktur (5)** — menguji tab, panel aktivitas, tiga sumbu status
4. **Laba rugi (9)** — menguji tabel hierarkis dan drill-down
5. **Stok multi-gudang (8)** — menguji kolom dinamis
6. Sisanya

Bila keempat layar pertama berhasil tanpa memerlukan komponen baru, design system-nya terbukti. Bila tidak, kembali ke Fase 3 sebelum melanjutkan.

---

## Risiko & Item Terbuka

| Item | Status | Dampak |
|---|---|---|
| Hex brand asli | **Masih perkiraan** | 12 layar hi-fi harus dibuat ulang bila berubah |
| Trademark clearance | **Masih terbuka** | Risiko terbesar proyek |
| Sepuluh layar sisanya | Spesifikasi, belum dirender | Dibangun di Claude Design atau langsung di Fase 7 |
| Self-critique per layar | Belum dilakukan | Setiap layar perlu ditinjau ulang: 5 kelemahan, lalu diperbaiki |
| Uji di layar 1080p | Belum | Density compact perlu diverifikasi di resolusi rendah |
