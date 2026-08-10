# Module Design: Tax
*Phase 2 — Core Business. Menerima titipan pekerjaan dari Penjualan, Pembelian, dan Akuntansi.*

**Cakupan:** Kode Pajak · Mesin Perhitungan · Faktur Pajak Keluaran · Faktur Pajak Masukan · Nomor Seri · PPh Potong Pungut · Bukti Potong · Buku Pajak · Laporan Masa · Rekonsiliasi Pajak.
**Dependency:** Modul 01, 02, 03, 04 (Penjualan), 06 (Pembelian), 07 (Akuntansi).

> **Peringatan yang berlaku untuk seluruh dokumen ini.** Modul ini menyentuh regulasi perpajakan Indonesia. Dokumen ini merancang **sistem yang dapat dikonfigurasi**, bukan menetapkan aturan pajaknya. Setiap tarif, batasan, tenggat, dan syarat formal wajib ditetapkan konsultan pajak dan dimasukkan sebagai konfigurasi — bukan diambil dari dokumen ini.

---

## 1. Business Problem

Pajak adalah satu-satunya area di mana kesalahan sistem berubah menjadi sanksi, bukan sekadar laporan yang salah.

Tiga kegagalan model muncul berulang. **Tarif ditulis sebagai konstanta di kode** — dan ketika tarif berubah, seluruh dokumen lama ikut terhitung ulang dengan tarif baru, sehingga laporan masa lalu berubah dan tidak lagi cocok dengan yang sudah dilaporkan. **Faktur pajak diperlakukan sebagai atribut dokumen komersial**, sehingga koreksi, penggantian, dan pembatalan tidak punya tempat. **Buku pajak dan buku besar tidak pernah direkonsiliasi**, sehingga selisihnya baru ditemukan saat pemeriksaan.

Bagi UMKM Indonesia yang baru menjadi PKP, sistem yang salah di sini adalah alasan paling umum mereka kembali ke spreadsheet.

---

## 2. Goals

- **Tarif dan aturan adalah data bertanggal berlaku**, tidak pernah konstanta di kode.
- Dokumen dihitung dengan tarif yang berlaku **pada tanggal dokumen**, bukan tanggal hari ini. Menghitung ulang dokumen lama menghasilkan angka yang sama seperti saat dilaporkan.
- Faktur pajak keluaran dan masukan sebagai dokumen tersendiri dengan siklus hidupnya sendiri.
- Nomor seri dikelola penuh: dialokasikan, dipakai, dibatalkan — tanpa celah dan tanpa duplikat.
- PPh potong pungut dihitung otomatis saat pembayaran, dengan bukti potong yang tercatat.
- **Buku pajak dan akun pajak di buku besar wajib selalu sama**, dan selisihnya terlihat setiap saat.
- Laporan masa dapat dihasilkan dan diarsipkan dalam bentuk yang tidak berubah setelah dilaporkan.

---

## 3. User Stories

- Sebagai akuntan pajak, saya ingin tarif berubah tanpa mengubah dokumen yang sudah dilaporkan.
- Sebagai akuntan pajak, saya ingin tahu faktur pajak masukan mana yang belum lengkap syaratnya, dan apa yang kurang.
- Sebagai akuntan pajak, saya ingin nomor seri dikelola sistem sehingga tidak pernah terpakai dua kali atau terlewat.
- Sebagai akuntan pajak, saya ingin membetulkan faktur pajak dengan faktur pengganti, dan jejaknya utuh.
- Sebagai finance, saya ingin PPh yang saya potong dari vendor terhitung otomatis beserta bukti potongnya.
- Sebagai akuntan, saya ingin buku pajak dan buku besar cocok, dan diberi tahu segera bila tidak.
- Sebagai pemilik, saya ingin tahu berapa yang harus disetor bulan ini, sebelum tenggatnya.
- Sebagai pengguna baru, saya ingin sistem tahu apakah perusahaan saya PKP atau belum, dan berperilaku sesuai.

---

## 4. Functional Requirements

**Profil pajak company.** Status PKP dan tanggal pengukuhannya, NPWP, jenis pajak yang berlaku, dan skema pajak khusus bila ada. Company non-PKP tidak menerbitkan faktur pajak dan tidak mengkreditkan pajak masukan.

**Kode pajak.** Setiap kode membawa tarif, tanggal mulai berlaku, tanggal berakhir, jenis (PPN, PPh, bebas, tidak dipungut), akun buku besar, dan aturan keberlakuan. **Perubahan tarif adalah baris baru, bukan pengubahan baris lama.**

**Mesin perhitungan.** Menerima konteks — jenis dokumen, tanggal, item, pelanggan atau vendor, dan lokasi — lalu mengembalikan kode pajak yang berlaku beserta perhitungannya. Sama polanya dengan penentuan akun di Modul 07: modul lain tidak pernah menyebut tarif.

**Faktur pajak keluaran.** Dokumen tersendiri yang merujuk satu atau beberapa faktur komersial. Mengelola nomor seri, penerbitan, pembatalan, dan faktur pengganti dengan rujukan ke yang digantikan.

**Nomor seri.** Alokasi dicatat sebagai rentang. Nomor yang dipakai, dibatalkan, dan belum terpakai dapat dilaporkan setiap saat. **Nomor yang batal dipakai tidak dikembalikan ke pool** — pemakaiannya tetap harus dapat dipertanggungjawabkan.

**Faktur pajak masukan.** Dicatat dari tagihan vendor, divalidasi terhadap syarat formal, dan ditandai dapat atau tidak dapat dikreditkan beserta alasannya. Periode pengkreditan dapat berbeda dari periode tagihannya.

**PPh potong pungut.** Dihitung saat pembayaran ke vendor berdasarkan kategori jasa dan status NPWP vendor. Menghasilkan bukti potong bernomor yang dapat diserahkan ke vendor.

**Buku pajak.** Catatan seluruh transaksi berpajak per masa, sebagai dasar laporan. Terpisah dari buku besar, tetapi wajib rekonsiliasi.

**Laporan masa.** Ringkasan PPN keluaran, masukan, dan selisihnya. Ringkasan PPh yang dipotong. Ekspor dalam format yang dapat diunggah ke sistem pelaporan.

**Arsip laporan.** Laporan yang sudah dilaporkan dibekukan sebagai snapshot yang tidak berubah, meski data sumbernya kemudian dikoreksi. Pembetulan menghasilkan snapshot baru bernomor pembetulan.

---

## 5. Non Functional Requirements

- **Perhitungan pajak deterministik dan dapat direproduksi.** Menghitung ulang dokumen tahun lalu menghasilkan angka yang sama persis.
- Kode pajak yang berlaku ditentukan oleh **tanggal dokumen**, tidak pernah oleh tanggal sistem.
- Rekonsiliasi buku pajak terhadap akun pajak di buku besar dapat dijalankan kapan saja dan wajib menghasilkan nol.
- Nomor seri tidak boleh ganda maupun berlubang di bawah beban konkuren.
- Laporan masa untuk 10.000 transaksi selesai di bawah 5 detik.
- Snapshot laporan yang sudah dilaporkan tidak dapat diubah oleh peran mana pun.
- Seluruh perubahan konfigurasi pajak tercatat di audit log dengan nilai sebelum dan sesudah.

---

## 6. Database Design

**Table: `company_tax_profiles`** — `company_id`, `npwp`, `is_pkp`, `pkp_effective_date`, `nppkp`, `tax_office_code`, `applicable_taxes` jsonb, + audit baku.

**Table: `tax_codes`**

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| company_id | UUID, nullable | null berarti bawaan sistem |
| code | varchar | `PPN-OUT`, `PPH23-JASA` |
| name | varchar | |
| tax_type | enum | vat_out, vat_in, withholding, exempt, not_collected |
| rate | numeric(7,4) | |
| valid_from, valid_to | date | **tanggal berlaku, bukan pengubahan** |
| calculation_base | enum | net, gross, custom |
| gl_account_id | UUID (FK) | |
| is_creditable | boolean | untuk pajak masukan |
| status | enum | |

Unik: `(company_id, code, valid_from)`. Perubahan tarif menambah baris baru dengan `valid_from` yang baru, dan menutup baris lama dengan `valid_to`.

**Table: `tax_determination_rules`** — memetakan `(jenis dokumen, kategori item, jenis partner, status PKP partner, lokasi)` ke `tax_code_id`, dengan `specificity`. Pola identik dengan penentuan akun di Modul 07.

**Table: `output_tax_invoices`** — didefinisikan di Modul 04, dikelola oleh modul ini
**Table: `input_tax_invoices`** — didefinisikan di Modul 06, dikelola oleh modul ini

**Table: `tax_serial_allocations`** — `company_id`, `range_start`, `range_end`, `allocated_at`, `expires_at`, `source_reference`
**Table: `tax_serial_usage`** — `allocation_id`, `serial_number`, `status` (available, used, cancelled, expired), `output_tax_invoice_id`, `used_at`

Memisahkan alokasi dari pemakaian membuat pertanyaan "nomor mana yang belum terpakai" dan "nomor mana yang batal" dapat dijawab langsung.

**Table: `withholding_certificates`** — bukti potong

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| company_id | UUID | |
| number | varchar | bernomor urut per masa |
| partner_id, partner_npwp | | disalin saat terbit |
| tax_code_id | UUID | |
| base_amount, rate, tax_amount | numeric | |
| period | varchar | masa pajak |
| source_type, source_id | | pembayaran pemicu |
| status | enum | draft, issued, reported, cancelled |

**Table: `tax_ledger`** — append-only, satu baris per transaksi berpajak

`company_id` · `period` · `tax_code_id` · `direction` (out, in, withheld) · `document_type`, `document_id` · `partner_id`, `partner_npwp` · `base_amount`, `tax_amount` · `is_creditable`, `non_creditable_reason` · `posted_at`

**Table: `tax_returns`** — `company_id`, `tax_type`, `period`, `revision_no`, `status` (draft, submitted, accepted, amended), `snapshot` jsonb, `total_payable`, `submitted_at`, `receipt_number`

`snapshot` menyimpan laporan sebagaimana dilaporkan. Ia **tidak pernah dihitung ulang** dari data sumber.

---

## 7. API Design

```
GET    /v1/companies/{id}/tax-profile
PATCH  /v1/companies/{id}/tax-profile

GET    /v1/companies/{id}/tax-codes?as_of=
POST   /v1/companies/{id}/tax-codes            -> perubahan tarif = kode baru dengan valid_from
POST   /v1/companies/{id}/tax-rules/resolve    -> uji: konteks ini kena kode pajak apa

POST   /v1/companies/{id}/tax/calculate        -> dipanggil modul lain, mengembalikan kode + nilai

POST   /v1/companies/{id}/tax-serials          -> catat alokasi
GET    /v1/companies/{id}/tax-serials/usage    -> terpakai, batal, tersisa

POST   /v1/companies/{id}/output-tax-invoices
POST   /v1/output-tax-invoices/{id}/issue      -> mengambil nomor seri
POST   /v1/output-tax-invoices/{id}/replace    -> faktur pengganti
POST   /v1/output-tax-invoices/{id}/cancel     -> nomor ditandai batal, tidak kembali ke pool

POST   /v1/companies/{id}/input-tax-invoices
POST   /v1/input-tax-invoices/{id}/validate    -> memeriksa syarat formal
PATCH  /v1/input-tax-invoices/{id}/credit-period

POST   /v1/companies/{id}/withholding-certificates
POST   /v1/withholding-certificates/{id}/issue

GET    /v1/companies/{id}/tax-ledger?period=&type=
GET    /v1/companies/{id}/tax-returns/{type}/{period}/preview
POST   /v1/companies/{id}/tax-returns          -> membekukan snapshot
POST   /v1/tax-returns/{id}/amend              -> pembetulan, snapshot baru
GET    /v1/companies/{id}/reports/tax-reconciliation?period=
```

### Kontrak yang mengikat

**`/tax/calculate` menerima tanggal dokumen dan memakai tarif yang berlaku pada tanggal itu.** Tidak ada parameter untuk memaksa tarif tertentu. Modul lain tidak pernah menyebut angka tarif.

**`POST /tax-codes` tidak pernah mengubah tarif kode yang sudah ada.** Ia membuat baris baru dan menutup yang lama. Upaya `PATCH` tarif pada kode yang sudah dipakai ditolak.

**`/tax-returns` membekukan snapshot.** Setelah dibuat, laporan itu tidak berubah meski data sumbernya dikoreksi. Koreksi menghasilkan pembetulan bernomor, bukan perubahan diam-diam.

**Nomor seri yang dibatalkan tidak kembali ke pool.** Endpoint `/cancel` menandainya `cancelled`, dan ia tetap muncul di laporan pemakaian.

---

## 8. UI Flow

**Profil pajak** di Pengaturan → Pajak. Status PKP ditandai jelas, karena ia mengubah perilaku seluruh produk.

**Kode pajak** — daftar dengan kolom tanggal berlaku. Mengubah tarif membuka form yang menjelaskan bahwa ini akan membuat versi baru, dengan tanggal mulai berlaku, bukan mengubah yang lama. Ini pola yang sama dengan pratinjau dampak di Archetype 7.

**Penguji aturan** — pilih skenario, lihat kode pajak mana yang akan dipakai dan aturan mana yang menang. Sama seperti penguji penentuan akun.

**Nomor seri** — sisa alokasi terlihat sebagai indikator, dengan peringatan saat menipis. Daftar pemakaian menampilkan terpakai, batal, dan tersisa secara terpisah.

**Faktur pajak masukan** — daftar dengan penanda mana yang belum lengkap dan **apa yang kurang**, bukan sekadar bendera merah.

**Laporan masa** — pratinjau sebelum dibekukan, dengan penelusuran per baris ke transaksi sumbernya. Setelah dibekukan, tampil sebagai arsip dengan nomor pembetulan.

**Rekonsiliasi pajak** — buku pajak berdampingan dengan akun pajak di buku besar, selisih ditampilkan per kode pajak.

---

## 9. Business Flow

Faktur diposting di Penjualan → mesin pajak menentukan kode berdasarkan tanggal dan konteks → nilai pajak dihitung → baris masuk ke buku pajak → jurnal PPN keluaran diposting lewat penentuan akun.

Faktur pajak keluaran diterbitkan merujuk satu atau beberapa faktur → nomor seri diambil dari alokasi → status menjadi terbit.

Tagihan diposting di Pembelian → faktur pajak masukan dicatat → divalidasi → ditandai dapat atau tidak dapat dikreditkan → masuk buku pajak dengan periode pengkreditannya.

Pembayaran ke vendor jasa → PPh dihitung → bukti potong diterbitkan → nilai potongan mengurangi kas yang dibayarkan.

Akhir masa: rekonsiliasi buku pajak terhadap buku besar → pratinjau laporan → laporan dibekukan sebagai snapshot → disetor dan dilaporkan → nomor tanda terima dicatat.

Bila ditemukan kesalahan setelah dilaporkan: **snapshot lama tidak diubah.** Faktur pengganti diterbitkan bila perlu, dan laporan pembetulan dibuat sebagai snapshot baru.

---

## 10. Permission Matrix

| Aksi | Tenant Owner | Tenant Admin | Company Admin | Akuntan Pajak | Finance | Member |
|---|---|---|---|---|---|---|
| Lihat laporan pajak | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ubah profil pajak company | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Ubah kode dan tarif pajak** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ubah aturan penentuan pajak | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Catat alokasi nomor seri | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Terbitkan faktur pajak keluaran | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Batalkan faktur pajak | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Validasi faktur pajak masukan | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Terbitkan bukti potong | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Bekukan laporan masa** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |

**Mengubah tarif hanya di tingkat tenant.** Tarif yang salah menyebar ke seluruh transaksi berikutnya di seluruh company, dan efeknya baru terlihat di laporan masa berikutnya.

**Yang menyiapkan laporan bukan yang membekukannya.** Pola pemisahan tugas yang sama dengan modul lain.

---

## 11. Validation Rules

- Company non-PKP tidak dapat menerbitkan faktur pajak keluaran maupun mengkreditkan pajak masukan.
- Faktur pajak keluaran memerlukan NPWP pelanggan; tanpa itu, ditolak dengan penjelasan cara melengkapinya.
- Nomor seri di luar rentang yang dialokasikan ditolak.
- Nomor seri yang berstatus `used` atau `cancelled` tidak dapat dipakai ulang.
- Faktur pengganti wajib merujuk faktur yang digantikan, dan yang digantikan berubah status menjadi `replaced`.
- Kode pajak tidak dapat diubah tarifnya; hanya ditutup dan digantikan versi baru.
- Kode pajak tidak dapat dihapus bila sudah dipakai di buku pajak.
- Transaksi tidak dapat diposting ke masa pajak yang laporannya sudah dibekukan; koreksinya masuk ke pembetulan.
- Bukti potong memerlukan NPWP partner; tarif berbeda bila partner tidak ber-NPWP.
- Perubahan `is_pkp` pada company yang sudah punya transaksi memerlukan konfirmasi eksplisit dengan pratinjau dampak.

### Yang wajib ditetapkan konsultan pajak

Seluruh nilai berikut adalah **konfigurasi, bukan keputusan desain**: tarif PPN yang berlaku dan tanggal berlakunya · syarat formal faktur pajak agar dapat dikreditkan · batas waktu pengkreditan pajak masukan · tarif dan kategori PPh potong pungut per jenis jasa · tarif untuk partner tanpa NPWP · tenggat setor dan lapor per jenis pajak · aturan dan batas waktu faktur pajak pengganti · perlakuan pajak masukan yang tidak dapat dikreditkan · format berkas untuk pelaporan.

---

## 12. Testing Strategy

**Unit.** Pemilihan kode pajak berdasarkan tanggal dokumen di sekitar batas perubahan tarif · perhitungan untuk seluruh basis (neto, bruto) · perhitungan PPh untuk partner ber-NPWP dan tidak.

**Reproduksibilitas — yang terpenting di modul ini.** Dokumen bertanggal sebelum perubahan tarif, dihitung ulang setelah tarif berubah, menghasilkan angka yang sama persis. Ini diuji dengan mengubah tarif di tengah rangkaian pengujian.

**Invarian.** Setelah rangkaian transaksi acak: jumlah buku pajak per kode sama dengan saldo akun pajak terkait di buku besar · jumlah nomor seri terpakai ditambah batal ditambah tersisa sama dengan total dialokasikan.

**Konkurensi.** Sepuluh penerbitan faktur pajak bersamaan menghasilkan sepuluh nomor berurutan tanpa celah dan tanpa duplikat.

**Negatif.** Company non-PKP menerbitkan faktur pajak ditolak · nomor seri di luar rentang ditolak · pemakaian ulang nomor batal ditolak · posting ke masa yang sudah dibekukan ditolak · `PATCH` tarif pada kode terpakai ditolak.

**E2E.** Satu masa penuh dari transaksi pertama sampai laporan dibekukan · pembetulan setelah pelaporan dengan faktur pengganti · perubahan tarif di tengah tahun dengan dokumen di kedua sisi tanggal berlaku.

---

## 13. Future Enhancements

- **Integrasi langsung** ke sistem pelaporan otoritas pajak, menggantikan ekspor dan unggah manual.
- **Validasi otomatis faktur pajak masukan** terhadap basis data otoritas.
- **Pengingat tenggat** per jenis pajak, terhubung ke modul Notifikasi.
- **Proyeksi kewajiban pajak** berjalan, sehingga kas dapat disiapkan sebelum tenggat.
- **Skema pajak khusus** — kawasan berikat, fasilitas, dan sektor dengan perlakuan berbeda.
- **Pajak daerah** untuk restoran dan hotel, relevan bagi solusi industri di Fase 5.
- **Multi yurisdiksi** untuk company di luar Indonesia, memakai model kode pajak yang sama.
- **Pemeriksaan kesiapan audit** — daftar temuan yang biasanya ditanyakan pemeriksa, diperiksa otomatis.
