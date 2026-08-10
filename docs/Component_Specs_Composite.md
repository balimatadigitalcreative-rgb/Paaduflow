# Paadu Flow — Composite Component Specs
### Step 3.2 · Fase 3 — Core Component Library

**Input:** Design Tokens (2.1), Layout System (2.2), Primitive Components (3.1).
**Aturan mutlak:** tidak ada nilai hardcode. Composite hanya menyusun primitif — bila sebuah composite butuh primitif baru, hentikan dan tambahkan ke 3.1 dulu.

> **Pengingat status Fase 1:** trademark clearance, hex brand asli, dan typeface wordmark masih terbuka. Tidak memblokir Fase 3.

---

## 1. Data Table

Komponen terpenting di seluruh produk. Ia muncul di setiap modul, dan kualitasnya menentukan apakah produk terasa profesional atau amatir.

### 1.1 Kolom

| Kemampuan | Perilaku |
|---|---|
| Sort | Klik header. Multi-sort dengan `Shift`+klik, maksimal 3 level |
| Resize | Drag pembatas header. Lebar minimum per kolom didefinisikan komponen |
| Reorder | Drag header. **Kecuali kolom yang di-pin** |
| Pin | Kiri saja. Maksimal 2 kolom — biasanya identifier dan nama |
| Visibility | Toggle per kolom lewat menu. Kolom identifier tidak dapat disembunyikan |
| Alignment | Angka kanan, teks kiri. **Header mengikuti alignment isinya** |

**Preferensi kolom disimpan per pengguna per view**, bukan per tenant. Akuntan dan kepala gudang melihat tabel yang sama dengan kebutuhan kolom yang berbeda.

### 1.2 Saved views

Kombinasi filter + kolom + sort + density disimpan sebagai view bernama. Dua cakupan:
- **Pribadi** — hanya pemiliknya
- **Company** — dibagikan ke seluruh pengguna company, hanya dapat dibuat oleh Company Admin ke atas

View wajib punya **URL sendiri** agar dapat dikirim. Ini bukan kemewahan: alur kerja nyata adalah "kirim link daftar faktur jatuh tempo ini ke akuntan", dan itu mustahil bila state hanya hidup di memori klien.

### 1.3 Seleksi baris — titik paling berbahaya

Ini sumber kesalahan massal yang paling umum di aplikasi enterprise.

**Checkbox di header hanya memilih halaman saat ini.** Tidak pernah seluruh hasil.

Untuk memilih seluruh hasil, harus ada **afordans terpisah dan eksplisit** yang menyebutkan jumlahnya: *"Pilih semua 1.284 baris yang cocok dengan filter"*. Dua mode ini harus dapat dibedakan pengguna kapan pun, karena konsekuensinya berbeda jauh.

**Aksi massal pada "seluruh hasil" dieksekusi di sisi server terhadap kueri filter**, bukan terhadap daftar ID. Mengirim 1.284 ID dari klien akan gagal diam-diam pada tenant besar.

**Dialog konfirmasi aksi massal wajib menyebut jumlah dan nama company:** *"Batalkan 1.284 faktur di PT Nusantara Jaya?"* Ini penerapan Lapis 4 indikator konteks dari Step 2.2.

Baris subtotal dan baris grup **tidak dapat dipilih**.

### 1.4 Pagination vs virtual scroll

**Pagination adalah default untuk seluruh daftar transaksional.**

Alasannya bukan performa:
- Posisi halaman dapat direferensikan dan dikirim lewat URL
- "Pilih semua di halaman ini" punya arti yang jelas; pada infinite scroll ia tidak punya arti
- Auditor dan akuntan bekerja dengan rujukan yang stabil

**Virtual scroll dipakai hanya untuk view laporan** di mana keseluruhan himpunan memang bermakna sebagai satu kesatuan — misalnya buku besar satu periode, atau daftar stok satu gudang.

Virtual scroll **mensyaratkan tinggi baris tetap**. Karena itu tinggi baris ditentukan density, bukan konten — tidak ada baris yang tumbuh mengikuti isinya.

### 1.5 Grouping & agregasi

Baris grup menampilkan nilai grup dan jumlah baris. Baris subtotal menampilkan agregat kolom numerik.

**Subtotal wajib dibedakan secara visual dari baris data biasa** — latar berbeda, bobot medium, dan pembatas atas yang lebih kuat. Subtotal yang terlihat seperti baris data adalah salah baca yang berujung salah angka.

Agregasi yang didukung: sum, average, count, min, max — **ditetapkan per kolom**, bukan dipilih pengguna secara bebas. Rata-rata dari kolom nomor dokumen tidak bermakna.

### 1.6 Inline edit

**Hanya untuk field yang aman diedit di tempat:** kuantitas, catatan, tanggal jatuh tempo, tag.

**Tidak pernah untuk field yang memicu kaskade kalkulasi atau perubahan status** — harga yang mengubah pajak dan total, akun GL, mata uang, status dokumen. Field seperti itu dibuka di form penuh di mana konsekuensinya terlihat.

Perilaku: `Enter` menyimpan dan turun ke baris berikutnya, `Tab` menyimpan dan pindah ke kolom berikutnya, `Esc` membatalkan. Optimistic dengan rollback jelas bila gagal.

### 1.7 Export

**Export selalu mengikuti filter, bukan yang terlihat di layar.** Pengguna mengasumsikan ini, dan mengekspor hanya halaman saat ini adalah kesalahan data yang sunyi.

Konfirmasi wajib menyebut jumlah baris: *"Ekspor 1.284 baris ke XLSX?"* Bila jumlahnya besar, proses berjalan async dengan notifikasi saat selesai.

Format: XLSX (default, mempertahankan tipe angka), CSV, PDF. **Export XLSX harus mengirim angka sebagai angka**, bukan string terformat — akuntan akan menghitung ulang di atasnya.

### 1.8 Empat state kosong yang berbeda

Ini sering disamakan, dan penyamaan itu membingungkan pengguna karena **tindakan yang benar berbeda untuk keempatnya**.

| State | Kapan | Yang ditampilkan | Aksi |
|---|---|---|---|
| **Belum ada data** | Belum pernah ada faktur di company ini | Penjelasan apa yang akan muncul di sini | "Buat faktur pertama" · "Impor dari sistem lama" |
| **Sedang memuat** | Permintaan berjalan | Skeleton yang menyerupai bentuk tabel akhir | — |
| **Gagal memuat** | Permintaan error | Apa yang gagal, dalam bahasa manusia | "Coba lagi" |
| **Tidak ada hasil** | Ada data, tapi filter tidak cocok | Ringkasan filter yang sedang aktif | "Hapus filter" · "Ubah filter" |

Menampilkan "Tidak ada data" untuk keempatnya berarti pengguna yang salah menyetel filter akan menyimpulkan datanya hilang.

Skeleton **wajib menyerupai bentuk tabel akhir** — jumlah kolom dan tinggi baris yang sama. Skeleton yang bentuknya salah menyebabkan layout shift saat data tiba, dan itu memindahkan tombol tepat saat pengguna hendak mengklik.

---

## 2. Filter Bar

**Quick filter chips** untuk filter yang paling sering dipakai per modul, ditetapkan saat desain modul — bukan dipilih pengguna.

**Advanced filter builder** untuk kondisi bertingkat: grup AND/OR, operator per tipe field (angka: =, ≠, >, <, antara; teks: berisi, sama dengan, kosong; tanggal: rentang dan preset relatif).

**Seluruh state filter hidup di URL.** Ini persyaratan, bukan optimasi — sebuah link harus mereproduksi tampilan yang sama persis di layar orang lain, dengan catatan konteks company-nya sama.

Badge jumlah filter aktif selalu terlihat, dan "Hapus semua" selalu tersedia satu klik. Filter yang tersembunyi adalah penyebab paling umum orang menyimpulkan datanya hilang.

**Filter tanggal wajib menyediakan preset relatif** (bulan ini, kuartal ini, tahun fiskal berjalan) — dan preset fiskal menghitung dari `fiscal_year_start_month`, bukan dari Januari.

---

## 3. Form Layout

| Pola | Kapan |
|---|---|
| Satu kolom, `container-form` 640px | Default. Sebagian besar form |
| Dua kolom, 960px | Hanya bila field-nya berpasangan secara logis (alamat, periode) |
| Multi-seksi + anchor nav | Form panjang: pengaturan pajak, konfigurasi company |

**Action footer sticky** untuk form yang lebih panjang dari satu layar. Tombol simpan yang harus dicari dengan scroll adalah kegagalan aturan tiga klik.

**Ringkasan error di atas form**, dengan tautan ke tiap field yang bermasalah. Untuk form pajak berisi 30 field, meminta pengguna menggulir mencari border merah adalah tidak manusiawi.

**Penjaga perubahan belum tersimpan.** Meninggalkan form dengan perubahan menampilkan konfirmasi. Ini berlaku juga untuk berpindah company — dan pada kasus itu konfirmasinya wajib menyebut bahwa konteks akan berubah.

---

## 4. Modal, Drawer, Sheet, Halaman

Aturan tegas. Ketidakjelasan di sini menghasilkan produk yang terasa acak.

| Komponen | Kapan | Batas |
|---|---|---|
| **Modal** | Butuh keputusan sekarang, memblokir | Maksimal satu layar konten. Tanpa scroll |
| **Drawer kanan** | Detail kontekstual sambil daftar tetap terlihat | Lebar 360–480px |
| **Bottom sheet** | Mobile saja, pengganti drawer | — |
| **Halaman penuh** | Lebih dari 10 field, atau butuh URL sendiri | — |

**Aturan pemutus:** kalau kontennya perlu dapat ditautkan, ia halaman — bukan modal. Faktur tidak pernah diedit di dalam modal.

**Konfirmasi destruktif proporsional terhadap dampaknya:**
- Dampak rendah dan dapat diurungkan → **jangan pakai dialog**. Lakukan langsung, sediakan "Urungkan" di toast
- Dampak sedang → dialog dengan konsekuensi disebut dalam angka
- Dampak tinggi atau permanen → **ketik-untuk-konfirmasi** dengan nama objeknya

Type-to-confirm dipakai hemat. Kalau ia muncul di setiap penghapusan, pengguna belajar mengetik tanpa membaca dan mekanismenya mati.

---

## 5. Command Palette (⌘K)

Jalur utama produk, bukan pelengkap. Ia yang membuat janji "maksimal tiga klik" dan "keyboard friendly" dapat ditepati.

**Empat jenis hasil, dikelompokkan:** navigasi modul · aksi cepat ("Buat faktur baru") · entitas lintas modul (pelanggan, barang, dokumen) · masuk ke AI dengan pertanyaan bebas.

**Hasil difilter oleh permission — ini persyaratan keamanan, bukan kerapian.** Pengguna tidak boleh melihat *eksistensi* data yang tidak boleh diaksesnya. Menampilkan nama pelanggan lalu menolak saat dibuka sudah membocorkan informasi.

Semua hasil dibatasi konteks company aktif. Bila ada hasil di company lain yang boleh diakses pengguna, ia ditampilkan di grup terpisah **dengan nama company-nya**, dan memilihnya memicu perpindahan konteks yang dikonfirmasi.

Riwayat terakhir muncul saat palette dibuka kosong.

---

## 6. Notification System

| Jenis | Sifat | Aturan |
|---|---|---|
| **Toast** | Transien, 5–8 detik | **Tidak pernah** untuk sesuatu yang harus ditindaklanjuti. Tempat yang tepat untuk "Urungkan" |
| **Inline alert** | Kontekstual, menetap | Untuk kondisi yang memengaruhi halaman yang sedang dilihat |
| **Notification center** | Persisten lintas sesi | Approval menunggu, proses async selesai, peringatan sistem |

**Toast yang menghilang membawa informasi yang tidak ada di tempat lain adalah bug.** Bila pengguna sedang melihat ke tempat lain, informasinya hilang selamanya.

Toast memuat objek spesifik dan aksi lanjutan: *"Faktur INV/2026/08/0142 terkirim ke budi@nusantarajaya.co.id."* dengan "Lihat" dan "Urungkan".

Maksimal tiga toast bertumpuk; sisanya antre.

---

## 7. Page Header

Susunan tetap di seluruh produk: breadcrumb → judul → badge status → **baris konteks** → aksi primer (kanan) → aksi sekunder di overflow → tab.

**Baris konteks wajib** di setiap halaman transaksional: `PT Nusantara Jaya · FY2026 P8 · IDR`. Ini Lapis 2 indikator konteks dari Step 2.2 — menempatkan konteks company di dalam fokus perhatian, bukan di pinggirnya.

Satu aksi primer. Bila terasa ada dua, hierarkinya belum diputuskan.

---

## 8. Card & KPI Card

KPI card memuat: label, nilai (tabular, bobot semibold), indikator tren, **basis pembanding yang disebut eksplisit**, dan tautan drill-down.

**Persentase tren tidak pernah ditampilkan tanpa menyebut pembandingnya.** "+12%" tidak bermakna; "+12% vs Juli 2026" bermakna. Ini kesalahan paling umum di dashboard finansial.

**Arah tren dibedakan oleh panah dan tanda, bukan hanya warna** — WCAG 1.4.1, dan juga karena "naik" tidak selalu berarti "baik". Biaya yang naik 12% berwarna hijau adalah salah baca yang mahal.

Setiap KPI card wajib punya jalur ke rinciannya. Angka agregat tanpa jalan ke sumbernya melanggar pilar Terang.

---

## 9. Activity Feed & Audit Trail

Dikelompokkan per hari. Setiap entri memuat: pelaku, waktu, aksi, dan untuk perubahan field — **nilai sebelum dan sesudah**.

**Pelaku dibedakan secara visual menjadi tiga jenis:** manusia, AI, dan sistem/otomasi. Pengguna harus dapat melihat sekilas mana perubahan yang dilakukan orang dan mana yang dilakukan AI. Ini penerapan langsung aturan AI di Brand Strategy.

Audit trail **tidak dapat diedit dan tidak dapat dihapus** dari antarmuka, oleh peran mana pun.

---

## 10. State Components

Dipakai konsisten di seluruh modul, bukan digambar ulang per halaman.

| State | Isi wajib |
|---|---|
| Empty | Judul, penjelasan satu baris, satu CTA utama, ilustrasi garis opsional |
| Error | Apa yang gagal dalam bahasa manusia, satu aksi pemulihan |
| Permission denied | Apa yang dibutuhkan dan **kepada siapa meminta** — bukan sekadar "Akses ditolak" |
| Offline | Apa yang masih bisa dilakukan, dan apa yang akan tersinkron saat kembali online |
| Tidak ada hasil | Ringkasan filter aktif, tombol hapus filter |

---

## 11. Risiko & Item Terbuka

| Item | Status | Dampak |
|---|---|---|
| Ambang virtualisasi | Belum diukur | Perlu uji beban nyata dengan data tenant besar |
| Skema URL untuk state filter | Ditunda ke Step 4.1 | Harus konsisten lintas modul, ditetapkan sekali |
| Kosakata status dokumen | Ditunda ke Step 4.1 | Dipakai oleh badge, filter, dan alur approval |
| Perilaku offline data table | Belum dirancang | Product Requirements menyebut offline untuk modul terpilih |
| Batas aksi massal | Belum ditetapkan | Berapa banyak baris yang boleh dibatalkan sekaligus sebelum butuh persetujuan tambahan |
| Aksesibilitas tabel kompleks | Perlu audit | Sticky header, kolom pinned, dan grouping semuanya menyulitkan screen reader — diuji di Step 8.1 |
