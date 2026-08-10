# Paadu Flow — Prototype Spec
### Step 7.1 · Fase 7 — Interactive Prototype

**Input:** seluruh Fase 1–6.
**Output pendamping:** `mock_data.json` — dataset yang konsisten secara aritmetika.

---

## 1. Scope — Tiga Alur yang Dibuat Benar-Benar Interaktif

Prototype tidak perlu menjadi produk. Ia perlu **membuktikan satu klaim** kepada orang yang belum percaya. Klaim itu adalah positioning Anda: keterpaduan sebagai mekanisme, tidak-perlu-migrasi sebagai manfaat.

### Alur 1 — Buat faktur, lalu lihat angkanya mengalir

Dari dashboard → buat faktur → isi line item → terbitkan → **kembali ke dashboard dan lihat angkanya sudah berubah**, sekaligus muncul di daftar piutang dan di laporan penjualan.

**Mengapa ini yang pertama:** inilah satu-satunya cara membuktikan "padu" tanpa menjelaskannya. Tidak ada tombol sinkronisasi, tidak ada jeda, tidak ada langkah tambahan. Pembeli yang selama ini menyalin data antar aplikasi akan langsung mengerti tanpa diberi tahu.

Ini juga sekaligus first value moment dari Step 5.1.

### Alur 2 — Drill-down laba rugi sampai ke transaksi

Laporan Laba Rugi → klik angka Pendapatan → daftar jurnal → klik satu jurnal → faktur sumbernya.

**Mengapa ini penting:** ia membuktikan bahwa laporan **dihitung dari data yang sama**, bukan dihasilkan terpisah. Untuk pembeli finansial — yang biasanya orang paling skeptis di ruangan — ini argumen yang paling meyakinkan. Ia juga menunjukkan pilar Terang secara konkret.

### Alur 3 — Berpindah company

Pengalih company → pilih PT Nusantara Logistik → **seluruh layar berubah**: angka berbeda, dokumen berbeda, periode fiskal berbeda (April–Maret, bukan Januari–Desember) — dengan banner konfirmasi yang tidak bisa dilewatkan.

**Mengapa ini masuk tiga besar:** multi-company native adalah hal yang tidak bisa dilakukan pesaing di tier UMKM sama sekali. Bagi pemilik grup usaha, ini bukan fitur — ini alasan berpindah. Dan perbedaan tahun fiskal antar company adalah detail yang langsung membuktikan bahwa ini bukan sekadar filter.

### Yang sengaja TIDAK dijadikan alur interaktif

**AI assistant.** Menggoda, tetapi tiga alasan menolaknya:

1. AI yang dipalsukan akan runtuh begitu penonton bertanya di luar skrip — dan mereka pasti bertanya
2. Brand Strategy sendiri menempatkan AI sebagai **pengganda, bukan janji utama**; ia akan menjadi table stakes dalam dua tahun
3. Prototype yang gagal di depan mata merusak kepercayaan lebih besar daripada nilai yang dibawanya

AI tetap ada sebagai **layar statis** yang menunjukkan pola kepercayaan — jawaban dengan sumber, konfirmasi sebelum mengubah data. Itu cukup untuk menyampaikan pendekatannya tanpa berpura-pura.

Approval, impor, dan modul lain juga statis: dapat dinavigasi, tidak dapat dimanipulasi.

---

## 2. Mock Data

`mock_data.json` — dibangkitkan dengan skrip bernih (seed tetap), bukan diketik tangan.

| Entitas | Jumlah |
|---|---|
| Tenant | 1 — Nusantara Group |
| Company | 2 — PT Nusantara Jaya (fiskal Jan–Des) · PT Nusantara Logistik (fiskal Apr–Mar) |
| Pengguna | 5 — dengan peran berbeda, akses lintas company berbeda |
| Pelanggan · Vendor | 25 · 20 |
| Item | 44 — 40 barang stok + 4 jasa, dengan harga jual dan harga pokok |
| Gudang | 2 — Surabaya, Malang |
| Faktur | 63 — 60 terposting sepanjang 12 bulan + 3 dalam status draf, diajukan, menunggu persetujuan |
| Pesanan pembelian | 30 |
| Peluang | 26 — tersebar di 5 tahap pipeline |
| Finansial bulanan | 12 — pendapatan, HPP, laba kotor, beban operasional |

### Verifikasi yang dijalankan

Skrip menolak menghasilkan file bila salah satu gagal:

- Jumlah seluruh baris faktur **sama persis** dengan subtotalnya
- `subtotal − diskon = DPP` untuk setiap faktur
- `DPP + PPN = total` untuk setiap faktur
- `total − dibayar = outstanding` untuk setiap faktur
- `pendapatan − HPP = laba kotor` untuk setiap bulan
- Jumlah seluruh bucket umur piutang **sama persis** dengan total piutang
- Tidak ada bulan tanpa pendapatan

Hasil: **tidak ada error.**

### Bentuk data yang dihasilkan

Penjualan 12 bulan (juta rupiah): 219 · 243 · 272 · 227 · 227 · 279 · 303 · 237 · 245 · 313 · 293 · **345**

Margin kotor bergerak di 24–29%. Piutang total Rp 340 jt, dengan Rp 166 jt jatuh tempo di 3 faktur. Umur piutang: lancar 174 jt · 1–30 hari 123 jt · 31–60 hari 43 jt · di atas 60 hari nihil.

**Angka-angka ini menggantikan angka indikatif di mockup Step 6.1.** Prototype menghitung dari `mock_data.json`, bukan dari angka yang ditulis di dokumen.

### Catatan

Data sengaja **tidak sempurna**: ada item dengan stok `null` di gudang tertentu (belum pernah masuk — dirender sebagai em dash, bukan nol), ada faktur dibayar sebagian, ada peluang yang mengendap lebih dari 30 hari. Data yang terlalu rapi menyembunyikan masalah layout yang baru muncul di produksi.

---

## 3. Inventaris Interaksi

### Wajib benar-benar berfungsi

| Interaksi | Cakupan |
|---|---|
| Navigasi antar layar | Semua layar dalam scope |
| Ganti company | Seluruh data berganti sumber, banner konfirmasi muncul |
| Filter, sort, pencarian tabel | Bekerja pada data nyata, bukan hasil yang dipalsukan |
| Seleksi baris + bulk action bar | Termasuk pembedaan "halaman ini" vs "seluruh hasil" |
| Line-item editor | Hitung subtotal, diskon, DPP, PPN, total secara real-time |
| Validasi form | Pesan error nyata dengan nilai aktual |
| Terbitkan faktur | Mengubah data in-memory sehingga dashboard ikut berubah |
| Drill-down laporan | Laba rugi → jurnal → faktur sumber |
| Command palette | Navigasi, aksi, dan pencarian entitas |
| Toggle tema | Light dan dark |
| Toggle density | Comfortable dan compact |
| Navigasi keyboard | Tab, Enter, Esc, panah di tabel |

### Cukup visual

Panel AI · alur persetujuan · impor massal · pengaturan · modul di luar Penjualan, CRM, dan Akuntansi · notification center · manajemen pengguna.

Layar statis tetap **memakai data nyata dari `mock_data.json`**, sehingga tidak ada angka yang bertentangan antar layar.

---

## 4. Batasan Teknis

- Token dipakai sebagai CSS custom properties. **Dilarang nilai warna atau spacing hardcode**
- Komponen berasal dari library Fase 3. Bila terasa butuh komponen baru — **hentikan dan tanyakan**, jangan diam-diam membuat varian
- State disimpan di memori (React state atau variabel JS). **Dilarang `localStorage` dan `sessionStorage`** — keduanya tidak berfungsi di artifact
- Dark mode berfungsi lewat toggle
- Simulasikan jeda 300–600ms pada operasi agar loading state terasa nyata
- Responsif diuji di 1440px, 1024px, dan 390px
- Fokus indicator terlihat di seluruh elemen interaktif
- Tidak ada layout shift saat data dimuat

---

## 5. Urutan Pembangunan

**Satu alur per sesi. Jangan bangun ketiganya sekaligus** — hasilnya akan dangkal di ketiganya.

1. Shell + navigasi + ganti company (Alur 3) — fondasi yang dipakai dua alur lain
2. Daftar faktur + detail faktur — menguji data table
3. Form faktur + terbitkan + dashboard berubah (Alur 1) — bagian yang paling meyakinkan
4. Laba rugi + drill-down (Alur 2)
5. Layar statis pelengkap
6. Polish pass (Step 7.3)

---

## 6. Risiko & Item Terbuka

| Item | Status | Dampak |
|---|---|---|
| Hex brand asli | **Masih perkiraan** | Prototype memakai token, jadi perubahan hex berbiaya rendah — inilah keuntungan arsitektur Lapis 2 |
| Trademark clearance | **Masih terbuka** | Prototype akan dipakai demo. Nama yang salah akan tersebar |
| Data company kedua | Minimal | PT Nusantara Logistik sengaja tipis agar perbedaan saat berpindah terlihat jelas. Bila demo perlu keduanya kaya, bangkitkan ulang |
| Perhitungan pajak | **Belum divalidasi akuntan** | Dari Step 5.2. Prototype memakai PPN 11% datar tanpa alokasi diskon berlapis |
| Kinerja tabel besar | Belum diuji | 63 faktur tidak menguji virtualisasi. Bangkitkan 5.000 baris bila perlu diuji |
