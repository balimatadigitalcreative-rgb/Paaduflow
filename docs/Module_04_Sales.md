# Module Design: Sales
*Phase 2 — Core Business. Modul referensi: seluruh Flow Archetypes, spesifikasi layar, dan prototype memakainya sebagai contoh.*

**Cakupan:** Pelanggan · Daftar Harga · Penawaran · Pesanan Penjualan · Faktur · Faktur Pajak · Penerimaan Pembayaran · Retur Penjualan · Nota Kredit.
**Dependency:** Modul 01 (Tenant, Company), 02 (IAM), 03 (Notification, Audit, File).
**Berpasangan dengan:** Persediaan (pemenuhan barang), Akuntansi (posting jurnal), Pajak (perhitungan dan pelaporan).

---

## 1. Business Problem

Penjualan adalah tempat uang masuk, dan karena itu ia tempat kesalahan paling mahal.

Sistem yang buruk di sini menghasilkan tiga masalah yang saling memperkuat. **Dokumen tidak terhubung**: penawaran dibuat di spreadsheet, pesanan di WhatsApp, faktur di aplikasi lain, sehingga tidak ada yang tahu berapa nilai pesanan yang belum difakturkan. **Faktur pajak diperlakukan sebagai kolom di faktur biasa**, padahal ia dokumen tersendiri dengan nomor seri yang dialokasikan otoritas pajak dan siklus hidupnya sendiri — begitu ada koreksi, seluruh model pecah. **Koreksi dilakukan dengan mengedit dokumen yang sudah diposting**, yang menghapus jejak audit dan membuat laporan bulan lalu berubah diam-diam.

Untuk UMKM Indonesia yang tumbuh, ketiganya biasanya baru terasa saat pemeriksaan pajak atau saat mencari selisih piutang yang tidak bisa dijelaskan.

---

## 2. Goals

- Rantai dokumen yang terhubung penuh dengan penelusuran dua arah, dari penawaran sampai pembayaran.
- **Faktur Pajak sebagai dokumen tersendiri**, bukan atribut faktur komersial.
- Dokumen terposting tidak pernah diedit; koreksi selalu lewat nota kredit.
- Konversi parsial per baris, dengan penjagaan konversi berlebih.
- Piutang dan umurnya dihitung, tidak disimpan.
- Satu pembayaran dapat menyelesaikan banyak faktur, dan sebaliknya.
- Menerapkan Flow Archetypes 1–6 apa adanya, tanpa dialek modul sendiri.

---

## 3. User Stories

- Sebagai sales, saya ingin mengubah penawaran yang disetujui menjadi pesanan tanpa mengetik ulang apa pun.
- Sebagai admin penjualan, saya ingin memfakturkan sebagian pesanan saat barang dikirim bertahap, dan tahu sisanya masih terbuka.
- Sebagai akuntan, saya ingin faktur yang sudah diposting tidak dapat diubah siapa pun.
- Sebagai akuntan pajak, saya ingin nomor seri faktur pajak dikelola sistem dan tidak pernah terpakai dua kali atau terlewat.
- Sebagai pemilik, saya ingin tahu piutang mana yang jatuh tempo dan siapa pelanggan yang selalu telat.
- Sebagai kasir, saya ingin mencatat satu transfer yang melunasi empat faktur sekaligus.
- Sebagai manajer, saya ingin faktur di atas nilai tertentu perlu persetujuan saya sebelum terbit.
- Sebagai sales, saya ingin diperingatkan sebelum membuat pesanan yang melampaui batas kredit pelanggan.

---

## 4. Functional Requirements

**Pelanggan.** Data induk dengan kontak berganda, alamat tagih dan alamat kirim terpisah, NPWP, termin pembayaran, batas kredit, segmen, dan mata uang default.

**Daftar harga.** Per segmen pelanggan, per mata uang, dengan tanggal berlaku. Harga khusus per pelanggan menimpa daftar harga. Diskon bertingkat berdasarkan kuantitas.

**Penawaran.** Masa berlaku, revisi bernomor, konversi ke pesanan.

**Pesanan penjualan.** Komitmen kuantitas dan harga. Melacak kuantitas yang sudah dikirim dan sudah difakturkan **per baris**. Pemeriksaan batas kredit saat konfirmasi.

**Faktur.** Dibuat dari pesanan, dari pengiriman, atau berdiri sendiri. Line-item editor sesuai Flow Archetypes §4. Alur persetujuan berbasis ambang nilai.

**Faktur pajak.** Dokumen terpisah yang merujuk satu atau beberapa faktur komersial. Mengelola alokasi nomor seri, status pelaporan, dan koreksi (faktur pajak pengganti).

**Penerimaan pembayaran.** Satu penerimaan dapat dialokasikan ke banyak faktur. Pembayaran sebagian, kelebihan bayar menjadi saldo kredit pelanggan, dan biaya bank dicatat terpisah.

**Retur penjualan.** Barang kembali, memicu penyesuaian stok, menghasilkan nota kredit.

**Nota kredit.** Koreksi nilai tanpa mengubah faktur asal. Dapat dialokasikan ke faktur atau menjadi saldo kredit.

**Laporan.** Penjualan per periode, per pelanggan, per barang, per sales · umur piutang · pesanan terbuka · margin per faktur.

---

## 5. Non Functional Requirements

- **Kalkulasi deterministik.** Perhitungan yang sama selalu menghasilkan angka yang sama. Pembulatan hanya di langkah terakhir, sesuai Flow Archetypes §4.
- **Penomoran tahan konkurensi.** Sepuluh pengguna menerbitkan faktur bersamaan tidak boleh menghasilkan nomor ganda maupun celah.
- **Nomor seri faktur pajak tidak boleh bocor.** Nomor yang dialokasikan tetapi gagal dipakai wajib tercatat, karena otoritas pajak menanyakan penggunaannya.
- **Daftar faktur di bawah 300ms** untuk 100.000 baris dengan filter aktif.
- **Posting bersifat atomik.** Faktur, jurnal, dan mutasi stok berhasil bersama atau gagal bersama.
- **Idempoten.** Endpoint posting dan pembayaran wajib memakai kunci idempotensi — timeout tidak boleh menghasilkan faktur atau pembayaran ganda.

---

## 6. Database Design

**Table: `customers`** — `id`, `tenant_id`, `company_id`, `code`, `name`, `legal_name`, `tax_id`, `segment_id`, `price_list_id`, `payment_term_days`, `credit_limit`, `currency`, `status`, + kolom audit baku.

**Table: `sales_documents`** — tabel tunggal untuk penawaran, pesanan, dan faktur

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| tenant_id, company_id | UUID (FK) | bagian indeks utama |
| doc_type | enum | quotation, sales_order, invoice, credit_note |
| number | varchar, nullable | **diberikan saat submit**, bukan saat draf |
| customer_id | UUID (FK) | |
| issue_date, due_date, valid_until | date | |
| currency, exchange_rate | varchar(3), numeric | **kurs dikunci saat submit** |
| lifecycle_status | enum | draft, submitted, pending_approval, approved, rejected, posted, cancelled, void, closed |
| settlement_status | enum | unpaid, partially_paid, paid, overpaid, written_off |
| fulfillment_status | enum | not_fulfilled, partially_fulfilled, fulfilled, returned |
| subtotal, discount, dpp, tax_total, withholding, total | numeric(18,2) | |
| source_document_id | UUID, nullable | jejak konversi |
| document_version | int | **optimistic concurrency** |
| + kolom audit baku | | |

Satu tabel dipakai untuk tiga jenis dokumen karena struktur dan perilakunya identik — yang berbeda hanya transisi status yang diizinkan. Memisahkannya menjadi tiga tabel berarti menduplikasi line item, perhitungan, dan konversi tiga kali.

**Table: `sales_document_lines`** — `document_id`, `line_no`, `item_id`, `description`, `qty`, `uom`, `unit_price`, `discount_pct`, `discount_amount`, `allocated_doc_discount`, `net_amount`, `tax_code_id`, `tax_amount`, `qty_delivered`, `qty_invoiced`, `qty_returned`, `warehouse_id`

`qty_invoiced` dan `qty_delivered` per baris adalah yang memungkinkan konversi parsial dan penjagaan konversi berlebih.

**Table: `tax_invoices`** — dokumen terpisah

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| tenant_id, company_id | UUID | |
| serial_number | varchar | dari alokasi otoritas pajak |
| customer_id, customer_tax_id | | disalin saat terbit, tidak diikat referensi |
| issue_date | date | |
| status | enum | draft, issued, reported, replaced, cancelled |
| replaces_id | UUID, nullable | faktur pajak pengganti |
| dpp, tax_amount | numeric | |

**Table: `tax_invoice_lines`** — merujuk `sales_document_lines`, karena satu faktur pajak dapat mencakup beberapa faktur komersial.

**Table: `tax_serial_allocations`** — `company_id`, `range_start`, `range_end`, `next_available`, `allocated_at`, `expires_at`. Nomor yang dialokasikan tetapi batal dipakai dicatat sebagai terpakai-batal, tidak dikembalikan ke pool.

**Table: `payment_receipts`** — `company_id`, `number`, `customer_id`, `received_date`, `amount`, `currency`, `exchange_rate`, `method`, `bank_account_id`, `bank_charge`, `lifecycle_status`

**Table: `payment_allocations`** — `receipt_id`, `document_id`, `allocated_amount`. Inilah yang membuat satu pembayaran dapat melunasi banyak faktur.

**Table: `customer_credits`** — saldo kredit dari kelebihan bayar dan nota kredit, dengan alokasi ke faktur berikutnya.

**Table: `document_numbering`** — `company_id`, `doc_type`, `fiscal_year`, `prefix`, `next_number`. Dikunci per baris saat pengambilan nomor.

---

## 7. API Design

```
GET    /v1/companies/{id}/customers
POST   /v1/companies/{id}/customers
GET    /v1/customers/{id}/statement           -> mutasi piutang

GET    /v1/companies/{id}/quotations
POST   /v1/companies/{id}/quotations
POST   /v1/quotations/{id}/convert            -> body: line_ids, target: sales_order

GET    /v1/companies/{id}/sales-orders
POST   /v1/sales-orders/{id}/confirm          -> memeriksa batas kredit
POST   /v1/sales-orders/{id}/convert          -> body: lines[{line_id, qty}], target: invoice

GET    /v1/companies/{id}/invoices?q=&filter=&sort=&page=&view=
POST   /v1/companies/{id}/invoices
PATCH  /v1/invoices/{id}                      -> hanya draft; wajib If-Match document_version
POST   /v1/invoices/{id}/submit               -> nomor diberikan di sini
POST   /v1/invoices/{id}/approve
POST   /v1/invoices/{id}/reject               -> alasan wajib
POST   /v1/invoices/{id}/post                 -> atomik dengan jurnal dan stok
POST   /v1/invoices/{id}/void                 -> jurnal pembalik
GET    /v1/invoices/{id}/related              -> jejak konversi dua arah

POST   /v1/companies/{id}/tax-invoices        -> body: invoice_ids[]
POST   /v1/tax-invoices/{id}/issue            -> mengambil nomor seri
POST   /v1/tax-invoices/{id}/replace          -> faktur pajak pengganti
GET    /v1/companies/{id}/tax-serials         -> sisa alokasi

POST   /v1/companies/{id}/payment-receipts    -> body: allocations[{invoice_id, amount}]
POST   /v1/companies/{id}/credit-notes
POST   /v1/companies/{id}/sales-returns

GET    /v1/companies/{id}/reports/ar-aging?as_of=
GET    /v1/companies/{id}/reports/sales?group_by=&period=
```

### Kontrak yang mengikat

**`PATCH` wajib menyertakan `If-Match: <document_version>`.** Versi tidak cocok mengembalikan `409` dengan kode `conflict` beserta daftar field yang bentrok, siapa mengubahnya, dan kapan — sesuai Component Specs Feedback States §6.

**`/post` dan `/payment-receipts` wajib memakai kunci idempotensi.** Percobaan ulang setelah timeout mengembalikan hasil yang sama, bukan dokumen kedua.

**`/convert` menerima kuantitas per baris**, dan menolak bila melebihi sisa yang belum dikonversi. Penjagaan ini adalah kontrol keuangan, bukan validasi UI.

**Nomor faktur tidak pernah dikembalikan oleh `POST /invoices`.** Ia baru ada setelah `/submit`.

---

## 8. UI Flow

Seluruhnya menerapkan Flow Archetypes tanpa penyimpangan.

**Daftar faktur** — Archetype 1 dan data table penuh. Default terfilter ke periode berjalan agar Ekspor menjadi klik ketiga.

**Detail faktur** — tab baku Ringkasan · Baris · Dokumen terkait · Aktivitas. Tiga sumbu status ditampilkan terpisah dengan label jelas. Draf dapat diedit langsung; terposting baca-saja permanen.

**Form faktur** — line-item editor keyboard-first, kalkulasi real-time, konfirmasi penerbitan menyebut nilai dan nama company.

**Konversi** — memilih baris dan kuantitas, dengan sisa terlihat per baris.

**Penerimaan pembayaran** — daftar faktur terbuka pelanggan, alokasi otomatis tertua-dulu yang dapat diubah manual, sisa yang belum teralokasi ditampilkan eksplisit.

**Faktur pajak** — layar tersendiri, bukan tab di faktur. Menampilkan sisa alokasi nomor seri sebagai peringatan saat menipis.

**Umur piutang** — laporan dengan drill-down ke faktur, sesuai Archetype 6.

---

## 9. Business Flow

Penawaran dibuat → disetujui pelanggan → dikonversi ke pesanan → batas kredit diperiksa saat konfirmasi → barang dikirim, `qty_delivered` bertambah per baris → faktur dibuat dari baris yang sudah dikirim → bila melewati ambang, masuk persetujuan → diposting: nomor final, jurnal piutang dan pendapatan, mutasi stok, semuanya atomik → faktur pajak diterbitkan merujuk faktur itu, mengambil nomor seri → pembayaran diterima dan dialokasikan → `settlement_status` diperbarui.

Bila ada koreksi setelah posting: **faktur tidak pernah diedit.** Nota kredit diterbitkan, dan bila menyangkut pajak, faktur pajak pengganti dibuat merujuk yang lama.

Bila pesanan dibatalkan sebagian: baris yang belum dikonversi ditutup, baris yang sudah difakturkan tidak terpengaruh.

---

## 10. Permission Matrix

| Aksi | Tenant Owner | Tenant Admin | Company Admin | Sales | Finance | Member |
|---|---|---|---|---|---|---|
| Lihat faktur | ✅ | ✅ | ✅ | ✅ (milik sendiri) | ✅ | ❌ |
| Buat draf faktur | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ajukan faktur | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Setujui faktur | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Posting faktur** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Void faktur | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Terbitkan faktur pajak | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Catat pembayaran | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Ubah batas kredit | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ubah daftar harga | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

**Pengaju tidak dapat menyetujui dokumennya sendiri**, meski memegang izin persetujuan. Ditegakkan di layanan persetujuan, bukan di model izin (Modul 02 §11).

**Sales tidak dapat memposting maupun mencatat pembayaran.** Pemisahan tugas antara yang menjual dan yang mengakui pendapatan adalah kontrol yang akan diperiksa auditor.

**AI tidak pernah memegang izin posting, persetujuan, maupun void** — ditandai `delegatable_to_machine = false` di katalog izin.

---

## 11. Validation Rules

- Faktur wajib punya pelanggan dan minimal satu baris berkuantitas positif.
- Kuantitas konversi tidak boleh melebihi `qty - qty_invoiced` pada baris sumber.
- Tanggal jatuh tempo tidak boleh mendahului tanggal terbit.
- Dokumen tidak dapat diposting ke periode fiskal yang sudah ditutup.
- Kurs wajib ada bila mata uang berbeda dari mata uang company.
- Alokasi pembayaran tidak boleh melebihi sisa tagihan faktur; kelebihan menjadi saldo kredit, bukan alokasi berlebih.
- Nota kredit tidak boleh melebihi nilai faktur asal dikurangi nota kredit sebelumnya.
- Faktur pajak memerlukan NPWP pelanggan; tanpa itu ditolak dengan pesan yang menjelaskan cara melengkapinya.
- Nomor seri faktur pajak yang sudah dipakai tidak dapat dipakai ulang, termasuk setelah pembatalan.
- Pesanan yang melampaui batas kredit memerlukan persetujuan eksplisit, bukan diblokir diam-diam.

### Yang wajib divalidasi profesional

**Urutan perhitungan pajak** — alokasi diskon dokumen ke baris sebelum pajak dihitung (Flow Archetypes §4) · **perlakuan PPh yang dipotong pelanggan** atas jasa · **aturan faktur pajak pengganti** dan batas waktunya · **retensi dokumen**. Keempatnya menyentuh regulasi perpajakan Indonesia dan harus ditetapkan konsultan pajak, bukan diasumsikan dari dokumen desain.

---

## 12. Testing Strategy

**Unit.** Urutan perhitungan lengkap termasuk alokasi diskon dan pembulatan akhir · konversi mata uang dengan kurs terkunci · transisi status yang sah dan tidak sah · perhitungan bucket umur piutang.

**Integration.** Posting bersifat atomik — jurnal gagal berarti faktur tidak jadi diposting · konversi memperbarui `qty_invoiced` dengan benar · pembayaran ke banyak faktur memperbarui seluruh `settlement_status` · alokasi nomor seri pajak tidak pernah ganda.

**Konkurensi.** Sepuluh permintaan `/submit` bersamaan menghasilkan sepuluh nomor berurutan tanpa celah dan tanpa duplikat · dua pengguna mengedit draf yang sama menghasilkan `409` yang benar, bukan penimpaan senyap · dua permintaan `/post` dengan kunci idempotensi sama menghasilkan satu posting.

**Negatif.** Konversi melebihi sisa ditolak · posting ke periode tertutup ditolak · pengaju menyetujui dokumennya sendiri ditolak · pengguna company lain tidak dapat mengambil faktur lewat manipulasi ID.

**E2E.** Penawaran sampai pembayaran penuh · konversi parsial dua tahap · koreksi lewat nota kredit dan faktur pajak pengganti.

---

## 13. Future Enhancements

- **Faktur berulang** untuk langganan dan retainer, dengan pembuatan otomatis terjadwal.
- **Integrasi e-Faktur langsung** ke sistem otoritas pajak, menggantikan ekspor manual.
- **Portal pelanggan**: pelanggan melihat fakturnya sendiri, mengunduh, dan membayar.
- **Tautan pembayaran** di faktur, terhubung ke payment gateway lokal.
- **Rekonsiliasi bank otomatis** yang mencocokkan transfer masuk ke faktur terbuka.
- **Penilaian risiko kredit** dari riwayat pembayaran, mengubah batas kredit sebagai saran.
- **Pengingat penagihan bertingkat** dengan nada yang menyesuaikan riwayat pelanggan.
- **Komisi sales** dihitung dari faktur terbayar, bukan dari faktur terbit.
- **Harga berbasis kontrak** dengan komitmen volume dan rabat akhir periode.
