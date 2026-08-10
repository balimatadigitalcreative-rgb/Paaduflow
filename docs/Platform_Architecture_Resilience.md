# Platform Architecture: Resilience, Multi Region & Disaster Recovery
*Phase 5 — Enterprise. Bukan modul produk, melainkan kemampuan platform.*

**Catatan struktur.** Dokumen ini tidak memakai template modul, karena ia tidak punya entitas, layar, maupun matriks izin dalam pengertian yang sama. Memaksanya ke template itu akan menghasilkan bagian-bagian kosong yang menyamarkan bahwa isinya berbeda. Yang tetap dipertahankan: masalah, sasaran, keputusan, pengujian, dan risiko.

**Menyentuh:** seluruh modul.

---

## 1. Business Problem

"Sistem harus selalu tersedia" adalah persyaratan yang terdengar jelas dan sebenarnya tidak berarti apa-apa. Ketersediaan sempurna tidak dapat dibeli; yang dapat dibeli adalah **ketersediaan tertentu dengan biaya tertentu**, dan keputusannya bersifat komersial, bukan teknis.

Tiga kesalahan muncul saat ini tidak diputuskan eksplisit. **Multi region dibangun untuk alasan yang salah** — untuk ketersediaan, padahal kebutuhan sebenarnya kedaulatan data, atau sebaliknya. Keduanya masalah berbeda dengan solusi dan biaya yang sangat berbeda. **Cadangan tidak pernah diuji pulih**, sehingga baru ketahuan tidak berfungsi pada hari terburuk. **Tidak ada yang tahu apa yang seharusnya tetap berjalan** saat sebagian sistem mati, sehingga saat insiden terjadi keputusan diambil dengan panik.

---

## 2. Dua Masalah yang Sering Dicampur

| | **Kedaulatan data** | **Ketersediaan** |
|---|---|---|
| Pertanyaan | Data ini boleh disimpan di mana? | Apa yang terjadi bila satu tempat mati? |
| Pendorong | Regulasi, kontrak pelanggan | Toleransi henti layanan |
| Solusi | Tenant disematkan ke region tertentu | Redundansi di dalam region, siaga di region lain |
| Biaya | Menengah, kompleksitas operasional | Tinggi, tumbuh cepat mendekati sempurna |

**Keduanya diputuskan terpisah.** Tenant di Indonesia yang menuntut datanya tetap di Indonesia belum tentu menuntut pemulihan dalam lima menit — dan sebaliknya.

Modul 01 sudah menyediakan kolom `region` pada tenant. Dokumen ini menjelaskan apa artinya.

---

## 3. Keputusan Inti

### 3.1 Tenant disematkan ke satu region. Tidak ada penulisan lintas region.

Arsitektur aktif-aktif lintas region untuk tenant yang sama berarti dua tempat dapat menulis data yang sama secara bersamaan, dan konflik harus diselesaikan kemudian.

Untuk data finansial, **tidak ada resolusi konflik yang dapat diterima.** Dua faktur dengan nomor sama, dua posting jurnal atas transaksi yang sama, dua pengeluaran stok atas unit terakhir — seluruhnya adalah kesalahan yang tidak dapat "digabungkan". Modul 05 sudah membuat pengecualian sadar untuk POS luring, dan pengecualian itu bekerja **hanya karena satu terminal adalah satu-satunya penulis untuk transaksinya sendiri**.

Karena itu: satu tenant, satu region penulis. Region lain berperan sebagai siaga, bukan sebagai penulis kedua.

### 3.2 Ketersediaan berjenjang, bukan seragam

| Tier | Untuk | Sasaran ketersediaan | Kehilangan data maksimal | Waktu pulih |
|---|---|---|---|---|
| Standar | Trial, Starter | Jam kerja | Menit | Jam |
| Bisnis | Business | Tinggi | Detik | Puluhan menit |
| Enterprise | Enterprise | Sangat tinggi | Mendekati nol | Menit |

Angka pastinya adalah **komitmen komersial** yang ditetapkan bersama tim bisnis dan dituangkan di perjanjian layanan. Yang ditetapkan arsitektur adalah **bentuknya**: berjenjang, terukur, dan diuji.

Menjanjikan tier tertinggi ke semua pelanggan berarti membebankan biayanya ke pelanggan UMKM yang tidak membutuhkannya — dan membuat harga produk tidak kompetitif di segmen yang paling besar.

### 3.3 Cadangan yang tidak pernah diuji pulih bukan cadangan

Uji pemulihan terjadwal, otomatis, ke lingkungan terpisah, dengan verifikasi integritas: neraca saldo seimbang, akun kontrol sama dengan buku pembantu, rantai hash audit utuh, saldo stok cocok dengan mutasi.

**Invarian yang sudah didefinisikan di modul-modul sebelumnya adalah alat verifikasi pemulihan.** Ini keuntungan tak terduga dari menetapkannya sejak awal: pemulihan dinyatakan berhasil bila seluruh invarian lolos, bukan bila proses restore selesai tanpa error.

### 3.4 Modul 01 dan 02 adalah titik kegagalan tunggal, dan itu disengaja

Resolusi konteks tenant dan izin dipanggil di **setiap** permintaan. Keduanya tidak dapat dihindari, jadi keduanya diperlakukan khusus: cache berlapis, replika baca khusus, dan **mode terdegradasi** di mana izin yang sudah di-cache tetap berlaku sementara sumbernya tidak terjangkau — dengan masa berlaku pendek dan penolakan untuk operasi sensitif.

Mode ini **tidak pernah memperluas izin.** Bila cache tidak memuat jawaban, jawabannya adalah tolak.

---

## 4. Tangga Degradasi

Ditetapkan sebagai persyaratan, bukan sebagai perilaku yang muncul sendiri.

| Yang gagal | Yang tetap berjalan |
|---|---|
| Lapisan analitik | Seluruh transaksi normal. Dashboard menampilkan penanda basi, bukan kosong |
| AI dan otomasi | Seluruh transaksi normal. Notifikasi tertunda, tidak hilang |
| Penyimpanan berkas | Transaksi normal. Unggah ditahan di antrean, unduh gagal dengan pesan jujur |
| Basis data utama | Failover ke replika siaga. Tidak ada transaksi terkonfirmasi yang hilang |
| Seluruh region | POS tetap melayani luring. Sisanya menunggu pemulihan di region cadangan |

**Kasir yang antre pelanggan tidak peduli region mana yang mati.** Itu sebabnya POS dirancang luring sejak Modul 09 — bukan sebagai fitur tambahan, melainkan sebagai satu-satunya bagian sistem yang benar-benar tidak boleh berhenti.

Setiap kegagalan menghasilkan **pesan yang jujur**, bukan layar kosong dan bukan pura-pura normal. Pengguna yang tahu apa yang sedang terjadi dapat mengambil keputusan; pengguna yang ditinggal menebak akan kehilangan kepercayaan lebih cepat daripada karena hentinya sendiri.

---

## 5. Isolasi dan Radius Ledakan

**Batas isolasi utama adalah tenant.** Seluruh kueri membawa `tenant_id` sebagai bagian indeks utama, sejak Modul 01.

**Tenant besar dipisahkan.** Tenant yang volumenya melewati ambang dipindahkan ke kelompok sumber daya tersendiri, sehingga beban satu pelanggan tidak memperlambat yang lain. Skema sudah dirancang siap di-*shard* per tenant sejak Modul 01; ini penerapannya.

**Pekerjaan berat berjalan di kelompok terpisah** dari jalur transaksi: ekspor, impor massal, penggajian, penyusutan, laporan besar. Kegagalan atau kelebihan beban di sana tidak boleh menyentuh orang yang sedang membuat faktur.

**Batas laju per tenant** untuk API dan pekerjaan asinkron, agar satu integrasi yang salah tidak menghabiskan kapasitas bersama.

---

## 6. Rilis Tanpa Henti

Seluruh keputusan skema di delapan belas modul membuat ini lebih mudah daripada biasanya.

**Migrasi bersifat menambah.** Tabel append-only — audit log, jurnal, mutasi stok, buku besar cuti — tidak pernah diubah bentuknya, hanya ditambah. Kolom baru selalu nullable dengan nilai bawaan.

**Kompatibilitas dua arah.** Versi lama dan baru berjalan bersamaan selama rilis bertahap; keduanya harus dapat membaca skema yang sama.

**Perubahan yang merusak dipecah tiga tahap:** tambah yang baru → tulis ke keduanya → berhenti memakai yang lama, di rilis terpisah dengan jeda.

**Feature flag per tenant** memungkinkan rilis bertahap dan pembatalan cepat tanpa penurunan versi.

**Migrasi besar berjalan sebagai pekerjaan latar** yang dapat dijeda, dilanjutkan, dan diawasi progresnya — bukan sebagai skrip yang menahan rilis.

---

## 7. Observabilitas

Tiga lapis, dan yang ketiga paling sering terlewat.

**Teknis.** Latensi, tingkat kesalahan, jenuh sumber daya, per endpoint dan per tenant.

**Bisnis.** Jumlah faktur diposting per jam, keberhasilan sinkronisasi POS, keberhasilan pengiriman webhook, antrean otomasi. Anomali di sini sering muncul **sebelum** metrik teknis, karena pengguna berhenti memakai fitur yang rusak sebelum sistem melaporkannya rusak.

**Invarian.** Pemeriksaan berkala terhadap invarian yang ditetapkan di seluruh modul: neraca saldo seimbang, akun kontrol sama dengan buku pembantu, WIP sama dengan perintah kerja terbuka, saldo stok sama dengan mutasi, rantai hash audit utuh, nomor dokumen tanpa celah.

**Pelanggaran invarian adalah insiden**, sekalipun tidak ada pengguna yang mengeluh — karena ia berarti data sedang salah dan belum ada yang menyadarinya.

`X-Request-Id` dari Modul 17 menghubungkan log, jejak, dan audit trail menjadi satu rangkaian yang dapat ditelusuri.

---

## 8. Respons Insiden

**Klasifikasi berdasarkan dampak pengguna**, bukan berdasarkan komponen yang rusak. "Pengguna tidak dapat menerbitkan faktur" adalah insiden besar; "replika analitik tertinggal" tidak, meski keduanya bisa berasal dari basis data yang sama.

**Komunikasi ke pelanggan bagian dari respons, bukan sesudahnya.** Halaman status yang diperbarui dan notifikasi dalam produk.

**Setiap insiden menghasilkan tinjauan tanpa menyalahkan**, dengan tindakan yang punya pemilik dan tenggat.

**Latihan berkala:** uji pemulihan cadangan, uji failover region, dan uji tangga degradasi — mematikan lapisan analitik di lingkungan uji dan memastikan transaksi memang tetap berjalan.

---

## 9. Pengujian

**Uji ketahanan.** Mematikan setiap ketergantungan satu per satu dan memverifikasi tangga degradasi §4 berperilaku sesuai yang tertulis. Ini pengujian, bukan asumsi.

**Uji pemulihan.** Restore terjadwal ke lingkungan terpisah, dengan seluruh invarian §7 dijalankan sebagai kriteria kelulusan.

**Uji failover.** Perpindahan ke replika siaga di bawah beban, memverifikasi tidak ada transaksi terkonfirmasi yang hilang.

**Uji isolasi.** Beban ekstrem pada satu tenant tidak menaikkan latensi tenant lain di luar ambang.

**Uji migrasi.** Rilis bertahap dengan dua versi berjalan bersamaan pada skema yang sama.

**Uji mode terdegradasi izin.** Cache izin berlaku saat sumber tidak terjangkau, **tidak pernah memperluas izin**, dan menolak operasi sensitif.

---

## 10. Risiko dan Item Terbuka

| Item | Status | Catatan |
|---|---|---|
| Sasaran ketersediaan per tier | **Belum ditetapkan** | Komitmen komersial, bukan keputusan teknis. Perlu keputusan bisnis sebelum perjanjian layanan disusun |
| Kebutuhan kedaulatan data | **Belum dipetakan** | Perlu masukan hukum: data apa yang wajib berada di Indonesia, dan untuk pelanggan seperti apa |
| Ambang pemisahan tenant besar | Belum diukur | Ditetapkan dari data pemakaian nyata, bukan dari perkiraan |
| Retensi cadangan | Belum ditetapkan | Terkait retensi dokumen yang sudah ditandai di Modul 03 dan 04 |
| Biaya region kedua | Belum dihitung | Menentukan apakah tier Enterprise layak secara komersial |
| Prosedur failover | Belum ditulis | Harus berupa prosedur tertulis yang dilatih, bukan pengetahuan di kepala satu orang |

---

## 11. Prinsip yang Dipegang

**Ketersediaan adalah keputusan komersial yang diwujudkan secara teknis**, bukan sebaliknya. Angkanya datang dari apa yang pelanggan bersedia bayar.

**Kedaulatan data dan ketersediaan diputuskan terpisah.** Mencampurnya menghasilkan arsitektur mahal yang tidak menyelesaikan keduanya dengan baik.

**Satu tenant, satu region penulis.** Data finansial tidak punya resolusi konflik yang dapat diterima.

**Cadangan yang tidak diuji pulih bukan cadangan.**

**Degradasi ditetapkan, bukan ditemukan saat insiden.**

**Pelanggaran invarian adalah insiden**, meski belum ada yang mengeluh.

**Kegagalan dinyatakan jujur ke pengguna.** Pura-pura normal merusak kepercayaan lebih lama daripada hentinya sendiri.
