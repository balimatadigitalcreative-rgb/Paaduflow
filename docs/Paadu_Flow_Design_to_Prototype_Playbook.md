# Paadu Flow — Design to Prototype Playbook
### Roadmap fase desain (brand → design system → UX → prototype) + prompt siap pakai untuk Claude Design

*Disusun sebagai turunan dari Business OS Knowledge Base & Continuity Brief. Setiap fase punya deliverable yang menjadi input fase berikutnya — jangan lompat fase, karena setiap output adalah dependency root untuk output setelahnya (prinsip yang sama dengan Module 01).*

---

## Cara Pakai Dokumen Ini

1. Kerjakan fase secara berurutan. Fase 0 → 8.
2. Setiap step punya **Prompt** dalam blok kode. Copy-paste apa adanya ke Claude Design (atau chat biasa untuk step non-visual).
3. **Selalu tempelkan `MASTER CONTEXT BLOCK` di bawah ini di awal setiap sesi Claude Design baru.** Claude Design tidak otomatis membawa knowledge base project ini.
4. Setelah tiap step selesai, simpan output-nya sebagai file `.md` di project — output itu jadi input step berikutnya.

---

## MASTER CONTEXT BLOCK
*Tempel ini di awal SETIAP sesi Claude Design, sebelum prompt step manapun.*

```
=== KONTEKS PRODUK — JANGAN DIUBAH ===

PRODUK: Paadu Flow — Business Operating System (Business OS)
TAGLINE: One Platform. Every Business.
FILOSOFI NAMA: dari kata Bahasa Indonesia "padu" (bersatu, kohesif, terpadu) —
  menyatukan seluruh proses bisnis ke dalam satu ekosistem terpadu.
LOGO MARK (final): "Anyaman Alur" (Woven Flow) — dua untaian saling menganyam,
  bertemu dan menyatu di satu titik. Makna: banyak proses bisnis menyatu jadi satu alur.

POSITIONING: Platform enterprise modern yang menjadi sistem operasi bisnis —
  modular, cloud-native, AI-native, API-first, event-driven, multi-tenant, multi-company.
  Bukan sekadar ERP. Single Source of Truth untuk seluruh operasional organisasi.

TARGET USER: individu → UMKM → enterprise/multinasional dengan banyak entitas legal.

DOMAIN MODUL: Finance & Accounting, Sales & CRM, Inventory, Purchasing,
  Manufacturing, HR, POS, Tax, Project, AI Assistant.

DESIGN PHILOSOPHY: Modern, Minimal, Enterprise, Fast, Clean.
REFERENSI RASA (bukan untuk ditiru persis): Linear, Stripe, Notion, Vercel, Apple.

PRINSIP UX WAJIB:
- Maksimal 3 klik untuk tugas umum
- Konsisten di seluruh modul
- Keyboard friendly (command palette, shortcut)
- Accessibility WCAG 2.1 AA minimum
- Responsive (desktop-first, tapi mobile harus fungsional)
- Dark mode wajib, bukan opsional

ATURAN KOMPONEN:
- Semua komponen harus reusable
- Dilarang membuat komponen baru jika yang lama masih bisa dipakai
- Design System adalah SATU-SATUNYA sumber komponen UI

URUTAN PRIORITAS KEPUTUSAN (jika ada trade-off, ikuti urutan ini dan jelaskan trade-off-nya):
Security > Data Integrity > Scalability > Maintainability > Performance >
Developer Experience > User Experience > Cost Efficiency

ATURAN MUTLAK:
- Dilarang menghasilkan solusi sementara, shortcut, atau yang "sekadar berfungsi".
- Asumsikan produk ini tumbuh 20 tahun, jutaan user, ribuan organisasi.
- Setiap keputusan desain harus punya rasional yang bisa dipertahankan.

=== AKHIR KONTEKS ===
```

---

# FASE 0 — Brand Foundation Lock
*Menutup item yang masih terbuka di Continuity Brief sebelum masuk desain visual. Jangan investasi waktu di identitas visual sebelum nama aman secara legal.*

### Step 0.1 — Trademark & Domain Clearance
**Tujuan:** memastikan "Paadu Flow" aman dipakai jangka panjang.
**Deliverable:** `Brand_Clearance_Report.md`
**Catatan:** jalankan di chat biasa (butuh web search), bukan Claude Design.

```
Lakukan pre-clearance check untuk nama produk "Paadu Flow" (kategori: B2B SaaS /
enterprise business software). Ini pengecekan awal, BUKAN pengganti trademark attorney.

Kerjakan dan laporkan:
1. Web search konflik nama: "Paadu Flow", "Paadu", "PaaduFlow", "Padu Flow" —
   khususnya di kategori software, SaaS, ERP, fintech.
2. Cek nama yang secara fonetik mirip dan berpotensi menimbulkan confusion.
3. Cek makna/konotasi kata "paadu" di bahasa lain (Tamil, Finnish, Estonian, dll)
   yang bisa jadi masalah di pasar internasional.
4. Ketersediaan domain: paaduflow.com, paadu.com, paadu.io, paadu.app,
   getpaadu.com, paaduflow.id, paadu.co.id — plus rekomendasi domain fallback.
5. Ketersediaan handle sosial: X/Twitter, LinkedIn, Instagram, GitHub, npm org.
6. Kelas trademark Nice Classification yang relevan (kemungkinan besar Class 9 & 42)
   dan langkah resmi berikutnya di USPTO TESS, EUIPO, WIPO Global Brand Database,
   dan DJKI (Indonesia).

OUTPUT: tabel temuan + level risiko (Rendah/Sedang/Tinggi) per temuan +
rekomendasi GO / GO-WITH-CAUTION / STOP, dengan alasan eksplisit.
Jangan menyimpulkan lebih kuat dari bukti yang ada; nyatakan mana yang belum terverifikasi.
```

### Step 0.2 — Brand Strategy & Messaging Foundation
**Tujuan:** menetapkan apa yang dikomunikasikan brand, sebelum menentukan tampilannya.
**Deliverable:** `Brand_Strategy.md`

```
[TEMPEL MASTER CONTEXT BLOCK DI SINI]

Bertindaklah sebagai Brand Strategist senior untuk produk B2B SaaS enterprise.
Susun Brand Strategy Foundation untuk Paadu Flow.

Hasilkan:
1. BRAND POSITIONING STATEMENT (format: Untuk [target], yang [kebutuhan],
   Paadu Flow adalah [kategori] yang [benefit utama]. Berbeda dari [alternatif],
   kami [pembeda]). Buat 3 varian, lalu rekomendasikan 1 terkuat dengan alasan.
2. BRAND PILLARS — 4-5 pilar, masing-masing dengan definisi 1 kalimat dan
   implikasi konkretnya ke keputusan produk & desain.
3. BRAND PERSONALITY — 5 atribut, masing-masing dengan pasangan "kami X, bukan Y"
   (contoh: "Tegas, bukan kaku").
4. TONE OF VOICE — prinsip penulisan + tabel do/don't + contoh nyata untuk:
   headline marketing, empty state, error message, konfirmasi destruktif,
   notifikasi sukses, dan copy AI assistant.
5. MESSAGING HIERARCHY — satu core message, tiga supporting message,
   dan versi per segmen (individu, UMKM, enterprise).
6. NAMING CONVENTION INTERNAL — aturan penamaan modul, fitur, dan plan/tier
   agar konsisten selama 20 tahun (mis. apakah modul dinamai fungsional
   "Finance" atau brand-y "Paadu Ledger"). Rekomendasikan satu pendekatan
   dan jelaskan trade-off-nya.

Tulis dalam Bahasa Indonesia. Setiap rekomendasi wajib disertai rasional.
```

---

# FASE 1 — Brand Identity System
*Menerjemahkan strategi jadi aset visual. Fase pertama yang dikerjakan di Claude Design.*

### Step 1.1 — Logo System "Anyaman Alur"
**Deliverable:** SVG logo mark, wordmark, lockup, app icon, favicon.

```
[TEMPEL MASTER CONTEXT BLOCK DI SINI]

Bertindaklah sebagai Senior Brand Designer. Rancang sistem logo lengkap untuk Paadu Flow
berdasarkan konsep mark yang SUDAH FINAL: "Anyaman Alur" (Woven Flow) — dua untaian
saling menganyam yang bertemu dan menyatu di satu titik.

Buat sebagai SVG, semua dengan geometri presisi (grid-based, bukan freehand):

A. LOGO MARK
   Buat 4 eksplorasi berbeda dari konsep anyaman yang sama:
   1. Continuous stroke — satu garis yang menganyam dan menyatu
   2. Two-strand ribbon — dua bidang pita dengan over/under yang jelas
   3. Geometric grid-based — dibangun dari lingkaran & sudut 45°, presisi matematis
   4. Negative-space — anyaman terbentuk dari ruang kosong
   Untuk tiap eksplorasi: tampilkan di ukuran 128px, 48px, 24px, dan 16px
   berdampingan untuk membuktikan legibility di ukuran kecil.

B. WORDMARK
   "Paadu Flow" — eksplorasi 3 pendekatan tipografi (geometric sans, grotesque,
   humanist sans). Perhatikan double-a di "Paadu" sebagai peluang detail khas.

C. LOCKUP
   Horizontal (mark + wordmark), vertical/stacked, dan mark-only.
   Definisikan clear space dalam satuan relatif (mis. x = tinggi mark).

D. APP ICON & FAVICON
   Versi 512px (rounded square, dengan padding aman) dan 16px (paling
   disederhanakan, tetap terbaca).

E. VARIAN TEKNIS
   Monochrome hitam, monochrome putih (untuk background gelap),
   dan single-color untuk keperluan cetak 1 warna.

ATURAN:
- Mark harus tetap terbaca di 16x16px. Kalau tidak, sederhanakan.
- Stroke weight konsisten, optical alignment diperhatikan.
- Tanpa gradien pada versi utama (gradien hanya boleh sebagai varian ekspresif terpisah).
- Jangan gunakan clipart, emoji, atau bentuk generik.

Setelah menampilkan semua opsi, rekomendasikan SATU direction terkuat
dengan alasan berbasis: memorability, scalability, distinctiveness,
dan kecocokan dengan filosofi "padu".
```

### Step 1.2 — Color System
**Deliverable:** `Color_System.md` + palette visual.

```
[TEMPEL MASTER CONTEXT BLOCK DI SINI]

Bertindaklah sebagai Design Systems Engineer. Rancang color system produksi untuk
Paadu Flow — aplikasi enterprise dengan tampilan data padat, dipakai 8 jam sehari.

Hasilkan color system 2 lapis:

LAPIS 1 — PRIMITIVE SCALE (raw values, tidak dipakai langsung di UI)
- Brand/primary: skala 50-950 (11 langkah)
- Neutral/gray: skala 50-950 — INI YANG PALING PENTING untuk aplikasi enterprise,
  desain dengan hati-hati agar tidak terasa "murah" atau terlalu kontras
- Semantic: success, warning, danger, info — masing-masing skala 50-950
- Data-viz: 8 warna kategorikal yang tetap dapat dibedakan oleh penderita
  deuteranopia & protanopia, plus 1 skala sequential dan 1 diverging

LAPIS 2 — SEMANTIC TOKEN (yang dipakai komponen)
Definisikan token dengan penamaan bermakna, masing-masing punya nilai
light mode DAN dark mode. Minimal cakup:
- background: canvas, surface, surface-raised, surface-sunken, overlay
- border: subtle, default, strong, focus
- text: primary, secondary, tertiary, disabled, inverse, link
- interactive: default, hover, active, disabled (untuk primary/secondary/ghost/danger)
- status: success/warning/danger/info × (bg, border, text, icon)

PERSYARATAN:
- Dark mode BUKAN inversi otomatis. Rancang terpisah. Hindari #000 murni;
  gunakan dark neutral yang tepat agar tidak terjadi halation pada teks.
- Setiap pasangan teks/background wajib lulus WCAG 2.1 AA (4.5:1 body, 3:1 large text
  & UI komponen). Tampilkan tabel rasio kontrasnya sebagai bukti.
- Sertakan aturan penggunaan: kapan pakai surface vs surface-raised,
  kapan warna boleh membawa makna dan kapan tidak.

OUTPUT:
1. Swatch visual semua skala (light & dark berdampingan)
2. Tabel semantic token: nama token | nilai light | nilai dark | kegunaan
3. Kode CSS custom properties siap pakai (:root dan [data-theme="dark"])
4. Tabel bukti kontras WCAG
```

### Step 1.3 — Typography System
**Deliverable:** `Typography_System.md` + spesimen visual.

```
[TEMPEL MASTER CONTEXT BLOCK DI SINI]

Bertindaklah sebagai Typographer & Design Systems Engineer.
Rancang typography system untuk Paadu Flow.

Konteks kritis: ini aplikasi enterprise dengan tabel data padat, angka finansial,
form panjang, dan laporan. Keterbacaan angka & alignment tabular adalah prioritas.

Hasilkan:
1. FONT STACK — rekomendasikan 1 typeface UI utama + 1 monospace,
   keduanya open source / bebas lisensi komersial. Sertakan 2 alternatif
   dan alasan kenapa pilihan utama menang. Wajib punya tabular figures
   dan dukungan multi-bahasa (Latin Extended minimal, untuk ekspansi regional).
2. TYPE SCALE — skala modular dengan rasio eksplisit. Definisikan token:
   display, heading-1..4, body-lg, body, body-sm, caption, overline, code.
   Untuk tiap token: font-size (rem + px), line-height, letter-spacing,
   font-weight, dan kapan dipakai.
3. NUMERIC TREATMENT — aturan khusus untuk angka: tabular-nums di semua tabel
   dan field mata uang, aturan alignment (kanan untuk angka, kiri untuk teks),
   dan format currency/tanggal multi-locale (ingat: produk ini multi-currency
   dan multi-region).
4. DENSITY MODES — definisikan mode Comfortable dan Compact (enterprise user
   sering butuh compact untuk melihat lebih banyak baris). Tunjukkan perbedaan
   line-height & spacing-nya.
5. SPESIMEN VISUAL — render contoh nyata: satu halaman detail invoice
   yang memakai semua level tipografi sekaligus, dalam light & dark mode.

OUTPUT: tabel token + kode CSS custom properties + spesimen visual.
```

### Step 1.4 — Brand Guidelines Document
**Deliverable:** `Paadu_Flow_Brand_Book.md`

```
[TEMPEL MASTER CONTEXT BLOCK DI SINI]
[LAMPIRKAN: Brand_Strategy.md, output Step 1.1, Color_System.md, Typography_System.md]

Gabungkan seluruh keputusan brand di atas menjadi satu Brand Book yang bisa
diserahkan ke desainer/agensi/vendor eksternal tanpa penjelasan tambahan.

Struktur:
1. Brand Story & filosofi nama "padu"
2. Positioning & messaging (ringkas dari Brand Strategy)
3. Logo: anatomi, varian, clear space, ukuran minimum, penempatan di background
4. Logo misuse — minimal 8 contoh "JANGAN" yang divisualisasikan
5. Color: palette + semantic token + aturan penggunaan + aksesibilitas
6. Typography: scale + aturan + contoh
7. Iconography: gaya (stroke width, corner radius, grid, sudut), sumber icon set
8. Photography & Illustration: arah gaya, apa yang boleh dan tidak
9. Motion principles: durasi, easing, kapan animasi dipakai dan kapan tidak
10. Voice & tone: contoh copy per konteks
11. Application examples: app icon, login screen, email header, slide deck,
    business card, kaos, signage kantor

Setiap section wajib punya contoh visual, bukan hanya deskripsi teks.
```

---

# FASE 2 — Design System Foundation
*Dari brand ke sistem yang bisa dibangun. Ini adalah "Module 01"-nya sisi desain: dependency root untuk semua UI.*

### Step 2.1 — Design Token Architecture
**Deliverable:** `Design_Tokens.md` + `tokens.css` / `tokens.json`

```
[TEMPEL MASTER CONTEXT BLOCK DI SINI]
[LAMPIRKAN: Color_System.md, Typography_System.md]

Bertindaklah sebagai Design Systems Architect. Rancang arsitektur design token
3 lapis untuk Paadu Flow yang akan bertahan 20 tahun dan mendukung theming
per-tenant di masa depan (white-labeling).

LAPIS:
1. PRIMITIVE (global, raw) — mis. color-blue-600, space-4, radius-md
2. SEMANTIC (alias bermakna) — mis. color-bg-surface, color-text-primary
3. COMPONENT (spesifik komponen) — mis. button-primary-bg, table-row-hover-bg

Definisikan token untuk kategori:
- Color (sudah dari Step 1.2 — petakan ke 3 lapis ini)
- Typography (dari Step 1.3)
- Spacing — skala berbasis 4px, minimal 12 langkah, dengan aturan pemakaian
- Sizing — tinggi kontrol (sm/md/lg), lebar container, lebar sidebar
- Border radius — skala + aturan (kapan sharp, kapan rounded)
- Border width
- Shadow/elevation — 5 level, masing-masing punya versi light & dark
  (di dark mode, elevation lebih tepat diekspresikan lewat surface lightness
  daripada shadow — terapkan itu)
- Z-index — skala terdefinisi untuk dropdown, sticky, modal, popover, toast, tooltip
- Motion — duration (instant/fast/normal/slow) & easing curve, plus aturan
  prefers-reduced-motion
- Breakpoint — sm/md/lg/xl/2xl dengan nilai eksplisit
- Opacity — disabled, overlay, hover

PERSYARATAN:
- Penamaan token wajib konsisten dan self-documenting.
  Tetapkan naming convention formal dulu, lalu terapkan.
- Jelaskan bagaimana theming per-tenant akan bekerja: lapis mana yang
  boleh di-override tenant, lapis mana yang dikunci.
- Sertakan aturan governance: siapa boleh menambah token, kapan token baru
  dibenarkan, bagaimana deprecation dilakukan.

OUTPUT: dokumentasi + tokens.json (format W3C Design Tokens) + tokens.css.
```

### Step 2.2 — Layout, Grid & App Shell Structure
**Deliverable:** `Layout_System.md` + mockup app shell.

```
[TEMPEL MASTER CONTEXT BLOCK DI SINI]
[LAMPIRKAN: Design_Tokens.md]

Bertindaklah sebagai Senior Product Designer. Rancang sistem layout & struktur
app shell untuk Paadu Flow.

Konteks: aplikasi ini punya 10+ domain modul (Finance, Sales, Inventory, Purchasing,
Manufacturing, HR, POS, Tax, Project, AI). User bisa punya akses ke banyak company
di dalam satu tenant. Navigasi harus tetap waras saat modul bertambah jadi 30+.

Hasilkan:
1. GRID SYSTEM — kolom, gutter, margin per breakpoint. Aturan max-width konten
   untuk halaman form vs halaman tabel data (tabel butuh full-bleed).
2. APP SHELL ANATOMY — rancang dan render struktur:
   - Global top bar: logo, tenant switcher, company switcher, global search
     (command-K), notifikasi, AI assistant trigger, user menu
   - Primary navigation: rekomendasikan pola (module rail + contextual sidebar,
     vs sidebar tunggal bertingkat, vs top-level tabs). Bandingkan minimal
     2 pola, tunjukkan mockup keduanya, lalu rekomendasikan satu dengan alasan
     — khususnya soal skalabilitas ke 30+ modul dan aturan "maksimal 3 klik".
   - Content area: header halaman (breadcrumb, judul, aksi primer, filter),
     body, dan panel kanan opsional (detail/AI)
   - Status bar / footer jika diperlukan
3. RESPONSIVE BEHAVIOR — bagaimana shell berubah di desktop → laptop → tablet →
   mobile. Nyatakan eksplisit modul mana yang layak dipakai di mobile
   (mis. approval, POS, attendance) dan mana yang desktop-only.
4. DENSITY — terapkan mode Comfortable & Compact ke shell.
5. STATE KONTEKS — bagaimana user selalu tahu sedang berada di tenant & company mana.
   Ini kritikal: salah konteks company = salah data finansial. Rancang indikator
   visual yang mustahil terlewat, termasuk saat user hanya melihat sekilas.

Render mockup app shell dalam light & dark mode, desktop & mobile.
```

---

# FASE 3 — Core Component Library
*Bangun sekali, pakai di semua modul. Tanpa ini, prototype akan tidak konsisten.*

### Step 3.1 — Primitive Components
**Deliverable:** komponen + `Component_Specs_Primitives.md`

```
[TEMPEL MASTER CONTEXT BLOCK DI SINI]
[LAMPIRKAN: Design_Tokens.md, Layout_System.md]

Bertindaklah sebagai Design Systems Engineer. Bangun primitive component library
untuk Paadu Flow menggunakan design token — TIDAK BOLEH ada nilai hardcode.

Komponen yang harus dibuat, masing-masing lengkap dengan SEMUA state
(default, hover, active/pressed, focus-visible, disabled, loading, error, read-only)
dan SEMUA ukuran (sm, md, lg) di light & dark mode:

1. Button — variant: primary, secondary, ghost, danger, link. Plus icon-only,
   icon-leading, icon-trailing, loading state, split button.
2. Input teks — dengan label, helper text, error text, prefix/suffix,
   character counter, clearable.
3. Number & Currency input — dengan tabular figures, thousand separator,
   dan penanganan multi-currency (simbol/kode mata uang).
4. Textarea — auto-resize, max length.
5. Select / Combobox — single, multi, searchable, grouped, dengan async loading state.
6. Date & Date Range picker — plus fiscal period picker (produk ini punya
   fiscal_year_start_month yang bisa bukan Januari — tangani ini).
7. Checkbox, Radio, Switch — termasuk indeterminate state.
8. Badge / Tag / Status pill — variant semantic + dengan dot indicator.
9. Avatar — user, company, dengan fallback inisial dan stacked group.
10. Tooltip, Popover, Dropdown menu.
11. Spinner, Progress bar, Skeleton loader.
12. Icon — tetapkan icon set & aturan (stroke width, ukuran grid, alignment optik).

UNTUK SETIAP KOMPONEN, dokumentasikan:
- Anatomi (bagian-bagian penyusun)
- Props/varian yang tersedia
- Token yang dipakai
- Perilaku keyboard & ARIA role/attribute
- Aturan penggunaan: kapan dipakai, kapan JANGAN dipakai
- Ukuran target sentuh minimum 44×44px untuk mobile

Render semua komponen dalam satu halaman "component gallery" agar bisa dinilai
konsistensinya sekaligus.
```

### Step 3.2 — Composite & Data Components
**Deliverable:** komponen + `Component_Specs_Composite.md`

```
[TEMPEL MASTER CONTEXT BLOCK DI SINI]
[LAMPIRKAN: Design_Tokens.md, Component_Specs_Primitives.md]

Bangun composite component library untuk Paadu Flow. Ini komponen yang paling
menentukan kualitas aplikasi enterprise — kerjakan dengan sangat teliti.

1. DATA TABLE (komponen terpenting — beri porsi terbesar)
   - Sortable, resizable, reorderable, dan pinnable columns
   - Column visibility toggle & saved views
   - Row selection (single, multi, select-all-across-pages)
   - Inline edit, row actions, bulk actions bar
   - Sticky header + sticky first column
   - Pagination DAN virtual scroll (untuk 100rb+ baris)
   - Grouping & aggregation row (subtotal/total — kritikal untuk finance)
   - Expandable row untuk detail
   - Density toggle, export action
   - Empty state, loading skeleton, error state, "no results after filter" state
     (bedakan ketiganya — ini sering disamakan dan membingungkan user)

2. FILTER BAR — quick filter chips, advanced filter builder (kondisi bertingkat
   AND/OR), saved filter, indikator jumlah filter aktif, clear all.

3. FORM LAYOUT — single column, two column, section dengan divider,
   sticky action footer, aturan penempatan label, dan pola form panjang
   (multi-section dengan anchor nav).

4. MODAL, DRAWER, SHEET — tetapkan aturan tegas kapan pakai yang mana.
   Termasuk confirmation dialog untuk aksi destruktif (dengan pola
   type-to-confirm untuk aksi berisiko tinggi).

5. COMMAND PALETTE (Cmd/Ctrl+K) — navigasi antar modul, aksi cepat,
   pencarian entitas lintas modul, dan entry point ke AI. Ini kunci dari
   janji "maksimal 3 klik" dan "keyboard friendly".

6. NOTIFICATION SYSTEM — toast (transient), inline alert (kontekstual),
   notification center (persisten). Tetapkan aturan mana dipakai kapan.

7. PAGE HEADER — breadcrumb, judul, subtitle/metadata, status badge,
   primary action, secondary actions overflow, tabs.

8. CARD & METRIC/KPI CARD — dengan trend indicator, sparkline,
   comparison period, dan loading state.

9. TIMELINE / ACTIVITY FEED — untuk audit trail dan riwayat dokumen
   (produk ini wajib punya audit trail di semua modul).

10. STATE COMPONENTS — empty state (dengan ilustrasi & CTA), error state
    (dengan recovery action), permission-denied state, offline state.

Untuk setiap komponen: anatomi, varian, state, perilaku keyboard, catatan ARIA,
dan aturan pemakaian. Render semuanya dengan data contoh yang realistis
(nama perusahaan Indonesia, nominal Rupiah, tanggal format lokal) —
JANGAN pakai lorem ipsum.
```

---

# FASE 4 — Information Architecture & Navigation

### Step 4.1 — IA & Navigation Model
**Deliverable:** `Information_Architecture.md` + sitemap diagram

```
[TEMPEL MASTER CONTEXT BLOCK DI SINI]
[LAMPIRKAN: Layout_System.md]

Bertindaklah sebagai Information Architect. Rancang IA lengkap Business OS
Paadu Flow untuk seluruh domain modul (Finance/Accounting, Sales/CRM, Inventory,
Purchasing, Manufacturing, HR, POS, Tax, Project, AI, plus Foundation:
Auth, Organization, User/Role/Permission, Notification, Settings, Audit Log, File Storage).

Hasilkan:
1. SITEMAP LENGKAP — hierarki 3 level untuk seluruh modul. Tandai mana yang
   masuk Phase 1 (Foundation), Phase 2 (Core Business), Phase 3 (Operations),
   Phase 4 (Growth), sesuai Roadmap.
2. ROUTE ARCHITECTURE — skema URL yang konsisten selama 20 tahun.
   Putuskan dan pertahankan: apakah tenant & company masuk ke URL path,
   subdomain, atau session state? Bandingkan opsi dari sisi security,
   shareability link, dan risiko salah konteks. Rekomendasikan satu.
   Tetapkan pola: /{module}/{entity}/{id}/{sub-view}
3. NAVIGATION MODEL — bagaimana user berpindah antar modul, antar entitas,
   dan antar company. Termasuk: recently visited, favorites/pinned,
   dan deep-link behavior.
4. GLOBAL SEARCH ARCHITECTURE — apa saja yang dapat dicari, bagaimana hasil
   dikelompokkan lintas modul, dan bagaimana permission memfilter hasil
   (user tidak boleh melihat eksistensi data yang tidak boleh dia akses —
   ini isu keamanan, bukan sekadar UX).
5. PERMISSION-AWARE NAVIGATION — aturan: sembunyikan vs disable vs tampilkan
   dengan upsell. Tetapkan kebijakan tegas dan alasannya.
6. TAXONOMY & TERMINOLOGY — glosarium istilah yang dipakai konsisten di seluruh
   produk (mis. Customer vs Client, Vendor vs Supplier, Item vs Product).
   Ini mencegah inkonsistensi bahasa saat 30+ modul dibangun tim berbeda.

Sertakan diagram sitemap visual.
```

---

# FASE 5 — UX Flow Design
*Rancang alur sebelum menggambar layar. Setiap flow di sini akan jadi kandidat layar prototype.*

### Step 5.1 — Onboarding & Provisioning Flow
**Deliverable:** flow diagram + wireframe

```
[TEMPEL MASTER CONTEXT BLOCK DI SINI]
[LAMPIRKAN: Module_01_Multi_Tenant_Organization_Foundation.md, Layout_System.md]

Bertindaklah sebagai Senior Product Designer. Rancang UX flow lengkap untuk
onboarding & provisioning Paadu Flow, berdasarkan Module 01 (Multi-Tenant &
Organization Foundation) yang sudah didesain.

Cakup dua jalur berbeda:
A. SELF-SERVE (individu/UMKM) — signup → verifikasi email → auto-provisioning
   tenant (status trial) → setup company pertama (legal name, NPWP, mata uang,
   fiscal year start) → pilih modul yang dipakai → invite tim → first-value moment.
B. ASSISTED (enterprise) — request demo → sales-led → provisioning terkelola →
   import data → konfigurasi multi-company → SSO setup.

Untuk setiap jalur, hasilkan:
1. Flow diagram lengkap termasuk semua cabang error dan edge case
   (email sudah terdaftar, slug tenant bentrok, NPWP invalid, user diundang
   ke tenant yang sudah ada, user punya akses ke banyak tenant).
2. Wireframe setiap layar (low-fidelity, fokus struktur & hierarki informasi).
3. Copy asli untuk setiap layar — headline, body, label field, helper text,
   error message, empty state — mengikuti Tone of Voice dari Brand Strategy.
   JANGAN pakai placeholder text.
4. Progress indicator & aturan boleh/tidaknya user skip suatu langkah.
5. "First value moment" — tentukan secara eksplisit apa momen di mana user
   pertama kali merasakan nilai produk, dan bagaimana desain mempercepatnya.
6. Aturan 3-klik: buktikan bahwa tugas umum setelah onboarding
   (mis. buat invoice pertama) tercapai dalam ≤3 klik dari dashboard.

Sertakan juga flow untuk: tenant/company switching, invite & accept invitation,
dan transisi lifecycle tenant (trial → active → suspended → churned) beserta
UI state di setiap status.
```

### Step 5.2 — Core Transaction Flow Archetype
**Deliverable:** `Flow_Archetypes.md` + wireframe

```
[TEMPEL MASTER CONTEXT BLOCK DI SINI]
[LAMPIRKAN: Information_Architecture.md, Component_Specs_Composite.md]

Business OS punya 10+ modul dengan pola interaksi yang berulang. Alih-alih
mendesain setiap modul dari nol, rancang ARCHETYPE FLOW yang dipakai ulang
di seluruh modul. Ini menjamin konsistensi dan menekan biaya desain 20 tahun ke depan.

Rancang dan wireframe archetype berikut:

1. LIST → DETAIL → EDIT
   Pola universal untuk entitas apapun (invoice, customer, employee, PO, item).
   Tetapkan struktur baku: layout halaman list, layout halaman detail
   (header + tabs + activity sidebar), dan mode edit (inline vs halaman terpisah —
   pilih satu dan pertahankan).

2. DOCUMENT LIFECYCLE + APPROVAL
   Pola untuk dokumen transaksional (Quotation → Sales Order → Invoice,
   RFQ → PO → Goods Receipt). Cakup: draft, submitted, pending approval,
   approved, rejected, posted, cancelled, void. Rancang visualisasi status,
   approval chain multi-level, delegasi, dan jejak audit yang terlihat user.

3. DOCUMENT CONVERSION
   Bagaimana user mengubah satu dokumen jadi dokumen lain (Quotation → Sales Order)
   sambil mempertahankan traceability. Rancang UI yang menunjukkan asal-usul
   dokumen dengan jelas.

4. LINE-ITEM EDITOR
   Pola tabel editable untuk baris transaksi (item, qty, harga, diskon, pajak,
   subtotal). Ini muncul di Invoice, PO, Quotation, Journal Entry. Harus:
   keyboard-first (tab antar sel, enter untuk baris baru), kalkulasi real-time,
   penanganan pajak berlapis, dan multi-currency. Rancang dengan sangat detail —
   komponen ini dipakai puluhan kali di seluruh produk.

5. BULK OPERATION & IMPORT
   Upload CSV/Excel → mapping kolom → validasi & preview error → konfirmasi →
   progress → laporan hasil (berhasil/gagal per baris, dengan alasan).

6. REPORT & DASHBOARD
   Pola baku halaman laporan: parameter/filter panel, hasil, drill-down,
   export (PDF/Excel/CSV), schedule & subscribe.

7. SETTINGS & CONFIGURATION
   Pola halaman pengaturan bertingkat: tenant-level, company-level, module-level,
   user-level. Rancang bagaimana user memahami level mana yang sedang diubah
   dan apa dampak perubahannya.

8. AI ASSISTANT INTERACTION
   Bagaimana AI hadir di produk: global assistant (via command palette),
   contextual assistant (di halaman tertentu), inline suggestion, dan
   AI-generated report. Rancang pola kepercayaan: bagaimana user tahu
   sesuatu dihasilkan AI, bagaimana user memverifikasi, dan bagaimana
   user membatalkan aksi AI. Aksi AI yang mengubah data WAJIB punya
   konfirmasi eksplisit dan tercatat di audit log.

Untuk setiap archetype: wireframe, deskripsi interaksi, keyboard shortcut,
state kosong/loading/error, dan daftar modul yang akan memakainya.
```

---

# FASE 6 — High-Fidelity Screen Design
*Terapkan design system ke layar nyata.*

### Step 6.1 — Key Screens High-Fidelity
**Deliverable:** hi-fi mockup 10-12 layar kunci

```
[TEMPEL MASTER CONTEXT BLOCK DI SINI]
[LAMPIRKAN: Design_Tokens.md, semua Component_Specs, Flow_Archetypes.md]

Bertindaklah sebagai Senior Product Designer. Buat desain high-fidelity untuk
layar-layar kunci Paadu Flow. Gunakan HANYA komponen dan token yang sudah
didefinisikan — jangan ciptakan gaya baru.

Layar yang harus dibuat (light & dark mode untuk setiap layar):
1. Login / Sign-in (dengan opsi SSO & MFA)
2. Onboarding — step "Buat Company Pertama"
3. Executive Dashboard — KPI cards, chart, aktivitas terkini, task pending
4. Sales — daftar Invoice (data table penuh dengan filter aktif)
5. Sales — detail Invoice (header, line items, pajak, total, activity/audit sidebar)
6. Sales — form buat Invoice baru (dengan line-item editor)
7. CRM — Opportunity pipeline (kanban) + tampilan tabel
8. Inventory — daftar stok dengan multi-warehouse
9. Finance — laporan Profit & Loss dengan drill-down
10. Settings — Tenant Settings & Company Settings
11. Command palette (Cmd+K) dalam keadaan terbuka
12. AI Assistant panel sedang menjawab pertanyaan bisnis

PERSYARATAN KUALITAS:
- Data harus realistis: nama perusahaan Indonesia, nominal Rupiah dengan
  format benar, tanggal DD MMM YYYY, NPWP, nomor dokumen yang masuk akal
  (INV/2026/08/0142). DILARANG lorem ipsum atau "Company A".
- Setiap layar menunjukkan konteks tenant & company aktif dengan jelas.
- Hierarki visual tegas — mata harus tahu ke mana melihat pertama.
- Perhatikan detail: alignment optik, spacing konsisten dengan token,
  tabular figures di semua angka, kontras lulus AA.
- Sertakan state realistis, bukan hanya "happy path": satu layar dengan
  loading skeleton, satu dengan empty state, satu dengan error/validation.

Setelah selesai, lakukan self-critique: sebutkan 5 hal yang masih bisa
diperbaiki dari desain tersebut dan perbaiki.
```

---

# FASE 7 — Interactive Prototype
*Inilah tujuan akhir. Bangun bertahap, jangan sekaligus.*

### Step 7.1 — Prototype Scope & Mock Data Model
**Deliverable:** `Prototype_Spec.md` + `mock_data.json`

```
[TEMPEL MASTER CONTEXT BLOCK DI SINI]

Sebelum membangun prototype interaktif, siapkan fondasinya.

1. TENTUKAN SCOPE PROTOTYPE
   Pilih 3 alur yang paling membuktikan nilai produk untuk didemokan
   secara interaktif penuh. Rekomendasikan pilihanmu dengan alasan
   (pertimbangkan: mana yang paling meyakinkan investor/calon pelanggan,
   mana yang paling menunjukkan diferensiasi). Sisanya cukup jadi
   layar statis yang bisa dinavigasi.

2. BANGUN MOCK DATA MODEL
   Buat dataset JSON yang konsisten dan saling terhubung untuk sebuah
   perusahaan fiktif Indonesia (tenant dengan 2 company). Minimal:
   - 1 tenant, 2 companies (mis. PT induk + anak perusahaan), 5 users
     dengan role berbeda
   - 25 customers, 20 vendors, 40 items/products dengan stok di 2 warehouse
   - 60 invoices dalam berbagai status & rentang 12 bulan
   - 30 purchase orders, 15 opportunities di berbagai stage
   - 12 bulan data finansial (revenue, COGS, expense) yang konsisten
     dengan transaksi di atas — angka harus benar-benar berjumlah,
     karena dashboard akan menghitung dari data ini
   Semua nominal dalam IDR dengan besaran yang masuk akal untuk UMKM
   menengah Indonesia.

3. DEFINISIKAN INTERAKSI YANG HARUS BERFUNGSI
   Daftar eksplisit: apa yang benar-benar interaktif (filter, sort, buka modal,
   isi form, hitung total, switch company, ganti tema) vs apa yang hanya visual.

OUTPUT: Prototype_Spec.md + mock_data.json lengkap.
```

### Step 7.2 — Build Prototype (kerjakan per alur, JANGAN sekaligus)
**Deliverable:** prototype interaktif

```
[TEMPEL MASTER CONTEXT BLOCK DI SINI]
[LAMPIRKAN: Design_Tokens.md, Component_Specs, Prototype_Spec.md, mock_data.json]

Bangun prototype interaktif Paadu Flow untuk ALUR: [ISI SATU ALUR SAJA, mis.
"Buat Invoice baru dari Dashboard hingga terkirim"].

PERSYARATAN TEKNIS:
- Gunakan design token yang sudah didefinisikan sebagai CSS custom properties.
  DILARANG nilai warna/spacing hardcode.
- Gunakan komponen dari component library yang sudah dibuat. Jika butuh
  komponen baru, hentikan dan tanyakan dulu — jangan diam-diam membuat baru.
- State disimpan di memory (React state / variabel JS). JANGAN gunakan
  localStorage atau sessionStorage.
- Dark mode harus berfungsi via toggle.
- Semua data dari mock_data.json.

PERSYARATAN INTERAKSI:
- Navigasi antar layar benar-benar berfungsi
- Filter, sort, dan search di tabel benar-benar bekerja pada data
- Form melakukan validasi nyata dengan pesan error yang benar
- Line-item editor menghitung subtotal, diskon, pajak, dan total secara real-time
- Command palette (Cmd/Ctrl+K) berfungsi
- Loading state ditampilkan (simulasikan delay 300-600ms agar terasa nyata)
- Toast konfirmasi muncul setelah aksi berhasil
- Keyboard navigation berfungsi: Tab, Enter, Esc, arrow keys di tabel

PERSYARATAN KUALITAS:
- Transisi halus mengikuti motion token; hormati prefers-reduced-motion
- Responsive: uji di lebar 1440px, 1024px, dan 390px
- Fokus indicator terlihat jelas di semua elemen interaktif
- Tidak ada layout shift saat data dimuat

Bangun HANYA alur ini. Setelah selesai, saya akan minta alur berikutnya
untuk ditambahkan ke prototype yang sama.
```

### Step 7.3 — Polish & Micro-interaction

```
[TEMPEL MASTER CONTEXT BLOCK DI SINI]
[LAMPIRKAN: prototype hasil Step 7.2]

Lakukan polish pass pada prototype. Fokus pada detail yang membedakan
produk enterprise biasa dengan produk kelas Linear/Stripe.

Perbaiki dan tambahkan:
1. MICRO-INTERACTION — hover state yang responsif, transisi state tombol,
   ripple/feedback saat klik, animasi masuk-keluar modal & drawer,
   stagger pada list yang baru dimuat, animasi angka pada KPI card.
   Semua ≤200ms untuk aksi langsung; jangan sampai terasa lambat.
2. OPTIMISTIC UI — aksi terasa instan; rollback dengan jelas jika gagal.
3. LOADING CHOREOGRAPHY — skeleton yang bentuknya menyerupai konten akhir,
   bukan spinner generik. Tanpa layout shift.
4. EMPTY & EDGE STATE — pastikan setiap tabel/list punya empty state
   yang bermakna dengan CTA, bukan sekadar "No data".
5. ERROR RECOVERY — setiap error punya aksi pemulihan yang jelas.
6. KEYBOARD SHORTCUT — tambahkan dan tampilkan overlay bantuan shortcut
   (tekan "?"). Verifikasi tidak ada shortcut yang bentrok.
7. FOCUS MANAGEMENT — fokus berpindah dengan benar saat modal buka/tutup,
   focus trap di dalam modal, fokus kembali ke trigger saat ditutup.
8. DETAIL FINISHING — konsistensi border radius, optical alignment ikon
   terhadap teks, tidak ada spacing ganjil, tabular figures di semua angka.

Setelah selesai, laporkan daftar perubahan yang dilakukan.
```

---

# FASE 8 — Validation & Handoff

### Step 8.1 — Accessibility & Quality Audit

```
[TEMPEL MASTER CONTEXT BLOCK DI SINI]
[LAMPIRKAN: prototype final]

Lakukan audit menyeluruh terhadap prototype Paadu Flow.

A. ACCESSIBILITY AUDIT (WCAG 2.1 AA)
   Periksa dan laporkan per kriteria:
   - Kontras warna semua kombinasi teks/background & UI component (target 4.5:1 / 3:1)
   - Keyboard: semua fungsi dapat dicapai tanpa mouse, urutan tab logis,
     tidak ada keyboard trap, focus indicator selalu terlihat
   - Semantik HTML & ARIA: landmark, heading hierarchy, label form,
     error announcement, live region untuk toast
   - Data table: header terasosiasi, caption, sortable diumumkan dengan benar
   - Ukuran target sentuh ≥44×44px di mobile
   - prefers-reduced-motion dihormati
   - Konten tidak bergantung pada warna saja untuk menyampaikan makna
   OUTPUT: tabel temuan — kriteria WCAG | severity (Critical/Major/Minor) |
   lokasi | perbaikan yang disarankan. Lalu perbaiki semua yang Critical & Major.

B. UX QUALITY AUDIT
   - Uji aturan 3-klik pada 10 tugas paling umum. Tabelkan: tugas | jumlah klik |
     lulus/tidak. Perbaiki yang gagal.
   - Konsistensi: apakah ada komponen/pola/istilah yang menyimpang dari sistem?
   - Apakah konteks tenant & company selalu jelas di setiap layar?
   - Apakah setiap aksi destruktif punya konfirmasi yang proporsional?

C. PERFORMANCE SANITY CHECK
   - Apakah tabel besar di-virtualisasi?
   - Adakah re-render yang tidak perlu?
   - Apakah ada layout shift?

Laporkan hasil audit sebagai dokumen, lalu terapkan perbaikannya.
```

### Step 8.2 — Design Handoff Specification

```
[TEMPEL MASTER CONTEXT BLOCK DI SINI]
[LAMPIRKAN: semua deliverable Fase 1-7]

Susun Design Handoff Specification agar tim engineering dapat
mengimplementasikan Paadu Flow tanpa ambiguitas.

Isi:
1. Ringkasan design system: token, komponen, aturan
2. Per komponen: anatomi, semua varian & state, token yang dipakai,
   props/API komponen yang disarankan, perilaku keyboard, ARIA
3. Per layar kunci: struktur layout, breakpoint behavior, komponen yang dipakai,
   sumber data yang dibutuhkan (petakan ke API endpoint yang sudah didefinisikan
   di Module 01 dan API Standards)
4. Interaksi & motion spec: durasi, easing, trigger
5. Edge case & error handling per layar
6. Responsive spec per breakpoint
7. Aturan copy & i18n: string mana yang perlu dilokalkan, format
   tanggal/angka/mata uang per locale
8. Definition of Done untuk pekerjaan frontend, diturunkan dari
   Definition of Done di Knowledge Base (12_DEFINITION_OF_DONE)

Format: dokumen terstruktur yang bisa langsung dibaca engineer,
bukan narasi desain.
```

---

## Ringkasan Urutan Eksekusi

| Fase | Step | Output Utama | Dependency |
|---|---|---|---|
| 0 | 0.1 | Brand Clearance Report | — |
| 0 | 0.2 | Brand Strategy | 0.1 |
| 1 | 1.1 | Logo System (SVG) | 0.2 |
| 1 | 1.2 | Color System | 0.2 |
| 1 | 1.3 | Typography System | 0.2 |
| 1 | 1.4 | Brand Book | 1.1–1.3 |
| 2 | 2.1 | Design Tokens | 1.2, 1.3 |
| 2 | 2.2 | Layout & App Shell | 2.1 |
| 3 | 3.1 | Primitive Components | 2.1 |
| 3 | 3.2 | Composite Components | 3.1 |
| 4 | 4.1 | Information Architecture | 2.2 |
| 5 | 5.1 | Onboarding Flow | 4.1, Module 01 |
| 5 | 5.2 | Flow Archetypes | 4.1, 3.2 |
| 6 | 6.1 | Hi-Fi Screens | 3.2, 5.2 |
| 7 | 7.1 | Prototype Spec + Mock Data | 6.1 |
| 7 | 7.2 | Prototype (per alur) | 7.1 |
| 7 | 7.3 | Polish Pass | 7.2 |
| 8 | 8.1 | Audit & Fix | 7.3 |
| 8 | 8.2 | Handoff Spec | 8.1 |

---

## Tips Eksekusi di Claude Design

- **Satu step, satu sesi.** Jangan gabungkan Step 3.1 dan 3.2 dalam satu percakapan — output akan dangkal.
- **Selalu lampirkan output step sebelumnya.** Konsistensi sistem bergantung penuh pada ini.
- **Iterasi dengan instruksi spesifik.** Bukan "bikin lebih bagus", tapi "kurangi kontras border di dark mode, dan naikkan line-height body ke 1.6".
- **Minta self-critique.** Tambahkan di akhir prompt: *"Setelah selesai, sebutkan 5 kelemahan hasilmu dan perbaiki."* Ini terbukti menaikkan kualitas output secara signifikan.
- **Kunci keputusan.** Setiap kali sebuah keputusan final (warna primer, pola navigasi), catat di file `Design_Decisions.md` agar tidak berubah diam-diam di sesi berikutnya.
- **Jangan mulai Fase 7 sebelum Fase 3 benar-benar selesai.** Prototype yang dibangun di atas komponen yang belum matang akan harus dibongkar ulang.
