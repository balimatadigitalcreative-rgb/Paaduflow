# Rencana Implementasi UI

**Fase 0 — Discovery.** Deliverable dari Fase 0 di `docs/UI_IMPLEMENTATION_BRIEF.md` §8.

> **Catatan kepatuhan.** EXIT Fase 0 berbunyi "nol berkas produksi berubah", tetapi
> `CLAUDE.md` sudah saya ubah atas instruksi eksplisit — dan tugas itu sebenarnya
> milik Fase 1 ("Perbaiki kalimat sumber kebenaran di CLAUDE.md"). Dikerjakan lebih
> awal, dicatat di sini supaya tidak terhitung dua kali. Terkirim di `a57f7c6`.

---

## 1. Inventaris `src/interface/web`

**Stack.** React 19.2 · TypeScript 5.7 (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) · Vite 7.3 · i18next 26 + react-i18next 17 · Tabler Icons · Style Dictionary 5.5 · Vitest 3 (`unit`/`db`/`ui`). Tanpa framework CSS.

**Isi.** 37 ekspor komponen · 19 layar di 7 berkas · 8 ekspor shell.

**Disiplin yang terbukti dipegang.** Enam dari tujuh daftar memakai `DataTable` + `useTabel` dengan paginasi kursor, seleksi baris, dan `bulkActions`. Empat layar detail memakai `useHeaderHalaman` + `Tabs` dengan id identik dalam urutan Flow_Archetypes §1. **Tidak ada satu pun CSS yang memanggil token primitif langsung** — seluruhnya lewat token semantik. Lima aturan stylelint sudah aktif sebagai *error*: `no-raw-hex`, `spacing-scale`, `no-literal-z-index`, `no-opacity-on-text`, `no-primitive-color-token`.

**Empat blocker komponen**, ditempatkan sesuai penugasan fase di brief §8:

| # | Temuan | Fase |
|---|---|---|
| **L-1** | `StatusBadge` tertutup pada tipe `DocumentStatus`; `pajak.tsx` memakai 10 `<Badge>` mentah dan nol `StatusBadge` | **1** — "konsolidasi tiga sumbu status jadi satu enum" |
| **L-2** | `settlement_status` dan `fulfillment_status` tanpa komponen. Ternary di `penjualan.tsx:285–294` meruntuhkan 5 nilai jadi 2 warna — `partially_paid`, `overpaid`, `written_off` tidak dapat dibedakan dari `unpaid` | **1** — enum yang sama |
| **L-3a** | Tidak ada `DropdownMenu` | **2** — disebut eksplisit "(belum ada)" |
| **L-3b** | `EmptyState` dan `InlineAlert` masih kelas CSS (`styles.notice`, `styles.card`) di lima berkas · tidak ada `Modal` | **3** — "naikkan dari kelas CSS ke komponen"; "Modal (belum ada)" |
| **L-4** | Tabel dokumen read-only ditulis tangan tujuh kali di empat berkas | **3** — bagian `Table` |

Usulan saya sebelumnya menaruh L-3b di Fase 2; **penugasan brief yang berlaku.**

---

## 2. Rekonsiliasi token (ADR-003)

### Peta, diukur di lapis semantik

39 token Design Spec §1.1–§1.6 versus `docs/tokens.json`:

| | Jumlah |
|---|---|
| Sudah cocok | 5 |
| Ada, nilai berbeda → **snap** | **12** |
| Belum ada → **tambah** | **22** |
| Primitif tanpa rujukan semantik → **deprecate** | **39** |

### 12 yang di-snap — nilai lama → nilai baru

| Token semantik | Lama | Baru (Design Spec) | Δ | Primitif yang dialias |
|---|---|---|---|---|
| `text-tertiary` | `#686E80` | `#7C8794` | 37,7 | `neutral.550` |
| `text-accent` | `#302B96` | `#3A34B5` | 33,8 | `indigo.700` ⚠ |
| `text-primary` | `#1C1F27` | `#0B0F14` | 30,1 | `neutral.900` ⚠ |
| `text-disabled` | `#9BA0B3` | `#A9B2BB` | 24,2 | `neutral.400` ⚠ |
| `text-secondary` | `#565C6E` | `#5B6672` | 11,9 | `neutral.600` ⚠ |
| `border-subtle` | `#F1F2F6` | `#EDEFF1` | 7,1 | `neutral.100` ⚠ |
| `bg-accent-subtle` | `#F0EFFC` | `#ECEBFA` | 6,0 | `indigo.50` |
| `border-strong` | `#CBCEDA` | `#C9CFD5` | 5,5 | `neutral.300` |
| `border-default` | `#E3E5EC` | `#E3E6E9` | 3,2 | `neutral.200` |
| `action-primary-bg-active` | `#282476` | `#262277` | 3,0 | `indigo.800` |
| `action-primary-bg-hover` | `#302B96` | `#2F2A94` | 2,4 | `indigo.700` ⚠ |
| `bg-canvas` | `#F8F9FB` | `#F7F8F9` | 2,4 | `neutral.50` |

⚠ = primitifnya melayani lebih dari satu token semantik dengan nilai berbeda. **Lima tabrakan:**

| Primitif | Melayani | Nilai yang dituntut |
|---|---|---|
| `neutral.900` | `light.text-primary`, `dark.bg-surface` | `#0B0F14` vs `#141A21` |
| `neutral.600` | `light.text-secondary`, `dark.text-disabled`, `dark.border-strong` | `#5B6672`, `#5B6672`, `#45525F` |
| `neutral.400` | `light.text-disabled`, `dark.text-secondary`, `dark.text-tertiary` | `#A9B2BB`, `#A9B2BB`, `#7C8794` |
| `neutral.100` | `light.bg-surface-sunken`, `light.border-subtle`, `dark.text-primary` | `#EDEFF1` vs `#F7F8F9` |
| `indigo.700` | `light.text-accent`, `light.action-primary-bg-hover` | `#3A34B5` vs `#2F2A94` |

Satu primitif tidak dapat memegang dua nilai. Menyetel `neutral.900` ke `#0B0F14` akan mengubah latar permukaan dark mode tanpa suara, dan `audit:kontras` tidak menangkapnya — ia menguji pasangan, bukan maksud. **Lihat Q-6; ke-12 snap tertahan di sana.**

### 22 yang ditambah — seluruhnya aditif

Triad `success` / `warning` / `danger` / `info` (`-bg-subtle`, `-border`, `-text`) · empat token `accent-ai` (`#E8A33D`, `#FDF3E3`, `#F0D3A0`, `#8A5A12` + varian dark) · `border-accent` · `bg-surface-subtle`. Repo kini hanya punya `text-danger`, `text-success`, `text-warning` — tanpa latar maupun border semantik.

Palet semantik lama yang diganti nilai Design Spec: `success-600 #157552` → `#12805C` · `danger-600 #A82929` → `#B42318` · `info-500 #1F72BD` → `#175CD3`.

### 39 yang di-deprecate — risikonya nol

Seluruh ramp `info` (11 langkah), sebagian besar `success` dan `warning`, sebagian `danger` dan `indigo` — tidak dirujuk token semantik mana pun. Dan karena tidak ada CSS yang memanggil primitif langsung, **call-site-nya nol di luar `tokens.json` sendiri.** Ditandai `@deprecated`, tidak dihapus, tiket migrasi terpisah.

---

## 2a. Hasil dua audit yang diminta

### Audit ADR-022 — aturan tabrakan primitif diterapkan pada 12 snap

| Hasil | Jumlah | Primitif |
|---|---|---|
| **Branch 2** — snap langsung | 5 | `neutral.550`, `indigo.50`, `neutral.300`, `indigo.800`, `neutral.50` — masing-masing melayani tepat satu alias, dan alias itu diatur Spec |
| **Branch 1** — primitif baru, arahkan ulang sebagian | 1 | `neutral.200` — melayani `light.border-default` (diatur, `#E3E6E9`) dan `light.action-disabled-bg` (**tidak diatur Spec**) |
| **TIDAK selesai oleh aturan** | **5** | lihat di bawah |

Aturannya menyelesaikan **7 dari 12**. Lima sisanya jatuh di luar kedua cabang, dan semuanya karena sebab yang sama: **dua atau lebih alias yang sama-sama diatur Spec menuntut nilai berbeda**, sehingga cabang "snap langsung" mustahil dan cabang "arahkan ulang hanya yang diatur" tidak menyebutkan alias mana yang menang.

| Primitif | Alias dan nilai yang dituntut Spec |
|---|---|
| `indigo.700` | `light.text-accent` → `#3A34B5` · `light.action-primary-bg-hover` → `#2F2A94` |
| `neutral.900` | `light.text-primary` → `#0B0F14` · `dark.bg-surface` → `#141A21` |
| `neutral.400` | `light.text-disabled` → `#A9B2BB` · `dark.text-secondary` → `#A9B2BB` · `dark.text-tertiary` → `#7C8794` |
| `neutral.600` | `light.text-secondary` → `#5B6672` · `dark.text-disabled` → `#5B6672` · `dark.border-strong` → `#45525F` |
| `neutral.100` | `light.bg-surface-sunken` (**tidak diatur**) · `light.border-subtle` → `#EDEFF1` · `dark.text-primary` → `#F7F8F9` |

Mekanisme ADR-022 sebenarnya cukup untuk kelimanya — buat satu primitif baru **per nilai Spec yang berbeda**, lalu arahkan ulang tiap alias ke primitifnya sendiri. Tetapi teks ADR-022 menulis "primitif baru" tunggal, dan memperluasnya menjadi jamak adalah keputusan, bukan penafsiran. **Tidak saya tebak.**

### Audit ADR-021 — call-site `--text-body-lg`

Dua call-site, dan keduanya berbeda peran.

| Call-site | Isi | Putusan |
|---|---|---|
| `shell/shell.module.css:384` | Input **command palette** | **Snap ke 15/22.** Design Spec §1.9 menyebut `15px` sebagai ukuran tambahan tepat untuk "input command palette" |
| `pages/pages.module.css:360` — `.metaValue` | Angka kunci di blok meta; `font-weight: medium` (500), `tabular-nums` | **Butuh token baru.** Design Spec tidak punya token untuk angka bertekanan. `--text-h3` (16/24) berukuran sama tetapi berbobot 600 dan bermakna judul — persis kasus yang ADR-021 larang diselesaikan dengan override weight |

**Temuan yang lebih besar dari satu token.** Design Spec §1.9 **tidak punya token bernama `--text-body-lg` sama sekali.** Skalanya: display 30/36 · h1 24/32 · h2 20/28 · h3 16/24 · body 14/20 · body-sm 13/18 · caption 12/16 · micro 11/16. Dan skala heading repo tergeser satu langkah terhadapnya:

| Design Spec | Repo | Cocok? |
|---|---|---|
| `display` 30/36 | `heading-1` 30/36 | nama berbeda, nilai sama |
| `h1` 24/32 | `heading-2` 24/30 | line-height berbeda |
| `h2` 20/28 | `heading-3` 20/26 | line-height berbeda |
| `h3` 16/24 | `heading-4` 16/22 · `body-lg` 16/24 | `body-lg` yang cocok, bukan `heading-4` |
| `body` 14/20 · `body-sm` 13/18 · `caption` 12/16 · `micro` 11/16 | `body` · `body-sm` · `caption` · `overline` | cocok |

Empat token teks terkecil sudah sejalan; seluruh skala heading tidak. Ini bukan lingkup yang tertulis di Fase 1 dan saya tidak memperluasnya sendiri — dicatat sebagai Q-8.

---

## 3. Gap terhadap brief, per fase

### Fase 1 — Rekonsiliasi fondasi

| Butir brief | Kondisi | Yang kurang |
|---|---|---|
| Rekonsiliasi `tokens.json` | — | 12 snap (tertahan Q-6) · 22 tambah · 39 deprecate |
| Kalimat sumber kebenaran `CLAUDE.md` | **Selesai** (`a57f7c6`) | — |
| Kelompok `z` | 10 kunci ada, **urutannya sudah benar** | ADR-007 direvisi: popover memang di atas modal. Repo tidak diubah. Sisa: tidak ada `sticky-row`/`sticky-col` terpisah, `chrome`, `system-banner` |
| `dataviz` | 8 seri ada | ADR-026: pertahankan 8, **jangan potong ke 6**. Sisa: verifikasi keamanan CVD dan laporkan |
| Token motion | `ease.enter` dan `ease.exit` **sudah ada** | Durasi 80/120/180 ms (repo: 0/100/160/240/320) |
| `--text-body-lg` 15/22 | Ada, tetapi **16/24** · dua call-site | **Audit selesai** — lihat §3a. Satu call-site di-snap ke 15/22, satu butuh token baru |
| `lib/format` | `angka`, `uang`, `akuntansi` (**kurung negatif sudah**), `tanggal`, `tanggalPendek`, `bulanTahun`, `periodeFiskal`; 4 berkas uji | Nomor dokumen `INV/YYYY/MM/NNNNN` · rupiah singkat (`Rp 210 jt`) · persen koma 1 desimal · minus U+2212 mode form · timestamp relatif 5 ember. Lokasinya `src/interface/web/i18n/format.ts`, bukan `lib/format` |
| Registry ikon + `Logo` | **Tidak ada** | Keduanya. `@tabler/icons-react` dipakai langsung per berkas |
| Enum tiga sumbu status | `DOCUMENT_STATUS` + `STATUS_TONE` | `labelShort`, `icon`, dan **kedua sumbu lain** — L-1 dan L-2 |
| Gerbang CI pemblokir | stylelint (5 aturan, *error*) · `tsc` strict · `check:i18n` · `audit:kontras` — semuanya sudah di `npm run lint` | `eslint-plugin-boundaries` · `jsx-a11y` · ambang coverage |

### Fase 2 — Primitives

Ada: `Button` (5 varian + prop `icon`), `TextField`, `CurrencyInput`, `Select`, `Combobox`, `Checkbox`, `Radio`, `Switch`, `TextArea`, `Badge`/`StatusBadge`, `Avatar`, `Tabs`, `FilterBar` (chip), `Tooltip`, `DateField`.

Kurang: **`SplitButton`, `MultiSelect`, `DateRangePicker`, `AvatarGroup`, `SegmentedControl`, `Stepper`, `ProgressBar`, `DropdownMenu`**. `Breadcrumb` ada di shell, belum sebagai komponen. `IconButton` — `Button` sudah menerima `icon`; perlu keputusan apakah itu memenuhi atau butuh komponen terpisah.

**EXIT menuntut Storybook — tidak terpasang.** Yang ada `gallery.tsx`, galeri komponen buatan sendiri. Lihat Q-7.

### Fase 3 — Data display & overlays

Ada: `DataTable` (sticky header, seleksi, `bulkActions`, paginasi kursor), `KpiCard`, `SkeletonText`, `ToastProvider`, `BarChart`, `AgeingChart`, `LineItemEditor`.

Kurang: **`StatSummaryRow`, `Card`, `EmptyState`, `InlineAlert`, `Banner`, `Modal`, `Drawer`, `SidePanel`**. `BulkActionBar` dan `Pagination` sudah ada di dalam `DataTable` tetapi belum dipakai satu halaman pun. **Virtualisasi >100 baris tidak ada** — EXIT "10.000 baris tetap 60fps" belum mungkin dipenuhi. L-4 (tujuh tabel tangan) diselesaikan di sini.

**Lingkup berkurang.** Penukaran urutan `z` dicoret — ADR-007 direvisi dan urutan repo sudah benar.

### Fase 4 — App Shell

Ada: `AppShell` (rail + drawer responsif), `CommandPalette`, `CompanySwitcher`, breadcrumb, notifikasi, menu pengguna.

Kurang: sidebar 248/56 dengan collapse, `NavGroup`, badge angka, item AI amber, shortcut `G`+`S`, empat kelompok berurutan di palette.

**EXIT sudah separuh terpenuhi.** `tests/integration/kebocoran-company.test.ts` sudah ada; perlu diperiksa apakah ia menutupi "ganti company tanpa kebocoran cache lintas company" atau hanya isolasi API.

### Fase 5 — Screens

Ada: Faktur Penjualan (daftar + detail + baru), dan pola daftar/detail yang konsisten di empat modul.

Kurang: **Onboarding, Pengaturan, Paadu AI Panel, System States** — nol. Business Overview ada tetapi 4 blok dari 10 (lihat perbandingan §3.4). `ListPageTemplate` dan `DocumentPageTemplate` belum diekstrak. **EXIT visual diff ≤0,1% — tidak ada tooling** (tidak ada Playwright).

### Fase 6 — State yang belum terdesain

16 state (§5.2) dan 9 overlay (§5.3). Sebagian sudah ada per layar: memuat, galat, kosong-karena-filter. Kurang: 403/404/500/offline/trial/suspended, konflik edit bersamaan, dan seluruh sembilan overlay.

### Fase 7 — Hardening & ship

Ada: `audit:kontras`, `axe-core` di uji UI, deploy dengan pemberitahuan versi.

Kurang: baseline visual regression, budget performa, `/design-system` yang di-generate, preview deploy per PR, env per region, feature flag per tenant.

---

## 4. Urutan, estimasi, dependensi

| Fase | Estimasi | Bergantung pada | Catatan |
|---|---|---|---|
| 1 | 4–6 hari | **Q-6** untuk 12 snap; 22 tambah dan 39 deprecate jalan tanpa menunggu | `lib/format` dan registry ikon porsi terbesar |
| 2 | 5–7 hari | Fase 1 (warna semantik, enum status) · **Q-7** untuk Storybook | 8 komponen baru |
| 3 | 6–8 hari | Fase 2 (`DropdownMenu` untuk aksi baris) | Virtualisasi tabel adalah risiko terbesar |
| 4 | 3–4 hari | Fase 2, Fase 3 (`Drawer`) | Sebagian besar sudah ada |
| 5 | 8–12 hari | Fase 1–4 · **Q-4** (bahasa copy) | Empat layar dari nol |
| 6 | 3–5 hari | Fase 3 (`EmptyState`, `Modal`) | — |
| 7 | 4–6 hari | Seluruhnya | Butuh tooling baru |

Total kasar **33–48 hari** untuk satu orang, tanpa perubahan skema. Fase 5 estimasinya paling lemah karena empat layar belum pernah ada bentuknya di repo.

---

## 5. Risiko teknis

| # | Risiko | Mitigasi |
|---|---|---|
| R-1 | **Ramp primitif tidak dapat mengekspresikan nilai Design Spec.** Lima tabrakan; snap di lapis primitif mengubah token lain tanpa suara | Q-6 diputuskan sebelum Fase 1 menyentuh nilai. Sementara itu kerjakan 22 tambah + 39 deprecate |
| R-2 | ~~Urutan `z` bertentangan~~ — **ditutup.** ADR-007 direvisi; urutan repo yang benar, brief yang salah | — |
| R-3 | **EXIT Fase 3 "10.000 baris 60fps" menuntut virtualisasi**, yang mengubah kontrak `DataTable` — sticky, seleksi, dan footer total semuanya bergantung pada baris yang benar-benar ter-render | Prototipe virtualisasi lebih dulu di Fase 3 sebelum menyentuh halaman mana pun |
| R-4 | **Audit kontras batal diam-diam** saat nilai semantik berubah | Satu kelompok warna per commit. `audit:kontras` sudah bagian `npm run lint` |
| R-5 | **`.dc.html` diperlakukan sebagai kode**, membawa 75 hex mentah ke repo | `design-refs/README.md` sudah melarang. Tambah pemeriksaan yang menolak impor dari `design-refs/` — berlaku juga untuk `tokens-from-design-spec.css` bila kelak ada |
| R-6 | **Dua EXIT menuntut tooling yang belum ada**: Storybook (Fase 2) dan visual diff (Fase 5, 7) | Putuskan di Q-7 sebelum Fase 2 dimulai; pengadaan tooling masuk estimasi fase itu |
| R-7 | **Density belum bertoken penuh** (`Design_Tokens.md` §12) | Tidak memblokir Fase 1–4. Wajib sebelum POS. Lihat Q-5 |

---

## 6. Pertanyaan

### Terjawab

| # | Jawaban |
|---|---|
| Q-1 · sumber kebenaran token | **ADR-003** — `tokens.json` untuk BUILD, Design Spec §1 untuk NILAI. Diterapkan di `a57f7c6` |
| Q-2 · keberadaan brief | Disusun bertahap di repo. §8 sudah ada |
| Q-3 · nilai Flow Amber | **ADR-003** — `#E8A33D`, `#FDF3E3`, `#F0D3A0`, `#8A5A12` + varian dark |
| — · i18n, `z`, `dataviz` | **ADR-006 / 007 / 012** — repo yang menang; tugasnya **verifikasi cakupan**, bukan bangun ulang |
| Q-4 · bahasa | **ADR-023** — id-ID locale sumber. "Dasbor" tetap. `Overdue` → "Jatuh Tempo" (ADR-011). Beda **makna** → berhenti dan lapor |
| Q-5 · density | **ADR-024** — mekanisme `data-density` di Fase 1; skala paralel penuh tidak dibangun |
| Q-7 · permukaan design system | **ADR-025** — `gallery.tsx` dinaikkan jadi `/design-system`. Storybook tidak dipasang |
| K-1 · urutan `z` | **ADR-007 (revisi)** — popover di atas modal. Repo tidak diubah; lingkup Fase 3 berkurang |

### Masih terbuka

| # | Pertanyaan | Memblokir |
|---|---|---|
| **Q-6a** | Lima tabrakan yang tidak selesai oleh ADR-022 (§2a). Boleh dibuat **satu primitif baru per nilai Spec yang berbeda** lalu tiap alias diarahkan ke primitifnya sendiri — atau tiap kasus diputuskan terpisah? | 5 dari 12 snap di Fase 1 |
| **Q-8** | Skala heading repo tergeser satu langkah terhadap Design Spec §1.9 (§2a). Diselaraskan di Fase 1, atau di luar lingkup dan menunggu tiket sendiri? | Lingkup Fase 1 dan Fase 5 |

Q-4, Q-5, dan Q-7 terjawab di ADR-023, ADR-024, dan ADR-025.

---|---|---|
| **Q-4** | Copy Inggris di sepuluh screen Design Spec (`Business Overview`, `Overdue`) mengikat, atau contoh? Brief §8 Fase 5 berkata "copy verbatim dari Design Spec §3, masuk sebagai kunci i18n" — verbatim dalam bahasa apa? Judul dasbor di repo kini "Dasbor" | Fase 5 |
| **Q-5** | Varian `space`/`size` per density masuk Fase 1, atau menunggu POS? | Lingkup Fase 1 |
| **Q-6** | Ramp primitif diturunkan ulang dari nilai Design Spec — tiga lapis utuh, mengubah setiap layar — atau semantik boleh memegang hex langsung saat tidak ada primitif yang cocok, melanggar `Design_Tokens.md` §1? | 12 snap di Fase 1 |
| **Q-7** | Storybook dipasang (EXIT Fase 2), atau `gallery.tsx` yang sudah ada dinaikkan menjadi permukaan itu? Brief Fase 7 juga menuntut `/design-system` di-generate dari komponen React nyata — keduanya mungkin permukaan yang sama | Fase 2 |

---

*Fase 0. Berkas yang berubah: `CLAUDE.md` (instruksi eksplisit, tugas Fase 1 dikerjakan lebih awal) dan dua dokumen di `docs/`.*
