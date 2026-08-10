# Module Design: Inventory
*Phase 2 — Core Business. Dibangun bersama Penjualan, karena Penjualan bergantung padanya untuk reservasi, pengiriman, dan harga pokok.*

**Cakupan:** Item · Satuan · Gudang · Mutasi Stok · Reservasi · Transfer · Penyesuaian · Stok Opname · Batch · Nomor Seri · Penilaian Persediaan · Landed Cost.
**Dependency:** Modul 01, 02, 03.
**Berpasangan dengan:** Penjualan (pengiriman), Pembelian (penerimaan), Akuntansi (jurnal persediaan dan HPP), Manufaktur (konsumsi bahan).

---

## 1. Business Problem

Stok adalah tempat di mana angka di sistem dan barang di rak paling sering berbeda — dan setiap selisih adalah uang yang tidak dapat dijelaskan.

Tiga kesalahan model menyebabkan sebagian besar masalah. **Jumlah stok disimpan sebagai kolom yang di-*update***, sehingga saat angkanya salah tidak ada cara mengetahui kapan dan mengapa. **Barang yang sudah dipesan pelanggan dianggap masih tersedia**, sehingga dua sales menjual barang yang sama. **Harga pokok diambil dari harga beli terakhir**, sehingga margin yang dilaporkan salah dan laporan laba rugi tidak dapat dipertanggungjawabkan.

Untuk perusahaan dagang, ketiganya baru terasa saat stok opname pertama — dan pada titik itu selisihnya sudah berbulan-bulan.

---

## 2. Goals

- Stok adalah **buku besar, bukan angka**. Setiap perubahan adalah baris mutasi yang tidak dapat diubah.
- Membedakan empat kuantitas dengan tegas: fisik, dipesan, dalam perjalanan, dan tersedia.
- Harga pokok dihitung dengan metode yang konsisten dan dapat ditelusuri per lapisan biaya.
- Batch dan nomor seri dilacak penuh untuk barang yang membutuhkannya, tanpa membebani barang yang tidak.
- Transfer antar gudang aman terhadap barang yang hilang di jalan.
- Stok opname dapat dijalankan tanpa menghentikan operasional.

---

## 3. User Stories

- Sebagai kepala gudang, saya ingin tahu berapa yang benar-benar bisa dijual, bukan berapa yang ada di rak.
- Sebagai sales, saya ingin diperingatkan bila barang yang saya janjikan sudah dipesan orang lain.
- Sebagai akuntan, saya ingin harga pokok penjualan dihitung dari lapisan biaya yang benar, bukan dari harga beli terakhir.
- Sebagai kepala gudang, saya ingin mengirim barang ke cabang dan tahu statusnya sampai diterima.
- Sebagai QC, saya ingin menelusuri batch mana yang terjual ke pelanggan mana bila ada penarikan produk.
- Sebagai pemilik, saya ingin tahu barang mana yang tidak bergerak enam bulan terakhir.
- Sebagai staf gudang, saya ingin menghitung stok fisik lewat ponsel tanpa menghentikan penjualan.

---

## 4. Functional Requirements

**Item.** Data induk dengan tipe (stok, jasa, non-stok), kategori, satuan dasar dan konversinya, pelacakan batch atau serial, titik pemesanan ulang, dan barcode.

**Satuan.** Satuan dasar per item plus faktor konversi — beli per karung, jual per kilogram. **Seluruh mutasi disimpan dalam satuan dasar**; konversi hanya di lapis tampilan dan input.

**Gudang.** Bertingkat: gudang → zona → rak. Gudang dapat ditandai sebagai virtual (transit, konsinyasi, barang rusak).

**Mutasi stok.** Append-only. Jenis: penerimaan, pengiriman, transfer keluar, transfer masuk, penyesuaian, retur masuk, retur keluar, konsumsi produksi, hasil produksi.

**Reservasi.** Pesanan penjualan yang dikonfirmasi mereservasi stok. Reservasi berkurang saat pengiriman dan lepas saat pesanan dibatalkan atau kedaluwarsa.

**Transfer.** **Dua langkah**: keluar dari gudang asal, lalu masuk ke gudang tujuan. Di antaranya barang berstatus dalam perjalanan dan tidak dihitung sebagai tersedia di mana pun.

**Penyesuaian.** Memerlukan alasan dari daftar terkelola dan persetujuan di atas ambang nilai tertentu.

**Stok opname.** Pembekuan snapshot → lembar hitung → input hasil → selisih ditampilkan per baris → posting penyesuaian. Transaksi tetap berjalan selama penghitungan; selisih dihitung terhadap snapshot, bukan terhadap saldo saat posting.

**Batch dan nomor seri.** Diaktifkan per item. Batch membawa tanggal kedaluwarsa. Penelusuran maju dan mundur: dari batch ke pelanggan, dan dari pelanggan ke batch.

**Penilaian.** Metode per company: FIFO atau rata-rata tertimbang. Lapisan biaya disimpan untuk FIFO.

**Landed cost.** Ongkos angkut, bea, dan asuransi dialokasikan ke harga pokok item setelah penerimaan, berdasarkan nilai atau berat.

**Laporan.** Kartu stok per item · nilai persediaan per gudang · umur persediaan · barang tidak bergerak · di bawah titik pemesanan ulang · penelusuran batch.

---

## 5. Non Functional Requirements

- **Saldo stok dihitung dari mutasi, bukan disimpan sebagai kolom yang diubah.** Proyeksi saldo diperbarui dalam transaksi yang sama dengan mutasinya, dan direkonsiliasi berkala terhadap sumbernya. Bila proyeksi dan mutasi berbeda, mutasi yang benar.
- **Kueri ketersediaan di bawah 50ms** — dipanggil di setiap baris pesanan dan setiap pemeriksaan keranjang POS.
- **Reservasi aman terhadap konkurensi.** Dua pesanan bersamaan atas sisa stok terakhir tidak boleh keduanya berhasil.
- **Posting atomik.** Mutasi stok, jurnal persediaan, dan perhitungan harga pokok berhasil bersama atau gagal bersama.
- **Penelusuran batch di bawah 2 detik** untuk 12 bulan data — ini dipakai saat penarikan produk, dan kecepatan berarti keselamatan.
- Stok opname pada 10.000 item tidak mengunci operasional.

---

## 6. Database Design

**Table: `items`** — `id`, `tenant_id`, `company_id`, `code`, `name`, `type` (stock, service, non_stock), `category_id`, `base_uom`, `track_batch` (bool), `track_serial` (bool), `reorder_point`, `reorder_qty`, `barcode`, `status`, + audit baku.

`track_batch` dan `track_serial` **tidak dapat dimatikan setelah ada mutasi**, karena mutasi lama tidak memiliki data yang diperlukan.

**Table: `uom_conversions`** — `item_id`, `uom`, `factor_to_base`. Satu karung = 25 kg disimpan sebagai faktor, bukan sebagai item terpisah.

**Table: `warehouses`** — `company_id`, `code`, `name`, `type` (physical, transit, consignment, damaged), `parent_id`, `address`, `status`.

**Table: `stock_movements`** — inti modul ini, **append-only**

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| tenant_id, company_id | UUID | bagian indeks utama |
| sequence | bigint | urut per company, tanpa celah |
| item_id, warehouse_id | UUID (FK) | |
| batch_id, serial_id | UUID, nullable | |
| movement_type | enum | receipt, shipment, transfer_out, transfer_in, adjustment, return_in, return_out, production_consume, production_output |
| qty_base | numeric(18,4) | positif masuk, negatif keluar. **Selalu satuan dasar** |
| unit_cost, total_cost | numeric(18,4) | nilai pada saat mutasi |
| source_type, source_id | varchar, UUID | dokumen pemicu |
| posted_at | timestamp | |
| created_by | UUID | |

Tanpa `updated_at` dan `deleted_at`. Koreksi dilakukan dengan mutasi lawan, bukan dengan mengubah baris.

**Table: `stock_balances`** — proyeksi, `item_id`, `warehouse_id`, `qty_on_hand`, `qty_reserved`, `qty_in_transit`, `value`, `last_movement_sequence`. Dapat dibangun ulang sepenuhnya dari `stock_movements`.

`qty_available` **tidak disimpan** — ia `qty_on_hand − qty_reserved`.

**Table: `stock_reservations`** — `item_id`, `warehouse_id`, `qty_base`, `source_type`, `source_id`, `expires_at`, `released_at`.

**Table: `cost_layers`** — untuk FIFO: `item_id`, `warehouse_id`, `received_at`, `qty_remaining`, `unit_cost`, `source_movement_id`. Dikonsumsi berurutan saat pengeluaran.

**Table: `batches`** — `item_id`, `batch_no`, `manufactured_at`, `expires_at`, `supplier_batch_no`.
**Table: `serials`** — `item_id`, `serial_no`, `status`, `current_warehouse_id`, `sold_to_customer_id`.

**Table: `stock_counts`** — `company_id`, `warehouse_id`, `status` (draft, frozen, counting, review, posted), `frozen_at`, `snapshot` jsonb.
**Table: `stock_count_lines`** — `count_id`, `item_id`, `qty_snapshot`, `qty_counted`, `variance`, `reason`, `counted_by`.

**Table: `transfers`** — `from_warehouse_id`, `to_warehouse_id`, `status` (draft, in_transit, received, cancelled), `shipped_at`, `received_at`.

---

## 7. API Design

```
GET    /v1/companies/{id}/items?q=&category=&low_stock=
POST   /v1/companies/{id}/items
GET    /v1/items/{id}/stock                    -> saldo per gudang, empat kuantitas
GET    /v1/items/{id}/movements?from=&to=      -> kartu stok

GET    /v1/companies/{id}/stock?warehouse_id=&item_id=
GET    /v1/companies/{id}/stock/availability   -> body: lines[{item_id, warehouse_id, qty}]

POST   /v1/companies/{id}/reservations         -> dipanggil saat pesanan dikonfirmasi
DELETE /v1/reservations/{id}

POST   /v1/companies/{id}/transfers
POST   /v1/transfers/{id}/ship                 -> transfer_out, masuk in-transit
POST   /v1/transfers/{id}/receive              -> transfer_in, boleh sebagian
POST   /v1/transfers/{id}/report-discrepancy   -> selisih kirim dan terima

POST   /v1/companies/{id}/adjustments          -> alasan wajib
POST   /v1/adjustments/{id}/post

POST   /v1/companies/{id}/stock-counts
POST   /v1/stock-counts/{id}/freeze            -> mengambil snapshot
PATCH  /v1/stock-counts/{id}/lines             -> input hasil hitung, boleh bertahap
POST   /v1/stock-counts/{id}/post              -> menghasilkan penyesuaian

POST   /v1/companies/{id}/landed-costs         -> alokasi ke penerimaan

GET    /v1/batches/{id}/trace                  -> maju dan mundur
GET    /v1/companies/{id}/reports/stock-valuation?as_of=
GET    /v1/companies/{id}/reports/stock-aging
```

### Kontrak yang mengikat

**`/availability` menerima banyak baris sekaligus.** Line-item editor memeriksa seluruh baris dalam satu permintaan, bukan satu permintaan per baris.

**Reservasi memakai penguncian baris pada `stock_balances`**, bukan pemeriksaan lalu penulisan. Dua pesanan bersamaan atas sisa terakhir: satu berhasil, satu ditolak dengan sisa aktual.

**`/transfers/{id}/receive` menerima kuantitas per baris** dan boleh kurang dari yang dikirim. Selisihnya tidak hilang — ia tetap berstatus dalam perjalanan sampai dilaporkan sebagai kehilangan lewat `/report-discrepancy`, yang memerlukan persetujuan.

**Stok opname menghitung selisih terhadap snapshot saat pembekuan**, bukan terhadap saldo saat posting. Transaksi yang terjadi selama penghitungan tetap tercatat dan tidak dianggap selisih.

---

## 8. UI Flow

**Daftar stok** — data table dengan kolom per gudang, grouping per kategori dengan subtotal nilai. Item yang belum pernah masuk gudang tertentu menampilkan em dash, bukan nol.

**Kartu stok** — riwayat mutasi satu item dengan saldo berjalan, dapat ditelusuri ke dokumen sumbernya. Ini penerapan Archetype 6.

**Transfer** — wizard dua langkah dengan status dalam perjalanan terlihat jelas, dan penerimaan yang boleh sebagian.

**Stok opname** — mode ponsel dengan pemindaian barcode, input bertahap yang tersimpan otomatis, dan layar peninjauan selisih sebelum posting.

**Penelusuran batch** — pohon dua arah: dari batch ke pelanggan, dan dari pelanggan ke batch.

**Peringatan stok** di dashboard: di bawah titik pemesanan ulang, mendekati kedaluwarsa, tidak bergerak.

---

## 9. Business Flow

Barang diterima dari pembelian → mutasi `receipt` dengan harga pokok dari tagihan → lapisan biaya dibuat → saldo bertambah.

Pesanan penjualan dikonfirmasi → reservasi dibuat → `qty_available` berkurang, `qty_on_hand` tidak berubah.

Barang dikirim → mutasi `shipment` → lapisan biaya dikonsumsi berurutan → harga pokok penjualan dihitung → reservasi berkurang → jurnal persediaan dan HPP diposting bersamaan, atomik.

Transfer → `transfer_out` di gudang asal, barang menjadi dalam perjalanan → penerimaan → `transfer_in` di gudang tujuan. Bila jumlah terima kurang, selisihnya tetap dalam perjalanan sampai diselesaikan lewat laporan kehilangan yang disetujui.

Stok opname → pembekuan snapshot → penghitungan → selisih ditinjau → posting menghasilkan mutasi `adjustment` dengan alasan.

---

## 10. Permission Matrix

| Aksi | Tenant Owner | Tenant Admin | Company Admin | Kepala Gudang | Staf Gudang | Finance |
|---|---|---|---|---|---|---|
| Lihat stok | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ubah data item | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ubah metode penilaian | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Buat transfer | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Terima transfer | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Buat penyesuaian | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Posting penyesuaian di atas ambang** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Jalankan stok opname | ✅ | ✅ | ✅ | ✅ | ✅ (input saja) | ❌ |
| Posting hasil opname | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Laporkan kehilangan transfer | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

**Yang menghitung stok tidak boleh memposting selisihnya.** Ini pemisahan tugas yang sama pentingnya dengan pemisahan pengaju dan penyetuju di Penjualan — dan ia yang mencegah selisih ditutup diam-diam.

---

## 11. Validation Rules

- Mutasi tidak dapat diposting ke periode fiskal yang sudah ditutup.
- Item bertipe `service` tidak memiliki mutasi stok.
- Item dengan `track_batch` wajib menyertakan batch di setiap mutasi.
- Item dengan `track_serial` wajib satu nomor seri per unit; kuantitas selalu bilangan bulat.
- Nomor seri tidak dapat berada di dua gudang sekaligus, dan tidak dapat dijual dua kali.
- Batch kedaluwarsa tidak dapat dikirim tanpa persetujuan eksplisit.
- Reservasi tidak boleh melebihi `qty_available`.
- Penyesuaian wajib menyertakan alasan dari daftar terkelola.
- Faktor konversi satuan tidak dapat diubah setelah ada mutasi memakai satuan itu.
- **Metode penilaian tidak dapat diubah setelah ada mutasi.** Sama seperti bulan awal tahun fiskal, ini ditandai jelas saat pertama disetel.

### Kebijakan stok negatif

Dapat dikonfigurasi per company: **blokir · peringatkan · izinkan**.

Rekomendasi default: **peringatkan**, bukan blokir. Memblokir terdengar lebih aman tetapi menciptakan hal yang lebih buruk — barang sudah dikirim ke pelanggan sementara penerimaan pembeliannya belum diinput, sehingga staf mencatat penyesuaian palsu untuk melewati blokade. Peringatan yang tercatat lebih jujur daripada blokade yang diakali.

Untuk item ber-serial, stok negatif **selalu diblokir** — unit yang tidak ada tidak dapat dikirim.

### Yang wajib divalidasi profesional

**Metode penilaian yang diakui** — LIFO tidak disertakan karena tidak diizinkan standar akuntansi yang berlaku di Indonesia, tetapi konfirmasikan ke akuntan · **perlakuan selisih stok opname** dalam laporan keuangan · **penurunan nilai persediaan** untuk barang rusak dan kedaluwarsa.

---

## 12. Testing Strategy

**Unit.** Konsumsi lapisan biaya FIFO termasuk kasus lapisan terpotong · perhitungan rata-rata tertimbang setelah penerimaan berharga berbeda · konversi satuan bolak-balik tanpa kehilangan presisi · perhitungan `qty_available`.

**Integration.** Posting pengiriman menghasilkan mutasi, konsumsi lapisan biaya, dan jurnal secara atomik · pembatalan pesanan melepas reservasi · transfer dua langkah menghasilkan saldo yang benar di kedua gudang.

**Konkurensi — yang terpenting di modul ini.** Dua pesanan bersamaan atas sisa stok terakhir: tepat satu berhasil · dua pengiriman bersamaan atas item yang sama menghasilkan lapisan biaya yang konsisten · rekonsiliasi proyeksi saldo terhadap mutasi setelah beban konkuren tinggi menghasilkan selisih nol.

**Negatif.** Kirim batch kedaluwarsa tanpa persetujuan ditolak · jual nomor seri yang sudah terjual ditolak · ubah metode penilaian setelah ada mutasi ditolak · penghitung stok memposting selisihnya sendiri ditolak.

**E2E.** Penerimaan sampai penjualan dengan harga pokok yang benar · transfer dengan penerimaan sebagian dan penyelesaian selisih · stok opname penuh sambil transaksi berjalan · penelusuran batch dari pelanggan sampai pemasok.

---

## 13. Future Enhancements

- **Multi-lokasi dalam gudang** sampai tingkat rak, dengan saran penempatan.
- **Pemindaian barcode dan QR** di seluruh alur gudang lewat ponsel.
- **Peramalan permintaan** dan saran titik pemesanan ulang otomatis dari pola historis.
- **Konsinyasi** — stok di lokasi pelanggan yang belum diakui sebagai penjualan.
- **Cycle counting** menggantikan opname tahunan: menghitung sebagian item setiap minggu secara bergilir.
- **Penilaian standar cost** dengan analisis varians, untuk perusahaan manufaktur.
- **Integrasi 3PL dan marketplace** untuk sinkronisasi stok lintas kanal.
- **Manajemen kedaluwarsa lanjutan** dengan aturan FEFO — barang kedaluwarsa lebih dulu, keluar lebih dulu.
