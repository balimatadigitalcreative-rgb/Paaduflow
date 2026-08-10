# Paadu Flow — Logo System
### Step 1.1 · Fase 1 — Brand Identity System

**Status: ⚠️ Sementara.** Bentuk mark belum dikonfirmasi. Dokumen ini mencatat riwayat keputusan, analisis penyempurnaan, dan spesifikasi teknis. Aturan pemakaian (clear space, misuse, penempatan) ada di `Brand_Book.md` dan berlaku untuk bentuk mana pun yang akhirnya dipilih.

---

## 1. Konsep — "Simpul Padu"

Dua untaian yang bertemu, saling mengunci, dan keluar sebagai satu alur.

| Elemen geometri | Yang dinyatakan |
|---|---|
| Dua untaian, bukan satu bentuk | Modul Business OS berdiri sendiri sebelum bertemu |
| Saling melewati, bukan meleleh | Keduanya tetap utuh di titik silang — yang dibagi adalah data, bukan identitas |
| Bobot stroke identik | Tidak ada modul kelas satu dan modul pelengkap |
| Keluar sebagai satu jalur ke kanan | Proses, bukan lambang — inilah yang menjelaskan kata "Flow" |
| Ujung terbuka, tidak dikurung | Sistem yang dapat diperluas — dasar langsung larangan misuse no. 7 |
| Ujung membulat | Enterprise tanpa dingin — sesuai pilar Tenang |

**Batas kejujuran:** tidak ada logo yang menyampaikan makna tanpa diberi tahu. Fungsi cerita ini adalah memberi tim alasan konsisten selama 20 tahun dan dasar untuk menolak perubahan yang merusak — bukan menyampaikan pesan ke pasar.

---

## 2. Riwayat Keputusan

**Iterasi 1 — eksplorasi awal.** Empat pendekatan dieksplorasi (untaian menerus, pita anyam, geometris, ruang negatif). Dibuang setelah pengguna menyediakan konsep mark yang sudah lebih matang.

**Iterasi 2 — mark yang ada.** Mark "Simpul Padu" milik pengguna, lengkap dengan sistem lockup dan aturan satu warna. Diagnosis: mark terbaca ambigu — pembacaan pertama cenderung ke **tanda potong percetakan (crop mark)** atau angka "4".

**Penyebab yang diidentifikasi:**
1. **Ketidaksetaraan untaian.** Satu untaian lurus dan kaku, satunya melengkung dan menghook. Otak membaca ini sebagai "satu objek yang dicoret satu garis", bukan "dua untaian menganyam". Garis lurus yang memotong garis lurus lain secara tegak lurus adalah persis anatomi tanda potong.
2. **Persilangan terlihat menyatu solid**, bukan saling melewati. Persilangan solid membaca sebagai *simpang*, bukan *anyaman*.

**Iterasi 3 — tiga variabel penyempurnaan diisolasi:**

| Variabel | Efek | Biaya |
|---|---|---|
| 1 — Persilangan (over/under) | Makna terbesar dengan perubahan bentuk paling kecil. Mark berhenti membaca "simpang", mulai membaca "anyaman" | Celah menutup di 16px; butuh varian optis |
| 2 — Paritas untaian | Paling langsung membunuh pembacaan crop mark, karena tidak ada lagi garis lurus tegak lurus | Paling mengubah siluet; kehilangan sebagian ketegasan geometris |
| 3 — Terminal diperpendek | Paling murah, paling kecil efeknya | Mengurangi energi horizontal yang membuat mark terasa "mengalir". **Tidak direkomendasikan** |

**Iterasi 4 — tiga opsi yang lebih rapi:**

| Opsi | Konstruksi | Penilaian |
|---|---|---|
| A — Grid tegak | Bar + busur setengah lingkaran murni + vertikal dengan over/under | Paling aman, perubahan terkecil. Garis lurus tegak lurus masih ada, jadi risiko crop mark berkurang tapi tidak hilang |
| B — Untaian tunggal | Satu jalur menerus, satu persilangan sendiri, tanpa serpihan | Siluet paling rapi. Tapi yang tergambar adalah **satu untaian melingkar**, bukan dua yang menganyam — secara konsep mundur |
| **C — Simetri putar** | Dua untaian identik, rotasi 180°, dua titik silang | **Direkomendasikan.** Satu-satunya yang konstruksinya benar-benar menyatakan isinya: dua untaian setara, bukan satu utama dan satu pelengkap. Bertahan paling baik di 16px karena massanya terdistribusi |

**Rekomendasi berdiri: Opsi C.** Biaya jujurnya — paling jauh dari mark saat ini, dan lebih lebar sehingga butuh ruang horizontal lebih besar di lockup.

**Status persetujuan: belum ada.** Pengguna menyatakan terbuka untuk penyempurnaan bentuk; keputusan final belum diambil.

---

## 3. Spesifikasi Teknis

### Varian yang wajib diproduksi

| Varian | Format | Catatan |
|---|---|---|
| Mark — positif | SVG | Satu warna |
| Mark — terbalik | SVG | Untuk latar gelap dan warna brand |
| Mark — varian optis | SVG | Untuk <20px. Celah anyam ditutup, kanal ditebalkan |
| Wordmark dua tone | SVG | "Paadu" medium + "Flow" regular sekunder |
| Wordmark satu bobot | SVG | Untuk bordir, stempel, gravir, cetak satu warna |
| Lockup horizontal | SVG | Default |
| Lockup vertikal | SVG | Cover, splash, slide pembuka |
| App icon | SVG + PNG 1024 | Safe area 10% untuk masking rounded-square |
| Favicon | SVG + PNG 16/32/48 | Varian optis |

### Aturan konstruksi

- Stroke weight konsisten di seluruh mark
- Ujung membulat (round cap), sambungan membulat (round join)
- Tanpa gradien pada versi utama
- Mark **wajib tetap terbaca di 16px** — bila tidak, gunakan varian optis
- Jarak internal lockup: 1 × lebar stroke mark
- Zona eksklusi: 0,25 × tinggi mark

### Uji yang wajib dijalankan sebelum dikunci

1. **Uji persepsi buta.** Tunjukkan mark saja ke minimal 10 orang tanpa konteks. Tanyakan "ini gambar apa?" Bila tidak ada satu pun yang menyebut simpul, ikatan, atau penyatuan, maknanya belum tersampaikan.
2. **Uji perbandingan lama vs baru.** Bila versi hasil penyempurnaan tidak menghasilkan lebih banyak jawaban bernuansa "ikatan" dibanding versi asli, perubahan tidak membeli apa pun dan versi asli lebih baik dipertahankan.
3. **Uji reproduksi fisik.** Cetak satu warna, bordir, dan gravir punya batas detail berbeda dari layar. Celah anyam adalah bagian pertama yang hilang.
4. **Uji favicon nyata.** Di tab browser sungguhan, bukan simulasi.
5. **Uji di atas latar berwarna dan foto.**

---

## 4. Item Terbuka

| Item | Status | Dampak |
|---|---|---|
| Bentuk mark final | **Belum diputuskan** | Seluruh aset turunan tertahan |
| File SVG sumber | **Belum diterima** | Semua geometri yang dipakai sejauh ini adalah rekonstruksi dari tangkapan layar — kurva, bobot stroke, dan rasio hampir pasti meleset beberapa unit |
| Typeface wordmark | **Belum teridentifikasi** | Rasio mark terhadap wordmark tidak dapat dikunci |
| Hex brand | **Belum dikonfirmasi** | `#3A34B5` adalah perkiraan |
| Alignment optis mark ke baseline wordmark | Belum disetel | Secara matematis sudah terpusat; mata biasanya menuntut koreksi 1–2px |

> **Catatan penting:** dokumen ini sengaja **tidak** menyertakan file SVG mark. Menghasilkan aset dari rekonstruksi akan menciptakan aset tandingan yang bersaing dengan file asli Anda. Kirimkan SVG sumber, dan seluruh varian di §3 dapat diturunkan darinya secara presisi.
