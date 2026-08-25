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

## Skema Fondasi

*Diputuskan di Sesi A3, saat migrasi pertama ditulis.*

### D-048 · Kunci primer komposit `(tenant_id, id)`
**Status:** Berlaku · **Menyimpang dari:** Module 01 §6 yang menulis `UUID (PK)` polos · **Sumber:** Module 01 §5, Platform Architecture Resilience §5
**Konteks.** Modul 01 menjanjikan skema yang siap di-*shard* per tenant. Postgres mensyaratkan kunci partisi berada di dalam kunci primer, jadi `PRIMARY KEY (id)` menutup jalan itu selamanya.
**Keputusan.** Seluruh tabel bertenant memakai `PRIMARY KEY (tenant_id, id)`. Foreign key ikut menjadi dua kolom: `(tenant_id, company_id) REFERENCES companies (tenant_id, id)`. Tabel identitas global — `users` dan `tenants` — tetap berkunci tunggal.
**Konsekuensi.** Rujukan lintas tenant menjadi mustahil di tingkat basis data, bukan hanya tidak diizinkan RLS — lapisan kedua yang didapat gratis. Biayanya: setiap FK dua kolom, dan pencarian dengan `id` saja memerlukan konteks tenant. Yang terakhir tidak menyakitkan karena konteks tenant selalu ada, ia datang dari path URL (D-002).

### D-049 · Fondasi memuat kerangka buku besar, bukan hanya konvensi
**Status:** Berlaku · **Sumber:** Design_Handoff_Spec §2, Module 03, Module 07
**Konteks.** `audit_log`, `journals`, dan `journal_lines` adalah tabel append-only. Hak akses dan constraint yang menjaganya harus berlaku sejak baris pertama, bukan sejak modul akuntansi dibangun.
**Keputusan.** Ketiganya dibuat di migrasi fondasi dengan bentuk sesuai modulnya. Modul 03 dan 07 menambah kolom dan tabel di atasnya; keduanya tidak pernah mengubah bentuk yang ada.
**Konsekuensi.** `journal_lines.account_id` belum punya foreign key — tabel `accounts` lahir di Sesi D1, dan menambahkan FK-nya kelak bersifat menambah.

### D-050 · Jurnal berimbang ditegakkan constraint trigger yang ditunda
**Status:** Berlaku · **Sumber:** Module 07 §73
**Konteks.** Jurnal dan barisnya disisipkan dalam satu transaksi. Pemeriksaan per baris akan selalu gagal pada baris pertama, karena saat itu jurnalnya memang belum berimbang.
**Keputusan.** `CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED` di `journal_lines` **dan** di `journals`. Yang kedua tidak berlebihan: jurnal tanpa satu pun baris tidak akan pernah memicu trigger di tabel baris, dan akan lolos.
**Konsekuensi.** Kegagalan muncul di titik `COMMIT`, bukan di titik `INSERT`. Kode yang menangani galat harus menyiapkan diri untuk itu, dan test invarian memeriksanya persis di titik itu.

### D-051 · Penomoran dokumen memakai baris terkunci, bukan `SEQUENCE`
**Status:** Berlaku · **Sumber:** D-007, Flow Archetypes §2
**Konteks.** `SEQUENCE` tidak ikut dibatalkan saat transaksi gagal. Ia meninggalkan celah, dan celah pada urutan nomor dokumen adalah temuan audit.
**Keputusan.** Tabel `document_sequences` dengan `SELECT … FOR UPDATE` di dalam transaksi yang sama dengan penyisipan dokumennya.
**Konsekuensi.** Submit untuk satu jenis dokumen di satu company menjadi serial. Itu harga dari "tanpa celah", diterima secara sadar, dan kuncinya dipersempit ke `(company, jenis, periode)` supaya modul lain tidak ikut menunggu.

### D-052 · RLS menegakkan tenant; company adalah otorisasi
**Status:** Berlaku · **Sumber:** D-003, D-001, Information Architecture §2
**Konteks.** Isolasi tenant dan pembatasan company terlihat mirip, tetapi bukan hal yang sama. Pengalih company memang harus melihat lintas company di dalam satu tenant.
**Keputusan.** Kebijakan RLS hanya membandingkan `tenant_id` dengan konteks yang dipasang `SET LOCAL`. Pembatasan company diterjemahkan menjadi predikat `WHERE` di lapisan izin (Sesi B2).
**Konsekuensi.** Konteks tenant yang belum dipasang menghasilkan nol baris — gagal tertutup. `WITH CHECK` ikut dipasang, sehingga menulis baris ke tenant lain juga ditolak, bukan hanya membacanya.

### D-053 · Basis data wajib ber-encoding UTF8
**Status:** Berlaku
**Konteks.** Klaster Postgres di Windows mewarisi locale sistem dan melahirkan basis data ber-encoding WIN1252. Migrasi gagal dengan galat konversi karakter yang tidak menyebutkan sebab sebenarnya.
**Keputusan.** Penjalan migrasi memeriksa `server_encoding` dan menolak sebelum menjalankan apa pun, dengan pesan yang menyebutkan cara memperbaikinya.
**Konsekuensi.** Berlaku juga untuk produksi. Nama pelanggan, alamat, dan pesan galat berbahasa Indonesia semuanya memerlukan UTF8.

### D-054 · Test invarian memakai PostgreSQL tertanam, bukan Docker
**Status:** Berlaku
**Konteks.** Row-level security dan pencabutan hak tidak dapat dipalsukan — basis data tiruan akan meluluskan tepat kelas kesalahan yang paling mahal. Tetapi mensyaratkan Docker berarti mensyaratkannya di setiap mesin pengembang.
**Keputusan.** `TEST_DATABASE_URL` dipakai bila ada — itu jalur CI, tempat Postgres berjalan sebagai service container. Bila tidak, satu instans PostgreSQL tertanam disalakan di direktori sementara. Keduanya tidak memerlukan Docker, dan test tidak pernah lulus tanpa basis data sungguhan.
**Konsekuensi.** Versi Postgres di uji lokal saat ini 18, sedangkan D-029 menetapkan 16 sebagai batas bawah. Versi mayor produksi wajib disamakan dengan yang dipakai CI, dan CI wajib memakai versi produksi — selisih mayor antara uji dan produksi adalah kelas kesalahan yang tidak akan tertangkap satu test pun.

---

## Autentikasi & Sesi

*Diputuskan di Sesi B1.*

### D-055 · Preferensi pengguna adalah tabel, bukan kolom jsonb di `users`
**Status:** Berlaku · **Menyimpang dari:** Module 02 §6 yang menempatkan `preferences jsonb` di `users`
**Konteks.** Modul tersemat yang dipilih seseorang di grup usaha A tidak sama dengan pilihannya di grup usaha B. Kolom jsonb di tabel identitas global tidak punya tempat untuk membedakannya.
**Keputusan.** `user_preferences` berkunci `(tenant_id, user_id)`, dibuat di migrasi `0007`.
**Konsekuensi.** Preferensi ikut aturan RLS seperti data bertenant lainnya, dan tabel identitas global tetap ramping.

### D-056 · Penguncian akun tidak diumumkan
**Status:** Berlaku · **Sumber:** Module 02 §11
**Konteks.** Modul mensyaratkan pesan kredensial salah tidak membedakan email tidak ditemukan dari kata sandi salah. Menjawab "akun terkunci" mengembalikan pembedaan itu lewat pintu lain — ia mengakui akun tersebut ada, sekaligus memberi tahu penyerang bahwa serangannya menimbulkan efek.
**Keputusan.** Akun terkunci menjawab `invalid_credentials`, sama seperti kata sandi salah. Penguncian tercatat di `auth_events`; pemiliknya diberi tahu lewat email, bukan lewat jawaban HTTP.
**Konsekuensi.** Biaya kegunaan yang nyata dan disengaja: pengguna sah yang terkunci tidak tahu mengapa kata sandi benarnya ditolak. Pemberitahuan lewat email menjadi wajib, bukan tambahan.

### D-057 · Deteksi penggunaan ulang hanya berlaku untuk token hasil rotasi
**Status:** Berlaku · **Sumber:** Module 02 §4
**Konteks.** Menganggap setiap token yang sudah dicabut sebagai serangan berarti tab lama yang menyegarkan setelah logout akan mencabut seluruh sesi pengguna dan membunyikan alarm keamanan palsu.
**Keputusan.** Hanya `revoked_reason = 'rotated'` yang dinilai sebagai penggunaan ulang. Logout, pencabutan manual, dan perubahan kata sandi menghasilkan penolakan biasa.
**Konsekuensi.** Alarm yang berbunyi berarti sesuatu yang sungguh terjadi. Alarm yang sering berbunyi tanpa sebab akan diabaikan, dan itu lebih berbahaya daripada tidak ada alarm.

### D-058 · Tantangan MFA berupa token bertanda tangan, bukan baris basis data
**Status:** Berlaku
**Keputusan.** Tantangan MFA adalah JWT berumur lima menit dengan klaim `purpose` tersendiri, diverifikasi terpisah dari access token.
**Konsekuensi.** Tidak ada tabel tantangan yang harus dipangkas. Pemeriksaan `purpose` wajib: tanpa itu, access token dapat dipakai sebagai tantangan MFA karena keduanya ditandatangani kunci yang sama — dan itu melewati MFA sepenuhnya. Ada test khusus untuk jalur itu.

### D-059 · Pembatasan laju per IP dihitung dari `auth_events`
**Status:** Berlaku · **Sumber:** Module 02 §5
**Konteks.** Penguncian bertahap per akun tidak melihat credential stuffing sama sekali: satu kata sandi umum dicoba ke ribuan akun berbeda, dan tidak ada satu akun pun yang mencapai ambangnya.
**Keputusan.** Kegagalan dihitung dari `auth_events` dalam jendela 15 menit per alamat, dengan indeks parsial. Tidak ada tabel penghitung baru.
**Konsekuensi.** Kegagalan terhadap email yang **tidak terdaftar** wajib ikut dicatat — justru itu bentuk serangannya. Peristiwa blokade memakai jenis tersendiri supaya tidak ikut menghitung dirinya dan memperpanjang blokade selamanya; keduanya punya test. Ambang 20 sengaja longgar: satu kantor di belakang satu IP publik dapat menghasilkan puluhan salah ketik yang sah.

---

## Model Izin

*Diputuskan di Sesi B2, bagian pertama.*

### D-060 · Cakupan izin hanya tiga, dan ketiganya wajib dapat menjadi predikat
**Status:** Berlaku · **Sumber:** Module 02 §5
**Konteks.** Modul 02 mengikat desain dengan satu kalimat: izin wajib dapat diterjemahkan menjadi klausa `WHERE`. Mengambil seluruh baris lalu menyaring di aplikasi gagal pada tenant besar, dan bocor lewat penghitungan total jauh sebelum itu.
**Keputusan.** `own`, `company`, `tenant` — tidak lebih. Setiap cakupan yang tidak dapat menjadi predikat adalah cakupan yang tidak boleh ada. Cakupan `tenant` pun tetap daftar tertutup: ia berarti seluruh company yang penggunanya punya akses, bukan seluruh company yang ada.
**Konsekuensi.** Kebutuhan seperti "akses per cabang" atau "per kategori barang" tidak dipaksakan ke model ini; ia menunggu ABAC di Modul 02 §13.

### D-061 · Izin diperiksa sebelum paket langganan
**Status:** Berlaku · **Sumber:** Information Architecture §5, Module 02 §7
**Konteks.** `plan_restricted` dirancang untuk **ditampilkan** beserta tawaran upgrade, sedangkan `permission_denied` dirancang untuk **disembunyikan sepenuhnya**.
**Keputusan.** Urutan pemeriksaan tidak boleh dibalik: izin dulu, paket kemudian. Pengguna yang tidak berizin menerima `permission_denied` meski paketnya juga kurang.
**Konsekuensi.** Tanpa urutan ini, `plan_restricted` menjadi saluran yang mengakui keberadaan fitur — persis yang `permission_denied` ada untuk sembunyikan. Ada test khusus untuk urutan ini.

### D-062 · Izin yang tidak dimiliki menghasilkan filter buntu, bukan pengecualian
**Status:** Berlaku · **Sumber:** Information Architecture §6
**Keputusan.** Di jalur baca, izin yang tidak dimiliki menurunkan `ScopeFilter` dengan daftar company kosong. Kuerinya tetap berjalan dan mengembalikan nol baris.
**Konsekuensi.** Pencarian lintas entitas dapat melewati satu entitas tanpa menggagalkan permintaan, dan tanpa pernah mengakui entitas itu ada. Tidak ada "3 hasil disembunyikan", dan tidak ada perbedaan bentuk galat yang dapat dipakai menyimpulkan keberadaan data. Pengecualian tetap dipakai di jalur tulis, tempat penolakan memang harus terdengar.

### D-063 · Satu-satunya jalan membaca data bertenant adalah `ScopedStore`
**Status:** Berlaku · **Sumber:** Module 02 §12
**Konteks.** Kebocoran lintas company hampir tidak pernah terjadi di endpoint utama. Ia terjadi di pencarian global dan di laporan, karena keduanya ditulis belakangan oleh orang lain dengan kueri yang dirakit sendiri.
**Keputusan.** Daftar, pencarian, dan penjumlahan laporan melewati kelas yang sama. Setiap metodenya menerima `ScopeFilter` sebagai argumen wajib, dan tidak ada satu pun metode yang menerima SQL mentah.
**Konsekuensi.** Menambah jalur baca baru tidak berarti menulis ulang penyaringannya. Melupakan filter bukan menghasilkan kueri tanpa filter — ia tidak menghasilkan kueri sama sekali, karena tidak dapat dikompilasi.

### D-064 · Pengguna boleh membaca baris aksesnya sendiri tanpa konteks tenant
**Status:** Berlaku
**Konteks.** Saat permintaan tiba, sistem belum tahu tenant mana yang dimaksud — ia baru tahu penggunanya. Tetapi seluruh tabel bertenant disaring RLS berdasarkan konteks tenant yang belum ada. Ayam dan telur.
**Keputusan.** Kebijakan RLS `company_access` mengizinkan dua jalan: `tenant_id` cocok dengan konteks, **atau** `user_id` cocok dengan `app.user_id`. Dari baris itulah tenant ditentukan, lalu konteks dipasang dan sisanya berjalan normal.
**Konsekuensi.** Yang terbuka tanpa konteks tenant hanyalah daftar akses milik pengguna itu sendiri. Alternatif yang ditolak: fungsi `SECURITY DEFINER` — ia memerlukan pemilik yang melewati RLS, dan `FORCE ROW LEVEL SECURITY` justru membuat pemilik ikut tersaring, sehingga jalur itu hanya bekerja bila migrasi dijalankan superuser.

### D-065 · `roles` berkunci tunggal, pengecualian sadar terhadap D-048
**Status:** Berlaku
**Keputusan.** `roles.tenant_id` dapat NULL untuk menandai peran bawaan sistem, sehingga kunci primer komposit `(tenant_id, id)` tidak mungkin. Keunikan dijaga `UNIQUE NULLS NOT DISTINCT (tenant_id, key)`.
**Konsekuensi.** Peran bawaan terlihat oleh semua tenant lewat kebijakan RLS yang mengizinkan `tenant_id IS NULL`, dan dilindungi trigger yang menolak `UPDATE` maupun `DELETE` atasnya — Modul 02 §10 menyatakan tidak ada peran mana pun yang dapat mengubah peran bawaan.

---

## Lapisan HTTP

*Diputuskan di Sesi B2, bagian kedua.*

### D-066 · Tiap sebab penolakan punya status HTTP tersendiri
**Status:** Berlaku · **Sumber:** Module 02 §7
**Keputusan.** `permission_denied` → 403 · `plan_restricted` → **402** · `state_restricted` → 409. Kodenya tetap ada di badan jawaban; status hanya membantu klien yang memutuskan sebelum membaca badan.
**Konsekuensi.** 402 dipilih karena `plan_restricted` satu-satunya sebab yang jalan keluarnya adalah membayar. Klien yang menangani 403 secara seragam tidak akan salah menyembunyikan tawaran upgrade.

### D-067 · Registrasi menjawab 202, bukan 201
**Status:** Berlaku · **Sumber:** Module 02 §11
**Konteks.** 201 Created menyatakan sesuatu telah dibuat. Untuk email yang sudah terdaftar, tidak ada yang dibuat — dan mengatakannya berarti mengakui email itu ada.
**Keputusan.** 202 Accepted dengan pesan yang sama untuk kedua kasus: "bila email tersebut dapat didaftarkan, tautan verifikasi sudah dikirim".
**Konsekuensi.** Klien tidak dapat mengetahui hasil registrasi dari jawaban HTTP; ia mengetahuinya dari email. Itu memang harganya.

### D-068 · Idempotency memakai `INSERT … ON CONFLICT`, bukan periksa-lalu-tulis
**Status:** Berlaku · **Sumber:** butir 12 Design_Handoff_Spec §2
**Keputusan.** Penyisipan baris kunci yang menentukan siapa yang menang. Dua permintaan bersamaan berlomba; hanya satu menyisipkan, yang kalah membaca baris pemenang.
**Konsekuensi.** Periksa-lalu-tulis akan meloloskan keduanya — persis skenario yang idempotency ada untuk cegah. Kunci dengan muatan berbeda ditolak `422`, bukan dijawab dengan hasil permintaan lain: klien yang menerima jawaban operasi berbeda akan mengira operasinya berhasil. Kunci dilepas bila penangan melempar, supaya percobaan ulang tidak buntu selamanya.

### D-069 · Layanan dirakit ulang per permintaan; cache izin dibagikan
**Status:** Berlaku · **Sumber:** Module 02 §5
**Konteks.** Repository terikat pada transaksi permintaan — di situlah konteks tenant hidup lewat `SET LOCAL`. Tetapi cache izin yang lahir dan mati bersama layanan tidak pernah menolong siapa pun, padahal resolusi izin dipanggil di setiap permintaan.
**Keputusan.** Layanan bercakupan company dibuat ulang tiap permintaan; cache izin dibuat sekali di composition root dan disuntikkan ke setiap instans.
**Konsekuensi.** Pencabutan akses menginvalidasi cache bersama, bukan salinan yang sudah telanjur tersebar.

### D-070 · Adapter sementara diberi nama yang tidak nyaman dibaca
**Status:** Berlaku
**Keputusan.** Pengganti sementara bernama `UncheckedBreachList` dan `ConsoleMailer`, dan proses `api` menuliskan peringatan setiap kali menyala bahwa Modul 02 §11 belum terpenuhi.
**Konsekuensi.** Adapter pengganti yang bernama netral akan bertahan sampai produksi tanpa ada yang menyadarinya. Nama yang canggung di composition root adalah pengingat yang tidak dapat diabaikan diam-diam.

---

## Integrasi Berkelanjutan

### D-071 · Versi mayor PostgreSQL dipatok 18 di uji, CI, dan produksi
**Status:** Berlaku · **Menutup item terbuka di:** D-054 · **Menyempurnakan:** D-029
**Konteks.** D-029 menetapkan 16 sebagai batas bawah, dan D-054 mencatat bahwa selisih mayor antara lingkungan uji dan produksi adalah kelas kesalahan yang tidak tertangkap satu test pun. Instans tertanam yang dipakai uji lokal adalah 18.
**Keputusan.** Ketiganya memakai mayor yang sama: 18. CI menjalankan `postgres:18` sebagai service container, dan produksi wajib mengikuti.
**Konsekuensi.** Menaikkan versi mayor kelak adalah satu perubahan yang menyentuh ketiganya sekaligus, bukan perubahan diam-diam di salah satunya. CI juga memverifikasi `server_encoding` adalah UTF8 sebelum menjalankan apa pun (D-053).

### D-072 · Migrasi yang sudah tercatat dijaga sidik jarinya
**Status:** Berlaku · **Melengkapi:** D-033
**Konteks.** D-033 menjanjikan pemeriksa additive-only di CI. Janji itu tercatat sejak Sesi A1 dan pemeriksanya baru ada sekarang — dokumen sempat lebih maju daripada kode.
**Keputusan.** `npm run check:migrations` menegakkan tiga hal: pola yang merusak ditolak, nomor berurutan tanpa celah maupun duplikat, dan berkas yang sudah tercatat di `migrations/CHECKSUMS.txt` tidak boleh berubah isinya. Berjalan di hook pre-commit dan di CI.
**Konsekuensi.** Mengubah migrasi yang sudah diterapkan tertangkap sebelum ia sampai ke basis data mana pun — skema produksi tidak dapat diam-diam berbeda dari berkas di repo. Pintu daruratnya `-- paadu:allow-breaking <alasan>`, sengaja jelek dibaca supaya ikut terlihat di tinjauan kode. Setiap aturan punya fixture yang melanggar, seperti aturan lint token.

---

## App Shell

*Diputuskan di Sesi B3.*

### D-073 · Tiga token layout diusulkan ke `tokens.json`
**Status:** **Menunggu persetujuan pemilik design system** · **Sumber:** Layout_System §3
**Konteks.** Shell membutuhkan tinggi top bar (46px), lebar rail (46px), dan lebar panel kanan (360px). Ketiganya ada di Layout_System tetapi tidak ada di `tokens.json`, dan ketiganya di luar skala spacing — sehingga lint token menolaknya, sebagaimana seharusnya.
**Keputusan.** `size.topbar`, `size.rail`, dan `size.panel` ditambahkan ke `tokens.json` dengan penanda `USULAN Sesi B3` di deskripsinya. Design_Tokens §11 mensyaratkan perubahan token lewat pull request dengan tinjauan pemilik design system — commit ini adalah pull request itu.
**Konflik yang ikut terangkat.** Layout_System §3 menyebut rail 46px **dan** sidebar yang diciutkan 46px, sedangkan `tokens.json` sudah memuat `size.sidebar-collapsed` 56px. Keduanya tidak dapat benar sekaligus. Implementasi memakai 46px untuk rail dan 56px untuk sidebar terciut; bila itu keliru, yang berubah hanya `tokens.json`.

### D-074 · Router ditunda sampai modul pertama punya halaman
**Status:** Berlaku · **Menyempurnakan:** D-037
**Keputusan.** TanStack Router tetap pilihan yang berlaku, tetapi belum dipasang. Shell dirakit tanpa router.
**Alasan.** Memasangnya sekarang berarti merancang bentuk URL sebelum ada satu pun halaman yang menempatinya, lalu merancangnya ulang saat modul nyata datang. Kosakata URL sudah ditetapkan di Information Architecture §2 dan D-041; yang belum ada adalah halamannya.

### D-075 · Audit aksesibilitas otomatis berjalan di CI, dan batasnya dinyatakan
**Status:** Berlaku · **Sumber:** Audit_Accessibility_Quality, Design_Handoff §8
**Keputusan.** `axe-core` berjalan di jsdom terhadap shell yang dirender penuh, dengan aturan WCAG 2.0 A/AA dan 2.1 A/AA. Ia bagian dari `npm test`, sehingga ikut menjadi gerbang CI.
**Konsekuensi yang harus dinyatakan.** Audit otomatis menangkap sekitar sepertiga masalah aksesibilitas nyata. Ia tidak dapat menilai apakah pengumuman `aria-live` benar-benar terdengar masuk akal, apakah urutan fokus terasa wajar, atau apakah kontras terukur pada piksel yang sungguh dirender. Karena itu berkas test yang sama juga menguji perilaku yang tidak dapat dilihat axe — fokus yang kembali ke pemicu, hasil yang disaring izin, pintasan yang mati saat mengetik. Uji screen reader sungguhan tetap terbuka di Design_Handoff §10.

---

## Komponen Primitif

*Diputuskan di Sesi C1, bagian pertama.*

### D-076 · Tombol nonaktif memakai `aria-disabled`, bukan atribut `disabled`
**Status:** Berlaku · **Sumber:** Component_Specs_Primitives §1
**Konteks.** Spesifikasi menganjurkan menghindari tombol disabled karena ia tidak menjelaskan apa pun. Tetapi ia tetap dibutuhkan pada kasus yang alasannya terlihat di layar, dan atribut `disabled` mengeluarkan tombol dari urutan fokus — sehingga pengguna keyboard dan screen reader tidak pernah tahu tombol itu ada.
**Keputusan.** `aria-disabled="true"` dengan penghentian klik di penangan. Tombol tetap dapat difokus dan dibacakan.
**Konsekuensi.** Penghentian aksi menjadi tanggung jawab komponen, bukan browser. Ada test yang memastikan klik tidak menjalankan aksi dan atribut `disabled` benar-benar tidak dipasang.

### D-077 · `Switch` tidak menerima `name`, ditegakkan tipe
**Status:** Berlaku · **Sumber:** Component_Specs_Primitives §7
**Konteks.** "Switch di dalam form yang punya tombol Simpan adalah bug — ia menjanjikan efek langsung lalu tidak menepatinya." Aturan yang hanya tertulis di dokumen akan dilanggar.
**Keputusan.** Properti `SwitchProps` sengaja tidak memuat `name`, sedangkan `CheckboxProps` memuatnya. Memasukkan switch ke dalam form yang dikirim tidak akan dapat dikompilasi.
**Konsekuensi.** Pembeda antara "berlaku seketika" dan "bagian dari form" menjadi keputusan yang harus diambil sadar saat memilih komponen, bukan setelah tinjauan desain.

### D-078 · Enam token semantik tambahan diusulkan
**Status:** **Menunggu persetujuan pemilik design system** · **Melanjutkan:** D-073
**Konteks.** Component_Specs_Primitives memanggil `--action-disabled-bg`, `--border-danger`, dan `--text-danger`; ketiganya tidak ada di `tokens.json`. Tanpa mereka, komponen tidak dapat menyatakan state error maupun nonaktif tanpa melanggar lint token.
**Keputusan.** Ditambahkan bersama `--action-danger-bg-hover`, `--text-success`, dan `--text-warning`, masing-masing untuk light dan dark, bertanda `USULAN Sesi C1`.
**Konsekuensi.** Sama seperti D-073: commit ini adalah pull request yang dimaksud Design_Tokens §11. Nilai dark mode sengaja tidak menyalin light mode — `danger.600` hanya mencapai kontras rendah di atas surface gelap, jadi yang dipakai `danger.300`.

### D-079 · Format dan parsing nominal tinggal di kernel bersama
**Status:** Berlaku · **Sumber:** Component_Specs_Primitives §3 dan §13
**Keputusan.** `src/shared/money-format.ts`, bukan di dalam komponen. Aturan pemisah: bila titik dan koma sama-sama muncul, yang terakhir adalah pemisah desimal; bila hanya satu dan diikuti tepat tiga angka, ia pemisah ribuan.
**Konsekuensi.** Menutup item terbuka "perilaku input mata uang saat tempel belum diuji" di §13. Teks yang tidak terbaca menghasilkan `null`, bukan `0` — nol adalah nilai yang sah, dan menyamakan keduanya akan diam-diam menyimpan nominal yang salah.

### D-080 · Lima keadaan combobox adalah tipe, bukan konvensi
**Status:** Berlaku · **Sumber:** Component_Specs_Primitives §5
**Konteks.** Spesifikasi menyebut lima keadaan yang wajib dirancang: memuat, kosong, tidak ada hasil untuk pencarian ini, gagal muat, dan opsi terpilih yang berada di luar halaman hasil. Keadaan yang hanya disebut di dokumen akan disederhanakan menjadi "ada data atau tidak" oleh implementasi pertama yang terburu-buru.
**Keputusan.** `ComboboxState` adalah union bertag. Menambahkan keadaan baru tanpa menanganinya tidak dapat dikompilasi.
**Konsekuensi.** "Belum ada pelanggan" dan "tidak ada pelanggan bernama itu" tidak dapat tertukar — keduanya menuntut tindakan berbeda dari pengguna. Opsi terpilih dibaca dari `value`, bukan dicari di dalam daftar hasil, sehingga ia tetap terbaca meski berada di halaman lain.

### D-081 · Avatar berwarna per identitas ditunda, bukan dikarang
**Status:** Berlaku · **Sumber:** Component_Specs_Primitives §9
**Konteks.** §9 meminta latar avatar diturunkan deterministik dari id pengguna. Menerapkannya berarti membangkitkan warna di dalam komponen — persis yang D-025 larang, dan lint token akan menolaknya dengan benar.
**Keputusan.** Seluruh avatar memakai satu latar netral untuk sekarang. Pembeda identitas sementara adalah inisial dan bentuk — lingkaran untuk orang, rounded square untuk company.
**Konsekuensi.** Menunggu palet warna identitas di `tokens.json`. Ramp `dataviz` sudah ada dan berjumlah delapan, tetapi ia Lapis 1 dan komponen tidak boleh menyentuhnya; yang dibutuhkan adalah token semantik yang merujuk ke sana.

### D-082 · Utang token ditutup
**Status:** Berlaku · **Menutup:** D-073, D-078 · **Menegaskan:** D-081 · **Sumber:** Design Tokens §11
**Konteks.** Tiga usulan token menumpuk menunggu keputusan pemilik design system, dan setiap sesi komponen menambah daftarnya. Utang yang menunggu keputusan adalah utang yang tumbuh.
**Keputusan.** Empat hal diputuskan sekaligus.

**1. `border-default` dan `border-strong` di light mode ditukar.** Sebelumnya `default` memakai `neutral.300` dan `strong` memakai `neutral.200`, sehingga "strong" justru berkontras lebih rendah daripada "default". Dark mode sudah benar dan menaik monoton — subtle 800, default 700, strong 600, interactive 500. Light mode kini mengikuti bentuk yang sama: subtle 100, default 200, strong 300, interactive 450. Ini menutup temuan yang diangkat sejak Sesi A2.

**2. `size.rail` dibatalkan; module rail memakai `size.sidebar-collapsed` (56px).** Layout_System §3 menulis rail 46px, tetapi §2 dokumen yang sama menyatakan lebar chrome 296px. 46 + 240 = 286, sedangkan 56 + 240 = 296. Aritmetika dokumennya sendiri yang menjawab, dan jawabannya sama dengan nilai yang sudah ada di `tokens.json` sejak awal. Satu token lebih sedikit, satu konflik hilang.

**3. `size.topbar` (46px) dan `size.panel` (360px) diterima**, beserta enam token semantik dari Sesi C1 — `action-disabled-bg`, `action-danger-bg-hover`, `border-danger`, `text-danger`, `text-success`, `text-warning`. Penanda `USULAN` dilepas dari seluruhnya.

**4. Warna avatar per identitas tetap tidak diterapkan.** Bukan ditunda lagi — ditolak sampai ada yang mengukur kontrasnya. Ramp `dataviz` berjumlah delapan dan luminansinya sangat beragam; sebagian tidak dapat memuat teks putih maupun gelap dengan aman. Menurunkan palet identitas tanpa pengukuran berarti mengirim avatar yang tidak terbaca ke produksi. Inisial dan bentuk sudah membedakan identitas hari ini.

**Konsekuensi.** Tidak ada lagi token bertanda usulan. Bila keputusan nomor 1 atau 2 keliru, yang berubah tetap hanya `tokens.json` — tidak ada komponen yang menyebut nilainya.

### D-083 · Seleksi baris adalah union bertag; aksi massal tidak menerima daftar id
**Status:** Berlaku · **Sumber:** Component_Specs_Composite §1.3
**Konteks.** "Checkbox header hanya memilih halaman ini" dan "aksi massal dieksekusi terhadap kueri filter, bukan daftar id" adalah dua aturan yang paling sering dilanggar di aplikasi enterprise, dan pelanggarannya baru terlihat pada tenant besar.
**Keputusan.** `Selection` adalah union bertag dengan tiga varian. Varian `query` **tidak memuat daftar id sama sekali**, dan aksi massal menerima `Selection`, bukan `string[]`.
**Konsekuensi.** "Mengirim 1.284 id dari klien" tidak dapat ditulis — bukan sekadar tidak dianjurkan. `togglePage` tidak pernah menghasilkan varian `query`; satu-satunya jalan ke sana adalah `selectAllMatching`, yang menerima jumlah total supaya afordansnya dapat menyebutkan angka itu. Mengubah satu baris saat seluruh hasil terpilih menurunkan cakupan ke halaman, karena "semua kecuali satu" tidak dapat dinyatakan sebagai kueri filter.

### D-084 · Angka performa tabel dibatasi pada lapisan data
**Status:** Berlaku · **Sumber:** Sesi C2
**Konteks.** Playbook meminta uji 50.000 baris dan angka performanya. Test berjalan di jsdom, yang tidak melakukan layout sama sekali.
**Keputusan.** Yang diukur dan dilaporkan hanya lapisan data: pengurutan, penyaringan, dan pembentukan halaman berkursor. Waktu cat, jank saat menggulir, dan memori **tidak** diukur, dan tidak dilaporkan seolah-olah terukur.
**Konsekuensi.** Pengukuran render sungguhan menunggu Playwright di Sesi E1, tempat audit performa dan aksesibilitas memang dijadwalkan bersama. Ambang di test sengaja longgar: test performa yang ketat akan berkedip di CI bersama, dan test yang berkedip akan dinonaktifkan orang.

### D-085 · Perhitungan baris memakai bilangan bulat berskala mikro
**Status:** Berlaku · **Sumber:** Flow_Archetypes §4, D-039
**Konteks.** Urutan delapan langkah mensyaratkan pembulatan hanya di langkah terakhir. Pecahan biner tidak dapat memenuhi itu: 0,1 + 0,2 sudah meleset sebelum langkah pertama selesai.
**Keputusan.** Seluruh hitungan antara berjalan sebagai `bigint` berskala satu juta — enam angka penjaga di bawah unit mata uang. Pembulatan terjadi sekali, saat hasil dibentuk.
**Konsekuensi.** Nilai baris yang ditampilkan dibulatkan memakai **pembagian sisa terbesar**, sehingga jumlah baris selalu persis sama dengan nilai dokumen. Tanpa itu, invarian "jumlah nilai baris faktur sama dengan subtotalnya" akan gagal pada dokumen mana pun yang angkanya tidak habis dibagi — dan ia adalah invarian nomor 5 di `tests/invariants`.

### D-086 · Diskon dokumen dialokasikan sebelum pajak, dan itu diuji sebagai pembanding
**Status:** Berlaku, menunggu V-01 · **Sumber:** Flow_Archetypes §4
**Keputusan.** Diskon dokumen dialokasikan proporsional ke setiap baris di langkah 5, sebelum pajak dihitung per baris di langkah 7.
**Konsekuensi.** Ada test yang menghitung **angka yang salah** — pajak atas neto penuh — lalu memastikan hasil implementasi berbeda darinya, beserta selisihnya. Selisih itu masuk ke pelaporan pajak, bukan ke tampilan, jadi ia layak diuji sebagai pembanding eksplisit, bukan sebagai angka harapan yang bisa saja ikut salah bila seseorang menyalinnya dari implementasi.
**Catatan status.** Urutan ini adalah **V-01** — menunggu validasi konsultan pajak, dan memblokir modul Penjualan serta Akuntansi mencapai produksi. Implementasi boleh berjalan dengan asumsi tertulis; rilis tidak.

### D-087 · Spesifisitas aturan akun dihitung basis data dengan bobot berjenjang
**Status:** Berlaku · **Sumber:** Module 07 §6, D-011
**Konteks.** Kolom `specificity` yang diisi manusia akan diisi berbeda oleh dua orang untuk aturan yang bentuknya sama. Dan bobot yang rata membuat aturan ber-kategori-item berskor sama dengan aturan ber-gudang+pajak+mitra — pemenangnya lalu ditentukan urutan baris, yaitu tidak ditentukan sama sekali.
**Keputusan.** `specificity` adalah kolom `GENERATED ALWAYS AS … STORED` dengan bobot berjenjang: kategori item 8, gudang 4, kode pajak 2, jenis mitra 1.
**Konsekuensi.** Bobotnya hidup di dua tempat — kolom terhitung dan fungsi domain yang dapat diuji tanpa basis data. Ada test invarian yang membandingkan keduanya terhadap Postgres sungguhan, sehingga keduanya tidak dapat menyimpang diam-diam.

### D-088 · Aturan seri ditolak sebagai ambigu, bukan diambil yang pertama
**Status:** Berlaku · **Sumber:** Module 07 §6
**Keputusan.** Bila dua aturan berskor sama-sama tertinggi, resolver mengembalikan `ambiguous`. Ditambah kekangan unik atas bentuk aturan, sehingga dua aturan yang persis sama tidak dapat hidup berdampingan.
**Konsekuensi.** Konfigurasi yang tidak dapat dijelaskan ketahuan saat resolve, bukan saat tutup buku. Sejalan dengan D-011: tidak ada akun cadangan, dan penolakan menyebutkan aturan apa yang kurang.

### D-089 · Akun induk tidak dapat dijurnal, ditegakkan basis data
**Status:** Berlaku · **Menambah:** Module 07 §6
**Konteks.** Modul 07 melarang akun kontrol dijurnal manual. Larangan kedua tidak tertulis tetapi mengikuti langsung dari hierarki: memposting ke akun induk membuat jumlah anak tidak sama dengan induknya, dan laporan menjadi tidak dapat dijelaskan.
**Keputusan.** Satu trigger menegakkan keduanya di `journal_lines`, bukan di layanan — karena keduanya harus berlaku juga untuk jalur tulis yang belum ada hari ini.

### D-090 · Template bagan akun adalah data, bukan kode modul
**Status:** Berlaku, mekanisme saja · **Sumber:** CLAUDE.md, D-011
**Konteks.** Company baru membutuhkan bagan akun awal, tetapi modul dilarang menyebut nomor akun.
**Keputusan.** `chart_templates` dan `chart_template_accounts` — template per negara sebagai data, mengikuti pola katalog izin. Sesi D1 membangun mekanismenya saja.
**Konsekuensi.** Isi template konkret memerlukan akuntan, sama seperti V-01 memerlukan konsultan pajak. Sampai ada, company baru mulai dengan bagan kosong.

### D-091 · `qty_available` adalah kolom terhitung, bukan kolom yang diisi
**Status:** Berlaku · **Melaksanakan:** D-014
**Konteks.** D-014 menyatakan `qty_available` tidak disimpan. Menyimpannya sebagai kolom biasa yang "dijaga aplikasi" berarti ia akan menyimpang, dan penyimpangannya baru terlihat saat barang yang dijanjikan ternyata tidak ada.
**Keputusan.** `GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED`. Ia tetap terindeks dan dapat difilter, tetapi tidak dapat ditulis.
**Konsekuensi.** Percobaan menulisnya ditolak `428C9` oleh Postgres, dan ada test yang membuktikannya. Definisi yang sama juga hidup sebagai fungsi domain, supaya lapisan aplikasi tidak menghitungnya dengan cara berbeda.

### D-092 · Reservasi memakai penguncian baris, dan itu diuji seratus kali
**Status:** Berlaku · **Sumber:** Module 05 §12
**Keputusan.** `SELECT … FOR UPDATE` atas baris saldo sebelum memeriksa ketersediaan. Port repository sengaja menamainya `lockBalance` dan tidak menyediakan pembacaan saldo tanpa kunci — layanan tidak punya jalan membaca tanpa mengunci.
**Konsekuensi.** Dua pesanan bersamaan atas sisa terakhir menghasilkan tepat satu keberhasilan. Diuji seratus putaran dengan dua transaksi sungguhan yang berjalan bersamaan di koneksi berbeda; periksa-lalu-tulis akan meloloskan keduanya.

### D-093 · Nomor urut mutasi diambil di dalam pernyataan penyisipannya
**Status:** Berlaku
**Konteks.** `stock_movements.sequence` harus urut per company dan tanpa duplikat, sedangkan mutasi ditulis dari banyak transaksi bersamaan.
**Keputusan.** Nomor diambil lewat `SELECT max(sequence) + 1` **di dalam** `INSERT … SELECT` yang sama, bukan lewat pembacaan terpisah lalu penyisipan.
**Konsekuensi.** Kekangan unik atas `(tenant_id, company_id, sequence)` menjadi jaring terakhir: dua mutasi yang tetap memperoleh nomor sama akan ditolak, bukan tersimpan diam-diam.

### D-094 · Transisi status adalah tabel, bukan `switch`
**Status:** Berlaku · **Sumber:** Flow_Archetypes §2, Module 04
**Konteks.** Penjualan adalah modul referensi. Bentuk apa pun yang dipilih di sini akan disalin dua puluh modul berikutnya, termasuk bentuk yang buruk.
**Keputusan.** `document_transitions` menyimpan `(doc_type, from, to, requires)`. Domain hanya mengevaluasi daftar yang dimuat; ia tidak memuat satu pun aturan modul.
**Konsekuensi.** Pertanyaan "siapa yang boleh mengubah faktur dari approved ke posted" dapat dijawab dengan kueri, bukan dengan membaca kode dua puluh modul. Penolakan menyertakan daftar tujuan yang tersedia, sehingga ia menjadi petunjuk alih-alih sekadar penolakan.

### D-095 · `document_numbering` Modul 04 dan `document_sequences` A3 adalah hal yang sama
**Status:** Berlaku · **Menyimpang dari:** Module 04 §6 (penamaan)
**Keputusan.** Tidak ada tabel baru. Modul 04 menyebutnya `document_numbering`; migrasi `0006` sudah membangunnya sebagai `document_sequences` beserta fungsi pengambil nomornya.
**Konsekuensi.** Diuji: sepuluh submit bersamaan menghasilkan sepuluh nomor berurutan tanpa celah dan tanpa duplikat, dan transaksi yang dibatalkan **tidak** membakar nomor — bukti bahwa penomoran memakai baris terkunci, bukan `SEQUENCE`.

### D-096 · Tiga komponen Form Layout dibangun sebagai library, bukan sebagai bagian modul
**Status:** Berlaku · **Sumber:** Component_Specs_Composite §3, gerbang Sesi D4
**Konteks.** Modul referensi membutuhkan ringkasan error, penjaga perubahan belum tersimpan, dan action footer sticky. Ketiganya tidak masuk C1 maupun C2.
**Keputusan.** Dibangun di `components/form`, bukan di dalam modul Penjualan.
**Konsekuensi.** Gerbang D4 menanyakan apakah modul referensi memerlukan komponen baru. Membangunnya di dalam modul akan membuat jawabannya "ya" sekaligus menyembunyikan komponennya dari modul lain. Penjaga perubahan menyebut secara eksplisit bahwa berpindah company mengubah konteks — akibatnya bukan kehilangan ketikan, melainkan bekerja di entitas legal yang berbeda.

### D-097 · Penjualan mendeklarasikan port; composition root menyambungkannya
**Status:** Berlaku · **Melaksanakan:** D-040 · **Sumber:** Module 04 §9
**Konteks.** Posting faktur membutuhkan penentuan akun, penulisan jurnal, dan mutasi stok — ketiganya milik modul lain. Mengimpornya langsung akan melanggar batas modul dan ditolak lint.
**Keputusan.** `application/sales/posting.ts` mendeklarasikan `AccountResolverPort`, `LedgerPort`, dan `StockPort` menurut kebutuhannya sendiri. Adapter yang menerjemahkannya ke layanan Akuntansi dan Persediaan tinggal di `composition/sales.ts` — satu-satunya berkas yang mengenal ketiganya.
**Konsekuensi.** Ini pemakaian pertama D-040 oleh modul sungguhan, dan ia bekerja: mengangkat salah satu modul menjadi layanan terpisah kelak berarti mengganti adapter di satu berkas, bukan membongkar kode modul.

### D-098 · Jurnal otomatis wajib menyimpan dokumen sumbernya
**Status:** Berlaku · **Sumber:** Design_Handoff_Spec §3
**Konteks.** `PostingService` semula tidak meneruskan `source_type` dan `source_id`; kolomnya ada di skema sejak Sesi A3 tetapi tidak pernah terisi. Test posting atomik yang menemukannya, karena ia mencari jurnal berdasarkan dokumen sumbernya dan tidak menemukan apa pun.
**Keputusan.** Keduanya menjadi bagian masukan `PostJournalInput` dan ditulis di pernyataan yang sama.
**Konsekuensi.** Penelusuran "jurnal ke sumber" menjadi mungkin. Jurnal otomatis tanpa asal adalah jurnal yang tidak dapat dijelaskan saat audit.

### D-099 · Konflik edit menjawab dengan field, pelaku, dan waktu
**Status:** Berlaku · **Melaksanakan:** D-004
**Keputusan.** `409` membawa daftar field yang bentrok beserta nilai kedua belah pihak, siapa mengubahnya, dan kapan — diambil dari `audit_log`. Field yang hanya diubah pengirim dipisahkan sebagai `mergeable`.
**Konsekuensi.** Menolak seluruh kiriman karena orang lain menyentuh field yang berbeda akan membuat pengguna mengetik ulang pekerjaan yang sebenarnya tidak bertabrakan.

---

## Gerbang Sesi D4

### D-100 · `stock_movements.sequence` memakai SEQUENCE, dan boleh berlubang
**Status:** Berlaku · **Merevisi:** D-093 · **Ditemukan oleh:** gerbang Sesi D4
**Konteks.** D-093 mengambil nomor dengan `max(sequence) + 1` di dalam pernyataan penyisipan dan menyebut kekangan unik sebagai "jaring terakhir". Gerbang membuktikan jaring itu benar-benar terpakai: enam alur penjualan yang berjalan bersamaan membuat dua transaksi membaca nilai maksimum yang sama, dan penyisipannya gagal.
**Keputusan.** `nextval('stock_movement_sequence')`. Aman terhadap konkurensi, dengan konsekuensi nomor dapat berlubang saat transaksi dibatalkan.
**Konsekuensi.** Lubang di sini tidak apa-apa, dan itu perlu dinyatakan: kolom ini penanda posisi bagi proyeksi saldo, bukan nomor dokumen. Larangan celah di D-007 berlaku untuk nomor yang dilihat auditor — nomor faktur, bukan kursor internal. D-093 dicabut sebagian: nomor dokumen tetap memakai baris terkunci, mutasi stok tidak.

### D-101 · Harga pokok memakai rata-rata tertimbang, bukan FIFO
**Status:** Berlaku, sementara · **Sumber:** Module 05 §6
**Konteks.** Tabel `cost_layers` sudah ada sejak Sesi D2 tetapi belum ada yang mengonsumsinya. Posting penjualan tetap membutuhkan angka harga pokok untuk menjurnal persediaan dan HPP.
**Keputusan.** Harga pokok satuan dibaca dari proyeksi saldo — nilai dibagi kuantitas. Adapter menyatakannya secara eksplisit alih-alih memunculkan angka tanpa keterangan asalnya.
**Konsekuensi.** Invarian ketiga di gerbang berlaku hari ini. Bila FIFO jadi diterapkan, yang berubah adalah satu adapter di composition root, dan invariannya tetap sama.

### D-102 · Gerbang D4 lolos: tidak ada komponen UI baru yang dibutuhkan
**Status:** Berlaku
**Jawaban atas pertanyaan pertama.** Modul referensi tidak memerlukan komponen yang belum ada. Tiga komponen Form Layout yang dibutuhkannya — ringkasan error, action footer sticky, dan penjaga perubahan belum tersimpan — sengaja dibangun di `components/form` pada Sesi D3 bagian 1, bukan di dalam modul (D-096).
**Jawaban atas pertanyaan kedua — satu penyimpangan dari Flow Archetypes.** Archetype 4 menyebut pemilih item selalu async; modul Penjualan belum memiliki layar, jadi pemilihnya belum dipakai di mana pun. Ini bukan penyimpangan yang diambil, melainkan bagian yang belum dibangun, dan dicatat supaya tidak lolos sebagai "sudah sesuai".
**Konsekuensi.** Design system dinyatakan terbukti. Fase D dapat berlanjut tanpa kembali ke Fase C.

---

## Audit Sesi E1

### D-103 · Tiga token dark mode diperbaiki karena gagal kontras terukur
**Status:** Berlaku · **Sumber:** WCAG 2.1 SC 1.4.3 dan 1.4.11
**Temuan.** Audit menghitung 36 pasangan token yang benar-benar dipakai, di kedua mode. Tiga gagal, seluruhnya di dark mode: `text-tertiary` 3,59:1 (Major), `text-on-accent` di atas `action-danger-bg` 3,80:1 (Major), dan `action-primary-bg` terhadap `bg-surface` 2,98:1 (Minor, meleset 0,02).
**Perbaikan.** `text-tertiary` dinaikkan ke `neutral.400`; `action-primary-bg` dinaikkan ke `indigo.400`; `text-on-accent` di dark mode menjadi `neutral.950` — teks gelap di atas aksi terang, pola baku dark mode. Seluruhnya perubahan `tokens.json`; tidak ada komponen yang disentuh.
**Konsekuensi.** Audit menjadi gerbang CI dan melaporkan **angkanya**, bukan lulus atau gagal — pasangan yang lulus di 4,52 adalah pasangan yang akan gagal begitu hex brand asli menggantikan perkiraan `#3A34B5`.

### D-104 · Invarian ketiga gerbang D4 ternyata menguji hal yang lebih lemah dari namanya
**Status:** Diperbaiki · **Ditemukan oleh:** pemeriksaan asumsi test sendiri, Sesi E1
**Temuan.** Test "akun persediaan sama dengan nilai persediaan" membandingkan nilai stok dengan jumlah mutasi bernilai — yang hanya mengulang invarian keempat dengan nama berbeda. Ia lolos **tanpa pernah menyentuh buku besar sama sekali.**
**Perbaikan.** Kini menegaskan `nilai stok − saldo akun persediaan = seluruh nilai yang pernah diterima`, sehingga kedua sisi benar-benar terikat.
**Konsekuensi.** Audit prototype mencatat dua dari empat kegagalannya ada di tesnya, bukan di kodenya. Pola yang sama terulang di sini, dan itu alasan pemeriksaan ini diminta secara eksplisit.

### D-105 · Yang tidak dapat diukur dinyatakan tidak diukur
**Status:** Berlaku
**Keputusan.** Tiga bagian audit Sesi E1 tidak dijalankan dan tidak dilaporkan sebagai lulus: uji screen reader sungguhan, zoom 200%, dan waktu cat browser beserta jank saat menggulir.
**Alasan.** Ketiganya membutuhkan browser sungguhan; Playwright belum terpasang. Melaporkan hasil jsdom sebagai "performa render" atau "audit aksesibilitas penuh" akan lebih berbahaya daripada tidak melaporkannya — ia memberi keyakinan yang tidak berdasar.
**Konsekuensi.** Ketiganya tetap terbuka. Uji screen reader juga tercantum sebagai utang di Design_Handoff §10 sejak awal, dan tidak dapat ditutup oleh alat mana pun.

---

## Observabilitas

### D-106 · Penulisan pada tabel append-only dideteksi di kode, bukan hanya ditolak saat berjalan
**Status:** Berlaku · **Sumber:** Resilience §6
**Konteks.** D-005 mencabut hak `UPDATE` dan `DELETE` dari peran aplikasi, sehingga penulisan terlarang gagal saat berjalan. Tetapi kegagalan runtime pada jalur yang jarang dilewati bisa berbulan-bulan tidak ketahuan.
**Keputusan.** `npm run check:append-only` memindai seluruh `src/` dan menolak `UPDATE`, `DELETE`, maupun `TRUNCATE` pada tabel di `src/db/append-only-tables.ts` — termasuk SQL yang menyeberang baris di dalam template literal. Berjalan di lint, hook pre-commit, dan CI.
**Konsekuensi.** Satu daftar dibaca empat pihak: migrasi, test invarian, pemeriksa ini, dan kode aplikasi. Pintu daruratnya `-- paadu:allow-append-only-write`, sengaja panjang supaya terlihat di tinjauan.

### D-107 · Pelanggaran invarian tidak dapat diturunkan menjadi peringatan
**Status:** Berlaku · **Sumber:** Resilience §7
**Keputusan.** `Telemetry.invariant()` tidak menerima parameter severity. Invarian yang gagal selalu `incident`.
**Konsekuensi.** "Belum ada pengguna yang mengeluh" bukan alasan menurunkan tingkatnya — ia berarti data sedang salah dan belum ada yang menyadarinya. Ketiga lapis melewati satu jalur yang sama, karena tiga jalur terpisah berarti hanya dua di antaranya yang benar-benar dipantau. Empat pemeriksaan berkala hidup sebagai data di `INVARIANT_CHECKS`, sehingga menambah invarian berarti menambah satu baris.

### D-108 · `X-Request-Id` turun sampai ke audit trail
**Status:** Berlaku · **Sumber:** Resilience §7, Module 17
**Temuan.** `audit_log` membawa `request_id` sejak migrasi `0005`, tetapi `auth_events` tidak — sehingga satu insiden autentikasi tidak dapat ditelusuri dari log ke jejak ke catatan. Justru peristiwa autentikasi yang paling sering perlu ditelusuri saat insiden keamanan.
**Keputusan.** Kolom ditambahkan lewat migrasi `0017`, dan id permintaan diteruskan dari lapisan HTTP melalui `RequestContext` sampai ke penulisan peristiwa.
**Konsekuensi.** Nullable dengan sengaja: peristiwa yang lahir di luar permintaan HTTP — pekerjaan terjadwal, relay outbox — tidak punya id permintaan, dan nilai palsu di sana akan membuat penelusuran menunjuk ke tempat yang salah.

---

## Koreksi Gerbang D4

*Ditulis saat menjawab ulang dua pertanyaan gerbang. Empat hal di bawah tidak tercatat sebelumnya, dan tiga di antaranya membuat D-102 terbaca lebih kuat daripada kenyataannya.*

### D-109 · D-102 dikoreksi: design system belum terbukti, ia baru belum terbantah
**Status:** Berlaku · **Mengoreksi:** D-102
**Temuan.** D-102 menyatakan modul referensi tidak memerlukan komponen UI baru. Secara teknis benar, tetapi **modul Penjualan tidak memiliki satu layar pun** — `src/interface/web/modules/` tidak ada, dan tiga komponen Form Layout yang dibangun di D3 tidak dipakai di berkas mana pun.
**Koreksi.** Gerbang D4 ada untuk menguji apakah design system bertahan saat dipakai modul nyata. Modul nyata belum memakainya. Jawaban "tidak ada komponen baru" karena itu lolos tanpa ada yang diuji.
**Konsekuensi.** Hal-hal yang biasanya baru ketahuan saat membangun layar belum tersentuh: simpan otomatis per field pada dokumen draf, navigasi sebelumnya/berikutnya yang mempertahankan filter daftar asal, dan tab bar. Gerbang wajib diulang setelah layar pertama ada.

### D-110 · Penjaga periode fiskal tidak menjaga apa pun
**Status:** Terbuka, blocking · **Sumber:** Module 04 §12
**Temuan.** Transisi `approved → posted` mensyaratkan `fiscal_period_open`, dan adapternya mengembalikan `true` tanpa syarat. Tabel `fiscal_periods` tidak pernah dibuat, padahal rencana Sesi D1 mencantumkannya di dalam cakupan.
**Akibat.** "Posting ke periode tertutup ditolak" — test negatif wajib di Modul 04 §12 — saat ini **tidak mungkin lulus maupun gagal**, karena tidak ada periode yang dapat ditutup.
**Konsekuensi.** Dicatat sebagai utang blocking, bukan sebagai detail. Syarat yang selalu terpenuhi lebih berbahaya daripada syarat yang tidak ada: ia terbaca seperti perlindungan.

### D-111 · Konversi dokumen ada di domain, tidak pernah dijalankan
**Status:** Terbuka · **Sumber:** Flow_Archetypes §3
**Temuan.** `evaluateConversion` teruji tujuh kasus dan tidak dipanggil satu layanan pun. Tidak ada yang memperbarui `qty_invoiced`, dan `converted_from_id` tidak pernah diisi.
**Konsekuensi.** Archetype 3 seluruhnya masih berupa niat: penjagaan konversi berlebih, jejak dua arah, dan penandaan perubahan harga saat konversi belum berjalan. Kolom dan constraint-nya sudah ada, jadi menyalakannya kelak bersifat menambah.

### D-112 · Mesin status Penjualan kehilangan empat perpindahan Archetype 2
**Status:** Diperbaiki · **Melengkapi:** D-094
**Temuan.** Tabel transisi di migrasi `0015` kehilangan `rejected → draft` untuk faktur — sehingga faktur yang ditolak terkunci selamanya — serta pembatalan dari `submitted` dan `approved`, dan penarikan kembali `submitted → draft`.
**Perbaikan.** Migrasi `0018` melengkapinya, dan `tests/invariants/mesin-status.test.ts` kini memeriksa kelengkapannya terhadap Archetype 2 alih-alih mempercayakannya pada mata.
**Konsekuensi.** Ini modul referensi. Mesin status yang bolong di sini akan disalin ke dua puluh modul berikutnya beserta bolongnya — dan test kelengkapan itulah yang mencegahnya.

### D-113 · Persetujuan berambang nilai belum ada
**Status:** Terbuka · **Sumber:** Flow_Archetypes §2
**Temuan.** Archetype 2 menetapkan alur persetujuan per company, per jenis dokumen, **per ambang nilai**, beserta rantai berurutan atau paralel, delegasi, eskalasi, dan alasan penolakan yang wajib. Yang terbangun hanya "pengaju bukan penyetuju".
**Konsekuensi.** Alasan penolakan bahkan belum punya kolom, padahal Archetype 2 mewajibkannya tampil di halaman detail. Ini sejalan dengan "mesin alur persetujuan" yang sudah tercatat sebagai keputusan arsitektur tertunda sejak Design_Handoff §10.

---

## Modul 06 · Pembelian

*Modul kedua. Sebagian besar catatan di bawah adalah temuan tentang modul pertama — pola yang terlihat benar dengan satu contoh baru menunjukkan bentuknya saat ada contoh kedua.*

### D-114 · Arketipe dokumen pindah dari `domain/sales/` ke `src/shared/`
**Status:** Berlaku · **Mengoreksi:** penempatan di D3
**Temuan.** `evaluateTransition` dan `evaluateConversion` adalah mesin Flow Archetypes 2 dan 3, bukan logika Penjualan. Karena keduanya tinggal di `domain/sales/`, lint `no-cross-module-import` melarang Pembelian memakainya — modul kedua hanya punya pilihan menyalin atau melanggar batas.
**Keputusan.** Dipindahkan ke `src/shared/document-lifecycle.ts` dan `src/shared/document-conversion.ts`. `docType` diubah dari union per modul menjadi `string`, karena tabel transisilah yang menentukan jenis dokumen apa yang ada, bukan tipe TypeScript.
**Konsekuensi.** Menyentuh kode Penjualan yang sudah lolos gerbang, tanpa mengubah perilakunya; 326 test menjadi jaringnya, dan seluruhnya tetap lulus. Alternatif yang ditolak: menyalin mesinnya ke Pembelian. Dua salinan aturan status akan menyimpang, dan yang menyimpang adalah aturan siapa boleh memposting apa.

### D-115 · `document_transitions.doc_type` menjadi `text`
**Status:** Berlaku · **Mengoreksi:** D3
**Temuan.** Tabel bernama `document_transitions` bertipe kolom `sales_doc_type`. Namanya generik, isinya tidak.
**Keputusan.** Diubah menjadi `text` di `0019_purchasing.sql`, dengan penanda `-- paadu:allow-breaking` karena perubahan tipe kolom adalah pola terlarang pemeriksa migrasi. Penandanya memang layak terlihat di tinjauan.
**Konsekuensi.** Validasi jenis dokumen berpindah dari basis data ke baris yang disisipkan tiap modul. Ditukar sadar: satu tabel yang melayani seluruh modul lebih berharga daripada penjagaan enum yang memaksa modul ketiga menyalin tabelnya.

### D-116 · Utang usaha lahir saat posting tagihan, bukan saat barang diterima
**Status:** Berlaku · **Sumber:** Module 06 §9
**Keputusan.** Penerimaan barang menulis `DR Persediaan / CR Akun Perantara Penerimaan Barang`. Posting tagihan menulis `DR Akun Perantara / DR Selisih Harga / DR PPN Masukan / CR Utang Usaha`, dan nilai yang mendebit akun perantara adalah kuantitas ditagih × **harga pesanan** — angka yang sama dengan yang dulu mengkreditnya.
**Alasan.** Barang masuk gudang sebelum tagihan datang, dan sering sebelum harganya pasti. Menulis langsung ke utang akan memuat laporan utang dengan angka yang belum pernah ditagih vendor mana pun, dan tidak menyisakan satu saldo pun yang dapat membuktikan berapa yang belum tertagih.
**Konsekuensi.** Saldo akun perantara pada saat mana pun sama dengan nilai barang diterima belum ditagih. Diuji sebagai invarian dengan 25 siklus acak berbibit tetap, diperiksa setelah **setiap** siklus.

### D-117 · Kontrol pencocokan hidup di tiga lapisan, dan tidak satu pun menerima parameter
**Status:** Berlaku · **Sumber:** Module 06 §11
**Keputusan.** `PostBillService.post(billId, postedBy)` tidak punya argumen ketiga. Rute `POST /bills/:id/post` tidak punya skema badan. `CHECK (qty_billed <= qty_received)` dan trigger `t40_match_guard` menolak di basis data.
**Alasan.** Kalau kontrol bisa dilewati dengan parameter, ia bukan kontrol. Bentuk tanda tangan dan bentuk skema HTTP adalah kontrolnya — bukan pemeriksaan `if` yang dapat dilewati pemanggil berikutnya.
**Konsekuensi.** Pencocokan **dijalankan ulang** saat posting, tidak dibaca dari kolom `match_status`. Kolom itu mungkin disetel sejam lalu, sebelum penerimaan dibatalkan. Yang menentukan adalah keadaan sekarang.

### D-118 · Menagih barang yang belum diterima tidak dapat di-override
**Status:** Berlaku · **Sumber:** Module 06 §11
**Keputusan.** Tiga jenis selisih diperlakukan berbeda. `received_over_ordered` dan `price_variance` punya toleransi dan dapat disetujui lewat override. `billed_over_received` tidak punya toleransi dan **tidak dapat disetujui siapa pun**, termasuk pemegang `pembelian.pencocokan.override`.
**Alasan.** Dua selisih pertama adalah kenyataan komersial yang dapat diterima dengan pertimbangan. Yang ketiga adalah pembayaran atas barang yang belum ada. Jalan keluarnya mencatat penerimaannya atau memperbaiki tagihannya, bukan menyetujui ketiadaannya.
**Konsekuensi.** Toleransi harga memakai dua batas — persen dan nilai mutlak — dan yang **longgar** yang menang: persen melindungi baris bernilai besar, nilai mutlak melindungi baris kecil yang persentasenya besar hanya karena pembaginya kecil.

### D-119 · Pemisahan tugas override ditegakkan di layanan, bukan di katalog izin
**Status:** Berlaku · **Sumber:** Module 06 §10
**Keputusan.** `pembelian.pencocokan.override` adalah izin tersendiri, tidak diberikan bersama `pembelian.tagihan.posting`. Di atasnya, dua aturan berbasis relasi: pembuat atau pengaju tagihan tidak dapat menyetujui pengecualiannya, dan penyetuju pengecualian tidak dapat memposting tagihan yang sama.
**Alasan.** Sama dengan D-009: aturan ini bergantung pada relasi pengguna dengan dokumen, bukan pada peran. Menyandikannya ke katalog izin akan meledakkan jumlah peran.
**Batas yang diakui.** Empat peran sistem yang ada — `tenant_owner`, `tenant_admin`, `company_admin`, `member` — **tidak dapat menyatakan** tiga tugas Pembelian sebagai tiga peran terpisah; `member` memegang pesanan, penerimaan, dan posting sekaligus. Izinnya sudah terpisah, jadi tenant dapat membuat peran khusus. Sampai itu dilakukan, pemisahan tugas tingkat peran belum berlaku, sedangkan pemisahan tingkat dokumen sudah — dan yang terakhir itulah yang diuji.

### D-120 · Penulis pertama `audit_log` lahir di sini
**Status:** Berlaku · **Temuan**
**Temuan.** `audit_log` dibuat di Sesi B2 dan **tidak pernah ada yang menulis ke sana**. Peristiwa override adalah tulisan pertamanya.
**Keputusan.** `PostgresAuditLog` menomori `sequence` dengan `max + 1` di bawah `pg_advisory_xact_lock` per tenant, bukan dengan SEQUENCE. Rantai `hash`/`prev_hash` dihitung dari isi yang bermakna, bukan dari seluruh baris.
**Alasan.** Celah pada urutan audit berarti baris hilang, dan tabel audit yang tidak dapat membuktikan kelengkapannya tidak berguna sebagai bukti — berbeda dengan `stock_movements.sequence` yang boleh bercelah (D-100) karena ia kursor proyeksi.
**Konsekuensi.** Penulisan audit menjadi serial per tenant. Harganya nyata dan diterima; alternatifnya adalah bukti yang tidak dapat dibuktikan.

### D-121 · Adapter Akuntansi dan Persediaan kembar di dua composition root
**Status:** Terbuka · **Sumber:** aturan proyek "jangan buat abstraksi sebelum dibutuhkan di dua tempat"
**Temuan.** `composition/purchasing.ts` mengulang `AccountResolverPort` dan `LedgerPort` hampir kata per kata dari `composition/sales.ts`.
**Keputusan.** Dibiarkan kembar untuk sekarang. Syaratnya sudah terpenuhi ("dua tempat"), tetapi bentuk yang benar baru terlihat setelah contoh ketiga — apakah port-nya identik, atau Pembelian kelak butuh konteks vendor yang Penjualan tidak punya.
**Konsekuensi.** Perubahan pada penentuan akun harus disalin ke dua berkas sampai penyatuannya dilakukan. Dicatat supaya penyatuan itu tidak lupa, bukan supaya dianggap selesai.

### D-122 · Dua invarian mesin status dibuat tidak bergantung jumlah modul
**Status:** Berlaku · **Mengoreksi:** D-112
**Temuan.** `mesin-status.test.ts` memeriksa `rows.length` pada tabel `document_transitions` lintas modul. Kedatangan Pembelian membuat kedua test gagal — gagal karena bertambah, bukan karena rusak.
**Keputusan.** Diubah menjadi pemeriksaan himpunan dan "lebih dari nol, dan setiap barisnya memenuhi syarat".
**Konsekuensi.** Invarian tetap menangkap pelanggaran nyata (perpindahan keluar dari `posted` selain `void`/`closed`; penarikan tanpa `own_document`) sambil tumbuh bersama modul berikutnya.

### D-123 · Gerbang UI Pembelian: tidak ada komponen baru karena tidak ada layar
**Status:** Terbuka · **Melanjutkan:** D-109
**Jawaban jujur atas pertanyaan gerbang.** Modul Pembelian tidak menambah satu komponen UI pun — dan alasannya sama dengan D-109: `src/interface/web/modules/` masih tidak ada. Pembelian dibangun sampai lapisan HTTP, tanpa layar.
**Penyimpangan dari Flow Archetypes yang diketahui.** Archetype 3 kini benar-benar berjalan di Pembelian (`evaluateConversion` dipanggil di penerimaan dan pembuatan tagihan, `qty_received`/`qty_billed` diperbarui) — yang berarti D-111 kini hanya berlaku untuk Penjualan, bukan untuk seluruh sistem. Archetype 2 masih kehilangan ambang nilai persetujuan (D-113), dan `approve()` di Pembelian belum memanggil `canApprove` yang sudah ditulis, persis seperti di Penjualan.

---

## Modul 08 · Pajak

*Modul ketiga. Di sini pola "modul referensi" akhirnya menunjukkan batasnya: dua dari tiga penyimpangan di bawah muncul karena pola yang benar untuk data tak-bertanggal tidak benar untuk data bertanggal berlaku.*

### D-124 · Tarif tidak dapat diubah — selalu, bukan hanya setelah dipakai
**Status:** Berlaku · **Sumber:** Module 08 §11
**Keputusan.** Trigger `t40_rate_immutable` menolak UPDATE pada `rate`, `tax_type`, `calculation_base`, `valid_from`, `is_creditable`, dan `gl_account_id` di `tax_codes` — pada baris mana pun, kapan pun. Yang boleh berubah hanya `valid_to`, `status`, dan `name`. Tidak ada endpoint `PATCH` untuk tarif, dan itu bukan kelalaian: rute yang tidak ada tidak dapat dipanggil.
**Menyimpang dari dokumen,** yang menuliskan "`PATCH` tarif pada kode yang **sudah dipakai** ditolak". "Sudah dipakai" adalah keadaan yang berubah, dan kontrol yang bergantung pada keadaan punya jendela di mana ia belum berlaku. Kode yang salah dan belum masuk buku pajak tetap dapat **dihapus**; yang sudah masuk tidak dapat dihapus (trigger `t40_used_code_undeletable`) maupun diubah.
**Konsekuensi.** Salah ketik tarif pada kode baru diperbaiki dengan hapus-dan-buat-ulang, bukan dengan sunting. Ditukar sadar dengan jaminan bahwa dokumen lama tidak pernah terhitung ulang.

### D-125 · Aturan penentuan pajak menunjuk KODE, bukan baris kode pajak
**Status:** Berlaku · **Menyimpang dari:** pola D-011
**Temuan.** `account_determination_rules.account_id` menunjuk baris `accounts` karena akun tidak bertanggal. Kode pajak bertanggal: setiap perubahan tarif melahirkan baris baru.
**Keputusan.** `tax_determination_rules.tax_code` menyimpan **teks** (`PPN-OUT`). Resolusi berjalan dua langkah: aturan menjawab kode, lalu kode ditambah tanggal dokumen menjawab versinya.
**Alasan.** Kalau aturan menunjuk baris, setiap perubahan tarif memaksa seluruh aturan penentuan ditulis ulang — dan aturan yang harus ditulis ulang setiap kali tarif berubah adalah aturan yang akan tertinggal.
**Konsekuensi.** Kehilangan foreign key ke `tax_codes`: kode yang salah ketik di aturan baru ketahuan saat resolve, sebagai `no_rate_on_date`. Ditukar sadar; alternatifnya adalah masalah yang lebih buruk dan lebih sunyi.

### D-126 · Tepat satu tarif berlaku pada satu tanggal, dijamin basis data
**Status:** Berlaku · **Sumber:** Module 08 §5
**Keputusan.** `EXCLUDE USING gist` atas `(tenant_id, company_id, code, daterange(valid_from, valid_to, '[)'))` dengan ekstensi `btree_gist`. Rentangnya setengah terbuka, sehingga `valid_to` satu versi boleh sama persis dengan `valid_from` versi berikutnya tanpa hari yang bertarif ganda.
**Alasan.** "Tarif mana yang berlaku pada tanggal ini" harus punya tepat satu jawaban. Jawaban ganda pada pajak berarti dua angka yang sama-sama dapat dibenarkan di depan pemeriksa.
**Konsekuensi.** `versionOn` di domain tetap menangani kasus `overlapping` meski basis data melarangnya — kalau ia sampai terjadi, yang rusak adalah penjaganya, dan itu harus berisik alih-alih diam-diam memilih satu baris.

### D-127 · Faktur pajak tidak memakai `lifecycle_status` maupun `document_transitions`
**Status:** Berlaku · **Menyimpang dari:** Flow Archetypes §2
**Keputusan.** `output_tax_invoices.status` adalah enum tersendiri: `draft → issued → cancelled | replaced`.
**Alasan.** Faktur pajak tidak pernah disetujui dan tidak pernah diposting ke buku besar. Memaksakannya ke Archetype 2 berarti memetakan `issued` ke `posted` dan `replaced` ke `void` — dua kebohongan kecil yang akan dibaca orang berikutnya sebagai kebenaran. Alternatif `ALTER TYPE lifecycle_status ADD VALUE` bermasalah di dalam transaksi migrasi.
**Konsekuensi.** Modul ini tidak ikut terjaga oleh invarian mesin status di `tests/invariants/mesin-status.test.ts`. Penjagaannya berpindah ke constraint (`output_issued_has_serial`) dan ke test integrasi.

### D-128 · Nomor seri dimaterialisasi per baris, dan diambil dengan kunci yang memblokir
**Status:** Berlaku · **Sumber:** Module 08 §4 dan §5
**Keputusan.** Alokasi menulis satu baris `tax_serial_usage` per nomor. Penerbitan mengambil nomor `available` terendah dengan `ORDER BY … LIMIT 1 FOR UPDATE` — **memblokir, bukan `SKIP LOCKED`**.
**Alasan.** `SKIP LOCKED` membuat penerbitan bersamaan melompati nomor yang sedang dipegang yang lain, dan lompatan pada nomor seri faktur pajak adalah temuan pemeriksaan. Materialisasi membuat "terpakai + batal + kedaluwarsa + tersisa = total dialokasikan" berlaku menurut konstruksi, bukan menurut harapan.
**Konsekuensi.** Penerbitan serial per company — pertukaran yang sama dengan D-007. Diuji: sepuluh penerbitan bersamaan menghasilkan nomor 1–10 berurutan.

### D-129 · Constraint nomor seri dikoreksi: nomor batal tetap menunjuk fakturnya
**Status:** Berlaku · **Temuan test**
**Temuan.** `CHECK ((status = 'used') = (output_tax_invoice_id IS NOT NULL))` membuat pembatalan mustahil: status berubah menjadi `cancelled`, `output_tax_invoice_id` tetap terisi, constraint pecah. Ditemukan `tests/invariants/nomor-seri-pajak.test.ts`, bukan oleh pembacaan ulang.
**Koreksi.** Dipecah menjadi dua: `available` tidak boleh menunjuk faktur; `used` wajib menunjuk faktur. `cancelled` sengaja tidak dibatasi — ia justru **harus** tetap menunjuk faktur yang dulu memakainya. "Nomor ini dibatalkan" tanpa "dibatalkan dari faktur mana" tidak menjawab pertanyaan yang ditanyakan pemeriksa.

### D-130 · Tanggal keluar dari repository sebagai teks, bukan `Date`
**Status:** Berlaku · **Sumber:** Module 08 §5
**Keputusan.** Kolom `date` dipetakan ke `YYYY-MM-DD` sebagai string di seluruh modul Pajak; `IsoDate` dibandingkan sebagai string karena ISO 8601 urut secara leksikografis.
**Alasan.** Kolom `date` di Postgres tidak punya zona waktu. Membungkusnya menjadi `Date` di Node menempelkan zona waktu server, dan dokumen tanggal 1 April di server UTC+7 berubah menjadi 31 Maret saat dibandingkan. Di modul yang seluruh kebenarannya bergantung pada "tarif mana yang berlaku pada tanggal dokumen", itu bukan detail.

### D-131 · Tidak ada satu pun angka tarif di kode
**Status:** Berlaku · **Sumber:** Module 08 peringatan pembuka
**Keputusan.** `src/domain/tax/` dan `src/application/tax/` tidak memuat satu pun tarif; angka yang ada hanyalah 100 (pembagi persen) dan bobot spesifisitas. Kolom `tax_codes.rate` **tanpa DEFAULT**. Nilai pengembangan hidup di `tools/seed/pajak-pengembangan.js`, yang bukan migrasi dan karena itu tidak pernah ikut ke produksi; ia berteriak di konsol setiap kali dijalankan.
**Menyimpang dari rencana sesi:** seed direncanakan sebagai `.sql` berparameter `psql`. Diubah menjadi skrip Node karena `psql` tidak terpasang di mesin ini, sehingga berkas `.sql` itu tidak dapat dijalankan siapa pun yang mengikuti README.
**Konsekuensi.** Test menyeed tarifnya sendiri lewat `tests/invariants/tax-fixture.ts`. Kalau suatu hari sebuah test pajak lulus tanpa memanggil `seedTaxCode`, itu berarti ada tarif yang menyelinap masuk ke kode.

### D-132 · Gerbang Pajak: tidak ada komponen UI baru, dan alasannya masih sama
**Status:** Terbuka · **Melanjutkan:** D-109, D-123
**Komponen UI baru?** Nol, dan bukan karena design system terbukti: `src/interface/web/modules/` masih tidak ada. Modul 08 §8 menuntut empat layar yang belum punya padanan komponen — pratinjau dampak saat membuat versi tarif (Archetype 7), indikator sisa alokasi nomor seri dengan peringatan menipis, daftar faktur masukan yang menampilkan **apa yang kurang** per baris, dan tampilan rekonsiliasi berdampingan. Ketiga modul terakhir menumpuk utang yang sama; gerbang UI wajib diulang setelah layar pertama ada.
**Penyimpangan dari pola yang ada?** Tiga, seluruhnya tercatat: D-125 (aturan menunjuk kode, bukan baris), D-127 (siklus hidup sendiri), D-130 (tanggal sebagai teks). Yang **tidak** menyimpang: struktur penentuan (matriks + spesifisitas berjenjang + tolak bila tidak ditemukan) identik dengan D-011, termasuk bobot yang kembar antara TypeScript dan kolom terhitung basis data.
**Yang belum dibangun sesuai cakupan sesi:** bukti potong PPh dan laporan masa. Konsekuensi yang perlu diketahui: aturan "transaksi tidak dapat diposting ke masa yang laporannya sudah dibekukan" (Module 08 §11) **ikut tertunda**, karena belum ada yang membekukan. Ia bukan terlewat, ia menunggu `tax_returns`.

---

## Sesi Antarmuka · Layar pertama yang tersambung

*Sesi ini seharusnya hanya merangkai layar di atas API yang sudah ada. Yang ditemukannya adalah bahwa API itu belum ada — dan dua cacat yang hanya dapat terlihat lewat mata, bukan lewat `expect`.*

### D-133 · Jalur baca tidak pernah dibangun, dan Penjualan tidak punya satu rute pun
**Status:** Berlaku · **Temuan**
**Temuan.** Sebelum sesi ini: modul Penjualan punya layanan lengkap dan **nol rute HTTP** — `src/interface/http/modules/sales/` tidak ada. Pembelian punya enam POST tanpa satu pun GET. Akuntansi tidak punya rute sama sekali. Dan tidak ada cara memperoleh daftar company yang dapat diakses, padahal konteks company datang dari path (D-002), sehingga layar tidak punya id untuk dimasukkan ke URL mana pun.
**Sebabnya.** Seluruh gerbang dilewati oleh test yang memanggil layanan langsung. "Modul selesai" karena itu berarti "logikanya benar", bukan "ada yang dapat memakainya".
**Yang dibangun.** Sebelas endpoint baru: daftar dan detail Penjualan beserta submit/approve/post, daftar dan detail Pembelian beserta panel pencocokan dan daftar penerimaan, bagan akun dan buku besar, data induk, dan `GET /v1/me/companies`. Port bacanya dikumpulkan di `src/application/queries.ts` — berbeda dengan port tulis yang dideklarasikan tiap modul (D-097), karena yang ini kontrak antara interface dan infrastruktur, bukan antar modul.
**Konsekuensi.** Gerbang modul berikutnya harus menuntut satu alur lewat `app.inject()` sebelum modul dinyatakan selesai.

### D-134 · Server API belum pernah dijalankan; `npm run dev` menyalakan semuanya
**Status:** Berlaku · **Temuan**
**Temuan.** Tidak ada skrip yang menjalankan server, dan ia memang tidak dapat dijalankan: alias `#` hanya ada di `tsconfig.json`, tidak di `package.json` `imports`, sehingga Node tidak dapat menyelesaikannya saat berjalan.
**Keputusan.** `tools/dev/start.js` memuat kode server lewat `ssrLoadModule` milik Vite, dengan konfigurasi yang sama dengan yang dipakai web — satu resolusi, bukan dua yang dapat menyimpang. Ia juga menyalakan PostgreSQL sementara persisten di `.paadu-dev/`, menjalankan migrasi, dan menyeed bila kosong.
**Alasan.** Menyuruh orang memasang PostgreSQL sendiri sebelum dapat melihat satu layar pun adalah cara paling pasti membuat layar itu tidak pernah dilihat. Proyek ini sudah menolak Docker sejak Sesi A3; ini konsekuensinya yang wajar.
**Konsekuensi.** Jalur produksi tetap menunggu bundel server sungguhan. `npm run dev` bukan jalur rilis, dan tidak berpura-pura menjadi itu.

### D-136 · Penentuan akun tidak menyaring company — cacat yang butuh tenant dua company
**Status:** Berlaku · **Koreksi**
**Temuan.** `createAccountResolver` di `composition/sales.ts` dan `composition/purchasing.ts` menyaring `WHERE tenant_id = $1 AND transaction_type = $2` — **tanpa `company_id`**. Seluruh tenant uji hanya punya satu company, jadi selama lima modul cacat ini tidak pernah terlihat. Seed dua company menampakkannya dalam satu percobaan: posting faktur ditolak `ambiguous`, karena dua aturan identik dari dua company sama-sama paling spesifik.
**Koreksi.** `companyId` menjadi bagian wajib konteks `AccountResolverPort`, dan kueri menyaringnya. Diterapkan di Penjualan dan Pembelian; modul Pajak sudah benar sejak awal karena `listRules` memang menerima `companyId`.
**Konsekuensi.** Seluruh test invarian yang ada tetap lulus — ia lulus juga sebelumnya, dan itulah masalahnya. **Fixture uji harus menyeed dua company**, bukan satu, supaya kelas cacat ini tidak lolos lagi. Dicatat sebagai pekerjaan berikutnya, bukan sudah selesai.

### D-135 · Batas yang diketahui pada antarmuka minimal ini
**Status:** Terbuka
Enam hal yang **belum benar**, dicatat supaya tidak disangka selesai:

1. **Sidebar tidak disaring izin.** Seluruh item `permitted: true` karena izin efektif belum diambil ke sisi web. Server tetap menolak yang tidak boleh — jadi ini kebocoran informasi navigasi, bukan kebocoran data — tetapi Information Architecture §5 menuntut yang tidak boleh dilihat tidak diakui keberadaannya.
2. **Formulir faktur membuat baris tanpa item.** `LineItemEditor` dari C3 tidak punya pemilih barang, dan sesi ini tidak membuat komponen baru. Akibatnya faktur dari layar tidak menghasilkan harga pokok maupun mutasi stok — jurnalnya hanya piutang, pendapatan, dan PPN. Alur "posting mengurangi persediaan" belum dapat dilihat dari layar.
3. **Router berbasis hash, bukan TanStack Router** (D-037 tetap tujuannya). Konsekuensinya: keadaan filter daftar tidak ada di URL, sehingga "kembali ke daftar" kehilangan filternya — persis utang yang sudah dicatat D-109.
4. **Mata uang company tidak dikirim `/v1/me/companies`**, dan layar memakai `IDR` untuk semuanya. Benar untuk data contoh, salah untuk company bermata uang lain.
5. **Tidak ada penyegaran token.** Access token kedaluwarsa membuat layar kembali ke halaman masuk alih-alih memakai refresh token yang sudah tersimpan.
6. **Tidak ada test UI untuk halaman baru.** Kesebelas test shell diarahkan ke `ShellDemo` supaya tetap menguji shell (App kini gerbang autentikasi); halaman Penjualan, Pembelian, dan Akuntansi sendiri belum punya test.

### D-137 · `TextField` menerima `type="password"`
**Status:** Berlaku
Satu-satunya perubahan pada pustaka komponen di sesi ini. Halaman masuk tidak dapat menampilkan kata sandi apa adanya, dan komponen kedua hanya untuk satu atribut akan menggandakan seluruh perilaku label, galat, dan fokus. Tidak ada komponen baru yang dibuat; berkas `pages/pages.module.css` hanya menempatkan komponen yang sudah ada — jarak dan kolom — dan seluruh nilainya lewat token.

### D-138 · Teardown test menghabisi sisa proses klaster sendiri, dan memegang sendiri direktorinya
**Status:** Berlaku
Kira-kira sekali per tiga jalan, `npm test` lulus seluruhnya lalu menggantung: `close timed out after 10000ms`. Sebabnya bukan pool yang lupa ditutup dan bukan timer — `--reporter=hanging-process` menunjukkan yang tersisa hanya `PipeWrap`, tidak satu pun `TCPWRAP`.

`embedded-postgres` menembak `taskkill /f /t` tanpa menunggunya, lalu menganggap tugasnya selesai begitu postmaster keluar. Bila postmaster mati lebih dulu daripada taskkill sempat mendata anaknya, satu proses `io_worker` milik PostgreSQL 18 tertinggal sebagai yatim. Proses itu mewarisi stdout dan stderr postmaster — dua pipa yang dibuat Node saat men-spawn — sehingga ujung tulisnya tidak pernah tertutup, Node tidak pernah menerima EOF, dan event loop tidak pernah kosong. Probe minimal memastikannya: tanpa anak yatim proses keluar dalam 1 ms, dengan satu anak yatim ia masih hidup setelah 82 detik.

Karena itu `teardown` global mendata anak yang tertinggal lewat `ParentProcessId` — nomor itu tetap tercatat meski induknya sudah mati — dan menghabisinya sambil menunggu. Penyaringan `Name='postgres.exe'` menjaga agar PID yang kebetulan dipakai ulang sistem tidak ikut terbunuh. Hanya Windows: di tempat lain postmaster menerima SIGINT dan menutup anaknya sendiri.

`persistent` sekaligus dipindah ke `true`. Bukan karena klaster uji jadi permanen, melainkan karena dengan `false` pustakalah yang menghapus direktori di dalam `stop()`, tanpa coba ulang, tepat ketika proses yatim masih menguncinya — `stop()` gagal dengan EBUSY sebelum pembersihan sempat berjalan. Penghapusan kini sepenuhnya milik teardown, yang memang sudah punya coba ulang.

Tidak dipakai: `process.exit`, `dangerouslyIgnoreUnhandledErrors`, maupun opsi apa pun yang menyembunyikan peringatan. Peringatannya benar — ada proses yang benar-benar tertinggal, dan sebelum ini ia menumpuk diam-diam di mesin pengembang.

### D-139 · Rekonsiliasi pajak dihitung per AKUN, bukan per kode pajak
**Status:** Berlaku · menggantikan bentuk jawaban `/reports/tax-reconciliation`
Versi sebelumnya mengelompokkan mutasi buku besar per baris `tax_codes` lewat join pada `gl_account_id`. Akibatnya seluruh saldo akun disalin ke **setiap** baris kode yang menunjuk akun itu. Dua versi dari satu kode sudah cukup membuat angkanya berlipat — dan versi berganda adalah keadaan normal di modul ini, bukan kasus tepi, karena tarif memang tidak pernah diubah melainkan ditutup dan digantikan (D-124). Seed pengembangan pun sengaja membuat dua versi PPN keluaran.

Sebabnya struktural: `journal_lines` hanya menyimpan `account_id` dan tidak pernah menyebut kode pajak. Saldo buku besar karena itu **tidak dapat** dibagi per kode tanpa mengarang. Grain yang benar adalah akun.

Sisi buku pajak tetap dirinci per kode di `codes`, karena `tax_ledger` memang menyimpan `tax_code_id`. Jadi selisih dihitung pada grain yang dapat dipertanggungjawabkan, sedangkan penunjuk arah "kode mana yang mengisi akun ini" tidak hilang.

Cacatnya lolos selama ini karena `tests/invariants/buku-pajak.test.ts` memberi tiap kode satu versi dan akun tersendiri — persis kasus khusus ketika query lama kebetulan benar. Test baru menambahkan kode kedua di akun yang sama dan menuntut total buku besar tidak berubah; sebelum perbaikan ia melaporkan tepat dua kali lipat.

### D-140 · Faktur pajak pengganti dan ekspor pelaporan sengaja belum dibangun
**Status:** Berlaku · ditinjau ulang setelah V-07 terjawab
Keduanya **tidak** dibangun, dan ketiadaannya adalah keputusan, bukan pekerjaan yang terlewat.

Aturan yang mengaturnya belum divalidasi konsultan pajak (V-07): syarat kapan sebuah faktur pajak boleh diganti, apa yang terjadi pada nomor seri faktur yang digantikan, bagaimana rantai penggantinya dilaporkan, serta format berkas pelaporan beserta tenggat setor dan lapornya. Membangunnya sekarang berarti menebak, dan tebakan pada pelaporan pajak tidak berhenti sebagai cacat perangkat lunak — ia menjadi berkas yang dikirim ke otoritas.

Bekasnya sengaja ditinggalkan setengah: kolom `replaces_id` sudah ada di `output_tax_invoices` beserta relasi dua arahnya, karena skema yang menambahkan kolom belakangan lebih mahal daripada kolom yang menunggu. Yang tidak ada adalah jalur untuk mengisinya — tidak ada endpoint, tidak ada layanan, dan tidak ada layar. Rantai pengganti juga sengaja tidak ditampilkan di layar detail faktur keluaran: layar yang menampilkannya akan segera diikuti pertanyaan di mana tombol membuatnya.

Ekspor pelaporan tidak punya bekas sama sekali. Tidak ada endpoint, tidak ada berkas contoh, dan tidak ada format yang diasumsikan.

Yang harus terjadi lebih dulu: V-07 dijawab konsultan pajak. Sesudah itu keduanya dibangun bersama testnya, bukan sebelum.

### D-141 · Kebijakan RLS `roles` menolak barisnya sendiri, dan pengujian lokal tidak dapat melihatnya
**Status:** Berlaku · diperbaiki di 0011 dan 0023
Ditemukan saat deploy ke VPS, bukan oleh satu pun dari 434 test yang lulus.

**Cacatnya.** Migrasi 0011 memasang kebijakan yang kedua sisinya tidak sepakat: `USING (tenant_id IS NULL OR tenant_id = paadu.current_tenant_id())` tetapi `WITH CHECK (tenant_id = paadu.current_tenant_id())`. Peran bawaan sistem disisipkan dengan `tenant_id` NULL, dan `NULL = apa pun` bernilai NULL — bukan true. WITH CHECK karena itu menolak baris yang USING-nya sendiri izinkan dibaca. Karena tabelnya memakai `FORCE ROW LEVEL SECURITY`, pemilik tabel pun tunduk; hanya superuser dan peran ber-`BYPASSRLS` yang lolos.

Akibatnya dua, dan yang kedua lebih buruk: migrasi 0011 **gagal total** pada peran non-superuser — yaitu justru `paadu_owner` yang sejak 0001 dirancang menjalankannya — dan baris `tenant_id IS NULL` tidak dapat ditulis siapa pun sesudahnya.

**Kenapa pengujian lokal tidak menangkapnya.** `tests/invariants/global-setup.ts` menjalankan migrasi sebagai `postgres`, superuser dari PostgreSQL sementara yang dinyalakannya sendiri. Superuser melewati RLS sepenuhnya. Setiap test RLS yang ada memang menguji kebijakan dengan `SET ROLE paadu_app` — tetapi seluruhnya berjalan **setelah** migrasi selesai, di basis data yang skemanya sudah jadi. Tidak ada satu pun yang menjalankan migrasinya sendiri sebagai peran yang tunduk RLS, sehingga kesalahan pada kebijakan yang menghalangi migrasi tidak punya tempat untuk muncul.

Pola yang sama untuk ketiga kalinya di repo ini: fixture uji lebih sederhana daripada kenyataan. D-139 lolos karena fixture memberi tiap kode pajak satu versi dan akun tersendiri; migrasi 0022 lahir karena seluruh test menyeed satu company per tenant; dan sekarang, karena seluruh test bermigrasi sebagai superuser.

**Perbaikannya di dua tempat, dan keduanya perlu.** 0011 diubah langsung — pengecualian sadar terhadap D-033, ditandai `paadu:allow-breaking`, karena migrasi yang mustahil dijalankan tidak dapat diperbaiki oleh migrasi sesudahnya: pemasangan baru tidak akan pernah sampai ke sana. 0023 memperbaiki basis data yang terlanjur menerapkan versi lamanya, yaitu setiap basis data yang bermigrasi sebagai superuser, dan ditulis idempoten supaya aman di kedua keadaan.

Melonggarkan WITH CHECK saja akan membuka pintu lain: `paadu_app` dapat menyisipkan peran ber-`tenant_id` NULL, yang menurut kebijakan itu terlihat oleh **seluruh** tenant. Pembatasannya karena itu dipindah ke tempat yang tepat — tiga kebijakan `RESTRICTIVE` bercakupan `TO paadu_app`, dipecah per perintah supaya SELECT tidak ikut tertutup. Membaca peran bawaan harus tetap boleh: setiap pemberian akses company mencarinya justru lewat `WHERE tenant_id IS NULL`.

**Pencegahannya.** `tests/invariants/migrasi-non-superuser.test.ts` membuat peran `NOSUPERUSER NOBYPASSRLS`, membuat basis data kosong yang dimilikinya, lalu menjalankan seluruh migrasi sebagai peran itu. Test pertamanya memastikan perannya memang tanpa keduanya — tanpa itu, sisanya hanya teater yang lulus karena RLS tidak pernah diterapkan.

**Terkait.** Kredensial migrasi kini terpisah dari kredensial runtime lewat `MIGRATION_DATABASE_URL`, didokumentasikan di `.env.example` dan README. Sebelumnya `npm run migrate` hanya membaca `DATABASE_URL`, sehingga satu-satunya kredensial yang tersedia bagi proses runtime adalah kredensial yang dapat membongkar seluruh skema.

### D-142 · Jalur pengembangan dan jalur produksi dipisah, dan `npm run dev` tidak boleh menyentuh server
**Status:** Berlaku
Ditemukan saat PM2 di VPS menjalankan `npm run dev` dan gagal berulang: migrasinya dijalankan dengan koneksi aplikasi, yang memang tidak berwenang membuat tabel.

**Kenapa `npm run dev` benar di laptop dan salah di server.** Ia melakukan tiga hal yang seluruhnya tepat saat mengembangkan dan seluruhnya berbahaya di produksi:

| Yang dilakukan `npm run dev` | Kenapa salah di server |
|---|---|
| Menyalakan PostgreSQL sementara di `.paadu-dev/` | Basis data produksi berumur lebih panjang daripada proses yang memakainya |
| Menjalankan migrasi saat menyala | Perubahan skema adalah langkah deploy yang diawasi, bukan efek samping dari restart. Koneksi runtime pun tidak berwenang melakukannya (D-141) |
| Menjalankan Vite | Hot reload menuntut sumber, kompilator, dan port kedua yang tidak ada gunanya di server |

Yang membuatnya berbahaya bukan sekadar tidak efisien: proses yang bermigrasi saat menyala akan **bermigrasi setiap kali PM2 memulihkannya**. Restart karena kehabisan memori berubah menjadi perubahan skema yang tidak diminta siapa pun.

**Jalur produksinya.** `npm start` hanya menyalakan server HTTP. Ia membaca `DATABASE_URL`, `PORT`, `TOKEN_SIGNING_SECRET`, dan `MFA_ENCRYPTION_KEY`, lalu berhenti dengan menyebutkan yang kurang bila salah satunya kosong — sebelum menyentuh basis data. Antarmuka disajikan sebagai berkas statis hasil `npm run build:web`, dengan rute non-API diarahkan ke `index.html`. `/v1` dan `/openapi.json` sengaja tidak ikut diarahkan: API yang menjawab HTML berstatus 200 saat rutenya salah menyembunyikan kesalahan pemanggilnya.

**Server ikut dibangun.** Servernya TypeScript dan memakai alias `#`; saat pengembangan Vite yang menyelesaikan keduanya lewat `ssrLoadModule` (D-134). Produksi tidak boleh menjalankan Vite, jadi hal yang sama diselesaikan sekali di muka menjadi `dist/server/main.js` lewat `vite.server.config.ts`. Dependensi runtime dibiarkan eksternal — membundel `node_modules` hanya membuatnya lebih sulit ditambal saat ada CVE.

**Pemuatan `.env`.** Dilakukan di titik masuk dengan `process.loadEnvFile`, yang **tidak menimpa** variabel yang sudah ada di lingkungan. Itu perilaku bawaan Node, dan itu yang benar di server: nilainya sering diberikan systemd, PM2, atau manajer rahasia, dan berkas `.env` yang tertinggal dari penyiapan pertama tidak boleh diam-diam mengalahkannya.

**Migrasi tetap terpisah**, dan kini menolak lebih awal bila koneksinya bukan pemilik basis data — dengan pesan yang menyebutkan bahwa yang salah adalah kredensialnya, bukan migrasinya. Sebelumnya kegagalan itu muncul di tengah jalan sebagai `permission denied for schema public`, persis yang terlihat di VPS.

`ecosystem.config.cjs` menjalankan `npm start` dengan `max_restarts` dan `min_uptime`. Tanpa keduanya, konfigurasi yang salah berubah menjadi proses yang menyala dan mati ribuan kali semalaman, dan lognya menjadi tidak terbaca justru saat paling dibutuhkan.


### D-143 · `.env.example` adalah kontrak, dan diperiksa CI
**Status:** Berlaku
Deploy gagal sembilan kali berturut-turut karena `.env` di server disusun dari `.env.example`, dan berkas itu tidak menyebut `TOKEN_SIGNING_SECRET` maupun `MFA_ENCRYPTION_KEY` — padahal `npm start` menolak menyala tanpa keduanya. Kesalahan berikutnya lebih halus: `MFA_ENCRYPTION_KEY` diisi `openssl rand -hex 32`, dan aplikasi menolaknya karena menuntut base64 32 bait. Format itu tidak tertulis di mana pun.

**Sebab yang sebenarnya, dan ia bukan soal dokumentasi.** `.env.example` diperlakukan sebagai catatan yang kebetulan ada, bukan sebagai kontrak. Tidak ada apa pun yang menghubungkannya dengan daftar variabel yang benar-benar dituntut kode, sehingga ia menua diam-diam setiap kali ada variabel baru — dan yang menemukan penuaannya adalah deploy, di tempat yang paling mahal.

**Nama saja tidak cukup.** Dua rahasia di modul ini punya syarat yang berbeda jenis: `TOKEN_SIGNING_SECRET` dihitung dalam **karakter** (minimal 32, dipakai apa adanya sebagai UTF-8), sedangkan `MFA_ENCRYPTION_KEY` dihitung dalam **bait setelah didekode** (tepat 32, base64). Keduanya terlihat seperti "rahasia acak 32-an", dan justru karena itu tertukar. Perintah pembuatnya kini dicantumkan — `openssl rand -base64 48` dan `openssl rand -base64 32` — karena instruksi "isi dengan nilai acak" tetap membiarkan orang memilih hex.

**Pemeriksanya.** `tools/check-env-example.js` membaca daftar wajib dari `src/composition/main.ts` — satu-satunya tempat yang menolak proses menyala — lalu menuntut tiga hal: setiap variabel wajib tercantum, setiap variabel wajib punya baris `Format`, dan setiap nama yang mengandung `SECRET`, `KEY`, `PASSWORD`, atau `TOKEN` punya baris `Buat` berisi perintah pembuatnya. Dipasang ke `npm run lint`, sehingga ia gerbang CI, bukan kebiasaan.

Bila bentuk daftar di `main.ts` berubah dan tidak lagi terbaca, pemeriksaan **gagal** alih-alih diam. Pemeriksa yang mati diam-diam lebih buruk daripada tidak ada pemeriksa, karena ia memberi rasa aman yang tidak berdasar.

**Kegagalan formatnya juga dipindah lebih awal.** `npm start` kini memvalidasi bentuk, bukan hanya keberadaan, sebelum menyentuh basis data — dan menyebutkan format yang benar beserta perintah pembuatnya. Nilai yang tampak hex disebutkan sebagai hex. Sebelumnya kesalahan ini muncul dari dalam `AesSecretCipher` dan hanya terlihat di log manajer proses setelah proses gagal menyala.

**Yang paling perlu diingat dari kejadian ini bukan tentang env.** Perbaikan `.env.example` sudah ditulis satu giliran sebelum deploy itu, tetapi tidak pernah di-commit — sehingga server menarik versi lama dan gagal karena celah yang sudah tertutup di komputer pengembang. Pekerjaan yang tidak di-commit tidak ada bagi siapa pun selain yang mengetiknya.


### D-144 · `@fastify/swagger` adalah dependensi runtime, dan sudah berada di tempat yang benar
**Status:** Berlaku
Server di VPS mati dengan `Cannot find package '@fastify/swagger'`, dan dugaannya paket itu salah tempat di `devDependencies`.

**Dugaan itu keliru, dan diperiksa sebelum apa pun dipindahkan.** Seluruh paket yang diimpor `src/interface/http`, `src/application`, `src/infrastructure`, dan `src/composition` — `@fastify/swagger`, `@fastify/type-provider-typebox`, `@fastify/static`, `@sinclair/typebox`, `fastify`, `pg`, `jose`, `otpauth`, `@node-rs/argon2` — sudah berada di `dependencies`. Tidak ada satu pun yang salah tempat.

Dibuktikan dengan uji yang diminta: `rm -rf node_modules`, `npm ci --omit=dev`, lalu `npm run start`. Terpasang 97 paket, server menyala dan mendengarkan. Bila ada yang salah tempat, ia akan gagal persis di titik itu.

**Sebab sebenarnya ada di server, bukan di manifes.** `node_modules` di sana tertinggal dari commit yang lebih lama — `@fastify/static` baru ditambahkan belakangan, dan `dist/server/main.js` yang dibangun sesudahnya mengimpor paket yang belum pernah dipasang. Deploy yang menjalankan `npm ci --include=dev` menutupnya. Ini bukan cacat pengemasan; ini akibat build dan install yang tidak sejalan.

**Swagger tetap di `dependencies`, tidak dimatikan di produksi.** Ia bukan alat pengembangan: `/openapi.json` dibangkitkan dari skema rute yang sama yang memvalidasi permintaan (D-031), dan dokumen yang lahir dari kode yang berjalan tidak bisa basi. Mematikannya di produksi berarti dokumen API hanya benar di laptop — tempat yang paling tidak membutuhkannya.

Bila kelak permukaannya ingin ditutup dari publik, yang dibatasi adalah **aksesnya** lewat reverse proxy atau izin, bukan keberadaannya. Menghapus rute berarti menghapus kemampuan memverifikasi apa yang benar-benar dilayani server.

### D-145 · Deploy membangun bundel server, bukan hanya frontend
**Status:** Berlaku
Langkah build di `tools/deploy/deploy.js` menjalankan `npm run build:web`. Itu hanya membangun frontend. `dist/server/main.js` tidak pernah dibangun ulang, sehingga tertinggal dari commit yang baru saja ditarik.

**Deploy tetap berakhir hijau.** Verifikasi kesehatan mengembalikan 200, PM2 melaporkan `online`, dan commit di server benar. Yang melayani tetap bundel lama. Setiap perubahan backend — rute, kebijakan, perbaikan — hilang tanpa suara, dan yang tampak justru sebaliknya.

Terbukti saat deploy 2c2e72a: `dist/web/index.html` bertanggal 08:31 UTC, `dist/server/main.js` bertanggal 07:56 UTC, dari build tangan yang tidak berhubungan.

Ini juga menjelaskan D-144. Bundel server yang dibangun tangan itu sudah mengimpor `@fastify/static`, sementara `node_modules` di sana masih dari install yang lebih lama. Build dan install berasal dari dua momen berbeda karena deploy tidak pernah menyatukan keduanya.

**Verifikasi kesehatan tidak menangkapnya, dan tidak dirancang untuk itu.** `/healthz` membuktikan ada proses yang menjawab, bukan bahwa yang menjawab dibangun dari commit ini. Gerbang yang menjawab pertanyaan berbeda dari yang kita kira sama saja dengan tidak ada gerbang.

Langkah 3 sekarang `npm run build`, yang membangun keduanya dari pohon kerja yang sama.

### D-146 · Sesi yang mati diputuskan di klien API, bukan di tiap layar
**Status:** Berlaku
Setiap layar dulu menangkap galatnya sendiri. 401 yang datang setelah aplikasi terbuka — token yang mati di tengah pemakaian — hanya menjadi teks merah "Sesi tidak berlaku." di layar itu, lengkap dengan tombol "Coba lagi" yang selamanya mengulang pesan yang sama. Tidak ada satu pun jalan ke halaman masuk.

Token yang mati adalah kondisi aplikasi, bukan kegagalan satu layar. Keputusannya sekarang diambil sekali di `panggil()`, dan `onSesiHabis` memberitahu perakitan aplikasi.

Syaratnya tiga, dan ketiganya perlu: `status === 401`, `tanpaToken !== true`, dan token benar-benar dikirim. **401 pada permintaan tanpa token bukan sesi yang mati** — itu jawaban wajar untuk kata sandi yang salah di halaman masuk, dan tanpa pembedaan ini kegagalan masuk akan memunculkan "sesi Anda berakhir" pada orang yang memang belum pernah masuk.

**Yang ikut hilang: `catch` yang menelan semua galat sebagai token kedaluwarsa.** Satu gangguan jaringan sesaat dulu membuang sesi yang masih sah. Sekarang hanya 401 yang mengeluarkan; sisanya dapat dicoba lagi.

### D-147 · Daftar kosong adalah keadaan tersendiri, bukan daftar yang belum terisi
**Status:** Berlaku
Gerbang company di `app.tsx` menyimpan `companies` sebagai array yang dimulai kosong, sehingga "belum dijawab" dan "dijawab, memang kosong" tidak dapat dibedakan:

```
companies.length === 0 ? 'Memuat company…' : 'Anda belum punya akses…'
```

Pengguna yang sudah masuk tetapi belum diberi akses ke company mana pun melihat "Memuat company…" tanpa batas waktu — indikator yang menjanjikan sesuatu yang tidak akan pernah datang. Cabang keduanya praktis tidak terjangkau.

Diganti dengan tiga keadaan terpisah: `memuat`, `siap` beserta daftarnya, dan `galat` beserta pesannya. Ini pola yang sama dengan `TableState` yang sudah dipakai seluruh halaman daftar — `loading`, `empty`, `no_match`, `error`, `ready`. Gerbang ini satu-satunya tempat yang masih memakai array telanjang.

Layar galat dan layar kosong keduanya membawa "Keluar", supaya tidak ada gerbang yang menjadi jalan buntu.

**Premis laporan awalnya keliru dan diperiksa lebih dulu.** Dugaannya `/v1/me/companies` menjawab 200 dengan daftar kosong bagi pengguna yang belum masuk. Diuji di produksi, ketiga varian permintaan tanpa sesi menjawab 401 — rutenya memanggil `requireUser` sebelum apa pun. Yang menggantung justru pengguna yang sudah masuk.

### D-148 · RLS tidak menular lewat join, dan daftar company membayarnya
**Status:** Berlaku
`GET /v1/me/companies` menjawab `{"success":true,"data":[]}` di produksi meski `company_access` berisi baris untuk pengguna yang sudah masuk.

Kueri itu berjalan lewat `asUser`, yang memasang `app.user_id` tanpa `app.tenant_id` — tenant-nya justru yang sedang dicari (D-064). 0011 membuka `company_access` khusus untuk langkah ini, dan komentar di lapisan kueri menyatakan `companies` dan `tenants` "ikut terbaca lewat join yang dibatasi baris akses itu".

**Kalimat itu keliru, dan itulah bugnya.** RLS dievaluasi per tabel. Setiap tabel yang disebut dalam kueri disaring kebijakannya sendiri, tanpa peduli tabel apa yang mengikatnya lewat join. Diukur dengan `app.user_id` terpasang dan `app.tenant_id` kosong:

```
company_access  1 baris    ← punya jalur user_id
companies       0 baris    ← hanya mengenal app.tenant_id
tenants         0 baris    ← hanya mengenal app.tenant_id
roles           4 baris    ← lolos lewat tenant_id IS NULL
join lengkap    0 baris
```

Satu tabel yang memulangkan nol sudah cukup mengosongkan seluruh join.

**Kenapa pengujian lokal hijau, dan kali ini bukan karena superuser.** Seluruh test integrasi sudah terhubung sebagai `paadu_app` lewat `options: '-c role=paadu_app'`, jadi RLS memang berlaku di sana. Sebabnya lebih sederhana dan lebih memalukan: **tidak ada satu pun test yang memanggil `/v1/me/companies`.** Pintu masuk seluruh antarmuka tanpa cakupan sama sekali. Ditutup oleh `tests/integration/daftar-company.test.ts`, yang menjalankan alur sungguhan — daftar, masuk, lalu ambil daftarnya memakai token yang dikembalikan.

**Diperbaiki dengan kebijakan terpisah, bukan dengan melonggarkan `tenant_isolation`.** Melonggarkan USING pada kebijakan yang ada akan ikut melonggarkan UPDATE dan DELETE, karena USING menentukan baris mana yang boleh disasar. Pengguna dengan konteks tenant T1 dan akses ke company di T2 lalu dapat meng-UPDATE baris T2 itu dengan `tenant_id = T1`; WITH CHECK-nya lolos, dan company berpindah tenant. `bootstrap_akses_sendiri` di 0024 memakai `FOR SELECT`, sehingga jalur baca melebar dan jalur tulis tidak bergerak sama sekali.

Yang dibuka persis sebesar yang sudah terbuka di `company_access`: baris yang aksesnya memang sudah dimiliki pengguna. Tanpa `app.user_id`, `paadu.current_user_id()` bernilai NULL dan kebijakan ini tidak menyumbang baris apa pun.

### D-149 · Seed memasang konteks tenant sendiri, dan tidak menuntut BYPASSRLS
**Status:** Berlaku
Ketiga seed — `seed:dev`, `seed:demo`, `seed:tax-dev` — gagal dengan `new row violates row-level security policy for table "tenants"` bila dijalankan memakai `DATABASE_URL` biasa. Praktik yang terbentuk: menjalankannya dengan `MIGRATION_DATABASE_URL` yang punya BYPASSRLS.

**Itu menukar hak yang besar untuk pekerjaan yang kecil.** Mengisi data contoh adalah pekerjaan biasa. Menuntut BYPASSRLS untuk itu berarti setiap orang yang ingin menjalankan demo harus memegang kredensial yang dapat membaca dan menulis seluruh tenant di server — dan kredensial migrasi sengaja dipisahkan dari runtime justru supaya tidak beredar (D-146 di README).

Yang sebenarnya dibutuhkan hanya konteks, persis seperti yang dilakukan `unit-of-work.ts` di setiap permintaan. `tools/seed/konteks.js` memasangnya lewat `set_config(..., true)`.

**Urutannya mengikat.** Konteks harus dipasang SEBELUM baris tenant disisipkan, karena kebijakan `tenants` menuntut `id = paadu.current_tenant_id()` pada WITH CHECK-nya. Dan `BEGIN` harus mendahului keduanya: `set_config(..., true)` adalah SET LOCAL, dan di luar transaksi ia hilang seketika — kegagalannya sunyi, bukan galat melainkan nol baris. Seed pajak sempat salah di titik itu.

**Dua kegagalan sunyi ikut ditemukan dan ditutup.**

Pertama, penolakan `seed:demo` berjalan dua kali bersandar pada `SELECT ... WHERE slug = ...`. Itu bekerja sebagai superuser dan diam sebagai peran aplikasi: tanpa konteks tenant, RLS menyembunyikan baris yang dicari, penjaganya menyimpulkan belum ada, lalu gagal beberapa ratus baris kemudian dengan galat kunci ganda mentah. Sekarang bersandar pada constraint unik, yang tidak dapat disembunyikan RLS.

Kedua, penemuan otomatis tenant di `seed:tax-dev` memulangkan nol baris di bawah RLS dan melaporkannya sebagai "tidak ada tenant di basis data ini". Itu kebohongan yang mahal — orang akan menjalankan `seed:dev` lagi dan menggandakan datanya. Pesannya kini menyebutkan kedua kemungkinan beserta jalan keluarnya.

**Kekurangan hak dijelaskan di awal.** `periksaKemampuan` memeriksa INSERT pada dua puluh tabel yang benar-benar ditulis seed, sebelum satu baris pun disisipkan, dan pesannya menyebut peran yang dipakai, tabel yang ditolak, dan perintah `GRANT` yang memperbaikinya.

**Kenapa tidak pernah ketahuan:** seluruh uji menyemai lewat koneksi superuser, sehingga RLS dilewati dan kebijakannya tidak pernah benar-benar diuji. Titik buta yang sama dengan D-148. `tests/integration/seed-demo.test.ts` kini menyemai sebagai `paadu_app`, sehingga setiap penegasan di dalamnya ikut membuktikan seed berjalan tanpa kredensial pemilik.

### D-150 · Istilah pajak dan akuntansi Indonesia tidak pernah diterjemahkan
**Status:** Berlaku
Produk ini akan dikirim dalam Bahasa Indonesia dan Inggris sebagai dua bahasa setara, dengan Melayu dan mungkin Thai atau Vietnam menyusul.

Tujuh istilah berikut **tetap apa adanya di seluruh bahasa**:

`NPWP` · `NPPKP` · `e-Faktur` · `Faktur Pajak` · `DPP` · `PPN` · `PPh`

**Alasannya hukum, bukan gaya.** Ketujuhnya adalah istilah yang dipakai Direktorat Jenderal Pajak, muncul di formulir resmi, dan menjadi nama kolom di berkas yang diunggah ke sistem mereka. Menerjemahkan `Faktur Pajak` menjadi "Tax Invoice" menghasilkan dokumen yang tidak cocok dengan yang diharapkan otoritas pajak — dan orang yang membacanya di Indonesia, dalam antarmuka berbahasa Inggris sekalipun, tetap menyebutnya Faktur Pajak.

`DPP` khususnya tidak punya padanan tunggal: ia Dasar Pengenaan Pajak, dan menerjemahkannya menjadi "Tax Base" kehilangan kaitannya dengan istilah yang tertulis di peraturan.

Ditegakkan dua arah. Berkas `umum.json` memuat ketujuhnya sebagai nilai yang identik di `id` dan `en`, sehingga penerjemah berikutnya melihat kesamaannya sebagai keputusan, bukan sebagai pekerjaan yang belum selesai.

**Yang TIDAK ikut aturan ini:** kata umum yang kebetulan muncul di konteks pajak — "faktur", "pajak", "periode" sendirian tetap diterjemahkan. Yang dilindungi adalah istilah bernama, bukan kosakata di sekitarnya.

### D-151 · Pemformatan mengikuti locale; nilai tidak pernah
**Status:** Berlaku
Angka, tanggal, dan mata uang ditampilkan menurut bahasa yang dipilih: `1.234.567` di Indonesia, `1,234,567` di Inggris; `20 Agustus 2026` versus `20 August 2026`.

**Nilai tersimpan, muatan API, dan seluruh perhitungan tidak pernah berubah mengikuti locale.** Angka yang tampil berbeda tetapi dihitung berbeda adalah cacat yang tidak muncul sampai audit — dan saat itu ia sudah ada di ribuan dokumen.

Ditegakkan lewat bentuk: `src/interface/web/i18n/format.ts` hanya menerima `number` dan mengembalikan `string`. Ia tidak punya jalan mengembalikan angka, dan itu disengaja — fungsi yang mengembalikan `number` dari sana cepat atau lambat akan dipakai dalam perhitungan.

**Desimal ditetapkan mata uang, bukan bahasa.** IDR nol desimal di kedua bahasa; USD dua desimal di kedua bahasa. Membiarkan bahasa menentukannya akan membuat nominal Rupiah yang sama tampil `1.234` dan `1,234.00` di dua layar, dan yang membacanya menyimpulkan salah satunya salah.

**Tanggal dokumen dibaca sebagai tanggal kalender, bukan momen.** Menguraikan `2026-08-20` sebagai momen UTC lalu menampilkannya di zona waktu pembaca menggeser sebagian tanggal satu hari — dan tanggal faktur yang meleset satu hari dapat memindahkannya ke masa pajak yang salah.

**`FY2026 P8` tidak diterjemahkan.** Notasi periode fiskal sama di seluruh sistem akuntansi, dan orang keuangan Indonesia membacanya tanpa terjemahan. Menerjemahkannya hanya membuat dua orang di ruangan yang sama menyebut periode yang sama dengan dua nama.

### D-152 · i18next dipilih sebagai pustaka i18n
**Status:** Berlaku
Dipertimbangkan tiga: `i18next` + `react-i18next`, `react-intl` (FormatJS), dan `lingui`.

| Syarat | i18next | react-intl | lingui |
|---|---|---|---|
| Aturan plural CLDR | Lewat `Intl.PluralRules` | Lewat ICU MessageFormat | Lewat ICU MessageFormat |
| Namespace per modul | Bawaan | Tidak ada — satu katalog datar | Lewat konvensi penamaan |
| Pemuatan malas per bahasa+namespace | Bawaan | Dirakit sendiri | Bawaan |
| Tipe kunci dari berkas locale | `CustomTypeOptions` | Perlu pembangkit | Perlu pembangkit |

**Yang menentukan pilihannya adalah plural.** Indonesia, Melayu, Thai, dan Vietnam masing-masing hanya punya SATU bentuk plural; Inggris punya dua. Ketiga pustaka membaca aturannya dari CLDR dan karena itu benar, tetapi i18next menyimpan bentuk plural sebagai sufiks kunci (`barisTerpilih_one`, `barisTerpilih_other`) — sehingga berkas locale Indonesia hanya memuat `_other`, dan penerjemah berikutnya tidak perlu menuliskan bentuk yang tidak pernah dipakai bahasanya. Pemeriksa CI membandingkan kunci menurut BASIS-nya, bukan menurut sufiksnya, justru karena itu.

Namespace per modul dipilih karena berpengaruh langsung ke ukuran unduhan: seseorang yang tidak pernah membuka modul Pajak tidak pernah mengunduh string Pajak, dalam bahasa mana pun. Terbukti di hasil build — satu chunk per bahasa per namespace, bukan satu katalog besar.

`react-intl` gugur di namespace: katalognya datar, dan memecahnya menuntut merakit sendiri apa yang di sini sudah jadi. `lingui` kuat di ekstraksi otomatis, tetapi ekstraksinya berbasis teks sumber di dalam kode — dan itu berlawanan dengan kunci berstruktur `modul.layar.elemen` yang dituntut produk ini.

### D-153 · Bahasa disimpan per pengguna di server; tema dan kepadatan tidak
**Status:** Berlaku
`users.preferred_language` — kolom di tabel identitas global, bukan tabel preferensi tersendiri, dan bukan di `company_access`.

**Di server, bukan di peramban.** Orang yang sama masuk dari laptop kantor dan dari ponsel; bahasa yang hanya tersimpan di `localStorage` berarti ia memilih ulang di setiap perangkat, dan mengira pilihannya tidak tersimpan. `localStorage` tetap dipakai — tetapi hanya sebagai TEBAKAN awal supaya layar pertama tidak berkedip dalam bahasa yang salah sebelum `/v1/me` menjawab. Jawaban server selalu menang.

**Di `users`, bukan di `company_access`.** Bahasa milik orangnya. Satu orang yang memegang tiga company tidak berganti bahasa saat berpindah antar company; ia hanya berpindah tempat kerja.

**Tema dan kepadatan sengaja TIDAK ikut ke server.** Keduanya menyangkut layar yang sedang dipakai — laptop terang di kantor, layar gelap di rumah, mode padat di monitor besar. Menyeragamkannya lintas perangkat justru salah.

**Daftar bahasa diulang di tiga tempat**: CHECK di kolom, `Type.Union` di skema HTTP, dan `BAHASA` di lapisan web. Menambah bahasa memang menuntut ketiganya berubah, dan itu yang diinginkan — berkas locale harus ikut dikirim. Kolom yang menerima `'ms'` sebelum berkasnya ada hanya memindahkan kegagalan ke layar pengguna, tempat ia muncul sebagai teks kosong alih-alih sebagai galat.

`PUT`, bukan `POST`, dan tanpa `Idempotency-Key`: menyimpan pilihan yang sama dua kali menghasilkan keadaan yang sama. Idempotensinya melekat pada bentuk operasinya. `withIdempotency` pun menuntut konteks company untuk menyimpan jawabannya, sementara preferensi ini berlaku di seluruh company.

**Efek samping yang layak disebut:** `GET /v1/me` menutup keterbatasan lama — sebelumnya tidak ada satu pun jalan baca yang mengetahui nama pengguna, dan menu profil menampilkan "Pengguna" bagi semua orang.

### D-154 · Label tampilan dari server hanya cadangan; `id`-nya yang menghubungkan ke terjemahan
**Status:** Berlaku
Beberapa port mengirim kalimat jadi, bukan hanya data: `DashboardQueryPort` mengirim `label: 'Pendapatan bulan ini'` dan `comparisonBasis: 'vs Juli 2026'`; ember umur piutang mengirim `label: '1–30 hari'`. Keduanya dirancang sebelum ada bahasa kedua.

**Yang tidak dilakukan: menyeret locale ke server.** Server yang tahu bahasa pembacanya akan menerima `Accept-Language`, dan sejak saat itu jawaban API berbeda menurut siapa yang bertanya — persis yang dilarang D-151. Muatan API adalah data, dan data tidak berubah menurut bahasa.

**Yang dilakukan:** setiap entri sudah membawa `id` yang stabil (`pendapatan`, `piutang`, `lewat_30`). Layar menerjemahkan lewat `id` itu, dengan teks dari server sebagai `defaultValue`. Konsekuensinya: id baru yang belum punya terjemahan muncul apa adanya dalam bahasa sumber — terlihat janggal, tetapi terbaca — alih-alih hilang menjadi ruang kosong.

`comparisonBasis` tidak punya id, dan itu ditangani dengan pemetaan eksplisit di `pages/dasbor.tsx`. Bila basis pembanding bertambah, memberinya `id` di port lebih baik daripada menambah cabang di pemetaan itu.

### D-155 · Nama dokumen pajak berbadan hukum tidak diterjemahkan sebagai frasa utuh
**Status:** Berlaku · Memperjelas D-150
D-150 menetapkan istilah yang dilindungi. Ekstraksi memunculkan pertanyaan yang belum terjawab di sana: bagaimana dengan frasa yang MEMUAT istilah itu?

Aturannya: **nama kategori dokumen yang ditetapkan peraturan tidak diterjemahkan sebagai frasa utuh.** `Faktur Pajak Keluaran`, `Faktur Pajak Masukan`, dan `Nomor Seri Faktur Pajak` tetap apa adanya di bahasa Inggris — seperti `Form W-2` tidak diterjemahkan ke bahasa Indonesia. "Keluaran" dan "Masukan" di sini bagian dari nama, bukan kata sifat yang berdiri sendiri.

**Kosakata di sekitarnya tetap diterjemahkan.** Nama modul `Pajak` menjadi `Tax`; `Kode Pajak` menjadi `Tax Codes`; `Rekonsiliasi Pajak` menjadi `Tax Reconciliation`; `Terbitkan Faktur Pajak` menjadi `Issue Faktur Pajak` — kata kerjanya diterjemahkan, objeknya tidak.

Ditegakkan `tests/unit/istilah-pajak.test.ts`, yang memeriksa dua arah: istilah yang ada di berkas Indonesia harus ada di berkas Inggris, dan padanan Inggris yang paling mungkin dikarang orang (`Tax Invoice`, `Value Added Tax`, `Taxpayer Identification Number`) tidak boleh muncul sama sekali. Masing-masing terdengar wajar dan tidak satu pun merujuk dokumen yang sama di mata Direktorat Jenderal Pajak.

### D-156 · Kalimat berjumlah disimpan utuh, tidak dirakit dari potongan
**Status:** Berlaku
Beberapa tempat merakit kalimat dari kepingan: `` `Belum ${kata}` ``, `` `${jumlah} faktur` `` + `sudah lewat jatuh tempo`, `` `Jumlah ${judul.toLowerCase()}` ``. Semuanya benar selama bahasanya satu.

Bahasa Inggris membalik urutannya (`Fully received`, bukan `Received fully`) dan menyesuaikan kata kerjanya dengan jumlah (`1 invoice IS past due`, `2 invoices ARE past due`). Tidak satu pun dapat dihasilkan perakitan semacam itu tanpa salah di salah satu bahasa.

Karena itu: **satu kunci untuk satu kalimat utuh**, dengan interpolasi untuk angkanya dan sufiks plural untuk bentuknya. Yang memuat markup memakai `<Trans>` dengan indeks komponen, bukan penggabungan JSX. Fungsi yang dulu memulangkan kalimat kini memulangkan KUNCI — `ringkasKuantitas` di `pages/pembelian.tsx` adalah contohnya.

**Berkas locale Indonesia hanya memuat `_other`.** Indonesia punya satu bentuk plural; menulis `_one` di sana berarti menulis kunci yang tidak akan pernah dipakai, dan menyesatkan penerjemah berikutnya. Pemeriksa CI membandingkan kunci menurut basisnya, bukan sufiksnya, justru karena itu.

### D-157 · Mode cluster dua instance, dengan siaran pembatalan izin
**Status:** Berlaku
`ecosystem.config.cjs` dulu memuat catatan yang menahan diri: *"Satu instance. Menaikkannya menuntut jawaban lebih dulu atas sesi, idempotency, dan penomoran dokumen di bawah beberapa proses."* Ketiganya diperiksa sebelum angka itu diubah, dan jawabannya sama: penjaganya ada di basis data, bukan di proses.

| | Mekanisme |
|---|---|
| Sesi | Tabel `sessions`, dicari lewat hash refresh token |
| Idempotency | `ON CONFLICT (tenant_id, endpoint, idempotency_key) DO NOTHING` |
| Nomor dokumen | `paadu.next_document_number()` dengan `SELECT … FOR UPDATE` |
| Urutan mutasi stok | `nextval('stock_movement_sequence')` |
| Throttle login | Dihitung dari tabel `auth_events` |

**Tidak ada pekerjaan terjadwal di proses api.** `startScheduler()` melempar — relay outbox dan pemeriksa invarian tinggal di proses `scheduler` yang belum dirakit (D-044). Saat proses itu kelak dibangun, ia **tidak boleh** dijalankan cluster: pekerjaan berjadwal yang menyala dua kali lebih berbahaya daripada restart sesaat.

**Satu-satunya yang benar-benar mengasumsikan satu proses adalah cache izin.** `invalidate()` hanya membersihkan `Map` di proses yang menangani permintaannya; instance lain menyajikan izin yang sudah dicabut sampai TTL 30 detik habis. Komentar di `authorization.ts` menamai kegagalan itu jauh sebelum cluster dinyalakan.

Diselesaikan dengan `LISTEN`/`NOTIFY` PostgreSQL, bukan Redis: basis datanya sudah ada, sudah menjadi sumber kebenaran izin, dan sudah menjadi titik gagal bersama.

**Siarannya wajib dikirim di transaksi yang sama dengan perubahannya.** PostgreSQL menyampaikan `NOTIFY` saat commit. Mengirimnya lewat koneksi lain menyampaikannya *sebelum* commit — proses lain lalu membuang cache, membaca izin yang belum berubah, dan menyimpannya kembali. Hasilnya lebih buruk daripada tidak menyiarkan: entri basi yang baru disegarkan bertahan satu TTL penuh sejak commit. Diuji langsung di `tests/integration/kesiapan-dan-penutupan.test.ts`.

`NOTIFY` tidak tahan mati, dan itu diterima: pesan yang hilang berarti kembali ke perilaku lama — basi paling lama satu TTL — bukan basi selamanya. Koneksi pendengar yang putus mengosongkan seluruh cache saat menyambung ulang, karena proses itu tidak dapat tahu pembatalan mana yang terlewat.

**`script` harus menunjuk `dist/server/main.js`, bukan `npm start`.** Mode cluster menuntut PM2 mem-fork skripnya sendiri agar soket pendengar dapat dibagi. `npm start` menyalakan Node sebagai proses cucu; PM2 tidak dapat membagi soket ke sana, dan setiap worker akan mati dengan `EADDRINUSE`.

### D-158 · Liveness dan readiness dipisahkan
**Status:** Berlaku · Menggantikan perilaku `/healthz` sebelumnya
`/healthz` dulu menyentuh basis data. Niatnya benar — endpoint yang menjawab 200 pada proses yang tidak dapat melayani apa pun membuat deploy dinyatakan berhasil tepat ketika ia gagal. Tetapi menggabungkan keduanya salah ke arah lain: gangguan basis data sesaat membuat *liveness* gagal, dan pemantau yang me-restart saat liveness gagal akan membunuh proses yang sehat — tepat ketika basis datanya sedang pulih dan restart adalah hal terakhir yang menolong.

| | Pertanyaan | Tindakan bila gagal | Menyentuh DB |
|---|---|---|---|
| `/healthz` | Apakah proses ini hidup? | Restart | Tidak |
| `/readyz` | Boleh dikirimi permintaan? | Alihkan | Ya |

`/readyz` menjawab 503 dalam tiga keadaan: belum selesai menyala, sedang menutup, atau basis data tidak terjangkau. Keadaan kedua yang membuat reload mulus — instance berhenti menyatakan siap **sebelum** berhenti mendengarkan.

`/healthz` tetap 200 saat proses sedang menutup. Proses yang sedang menyelesaikan permintaan terakhirnya memang hidup.

Skrip deploy kini memverifikasi `/readyz`, bukan `/healthz`.

### D-159 · Penutupan rapi, dan angka batasnya
**Status:** Berlaku
Sebelumnya tidak ada satu pun penangan SIGTERM/SIGINT. `pm2 reload` mengirim SIGINT lalu SIGKILL setelah `kill_timeout` — permintaan yang sedang berjalan diputus di tengah. Faktur yang sedang diposting tidak merusak basis data (transaksinya rollback), tetapi merusak kepercayaan: orang menekan "Posting", melihat galat, dan tidak tahu apakah fakturnya terposting.

Urutan penutupan: berhenti menyatakan siap → jeda 2 detik → tutup HTTP dan tunggu permintaan berjalan → tutup pendengar → tutup pool.

**Angka batasnya diturunkan dari pengukuran, bukan dari kebiasaan.** Diukur di produksi: login median 0,24–0,49 detik, dengan **ekor 3,27 detik** saat threadpool libuv penuh (argon2 native, empat utas). Batas tunggu ditetapkan 15 detik — berjarak jauh dari ekornya, bukan pas-pasan, karena yang dipotong batas ini adalah permintaan seseorang yang sedang bekerja.

`kill_timeout` PM2 ditetapkan 25 detik, wajib lebih besar daripada 2 + 15. Bila lebih kecil, SIGKILL datang di tengah penutupan yang sedang rapi, dan seluruh pekerjaan ini sia-sia tanpa satu pun tanda di log.

`forceCloseConnections: 'idle'` di Fastify: Nginx memegang koneksi upstream tetap terbuka di antara permintaan, dan tanpa opsi ini `close()` menunggu koneksi menganggur itu kedaluwarsa sendiri. `'idle'`, bukan `true` — `true` memutus koneksi yang sedang melayani permintaan.

Proses selalu keluar dengan kode 0, termasuk saat ada langkah yang lewat batas. Kode selain 0 memberi tahu PM2 bahwa proses ini mati, dan PM2 akan menyalakannya kembali di tengah reload yang justru sedang mematikannya dengan sengaja.

### D-160 · Retry Nginx dibatasi pada permintaan idempoten
**Status:** Berlaku
`proxy_next_upstream error timeout http_502 http_503 http_504`, **tanpa** `non_idempotent`.

Tanpa `non_idempotent`, Nginx tidak pernah mengulang POST/PUT/PATCH yang sudah sampai ke aplikasi. Itu yang benar di sini: mengulang `POST …/sales-documents/:id/post` yang sebenarnya sudah diproses dapat memposting faktur dua kali. `Idempotency-Key` melindunginya hanya bila kliennya mengirimkannya — dan Nginx tidak dapat tahu apakah ia mengirimkannya.

**Alamat upstream ditulis dua kali, dan itu disengaja.** PM2 mode cluster mengikat satu porta di proses master, sehingga Nginx hanya melihat satu alamat. `proxy_next_upstream` bekerja dengan berpindah ke peer *berikutnya*; dengan satu peer tidak ada berikutnya, dan Nginx langsung memulangkan 502. Entri kedua membuat percobaan ulang membuka koneksi baru ke soket yang sama, yang diserahkan master ke worker sehat.

**Perannya sekunder, dan itu perlu dikatakan.** Yang benar-benar membuat deploy tidak memutus layanan adalah mode cluster dan penutupan rapi — soketnya tidak pernah tertutup, dan worker menyelesaikan permintaannya sebelum keluar. Retry menjaring sisanya: worker yang mati di tengah permintaan. Master PM2 yang mati tidak tertolong, dan memang tidak seharusnya.

Konfigurasinya terversi di `deploy/nginx/paaduflow.conf`.
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
| Daftar kata sandi bocor sungguhan | Sebelum peluncuran. Port `BreachedPasswordList` sudah ada dan dipanggil; implementasinya belum — saat ini hanya tiruan di test, sehingga Module 02 §11 belum terpenuhi di produksi |
| Pencabutan access token sebelum kedaluwarsa | Saat lapisan HTTP dirakit. Mencabut sesi menghentikan penyegaran seketika, tetapi access token yang sudah terbit tetap berlaku sampai 15 menit |
| Idempotency untuk endpoint pra-autentikasi | Saat dibutuhkan. `idempotency_keys` bertenant dan ber-RLS, sedangkan `/v1/auth/*` berjalan sebelum tenant diketahui. Registrasi sendiri sudah idempoten secara desain (D-067) |
| Pencabutan access token sebelum kedaluwarsa | Masih terbuka dari B1. Lapisan HTTP kini ada, jadi daftar cabut punya tempat untuk dipasang |

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
| V-07 | Seluruh konfigurasi modul Pajak: tarif PPN dan tanggal berlakunya · syarat formal faktur pajak agar dapat dikreditkan · batas waktu pengkreditan pajak masukan · tarif dan kategori PPh potong pungut · tarif untuk partner tanpa NPWP · tenggat setor dan lapor · aturan faktur pajak pengganti · perlakuan pajak masukan yang tidak dapat dikreditkan · format berkas pelaporan | Konsultan pajak |

**V-07 memblokir modul Pajak mencapai produksi.** Mekanismenya lengkap dan teruji; nilainya kosong. Satu-satunya angka yang ada di repo adalah `tools/seed/pajak-pengembangan.js`, yang menandai dirinya sementara dan tidak pernah ikut ke produksi (D-131). Validasi faktur pajak masukan saat ini hanya memeriksa syarat yang dapat diturunkan dari data yang sudah ada — status PKP kedua pihak, NPWP, nomor faktur vendor, dan sifat kode pajaknya. Syarat formal selebihnya menunggu V-07.

**V-01 memblokir modul Penjualan dan Akuntansi mencapai produksi.** Implementasi boleh berjalan dengan asumsi yang tertulis di `docs/Flow_Archetypes.md` §4, tetapi tidak boleh dirilis sebelum divalidasi.
