# Module Design: Point of Sale
*Phase 2 — Core Business. Modul terakhir Fase 2, dan satu-satunya yang harus bekerja tanpa koneksi.*

**Cakupan:** Terminal · Sesi Kasir · Transaksi Penjualan · Pembayaran · Retur & Tukar · Promosi · Mode Restoran · Kitchen Display · Sinkronisasi Luring · Perangkat Keras.
**Dependency:** Modul 01, 02, 03, 04 (Penjualan), 05 (Persediaan), 07 (Akuntansi), 08 (Pajak).

---

## 1. Business Problem

POS punya batasan yang tidak dimiliki modul lain: **ia tidak boleh berhenti.** Antrean di kasir tidak bisa menunggu koneksi pulih, dan pelanggan yang sudah membawa barang ke depan tidak bisa diminta kembali besok.

Sebagian besar sistem POS berbasis cloud gagal di titik ini. Mereka bekerja sempurna di demo dan berhenti total saat internet putus — yang di banyak lokasi di Indonesia terjadi beberapa kali seminggu. Kasir lalu kembali ke nota tulis tangan, dan data hari itu masuk ke sistem esok hari dengan kualitas seadanya, kalau masuk sama sekali.

Masalah kedua lebih halus: **harga ritel di Indonesia lazimnya sudah termasuk pajak**, sementara seluruh modul B2B yang sudah dirancang bekerja dengan harga di luar pajak. Menyamakan keduanya menghasilkan selisih pembulatan yang muncul di rekonsiliasi setiap bulan.

---

## 2. Goals

- **Terminal berfungsi penuh tanpa koneksi**, termasuk mencetak struk dan menerima pembayaran.
- **Penjualan yang sudah terjadi tidak pernah ditolak saat sinkronisasi.**
- Harga termasuk pajak sebagai mode tersendiri, dengan pembulatan yang ditetapkan sekali dan konsisten.
- Sesi kasir yang dapat direkonsiliasi: uang yang dihitung versus uang yang seharusnya.
- Kecepatan: dari pindai barcode sampai baris bertambah di bawah 100ms, tanpa menunggu jaringan.
- Mode ritel dan mode restoran berbagi inti yang sama, berbeda hanya di alurnya.

---

## 3. User Stories

- Sebagai kasir, saya ingin tetap bisa melayani pelanggan saat internet mati.
- Sebagai kasir, saya ingin memindai barcode dan barisnya langsung muncul, tanpa jeda.
- Sebagai kasir, saya ingin menerima pembayaran gabungan — sebagian tunai, sebagian QRIS.
- Sebagai kasir, saya ingin menutup sesi dan tahu apakah uang di laci cocok dengan yang seharusnya.
- Sebagai supervisor, saya ingin membatalkan transaksi salah dengan otorisasi saya, dan jejaknya tercatat.
- Sebagai pemilik toko, saya ingin tahu penjualan hari ini dari ponsel tanpa datang ke toko.
- Sebagai pelayan restoran, saya ingin membuka pesanan per meja dan menambah item sepanjang tamu makan.
- Sebagai dapur, saya ingin melihat pesanan masuk di layar dan menandainya selesai.

---

## 4. Functional Requirements

**Terminal.** Terdaftar per company dan per outlet, dengan kode perangkat unik yang menjadi awalan referensi transaksi lokal. Data induk — item, harga, promosi, pelanggan, kode pajak — tersimpan lokal dan disegarkan berkala.

**Sesi kasir.** Buka sesi dengan modal awal → transaksi berjalan → kas masuk dan keluar di luar penjualan dicatat → tutup sesi dengan penghitungan fisik → selisih dihitung dan memerlukan alasan bila melewati ambang.

**Transaksi penjualan.** Pindai atau cari item, ubah kuantitas, diskon per baris dan per transaksi dengan batas wewenang kasir, tahan transaksi dan lanjutkan kemudian, cetak struk.

**Pembayaran.** Tunai dengan perhitungan kembalian, kartu, QRIS, dompet digital, dan gabungan beberapa metode dalam satu transaksi. Pembayaran non-tunai yang gagal dikonfirmasi saat luring ditandai untuk verifikasi manual.

**Retur dan tukar.** Berdasarkan struk asal, sebagian atau penuh. Tukar barang menghasilkan selisih yang dibayar atau dikembalikan.

**Pembatalan.** Baris dan transaksi. **Memerlukan otorisasi supervisor** dan alasan, keduanya tercatat.

**Promosi.** Diskon persentase dan nominal, beli satu dapat satu, harga bundel, diskon berdasarkan kuantitas, dan periode berlaku. Dievaluasi lokal.

**Mode restoran.** Denah meja, pesanan terbuka per meja, penambahan item bertahap, pemisahan dan penggabungan tagihan, biaya layanan, dan pajak restoran daerah bila berlaku.

**Kitchen display.** Pesanan masuk per stasiun, penanda selesai, dan waktu tunggu. Berfungsi di jaringan lokal tanpa internet.

**Sinkronisasi.** Antrean transaksi dikirim saat koneksi kembali, berurutan, idempoten, dengan status per transaksi yang terlihat kasir.

**Perangkat keras.** Pencetak struk, laci kas, pemindai barcode, layar pelanggan, dan pencetak dapur.

---

## 5. Non Functional Requirements

- **Pindai sampai baris bertambah di bawah 100ms**, tanpa panggilan jaringan.
- **Seluruh alur transaksi berfungsi luring**, termasuk promosi, pajak, dan cetak struk.
- Antrean luring bertahan minimal 72 jam transaksi tanpa kehilangan data, dan selamat dari terminal yang mati mendadak.
- **Sinkronisasi idempoten.** Terminal yang mengirim ulang antrean tidak pernah menghasilkan transaksi ganda.
- Data induk lokal disegarkan tanpa mengganggu transaksi berjalan.
- Terminal yang hilang atau dicuri dapat dicabut aksesnya, dan data lokalnya terenkripsi.
- Sesi kasir tidak dapat ditutup bila masih ada transaksi belum tersinkron, kecuali dengan konfirmasi eksplisit.

---

## 6. Database Design

**Table: `outlets`** — `company_id`, `code`, `name`, `warehouse_id`, `address`, `tax_profile_override`, `status`.

Setiap outlet terikat satu gudang, sehingga penjualan POS memutasi stok di gudang yang benar.

**Table: `pos_terminals`** — `outlet_id`, `code`, `name`, `device_fingerprint`, `last_sync_at`, `master_data_version`, `status` (active, suspended, revoked).

`code` menjadi awalan referensi lokal, sehingga dua terminal luring tidak pernah menghasilkan referensi yang sama.

**Table: `pos_sessions`** — sesi kasir

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| terminal_id, user_id | UUID | |
| opened_at, closed_at | timestamp | |
| opening_float | numeric | |
| expected_cash, counted_cash, variance | numeric | |
| variance_reason | text, nullable | |
| status | enum | open, closing, closed, reconciled |

**Table: `pos_transactions`**

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | dibuat di terminal |
| local_reference | varchar | `POS-01/20260810/0037` |
| number | varchar, nullable | **nomor resmi, diberikan saat sinkron** |
| session_id, terminal_id, outlet_id | UUID | |
| customer_id | UUID, nullable | penjualan tanpa pelanggan diizinkan |
| transaction_at | timestamp | **waktu di terminal**, bukan waktu server |
| subtotal, discount, tax_total, total | numeric | |
| price_includes_tax | boolean | |
| sync_status | enum | pending, synced, failed, flagged |
| stock_discrepancy | boolean | ditandai bila stok tidak cukup saat sinkron |
| voided_by, void_reason | | |

`transaction_at` memakai waktu terminal karena itulah waktu penjualan sebenarnya. Waktu sinkron dicatat terpisah.

**Table: `pos_transaction_lines`** — `transaction_id`, `line_no`, `item_id`, `qty`, `unit_price`, `discount`, `tax_code_id`, `tax_amount`, `net_amount`, `promotion_id`

**Table: `pos_payments`** — `transaction_id`, `method` (cash, card, qris, ewallet, voucher), `amount`, `reference`, `status` (captured, pending_verification, failed), `change_given`

**Table: `pos_cash_movements`** — `session_id`, `type` (in, out, drop, float), `amount`, `reason`, `authorized_by`

**Table: `promotions`** — `company_id`, `outlet_ids` jsonb, `type`, `rules` jsonb, `valid_from`, `valid_to`, `priority`, `stackable` (boolean)

**Table: `restaurant_tables`** dan **`table_orders`** — untuk mode restoran, dengan status meja dan pesanan terbuka.

**Table: `pos_sync_log`** — `terminal_id`, `batch_id`, `transaction_count`, `started_at`, `completed_at`, `failed_count`, `error` — untuk mendiagnosis terminal bermasalah.

---

## 7. API Design

```
POST   /v1/outlets/{id}/terminals/register     -> mengembalikan kode terminal
GET    /v1/terminals/{id}/master-data?since=   -> unduhan bertahap
POST   /v1/terminals/{id}/heartbeat

POST   /v1/terminals/{id}/sessions             -> buka sesi
POST   /v1/sessions/{id}/cash-movements
POST   /v1/sessions/{id}/close                 -> body: counted_cash, alasan bila ada selisih

POST   /v1/terminals/{id}/sync                 -> kirim antrean, idempoten per transaction id
GET    /v1/terminals/{id}/sync/status

POST   /v1/pos-transactions/{id}/void          -> otorisasi supervisor wajib
POST   /v1/pos-transactions/{id}/return

GET    /v1/outlets/{id}/reports/daily-sales?date=
GET    /v1/outlets/{id}/reports/session-summary?session_id=
GET    /v1/companies/{id}/reports/pos-discrepancies
```

### Kontrak yang mengikat

**`/sync` bersifat idempoten per `transaction.id` yang dibuat terminal.** Terminal yang kehilangan jawaban dan mengirim ulang tidak pernah menghasilkan transaksi ganda. Ini bukan optimasi — koneksi buruk berarti kirim ulang adalah kejadian normal, bukan pengecualian.

**`/sync` tidak pernah menolak transaksi penjualan.** Stok tidak cukup menghasilkan `stock_discrepancy = true` dan penyesuaian stok otomatis, bukan penolakan. Transaksi tetap diterima, nomor resmi tetap diberikan, jurnal tetap diposting.

**Nomor resmi diberikan server, referensi lokal dibuat terminal.** Struk luring mencetak referensi lokal; nomor resmi menyusul dan keduanya tersimpan. Struk yang dicetak ulang setelah sinkron menampilkan keduanya.

**`/master-data` bersifat bertahap.** Terminal mengirim versi yang dimilikinya dan menerima selisihnya, bukan seluruh katalog.

---

## 8. UI Flow

**Layar kasir** — daftar item di kiri, keranjang di kanan, tombol pembayaran besar dan selalu di tempat yang sama. Dirancang untuk sentuh dan untuk keyboard, karena kasir cepat memakai keyboard.

**Indikator koneksi permanen** — daring, luring, atau menyinkronkan, dengan jumlah transaksi tertunda. Kasir harus selalu tahu, tanpa harus mencari.

**Pembayaran** — metode dipilih, jumlah dimasukkan, kembalian dihitung besar dan jelas. Pembayaran gabungan menampilkan sisa yang belum terbayar setiap saat.

**Tutup sesi** — penghitungan uang per denominasi, selisih ditampilkan setelah dihitung bukan sebelumnya, dan alasan wajib bila melewati ambang.

**Mode restoran** — denah meja dengan status warna dan label, pesanan terbuka per meja, pemisahan tagihan per item atau per orang.

**Kitchen display** — kartu pesanan per stasiun, diurutkan waktu, dengan penanda pesanan yang menunggu terlalu lama.

Mengikuti aturan target sentuh 44px dan mode kepadatan tidak tersedia di viewport sentuh, sesuai Layout System.

---

## 9. Business Flow

Kasir membuka sesi dengan modal awal → transaksi dilayani, seluruhnya lokal → pembayaran diterima → struk dicetak dengan referensi lokal → transaksi masuk antrean.

Saat koneksi ada: antrean dikirim berurutan → server memberikan nomor resmi → memutasi stok di gudang outlet → membuat jurnal lewat penentuan akun → menghitung pajak dengan kode yang berlaku pada tanggal transaksi → mengembalikan status per transaksi.

Bila stok tidak cukup: transaksi tetap diterima, ditandai selisih, dan penyesuaian stok dibuat otomatis dengan alasan yang jelas. Selisih muncul di laporan agar diselidiki, bukan diabaikan.

Tutup sesi: uang dihitung → selisih terhadap yang seharusnya dihitung → alasan diminta bila melewati ambang → sesi ditutup → setoran kas dicatat.

Bila terminal tidak tersinkron lebih dari batas waktu: peringatan dikirim ke pemilik lewat modul Notifikasi.

---

## 10. Permission Matrix

| Aksi | Tenant Owner | Company Admin | Manajer Outlet | Supervisor | Kasir |
|---|---|---|---|---|---|
| Transaksi penjualan | ✅ | ✅ | ✅ | ✅ | ✅ |
| Diskon dalam batas | ✅ | ✅ | ✅ | ✅ | ✅ |
| Diskon melebihi batas | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Batalkan baris atau transaksi** | ✅ | ✅ | ✅ | ✅ | ❌ |
| Proses retur | ✅ | ✅ | ✅ | ✅ | ❌ |
| Buka dan tutup sesi sendiri | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tutup sesi kasir lain | ✅ | ✅ | ✅ | ✅ | ❌ |
| Kas masuk dan keluar | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Setujui selisih kas** | ✅ | ✅ | ✅ | ❌ | ❌ |
| Kelola promosi | ✅ | ✅ | ✅ | ❌ | ❌ |
| Daftarkan dan cabut terminal | ✅ | ✅ | ❌ | ❌ | ❌ |

**Kasir tidak dapat membatalkan transaksinya sendiri.** Pembatalan tanpa otorisasi adalah jalur kebocoran kas paling umum di ritel — dan ini kontrol, bukan ketidakpercayaan.

**Yang menghitung uang bukan yang menyetujui selisihnya.** Pola yang sama dengan stok opname di Modul 05.

---

## 11. Validation Rules

- Transaksi tidak dapat dibuat tanpa sesi kasir yang terbuka.
- Sesi tidak dapat ditutup bila masih ada transaksi ditahan yang belum diselesaikan.
- Sesi dengan transaksi belum tersinkron hanya dapat ditutup dengan konfirmasi eksplisit, dan antreannya tetap terkirim.
- Diskon melebihi batas wewenang memerlukan otorisasi, yang tercatat beserta pemberinya.
- Pembatalan memerlukan alasan dari daftar terkelola.
- Retur tidak boleh melebihi kuantitas pada struk asal dikurangi retur sebelumnya.
- Pembayaran gabungan wajib berjumlah tepat sama dengan total; kelebihan tunai menjadi kembalian, kelebihan non-tunai ditolak.
- Terminal berstatus `revoked` tidak dapat menyinkronkan; antreannya ditahan untuk peninjauan manual.
- Promosi kedaluwarsa tidak diterapkan meski masih tersimpan di data lokal terminal.

### Harga termasuk pajak

Bila `price_includes_tax` aktif, dasar pengenaan pajak dihitung mundur dari harga jual. **Aturan pembulatannya ditetapkan sekali per company dan tidak dapat diubah setelah ada transaksi** — sama seperti metode penilaian persediaan dan bulan awal tahun fiskal.

Selisih pembulatan antara total struk dan jumlah pajak per baris **wajib ditampung akun selisih pembulatan yang ditentukan**, bukan disembunyikan. Selisih beberapa rupiah per transaksi yang tidak dibukukan akan menjadi selisih yang tidak dapat dijelaskan pada akhir bulan.

### Yang wajib divalidasi profesional

Perlakuan harga termasuk pajak dan cara menghitung mundur DPP · syarat formal struk sebagai dokumen pajak · pajak restoran daerah dan hubungannya dengan PPN · perlakuan selisih pembulatan dalam pelaporan.

---

## 12. Testing Strategy

**Unit.** Perhitungan mundur DPP dari harga termasuk pajak, termasuk kasus pembulatan batas · evaluasi promosi bertumpuk dan prioritasnya · perhitungan kembalian dan pembayaran gabungan.

**Luring — yang terpenting di modul ini.** Terminal dimatikan paksa di tengah transaksi lalu dinyalakan: antrean utuh · 72 jam transaksi tanpa koneksi lalu sinkron: seluruhnya masuk berurutan · dua terminal luring bersamaan menghasilkan referensi lokal yang tidak pernah bertabrakan.

**Idempotensi.** Antrean yang sama dikirim tiga kali menghasilkan satu set transaksi · sinkronisasi terputus di tengah lalu diulang tidak menghasilkan duplikat maupun kehilangan.

**Selisih stok.** Dua terminal menjual item terakhir secara luring: keduanya diterima, stok menjadi negatif, penyesuaian dibuat, dan selisihnya muncul di laporan.

**Integration.** Sinkronisasi menghasilkan mutasi stok, jurnal, dan baris buku pajak yang benar · retur menghasilkan mutasi dan jurnal lawan.

**E2E.** Sesi penuh dari buka sampai tutup dengan selisih kas · transaksi restoran dari buka meja sampai bayar terpisah · pemadaman internet di tengah jam sibuk lalu pemulihan.

---

## 13. Future Enhancements

- **Program loyalitas** dengan poin dan tingkatan pelanggan.
- **Pemesanan mandiri** lewat QR di meja, terhubung ke kitchen display yang sama.
- **Integrasi pengantaran** ke platform pihak ketiga, dengan stok dan menu yang sama.
- **Timbangan terhubung** untuk barang curah.
- **Analisis keranjang** — barang apa yang sering dibeli bersama, dipakai untuk penempatan dan bundel.
- **Peramalan permintaan per outlet** untuk pengisian ulang otomatis.
- **Mode kios** tanpa kasir untuk gerai kecil.
- **Rekonsiliasi pembayaran otomatis** dengan penyedia QRIS dan akuisisi kartu.
