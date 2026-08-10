# Paadu Flow — Build Playbook untuk Claude Code
### Versi rinci · persiapan + 15 sesi · dari dokumentasi ke kode berjalan

*Turunan dari 41 dokumen desain dan arsitektur. Setiap sesi punya tujuan tunggal, langkah yang Anda lakukan, prompt siap tempel, apa yang akan Anda lihat, cara memverifikasi, dan kesalahan yang umum terjadi.*

---

## Prinsip yang Mendasari Seluruh Playbook Ini

**Konteks bukan penegakan.** `CLAUDE.md` dan prompt adalah konteks — ia memandu, tidak memaksa. Aturan yang benar-benar harus ditegakkan dikodekan di lint, test, hook, dan CI. Sesi A2 membangun penegakannya lebih dulu, sebelum ada kode yang bisa melanggarnya.

**Satu sesi, satu tujuan.** Bersihkan konteks di antara sesi. Sesi yang mengerjakan dua hal menghasilkan dua hal setengah jadi.

**Rencana sebelum kode** untuk sesi bertanda 🗺️. Ini yang paling berisiko dikerjakan tanpa rencana.

**Berikan cara memverifikasi diri.** Setiap prompt yang menghasilkan logika disertai test yang membuktikannya.

**Baca diff-nya.** Selalu.

---

# FASE 0 — Persiapan

*Sekali saja, sebelum sesi pertama. Sekitar 30 menit.*

## 0.1 Siapkan repo dan dokumentasi

```bash
mkdir -p ~/dev/paadu-flow && cd ~/dev/paadu-flow
git init
mkdir docs
# Salin seluruh 41 dokumen ke docs/
```

Struktur yang dituju setelah Fase A:

```
paadu-flow/
├── CLAUDE.md                    ← dibaca setiap sesi, pendek
├── docs/                        ← 41 dokumen, dibaca saat diminta
│   ├── README.md                ← indeks
│   ├── tokens.json              ← sumber kebenaran nilai visual
│   ├── Design_Handoff_Spec.md
│   ├── Module_01_...md ... Module_19_...md
│   └── DECISIONS.md             ← dibuat di sesi A1
├── migrations/
├── src/
│   ├── domain/                  ← entitas dan aturan bisnis, tanpa framework
│   ├── application/             ← use case, orkestrasi
│   ├── infrastructure/          ← basis data, antrean, penyimpanan
│   └── interface/               ← API dan UI
├── tests/
│   ├── unit/
│   ├── integration/
│   └── invariants/              ← yang paling penting, lihat D4
└── tools/
    └── style-dictionary/        ← pipeline token
```

**Kenapa `docs/` di dalam repo:** Claude Code membacanya sendiri saat diminta. Anda tidak perlu menempelkan isinya ke prompt — dan tidak boleh, karena membuang konteks untuk hal yang belum tentu relevan.

## 0.2 Tulis `CLAUDE.md`

Simpan di root repo. **Pendek dengan sengaja** — ia dibaca setiap sesi, jadi isinya hanya aturan yang selalu berlaku.

```markdown
# Paadu Flow — Business Operating System

Platform multi-tenant, multi-company untuk UMKM sampai enterprise Indonesia.
Dokumentasi lengkap di `docs/`. Indeks: `docs/README.md`.
Keputusan yang menyimpang dari dokumen dicatat di `docs/DECISIONS.md`.

## Aturan yang selalu berlaku

- `tokens.json` adalah sumber kebenaran tunggal untuk seluruh nilai visual.
  `tokens.css` dibangkitkan Style Dictionary — jangan diedit tangan.
- Setiap tabel membawa `tenant_id` dan `company_id`, kecuali tabel identitas global.
- Setiap tabel transaksional membawa `document_version` untuk optimistic concurrency.
- Status dokumen memakai tiga kolom terpisah: `lifecycle_status`,
  `settlement_status`, `fulfillment_status`. Tidak pernah satu enum gabungan.
- Tabel append-only tidak pernah di-UPDATE atau DELETE. Peran aplikasi hanya
  punya INSERT dan SELECT di sana.
- Modul tidak pernah menyebut nomor akun atau tarif pajak. Keduanya lewat
  lapisan penentuan di modul Akuntansi dan Pajak.
- Nomor dokumen diberikan saat submit, bukan saat draf dibuat.
- Operasi tulis di API wajib mendukung `Idempotency-Key`.
- Pagination berbasis kursor. Tidak ada parameter `offset`.

## Sebelum menyatakan selesai

- Jalankan `npm run lint` dan `npm test`
- Untuk perubahan skema: jalankan `tests/invariants/`
- Jangan buat abstraksi yang belum dibutuhkan di dua tempat

## Glosarium

Customer (bukan Client) · Vendor (bukan Supplier) · Item (bukan Product) ·
Invoice = sisi penjualan · Bill = sisi pembelian · User ≠ Employee ·
"Akun Perkiraan" untuk GL account, "Akun Pengguna" untuk login.
```

## 0.3 Uji sesi pertama

Jalankan `claude` di root repo, lalu ketik:

```
Baca CLAUDE.md dan docs/README.md. Ringkas dalam 5 kalimat: produk ini apa,
ada berapa modul, dan tiga aturan teknis apa yang paling mengikat.
```

**Yang Anda harapkan:** ringkasan yang menyebut multi-tenant, 19 modul, dan menyinggung `tokens.json`, `document_version`, atau tabel append-only.

**Bila jawabannya kabur:** `CLAUDE.md` terlalu panjang atau `docs/README.md` tidak terbaca. Perbaiki sekarang — seluruh sesi berikutnya bergantung pada ini.

---

# FASE A — Fondasi

## Sesi A1 🗺️ — Keputusan Stack & Scaffolding

**Tujuan:** repo berjalan dengan struktur yang tahan 30+ modul.
**Prasyarat:** Fase 0 selesai.
**Perkiraan:** 1–2 jam, sebagian besar untuk membaca dan mengoreksi rencana.

### Langkah

1. Jalankan `claude` di root repo.
2. Masuk plan mode.
3. Tempel prompt di bawah.
4. **Baca rencananya sampai habis.** Ini keputusan yang paling sulit diubah nanti.
5. Koreksi apa yang perlu, minta rencana diperbarui.
6. Baru setujui eksekusi.

### Prompt

```
Masuk plan mode.

Baca docs/Design_Handoff_Spec.md dan
docs/Module_01_Multi_Tenant_Organization_Foundation.md.

Rancang struktur repo dan pilih stack untuk Business OS multi-tenant ini.
Jangan menulis kode — buat rencana dan tunjukkan ke saya.

Batasan yang tidak dapat ditawar:
- Transaksi ACID sejati. Posting dokumen menyentuh beberapa tabel dan harus atomik.
- Mampu menegakkan isolasi tenant di tingkat basis data, bukan hanya aplikasi.
- Pekerjaan latar yang andal untuk ekspor, impor, penggajian, penyusutan.
- Pola outbox untuk peristiwa, agar audit log dan notifikasi tidak pernah hilang.
- Migrasi bertahap dan kompatibel dua arah, karena rilis tanpa henti.
- Frontend React memakai design token dari tokens.json.

Untuk setiap pilihan stack, sebutkan alternatif yang dipertimbangkan dan alasan
pilihan Anda menang. Saya lebih peduli alasannya daripada pilihannya.

Struktur repo memisahkan domain, aplikasi, infrastruktur, dan antarmuka
mengikuti Clean Architecture. Modul dapat dikembangkan terpisah tanpa saling
mengimpor domain.

Terakhir: jelaskan bagaimana struktur ini menampung 30+ modul tanpa menjadi
monolit yang tidak dapat dinavigasi.

Buat juga docs/DECISIONS.md berisi keputusan sesi ini beserta alasannya.
```

### Yang akan Anda lihat

Rencana berisi pilihan bahasa, framework, basis data, antrean, dan struktur folder — masing-masing dengan alternatif dan alasan. Lalu setelah disetujui: repo terbentuk, satu endpoint sehat, satu test lulus.

### Cara memverifikasi

```bash
npm install && npm test && npm run dev
curl localhost:3000/health
```

### Kesalahan umum

**Menyetujui rencana tanpa membaca.** Ini satu-satunya sesi yang keputusannya menyentuh seluruh proyek selamanya.

**Meminta stack tertentu tanpa alasan.** Bila Anda sudah punya preferensi, katakan beserta alasannya — supaya rencana menyesuaikan, bukan berdebat.

**Membiarkan struktur folder mengikuti framework.** Domain harus dapat dibaca tanpa tahu framework apa yang dipakai.

---

## Sesi A2 — Pipeline Token & Penegakan

**Tujuan:** aturan desain ditegakkan mesin sebelum ada kode yang bisa melanggarnya.
**Prasyarat:** A1 selesai.
**Perkiraan:** 1 jam.

### Langkah

1. Sesi baru, konteks bersih.
2. Tempel prompt.
3. Setelah selesai, **coba langgar aturannya sendiri** untuk membuktikan lint benar-benar menangkap.

### Prompt

```
Baca docs/Design_Tokens.md dan docs/tokens.json.

Bangun tiga hal:

1. PIPELINE TOKEN
   Style Dictionary yang membaca docs/tokens.json dan menghasilkan:
   - src/styles/tokens.css — CSS custom properties untuk :root dan
     [data-theme="dark"]
   - src/styles/tokens.ts — tipe TypeScript untuk nama token
   Tandai keduanya sebagai berkas generated.

2. LINT RULE YANG MENGGAGALKAN BUILD
   - Nilai warna hex mentah di kode komponen
   - Nilai px yang tidak ada di skala spacing tokens.json
   - z-index literal
   - opacity pada elemen yang memuat teks
   - Impor token Lapis 1 (primitive) dari kode komponen — hanya Lapis 2 dan 3

3. HOOK PRE-COMMIT
   Menjalankan lint dan menolak commit yang melanggar.

Untuk setiap rule, tulis test yang membuktikan ia menangkap pelanggaran —
bukan sekadar ada. Buat berkas contoh pelanggaran di fixture, dan pastikan
test gagal bila rule dihapus.

Catatan: docs/Design_Tokens.md bagian 12 mencatat kemungkinan border-default
dan border-strong tertukar. Tampilkan nilai keduanya ke saya. Jangan diperbaiki
sendiri — saya yang memutuskan.
```

### Yang akan Anda lihat

`tokens.css` berisi seluruh variabel untuk kedua mode, lima rule lint dengan testnya, dan hook yang aktif. Plus laporan nilai `border-default` versus `border-strong` untuk Anda putuskan.

### Cara memverifikasi

Buat berkas percobaan berisi `color: #FF0000` dan `z-index: 9999`, lalu:

```bash
npm run lint          # harus gagal, menyebut kedua pelanggaran
git commit -m "test"  # harus ditolak hook
```

Hapus berkas itu setelah terbukti.

### Kesalahan umum

**Menerima lint yang lolos tanpa diuji.** Rule yang tidak pernah menangkap apa pun sering kali memang tidak berfungsi.

**Mengedit `tokens.css` langsung** saat ada warna yang terasa kurang pas. Ubah `tokens.json`, jalankan ulang pipeline.

---

## Sesi A3 🗺️ — Skema Fondasi & Template Transaksional

**Tujuan:** dua belas keputusan skema lintas-modul masuk migrasi pertama.
**Prasyarat:** A1, A2 selesai.
**Perkiraan:** 2–3 jam. **Sesi paling penting di seluruh playbook.**

### Langkah

1. Sesi baru, plan mode.
2. Tempel prompt.
3. Bandingkan rencananya dengan `docs/Design_Handoff_Spec.md` §2 — dua belas butir itu harus semuanya ada.
4. Koreksi yang kurang, minta rencana diperbarui.
5. Setujui.

### Prompt

```
Masuk plan mode.

Baca docs/Design_Handoff_Spec.md bagian 2 — dua belas konsekuensi desain
terhadap skema. Baca juga docs/Module_01_Multi_Tenant_Organization_Foundation.md
dan docs/Information_Architecture.md bagian 3 tentang tiga sumbu status.

Rancang migrasi fondasi. Tunjukkan rencananya sebelum menulis apa pun.

Wajib ada di migrasi pertama, karena tidak dapat ditambal kemudian:
- Kolom audit baku sebagai konvensi bersama
- tenant_id dan company_id sebagai bagian indeks utama
- document_version untuk optimistic concurrency
- Tiga tipe enum status terpisah, sebagai tipe yang dapat dipakai ulang
- Tabel tenants dan companies sesuai Module 01

Buat TEMPLATE TABEL TRANSAKSIONAL — fungsi migrasi atau macro yang menambahkan
seluruh kolom lintas-modul sekaligus, sehingga modul berikutnya tidak dapat lupa
menyertakannya.

Penegakan tingkat basis data:
- Row-level security atau setara untuk isolasi tenant
- Peran aplikasi tanpa UPDATE dan DELETE pada tabel append-only.
  Buat daftar nama tabel append-only sebagai konstanta, sehingga migrasi
  berikutnya tinggal menambah nama.
- Constraint yang menolak jurnal tidak berimbang

Terakhir, buat kerangka test invarian di tests/invariants/ dengan tiga contoh
yang berjalan: isolasi tenant, penolakan UPDATE pada tabel append-only, dan
penolakan jurnal tidak berimbang.

Setelah selesai, jalankan test dan tunjukkan hasilnya. Lalu sebutkan butir mana
dari dua belas yang belum tercakup migrasi ini dan kapan sebaiknya ditambahkan.
```

### Yang akan Anda lihat

Migrasi berjalan, tiga test invarian lulus, dan daftar jujur butir yang belum tercakup.

### Cara memverifikasi

```bash
npm run migrate
npm test -- tests/invariants
```

Lalu coba secara manual: dari koneksi dengan peran aplikasi, jalankan `UPDATE audit_log SET ...`. Harus ditolak basis data, bukan ditolak kode.

### Kesalahan umum

**Menunda `document_version` karena "belum ada tabel transaksional".** Justru sekarang waktunya — ia masuk ke template, bukan ke tabel.

**Menegakkan isolasi tenant hanya di kode.** Bila hanya di aplikasi, satu kueri yang lupa filter akan membocorkan data lintas tenant, dan tidak ada yang menangkapnya.

**Membuat tiga status sebagai tiga kolom `varchar`.** Buat sebagai tipe enum, agar nilai yang salah ditolak basis data.

---

# FASE B — Identitas & Kerangka Aplikasi

## Sesi B1 — Autentikasi & Sesi

**Tujuan:** orang dapat masuk dengan aman. Belum izin.
**Perkiraan:** 2–3 jam.

### Prompt

```
Baca docs/Module_02_Identity_Access_Management.md.

Implementasikan bagian autentikasi dan sesi saja. Belum izin, belum peran.

Cakupan: registrasi, verifikasi email, login, MFA berbasis TOTP dengan kode
pemulihan, refresh token dengan rotasi dan deteksi penggunaan ulang, daftar
sesi aktif, dan pencabutan.

Keputusan dari dokumen yang tidak boleh disimpangi:
- Email unik lintas seluruh sistem, disimpan sebagai citext
- Kata sandi Argon2id, minimal 12 karakter, TANPA aturan komposisi karakter
- Token membawa identitas dan keanggotaan tenant, TIDAK membawa company_id
- Perubahan kata sandi mencabut seluruh sesi kecuali yang sedang berjalan
- Pesan kredensial salah tidak pernah membedakan email tidak ditemukan dari
  kata sandi salah

Tulis test negatif untuk:
- Penggunaan ulang refresh token terdeteksi dan seluruh rantai dicabut
- Penguncian bertahap bekerja setelah percobaan gagal berulang
- Sesi yang dicabut berhenti berlaku seketika
- Registrasi dengan email terdaftar tidak membocorkan bahwa email itu ada

Setelah selesai, sebutkan tiga kelemahan implementasi ini dan perbaiki yang
paling serius.
```

### Cara memverifikasi

Jalankan alur penuh lewat `curl` atau REST client: daftar, verifikasi, login, refresh, cabut. Lalu coba pakai refresh token lama — harus ditolak dan seluruh sesi tercabut.

### Kesalahan umum

**Menaruh `company_id` di token.** Ini merusak keputusan URL di Information Architecture §2 dan membuat tautan lintas company tidak berfungsi.

**Menambahkan aturan komposisi kata sandi** karena terasa lebih aman. Ia menurunkan entropi nyata.

---

## Sesi B2 — Resolusi Izin & Kontrak Kesalahan

**Tujuan:** izin yang dapat diterjemahkan menjadi klausa `WHERE`.
**Perkiraan:** 3–4 jam. Bagian tersulit di Fase B.

### Prompt

```
Baca docs/Module_02_Identity_Access_Management.md bagian 6 dan 7, dan
docs/Information_Architecture.md bagian 5.

Implementasikan model izin: tenant_memberships, company_access, roles,
permissions, role_permissions.

Keputusan yang mengikat:
- Peran melekat pada pasangan pengguna–company, bukan pada pengguna
- Satu peran per pasangan pengguna–company
- Izin berformat modul.entitas.aksi:cakupan
- Konteks company diambil dari path URL, diperiksa per permintaan
- Katalog izin punya DUA penanda: delegatable_to_agent dan
  grantable_to_integration. Lihat docs/Module_17_Public_API_Integration.md
  bagian 1 — ia merevisi keputusan awal Modul 02.

Yang paling penting: izin harus dapat diterjemahkan menjadi predikat kueri.
Bangun mekanisme yang mengubah cakupan izin menjadi klausa WHERE. Buktikan
dengan test bahwa penyaringan terjadi di basis data — periksa kueri yang
benar-benar dijalankan, bukan hanya hasil akhirnya.

Implementasikan kontrak kesalahan tiga sebab: permission_denied,
plan_restricted, state_restricted. Setiap penolakan wajib menyebutkan sebabnya
— frontend bergantung pada pembedaan ini untuk memutuskan menyembunyikan,
menawarkan upgrade, atau menonaktifkan dengan alasan.

Test negatif wajib, masing-masing terpisah:
- Pengguna company A mengambil data company B lewat manipulasi path
- Lewat pencarian global
- Lewat laporan
Ketiganya harus gagal, dan yang ketiga adalah yang paling sering bocor.
```

### Cara memverifikasi

Aktifkan log kueri. Jalankan permintaan sebagai pengguna terbatas dan **baca SQL yang dihasilkan** — filter tenant dan company harus ada di dalam `WHERE`, bukan diterapkan setelahnya.

### Kesalahan umum

**Menyaring setelah data diambil.** Ia berfungsi di test dan bocor lewat jumlah total hasil.

**Mengembalikan 403 polos.** Frontend tidak dapat membedakan tiga kasus, dan kebijakan tiga arah di IA §5 menjadi mustahil.

---

## Sesi B3 — App Shell & Command Palette

**Tujuan:** kerangka aplikasi yang dipakai seluruh modul.
**Perkiraan:** 3–4 jam.

### Prompt

```
Baca docs/Layout_System.md dan docs/Component_Specs_AppShell.md.
Lihat docs/Paadu_Flow_Prototype.jsx sebagai referensi yang sudah berjalan —
tapi jangan menyalinnya mentah, ia prototype dengan data statis.

Bangun app shell React: top bar, module rail tersemat, sidebar kontekstual,
area konten, dan panel kanan opsional.

Yang tidak boleh disederhanakan:
- Empat lapis indikator konteks company (Layout_System bagian 4). Yang paling
  sering terlewat adalah lapis kedua: baris konteks di page header setiap
  halaman transaksional.
- Skip link dan struktur landmark (Component_Specs_AppShell bagian 7)
- Focus ring di seluruh elemen interaktif, memakai :focus-visible
- Pengalih company dengan navigasi keyboard penuh, banner konfirmasi
  aria-live="assertive", dan fokus kembali ke pemicu saat ditutup
- Command palette dengan empat kelompok hasil, dibatasi izin
- Toggle tema dan kepadatan, tersimpan per pengguna

Seluruh nilai visual dari tokens.css. Lint akan menolak bila tidak.

Setelah selesai, jalankan audit aksesibilitas otomatis dan tunjukkan hasilnya
beserta severity tiap temuan.
```

### Cara memverifikasi

Navigasikan seluruh shell **tanpa menyentuh mouse**. Tab dari awal halaman — elemen pertama yang menerima fokus harus skip link.

### Kesalahan umum

**Melewatkan baris konteks di page header** karena nama company sudah ada di top bar. Orang yang menginput faktur menatap form, bukan chrome.

---

# FASE C — Komponen Inti

## Sesi C1 — Komponen Primitif

**Perkiraan:** 4–6 jam. Dapat dipecah dua sesi.

### Prompt

```
Baca docs/Component_Specs_Primitives.md secara lengkap.

Bangun component library primitif. Setiap komponen wajib punya seluruh state
dan ukuran yang tertulis, di light dan dark mode.

Yang paling mudah terlewat, periksa satu per satu:
- Loading pada tombol tidak mengubah lebarnya
- Currency input: pemisah ribuan diterapkan saat BLUR, bukan saat mengetik.
  Saat fokus, tampilkan angka mentah.
- IDR tanpa desimal secara bawaan
- Readonly berbeda dari disabled — readonly tetap dapat difokus dan disalin
- Fiscal period picker menampilkan label fiskal DAN bulan kalendernya
- Switch berarti berlaku seketika; checkbox berarti bagian dari form yang
  perlu disimpan
- Checkbox punya state indeterminate untuk header tabel

Setiap komponen menerima id, name, aria-describedby, dan data-testid.

Buat halaman galeri di /dev/components yang menampilkan seluruh komponen
dengan seluruh state sekaligus, agar konsistensinya dapat dinilai mata.

Tulis test untuk perilaku keyboard setiap komponen interaktif.
```

### Cara memverifikasi

Buka galeri, ganti tema dan kepadatan, dan periksa: tidak ada komponen yang pecah, tidak ada warna yang tidak ikut berubah.

### Kesalahan umum

**Currency input yang memformat saat mengetik.** Kursor melompat, dan orang yang menginput ratusan angka sehari akan membencinya dalam tiga hari.

---

## Sesi C2 🗺️ — Data Table

**Tujuan:** komponen tunggal terpenting di seluruh produk.
**Perkiraan:** 6–8 jam. Jangan diburu.

### Prompt

```
Masuk plan mode.

Baca docs/Component_Specs_Composite.md bagian 1 secara sangat teliti.
Komponen ini muncul di setiap modul — cara Anda membangunnya menentukan
kualitas seluruh produk.

Rancang dulu, tunjukkan rencananya, baru bangun.

Yang tidak boleh disederhanakan:
- Seleksi: checkbox header HANYA memilih halaman ini. Afordans terpisah untuk
  "pilih semua N baris yang cocok dengan filter". Keduanya harus dapat
  dibedakan pengguna kapan pun, karena konsekuensinya berbeda jauh.
- Aksi massal atas seluruh hasil mengirim kueri filter ke server, BUKAN daftar ID
- Empat state kosong yang berbeda, masing-masing dengan aksi yang berbeda:
  belum ada data, sedang memuat, gagal memuat, tidak ada hasil setelah filter
- Skeleton berbentuk tabel akhir — jumlah kolom dan tinggi baris sama
- Sort dapat dioperasikan keyboard: bungkus label header dalam button, JANGAN
  pasang onClick di th
- Baris dapat dibuka keyboard: sediakan elemen yang dapat difokus, JANGAN
  jadikan onClick di tr sebagai satu-satunya jalan
- scope="col" di seluruh header

Pagination sebagai default. Virtual scroll sebagai mode terpisah untuk laporan.

Uji dengan 50.000 baris sintetis dan laporkan angka performanya.
```

### Cara memverifikasi

Operasikan seluruh tabel dengan keyboard: urutkan kolom, pilih baris, buka detail. Lalu matikan jaringan dan periksa state gagal muncul dengan aksi pemulihan.

### Kesalahan umum

**`onClick` di `<tr>` dan `<th>`.** Ini persis temuan Major di audit prototype — fitur yang sepenuhnya tidak tersedia bagi pengguna keyboard, dan tidak tertangkap pemeriksa kontras otomatis.

---

## Sesi C3 — Line-Item Editor

**Perkiraan:** 4–6 jam.

### Prompt

```
Baca docs/Flow_Archetypes.md bagian 4 dan docs/Component_Specs_Composite.md.

Bangun line-item editor. Ia dipakai di Faktur, Tagihan, Pesanan, Jurnal,
Penyesuaian Stok, dan BOM — bangun sekali dengan benar.

Keyboard-first, tidak dapat ditawar:
Tab pindah sel · Enter turun baris · Enter di sel terakhir menambah baris ·
Ctrl+D menyalin dari baris atas · tempel blok dari Excel mengisi banyak baris

URUTAN PERHITUNGAN — ikuti persis:
1. Bruto baris = qty × harga satuan
2. Diskon baris
3. Neto baris
4. Subtotal dokumen = jumlah neto baris
5. Diskon dokumen DIALOKASIKAN PROPORSIONAL ke setiap baris
6. DPP
7. Pajak dihitung PER BARIS di atas neto setelah alokasi
8. Total
Pembulatan HANYA di langkah terakhir.

Alokasi proporsional itu penting dan bukan preferensi: pajak dihitung per baris
dan tarifnya bisa berbeda antar baris. Mengurangkan diskon dokumen di akhir
menghasilkan DPP dan pajak yang salah.

Tulis test untuk: kasus batas pembulatan, diskon nol, tarif pajak campuran
dalam satu dokumen, baris berkuantitas nol, dan tempel 200 baris dari Excel.
```

### Cara memverifikasi

Isi faktur dengan tiga baris tarif pajak berbeda dan diskon dokumen 5%. Hitung manual dengan kalkulator dan bandingkan sampai rupiah terakhir.

---

# FASE D — Modul Referensi

## Sesi D1 🗺️ — Akuntansi Inti

**Perkiraan:** 5–7 jam.

### Prompt

```
Masuk plan mode.

Baca docs/Module_07_Accounting.md.

Bangun inti akuntansi saja: bagan akun, jurnal, buku besar, dan LAPISAN
PENENTUAN AKUN. Belum laporan keuangan, belum rekonsiliasi bank, belum tutup
periode.

Lapisan penentuan akun adalah bagian terpenting sesi ini. Ia yang membuat
modul lain tidak pernah menyebut nomor akun — dan yang membuat janji
"konfigurasi bukan kustomisasi kode" dapat ditepati.

- Matriks aturan dengan spesifisitas; aturan paling spesifik menang
- Aturan tidak ditemukan MENOLAK posting, dengan pesan yang menyebutkan aturan
  apa yang kurang. Tidak ada akun cadangan — akun cadangan menyembunyikan salah
  konfigurasi sampai tutup buku.
- Endpoint /account-rules/resolve untuk menguji sebelum menyimpan

Penegakan tingkat basis data:
- Jurnal tidak berimbang tidak dapat tersimpan
- Satu baris tidak boleh punya debit dan kredit sekaligus
- Akun kontrol tidak dapat dijurnal manual

Tambahkan test invarian: neraca saldo selalu seimbang setelah rangkaian
transaksi acak. Jalankan minimal 200 transaksi acak, bukan 5.
```

---

## Sesi D2 — Persediaan Inti

**Perkiraan:** 5–7 jam.

### Prompt

```
Baca docs/Module_05_Inventory.md.

Bangun inti persediaan: item, satuan dan konversinya, gudang, mutasi stok,
saldo, reservasi, dan lapisan biaya. Belum transfer, belum stok opname,
belum batch dan nomor seri.

Keputusan yang mengikat:
- stock_movements append-only. Saldo adalah PROYEKSI yang dapat dibangun ulang
  sepenuhnya dari mutasi. Bila keduanya berbeda, mutasi yang benar.
- qty_available TIDAK disimpan. Ia qty_on_hand dikurangi qty_reserved.
- Seluruh mutasi disimpan dalam satuan dasar. Konversi hanya di lapisan
  tampilan dan input.
- Reservasi memakai penguncian baris, bukan periksa-lalu-tulis.

Test konkurensi wajib: dua pesanan bersamaan atas sisa stok terakhir — tepat
satu berhasil. Jalankan 100 kali untuk memastikan bukan kebetulan.

Test invarian: saldo proyeksi sama dengan jumlah mutasi, diuji setelah beban
konkuren tinggi. Sediakan juga perintah untuk membangun ulang seluruh proyeksi
dari mutasi, dan buktikan hasilnya identik.
```

---

## Sesi D3 🗺️ — Penjualan Sampai Posting

**Tujuan:** modul referensi. Cara Anda membangunnya akan disalin dua puluh kali.
**Perkiraan:** 8–12 jam. Dapat dipecah dua sesi.

### Prompt

```
Masuk plan mode.

Baca docs/Module_04_Sales.md dan docs/Flow_Archetypes.md.

Bangun modul Penjualan: pelanggan, penawaran, pesanan, faktur, sampai posting.
Belum faktur pajak, belum pembayaran, belum retur.

Ini modul referensi. Ikuti Flow Archetypes apa adanya — jangan menciptakan
dialek modul sendiri, karena dialek itu akan menyebar.

Keputusan yang mengikat:
- Satu tabel untuk penawaran, pesanan, dan faktur. Yang berbeda hanya transisi
  status yang diizinkan.
- Nomor diberikan saat submit, bukan saat draf. Tahan konkurensi, tanpa celah.
- qty_invoiced dan qty_delivered per BARIS, bukan per dokumen.
- Konversi menolak kuantitas melebihi sisa yang belum dikonversi.
- Posting atomik: dokumen, jurnal lewat penentuan akun, dan mutasi stok
  berhasil bersama atau gagal bersama.
- PATCH wajib If-Match document_version. Konflik mengembalikan 409 dengan
  daftar field yang bentrok, siapa mengubahnya, dan kapan.
- Dokumen terposting tidak dapat diedit oleh peran mana pun.
- Pengaju tidak dapat menyetujui dokumennya sendiri, meski punya izin.

Test konkurensi: sepuluh submit bersamaan menghasilkan sepuluh nomor berurutan
tanpa celah dan tanpa duplikat. Jalankan berulang.

Setelah selesai, sebutkan komponen UI apa saja yang Anda butuhkan dan apakah
seluruhnya sudah ada di component library.
```

---

## Sesi D4 — 🚪 Gerbang: Uji Invarian Lintas Modul

**Ini sesi penentu. Jangan lanjut ke modul lain sebelum lolos.**
**Perkiraan:** 3–5 jam.

### Prompt

```
Baca bagian Testing Strategy di docs/Module_04_Sales.md,
docs/Module_05_Inventory.md, dan docs/Module_07_Accounting.md.

Bangun rangkaian test invarian berbasis properti di tests/invariants/.
Bangkitkan ratusan transaksi acak lintas ketiga modul, lalu buktikan:

1. Neraca saldo selalu seimbang
2. Saldo akun kontrol piutang sama dengan jumlah sisa tagihan di Penjualan
3. Saldo akun persediaan sama dengan nilai persediaan di Modul 05
4. Saldo stok dari proyeksi sama dengan jumlah mutasi
5. Jumlah nilai baris faktur sama dengan subtotalnya, untuk setiap faktur
6. Tidak ada celah pada nomor dokumen

Ini bukan unit test. Ia harus menjalankan alur nyata lewat layanan aplikasi,
bukan memanipulasi tabel langsung.

Jalankan juga dengan konkurensi: beberapa alur berjalan bersamaan.

Setelah lulus, jawab dua pertanyaan dengan jujur:
1. Apakah membangun modul Penjualan memerlukan komponen UI baru yang belum ada
   di component library? Bila ya, sebutkan mana saja.
2. Apakah ada tempat di kode Penjualan yang menyimpang dari Flow Archetypes?
   Bila ya, catat di docs/DECISIONS.md beserta alasannya.
```

### Gerbangnya

**Bila tidak ada komponen baru:** design system Anda terbukti. Sembilan belas modul berikutnya akan jauh lebih cepat.

**Bila ada komponen baru:** kembali ke Fase C, tambahkan ke library dengan benar, lalu ulangi. Menemukannya sekarang jauh lebih murah daripada di modul kelima, saat sudah ada lima varian komponen yang sama.

---

# FASE E — Pengerasan

## Sesi E1 — Aksesibilitas & Performa

### Prompt

```
Baca docs/Audit_Accessibility_Quality.md.

Jalankan audit yang sama terhadap kode nyata, bukan terhadap prototype.

Aksesibilitas:
- Hitung rasio kontras seluruh pasangan token yang dipakai, di kedua mode.
  Laporkan angkanya, bukan hanya lulus atau gagal.
- Verifikasi seluruh fungsi dapat dicapai keyboard. Perhatikan pola yang gagal
  di audit prototype: onClick di tr dan th.
- Jalankan pengujian screen reader nyata dan laporkan temuannya.
- Verifikasi target sentuh 44px di viewport sentuh.
- Uji zoom 200% — layout tidak boleh pecah.

Performa:
- Daftar faktur 100.000 baris dengan filter aktif — target di bawah 300ms
- Tidak ada layout shift saat data tiba
- Beban analitis tidak menaikkan latensi transaksi

Untuk setiap temuan: severity, lokasi, perbaikan. Perbaiki Critical dan Major.

Penting: periksa juga asumsi tes Anda sendiri. Di audit prototype, dua dari
empat kegagalan ternyata ada di tesnya, bukan di kodenya — ambang yang salah
diterapkan pada elemen yang tidak memerlukannya.
```

---

## Sesi E2 — CI/CD & Observabilitas

### Prompt

```
Baca docs/Platform_Architecture_Resilience.md bagian 6 dan 7.

Bangun CI/CD dan observabilitas.

CI wajib menggagalkan build pada:
- Lint token dan aturan desain
- Test unit dan integrasi
- Test invarian
- Uji kompatibilitas skema: migrasi harus bersifat menambah, bukan mengubah
  arti kolom yang ada
- Deteksi UPDATE atau DELETE pada tabel append-only di kode mana pun

Observabilitas tiga lapis:
- Teknis: latensi, kesalahan, saturasi, per endpoint dan per tenant
- Bisnis: faktur diposting per jam, keberhasilan sinkronisasi, antrean otomasi.
  Anomali di sini sering muncul sebelum metrik teknis.
- Invarian: pemeriksaan berkala, dan PELANGGARANNYA ADALAH INSIDEN meski belum
  ada pengguna yang mengeluh

Setiap permintaan membawa X-Request-Id yang muncul di log, jejak, dan audit
trail — sehingga satu ID cukup untuk menelusuri seluruh rangkaian.

Terakhir: tulis runbook singkat untuk tiga skenario di tangga degradasi
(Platform_Architecture_Resilience bagian 4).
```

---

## Urutan Modul Sesudahnya

Setelah gerbang D4 lolos:

**Pembelian** → melengkapi harga pokok dan akun perantara
**Pajak** → Penjualan dan Pembelian sudah menitipkan pekerjaan
**Persediaan lanjutan** → transfer, stok opname, batch dan nomor seri
**Akuntansi lanjutan** → laporan keuangan, rekonsiliasi bank, tutup periode
**POS** → paling berbeda, luring-first, kerjakan setelah inti stabil

Fase 3 ke atas mengikuti nomor modul.

---

## Kebiasaan yang Membuat Perbedaan

**Plan mode untuk kerja besar.** Sesi bertanda 🗺️ paling berisiko dikerjakan tanpa rencana. Baca rencananya sampai habis.

**Scope konteks.** Sebut berkas yang harus dibaca. Jangan bilang "baca semuanya" — itu membanjiri konteks dengan hal yang tidak relevan.

**Berikan alat verifikasi.** Prompt yang menghasilkan logika harus disertai test. Claude Code jauh lebih baik saat punya cara memeriksa hasilnya sendiri.

**Commit kecil dan sering**, dengan pesan yang menyebut keputusan, bukan hanya perubahan.

**Minta kritik diri.** Tambahkan: *"Setelah selesai, sebutkan tiga kelemahan implementasi ini dan perbaiki yang paling serius."*

**Catat penyimpangan di `docs/DECISIONS.md`.** Dokumen yang tidak lagi cocok dengan kode lebih berbahaya daripada tidak ada dokumen — karena orang tetap mempercayainya.

**Berhenti saat lelah.** Sesi D3 sebaiknya dipecah dua daripada diselesaikan larut malam. Modul referensi yang buruk akan disalin dua puluh kali.
