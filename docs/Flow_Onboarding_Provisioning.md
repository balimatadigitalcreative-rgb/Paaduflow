# Paadu Flow — Onboarding & Provisioning Flow
### Step 5.1 · Fase 5 — UX Flow Design

**Input:** Module 01 (Multi-Tenant & Organization Foundation), Information Architecture (4.1), Component Specs (3.1–3.4), Brand Strategy (0.2).

---

## 1. Dua Jalur

| | **Self-serve** | **Assisted** |
|---|---|---|
| Untuk | Individu, UMKM | Enterprise, grup usaha |
| Pemicu | Daftar sendiri | Permintaan demo, sales-led |
| Provisioning | Otomatis saat registrasi | Terkelola, dengan impor data |
| Company | Satu, dibuat sendiri | Beberapa, disiapkan bersama |
| Autentikasi | Email atau SSO publik | SSO korporat, SAML |
| Waktu ke nilai pertama | Menit | Hari sampai minggu |

Keduanya berujung pada model data yang sama. **Tidak ada jalur yang menghasilkan struktur berbeda** — itu akan melanggar pilar Tumbuh dan menciptakan dua produk yang harus dipelihara.

---

## 2. Alur Self-Serve

### Langkah dan keputusannya

**1 · Registrasi.** Email + kata sandi, atau SSO publik. Tidak meminta nama perusahaan di sini — meminta terlalu banyak sebelum ada nilai adalah penyebab utama orang berhenti di langkah pertama.

**2 · Verifikasi email.** Tautan berlaku 24 jam. Kirim ulang tidak mengulang form.

**3 · Provisioning otomatis.** Tenant dibuat dengan `status = trial`, plus company pertama dalam keadaan draft. **Pengguna tidak melihat langkah ini** — ia terjadi di latar.

Slug tenant diturunkan dari nama; bila bentrok, sufiks ditambahkan otomatis dan pengguna dapat mengeditnya. Slug **tidak pernah** ditolak dengan pesan error di titik ini.

**4 · Setup company.** Nama legal, NPWP, mata uang default, bulan awal tahun fiskal, alamat.

NPWP **boleh dilewati** — banyak UMKM baru mengurusnya kemudian. Tetapi ia menjadi prasyarat wajib sebelum faktur pajak pertama dapat diterbitkan, dan itu dinyatakan saat dilewati, bukan sebagai kejutan nanti.

Bulan awal tahun fiskal default Januari, dengan penjelasan singkat mengapa ini penting. Ini satu-satunya field di layar ini yang mahal untuk diubah kemudian.

**5 · Pilih modul.** Menentukan sematan awal di module rail (Step 3.3 §2). Dinyatakan eksplisit bahwa pilihan ini dapat diubah kapan saja — mengurangi kelumpuhan memilih.

**6 · Undang tim.** Dapat dilewati. Bila dilewati, pengingat muncul **sebagai kartu di dashboard**, bukan sebagai modal yang menghadang.

**7 · Dokumen pertama.** Ini first value moment — lihat §5.

### Kasus tepi yang wajib ditangani

| Kasus | Perilaku |
|---|---|
| Email sudah terdaftar | Arahkan ke Masuk. **Jangan pernah menyatakan "email ini sudah terdaftar" pada form publik tanpa autentikasi** — itu membocorkan siapa yang memakai produk. Kirim email berisi tautan masuk, dan tampilkan pesan netral |
| Email punya undangan tertunda | Jalur berbeda sepenuhnya: terima undangan, **tidak membuat tenant baru** |
| Pengguna punya akses ke banyak tenant | Setelah masuk, pilih tenant. Tenant terakhir dipakai diingat |
| Slug tenant bentrok | Sufiks otomatis, dapat diedit |
| NPWP tidak valid | Tampilkan aturan dan jumlah digit aktual. Boleh dilewati |
| Tutup browser di tengah jalan | State onboarding tersimpan. Kembali melanjutkan dari langkah terakhir, bukan mengulang |
| Undangan kedaluwarsa | Minta kirim ulang ke admin, bukan buntu |

---

## 3. Alur Assisted (Enterprise)

1. Permintaan demo → kualifikasi sales
2. Tenant disiapkan tim Paadu Flow dengan `plan_type = enterprise`
3. Konfigurasi multi-company: struktur entitas legal, mata uang, tahun fiskal per company
4. Setup SSO korporat dan pemetaan peran
5. Impor data: master data lebih dulu (pelanggan, vendor, item, akun perkiraan), lalu saldo awal
6. Validasi impor bersama pelanggan — laporan per baris, bukan hanya total
7. Pelatihan admin, lalu rollout bertahap per company

**Impor selalu dua tahap: pratinjau lalu konfirmasi.** Pratinjau menampilkan berapa baris berhasil, berapa gagal, dan **alasan per baris**. Impor yang gagal separuh tanpa penjelasan adalah cara tercepat kehilangan kepercayaan pelanggan enterprise di minggu pertama.

**Saldo awal tidak pernah diimpor sebelum master data tervalidasi.** Urutan ini tidak dapat dibalik.

---

## 4. Copy Deck

Copy asli, mengikuti Tone of Voice (Brand Strategy §4). Tidak ada placeholder.

### Layar 1 — Registrasi

| Elemen | Copy |
|---|---|
| Judul | Mulai pakai Paadu Flow |
| Sub | Gratis 14 hari. Tanpa kartu kredit. |
| Label | Email kerja · Kata sandi |
| Helper kata sandi | Minimal 12 karakter |
| Tombol | Buat akun |
| Alternatif | Atau lanjutkan dengan Google |
| Tautan | Sudah punya akun? Masuk |
| Error netral | Kami mengirim email ke alamat itu. Periksa kotak masuk Anda untuk melanjutkan. |

### Layar 2 — Verifikasi email

| Elemen | Copy |
|---|---|
| Judul | Periksa email Anda |
| Body | Kami mengirim tautan ke budi@nusantarajaya.co.id. Tautan berlaku 24 jam. |
| Tombol sekunder | Kirim ulang tautan |
| Setelah kirim ulang | Tautan baru terkirim. Yang lama sudah tidak berlaku. |
| Error kedaluwarsa | Tautan ini sudah kedaluwarsa. Kirim tautan baru untuk melanjutkan. |

### Layar 3 — Buat company pertama

| Elemen | Copy |
|---|---|
| Judul | Buat company pertama Anda |
| Sub | Company adalah entitas legal — satu PT, satu CV, atau usaha perorangan. Anda bisa menambah company lain kapan saja. |
| Label nama legal | Nama legal perusahaan |
| Placeholder | PT Nusantara Jaya Abadi |
| Helper nama legal | Sesuai akta atau NIB. Nama tampilan bisa berbeda. |
| Label NPWP | NPWP · opsional |
| Helper NPWP | Diperlukan sebelum Anda menerbitkan faktur pajak. Bisa diisi nanti. |
| Error NPWP | NPWP harus 15 atau 16 digit. Yang Anda masukkan berisi 13 digit. |
| Label mata uang | Mata uang default |
| Helper mata uang | Mata uang pelaporan company ini. Transaksi dalam mata uang lain tetap bisa dicatat. |
| Label fiskal | Bulan awal tahun fiskal |
| Helper fiskal | Sebagian besar perusahaan Indonesia memakai Januari. Ubah hanya jika tahun buku Anda berbeda — ini sulit diubah setelah ada transaksi. |
| Tombol | Lanjut |

### Layar 4 — Pilih modul

| Elemen | Copy |
|---|---|
| Judul | Apa yang ingin Anda kelola lebih dulu? |
| Sub | Pilih yang Anda butuhkan hari ini. Modul lain bisa diaktifkan kapan saja tanpa memindahkan data apa pun. |
| Tombol | Lanjut |
| Tautan lewati | Nanti saja |

### Layar 5 — Undang tim

| Elemen | Copy |
|---|---|
| Judul | Ajak tim Anda |
| Sub | Undang orang yang akan memakai Paadu Flow bersama Anda. Anda bisa mengatur akses mereka nanti. |
| Placeholder | email@perusahaan.com |
| Tombol | Kirim undangan |
| Tautan lewati | Lewati untuk sekarang |
| Konfirmasi | 3 undangan terkirim. Mereka akan muncul di Pengaturan → Pengguna setelah menerima. |

### Layar 6 — Selesai

| Elemen | Copy |
|---|---|
| Judul | PT Nusantara Jaya siap dipakai |
| Sub | Buat dokumen pertama Anda untuk melihat bagaimana semuanya terhubung. |
| CTA utama | Buat faktur pertama |
| CTA sekunder | Impor data dari sistem lama |
| Tautan | Jelajahi sendiri |

### Empty state dashboard hari pertama

| Elemen | Copy |
|---|---|
| Judul | Belum ada aktivitas |
| Body | Setelah Anda membuat faktur atau mencatat pembelian, ringkasannya muncul di sini. |
| CTA | Buat faktur pertama |

---

## 5. First Value Moment

**Didefinisikan sebagai: dokumen transaksional pertama berhasil dibuat dan angkanya muncul di dashboard.**

Bukan "akun berhasil dibuat", bukan "company tersimpan". Keduanya adalah pekerjaan yang dilakukan pengguna *untuk* produk, bukan nilai yang diterima *dari* produk.

Momen ini penting karena ia yang membuktikan positioning: data mengalir tanpa disinkronkan. Pengguna membuat satu faktur, lalu melihat angkanya muncul di dashboard, di piutang, dan di laporan penjualan — tanpa melakukan apa pun.

**Konsekuensi desain:** setiap keputusan onboarding dinilai dari apakah ia mempercepat atau memperlambat momen ini. Karena itu NPWP boleh dilewati, undang tim boleh dilewati, dan pemilihan modul dinyatakan tidak permanen.

**Trial 14 hari dihitung dari titik ini, bukan dari registrasi.** Pengguna yang mendaftar lalu sibuk dua minggu tidak kehilangan masa cobanya sebelum sempat mencoba.

---

## 6. Aturan Tiga Klik — Diuji

Diukur dari dashboard, dengan mouse. Jalur keyboard lewat `⌘K` selalu lebih pendek.

| Tugas | Jalur | Klik | |
|---|---|---|---|
| Buat faktur | Rail Penjualan → Faktur → Buat faktur | 3 | ✅ |
| Lihat faktur jatuh tempo | Rail Penjualan → Faktur → chip Jatuh tempo | 3 | ✅ |
| Tambah pelanggan | Rail Penjualan → Pelanggan → Tambah | 3 | ✅ |
| Setujui pengajuan | Notifikasi → item → Setujui | 3 | ✅ |
| Ganti company | Pengalih → pilih company | 2 | ✅ |
| Undang pengguna | Pengaturan → Pengguna → Undang | 3 | ✅ |
| Tambah company | Pengaturan → Company → Tambah | 3 | ✅ |
| **Ekspor faktur bulan ini** | Penjualan → Faktur → filter → Ekspor | **4** | ❌ |
| **Posting jurnal** | Akuntansi → Jurnal → pilih → Posting | **4** | ❌ |

**Perbaikan untuk ekspor:** daftar faktur default terfilter ke periode berjalan, sehingga Ekspor menjadi klik ketiga. Saved view yang difavoritkan juga memotongnya menjadi dua.

**Posting jurnal sengaja dibiarkan gagal.** Aturan tiga klik berlaku untuk **tugas umum**, dan posting ke buku besar bukan tugas yang seharusnya dipermudah. Gesekan di sini adalah fitur. Ini dicatat sebagai pengecualian eksplisit, bukan kelalaian.

---

## 7. Undangan & Penerimaan

1. Admin mengundang lewat email, memilih peran dan company yang dapat diakses
2. Undangan berlaku 7 hari
3. Penerima yang **belum punya akun**: buat kata sandi → langsung masuk ke company yang diundang. **Tidak melewati onboarding company** — company sudah ada
4. Penerima yang **sudah punya akun**: undangan muncul sebagai notifikasi. Menerimanya menambahkan tenant ke daftar akses, tidak mengganti apa pun
5. Undangan kedaluwarsa: tautan menampilkan cara meminta kirim ulang, bukan halaman buntu

**Undangan yang belum diterima terlihat di Pengaturan → Pengguna** dengan status tertunda dan tombol kirim ulang. Undangan yang menghilang dari pandangan admin adalah sumber kebingungan yang umum.

---

## 8. Siklus Hidup Tenant

| Status | Akses | UI |
|---|---|---|
| `trial` | Penuh | Hitung mundur muncul saat tersisa ≤5 hari. Sebelum itu, tidak mengganggu |
| `active` | Penuh | Tidak ada banner |
| `past_due` | Penuh, masa tenggang 7 hari | Banner: pembayaran gagal, cara memperbaiki |
| `suspended` | **Baca saja + ekspor** | Banner permanen dengan langkah pemulihan |
| `churned` | Masuk untuk ekspor saja | Pemberitahuan retensi data dan tenggat |

### Keputusan: `suspended` berarti baca-saja, bukan terkunci

Mengunci sebuah bisnis dari catatan akuntansinya sendiri karena pembayaran gagal adalah tindakan yang tidak proporsional — dan di banyak yurisdiksi, catatan itu wajib mereka simpan dan sanggup tunjukkan kepada otoritas pajak.

**Ekspor selalu berfungsi di setiap status, termasuk `churned`.** Data pelanggan adalah milik pelanggan. Menahannya sebagai alat tekanan komersial adalah dark pattern, dan Brand Strategy melarangnya secara eksplisit.

Setiap transisi status memicu notifikasi, sesuai Functional Requirements Modul 01.

---

## 9. Risiko & Item Terbuka

| Item | Status | Dampak |
|---|---|---|
| Panjang trial 14 hari | Asumsi | Perlu divalidasi terhadap siklus penjualan nyata |
| Aturan validasi NPWP | Belum lengkap | Modul 01 menyebut format bervariasi per negara |
| Kebijakan retensi data `churned` | Belum ditetapkan | Perlu keputusan legal, bukan desain |
| State onboarding tersimpan | Belum ada di skema | Butuh kolom progres agar pengguna dapat melanjutkan |
| Impor data enterprise | Alur belum dirinci | Didesain bersama modul terkait |
| Wireframe visual per layar | Belum dibuat | Copy deck sudah cukup untuk mulai; wireframe menyusul di Fase 6 |
