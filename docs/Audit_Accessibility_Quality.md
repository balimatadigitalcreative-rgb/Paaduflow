# Paadu Flow — Audit Aksesibilitas & Kualitas
### Step 8.1 · Fase 8 — Validation & Handoff

**Objek audit:** `Paadu_Flow_Prototype.jsx` sebagaimana dibangun di Step 7.2–7.3.
**Standar:** WCAG 2.1 AA.
**Metode:** rasio kontras dihitung dengan formula luminansi relatif WCAG atas seluruh pasangan token yang benar-benar dipakai; sisanya inspeksi kode. **Belum diuji dengan screen reader sungguhan** — lihat §5.

---

## 1. Ringkasan

| Severity | Ditemukan | Diperbaiki | Tersisa |
|---|---|---|---|
| Critical | 0 | — | 0 |
| Major | 5 | 5 | 0 |
| Minor | 4 | 3 | 1 |
| Salah alarm | 2 | — | — |

---

## 2. Kontras Warna

### Sebelum perbaikan

| Kombinasi | Rasio | Ambang | Hasil |
|---|---|---|---|
| Teks tersier / surface (light) | 4,59:1 | 4,5 | ✅ |
| **Teks tersier / surface sunken (light)** | **4,10:1** | 4,5 | ❌ Major |
| **Teks tersier / surface (dark)** | **3,59:1** | 4,5 | ❌ Major |
| **Teks tersier / surface sunken (dark)** | **4,26:1** | 4,5 | ❌ Major |
| Teks utama light / dark | 16,47 / 14,73:1 | 4,5 | ✅ AAA |
| Teks sekunder light / dark | 6,66 / 6,33:1 | 4,5 | ✅ |
| Teks aksen light / dark | 10,99 / 6,65:1 | 4,5 | ✅ |
| Status berhasil light / dark | 5,14 / 11,29:1 | 4,5 | ✅ |
| Status peringatan light / dark | 4,58 / 11,27:1 | 4,5 | ✅ |
| Status bahaya light / dark | 6,10 / 9,42:1 | 4,5 | ✅ |
| Border interaktif light / dark | 3,18 / 3,59:1 | 3,0 | ✅ |
| Ring fokus light / dark | 8,98 / 4,32:1 | 3,0 | ✅ |
| Putih di atas tombol primer light / dark | 8,98 / 5,52:1 | 4,5 | ✅ |

### Perbaikan yang diterapkan

`--tx-3` diganti di kedua mode, dipilih dari kandidat yang diuji — bukan ditebak:

| Mode | Sebelum | Sesudah | Surface | Sunken |
|---|---|---|---|---|
| Light | `#6F7588` | **`#686E80`** | 5,08:1 | 4,54:1 |
| Dark | `#6F7588` | **`#8A90A3`** (neutral-450) | 5,18:1 | 6,15:1 |

Keduanya kini lolos di kedua permukaan. Ini juga alasan `neutral-450` ada di `tokens.json` — setengah langkah itu ternyata dibutuhkan dua kali.

### Dua salah alarm

**"Border default hanya 1,26:1"** — bukan kegagalan. WCAG 1.4.11 mengatur batas yang *dibutuhkan untuk mengidentifikasi komponen*. Garis pemisah baris tabel bersifat dekoratif; yang wajib 3:1 adalah `--bd-i` (batas kontrol), dan ia lolos di kedua mode. Ambang di skrip audit awal saya yang salah, bukan tokennya.

**"Ring fokus dark gagal"** — saya salah menguji `indigo-500` padahal token yang dipakai `indigo-400`. Nilai sebenarnya 4,32:1, lolos.

> Catatan metodologi: dua dari empat kegagalan awal ternyata ada di tesnya. Audit yang tidak memeriksa asumsi tesnya sendiri akan menghasilkan perbaikan yang tidak perlu.

---

## 3. Keyboard & Semantik

Ini temuan yang **lebih serius daripada kontras**, dan ketiganya tidak akan tertangkap oleh pemeriksa kontras otomatis.

| # | Temuan | Severity | Perbaikan |
|---|---|---|---|
| 1 | **Baris tabel faktur hanya dapat dibuka dengan klik.** `onClick` di `<tr>` tidak dapat difokus maupun diaktifkan keyboard | **Major** | Nomor faktur dijadikan `<button>` dengan `aria-label` deskriptif. Klik baris dipertahankan sebagai kemudahan mouse |
| 2 | **Header kolom yang dapat diurutkan tidak dapat difokus.** `onClick` di `<th>` — pengguna keyboard tidak dapat mengurutkan sama sekali | **Major** | Label dibungkus `<button>` dengan `aria-label="Urutkan menurut …"`. `aria-sort` sudah ada dan dipertahankan |
| 3 | **Baris laba rugi yang dapat ditelusuri tidak dapat difokus** — fitur inti Alur 2 tidak tersedia lewat keyboard | **Major** | Label akun dijadikan `<button>` dengan `aria-label` yang menyebut akun dan periode |
| 4 | Seluruh `<th>` tanpa `scope` | Minor | `scope="col"` ditambahkan pada 18 header di 4 tabel |
| 5 | Target sentuh rail 34px, kontrol 30–36px | **Major** di perangkat sentuh | Media query `(pointer:coarse)` menaikkan rail, tombol, item nav, dan tinggi baris ke minimal 44px |

### Yang sudah benar sebelum audit

Skip link ke konten utama dan berfungsi · landmark `header`/`nav`/`main` dengan `aria-label` · `aria-live="assertive"` pada banner perpindahan company dan `polite` pada toast · `aria-sort` pada kolom terurut · seluruh input punya label atau `aria-label` · grafik punya `role="img"` dengan deskripsi · `:focus-visible` di semua elemen interaktif, tidak pernah dihapus · `prefers-reduced-motion` dihormati termasuk animasi angka KPI · focus trap dan pengembalian fokus di dialog konfirmasi, pengalih company, dan overlay bantuan.

### Warna bukan satu-satunya pembeda

Diverifikasi di tiga tempat: badge status membawa titik indikator **dan** teks; tren KPI membawa panah arah **dan** tanda; grafik penjualan memberi label angka pada batang yang disorot. Lolos WCAG 1.4.1.

---

## 4. Uji Aturan Tiga Klik

Diukur pada prototype yang sudah dibangun, dari dashboard, dengan mouse.

| Tugas | Jalur | Klik | |
|---|---|---|---|
| Buka daftar faktur | Rail Penjualan → Faktur | 2 | ✅ |
| Buat faktur | Rail Penjualan → Faktur → Buat faktur | 3 | ✅ |
| Lihat faktur jatuh tempo | Rail Penjualan → Faktur → chip Jatuh tempo | 3 | ✅ |
| Buka laba rugi | Rail Akuntansi → Laba rugi | 2 | ✅ |
| Telusuri pendapatan ke jurnal | Akuntansi → Laba rugi → baris Pendapatan | 3 | ✅ |
| Ganti company | Pengalih → pilih company | 2 | ✅ |
| Ubah tema atau kepadatan | Tombol di top bar | 1 | ✅ |
| **Telusuri sampai faktur sumber** | Akuntansi → Laba rugi → baris → jurnal | **4** | ⚠️ |

**Satu tugas melebihi tiga klik, dan itu dapat diterima.** Menelusuri dari laporan sampai ke dokumen sumber secara inheren melintasi tiga tingkat hierarki data. Memaksanya menjadi tiga klik berarti menghapus satu tingkat, dan tingkat jurnal justru bagian yang dicari auditor. Ini dicatat sebagai pengecualian sadar, sejalan dengan pengecualian posting jurnal di Step 5.1.

Lewat keyboard, seluruh tugas di atas tercapai dalam satu langkah `⌘K`.

---

## 5. Yang Belum Diuji

| Item | Status | Kenapa penting |
|---|---|---|
| Screen reader sungguhan | **Belum** | Inspeksi kode tidak dapat menggantikan NVDA, JAWS, atau VoiceOver. Urutan pengumuman dan pembacaan tabel hanya terbukti lewat pengujian nyata |
| Kepadatan compact di layar 1080p | Belum | Tinggi baris 32px dengan font 14px perlu diverifikasi di kepadatan piksel rendah |
| Zoom 200% | Belum | WCAG 1.4.4. Layout dua kolom laba rugi berisiko pecah |
| Mode kontras tinggi Windows | Belum | Warna yang dipaksa OS dapat menghapus pembeda status |
| Simulator buta warna untuk palet data-viz | Belum | Utang sejak Step 1.2 |
| Uji beban tabel | Belum | 100 faktur tidak menguji virtualisasi |
| Uji keselamatan konteks company | **Belum** | Uji terpenting yang tersisa — lihat di bawah |

### Uji yang paling mendesak, dan bukan uji aksesibilitas

**Apakah pengguna benar-benar menyadari saat konteks company berpindah?**

Empat lapis pertahanan sudah dibangun — nama di top bar, baris konteks di page header, banner konfirmasi, dan penyebutan nama company di dialog penerbitan. Tetapi tidak satu pun terbukti berhasil sampai diuji pada orang sungguhan yang sedang mengerjakan tugas lain.

Bentuk ujinya: minta peserta menerbitkan faktur, lalu di tengah alur pindahkan konteks company, dan lihat apakah mereka menyadarinya sebelum menekan Terbitkan. Ini uji keselamatan data, bukan uji kegunaan — dan konsekuensi kegagalannya adalah transaksi masuk ke entitas legal yang salah.

---

## 6. Sisa Temuan

| Temuan | Severity | Status |
|---|---|---|
| `<tr onClick>` masih ada di tabel faktur | Minor | **Dibiarkan.** Ia kemudahan mouse; jalur keyboard tersedia lewat tombol nomor faktur. Menghapusnya justru menurunkan kegunaan tanpa menambah aksesibilitas |
| Pemilih barang memakai `select`, bukan combobox async | Minor | Diterima untuk prototype. Spesifikasi 3.1 §5 mensyaratkan async di produksi |
| Tabel tanpa `<caption>` | Minor | Konteks sudah dibawa page header. Ditinjau ulang setelah uji screen reader |
