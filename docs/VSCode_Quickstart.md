# Paadu Flow — Panduan VS Code
### Pasang, kenali panelnya, lalu 15 prompt siap tempel

*Pendamping `Build_Playbook_Claude_Code.md`. Penjelasan lengkap tiap sesi ada di sana — berkas ini fokus pada **apa yang Anda klik dan apa yang Anda tempel** di VS Code.*

---

# Bagian 1 — Pasang

**1.** Unduh dan pasang **Visual Studio Code** dari `code.visualstudio.com`.

**2.** Buka VS Code. Klik ikon **Extensions** di bilah kiri (bentuknya empat kotak).

**3.** Ketik **Claude Code** di kotak pencarian. Pilih yang penerbitnya **Anthropic**. Klik **Install**.

**4.** **File → Open Folder** → pilih folder `Paaduflow` Anda. Bukan folder induknya — folder repo itu sendiri.

**5.** Klik ikon **Claude** di bilah kiri. Masuk dengan akun Anthropic Anda. Tidak perlu API key — langganan Pro, Max, Team, atau Enterprise sudah cukup.

**Verifikasi:** di Explorer (bilah kiri) Anda harus melihat `docs`, `src`, `tests`, `migrations`, `tools`, dan `CLAUDE.md`. Bila tidak, folder yang dibuka salah.

---

# Bagian 2 — Kenali Panelnya

Empat hal yang akan Anda pakai terus-menerus.

### Pemilih mode

Ada tiga pilihan di atas kotak input:

| Mode | Perilaku | Kapan dipakai |
|---|---|---|
| **Default** | Meminta izin di setiap perubahan berkas | **Selalu, selama Fase A dan B** |
| Edit otomatis | Menerapkan perubahan tanpa bertanya | Nanti, untuk tugas kecil yang Anda paham |
| **Plan mode** | Menyusun rencana dulu, jalankan setelah disetujui | Sesi bertanda 🗺️ |

Biarkan di **Default** sampai minimal Sesi B3. Otomatis menerima terasa lebih cepat, tapi Anda kehilangan kesempatan melihat apa yang sebenarnya berubah — dan di fase fondasi, itu justru yang paling perlu Anda pahami.

### `@` untuk menyebut berkas

Ketik `@` di kotak input, lalu ketik sebagian nama berkas. Daftar akan muncul, pilih dengan panah dan Enter.

Ini **lebih andal** daripada menulis "baca docs/Module_04_Sales.md" sebagai teks biasa, karena berkasnya benar-benar dimuat ke konteks, bukan dicari sendiri.

### Meninjau diff

Saat Claude mengusulkan perubahan, editor akan menampilkan perbandingan berdampingan: baris hijau ditambahkan, merah dihapus. Ada tombol **Accept** dan **Reject**.

**Baca sebelum menerima.** Ini instruksi yang paling sering diabaikan dan paling sering disesali. Claude kadang mengubah hal di sekitarnya yang tidak Anda minta.

### Percakapan baru

Setiap sesi di playbook ini = **percakapan baru**. Klik tombol `+` di panel Claude. Jangan melanjutkan percakapan lama — konteks yang tercampur menghasilkan hasil yang tercampur.

---

# Bagian 3 — Sesi 0: Uji Pertama

Sebelum menyentuh kode.

**Mode:** Default · **Percakapan:** baru

```
Baca @CLAUDE.md dan @docs/README.md.

Ringkas dalam 5 kalimat: produk ini apa, ada berapa modul, dan tiga aturan
teknis apa yang paling mengikat.
```

**Lulus bila** ringkasannya menyebut multi-tenant, 19 modul, dan menyinggung `tokens.json`, `document_version`, atau tabel append-only.

**Bila kabur:** folder yang dibuka salah, atau `@` tidak berhasil memuat berkas. Perbaiki sekarang — lima belas sesi berikutnya bergantung pada ini.

---

# Bagian 4 — 15 Prompt Siap Tempel

Penjelasan lengkap tiap sesi ada di `docs/Build_Playbook_Claude_Code.md`. Yang di bawah ini adalah versi yang tinggal ditempel, sudah memakai `@`.

---

## 🗺️ Sesi A1 — Stack & Scaffolding

**Mode:** Plan mode · **Perkiraan:** 1–2 jam

```
Baca @docs/Design_Handoff_Spec.md dan
@docs/Module_01_Multi_Tenant_Organization_Foundation.md.

Rancang struktur repo dan pilih stack untuk Business OS multi-tenant ini.
Tunjukkan rencana sebelum menulis kode.

Batasan yang tidak dapat ditawar:
- Transaksi ACID sejati. Posting dokumen menyentuh beberapa tabel, harus atomik.
- Mampu menegakkan isolasi tenant di tingkat basis data, bukan hanya aplikasi.
- Pekerjaan latar yang andal untuk ekspor, impor, penggajian, penyusutan.
- Pola outbox untuk peristiwa, agar audit log dan notifikasi tidak pernah hilang.
- Migrasi bertahap dan kompatibel dua arah.
- Frontend React memakai design token dari docs/tokens.json.

Untuk setiap pilihan stack, sebutkan alternatif yang dipertimbangkan dan alasan
pilihan Anda menang. Saya lebih peduli alasannya daripada pilihannya.

Struktur repo memisahkan domain, aplikasi, infrastruktur, dan antarmuka
mengikuti Clean Architecture. Folder src/ sudah ada beserta README penjelasnya —
baca dan ikuti.

Jelaskan bagaimana struktur ini menampung 30+ modul tanpa menjadi monolit.

Terakhir, catat keputusan sesi ini di docs/DECISIONS.md beserta alasannya.
```

**Yang Anda lakukan:** baca rencananya sampai habis. Koreksi lewat pesan biasa. Setujui hanya bila Anda paham alasan tiap pilihan.

---

## Sesi A2 — Pipeline Token & Penegakan

**Mode:** Default · **Perkiraan:** 1 jam

```
Baca @docs/Design_Tokens.md dan @docs/tokens.json.

Bangun tiga hal:

1. PIPELINE TOKEN
   Style Dictionary yang membaca docs/tokens.json dan menghasilkan
   src/styles/tokens.css (custom properties untuk :root dan
   [data-theme="dark"]) serta src/styles/tokens.ts (tipe TypeScript).
   Keduanya sudah ada di .gitignore sebagai berkas generated.

2. LINT RULE YANG MENGGAGALKAN BUILD
   - Nilai warna hex mentah di kode komponen
   - Nilai px yang tidak ada di skala spacing tokens.json
   - z-index literal
   - opacity pada elemen yang memuat teks
   - Impor token Lapis 1 dari kode komponen — hanya Lapis 2 dan 3

3. HOOK PRE-COMMIT yang menjalankan lint dan menolak commit yang melanggar.

Untuk setiap rule, tulis test dengan berkas fixture yang melanggar, dan
pastikan test gagal bila rule dihapus.

docs/Design_Tokens.md bagian 12 mencatat kemungkinan border-default dan
border-strong tertukar. Tampilkan nilai keduanya ke saya. Jangan diperbaiki
sendiri.
```

**Verifikasi manual:** buat berkas berisi `color: #FF0000`, jalankan `npm run lint`. Harus gagal. Hapus berkasnya setelah terbukti.

---

## 🗺️ Sesi A3 — Skema Fondasi

**Mode:** Plan mode · **Perkiraan:** 2–3 jam · **Sesi paling penting**

```
Baca @docs/Design_Handoff_Spec.md bagian 2 — dua belas konsekuensi desain
terhadap skema. Baca juga @docs/Module_01_Multi_Tenant_Organization_Foundation.md
dan @docs/Information_Architecture.md bagian 3 tentang tiga sumbu status.

Rancang migrasi fondasi. Tunjukkan rencana sebelum menulis.

Wajib ada di migrasi pertama:
- Kolom audit baku sebagai konvensi bersama
- tenant_id dan company_id sebagai bagian indeks utama
- document_version untuk optimistic concurrency
- Tiga tipe enum status terpisah, sebagai tipe yang dapat dipakai ulang
- Tabel tenants dan companies sesuai Module 01

Buat TEMPLATE TABEL TRANSAKSIONAL — fungsi atau macro yang menambahkan seluruh
kolom lintas-modul sekaligus, sehingga modul berikutnya tidak dapat lupa.

Penegakan tingkat basis data:
- Row-level security untuk isolasi tenant
- Peran aplikasi tanpa UPDATE dan DELETE pada tabel append-only. Buat daftar
  nama tabel append-only sebagai konstanta agar migrasi berikutnya tinggal
  menambah nama.
- Constraint yang menolak jurnal tidak berimbang

Buat kerangka test di tests/invariants/ dengan tiga contoh berjalan: isolasi
tenant, penolakan UPDATE pada tabel append-only, penolakan jurnal tidak berimbang.

Setelah selesai, sebutkan butir mana dari dua belas yang belum tercakup dan
kapan sebaiknya ditambahkan.
```

**Bandingkan rencananya** dengan `docs/Design_Handoff_Spec.md` §2. Dua belas butir itu harus semuanya muncul.

---

## Sesi B1 — Autentikasi & Sesi

**Mode:** Default · **Perkiraan:** 2–3 jam

```
Baca @docs/Module_02_Identity_Access_Management.md.

Implementasikan autentikasi dan sesi saja. Belum izin, belum peran.

Cakupan: registrasi, verifikasi email, login, MFA berbasis TOTP dengan kode
pemulihan, refresh token dengan rotasi dan deteksi penggunaan ulang, daftar
sesi aktif, pencabutan.

Yang tidak boleh disimpangi:
- Email unik lintas sistem, disimpan sebagai citext
- Kata sandi Argon2id, minimal 12 karakter, TANPA aturan komposisi karakter
- Token membawa identitas dan keanggotaan tenant, TIDAK membawa company_id
- Perubahan kata sandi mencabut seluruh sesi kecuali yang berjalan
- Pesan kredensial salah tidak membedakan email tidak ditemukan dari kata
  sandi salah

Test negatif wajib: penggunaan ulang refresh token terdeteksi dan seluruh
rantai dicabut · penguncian bertahap bekerja · sesi dicabut berhenti seketika ·
registrasi dengan email terdaftar tidak membocorkan bahwa email itu ada.

Setelah selesai, sebutkan tiga kelemahan implementasi ini dan perbaiki yang
paling serius.
```

---

## Sesi B2 — Resolusi Izin & Kontrak Kesalahan

**Mode:** Default · **Perkiraan:** 3–4 jam

```
Baca @docs/Module_02_Identity_Access_Management.md bagian 6 dan 7, dan
@docs/Information_Architecture.md bagian 5.

Implementasikan model izin: tenant_memberships, company_access, roles,
permissions, role_permissions.

Keputusan yang mengikat:
- Peran melekat pada pasangan pengguna–company, bukan pada pengguna
- Satu peran per pasangan pengguna–company
- Izin berformat modul.entitas.aksi:cakupan
- Konteks company diambil dari path URL, diperiksa per permintaan
- Katalog izin punya DUA penanda: delegatable_to_agent dan
  grantable_to_integration. Lihat @docs/Module_17_Public_API_Integration.md
  bagian 1 — ia merevisi keputusan awal Modul 02.

Yang paling penting: izin harus dapat diterjemahkan menjadi predikat kueri.
Bangun mekanisme yang mengubah cakupan izin menjadi klausa WHERE. Buktikan
dengan test bahwa penyaringan terjadi di basis data — periksa SQL yang
benar-benar dijalankan, bukan hanya hasil akhirnya.

Implementasikan kontrak kesalahan tiga sebab: permission_denied,
plan_restricted, state_restricted.

Test negatif, masing-masing terpisah: pengguna company A mengambil data
company B lewat manipulasi path · lewat pencarian global · lewat laporan.
Yang ketiga paling sering bocor.
```

---

## Sesi B3 — App Shell & Command Palette

**Mode:** Default · **Perkiraan:** 3–4 jam

```
Baca @docs/Layout_System.md dan @docs/Component_Specs_AppShell.md.
Lihat @docs/Paadu_Flow_Prototype.jsx sebagai referensi yang sudah berjalan —
jangan disalin mentah, ia prototype dengan data statis.

Bangun app shell React: top bar, module rail tersemat, sidebar kontekstual,
area konten, panel kanan opsional.

Yang tidak boleh disederhanakan:
- Empat lapis indikator konteks company. Yang paling sering terlewat adalah
  lapis kedua: baris konteks di page header setiap halaman transaksional.
- Skip link dan struktur landmark
- Focus ring di seluruh elemen interaktif, memakai :focus-visible
- Pengalih company dengan navigasi keyboard penuh, banner konfirmasi
  aria-live="assertive", dan fokus kembali ke pemicu saat ditutup
- Command palette dengan empat kelompok hasil, dibatasi izin
- Toggle tema dan kepadatan, tersimpan per pengguna

Seluruh nilai visual dari tokens.css.

Setelah selesai, jalankan audit aksesibilitas otomatis dan tampilkan hasilnya
beserta severity tiap temuan.
```

---

## Sesi C1 — Komponen Primitif

**Mode:** Default · **Perkiraan:** 4–6 jam, boleh dipecah dua

```
Baca @docs/Component_Specs_Primitives.md secara lengkap.

Bangun component library primitif. Setiap komponen wajib punya seluruh state
dan ukuran yang tertulis, di light dan dark mode.

Periksa satu per satu yang mudah terlewat:
- Loading pada tombol tidak mengubah lebarnya
- Currency input: pemisah ribuan saat BLUR, bukan saat mengetik. Saat fokus,
  tampilkan angka mentah.
- IDR tanpa desimal secara bawaan
- Readonly berbeda dari disabled — readonly tetap dapat difokus dan disalin
- Fiscal period picker menampilkan label fiskal DAN bulan kalendernya
- Switch berarti berlaku seketika; checkbox berarti bagian dari form
- Checkbox punya state indeterminate untuk header tabel

Setiap komponen menerima id, name, aria-describedby, dan data-testid.

Buat halaman galeri di /dev/components yang menampilkan seluruh komponen
dengan seluruh state sekaligus.

Tulis test perilaku keyboard untuk setiap komponen interaktif.
```

---

## 🗺️ Sesi C2 — Data Table

**Mode:** Plan mode · **Perkiraan:** 6–8 jam

```
Baca @docs/Component_Specs_Composite.md bagian 1 secara sangat teliti.
Komponen ini muncul di setiap modul.

Rancang dulu, tunjukkan rencananya, baru bangun.

Yang tidak boleh disederhanakan:
- Seleksi: checkbox header HANYA memilih halaman ini. Afordans terpisah untuk
  "pilih semua N baris yang cocok dengan filter". Keduanya harus dapat
  dibedakan pengguna kapan pun.
- Aksi massal atas seluruh hasil mengirim kueri filter ke server, BUKAN daftar ID
- Empat state kosong yang berbeda, masing-masing dengan aksi berbeda
- Skeleton berbentuk tabel akhir — jumlah kolom dan tinggi baris sama
- Sort dapat dioperasikan keyboard: bungkus label header dalam button, JANGAN
  pasang onClick di th
- Baris dapat dibuka keyboard: sediakan elemen yang dapat difokus, JANGAN
  jadikan onClick di tr satu-satunya jalan
- scope="col" di seluruh header

Pagination sebagai default. Virtual scroll sebagai mode terpisah untuk laporan.

Uji dengan 50.000 baris sintetis dan laporkan angka performanya.
```

---

## Sesi C3 — Line-Item Editor

**Mode:** Default · **Perkiraan:** 4–6 jam

```
Baca @docs/Flow_Archetypes.md bagian 4 dan @docs/Component_Specs_Composite.md.

Bangun line-item editor. Dipakai di Faktur, Tagihan, Pesanan, Jurnal,
Penyesuaian Stok, dan BOM — bangun sekali dengan benar.

Keyboard-first, tidak dapat ditawar:
Tab pindah sel · Enter turun baris · Enter di sel terakhir menambah baris ·
Ctrl+D menyalin dari baris atas · tempel blok dari Excel mengisi banyak baris

URUTAN PERHITUNGAN — ikuti persis:
1. Bruto baris = qty x harga satuan
2. Diskon baris
3. Neto baris
4. Subtotal dokumen
5. Diskon dokumen DIALOKASIKAN PROPORSIONAL ke setiap baris
6. DPP
7. Pajak dihitung PER BARIS di atas neto setelah alokasi
8. Total
Pembulatan HANYA di langkah terakhir.

Alokasi proporsional itu bukan preferensi: pajak dihitung per baris dan
tarifnya bisa berbeda antar baris. Mengurangkan diskon di akhir menghasilkan
DPP dan pajak yang salah.

Test: kasus batas pembulatan, diskon nol, tarif pajak campuran dalam satu
dokumen, baris berkuantitas nol, tempel 200 baris dari Excel.
```

---

## 🗺️ Sesi D1 — Akuntansi Inti

**Mode:** Plan mode · **Perkiraan:** 5–7 jam

```
Baca @docs/Module_07_Accounting.md.

Bangun inti akuntansi saja: bagan akun, jurnal, buku besar, dan LAPISAN
PENENTUAN AKUN. Belum laporan keuangan, belum rekonsiliasi bank, belum tutup
periode.

Lapisan penentuan akun adalah bagian terpenting sesi ini. Ia yang membuat
modul lain tidak pernah menyebut nomor akun.

- Matriks aturan dengan spesifisitas; aturan paling spesifik menang
- Aturan tidak ditemukan MENOLAK posting, dengan pesan yang menyebutkan aturan
  apa yang kurang. Tidak ada akun cadangan.
- Endpoint /account-rules/resolve untuk menguji sebelum menyimpan

Penegakan tingkat basis data:
- Jurnal tidak berimbang tidak dapat tersimpan
- Satu baris tidak boleh punya debit dan kredit sekaligus
- Akun kontrol tidak dapat dijurnal manual

Tambahkan test invarian: neraca saldo selalu seimbang setelah minimal 200
transaksi acak.
```

---

## Sesi D2 — Persediaan Inti

**Mode:** Default · **Perkiraan:** 5–7 jam

```
Baca @docs/Module_05_Inventory.md.

Bangun inti persediaan: item, satuan dan konversinya, gudang, mutasi stok,
saldo, reservasi, lapisan biaya. Belum transfer, belum stok opname, belum
batch dan nomor seri.

Keputusan yang mengikat:
- stock_movements append-only. Saldo adalah PROYEKSI yang dapat dibangun ulang
  sepenuhnya dari mutasi. Bila berbeda, mutasi yang benar.
- qty_available TIDAK disimpan. Ia qty_on_hand dikurangi qty_reserved.
- Seluruh mutasi disimpan dalam satuan dasar. Konversi hanya di lapisan
  tampilan dan input.
- Reservasi memakai penguncian baris, bukan periksa-lalu-tulis.

Test konkurensi wajib: dua pesanan bersamaan atas sisa stok terakhir — tepat
satu berhasil. Jalankan 100 kali.

Sediakan perintah untuk membangun ulang seluruh proyeksi saldo dari mutasi,
dan buktikan hasilnya identik.
```

---

## 🗺️ Sesi D3 — Penjualan Sampai Posting

**Mode:** Plan mode · **Perkiraan:** 8–12 jam, sebaiknya dipecah dua

```
Baca @docs/Module_04_Sales.md dan @docs/Flow_Archetypes.md.

Bangun modul Penjualan: pelanggan, penawaran, pesanan, faktur, sampai posting.
Belum faktur pajak, belum pembayaran, belum retur.

Ini modul referensi. Ikuti Flow Archetypes apa adanya — jangan menciptakan
dialek modul sendiri, karena dialek itu akan menyebar ke dua puluh modul.

Keputusan yang mengikat:
- Satu tabel untuk penawaran, pesanan, dan faktur. Yang berbeda hanya transisi
  status yang diizinkan.
- Nomor diberikan saat submit, bukan saat draf. Tahan konkurensi, tanpa celah.
- qty_invoiced dan qty_delivered per BARIS, bukan per dokumen.
- Konversi menolak kuantitas melebihi sisa.
- Posting atomik: dokumen, jurnal lewat penentuan akun, dan mutasi stok
  berhasil bersama atau gagal bersama.
- PATCH wajib If-Match document_version. Konflik mengembalikan 409 dengan
  daftar field yang bentrok, siapa mengubahnya, dan kapan.
- Dokumen terposting tidak dapat diedit oleh peran mana pun.
- Pengaju tidak dapat menyetujui dokumennya sendiri, meski punya izin.

Test konkurensi: sepuluh submit bersamaan menghasilkan sepuluh nomor berurutan
tanpa celah dan tanpa duplikat.

Setelah selesai, sebutkan komponen UI apa saja yang Anda butuhkan dan apakah
seluruhnya sudah ada di component library.
```

---

## 🚪 Sesi D4 — Gerbang

**Mode:** Default · **Perkiraan:** 3–5 jam · **Jangan lanjut sebelum lolos**

```
Baca bagian Testing Strategy di @docs/Module_04_Sales.md,
@docs/Module_05_Inventory.md, dan @docs/Module_07_Accounting.md.

Bangun rangkaian test invarian berbasis properti di tests/invariants/.
Bangkitkan ratusan transaksi acak lintas ketiga modul, lalu buktikan:

1. Neraca saldo selalu seimbang
2. Saldo akun kontrol piutang sama dengan jumlah sisa tagihan di Penjualan
3. Saldo akun persediaan sama dengan nilai persediaan
4. Saldo stok dari proyeksi sama dengan jumlah mutasi
5. Jumlah nilai baris faktur sama dengan subtotalnya, untuk setiap faktur
6. Tidak ada celah pada nomor dokumen

Ini bukan unit test. Jalankan alur nyata lewat layanan aplikasi, bukan
memanipulasi tabel langsung. Jalankan juga dengan beberapa alur bersamaan.

Setelah lulus, jawab dua pertanyaan dengan jujur:
1. Apakah modul Penjualan memerlukan komponen UI baru yang belum ada di
   component library? Bila ya, sebutkan mana saja.
2. Apakah ada tempat di kode Penjualan yang menyimpang dari Flow Archetypes?
   Bila ya, catat di docs/DECISIONS.md beserta alasannya.
```

**Gerbangnya:** tidak ada komponen baru → design system terbukti, lanjut. Ada komponen baru → kembali ke Fase C dulu.

---

## Sesi E1 — Aksesibilitas & Performa

**Mode:** Default

```
Baca @docs/Audit_Accessibility_Quality.md.

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

Untuk setiap temuan: severity, lokasi, perbaikan. Perbaiki Critical dan Major.

Periksa juga asumsi tes Anda sendiri. Di audit prototype, dua dari empat
kegagalan ternyata ada di tesnya, bukan di kodenya.
```

---

## Sesi E2 — CI/CD & Observabilitas

**Mode:** Default

```
Baca @docs/Platform_Architecture_Resilience.md bagian 6 dan 7.

Bangun CI/CD dan observabilitas.

CI wajib menggagalkan build pada:
- Lint token dan aturan desain
- Test unit, integrasi, dan invarian
- Uji kompatibilitas skema: migrasi harus bersifat menambah
- Deteksi UPDATE atau DELETE pada tabel append-only di kode mana pun

Observabilitas tiga lapis:
- Teknis: latensi, kesalahan, saturasi, per endpoint dan per tenant
- Bisnis: faktur diposting per jam, keberhasilan sinkronisasi, antrean otomasi
- Invarian: pemeriksaan berkala, dan PELANGGARANNYA ADALAH INSIDEN meski belum
  ada pengguna yang mengeluh

Setiap permintaan membawa X-Request-Id yang muncul di log, jejak, dan audit trail.

Tulis runbook singkat untuk tiga skenario di tangga degradasi
(Platform_Architecture_Resilience bagian 4).
```

---

# Bagian 5 — Masalah Umum

**`@` tidak memunculkan daftar berkas.** Folder yang dibuka bukan root repo. Tutup, lalu **File → Open Folder** pilih folder `Paaduflow` itu sendiri.

**Diff tidak muncul, perubahan langsung diterapkan.** Mode sedang di "Edit otomatis". Ganti ke Default.

**Claude terasa lupa aturan proyek.** Percakapan sudah terlalu panjang. Mulai percakapan baru — `CLAUDE.md` dibaca ulang setiap percakapan.

**Claude menyentuh berkas yang tidak diminta.** Sebut ruang lingkupnya di prompt: "hanya ubah berkas di src/domain". Dan tolak diff yang di luar itu.

**Sesi terasa berat dan lambat.** Sesi terlalu besar. Pecah — misalnya Sesi C1 menjadi "komponen input" dan "komponen pilihan dan tampilan".

**Anda ragu apakah hasilnya benar.** Tanyakan langsung: *"Sebutkan tiga kelemahan implementasi ini dan perbaiki yang paling serius."* Ini sering memunculkan hal yang tidak terpikir saat menulis prompt.

---

# Bagian 6 — Kebiasaan yang Membuat Perbedaan

**Satu sesi, satu percakapan baru.**

**Baca diff sebelum menerima.** Selalu.

**Plan mode untuk sesi 🗺️.** Baca rencananya sampai habis. Koreksi satu detail sering berdampak besar.

**Commit setelah setiap sesi**, dengan pesan yang menyebut keputusan. Minta saja: *"Commit perubahan ini dengan pesan yang menjelaskan keputusan, bukan hanya daftar berkas."*

**Catat penyimpangan di `docs/DECISIONS.md`.** Dokumen yang tidak lagi cocok dengan kode lebih berbahaya daripada tidak ada dokumen.

**Berhenti saat lelah.** Sesi D3 lebih baik dipecah dua daripada diselesaikan larut malam. Modul referensi yang buruk akan disalin dua puluh kali.
