# Paadu Flow — UI Implementation Brief

> Dokumen ini sedang disusun bertahap. Bagian 8 lebih dulu; bagian lain menyusul.

---

## 4. Keputusan arsitektur (ADR)

> **Penomoran.** ADR-001 sampai ADR-020 diputuskan di luar repo dan belum
> ditranskripsi ke sini. ADR-007 di bawah adalah **revisi** atas nomor yang sudah
> ada. Keputusan baru diberi nomor mulai **ADR-021** agar tidak menabrak nomor
> yang sudah terpakai.

### ADR-007 (revisi) · Urutan z — popover di atas modal

**Keputusan.** Urutan resmi: `sticky row < sticky col < chrome < panel/drawer < modal < popover < toast < banner`.

**Alasan.** Dropdown yang dibuka di dalam modal atau drawer harus tetap terpakai — `Select` mata uang di dalam modal, `DateRangePicker` di dalam side panel. Urutan sebelumnya (popover di bawah modal) akan menimbunnya. Radix juga mengasumsikan susunan ini lewat portal dan urutan DOM.

**Pengaman yang menggantikan urutan lama.** Hanya satu modal aktif pada satu waktu, dan membuka modal menutup popover level-halaman (dismissable layer Radix). Aturan "maksimal dua lapisan mengambang" tetap berlaku.

**Trade-off.** Popover yang lupa ditutup dapat mengambang di atas modal. Ditutup oleh pengaman di atas, bukan oleh urutan z.

**Konsekuensi.** Repo **tidak diubah** — urutan yang ada sudah benar. Item penukaran z dicoret dari Fase 3.

### ADR-021 · `--text-body-lg` — audit call-site sebelum menetapkan nilai

**Keputusan.** Nilai tidak di-snap membabi buta ke 15/22. Setiap call-site diaudit lebih dulu: bila 16/24 dipakai di tempat yang Design Spec memang menuntut 16/24, itu peran berbeda dan dipindahkan ke token yang tepat; bila tidak punya dasar di Spec, di-snap ke 15/22. Bila bedanya hanya weight, **tambah token baru** — jangan pakai `--text-h3` dengan override weight.

**Alasan.** Satu nama token yang melayani dua peran adalah tabrakan yang sama dengan tabrakan primitif di ADR-022, hanya di sumbu tipografi.

**Trade-off.** Lebih lambat daripada menyetel satu angka, dan menghasilkan satu token tambahan.

### ADR-022 · Tabrakan primitif — buat primitif baru, jangan mutasi yang dipakai bersama

**Keputusan.** Bila satu primitif dipakai beberapa alias semantik dan Design Spec hanya mengatur sebagian aliasnya: jangan snap primitifnya. Buat primitif baru bernilai Design Spec, arahkan ulang **hanya** alias yang diatur Spec, dan biarkan primitif lama melayani sisanya sampai tiket migrasi. Bila primitif hanya melayani alias yang seluruhnya diatur Spec dan sepakat pada satu nilai, snap langsung.

**Alasan.** Menyeret alias yang tidak diatur Spec ikut berubah warna adalah efek samping, bukan keputusan.

**Trade-off.** Jumlah primitif bertambah, dan sebagian primitif lama hidup berdampingan dengan penggantinya sampai tiket migrasi selesai.

**Batas yang diketahui.** Aturan ini tidak menyelesaikan kasus ketika **dua alias yang sama-sama diatur Spec menuntut nilai berbeda**. Kasus seperti itu diputuskan satu per satu.

### ADR-023 · Bahasa — id-ID adalah locale sumber

**Keputusan.** Bahasa Indonesia menang di setiap tabrakan. Nama layar di Design Spec ("Business Overview") adalah nama dokumen desain, bukan copy UI — "Dasbor" yang sudah tayang tetap dipakai. String Inggris di Spec yang memang teks UI dan belum punya padanan diterjemahkan mengikuti glosarium `CLAUDE.md`, lalu katalog `en` diisi aslinya. Label status final di ADR-011: `Overdue` → "Jatuh Tempo"; label Inggris di Style Guide adalah sisa dan tidak diport; "Void" tetap "Void".

**Alasan.** "Verbatim" di Fase 5 berarti jangan memparafrase atau mengarang copy. Itu bukan instruksi soal bahasa.

**Trade-off.** Katalog `en` menjadi turunan, bukan sumber — kualitasnya bergantung pada terjemahan, bukan pada penulis aslinya.

**Batas.** Bila Spec dan repo berbeda **makna**, bukan sekadar bahasa: berhenti dan lapor. Jangan diam-diam memilih.

### ADR-024 · Density — mekanisme dulu, skala paralel tidak dibangun sekarang

**Keputusan.** Yang masuk Fase 1 adalah mekanismenya: `data-density` di root subtree, komponen membaca `var`, tidak ada tinggi baris atau tinggi kontrol yang di-hardcode. Token density yang ditambahkan **hanya** yang dibutuhkan dua layar yang sudah tayang. Skala spacing paralel penuh tidak dibangun.

**Alasan.** POS ada di roadmap Fase 2 dan kebutuhannya belum diketahui. Membangun skala spekulatif adalah biaya yang belum tentu terpakai.

**Trade-off.** Diterima secara sadar: varian density ditambahkan belakangan, token per token. Itu murah justru karena mekanismenya sudah terpasang dan call-site sudah membaca `var`. Yang mahal adalah memasang mekanismenya belakangan.

### ADR-025 · Satu permukaan design system — `/design-system`, bukan Storybook

**Keputusan.** `gallery.tsx` dinaikkan menjadi rute `/design-system`. Storybook tidak dipasang. Kontrak komponen syarat ke-7 dibaca sebagai "matriks varian × state di `/design-system`", bukan "story Storybook". EXIT Fase 2 dan Fase 7 menyesuaikan.

**Alasan.** EXIT Fase 7 menuntut permukaan itu di-generate dari komponen React nyata, dan `gallery.tsx` sudah memenuhi syarat itu hari ini. Storybook akan menjadi permukaan kedua untuk tujuan yang sama. Nilai utamanya — addon a11y dan visual regression — sudah tercakup: axe lewat Playwright dan snapshot Playwright keduanya sudah wajib di brief.

**Trade-off.** Kehilangan ekosistem addon dan interaction test bawaan Storybook. Bila kelak benar-benar terasa, itu keputusan baru dengan ADR-nya sendiri — bukan alasan memasang dua permukaan sekarang.

### ADR-026 · `dataviz` tetap delapan seri

**Keputusan.** Pertahankan 8 seri. Verifikasi keamanan defisiensi warna dan laporkan hasilnya. Jangan potong ke 6.

**Alasan.** Sesuai ADR-006, tugasnya verifikasi cakupan, bukan bangun ulang. Memotong seri yang sudah ada dan sudah dipakai adalah pembangunan ulang.

**Trade-off.** Delapan seri lebih sulit dijamin aman-CVD daripada enam. Bila verifikasi gagal, keputusan pemotongan diambil saat itu dengan datanya di tangan.

---

## 8. Rencana fase

Satu fase = satu PR. Tidak ada fase berikutnya sebelum exit criteria hijau di CI.

### Fase 0 — Discovery
Keluarkan docs/UI_IMPLEMENTATION_PLAN.md: inventaris kode yang ada dan kondisinya;
gap terhadap brief per fase; hasil rekonsiliasi token (ADR-003) dengan daftar
konkret token yang ditambah/diganti/di-deprecate beserta nilai lama → nilai baru;
urutan Fase 1–7 dengan estimasi dan dependensi; risiko teknis + mitigasi; empat
blocker komponen (sumbu status tertutup, tidak ada Modal, tidak ada DropdownMenu,
EmptyState/InlineAlert masih kelas CSS) ditempatkan di fase yang tepat.
EXIT: plan disetujui manusia. Nol berkas produksi berubah.

### Fase 1 — Rekonsiliasi fondasi
Bukan membangun dari nol — merapikan yang ada.
- Rekonsiliasi docs/tokens.json sesuai ADR-003. Jangan sentuh src/styles/tokens.css;
  jalankan Style Dictionary dan biarkan ia yang menulis.
- Perbaiki kalimat sumber kebenaran di CLAUDE.md.
- Verifikasi cakupan kelompok z (sticky row < sticky col < chrome < popover 
  panel < modal < toast < system banner) dan dataviz (6 seri, CVD-safe). Tambal
  yang kurang; jangan bangun palet tandingan.
- Tambahkan token motion (80/120/180/240ms + easing enter/exit) dan
  --text-body-lg 15/22.
- lib/format lengkap dengan test tabel untuk SETIAP aturan format: nomor dokumen
  kanonik INV/YYYY/MM/NNNNN; rupiah penuh vs singkat vs dalam tabel; persen koma
  satu desimal; minus U+2212 di form vs kurung di mode laporan; tanggal
  DD MMM YYYY leading zero; timestamp relatif <60mnt/hari ini/kemarin/2–6 hari/≥7
  hari; tabular-nums wajib.
- Registry ikon + komponen Logo (mark-only, lockup horizontal, monokrom; geometri
  path dari SVG di Paadu Flow Style Guide.dc.html; stroke 2.15–2.4 pada viewBox 32,
  dinaikkan di bawah 32px).
- Konsolidasi tiga sumbu status jadi satu enum: key, label, labelShort, tone, icon.
- Aktifkan gerbang CI sebagai PEMBLOKIR bukan peringatan: stylelint (hex/px/z-index
  mentah), eslint-plugin-boundaries, jsx-a11y, tsc strict, coverage. Pertahankan
  check:i18n dan audit:kontras.
EXIT: audit:kontras dan check:i18n hijau; ganti tema membalik seluruh warna tanpa
satu literal tersisa; 64 hex unik Style Guide seluruhnya terpetakan ke token.

### Fase 2 — Primitives
Migrasi dan lengkapi: Button, SplitButton, IconButton, Input (text/currency/
readonly/search), Select, MultiSelect, Combobox, DateRangePicker, Checkbox, Radio,
Toggle, Textarea, Badge/StatusPill, Avatar, AvatarGroup, Tabs, Breadcrumb,
SegmentedControl, Stepper, ProgressBar, FilterChip, Tooltip, DropdownMenu (belum ada).
EXIT: matriks varian × state di Storybook cocok dengan Style Guide §05–§08; axe
bersih; keyboard penuh.

### Fase 3 — Data display & overlays
Table, KpiCard, StatSummaryRow, BulkActionBar, Pagination, Card, Skeleton,
EmptyState & InlineAlert (naikkan dari kelas CSS ke komponen), Toast, Banner,
Modal (belum ada, termasuk destruktif ketik-nama), Drawer, SidePanel, charts.
Tabel: sticky header, sticky kolom kiri & kolom aksi, footer total sticky, multi-sort
dengan indikator urutan, row hover/selected, checkbox header indeterminate, skeleton
dengan lebar kolom final, empty state yang membedakan "belum ada data" vs "kosong
karena filter", virtualisasi otomatis >100 baris, density lewat prop.
EXIT: tabel 10.000 baris tetap 60fps; sticky benar di kedua tema; skeleton tidak
menggeser lebar kolom.

### Fase 4 — App Shell
Sidebar (248/56) + NavGroup + badge + item AI amber; TenantCompanySwitcher dengan
search; TopBar; Breadcrumb; global search; CommandPalette Cmd+K dengan 4 kelompok
berurutan; shortcut G+S; user dropdown; notifikasi. Integrasi tenancy + auth + izin.
EXIT: ganti company mengubah data tanpa reload penuh dan tanpa kebocoran cache
lintas company — test integrasi negatif WAJIB ada.

### Fase 5 — Screens
Urutan: Onboarding → Business Overview → Faktur Penjualan (jadikan ListPageTemplate)
→ Faktur Detail (jadikan DocumentPageTemplate) → Pengaturan → Paadu AI Panel →
System States. Copy verbatim dari Design Spec §3, masuk sebagai kunci i18n.
Faktur Penjualan adalah template seluruh modul transaksional; Faktur Detail adalah
template seluruh form dokumen. Perkuat pola daftar/detail yang sudah ada di repo;
jangan buat pola tandingan.
EXIT: visual diff terhadap prototipe ≤ 0,1% pada 1440×900 light & dark.

### Fase 6 — State yang belum terdesain
Design Spec §5.2 mendaftar 16 state hilang; §5.3 mendaftar 9 overlay yang disebut
tapi tidak digambar. Rancang sesuai prinsip yang sudah ada — "setiap keadaan
menyebutkan apa yang terjadi, apa akibatnya, dan satu langkah berikutnya; nada
tenang, tanpa permintaan maaf berlebihan, tanpa lelucon, tanpa menyalahkan
pengguna" — lalu implementasikan.
EXIT: tidak ada jalur di aplikasi yang berakhir di layar kosong tanpa penjelasan
dan langkah berikutnya.

### Fase 7 — Hardening & ship
Audit a11y penuh; budget performa (LCP < 2,5s, INP < 200ms, CLS < 0,1 di 4G);
baseline visual regression 10 screen × light/dark × compact/comfortable;
/design-system di-generate dari komponen React nyata; CI/CD preview deploy per PR;
env per region (ID/SG/Global); feature flag per tenant; dokumentasi diperbarui.
EXIT: Definition of Done terpenuhi seluruhnya.
