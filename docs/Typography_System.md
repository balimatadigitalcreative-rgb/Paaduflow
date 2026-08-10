# Paadu Flow — Typography System
### Step 1.3 · Fase 1 — Brand Identity System

**Konteks:** aplikasi enterprise dengan tabel data padat, angka finansial, form panjang, dan laporan. Dipakai delapan jam sehari. Multi-currency, multi-region, wajib light dan dark mode.

**Prioritas yang mengikat seluruh keputusan di dokumen ini:** keterbacaan angka dan alignment tabular mengalahkan ekspresi. Ini bukan produk editorial.

---

## 1. Font Stack

### Rekomendasi: **IBM Plex Sans** (UI) + **IBM Plex Mono** (angka teknis & kode)

Keduanya SIL Open Font License — bebas untuk penggunaan komersial, bisa di-*self-host*, tanpa biaya lisensi yang bertumbuh seiring jumlah pengguna. Untuk produk berumur 20 tahun, lisensi berlangganan per-pageview adalah utang yang membesar diam-diam.

**Alasan pemilihan:**

1. **Dirancang untuk konteks enterprise dan teknis.** Plex dibuat Bold Monday untuk IBM sebagai pengganti Helvetica Neue di seluruh sistem mereka — termasuk antarmuka data-berat. Ini bukan typeface pemasaran yang dipaksa masuk ke tabel.

2. **Sans dan Mono berbagi DNA desain.** Ini keunggulan yang jarang dimiliki keluarga lain dan sangat berarti di sini: nomor dokumen (`INV/2026/08/0142`), NPWP, kode barang, dan ID transaksi akan dirender dengan mono yang **secara visual masih terasa satu keluarga** dengan teks di sekitarnya. Memakai mono dari keluarga berbeda membuat setiap ID terlihat seperti benda asing.

3. **Cakupan bahasa untuk roadmap Fase 5.** Selain Latin Extended penuh, keluarga Plex punya varian Thai, Jepang, Korea, Arab, Devanagari, dan Hebrew. Roadmap Anda mencantumkan Multi Region sebagai fase enterprise — memilih typeface yang mentok di Latin berarti mewariskan proyek migrasi tipografi ke tim lima tahun lagi.

4. **Tabular figures kuat dan lebar digit konsisten.**

5. **Cukup berkarakter untuk tidak terlihat templated, cukup menahan diri untuk urusan uang.**

**Kelemahan yang harus diterima jujur:** huruf kecil `a` dan `g` Plex punya idiosinkrasi yang terlihat di ukuran display besar, dan lebarnya sedikit lebih sempit dari Inter sehingga baris panjang terasa lebih padat. Untuk halaman marketing, Plex terasa kurang "premium" dibanding sans geometris.

**Itu bukan masalah, karena wordmark Anda tidak memakai font ini.** Wordmark "Paadu Flow" adalah aset terpisah dengan typeface geometris tersendiri. Memisahkan typeface wordmark dari typeface antarmuka adalah praktik normal dan sehat — Stripe, Linear, dan Notion semuanya melakukannya.

### Alternatif

| Pilihan | Kapan dipilih | Konsekuensi |
|---|---|---|
| **Inter + JetBrains Mono** | Kalau prioritasnya risiko nol | Legibilitas UI terbaik di kelasnya, tapi Inter kini adalah *default* dunia desain — produk akan terlihat seperti template. Cakupan non-Latin lebih terbatas. |
| **Source Sans 3 + Source Code Pro** | Kalau produk lebih banyak teks panjang daripada tabel | Paling hangat dan paling enak dibaca panjang, tapi angkanya kurang tegas dan densitasnya lebih boros. |

### Deklarasi

```css
--font-sans: "IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
--font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
```

Bobot yang dimuat: **400 (Regular)**, **500 (Medium)**, **600 (SemiBold)**. Tidak lebih — setiap bobot tambahan adalah beban unduh di setiap muat halaman.

**Disiplin bobot:** 400 untuk seluruh teks isi. 500 untuk label, judul, dan header tabel. 600 **hanya** untuk display dan angka metrik di KPI card. Bold (700) tidak dipakai sama sekali di antarmuka — ia terlalu berat berdampingan dengan skala netral yang halus.

---

## 2. Type Scale

Skala ini **bukan modular murni**. Rasio geometris seperti 1.25 menghasilkan angka pecahan dan judul yang terlalu besar untuk UI padat. Yang dipakai: rasio ~1.25 di ujung display, mengetat ke ~1.1 di sekitar body, di mana presisi lebih penting daripada kemurnian matematis.

**Basis rem = 16px.** Body UI = 14px (0.875rem).

| Token | px | rem | Line height | Tracking | Weight | Pemakaian |
|---|---|---|---|---|---|---|
| `display` | 40 | 2.5 | 44px | −0.02em | 600 | Angka besar di dashboard, halaman kosong, marketing |
| `heading-1` | 30 | 1.875 | 36px | −0.015em | 500 | Judul halaman |
| `heading-2` | 24 | 1.5 | 30px | −0.01em | 500 | Judul seksi utama |
| `heading-3` | 20 | 1.25 | 26px | −0.01em | 500 | Judul kartu, judul modal |
| `heading-4` | 16 | 1 | 22px | −0.005em | 500 | Sub-seksi, judul grup form |
| `body-lg` | 16 | 1 | 24px | 0 | 400 | Teks konten panjang, dokumentasi, marketing |
| `body` | 14 | 0.875 | 20px | 0 | 400 | **Default seluruh antarmuka aplikasi** |
| `body-sm` | 13 | 0.8125 | 18px | 0 | 400 | Helper text, teks sekunder padat |
| `caption` | 12 | 0.75 | 16px | +0.005em | 400 | Metadata, timestamp, footnote |
| `overline` | 11 | 0.6875 | 16px | +0.08em | 500 | Label eyebrow, header grup — **UPPERCASE** |
| `code` | 13 | 0.8125 | 20px | 0 | 400 | Mono: ID, kode barang, nomor dokumen, JSON |

**Batas mutlak: tidak ada teks di bawah 11px di mana pun dalam produk.** Termasuk tooltip, badge, dan label chart.

### Catatan: `overline` melanggar aturan sentence case — secara sengaja

Brand Strategy (Step 0.2) menetapkan sentence case di mana-mana. Token `overline` adalah **satu-satunya pengecualian**, dan pengecualian ini eksplisit karena dua alasan: uppercase di sini berfungsi sebagai *perangkat pelabelan struktural*, bukan sebagai judul; dan pola ini sudah menjadi bagian dari bahasa visual Anda yang ada (label seperti `01 · LOCKUP UTAMA` di materi brand).

Aturan pembatasnya: overline maksimal **empat kata**, dan tidak pernah dipakai untuk kalimat.

---

## 3. Perlakuan Angka

Bagian terpenting dokumen ini. Sebagian besar kegagalan tipografi di ERP terjadi di sini, bukan di judul.

### 3.1 Tabular figures — wajib

```css
font-variant-numeric: tabular-nums;
font-feature-settings: "tnum" 1;
```

**Wajib diterapkan pada:** seluruh sel tabel yang berisi angka, semua field mata uang, kuantitas, persentase, tanggal dalam tabel, nomor dokumen, dan angka metrik di KPI card.

**Proportional figures hanya boleh** di prosa berjalan dan materi marketing.

Alasannya bukan estetika: dengan proportional figures, digit `1` lebih sempit dari `8`, sehingga kolom angka tidak sejajar secara vertikal dan mata tidak bisa membandingkan besaran secara sekilas. Di laporan keuangan, itu berarti selisih yang seharusnya terlihat dalam sekejap harus dibaca satu per satu.

### 3.2 Alignment

| Jenis kolom | Alignment | Alasan |
|---|---|---|
| Angka, mata uang, kuantitas, persentase | **Kanan** | Digit satuan sejajar; besaran terbaca dari panjang |
| Teks, nama, deskripsi | Kiri | — |
| Tanggal | Kiri | Kecuali kolom tanggal yang dibandingkan urut — kanan |
| ID, nomor dokumen (mono) | Kiri | Dibaca sebagai label, bukan besaran |
| Status, badge | Kiri | — |
| Header kolom | **Mengikuti alignment isinya** | Header kiri di atas angka kanan adalah kesalahan paling umum |

### 3.3 Format mata uang

| Locale | Format | Desimal |
|---|---|---|
| IDR | `Rp 1.234.567` | **0 desimal** |
| USD | `$1,234.57` | 2 |
| EUR | `€1.234,57` | 2 |
| SGD | `S$1,234.57` | 2 |
| JPY | `¥1,234` | 0 |

**Rupiah tidak menampilkan sen.** Menampilkan `Rp 1.234.567,00` di seluruh aplikasi menambah empat karakter mati di setiap baris tabel tanpa membawa informasi apa pun. Sen hanya ditampilkan bila nilai transaksi memang mengandungnya.

**Di tabel multi-currency, wajib tampilkan kode mata uang, bukan hanya simbol.** Tabel berisi `$1,200` dan `S$1,200` yang hanya dibedakan satu huruf adalah jebakan. Gunakan `USD 1,200.00` dan `SGD 1,200.00`.

**Simbol mata uang tidak pernah dirender lebih kecil atau ditinggikan.** Ini konvensi editorial, bukan konvensi finansial, dan ia merusak alignment tabular.

### 3.4 Aturan yang mengikat kebenaran data

**Nol dan kosong adalah dua hal berbeda.**
`0` berarti nilainya terukur nol. `—` (em dash) berarti tidak ada data. Menyamakan keduanya adalah kesalahan pelaporan, bukan kesalahan desain. Sebuah baris stok dengan `0` berarti barang habis; dengan `—` berarti barang belum pernah dicatat.

**Desimal konsisten dalam satu kolom.** Kolom yang berisi `1.200` dan `1.200,5` bersamaan tidak bisa dibandingkan. Tetapkan presisi per kolom, bukan per nilai.

**Angka negatif:** kurung `(1.234.567)` di laporan keuangan formal (P&L, Neraca, Arus Kas), tanda minus `-1.234.567` di tabel transaksional. **Tidak pernah hanya merah** — Color System sudah melarang warna sebagai satu-satunya pembawa makna.

**Dilarang menyingkat angka di tabel transaksional.** `Rp 1,2 jt` tidak boleh muncul di baris faktur, jurnal, atau pembayaran. Penyingkatan hanya diizinkan di KPI card dan sumbu chart, dan nilai penuh harus tersedia lewat hover atau drill-down.

### 3.5 Tanggal dan waktu

**Format default: `10 Agu 2026`** (DD MMM YYYY).

Format numerik murni dengan garis miring **dilarang sebagai default**. `10/08/2026` berarti 10 Agustus bagi pengguna Indonesia dan 8 Oktober bagi pengguna Amerika. Untuk produk yang menargetkan multi-region dan menyimpan data finansial berkonsekuensi hukum, ambiguitas ini tidak dapat diterima.

**Waktu:** format 24 jam untuk Indonesia (`14:30`), mengikuti locale untuk region lain. Zona waktu ditampilkan bila konteksnya lintas region (`14:30 WIB`).

**Periode fiskal harus menyebut bulan kalendernya.** Karena `fiscal_year_start_month` di Modul 01 dapat bukan Januari, label seperti `P3` tanpa konteks tidak bermakna. Format: `FY2026 P3 · Sep 2026`.

---

## 4. Density Modes

Dua mode. **Ukuran font tidak berubah antar mode — hanya line-height dan padding.**

Ini keputusan prinsip: mengecilkan font di mode padat memindahkan beban ke mata pengguna dan berpotensi melanggar aksesibilitas. Mengecilkan ruang putih tidak.

| Properti | Comfortable | Compact |
|---|---|---|
| Ukuran font body | 14px | **14px** (tidak berubah) |
| Line height body | 20px | 18px |
| Tinggi baris tabel | 44px | 32px |
| Padding sel tabel | 12px 16px | 6px 12px |
| Jarak antar field form | 20px | 12px |
| Tinggi kontrol (input, button) | 36px | 30px |

**Comfortable adalah default.** Compact diaktifkan pengguna dan **disimpan sebagai preferensi per pengguna**, bukan per perangkat — akuntan yang memilih compact menginginkannya di semua mesin.

Target sentuh minimum 44×44px di mobile tetap berlaku mutlak. **Mode compact tidak tersedia di viewport sentuh.**

---

## 5. Aturan Tambahan

**Panjang baris:** teks prosa maksimal 75 karakter per baris. Untuk itu, halaman form dan dokumentasi dibatasi lebarnya; halaman tabel tidak (tabel butuh lebar penuh).

**Hierarki lewat ukuran dan bobot, bukan warna.** Teks abu bukan pengganti hierarki — ia menurunkan kontras. Ingat temuan Color System: `neutral-500` hanya 4.6:1, jadi **caption 12px wajib memakai `neutral-600`, bukan `neutral-500`**.

**Tidak ada teks di dalam gambar.** Semua teks harus berupa teks sungguhan agar dapat dipilih, dicari, diterjemahkan, dan dibaca screen reader.

**Truncation:** ellipsis di akhir untuk nama dan deskripsi; **tidak pernah** untuk angka, nomor dokumen, atau ID. Angka yang terpotong lebih buruk daripada kolom yang lebih lebar.

**Hierarki heading tidak boleh melompat.** `h1` → `h3` tanpa `h2` merusak navigasi screen reader. Kalau butuh ukuran lebih kecil, pakai token visual berbeda, bukan level heading berbeda.

---

## 6. Risiko & Verifikasi Tertunda

| Item | Status | Dampak bila diabaikan |
|---|---|---|
| Typeface wordmark belum diidentifikasi | **Terbuka** | Rasio mark ke wordmark di lockup belum bisa dikunci (Step 1.1) |
| Plex belum diuji dengan data Indonesia nyata | **Perlu uji** | Render nama panjang, NPWP 16 digit, dan alamat multi-baris di tabel padat |
| Cakupan glyph untuk aksara daerah | **Belum diperiksa** | Relevan hanya bila ada rencana lokalisasi non-Latin |
| Performa muat font | **Belum diukur** | Tiga bobot × dua keluarga = beban nyata. Pertimbangkan varian variable font dan `font-display: swap` |
| Uji pembacaan angka di layar 4K vs 1080p | **Belum dilakukan** | Tracking negatif pada display 40px bisa terlalu rapat di kepadatan piksel rendah |
