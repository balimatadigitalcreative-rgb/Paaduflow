# Module Design: Manufacturing
*Phase 3 — Operations. Modul dengan ketergantungan terdalam pada Persediaan.*

**Cakupan:** Bill of Material · Rute & Stasiun Kerja · Perintah Kerja · Pengeluaran Bahan · Pencatatan Hasil · Barang Dalam Proses · Perhitungan Biaya Produksi · Selisih · Kendali Mutu · Subkontrak · Silsilah Batch.
**Dependency:** Modul 01, 02, 03, 05 (Persediaan), 06 (Pembelian), 07 (Akuntansi), 10 (HRIS), 12 (Aset).

---

## 1. Business Problem

Manufaktur adalah tempat biaya paling mudah hilang tanpa jejak.

Tiga kegagalan model menyebabkannya. **Tidak ada akun penampung untuk barang dalam proses** — bahan keluar gudang dan hilang dari neraca sampai barang jadi muncul, sehingga selama produksi berjalan perusahaan tidak tahu berapa nilai yang sedang menempel di lantai pabrik. **Resep produksi diubah di tempat**, sehingga perintah kerja bulan lalu ikut berubah komposisinya dan harga pokoknya tidak lagi dapat dijelaskan. **Bahan dikonsumsi otomatis sesuai resep**, sehingga pemakaian berlebih, susut, dan pencurian tidak pernah terlihat — angka selalu cocok karena memang dipaksa cocok.

Untuk pabrik kecil dan menengah, ketiganya berarti harga pokok yang salah, dan harga jual yang ditetapkan dari angka yang salah.

---

## 2. Goals

- **Barang dalam proses adalah akun nyata**, bukan konsep. Bahan yang keluar gudang punya tempat sampai hasilnya diterima.
- **Resep berversi dan bertanggal berlaku.** Perintah kerja membekukan resep saat dirilis.
- Pemakaian aktual dicatat, bukan diasumsikan dari resep. Selisih terlihat, bukan disembunyikan.
- Harga pokok produksi terbentuk dari bahan, tenaga kerja, dan overhead yang benar-benar terjadi.
- Silsilah batch lengkap: dari bahan masuk sampai barang jadi terjual.
- Kendali mutu dapat menghentikan barang sebelum masuk persediaan siap jual.

---

## 3. User Stories

- Sebagai manajer produksi, saya ingin tahu berapa nilai yang sedang ada di lantai produksi hari ini.
- Sebagai manajer produksi, saya ingin mengubah resep tanpa mengubah perintah kerja yang sudah berjalan.
- Sebagai kepala produksi, saya ingin tahu bila pemakaian bahan melebihi resep, bukan menemukannya saat stok opname.
- Sebagai akuntan, saya ingin harga pokok produksi dihitung dari biaya nyata, bukan dari estimasi.
- Sebagai QC, saya ingin menahan hasil produksi yang tidak lolos sebelum masuk gudang siap jual.
- Sebagai QC, saya ingin menelusuri batch bahan mana yang dipakai di batch produk mana.
- Sebagai perencana, saya ingin tahu bahan apa yang perlu dibeli untuk memenuhi rencana produksi.
- Sebagai manajer, saya ingin membandingkan biaya rencana dan biaya aktual per perintah kerja.

---

## 4. Functional Requirements

**Bill of material.** Berversi dengan tanggal berlaku. Komposisi bahan dengan kuantitas per unit hasil, toleransi susut yang diharapkan, dan produk sampingan. BOM bertingkat untuk produk rakitan.

**Stasiun kerja dan rute.** Urutan operasi dengan waktu standar, tarif tenaga kerja, dan tarif overhead per stasiun. **Rute bersifat opsional** — pabrik perakitan sederhana dapat berjalan tanpa rute, dengan biaya konversi datar per perintah kerja.

**Perintah kerja.** Dibuat dari rencana produksi, dari pesanan penjualan, atau manual. **Saat dirilis, BOM dan rute dibekukan sebagai snapshot** — perubahan resep setelah itu tidak memengaruhinya.

**Pengeluaran bahan.** Eksplisit sebagai default: bahan dikeluarkan dari gudang ke perintah kerja, dengan batch dan nomor seri dicatat. **Konsumsi otomatis sesuai resep hanya diizinkan untuk barang bernilai rendah**, dan itu pilihan per kategori, bukan default global.

**Pencatatan hasil.** Barang jadi diterima ke gudang, dengan batch baru yang membawa silsilah bahannya. Sisa dan produk sampingan dicatat terpisah dengan nilainya sendiri.

**Barang dalam proses.** Akun penampung per perintah kerja. Bahan, tenaga kerja, dan overhead masuk; nilai barang jadi dan sisa keluar. **Saldo tersisa saat perintah kerja ditutup adalah selisih**, dan wajib dijelaskan.

**Biaya tenaga kerja.** Dari jam kerja yang dicatat di stasiun, dikalikan tarif stasiun. Bila terhubung ke Modul 10, jam dapat berasal dari kehadiran.

**Overhead.** Dibebankan dengan tarif per jam mesin, per jam tenaga kerja, atau per unit — dikonfigurasi per stasiun.

**Selisih.** Selisih pemakaian bahan, selisih hasil, dan selisih waktu kerja — dihitung terhadap snapshot BOM perintah kerja, bukan terhadap BOM terbaru.

**Kendali mutu.** Titik pemeriksaan pada penerimaan bahan, dalam proses, dan hasil akhir. Hasil yang tidak lolos masuk gudang karantina, bukan gudang siap jual.

**Subkontrak.** Bahan dikirim ke pihak ketiga, hasil diterima kembali. Bahan tetap milik perusahaan dan tercatat di gudang subkontraktor.

**Rencana produksi.** Kebutuhan bahan dihitung dari rencana dikurangi stok tersedia dan pesanan pembelian terbuka, menghasilkan usulan pembelian.

---

## 5. Non Functional Requirements

- **Saldo barang dalam proses di GL wajib selalu sama** dengan jumlah nilai perintah kerja yang belum ditutup. Diuji sebagai invarian.
- Snapshot BOM perintah kerja tidak pernah berubah setelah rilis.
- Perhitungan biaya perintah kerja dapat direproduksi: menghitung ulang perintah kerja yang sudah ditutup menghasilkan angka yang sama.
- Silsilah batch dua arah di bawah 2 detik untuk 12 bulan data — dipakai saat penarikan produk.
- Pengeluaran bahan dan pencatatan hasil bersifat atomik terhadap mutasi stok dan jurnal.
- Pencatatan di lantai produksi berfungsi di perangkat sentuh dan tetap dapat dipakai saat koneksi lambat.

---

## 6. Database Design

**Table: `boms`** — `company_id`, `item_id`, `version`, `output_qty`, `uom`, `valid_from`, `valid_to`, `status` (draft, active, obsolete), `routing_id` (nullable), + audit baku.

Unik: `(item_id, version)`. Mengubah resep berarti versi baru, bukan pengubahan baris.

**Table: `bom_lines`** — `bom_id`, `line_no`, `component_item_id`, `qty_per_output`, `uom`, `scrap_pct`, `is_optional`, `operation_no`
**Table: `bom_byproducts`** — `bom_id`, `item_id`, `qty_per_output`, `valuation_method` (market, cost_share, zero)

**Table: `work_centers`** — `company_id`, `code`, `name`, `capacity_per_hour`, `labor_rate`, `overhead_rate`, `overhead_basis` (machine_hour, labor_hour, unit), `asset_id` (nullable, tautan ke mesin di Modul 12)

**Table: `routings`** dan **`routing_operations`** — `sequence`, `work_center_id`, `setup_minutes`, `run_minutes_per_unit`, `description`

**Table: `work_orders`**

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| tenant_id, company_id | UUID | |
| number | varchar | diberikan saat rilis |
| item_id, bom_id | UUID | |
| planned_qty, produced_qty, scrapped_qty | numeric | |
| warehouse_id, output_warehouse_id | UUID | |
| planned_start, planned_end, actual_start, actual_end | | |
| status | enum | draft, released, in_progress, completed, closed, cancelled |
| bom_snapshot | jsonb | **dibekukan saat rilis** |
| routing_snapshot | jsonb | dibekukan saat rilis |
| wip_material, wip_labor, wip_overhead | numeric | akumulasi |
| output_value, scrap_value, variance | numeric | |
| source_type, source_id | | pesanan penjualan atau rencana |
| document_version | int | |

`bom_snapshot` adalah inti keputusan ini. Perintah kerja yang sudah dirilis tidak pernah berubah komposisinya, meski BOM sumbernya direvisi keesokan harinya.

**Table: `work_order_materials`** — `work_order_id`, `component_item_id`, `qty_planned`, `qty_issued`, `qty_returned`, `variance`
**Table: `material_issues`** dan **`material_issue_lines`** — pengeluaran bahan dengan batch dan nomor seri, terhubung ke mutasi stok di Modul 05.

**Table: `production_outputs`** — `work_order_id`, `item_id`, `type` (finished, byproduct, scrap), `qty`, `batch_id`, `unit_cost`, `total_value`, `qc_status`, `warehouse_id`, `recorded_at`

**Table: `batch_genealogy`** — `output_batch_id`, `input_batch_id`, `work_order_id`, `qty_consumed`

Tabel inilah yang menjawab "batch bahan mana masuk ke batch produk mana", dua arah, dalam satu kueri.

**Table: `labor_entries`** — `work_order_id`, `operation_no`, `work_center_id`, `employee_id`, `start_at`, `end_at`, `minutes`, `labor_cost`

**Table: `qc_inspections`** — `subject_type` (receipt, in_process, output), `subject_id`, `checklist_id`, `result` (pass, fail, conditional), `inspector_id`, `notes`, `disposition` (accept, quarantine, rework, reject)

---

## 7. API Design

```
GET    /v1/companies/{id}/boms?item_id=&as_of=
POST   /v1/companies/{id}/boms                  -> versi baru, bukan pengubahan
POST   /v1/boms/{id}/activate
GET    /v1/boms/{id}/explode?qty=               -> kebutuhan bahan bertingkat

POST   /v1/companies/{id}/work-orders
POST   /v1/work-orders/{id}/release             -> membekukan snapshot BOM dan rute
POST   /v1/work-orders/{id}/issue-materials     -> body: lines[{item, qty, batch, serials}]
POST   /v1/work-orders/{id}/return-materials
POST   /v1/work-orders/{id}/record-labor
POST   /v1/work-orders/{id}/record-output       -> body: qty, type, batch, qc_required
POST   /v1/work-orders/{id}/complete            -> berhenti menerima input
POST   /v1/work-orders/{id}/close               -> menghitung biaya akhir, mengosongkan WIP
GET    /v1/work-orders/{id}/cost-summary        -> rencana vs aktual, per komponen biaya

POST   /v1/companies/{id}/qc-inspections
POST   /v1/qc-inspections/{id}/disposition

POST   /v1/companies/{id}/subcontract-orders
POST   /v1/subcontract-orders/{id}/ship-materials
POST   /v1/subcontract-orders/{id}/receive-output

GET    /v1/batches/{id}/genealogy?direction=forward|backward
POST   /v1/companies/{id}/production-plans
GET    /v1/production-plans/{id}/material-requirements  -> usulan pembelian
GET    /v1/companies/{id}/reports/wip?as_of=
GET    /v1/companies/{id}/reports/production-variance?period=
```

### Kontrak yang mengikat

**`/release` membekukan BOM dan rute sebagai snapshot.** Setelah itu, endpoint mana pun yang membaca komposisi perintah kerja membaca snapshot, bukan BOM sumbernya.

**`/issue-materials` adalah eksplisit dan wajib.** Konsumsi otomatis sesuai resep hanya berlaku untuk kategori item yang dikonfigurasi mengizinkannya, dan tetap menghasilkan baris pengeluaran nyata — bukan pengurangan diam-diam.

**`/close` menghitung biaya akhir dan mengosongkan WIP.** Sisa saldo menjadi selisih yang diposting ke akun selisih produksi. **Perintah kerja tidak dapat ditutup bila selisihnya melebihi ambang** tanpa persetujuan — karena selisih besar biasanya berarti ada yang tidak tercatat, bukan ada yang benar-benar hilang.

**`/record-output` dengan `qc_required` menempatkan hasil di gudang karantina**, bukan gudang siap jual. Barang berpindah hanya setelah QC meluluskannya.

---

## 8. UI Flow

**BOM** — pohon komponen bertingkat dengan biaya per level. Versi berdampingan dengan penanda perbedaan, sehingga perubahan resep dapat ditinjau sebelum diaktifkan.

**Perintah kerja** — papan status per tahap: dirilis, berjalan, selesai, ditutup. Kartu menampilkan progres kuantitas dan nilai WIP berjalan.

**Layar lantai produksi** — dirancang untuk sentuh dan sarung tangan: tombol besar untuk mulai operasi, catat hasil, dan laporkan masalah. Pemindaian batch bahan saat dikeluarkan.

**Ringkasan biaya perintah kerja** — rencana versus aktual per komponen biaya, dengan selisih ditandai dan dapat ditelusuri ke transaksinya.

**Silsilah batch** — pohon dua arah, dari bahan ke produk dan sebaliknya, dengan pelanggan di ujungnya.

**Kendali mutu** — daftar kerja inspeksi, formulir periksa, dan keputusan disposisi.

**Rencana produksi** — kebutuhan bahan dengan kolom stok tersedia, pesanan terbuka, dan kekurangan, langsung menghasilkan usulan pembelian.

---

## 9. Business Flow

Rencana produksi dibuat → kebutuhan bahan dihitung → kekurangan menghasilkan usulan pembelian di Modul 06 → perintah kerja dibuat dan dirilis, **BOM dibekukan** → bahan dikeluarkan dari gudang, mutasi stok terjadi, nilainya masuk ke WIP → operasi dijalankan, jam kerja dicatat, biaya tenaga kerja dan overhead masuk ke WIP → hasil dicatat, batch baru terbentuk dengan silsilahnya → QC memeriksa → yang lolos masuk gudang siap jual, yang gagal masuk karantina.

Perintah kerja ditutup: total WIP dibagi ke nilai barang jadi dan sisa → selisih dihitung terhadap snapshot BOM → jurnal diposting: WIP dikosongkan, persediaan barang jadi bertambah, selisih ke akun selisih produksi.

Bila selisih melebihi ambang: penutupan memerlukan persetujuan dan alasan. Biasanya penyebabnya bahan yang dipakai tetapi tidak dicatat, atau hasil yang belum dicatat — keduanya masalah pencatatan, bukan masalah biaya.

---

## 10. Permission Matrix

| Aksi | Tenant Owner | Company Admin | Manajer Produksi | Operator | QC | Finance |
|---|---|---|---|---|---|---|
| Lihat BOM | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Buat dan aktifkan versi BOM** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Buat perintah kerja | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Rilis perintah kerja | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Keluarkan bahan | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Catat hasil | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Keputusan disposisi QC** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Tutup perintah kerja** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Setujui selisih di atas ambang** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Ubah tarif stasiun kerja | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

**QC tidak berada di bawah produksi.** Orang yang dikejar target hasil tidak boleh menjadi orang yang memutuskan hasilnya lolos. Ini pemisahan tugas yang paling sering dilanggar di pabrik kecil, dan konsekuensinya sampai ke pelanggan.

**Manajer produksi tidak dapat menyetujui selisihnya sendiri.**

---

## 11. Validation Rules

- BOM tidak dapat diaktifkan bila komponennya memuat dirinya sendiri, langsung maupun bertingkat.
- BOM yang sudah dipakai perintah kerja tidak dapat diubah; hanya diberi versi baru.
- Perintah kerja tidak dapat dirilis tanpa BOM aktif pada tanggal rilis.
- Bahan tidak dapat dikeluarkan ke perintah kerja berstatus `draft` atau `closed`.
- Pengeluaran bahan mengikuti aturan stok Modul 05, termasuk pelacakan batch dan nomor seri.
- Hasil tidak dapat dicatat melebihi kuantitas rencana di luar toleransi tanpa persetujuan.
- Perintah kerja tidak dapat ditutup bila masih ada operasi berjalan atau hasil menunggu QC.
- Selisih melebihi ambang memerlukan alasan dan persetujuan sebelum penutupan.
- Batch hasil wajib memiliki silsilah; hasil tanpa bahan tercatat ditolak.
- Barang di gudang karantina tidak dapat dijual maupun dipakai produksi lain.

### Yang wajib divalidasi profesional

**Metode pembebanan overhead** yang diakui · **perlakuan selisih produksi** dalam laporan keuangan — dibebankan ke harga pokok penjualan atau dialokasikan ke persediaan · **penilaian produk sampingan dan sisa** · **penilaian barang dalam proses** pada akhir periode.

---

## 12. Testing Strategy

**Unit.** Penguraian BOM bertingkat termasuk deteksi lingkaran · perhitungan kebutuhan bahan dengan toleransi susut · pembagian biaya WIP ke barang jadi, produk sampingan, dan sisa · perhitungan selisih terhadap snapshot.

**Snapshot.** Perintah kerja dirilis, BOM sumber diubah, biaya dihitung ulang: hasilnya memakai snapshot, bukan BOM baru.

**Invarian — yang terpenting di modul ini.** Saldo akun WIP di GL sama dengan jumlah nilai perintah kerja belum ditutup · bahan yang keluar dari persediaan sama dengan bahan yang masuk WIP · nilai keluar WIP sama dengan nilai barang jadi ditambah sisa ditambah selisih · silsilah batch tidak pernah memuat lingkaran.

**Integration.** Pengeluaran bahan menghasilkan mutasi stok dan jurnal secara atomik · hasil yang menunggu QC tidak muncul sebagai stok tersedia · penutupan perintah kerja mengosongkan WIP tepat sampai nol.

**Negatif.** BOM melingkar ditolak · pengeluaran ke perintah kerja tertutup ditolak · penjualan barang karantina ditolak · manajer produksi menyetujui selisihnya sendiri ditolak · penutupan dengan hasil menunggu QC ditolak.

**E2E.** Rencana produksi sampai barang jadi terjual, dengan harga pokok yang dapat ditelusuri · penarikan produk: dari pelanggan mundur ke batch bahan dan pemasoknya · subkontrak penuh · perubahan BOM di tengah dengan dua perintah kerja di kedua sisi.

---

## 13. Future Enhancements

- **Penjadwalan kapasitas terbatas** dengan urutan operasi yang mempertimbangkan beban stasiun nyata.
- **MRP penuh** dengan waktu tunggu, ukuran lot, dan stok pengaman.
- **Biaya standar dengan analisis selisih lengkap** — selisih harga bahan, pemakaian, tarif, dan efisiensi.
- **Perawatan preventif** terhubung ke Modul 12, dengan penjadwalan berdasarkan jam mesin.
- **Pengumpulan data mesin otomatis** lewat sensor, menggantikan input manual jam kerja.
- **Sertifikat analisis** per batch untuk industri yang mensyaratkannya.
- **Optimasi hasil** dengan AI yang menandai pola pemakaian berlebih sebelum menjadi kebiasaan.
- **Manufaktur sesuai pesanan** dengan konfigurator produk dan BOM yang terbentuk dari pilihan pelanggan.
