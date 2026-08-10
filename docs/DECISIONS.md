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
