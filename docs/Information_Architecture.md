# Paadu Flow — Information Architecture
### Step 4.1 · Fase 4 — Information Architecture & Navigation

**Input:** Layout System (2.2), Component Specs (3.1–3.4), Module 01, Knowledge Base.
**Menutup empat utang** yang menumpuk dari empat dokumen berbeda: skema URL, kosakata status dokumen, glosarium terminologi, dan kebijakan permission-aware navigation.

---

## 1. Struktur Modul

Setiap modul transaksional memakai **struktur tiga tingkat yang sama**:

```
Modul  →  Transaksi · Data induk · Laporan · Pengaturan  →  Entitas
```

Keseragaman ini disengaja dan tidak boleh dilanggar per modul. Pengguna yang hafal struktur Penjualan otomatis hafal Pembelian, Persediaan, dan Manufaktur. Ini satu-satunya cara navigasi tetap dapat dipelajari saat modul bertambah dari 10 menjadi 30.

### Contoh — Penjualan

| Transaksi | Data induk | Laporan | Pengaturan |
|---|---|---|---|
| Penawaran | Pelanggan | Penjualan per periode | Nomor dokumen |
| Pesanan Penjualan | Daftar Harga | Penjualan per pelanggan | Alur persetujuan |
| Faktur | Segmen Pelanggan | Penjualan per barang | Syarat pembayaran |
| Retur Penjualan | Wilayah | Umur Piutang | Template dokumen |
| Penerimaan Pembayaran | | Komisi Sales | |

Struktur identik berlaku untuk Pembelian (RFQ · Pesanan Pembelian · Tagihan · Retur · Pembayaran), Persediaan, dan seterusnya.

**Modul Fondasi tidak memakai struktur ini** — ia bukan transaksional. Auth, Tenant, Company, User, Role, Permission, Notifikasi, Pengaturan, Audit Log, dan File Storage hidup di area Pengaturan, bukan di rail modul.

---

## 2. Arsitektur URL

Keputusan yang paling sulit diubah setelah diambil. Tiga opsi dipertimbangkan.

| | **A — Subdomain tenant** | **B — Path** | **C — Session saja** |
|---|---|---|---|
| Bentuk | `nusantara.paaduflow.com/c/{company}/...` | `/{tenant}/{company}/...` | `/sales/invoices/{id}` |
| Link dapat direproduksi | ✅ | ✅ | ❌ **Terbuka di company penerima** |
| Custom domain per tenant | ✅ Native | ⚠️ Bisa ditambahkan sebagai alias | ⚠️ |
| Kompleksitas | Wildcard SSL, cookie lintas subdomain, CORS, dev lokal sulit | Rendah | Rendah |
| Pindah tenant | Muat ulang penuh | Navigasi biasa | — |

### Rekomendasi: **B sekarang, A sebagai alias di masa depan**

Opsi C **ditolak tegas**. Ia bertentangan langsung dengan seluruh desain keselamatan konteks di Step 2.2: sebuah link yang dikirim ke rekan akan terbuka di company yang sedang aktif di layar *mereka*, bukan company yang dimaksud pengirim. Untuk produk yang menyimpan data keuangan berkonsekuensi legal, itu cacat, bukan trade-off.

Opsi A lebih baik untuk custom domain — yang memang sudah tercantum di Future Enhancements Modul 01. Tetapi memilih path sekarang **tidak menutup jalan ke subdomain nanti**: subdomain dapat ditambahkan sebagai alias yang menulis ulang ke path. Kebalikannya jauh lebih sulit.

### Pola

```
/{tenant-slug}/{company-slug}/{modul}/{entitas}/{id}/{sub-view}

/nusantara/nusantara-jaya/penjualan/faktur                 → daftar
/nusantara/nusantara-jaya/penjualan/faktur/baru            → form baru
/nusantara/nusantara-jaya/penjualan/faktur/INV-2026-08-0142        → detail
/nusantara/nusantara-jaya/penjualan/faktur/INV-2026-08-0142/aktivitas → tab
/nusantara/nusantara-jaya/pengaturan/company               → pengaturan
```

**Slug boleh berubah; ID tidak.** Perubahan slug membuat redirect permanen dari slug lama. Nomor dokumen dipakai di URL karena ia yang dikenali pengguna — bukan UUID internal.

### Query parameter — kosakata baku

Ditetapkan sekali, dipakai identik di seluruh modul.

| Parameter | Fungsi |
|---|---|
| `?q=` | Pencarian teks |
| `?page=` `?per_page=` | Pagination |
| `?sort=` | Contoh: `sort=-tanggal,nomor` (minus = turun) |
| `?filter=` | State filter terenkode |
| `?view=` | Saved view |
| `?tab=` | Tab aktif di halaman detail |

**Seluruh state daftar hidup di URL.** Sebuah link harus mereproduksi tampilan yang sama persis. Ini persyaratan dari Step 3.2 §2, dan di sinilah ia ditegakkan.

### Membuka link lintas company

Bila pengguna membuka URL dengan company yang berbeda dari konteks aktifnya:
1. Sistem memeriksa apakah ia punya akses
2. Bila ya → konteks berpindah, **banner konfirmasi muncul** menyebut nama company
3. Bila tidak → state "tidak punya akses", menyebutkan company mana dan kepada siapa meminta

**Perpindahan konteks lewat URL tidak pernah senyap.**

---

## 3. Status Dokumen

Utang dari Step 3.1 §8, 3.2, dan Layout System. Menutupnya menyingkap satu kesalahan arsitektur yang harus dihindari sekarang.

### Kesalahan yang harus dihindari: satu enum untuk semuanya

Sebagian besar ERP memakai satu kolom `status` yang mencampur alur persetujuan dengan penyelesaian: `draft → sent → partially_paid → paid → overdue`. Ini pecah dalam enam bulan, karena keduanya adalah **sumbu yang berbeda dan berjalan bersamaan**. Sebuah faktur bisa sekaligus *sudah diposting* dan *dibayar sebagian* dan *jatuh tempo*.

### Tiga sumbu terpisah

**Sumbu 1 — `lifecycle_status`** (berlaku untuk semua dokumen transaksional)

| Status | Arti |
|---|---|
| `draft` | Dapat diedit bebas, belum berdampak |
| `submitted` | Diajukan, menunggu diproses |
| `pending_approval` | Menunggu persetujuan |
| `approved` | Disetujui, belum diposting |
| `rejected` | Ditolak, kembali dapat diedit |
| `posted` | Sudah menulis ke buku besar. **Tidak dapat diedit** |
| `cancelled` | Dibatalkan **sebelum** posting. Tidak ada jejak akuntansi |
| `void` | Dibatalkan **setelah** posting, lewat jurnal pembalik |
| `closed` | Selesai, diarsipkan |

Pembedaan `cancelled` dan `void` adalah pembedaan akuntansi, bukan semantik. Menyatukannya menghilangkan kemampuan menjelaskan mengapa ada jurnal pembalik.

**Sumbu 2 — `settlement_status`** (dokumen yang melibatkan uang)
`unpaid` · `partially_paid` · `paid` · `overpaid` · `written_off`

**Sumbu 3 — `fulfillment_status`** (dokumen yang melibatkan barang)
`not_fulfilled` · `partially_fulfilled` · `fulfilled` · `returned`

`overdue` **bukan status** — ia kondisi turunan dari `due_date < hari ini` dan `settlement_status ≠ paid`. Menyimpannya sebagai status berarti butuh pekerjaan terjadwal untuk memutakhirkannya, dan pekerjaan itu akan gagal diam-diam.

### Konsekuensi UI

Badge menampilkan **status yang paling penting bagi pengguna di konteks itu**, bukan semuanya. Di daftar faktur, itu gabungan sumbu 1 dan 2. Di halaman detail, ketiganya ditampilkan terpisah dengan label jelas.

---

## 4. Glosarium Terminologi

Utang dari Step 2.2 dan 3.1. Ditetapkan sekali, dipakai identik di seluruh modul, dokumentasi, API, dan skema database.

| Istilah dipakai | Bukan | Alasan |
|---|---|---|
| **Tenant** | Organization, Account | Wadah langganan |
| **Company** | Entity, Subsidiary, Business Unit | Entitas legal di dalam tenant |
| **Customer** | Client, Buyer | Pihak yang membeli — akun, bukan orang |
| **Contact** | Person, PIC | Orang di dalam sebuah Customer atau Vendor |
| **Vendor** | Supplier, Seller | Pihak yang menjual kepada kita |
| **Item** | Product, Material, SKU, Barang | Master entity tunggal, dengan atribut tipe |
| **Warehouse** | Location, Site, Gudang | — |
| **Invoice** | — | **Sisi penjualan saja (AR)** |
| **Bill** | Purchase Invoice, Invoice Pembelian | **Sisi pembelian saja (AP)** |
| **Quotation** | Quote, Estimate, Proposal | — |
| **Sales Order / Purchase Order** | Order | "Order" tanpa awalan dilarang |
| **User** | — | Akun login |
| **Employee** | — | Catatan SDM. **Bukan hal yang sama dengan User** |
| **Journal Entry** | Voucher, Memorial | — |

### Dua jebakan khusus Bahasa Indonesia

**"Akun" bermakna ganda.** Dalam Bahasa Indonesia, "akun" berarti *login account* sekaligus *GL account*. Ini akan menimbulkan kebingungan serius di modul Akuntansi.

Penyelesaian: **"Akun Perkiraan"** untuk GL account (istilah baku akuntansi Indonesia), **"Akun Pengguna"** untuk login. Bentuk pendek "Akun" tidak pernah dipakai sendirian di antarmuka.

**Invoice vs Bill tidak punya padanan Indonesia yang berbeda.** Keduanya "faktur". Penyelesaian: **"Faktur Penjualan"** dan **"Faktur Pembelian"** — selalu lengkap, tidak pernah "Faktur" saja di konteks yang bisa ambigu.

### Tata kelola

Glosarium ini adalah bagian dari Definition of Done. Pull request yang memperkenalkan istilah baru untuk konsep yang sudah punya nama **ditolak**. Istilah baru masuk lewat penambahan eksplisit ke dokumen ini.

---

## 5. Permission-Aware Navigation

Utang dari Step 2.2 §3 dan 3.3. Kebijakan tiga arah — bukan satu aturan seragam, karena penyebabnya berbeda.

| Penyebab tidak tersedia | Perlakuan | Alasan |
|---|---|---|
| **Modul tidak termasuk plan** | **Tampilkan + tawarkan upgrade** | Ini keputusan komersial, bukan batas keamanan. Menyembunyikannya berarti pelanggan tidak pernah tahu fitur itu ada |
| **Peran tidak punya izin** | **Sembunyikan sepenuhnya** | Menampilkan mengajarkan struktur internal organisasi dan menimbulkan permintaan dukungan yang tidak perlu. Untuk data keuangan, eksistensinya sendiri bisa sensitif |
| **Tidak tersedia karena kondisi** (periode tutup, dokumen sudah diposting) | **Tampilkan, nonaktif, dengan alasan** | Pengguna punya izin — yang berubah hanya keadaannya. Menyembunyikan justru membingungkan |

**Menu Pengaturan tidak pernah kosong.** Bila pengguna tidak punya izin apa pun di sana, menunya tidak ditampilkan sama sekali — bukan ditampilkan berisi nol item.

---

## 6. Arsitektur Pencarian Global

### Cakupan

Empat kelompok hasil, dengan urutan tetap: **navigasi** · **aksi** · **entitas** · **AI**.

Entitas yang dapat dicari lintas modul: pelanggan, vendor, item, dokumen transaksional (berdasarkan nomor dan nama pihak), karyawan, proyek, dan akun perkiraan.

### Keamanan — ini bukan soal kerapian

**Filter permission diterapkan di sisi server pada tingkat kueri, bukan di klien.**

**Hasil yang tidak diizinkan tidak pernah diakui keberadaannya.** Dilarang menampilkan "3 hasil disembunyikan" atau menampilkan nama lalu menolak saat dibuka — keduanya sudah membocorkan informasi. Bagi pengguna yang tidak berizin, data itu **tidak ada**.

### Lintas company

Default: hanya company aktif.

Hasil dari company lain yang boleh diakses pengguna ditampilkan di **grup terpisah dengan nama company-nya**. Memilihnya memicu perpindahan konteks yang dikonfirmasi (§2).

### Perilaku

Pencarian nomor dokumen memakai pencocokan tepat dan diprioritaskan di atas semuanya — mengetik `0142` harus langsung memunculkan `INV/2026/08/0142`. Pencarian dijalankan setelah jeda 200ms, minimal 2 karakter, dan riwayat terakhir muncul saat kolom kosong.

---

## 7. Model Navigasi Tambahan

**Terakhir dikunjungi** — 10 entitas terakhir, per pengguna per company, muncul di command palette saat kosong.

**Favorit** — pengguna dapat menyematkan entitas dan saved view. Berbeda dari sematan modul di rail: itu navigasi, ini bookmark.

**Deep link** — setiap entitas punya URL kanonik yang stabil. Membuka link ke dokumen yang sudah dihapus menampilkan state "tidak ditemukan" yang **menyebutkan kemungkinan salah company** (Step 3.4 §5).

---

## 8. Risiko & Item Terbuka

| Item | Status | Dampak |
|---|---|---|
| Kolom versi dokumen untuk deteksi konflik | **Belum ada di skema** | Dari Step 3.4 §6. Harus masuk template skema modul transaksional sekarang |
| Tiga sumbu status di skema | **Perlu keputusan sekarang** | Bila diimplementasikan sebagai satu enum, migrasinya nanti menyentuh setiap tabel dokumen |
| Glosarium versi Inggris | Belum dibuat | Dibutuhkan untuk penamaan API dan kolom database |
| Indeks pencarian | Belum dirancang | Perlu keputusan: pencarian database atau mesin pencari terpisah. Memengaruhi arsitektur, bukan hanya UI |
| Skema kode modul untuk URL | Belum ditetapkan | `penjualan` atau `sales` di URL? Terkait keputusan i18n yang masih tertunda dari Step 1.3 |
| Struktur IA modul Fase 3–5 | Level 3 belum dirinci | Cukup untuk sekarang; dirinci saat modul didesain |
