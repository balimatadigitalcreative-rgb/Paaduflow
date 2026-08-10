# Paadu Flow — Layout, Grid & App Shell
### Step 2.2 · Fase 2 — Design System Foundation

**Input:** Design Tokens (Step 2.1).
**Output ini menjadi input untuk:** Step 3.2 (Composite Components), Step 4.1 (Information Architecture), dan seluruh Fase 6.

> **Pengingat:** Step 1.4 (Brand Book) masih belum dikerjakan. Ia menunggu hex brand asli, nama typeface wordmark, dan trademark clearance. Fase 2 dan 3 tidak diblokir olehnya.

---

## 1. Grid System

Grid 12 kolom, gutter `space-6` (24px). Margin halaman mengikuti breakpoint.

| Breakpoint | Margin halaman | Kolom | Gutter |
|---|---|---|---|
| `2xl` ≥1536 | 32px | 12 | 24px |
| `xl` ≥1280 | 24px | 12 | 24px |
| `lg` ≥1024 | 24px | 12 | 20px |
| `md` ≥768 | 20px | 8 | 16px |
| `sm` ≥640 | 16px | 4 | 16px |
| `<640` | 16px | 4 | 12px |

### Aturan lebar konten — berbeda menurut jenis halaman

Ini keputusan yang sering dilewatkan dan konsekuensinya besar.

| Jenis halaman | Lebar | Alasan |
|---|---|---|
| **Form satu kolom** | `container-form` (640px), rata kiri | Panjang baris terkendali; form yang melebar penuh memaksa mata melompat jauh antar label dan field |
| **Form dua kolom** | 960px maks | — |
| **Tabel dan daftar** | **Lebar penuh, tanpa container** | Tabel keuangan butuh setiap piksel. Membatasi lebarnya adalah membuang ruang yang justru dibayar pengguna |
| **Detail dokumen** | Lebar penuh, dengan panel kanan 360px | Header dan line item butuh lebar; aktivitas/audit di panel kanan |
| **Dashboard** | Lebar penuh, grid 12 kolom | — |
| **Pengaturan** | `container-form` (640px) | — |
| **Prosa dan dokumentasi** | 640px (±75 karakter) | Batas keterbacaan |

**Form rata kiri, bukan tengah.** Form yang dipusatkan di layar 1920px menempatkan konten jauh dari sidebar dan memaksa pergerakan mata yang tidak perlu. Rata kiri menjaga jangkar visual tetap konsisten dengan navigasi.

---

## 2. Keputusan Navigasi

### Masalahnya

Business OS punya 10 domain modul hari ini. Roadmap Fase 5 mencantumkan solusi spesifik industri — hospitality, healthcare, education, construction — yang masing-masing membawa modulnya sendiri. Angka 30+ modul bukan skenario ekstrem; ia adalah rencana yang tertulis.

Pola navigasi harus dipilih untuk kondisi itu, bukan untuk kondisi hari ini.

### Perbandingan

| | **Pola A — Rail penuh** | **Pola B — Sidebar bertingkat** | **Pola C — Rail tersemat + launcher** |
|---|---|---|---|
| Bentuk | Rail ikon berisi **semua** modul + sidebar kontekstual | Satu sidebar 240px berisi semua modul sebagai grup akordeon | Rail berisi modul **yang disematkan pengguna** (maks 8) + launcher untuk sisanya |
| Di 10 modul | Baik | Baik | Baik |
| Di 30 modul | ❌ Rail harus di-scroll; 30 ikon tanpa label menjadi tidak terhafalkan | ❌ Daftar sangat panjang; state akordeon berantakan; scroll dalam scroll | ✅ Panjang rail dibatasi perhatian pengguna, bukan jumlah modul |
| Lebar chrome | 296px | 240px | 296px (sidebar dapat diciutkan ke 46px) |
| Pindah modul | 1 klik | 2 klik (buka grup → pilih) | 1 klik (tersemat) / 2 klik atau `⌘K` (lainnya) |
| Multi-tenant | Semua tenant melihat rail yang sama meski memakai modul berbeda | Sama | ✅ Rail otomatis mencerminkan modul yang benar-benar dipakai tenant dan pengguna |

### Rekomendasi: **Pola C**

Alasan utamanya bukan estetika, melainkan **apa yang membatasi panjangnya**. Pada Pola A dan B, panjang navigasi tumbuh seiring jumlah modul — jadi navigasi memburuk setiap kali produk membaik. Pada Pola C, panjang rail dibatasi jumlah modul yang benar-benar dipakai seseorang sehari-hari, yang tidak pernah lebih dari sekitar delapan berapa pun ukuran produknya.

Ini juga satu-satunya pola yang cocok dengan multi-tenancy. Sebuah UMKM ritel dan sebuah grup manufaktur memakai himpunan modul yang sangat berbeda; rail statis memaksa keduanya melihat navigasi yang sama.

**Konsekuensi yang harus diterima:** modul yang tidak tersemat butuh satu interaksi lebih banyak. Ini dimitigasi `⌘K`, yang justru **lebih cepat** dari klik untuk pengguna keyboard — dan pengguna berat aplikasi ini adalah pengguna keyboard.

### Aturan rail

- Maksimal **8 modul tersemat**. Melebihi itu, ikon berhenti terhafalkan.
- Default penyematan ditentukan **saat onboarding**, berdasarkan modul yang dipilih tenant.
- Ikon **wajib punya tooltip** dengan nama modul. Ikon tanpa label adalah teka-teki.
- Item terakhir selalu **launcher** (`⋮⋮`), yang membuka grid modul dengan pencarian.
- Rail bersifat **per pengguna**, bukan per tenant — akuntan dan kepala gudang menyematkan modul berbeda di tenant yang sama.

---

## 3. Anatomi App Shell

```
┌────────────────────────────────────────────────────────────┐
│ TOP BAR                                             46px   │
│ mark · tenant/company switcher · search ⌘K   ai · 🔔 · avatar│
├──────┬──────────────┬──────────────────────────────────────┤
│ RAIL │ SIDEBAR      │ CONTENT AREA                          │
│ 46px │ 240px        │                                       │
│      │              │ ┌───────────────────────┬───────────┐ │
│ modul│ nav modul    │ │ page header           │ panel     │ │
│ ter- │ aktif        │ │ body                  │ kanan     │ │
│ semat│              │ │                       │ 360px     │ │
│      │              │ └───────────────────────┴───────────┘ │
│ ⋮⋮   │              │                                       │
└──────┴──────────────┴──────────────────────────────────────┘
```

### Top bar (46px, `z-nav`)

Kiri ke kanan: mark → **pengalih tenant/company** → pencarian global (`⌘K`) → *[dorong ke kanan]* → pemicu AI → notifikasi → menu pengguna.

Mark selalu kembali ke dashboard. Tinggi 46px dipilih karena ini chrome permanen — setiap piksel di sini diambil dari data.

### Sidebar (240px)

Berisi navigasi modul yang sedang aktif, dikelompokkan. Pengelompokan baku untuk modul transaksional: **Transaksi · Data induk · Laporan · Pengaturan**. Keseragaman ini penting — pengguna yang hafal struktur satu modul otomatis hafal semuanya.

Dapat diciutkan ke 46px (ikon saja). State ciutan disimpan per pengguna.

### Content area

**Page header** berisi: breadcrumb → judul → badge status → aksi primer (kanan) → aksi sekunder di overflow → tab (bila ada).

**Panel kanan (360px)** bersifat opsional dan kontekstual: riwayat aktivitas/audit trail, detail, atau AI assistant. Menjadi overlay di bawah 1280px.

### Tidak ada status bar

Kecuali POS, yang memang membutuhkan indikator status perangkat (printer, laci kas, koneksi). Modul lain tidak.

---

## 4. Indikator Konteks Tenant & Company

**Ini bagian paling kritis di seluruh dokumen.** Salah konteks company berarti transaksi keuangan masuk ke entitas legal yang salah — masalah integritas data, yang menempati prioritas nomor dua di Decision Principles, di atas skalabilitas dan performa.

### Kenapa indikator di top bar saja tidak cukup

Orang yang sedang menginput faktur menatap **form**, bukan chrome. Nama company di pojok kiri atas berada di luar fokus perhatian selama seluruh proses input. Indikator top bar mencegah kesalahan saat pengguna *mencari tahu* konteksnya — ia tidak mencegah kesalahan saat pengguna *lupa memeriksanya*.

### Empat lapis pertahanan

**Lapis 1 — Selalu terlihat.** Nama company ada di top bar, **tidak pernah di balik menu**. Format `Tenant / Company`, dengan nama company sebagai elemen yang lebih tebal. Saat top bar menyempit, elemen lain yang dipotong lebih dulu — nama company adalah yang terakhir menyerah.

**Lapis 2 — Diulang di titik kerja.** Setiap page header pada halaman transaksional menyatakan ulang company aktif, periode fiskal, dan mata uang default: `PT Nusantara Jaya · FY2026 P8 · IDR`. Ini menempatkan konteks di dalam fokus perhatian, bukan di pinggirnya.

**Lapis 3 — Konfirmasi saat berpindah.** Setelah beralih company, tampilkan banner transien selebar konten yang menyebut nama company baru. Bukan toast di pojok — banner yang tidak bisa dilewatkan mata.

**Lapis 4 — Disebut ulang saat komitmen.** Setiap dialog konfirmasi untuk aksi yang mengubah data keuangan menyebut nama company secara eksplisit: *"Terbitkan faktur INV/2026/08/0142 untuk **PT Nusantara Jaya**?"* Ini pemeriksaan terakhir sebelum kesalahan menjadi permanen.

### Yang tidak dipakai

**Warna per company ditolak.** Menandai tiap company dengan warna berbeda terasa menarik, tapi ia melanggar aturan Color System: warna hanya boleh membawa makna untuk kategori berjumlah tetap. Jumlah company per tenant tidak terbatas, dan begitu melewati enam sampai delapan, warna berhenti dapat dibedakan sekaligus merusak seluruh sistem status.

Yang dipakai sebagai penanda identitas adalah **inisial atau logo company** — identitas, bukan warna semantik.

---

## 5. Perilaku Responsif

| Viewport | Perilaku shell |
|---|---|
| **≥1280** | Shell penuh. Rail + sidebar + konten + panel kanan inline. Target utama. |
| **1024–1279** | Sidebar dapat diciutkan (default tetap terbuka). Panel kanan menjadi overlay. |
| **768–1023** | Rail dan sidebar menjadi drawer overlay yang dipicu tombol menu. Konten lebar penuh. |
| **<768** | Mode mobile. Bottom tab bar berisi maksimal 5 tujuan. Tabel berubah menjadi kartu. Mode compact tidak tersedia. |

### Modul mana yang benar-benar untuk mobile

Menyatakan "responsif" untuk seluruh produk adalah janji yang tidak bisa ditepati. Ini daftar eksplisitnya.

**Layak mobile — dirancang untuk mobile:**
Approval dan persetujuan · POS · Absensi dan cuti · Pengajuan reimbursement dengan foto struk · Notifikasi · Dashboard mode baca · Pencarian dan lihat detail dokumen · Aktivitas CRM lapangan

**Desktop saja — tidak akan dibuat mobile:**
Jurnal umum dan seluruh akuntansi · BOM dan work order manufaktur · Pelaporan pajak dan e-Faktur · Report builder · Konfigurasi dan pengaturan · Impor massal · Rekonsiliasi bank

Modul desktop-only pada viewport mobile menampilkan pesan yang jujur dan menawarkan tindakan yang mungkin — bukan versi yang diperas sampai tidak bisa dipakai.

---

## 6. Density pada Shell

| Elemen | Comfortable | Compact |
|---|---|---|
| Tinggi top bar | 46px | 46px (tidak berubah) |
| Tinggi item nav sidebar | 32px | 28px |
| Padding konten | `space-6` / `space-4` | `space-4` / `space-3` |
| Tinggi baris tabel | 44px | 32px |
| Gap antar field form | `space-5` | `space-3` |

Top bar tidak mengecil. Ia berisi pengalih company — mengecilkan target itu memperbesar peluang salah konteks, dan itu bertukar keselamatan data demi beberapa piksel.

Mode compact **tidak tersedia di viewport sentuh**. Target sentuh 44px tetap mutlak.

---

## 7. Risiko & Item Terbuka

| Item | Status | Dampak |
|---|---|---|
| **Step 1.4 Brand Book** | **Belum dikerjakan** | Menunggu hex brand, typeface wordmark, trademark clearance |
| Set ikon modul | Belum dipilih | Rail bergantung sepenuhnya pada ikon yang dapat dibedakan; 8 ikon yang mirip akan menggagalkan Pola C |
| Perilaku launcher | Belum dirancang | Grid, pencarian, pengelompokan, dan modul yang baru dipasang — ditetapkan di Step 4.1 |
| Default penyematan per peran | Belum ditetapkan | Perlu dipetakan bersama Permission Matrix |
| Uji konteks company | Belum dilakukan | Uji apakah pengguna benar-benar menyadari perpindahan company — ini uji keselamatan, bukan uji kegunaan |
| Perilaku shell saat offline | Belum dirancang | Product Requirements menyebut offline capability untuk modul terpilih |
