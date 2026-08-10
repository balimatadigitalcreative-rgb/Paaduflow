# Paadu Flow — Flow Archetypes
### Step 5.2 · Fase 5 — UX Flow Design

**Input:** Information Architecture (4.1), Component Specs (3.1–3.4), Onboarding Flow (5.1).

**Mengapa dokumen ini ada.** Business OS akan punya 30+ modul dengan pola interaksi yang berulang. Mendesain setiap modul dari nol menghasilkan 30 dialek berbeda dari perilaku yang sama, dan biayanya dibayar selamanya — oleh pengguna yang harus belajar ulang, dan oleh tim yang harus memelihara.

Delapan archetype berikut adalah **kontrak desain**. Modul baru menerapkannya, bukan menafsirkannya. Penyimpangan memerlukan justifikasi eksplisit, bukan preferensi.

---

## Archetype 1 — List → Detail → Edit

Pola paling universal. Dipakai oleh setiap entitas: faktur, pelanggan, karyawan, pesanan pembelian, item.

### Keputusan: halaman detail **adalah** permukaan edit

Tidak ada halaman "lihat" dan halaman "edit" yang terpisah. Ini menghilangkan seluruh kelas kebingungan "kenapa saya tidak bisa mengetik di sini".

| Status dokumen | Perilaku halaman detail |
|---|---|
| `draft` | Seluruh field dapat diedit langsung. Simpan otomatis per field |
| `pending_approval` | Baca saja. Aksi: tarik kembali |
| `posted` | Baca saja permanen. Aksi: void, atau buat dokumen koreksi |

### Struktur tab baku

Setiap halaman detail memakai urutan tab yang sama: **Ringkasan · Baris · Dokumen terkait · Aktivitas**. Modul boleh menambah tab, tidak boleh mengubah urutan empat yang pertama.

Tab **Dokumen terkait** menampilkan jejak konversi ke dua arah (Archetype 3). Tab **Aktivitas** adalah audit trail (Step 3.2 §9).

Navigasi antar record: tombol sebelumnya/berikutnya di page header mempertahankan urutan dan filter dari daftar asalnya. Tanpa ini, memeriksa 30 faktur berarti 60 kali bolak-balik.

---

## Archetype 2 — Siklus Hidup Dokumen & Persetujuan

### Mesin status

Menerapkan `lifecycle_status` dari Information Architecture §3. Transisi yang sah:

```
draft → submitted → pending_approval → approved → posted → closed
                          ↓
                      rejected → draft
draft | submitted | approved → cancelled     (sebelum menyentuh buku besar)
posted → void                                 (selalu lewat jurnal pembalik)
```

**Dokumen yang sudah diposting tidak dapat diedit oleh peran mana pun.** Ini menghilangkan seluruh kelas konflik edit bersamaan di area paling berkonsekuensi (Step 3.4 §6), dan membuat audit trail bermakna.

### Konfigurasi persetujuan

Alur persetujuan ditetapkan **per company, per jenis dokumen, per ambang nilai**. Contoh: faktur di bawah Rp 50 juta tidak perlu persetujuan; di atasnya perlu Manajer Keuangan; di atas Rp 500 juta perlu Direktur.

| Aspek | Aturan |
|---|---|
| Rantai | Berurutan (default) atau paralel. Ditetapkan per tingkat |
| Delegasi | Penyetuju dapat mendelegasikan dengan periode berakhir. Delegasi tercatat di audit trail |
| Eskalasi | Setelah N hari tanpa respons, naik ke tingkat berikutnya. Notifikasi ke keduanya |
| Tarik kembali | Pengaju dapat menarik selama belum ada yang menyetujui |
| Penolakan | **Alasan wajib.** Dokumen kembali ke `draft`, alasan tampil di halaman detail |
| Diri sendiri | Pengaju tidak dapat menyetujui dokumennya sendiri, meski punya izin |

Aturan terakhir bukan preferensi — ia kontrol pemisahan tugas yang akan ditanyakan auditor.

### Nomor dokumen

Nomor resmi diberikan saat **submit**, bukan saat draft dibuat. Draf yang dibuang tidak boleh membakar nomor urut — celah dalam urutan nomor adalah temuan audit.

---

## Archetype 3 — Konversi Dokumen

Penawaran → Pesanan Penjualan → Faktur. RFQ → Pesanan Pembelian → Penerimaan Barang → Tagihan.

| Aturan | Alasan |
|---|---|
| Konversi **tidak pernah mengubah dokumen sumber** | Sumber tetap menjadi catatan atas apa yang disepakati |
| Konversi parsial diizinkan | Konversi 3 dari 5 baris; sisanya tetap terbuka |
| Kuantitas terkonversi dilacak per baris | Sumber menampilkan `240 dari 400 difakturkan` |
| **Penjagaan konversi berlebih** | Tidak dapat memfakturkan melebihi yang dipesan tanpa persetujuan eksplisit |
| Jejak dua arah | Sumber menunjuk ke turunan, turunan menunjuk ke sumber. Keduanya di tab Dokumen terkait |
| Perubahan harga saat konversi | Diizinkan, tetapi **ditandai dan tercatat** — bukan senyap |

Penjagaan konversi berlebih adalah kontrol keuangan, bukan UX. Ia mencegah salah satu kebocoran paling umum di perusahaan dagang.

---

## Archetype 4 — Line-Item Editor

Muncul di Faktur, Tagihan, Pesanan, Penawaran, Jurnal, Penyesuaian Stok, BOM. **Dipakai puluhan kali di seluruh produk**, jadi kualitasnya berlipat ganda.

### Keyboard-first, non-negosiabel

| Tombol | Aksi |
|---|---|
| `Tab` | Sel berikutnya |
| `Enter` | Baris berikutnya, kolom yang sama |
| `Enter` di sel terakhir | Buat baris baru |
| `Ctrl+D` | Salin nilai dari baris di atas |
| `Ctrl+Backspace` | Hapus baris |
| Tempel | Tempel blok dari Excel mengisi banyak baris sekaligus |

Orang yang menginput 40 baris faktur tidak akan menyentuh mouse. Editor yang memaksanya adalah editor yang gagal.

### Urutan perhitungan — ditetapkan sekali, dipakai di semua modul

```
1. Bruto baris        = kuantitas × harga satuan
2. Diskon baris       = bruto × persen  ATAU  nominal
3. Neto baris         = bruto − diskon baris
4. Subtotal dokumen   = Σ neto baris
5. Diskon dokumen     = dialokasikan proporsional ke seluruh baris
6. DPP                = subtotal − diskon dokumen
7. Pajak              = dihitung per baris, di atas neto baris setelah alokasi
8. Total              = DPP + pajak − pemotongan (PPh)
```

**Diskon dokumen dialokasikan proporsional ke baris, bukan dikurangkan di akhir.** Ini penting: pajak dihitung per baris dan tarifnya bisa berbeda antar baris. Mengurangkan diskon di akhir menghasilkan pajak yang salah, dan itu bukan kesalahan tampilan — itu kesalahan pelaporan pajak.

### Aturan lain

- Kalkulasi real-time, tetapi **pembulatan hanya di akhir**. Pembulatan bertahap menciptakan selisih beberapa rupiah yang akan dikejar akuntan selama berjam-jam
- Multi-currency: kurs dikunci saat dokumen di-submit, bukan diambil ulang saat dibuka
- Baris tidak dapat dihapus setelah dokumen diposting — hanya lewat dokumen koreksi
- Pemilih item selalu async (Step 3.1 §5)

---

## Archetype 5 — Operasi Massal & Impor

**Alur:** unggah → petakan kolom → validasi dan pratinjau → konfirmasi → proses → laporan hasil.

Karena impor **tidak dapat diurungkan**, pratinjau adalah satu-satunya jaring pengaman. Ia harus benar-benar bekerja.

| Tahap | Wajib |
|---|---|
| Pemetaan | Deteksi otomatis dari header, dapat dikoreksi. Pemetaan dapat disimpan untuk impor berikutnya |
| Validasi | Berjalan atas **seluruh** file sebelum satu baris pun ditulis |
| Pratinjau | Jumlah berhasil, jumlah gagal, dan **alasan per baris** — bukan hanya total |
| Konfirmasi | Menyebut jumlah baris dan nama company |
| Proses | Asinkron bila >10 detik (Step 3.4 §4). Pengguna bebas meninggalkan halaman |
| Laporan | Dapat diunduh, memuat baris gagal beserta alasannya dalam format yang dapat diperbaiki dan diunggah ulang |

**Impor bersifat idempotent lewat kunci alami** (misalnya nomor dokumen). Mengunggah file yang sama dua kali tidak menghasilkan duplikat — ia melaporkan baris yang sudah ada. Tanpa ini, koneksi terputus di tengah impor akan menghasilkan data ganda.

Operasi massal pada data yang sudah ada memakai aturan seleksi dari Step 3.2 §1.3.

---

## Archetype 6 — Laporan & Dashboard

**Struktur baku:** panel parameter → hasil → drill-down → ekspor → jadwal.

| Aturan | Alasan |
|---|---|
| **Setiap angka dapat di-drill sampai ke transaksi sumbernya** | Pilar Terang. Angka agregat tanpa jalan ke sumbernya tidak dapat dipertanggungjawabkan |
| Parameter selalu terlihat di hasil | Laporan yang dicetak tanpa menyebut periode dan company-nya tidak berguna |
| Header laporan menyebut company, periode, mata uang, dan waktu generate | Sama seperti di atas |
| Perbandingan periode adalah parameter, bukan laporan terpisah | Menghindari ledakan jumlah laporan |
| Jadwal dan langganan | Kirim otomatis ke email pada tanggal tertentu |
| Ekspor mengikuti parameter, bukan tampilan | Step 3.2 §1.7 |

**Laporan keuangan menampilkan angka negatif dalam kurung**, sesuai Typography System.

Dashboard adalah kumpulan kartu KPI (Step 3.2 §8) — dan setiap kartu wajib punya jalur ke laporan yang mendasarinya.

---

## Archetype 7 — Pengaturan & Konfigurasi

Empat tingkat dengan pewarisan:

```
Tenant  →  Company  →  Modul  →  Pengguna
```

Tingkat yang lebih spesifik menimpa yang lebih umum.

**Setiap field pengaturan wajib menampilkan asal nilainya:** *"Diwarisi dari Tenant"* atau *"Diubah di Company ini"*, dengan tombol kembali ke default. Tanpa ini, pengguna tidak dapat menjelaskan mengapa dua company berperilaku berbeda — dan itu memicu tiket dukungan yang tidak pernah selesai.

**Perubahan berdampak luas menampilkan pratinjau dampak sebelum disimpan.** Mengubah bulan awal tahun fiskal atau mata uang default company yang sudah punya transaksi memerlukan konfirmasi yang menyebut berapa transaksi terpengaruh — atau ditolak sama sekali bila memang tidak dapat diubah.

Pengaturan yang **tidak dapat diubah setelah ada transaksi** ditandai jelas sejak awal, bukan saat pengguna mencoba mengubahnya.

---

## Archetype 8 — Interaksi AI

Empat permukaan:

| Permukaan | Bentuk |
|---|---|
| Global | Lewat `⌘K`, pertanyaan bebas lintas modul |
| Kontekstual | Panel kanan yang membawa konteks halaman aktif |
| Inline | Saran di dalam form — kategori akun, pencocokan item |
| Terjadwal | Ringkasan dan anomali yang dikirim proaktif |

### Pola kepercayaan — non-negosiabel

**1 · Selalu menyebut sumber dan cakupan.** *"Dihitung dari 47 transaksi pembelian, 1–31 Agustus 2026."* Jawaban tanpa dasar yang dapat ditelusuri melanggar pilar Terang.

**2 · Selalu dapat diverifikasi.** Setiap klaim AI punya tautan ke data yang mendasarinya.

**3 · Tidak pernah mengubah data tanpa konfirmasi eksplisit** yang menampilkan persis apa yang akan berubah.

**4 · Setiap aksi AI tercatat di audit trail dengan pelaku yang ditandai sebagai AI**, dapat dibedakan secara visual dari manusia dan dari sistem (Step 3.2 §9).

**5 · AI tidak pernah memposting dokumen ke buku besar.** Ia dapat menyiapkan draf; manusia yang memposting. Batas ini bukan soal kemampuan model — ia soal siapa yang bertanggung jawab saat angkanya salah.

**6 · AI boleh mengatakan tidak tahu**, dan itu lebih murah daripada satu angka yang salah dipercaya.

**7 · Konteks yang sedang dibaca AI ditampilkan eksplisit** di panel: `Konteks: Faktur INV/2026/08/0142`.

---

## Peta Pemakaian

| Archetype | Modul yang memakainya |
|---|---|
| 1 · List → Detail → Edit | Semua |
| 2 · Siklus hidup & persetujuan | Penjualan, Pembelian, Akuntansi, Persediaan, HR, Proyek, Manufaktur |
| 3 · Konversi dokumen | Penjualan, Pembelian, Manufaktur |
| 4 · Line-item editor | Penjualan, Pembelian, Akuntansi, Persediaan, Manufaktur, POS |
| 5 · Massal & impor | Semua |
| 6 · Laporan & dashboard | Semua |
| 7 · Pengaturan | Semua |
| 8 · AI | Semua |

---

## Risiko & Item Terbuka

| Item | Status | Dampak |
|---|---|---|
| Urutan perhitungan pajak | **Perlu validasi akuntan pajak** | Alokasi diskon dokumen memengaruhi DPP dan PPN. Salah di sini adalah kesalahan pelaporan, bukan kesalahan tampilan |
| Mesin alur persetujuan | Belum dirancang | Perlu keputusan arsitektur — mesin generik atau per modul |
| Pemberian nomor dokumen | Belum dirancang | Harus tahan terhadap konkurensi dan tidak menghasilkan celah |
| Kebijakan penguncian kurs | Ditetapkan sementara pada submit | Perlu konfirmasi terhadap praktik akuntansi Indonesia |
| Presisi dan pembulatan | Belum ditetapkan | Perlu keputusan jumlah desimal internal sebelum modul keuangan dibangun |
| Batas aksi AI per peran | Belum dipetakan | Ditetapkan bersama Permission Matrix |
