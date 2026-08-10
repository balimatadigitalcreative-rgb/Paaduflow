# Paadu Flow — Feedback & State Component Specs
### Step 3.4 · Fase 3 — Core Component Library

**Input:** Design Tokens (2.1), Primitive (3.1), Composite (3.2).

**Cakupan dokumen ini.** Step 3.2 §10 mendaftar *jenis* state component. Dokumen ini menetapkan *perilaku dan aturannya*, plus tiga area yang belum tersentuh sama sekali: **taksonomi error**, **penanganan konflik edit bersamaan**, dan **pola pekerjaan asinkron panjang**.

---

## 1. Ambang Waktu

Aturan tunggal yang mengikat seluruh perilaku pemuatan.

| Durasi | Yang ditampilkan |
|---|---|
| < 300ms | **Tidak ada apa pun** |
| 300ms – 2s | Skeleton yang menyerupai bentuk konten akhir |
| 2s – 10s | Skeleton + teks yang menjelaskan apa yang sedang terjadi |
| > 10s | **Bukan pemuatan lagi — ini pekerjaan asinkron.** Lihat §4 |

Indikator yang berkedip sekejap lebih mengganggu daripada jeda singkat yang tidak ditandai apa pun. Ambang 300ms bukan preferensi; ia batas di mana mata mulai membaca jeda sebagai jeda.

---

## 2. Sistem Skeleton

**Skeleton wajib menyerupai bentuk konten akhir** — jumlah kolom, tinggi baris, dan jumlah baris yang sama. Skeleton yang bentuknya salah menyebabkan layout shift saat data tiba, dan itu memindahkan tombol tepat saat pengguna hendak mengklik.

| Konteks | Bentuk skeleton |
|---|---|
| Data table | Header sungguhan + N baris abu setinggi baris density aktif |
| Halaman detail | Blok judul, blok metadata, blok konten dengan proporsi yang sama |
| KPI card | Kotak label + kotak nilai, ukuran kartu final |
| Daftar/feed | Baris dengan avatar bulat + dua baris teks |

**Header tabel dan page header tidak di-skeleton** — keduanya sudah diketahui sebelum data tiba, jadi tampilkan langsung. Men-skeleton yang sudah diketahui membuat halaman terasa lebih lambat dari kenyataannya.

Animasi shimmer memakai `duration-slow`, dan **dinonaktifkan penuh** di bawah `prefers-reduced-motion`. Skeleton statis tetap berfungsi.

Setiap area skeleton memakai `aria-busy="true"` dan diumumkan sekali sebagai "Memuat", bukan berulang.

---

## 3. Optimistic UI & Rollback

**Optimistic diizinkan hanya bila aksi memenuhi ketiganya:** kemungkinan gagal rendah, dampak kegagalan rendah, dan dapat dipulihkan.

| Aksi | Optimistic? |
|---|---|
| Tandai notifikasi terbaca, tambah tag, ubah catatan | ✅ Ya |
| Ubah kuantitas inline | ✅ Ya, dengan rollback jelas |
| Terbitkan faktur, posting jurnal, setujui approval | ❌ **Tidak.** Tunggu konfirmasi server |
| Aksi massal | ❌ Tidak |

Saat rollback: nilai kembali, baris diberi penanda error sementara, dan toast menjelaskan **apa** yang gagal dan **mengapa** — bukan "Terjadi kesalahan".

Aturan mutlak: **tidak pernah optimistic untuk apa pun yang memindahkan uang, mengubah status dokumen, atau menulis ke buku besar.** Menampilkan "terbit" untuk faktur yang sebenarnya gagal adalah kebohongan yang mahal.

---

## 4. Pekerjaan Asinkron Panjang

Untuk operasi >10 detik: export besar, impor massal, tutup buku, generate laporan, kirim faktur massal.

**Pola:** pengguna memicu → pekerjaan masuk antrean → **pengguna bebas meninggalkan halaman** → progres terlihat di notification center → selesai memicu notifikasi persisten dengan tautan hasil.

Aturan:
- **Jangan pernah menahan pengguna di layar tunggu** untuk pekerjaan >10 detik
- Progres determinate bila jumlah item diketahui (`312 dari 1.284 baris`); indeterminate bila tidak
- Pekerjaan dapat dibatalkan bila belum menulis data; **tidak dapat dibatalkan** setelah mulai menulis, dan itu dinyatakan sebelum dimulai
- Hasil parsial dilaporkan per baris: berhasil, gagal, dan **alasan** kegagalan per baris — bukan hanya jumlah total
- Hasil pekerjaan tetap tersedia minimal 7 hari

---

## 5. Taksonomi Error

Tujuh jenis. Masing-masing punya UI dan copy yang berbeda karena **tindakan yang benar berbeda**. Menyeragamkan semuanya menjadi "Terjadi kesalahan" memindahkan pekerjaan diagnosis ke pengguna.

| Jenis | Tempat tampil | Copy menyebutkan | Aksi |
|---|---|---|---|
| **Validasi** | Inline di field + ringkasan atas | Aturan + nilai aktual | Perbaiki field |
| **Permission** | State halaman penuh | Izin apa yang kurang **dan kepada siapa meminta** | Minta akses |
| **Tidak ditemukan** | State halaman penuh | Objek mungkin dihapus, **atau milik company lain** | Kembali ke daftar · ganti company |
| **Konflik** | Modal | Siapa mengubah, kapan, field mana | Lihat §6 |
| **Server (5xx)** | Inline alert atau state | Bahwa ini bukan kesalahan pengguna | Coba lagi |
| **Jaringan** | Toast persisten | Koneksi terputus | Otomatis coba ulang + tombol manual |
| **Timeout** | Inline alert | Operasi mungkin **masih berjalan** | Periksa status, jangan ulangi |

**Timeout adalah yang paling berbahaya** dan paling sering ditangani salah. Mengulang operasi yang sebenarnya masih berjalan menghasilkan faktur ganda dan pembayaran ganda. Copy-nya wajib menyarankan **memeriksa**, bukan mengulang — dan operasi tulis wajib idempotent dengan idempotency key, sesuai API Standards.

**Error "tidak ditemukan" wajib menyebut kemungkinan salah company.** Di produk multi-company, ini penyebab paling umum dokumen "hilang", dan tanpa petunjuk itu pengguna akan menyimpulkan datanya terhapus.

---

## 6. Konflik Edit Bersamaan

Belum tersentuh di dokumen mana pun, dan tidak dapat ditambal belakangan.

Business OS adalah aplikasi multi-pengguna. Dua orang akan mengedit faktur yang sama. Tanpa penanganan eksplisit, yang terjadi adalah **last-write-wins secara diam-diam** — perubahan seseorang hilang tanpa siapa pun tahu.

### Tiga lapis

**Lapis 1 — Kehadiran.** Bila pengguna lain sedang membuka dokumen yang sama dalam mode edit, tampilkan indikator: avatar mereka di page header dengan tooltip *"Budi sedang melihat dokumen ini"*. Ini mencegah sebagian besar konflik sebelum terjadi.

**Lapis 2 — Deteksi.** Setiap simpan menyertakan versi dokumen yang dibaca pengguna. Server menolak bila versinya sudah berubah. Ini optimistic concurrency, dan ia wajib — bukan opsional.

**Lapis 3 — Resolusi.** Saat konflik terdeteksi, tampilkan modal yang memuat:
- Siapa yang mengubah dan kapan
- **Daftar field yang bentrok, dengan nilai mereka dan nilai Anda berdampingan**
- Pilihan: pertahankan milik saya · ambil milik mereka · gabungkan per field

**Dilarang menawarkan "timpa saja" tanpa menampilkan apa yang akan ditimpa.**

### Pengecualian

Dokumen yang sudah **diposting atau disetujui tidak dapat diedit sama sekali** — ia hanya dapat dibatalkan atau dikoreksi lewat dokumen baru. Ini menghilangkan seluruh kelas konflik di area yang paling berkonsekuensi, dan sejalan dengan prinsip audit trail yang tidak dapat diubah.

---

## 7. Offline & Sinkronisasi

Berlaku hanya untuk modul yang memang dirancang offline (POS, absensi, approval, tangkap struk).

Indikator status permanen di shell: **online · offline · menyinkronkan**. Saat offline, tampilkan jumlah perubahan yang tertunda.

- Modul yang tidak mendukung offline menampilkan pesan jujur dan menawarkan tindakan yang mungkin — bukan versi yang diperas sampai tidak bisa dipakai
- Perubahan lokal ditandai visual sampai tersinkron
- Konflik saat sinkronisasi memakai alur §6, **tidak pernah diselesaikan diam-diam**
- Nomor dokumen tidak pernah diberikan offline — dokumen offline memakai identifier sementara dan mendapat nomor resmi saat sinkron

---

## 8. Toast & Undo

Durasi 5 detik untuk konfirmasi biasa, **8 detik bila ada tombol Urungkan**. Timer berhenti saat hover atau fokus.

**Untuk aksi destruktif yang dapat diurungkan, "hapus + undo" lebih baik daripada "konfirmasi lalu hapus".** Dialog konfirmasi menambah gesekan pada setiap aksi termasuk yang benar; undo hanya menambah gesekan pada aksi yang salah.

Dialog konfirmasi tetap dipakai bila aksi **tidak dapat diurungkan** atau berdampak besar.

Toast memuat objek spesifik: *"Faktur INV/2026/08/0142 dibatalkan."* dengan "Urungkan". Maksimal tiga toast bertumpuk; sisanya antre. Toast diumumkan lewat `aria-live="polite"`, kecuali toast error yang memakai `assertive`.

**Toast tidak pernah membawa satu-satunya salinan informasi penting.** Bila pengguna sedang melihat ke tempat lain, informasinya hilang selamanya.

---

## 9. Sistem Empty State

Empat komponen tetap: judul, penjelasan satu baris, satu CTA utama, ilustrasi garis opsional.

| Konteks | Judul | CTA |
|---|---|---|
| Belum ada data | "Belum ada faktur" | Buat faktur pertama · Impor dari sistem lama |
| Tidak ada hasil filter | "Tidak ada faktur yang cocok" | Hapus filter |
| Permission | "Anda tidak punya akses ke Laporan Keuangan" | Minta akses ke admin company |
| Fitur belum aktif | "Modul Manufaktur belum diaktifkan" | Pelajari · Hubungi admin |

Ilustrasi mengikuti gaya garis dari Brand Book §8: monoline, ujung membulat, satu warna. **Empty state tanpa CTA adalah jalan buntu** — selalu ada satu langkah berikutnya, meski hanya "kembali ke daftar".

---

## 10. Risiko & Item Terbuka

| Item | Status | Dampak |
|---|---|---|
| Mekanisme kehadiran real-time | Belum dirancang | Butuh keputusan arsitektur (WebSocket atau polling) sebelum Lapis 1 §6 dapat dibangun |
| Versioning dokumen untuk deteksi konflik | Belum ada di skema | **Harus masuk skema database sebelum modul transaksional dibangun** — tidak dapat ditambal belakangan |
| Retensi hasil pekerjaan asinkron | Ditetapkan sementara 7 hari | Perlu dikonfirmasi terhadap kebijakan retensi data |
| Strategi antrean offline | Belum dirancang | Ditetapkan bersama desain modul POS |
| Ilustrasi empty state | Belum diproduksi | Menunggu keputusan bentuk mark dan hex brand |
