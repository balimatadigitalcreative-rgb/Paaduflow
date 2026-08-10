# Module Design: Business Intelligence
*Phase 4 — Growth. Membangun di atas lapisan semantik dari Modul 15, bukan mendefinisikan ulang metrik.*

**Cakupan:** Dashboard · Widget · Laporan Kustom · Konsolidasi Lintas Company · Snapshot Terjadwal · Kesegaran Data · Berbagi & Ekspor · Tata Kelola Metrik.
**Dependency:** Modul 01, 02, 03, 07 (Akuntansi), 14 (Otomasi), 15 (Lapisan Semantik).

---

## 1. Business Problem

Setiap modul sudah punya laporannya sendiri, dan itu justru masalahnya: pemilik bisnis harus membuka enam layar untuk menjawab satu pertanyaan, dan tidak ada tempat yang menyatukan gambaran.

Tiga kegagalan model muncul saat BI dibangun terburu-buru. **Metrik didefinisikan ulang di lapisan BI**, sehingga "penjualan" di dashboard berbeda dari "penjualan" di laba rugi, dan rapat dihabiskan mencari tahu mana yang benar. **Dashboard dibagikan sebagai gambar atau data yang dibekukan**, sehingga orang yang tidak berhak melihat angka tertentu tetap melihatnya. **Tidak ada yang tahu kapan angka terakhir dihitung**, sehingga keputusan diambil dari data kemarin yang dikira data hari ini.

---

## 2. Goals

- **BI tidak mendefinisikan metrik. Ia mengonsumsinya** dari lapisan semantik.
- **Dashboard yang dibagikan bukan data yang dibagikan.** Penyaringan izin terjadi saat kueri, bukan saat tampil.
- Setiap widget menyatakan kapan datanya dihitung.
- Setiap angka dapat ditelusuri ke transaksinya.
- Konsolidasi lintas company tersedia bagi yang berhak, dengan penjabaran mata uang yang benar.
- Angka yang harus cocok dengan laporan resmi dibekukan sebagai snapshot; angka operasional tetap hidup.

---

## 3. User Stories

- Sebagai pemilik grup, saya ingin melihat kinerja seluruh PT dalam satu layar.
- Sebagai manajer, saya ingin membagikan dashboard ke tim tanpa membocorkan angka yang bukan urusan mereka.
- Sebagai akuntan, saya ingin angka di dashboard sama persis dengan laporan yang saya terbitkan.
- Sebagai pengguna, saya ingin tahu angka ini dihitung kapan.
- Sebagai pengguna, saya ingin mengklik angka sampai ke transaksinya.
- Sebagai manajer, saya ingin diberi tahu bila sebuah angka melewati ambang, tanpa membuka dashboard.
- Sebagai admin, saya ingin membedakan metrik resmi dari metrik coba-coba yang dibuat orang.
- Sebagai pemilik, saya ingin dashboard saya terkirim ke email setiap Senin pagi.

---

## 4. Functional Requirements

**Dashboard.** Kumpulan widget dengan tata letak grid. Bercakupan company atau tenant. Dapat dibagikan ke pengguna atau peran.

**Widget.** Kartu KPI, grafik garis, batang, area, donat, tabel, dan tabel pivot. Setiap widget merujuk **satu metrik dari katalog semantik** dengan dimensi, filter, dan rentang waktunya.

**Filter dashboard.** Berlaku ke seluruh widget: periode, company, dan dimensi. Filter tersimpan di URL sehingga tampilan dapat dikirim, sesuai skema di Information Architecture §2.

**Laporan kustom.** Pembangun tabel dan pivot dari metrik dan dimensi, dapat disimpan sebagai saved view, dan dijadwalkan.

**Konsolidasi lintas company.** Untuk pengguna dengan akses lintas company: agregasi dengan penjabaran mata uang ke mata uang pelaporan yang dipilih. Company dengan tahun fiskal berbeda ditangani lewat penyelarasan periode kalender, dan perbedaannya **dinyatakan di antarmuka**, bukan disembunyikan.

**Kesegaran data.** Setiap widget menampilkan waktu perhitungan terakhir. Widget yang gagal disegarkan menampilkan angka terakhir **dengan penanda basi**, bukan angka kosong maupun angka lama tanpa keterangan.

**Snapshot.** Dashboard dapat dibekukan per periode. Snapshot tidak berubah meski data sumber dikoreksi — pola yang sama dengan laporan pajak dan slip gaji.

**Ambang dan peringatan.** Ditetapkan per widget, dan **dijalankan lewat Modul 14**, bukan lewat mesin peringatan tersendiri.

**Berbagi dan ekspor.** Berbagi dashboard membagikan definisinya, bukan datanya. Ekspor menghasilkan apa yang dilihat pengekspor, dan tercatat di audit log.

**Tata kelola metrik.** Metrik bertanda **tersertifikasi** atau **draf**. Metrik draf dapat dibuat pengguna berwenang untuk eksplorasi; hanya metrik tersertifikasi boleh dipakai di dashboard yang dibagikan luas.

---

## 5. Non Functional Requirements

- **Penyaringan izin terjadi di dalam kueri**, tidak pernah setelah data diambil. Ini yang membuat berbagi dashboard aman.
- Dashboard dengan 12 widget dimuat di bawah 3 detik pada company besar, dengan cache per kombinasi metrik, filter, dan konteks izin.
- **Cache bercakupan konteks izin.** Dua pengguna dengan izin berbeda tidak pernah berbagi entri cache — ini persyaratan keamanan, bukan optimasi.
- Kueri berat berjalan asinkron dengan notifikasi, tidak menahan halaman.
- Sumber data adalah replika baca terpisah, sehingga beban analitis tidak pernah memperlambat transaksi.
- Penelusuran dari angka ke transaksi di bawah 500ms.

### Keputusan penyimpanan analitis

**Mulai dengan replika baca dan lapisan semantik dengan cache.** Gudang data kolumnar hanya dibangun bila terbukti dibutuhkan — ketika volume atau kompleksitas kueri melewati ambang yang terukur.

Membangun pipa ETL dan gudang data sejak awal menambah lapisan yang harus dijaga konsistensinya, dan **selisih antara gudang dan sumber adalah kelas bug yang paling sulit dijelaskan ke pengguna**: dashboard bilang satu angka, laporan bilang angka lain, dan keduanya "benar".

---

## 6. Database Design

**Table: `dashboards`** — `tenant_id`, `company_id` (nullable untuk tingkat tenant), `name`, `description`, `layout` jsonb, `scope` (company, tenant), `owner_id`, `visibility` (private, shared, role_based), `status`, + audit baku.

**Table: `dashboard_widgets`** — `dashboard_id`, `position` jsonb, `type`, `metric_key`, `dimensions` jsonb, `filters` jsonb, `time_range`, `comparison`, `drill_target`, `title`

`metric_key` merujuk katalog semantik Modul 15. **Widget tidak menyimpan rumus.**

**Table: `dashboard_shares`** — `dashboard_id`, `principal_type` (user, role), `principal_id`, `can_edit`

**Table: `dashboard_snapshots`** — `dashboard_id`, `period`, `frozen_at`, `frozen_by`, `data` jsonb, `permission_context` jsonb

`permission_context` disimpan karena snapshot adalah data yang dibekukan; siapa yang boleh membukanya harus dapat dijawab kemudian.

**Table: `custom_reports`** — `company_id`, `name`, `metrics` jsonb, `dimensions` jsonb, `filters` jsonb, `layout` (table, pivot), `owner_id`, `visibility`

**Table: `scheduled_deliveries`** — `subject_type` (dashboard, report), `subject_id`, `recipient_id`, `schedule`, `format` (pdf, xlsx, link), `last_sent_at`, `status`

Pengiriman terjadwal berjalan **dengan izin penerima**, bukan izin pembuat jadwal — sama seperti ringkasan AI di Modul 15.

**Table: `query_cache`** — `cache_key` (metrik + filter + hash konteks izin), `result` jsonb, `computed_at`, `expires_at`, `row_count`

Hash konteks izin adalah bagian kunci cache. Tanpa itu, cache menjadi jalur kebocoran.

---

## 7. API Design

```
GET    /v1/companies/{id}/dashboards
POST   /v1/companies/{id}/dashboards
POST   /v1/dashboards/{id}/share
GET    /v1/dashboards/{id}/data?period=&filters=  -> difilter izin pemanggil
POST   /v1/dashboards/{id}/snapshot?period=
GET    /v1/dashboards/{id}/snapshots

POST   /v1/companies/{id}/reports/custom
GET    /v1/reports/{id}/data
POST   /v1/reports/{id}/export                    -> asinkron bila besar, tercatat

GET    /v1/widgets/{id}/drill?dimension=&value=   -> menuju transaksi sumber
GET    /v1/tenants/{id}/consolidated?metric=&currency=&period=

POST   /v1/scheduled-deliveries
GET    /v1/companies/{id}/metrics/certified       -> katalog yang boleh dipakai luas
POST   /v1/metrics/{key}/certify                  -> izin terpisah
```

### Kontrak yang mengikat

**`/dashboards/{id}/data` selalu difilter dengan izin pemanggil.** Dua pengguna memanggil endpoint yang sama dengan `id` yang sama dan menerima angka berbeda. Ini perilaku yang benar, dan wajib diuji secara eksplisit.

**BI tidak punya endpoint definisi metrik.** Metrik dibuat lewat `/semantic/metrics` di Modul 15, dan BI hanya membacanya.

**Ekspor menghasilkan apa yang dilihat pengekspor**, dan setiap ekspor tercatat di audit log dengan cakupan datanya.

**Setiap respons data membawa `computed_at` dan `row_count`.** Widget yang tidak dapat menampilkan keduanya tidak menampilkan angkanya.

**Konsolidasi lintas company memerlukan akses ke seluruh company yang diagregasi.** Tidak ada agregasi sebagian yang menyembunyikan bahwa sebagian data tidak terlihat — bila pengguna tidak punya akses penuh, sistem menyatakan cakupan yang benar-benar termasuk.

---

## 8. UI Flow

**Daftar dashboard** — milik sendiri, dibagikan ke saya, dan tingkat tenant.

**Tampilan dashboard** — filter global di atas, grid widget di bawah. Setiap widget menampilkan **waktu perhitungan** di sudut, dan menu untuk menyegarkan, menelusuri, atau mengekspor.

**Pembangun widget** — pilih metrik dari katalog (dengan penanda tersertifikasi atau draf), lalu dimensi, filter, dan rentang. Pratinjau langsung. Metrik draf memunculkan peringatan saat dipakai di dashboard yang dibagikan.

**Penelusuran** — klik segmen grafik atau angka membuka daftar transaksi yang menyusunnya, dengan filter yang sama. Ini penerapan Archetype 6.

**Konsolidasi** — pemilih company dengan mata uang pelaporan, dan **catatan eksplisit** bila company yang diagregasi punya tahun fiskal berbeda.

**Snapshot** — daftar per periode dengan penanda beku, dan pembanding terhadap data hidup untuk melihat apa yang berubah sejak dibekukan.

---

## 9. Business Flow

Metrik didefinisikan dan disertifikasi di lapisan semantik → dashboard disusun dari metrik tersertifikasi → dibagikan ke peran atau pengguna.

Saat dibuka: setiap widget mengirim kueri semantik dengan konteks izin pemanggil → cache diperiksa dengan kunci yang memuat hash konteks izin → hasil dikembalikan beserta `computed_at`.

Untuk periode yang harus cocok dengan laporan resmi: dashboard dibekukan sebagai snapshot setelah periode ditutup di Akuntansi.

Untuk peringatan: ambang ditetapkan di widget, lalu **aturan otomasi dibuat di Modul 14** dengan pemicu terjadwal yang mengevaluasi metrik itu.

---

## 10. Permission Matrix

| Aksi | Tenant Owner | Company Admin | Manajer | Pengguna |
|---|---|---|---|---|
| Lihat dashboard yang dibagikan | ✅ | ✅ | ✅ | ✅ |
| **Melihat angka** | mengikuti izin data masing-masing | | | |
| Buat dashboard pribadi | ✅ | ✅ | ✅ | ✅ |
| Bagikan dashboard | ✅ | ✅ | ✅ | ❌ |
| Buat dashboard tingkat tenant | ✅ | ❌ | ❌ | ❌ |
| Buat metrik draf | ✅ | ✅ | ✅ | ❌ |
| **Sertifikasi metrik** | ✅ | ✅ | ❌ | ❌ |
| Bekukan snapshot | ✅ | ✅ | ❌ | ❌ |
| Lihat konsolidasi lintas company | ✅ | ⚠️ | ❌ | ❌ |
| Ekspor | ✅ | ✅ | ✅ | ✅ (sebatas yang terlihat) |

⚠️ hanya untuk company yang benar-benar diaksesnya.

**Membagikan dashboard tidak pernah membagikan akses data.** Penerima melihat dashboard yang sama dengan angka menurut izinnya sendiri — dan bila ia tidak punya akses ke metrik tertentu, widget itu menampilkan pesan yang jujur, bukan angka nol.

---

## 11. Validation Rules

- Widget hanya dapat merujuk metrik yang ada di katalog dan yang dapat diakses pembuatnya.
- Metrik draf tidak dapat dipakai di dashboard tingkat tenant.
- Dashboard tidak dapat dibagikan ke pengguna di company yang tidak diaksesnya.
- Snapshot hanya dapat dibekukan untuk periode yang sudah ditutup di Akuntansi.
- Konsolidasi memerlukan kurs untuk seluruh kombinasi mata uang dan periode; bila kurang, ditolak dengan menyebutkan yang kurang.
- Kunci cache wajib memuat hash konteks izin; kueri tanpa konteks izin ditolak di tingkat layanan.
- Ekspor melebihi ambang ukuran berjalan asinkron.
- Pengiriman terjadwal berhenti bila penerimanya kehilangan akses, dengan notifikasi ke pembuat jadwal.

---

## 12. Testing Strategy

**Keamanan — yang terpenting di modul ini.** Dua pengguna membuka dashboard yang sama menerima angka sesuai izin masing-masing · cache satu pengguna tidak pernah terpakai pengguna lain · penelusuran tidak menampilkan transaksi di luar izin · ekspor tidak memuat data di luar izin pengekspor · konsolidasi tidak membocorkan keberadaan company yang tidak diakses.

**Konsistensi.** Angka widget sama persis dengan laporan resmi untuk metrik yang sama · angka setelah penelusuran berjumlah sama dengan angka agregatnya.

**Kesegaran.** Widget yang gagal disegarkan menampilkan penanda basi, bukan angka kosong maupun angka lama tanpa keterangan.

**Snapshot.** Data sumber dikoreksi setelah snapshot dibekukan: snapshot tidak berubah, dan pembanding menunjukkan selisihnya.

**Kinerja.** Dashboard 12 widget di bawah 3 detik pada company dengan 500.000 transaksi · beban analitis tidak menaikkan latensi transaksi.

**E2E.** Metrik dibuat, disertifikasi, dipakai di dashboard, dibagikan, dan dilihat dua pengguna berbeda · dashboard dibekukan setelah tutup periode · pengiriman terjadwal ke dua penerima dengan izin berbeda.

---

## 13. Future Enhancements

- **Gudang data kolumnar** bila volume terbukti membutuhkannya, dengan rekonsiliasi otomatis terhadap sumber.
- **Deteksi anomali** yang menandai penyimpangan pola tanpa perlu ambang ditetapkan manual.
- **Naratif otomatis** — penjelasan singkat perubahan angka, memakai AI dari Modul 15 dengan jejak yang sama.
- **Perbandingan tolok ukur industri** secara anonim antar tenant yang ikut serta.
- **Dashboard untuk pihak luar** — investor atau bank, dengan cakupan data yang dibatasi ketat dan berjangka waktu.
- **Analisis kohort dan retensi pelanggan** sebagai metrik bawaan.
- **Perencanaan dan skenario** — mengubah asumsi dan melihat dampaknya di dashboard yang sama.
- **Dashboard mobile** yang dirancang ulang, bukan versi diperkecil.
