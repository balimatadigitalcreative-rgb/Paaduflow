# Paadu Flow — Brand Strategy & Messaging Foundation
### Step 0.2 · Fase 0 — Brand Foundation Lock

**Status nama:** Dilanjutkan dengan "Paadu Flow". Risiko dari Brand Clearance Report (Step 0.1) — khususnya tabrakan dengan PADU Malaysia dan makna "paadu" dalam bahasa Tamil — **diterima secara sadar**, bukan terselesaikan. Lihat bagian *Risiko Terbuka* di akhir dokumen.

**Input:** Project Vision, Product Requirements, Decision Principles (Knowledge Base), Continuity Brief, Brand Clearance Report.
**Output ini menjadi input untuk:** Step 1.1 (Logo), 1.2 (Color), 1.3 (Typography), 1.4 (Brand Book), 5.1 (copy onboarding), 4.1 (taxonomy).

---

## 1. Brand Positioning Statement

### Tiga Varian

**Varian A — Anti-Migrasi (benefit-led)**
> Untuk pemilik bisnis yang sistemnya sudah tidak sanggup mengikuti pertumbuhan mereka, Paadu Flow adalah business operating system yang tumbuh dari satu orang sampai puluhan entitas legal tanpa pernah perlu ganti sistem. Berbeda dari software akuntansi UMKM yang harus ditinggalkan saat bisnis membesar, dan dari ERP enterprise yang terlalu berat untuk dimulai, Paadu Flow adalah satu-satunya sistem yang tidak Anda tinggalkan.

**Varian B — Keterpaduan (mechanism-led, paling dekat dengan nama)**
> Untuk organisasi yang datanya tersebar di banyak aplikasi dan spreadsheet, Paadu Flow adalah platform operasional yang menyatukan seluruh proses bisnis ke dalam satu sumber data tunggal. Berbeda dari kumpulan aplikasi yang "terintegrasi" lewat sinkronisasi, di Paadu Flow tidak ada yang perlu disinkronkan — karena tidak pernah terpisah.

**Varian C — AI-Native (capability-led)**
> Untuk pemimpin bisnis yang menghabiskan waktu mengumpulkan data alih-alih mengambil keputusan, Paadu Flow adalah business operating system yang dibangun AI-native sejak fondasinya. Berbeda dari ERP yang menambahkan chatbot di atas sistem lama, AI di Paadu Flow membaca seluruh operasional Anda dari satu sumber data — sehingga jawabannya benar-benar bisa dipercaya.

### Rekomendasi: **Varian A sebagai positioning utama, Varian B sebagai brand promise**

**Alasan:**

Positioning harus berisi klaim yang **sulit ditiru pesaing**, bukan klaim yang paling nyaman. Diuji dengan kriteria itu:

- **Varian B lemah sebagai diferensiasi.** Setiap vendor ERP di dunia mengklaim "terintegrasi" dan "single source of truth". Klaim ini tidak akan membedakan Anda di ruang evaluasi — pembeli sudah kebal terhadapnya.
- **Varian C rapuh terhadap waktu.** "AI-native" adalah klaim yang akan menjadi tabel taruhan (table stakes) dalam 2–3 tahun. Positioning yang harus bertahan 20 tahun tidak boleh bertumpu pada kategori teknologi yang sedang panas.
- **Varian A menyerang rasa sakit yang nyata dan mahal.** Migrasi sistem adalah kejadian traumatis yang diingat pemilik bisnis bertahun-tahun: data hilang, proses berhenti, biaya konsultan, tim harus belajar ulang. Di Indonesia, pola ini sangat umum — UMKM mulai di software akuntansi ringan, lalu terpaksa rip-and-replace ke ERP berat saat tumbuh. Menjanjikan bahwa kejadian itu tidak akan pernah terjadi adalah janji yang spesifik, emosional, dan dapat diverifikasi.

**Hubungan A dan B — ini yang membuat brand koheren:**

Keterpaduan (B) adalah **mekanisme**; tidak-perlu-migrasi (A) adalah **manfaatnya**. Anda hanya bisa menjanjikan A *karena* B benar. Ini juga yang menjadikan nama "Paadu" bukan dekorasi: nama menjelaskan cara kerjanya, positioning menjelaskan hasilnya.

**Positioning statement final:**

> **Untuk** organisasi yang sistemnya tidak sanggup mengikuti pertumbuhannya — dari individu, UMKM, hingga grup usaha dengan banyak entitas legal —
> **Paadu Flow adalah** business operating system yang menyatukan seluruh proses bisnis dalam satu sumber data, dan tumbuh bersama organisasi tanpa pernah perlu diganti.
> **Berbeda dari** software UMKM yang harus ditinggalkan saat bisnis membesar, dan ERP enterprise yang terlalu berat untuk dimulai,
> **Paadu Flow** adalah sistem terakhir yang perlu Anda pindahi.

**Konsekuensi yang harus diterima:** positioning ini adalah janji produk, bukan sekadar kalimat marketing. Ia mengikat keputusan arsitektur — dilarang membuat "edisi UMKM" dan "edisi Enterprise" sebagai basis kode terpisah, dilarang membuat batasan struktural yang memaksa upgrade destruktif. Ini konsisten dengan Success Metrics di Knowledge Base: *implementasi dilakukan dengan konfigurasi, bukan kustomisasi kode.*

---

## 2. Brand Pillars

Lima pilar. Masing-masing punya konsekuensi konkret — kalau sebuah pilar tidak mengubah satu pun keputusan produk atau desain, pilar itu tidak layak ada.

### Pilar 1 — **Padu** (Terpadu)
*Satu data, satu kebenaran. Tidak ada yang perlu direkonsiliasi karena tidak pernah terpisah.*

**Konsekuensi produk:**
- Dilarang ada dua master data untuk entitas yang sama. Modul Sales dan modul Finance memakai record `customer` yang sama, bukan salinan yang disinkronkan.
- Setiap angka di dashboard wajib bisa di-drill-down sampai ke transaksi sumbernya.
- Dilarang ada fitur "sinkronisasi" antar modul internal. Kehadiran tombol sync adalah bukti kegagalan pilar ini.

**Konsekuensi desain:**
- Navigasi antar modul tidak boleh terasa seperti berpindah aplikasi. Shell, tipografi, dan pola interaksi identik di semua modul.
- Entitas yang sama tampil dengan komponen yang sama di mana pun ia muncul.

### Pilar 2 — **Tumbuh** (Skala tanpa patah)
*Platform yang sama melayani satu orang dan sepuluh entitas legal.*

**Konsekuensi produk:**
- Satu basis kode. Perbedaan tier diwujudkan lewat feature flag dan konfigurasi, bukan fork.
- Upgrade plan tidak pernah memerlukan migrasi data atau perubahan alur kerja.
- Fitur enterprise (multi-company, approval berjenjang, SSO) hadir secara laten di semua tier — aktif saat dibutuhkan, tersembunyi saat tidak.

**Konsekuensi desain:**
- Progressive disclosure adalah aturan wajib, bukan preferensi. UI untuk pengguna solo tidak boleh menampilkan kompleksitas enterprise.
- Komponen harus menangani skala ekstrem: tabel yang sama harus waras di 5 baris dan 500.000 baris.

### Pilar 3 — **Terang** (Transparan & dapat ditelusuri)
*Setiap angka bisa dipertanggungjawabkan. Setiap perubahan punya jejak.*

**Konsekuensi produk:**
- Audit trail bukan fitur admin tersembunyi — ia hadir sebagai riwayat yang terlihat pengguna di setiap dokumen.
- AI wajib menyebutkan sumber. Jawaban tanpa sumber adalah bug, bukan gaya bahasa.
- Perubahan yang dilakukan sistem secara otomatis harus sama terlihatnya dengan perubahan yang dilakukan manusia.

**Konsekuensi desain:**
- Setiap halaman detail dokumen menyediakan panel aktivitas.
- Dilarang menampilkan angka agregat tanpa jalur menuju rinciannya.

### Pilar 4 — **Cekatan** (Cepat & tanpa gesekan)
*Pekerjaan harian selesai tanpa menunggu dan tanpa berpikir.*

**Konsekuensi produk:**
- Aturan maksimal tiga klik ditegakkan sebagai kriteria penerimaan, bukan aspirasi (lihat Step 8.1).
- Command palette adalah jalur utama, bukan pelengkap.
- Anggaran performa eksplisit: interaksi terasa instan, operasi berat memberi umpan balik dalam 100ms pertama.

**Konsekuensi desain:**
- Keyboard-first di semua alur input transaksional, terutama line-item editor.
- Optimistic UI untuk aksi yang aman; konfirmasi hanya untuk yang berisiko.

### Pilar 5 — **Tenang** (Dapat dipercaya)
*Sistem yang memegang uang dan data orang tidak boleh mengejutkan siapa pun.*

**Konsekuensi produk:**
- Dilarang menggunakan dark pattern dalam bentuk apa pun — termasuk untuk upgrade plan dan retensi.
- Aksi destruktif dijaga secara proporsional terhadap dampaknya, dan selalu punya jalur pemulihan.
- Keamanan adalah prioritas nomor satu dalam Decision Principles; brand tidak boleh membuat janji yang menekan prinsip itu.

**Konsekuensi desain:**
- Bahasa visual tenang: kontras terkendali, warna membawa makna bukan dekorasi, animasi singkat dan fungsional.
- Warna merah dan peringatan disimpan untuk hal yang benar-benar berbahaya, agar tidak kehilangan daya.

> **Catatan kohesi:** kelima nama pilar adalah kata Bahasa Indonesia. Ini konsisten dengan filosofi naming "padu" dan memberi brand kosakata internal yang khas — tapi ini kosakata **internal**. Lihat Bagian 6 soal mengapa kosakata ini tidak boleh bocor menjadi nama modul.

---

## 3. Brand Personality

Lima atribut. Format "kami X, bukan Y" ada untuk mencegah setiap atribut meluncur menjadi versi buruknya.

| # | Atribut | Kami begini | Bukan begini |
|---|---|---|---|
| 1 | **Tegas** | Menyatakan hal sulit dengan jelas: apa yang akan terjadi, apa yang hilang, berapa biayanya | **Kaku** — birokratis, penuh syarat dan ketentuan, menyembunyikan makna di balik formalitas |
| 2 | **Cerdas** | Menampilkan yang relevan, mengantisipasi langkah berikutnya, menyederhanakan tanpa mengurangi kebenaran | **Menggurui** — menjelaskan hal yang sudah jelas, memamerkan kecanggihan, memakai jargon untuk terlihat pintar |
| 3 | **Hangat** | Berpihak pada pengguna, tidak menyalahkan saat terjadi kesalahan, memakai bahasa manusia | **Akrab berlebihan** — bercanda saat pengguna sedang cemas, memakai emoji di konteks finansial, sok karib |
| 4 | **Tenang** | Stabil di situasi buruk, memberi informasi bukan kepanikan, tidak berteriak | **Datar** — dingin, tanpa empati, mengabaikan bahwa di balik data ada orang yang bertanggung jawab |
| 5 | **Presisi** | Angka spesifik, waktu spesifik, nama spesifik. Tidak pernah "beberapa" saat bisa "tujuh" | **Dingin** — teknis tanpa konteks, melempar kode error mentah, membuat pengguna menerjemahkan sendiri |

**Uji cepat:** kalau sebuah kalimat copy tidak bisa ditempatkan di kolom "Kami begini" pada minimal dua baris, kalimat itu belum siap dikirim.

---

## 4. Tone of Voice

### Keputusan Fondasi

**Bahasa utama:** Bahasa Indonesia untuk pasar Indonesia, dengan arsitektur i18n sejak hari pertama (tidak ada string yang di-hardcode). Istilah akuntansi dan perpajakan yang sudah baku di Indonesia **tidak diterjemahkan paksa** — "Faktur Pajak", "NPWP", "e-Faktur", "Jurnal Umum", "Neraca" dipakai apa adanya. Memaksa terjemahan literal dari istilah Inggris akan membuat produk terasa asing bagi akuntan Indonesia, yang justru pengguna harian terberat.

**Sapaan:** **"Anda"**, konsisten di seluruh produk.
- Bukan "kamu" — produk ini memegang data finansial dan legal; keakraban menurunkan kredibilitas.
- Bukan "Bapak/Ibu" — terlalu berat untuk antarmuka, dan tidak bisa diterapkan konsisten karena sistem tidak selalu tahu gender pengguna.

**Persona sistem:** Sistem menyebut dirinya "Paadu Flow" bila perlu, tapi sedapat mungkin tidak menyebut diri sama sekali. Tulis "Faktur terkirim", bukan "Kami telah mengirim faktur Anda". Pengecualian: AI assistant, yang boleh memakai "saya" karena ia memang diajak bicara.

### Prinsip Penulisan

1. **Kalimat aktif, subjek jelas.** Pengguna harus tahu siapa melakukan apa.
2. **Spesifik selalu mengalahkan umum.** "13 digit", bukan "jumlah digit salah".
3. **Jangan salahkan pengguna.** Deskripsikan keadaan, jangan menuduh.
4. **Front-load informasi penting.** Kalimat pertama harus bisa berdiri sendiri.
5. **Panjang mengikuti taruhan.** Semakin besar konsekuensi, semakin banyak konteks yang wajib diberikan.
6. **Jangan bercanda dekat uang, data, atau kegagalan.** Humor hanya boleh di area bertaruhan rendah (misal: onboarding kosong), dan itu pun tipis.
7. **Judul dalam sentence case**, bukan Title Case. Lebih mudah dibaca dan terasa lebih modern.

### Tabel Do / Don't

| Konteks | ✅ Lakukan | ❌ Hindari |
|---|---|---|
| Label tombol | Kata kerja spesifik: "Kirim faktur", "Setujui" | "OK", "Submit", "Lanjutkan" tanpa konteks |
| Pesan error | Sebutkan penyebab + cara memperbaiki | Kode error mentah, "Terjadi kesalahan" |
| Konfirmasi | Sebutkan dampak dalam angka | "Apakah Anda yakin?" |
| Empty state | Jelaskan apa yang akan muncul + satu CTA | "Tidak ada data" |
| Notifikasi | Objek spesifik + aksi lanjutan | "Berhasil!" |
| Copy AI | Kesimpulan + bukti + sumber | Klaim tanpa dasar, nada terlalu meyakinkan |
| Marketing | Klaim yang bisa diverifikasi | "Revolusioner", "solusi all-in-one terdepan" |

### Contoh Konkret per Konteks

**A. Headline marketing**
> ✅ Berhenti memindahkan data antar aplikasi.
> ✅ Satu sistem, dari karyawan pertama sampai entitas ke-sepuluh.
> ❌ Revolusikan transformasi digital bisnis Anda bersama solusi ERP terdepan!

*Kenapa:* yang pertama menamai rasa sakit spesifik yang dialami pembeli minggu ini. Yang ketiga bisa dipakai vendor mana pun, sehingga tidak menyampaikan apa-apa.

**B. Empty state** (daftar faktur, pengguna baru)
> ✅ **Belum ada faktur**
> Faktur yang Anda buat akan muncul di sini, lengkap dengan status pembayarannya.
> `[Buat faktur pertama]` `[Impor dari sistem lama]`
> ❌ No data available.

*Kenapa:* empty state adalah momen pengajaran, bukan laporan kekosongan. Tombol impor hadir karena positioning kita menjanjikan perpindahan yang mulus.

**C. Pesan error validasi**
> ✅ NPWP harus 15 atau 16 digit. Yang Anda masukkan berisi 13 digit.
> ❌ Format NPWP tidak valid.
> ❌ Anda salah memasukkan NPWP.

*Kenapa:* aturan + keadaan aktual = pengguna bisa langsung memperbaiki tanpa menebak. Versi ketiga melanggar prinsip "jangan salahkan pengguna".

**D. Konfirmasi aksi destruktif** (menghapus company)
> ✅ **Hapus PT Nusantara Jaya?**
> Company ini memiliki 1.284 transaksi dan 3 pengguna aktif. Setelah dihapus, data disimpan 90 hari sebelum dihapus permanen, dan seluruh pengguna kehilangan akses segera.
> Ketik **PT Nusantara Jaya** untuk mengonfirmasi.
> `[Batal]` `[Hapus company]`
> ❌ Apakah Anda yakin ingin menghapus? Tindakan ini tidak dapat dibatalkan.

*Kenapa:* pengguna tidak bisa menilai risiko tanpa angka. Type-to-confirm dipakai karena dampaknya besar — bukan sebagai default untuk semua penghapusan (itu akan melatih pengguna mengabaikannya).

**E. Notifikasi sukses**
> ✅ Faktur INV/2026/08/0142 terkirim ke budi@nusantarajaya.co.id.
> `[Lihat faktur]` `[Urungkan]`
> ❌ Berhasil!

*Kenapa:* toast yang tidak menyebut objeknya tidak bisa diverifikasi pengguna. "Urungkan" hadir karena pengiriman ke alamat yang salah adalah kesalahan yang mahal dan sering.

**F. Copy AI assistant**
> ✅ Margin kotor Agustus turun 4,2 poin dibanding Juli — dari 31,8% ke 27,6%.
> Penyumbang terbesar: harga beli **Kopi Arabika Gayo** naik 18% sejak 3 Agustus, sementara harga jual belum disesuaikan.
> *Dihitung dari 47 transaksi pembelian dan 312 transaksi penjualan.* `[Lihat rincian]`
> ❌ Sepertinya margin bisnis Anda sedang menghadapi tantangan! 📉 Coba tinjau kembali strategi harga Anda ya.

*Aturan khusus AI — non-negosiabel:*
1. **Selalu sebutkan sumber dan cakupan data.** Jawaban tanpa dasar yang dapat ditelusuri melanggar Pilar Terang.
2. **Jangan berhedge tanpa alasan.** Kalau data cukup, nyatakan. Kalau tidak cukup, katakan apa yang kurang — bukan "sepertinya".
3. **Jangan pernah mengubah data tanpa konfirmasi eksplisit**, dan setiap aksi AI wajib masuk audit log dengan penanda bahwa pelakunya adalah AI.
4. **Tanpa emoji** di konteks finansial dan operasional.
5. **AI boleh mengatakan tidak tahu.** Itu lebih murah daripada satu angka yang salah dipercaya.

---

## 5. Messaging Hierarchy

### Core Message
> **Paadu Flow menyatukan seluruh operasional bisnis Anda dalam satu sistem — dan tumbuh bersama Anda, sehingga Anda tidak perlu pindah sistem lagi.**

### Tagline
> **One Platform. Every Business.** (utama, sesuai Knowledge Base)
> **Satu platform. Semua bisnis.** (pasar Indonesia)

### Supporting Messages

**S1 — Satu data, tanpa rekonsiliasi**
Penjualan, stok, pembelian, dan keuangan membaca angka yang sama pada detik yang sama. Tidak ada ekspor, tidak ada sinkronisasi, tidak ada dua versi kebenaran.
*Bukti:* drill-down dari laporan ke transaksi sumber; tidak adanya fitur sinkronisasi antar modul.

**S2 — Tumbuh tanpa migrasi**
Mulai dari satu orang dan satu perusahaan. Tambah entitas legal, mata uang, cabang, dan tim — di platform yang sama, tanpa memindahkan data dan tanpa mempelajari ulang.
*Bukti:* arsitektur multi-tenant & multi-company sejak Modul 01; perubahan tier tidak memicu migrasi.

**S3 — AI yang membaca bisnis Anda, bukan chatbot tempelan**
Karena seluruh data berada di satu tempat, AI dapat menjawab pertanyaan lintas modul dan selalu menunjukkan dari mana angkanya berasal.
*Bukti:* setiap jawaban AI menyertakan sumber dan cakupan data.

> Urutan ini disengaja: S1 adalah mekanisme, S2 adalah manfaat utama, S3 adalah pengganda. S3 sengaja diletakkan terakhir agar brand tidak bergantung pada klaim AI yang akan menjadi biasa.

### Versi per Segmen

| | **Individu / Freelancer** | **UMKM** | **Enterprise / Grup Usaha** |
|---|---|---|---|
| **Rasa sakit utama** | Software bisnis terasa berlebihan dan mahal; akhirnya balik ke spreadsheet | Data tersebar di aplikasi kasir, spreadsheet, dan WhatsApp; tutup buku memakan berhari-hari | Banyak entitas legal dengan sistem berbeda; konsolidasi manual; audit menyakitkan |
| **Pesan utama** | Mulai dari yang Anda butuhkan hari ini. Sisanya menunggu sampai Anda siap. | Berhenti menyalin data antar aplikasi. Tutup buku dalam hitungan jam, bukan minggu. | Konsolidasi seluruh entitas tanpa proyek integrasi bertahun-tahun. |
| **Bukti yang ditonjolkan** | Aktifkan hanya modul yang dipakai; harga mengikuti pemakaian | Satu sumber data lintas penjualan–stok–keuangan; rekonsiliasi otomatis | Multi-company native, audit trail lengkap, RBAC, SSO, API-first |
| **Yang TIDAK boleh disebut** | Multi-company, approval berjenjang, konsolidasi — membuat produk terasa berat | Terminologi ERP berat ("modul GL", "cost center") di materi awal | Bahasa "mudah" dan "simpel" — terbaca sebagai tidak mampu |
| **Nada** | Ringan, membebaskan | Praktis, hemat waktu | Tenang, kredibel, teknis |

**Aturan penting:** ketiganya adalah **pembingkaian berbeda atas produk yang sama**, bukan produk yang berbeda. Kalau sebuah pesan segmen hanya bisa benar dengan membangun edisi terpisah, pesan itu melanggar Pilar Tumbuh dan harus dibuang.

---

## 6. Naming Convention Internal

### Pilihan yang Dipertimbangkan

**Pendekatan A — Fungsional deskriptif**
`Finance` · `Sales` · `Inventory` · `Purchasing` · `HR` · `Tax`

**Pendekatan B — Ber-brand**
`Paadu Ledger` · `Paadu Pulse` · `Paadu Stock` · `Paadu People`

**Pendekatan C — Hibrida**
Nama fungsional untuk seluruh modul, nama ber-brand hanya untuk satu-dua elemen yang benar-benar ikonik.

### Rekomendasi: **Pendekatan C** — fungsional sebagai aturan, ber-brand sebagai pengecualian sempit

**Alasan:**

1. **Pembeli enterprise mengevaluasi lewat daftar periksa.** RFP dan proses procurement mencari kata "General Ledger", "Accounts Payable", "Fixed Asset". Nama ciptaan membuat produk gagal dicocokkan — pada tahap di mana Anda bahkan belum diajak bicara.
2. **SEO dan penemuan.** Orang mencari "software inventory multi gudang", bukan "Paadu Stock". Nama fungsional menang di pencarian sejak hari pertama; nama ciptaan butuh bertahun-tahun dan anggaran besar untuk diajarkan.
3. **Skala 20 tahun memberatkan nama ciptaan.** Dengan 30+ modul, kosakata brand menjadi bahasa asing yang harus dipelajari setiap karyawan baru pelanggan. Biaya onboarding itu terakumulasi selamanya.
4. **Lokalisasi.** "Inventory" punya padanan mapan di setiap bahasa. "Paadu Stock" harus dipertahankan apa adanya atau diterjemahkan setengah-setengah — keduanya buruk.
5. **Konsisten dengan Knowledge Base.** Dokumen Product Requirements sudah menamai domain secara fungsional. Menyimpang darinya berarti memelihara dua kosakata.

**Trade-off yang harus diakui jujur:**

- Nama fungsional **tidak dapat dimiliki**. Anda tidak bisa mendaftarkan merek "Inventory", dan pesaing bebas memakai nama yang sama.
- Nama fungsional **terasa kurang premium**. Salesforce (Sales Cloud, Service Cloud) dan HubSpot (Marketing Hub) membuktikan nama ber-brand bisa menjadi aset besar — tetapi keduanya membangunnya dengan satu dekade anggaran marketing untuk mengajarkan kosakata itu. Anda belum punya itu, dan mengeluarkan nama ber-brand sebelum ada awareness hanya menciptakan gesekan.
- Diferensiasi jadi sepenuhnya bergantung pada nama produk induk. Ini dapat diterima — justru memusatkan seluruh ekuitas brand pada "Paadu Flow" alih-alih menyebarkannya tipis-tipis.

### Aturan yang Ditetapkan

**Modul** — kata benda fungsional standar industri, tunggal, tanpa awalan brand.
`Finance` `Sales` `Inventory` `Purchasing` `Manufacturing` `HR` `POS` `Tax` `Project`

**Sub-modul** — istilah baku yang dikenali praktisi domain.
`General Ledger` `Accounts Receivable` `Stock Transfer` `Goods Receipt`

**Fitur** — kata kerja atau frasa deskriptif, bukan nama benda ciptaan.
✅ `Rekonsiliasi Bank` `Approval Berjenjang` ❌ `PaduSync` `FlowMatch`

**Pengecualian yang diizinkan — AI assistant.** Ini satu-satunya elemen yang layak diberi nama diri, karena pengguna benar-benar **berbicara kepadanya**. Menyapa "AI Assistant" terasa canggung; menyapa nama terasa alami. Nama harus: dua suku kata, mudah diucapkan penutur Indonesia dan Inggris, tidak gender-spesifik, dan tidak mengandung "Padu" (menghindari tabrakan yang sudah dicatat di Step 0.1). Keputusan nama ini **ditunda ke Fase 5** saat pola interaksi AI dirancang — jangan dipilih sekarang tanpa konteks penggunaannya.

**Plan / tier** — **pertahankan yang sudah ada di skema database.**
`trial` · `starter` · `business` · `enterprise`

> ⚠️ **Ini bukan pilihan bebas.** Modul 01 sudah menetapkan `plan_type` sebagai enum dengan nilai-nilai tersebut di tabel `tenants`. Mengubah nama tier setelah implementasi berarti migrasi data dan perubahan di setiap tempat yang memeriksa tier. Karena nilainya sudah masuk akal dan dapat dipahami pasar, keputusannya: **kunci sekarang, jangan ditinjau ulang.** Label yang tampil ke pengguna boleh diperhalus per bahasa; nilai di database tidak berubah.

**Kata terlarang di seluruh produk:**
- Jangan menamai modul, fitur, atau layanan apa pun dengan "PADU" berdiri sendiri — menghindari tabrakan dengan Pangkalan Data Utama Malaysia (Step 0.1).
- Jangan bocorkan akronim internal ke antarmuka. Nama pilar brand (Padu, Tumbuh, Terang, Cekatan, Tenang) adalah kosakata internal — dilarang muncul sebagai nama fitur.

**Tata kelola:** glosarium terminologi lintas modul disusun di **Step 4.1 (Information Architecture)** dan menjadi rujukan tunggal. Istilah yang harus diputuskan sekali dan tidak boleh bervariasi antar modul: Customer/Client, Vendor/Supplier, Item/Product, Company/Entity, Warehouse/Location.

---

## 7. Risiko Terbuka & Keputusan yang Ditunda

| Item | Status | Konsekuensi bila diabaikan |
|---|---|---|
| Tabrakan nama dengan PADU Malaysia | **Diterima secara sadar** | Hambatan brand permanen di pasar ekspansi utama; tidak ada mitigasi selain strategi go-to-market khusus |
| Makna "paadu" dalam bahasa Tamil | **Diterima secara sadar** | Beban brand di pasar India; dampak rendah selama belum masuk pasar tersebut |
| Trademark clearance resmi | **Belum dilakukan** | Risiko harus rebranding setelah investasi Fase 1–8 — biaya terbesar dari seluruh daftar ini |
| Ketersediaan domain | **Belum diverifikasi** | Perlu dicek sebelum Step 1.4 (Brand Book memuat URL) |
| Nama AI assistant | **Ditunda ke Fase 5** | Tidak ada, selama tidak diputuskan prematur |
| Bahasa default untuk pasar non-Indonesia | **Ditunda** | Perlu diputuskan sebelum arsitektur i18n dikunci di Fase 3 |

**Rekomendasi berdiri:** selesaikan pencarian resmi di DJKI (pdki-indonesia.dgip.go.id) dan WIPO Global Brand Database **sebelum memulai Step 1.4**. Fase 1.1–1.3 relatif aman untuk dikerjakan lebih dulu karena logo, warna, dan tipografi sebagian besar dapat diselamatkan seandainya nama berubah — Brand Book tidak.

---

## Lampiran — Checklist Verifikasi Copy

Sebelum copy apa pun dikirim ke produksi:

- [ ] Memakai "Anda", bukan "kamu"
- [ ] Kalimat aktif dengan subjek yang jelas
- [ ] Angka spesifik, bukan kuantitas samar
- [ ] Tidak menyalahkan pengguna
- [ ] Tombol memakai kata kerja spesifik
- [ ] Pesan error menyebutkan penyebab **dan** cara memperbaiki
- [ ] Konfirmasi destruktif menyebutkan dampak dalam angka
- [ ] Copy AI menyertakan sumber dan cakupan data
- [ ] Tanpa emoji di konteks finansial atau operasional
- [ ] Lolos uji dua kolom pada tabel Brand Personality
- [ ] Istilah sesuai glosarium (setelah Step 4.1 tersedia)
