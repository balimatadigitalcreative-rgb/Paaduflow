# Runbook — Tangga Degradasi

Ditulis di Sesi E2. Rujukan: `Platform_Architecture_Resilience.md` §4 dan §8.

Degradasi **ditetapkan, bukan ditemukan saat insiden.** Tiga skenario di bawah adalah tiga baris pertama tangga degradasi, ditulis sebagai prosedur supaya keputusannya tidak diambil dengan panik.

Klasifikasi insiden mengikuti **dampak pengguna**, bukan komponen yang rusak. "Pengguna tidak dapat menerbitkan faktur" adalah insiden besar; "replika analitik tertinggal" tidak — meski keduanya bisa berasal dari basis data yang sama.

---

## 1 · Lapisan analitik mati

**Yang tetap berjalan:** seluruh transaksi normal. Faktur, jurnal, stok, POS — tidak satu pun bergantung pada lapisan analitik.

**Yang berubah bagi pengguna:** dashboard menampilkan **penanda basi** dengan waktu data terakhir, bukan layar kosong dan bukan angka lama yang berpura-pura terkini.

### Langkah

1. Pastikan jalur transaksi sehat: `POST /v1/companies/{id}/access` dan posting faktur masih dijawab. Bila keduanya sehat, ini **bukan** insiden besar.
2. Nyalakan penanda basi di dashboard. Sebutkan waktu data terakhir, bukan "data tidak tersedia".
3. Umumkan di halaman status dengan kalimat yang menyebut apa yang **masih** bisa dilakukan.
4. Jangan mematikan cache: data basi yang ditandai jujur lebih berguna daripada tidak ada data.

**Jangan:** memblokir posting faktur karena dashboard mati. Keduanya tidak berbagi jalur.

---

## 2 · Penyimpanan berkas mati

**Yang tetap berjalan:** transaksi normal. Faktur tetap dapat dibuat dan diposting tanpa lampiran.

**Yang berubah:** unggahan **ditahan di antrean**; unduhan gagal dengan pesan jujur.

### Langkah

1. Alihkan unggahan ke antrean tunda. Pengguna melihat "lampiran menunggu diunggah", bukan kegagalan pembuatan dokumen.
2. Unduhan menjawab dengan pesan yang menyebut penyebab dan perkiraan pemulihan — bukan 500 tanpa keterangan.
3. Pastikan tidak ada jalur yang **memblokir posting** karena lampiran gagal. Lampiran bukan syarat sahnya dokumen.
4. Setelah pulih: jalankan antrean tunda, lalu bandingkan jumlah berkas yang tercatat dengan yang benar-benar tersimpan.

**Jangan:** menandai dokumen gagal karena lampirannya gagal.

---

## 3 · Basis data utama mati

Ini satu-satunya dari tiga skenario yang merupakan **insiden besar**.

**Yang dijanjikan:** failover ke replika siaga, tanpa kehilangan transaksi terkonfirmasi.

### Langkah

1. **Nyatakan insiden lebih dulu, komunikasikan sebelum memperbaiki.** Halaman status dan notifikasi dalam produk adalah bagian dari respons, bukan sesudahnya.
2. Jalankan prosedur failover ke replika siaga.
3. Setelah replika menerima tulisan, **jalankan seluruh pemeriksaan invarian** sebelum menyatakan pulih:
   - neraca saldo seimbang
   - saldo stok proyeksi sama dengan mutasi
   - jumlah nilai baris faktur sama dengan dokumennya
   - nomor dokumen tanpa celah
4. Pemulihan dinyatakan berhasil bila **seluruh invarian lolos**, bukan bila proses failover selesai tanpa galat. Ini yang membedakan "basis data menyala" dari "data benar".
5. POS tetap melayani luring selama seluruh langkah di atas. Kasir yang antre pelanggan tidak peduli region mana yang mati.

**Jangan:** menerima tulisan di dua tempat sekaligus. Data finansial tidak punya resolusi konflik yang dapat diterima — D-027.

---

## Setelah setiap insiden

**Tinjauan tanpa menyalahkan**, dengan tindakan yang punya pemilik dan tenggat.

Bila insidennya adalah **pelanggaran invarian** — bukan layanan yang mati — perlakukan sama beratnya. Data yang salah tanpa keluhan pengguna adalah keadaan yang lebih berbahaya, bukan lebih ringan.

---

## Yang belum ditulis

| Item | Menunggu |
|---|---|
| Prosedur failover terperinci | Region kedua benar-benar ada (V-06) |
| Sasaran waktu pulih per tier | Komitmen komersial dari tim bisnis |
| Latihan berkala | Lingkungan uji yang terpisah dari produksi |

Prosedur yang tidak pernah dilatih adalah prosedur yang tidak ada. Ketiga baris di atas dicatat supaya kekosongannya terlihat.
