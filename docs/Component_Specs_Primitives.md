# Paadu Flow — Primitive Component Specs
### Step 3.1 · Fase 3 — Core Component Library

**Input:** Design Tokens (2.1), Layout System (2.2).
**Aturan mutlak:** tidak ada nilai hardcode. Setiap komponen hanya membaca token Lapis 2 atau Lapis 3. Lint menggagalkan build bila menemukan hex atau px mentah.

> **Pengingat: Step 1.4 (Brand Book) belum dikerjakan.** Menunggu hex brand asli, nama typeface wordmark, dan trademark clearance. Tidak memblokir Fase 3 — komponen memanggil `--action-primary-bg`, bukan hex, sehingga perubahan brand nanti berbiaya nol di lapis komponen.

---

## 0. Set Ikon — keputusan struktural, bukan dekorasi

Ini diputuskan lebih dulu karena Pola C navigasi (Step 2.2) **bergantung sepenuhnya** pada ikon yang dapat dibedakan. Delapan ikon yang mirip akan menggagalkan seluruh pola rail.

### Rekomendasi: **Tabler Icons**

| Kandidat | Jumlah | Lisensi | Penilaian |
|---|---|---|---|
| **Tabler** | 5.800+ | MIT | ✅ Cakupan terbaik untuk konsep ERP — gudang, faktur, jurnal, pajak, BOM, timbangan, kontainer |
| Lucide | 1.500+ | ISC | Paling bersih secara visual, tapi cakupan domain ERP tipis; akan memaksa Anda menggambar sendiri puluhan ikon |
| Phosphor | 1.200+/bobot | MIT | Bagus, multi-bobot, tapi cakupan domain juga terbatas |
| Material Symbols | 3.000+ | Apache 2.0 | Cakupan baik, tapi membawa bahasa visual Google yang kuat — produk akan terlihat seperti aplikasi Google |

Alasan utama: dengan 30+ modul yang mencakup manufaktur, gudang, pajak, dan konstruksi, **cakupan mengalahkan kemurnian estetis**. Set yang indah tapi kekurangan ikon akan dilengkapi oleh sepuluh orang berbeda dengan sepuluh gaya berbeda selama lima tahun.

### Aturan pemakaian

- **Hanya gaya outline.** Varian filled tidak dipakai sama sekali — mencampur outline dan filled adalah tanda sistem yang tidak dijaga.
- **Ukuran render hanya 16, 20, atau 24px.** Tidak ada ukuran lain.
- **Stroke 2px pada 20 dan 24px; 1.5px pada 16px.** Stroke 2px yang diperkecil ke 16px menjadi gumpalan.
- Ikon dekoratif: `aria-hidden="true"`. Ikon yang berdiri sendiri sebagai tombol: wajib `aria-label`.
- **Ikon tidak pernah berdiri sendiri tanpa label atau tooltip**, kecuali ikon yang sudah universal (silang, cari, plus, chevron).
- Ikon rail modul **wajib melewati uji pembedaan**: tampilkan kedelapan ikon tersemat pada 24px kepada orang yang belum pernah melihat produk, minta mereka memasangkan dengan nama modul. Kalau akurasinya di bawah 80%, ganti ikonnya.

---

## 1. Button

**Varian:** `primary` · `secondary` · `ghost` · `danger` · `link`
**Ukuran:** sm (28) · md (36, default) · lg (44)
**Bentuk:** icon-only · icon-leading · icon-trailing · split

| State | Token |
|---|---|
| default | `--action-primary-bg` |
| hover | `--action-primary-bg-hover` |
| active | `--action-primary-bg-active` |
| focus | outline `--border-focus` 2px, offset 2px |
| disabled | `--action-disabled-bg` + `--text-disabled` |
| loading | bg default, ikon `ti-loader-2` berputar, **lebar dipertahankan** |

### Keputusan

**Loading tidak boleh mengubah lebar tombol.** Label tetap, spinner menggantikan ikon (atau ditambahkan di depan bila tidak ada ikon). Tombol yang menyusut saat diklik menggeser seluruh baris aksi dan menyebabkan klik meleset pada tombol sebelahnya.

**Hindari tombol disabled.** Tombol disabled tidak menjelaskan apa pun, kontrasnya rendah, dan pada perangkat sentuh ia tidak bisa menampilkan tooltip — pengguna hanya tahu bahwa sesuatu tidak bisa, tanpa tahu mengapa. Lebih baik biarkan aktif dan jelaskan saat diklik. Disabled dipakai hanya bila alasannya benar-benar terlihat di layar (misalnya "pilih minimal satu baris" pada bulk action bar).

**Maksimal satu tombol primary per layar.** Kalau ada dua aksi primer, berarti hierarkinya belum diputuskan.

**Focus memakai `:focus-visible`, bukan `:focus`.** Klik mouse tidak boleh memunculkan ring; navigasi keyboard wajib.

### Keyboard & ARIA
`Enter` dan `Space` mengaktifkan. Elemen `<button>` sungguhan, bukan `<div onclick>`. Loading state: `aria-busy="true"`. Icon-only: `aria-label` wajib.

---

## 2. Text Input

**Anatomi:** label → input (opsional prefix/suffix) → helper text ATAU error text → counter (opsional)

| State | Perlakuan |
|---|---|
| default | border `--border-interactive` |
| hover | border `--border-strong` |
| focus | border `--border-focus` + ring 2px `--bg-accent-subtle` |
| error | border `--border-danger` + pesan error menggantikan helper text |
| disabled | bg `--bg-surface-sunken`, teks `--text-disabled`, kursor `not-allowed` |
| readonly | bg transparan, tanpa border, teks `--text-primary` |

### Keputusan

**Label selalu di atas, tidak pernah floating.** Floating label menghapus label saat field terisi, sehingga pengguna yang memeriksa ulang form panjang kehilangan konteks. Untuk form berisi 30 field pajak, ini bukan detail kecil.

**Pesan error menggantikan helper text, tidak ditumpuk.** Menumpuk keduanya menggeser layout dan mendorong field di bawahnya.

**Readonly ≠ disabled.** Readonly tetap dapat difokus dan disalin — penting untuk nomor dokumen dan NPWP yang sering perlu disalin. Disabled tidak dapat difokus.

**Placeholder bukan pengganti label**, dan berisi contoh input yang valid (`nama@perusahaan.com`), bukan pengulangan label.

---

## 3. Number & Currency Input

Komponen dengan keputusan terbanyak, karena ia menyentuh uang.

### Keputusan

**Pemisah ribuan diterapkan saat blur, bukan saat mengetik.** Memformat ulang di setiap ketukan memindahkan posisi kursor dan merupakan salah satu interaksi paling dibenci di aplikasi finansial. Saat fokus: angka mentah. Saat blur: terformat.

**Simbol mata uang adalah affix, bukan bagian dari nilai.** Ia hidup di prefix slot dengan pemisah visual, sehingga tidak pernah ikut terpilih saat pengguna menekan `Ctrl+A`.

**IDR tanpa desimal secara default.** Field baru menampilkan `Rp 185.000`, bukan `Rp 185.000,00`. Desimal hanya muncul bila nilainya memang mengandungnya.

**Separator desimal mengikuti locale.** Indonesia memakai koma untuk desimal dan titik untuk ribuan — kebalikan dari Inggris. Parser harus menerima keduanya dan menormalkan, karena pengguna akan menyalin-tempel dari sumber apa pun.

**Nilai tersimpan selalu numerik mentah.** Tidak pernah string terformat. Ini tampak jelas dan tetap sering dilanggar.

**Rata kanan**, `tabular-nums` aktif, sesuai Typography System.

**Tanpa spinner naik/turun.** Panah stepper tidak berguna untuk nominal finansial dan menjadi target salah klik.

---

## 4. Textarea

Auto-resize sampai maksimum 8 baris, lalu scroll. Counter karakter muncul hanya bila ada batas, dan berubah ke `--text-danger` pada 10% sisa terakhir. Resize handle dinonaktifkan — tinggi dikendalikan komponen.

---

## 5. Select & Combobox

| Jumlah opsi | Komponen |
|---|---|
| 2–7 | `select` sederhana |
| 8–50 | `combobox` dengan pencarian |
| >50 atau tak terbatas | `combobox` async dengan pencarian sisi server |

Pelanggan, barang, dan akun GL **selalu** async — jumlahnya tak terbatas dan memuat seluruhnya akan menggantung browser pada tenant besar.

**State yang wajib dirancang:** loading, kosong, "tidak ada hasil untuk pencarian ini" (berbeda dari kosong), error muat, dan opsi terpilih yang di luar halaman hasil saat ini.

Multi-select menampilkan chip; melebihi tiga chip, ringkas menjadi `3 terpilih` dengan popover.

---

## 6. Date, Date Range & Fiscal Period Picker

Format tampilan `10 Agu 2026`, sesuai Typography System. Input teks tetap menerima pengetikan manual — pemilih kalender adalah pelengkap, bukan satu-satunya jalan. Akuntan mengetik tanggal jauh lebih cepat daripada mengkliknya.

**Fiscal period picker adalah komponen tersendiri**, bukan varian date picker. Karena `fiscal_year_start_month` di Modul 01 dapat bukan Januari, pemilih periode wajib menampilkan label fiskal **dan** bulan kalendernya bersamaan: `FY2026 P3 · Sep 2026`. Menampilkan `P3` saja tidak bermakna bagi siapa pun.

Preset rentang wajib: hari ini, 7 hari, 30 hari, bulan ini, bulan lalu, kuartal ini, tahun fiskal berjalan, kustom.

---

## 7. Checkbox, Radio & Switch

Tiga komponen ini terus-menerus dipakai untuk hal yang salah. Aturannya:

| Komponen | Kapan dipakai |
|---|---|
| **Checkbox** | Bagian dari form — perubahan berlaku setelah disimpan. Pilihan ganda. |
| **Radio** | Bagian dari form — pilihan tunggal dari 2–5 opsi yang semuanya perlu terlihat |
| **Switch** | **Berlaku seketika**, tanpa tombol simpan. Hanya nyala/mati. |

**Switch di dalam form yang punya tombol Simpan adalah bug.** Ia menjanjikan efek langsung lalu tidak menepatinya.

Checkbox wajib punya state **indeterminate** untuk header tabel (sebagian baris terpilih). Label seluruhnya dapat diklik, bukan hanya kotaknya.

---

## 8. Badge, Tag & Status Pill

**Warna tidak pernah menjadi satu-satunya pembeda.** Setiap badge status membawa titik indikator **dan** teks. Ini WCAG 1.4.1, bukan preferensi.

Status dokumen memakai kosakata tetap lintas modul — ditetapkan di glosarium Step 4.1, bukan diputuskan per modul: `Draf · Diajukan · Menunggu persetujuan · Disetujui · Ditolak · Diposting · Dibatalkan · Void`.

Tag (label bebas pengguna) memakai gaya netral, **bukan** warna semantik. Mencampur tag berwarna dengan badge status membuat baris tabel tidak terbaca sekilas.

---

## 9. Avatar

Ukuran 20 · 24 · 32 · 40. Fallback: inisial dari nama, latar diturunkan secara deterministik dari ID pengguna (bukan acak, agar orang yang sama selalu punya warna sama). Avatar company memakai bentuk rounded square, avatar orang memakai lingkaran — pembedaan bentuk ini penting di pengalih tenant/company.

Stacked group maksimal 4 + `+N`.

---

## 10. Tooltip, Popover & Dropdown

| | Pemicu | Isi | Fokus |
|---|---|---|---|
| Tooltip | hover / focus | teks singkat saja | tidak mengambil fokus |
| Popover | klik | konten kaya, dapat berisi kontrol | mengambil fokus |
| Dropdown menu | klik | daftar aksi | mengambil fokus, navigasi panah |

**Tooltip tidak pernah berisi informasi yang hanya ada di sana.** Ia tidak dapat diakses pada perangkat sentuh. Informasi penting masuk ke helper text.

Tooltip muncul setelah delay 400ms; menghilang seketika. `Esc` menutup semuanya. Popover dan dropdown memakai focus trap dan mengembalikan fokus ke pemicu saat ditutup.

---

## 11. Spinner, Progress & Skeleton

| Kondisi | Komponen |
|---|---|
| < 300ms | **Tidak ada apa pun.** Indikator yang berkedip lebih mengganggu daripada jeda singkat |
| 300ms – 2s | Skeleton yang menyerupai bentuk konten akhir |
| > 2s dengan progres terukur | Progress bar dengan persentase |
| > 2s tanpa progres terukur | Spinner + teks yang menjelaskan apa yang sedang terjadi |

Skeleton **wajib menyerupai bentuk konten akhir**, bukan kotak abu generik. Skeleton yang bentuknya salah menyebabkan layout shift saat data tiba — itu memindahkan tombol tepat saat pengguna hendak mengklik.

---

## 12. Aturan Lintas Komponen

**Focus ring tidak pernah dihapus.** 2px `--border-focus`, offset 2px, `:focus-visible`, terlihat di kedua mode. Menghapus outline adalah pelanggaran aksesibilitas, bukan pilihan desain.

**Target sentuh minimum 44×44px** di viewport sentuh. Kontrol sm dan md tidak tersedia di mobile.

**Semua komponen menerima `id`, `name`, `aria-describedby`, dan `data-testid`.** Tanpa `data-testid`, tim QA akan menulis selector rapuh berbasis kelas CSS dan setiap perubahan desain akan mematahkan test suite.

**Tidak ada komponen yang mengelola state globalnya sendiri.** Toast, modal, dan tooltip dirender lewat portal dengan `z-index` dari skala token.

---

## 13. Risiko & Item Terbuka

| Item | Status | Dampak |
|---|---|---|
| **Step 1.4 Brand Book** | **Belum dikerjakan** | Menunggu hex brand, typeface wordmark, trademark clearance |
| Uji pembedaan ikon rail | Belum dilakukan | Menentukan apakah Pola C navigasi (Step 2.2) berhasil atau gagal |
| Perilaku input mata uang saat tempel | Belum diuji | Pengguna menempel dari Excel, WhatsApp, PDF — parser harus tangguh |
| Aturan validasi NPWP per negara | Belum lengkap | Modul 01 menyebut format bervariasi per negara |
| Kosakata status dokumen | Ditunda ke Step 4.1 | Harus ditetapkan sekali untuk seluruh modul |
| Varian komponen untuk density compact | Belum lengkap | Ditetapkan bersama Step 3.2 |
