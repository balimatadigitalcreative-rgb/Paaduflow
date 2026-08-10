# Paadu Flow — Color System
### Step 1.2 · Fase 1 — Brand Identity System

**Konteks:** aplikasi enterprise dengan tampilan data padat, dipakai 8 jam sehari, wajib light dan dark mode, target WCAG 2.1 AA.

> ⚠️ **Nilai jangkar bersifat sementara.** Seluruh skala diturunkan dari `#3A34B5`, yang merupakan **perkiraan** biru brand Anda dari tangkapan layar. Begitu nilai hex asli tersedia, skala indigo harus diturunkan ulang — sebelas langkahnya, bukan hanya satu. Token semantik dan seluruh struktur di bawah tidak berubah.

---

## 1. Keputusan Warna Primer

Di Step 1.1 saya mencatat bahwa biru adalah warna paling padat di enterprise software. Berikut pemeriksaannya sebagai keputusan, bukan warisan.

**Lanskap kategori:** SAP (biru), Oracle (merah), Salesforce (biru sian), Microsoft Dynamics (biru), Odoo (ungu-plum), NetSuite (biru), Zoho (multi), Xero (biru sian), Mekari/Jurnal (biru). Biru sian dan biru korporat sudah jenuh sampai tidak bermakna.

**Posisi `#3A34B5`:** ini bukan biru korporat. Hue-nya di sekitar 244°, condong ke **indigo-violet** — lebih dekat ke Odoo dan Stripe daripada ke SAP. Ini secara nyata terdiferensiasi dari mayoritas kategori.

**Risiko yang tersisa:** indigo-violet padat di kategori *lain* — fintech, crypto, dan developer tools (Stripe, Linear, Vercel-adjacent). Untuk produk yang salah satu referensi rasanya memang Linear dan Stripe, ini bisa dibaca sebagai kedekatan yang disengaja, bukan kebetulan. Saya menilai ini dapat diterima.

**Keputusan: pertahankan indigo sebagai warna brand.** Satu penyesuaian direkomendasikan: jangkar berada tepat di antara "biru" dan "ungu", yang membuatnya sedikit ragu. Menggeser hue 2–4° ke arah violet akan mempertegas jati dirinya tanpa mengubah pengenalan. Ini opsional dan sebaiknya diputuskan bersamaan dengan verifikasi hex asli.

**Batasan yang mengikat:** warna brand **tidak boleh** dipakai untuk menyampaikan status. Indigo berarti "ini elemen Paadu Flow" atau "ini aksi utama" — tidak pernah "ini berhasil" atau "ini perlu perhatian". Aplikasi finansial yang mencampur warna brand dengan warna status akan menghasilkan dashboard yang tidak bisa dibaca sekilas.

---

## 2. Lapis 1 — Primitive Scale

Nilai mentah. **Tidak pernah dipakai langsung di komponen.** Komponen hanya boleh memanggil token semantik di Lapis 2.

### Indigo (Brand)

| Step | Hex | Peran utama |
|---|---|---|
| 50 | `#F0EFFC` | Latar terpilih, hover baris tabel |
| 100 | `#E0DEFA` | Latar badge brand, chip aktif |
| 200 | `#C4C0F4` | Border elemen brand di light mode |
| 300 | `#A29CEA` | Teks tautan di dark mode |
| 400 | `#7E76DC` | Focus ring dark mode, ikon brand dark |
| 500 | `#605AC9` | Isi tombol primer **dark mode** |
| 600 | `#3A34B5` | **Jangkar.** Isi tombol primer light mode, focus ring light |
| 700 | `#302B96` | Teks tautan light mode, hover tombol primer |
| 800 | `#282476` | Active/pressed tombol primer |
| 900 | `#221F5E` | Teks di atas latar indigo terang |
| 950 | `#14123A` | Latar brand pekat, dark mode surface aksen |

### Neutral

Skala paling penting dalam aplikasi enterprise. Sedikit condong dingin agar duduk harmonis dengan indigo, tapi tidak cukup biru untuk terbaca sebagai warna.

| Step | Hex | Peran utama |
|---|---|---|
| 50 | `#F8F9FB` | Kanvas halaman light |
| 100 | `#F1F2F6` | Surface tenggelam, header tabel light · Teks primer dark |
| 200 | `#E3E5EC` | Border kuat light, divider tebal |
| 300 | `#CBCEDA` | Border default light |
| 400 | `#9BA0B3` | Teks nonaktif light · Teks sekunder dark |
| **450** | `#8A90A3` | **Border interaktif light.** Setengah langkah, lihat §5 |
| 500 | `#6F7588` | Teks tersier light · Border interaktif dark |
| 600 | `#565C6E` | Teks sekunder light · Border kuat dark |
| 700 | `#434857` | Border default dark |
| 800 | `#2E323D` | Surface terangkat dark |
| 900 | `#1C1F27` | **Teks primer light** · Surface kartu dark |
| 950 | `#101319` | Kanvas halaman dark |

> `neutral-450` bukan kelonggaran estetis. Ia ada karena `neutral-400` hanya mencapai 2,60:1 terhadap putih, sementara WCAG 1.4.11 mewajibkan 3:1 untuk batas komponen yang membawa makna. Matematikanya yang menentukan palet, bukan sebaliknya.

### Success · Warning · Danger · Info

| Step | Success | Warning | Danger | Info |
|---|---|---|---|---|
| 50 | `#E9F7EF` | `#FEF5E7` | `#FDECEC` | `#E8F3FC` |
| 100 | `#CFEFDF` | `#FCE8C4` | `#FBD5D5` | `#CDE5F9` |
| 200 | `#A3E0C3` | `#F8D28C` | `#F6ADAD` | `#9FCDF3` |
| 300 | `#6CCBA0` | `#F2B44E` | `#EE7E7E` | `#6BB0E9` |
| 400 | `#38B07E` | `#E29616` | `#E15252` | `#3B90DA` |
| 500 | `#1E9166` | `#C07C0C` | `#CC3434` | `#1F72BD` |
| 600 | `#157552` | `#9C640A` | `#A82929` | `#175B9A` |
| 700 | `#115C42` | `#7C4F0A` | `#8A2222` | `#14497B` |
| 800 | `#0E4735` | `#623F0B` | `#6E1D1D` | `#123A61` |
| 900 | `#0B3628` | `#4C310A` | `#571818` | `#102F4C` |
| 950 | `#06211A` | `#2E1D05` | `#350E0E` | `#081C2E` |

Info sengaja dijaga jelas berbeda dari indigo brand — hue-nya di kisaran 208° versus 244°. Kalau keduanya terlalu dekat, pengguna tidak bisa membedakan "ini pesan informasi" dari "ini elemen brand".

### Data Visualisasi — 8 kategori

Diturunkan dari palet Okabe–Ito, yang dirancang khusus agar tetap dapat dibedakan pada deuteranopia dan protanopia, dengan indigo brand disisipkan sebagai warna pertama.

| # | Hex | Catatan |
|---|---|---|
| 1 | `#3A34B5` | Indigo brand |
| 2 | `#E69F00` | Oranye |
| 3 | `#56B4E9` | Biru langit |
| 4 | `#009E73` | Hijau kebiruan |
| 5 | `#CC79A7` | Ungu kemerahan |
| 6 | `#0072B2` | Biru |
| 7 | `#D55E00` | Vermilion |
| 8 | `#6F7588` | Netral |

**Aturan wajib:** warna tidak pernah menjadi satu-satunya pembeda. Setiap seri di chart harus juga dibedakan oleh pola (garis putus-putus, arsir, bentuk marker) atau label langsung. Ini bukan opsi aksesibilitas tambahan — ini syarat WCAG 1.4.1.

**Sequential** (untuk heatmap, intensitas): Indigo 100 → 300 → 500 → 700 → 900.

**Diverging** (untuk varians dan selisih): dua pilihan, dan pilihannya penting.
- *Konvensional:* Danger-600 ↔ Neutral-200 ↔ Success-600. Merah–hijau adalah kegagalan buta warna paling klasik, tetapi konvensi finansial untuk untung/rugi terlalu kuat untuk dilawan. Boleh dipakai **hanya** jika setiap angka juga membawa tanda (+/−) atau panah arah.
- *Aman:* Warning-500 ↔ Neutral-200 ↔ Indigo-600. Wajib tersedia sebagai preferensi pengguna di Settings, bukan hanya sebagai catatan di dokumen.

---

## 3. Lapis 2 — Semantic Token

Inilah yang dipanggil komponen. Setiap token punya nilai light dan dark yang **dirancang terpisah**, bukan hasil inversi.

### Background

| Token | Light | Dark | Kegunaan |
|---|---|---|---|
| `bg-canvas` | `#FFFFFF` | `neutral-950` | Latar halaman paling belakang |
| `bg-surface` | `neutral-50` | `neutral-900` | Kartu, panel, modal |
| `bg-surface-raised` | `#FFFFFF` | `neutral-800` | Dropdown, popover, tooltip |
| `bg-surface-sunken` | `neutral-100` | `#0A0C11` | Header tabel, area kode, well |
| `bg-overlay` | `rgba(28,31,39,.45)` | `rgba(0,0,0,.65)` | Latar di belakang modal |
| `bg-hover` | `neutral-100` | `neutral-800` | Hover baris tabel dan menu |
| `bg-selected` | `indigo-50` | `indigo-950` | Baris terpilih, tab aktif |

> Perhatikan pembalikan hierarki di dark mode: `bg-canvas` adalah yang **paling gelap** dan surface menjadi **lebih terang** saat naik. Di light mode kebalikannya. Inilah alasan inversi otomatis selalu gagal.

### Text

| Token | Light | Dark | Kontras |
|---|---|---|---|
| `text-primary` | `neutral-900` | `neutral-100` | 16,47 / 16,62 |
| `text-secondary` | `neutral-600` | `neutral-400` | 6,66 / 7,15 |
| `text-tertiary` | `neutral-500` | `neutral-500` | 4,59 / — |
| `text-disabled` | `neutral-400` | `neutral-600` | Dikecualikan dari AA |
| `text-inverse` | `#FFFFFF` | `neutral-950` | Di atas isi solid |
| `text-link` | `indigo-700` | `indigo-300` | 10,99 / 7,51 |

### Border

| Token | Light | Dark | Kegunaan |
|---|---|---|---|
| `border-subtle` | `neutral-200` | `neutral-800` | Divider dalam kartu |
| `border-default` | `neutral-300` | `neutral-700` | Batas kartu, garis tabel |
| `border-interactive` | `neutral-450` | `neutral-500` | **Border input, checkbox, radio, select** |
| `border-strong` | `neutral-400` | `neutral-600` | Hover pada elemen interaktif |
| `border-focus` | `indigo-600` | `indigo-400` | Focus ring, tebal 2px, offset 2px |

### Interactive

| Peran | Varian | Light | Dark |
|---|---|---|---|
| Primary | isi | `indigo-600` | `indigo-500` |
| Primary | isi hover | `indigo-700` | `indigo-400` |
| Primary | isi active | `indigo-800` | `indigo-600` |
| Primary | teks | `#FFFFFF` | `#FFFFFF` |
| Secondary | isi | `#FFFFFF` | `neutral-800` |
| Secondary | border | `neutral-450` | `neutral-600` |
| Secondary | teks | `neutral-900` | `neutral-100` |
| Ghost | isi hover | `neutral-100` | `neutral-800` |
| Ghost | teks | `neutral-700` | `neutral-200` |
| Danger | isi | `danger-600` | `danger-500` |
| Danger | teks | `#FFFFFF` | `#FFFFFF` |
| Disabled | isi | `neutral-200` | `neutral-800` |
| Disabled | teks | `neutral-400` | `neutral-600` |

### Status

Untuk setiap peran (`success`, `warning`, `danger`, `info`), empat token:

| Sub-token | Light | Dark |
|---|---|---|
| `{peran}-bg` | `{peran}-50` | `{peran}-800` |
| `{peran}-border` | `{peran}-200` | `{peran}-600` |
| `{peran}-text` | `{peran}-800` | `{peran}-200` |
| `{peran}-icon` | `{peran}-600` | `{peran}-400` |

Pengecualian: `warning-icon` di light mode memakai `warning-700`, bukan 600. Kuning secara optis jauh lebih terang dari hijau atau merah pada langkah yang sama, dan `warning-600` hanya mencapai 4,4:1 terhadap putih.

---

## 4. Aturan Penggunaan

**Kapan `bg-surface` versus `bg-surface-raised`.** `bg-surface` untuk elemen yang berada *dalam* aliran halaman — kartu, panel, tabel. `bg-surface-raised` hanya untuk elemen yang *melayang di atas* aliran dan akan hilang saat ditutup — dropdown, popover, tooltip, menu konteks. Kalau elemen tidak bisa ditutup, ia bukan raised.

**Elevasi di dark mode tidak memakai bayangan.** Bayangan hitam di atas latar hitam tidak terlihat. Di dark mode, semakin tinggi sebuah permukaan, semakin **terang** ia. Bayangan tetap ada tetapi hanya sebagai penegas tepi tipis, bukan sebagai pembawa hierarki.

**Kapan warna boleh membawa makna.** Warna status boleh membawa makna hanya jika ia **redundan** — selalu ditemani ikon, label, atau tanda. Baris tabel yang hanya berwarna merah tanpa penanda lain tidak dapat dibaca oleh sekitar 8% pria.

**Hindari #000 dan #FFF sebagai latar besar.** Kanvas dark memakai `#101319`, bukan hitam murni. Hitam murni menyebabkan halation — teks putih tampak bergetar bagi banyak orang, terutama yang astigmatisme, dan ini melelahkan pada pemakaian 8 jam. Untuk alasan yang sama, kanvas light memakai putih tetapi surface memakai `neutral-50` agar ada gradasi.

**Warna brand di dark mode.** Jangan pertahankan `indigo-600` untuk tombol primer di dark mode. Ia lolos kontras terhadap teks putih (5,52 di indigo-500), tetapi terhadap kanvas gelap ia kehilangan kehadiran. Naikkan ke `indigo-500`.

---

## 5. Bukti Kontras WCAG 2.1

Dihitung dengan formula relative luminance WCAG. Target: **4,5:1** untuk teks normal, **3:1** untuk teks besar dan komponen antarmuka.

### Light mode

| Pasangan | Rasio | Hasil |
|---|---|---|
| `text-primary` di kanvas | 16,47 | AAA |
| `text-secondary` di kanvas | 6,66 | AA |
| `text-tertiary` di kanvas | 4,59 | AA |
| `text-primary` di surface | 15,64 | AAA |
| `text-secondary` di surface | 6,33 | AA |
| `text-link` di kanvas | 10,99 | AAA |
| Teks putih di tombol primer | 8,98 | AAA |
| `border-focus` di kanvas | 8,98 | AAA |
| `border-interactive` di kanvas | 3,18 | AA (komponen) |
| `success-text` di `success-bg` | 9,65 | AAA |
| `warning-text` di `warning-bg` | 8,69 | AAA |
| `danger-text` di `danger-bg` | 9,90 | AAA |
| `info-text` di `info-bg` | 10,34 | AAA |
| `success-icon` di putih | 5,68 | AA |
| `warning-icon` di putih | 7,05 | AAA |
| `danger-icon` di putih | 6,97 | AA |

### Dark mode

| Pasangan | Rasio | Hasil |
|---|---|---|
| `text-primary` di kanvas | 16,62 | AAA |
| `text-secondary` di kanvas | 7,15 | AAA |
| `text-primary` di surface | 14,73 | AAA |
| `text-secondary` di surface | 6,33 | AA |
| `text-link` di kanvas | 7,51 | AAA |
| Teks putih di tombol primer | 5,52 | AA |
| `border-focus` di kanvas | 4,88 | AA |
| `border-interactive` di kanvas | 4,05 | AA (komponen) |
| `border-interactive` di surface | 3,59 | AA (komponen) |
| `success-text` di `success-bg` | 7,11 | AAA |
| `warning-text` di `warning-bg` | 6,53 | AA |
| `danger-text` di `danger-bg` | 6,19 | AA |
| `info-text` di `info-bg` | 6,93 | AA |
| `success-icon` di kanvas | 6,80 | AA |
| `warning-icon` di kanvas | 7,62 | AAA |
| `danger-icon` di kanvas | 4,90 | AA |

### Dikecualikan dari AA — disengaja

| Token | Rasio | Alasan |
|---|---|---|
| `border-subtle`, `border-default` | 1,57 – 2,04 | Pembagi dekoratif. WCAG 1.4.11 tidak berlaku untuk batas yang tidak membawa makna. Batas yang membawa makna wajib memakai `border-interactive`. |
| `text-disabled` | < 4,5 | WCAG 1.4.3 mengecualikan komponen nonaktif. Status nonaktif **wajib** juga ditandai oleh `aria-disabled` dan kursor, tidak boleh hanya oleh warna. |

---

## 6. CSS Custom Properties

```css
:root {
  --indigo-50:#F0EFFC;  --indigo-100:#E0DEFA; --indigo-200:#C4C0F4;
  --indigo-300:#A29CEA; --indigo-400:#7E76DC; --indigo-500:#605AC9;
  --indigo-600:#3A34B5; --indigo-700:#302B96; --indigo-800:#282476;
  --indigo-900:#221F5E; --indigo-950:#14123A;

  --neutral-50:#F8F9FB;  --neutral-100:#F1F2F6; --neutral-200:#E3E5EC;
  --neutral-300:#CBCEDA; --neutral-400:#9BA0B3; --neutral-450:#8A90A3;
  --neutral-500:#6F7588; --neutral-600:#565C6E; --neutral-700:#434857;
  --neutral-800:#2E323D; --neutral-900:#1C1F27; --neutral-950:#101319;

  --success-50:#E9F7EF; --success-200:#A3E0C3; --success-400:#38B07E;
  --success-500:#1E9166; --success-600:#157552; --success-800:#0E4735;
  --warning-50:#FEF5E7; --warning-200:#F8D28C; --warning-400:#E29616;
  --warning-500:#C07C0C; --warning-700:#7C4F0A; --warning-800:#623F0B;
  --danger-50:#FDECEC;  --danger-200:#F6ADAD;  --danger-400:#E15252;
  --danger-500:#CC3434; --danger-600:#A82929;  --danger-800:#6E1D1D;
  --info-50:#E8F3FC;    --info-200:#9FCDF3;    --info-400:#3B90DA;
  --info-600:#175B9A;   --info-800:#123A61;

  --bg-canvas:#FFFFFF;
  --bg-surface:var(--neutral-50);
  --bg-surface-raised:#FFFFFF;
  --bg-surface-sunken:var(--neutral-100);
  --bg-overlay:rgba(28,31,39,.45);
  --bg-hover:var(--neutral-100);
  --bg-selected:var(--indigo-50);

  --text-primary:var(--neutral-900);
  --text-secondary:var(--neutral-600);
  --text-tertiary:var(--neutral-500);
  --text-disabled:var(--neutral-400);
  --text-inverse:#FFFFFF;
  --text-link:var(--indigo-700);

  --border-subtle:var(--neutral-200);
  --border-default:var(--neutral-300);
  --border-interactive:var(--neutral-450);
  --border-strong:var(--neutral-400);
  --border-focus:var(--indigo-600);

  --interactive-primary:var(--indigo-600);
  --interactive-primary-hover:var(--indigo-700);
  --interactive-primary-active:var(--indigo-800);
  --interactive-danger:var(--danger-600);

  --status-success-bg:var(--success-50);
  --status-success-border:var(--success-200);
  --status-success-text:var(--success-800);
  --status-success-icon:var(--success-600);
  --status-warning-bg:var(--warning-50);
  --status-warning-border:var(--warning-200);
  --status-warning-text:var(--warning-800);
  --status-warning-icon:var(--warning-700);
  --status-danger-bg:var(--danger-50);
  --status-danger-border:var(--danger-200);
  --status-danger-text:var(--danger-800);
  --status-danger-icon:var(--danger-600);
  --status-info-bg:var(--info-50);
  --status-info-border:var(--info-200);
  --status-info-text:var(--info-800);
  --status-info-icon:var(--info-600);
}

[data-theme="dark"] {
  --bg-canvas:var(--neutral-950);
  --bg-surface:var(--neutral-900);
  --bg-surface-raised:var(--neutral-800);
  --bg-surface-sunken:#0A0C11;
  --bg-overlay:rgba(0,0,0,.65);
  --bg-hover:var(--neutral-800);
  --bg-selected:var(--indigo-950);

  --text-primary:var(--neutral-100);
  --text-secondary:var(--neutral-400);
  --text-tertiary:var(--neutral-500);
  --text-disabled:var(--neutral-600);
  --text-inverse:var(--neutral-950);
  --text-link:var(--indigo-300);

  --border-subtle:var(--neutral-800);
  --border-default:var(--neutral-700);
  --border-interactive:var(--neutral-500);
  --border-strong:var(--neutral-600);
  --border-focus:var(--indigo-400);

  --interactive-primary:var(--indigo-500);
  --interactive-primary-hover:var(--indigo-400);
  --interactive-primary-active:var(--indigo-600);
  --interactive-danger:var(--danger-500);

  --status-success-bg:var(--success-800);
  --status-success-border:var(--success-600);
  --status-success-text:var(--success-200);
  --status-success-icon:var(--success-400);
  --status-warning-bg:var(--warning-800);
  --status-warning-border:var(--warning-500);
  --status-warning-text:var(--warning-200);
  --status-warning-icon:var(--warning-400);
  --status-danger-bg:var(--danger-800);
  --status-danger-border:var(--danger-500);
  --status-danger-text:var(--danger-200);
  --status-danger-icon:var(--danger-400);
  --status-info-bg:var(--info-800);
  --status-info-border:var(--info-600);
  --status-info-text:var(--info-200);
  --status-info-icon:var(--info-400);
}
```

---

## 7. Risiko Terbuka

| Item | Status | Dampak |
|---|---|---|
| Hex indigo asli belum diverifikasi | Terbuka | Seluruh skala indigo harus diturunkan ulang |
| Penyesuaian hue +2–4° ke violet | Diusulkan, belum diputuskan | Diferensiasi kategori; ubah sekarang atau tidak sama sekali |
| Theming per-tenant (white-label) | Ditunda ke Step 2.1 | Menentukan lapis mana yang boleh di-override tenant |
| Diverging ramp aman sebagai preferensi | Perlu masuk backlog Settings | Aksesibilitas untuk pengguna buta warna |
| Uji palet pada simulator buta warna | Belum dilakukan | Wajib sebelum Step 3.2 (data table dan chart) |
