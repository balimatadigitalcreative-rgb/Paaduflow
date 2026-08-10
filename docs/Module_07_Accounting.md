# Module Design: Accounting
*Phase 2 — Core Business. Modul tujuan dari seluruh transaksi: Penjualan, Persediaan, dan Pembelian memposting ke sini.*

**Cakupan:** Bagan Akun · Jurnal · Buku Besar · Penentuan Akun · Kas & Bank · Rekonsiliasi Bank · Multi Mata Uang · Dimensi Biaya · Tutup Periode · Laporan Keuangan · Saldo Awal.
**Dependency:** Modul 01, 02, 03.
**Menerima posting dari:** Penjualan, Pembelian, Persediaan, dan seluruh modul Fase 3 ke atas.

---

## 1. Business Problem

Akuntansi adalah satu-satunya modul yang tidak boleh salah, karena seluruh modul lain bermuara ke sini dan seluruh keputusan bisnis dibaca dari sini.

Tiga kegagalan model muncul berulang. **Nomor akun ditulis di dalam kode modul**, sehingga setiap perusahaan dengan bagan akun berbeda memerlukan perubahan kode — dan janji "implementasi lewat konfigurasi, bukan kustomisasi" langsung runtuh. **Piutang dan utang disimpan dua kali**, di modul transaksional dan di akuntansi, lalu keduanya berbeda dan tidak ada yang tahu mana yang benar. **Jurnal dapat diedit**, sehingga laporan bulan lalu berubah diam-diam dan tidak ada yang dapat menjelaskan mengapa.

Untuk perusahaan Indonesia yang tumbuh, ketiganya baru terasa saat audit pertama atau saat pemeriksaan pajak — dan pada titik itu perbaikannya berarti membongkar berbulan-bulan data.

---

## 2. Goals

- **Modul lain tidak pernah menyebut nomor akun.** Mereka menerbitkan peristiwa; Akuntansi yang memutuskan akunnya lewat aturan yang dikonfigurasi.
- Jurnal tidak dapat diubah. Koreksi selalu lewat jurnal pembalik.
- Setiap jurnal berimbang, dijamin di tingkat layanan dan basis data.
- **Buku pembantu tidak diduplikasi.** Rincian piutang hidup di Penjualan; Akuntansi memegang akun kontrolnya, dan keduanya wajib selalu sama.
- Multi mata uang dengan selisih kurs terealisasi dan belum terealisasi yang benar.
- Tutup periode yang dapat ditegakkan, dan pembukaan kembali yang teraudit.
- Laporan keuangan dapat ditelusuri sampai ke transaksi sumbernya.

---

## 3. User Stories

- Sebagai akuntan, saya ingin bagan akun mengikuti struktur perusahaan saya tanpa meminta perubahan ke pengembang.
- Sebagai akuntan, saya ingin setiap angka di laba rugi dapat saya klik sampai ke fakturnya.
- Sebagai akuntan, saya ingin yakin neraca saldo selalu seimbang, dan diberi tahu segera bila tidak.
- Sebagai akuntan, saya ingin menutup periode dan yakin tidak ada yang menambah transaksi ke belakang.
- Sebagai pemilik grup, saya ingin membandingkan laba rugi dua PT dengan tahun fiskal berbeda.
- Sebagai akuntan, saya ingin mencocokkan mutasi rekening bank dengan pembayaran yang tercatat.
- Sebagai controller, saya ingin melihat biaya per cabang dan per proyek tanpa membuat akun terpisah untuk masing-masing.
- Sebagai pelanggan baru, saya ingin memasukkan saldo awal dari sistem lama tanpa merusak jejak audit.

---

## 4. Functional Requirements

**Bagan akun.** Hierarkis, per company, dengan tipe akun yang menentukan penempatannya di laporan. Template bagan akun Indonesia tersedia saat onboarding dan dapat disesuaikan. Akun yang sudah punya mutasi tidak dapat dihapus, hanya dinonaktifkan.

**Penentuan akun.** Matriks konfigurasi yang memetakan `(jenis transaksi, kategori item, gudang, kode pajak, jenis pelanggan atau vendor)` ke akun. Aturan yang lebih spesifik menimpa yang lebih umum. Modul lain hanya menerbitkan peristiwa.

**Jurnal.** Manual dan otomatis. **Append-only.** Jurnal berulang untuk beban tetap. Jurnal penyesuaian akhir periode. Setiap jurnal membawa referensi ke dokumen sumbernya.

**Buku besar.** Mutasi per akun dengan saldo berjalan, dapat ditelusuri ke jurnal dan ke dokumen sumber.

**Buku pembantu.** Piutang, utang, dan persediaan **tidak disimpan ulang**. Akuntansi memegang akun kontrol; rinciannya dibaca dari modul asal. Laporan rekonsiliasi kontrol-versus-pembantu tersedia setiap saat dan wajib nol.

**Kas dan bank.** Rekening per company, mutasi, transfer antar rekening, dan rekonsiliasi bank dengan impor mutasi serta pencocokan otomatis yang dapat dikoreksi manual.

**Multi mata uang.** Mata uang transaksi dan mata uang fungsional company. Selisih kurs terealisasi saat pelunasan; revaluasi saldo mata uang asing di akhir periode menghasilkan selisih belum terealisasi.

**Dimensi biaya.** Maksimal tiga dimensi yang dapat dikonfigurasi per company — misalnya cabang, departemen, proyek. Dimensi wajib atau opsional per akun.

**Tutup periode.** Penutupan lunak memberi peringatan; penutupan keras memblokir. Pembukaan kembali memerlukan izin tersendiri dan tercatat sebagai peristiwa audit.

**Saldo awal.** Jalur khusus untuk migrasi, dengan jurnal saldo awal yang ditandai jelas dan tidak tercampur dengan transaksi operasional.

**Laporan.** Neraca saldo · Laba Rugi · Neraca · Arus Kas · Buku Besar · Rekonsiliasi kontrol-pembantu · Laporan per dimensi.

---

## 5. Non Functional Requirements

- **Jurnal tidak berimbang tidak pernah dapat tersimpan.** Ditegakkan constraint basis data, bukan hanya validasi aplikasi.
- **Neraca saldo diperiksa terus-menerus.** Ketidakseimbangan memicu peringatan segera, bukan ditemukan saat tutup buku.
- Rekonsiliasi kontrol-versus-pembantu dapat dijalankan kapan saja dan wajib menghasilkan nol.
- Laporan laba rugi 12 bulan pada company dengan 500.000 jurnal selesai di bawah 3 detik.
- Penelusuran dari baris laporan ke dokumen sumber di bawah 500ms.
- Posting bersifat atomik dan idempoten — percobaan ulang tidak pernah menghasilkan jurnal ganda.
- Presisi internal empat desimal, pembulatan hanya saat penyajian.

---

## 6. Database Design

**Table: `accounts`** — `company_id`, `code`, `name`, `type` (asset, liability, equity, revenue, expense), `subtype`, `parent_id`, `currency`, `is_control` (boolean), `control_of` (ar, ap, inventory, nullable), `requires_dimension` jsonb, `status`, + audit baku.

Akun kontrol ditandai eksplisit dan **tidak dapat dijurnal manual** — saldonya hanya boleh berubah lewat modul asalnya. Ini yang menjaga kontrol dan pembantu tetap sama.

**Table: `journals`**

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| tenant_id, company_id | UUID | |
| number | varchar | diberikan saat posting |
| journal_date | date | |
| fiscal_year, fiscal_period | int | dihitung dari `fiscal_year_start_month` |
| type | enum | auto, manual, adjustment, closing, opening, reversal |
| source_type, source_id | varchar, UUID | dokumen pemicu |
| description | text | |
| reverses_id | UUID, nullable | |
| posted_at, posted_by | | |
| currency, exchange_rate | | |

Tanpa `updated_at` dan `deleted_at`. Peran basis data aplikasi hanya diberi `INSERT` dan `SELECT`, sama seperti audit log.

**Table: `journal_lines`** — `journal_id`, `line_no`, `account_id`, `debit`, `credit`, `currency`, `amount_foreign`, `exchange_rate`, `dimension_1_id`, `dimension_2_id`, `dimension_3_id`, `description`, `source_line_id`

Constraint: `debit = 0 OR credit = 0` per baris, dan jumlah debit sama dengan jumlah kredit per jurnal.

**Table: `account_determination_rules`**

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| company_id | UUID | |
| transaction_type | varchar | `sales.invoice.revenue`, `purchase.receipt.clearing` |
| item_category_id | UUID, nullable | null berarti berlaku umum |
| warehouse_id | UUID, nullable | |
| tax_code_id | UUID, nullable | |
| partner_type | varchar, nullable | |
| account_id | UUID (FK) | |
| specificity | int | dihitung; makin spesifik makin tinggi |

Pencarian mengambil aturan dengan `specificity` tertinggi yang cocok. Bila tidak ada yang cocok, posting **ditolak dengan pesan yang menyebutkan aturan apa yang kurang** — bukan diposting ke akun cadangan diam-diam.

**Table: `fiscal_periods`** — `company_id`, `fiscal_year`, `period_no`, `start_date`, `end_date`, `status` (open, soft_closed, closed), `closed_at`, `closed_by`, `reopened_at`, `reopened_by`

**Table: `bank_accounts`**, **`bank_statements`**, **`bank_statement_lines`**, **`bank_reconciliations`** — impor mutasi, pencocokan ke pembayaran, dan selisih yang belum tercocokkan.

**Table: `dimensions`** dan **`dimension_values`** — tiga dimensi terkonfigurasi per company.

**Table: `exchange_rates`** — `company_id`, `from_currency`, `to_currency`, `rate_date`, `rate`, `source`

---

## 7. API Design

```
GET    /v1/companies/{id}/accounts?tree=true
POST   /v1/companies/{id}/accounts
PATCH  /v1/accounts/{id}                       -> tidak dapat mengubah tipe bila ada mutasi

GET    /v1/companies/{id}/account-rules
POST   /v1/companies/{id}/account-rules
POST   /v1/companies/{id}/account-rules/resolve -> uji aturan sebelum disimpan

POST   /v1/companies/{id}/journals              -> manual, wajib berimbang
POST   /v1/journals/{id}/post
POST   /v1/journals/{id}/reverse                -> alasan wajib
GET    /v1/journals/{id}

GET    /v1/companies/{id}/ledger?account_id=&from=&to=
GET    /v1/companies/{id}/trial-balance?as_of=
GET    /v1/companies/{id}/reports/profit-loss?period=&compare=&dimension=
GET    /v1/companies/{id}/reports/balance-sheet?as_of=
GET    /v1/companies/{id}/reports/cash-flow?period=
GET    /v1/companies/{id}/reports/subledger-reconciliation

POST   /v1/companies/{id}/bank-statements/import
GET    /v1/bank-statements/{id}/suggestions     -> pencocokan otomatis
POST   /v1/bank-statement-lines/{id}/match

POST   /v1/companies/{id}/periods/{period}/close
POST   /v1/companies/{id}/periods/{period}/reopen  -> izin tersendiri, alasan wajib
POST   /v1/companies/{id}/fx-revaluation        -> akhir periode

POST   /v1/companies/{id}/opening-balances      -> jalur migrasi terpisah
```

### Kontrak yang mengikat seluruh produk

**Modul lain tidak pernah mengirim `account_id`.** Mereka mengirim `transaction_type` beserta konteksnya, dan Akuntansi yang menyelesaikan akunnya. Endpoint posting yang menerima nomor akun dari modul lain adalah pelanggaran arsitektur.

**Aturan yang tidak ditemukan menolak posting.** Tidak ada akun cadangan. Posting ke akun cadangan menyembunyikan kesalahan konfigurasi sampai tutup buku, dan pada titik itu ratusan transaksi sudah salah tempat.

**`/account-rules/resolve` dapat dipanggil sebelum menyimpan aturan**, sehingga admin dapat menguji "peristiwa seperti ini akan masuk ke akun mana" tanpa membuat transaksi.

**Akun kontrol tidak dapat dijurnal manual.** Endpoint jurnal manual menolak baris yang menyentuhnya.

---

## 8. UI Flow

**Bagan akun** — pohon yang dapat dilipat, dengan saldo berjalan per akun dan penanda akun kontrol.

**Penentuan akun** — matriks per jenis transaksi, dengan penguji di sampingnya: pilih skenario, lihat akun mana yang akan dipakai dan aturan mana yang menang.

**Jurnal manual** — line-item editor sesuai Archetype 4, dengan indikator selisih debit-kredit yang selalu terlihat dan tombol posting yang tidak aktif sampai berimbang.

**Buku besar** — daftar mutasi per akun dengan saldo berjalan, dapat ditelusuri ke jurnal lalu ke dokumen sumber.

**Laporan keuangan** — sesuai Archetype 6: panel parameter, hasil hierarkis yang dapat dilipat, kolom perbandingan periode, angka negatif dalam kurung, dan **setiap baris dapat ditelusuri**.

**Rekonsiliasi bank** — dua kolom berdampingan, saran pencocokan di tengah, sisa yang belum cocok selalu terlihat.

**Tutup periode** — daftar periksa sebelum menutup: jurnal belum diposting, rekonsiliasi kontrol-pembantu, revaluasi kurs, rekonsiliasi bank. Menutup tanpa menyelesaikan daftar memerlukan konfirmasi eksplisit.

---

## 9. Business Flow

Modul menerbitkan peristiwa saat dokumen diposting → Akuntansi menyelesaikan akun lewat aturan → jurnal dibuat, diperiksa keseimbangannya, dan diposting dalam transaksi yang sama dengan dokumennya → buku besar dan saldo akun diperbarui.

Akhir periode: jurnal penyesuaian dibuat → revaluasi mata uang asing dijalankan → rekonsiliasi kontrol-pembantu diperiksa → rekonsiliasi bank diselesaikan → periode ditutup.

Akhir tahun fiskal: jurnal penutup memindahkan saldo pendapatan dan beban ke laba ditahan, dan periode pertama tahun berikutnya dibuka.

Bila ditemukan kesalahan setelah posting: **jurnal tidak pernah diedit.** Jurnal pembalik dibuat, dan bila periodenya sudah tertutup, pembalikan diposting di periode berjalan — bukan dengan membuka kembali periode lama, kecuali memang diperlukan dan disetujui.

---

## 10. Permission Matrix

| Aksi | Tenant Owner | Tenant Admin | Company Admin | Akuntan | Finance | Member |
|---|---|---|---|---|---|---|
| Lihat laporan keuangan | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Kelola bagan akun | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Ubah aturan penentuan akun** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Buat jurnal manual | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Posting jurnal manual** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Balik jurnal | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Rekonsiliasi bank | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Tutup periode** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Buka kembali periode** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Input saldo awal | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

**Yang membuat jurnal bukan yang memposting.** Pemisahan tugas yang sama polanya dengan Penjualan dan Pembelian.

**Membuka kembali periode tertutup hanya di tingkat tenant.** Ini aksi paling berdampak di seluruh produk — ia dapat mengubah laporan yang sudah diserahkan ke bank, pemegang saham, atau otoritas pajak.

---

## 11. Validation Rules

- Jumlah debit wajib sama dengan jumlah kredit, per jurnal, dalam mata uang fungsional.
- Satu baris jurnal tidak boleh memiliki debit dan kredit sekaligus.
- Akun bertipe kontrol tidak dapat dijurnal manual.
- Akun yang sudah punya mutasi tidak dapat diubah tipenya maupun dihapus.
- Jurnal tidak dapat diposting ke periode berstatus `closed`.
- Dimensi wajib pada akun tertentu harus terisi; bila tidak, posting ditolak.
- Kurs wajib ada untuk setiap kombinasi mata uang dan tanggal yang dipakai.
- Jurnal saldo awal hanya dapat dibuat sebelum ada transaksi operasional di company itu.
- Periode tidak dapat ditutup bila masih ada jurnal berstatus draft di dalamnya.
- Tahun fiskal tidak dapat ditutup sebelum seluruh periodenya tertutup.

### Yang wajib divalidasi profesional

**Struktur bagan akun template** terhadap praktik pelaporan Indonesia · **perlakuan selisih kurs** terealisasi dan belum terealisasi · **penyajian laporan keuangan** sesuai standar yang berlaku · **retensi dan format arsip** untuk keperluan pemeriksaan. Keempatnya menentukan bentuk laporan yang diserahkan ke pihak luar.

---

## 12. Testing Strategy

**Unit.** Penyelesaian aturan penentuan akun untuk seluruh kombinasi, termasuk kasus beberapa aturan cocok dengan spesifisitas berbeda · perhitungan periode fiskal untuk tahun buku non-Januari · selisih kurs terealisasi dan belum terealisasi.

**Invarian — yang terpenting di modul ini.** Setelah rangkaian transaksi acak dari seluruh modul: neraca saldo seimbang · saldo akun kontrol piutang sama dengan jumlah sisa tagihan di Penjualan · saldo akun kontrol utang sama dengan jumlah sisa tagihan di Pembelian · saldo akun persediaan sama dengan nilai persediaan di Modul 05. **Keempatnya diuji sebagai properti, bukan sebagai kasus.**

**Integration.** Posting faktur menghasilkan jurnal yang benar tanpa modul Penjualan menyebut nomor akun · aturan yang tidak ditemukan menolak posting dengan pesan yang jelas · pembalikan menghasilkan jurnal lawan yang tepat.

**Negatif.** Jurnal tidak berimbang ditolak di tingkat basis data · jurnal manual ke akun kontrol ditolak · posting ke periode tertutup ditolak · pembuat jurnal memposting jurnalnya sendiri ditolak.

**E2E.** Siklus penuh dari faktur sampai laporan keuangan · tutup periode lengkap dengan seluruh daftar periksa · migrasi saldo awal lalu transaksi pertama.

---

## 13. Future Enhancements

- **Konsolidasi grup** — laporan gabungan beberapa company dengan eliminasi transaksi antar entitas.
- **Anggaran dan varians** per akun dan per dimensi, dengan komentar naratif.
- **Mata uang pelaporan grup** di samping mata uang fungsional company.
- **Rekonsiliasi bank otomatis** lewat open banking, menggantikan impor manual.
- **Tutup buku berpandu** — daftar tugas dengan pemilik dan tenggat, seperti alur tutup bulan yang terstruktur.
- **Analisis anomali oleh AI** — menandai jurnal yang menyimpang dari pola historis untuk ditinjau manusia, tanpa pernah memposting sendiri.
- **Aset tetap dan penyusutan** sebagai modul terpisah di Fase 3, dengan jurnal otomatis ke sini.
- **Akuntansi berbasis akrual dan kas berdampingan**, untuk perusahaan yang melaporkan keduanya.
