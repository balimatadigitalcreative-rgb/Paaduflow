# Demo Paadu Flow — sepuluh menit

Naskah ini untuk ditunjukkan ke calon pelanggan. Setiap langkah pernah
dijalankan, bukan disusun dari membaca kode — alurnya diuji di
`tests/integration/seed-demo.test.ts`.

Sepuluh menit tidak cukup untuk seluruh produk, dan memang tidak perlu. Naskah
ini hanya membawa tiga hal yang membedakan, lalu berhenti.

---

## Sebelum masuk ruangan

```bash
npm run migrate
npm run seed:demo
```

Seed mencetak seluruh akun beserta kata sandinya di akhir. **Catat sebelum
menutup jendela terminal** — tidak ada tempat lain yang menyimpannya.

Seed menolak berjalan dua kali di basis data yang sama. Bila perlu mengulang,
pesannya menyebutkan perintahnya.

### Akun

| Alamat | Peran | Dipakai di langkah |
|---|---|---|
| `direktur@demo.paaduflow.id` | Pemilik Tenant | 1–5 |
| `akuntan@demo.paaduflow.id` | Admin Company | cadangan |
| `penjualan@demo.paaduflow.id` | Anggota | cadangan |

Kata sandi ketiganya sama: `demo paadu flow 2026 yang panjang`

**Pakai `direktur@` untuk seluruh naskah.** Dua akun lain ada untuk menjawab
pertanyaan tentang peran, bukan untuk dipakai berpindah-pindah di tengah demo.

### Yang sudah terisi

| Company | Tahun fiskal | Isi |
|---|---|---|
| PT Sinar Rejeki Nusantara | mulai Januari | 12 bulan riwayat penuh |
| PT Kencana Abadi Sejahtera | mulai **April** | riwayat lebih kecil |

Keduanya berisi faktur di lima status, tiga pesanan pembelian dengan satu
penerimaan sebagian, dan satu tagihan yang gagal pencocokan tiga arah.

### Periksa satu menit sebelum mulai

Buka dasbor. Bila grafik dua belas bulan terisi dan kartu KPI menunjukkan
angka, seluruh naskah ini akan berjalan. Bila kosong, seed belum jalan.

---

## Menit 0–2 · Dasbor, dan kenapa angkanya layak dipercaya

Masuk sebagai `direktur@demo.paaduflow.id`.

**Yang ditunjukkan:** empat kartu KPI dan pendapatan dua belas bulan.

**Yang dikatakan:**

> Setiap persentase di sini menyebut pembandingnya. Bukan "+12%", tapi "+12% vs
> Juli 2026". Persentase tanpa pembanding tidak bermakna, dan itu kesalahan
> paling umum di dasbor keuangan.

Tunjuk kartu **Piutang beredar**. Panahnya ke atas, warnanya bukan hijau.

> Naik tidak selalu berarti baik. Piutang yang menumpuk adalah kabar buruk, dan
> sistem ini tahu bedanya. Arahnya juga ditandai panah dan tanda, bukan hanya
> warna — supaya tetap terbaca oleh yang buta warna.

Tunjuk kartu **Piutang jatuh tempo**. Ia tidak menampilkan persentase sama
sekali.

> Ini dihitung relatif terhadap hari ini. Membandingkannya dengan bulan lalu
> berarti membandingkan dua definisi berbeda, jadi sistem memilih diam daripada
> menampilkan angka yang terdengar meyakinkan tetapi salah.

**Jangan** menghabiskan waktu di sini. Dua menit, lalu lanjut.

---

## Menit 2–5 · Faktur masuk ke buku besar tanpa sinkronisasi

Ini bagian terpenting. Jangan diburu.

**Penjualan → Faktur baru.**

Isi satu baris: pelanggan mana pun dari daftar, deskripsi bebas, kuantitas 40,
harga 185.000, pajak 11%. Simpan.

> Perhatikan: dokumen ini **belum punya nomor**. Ia masih draf.

**Ajukan.** Nomor resmi muncul sekarang.

> Nomor diberikan saat diajukan, bukan saat draf dibuat. Draf yang dibuang tidak
> membakar nomor urut — celah dalam urutan nomor adalah temuan audit.

**Setujui**, lalu **Posting ke buku besar**.

Toast muncul menyebut nomor fakturnya dan nomor jurnalnya.

> Sekarang tanpa menekan apa pun yang lain —

**Akuntansi → Buku Besar.** Baris jurnalnya sudah ada di sana.

> Tidak ada tombol sinkronisasi, tidak ada proses malam hari, tidak ada
> penjadwalan. Faktur dan jurnalnya lahir di transaksi basis data yang sama. Bila
> jurnalnya gagal, fakturnya ikut gagal — tidak mungkin ada faktur terposting
> yang tidak punya jurnal.

Kembali ke **Dasbor**. Pendapatan bulan ini sudah bertambah persis sebesar DPP
faktur tadi.

> Dasbor ini tidak menjumlahkan daftar faktur. Ia membaca dari buku besar, jadi
> yang ditampilkan hanya yang benar-benar sudah diposting. Draf tidak pernah ikut
> terhitung sebagai pendapatan.

---

## Menit 5–7 · Menelusuri balik sampai ke fakturnya

**Akuntansi → Bagan Akun.**

Saring dengan chip **Pendapatan**. Satu akun, dengan saldonya.

Klik barisnya. Buku besar terbuka **sudah tersaring** ke akun itu.

Klik salah satu baris jurnal. **Faktur sumbernya terbuka.**

> Dari angka agregat di dasbor, sampai ke satu faktur, dalam tiga klik. Setiap
> angka di sistem ini punya jalan pulang ke transaksi yang melahirkannya. Angka
> yang tidak bisa ditelusuri tidak bisa dipertanggungjawabkan, dan auditor akan
> menanyakan persis itu.

Di halaman faktur, tunjuk **tiga badge** di kepala halaman.

> Tiga sumbu status yang terpisah: siklus hidup, pelunasan, dan pemenuhan. Faktur
> ini sudah diposting, belum dibayar, dan barangnya sudah dikirim — tiga fakta
> berbeda yang tidak bisa dinyatakan satu label. Sistem yang menggabungkannya
> menjadi satu status akan memaksa Anda memilih kebohongan mana yang paling tidak
> merugikan.

---

## Menit 7–9 · Berpindah company, periode fiskal ikut berpindah

Buka pengalih company di kepala layar. Pilih **PT Kencana Abadi Sejahtera**.

Banner selebar konten muncul menyebut nama company barunya.

> Bukan toast di pojok. Salah konteks company berarti transaksi masuk ke entitas
> legal yang salah, jadi perpindahannya harus terlihat.

Tunjuk **baris konteks** di bawah judul halaman.

> Company, periode fiskal, dan mata uang, di setiap halaman transaksional. Yang
> sedang menginput faktur menatap formulir, bukan pojok kiri atas.

Sekarang bandingkan periodenya dengan company sebelumnya.

> Company pertama tahun fiskalnya mulai Januari, yang ini mulai **April**. Periode
> berjalannya berbeda, dan seluruh laporan ikut mengikuti. Ini satu tenant dengan
> dua entitas legal yang tahun bukunya memang berbeda — hal biasa di grup usaha
> Indonesia, dan hal yang biasanya memaksa orang memakai dua sistem terpisah.

Angka di dasbor ikut berganti, karena datanya memang milik company yang berbeda.

---

## Menit 9–10 · Kontrol yang menahan uang keluar

**Pembelian → Pesanan Pembelian.**

Buka pesanan yang badge-nya menyebut **Sebagian diterima**.

> Kuantitas dilacak per baris, bukan per dokumen. Dua ratus dipesan, tujuh puluh
> lima datang. Sisanya tetap terbuka.

**Pembelian → Faktur Pembelian.** Buka tagihan berstatus **exception**.

> Vendor menagih dengan harga 14% di atas pesanan. Sistem menahannya. Tagihan ini
> tidak bisa diposting sampai ada orang yang menyetujui pengecualiannya secara
> eksplisit, dan persetujuan itu tercatat beserta alasannya.

> Ini bukan fitur kenyamanan. Ini kontrol yang mencegah salah satu kebocoran
> paling umum di perusahaan dagang.

Berhenti di sini.

---

## Yang sengaja tidak ada di naskah ini

Sebutkan bila ditanya. Jangan dibuka sendiri — sepuluh menit habis.

| Hal | Keadaan sebenarnya |
|---|---|
| **Modul Pajak** | Berfungsi, tetapi `seed:demo` tidak mengisinya. Layarnya akan kosong. Untuk menunjukkannya, jalankan `seed:tax-dev` dengan `COMPANY_ID` company demo lebih dulu |
| **Laporan Laba Rugi** | Belum ada layarnya. Penelusuran di Menit 5–7 lewat Bagan Akun, dan itu memang jalur drill-down-nya — tetapi bukan laporan berformat |
| **Tab Aktivitas** | Ada di setiap halaman detail dan sengaja menyebutkan bahwa audit trail belum punya jalur baca di antarmuka. Perubahannya sudah tercatat di basis data |
| **Sidebar** | Menampilkan seluruh item tanpa menyaring izin. Izin ditegakkan di API, bukan di menu — dicatat sebagai keterbatasan di D-135 |
| **Panel AI** | Belum dibangun |

Bila calon pelanggan menanyakan salah satunya, jawab apa adanya. Demo yang
menjanjikan lebih dari yang ada akan ditagih tiga bulan kemudian.

---

## Bila ada yang salah di tengah demo

**Layar menggantung di "Memuat company…"** — seharusnya tidak lagi terjadi. Bila
terjadi, sesi Anda habis; muat ulang halaman dan masuk lagi.

**Faktur gagal diposting** — pesan servernya menyebutkan sebabnya apa adanya,
biasanya aturan penentuan akun yang belum lengkap. Jangan diperdebatkan di
ruangan; catat dan lanjutkan ke langkah berikutnya.

**Dasbor kosong padahal seed sudah jalan** — kemungkinan besar Anda sedang berada
di company yang salah. Periksa baris konteks di bawah judul.

---

## Setelah demo

Basis data demo berisi data karangan seluruhnya. Jangan pernah memakainya
sebagai basis data produksi, dan jangan biarkan akun demo hidup di server yang
sama dengan data pelanggan sungguhan.
