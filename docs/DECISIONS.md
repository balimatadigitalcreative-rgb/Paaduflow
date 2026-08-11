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

**V-01 memblokir modul Penjualan dan Akuntansi mencapai produksi.** Implementasi boleh berjalan dengan asumsi yang tertulis di `docs/Flow_Archetypes.md` §4, tetapi tidak boleh dirilis sebelum divalidasi.
