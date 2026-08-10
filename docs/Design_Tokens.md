# Paadu Flow — Design Token Architecture
### Step 2.1 · Fase 2 — Design System Foundation

**Input:** Color System (Step 1.2), Typography System (Step 1.3).
**Output ini menjadi input untuk:** seluruh Fase 3 (Component Library) dan setiap komponen yang pernah dibangun sesudahnya.

---

> ## ⚠️ Step 1.4 (Brand Book) belum dikerjakan
>
> Dilewati secara sengaja, bukan terlupa. Brand Book menunggu tiga item yang masih terbuka:
>
> 1. **Nilai hex brand asli** — seluruh skala indigo saat ini diturunkan dari `#3A34B5`, sebuah perkiraan dari tangkapan layar
> 2. **Nama typeface wordmark** — rasio mark terhadap wordmark di lockup belum bisa dikunci tanpa ini
> 3. **Trademark clearance resmi** — DJKI, WIPO, dan MyIPO (lihat Brand Clearance Report, Step 0.1)
>
> Brand Book adalah dokumen paling mahal untuk dibuang kalau nama berubah. Kerjakan **setelah** ketiganya tertutup. Fase 2 dan 3 dapat berjalan penuh tanpanya.

---

## 1. Model Tiga Lapis

```
Lapis 1 — PRIMITIVE   nilai mentah, tanpa makna
                      --indigo-600, --space-4, --duration-fast
                      ↓ dirujuk oleh
Lapis 2 — SEMANTIC    makna, tanpa konteks komponen
                      --text-secondary, --bg-surface, --radius-control
                      ↓ dirujuk oleh
Lapis 3 — COMPONENT   konteks spesifik
                      --button-primary-bg-hover, --table-row-bg-selected
```

**Aturan aliran satu arah:** komponen hanya boleh membaca Lapis 3 atau Lapis 2. Komponen **tidak pernah** membaca Lapis 1.

Alasannya bukan kerapian. Kalau sebuah tombol menulis `background: var(--indigo-600)`, maka tombol itu diam-diam mengunci dirinya ke warna, bukan ke peran. Saat dark mode butuh `indigo-500` dan saat tenant mengganti brand-nya, tombol itu harus diedit satu per satu. Dengan `--action-primary-bg`, tidak ada satu pun komponen yang perlu disentuh.

**Kapan Lapis 3 dibuat:** hanya kalau sebuah komponen benar-benar butuh nilai yang berbeda dari token semantik. Sebagian besar komponen tidak. Membuat token Lapis 3 untuk setiap properti setiap komponen menghasilkan ribuan token yang tidak ada yang mengingatnya — itu kegagalan design system yang paling umum.

---

## 2. Konvensi Penamaan

### Pola

| Lapis | Pola | Contoh |
|---|---|---|
| Primitive | `--{ramp}-{stop}` | `--indigo-600`, `--neutral-450` |
| Primitive (non-warna) | `--{kategori}-{skala}` | `--space-4`, `--duration-fast` |
| Semantic | `--{properti}-{peran}` | `--text-secondary`, `--border-focus` |
| Component | `--{komponen}-{bagian}-{properti}-{state}` | `--button-primary-bg-hover` |

### Aturan mengikat

**Dilarang menyandikan nilai ke dalam nama.** `--blue-button-bg` salah — kalau brand berubah jadi hijau, namanya berbohong. `--action-primary-bg` benar.

**Dilarang menyandikan konteks di Lapis 1.** `--indigo-button` salah; primitive tidak tahu apa pun tentang tombol.

**Dilarang singkatan kecuali yang sudah universal.** `bg` boleh. `fg` tidak — pakai `text`. `clr`, `bdr`, `sz` tidak.

**Urutan state selalu di akhir:** `default` (implisit, tanpa sufiks), `-hover`, `-active`, `-focus`, `-disabled`, `-selected`.

**Semua kebab-case huruf kecil.** Tanpa camelCase, tanpa underscore.

**Nama harus menjelaskan dirinya tanpa dokumentasi.** Uji: kalau seorang engineer baru membaca nama token dan tidak bisa menebak apa fungsinya, namanya salah.

---

## 3. Spacing

Basis **4px**. Angka pada nama adalah pengali basis — `space-4` = 4 × 4px = 16px.

| Token | px | Pemakaian utama |
|---|---|---|
| `space-0` | 0 | Reset |
| `space-px` | 1 | Koreksi optis, garis |
| `space-0-5` | 2 | Jarak ikon ke label sangat rapat |
| `space-1` | 4 | Jarak dalam badge, chip |
| `space-2` | 8 | Jarak ikon ke teks, gap tombol |
| `space-3` | 12 | Padding sel tabel compact, gap form compact |
| `space-4` | 16 | **Padding default** — sel tabel, kartu, tombol |
| `space-5` | 20 | Gap antar field form (comfortable) |
| `space-6` | 24 | Padding kartu, gap antar grup |
| `space-8` | 32 | Gap antar seksi |
| `space-10` | 40 | Margin atas seksi besar |
| `space-12` | 48 | Padding halaman vertikal |
| `space-16` | 64 | Pemisah blok besar |
| `space-20` | 80 | Padding halaman marketing |
| `space-24` | 96 | Hero, halaman kosong |

**Tidak ada nilai spacing di luar skala ini.** `padding: 15px` adalah bug, bukan penyesuaian.

---

## 4. Sizing

| Token | px | Catatan |
|---|---|---|
| `size-control-sm` | 28 | Tombol dan input kecil |
| `size-control-md` | 36 | **Default** |
| `size-control-lg` | 44 | Aksi utama, target sentuh mobile |
| `size-row-comfortable` | 44 | Tinggi baris tabel |
| `size-row-compact` | 32 | Tinggi baris tabel padat |
| `size-sidebar` | 240 | Navigasi utama |
| `size-sidebar-collapsed` | 56 | Rail ikon |
| `size-touch-min` | 44 | **Minimum mutlak target sentuh** |
| `container-form` | 640 | Lebar maks form dan prosa (±75 karakter) |
| `container-narrow` | 480 | Dialog, panel sempit |

Halaman tabel **tidak memakai container** — tabel butuh lebar penuh.

---

## 5. Radius & Border

| Token | Nilai | Pemakaian |
|---|---|---|
| `radius-none` | 0 | Tabel, baris, elemen menempel |
| `radius-sm` | 4px | Badge, chip, checkbox |
| `radius-md` | 6px | **Kontrol** — input, tombol, select |
| `radius-lg` | 8px | Panel kecil, dropdown |
| `radius-xl` | 12px | Kartu, modal |
| `radius-full` | 9999px | Avatar, pill, toggle |

| Token | Nilai | Catatan |
|---|---|---|
| `border-width-default` | 1px | Default produk |
| `border-width-hairline` | 0.5px | **Hanya untuk layar retina** — di layar 1× ia dibulatkan tak konsisten dan menghasilkan garis yang hilang di sebagian baris tabel |
| `border-width-focus` | 2px | Focus ring |

---

## 6. Elevation

**Light mode memakai bayangan. Dark mode tidak.**

Bayangan tidak terlihat di atas latar gelap — menaikkan lightness surface adalah satu-satunya cara elevasi terbaca. Ini bukan penyederhanaan; menyalin bayangan ke dark mode menghasilkan lapisan yang tampak datar dan pengguna kehilangan hierarki.

| Level | Light | Dark | Pemakaian |
|---|---|---|---|
| `elevation-0` | none | `neutral-950` | Kanvas halaman |
| `elevation-1` | `0 1px 2px rgba(16,19,25,.06)` | `neutral-900` | Kartu dalam aliran |
| `elevation-2` | `0 2px 4px rgba(16,19,25,.06), 0 1px 2px rgba(16,19,25,.04)` | `neutral-800` | Panel, sticky header |
| `elevation-3` | `0 4px 12px rgba(16,19,25,.08), 0 2px 4px rgba(16,19,25,.04)` | `neutral-800` + border `neutral-700` | Dropdown, popover, tooltip |
| `elevation-4` | `0 12px 32px rgba(16,19,25,.12), 0 4px 8px rgba(16,19,25,.06)` | `neutral-800` + border `neutral-700` + bayangan | Modal, drawer |

Level 4 adalah satu-satunya yang memakai bayangan di dark mode, karena ia harus terpisah dari backdrop gelap.

**Maksimal dua lapisan mengambang di layar secara bersamaan.** Lapisan ketiga berarti arsitektur informasinya salah — pakai halaman penuh, bukan popover di atas popover.

---

## 7. Z-Index

Skala terdefinisi. **Dilarang menulis nilai z-index literal di komponen mana pun.**

| Token | Nilai | Lapisan |
|---|---|---|
| `z-base` | 0 | Konten normal |
| `z-raised` | 10 | Kartu terangkat, baris di-hover |
| `z-sticky` | 100 | Header tabel sticky, footer aksi sticky |
| `z-nav` | 200 | Sidebar, top bar |
| `z-dropdown` | 1000 | Menu, select, combobox |
| `z-backdrop` | 1200 | Scrim modal |
| `z-modal` | 1300 | Dialog, drawer |
| `z-popover` | 1400 | Popover di dalam modal |
| `z-toast` | 1500 | Notifikasi |
| `z-tooltip` | 1600 | Tooltip — selalu paling atas |

Tooltip berada di atas segalanya karena ia bisa muncul di atas elemen mana pun, termasuk di dalam modal.

---

## 8. Motion

| Token | Nilai | Pemakaian |
|---|---|---|
| `duration-instant` | 0ms | Perubahan yang harus terasa langsung |
| `duration-fast` | 100ms | Hover, focus, perubahan state kontrol |
| `duration-normal` | 160ms | **Default** — elemen masuk, akordeon |
| `duration-slow` | 240ms | Modal, drawer, panel besar |
| `duration-deliberate` | 320ms | **Batas maksimum produk** |

| Token | Curve | Pemakaian |
|---|---|---|
| `ease-standard` | `cubic-bezier(.2,0,0,1)` | Default |
| `ease-enter` | `cubic-bezier(0,0,0,1)` | Elemen masuk — melambat di akhir |
| `ease-exit` | `cubic-bezier(.3,0,1,1)` | Elemen keluar — mempercepat |
| `ease-spring` | `cubic-bezier(.2,.8,.2,1)` | Toggle, switch |

**Aturan:** keluar selalu lebih cepat daripada masuk. Elemen yang pergi tidak boleh membuat pengguna menunggu. Kalau enter memakai `duration-normal`, exit memakai `duration-fast`.

**Tidak ada animasi melebihi 320ms di produk.** Animasi panjang terasa mewah pada demo dan menyiksa pada pemakaian kelima puluh di hari yang sama.

**`prefers-reduced-motion` bukan opsional:**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 9. Breakpoint & Opacity

| Token | Nilai | Target |
|---|---|---|
| `bp-sm` | 640px | Telepon besar |
| `bp-md` | 768px | Tablet portrait |
| `bp-lg` | 1024px | Tablet landscape, laptop kecil |
| `bp-xl` | 1280px | **Target utama aplikasi** |
| `bp-2xl` | 1536px | Monitor lebar |

Business OS adalah aplikasi **desktop-first**. Breakpoint di bawah `lg` melayani subset modul yang memang masuk akal di mobile — approval, POS, absensi — bukan seluruh produk.

| Token | Nilai |
|---|---|
| `opacity-disabled` | 0.4 |
| `opacity-scrim-light` | 0.45 |
| `opacity-scrim-dark` | 0.6 |
| `opacity-hover-wash` | 0.06 |
| `opacity-loading` | 0.6 |

**Opacity tidak pernah dipakai pada teks.** Teks disabled memakai token warna `--text-disabled`, bukan `opacity: .4` — opacity berlipat terhadap latar dan menghasilkan kontras yang berbeda di setiap surface.

---

## 10. Theming per Tenant

Roadmap Fase 4–5 mencantumkan Marketplace dan solusi industri; white-labeling per tenant hampir pasti akan diminta. Arsitekturnya ditetapkan sekarang agar tidak dipaksakan belakangan.

| Lapis | Boleh di-override tenant? |
|---|---|
| Lapis 1 — primitive non-warna | ❌ Terkunci |
| Lapis 1 — ramp `neutral` dan semantik | ❌ Terkunci |
| Lapis 1 — ramp `indigo` (brand) | ⚠️ Terkunci, tapi **diturunkan** dari input tenant |
| Lapis 2 — semantic | ❌ Terkunci total |
| Lapis 3 — component | ❌ Terkunci total |

### Mekanisme: tenant memberi maksud, sistem menurunkan nilai

Tenant **tidak pernah** menetapkan nilai token secara langsung. Yang boleh dikirim tenant hanya:

1. **Satu nilai hex brand.** Sistem yang menurunkan sebelas stop-nya.
2. **Logo** (SVG, varian terang dan gelap).
3. **Latar halaman login.**

Setelah hex diterima, sistem menjalankan tiga langkah otomatis:

1. Turunkan sebelas stop indigo dari hex tersebut
2. Petakan ulang token aksen di light dan dark mode
3. **Jalankan pemeriksaan kontras.** Kalau kombinasi mana pun turun di bawah 4.5:1 (teks) atau 3:1 (komponen), sistem menggeser stop yang dipakai — dan bila tetap gagal, menolak warna itu dengan pesan yang menjelaskan alasannya

Ini keputusan arsitektur yang paling penting di bagian ini. Membiarkan tenant menetapkan nilai token secara bebas berarti mengirimkan instans white-label yang tidak dapat diakses, dan tanggung jawabnya tetap ada pada Anda — bukan pada tenant.

**Ramp neutral tidak pernah dapat di-override.** Ia yang membawa 90% piksel aplikasi. Kalau tenant boleh mengubahnya, semua jaminan kontras runtuh sekaligus.

---

## 11. Tata Kelola

### Sumber kebenaran

`tokens.json` (format W3C Design Tokens) adalah **satu-satunya sumber kebenaran** mulai sekarang. `tokens.css` adalah keluaran yang dihasilkan darinya, bukan file yang diedit tangan.

`Color_System.md` dan `Typography_System.md` beralih peran menjadi **dokumen rasional** — mereka menjelaskan *mengapa*, bukan menyimpan nilai. Bila terjadi perbedaan, `tokens.json` yang menang.

### Kapan token baru dibenarkan

Ketiganya harus terpenuhi:

1. Nilainya dipakai di **tiga tempat atau lebih**
2. Ia membawa **makna semantik** yang belum tercakup token mana pun
3. Ia **perlu berbeda** antara light dan dark mode, antara density mode, atau antar tenant

Kalau salah satu tidak terpenuhi, pakai token yang sudah ada. Kalau tidak ada yang cocok, itu tanda desainnya yang menyimpang — bukan tanda sistemnya kurang lengkap.

### Siapa yang boleh menambah

Perubahan `tokens.json` lewat pull request dengan review wajib dari pemilik design system. Token bukan file yang bisa disentuh siapa saja — setiap penambahan adalah komitmen selamanya.

### Deprecation

```json
"--old-token": {
  "$value": "...",
  "$deprecated": true,
  "$description": "Diganti oleh --new-token. Dihapus di v3.0."
}
```

Token yang di-deprecate dipertahankan **dua rilis minor**. Selama periode itu, lint memberi peringatan. Setelah itu, build gagal.

### Penegakan

Lint rule yang **menggagalkan build** bila menemukan di kode komponen:
- Nilai hex mentah
- Nilai px di luar skala spacing
- `z-index` literal
- `opacity` pada elemen teks
- Rujukan ke token Lapis 1 dari komponen

Aturan yang tidak ditegakkan mesin akan dilanggar dalam tiga bulan. Ini bukan sinisme — ini pengalaman setiap design system yang pernah dibangun.

---

## 12. Risiko & Item Terbuka

| Item | Status | Dampak |
|---|---|---|
| **Step 1.4 Brand Book** | **Belum dikerjakan** | Lihat peringatan di awal dokumen |
| Hex brand asli | Terbuka | Sebelas stop indigo dan seluruh token aksen harus diturunkan ulang |
| Nama typeface wordmark | Terbuka | Lockup belum bisa dikunci |
| Trademark clearance | Terbuka | Risiko terbesar — rebranding setelah Fase 3 sangat mahal |
| Algoritma penurunan ramp tenant | Belum dirancang | Perlu ditetapkan sebelum fitur white-label dibangun (Fase 4) |
| Token untuk density mode | Belum lengkap | Perlu varian `space` dan `size` per density; ditetapkan saat Step 3.2 |
