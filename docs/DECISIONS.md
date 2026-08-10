# Decisions

*Register keputusan arsitektur. Setiap entri: konteks, keputusan, konsekuensi.*

**Cara pakai.** Keputusan di bawah sudah diambil selama fase desain dan berlaku sejak commit pertama. Bila implementasi terpaksa menyimpang, tambahkan entri baru yang mencabut atau merevisi entri lama — **jangan mengedit entri lama.** Dokumen yang berubah diam-diam lebih berbahaya daripada tidak ada dokumen.

Format nomor: `D-nnn`. Status: `Berlaku` · `Direvisi oleh D-nnn` · `Dicabut`.

---

## Fondasi

### D-001 · Peran melekat pada pasangan pengguna–company
**Status:** Berlaku · **Sumber:** Module 02
**Konteks.** Satu orang wajar menjadi Direktur di satu PT dan staf gudang di PT lain dalam grup yang sama.
**Keputusan.** Peran disimpan di `company_access`, satu peran per pasangan pengguna–company. Bukan di `users`, bukan di `tenant_memberships`.
**Konsekuensi.** Resolusi izin selalu memerlukan konteks company. Tidak ada "peran global".

### D-002 · Konteks company dari path URL, bukan dari token
**Status:** Berlaku · **Sumber:** Information Architecture §2, Module 02
**Konteks.** Tautan lintas company harus dapat dikirim dan terbuka di company yang benar.
**Keputusan.** Token membawa identitas dan keanggotaan tenant. `company_id` diambil dari path dan diotorisasi per permintaan.
**Konsekuensi.** Berpindah company tidak memerlukan penerbitan ulang token. Setiap endpoint wajib memeriksa akses company dari path.

### D-003 · Isolasi tenant ditegakkan basis data, bukan aplikasi
**Status:** Berlaku · **Sumber:** Module 01
**Keputusan.** Row-level security atau setara, plus `tenant_id` sebagai bagian indeks utama di setiap tabel.
**Konsekuensi.** Satu kueri yang lupa filter tetap tidak dapat membocorkan data lintas tenant.

### D-004 · `document_version` di setiap tabel transaksional
**Status:** Berlaku · **Sumber:** Component Specs Feedback States §6
**Konteks.** Dua orang akan mengedit dokumen yang sama. Tanpa penanganan, hasilnya *last-write-wins* senyap.
**Keputusan.** Optimistic concurrency. `PATCH` wajib `If-Match`; konflik mengembalikan `409` beserta field yang bentrok.
**Konsekuensi.** Masuk template tabel transaksional sejak migrasi pertama. Menambahkannya setelah 40 tabel ada berarti migrasi di semuanya.

### D-005 · Tabel append-only ditegakkan di tingkat izin basis data
**Status:** Berlaku · **Sumber:** Module 03, 07
**Keputusan.** Peran aplikasi hanya diberi `INSERT` dan `SELECT` pada `audit_log`, `journals`, `stock_movements`, `leave_ledger`, dan tabel append-only lain.
**Konsekuensi.** Koreksi selalu lewat entri lawan, tidak pernah lewat pengubahan baris.

---

## Model Dokumen

### D-006 · Tiga sumbu status, bukan satu enum
**Status:** Berlaku · **Sumber:** Information Architecture §3
**Konteks.** Sebuah faktur bisa sekaligus *diposting*, *dibayar sebagian*, dan *jatuh tempo*.
**Keputusan.** `lifecycle_status`, `settlement_status`, `fulfillment_status` sebagai kolom terpisah. `overdue` **tidak disimpan** — ia kondisi turunan.
**Konsekuensi.** UI menampilkan gabungan yang relevan per konteks. Status tersimpan tidak memerlukan pekerjaan terjadwal.

### D-007 · Nomor dokumen diberikan saat submit
**Status:** Berlaku · **Sumber:** Flow Archetypes §2
**Keputusan.** Draf tidak punya nomor. Nomor diambil saat submit, dengan penguncian baris, tanpa celah.
**Konsekuensi.** Draf yang dibuang tidak membakar nomor urut. Celah dalam urutan adalah temuan audit.

### D-008 · Dokumen terposting tidak dapat diedit
**Status:** Berlaku · **Sumber:** Flow Archetypes §2
**Keputusan.** Setelah `posted`, tidak ada peran yang dapat mengubahnya. Koreksi lewat nota kredit atau jurnal pembalik.
**Konsekuensi.** Menghilangkan seluruh kelas konflik edit di area paling berkonsekuensi, dan membuat audit trail bermakna.

### D-009 · Pengaju tidak dapat menyetujui dokumennya sendiri
**Status:** Berlaku · **Sumber:** Module 02 §11, Flow Archetypes §2
**Keputusan.** Ditegakkan di layanan persetujuan, bukan di model izin — karena bergantung pada relasi pengguna dengan dokumen, bukan pada peran.
**Konsekuensi.** Ambang nilai persetujuan juga bukan izin. Menyandikan keduanya ke peran akan meledakkan jumlah peran.

### D-010 · Bekukan nilai di titik komitmen
**Status:** Berlaku · **Sumber:** Module 04, 08, 10, 11, 12, 13
**Keputusan.** Kurs dikunci saat submit · slip gaji dan laporan pajak dibekukan sebagai snapshot · tarif timesheet dibekukan saat persetujuan · jadwal penyusutan dibangkitkan dan disimpan · BOM dibekukan saat perintah kerja dirilis.
**Konsekuensi.** Angka masa lalu tidak pernah berubah karena keputusan hari ini. Menghitung ulang periode lalu menghasilkan angka yang sama.

---

## Konfigurasi, Bukan Kode

### D-011 · Modul tidak pernah menyebut nomor akun
**Status:** Berlaku · **Sumber:** Module 07
**Keputusan.** Modul menerbitkan peristiwa dengan konteksnya. Lapisan penentuan akun memilih akun berdasarkan matriks aturan dengan spesifisitas.
**Konsekuensi.** Aturan tidak ditemukan **menolak posting**. Tidak ada akun cadangan — ia menyembunyikan salah konfigurasi sampai tutup buku.

### D-012 · Tarif pajak adalah data bertanggal berlaku
**Status:** Berlaku · **Sumber:** Module 08
**Keputusan.** Perubahan tarif adalah baris baru dengan `valid_from`, bukan pengubahan baris lama. Tarif dipilih dari **tanggal dokumen**, bukan tanggal sistem.
**Konsekuensi.** `PATCH` tarif pada kode yang sudah dipakai ditolak. Menghitung ulang dokumen lama menghasilkan angka yang sama seperti saat dilaporkan.

### D-013 · Laporan pajak dibekukan sebagai snapshot
**Status:** Berlaku · **Sumber:** Module 08
**Keputusan.** Laporan yang sudah dilaporkan tidak pernah dihitung ulang dari data sumber. Koreksi menghasilkan pembetulan bernomor.
**Konsekuensi.** Apa yang tersimpan di sistem tetap sama dengan apa yang dilaporkan ke otoritas.

---

## Persediaan & Produksi

### D-014 · Stok adalah buku besar; saldo adalah proyeksi
**Status:** Berlaku · **Sumber:** Module 05
**Keputusan.** `stock_movements` append-only. `stock_balances` dapat dibangun ulang sepenuhnya. Bila keduanya berbeda, mutasi yang benar.
**Konsekuensi.** `qty_available` tidak disimpan — ia `qty_on_hand − qty_reserved`.

### D-015 · Stok negatif diperingatkan, tidak diblokir
**Status:** Berlaku · **Sumber:** Module 05 §11
**Konteks.** Memblokir memaksa staf mencatat penyesuaian palsu untuk melewatinya.
**Keputusan.** Dapat dikonfigurasi; bawaan **peringatkan**. Pengecualian: item ber-nomor seri selalu diblokir.
**Konsekuensi.** Peringatan yang tercatat lebih jujur daripada blokade yang diakali.

### D-016 · Akun penampung untuk selisih waktu
**Status:** Berlaku · **Sumber:** Module 06, 11, 13
**Keputusan.** Barang diterima belum ditagih, barang dalam proses, dan pekerjaan proyek belum ditagih masing-masing punya akun penampung.
**Konsekuensi.** Neraca benar setiap saat, bukan hanya saat dokumen lengkap.

### D-017 · Pengeluaran bahan produksi bersifat eksplisit
**Status:** Berlaku · **Sumber:** Module 13
**Konteks.** Konsumsi otomatis sesuai resep membuat angka selalu cocok karena dipaksa cocok.
**Keputusan.** Eksplisit sebagai bawaan. Otomatis hanya untuk kategori bernilai rendah, dan tetap menghasilkan baris pengeluaran nyata.
**Konsekuensi.** Pemakaian berlebih dan susut terlihat, bukan ditemukan saat stok opname.

---

## Batas Mesin

### D-018 · Batas kewenangan agen dalam produk
**Status:** Direvisi sebagian oleh D-019 · **Sumber:** Module 02, 14, 15
**Keputusan.** AI Assistant, Otomasi, dan Agen tidak pernah memposting, menyetujui, membayar, atau menghapus. Izin bertanda `delegatable_to_agent = false` tidak muncul di katalog aksi.
**Konsekuensi.** Ditegakkan di katalog, bukan di UI.

### D-019 · Dua kelas pelaku mesin
**Status:** Berlaku · **Merevisi:** D-018 · **Sumber:** Module 17 §1
**Konteks.** Larangan total memaksa orang menempelkan kredensial manusia ke skrip — jauh lebih berbahaya.
**Keputusan.** Katalog izin punya dua penanda: `delegatable_to_agent` dan `grantable_to_integration`. Integrasi terkonfigurasi dapat diberi izin sensitif secara eksplisit, bernama, dan dapat dicabut.
**Konsekuensi.** Service account dibuat hanya di tingkat tenant, dengan alasan tercatat dan persetujuan kedua untuk izin sensitif.

### D-020 · Tidak ada kode pihak ketiga di infrastruktur kami
**Status:** Berlaku · **Sumber:** Module 18
**Keputusan.** Aplikasi Marketplace berjalan di infrastruktur pembuatnya. Antarmuka tertanam lewat iframe dengan daftar pesan tertutup. Satu-satunya yang berjalan di dalam sistem adalah ekstensi data deklaratif.
**Konsekuensi.** Menghapus seluruh kelas risiko lolos-sandbox di lingkungan multi-tenant.

### D-021 · Ramalan tidak pernah masuk buku besar
**Status:** Berlaku · **Sumber:** Module 19
**Keputusan.** Angka ramalan tidak pernah menjadi nilai dokumen, dan ditandai berbeda secara visual. `lower_bound` dan `upper_bound` tidak boleh null.
**Konsekuensi.** Endpoint ramalan tidak dipanggil modul transaksional mana pun.

---

## Data & Antarmuka

### D-022 · Proyek adalah dimensi GL, bukan buku besar terpisah
**Status:** Berlaku · **Sumber:** Module 11
**Keputusan.** Angka keuangan proyek dibaca dari GL dengan filter dimensi. Tidak ada tabel ringkasan keuangan proyek.
**Konsekuensi.** Laba rugi proyek dan laba rugi perusahaan tidak akan pernah berbeda.

### D-023 · BI mengonsumsi metrik, tidak mendefinisikannya
**Status:** Berlaku · **Sumber:** Module 15, 16
**Keputusan.** Lapisan semantik adalah satu-satunya tempat metrik didefinisikan. AI, laporan, dan dashboard memanggil endpoint yang sama.
**Konsekuensi.** Kunci cache wajib memuat hash konteks izin — tanpa itu, cache menjadi jalur kebocoran.

### D-024 · Pagination berbasis kursor, tanpa `offset`
**Status:** Berlaku · **Sumber:** Module 17
**Keputusan.** Parameter `offset` tidak disediakan di API publik.
**Konsekuensi.** Membaca sambil data ditulis bersamaan tidak melewatkan maupun menggandakan baris.

### D-025 · `tokens.json` sumber kebenaran tunggal nilai visual
**Status:** Berlaku · **Sumber:** Design Tokens §11
**Keputusan.** `tokens.css` dibangkitkan Style Dictionary. Komponen hanya membaca token Lapis 2 dan 3.
**Konsekuensi.** Ditegakkan lint yang menggagalkan build, bukan konvensi.

### D-026 · Body antarmuka 14px, bukan 16px
**Status:** Berlaku · **Sumber:** Typography System §2
**Keputusan.** Basis rem 16px, body UI 14px. Mode kepadatan mengubah line-height dan padding, **tidak** mengubah ukuran font.
**Konsekuensi.** 16px membuang sekitar 15% baris yang terlihat di satu layar — biaya nyata untuk aplikasi tabel.

---

## Platform

### D-027 · Satu tenant, satu region penulis
**Status:** Berlaku · **Sumber:** Platform Architecture Resilience §3.1
**Konteks.** Data finansial tidak punya resolusi konflik yang dapat diterima.
**Keputusan.** Tenant disematkan ke satu region. Region lain berperan siaga, bukan penulis kedua.
**Konsekuensi.** Pengecualian POS luring bekerja karena satu terminal adalah satu-satunya penulis transaksinya sendiri.

### D-028 · Pelanggaran invarian adalah insiden
**Status:** Berlaku · **Sumber:** Platform Architecture Resilience §7
**Keputusan.** Pemeriksaan invarian berkala. Pelanggarannya ditangani sebagai insiden meski belum ada pengguna yang mengeluh.
**Konsekuensi.** Invarian yang sama menjadi kriteria kelulusan uji pemulihan bencana.

---

## Stack & Struktur Repo

*Diputuskan di Sesi A1. Seluruh entri di bawah menyebutkan alternatif yang kalah, karena alasannya lebih penting daripada pilihannya — bila alasannya gugur, keputusannya boleh dicabut.*

### D-029 · PostgreSQL adalah satu-satunya penyimpan kebenaran
**Status:** Berlaku · **Sumber:** Module 01 §5, Platform Architecture Resilience §3
**Konteks.** Empat kebutuhan menunjuk ke basis data yang sama: isolasi tenant yang ditegakkan basis data (D-003), pencabutan hak tulis pada tabel append-only (D-005), posting atomik lintas tabel, dan outbox yang tidak boleh kehilangan peristiwa.
**Keputusan.** PostgreSQL 16+. Seluruh data transaksional, antrean pekerjaan, dan outbox berada di dalamnya.
**Alternatif yang kalah.** *MySQL/MariaDB* — tidak punya row-level security; isolasi tenant akan kembali menjadi disiplin aplikasi, yang persis dilarang D-003. *MongoDB* — transaksi multi-dokumen ada, tetapi constraint jurnal berimbang dan hak akses per tabel tidak, sehingga seluruh invarian hidup hanya di kode. *CockroachDB* — keunggulannya adalah penulisan multi-region, yang justru sudah kita tolak di D-027; biaya dan ketidaklengkapan RLS-nya dibayar tanpa imbalan.
**Konsekuensi.** Kita bergantung pada satu mesin. Batas skalanya dinaikkan lewat replika baca, partisi per tenant, dan pemisahan tenant besar (Resilience §5) — bukan lewat penambahan jenis basis data.

### D-030 · Satu bahasa untuk domain, API, dan antarmuka
**Status:** Berlaku
**Keputusan.** TypeScript di Node.js 22 LTS, dari entitas domain sampai komponen React.
**Alternatif yang kalah.** *Go* — lebih tangguh untuk pekerja latar dan throughput, tetapi tidak punya tipe penjumlahan yang membuat tiga sumbu status dan hasil-atau-galat dapat diperiksa kompilator, dan memaksa domain ditulis dua kali karena frontend tetap React. *Java/Kotlin atau .NET* — matang, tetapi berat untuk ukuran tim ini. *Laravel* — cepat di awal, melawan Clean Architecture, dan cerita pipeline token jauh lebih lemah.
**Konsekuensi.** Glosarium, value object uang, dan kunci i18n dibagikan satu kali, tidak diterjemahkan antar bahasa. Risiko yang diterima: pekerjaan berat CPU (ekspor besar, penggajian) berjalan di kelompok pekerja terpisah dan dapat dipindah ke bahasa lain tanpa menyentuh domain.

### D-031 · Framework HTTP hanya tinggal di lapisan interface
**Status:** Berlaku · **Sumber:** src/interface/README.md
**Keputusan.** Fastify dengan skema JSON (TypeBox) di setiap rute. Validasi permintaan, respons, dan berkas OpenAPI berasal dari satu skema yang sama.
**Alternatif yang kalah.** *NestJS* — memaksakan arsitekturnya sendiri lewat dekorator dan modul, sehingga lapisan interface merembes ke aplikasi; kita sudah punya arsitektur. *Express* — tanpa validasi berbasis skema, OpenAPI menjadi dokumen terpisah yang segera basi. *Hono* — unggul di edge, tidak relevan untuk proses panjang dengan kolam koneksi Postgres.
**Konsekuensi.** Modul mendaftarkan dirinya sebagai plugin. Mengganti framework berarti menulis ulang satu folder, bukan seluruh sistem.

### D-032 · Transaksi dan konteks RLS dikelola aplikasi, bukan ORM
**Status:** Berlaku · **Sumber:** Module 01 §5, Module 02 §6
**Konteks.** RLS menuntut `SET LOCAL` pada koneksi yang sama dengan transaksinya. Penerjemahan cakupan izin menjadi klausa `WHERE` menuntut penyusunan predikat yang dapat dikarang saat berjalan. Testnya menuntut SQL yang benar-benar dijalankan dapat dibaca.
**Keputusan.** Driver `pg` ditambah Kysely sebagai penyusun kueri bertipe. Satu `UnitOfWork` di lapisan aplikasi memiliki transaksi, memasang konteks tenant dan company, menulis outbox, dan mengantre pekerjaan — seluruhnya dalam satu transaksi.
**Alternatif yang kalah.** *Prisma* — mesin kueri terpisah membuat `SET LOCAL` per transaksi rapuh, model migrasinya melawan disiplin expand-contract, dan predikat izin dinamis kehilangan tipe di jalur keluar SQL mentah. *Drizzle* — nyaris setara dan sah dipilih; Kysely menang tipis karena penyusunan ekspresi dinamisnya lebih kuat dan ia tidak pernah ikut mengurus migrasi. *SQL mentah saja* — pengubahan nama kolom lolos ke produksi tanpa peringatan.

### D-033 · Migrasi adalah berkas SQL bernomor yang hanya menambah
**Status:** Berlaku · **Sumber:** migrations/README.md, Resilience §6
**Keputusan.** SQL tulisan tangan, berurutan, dijalankan node-pg-migrate di dalam transaksi. Pemeriksa di CI menolak `DROP COLUMN`, `ALTER COLUMN ... TYPE`, penambahan `NOT NULL` tanpa nilai bawaan, dan pengubahan bentuk tabel append-only. Perubahan merusak dipecah tiga rilis. Backfill besar tidak pernah berada di dalam migrasi — ia pekerjaan latar yang dapat dijeda dan dilanjutkan.
**Alternatif yang kalah.** *Atlas atau Sqitch* — kuat, tetapi diff deklaratifnya justru menyembunyikan tahapan expand-contract yang ingin kita lihat di tinjauan kode. *Prisma Migrate* — terikat D-032 yang sudah ditolak.
**Konsekuensi.** CI menjalankan test rilis sebelumnya terhadap skema baru. Kompatibilitas dua arah menjadi hal yang diuji, bukan diklaim.

### D-034 · Antrean pekerjaan hidup di dalam basis data
**Status:** Berlaku · **Sumber:** Resilience §5
**Konteks.** Outbox hanya bermakna bila penulisan dokumen dan pengantrean peristiwanya berhasil atau gagal bersama. Antrean di luar basis data mustahil memenuhi itu tanpa relay — dan bila relay tetap dibutuhkan, antrean luarnya tinggal biaya.
**Keputusan.** pg-boss di atas `FOR UPDATE SKIP LOCKED`. Pekerjaan berat berjalan di kelompok pekerja terpisah dengan batas laju per tenant.
**Alternatif yang kalah.** *BullMQ/Redis* — Redis dapat kehilangan pesan yang basis data sudah nyatakan terkomit; dua wilayah durabilitas untuk satu kebenaran. *SQS/Cloud Tasks* — mengikat ke satu penyedia, melawan penyematan region D-027. *Temporal* — tepat untuk alur panjang seperti penggajian dan persetujuan; ditunda sampai mesin alur persetujuan diputuskan.

### D-035 · Outbox adalah tabel kerja; audit log yang append-only
**Status:** Berlaku · **Sumber:** Module 03, D-005
**Konteks.** Relay harus menandai pesan terkirim, sedangkan D-005 melarang `UPDATE`. Keduanya tidak dapat berlaku pada tabel yang sama.
**Keputusan.** `outbox_messages` bukan tabel append-only: ia boleh diperbarui dan dipangkas. Catatan yang harus abadi ditulis ke `audit_log` oleh konsumen peristiwa, dan `audit_log` tetap append-only.
**Konsekuensi.** Daftar tabel append-only di `src/db/append-only-tables.ts` tidak pernah memuat outbox. Kehilangan baris outbox lama tidak menghilangkan jejak audit.

### D-036 · Redis hanya cache, tidak pernah sumber kebenaran
**Status:** Berlaku · **Sumber:** Resilience §3.4
**Keputusan.** Cache dua lapis — LRU dalam proses, lalu Redis — untuk resolusi izin dan lapisan semantik. Kunci cache memuat hash konteks izin (D-023). Mode terdegradasi memakai cache dengan masa berlaku pendek dan **tidak pernah** memperluas izin: cache yang tidak memuat jawaban berarti tolak.
**Konsekuensi.** Kehilangan Redis menurunkan kecepatan, tidak menghilangkan data maupun membuka akses.

### D-037 · Aplikasi satu halaman, bukan render sisi server
**Status:** Berlaku · **Sumber:** Design Handoff §3, Information Architecture §2
**Keputusan.** React di atas Vite. Routing memakai TanStack Router karena parameter pencarian bertipe dan tervalidasi — di situlah aturan "seluruh state daftar hidup di URL" ditegakkan, bukan sekadar diimbau. State server memakai TanStack Query dengan kueri berkursor.
**Alternatif yang kalah.** *Next.js* — SSR tidak memberi apa pun untuk aplikasi belakang layar yang seluruhnya terautentikasi, sementara ia menambah runtime server kedua yang harus ikut memahami izin dan konteks company. Dua tempat memutuskan izin adalah dua tempat yang dapat bocor.
**Konsekuensi.** Bundel awal dijaga lewat pemecahan kode per modul. Modul desktop-only tetap dimuat malas.

### D-038 · Nilai visual hanya dari custom property, tanpa framework utility
**Status:** Berlaku · **Sumber:** D-025, Design Tokens §11
**Keputusan.** CSS Modules yang membaca custom property dari `src/styles/tokens.css`. Tema dan kepadatan berpindah di lapisan CSS, tanpa build ulang dan tanpa keterlibatan TypeScript.
**Alternatif yang kalah.** *Tailwind* — skalanya tinggal di konfigurasinya sendiri, menjadi sumber kebenaran kedua yang bersaing dengan `tokens.json`, dan nilai sembarang seperti `text-[#fff]` membuat lint D-025 mudah diakali. *CSS-in-JS runtime* — biaya saat berjalan dan nilai yang sulit diperiksa secara statis. *vanilla-extract* — kandidat kuat dan boleh ditinjau ulang; kalah hanya karena mengikat pergantian tema ke build.

### D-039 · Uang adalah bilangan bulat berskala, tidak pernah pecahan biner
**Status:** Berlaku · **Sumber:** Flow Archetypes §4, Typography System
**Keputusan.** Di basis data `numeric(19,4)`. Di domain, `Money` sebagai bilangan bulat pada skala minor mata uang, dengan angka penjaga tambahan untuk hasil antara. Pembulatan hanya terjadi di langkah terakhir urutan perhitungan.
**Konteks.** Diskon dokumen dialokasikan proporsional ke setiap baris sebelum pajak, dan tarif pajak dapat berbeda antar baris. Pembulatan di tengah menghasilkan DPP dan pajak yang salah, dan salahnya kecil sehingga lolos tinjauan.
**Konsekuensi.** Tidak ada `number` JavaScript di jalur uang mana pun — ditegakkan tipe dan lint. IDR tanpa desimal hanyalah keputusan tampilan.

### D-040 · Modul adalah irisan vertikal; batasnya ditegakkan lint
**Status:** Berlaku · **Sumber:** src/*/README.md
**Keputusan.** Setiap modul hadir sebagai folder di keempat lapisan. Dua aturan lint menggagalkan build: arah ketergantungan (interface → aplikasi → domain; infrastruktur mengenal domain, tidak sebaliknya) dan batas antar modul (`domain/sales` tidak boleh mengimpor `domain/inventory`). Lintas modul hanya lewat dua jalan: port yang dideklarasikan modul pemakai dan disuntik di composition root, atau peristiwa domain lewat outbox.
**Konsekuensi.** Modul ketiga puluh menambah folder, bukan menambah keterikatan. Mengangkat satu modul menjadi layanan terpisah kelak berarti mengganti implementasi port, bukan membongkar kode.

### D-041 · Kursor menggantikan `page` dan `per_page`
**Status:** Berlaku · **Merevisi:** kosakata di Information Architecture §2 dan Design Handoff §3 · **Sumber:** D-024
**Konteks.** Kedua dokumen desain masih menuliskan `?page=` dan `?per_page=`, sedangkan D-024 melarang pagination berbasis offset di API. Keduanya tidak dapat berlaku bersamaan.
**Keputusan.** API dan URL memakai `?cursor=` dan `?per_page=`. Parameter `?page=` dihapus dari kosakata baku. Respons daftar membawa `meta.total`, `meta.next_cursor`, `meta.prev_cursor`, dan definisi filter yang diterapkan — `total` tetap wajib karena teks "Pilih semua N baris yang cocok" bergantung padanya.
**Konsekuensi.** Tidak ada penomoran halaman di UI; navigasinya berikutnya dan sebelumnya. `total` dihitung terpisah dan boleh berupa perkiraan di atas ambang tertentu, dengan penandaan jujur di UI.

### D-042 · Pencarian memakai pencarian teks penuh Postgres lebih dulu
**Status:** Berlaku, provisional · **Sumber:** Information Architecture §6, Design Handoff §10
**Konteks.** Menutup sementara item terbuka "strategi indeks pencarian".
**Keputusan.** `tsvector` dengan indeks GIN di dalam basis data yang sama, sehingga penyaringan izin dan RLS berlaku pada kueri pencarian tanpa jalur kedua.
**Alternatif yang kalah.** *OpenSearch/Elasticsearch* — indeks di luar basis data berarti izin dievaluasi dua kali di dua tempat, dan IA §6 melarang pencarian mengakui keberadaan data yang tidak diizinkan. Ditinjau ulang bila latensi pencarian melewati ambang pada tenant nyata.

### D-043 · Autentikasi dibangun sendiri
**Status:** Berlaku · **Sumber:** Module 02
**Keputusan.** Argon2id, TOTP dengan kode pemulihan, refresh token berotasi dengan deteksi penggunaan ulang — dibangun di dalam sistem.
**Alternatif yang kalah.** *Auth0, Clerk, Supabase Auth* — Module 02 menetapkan perilaku yang tidak dapat dititipkan: pencabutan seluruh sesi saat kata sandi berubah, token yang membawa keanggotaan tenant tetapi tidak membawa `company_id` (D-002), dan jenis pelaku di audit trail. Menaruh identitas di luar batas tenant juga melawan penyematan region D-027.

### D-044 · Satu image, tiga jenis proses
**Status:** Berlaku · **Sumber:** Resilience §5
**Keputusan.** `api`, `worker` untuk pekerjaan berat, dan `scheduler` yang menjalankan relay outbox, pekerjaan berjadwal, serta pemeriksaan invarian berkala. Ketiganya dari satu image dengan composition root yang sama, dibedakan perintah jalan dan peran basis data.
**Konsekuensi.** Ekspor besar tidak pernah memperlambat orang yang sedang membuat faktur. Pemeriksaan invarian punya tempat berjalan sejak hari pertama, sehingga D-028 bukan niat melainkan pekerjaan yang terjadwal.

### D-045 · Tiga penyesuaian agar batas modul dapat ditegakkan mesin
**Status:** Berlaku · **Menyempurnakan:** D-040 · **Sumber:** implementasi Sesi A1
**Konteks.** Rencana awal menempatkan modul langsung di bawah nama lapisan. Di `infrastructure` dan `interface` itu tidak dapat dibedakan dari folder teknis seperti `db`, `outbox`, atau `components`, sehingga lint harus menebak dari daftar nama yang harus dirawat manual — dan daftar semacam itu selalu tertinggal.
**Keputusan.** Tiga penyesuaian: (1) `infrastructure` dan `interface` memakai segmen `modules/` eksplisit, sedangkan `domain` dan `application` tidak memerlukannya karena seluruh isinya modul; (2) `interface` tidak boleh mengimpor `domain` — ia melewati use case, dan kosakata lintas modul seperti tiga sumbu status tinggal di `shared`; (3) `composition` menjadi lapisan tersendiri di `src/composition`, satu-satunya yang dikecualikan dari aturan batas modul.
**Konsekuensi.** Batas modul dihitung dari jalur berkas, bukan dari konfigurasi. Menambah modul tidak menyentuh berkas aturan mana pun. Terbukti: berkas yang melanggar membuat `npm run lint` keluar dengan kode 1.

### D-046 · Larangan Lapis 1 berlaku untuk warna, belum untuk seluruh primitive
**Status:** Berlaku, menunggu tinjauan pemilik design system · **Sumber:** Design Tokens §1 dan §11
**Konteks.** §1 menulis komponen tidak pernah membaca Lapis 1, dan §11 menjadikannya lint yang menggagalkan build. Tetapi Lapis 2 di `tokens.json` seluruhnya warna — tidak ada token semantik untuk spacing, sizing, radius, z-index, atau motion. Larangan harfiah membuat komponen tidak punya apa pun untuk dipakai sebagai padding, dan §3 justru menyebut `space-4` sebagai padding default komponen.
**Keputusan.** Lint menolak rujukan ke ramp warna Lapis 1 — `indigo`, `neutral`, `success`, `warning`, `danger`, `info`, `dataviz`. Primitive non-warna tetap boleh dirujuk langsung.
**Alasan.** Seluruh pembenaran §1 berbicara tentang warna: tombol yang menulis `var(--indigo-600)` mengunci diri ke warna, bukan ke peran. §10 juga hanya menandai ramp warna sebagai hal yang berubah antar tenant dan antar mode. Spacing tidak berubah karena brand berganti.
**Konsekuensi.** Aturan diperketat begitu token semantik non-warna ada — dan itu memang sudah dibutuhkan untuk mode kepadatan, yang §12 catat belum lengkap. Sampai saat itu, ini menunggu keputusan pemilik design system, bukan keputusan engineering.

### D-047 · Penegakan token hidup di Stylelint; atribut `style` ditutup ESLint
**Status:** Berlaku · **Sumber:** Design Tokens §11, D-038
**Konteks.** Nilai visual tinggal di CSS Module (D-038), jadi kelima aturan §11 harus memeriksa CSS. ESLint tidak membaca CSS; Stylelint tidak membaca TSX.
**Keputusan.** Kelima aturan token diimplementasikan sebagai plugin Stylelint di `tools/stylelint-rules`. Atribut `style` di TSX — satu-satunya jalan nilai visual dapat masuk tanpa melewati Stylelint — dibatasi aturan ESLint sehingga hanya boleh memuat custom property.
**Konsekuensi.** Nilai yang baru diketahui saat berjalan tetap terlayani lewat `style={{ '--row-height': … }}`, dan nilainya tetap berasal dari token. Satu pengecualian yang disengaja: parameter `@media` tidak diperiksa, karena custom property memang tidak berfungsi di dalam media query — batasan CSS, bukan kelalaian. Nilai yang diizinkan dibaca langsung dari `docs/tokens.json` saat lint berjalan, sehingga aturan tidak dapat menyimpang dari sumber kebenaran.

---

## Sengaja Ditunda

Bukan kelalaian. Setiap butir punya syarat kapan ia layak diputuskan.

| Item | Ditunda sampai |
|---|---|
| Mesin alur persetujuan | Modul yang memerlukannya lebih dari satu. Kandidat: mesin state sendiri, atau Temporal bila alurnya berumur panjang |
| Ekstraksi modul menjadi layanan terpisah | Ada batas tim atau batas beban yang nyata. D-040 sudah menyiapkan jalannya |
| Sharding atau partisi per tenant | Ambang pemisahan tenant besar terukur dari pemakaian nyata (Resilience §10) |
| Mesin pencarian terpisah | Latensi pencarian Postgres melewati ambang pada tenant nyata (D-042) |
| Region kedua sebagai siaga aktif | Sasaran ketersediaan per tier ditetapkan bisnis (V-06) |

---

## Menunggu Validasi Profesional

Keputusan berikut **belum final** dan menunggu konfirmasi dari luar tim.

| # | Item | Kepada |
|---|---|---|
| V-01 | Urutan perhitungan pajak dan alokasi diskon dokumen proporsional sebelum pajak | Konsultan pajak |
| V-02 | Tarif dan metode PPh 21, PPN, dan kontribusi jaminan sosial | Konsultan pajak dan ahli ketenagakerjaan |
| V-03 | Kelompok dan tarif penyusutan fiskal | Konsultan pajak |
| V-04 | Metode pengakuan pendapatan proyek | Akuntan |
| V-05 | Retensi dokumen dan audit log | Penasihat hukum |
| V-06 | Sasaran ketersediaan per tier | Keputusan komersial |

**V-01 memblokir modul Penjualan dan Akuntansi mencapai produksi.** Implementasi boleh berjalan dengan asumsi yang tertulis di `docs/Flow_Archetypes.md` §4, tetapi tidak boleh dirilis sebelum divalidasi.
