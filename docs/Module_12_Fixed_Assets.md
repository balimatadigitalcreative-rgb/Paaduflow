# Module Design: Fixed Assets
*Phase 3 — Operations. Modul yang menutup jarak antara pembukuan internal dan pelaporan pajak.*

**Cakupan:** Register Aset · Perolehan · Kapitalisasi · Buku Penyusutan · Jadwal Penyusutan · Revaluasi & Penurunan Nilai · Pemindahan · Pelepasan · Aset dalam Penyelesaian · Inventarisasi Fisik.
**Dependency:** Modul 01, 02, 03, 06 (Pembelian), 07 (Akuntansi), 08 (Pajak).

---

## 1. Business Problem

Aset tetap terlihat sederhana sampai laporan pajak disusun.

Tiga masalah muncul berulang. **Hanya ada satu jadwal penyusutan**, padahal penyusutan komersial dan penyusutan fiskal mengikuti aturan berbeda — sehingga setiap tahun akuntan menghitung ulang seluruh aset di spreadsheet, dan hasilnya tidak pernah cocok dengan sistem. **Aset dicatat sebagai beban** karena tidak ada yang tahu ambang kapitalisasinya, sehingga laba tahun berjalan tertekan dan neraca tidak mencerminkan apa yang dimiliki perusahaan. **Register aset tidak pernah dicocokkan dengan barang fisik**, sehingga mesin yang sudah dijual tiga tahun lalu masih disusutkan.

Untuk perusahaan yang sedang tumbuh dan membeli mesin, kendaraan, atau perangkat produksi, ketiganya berarti angka pajak yang salah dan koreksi yang mahal.

---

## 2. Goals

- **Satu aset, beberapa buku penyusutan.** Komersial dan fiskal berdampingan tanpa duplikasi data aset.
- Jadwal penyusutan **dibangkitkan dan disimpan**, bukan dihitung ulang saat dibaca — sehingga periode lalu tidak berubah bila metode diubah.
- Aset lahir dari transaksi pembelian, bukan diinput ulang.
- Ambang kapitalisasi ditegakkan sistem, bukan diingat orang.
- Penyusutan memposting ke Akuntansi lewat penentuan akun.
- Register aset dapat dicocokkan dengan barang fisik.

---

## 3. User Stories

- Sebagai akuntan, saya ingin penyusutan komersial dan fiskal dihitung sistem, bukan di spreadsheet terpisah.
- Sebagai akuntan, saya ingin aset otomatis terbentuk saat saya memposting tagihan pembelian mesin.
- Sebagai akuntan, saya ingin diberi tahu bila ada pembelian di atas ambang yang dicatat sebagai beban.
- Sebagai akuntan, saya ingin menjalankan penyusutan bulanan dan meninjau hasilnya sebelum posting.
- Sebagai kepala operasional, saya ingin tahu aset mana ada di lokasi mana dan siapa penanggung jawabnya.
- Sebagai akuntan, saya ingin menjual mesin dan sistem menghitung laba atau rugi pelepasannya.
- Sebagai kontraktor, saya ingin mengumpulkan biaya pembangunan dan mengapitalisasinya saat selesai.
- Sebagai auditor, saya ingin menelusuri dari saldo akun aset ke daftar aset satu per satu.

---

## 4. Functional Requirements

**Register aset.** Kode, nama, kategori, tanggal perolehan, tanggal mulai digunakan, nilai perolehan, lokasi, penanggung jawab, nomor tag, dan status.

**Perolehan.** Tiga jalur: dari tagihan pembelian, dari aset dalam penyelesaian yang dikapitalisasi, atau input manual untuk aset warisan saat migrasi. Jalur pertama adalah yang utama — aset **tidak diinput ulang**.

**Kapitalisasi.** Ambang nilai per company. Pembelian di atas ambang yang tidak ditandai sebagai aset **memicu peringatan**, bukan diblokir — karena penentuannya kadang memang memerlukan pertimbangan.

**Buku penyusutan.** Minimal dua: komersial dan fiskal. Setiap buku punya metode, masa manfaat, nilai residu, dan konvensi periode awalnya sendiri. Buku tambahan dapat ditambahkan bila diperlukan.

**Metode penyusutan.** Garis lurus, saldo menurun, dan unit produksi. Metode adalah konfigurasi per kategori aset per buku.

**Jadwal penyusutan.** Dibangkitkan penuh saat aset mulai digunakan, disimpan per periode per buku. Perubahan estimasi membangkitkan ulang jadwal **ke depan saja** — periode yang sudah diposting tidak berubah.

**Siklus penyusutan.** Bulanan: hitung → tinjau → posting. Menghasilkan jurnal per buku; hanya buku komersial yang memposting ke GL, buku fiskal disimpan untuk pelaporan pajak dan perhitungan perbedaan temporer.

**Komponen aset.** Satu aset dapat memiliki komponen dengan masa manfaat berbeda — mesin dan modul kontrolnya, gedung dan liftnya.

**Revaluasi dan penurunan nilai.** Menyesuaikan nilai tercatat, membangkitkan ulang jadwal sisa, dan memposting jurnal yang sesuai.

**Pemindahan.** Antar lokasi, antar penanggung jawab, dan antar company dalam satu tenant.

**Pelepasan.** Penjualan, penghapusan, atau donasi. Menghitung laba atau rugi dari nilai tercatat, dan menghentikan penyusutan sejak tanggal pelepasan.

**Aset dalam penyelesaian.** Mengumpulkan biaya sampai siap digunakan, lalu dikapitalisasi menjadi satu atau beberapa aset.

**Inventarisasi fisik.** Pemindaian tag, pencocokan terhadap register, dan penanganan selisih — pola yang sama dengan stok opname di Modul 05.

---

## 5. Non Functional Requirements

- **Penyusutan dapat direproduksi.** Menghitung ulang periode lalu menghasilkan angka yang sama persis, karena jadwal tersimpan.
- Siklus penyusutan 10.000 aset dengan dua buku selesai di bawah 60 detik.
- Posting bersifat atomik dan idempoten; siklus yang diulang tidak menghasilkan jurnal ganda.
- Saldo akun aset dan akumulasi penyusutan di GL **wajib selalu sama** dengan jumlah register aset — diuji sebagai invarian.
- Perubahan estimasi tidak pernah mengubah periode yang sudah diposting.
- Jadwal penyusutan seumur aset tersimpan, sehingga proyeksi beban tahun depan dapat dibaca langsung.

---

## 6. Database Design

**Table: `asset_categories`** — `company_id`, `code`, `name`, `parent_id`, `capitalization_threshold`, `gl_account_asset_id`, `gl_account_accum_dep_id`, `gl_account_dep_expense_id`, `gl_account_disposal_id`

**Table: `assets`**

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| tenant_id, company_id | UUID | |
| code, name | varchar | |
| category_id | UUID (FK) | |
| acquisition_date, in_service_date | date | penyusutan mulai dari `in_service_date` |
| acquisition_cost | numeric(18,2) | |
| source_type, source_id | | tagihan atau aset dalam penyelesaian |
| location_id, custodian_id | UUID | |
| tag_number, serial_number | varchar | |
| parent_asset_id | UUID, nullable | untuk komponen |
| status | enum | draft, in_service, idle, under_repair, disposed, written_off |
| disposal_date, disposal_value, disposal_gain_loss | | |
| + audit baku | | |

**Table: `depreciation_books`** — `company_id`, `code` (commercial, fiscal), `name`, `posts_to_gl` (boolean), `is_primary`

Hanya buku dengan `posts_to_gl = true` yang menghasilkan jurnal. Buku fiskal disimpan untuk pelaporan.

**Table: `asset_books`** — satu baris per aset per buku

`asset_id` · `book_id` · `method` (straight_line, declining_balance, units_of_production) · `useful_life_months` · `salvage_value` · `depreciation_rate` · `convention` (full_month, half_month, actual_days) · `start_period` · `status`

Inilah yang membuat satu aset punya beberapa jadwal tanpa data aset diduplikasi.

**Table: `depreciation_schedules`** — dibangkitkan penuh saat aset mulai digunakan

`asset_book_id` · `period` · `opening_nbv` · `depreciation_amount` · `accumulated_depreciation` · `closing_nbv` · `status` (projected, posted) · `run_id`

Jadwal tersimpan, bukan dihitung saat dibaca. Perubahan estimasi membangkitkan ulang baris berstatus `projected` saja.

**Table: `depreciation_runs`** — `company_id`, `book_id`, `period`, `status` (draft, calculated, posted), `asset_count`, `total_amount`, `journal_id`

**Table: `asset_transactions`** — append-only, seluruh peristiwa aset

`asset_id` · `type` (acquisition, depreciation, revaluation, impairment, transfer, disposal, adjustment) · `date` · `amount` · `book_id` (nullable) · `journal_id` · `reason` · `created_by`

**Table: `construction_in_progress`** dan **`cip_costs`** — mengumpulkan biaya sebelum kapitalisasi.

**Table: `asset_counts`** dan **`asset_count_lines`** — inventarisasi fisik, struktur sejajar dengan stok opname.

---

## 7. API Design

```
GET    /v1/companies/{id}/assets?category=&location=&status=
POST   /v1/companies/{id}/assets
POST   /v1/bills/{id}/capitalize                -> membuat aset dari tagihan
POST   /v1/assets/{id}/place-in-service         -> membangkitkan jadwal seluruh buku

GET    /v1/assets/{id}/books
PATCH  /v1/asset-books/{id}                     -> perubahan estimasi, ke depan saja
GET    /v1/asset-books/{id}/schedule            -> jadwal penuh seumur aset

POST   /v1/companies/{id}/depreciation-runs     -> per buku per periode
POST   /v1/depreciation-runs/{id}/calculate
GET    /v1/depreciation-runs/{id}/review
POST   /v1/depreciation-runs/{id}/post

POST   /v1/assets/{id}/revalue                  -> alasan wajib
POST   /v1/assets/{id}/impair
POST   /v1/assets/{id}/transfer
POST   /v1/assets/{id}/dispose                  -> body: type, proceeds, date

POST   /v1/companies/{id}/cip
POST   /v1/cip/{id}/capitalize                  -> menjadi satu atau beberapa aset

POST   /v1/companies/{id}/asset-counts
GET    /v1/companies/{id}/reports/asset-register?as_of=
GET    /v1/companies/{id}/reports/book-difference?period=  -> selisih komersial vs fiskal
```

### Kontrak yang mengikat

**`/place-in-service` membangkitkan jadwal untuk seluruh buku sekaligus.** Aset tidak dapat mulai disusutkan di satu buku saja — itu sumber selisih yang tidak dapat dijelaskan.

**`PATCH /asset-books/{id}` hanya memengaruhi periode yang belum diposting.** Perubahan masa manfaat membangkitkan ulang sisa jadwal dengan nilai tercatat saat ini sebagai dasar. Periode lalu tidak pernah dihitung ulang.

**Hanya buku primer memposting ke GL.** Buku fiskal menghasilkan jadwal dan angka pelaporan, tanpa jurnal — sehingga tidak ada risiko penyusutan terbukukan dua kali.

**`/reports/book-difference` menghasilkan selisih per aset per periode**, yang menjadi dasar perhitungan perbedaan temporer di modul Pajak.

---

## 8. UI Flow

**Register aset** — data table dengan filter kategori, lokasi, dan status. Kolom nilai tercatat per buku dapat dipilih.

**Detail aset** — tab: Ringkasan · Buku Penyusutan · Jadwal · Riwayat · Lampiran. Tab Jadwal menampilkan **kedua buku berdampingan** dengan selisihnya, karena itulah pertanyaan yang paling sering diajukan.

**Kapitalisasi dari tagihan** — saat memposting tagihan berisi baris di atas ambang, muncul saran untuk mengapitalisasi, dengan pilihan membuat satu aset atau memecah per unit.

**Siklus penyusutan** — pilih buku dan periode → hitung → **layar peninjauan dengan perbandingan terhadap periode lalu**, aset dengan perubahan tidak wajar ditandai → posting. Pola yang sama dengan siklus penggajian di Modul 10.

**Pelepasan** — form dengan perhitungan laba atau rugi yang terlihat sebelum dikonfirmasi.

**Inventarisasi fisik** — mode ponsel dengan pemindaian tag, dan layar selisih sebelum posting.

---

## 9. Business Flow

Tagihan pembelian mesin diposting → baris di atas ambang memicu saran kapitalisasi → aset dibuat, terhubung ke tagihan sumbernya → tanggal mulai digunakan ditetapkan → **jadwal penyusutan dibangkitkan untuk kedua buku**.

Setiap bulan: siklus penyusutan dijalankan per buku → hasil ditinjau → diposting. Buku komersial menghasilkan jurnal beban penyusutan dan akumulasi penyusutan; buku fiskal hanya menandai jadwalnya terposting.

Akhir tahun: laporan selisih antar buku dihasilkan → menjadi dasar perbedaan temporer di modul Pajak.

Bila mesin dijual: pelepasan dicatat → penyusutan berhenti sejak tanggal itu → nilai tercatat dikeluarkan dari neraca → selisih terhadap hasil penjualan menjadi laba atau rugi pelepasan.

Bila estimasi berubah: masa manfaat disesuaikan → sisa jadwal dibangkitkan ulang dari nilai tercatat saat ini → periode yang sudah diposting tidak tersentuh.

---

## 10. Permission Matrix

| Aksi | Tenant Owner | Company Admin | Akuntan | Finance | Operasional |
|---|---|---|---|---|---|
| Lihat register aset | ✅ | ✅ | ✅ | ✅ | ✅ (lokasi sendiri) |
| Buat dan ubah aset | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ubah kategori dan ambang kapitalisasi | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ubah buku dan metode penyusutan | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ubah estimasi masa manfaat | ✅ | ✅ | ✅ | ❌ | ❌ |
| Jalankan perhitungan penyusutan | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Posting penyusutan** | ✅ | ✅ | ❌ | ✅ | ❌ |
| Revaluasi dan penurunan nilai | ✅ | ✅ | ❌ | ❌ | ❌ |
| Pemindahan lokasi | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Pelepasan aset** | ✅ | ✅ | ❌ | ✅ | ❌ |
| Inventarisasi fisik | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Posting selisih inventarisasi** | ✅ | ✅ | ❌ | ✅ | ❌ |

**Yang menghitung bukan yang memposting**, dan **yang menghitung fisik bukan yang memposting selisihnya** — pola yang sama dengan Persediaan dan Penggajian.

**Revaluasi dan penurunan nilai dibatasi ketat.** Keduanya mengubah nilai aset tanpa transaksi ekonomi, dan karena itu jalur paling mudah untuk memanipulasi laporan keuangan.

---

## 11. Validation Rules

- Aset tidak dapat mulai disusutkan sebelum tanggal mulai digunakan.
- Tanggal mulai digunakan tidak boleh mendahului tanggal perolehan.
- Aset tidak dapat dihapus; hanya dilepaskan atau dihapusbukukan, dengan jejak yang utuh.
- Nilai tercatat tidak boleh menjadi negatif; penyusutan berhenti di nilai residu.
- Penyusutan tidak dapat diposting ke periode fiskal yang sudah ditutup.
- Satu periode hanya boleh punya satu siklus penyusutan terposting per buku.
- Aset yang sudah dilepaskan tidak dapat disusutkan, dipindahkan, maupun direvaluasi.
- Perubahan metode penyusutan hanya berlaku ke depan dan memerlukan alasan.
- Kapitalisasi aset dalam penyelesaian memerlukan seluruh biaya di dalamnya sudah diposting.
- Aset komponen tidak dapat dilepaskan terpisah dari induknya tanpa pemisahan eksplisit.

### Yang wajib ditetapkan profesional

**Kelompok aset dan tarif penyusutan fiskal** beserta metode yang diizinkan · **ambang kapitalisasi** yang diakui · **perlakuan revaluasi** dalam laporan keuangan dan implikasi pajaknya · **perhitungan pajak tangguhan** dari perbedaan temporer · **perlakuan laba rugi pelepasan** untuk keperluan pajak.

---

## 12. Testing Strategy

**Unit.** Perhitungan garis lurus, saldo menurun, dan unit produksi termasuk periode awal dan akhir yang tidak penuh · konvensi periode (bulan penuh, setengah bulan, hari aktual) · perhitungan laba rugi pelepasan.

**Reproduksibilitas.** Metode diubah, jadwal dibangkitkan ulang: baris yang sudah diposting tidak berubah sama sekali.

**Invarian — yang terpenting di modul ini.** Saldo akun aset di GL sama dengan jumlah nilai perolehan aset aktif · saldo akumulasi penyusutan sama dengan jumlah akumulasi di register · nilai tercatat per aset sama dengan perolehan dikurangi akumulasi · jumlah jadwal seumur aset sama dengan nilai perolehan dikurangi nilai residu.

**Dua buku.** Aset yang sama menghasilkan dua jadwal berbeda dari satu nilai perolehan · hanya buku primer menghasilkan jurnal · laporan selisih sama dengan selisih kedua jadwal.

**Negatif.** Penyusutan aset yang sudah dilepas ditolak · dua siklus terposting di periode yang sama ditolak · nilai tercatat melewati nilai residu ditolak · akuntan memposting penyusutan yang ia hitung sendiri ditolak.

**E2E.** Tagihan pembelian sampai aset tersusutkan tiga periode · perubahan estimasi di tengah umur aset · pelepasan dengan laba · inventarisasi fisik dengan selisih.

---

## 13. Future Enhancements

- **Sewa dan hak guna** sesuai standar akuntansi sewa, yang mengubah banyak sewa menjadi aset di neraca.
- **Perawatan dan jadwal servis**, terhubung ke Manufaktur untuk mesin produksi.
- **Pelacakan lokasi otomatis** lewat tag RFID atau QR untuk perusahaan dengan ribuan aset.
- **Analisis biaya kepemilikan** — perolehan, perawatan, dan operasional per aset sepanjang umurnya.
- **Perencanaan belanja modal** dengan proyeksi penggantian aset.
- **Buku tambahan** untuk pelaporan grup dengan standar berbeda.
- **Penurunan nilai berbasis indikator** yang menandai aset yang perlu diuji.
- **Integrasi dengan Manufaktur** untuk penyusutan berbasis jam mesin aktual.
