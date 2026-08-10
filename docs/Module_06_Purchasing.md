# Module Design: Purchasing
*Phase 2 — Core Business. Melengkapi sisi masuk Persediaan dan menutup lingkaran harga pokok.*

**Cakupan:** Vendor · Permintaan Penawaran · Pesanan Pembelian · Penerimaan Barang · Tagihan · Pembayaran ke Vendor · Retur Pembelian · Nota Debit · Landed Cost.
**Dependency:** Modul 01, 02, 03, 05 (Persediaan).
**Berpasangan dengan:** Akuntansi (utang usaha dan akun perantara), Pajak (PPN Masukan dan PPh yang dipotong).

---

## 1. Business Problem

Pembelian adalah tempat uang keluar, dan tanpa kontrol yang benar ia adalah tempat kebocoran paling sunyi.

Tiga masalah muncul berulang. **Tagihan dibayar tanpa dicocokkan** dengan apa yang dipesan dan apa yang benar-benar datang, sehingga perusahaan membayar barang yang tidak pernah diterima atau membayar dengan harga yang bukan harga sepakat. **Barang yang sudah datang tetapi belum ditagih tidak tercatat sebagai kewajiban**, sehingga neraca terlihat lebih sehat dari kenyataannya sampai tagihan menumpuk di akhir bulan. **Ongkos angkut dan bea tidak masuk ke harga pokok**, sehingga margin yang dilaporkan lebih tinggi dari yang sebenarnya — dan keputusan harga jual diambil dari angka yang salah.

---

## 2. Goals

- **Pencocokan tiga arah** antara pesanan, penerimaan, dan tagihan sebagai kontrol wajib, dengan toleransi yang dapat dikonfigurasi.
- Selisih waktu antara barang datang dan tagihan masuk ditampung **akun perantara**, sehingga neraca benar setiap saat.
- Landed cost masuk ke harga pokok, bukan menjadi beban terpisah.
- Faktur Pajak Masukan dikelola sebagai dokumen tersendiri, sejajar dengan Faktur Pajak Keluaran di Penjualan.
- PPh yang dipotong saat membayar vendor dihitung dan diserahkan ke modul Pajak untuk bukti potong.
- Rencana pembayaran terlihat, sehingga kas dapat direncanakan.

---

## 3. User Stories

- Sebagai pemilik, saya ingin tidak pernah membayar tagihan untuk barang yang belum datang.
- Sebagai kepala gudang, saya ingin menerima barang sebagian dan tahu sisanya masih ditunggu.
- Sebagai akuntan, saya ingin barang yang sudah diterima tercatat sebagai kewajiban meski tagihannya belum datang.
- Sebagai akuntan, saya ingin ongkos angkut impor terbagi ke harga pokok setiap barang, bukan menjadi beban sendiri.
- Sebagai akuntan pajak, saya ingin tahu Faktur Pajak Masukan mana yang sudah lengkap dan dapat dikreditkan.
- Sebagai finance, saya ingin melihat tagihan yang jatuh tempo minggu depan sebelum memutuskan pembayaran.
- Sebagai purchasing, saya ingin membandingkan penawaran beberapa vendor untuk permintaan yang sama.

---

## 4. Functional Requirements

**Vendor.** Data induk dengan NPWP, status PKP, termin pembayaran, rekening bank, kategori PPh yang berlaku, dan penilaian kinerja.

**Permintaan penawaran.** Satu permintaan dikirim ke beberapa vendor, jawaban dibandingkan berdampingan per baris, dan yang terpilih dikonversi menjadi pesanan.

**Pesanan pembelian.** Alur persetujuan berbasis ambang nilai. Melacak kuantitas yang sudah diterima dan sudah ditagih **per baris**. Mendukung pesanan payung dengan pelepasan bertahap.

**Penerimaan barang.** Boleh sebagian. Menghasilkan mutasi stok dan **jurnal persediaan lawan akun perantara**. Mencatat batch, nomor seri, dan penolakan QC.

**Tagihan.** Dibuat dari penerimaan atau berdiri sendiri. **Pencocokan tiga arah dijalankan sebelum posting.** Menyimpan referensi Faktur Pajak Masukan dan penanda PPh yang dipotong.

**Pembayaran ke vendor.** Satu pembayaran dapat melunasi beberapa tagihan. Mendukung uang muka, pemotongan PPh, dan biaya bank.

**Retur pembelian dan nota debit.** Barang dikembalikan, nilai dikoreksi tanpa mengubah tagihan asal.

**Landed cost.** Ongkos angkut, bea masuk, asuransi, dan biaya bongkar dialokasikan ke penerimaan berdasarkan nilai, berat, atau volume. **Menyesuaikan lapisan biaya yang sudah terbentuk di Persediaan.**

**Rencana pembayaran.** Daftar tagihan jatuh tempo per periode, dengan proyeksi kebutuhan kas.

---

## 5. Non Functional Requirements

- Pencocokan tiga arah dijalankan di layanan, bukan di antarmuka. Tagihan yang tidak cocok **tidak dapat diposting** lewat jalur mana pun, termasuk API langsung.
- Posting penerimaan bersifat atomik: mutasi stok, lapisan biaya, dan jurnal berhasil bersama atau gagal bersama.
- Alokasi landed cost menyesuaikan lapisan biaya secara retroaktif tanpa mengubah baris mutasi yang sudah ada — koreksi dilakukan lewat mutasi nilai tersendiri.
- Idempoten pada posting tagihan dan pembayaran.
- Rekonsiliasi akun perantara dapat dijalankan kapan saja dan menampilkan sisa per pesanan.

---

## 6. Database Design

**Table: `vendors`** — `company_id`, `code`, `name`, `legal_name`, `tax_id`, `is_pkp` (boolean), `payment_term_days`, `withholding_category`, `bank_account`, `status`, + audit baku.

`is_pkp` menentukan apakah vendor dapat menerbitkan Faktur Pajak, dan karenanya apakah PPN-nya dapat dikreditkan.

**Table: `purchase_documents`** — tabel tunggal untuk permintaan penawaran, pesanan, dan tagihan

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| tenant_id, company_id | UUID | |
| doc_type | enum | rfq, purchase_order, bill, debit_note |
| number | varchar, nullable | diberikan saat submit |
| vendor_id | UUID (FK) | |
| issue_date, due_date, expected_date | date | |
| currency, exchange_rate | | kurs dikunci saat submit |
| lifecycle_status | enum | sama dengan Penjualan |
| settlement_status | enum | unpaid, partially_paid, paid, overpaid |
| fulfillment_status | enum | not_fulfilled, partially_fulfilled, fulfilled, returned |
| subtotal, discount, dpp, tax_total, withholding_total, total | numeric(18,2) | |
| match_status | enum | **not_matched, matched, exception, overridden** |
| source_document_id | UUID, nullable | |
| document_version | int | |

`match_status` hanya berlaku untuk `bill`. Status `overridden` menyimpan siapa yang menyetujui pengecualian dan alasannya.

**Table: `purchase_document_lines`** — `document_id`, `line_no`, `item_id`, `qty`, `uom`, `unit_price`, `discount`, `net_amount`, `tax_code_id`, `qty_received`, `qty_billed`, `qty_returned`, `warehouse_id`, `expected_date`

**Table: `goods_receipts`** — `company_id`, `number`, `purchase_order_id`, `vendor_id`, `received_date`, `warehouse_id`, `status`, `received_by`
**Table: `goods_receipt_lines`** — `receipt_id`, `po_line_id`, `item_id`, `qty_received`, `qty_rejected`, `rejection_reason`, `batch_id`, `serial_ids`

**Table: `input_tax_invoices`** — Faktur Pajak Masukan, dokumen tersendiri

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| company_id, vendor_id | UUID | |
| serial_number | varchar | nomor dari vendor |
| issue_date | date | |
| dpp, tax_amount | numeric | |
| status | enum | received, validated, creditable, non_creditable, rejected |
| credit_period | varchar | periode masa pajak pengkreditan |
| bill_id | UUID, nullable | |

Dipisahkan karena tanggal, nilai, dan periode pengkreditannya dapat berbeda dari tagihan komersialnya — dan validitasnya ditentukan pihak ketiga, bukan oleh sistem ini.

**Table: `landed_costs`** — `company_id`, `number`, `cost_type`, `amount`, `allocation_basis` (value, weight, volume, qty), `status`
**Table: `landed_cost_allocations`** — `landed_cost_id`, `goods_receipt_line_id`, `allocated_amount`, `cost_adjustment_movement_id`

**Table: `vendor_payments`** dan **`vendor_payment_allocations`** — struktur sejajar dengan penerimaan pembayaran di Penjualan, ditambah `withholding_amount` dan `withholding_certificate_id`.

**Table: `match_tolerances`** — `company_id`, `qty_over_receipt_pct`, `price_variance_pct`, `price_variance_amount`, `require_approval_above`

---

## 7. API Design

```
GET    /v1/companies/{id}/vendors
POST   /v1/companies/{id}/rfqs
POST   /v1/rfqs/{id}/send                     -> ke beberapa vendor
GET    /v1/rfqs/{id}/comparison               -> perbandingan per baris
POST   /v1/rfqs/{id}/award                    -> konversi ke pesanan

POST   /v1/companies/{id}/purchase-orders
POST   /v1/purchase-orders/{id}/approve
POST   /v1/purchase-orders/{id}/close         -> menutup sisa yang tidak akan datang

POST   /v1/companies/{id}/goods-receipts      -> body: lines[{po_line_id, qty, batch, serials}]
POST   /v1/goods-receipts/{id}/post           -> atomik: stok + lapisan biaya + jurnal

POST   /v1/companies/{id}/bills
GET    /v1/bills/{id}/match                   -> hasil pencocokan tiga arah, per baris
POST   /v1/bills/{id}/post                    -> ditolak bila match_status = exception
POST   /v1/bills/{id}/override-match          -> alasan wajib, memerlukan izin khusus

POST   /v1/companies/{id}/input-tax-invoices
POST   /v1/input-tax-invoices/{id}/validate

POST   /v1/companies/{id}/landed-costs
POST   /v1/landed-costs/{id}/allocate         -> menyesuaikan lapisan biaya

POST   /v1/companies/{id}/vendor-payments
GET    /v1/companies/{id}/reports/ap-aging?as_of=
GET    /v1/companies/{id}/reports/gr-ir       -> rekonsiliasi akun perantara
GET    /v1/companies/{id}/reports/payment-plan?from=&to=
```

### Kontrak yang mengikat

**`/bills/{id}/post` menolak bila `match_status = exception`.** Tidak ada parameter yang dapat melewatinya. Satu-satunya jalan adalah `/override-match`, yang memerlukan izin tersendiri, alasan wajib, dan tercatat di audit log sebagai peristiwa terpisah. Ini bukan kerepotan — inilah kontrolnya.

**`/goods-receipts/{id}/post` menulis ke akun perantara, bukan ke utang usaha.** Utang usaha baru terbentuk saat tagihan diposting, yang sekaligus mengosongkan akun perantara sebesar nilai yang cocok.

**`/landed-costs/{id}/allocate` tidak mengubah mutasi stok yang sudah ada.** Ia menghasilkan mutasi nilai tersendiri yang menyesuaikan lapisan biaya, sehingga jejaknya utuh.

---

## 8. UI Flow

**Perbandingan penawaran** — tabel per baris dengan kolom per vendor, selisih harga terhadap penawaran terendah ditandai, dan pemilihan boleh berbeda vendor per baris.

**Penerimaan barang** — mode ponsel dengan pemindaian barcode, kuantitas terima per baris dengan sisa terlihat, dan pencatatan penolakan QC beserta alasannya.

**Tagihan** — panel pencocokan menampilkan tiga kolom berdampingan per baris: dipesan, diterima, ditagih. Baris yang tidak cocok ditandai dengan selisihnya, bukan hanya bendera merah.

**Faktur Pajak Masukan** — layar tersendiri, bukan tab di tagihan. Menampilkan mana yang belum lengkap dan mana yang belum dapat dikreditkan, karena keduanya berbeda.

**Rencana pembayaran** — tagihan jatuh tempo dikelompokkan per minggu, dengan total dan proyeksi kas. Memilih tagihan menghasilkan draf pembayaran.

**Rekonsiliasi akun perantara** — daftar pesanan dengan barang diterima tetapi belum ditagih, diurutkan dari yang terlama. Ini laporan yang jarang dibuat dan hampir selalu mengejutkan saat pertama dilihat.

---

## 9. Business Flow

Permintaan penawaran dikirim → jawaban dibandingkan → pesanan dibuat dan disetujui → barang datang, diterima sebagian atau penuh → **posting penerimaan: stok bertambah, lapisan biaya terbentuk, jurnal persediaan lawan akun perantara** → tagihan vendor masuk → pencocokan tiga arah dijalankan → bila cocok, tagihan diposting: akun perantara dikosongkan, utang usaha terbentuk → Faktur Pajak Masukan dicatat dan divalidasi → pembayaran dijadwalkan → dibayar dengan PPh dipotong bila berlaku → bukti potong diserahkan ke modul Pajak.

Bila tagihan tidak cocok: statusnya `exception`, tidak dapat diposting, dan muncul di daftar kerja untuk diselesaikan — dengan koreksi penerimaan, koreksi pesanan, permintaan nota kredit ke vendor, atau pengecualian yang disetujui.

Bila ongkos angkut datang belakangan: landed cost dialokasikan, lapisan biaya disesuaikan, dan harga pokok penjualan berikutnya memakai angka yang benar.

---

## 10. Permission Matrix

| Aksi | Tenant Owner | Tenant Admin | Company Admin | Purchasing | Gudang | Finance |
|---|---|---|---|---|---|---|
| Kelola vendor | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Buat pesanan pembelian | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Setujui pesanan pembelian | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Terima barang | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Buat tagihan | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Posting tagihan** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Override pencocokan** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Bayar vendor | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Ubah toleransi pencocokan | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Alokasi landed cost | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |

**Tiga peran berbeda untuk tiga dokumen.** Yang memesan bukan yang menerima, dan yang menerima bukan yang membayar. Ini pemisahan tugas klasik pada siklus pembelian, dan tanpanya pencocokan tiga arah kehilangan sebagian besar nilainya — karena satu orang dapat memalsukan ketiganya.

**Override pencocokan sengaja tidak diberikan ke Finance.** Yang memposting tagihan tidak boleh sekaligus yang memaafkan ketidakcocokannya.

---

## 11. Validation Rules

- Kuantitas terima tidak boleh melebihi kuantitas pesan di luar toleransi over-receipt.
- Kuantitas tagih tidak boleh melebihi kuantitas terima. **Tanpa toleransi** — menagih barang yang belum datang tidak punya pembenaran operasional.
- Selisih harga di luar toleransi menghasilkan `exception`, bukan penolakan langsung, agar dapat diselesaikan.
- Vendor non-PKP tidak dapat memiliki Faktur Pajak Masukan; PPN pada tagihannya tidak dapat dikreditkan.
- Faktur Pajak Masukan dengan NPWP yang tidak cocok ditolak validasinya.
- Landed cost tidak dapat dialokasikan ke penerimaan di periode fiskal yang sudah ditutup.
- Pembayaran tidak boleh melebihi sisa tagihan; kelebihan menjadi uang muka vendor.
- Pesanan tidak dapat ditutup bila masih ada barang dalam perjalanan yang tercatat.

### Yang wajib divalidasi profesional

**Aturan dan batas waktu pengkreditan PPN Masukan** · **kategori dan tarif PPh yang dipotong per jenis jasa** · **perlakuan bea masuk dan PPN impor dalam harga pokok** · **syarat formal Faktur Pajak agar dapat dikreditkan**. Keempatnya menentukan angka yang dilaporkan ke otoritas pajak dan harus ditetapkan konsultan pajak.

---

## 12. Testing Strategy

**Unit.** Logika pencocokan tiga arah untuk seluruh kombinasi selisih kuantitas dan harga · alokasi landed cost berdasarkan nilai, berat, dan volume · perhitungan PPh yang dipotong per kategori.

**Integration.** Posting penerimaan menulis ke akun perantara, bukan utang usaha · posting tagihan mengosongkan akun perantara sebesar nilai yang cocok · alokasi landed cost mengubah harga pokok penjualan berikutnya · penerimaan sebagian memperbarui `qty_received` per baris dengan benar.

**Kontrol.** Tagihan `exception` tidak dapat diposting lewat API langsung · override memerlukan izin dan tercatat sebagai peristiwa audit terpisah · pengguna yang memposting tagihan tidak dapat melakukan override.

**Rekonsiliasi.** Setelah rangkaian transaksi acak, saldo akun perantara sama dengan jumlah nilai barang diterima yang belum ditagih.

**E2E.** Permintaan penawaran sampai pembayaran penuh · penerimaan bertahap dengan tagihan bertahap · tagihan tidak cocok yang diselesaikan lewat nota kredit vendor · impor dengan landed cost yang mengubah margin.

---

## 13. Future Enhancements

- **Portal vendor** — vendor mengunggah tagihan sendiri dan melihat status pembayarannya.
- **OCR tagihan** yang mengisi draf otomatis dan mencocokkannya ke pesanan, masuk jalur AI di Fase 4.
- **Kontrak dan harga sepakat** dengan komitmen volume dan rabat akhir periode.
- **Penilaian kinerja vendor** dari ketepatan waktu, tingkat penolakan QC, dan selisih harga.
- **Persetujuan pembelian berbasis anggaran** — pesanan diblokir bila anggaran departemen habis.
- **Pembayaran massal** terhubung ke bank lewat host-to-host.
- **Validasi Faktur Pajak Masukan otomatis** ke sistem otoritas pajak.
- **Konsinyasi masuk** — stok vendor di gudang kita, diakui saat terjual.
