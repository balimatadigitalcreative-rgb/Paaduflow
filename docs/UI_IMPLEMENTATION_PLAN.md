# Rencana Implementasi UI

**Fase 0 — Discovery.** Selain `CLAUDE.md` (perbaikan kalimat sumber kebenaran, diminta eksplisit), tidak ada berkas produksi yang diubah untuk menghasilkan dokumen ini.

> **Dua bagian masih TERBLOKIR, dan hanya oleh satu hal.**
>
> `docs/UI_IMPLEMENTATION_BRIEF.md` tidak ada di repo. Diperiksa tiga kali:
> nama berkas, isi (`grep -rl "ADR-003"` atas seluruh `.md`/`.css`), berkas yang
> berubah tiga jam terakhir, dan satu level di atas akar repo. Nol hasil.
> `design-refs/tokens-from-design-spec.css` juga tidak ada.
>
> Kebijakan token sudah dapat dikerjakan — isinya diringkas langsung di pesan
> penugasan dan nilainya ada di Design Spec §1 yang memang ada di repo.
> Yang tetap tidak dapat ditulis adalah **daftar fase**: §4 (gap per fase) dan
> §5 (urutan Fase 1–7) menuntut definisi fase yang hanya ada di brief.
> §5 karena itu berisi **usulan saya**, ditandai sebagai usulan, bukan kutipan.

---

## 1. Berkas rujukan — status

| Berkas | Status |
|---|---|
| `docs/UI_IMPLEMENTATION_BRIEF.md` v1.1 | **Tidak ada** |
| `design-refs/tokens-from-design-spec.css` | **Tidak ada** |
| `design-refs/Paadu Flow Design Spec.md` | Ada — 79.976 bytes, dibaca utuh. §1 dipakai sebagai sumber nilai |
| `design-refs/*.dc.html` | Ada — 10 berkas, dibaca sebagai HTML/CSS |
| `CLAUDE.md`, `docs/Design_Tokens.md`, `docs/Logo_System.md` | Ada |
| `src/interface/web/**`, `package.json`, `tsconfig.json` | Ada |

**Yang sudah diputuskan dan sudah diterapkan:** kalimat sumber kebenaran di `CLAUDE.md` diperbaiki sesuai ADR-003 — `docs/tokens.json` untuk BUILD, Design Spec §1 untuk NILAI, `src/styles/tokens.css` dibangkitkan dan tidak pernah diedit tangan.

---

## 2. Inventaris `src/interface/web`

### Stack

React 19.2 · TypeScript 5.7 (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) · Vite 7.3 · i18next 26 + react-i18next 17 · Tabler Icons · Style Dictionary 5.5 · Vitest 3 (proyek `unit`/`db`/`ui`). Tanpa framework CSS — empat CSS Module plus `tokens.css` yang dibangkitkan.

### Isi

37 ekspor komponen · 19 layar di 7 berkas · 8 ekspor shell.

**Disiplin yang terbukti dipegang.** Enam dari tujuh daftar memakai `DataTable` + `useTabel`, lengkap dengan paginasi kursor, seleksi baris, dan `bulkActions`. Empat layar detail memakai `useHeaderHalaman` + `Tabs` dengan id identik dalam urutan Flow_Archetypes §1. i18n penuh dengan gerbang CI. Dan — diverifikasi ulang untuk dokumen ini — **tidak ada satu pun CSS yang memanggil token primitif langsung**; seluruhnya lewat token semantik. Model tiga lapis di `Design_Tokens.md` §1 bukan sekadar tertulis, ia benar-benar dipatuhi.

### Empat blocker komponen

| # | Temuan | Ditempatkan di |
|---|---|---|
| **L-1** | `StatusBadge` tertutup pada tipe `DocumentStatus`. Modul dengan kosakata status sendiri tidak punya tempat mendaftarkannya — `pajak.tsx` memakai 10 `<Badge>` mentah dan nol `StatusBadge` | Fase 2 |
| **L-2** | `settlement_status` dan `fulfillment_status` tanpa komponen. Digambar sekali di `penjualan.tsx:285–294` dengan ternary yang meruntuhkan 5 nilai menjadi 2 warna — `partially_paid`, `overpaid`, `written_off` tidak dapat dibedakan dari `unpaid` | Fase 2 |
| **L-3** | Tidak ada `Modal`, `DropdownMenu`, `EmptyState`, `InlineAlert`. Dua terakhir kini kelas CSS (`styles.notice`, `styles.card`) yang disalin di lima berkas halaman | `EmptyState`/`InlineAlert` → Fase 2 · `Modal`/`DropdownMenu` → Fase 3 |
| **L-4** | Tabel dokumen read-only ditulis tangan tujuh kali di empat berkas. Spec menamai tiga komponen untuk ini; yang ada hanya `LineItemEditor`, untuk kasus yang dapat diedit | Fase 4 |

---

## 3. Rekonsiliasi token

### Kebijakan (ADR-003, sebagaimana diringkas di penugasan)

Δ≤12 → snap ke nilai Design Spec, bukan titik tengah · tanpa padanan → tambahkan · palet semantik lama (`success-600 #157552`, `danger-600 #A82929`, `info-500 #1F72BD`) adalah sisa sebelum rebrand, diganti nilai Design Spec · token repo yang tidak ada di Design Spec **jangan dihapus** — tandai `@deprecated`, catat call-site, tiket terpisah · `npm run audit:kontras` wajib hijau kecuali `--text-tertiary` (3,51:1) dan `--text-disabled` (2,11:1), keduanya sudah beralasan di Design Spec §1.4.

### Peta sebenarnya — diukur di lapis semantik

Angka 75-vs-81 di versi sebelumnya membandingkan hex design terhadap **semua** token termasuk primitif. Itu framing yang salah. Dipetakan per token semantik, ke-39 token Design Spec §1.1–§1.6 jatuh begini:

| | Jumlah |
|---|---|
| Sudah cocok, tidak perlu disentuh | 5 |
| Ada, nilainya berbeda → snap | **12** |
| Belum ada sama sekali → tambahkan | **22** |

**22 yang belum ada** — seluruhnya aditif, tidak mengubah satu pun nilai yang sudah dipakai: triad lengkap `success` / `warning` / `danger` / `info` (`-bg-subtle`, `-border`, `-text`), keempat token `accent-ai` (Flow Amber), `border-accent`, dan `bg-surface-subtle`. Repo saat ini hanya punya `text-danger`, `text-success`, `text-warning` — tanpa latar maupun border semantik sama sekali.

### Hambatan pada 12 yang harus di-snap

Token semantik meng-alias primitif (`text-secondary` → `{neutral.600}`). Mengubah nilai berarti mengubah primitifnya — dan beberapa primitif melayani semantik yang Design Spec beri nilai **berbeda**:

| Primitif | Melayani | Nilai yang dituntut Design Spec |
|---|---|---|
| `neutral.900` | `light.text-primary`, `dark.bg-surface` | `#0B0F14` vs `#141A21` |
| `neutral.600` | `light.text-secondary`, `dark.text-disabled`, `dark.border-strong` | `#5B6672`, `#5B6672`, `#45525F` |
| `neutral.400` | `light.text-disabled`, `dark.text-secondary`, `dark.text-tertiary` | `#A9B2BB`, `#A9B2BB`, `#7C8794` |
| `neutral.100` | `light.bg-surface-sunken`, `light.border-subtle`, `dark.text-primary` | `#EDEFF1` vs `#F7F8F9` |
| `indigo.700` | `light.text-accent`, `light.action-primary-bg-hover` | `#3A34B5` vs `#2F2A94` |

Satu primitif tidak dapat memegang dua nilai. **Menyetel `neutral.900` ke `#0B0F14` akan diam-diam mengubah latar permukaan dark mode**, dan `audit:kontras` tidak akan menangkapnya — ia menguji pasangan, bukan maksud. Ramp yang ada karena itu **tidak dapat mengekspresikan nilai Design Spec tanpa diturunkan ulang.** Lihat Q-6.

### Deprecation — risikonya rendah, dan itu terukur

39 dari 76 token warna primitif tidak dirujuk token semantik mana pun: seluruh ramp `info` (11 langkah), sebagian besar `success` dan `warning`, sebagian `danger` dan `indigo`. Dan karena tidak ada CSS yang memanggil primitif langsung, **call-site-nya nol di luar `tokens.json` sendiri**. Menandainya `@deprecated` tidak menyentuh satu baris kode pun.

---

## 4. Gap terhadap `UI_IMPLEMENTATION_BRIEF.md`, per fase

**TERBLOKIR.** Brief tidak ada di repo, sehingga tidak ada daftar fase untuk dibandingkan. Yang dibutuhkan untuk membuka bagian ini hanya satu: **daftar Fase 1–7 beserta lingkup masing-masing.** Sisanya sudah terkumpul di §2 dan §3.

---

## 5. Urutan Fase 1–7 — **USULAN, bukan kutipan brief**

Ditandai tegas karena penomoran fase di brief belum pernah saya lihat. Bila brief punya pembagian lain, yang berlaku brief; isi tabel ini tinggal dipindahkan.

| Fase | Lingkup | Blocker yang ditutup | Bergantung pada | Estimasi |
|---|---|---|---|---|
| **1** | Fondasi token. 22 penambahan, 12 snap, 39 penandaan `@deprecated`, `audit:kontras` hijau | — | Q-6 untuk bagian snap; 22 penambahan tidak menunggu apa pun | 1–2 hari |
| **2** | Status & umpan balik. `StatusBadge` dibuka untuk kosakata milik modul, sumbu pelunasan dan pemenuhan, `EmptyState` + `InlineAlert` sebagai komponen | **L-1, L-2**, sebagian **L-3** | Fase 1 untuk warna semantik triad | 2–3 hari |
| **3** | Overlay. `Modal` (termasuk varian destruktif berkonfirmasi ketik) dan `DropdownMenu` | sisa **L-3** | Fase 1 (`shadow-lg`, `bg-surface-raised`) | 1,5–2 hari |
| **4** | Tabel dokumen bersama — `DocumentTable`, `JournalTable`, `DocumentTotals` menggantikan tujuh salinan tangan | **L-4** | Fase 2 (status di baris) dan Fase 3 (aksi per baris) | 2–3 hari |
| **5** | Kelengkapan shell terhadap Design Spec §3.3 — `SplitButton` Buat, badge tahun fiskal, nav grup yang belum ada | — | Fase 3 (`DropdownMenu`) | 2 hari |
| **6** | Layar terhadap Design Spec §3.4–§3.6 — dasbor, daftar faktur, detail faktur | — | Fase 1–4 | 4–6 hari |
| **7** | State sistem Design Spec §3.10, dan **verifikasi cakupan** ADR-006 / ADR-007 / ADR-012 (i18next, kelompok `z`, `dataviz`) — memverifikasi, bukan membangun; ketiganya sudah ada di repo | — | Fase 2 (`EmptyState`) | 2–3 hari |

Total kasar 15–21 hari untuk satu orang, tanpa perubahan skema.

**Alasan urutannya.** Fase 1 mendahului segalanya karena Fase 2 menuntut warna semantik yang belum ada. Fase 2 mendahului Fase 4 karena tabel dokumen menampilkan status di setiap baris — membangunnya lebih dulu berarti menulis peta warna sementara, lalu membuangnya. Fase 3 mendahului Fase 5 karena `SplitButton` dan menu shell keduanya memakai `DropdownMenu`.

---

## 6. Risiko teknis

| # | Risiko | Mitigasi |
|---|---|---|
| R-1 | **Ramp primitif tidak dapat mengekspresikan nilai Design Spec.** Lima primitif melayani semantik dengan nilai berbeda; snap di lapis primitif akan mengubah token lain tanpa suara | Q-6 diputuskan sebelum Fase 1 dimulai. Sampai itu, kerjakan 22 penambahan saja |
| R-2 | **Audit kontras batal diam-diam.** Mengganti nilai semantik membatalkan 32 pasangan yang kini lolos AA | `npm run audit:kontras` sudah bagian dari `npm run lint`. Satu kelompok warna per commit, bukan satu commit besar |
| R-3 | **Komponen status tertutup menyebar sebelum diperbaiki.** POS, HRIS, dan Project masing-masing akan menulis peta warna sendiri | Fase 2 selesai sebelum modul baru mana pun dimulai |
| R-4 | **`.dc.html` diperlakukan sebagai kode**, membawa 75 hex mentah ke repo | `design-refs/README.md` sudah melarangnya; tambahkan pemeriksaan yang menolak impor dari `design-refs/`. Berlaku juga untuk `tokens-from-design-spec.css` — input, bukan sumber |
| R-5 | **Density belum bertoken penuh.** `Design_Tokens.md` §12 mencatatnya sendiri | Tidak memblokir Fase 1–4. Wajib selesai sebelum POS |
| R-6 | **Estimasi Fase 5–7 lemah** karena lingkupnya diturunkan dari Design Spec, bukan dari brief | Perbarui begitu daftar fase yang sebenarnya tersedia |

---

## 7. Pertanyaan

### Terjawab

| # | Pertanyaan | Jawaban |
|---|---|---|
| Q-1 | Sumber kebenaran token | **ADR-003.** `tokens.json` untuk BUILD, Design Spec §1 untuk NILAI. Sudah diterapkan di `CLAUDE.md` |
| Q-2 | Apakah brief pernah ada | Ada di v1.1 menurut penugasan, tetapi **belum sampai ke repo** |
| Q-3 | Nilai Flow Amber | **ADR-003.** `#E8A33D`, `#FDF3E3`, `#F0D3A0`, `#8A5A12` + varian dark, sesuai Design Spec §1.6. Lapis penempatannya masih Q-6 |
| — | i18next, kelompok `z`, `dataviz` | **ADR-006 / ADR-007 / ADR-012** — "verifikasi cakupan", bukan "bangun". Repo yang menang; Design Spec §5.4 ditulis sebelum pekerjaan itu ada |

### Masih terbuka

| # | Pertanyaan | Memblokir |
|---|---|---|
| **Q-4** | Copy Inggris di sepuluh screen Design Spec (`Business Overview`, `Overdue`) mengikat, atau contoh? Repo seluruhnya Bahasa Indonesia dengan terjemahan Inggris, dan judul dasbor kini "Dasbor" | Fase 6 |
| **Q-5** | Density `comfortable` menuntut varian `space` dan `size` yang belum ada tokennya. Ditambahkan di Fase 1, atau menunggu POS? | Lingkup Fase 1 |
| **Q-6** | Ramp primitif diturunkan ulang dari nilai Design Spec — model tiga lapis utuh, mengubah setiap layar — atau token semantik boleh memegang hex langsung saat tidak ada primitif yang cocok, yang melanggar `Design_Tokens.md` §1? | 12 snap di Fase 1 |

Ketiganya kemungkinan sudah dijawab di brief. Q-6 lahir setelah pemetaan lapis semantik dan mungkin belum tercakup di sana.

---

*Fase 0. Berkas produksi yang berubah: `CLAUDE.md` saja, sesuai instruksi eksplisit.*
