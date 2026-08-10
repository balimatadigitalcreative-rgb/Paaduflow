# Paadu Flow — Design Handoff Specification
### Step 8.2 · Fase 8 — Validation & Handoff

Dokumen ini ditulis untuk engineering. Ia tidak menjelaskan alasan desain — untuk itu rujuk dokumen sumbernya. Ia menetapkan **apa yang dibangun, dengan kontrak apa, dan kapan dianggap selesai.**

---

## 1. Sumber Kebenaran

| Kebutuhan | File |
|---|---|
| **Seluruh nilai** — warna, tipografi, spacing, motion, sizing | `tokens.json` |
| Alasan di balik nilai warna | `Color_System.md` |
| Alasan di balik tipografi dan aturan angka | `Typography_System.md` |
| Arsitektur token, penamaan, tata kelola | `Design_Tokens.md` |
| Grid, app shell, indikator konteks | `Layout_System.md` |
| Komponen primitif | `Component_Specs_Primitives.md` |
| Komponen komposit dan data table | `Component_Specs_Composite.md` |
| Komponen shell dan aksesibilitas shell | `Component_Specs_AppShell.md` |
| Loading, error, konflik, offline | `Component_Specs_Feedback_States.md` |
| URL, status dokumen, glosarium, permission | `Information_Architecture.md` |
| Delapan pola yang dipakai ulang lintas modul | `Flow_Archetypes.md` |
| Alur onboarding dan copy deck | `Flow_Onboarding_Provisioning.md` |
| Spesifikasi 12 layar | `Screen_Specs_HiFi.md` |
| Temuan audit dan perbaikannya | `Audit_Accessibility_Quality.md` |
| Referensi implementasi yang berjalan | `Paadu_Flow_Prototype.jsx` |

**Bila terjadi perbedaan nilai, `tokens.json` menang.** `tokens.css` dibangkitkan dari file itu lewat Style Dictionary — **jangan diedit tangan.**

---

## 2. Konsekuensi Desain terhadap Skema Database

Bagian terpenting dokumen ini. Keputusan desain berikut **tidak dapat ditambal belakangan** dan harus masuk skema sebelum modul transaksional pertama dibangun.

| # | Kebutuhan | Asal | Kenapa tidak bisa ditunda |
|---|---|---|---|
| 1 | Kolom `document_version` (int) di **setiap tabel transaksional** | 3.4 §6 | Tanpa optimistic concurrency, edit bersamaan menghasilkan *last-write-wins* senyap. Menambahkannya setelah 40 tabel ada berarti migrasi di semuanya plus perubahan di setiap endpoint tulis |
| 2 | **Tiga kolom status terpisah**: `lifecycle_status`, `settlement_status`, `fulfillment_status` | 4.1 §3 | Satu enum gabungan pecah begitu sebuah faktur perlu berstatus *diposting* dan *dibayar sebagian* sekaligus |
| 3 | `overdue` **tidak disimpan** — dihitung dari `due_date` dan `settlement_status` | 4.1 §3 | Status tersimpan butuh pekerjaan terjadwal yang akan gagal diam-diam |
| 4 | Nomor dokumen diberikan **saat submit**, bukan saat draft dibuat | 5.2 A2 | Celah dalam urutan nomor adalah temuan audit. Butuh layanan penomoran yang tahan konkurensi dan tidak menghasilkan celah |
| 5 | `qty_converted` per baris dokumen | 5.2 A3 | Konversi parsial dan penjagaan konversi berlebih mustahil tanpa ini |
| 6 | Audit trail menyimpan **jenis pelaku**: `human` · `ai` · `system` | 3.2 §9, 5.2 A8 | Aturan AI mensyaratkan aksi AI dapat dibedakan. Menebaknya dari `user_id` tidak cukup |
| 7 | `item.type` (`stock` / `service`) | Prototype | Pemisahan pendapatan barang dan jasa di laba rugi bergantung padanya |
| 8 | Preferensi per pengguna: tema, kepadatan, sidebar diciutkan, modul tersemat | 2.2, 3.3 | Disimpan per pengguna, bukan per perangkat |
| 9 | Tabel `saved_views`: filter + kolom + sort + kepadatan, bercakupan **pribadi atau company** | 3.2 §1.2 | View wajib punya URL sendiri agar dapat dikirim |
| 10 | State progres onboarding | 5.1 §2 | Pengguna yang menutup browser melanjutkan, bukan mengulang |
| 11 | Hex brand per tenant (satu nilai) | 2.1 §10 | Tenant mengirim maksud; sistem menurunkan sebelas stop dan memvalidasi kontras |
| 12 | Idempotency key pada seluruh endpoint create | Modul 01, 5.2 A5 | Timeout tidak boleh menghasilkan faktur ganda |

---

## 3. Kontrak Data per Layar

Mengikuti API Standards: RESTful, versioned, format respons `{success, message, data}`.

| Layar | Endpoint |
|---|---|
| Pengalih company | `GET /v1/tenants/{id}/companies?q=` |
| Dashboard | `GET /v1/companies/{id}/dashboard?period=` |
| Daftar faktur | `GET /v1/companies/{id}/invoices?q=&filter=&sort=&page=&per_page=&view=` |
| Detail faktur | `GET /v1/invoices/{id}` · `GET /v1/invoices/{id}/activity` |
| Buat faktur | `POST /v1/companies/{id}/invoices` (idempotency key wajib) |
| Terbitkan faktur | `POST /v1/invoices/{id}/post` (idempotency key wajib) |
| Batalkan / void | `POST /v1/invoices/{id}/cancel` · `POST /v1/invoices/{id}/void` |
| Aksi massal | `POST /v1/companies/{id}/invoices/bulk` — menerima **kueri filter**, bukan daftar ID |
| Laba rugi | `GET /v1/companies/{id}/reports/profit-loss?period=&compare=` |
| Penelusuran akun | `GET /v1/companies/{id}/reports/profit-loss/{account}/entries?period=` |
| Jurnal ke sumber | `GET /v1/journal-entries/{id}` → `source_document` |
| Pencarian global | `GET /v1/search?q=&company_id=` — **difilter permission di sisi server** |
| Ekspor | `POST /v1/companies/{id}/exports` → pekerjaan asinkron |

### Aturan yang mengikat backend

**Aksi massal atas "seluruh hasil" mengirim kueri filter, bukan 1.284 ID.** Klien tidak pernah mengirim daftar ID panjang.

**Ekspor mengikuti filter, bukan halaman yang terlihat**, dan berjalan asinkron di atas 10 detik.

**Pencarian tidak pernah mengakui keberadaan data yang tidak diizinkan.** Tanpa "N hasil disembunyikan", tanpa mengembalikan nama lalu menolak saat dibuka.

**Setiap respons daftar menyertakan** `total`, `page`, `per_page`, dan definisi filter yang diterapkan — dibutuhkan untuk teks "Pilih semua N baris yang cocok".

---

## 4. Kontrak Komponen

Rinciannya di `Component_Specs_*`. Yang mengikat implementasi:

**Setiap komponen menerima** `id`, `name`, `aria-describedby`, dan `data-testid`. Tanpa `data-testid`, QA akan menulis selector berbasis kelas CSS dan setiap perubahan desain mematahkan test suite.

**Komponen tidak pernah membaca token Lapis 1.** Hanya Lapis 2 (`--text-secondary`) atau Lapis 3 (`--button-primary-bg-hover`).

**Toast, modal, tooltip dirender lewat portal** dengan `z-index` dari skala token. Tidak ada nilai `z-index` literal di komponen mana pun.

**Focus ring tidak pernah dihapus.** `:focus-visible`, 2px `--border-focus`, offset 2px.

**Setiap elemen interaktif harus dapat dijangkau keyboard.** Temuan Major di `Audit_Accessibility_Quality.md` §3 seluruhnya berasal dari `onClick` di elemen non-interaktif — jangan ulangi pola itu.

---

## 5. Motion & Interaksi

| Aturan | Nilai |
|---|---|
| Hover, focus, state kontrol | `duration-fast` 100ms |
| Elemen masuk | `duration-normal` 160ms, `ease-enter` |
| Elemen keluar | `duration-fast` 100ms, `ease-exit` — **keluar selalu lebih cepat dari masuk** |
| Modal, drawer | `duration-slow` 240ms |
| Batas maksimum | 320ms. Tidak ada pengecualian |
| `prefers-reduced-motion` | Seluruh durasi ke 0,01ms. Wajib, bukan opsi |

**Optimistic UI hanya untuk aksi berdampak rendah dan dapat dipulihkan.** Tidak pernah untuk posting, approval, atau apa pun yang menyentuh buku besar.

**Ambang pemuatan:** di bawah 300ms tidak menampilkan apa pun · 300ms–2s skeleton berbentuk konten akhir · di atas 10s menjadi pekerjaan asinkron dengan notifikasi.

---

## 6. Responsif

| Viewport | Shell |
|---|---|
| ≥1280 | Rail + sidebar + konten + panel kanan inline |
| 1024–1279 | Sidebar dapat diciutkan; panel kanan overlay |
| 768–1023 | Rail dan sidebar menjadi drawer overlay |
| <768 | Bottom tab bar maks 5 tujuan; tabel menjadi kartu; mode compact tidak tersedia |

`@media (pointer:coarse)` menaikkan seluruh target sentuh ke minimal 44px — sudah diterapkan di prototype.

**Modul desktop-only** (jurnal, BOM, pelaporan pajak, report builder, impor massal, rekonsiliasi) menampilkan pesan jujur di viewport mobile, bukan versi yang diperas.

---

## 7. Copy & i18n

**Seluruh string dieksternalisasi sejak commit pertama.** Tidak ada teks hardcode, termasuk pesan error dan label tombol.

**Copy onboarding sudah ditulis** di `Flow_Onboarding_Provisioning.md` §4 — pakai apa adanya, jangan tulis ulang.

**Yang wajib mengikuti locale:** format tanggal, pemisah desimal dan ribuan, penempatan simbol mata uang, jumlah desimal per mata uang (IDR nol desimal), dan aturan pluralisasi.

**Yang tidak diterjemahkan:** istilah pajak dan akuntansi baku Indonesia — NPWP, e-Faktur, Faktur Pajak, DPP, PPN, PPh.

**Istilah mengikuti glosarium** di `Information_Architecture.md` §4. Pull request yang memperkenalkan istilah baru untuk konsep yang sudah bernama akan ditolak. Perhatikan khususnya "Akun Perkiraan" versus "Akun Pengguna", dan "Faktur Penjualan" versus "Faktur Pembelian".

---

## 8. Definition of Done — Frontend

Diturunkan dari `12_DEFINITION_OF_DONE` di Knowledge Base. Sebuah layar selesai hanya bila **seluruh** butir terpenuhi.

**Fungsional**
- [ ] Acceptance criteria user story lulus
- [ ] Seluruh state ditangani: normal, kosong, memuat, error, permission denied, tidak ada hasil setelah filter
- [ ] Kasus tepi dari spesifikasi layar ditangani

**Design system**
- [ ] Tanpa nilai hex, px di luar skala spacing, atau `z-index` literal — ditegakkan lint
- [ ] Hanya komponen dari library. Komponen baru butuh persetujuan pemilik design system
- [ ] Light dan dark mode keduanya benar, bukan hasil inversi
- [ ] Kedua mode kepadatan berfungsi

**Aksesibilitas**
- [ ] Kontras teks ≥4,5:1 dan komponen ≥3:1, **diukur bukan diasumsikan**
- [ ] Seluruh fungsi dapat dicapai keyboard; urutan tab logis; tanpa keyboard trap
- [ ] Focus ring terlihat di semua elemen interaktif
- [ ] Landmark, hierarki heading, label form, `scope` pada header tabel
- [ ] Target sentuh ≥44px di viewport sentuh
- [ ] `prefers-reduced-motion` dihormati
- [ ] Warna bukan satu-satunya pembeda makna
- [ ] Diuji dengan screen reader sungguhan

**Data dan konteks**
- [ ] Konteks company terlihat di page header
- [ ] Aksi yang mengubah data keuangan menyebut nama company di konfirmasinya
- [ ] Seluruh angka `tabular-nums`, rata kanan, presisi konsisten per kolom
- [ ] Nol dan kosong dibedakan
- [ ] Angka negatif dalam kurung di laporan keuangan
- [ ] State daftar tercermin di URL

**Kualitas**
- [ ] Tidak ada layout shift saat data tiba
- [ ] Skeleton menyerupai bentuk konten akhir
- [ ] Aturan tiga klik lulus, atau pengecualiannya didokumentasikan
- [ ] Responsif di 1440, 1024, dan 390px
- [ ] `data-testid` pada seluruh elemen interaktif
- [ ] Unit, integration, dan E2E test lulus
- [ ] Copy sesuai Tone of Voice dan glosarium

---

## 9. Urutan Pembangunan

Bukan urutan modul — urutan berdasarkan berapa banyak yang dikunci tiap langkah.

1. **Token pipeline** — `tokens.json` → Style Dictionary → `tokens.css`, plus lint rule
2. **App shell** — top bar, pengalih company, rail, sidebar, landmark, skip link, command palette
3. **Komponen primitif** — sesuai `Component_Specs_Primitives.md`
4. **Data table** — komponen tunggal terpenting
5. **Line-item editor** — dipakai puluhan kali; bangun sekali dengan benar
6. **Modul Penjualan** sebagai modul referensi
7. Modul berikutnya, **menerapkan** archetype — bukan menafsirkannya

Bila langkah 6 selesai tanpa memerlukan komponen baru, design system terbukti. Bila tidak, kembali ke langkah 3.

---

## 10. Utang yang Diserahkan Bersama Dokumen Ini

| Item | Pemilik | Blocking? |
|---|---|---|
| **Trademark clearance** (DJKI, WIPO, MyIPO) | Bisnis | Tidak untuk kode. **Ya** untuk peluncuran |
| **Hex brand asli** | Bisnis | Tidak — arsitektur token membuat perubahannya berbiaya rendah |
| **Typeface wordmark** | Bisnis | Hanya untuk lockup |
| **Validasi urutan perhitungan pajak oleh akuntan** | Bisnis | **Ya** untuk modul keuangan |
| Konfirmasi `border-default` vs `border-strong` di `tokens.json` | Design | Ya untuk langkah 1 |
| Uji screen reader | Design + QA | Ya untuk DoD |
| Uji keselamatan konteks company | Design + Riset | **Ya** — konsekuensi kegagalan adalah data keuangan di entitas yang salah |
| Uji pembedaan ikon rail | Design | Ya untuk langkah 2 |
| Simulator buta warna untuk palet data-viz | Design | Ya sebelum modul laporan |
| Mesin alur persetujuan | Engineering | Keputusan arsitektur, belum diambil |
| Strategi indeks pencarian | Engineering | Keputusan arsitektur, belum diambil |
