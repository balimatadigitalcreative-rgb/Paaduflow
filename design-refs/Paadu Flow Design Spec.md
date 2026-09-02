# Paadu Flow — Design Spec

Sumber: 10 file `.dc.html` di project ini. Semua nilai diambil verbatim dari file, bukan diperkirakan.
Stack target: React + CSS variables. Nama token di bawah adalah nama yang sudah dipakai di `Paadu Flow Style Guide.dc.html`.

Catatan implementasi: 9 dari 10 screen menulis nilai hex secara literal inline (bukan `var()`). Hanya Style Guide memakai `var(--*)`. Saat porting ke React, ganti seluruh literal dengan token di Bagian 1.

---

## 1. Design Tokens

### 1.1 Brand (Paadu Blue)

| Token | Light | Dark | Dipakai di mana |
|---|---|---|---|
| `--action-primary-bg` | `#3A34B5` | `#4F48C4` | Semua screen. Tombol primary, tab aktif (border-bottom 2px), left-border item sidebar aktif, checkbox terpilih, focus ring, ikon stepper selesai |
| `--action-primary-bg-hover` | `#2F2A94` | `#5F57CE` | Hover tombol primary — 10 screen |
| `--action-primary-bg-active` | `#262277` | `#4239A8` | Active/pressed tombol primary — Style Guide, Brand Guidelines |
| `--bg-accent-subtle` | `#ECEBFA` | `#1A1840` | Baris tabel terpilih, background item sidebar aktif, bubble pertanyaan user (AI Panel), bulk-action bar, sel chip filter aktif |
| `--border-accent` | `#B9B5EC` | `#353173` | Border chip filter aktif, border bubble user, border kartu terpilih |
| `--text-accent` | `#3A34B5` | `#A5A0F0` | Teks link, label item sidebar aktif, teks tab aktif, angka pada chip aktif |
| `--text-on-accent` | `#FFFFFF` | `#FFFFFF` | Teks di atas tombol primary |

### 1.2 Surface

| Token | Light | Dark | Dipakai di mana |
|---|---|---|---|
| `--bg-canvas` | `#F7F8F9` | `#0B0F14` | Latar area konten shell (di bawah top bar), latar halaman Onboarding |
| `--bg-surface` | `#FFFFFF` | `#141A21` | Kartu, tabel, sidebar, top bar, panel |
| `--bg-surface-subtle` | `#F7F8F9` | `#10161C` | Header tabel (sticky), footer total, baris hover, kotak info sekunder, rail sidebar collapsed |
| `--bg-surface-raised` | `#FFFFFF` | `#1F272F` | Dropdown, popover company switcher, command palette, modal, drawer |
| — (backdrop) | `rgba(11,15,20,.45)` | `rgba(0,0,0,.6)` | Overlay di belakang modal, command palette, drawer |

### 1.3 Border

| Token | Light | Dark | Dipakai di mana |
|---|---|---|---|
| `--border-subtle` | `#EDEFF1` | `#232C36` | Pemisah baris tabel, pemisah item di dalam kartu, divider dropdown |
| `--border-default` | `#E3E6E9` | `#2E3843` | Border kartu, border tabel, border input default, border sidebar/top bar |
| `--border-strong` | `#C9CFD5` | `#45525F` | Border input hover, border tombol secondary, border-top footer total, border-bottom header tabel, dashed border empty state |

### 1.4 Teks

| Token | Light | Dark | Kontras (light, di atas `#FFFFFF`) | Dipakai di mana |
|---|---|---|---|---|
| `--text-primary` | `#0B0F14` | `#F7F8F9` | 18.9:1 | Nilai, judul, label form, isi tabel |
| `--text-secondary` | `#5B6672` | `#A9B2BB` | 5.74:1 | Label kolom tabel, helper text, subtitle, ikon inaktif. Token paling sering dipakai (657 kemunculan) |
| `--text-tertiary` | `#7C8794` | `#7C8794` | 3.51:1 | Overline, placeholder, kode langkah. **Di bawah AA** — hanya untuk teks non-esensial ≥12px |
| `--text-disabled` | `#A9B2BB` | `#5B6672` | 2.11:1 | Item disabled. **Di bawah AA** — selalu didampingi penanda non-warna |
| `--text-inverse` | `#FFFFFF` | `#0B0F14` | — | Teks di atas toast gelap dan tombol primary |

### 1.5 Semantic

| Token | Light | Dark | Dipakai di mana |
|---|---|---|---|
| `--success` | `#12805C` | `#12805C` | Fill batang "Pemasukan" (Arus Kas), garis aksen atas KPI card, sparkline naik |
| `--success-bg-subtle` | `#E6F4EF` | `#0E2A21` | Badge Lunas/Paid, alert sukses |
| `--success-border` | `#A7D8C6` | `#1C5140` | Border badge Lunas, border baris "Seimbang" jurnal |
| `--success-text` | `#0E6A4C` | `#5FD3AA` | Teks badge Lunas, delta positif, teks "Seimbang" |
| `--warning` | `#B45309` | `#B45309` | Fill indikator peringatan |
| `--warning-bg-subtle` | `#FDF3E7` | `#2C1F0E` | Badge Menunggu/Pending, alert stok, peringatan retensi pajak |
| `--warning-border` | `#F0CFA0` | `#5A3F1B` | Border badge Menunggu |
| `--warning-text` | `#92400E` | `#EFB765` | Teks badge Menunggu, teks umur piutang 31–60 hari |
| `--danger` | `#B42318` | `#B42318` | Fill batang "Pengeluaran", dot notifikasi, garis aksen KPI turun, tombol Void |
| `--danger-bg-subtle` | `#FDECEA` | `#2C1512` | Badge Overdue, alert galat, ikon modal destruktif |
| `--danger-border` | `#F1B4AE` | `#5C2721` | Border badge Overdue, border badge Void (dashed) |
| `--danger-text` | `#912018` | `#F2A29A` | Teks badge Overdue, tanggal jatuh tempo terlampaui, sisa tagihan overdue, delta negatif |
| `--info` | `#175CD3` | `#175CD3` | Fill indikator info |
| `--info-bg-subtle` | `#EAF0FC` | `#111E38` | Badge Sebagian/Partial, alert info |
| `--info-border` | `#B3C8F0` | `#274574` | Border badge Sebagian |
| `--info-text` | `#1449A6` | `#8FB4F5` | Teks badge Sebagian |

### 1.6 Accent AI (Flow Amber)

| Token | Light | Dark | Dipakai di mana |
|---|---|---|---|
| `--accent-ai` | `#E8A33D` | `#E8A33D` | Stroke logo mark strand kedua, ikon Paadu AI, dot indikator sidebar |
| `--accent-ai-bg-subtle` | `#FDF3E3` | `#2A2013` | Permukaan panel AI, item sidebar "Paadu AI", banner trial, kartu temuan AI |
| `--accent-ai-border` | `#F0D3A0` | `#54401F` | Border permukaan AI |
| `--accent-ai-text` | `#8A5A12` | `#F0C079` | Teks di atas permukaan AI |

Aturan: amber **hanya** menandai permukaan AI dan highlight sementara. Tombol aksi di dalam permukaan AI tetap `--action-primary-bg` (biru), karena aksinya adalah aksi produk, bukan aksi AI.

### 1.7 Radius

| Token | Nilai | Dipakai di mana |
|---|---|---|
| `--radius-xs` | `4px` | Kotak checkbox, kbd, swatch kecil, badge angka sidebar |
| `--radius-control` | `6px` | Tombol, input, select, ikon-button, item dropdown |
| `--radius-card` | `10px` | Kartu, tabel container, dropdown, popover, KPI card |
| `--radius-panel` | `12px` | Kartu spesimen pembungkus (frame demo), panel AI, shell frame |
| `--radius-modal` | `14px` | Modal, command palette |
| `--radius-pill` | `999px` | Avatar, badge status, chip filter, toggle, progress bar |

Nilai lain yang muncul: `1px`–`3px` (garis dekoratif dan sudut kbd), `5px` (chevron kecil), `8px` (alert inline, kotak info di dalam kartu), `16px`/`20px` (bubble mobile, sheet mobile di Faktur Detail), `2px` (batang chart).

### 1.8 Shadow

| Token | Light | Dark | Dipakai di mana |
|---|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(11,15,20,.06)` | `none` | KPI card, segmented control aktif, thumb toggle |
| `--shadow-md` | `0 4px 12px rgba(11,15,20,.08)` | `0 4px 12px rgba(0,0,0,.5)` | Dropdown, popover, tooltip, toast |
| `--shadow-lg` | `0 12px 32px rgba(11,15,20,.12)` | `0 12px 32px rgba(0,0,0,.6)` | Modal, drawer, command palette, panel AI |
| focus ring inner | `0 0 0 2px var(--bg-accent-subtle)` | idem | Input focus (dipasangkan dengan `border-color: var(--action-primary-bg)`) |

Aturan: border 1px lebih diutamakan daripada shadow untuk memisahkan area. Di dark mode `--shadow-sm` = `none`; elevasi dikerjakan lightness surface.

### 1.9 Typography

Font UI: `Inter`, fallback `system-ui, sans-serif`. Font kode/nomor dokumen: `JetBrains Mono`, fallback `ui-monospace, monospace`. Bobot: **400 / 500 / 600 saja**.

| Token | Size / Line-height | Weight | Dipakai di mana |
|---|---|---|---|
| `--text-display` | 30 / 36 | 600 | H1 Style Guide |
| `--text-h1` | 24 / 32 | 600 | Judul halaman (Business Overview, Faktur Penjualan, System States), nomor faktur di header detail (mono), nilai besar mobile |
| `--text-h2` | 20 / 28 | 600 | Judul section, nilai KPI (Style Guide), judul kartu AI |
| `--text-h3` | 16 / 24 | 600 | Judul kartu, judul modal, nama company di switcher, judul empty state |
| `--text-body` | 14 / 20 | 400 | Isi default, teks tombol, isi input |
| `--text-body-sm` | 13 / 18 | 400 | Isi tabel, item sidebar, item dropdown, helper text panjang |
| `--text-caption` | 12 / 16 | 400 | Label kolom tabel, helper text, timestamp, sublabel |
| `--text-micro` | 11 / 16 | 600 | Overline (uppercase, `letter-spacing: .08em`), badge angka, kbd |

Ukuran tambahan yang muncul: `10px` (label sumbu chart, badge "Soon"), `15px` (input command palette, judul mobile), `18px` (H2 System States), `19px`/`21px`–`120px` (khusus Brand Guidelines — halaman dokumen brand, bukan skala UI).

Angka finansial: `font-variant-numeric: tabular-nums` **wajib**, di-set di `body` semua screen dan diulang per sel nilai.

### 1.10 Spacing

Base unit 4px. Skala: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

| Token | Nilai | Dipakai di mana |
|---|---|---|
| `--space-1` | 4px | Gap ikon-ke-ikon, gap item pagination |
| `--space-2` | 8px | Gap tombol dalam grup, gap label-ke-kontrol |
| `--space-3` | 12px | Padding horizontal sel tabel, gap antar kartu kecil |
| `--space-4` | 16px | Padding kartu kecil, gap grid kartu |
| `--space-5` | 20px | Padding kartu standar |
| `--space-6` | 24px | Padding area konten shell, padding kartu besar, gap baris dashboard |
| `--space-8` | 32px | Padding halaman standalone (Style Guide, System States, AI Panel) |
| `--space-10` | 40px | Padding vertikal empty state |
| `--space-12` | 48px | Gap antar section besar |
| `--space-16` | 64px | Padding bawah halaman panjang |

### 1.11 Ukuran & tinggi baris

| Token | Nilai | Dipakai di mana |
|---|---|---|
| `--control-h-sm` | 28px | Tombol kecil (toolbar tabel, bulk bar, chip aksi), pagination item 32px |
| `--control-h-md` | 36px | **Default** tombol, input, select, ikon-button |
| `--control-h-lg` | 40px | Input command palette, tombol CTA onboarding & tenant suspended, input AI |
| `--control-h-touch` | 44px | Minimum target sentuh (versi mobile Faktur Detail, mode Comfortable) |
| `--row-h-compact` | 36px | **Default** tinggi baris tabel |
| `--row-h-comfortable` | 44px | Mode Comfortable; dipakai sebagai tinggi baris tabel Pengaturan |
| `--topbar-h` | 56px | Top bar semua screen di dalam shell |
| `--sidebar-w` | 248px | Sidebar expanded |
| `--sidebar-w-collapsed` | 56px | Rail icon-only |
| `--nav-item-h` | 32px | Item navigasi sidebar (expanded); 40px di rail collapsed |
| `--chatter-w` | 360px | Panel aktivitas Faktur Detail |
| `--ai-panel-w` | 420px | Panel Paadu AI (lihat inkonsistensi §4) |
| `--mobile-w` | 390px | Frame mobile Faktur Detail |
| ikon inline | 12 / 14 / 16 / 18px | 12px di dalam badge & kbd; 14px di tombol kecil; 16px default; 18px di rail collapsed |
| avatar | 20 / 24 / 28 / 32 / 40px | 20–24px inline timeline; 28px avatar group; 32px switcher & top bar; 40px header dokumen |

---

## 2. Inventaris Komponen

Ukuran di kolom Props/State adalah nilai konkret dari file.

| Komponen | Varian | Props | State | Dipakai di screen |
|---|---|---|---|---|
| **Button** | primary, secondary, ghost, danger, icon-only | `variant`, `size` (sm 28 / md 36 / lg 40), `loading`, `disabled`, `iconLeft`, `iconRight`, `shortcut` | default, hover, focus (`outline:2px` + `outline-offset:2px`), active, disabled, loading (spinner 12px, lebar tetap) | Semua 10 |
| **SplitButton** | primary | `label`, `items[]` (label + shortcut + disabled), `onPrimary` | closed, open, item hover, item disabled | App Shell, Faktur Penjualan, Faktur Detail, Style Guide |
| **IconButton** | default, ghost | `icon`, `ariaLabel`, `size` (24 / 28 / 32 / 36) | default, hover, focus, active, disabled, loading | Semua 10 |
| **Input** | text, currency (prefix `Rp`, rata kanan), readonly (mono), search | `label`, `required`, `placeholder`, `prefix`, `suffix`, `error`, `helper`, `disabled` | default (`border-strong`), hover (`text-tertiary`), focus (`border-accent` + ring), error (`danger` + ikon 16px), disabled (`surface-subtle`), readonly (tanpa border) | Style Guide, Onboarding, Faktur Detail, Pengaturan, AI Panel, System States |
| **Select** | single | `label`, `value`, `options[]`, `disabled` | default, hover, focus, open, disabled | Style Guide, Onboarding, Faktur Penjualan, Pengaturan |
| **MultiSelect** | chip-in-field | `values[]`, `max`, `overflowLabel` (`+2 lain`) | default, focus, chip removable | Style Guide |
| **Combobox** | search + grouped result | `query`, `groups[]`, `footerHint` | closed, typing, results, empty, keyboard-highlight | Style Guide, App Shell (⌘K), Faktur Penjualan |
| **DateRangePicker** | range + preset | `from`, `to`, `presets[]` (Bulan Ini, Kuartal Ini, Tahun Ini, Custom) | default, preset aktif, open | Business Overview, Style Guide |
| **Checkbox** | default, indeterminate | `checked`, `indeterminate`, `disabled` | default, checked, indeterminate, focus, disabled | Style Guide, Faktur Penjualan, Onboarding, Pengaturan |
| **Radio** | default | `checked`, `disabled` | default, checked, disabled | Style Guide, Onboarding |
| **Toggle** | 32×20, thumb 16 | `checked`, `disabled` | on, off, focus, disabled | Style Guide, Business Overview, Onboarding |
| **Textarea** | default | `rows`, `maxLength`, `counter` | default, focus, error | Style Guide, Faktur Detail (kotak komentar) |
| **Badge / StatusPill** | 8 status semantik + tag netral | `status`, `label`, `icon`, `suffix` (`Overdue 30h`) | statis. Selalu ikon + teks, tidak pernah warna saja | Semua kecuali Onboarding |
| **Avatar** | circle (orang), rounded-square 6px (company) | `initials`, `size` (20–40), `entity` | default, dalam group (ring 2px `bg-surface`, offset −8px) | Semua 10 |
| **AvatarGroup** | max + overflow | `items[]`, `max`, `overflowCount` (`+2`, `+7`) | default | App Shell, Business Overview, Faktur Detail, Pengaturan |
| **Tabs** | underline 2px | `items[]`, `active`, `count`, `disabled` | active (600 + `text-accent`), inactive, hover, disabled | Style Guide, Faktur Detail, Pengaturan |
| **Breadcrumb** | slash separator | `items[]` (link + current mono) | default, hover | App Shell, Business Overview, Faktur Penjualan, Faktur Detail, Pengaturan |
| **Table** | compact 36 / comfortable 44 | `columns[]` (align, sortable, sticky), `rows[]`, `selectable`, `footerTotals` | sticky header (top 0, `surface-subtle`, border-bottom `border-strong`), sort asc/desc + urutan sort, row hover, row selected (`bg-accent-subtle`), sticky kolom kiri & kolom aksi (border + bg mengikuti state baris), footer total sticky, skeleton, empty | Style Guide, Faktur Penjualan, Faktur Detail, Pengaturan, AI Panel, Business Overview |
| **BulkActionBar** | menempel di bawah tabel | `selectedCount`, `actions[]`, `onCancel` | hidden, visible | Faktur Penjualan, Style Guide |
| **Pagination** | numbered + per-page | `page`, `total`, `perPage` (50), `range` | default, current (`aria-current`), disabled prev/next, ellipsis | Faktur Penjualan, Style Guide |
| **Card** | plain, header+body, framed spesimen | `title`, `meta`, `action`, `padding` | default | Semua 10 |
| **KpiCard** | dengan garis aksen atas 2px | `label`, `value`, `delta`, `deltaDirection`, `context`, `sparkline`, `tooltip` | positif, negatif, netral (tanpa garis), loading (shimmer) | Business Overview, Style Guide |
| **StatSummaryRow** | 4 angka ringkas | `items[]` (label + value + tone) | default, danger pada item terakhir | Faktur Penjualan |
| **EmptyState** | no-data, filtered, no-second-company | `icon`, `title`, `body`, `actions[]`, `activeFilters[]` | 3 varian copy berbeda | System States, Faktur Penjualan, Style Guide |
| **Skeleton** | text bar, tabel row, KPI | `width`, `height`, `shimmer` | shimmer 1.2–1.3s linear infinite | Faktur Penjualan, Business Overview, AI Panel, Style Guide |
| **Toast** | success, danger (latar `text-primary`, border-left 2px) | `tone`, `message`, `docRef`, `action` | visible | Style Guide |
| **InlineAlert** | info, success, warning, danger, ai | `tone`, `title`, `body` | statis | Style Guide, Onboarding, Faktur Detail, System States, Pengaturan |
| **Modal** | konfirmasi, destruktif-dengan-ketik-nama | `title`, `body`, `impactList`, `confirmPhrase`, `actions[]` | default, confirm terkunci (tombol disabled sampai teks cocok) | Style Guide, System States |
| **Drawer** | kanan, 78% lebar frame | `title`, `subtitle`, `body`, `footerActions` | open | Style Guide |
| **SidePanel** | chatter 360px, AI 420px | `tabs[]`, `width`, `onClose`, `contextSelector` | open, closed, empty, streaming | Faktur Detail, AI Panel, Business Overview |
| **Tooltip** | dark, dengan kbd | `label`, `shortcut`, `placement` | visible | Style Guide, App Shell, Business Overview |
| **DropdownMenu** | plain, dengan shortcut, dengan section | `items[]`, `sections[]`, `disabledReason` | closed, open, item hover, item disabled | App Shell, Faktur Penjualan, Faktur Detail, Style Guide |
| **SegmentedControl** | 2–4 opsi, tinggi 28 | `options[]`, `value` | selected (`bg-surface` + `shadow-sm`), unselected, disabled | Style Guide, Business Overview, Faktur Penjualan |
| **Stepper** | horizontal bernama (desktop), 4-segmen progress (mobile) | `steps[]`, `current` | done (fill solid + ikon centang), current (outline 2px + 600), upcoming (border `border-strong`) | Onboarding, Faktur Detail, Style Guide |
| **ProgressBar** | linear 6px, stacked | `value`, `segments[]` | default | Style Guide, Business Overview, Onboarding, Faktur Detail |
| **CommandPalette** | ⌘K | `query`, `groups[]` (Navigasi, Aksi cepat, Dokumen terbaru, Tanya Paadu AI), `footerHints` | closed, open, typing, highlighted row | App Shell, Style Guide |
| **SidebarNavItem** | expanded, collapsed, child, dengan badge | `icon`, `label`, `active`, `badge`, `children[]`, `collapsed` | default, hover, active (`bg-accent-subtle` + `box-shadow: inset 2px 0 0`), disabled + "Soon", AI (amber) | App Shell + 4 screen yang memakai shell |
| **NavGroup** | collapsible | `label`, `items[]`, `open` | collapsed, expanded | App Shell, semua screen ber-shell |
| **TenantCompanySwitcher** | popover | `active`, `tenants[]` → `companies[]`, `searchable`, `trialBadge` | closed, open, search, company aktif, tenant trial | App Shell, Business Overview, Faktur Penjualan, Faktur Detail, Pengaturan |
| **FilterChip** | aktif (dengan count + ×), inaktif, add | `label`, `value`, `count`, `removable` | default, hover, aktif | Faktur Penjualan, Style Guide, System States |
| **SearchWithChips** | search bar besar yang memuat chip | `chips[]`, `query`, `onClear` | default, focus, dengan chip | Faktur Penjualan |
| **LineItemTable** | editable inline, 9 kolom | `rows[]`, `onAddRow`, `onAddSection` | default, row hover, sel editable, footer "+ Tambah Baris" | Faktur Detail |
| **DocumentTotals** | ringkasan kanan | `lines[]`, `emphasisLine` | default | Faktur Detail |
| **JournalTable** | debit/kredit read-only | `entries[]`, `balanced` | seimbang, tidak seimbang | Faktur Detail |
| **ActivityTimeline** | comment, status-change, audit-diff, email, ai | `entries[]`, `entryType` | default; audit menampilkan `field: lama → baru` | Faktur Detail, Business Overview |
| **PermissionMatrix** | tri-state | `actions[]`, `roles[]`, `values` (`full` / `limited` / `none`), `lockedColumn` | full ✓, limited ◐ + keterangan, none ✗, kolom terkunci (abu + tooltip) | Pengaturan |
| **PlanCard** | 4 plan | `name`, `price`, `features[]`, `selected` | selected (border accent), unselected | Onboarding |
| **RegionCard** | 3 region | `name`, `detail`, `selected` | selected, unselected | Onboarding |
| **SlugField** | prefix URL + indikator | `value`, `available`, `immutableNote` | tersedia (✓), sudah dipakai (✗), typing | Onboarding |
| **NpwpField** | masked | `value`, `mask` (`00.000.000.0-000.000`), `valid` | valid (15/16 digit), invalid, typing | Onboarding |
| **InviteRow** | email + role | `email`, `role`, `scope`, `onRemove` | filled, empty, role open | Onboarding |
| **Banner** | trial (amber), offline (gelap) | `tone`, `message`, `actions[]`, `pendingCount` | visible, dismissible | System States |
| **ErrorPage** | 403, 404, 500 | `code`, `title`, `body`, `roleHint`, `eventCode`, `actions[]` | 3 varian | System States |
| **SuspendedScreen** | layar penuh gelap | `tenant`, `amount`, `dueDate`, `retentionDate`, `ownerName` | statis | System States |
| **AiAnswer** | teks + tabel + chart + aksi | `blocks[]`, `sourceLine`, `feedback` | empty, streaming, complete | AI Panel |
| **Logo** | mark-only, lockup horizontal, monokrom | `size` (24–96), `variant`, `monochrome` | statis. Stroke 2.15–2.4 pada viewBox 32; naik di bawah 32px | Semua 10 |

---

## 3. Spesifikasi Per Screen

### 3.1 Brand Guidelines

- **Rute**: `/brand` (dokumen internal, di luar shell aplikasi)
- **Struktur layout**:
  ```
  Page (dokumen panjang, latar gelap → terang per section)
    - Cover (logo besar, tagline)
    - Daftar isi
    - Section: Anyaman Alur — makna geometri
    - Section: Lima pilar brand
    - Section: Kepribadian brand
    - Section: Varian dan lockup
    - Section: Clear space dan ukuran minimum
    - Section: Penempatan di latar
    - Section: Sembilan larangan
    - Section: Paadu Blue & Flow Amber
    - Section: Netral & semantik
    - Section: Dua typeface, tiga bobot
    - Section: Perlakuan angka finansial
    - Section: Satu bahasa dengan mark (ikonografi)
    - Section: Nyata, bukan stok (fotografi)
    - Section: Motion menjelaskan, tidak menghibur
    - Section: Cara Paadu Flow berbicara (voice & tone)
    - Section: Aset yang diturunkan dari dokumen ini
    - Section: Sumber kebenaran
  ```
- **Komponen**: Logo (semua varian), Card, Badge, tabel token
- **Data**: statis — tidak ada data aplikasi
- **State halaman**: tidak ada (dokumen statis). Tidak ada loading/empty/error.
- **Copy string**: judul section di atas verbatim. Skala tipografi khusus dokumen (19–120px) **tidak** dipakai di aplikasi.
- **Interaksi**: daftar isi → anchor link ke section.
- **Catatan porting**: jangan generate komponen React dari file ini. Ini referensi manusia; nilai UI-nya diambil dari Style Guide.

---

### 3.2 Style Guide

- **Rute**: `/design-system`
- **Struktur layout**:
  ```
  Page
    - Header (sticky, 56px): Logo + versi + SegmentedControl Density + SegmentedControl Tema
    - Grid [216px | 1fr]
      - Nav "Contents" (sticky, 12 anchor)
      - Main (12 section)
        - Hero: judul + 4 metrik fondasi
        - 01 Brand & Logo (mark-only, lockup, monokrom)
        - 02 Color (brand, amber, neutral 12 langkah, semantic ×4, dark mode)
        - 03 Typography (skala 8 baris, tabular-nums, JetBrains Mono)
        - 04 Spacing, Shape & Density (spacing 10, radius 4, shadow 3, compact vs comfortable)
        - 05 Actions (matriks varian × 6 state, split button, size, tooltip shortcut)
        - 06 Form Controls
        - 07 Status & Identity (8 status pill, avatar, filter chip)
        - 08 Navigation (breadcrumb, tabs, segmented, stepper, progress, pagination, sidebar, ⌘K)
        - 09 Data Display (tabel lengkap, KPI card)
        - 10 Overlays (modal, drawer)
        - 11 Feedback & States (toast, inline alert, 2 empty state)
        - 12 Accessibility (focus ring, status non-warna, keyboard, lint)
    - Footer: sumber kebenaran token
  ```
- **Komponen**: seluruh inventaris §2 (halaman ini adalah sumbernya)
- **Data**: contoh statis — `INV/2026/09/00184`, `1-10200 Piutang Usaha`, `01.234.567.8-901.000`, nominal `1.847.500` / `184.750.000`
- **State halaman**: tidak ada state data. Tema (light/dark) dan density (compact/comfortable) adalah props root: `theme`, `density`
- **Copy string** (label struktural):
  - `One Platform. Every Business.`
  - `Design System Foundation`, `v1.0 · Fase 2`, `Density`, `Compact`, `Comfortable`, `Light`, `Dark`, `Contents`
  - `Body default`, `14 / 20`, `aplikasi data-dense`, `Base unit`, `4 px`, `10 langkah skala`, `Row height`, `compact default`, `Kontras minimum`, `4.5 : 1`, `WCAG AA, teks`
  - `Brand & Logo`, `Anyaman Alur — dua untaian menganyam, menyatu di satu titik, keluar sebagai satu alur`, `Mark-only · dua warna`, `Horizontal lockup`, `Monokrom`
  - `Color`, `Dasbor didominasi netral. Primary hanya untuk aksi utama, state aktif, dan aksen`, `Aturan mengikat:`, `Brand — Paadu Blue`, `Accent — Flow Amber`, `Neutral — 12 langkah`, `Semantic`, `Dark mode`
  - `Typography`, `Inter untuk UI, JetBrains Mono untuk nomor dokumen. Tiga bobot saja`, `Tabular numerals — wajib`, `JetBrains Mono — kode & nomor referensi`
  - `Spacing, Shape & Density`, `Border 1px lebih diutamakan daripada bayangan untuk memisahkan area`, `Nilai di luar skala ini adalah bug, bukan penyesuaian.`
  - `Actions`, `Tinggi kontrol 36px default. Lebar tidak berubah saat memuat`, `Split button`, `Size & tooltip shortcut`
  - `Form Controls`, `Label selalu di atas, tidak pernah floating. Pesan galat mengganti helper text`
  - `Status & Identity`, `Setiap status membawa ikon DAN teks — warna tidak pernah menjadi satu-satunya pembeda`, `Void memakai border dashed`, `Cancelled bukan Void`, `Tag bebas pengguna`
  - `Navigation`, `Data Display`, `Tabel adalah komponen terpenting produk ini. Ia mendapat perhatian paling banyak`
  - `Overlays`, `Maksimal dua lapisan mengambang sekaligus. Lapisan ketiga berarti arsitekturnya salah`, `Void faktur INV/2026/09/00184?`
  - `Feedback & States`, `Setiap keadaan kosong menyebut langkah berikutnya, bukan hanya kekosongannya`
  - `Accessibility`, `Focus ring — 2px, selalu terlihat`, `Status tidak pernah warna saja`, `Keyboard — aksi utama`, `Penegakan lint — build gagal, bukan peringatan`
  - Status pill: `Draft`, `Pending`, `Approved`, `Paid`, `Partial`, `Overdue`, `Cancelled`, `Void`
- **Interaksi**: SegmentedControl tema mengganti CSS variable map di root; SegmentedControl density mengganti `--row-h` (36 ↔ 44) dan mempengaruhi tabel demo; anchor nav menggulir ke section; tab demo di section 08 dapat diklik dan mengubah `state.tab`

---

### 3.3 App Shell

- **Rute**: layout, bukan rute. Wrapper untuk semua rute di dalam `/app`
- **Struktur layout**:
  ```
  Shell [flex row]
    - Sidebar (248px expanded / 56px collapsed)
      - TenantCompanySwitcher (avatar 32px + nama company + nama tenant + chevron)
        - Popover: search "Cari company…" + tenant group + trial badge + "+ Tambah Company"
      - NavScroll
        - NavItem Dashboard
        - NavGroup Penjualan → Pelanggan, Penawaran, Pesanan Penjualan, Faktur, Pembayaran Diterima
        - NavGroup Pembelian → Pemasok, Permintaan Penawaran, Pesanan Pembelian, Penerimaan Barang, Tagihan
        - NavGroup Persediaan → Produk, Gudang, Transfer Stok, Penyesuaian Stok
        - NavGroup Akuntansi → Bagan Akun, Jurnal Umum, Kas & Bank, Rekonsiliasi, Aset Tetap
        - NavGroup Pajak → Pajak Keluaran, Pajak Masukan, e-Faktur, e-Bupot
        - NavGroup HR → Karyawan, Kehadiran, Cuti, Payroll
        - NavItem Proyek, POS, Laporan
      - NavFooter: Paadu AI (amber + dot), Pengaturan, Bantuan
    - Main [flex column]
      - TopBar (56px): Breadcrumb | Search "Cari apa saja… ⌘K" | SplitButton Buat + Notifikasi(3) + FY 2026 · Jan–Des + Avatar
      - Content (padding 24px, bg-canvas)
  ```
- **Komponen**: SidebarNavItem, NavGroup, TenantCompanySwitcher, Breadcrumb, Combobox, SplitButton, IconButton, Badge, Avatar, DropdownMenu, CommandPalette, Tooltip, Logo
- **Data**: `company.name` | string · `tenant.name` | string · `tenant.trialDaysLeft` | number · `notifications.count` | number badge · `fiscalYear.label` | string (`FY 2026 · Jan–Des`) · `nav[].badge` | number
- **State halaman**: ada — sidebar collapsed/expanded, popover switcher open/closed, command palette open/closed, dropdown user open/closed, tema light/dark. **Tidak ada** — loading shell, error shell, no-permission shell
- **Copy string**:
  - Switcher: `PT Sumber Anyaman`, `Anyaman Group`, `Cari company…`, `PT Tenun Sari`, `PT Anyaman Logistik`, `Bali Mata Digital`, `Trial`, `12 hari lagi`, `CV Bali Mata Digital`, `Tambah Company`
  - Nav: `Dashboard`, `Penjualan`, `Pelanggan`, `Penawaran`, `Pesanan Penjualan`, `Faktur`, `Pembayaran Diterima`, `Pembelian`, `Persediaan`, `Akuntansi`, `Pajak`, `HR`, `Proyek`, `POS`, `Laporan`, `Paadu AI`, `Pengaturan`, `Bantuan`
  - Top bar: `Cari apa saja…`, `⌘K`, `Buat`, `Faktur Baru` `⌘N`, `Tagihan Baru` `⌘⇧B`, `Jurnal Baru` `⌘⇧J`, `Produk Baru` `⌘⇧P`, `FY 2026`, `Jan–Des`, `1.284 dokumen`, `14 jatuh tempo`
  - User dropdown: `Rina Anggraeni`, `Akuntan`, `PT Sumber Anyaman`, `Profil`, `Preferensi`, `Ganti Tema`, `Terang`, `Keluar` `⌘⇧Q`
  - Command palette: `faktur`, `esc`, `Navigasi`, `Pajak Keluaran (e-Faktur)`, `Aksi cepat`, `Buat Faktur baru`, `Ekspor daftar faktur ke XLSX` `⌘⇧E`, `Dokumen terbaru`, `INV/2026/09/00184`, `Overdue`, `INV/2026/09/00183`, `Paid`, `Tanya Paadu AI`, `"Faktur mana yang paling berisiko tidak tertagih bulan ini?"`, `↑↓ navigasi`, `⏎ buka`, `⌘⏎ tab baru`, `Hasil tanpa izin tidak pernah ditampilkan`
  - Collapsed tooltip: `Penjualan` + `G S`
  - Anotasi spesimen: `CONTENT AREA`, `Area konten screen`, `Padding 24px, latar surface-subtle, lebar penuh. Setiap screen berikutnya mengisi area ini tanpa mengubah shell.`, `Elevasi lewat surface, bukan bayangan`, `Di dark mode, bayangan tidak terlihat. Kartu naik dengan lightness surface dan border 1px.`, `Label pindah ke tooltip`, `Spesimen terpisah agar Section A tetap maksimal dua lapisan mengambang`
- **Interaksi**: klik switcher → popover (search + grouped companies); klik NavGroup → expand/collapse; klik NavItem → set aktif + navigasi; `⌘K` → command palette; `G` lalu `S` → pindah modul Penjualan; klik avatar → dropdown user; `Ganti Tema` → toggle light/dark; collapse sidebar → label pindah ke tooltip yang memuat shortcut

---

### 3.4 Business Overview

- **Rute**: `/app/dashboard`
- **Struktur layout**:
  ```
  Shell
    - PageHeader: judul "Business Overview" + subtitle company + "diperbarui 07:12, 02 Sep 2026"
      - Kanan: preset SegmentedControl + DateRangePicker + Toggle bandingkan + Button Ekspor + Button Kustomisasi Widget
    - Row 1 [grid 4]: KpiCard ×4
    - Row 2 [grid 60/40]
      - Card "Arus Kas": stacked bar 12 bulan + line saldo + legend + tooltip
      - Card "Laba Rugi Ringkas": 5 horizontal bar + nilai + % pendapatan
    - Row 3 [grid 3]
      - Card "Umur Piutang": stacked progress + tabel 5 rentang
      - Card "Umur Utang": struktur sama
      - Card "Top 5 Pelanggan": avatar + nama + nilai + %
    - Row 4 [grid 55/45]
      - Card "Perlu Tindakan": 4 task row (ikon + teks + badge + tombol aksi)
      - Card "Aktivitas Terbaru": ActivityTimeline 6 entri
    - FAB Paadu AI (absolute, kanan-bawah 24px, amber) → SidePanel
  ```
- **Komponen**: KpiCard, Card, DateRangePicker, SegmentedControl, Toggle, Button, Badge, Avatar, ActivityTimeline, ProgressBar, SidePanel, Tooltip
- **Data**:
  | Field | Tipe | Format |
  |---|---|---|
  | `cash.balance` | number | Rupiah penuh, `Rp 1.284.500.000` |
  | `cash.delta` | number | persen 1 desimal koma, `8,4%` + panah |
  | `cash.sparkline` | number[] | 8 titik, 64×20 |
  | `receivable.total` | number | Rupiah penuh |
  | `receivable.invoiceCount` | number | `34 faktur` |
  | `receivable.overdue30` | number | Rupiah singkat, `Rp 210 jt` |
  | `payable.total` / `billCount` / `dueThisWeek` | number | idem |
  | `netProfit.ytd` | number | Rupiah penuh |
  | `netProfit.margin` | number | `18,3%` |
  | `cashflow[]` | {month, in, out, balance} | sumbu Y `Rp 200jt`, rata kanan |
  | `pnl[]` | {label, amount, pctOfRevenue} | Rupiah penuh + persen |
  | `aging[]` | {bucket, amount, count} | `470.900.000` tanpa prefix, rata kanan, tabular |
  | `topCustomers[]` | {initials, name, invoiceCount, amount, pct} | — |
  | `tasks[]` | {icon, label, amount?, count, actionLabel} | — |
  | `activity[]` | {actor, verb, docRef, amount?, timestamp, meta?} | timestamp relatif: `2 menit lalu`, `1 jam lalu`, `Kemarin, 16:42` |
- **State halaman**: **ada** — loading (skeleton pada KPI ke-4 di Style Guide, pola sama berlaku), panel AI open/closed. **Tidak ada** — empty (dashboard tanpa data sama sekali), error widget gagal muat, no-permission per widget
- **Copy string**:
  - `Business Overview`, `PT Nusantara Jaya Abadi`, `Nusantara Group`, `diperbarui 07:12, 02 Sep 2026`
  - `Bulan Ini`, `Kuartal Ini`, `Tahun Ini`, `Custom`, `1 Jan – 31 Des 2026`, `Bandingkan periode lalu`, `Ekspor`, `Kustomisasi Widget`
  - KPI: `Kas & Bank`, `Rp 1.284.500.000`, `8,4%`, `vs 2025`, `Rp 1.184,9 jt`, `Piutang Usaha`, `34 faktur`, `Rp 892.300.000`, `Rp 210 jt jatuh tempo >30 hari`, `Utang Usaha`, `19 tagihan`, `Rp 447.100.000`, `Rp 88 jt jatuh tempo minggu ini`, `Laba Bersih (YTD)`, `Rp 612.750.000`, `12,1%`, `Margin 18,3%`
  - `Arus Kas`, `12 bulan`, `Jan – Des 2026`, `Pemasukan`, `Pengeluaran`, `Saldo kas`, `September 2026`, `Rp 1.210 jt`, `Rp 990 jt`, `Rp 1.920 jt`
  - `Laba Rugi Ringkas`, `% terhadap pendapatan`, `Lihat laporan`, `Pendapatan`, `Rp 3.348.000.000`, `100%`, `HPP`, `Rp 2.108.000.000`, `63,0%`, `Laba Kotor`, `Rp 1.240.000.000`, `37,0%`, `Beban Operasional`, `Rp 627.250.000`, `18,7%`, `Laba Bersih`, `18,3%`
  - `Umur Piutang`, `Rp 892,3 jt`, `Rentang`, `Nilai`, `Faktur`, `Belum jatuh tempo`, `1–30 hari`, `31–60 hari`, `61–90 hari`, `>90 hari`
  - `Umur Utang`, `Rp 447,1 jt`, `Tagihan`
  - `Top 5 Pelanggan`, `61,4% dari pendapatan`, `PT Nusantara Jaya Abadi`, `PT Global Mandiri Persada`, `CV Sinar Terang`, `PT Anyaman Nusantara`, `CV Karya Bahari`
  - `Perlu Tindakan`, `4 hal menunggu Anda`, `Faktur jatuh tempo hari ini`, `Rp 118,4 jt`, `Tagih`, `Transaksi bank belum dikategorikan`, `Kategorikan`, `Tagihan menunggu persetujuan Anda`, `Rp 63,2 jt`, `Tinjau`, `e-Faktur Maret 2026 belum dilaporkan`, `terlambat 154 hari`, `Lapor`
  - `Aktivitas Terbaru`, `Semua aktivitas`, `Rani Kusuma`, `menyetujui`, `PO-2026-0451`, `2 menit lalu`, `Budi Santoso`, `memposting`, `INV/2026/09/00184`, `ke jurnal`, `18 menit lalu`, `mengusulkan kategori untuk 5 transaksi bank`, `1 jam lalu`, `menunggu tinjauan`, `Dewi Saraswati`, `mencatat pelunasan`, `Rp 84.300.000`, `dari CV Sinar Terang`, `3 jam lalu`, `Agus Pratama`, `membuat transfer stok`, `TS-2026-0188`, `ke Gudang Surabaya`, `Kemarin, 16:42`, `mem-void`, `INV/2026/08/00317`, `Kemarin, 09:15`, `alasan: duplikat`
  - Panel AI: `Konteks: Business Overview`, `FY 2026`, `Setiap jawaban menyertakan dokumen sumbernya. Angka dari AI selalu dapat diperiksa dan tidak pernah langsung diposting.`, `Contoh pertanyaan`, `Kenapa margin turun bulan ini?`, `Siapa pelanggan yang paling telat bayar?`, `Buatkan ringkasan arus kas kuartal ini.`, `Terakhir ditanyakan`, `Berapa PPN keluaran Agustus?`, `Bandingkan HPP Q2 dan Q3`, `Tanya tentang data Anda…`, `Jawaban berdasarkan data PT Nusantara Jaya Abadi saja.`
  - Shortcut FAB: `⌘J`
- **Interaksi**: preset → set date range + refresh widget; toggle bandingkan → tampilkan delta `vs 2025` di semua KPI; hover batang chart → tooltip bulan (`September 2026` + 3 nilai); `Lihat laporan` → `/app/laporan/laba-rugi`; tombol task → aksi modul terkait; `Semua aktivitas` → halaman audit; FAB / `⌘J` → panel AI dengan konteks halaman terisi otomatis

---

### 3.5 Faktur Penjualan (list view)

Template untuk semua modul transaksional (Pesanan Pembelian, Produk, Karyawan, dll).

- **Rute**: `/app/penjualan/faktur`
- **Struktur layout**:
  ```
  Shell
    - PageHeader: "Faktur Penjualan · 248" + "86 faktur cocok dengan 3 filter aktif"
      - Kanan: Button ghost Impor, Button ghost Ekspor, Button primary "+ Faktur Baru ⌘N"
    - FilterRow
      - SearchWithChips: [Status: Belum Lunas ×] [Periode: Q1 2026 ×] [Pelanggan: PT Nusantara ×] + input + "Bersihkan"
      - Kanan: Dropdown Filter, Dropdown Kelompokkan, Dropdown Tampilan Tersimpan, SegmentedControl List/Kanban/Kalender
    - StatSummaryRow [4]: Total Nilai, Sudah Dibayar, Belum Dibayar, Jatuh Tempo (danger)
    - Table (sticky header, sticky kolom aksi, footer total sticky, 12 baris)
    - BulkActionBar (muncul saat ada baris terpilih)
    - Footer: "1–12 dari 86" + Pagination + "50 / halaman"
    - Varian: EMPTY STATE (filter), LOADING (skeleton)
  ```
- **Komponen**: SearchWithChips, FilterChip, DropdownMenu, SegmentedControl, StatSummaryRow, Table, Badge, Checkbox, BulkActionBar, Pagination, EmptyState, Skeleton, IconButton
- **Data**:
  | Field | Tipe | Format |
  |---|---|---|
  | `selected` | boolean | Checkbox, header indeterminate |
  | `number` | string | mono 13px, link, `INV/2026/03/00312` |
  | `date` | date | `04 Mar 2026`, rata kiri |
  | `customer` | string | teks, truncate |
  | `dueDate` | date | `03 Apr 2026`; jika terlampaui → `--danger-text` + ikon peringatan 12px |
  | `total` | number | `184.750.000`, rata kanan, tabular, tanpa prefix |
  | `remaining` | number | rata kanan, tabular; >0 → weight 500; overdue → `--danger-text` |
  | `status` | enum | Badge: Overdue, Lunas, Sebagian, Disetujui, Menunggu, Draft, Void, Dibatalkan |
  | footer | number | `1.081.350.000` / `757.960.000`, weight 600 |
- **State halaman**: **ada** — default, loading (skeleton dengan header + lebar kolom final), empty karena filter, baris terpilih (bulk bar). **Tidak ada** — empty karena belum ada data sama sekali (ada di System States), error gagal muat tabel, no-permission
- **Copy string**:
  - `Faktur Penjualan`, `248`, `86 faktur cocok dengan 3 filter aktif`, `Impor`, `Ekspor`, `Faktur Baru`, `⌘N`
  - `Status: Belum Lunas`, `Periode: Q1 2026`, `Pelanggan: PT Nusantara`, `Cari nomor, pelanggan, atau nominal…`, `Bersihkan`, `Filter`, `Kelompokkan`, `Semua Faktur`
  - `Total Nilai`, `Rp 4.218.600.000`, `Sudah Dibayar`, `Rp 2.640.400.000`, `Belum Dibayar`, `Rp 1.578.200.000`, `Jatuh Tempo`, `Rp 462.100.000`
  - Kolom: `No. Faktur`, `Tanggal`, `Pelanggan`, `Jatuh Tempo`, `Total`, `Sisa Tagihan`, `Status`, `Aksi`
  - Baris: `INV/2026/03/00312` `04 Mar 2026` `03 Apr 2026` `184.750.000` `Overdue` · `INV/2026/03/00308` `02 Mar 2026` `CV Sinar Terang` `01 Apr 2026` `62.400.000` `Lunas` · `INV/2026/03/00301` `28 Feb 2026` `PT Global Mandiri Persada` `30 Mar 2026` `148.900.000` `59.560.000` `Sebagian` · `INV/2026/02/00287` `24 Feb 2026` `PT Anyaman Nusantara` `26 Mar 2026` `96.250.000` · `INV/2026/02/00276` `19 Feb 2026` `CV Karya Bahari` `21 Mar 2026` `43.800.000` · `INV/2026/02/00268` `16 Feb 2026` `18 Mar 2026` `212.500.000` `Disetujui` · `INV/2026/02/00255` `11 Feb 2026` `PT Dirgantara Sejahtera` `13 Mar 2026` `78.300.000` `Menunggu` · `INV/2026/02/00241` `06 Feb 2026` `CV Bahtera Kencana` `31.500.000` `Draft` · `INV/2026/01/00229` `30 Jan 2026` `01 Mar 2026` `124.000.000` `37.200.000` · `INV/2026/01/00214` `22 Jan 2026` `PT Samudra Biru Nusantara` `21 Feb 2026` `57.900.000` · `INV/2026/01/00203` `15 Jan 2026` `14 Feb 2026` `22.400.000` `Void` · `INV/2026/01/00191` `08 Jan 2026` `07 Feb 2026` `18.650.000` `Dibatalkan`
  - `Total 12 baris di halaman ini`, `1–12 dari 86`, `50 / halaman`
  - Bulk: `4 dipilih`, `Kirim Email`, `Tandai Lunas`, `Unduh PDF`, `Hapus`, `Batal`, `esc`
  - Empty: `VARIAN — EMPTY STATE`, `Kekosongan karena filter, bukan karena data tidak ada — filter aktif tetap ditampilkan`, `Tidak ada faktur yang cocok`, `Tiga filter sedang aktif. Longgarkan salah satunya, atau bersihkan semua untuk melihat 248 faktur.`, `Bersihkan semua filter`
  - Loading: `VARIAN — LOADING (SKELETON)`, `Header dan lebar kolom sudah final agar tabel tidak melompat saat data tiba`
- **Interaksi**: klik `No. Faktur` → detail; klik header kolom → sort (ikon arah + angka urutan sort); checkbox header → pilih semua di halaman (indeterminate saat sebagian); ada pilihan → BulkActionBar; `×` pada chip → hapus satu filter; `Bersihkan` → hapus semua filter; `⋯` per baris → DropdownMenu aksi; ganti `50 / halaman` → reset ke halaman 1

---

### 3.6 Faktur Detail

Template untuk semua form dokumen.

- **Rute**: `/app/penjualan/faktur/:id`
- **Struktur layout**:
  ```
  Shell
    - Layout [flex-1 | 360px]
      - Document
        - StickyHeader: breadcrumb, nomor faktur (mono 24px), Badge status,
          meta "dibuat 04 Mar 2026 oleh Budi Santoso", pager "4 dari 248" + prev/next,
          Button Batal, Button primary Simpan ⌘S, IconButton ⋯
        - Stepper horizontal: Draft → Terkirim → Menunggu Pembayaran → Lunas
        - InfoPanel [2 kolom]: Pelanggan (+NPWP, link profil), Alamat Penagihan,
          Tanggal Faktur, Jatuh Tempo (+Terlambat 152 hari), Syarat Pembayaran,
          Mata Uang (+kurs), Referensi PO Pelanggan, Sales Person, Tag
        - LineItemTable [9 kolom] + "+ Tambah Baris" + "+ Tambah Bagian"
        - DocumentTotals (kanan): Subtotal → Sisa Tagihan
        - Tabs: Catatan & Syarat | Info Pengiriman | Jurnal Akuntansi
          - JournalTable: Akun | Nama Akun | Debit | Kredit + baris Seimbang
      - Chatter (360px)
        - Tabs: Aktivitas | Komentar | Lampiran | Audit
        - Pengikut: AvatarGroup + tombol tambah
        - Kotak komentar (mention @) + Kirim
        - ActivityTimeline (audit diff, komentar, email, status, AI, asal dokumen)
    - Spesimen terpisah: DropdownMenu ⋯, versi mobile 390px
  ```
- **Komponen**: Stepper, Badge, Button, IconButton, DropdownMenu, LineItemTable, DocumentTotals, Tabs, JournalTable, SidePanel, ActivityTimeline, AvatarGroup, Textarea, Avatar, Breadcrumb
- **Data**:
  | Field | Tipe | Format |
  |---|---|---|
  | `number` | string | mono 24px, `INV-2026-0184` |
  | `status` | enum | Badge `Menunggu Pembayaran` |
  | `customer` / `npwp` | string | `01.234.567.8-901.000` mono |
  | `invoiceDate` / `dueDate` | date | `04 Mar 2026` |
  | `overdueDays` | number | `Terlambat 152 hari`, danger |
  | `terms` | string | `NET 30` |
  | `currency` / `rate` | string / number | `IDR — Rupiah`, `Kurs 1,00` |
  | `poRef` | string | mono `PO-NJA-2026-0771` |
  | `lines[]` | {no, product, description, qty, uom, unitPrice, discount, tax, amount} | qty & harga rata kanan tabular; diskon `5%` / `2,5%`; pajak `PPN 11%` |
  | `totals` | {subtotal, discount, dpp, ppn, pph23, total, paid, remaining} | negatif dengan `−`; `Sisa Tagihan` weight 600 ukuran lebih besar |
  | `journal[]` | {account, name, debit, credit} | akun mono `1-10200`; debit/kredit rata kanan |
  | `activity[]` | {actor, type, verb, target, timestamp, diff?} | diff `Jatuh Tempo: 15 Mar 2026 → 30 Mar 2026`; timestamp `Hari ini, 09:24` / `04 Mar 2026, 11:32` |
- **State halaman**: **ada** — dokumen terisi, chatter terbuka, dropdown ⋯ terbuka, versi mobile. **Tidak ada** — loading detail, error gagal muat, no-permission (dokumen company lain), state edit baris item aktif (sel dalam mode input), state dokumen Draft (semua field editable), state readonly setelah Void
- **Copy string**:
  - `Faktur Penjualan`, `INV-2026-0184`, `Menunggu Pembayaran`, `PT Nusantara Jaya Abadi`, `dibuat 04 Mar 2026 oleh Budi Santoso`, `4 dari 248`, `Batal`, `Simpan`, `⌘S`
  - Stepper: `Draft`, `Terkirim`, `Lunas`
  - Info: `NPWP 01.234.567.8-901.000`, `Alamat Penagihan`, `Jl. Raya Bypass Ngurah Rai No. 142`, `Denpasar Selatan, Bali 80228`, `Tanggal Faktur`, `04 Mar 2026`, `Jatuh Tempo`, `03 Apr 2026`, `Terlambat 152 hari`, `Syarat Pembayaran`, `NET 30`, `Mata Uang`, `IDR — Rupiah`, `Kurs 1,00`, `mata uang fungsional`, `Referensi PO Pelanggan`, `PO-NJA-2026-0771`, `Sales Person`, `Dewi Saraswati`, `Tim Penjualan Bali`, `Tag`, `Ekspor`, `Prioritas`, `Proyek Sekar Jagad`, `+ Tag`
  - Tabel item: `#`, `Produk / Jasa`, `Deskripsi`, `Qty`, `Satuan`, `Harga Satuan`, `Diskon`, `Pajak`, `Jumlah`, `Kain Tenun Ikat Premium`, `Motif Sekar Jagad, lebar 115 cm`, `120`, `Meter`, `285.000`, `5%`, `PPN 11%`, `32.490.000`, `Jasa Finishing & Quality Control`, `Termasuk uji susut dan uji warna`, `Lot`, `12.500.000`, `Benang Katun Mercerized 40s`, `Gulungan 2 kg · warna indigo`, `450`, `Kilogram`, `96.000`, `2,5%`, `42.120.000`, `Pengemasan & Labeling`, `Kemasan karton + label barcode`, `800`, `Pcs`, `8.500`, `6.800.000`, `Tambah Baris`, `Tambah Bagian`
  - Totals: `Subtotal`, `96.700.000`, `Diskon`, `−2.790.000`, `DPP`, `93.910.000`, `PPN 11%`, `10.330.100`, `PPh 23 (2% atas jasa)`, `−386.000`, `Total`, `103.854.100`, `Sudah Dibayar`, `−40.000.000`, `Sisa Tagihan`, `Rp 63.854.100`
  - Tabs: `Catatan & Syarat`, `Info Pengiriman`, `Jurnal Akuntansi`, `Jurnal terbentuk otomatis saat faktur diposting dan tidak dapat diedit dari sini. Perubahan hanya melalui jurnal pembalik.`, `Akun`, `Nama Akun`, `Debit`, `Kredit`, `1-10200`, `Piutang Usaha`, `1-10310`, `PPh 23 Dibayar di Muka`, `386.000`, `4-40100`, `Pendapatan Penjualan`, `2-20300`, `PPN Keluaran`, `Seimbang`, `104.240.100`
  - Chatter: `Aktivitas`, `Komentar`, `Lampiran`, `Audit`, `Pengikut`, `+2`, `@Rani Kusuma tolong cek ulang PPh 23-nya…`, `Kirim`
  - Timeline: `Rani Kusuma`, `mengubah`, `Hari ini, 09:24`, `Jatuh Tempo:`, `15 Mar 2026`, `→`, `30 Mar 2026`, `menambahkan komentar`, `Hari ini, 08:51`, `Pelanggan minta tempo diperpanjang 15 hari. Sudah disetujui lisan oleh Pak Hendra.`, `Sistem`, `mengirim email ke`, `finance@nusantarajaya.co.id`, `Kemarin, 16:08`, `Terkirim`, `dibuka 2×`, `Budi Santoso`, `mengubah status menjadi`, `04 Mar 2026, 11:32`, `Status:`, `memposting faktur ke jurnal`, `JV/2026/03/00921`, `04 Mar 2026, 11:30`, `menandai risiko keterlambatan pembayaran`, `04 Mar 2026, 11:31`, `Pelanggan ini rata-rata melunasi 12 hari setelah jatuh tempo pada 6 faktur terakhir.`, `membuat faktur dari`, `SO-2026-0308`, `04 Mar 2026, 10:12`
  - Menu ⋯: `Duplikat` `⌘D`, `Cetak` `⌘P`, `Void faktur`
  - Mobile: `VERSI MOBILE — 390px`, `Tahap 3 dari 4`, `Dibayar Rp 40.000.000`, `Total Rp 103.854.100`, `Jatuh tempo 03 Apr 2026 · terlambat 152 hari`, `Tanggal`, `Syarat`, `Ref. PO`, `Sales`, `Baris Item`, `Tambah`, `diskon 5%`, `120 Meter × Rp 285.000`, `Rp 32.490.000`, `1 Lot × Rp 12.500.000`, `450 Kg × Rp 96.000`, `800 Pcs × Rp 8.500`, `PPh 23`, `Tulis komentar…`, `Catat Bayar`
  - Rasional desain mobile: `Sisa Tagihan naik ke atas.`, `Status bar jadi progress 4 segmen.`, `Baris item jadi card.`, `Chatter jadi bottom sheet.`, `Satu aksi utama di bar bawah.`
- **Interaksi**: prev/next pager → dokumen ke-3 / ke-5 dari 248 tanpa keluar dari view; klik sel baris item → editable inline; `+ Tambah Baris` → baris kosong dengan fokus di kolom Produk; tab `Jurnal Akuntansi` → tabel debit/kredit read-only; `@` di kotak komentar → autocomplete pengikut; `⋯` → Duplikat / Cetak / Void; `Void faktur` → modal konfirmasi (di Style Guide); mobile: chatter peek → drag ke atas jadi timeline penuh

---

### 3.7 Onboarding Wizard

- **Rute**: `/onboarding/:step` (`akun`, `organisasi`, `perusahaan`, `undang-tim`) — layar penuh, **tanpa shell**
- **Struktur layout**:
  ```
  Page (tanpa sidebar/top bar)
    - Stepper atas: Akun → Organisasi → Perusahaan → Undang Tim (+ "Langkah N dari 4")
    - Grid [ilustrasi kiri | form kanan]
      - Kiri: ilustrasi geometris "anyaman alur" yang berkembang tiap langkah + judul + penjelasan
      - Kanan: kartu form
        - Langkah 2: Nama Organisasi, SlugField (+preview URL, indikator), RegionCard ×3, PlanCard ×4
        - Langkah 3: Nama Legal, NpwpField, Mata Uang, Bulan Awal Fiskal, Alamat, Status PKP
          + panel bantuan kontekstual kanan ("Kenapa ini penting", 4 poin)
        - Langkah 4: InviteRow ×3 + input tambah + tautan undangan + panel "Peran yang tersedia"
      - Footer: Button Kembali / Lewati + Button primary lanjut
  ```
- **Komponen**: Stepper, Input, SlugField, NpwpField, RegionCard, PlanCard, InviteRow, Select, Checkbox, Button, InlineAlert, Logo
- **Data**:
  | Field | Tipe | Format |
  |---|---|---|
  | `tenant.name` | string | teks bebas |
  | `tenant.slug` | string | lowercase + angka + hyphen; preview `paadu.app/nusantara-group` |
  | `tenant.slugAvailable` | boolean | `Tersedia` ✓ / sudah dipakai ✗ |
  | `tenant.region` | enum | `Indonesia` / `Singapura` / `Global` |
  | `tenant.plan` | enum | `Trial` (default) / `Starter` / `Business` / `Enterprise` |
  | `company.legalName` | string | wajib bentuk badan usaha |
  | `company.npwp` | string | mask `00.000.000.0-000.000`, 15 atau 16 digit |
  | `company.currency` | enum | `IDR — Rupiah`, final |
  | `company.fiscalStartMonth` | number 1–12 | `Januari (1)` → label `FY 2026 · Jan – Des 2026` |
  | `company.address` | text | multiline |
  | `company.isPkp` | boolean | mengaktifkan PPN 11% + e-Faktur |
  | `invites[]` | {email, role, scope} | role: Tenant Admin / Company Admin / Member |
  | `inviteLink` | string | `paadu.app/join/nusantara-group?t=8f3c1a92`, berlaku 7 hari |
- **State halaman**: **ada** — langkah 2, 3, 4; slug tersedia/terpakai; NPWP valid. **Tidak ada** — langkah 1 (Akun), state submitting, state error validasi server, slug sedang diperiksa (loading), state undangan gagal terkirim
- **Copy string**:
  - Langkah 2: `LANGKAH 2 — ORGANISASI (TENANT)`, `Slug menentukan URL tenant dan tidak dapat diubah setelah dibuat`, `Satu organisasi, banyak perusahaan`, `Organisasi adalah wadah tertinggi — tempat pengguna, peran, dan tagihan hidup. Setiap PT di dalamnya punya buku besar sendiri yang terpisah rapi.`, `Akun`, `Organisasi`, `Perusahaan`, `Undang Tim`, `Buat organisasi Anda`, `Nama ini muncul di kop dokumen dan pengalih perusahaan. Anda dapat mengubahnya nanti — kecuali slug.`, `Nama Organisasi`, `Nusantara Group`, `Slug`, `paadu.app/`, `nusantara-group`, `Tersedia`, `Huruf kecil, angka, dan tanda hubung.`, `Tidak dapat diubah setelah organisasi dibuat.`, `Contoh slug yang sudah dipakai: nusantara — coba tambahkan pembeda seperti nama kota atau bidang usaha.`, `Region penyimpanan data`, `Indonesia`, `Jakarta · patuh PP 71/2019`, `Singapura`, `Latensi rendah se-ASEAN`, `Global`, `Multi-region, replikasi`, `Region tidak dapat dipindah setelah data pertama masuk.`, `Plan`, `Trial`, `14 hari`, `Semua fitur Business. Tanpa kartu kredit.`, `Starter`, `Rp 199 rb`, `1 company · 3 pengguna`, `Business`, `Rp 749 rb`, `5 company · 20 pengguna`, `Enterprise`, `Hubungi`, `Tanpa batas · SSO · SLA`, `Kembali`, `Langkah 2 dari 4`, `Lanjut ke Perusahaan`
  - Langkah 3: `LANGKAH 3 — PERUSAHAAN (COMPANY)`, `NPWP bermask · bulan awal tahun fiskal menentukan seluruh laporan`, `Perusahaan pertama Anda`, `Setiap perusahaan punya NPWP, mata uang, dan tahun fiskalnya sendiri. Tambahkan perusahaan lain kapan pun tanpa memindahkan data.`, `Data perusahaan`, `Data ini dipakai di faktur, dokumen pajak, dan seluruh laporan keuangan perusahaan ini.`, `Nama Legal`, `PT Nusantara Jaya Abadi`, `Tulis sesuai akta — termasuk bentuk badan usaha (PT, CV, UD).`, `NPWP`, `01.234.567.8-901.000`, `15 digit · valid`, `Format 00.000.000.0-000.000 terisi otomatis. Menerima 15 digit (lama) dan 16 digit NIK badan.`, `Mata Uang Default`, `IDR — Rupiah`, `Mata uang buku besar. Tidak dapat diubah nanti.`, `Bulan Awal Tahun Fiskal`, `Januari (1)`, `FY 2026 · Jan – Des 2026`, `Alamat`, `Jl. Raya Bypass Ngurah Rai No. 142`, `Denpasar Selatan, Bali 80228`, `Status PKP`, `Perusahaan ini Pengusaha Kena Pajak`, `Mengaktifkan PPN 11%, e-Faktur, dan akun PPN Keluaran/Masukan.`, `Kenapa ini penting`, `NPWP tidak bisa diperbaiki belakangan`, `Nomor ini tercetak di setiap faktur pajak. Mengoreksinya setelah ada e-Faktur terbit berarti membatalkan dan menerbitkan ulang dokumen.`, `Bulan fiskal mengunci seluruh laporan`, `Neraca, laba rugi, dan penutupan periode dihitung dari bulan ini. Mengubahnya setelah ada transaksi akan menggeser semua komparasi tahun sebelumnya.`, `Mata uang buku besar bersifat final`, `Transaksi valuta asing tetap bisa dicatat dengan kurs, tapi buku besar selalu dilaporkan dalam mata uang ini.`, `Satu PT = satu company`, `Jangan gabungkan dua badan usaha dalam satu company hanya karena pemiliknya sama — pemeriksaan pajak menuntut buku yang terpisah.`, `Langkah 3 dari 4`, `Lanjut ke Undang Tim`
  - Langkah 4: `LANGKAH 4 — UNDANG TIM`, `Peran dipilih per undangan · tautan undangan bisa disalin`, `Kerja bersama sejak hari pertama`, `Peran menentukan apa yang dapat dilihat dan diubah. Tenant Admin mengelola organisasi; Company Admin hanya perusahaan yang ditugaskan.`, `Undang tim Anda`, `Lewati langkah ini jika ingin bekerja sendiri dulu — anggota tim dapat diundang kapan pun dari Pengaturan.`, `Undangan`, `3 dari 20 kursi terpakai`, `rani.kusuma@nusantarajaya.co.id`, `Tenant Admin`, `Dapat membuat company baru dan mengubah pengaturan organisasi.`, `budi.santoso@nusantarajaya.co.id`, `Company Admin`, `Terbatas pada PT Nusantara Jaya Abadi.`, `dewi.saraswati@nusantarajaya.co.id`, `Member`, `nama@perusahaan.co.id`, `Tambah undangan`, `Tempel beberapa email sekaligus — dipisah koma, spasi, atau baris baru.`, `Atau bagikan tautan undangan`, `Salin tautan`, `paadu.app/join/nusantara-group?t=8f3c1a92`, `Berlaku 7 hari`, `setiap pendaftar masuk sebagai Member dan menunggu persetujuan Anda.`, `Peran yang tersedia`, `Mengelola organisasi: membuat dan menghapus company, mengatur tagihan, dan mengelola semua pengguna.`, `Penuh di company yang ditugaskan — termasuk menyetujui faktur dan menutup periode — tanpa akses ke company lain.`, `Membuat dan mengedit dokumen sesuai izin modul. Tidak dapat mengubah pengaturan atau menyetujui.`, `Peran kustom`, `Butuh kombinasi lain? Buat peran sendiri di Pengaturan → Pengguna & Peran setelah onboarding.`, `Lewati`, `Langkah 4 dari 4`, `Kirim 3 undangan & selesai`
- **Interaksi**: ketik Nama Organisasi → slug ter-generate otomatis (bisa diedit); slug diperiksa → indikator tersedia/terpakai + saran pembeda; pilih region → kartu terpilih (final setelah data pertama); pilih plan → Trial default; NPWP → mask otomatis + validasi 15/16 digit; pilih Bulan Awal Fiskal → label FY diperbarui; toggle PKP → mengaktifkan PPN 11% + e-Faktur; `Tambah undangan` → InviteRow baru; `Salin tautan` → clipboard; `Lewati` di langkah 4 → langsung ke dashboard

---

### 3.8 Pengaturan — Pengguna & Peran

- **Rute**: `/app/pengaturan/pengguna` (tab lain: `/organisasi`, `/perusahaan`, `/keamanan`, `/integrasi`, `/tagihan`)
- **Struktur layout**:
  ```
  Shell
    - PageHeader: "Nusantara Group · 4 perusahaan · plan Business"
    - Tabs: Organisasi | Perusahaan (4) | Pengguna & Peran (7) | Keamanan | Integrasi | Tagihan
    - Grid [1fr | panel kanan]
      - Kolom utama
        - Card Pengguna
          - Toolbar: "7 dari 20 kursi terpakai · 1 undangan menunggu" + search + Select peran + Button "Undang Pengguna"
          - Table (7 baris, kolom Nama sticky-left, header sticky-top)
        - Card Matriks Izin
          - Legend: Penuh ✓ / Terbatas ◐ / Tidak ada ✗
          - Table: 6 aksi × 4 peran (kolom Tenant Owner terkunci)
          - Footer: Button "Simpan perubahan izin"
      - Panel kanan
        - Card Peran Kustom (2 dari 5) + Button "Buat peran baru"
        - Card Temuan Paadu AI (amber)
  ```
- **Komponen**: Tabs, Table, Avatar, AvatarGroup, Badge, Input search, Select, Button, PermissionMatrix, Card, InlineAlert (AI)
- **Data**:
  | Field | Tipe | Format |
  |---|---|---|
  | `user.initials` / `name` | string | Avatar 28px + nama 13px |
  | `user.email` | string | 13px, `--text-secondary` |
  | `user.role` | enum | Tenant Owner / Tenant Admin / Company Admin / Member |
  | `user.companies[]` | string[] | AvatarGroup rounded-square + `+1` |
  | `user.status` | enum | Badge Aktif / Diundang / Nonaktif |
  | `user.lastLogin` | datetime | relatif: `Hari ini, 07:04`, `Kemarin, 16:42`, `3 hari lalu`, absolut `12 Jul 2026` |
  | `matrix[action][role]` | enum | `full` ✓ / `limited` ◐ (+keterangan `≤ Rp 50 jt`, `Ditugaskan`, `Opsional`) / `none` ✗ / `locked` |
  | `customRoles[]` | {name, userCount, derivedFrom, scope} | — |
- **State halaman**: **ada** — daftar terisi, tiga status pengguna, kolom terkunci, temuan AI. **Tidak ada** — loading tabel, empty (organisasi 1 pengguna), error simpan izin, no-permission (Member membuka tab ini → seharusnya 403 di System States), state "perubahan izin belum disimpan" (dirty)
- **Copy string**:
  - `Nusantara Group`, `4 perusahaan`, `plan Business`, `Organisasi`, `Perusahaan`, `Pengguna & Peran`, `Keamanan`, `Integrasi`, `Tagihan`
  - `Pengguna`, `7 dari 20 kursi terpakai`, `1 undangan menunggu`, `Cari pengguna…`, `Semua peran`, `Undang Pengguna`
  - Kolom: `Nama`, `Email`, `Peran`, `Akses Company`, `Status`, `Login Terakhir`, `Aksi`
  - Baris: `Hendra Wijaya` `hendra.wijaya@nusantarajaya.co.id` `Tenant Owner` `Aktif` `Hari ini, 07:04` · `Rani Kusuma` `rani.kusuma@nusantarajaya.co.id` `Tenant Admin` `Hari ini, 09:24` · `Budi Santoso` `budi.santoso@nusantarajaya.co.id` `Company Admin` `Hari ini, 08:12` · `Dewi Saraswati` `dewi.saraswati@nusantarajaya.co.id` `Member` `Kemarin, 16:42` · `Agus Pratama` `agus.pratama@nusantarajaya.co.id` `3 hari lalu` · `Siti Nurhaliza` `siti.nurhaliza@sinarterang.co.id` `Diundang` · `Yoga Saputra` `yoga.saputra@nusantarajaya.co.id` `Nonaktif` `12 Jul 2026`
  - Matriks: `Matriks Izin`, `Peran bawaan · perubahan berlaku untuk semua pengguna dengan peran tersebut`, `Penuh`, `Terbatas`, `Tidak ada`, `Buat / Hapus Company`, `Membuat badan usaha baru di organisasi ini dan mengarsipkannya`, `Terkunci`, `Ya`, `Tidak`, `Ubah Pengaturan Tenant`, `Nama organisasi, region, SSO, dan kebijakan keamanan`, `Ubah Pengaturan Company`, `NPWP, tahun fiskal, bagan akun, dan penomoran dokumen`, `Ditugaskan`, `Lihat Company`, `Membuka data perusahaan dan laporannya`, `Setujui Faktur`, `Menyetujui dan memposting dokumen ke buku besar`, `≤ Rp 50 jt`, `Kelola Payroll`, `Melihat gaji, menjalankan payroll, dan mengubah komponen upah`, `Opsional`, `Kolom Tenant Owner dikunci dan diberi latar abu — bukan dikosongkan — agar tetap terbaca bahwa jawabannya "ya", bukan "belum diatur".`, `Simpan perubahan izin`
  - Panel: `Peran Kustom`, `2 dari 5`, `Kasir POS`, `4 pengguna`, `Turunan Member · hanya modul POS dan Pelanggan`, `Auditor Eksternal`, `1 pengguna`, `Hanya-baca seluruh company · tanpa akses payroll`, `Buat peran baru`, `Peran kustom selalu diturunkan dari peran bawaan, sehingga izin baru yang ditambahkan Paadu Flow tidak pernah bocor ke peran yang seharusnya terbatas.`
  - AI: `Temuan Paadu AI`, `Yoga Saputra nonaktif sejak 12 Jul 2026 tetapi masih memegang akses PT Nusantara Jaya Abadi. Cabut akses untuk mengurangi permukaan risiko.`, `Tinjau akses`
- **Interaksi**: klik tab → ganti panel pengaturan; search + Select peran → filter tabel; `⋯` per pengguna → aksi (ubah peran, cabut akses, kirim ulang undangan); klik sel matriks → siklus tri-state (kolom Tenant Owner tidak dapat diklik, tooltip menjelaskan); `Simpan perubahan izin` → commit; `Buat peran baru` → form peran turunan; `Tinjau akses` → filter tabel ke pengguna nonaktif

---

### 3.9 Paadu AI Side Panel

- **Rute**: overlay global, bukan rute. Dipicu dari FAB atau `⌘J`
- **Struktur layout**:
  ```
  SidePanel (420px, slide dari kanan, radius 12px, shadow-lg)
    - Header: logo mark 18px pada kotak amber + "Paadu AI" + IconButton percakapan baru + IconButton tutup
      - ContextSelector: "Konteks: Faktur Penjualan · Q1 2026" + chevron
    - Body (scroll)
      - State kosong: InlineAlert amber + 4 kartu saran (judul + sublabel)
      - State percakapan: bubble user → jawaban (paragraf + tabel 3 baris + chart mini 6 bulan
        + 3 tombol aksi + baris sumber + feedback/salin)
      - State loading: baris status streaming + 3 shimmer bar + skeleton tabel + checklist langkah
    - Footer: chip pertanyaan lanjutan + input 40px + IconButton kirim
  ```
- **Komponen**: SidePanel, Logo, IconButton, Button, Table, AiAnswer, Skeleton, InlineAlert
- **Data**:
  | Field | Tipe | Format |
  |---|---|---|
  | `context.label` | string | `Faktur Penjualan · Q1 2026` |
  | `suggestions[]` | {title, subtitle} | 4 kartu |
  | `messages[]` | {role, blocks[]} | blocks: `text` / `table` / `chart` / `actions` |
  | `answer.table` | {customer, lateDays, outstanding} | `34 hari` danger, `96,8 jt` rata kanan tabular |
  | `answer.chart` | {month, value}[] | 6 batang, label nilai tertinggi di atas |
  | `answer.source` | string | `Berdasarkan 248 faktur · Data per 1 Sep 2026` |
  | `streaming.steps[]` | {label, done} | checklist ✓ / kosong |
- **State halaman**: **ada** — kosong, percakapan lengkap, loading/streaming. **Tidak ada** — error (AI gagal menjawab), state "tidak ada data untuk pertanyaan ini", state konteks tidak diizinkan, riwayat percakapan (list thread)
- **Copy string**:
  - `Paadu AI`, `Konteks:`, `Faktur Penjualan · Q1 2026`
  - Kosong: `Bertanya tentang data Anda sendiri`, `Jawaban hanya diambil dari data PT Nusantara Jaya Abadi dalam konteks di atas, selalu menyebutkan sumbernya, dan tidak pernah memposting apa pun ke buku besar.`, `Saran pertanyaan`, `Siapa pelanggan yang paling telat bayar?`, `Peringkat berdasarkan rata-rata hari keterlambatan`, `Kenapa margin turun bulan ini?`, `Membandingkan HPP dan beban terhadap bulan lalu`, `Buatkan ringkasan arus kas kuartal ini`, `Pemasukan, pengeluaran, dan saldo per bulan`, `Faktur mana yang berisiko tidak tertagih?`, `Berdasarkan riwayat pembayaran tiap pelanggan`, `Tanya tentang data Anda…`
  - Percakapan: `Tiga pelanggan menyumbang 68% dari total keterlambatan. PT Global Mandiri Persada paling konsisten telat — rata-rata 34 hari setelah jatuh tempo pada 21 faktur terakhir, meski nilai tertunggaknya bukan yang terbesar.`, `Pelanggan`, `Telat`, `Tertunggak`, `PT Global Mandiri Persada`, `34 hari`, `96,8 jt`, `PT Anyaman Nusantara`, `27 hari`, `96,3 jt`, `CV Karya Bahari`, `12 hari`, `17,0 jt`, `Rata-rata hari keterlambatan`, `Okt 2025 – Mar 2026`, `Buka laporan lengkap`, `Ekspor ke Excel`, `Buatkan draft email penagihan`, `Berdasarkan 248 faktur · Data per 1 Sep 2026`, `Bandingkan dengan Q4 2025`, `Hanya faktur > Rp 50 jt`, `Tanya lanjutan…`
  - Loading: `Hentikan`, `Membaca 248 faktur dan riwayat pelunasannya…`, `Mengelompokkan per pelanggan`, `Menghitung rata-rata hari keterlambatan`, `Menyusun ringkasan`, `Menunggu jawaban…`
- **Interaksi**: klik kartu saran → kirim pertanyaan itu; ContextSelector → ganti cakupan data; `Buka laporan lengkap` → navigasi laporan; `Ekspor ke Excel` → unduh; `Buatkan draft email penagihan` → buka composer; feedback 👍/👎 → kirim rating; salin → clipboard; chip lanjutan → pertanyaan turunan; `Hentikan` → batalkan streaming; tombol kirim disabled selama streaming

---

### 3.10 System States

- **Rute**: `/design-system/states` (katalog). Setiap state dipakai di rute sebenarnya
- **Struktur layout**:
  ```
  Page
    - Header: judul + prinsip nada
    - 01 Empty state [grid 3]: belum ada faktur | hasil filter kosong | belum ada company kedua
    - 02 Error
      - [grid 3]: 403 | 404 | 500
      - [grid 2]: Banner offline (gelap) | Banner trial (amber)
    - 03 Tenant suspended & konfirmasi destruktif [grid 1.35 / 1]
      - Layar penuh gelap tenant suspended
      - Modal hapus company dengan input ketik-nama
  ```
- **Komponen**: EmptyState, ErrorPage, Banner, SuspendedScreen, Modal, Button, Input, InlineAlert
- **Data**:
  | Field | Tipe | Format |
  |---|---|---|
  | `error.code` | enum | 403 / 404 / 500 |
  | `error.requiredRole` | string | `Company Admin` |
  | `error.currentRole` | string | `Member` |
  | `error.adminName` | string | `Rani Kusuma` |
  | `error.eventCode` | string | mono `ERR-8F3C-1A92 · 02 Sep 2026 07:14` |
  | `offline.pendingCount` | number | `3 perubahan menunggu` |
  | `trial.daysLeft` / `endDate` | number / date | `3 hari` / `5 Sep 2026` |
  | `suspended.amount` | number | `Rp 8.988.000` |
  | `suspended.dueDate` | date | `15 Agu 2026` |
  | `suspended.retentionUntil` | date | `30 Nov 2026` |
  | `deleteImpact[]` | {label, value} | `1.284 dokumen`, `3.912 entri`, `640 berkas · 2,1 GB`, `3 orang` |
  | `confirmPhrase` | string | harus cocok tepat dengan nama company |
- **State halaman**: halaman ini **adalah** katalog state. Yang tercakup: empty ×3, 403, 404, 500, offline, trial ending, suspended, destructive confirm. Yang **tidak** tercakup: 401 sesi berakhir, 429 rate limit, maintenance window, konflik edit bersamaan, upload gagal
- **Copy string**:
  - `System States`, `Setiap keadaan menyebutkan apa yang terjadi, apa akibatnya, dan satu langkah berikutnya. Nada tenang: tanpa permintaan maaf berlebihan, tanpa lelucon, tanpa menyalahkan pengguna.`
  - Empty: `Belum ada faktur`, `Belum ada Faktur Penjualan`, `Faktur pertama akan otomatis membentuk jurnal penjualan dan piutang begitu diposting.`, `Buat faktur`, `Impor dari XLSX`, `Hasil filter kosong`, `Tidak ada faktur yang cocok`, `Tiga filter sedang aktif. Kekosongan ini hasil filter, bukan tanda datanya tidak ada.`, `Status: Void`, `Nilai > 1 M`, `Q1 2026`, `Bersihkan semua filter`, `Belum ada company kedua`, `Satu perusahaan di organisasi ini`, `Tambahkan perusahaan kedua bila Anda mengelola lebih dari satu badan usaha. Buku besarnya terpisah, penggunanya tetap satu.`, `Tambah company`, `Pelajari dulu`, `Plan Business · 1 dari 5 company terpakai`
  - 403: `Anda tidak punya akses ke halaman ini`, `Payroll hanya dapat dibuka oleh Company Admin pada perusahaan yang ditugaskan. Peran Anda saat ini Member di PT Nusantara Jaya Abadi.`, `Minta Tenant Admin Anda — Rani Kusuma — menaikkan peran, atau minta akses satu kali untuk periode tertentu.`, `Minta akses`, `Kembali ke Dashboard`
  - 404: `Dokumen tidak ditemukan`, `INV-2026-0912 tidak ada di PT Nusantara Jaya Abadi. Dokumen mungkin dihapus saat masih draf, atau berada di perusahaan lain.`, `Cari di semua company`, `Daftar faktur`
  - 500: `Terjadi kegagalan di sisi kami`, `Permintaan gagal diproses. Tidak ada data yang berubah — tidak ada jurnal yang terbentuk dan draf Anda tetap tersimpan.`, `Kode kejadian`, `ERR-8F3C-1A92 · 02 Sep 2026 07:14`, `Coba lagi`, `Salin kode & lapor`
  - Offline: `Koneksi terputus. Perubahan disimpan di perangkat ini dan akan dikirim otomatis saat koneksi kembali.`, `3 perubahan menunggu`, `Coba sambungkan`
  - Trial: `Trial berakhir dalam 3 hari — 5 Sep 2026. Setelah itu data tetap aman, tetapi hanya dapat dibaca sampai plan dipilih.`, `Pilih plan`, `Ingatkan besok`
  - Suspended: `Organisasi ditangguhkan`, `Nusantara Group sementara tidak dapat diakses`, `Tagihan 1 Agu 2026 belum terbayar setelah tiga kali pengingat. Seluruh data Anda utuh dan disimpan penuh selama 90 hari — tidak ada yang dihapus.`, `Tagihan`, `Rp 8.988.000`, `Jatuh tempo`, `15 Agu 2026`, `Data disimpan s.d.`, `30 Nov 2026`, `Hubungi tim billing`, `Bayar sekarang`, `Hanya Hendra Wijaya (Tenant Owner) yang dapat menyelesaikan pembayaran. Butuh ekspor data selama masa ini? Tim billing dapat membukanya untuk Anda.`
  - Destruktif: `Hapus company PT Anyaman Logistik?`, `Tindakan ini menghapus permanen seluruh data perusahaan ini dan tidak dapat dibatalkan.`, `Yang akan hilang`, `Faktur & tagihan`, `1.284 dokumen`, `Jurnal terposting`, `3.912 entri`, `Lampiran`, `640 berkas · 2,1 GB`, `Pengguna kehilangan akses`, `3 orang`, `Dokumen pajak yang sudah dilaporkan wajib disimpan 10 tahun. Pertimbangkan mengarsipkan alih-alih menghapus.`, `Ketik PT Anyaman Logistik untuk konfirmasi`, `Nama belum sama — tombol hapus terbuka setelah teks cocok tepat.`, `Arsipkan saja`, `Batal`, `esc`, `Hapus permanen`
- **Interaksi**: `Minta akses` → kirim permintaan ke Tenant Admin; `Cari di semua company` → global search lintas company; `Salin kode & lapor` → clipboard + form dukungan; `Coba sambungkan` → retry sync; `Ingatkan besok` → tunda banner 24 jam; input ketik-nama → tombol `Hapus permanen` tetap disabled sampai cocok tepat; `Arsipkan saja` → alternatif non-destruktif

---

## 4. Inkonsistensi Antar Screen

Semua baris di bawah adalah perbedaan nyata yang terukur di file, bukan dugaan.

### 4.1 Warna

| Hal yang berbeda | Screen A | Screen B | Saran |
|---|---|---|---|
| Merah muda untuk batang chart | Business Overview & AI Panel: `#E7A8A2` | Style Guide & 4 screen lain: `#F1B4AE` (`--danger-border`) | Pakai `#F1B4AE`. `#E7A8A2` tidak ada di skala mana pun — hapus, atau jadikan token baru `--danger-chart-muted` bila memang perlu batang lebih pekat |
| Amber untuk fill grafik/aksen kecil | Business Overview: `#DE9A33` · Faktur Penjualan: `#D89A34` · Pengaturan: keduanya | Style Guide: `#E8A33D` (`--accent-ai`) | Pakai `#E8A33D`. Dua varian gelap ini beda 1–2 digit dari token — hasil penyesuaian manual, bukan keputusan |
| Putih untuk sel tabel sticky | Faktur Penjualan & Faktur Detail: `#FDFDFE` | 8 screen lain: `#FFFFFF` (`--bg-surface`) | Pakai `#FFFFFF`. `#FDFDFE` tidak dapat dibedakan mata tapi memecah token |
| Abu border sekunder | Pengaturan: `#D3D8DD` dan `#3E4854` | Style Guide: `#C9CFD5` (`--border-strong`) / `#45525F` (dark) | Pakai token. Dua nilai ini hanya ada di Pengaturan |
| Latar gelap kemerahan | Faktur Penjualan: `#3A1A16` | Style Guide dark: `#2C1512` (`--danger-bg`) | Pakai `#2C1512` |
| Teal sisa rebrand | tidak ditemukan lagi | — | Bersih. Seluruh 10 file sudah memakai `#3A34B5` |

### 4.2 Ukuran & bentuk

| Hal yang berbeda | Screen A | Screen B | Saran |
|---|---|---|---|
| Radius kartu | Style Guide, Business Overview, Faktur ×2, Pengaturan, AI Panel, System States: `10px` | Brand Guidelines: `8px` / `12px` / `16px` saja — tidak ada `6px`/`10px` | Untuk UI pakai `6/10/14`. Radius Brand Guidelines adalah radius dokumen cetak; jangan diambil ke komponen |
| Tinggi tombol standar | Style Guide, App Shell, Business Overview, Faktur ×2, Onboarding, Pengaturan: `36px` | AI Panel & System States: `32px` untuk tombol aksi utama di dalam kartu | Pakai `36px` sebagai default; `32px` hanya untuk tombol di dalam panel 420px yang ruangnya sempit — jadikan `size="sm-plus"` eksplisit, bukan kebetulan |
| Lebar panel Paadu AI | AI Panel: `420px` | Business Overview: `380px` | Pakai `420px`. Tabel 3 kolom + chart di dalam jawaban tidak nyaman di 380px |
| Ukuran font isi tabel | Faktur Penjualan, Pengaturan, Faktur Detail: `13px` | Style Guide (tabel demo): `13px`, tapi header kolom `12px` di semua screen kecuali Style Guide yang juga memakai `11px` uppercase di beberapa tabel | Header kolom: `12px` weight 500 non-uppercase. Uppercase 11px hanya untuk overline kartu, bukan header tabel |
| Ukuran 15px | App Shell (input ⌘K), Faktur Detail (judul mobile), Style Guide | Tidak ada di 7 screen lain | Tambahkan `--text-body-lg: 15/22` sebagai token resmi, atau turunkan ke 14px. Sekarang ia ukuran tak bernama |
| Tinggi baris tabel | Faktur Penjualan, Faktur Detail: `36px` (compact, default) | Pengaturan: `44px` | Pengaturan memang layak comfortable (ada avatar group per baris), tapi harus lewat prop `density="comfortable"`, bukan hardcode |

### 4.3 Penamaan status

| Hal yang berbeda | Screen A | Screen B | Saran |
|---|---|---|---|
| Bahasa label status | Style Guide: `Draft`, `Pending`, `Approved`, `Paid`, `Partial`, `Overdue`, `Cancelled`, `Void` (Inggris) | Faktur Penjualan: `Draft`, `Menunggu`, `Disetujui`, `Lunas`, `Sebagian`, `Overdue`, `Dibatalkan`, `Void` (campur) | Pakai versi Indonesia dari Faktur Penjualan, **kecuali** `Overdue` → `Jatuh Tempo` dan `Void` → `Void` (istilah akuntansi yang dipakai praktisi, biarkan). Style Guide harus diperbarui agar tidak jadi sumber label Inggris |
| Status di command palette | App Shell: `Overdue`, `Paid` | Faktur Penjualan: `Overdue`, `Lunas` | Satu enum, satu tabel label. `Paid` di App Shell adalah sisa |
| Status dokumen aktif | Faktur Detail: badge `Menunggu Pembayaran` + stepper tahap 3 | Faktur Penjualan: badge `Menunggu` | `Menunggu Pembayaran` untuk detail (ada ruang), `Menunggu` untuk sel tabel. Definisikan `label` dan `labelShort` di enum, jangan dua string lepas |

### 4.4 Format data

| Hal yang berbeda | Screen A | Screen B | Saran |
|---|---|---|---|
| **Format nomor faktur** | Faktur Penjualan, App Shell, Business Overview: `INV/2026/03/00312` (slash, 5 digit) | Faktur Detail, System States: `INV-2026-0184` (hyphen, 4 digit) | Ini bug paling serius: list dan detail memakai skema berbeda untuk dokumen yang sama. Pilih satu — sarankan `INV/2026/03/00312` (slash + bulan) karena sudah dipakai di 3 screen dan mengandung periode |
| Rupiah di sel tabel | Faktur Penjualan, Business Overview (tabel aging): `184.750.000` tanpa prefix | Faktur Detail totals: `Rp 63.854.100` dengan prefix pada baris penekanan saja | Konsisten: tanpa prefix di dalam tabel (header kolom sudah menyebut `(IDR)`), dengan prefix pada nilai tunggal di luar tabel |
| Rupiah singkat | Business Overview: `Rp 210 jt`, `Rp 892,3 jt`, `Rp 1.184,9 jt`, `Rp 2,41 M` | AI Panel: `96,8 jt` (tanpa `Rp`) | Satu formatter: `Rp 892,3 jt` / `Rp 2,41 M`, satu desimal, koma sebagai pemisah desimal. Di dalam tabel boleh tanpa `Rp` |
| Format tanggal absolut | Faktur ×2, Pengaturan: `04 Mar 2026` (DD MMM YYYY) | Business Overview: `1 Jan – 31 Des 2026` (tanpa leading zero) | `DD MMM YYYY` dengan leading zero untuk data; range boleh tanpa leading zero hanya di label filter |
| Timestamp | Business Overview: `2 menit lalu`, `1 jam lalu`, `Kemarin, 16:42` | Faktur Detail: `Hari ini, 09:24`, `04 Mar 2026, 11:32` · Pengaturan: `Hari ini, 07:04`, `3 hari lalu` | Satu aturan: <60 menit → relatif menit; hari ini → `Hari ini, HH:mm`; kemarin → `Kemarin, HH:mm`; 2–6 hari → `N hari lalu`; ≥7 hari → `DD MMM YYYY`. Business Overview memakai `1 jam lalu` (bukan `Hari ini, …`) — perlu diseragamkan |
| Persentase | `8,4%`, `18,3%`, `63,0%` (koma, 1 desimal) | `2,5%` diskon, `100%` bulat | Konsisten. Hanya pastikan `100%` tidak jadi `100,0%` |
| Pemisah meta | `·` (middle dot) di 10 screen | `—` (em dash) untuk klausa | Konsisten. Pertahankan: `·` memisahkan fakta setara, `—` memisahkan klausa |

### 4.5 Gaya copy

| Hal yang berbeda | Screen A | Screen B | Saran |
|---|---|---|---|
| Judul tombol aksi | Faktur Penjualan: `Faktur Baru` (kata benda) | App Shell split button: `Faktur Baru`, tapi command palette: `Buat Faktur baru` (kata kerja + kapitalisasi campur) | Kata benda untuk tombol (`Faktur Baru`), kata kerja untuk command palette (`Buat faktur baru` — hanya kata pertama kapital) |
| Sapaan pengguna | Business Overview: `4 hal menunggu Anda`, `Tagihan menunggu persetujuan Anda` (Anda) | Style Guide & Brand Guidelines: banyak kalimat impersonal (`Setiap keadaan kosong menyebut…`) | `Anda` di UI produk; impersonal hanya di dokumen sistem desain |
| Panjang helper text | Onboarding: 2–3 kalimat penjelasan konsekuensi | Faktur ×2: 1 kalimat atau tanpa helper | Sesuai konteks — onboarding memang butuh penjelasan. Bukan bug, tapi catat sebagai aturan: helper panjang hanya untuk keputusan yang tidak dapat diubah |
| Anotasi spesimen bocor ke UI | App Shell, Faktur Penjualan, Faktur Detail, AI Panel memuat teks seperti `VARIAN — EMPTY STATE`, `Spesimen terpisah agar…`, `Keputusan versi mobile` | Business Overview, Pengaturan relatif bersih | Semua teks huruf-kapital-penuh dan blok "Keputusan …" adalah anotasi dokumentasi, **bukan copy produk**. Jangan port ke React |

---

## 5. Yang Belum Terdesain

### 5.1 Screen / rute yang belum ada

| Kebutuhan | Kenapa dibutuhkan | Referensi yang menyebutnya |
|---|---|---|
| Onboarding langkah 1 (Akun) | Stepper menampilkan 4 langkah; hanya 2–4 yang digambar | Onboarding stepper |
| Halaman login / SSO | Tidak ada satu pun layar autentikasi | Pengaturan menyebut SSO di Keamanan |
| Tab Pengaturan: Organisasi, Perusahaan, Keamanan, Integrasi, Tagihan | 5 dari 6 tab hanya label | Pengaturan tabs |
| Tampilan Kanban & Kalender | SegmentedControl List/Kanban/Kalender ada; hanya List digambar | Faktur Penjualan |
| Form "Faktur Baru" (create) | Detail hanya menampilkan dokumen berstatus Menunggu Pembayaran; state Draft-editable tidak ada | Split button `+ Buat` |
| Modul selain Penjualan | Pembelian, Persediaan, Akuntansi, Pajak, HR, Proyek, POS, Laporan — semuanya rute di sidebar tanpa screen | App Shell nav |
| Halaman "Semua aktivitas" / audit log penuh | Link ada di Business Overview | Business Overview |
| Composer email penagihan | Tombol AI `Buatkan draft email penagihan` mengarah ke sana | AI Panel |
| Form "Buat peran baru" & "Undang Pengguna" | Dua tombol tanpa tujuan | Pengaturan |
| Halaman "Kustomisasi Widget" | Tombol ada di header dashboard | Business Overview |
| Alur "Tambah Company" | Disebut di switcher dan di empty state company kedua | App Shell, System States |

### 5.2 State yang belum ada

| State | Di screen mana seharusnya |
|---|---|
| Loading detail dokumen (skeleton form) | Faktur Detail |
| Loading tabel Pengaturan | Pengaturan |
| Loading widget dashboard per-kartu | Business Overview (hanya ada di kartu KPI ke-4 sebagai contoh) |
| Empty dashboard (company baru, belum ada transaksi) | Business Overview |
| Empty tabel Pengaturan (1 pengguna) | Pengaturan |
| Error gagal muat tabel / widget (retry inline) | Faktur Penjualan, Business Overview, Pengaturan |
| Error AI gagal menjawab, dan "tidak ada data untuk pertanyaan ini" | AI Panel |
| Dirty state "perubahan izin belum disimpan" + konfirmasi keluar | Pengaturan |
| Baris item dalam mode edit aktif (sel fokus, validasi per sel) | Faktur Detail |
| Dokumen readonly setelah Void / setelah periode ditutup | Faktur Detail |
| Konflik edit bersamaan (dua pengguna, satu dokumen) | Faktur Detail |
| 401 sesi berakhir, 429 rate limit, maintenance window | System States |
| Upload lampiran: progress, gagal, tipe tidak didukung | Faktur Detail (tab Lampiran hanya label) |
| Slug sedang diperiksa (loading) & submit gagal | Onboarding |
| Riwayat percakapan AI (daftar thread) | AI Panel |
| No-permission per widget dashboard (Member tanpa akses laba rugi) | Business Overview |

### 5.3 Overlay yang disebut tapi tidak digambar

| Overlay | Disebut di |
|---|---|
| Modal konfirmasi Void faktur dari menu ⋯ | Faktur Detail (`Void faktur`) — versi Style Guide ada, tapi tidak dalam konteks detail |
| Modal konfirmasi Hapus dari bulk action | Faktur Penjualan (`Hapus` di BulkActionBar) |
| Dropdown `Filter`, `Kelompokkan`, `Tampilan Tersimpan` (isi panelnya) | Faktur Penjualan — hanya trigger yang digambar |
| Dropdown `Ekspor` (pilihan PDF/XLSX) | Business Overview, Faktur Penjualan |
| Popover `+ Tag` | Faktur Detail |
| Panel notifikasi (badge 3 di top bar) | App Shell — badge ada, panelnya tidak |
| Autocomplete mention `@` | Faktur Detail |
| Tooltip definisi metrik KPI (ikon info ada, isi tooltip tidak dispesifikasi) | Business Overview |
| Bottom sheet chatter dalam keadaan penuh (hanya peek yang digambar) | Faktur Detail mobile |

### 5.4 Hal lintas-sistem yang belum diputuskan

- **Responsive breakpoint**: hanya Faktur Detail punya versi mobile (390px). Tidak ada spesifikasi tablet, tidak ada perilaku sidebar di bawah 1024px, tidak ada versi mobile untuk dashboard maupun list view.
- **Skala z-index**: Style Guide melarang `z-index: 9999` di lint, tapi tidak ada skala token. Nilai yang dipakai di file: `1`, `2`, `3`, `30`, `200`.
- **Motion**: Brand Guidelines punya section "Motion menjelaskan, tidak menghibur", tetapi hanya `pf-spin`, `pf-shimmer`, `pf-pulse` yang benar-benar didefinisikan. Tidak ada durasi/easing token untuk buka-tutup panel, drawer, modal, dropdown.
- **Ikonografi**: semua ikon inline SVG per pemakaian, tanpa registry. Butuh satu set bernama sebelum menulis komponen React.
- **Palet chart**: Business Overview memakai success/danger untuk seri; tidak ada palet kategorikal (>2 seri) yang aman untuk defisiensi warna.
- **Empty state ilustrasi**: 3 empty state memakai ikon garis ad-hoc. Tidak ada sistem ilustrasi.
- **Format angka negatif**: Faktur Detail memakai `−2.790.000` (minus sign U+2212). Tidak ada aturan untuk kurung `(2.790.000)` yang lazim di laporan akuntansi Indonesia.
- **i18n**: seluruh copy hardcode Bahasa Indonesia. Tidak ada struktur kunci terjemahan meskipun ada pilihan region Singapura/Global di onboarding.
