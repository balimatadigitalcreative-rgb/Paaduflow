# Platform Architecture: Industry Solutions
*Phase 5 — Enterprise. Item terakhir roadmap.*

**Catatan struktur.** Seperti dokumen ketahanan platform, ini bukan modul. Ia **kerangka** untuk membangun solusi industri, plus disiplin yang menjaganya tidak merusak inti.

**Dependency:** seluruh modul, terutama 14 (Otomasi), 15 (Semantik), 18 (Marketplace).

---

## 1. Business Problem

Roadmap menjanjikan solusi untuk hospitality, healthcare, education, construction, dan lainnya. Janji itu punya dua cara gagal, dan keduanya fatal.

**Terlalu longgar:** setiap industri mendapat cabang kode sendiri di modul inti. Enam bulan kemudian, memperbaiki satu bug di modul Penjualan berarti menguji lima varian industri, dan tidak ada yang berani menyentuh apa pun. Success Metric di Knowledge Base — implementasi lewat konfigurasi, bukan kustomisasi kode — sudah mati sebelum pelanggan industri kelima.

**Terlalu ketat:** setiap kebutuhan industri dipaksa menjadi field kustom. Rekam medis pasien disimpan sebagai lima belas field kustom di tabel pelanggan, tanpa status, tanpa validasi, tanpa jejak audit tersendiri. Ia bekerja di demo dan gagal di audit.

---

## 2. Keputusan Inti

**Solusi industri adalah paket, bukan cabang.** Ia dirakit dari mekanisme yang sudah ada, tidak menambah jalur kode di modul inti.

Isi sebuah paket:

| Komponen | Mekanisme yang dipakai |
|---|---|
| Bagan akun preset | Modul 07 |
| Kode pajak dan aturan penentuan preset | Modul 08 |
| Jenis dokumen dan alur persetujuan | Modul 04, Flow Archetypes §2 |
| Peran dan matriks izin awal | Modul 02 |
| Field kustom, templat laporan, metrik | Modul 18, ekstensi data |
| Aturan otomasi bawaan | Modul 14 |
| Istilah tampilan | Lapisan presentasi, lihat §4 |
| Alur onboarding | Modul 01, Step 5.1 |
| Aplikasi mitra yang direkomendasikan | Modul 18 |

**Tidak satu pun memerlukan perubahan di modul inti.** Bila sebuah paket membutuhkannya, itu tanda ia bukan paket.

---

## 3. Uji Batas

Satu pertanyaan memutuskan: **apakah kebutuhan ini memerlukan entitas dengan siklus hidup, validasi, dan jejak auditnya sendiri?**

**Tidak** → paket industri. Nomor izin usaha khusus, kategori barang tambahan, urutan persetujuan berbeda, laporan wajib per sektor.

**Ya** → modul baru, dan biayanya diakui. Rekam medis pasien punya status, riwayat, kerahasiaan, dan retensi tersendiri. Kelas dan nilai siswa punya siklus semester. Kamar dan reservasi punya ketersediaan waktu yang tidak menyerupai stok mana pun.

**Menyamarkan kebutuhan modul sebagai konfigurasi tidak menghemat apa pun.** Ia memindahkan biayanya ke masa depan dan menambahkan bunga: data penting yang hidup di field kustom tidak dapat divalidasi, tidak dapat dijadikan dasar alur persetujuan, dan tidak dapat diaudit dengan benar — dan memindahkannya ke tabel yang benar setelah ada data pelanggan adalah migrasi yang menyakitkan.

### Modul vertikal adalah komitmen permanen

Setiap modul vertikal menambah permukaan yang harus dipelihara, diuji, dan didokumentasikan **selamanya**, dan hanya bermanfaat bagi sebagian pelanggan. Keputusan membangunnya adalah keputusan bisnis dengan angka: berapa pelanggan, berapa nilai kontraknya, berapa biaya pemeliharaannya per tahun.

**Alternatif yang sering lebih baik: serahkan ke mitra lewat Marketplace.** Modul 18 sudah menyediakan jalurnya, dan mitra yang memahami satu industri secara mendalam akan membangunnya lebih baik daripada tim yang memahami dua puluh industri secara dangkal.

---

## 4. Istilah Industri Hanya di Lapisan Tampilan

Rumah sakit menyebut "pasien", sekolah menyebut "siswa", hotel menyebut "tamu". Ketiganya adalah pihak yang menerima layanan dan ditagih — yaitu `customer`.

**Terjemahan istilah terjadi hanya di lapisan presentasi.** Skema tetap `customers`, API tetap `/v1/customers`, glosarium internal dari Information Architecture §4 tetap berlaku, dan laporan tetap memakai nama kanonik.

Bila entitas diganti nama sampai ke skema per industri, setiap integrasi, setiap laporan, setiap definisi metrik, dan setiap aplikasi Marketplace harus punya varian per industri. Itu bukan lima paket — itu lima produk.

**Batasnya:** overlay istilah mengubah label, bukan makna. Bila sebuah industri memakai kata yang sama untuk konsep yang berbeda, itu bukan masalah terjemahan — itu uji batas §3.

---

## 5. Industri Teregulasi Memerlukan Kemampuan Platform, Bukan Tambalan

Healthcare dan education membawa kewajiban yang menyentuh inti: klasifikasi data sensitif, persetujuan pemilik data, retensi yang lebih ketat, dan pembatasan akses berbasis kebutuhan.

Ini **tidak boleh diselesaikan per industri.** Yang dibutuhkan adalah kemampuan platform:

**Klasifikasi data.** Setiap field dapat ditandai tingkat sensitivitasnya. Tingkat tertinggi memicu enkripsi tambahan, pencatatan akses baca — pola yang sudah ada untuk data gaji di Modul 10 — dan pembatasan ekspor.

**Persetujuan dan tujuan pemakaian.** Catatan siapa menyetujui pemakaian data apa untuk tujuan apa, dan kapan dicabut.

**Retensi per klasifikasi.** Kebijakan yang dapat ditegakkan sistem, bukan diingat orang.

**Pembatasan akses berbasis kebutuhan.** Perluasan model Modul 02 yang sudah dimulai untuk data gaji: izin tingkat data, bukan hanya tingkat aksi.

Ketiganya berguna melampaui industri teregulasi — dan membangunnya sebagai kemampuan platform berarti pelanggan biasa pun mendapat manfaatnya.

**Konsekuensi jujur:** sampai kemampuan ini ada, Paadu Flow tidak siap untuk healthcare. Menjualnya lebih dulu lalu menambal kemudian adalah risiko yang tidak sepadan dengan pendapatannya.

---

## 6. Urutan Prioritas Industri

Ditentukan tiga faktor, dan yang ketiga paling sering dilupakan.

| Faktor | Pertanyaan |
|---|---|
| Kedalaman kecocokan | Berapa persen kebutuhan industri ini sudah terpenuhi modul inti? |
| Ukuran pasar | Berapa banyak calon pelanggan di Indonesia, dan berapa nilai kontrak khasnya? |
| **Beban regulasi** | Berapa banyak kemampuan platform baru yang harus dibangun lebih dulu? |

Industri dengan kecocokan tinggi dan beban regulasi rendah dikerjakan lebih dulu — bukan karena pasarnya paling besar, melainkan karena **ia membuktikan bahwa mekanisme paket benar-benar bekerja** sebelum dipakai untuk kasus yang lebih berat.

Penilaian awal, untuk didiskusikan bukan untuk diterima:

| Industri | Kecocokan inti | Beban regulasi | Butuh modul baru? |
|---|---|---|---|
| Perdagangan dan distribusi | Tinggi | Rendah | Tidak |
| F&B dan kafe | Tinggi | Rendah | Tidak — POS sudah ada |
| Manufaktur ringan | Tinggi | Rendah | Tidak |
| Jasa profesional | Tinggi | Rendah | Tidak — Proyek sudah ada |
| Konstruksi | Menengah | Menengah | Mungkin — termin, retensi, progres fisik |
| Hospitality | Menengah | Rendah | Ya — kamar dan reservasi |
| Pendidikan | Rendah | Tinggi | Ya — siswa, kelas, nilai |
| Kesehatan | Rendah | **Sangat tinggi** | Ya — rekam medis |

Empat teratas **sudah didukung hari ini** oleh sembilan belas modul yang ada, dengan paket konfigurasi. Itu titik awal yang jauh lebih kuat daripada mengejar vertikal berat lebih dulu.

---

## 7. Anatomi Paket

**Manifes paket** — deklaratif, memakai format yang sama dengan manifes aplikasi Modul 18: identitas, versi, isi, dan prasyarat.

**Pemasangan** — saat onboarding atau kemudian, dengan pratinjau apa yang akan dibuat dan diubah. Paket **tidak pernah menimpa konfigurasi yang sudah diubah tenant** tanpa konfirmasi eksplisit per item.

**Versi** — paket berversi. Pembaruan menampilkan perbedaan dan meminta persetujuan per item, karena tenant mungkin sudah menyesuaikan sebagian.

**Pelepasan** — mencabut paket menghapus konfigurasinya, **bukan datanya.** Data yang dibuat memakai konfigurasi itu tetap ada.

**Paket dapat dibuat mitra**, lewat jalur tinjauan yang sama dengan aplikasi Marketplace.

---

## 8. Pengujian

**Uji isolasi paket.** Memasang paket tidak mengubah perilaku modul inti bagi tenant yang tidak memasangnya. Diuji dengan menjalankan seluruh rangkaian uji inti pada tenant berpaket dan tanpa paket, dan membandingkan hasilnya.

**Uji tanpa cabang.** Pemeriksaan otomatis yang menggagalkan build bila ditemukan percabangan berdasarkan industri di kode modul inti. Ini penegakan mesin atas disiplin §2 — tanpa itu, disiplinnya akan luntur dalam setahun.

**Uji overlay istilah.** Mengganti overlay tidak mengubah nama field di API, laporan, maupun definisi metrik.

**Uji pembaruan paket.** Konfigurasi yang sudah diubah tenant tidak tertimpa diam-diam.

**Uji pelepasan.** Mencabut paket tidak menghapus data tenant.

---

## 9. Risiko dan Item Terbuka

| Item | Status | Catatan |
|---|---|---|
| Klasifikasi data sebagai kemampuan platform | **Belum ada** | Prasyarat mutlak untuk healthcare dan education |
| Izin tingkat data | Sebagian | Sudah ada untuk gaji di Modul 10; perlu digeneralisasi |
| Manajemen persetujuan pemilik data | **Belum ada** | Perlu masukan hukum |
| Retensi per klasifikasi | Belum ada | Terkait retensi dokumen yang masih terbuka sejak Modul 03 |
| Urutan prioritas industri | Penilaian awal | Keputusan bisnis, perlu data pasar nyata |
| Ambang kelayakan modul vertikal | Belum ditetapkan | Berapa pelanggan dan nilai kontrak yang membenarkan biaya pemeliharaan permanen |

---

## 10. Prinsip yang Dipegang

**Solusi industri adalah paket, bukan cabang.** Tidak ada percabangan industri di modul inti, dan itu ditegakkan mesin.

**Butuh entitas dengan siklus hidup sendiri berarti butuh modul.** Menyamarkannya sebagai field kustom memindahkan biaya ke masa depan dengan bunga.

**Istilah industri hanya di lapisan tampilan.** Skema, API, dan metrik tetap kanonik.

**Kebutuhan industri teregulasi diselesaikan sebagai kemampuan platform**, dan sampai kemampuan itu ada, industri tersebut belum siap dilayani.

**Setiap modul vertikal adalah komitmen permanen.** Marketplace sering merupakan jawaban yang lebih baik daripada membangunnya sendiri.

**Mulai dari industri yang kecocokannya sudah tinggi.** Ia membuktikan mekanismenya bekerja sebelum dipakai untuk kasus yang berat.
