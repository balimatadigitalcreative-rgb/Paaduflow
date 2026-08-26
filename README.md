# Paadu Flow

**Business Operating System** — platform multi-tenant, multi-company untuk individu, UMKM, hingga enterprise Indonesia.

> **Status: implementasi berjalan.** Fondasi, autentikasi, model izin, lapisan HTTP, app shell, komponen primitif, serta modul Penjualan, Pembelian, dan Pajak sudah ada dan diuji. Antarmuka minimal sudah tersambung ke API, cukup untuk membuat faktur dari layar, mempostingnya, dan melihat angkanya di buku besar. Riwayat keputusannya di `docs/DECISIONS.md`; urutan pembangunannya di `docs/Build_Playbook_Claude_Code.md`.

---

## Menjalankan di komputer sendiri

Satu perintah, tanpa Docker dan tanpa memasang PostgreSQL:

```bash
npm install
npm run dev
```

Perintah itu menyalakan PostgreSQL sementara di `.paadu-dev/`, menjalankan migrasi, mengisi data contoh bila basis datanya masih kosong, lalu menyalakan API dan antarmuka web sekaligus. Penyiapan pertama memakan waktu satu-dua menit; jalan berikutnya beberapa detik.

| Yang dibuka | Alamat |
|---|---|
| **Antarmuka web** | **http://localhost:5173** |
| API | http://localhost:3000 |
| Dokumen OpenAPI | http://localhost:3000/openapi.json |

Masuk dengan salah satu akun contoh:

| Email | Peran | Kata sandi |
|---|---|---|
| `admin@contoh.test` | Admin Company | `kata sandi contoh yang panjang` |
| `staf@contoh.test` | Anggota | `kata sandi contoh yang panjang` |

Keduanya punya akses ke dua company: **PT Nusantara Contoh** (tahun fiskal mulai Januari) dan **PT Samudra Contoh** (mulai April). Pengalih company ada di kiri atas.

> **Seluruh isinya data contoh.** Nama perusahaan, pelanggan, vendor, NPWP, harga, dan bagan akunnya karangan. Kata sandinya sengaja lemah. Basis data yang pernah diisi `npm run seed:dev` tidak boleh dipakai sebagai basis data produksi.

### Menyalakan modul Pajak

`npm run dev` **tidak** mengisi data pajak, dan itu disengaja: seluruh tarifnya angka isian yang belum divalidasi konsultan pajak (V-07). Tanpa langkah ini, layar Kode Pajak akan kosong — bukan rusak.

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/paadu_dev \
COMPANY_ID=<id company> npm run seed:tax-dev
```

`COMPANY_ID` dapat disalin dari keluaran `npm run seed:dev`, yang mencetak blok siap tempel untuk tiap company. `TENANT_ID` dan kedua ID akun PPN ditemukan sendiri bila tidak disebut. Bila kandidatnya lebih dari satu, seed berhenti dan menyebutkan seluruhnya — ia tidak menebak.

Setelahnya company itu punya profil PKP, empat versi kode pajak, tiga aturan penentuan, dan seratus nomor seri.

Dijalankan dua kali pada company yang sama, ia berhenti dengan `duplicate key value violates unique constraint "tax_codes_…"`. Itu penolakan yang benar — dua versi kode yang sama tidak boleh berlaku pada tanggal yang sama — tetapi pesannya mentah, karena seed ini belum idempoten.

### Alur yang dapat dicoba

1. **Penjualan → Faktur baru.** Pilih customer, isi baris, simpan sebagai draf.
2. Di halaman detail: **Ajukan** (nomor diberikan di sini, bukan saat draf), **Setujui**, lalu **Posting ke buku besar**.
3. **Akuntansi → Buku Besar.** Jurnalnya sudah ada: Piutang Usaha di debit, Pendapatan dan PPN Keluaran di kredit.
4. **Pembelian → Pesanan Pembelian → buka satu pesanan yang disetujui → Catat penerimaan.**
5. **Pembelian → Faktur Pembelian → buka satu tagihan.** Panel pencocokan tiga arah menampilkan dipesan, diterima, dan ditagih berdampingan; baris yang menyimpang diberi keterangan, bukan sekadar warna.
6. **Pajak → Kode Pajak.** Satu baris per **versi**, bukan per kode: PPN-OUT muncul dua kali, 10% yang sudah ditutup dan 11% yang masih berlaku. Tombol **Ubah tarif** membuka formulir yang menyebutkan versi mana yang akan ditutup pada tanggal berapa — tarif tidak pernah diubah, ia digantikan.
7. **Pajak → Nomor Seri.** Terpakai, batal, kedaluwarsa, dan tersisa berdiri sendiri-sendiri, lalu dijumlahkan terhadap total dialokasikan. Nomor batal tidak pernah kembali ke pool, jadi menggabungkannya menjadi satu angka akan menyesatkan.
8. **Pajak → Faktur Pajak Masukan.** Kolom Kelengkapan menyebut **apa** yang kurang — "vendor bukan PKP", bukan sekadar bendera merah.
9. **Pajak → Rekonsiliasi.** Buku pajak berdampingan dengan akun pajak di buku besar, selisih per akun.

10. **Pajak → Terbitkan Faktur Pajak.** Memposting faktur penjualan menulis PPN ke buku besar, tetapi **tidak** menerbitkan faktur pajaknya — keduanya dokumen terpisah, dan satu faktur pajak dapat mencakup beberapa faktur komersial. Layar ini yang menjembataninya: pilih satu atau beberapa faktur terposting, lalu terbitkan. Nomor seri melekat saat terbit, bukan saat draf dibuat.

> **Rekonsiliasi baru cocok setelah langkah 10.** Sebelum faktur pajak diterbitkan, buku pajak memang tertinggal dari buku besar, dan Rekonsiliasi melaporkannya sebagai selisih. Itu perilaku yang benar, bukan kesalahan hitung.

### Bila sudah punya PostgreSQL sendiri

Pasang `DATABASE_URL`, dan basis data sementara tidak akan dinyalakan:

```bash
DATABASE_URL=postgresql://user:sandi@localhost:5432/paadu npm run dev
```

Basis datanya harus ber-encoding UTF8 — `npm run migrate` menolak yang bukan, dengan pesan yang menyebutkan sebabnya.

---

## Menjalankan di server

`npm run dev` **tidak boleh dipakai di server.** Ia menyalakan PostgreSQL sementara, menjalankan migrasi, dan menjalankan Vite — ketiganya benar di laptop dan salah di produksi. Alasannya di D-142.

Yang dipakai di server hanya dua perintah: `npm run build` lalu `npm start`. `npm start` **hanya** menyalakan server HTTP. Ia tidak menyentuh skema, tidak menyalakan basis data, dan menyajikan antarmuka sebagai berkas statis.

### Penyiapan sekali

```bash
git clone <repo> /home/paadu/app && cd /home/paadu/app
mkdir -p log

cp .env.example .env      # isi DATABASE_URL, PORT, TOKEN_SIGNING_SECRET, MFA_ENCRYPTION_KEY
npm ci --include=dev

# Kredensial migrasi, DI LUAR direktori aplikasi
printf 'MIGRATION_DATABASE_URL=postgresql://paadu_owner:...@localhost:5432/paadu
' > /home/paadu/.env.deploy
chmod 600 /home/paadu/.env.deploy

set -a && . /home/paadu/.env.deploy && set +a && npm run migrate

npm run build              # menghasilkan dist/web DAN dist/server
PAADU_DIR=/home/paadu/app pm2 start ecosystem.config.cjs
pm2 save
```

`npm ci --include=dev` bukan salah ketik: build memerlukan Vite dan TypeScript, yang keduanya devDependencies.

### Dua perintah, dan bedanya

| | Yang dilakukan | Dipakai saat |
|---|---|---|
| `npm run ship` | commit → push → deploy | Ada perubahan yang belum di-commit |
| `npm run deploy` | deploy saja | Kode sudah ter-push, atau mengulang deploy yang gagal |
| `npm run rollback` | kembali ke rilis sebelumnya | Rilis baru bermasalah dan perlu dibalik cepat |

`npm run ship` adalah pembungkus tipis. Seluruh logika server tetap milik `deploy`, dipanggil apa adanya — gerbang prasyarat, konfirmasi migrasi, verifikasi kesehatan, dan berhenti di kegagalan pertama semuanya tetap berlaku. Yang ditambahkan `ship` hanya dua langkah di depannya.

Bila tidak ada perubahan untuk di-commit, `ship` melewati keduanya dan langsung men-deploy. Jadi ia aman dipakai sebagai kebiasaan, termasuk saat mengulang deploy yang gagal.

`ship` menyusun pesan commit dari daftar perubahannya sendiri, lalu **meminta konfirmasi**:

```
  Pesan commit yang diusulkan:

      Perubahan pada kode, test (7 berkas)
      ...

  Pakai pesan ini? (ya / ubah / batal)
```

Pesan itu menyebutkan **apa** yang berubah, tidak pernah mengarang **kenapa** — alasannya hanya diketahui yang mengubahnya. Jawab `ubah` untuk menuliskannya sendiri, atau `batal` untuk berhenti tanpa menyentuh apa pun. Untuk pesan panjang berparagraf, commit manual dulu lalu jalankan `npm run deploy`.

`ship` berhenti bila hook pre-commit menolak, dan berhenti bila push gagal — dalam kedua keadaan itu server belum tersentuh sama sekali.

### Setiap deploy — satu perintah, dari mana saja

```bash
npm run deploy
```

Perintahnya sama persis dari kedua tempat. Skrip menentukan sendiri di mana ia
berjalan, dan yang berubah hanya **pengangkutnya**:

| Dijalankan dari | Yang terjadi |
|---|---|
| Laptop | Seluruh langkah dikirim ke server lewat SSH |
| Server | Seluruh langkah dijalankan setempat, tanpa SSH sama sekali |

Deteksinya satu sinyal yang sulit keliru: apakah salah satu alamat IP mesin ini
sama dengan alamat server tujuan. Mesin tidak dapat memiliki alamat itu tanpa
menjadi mesin itu. Nama host, nama pengguna, dan adanya direktori aplikasi
sengaja **tidak** dipakai — ketiganya wajar dimiliki laptop yang meniru tata
letak server.

Bila hasilnya ambigu — nama tujuan tidak dapat diurai, atau mesin ini terlihat
seperti server tetapi alamatnya berbeda karena NAT — skrip **berhenti dan
mengatakannya**, alih-alih memilih salah satu:

```bash
DEPLOY_MODE=lokal      npm run deploy   # paksa: dijalankan DI server
DEPLOY_MODE=jarak-jauh npm run deploy   # paksa: dijalankan lewat SSH
```

Urutan langkahnya satu rangkaian, bukan dua. **Berhenti di kegagalan pertama**,
menampilkan pesan galat utuh:

| Langkah | Yang terjadi |
|---|---|
| 0 | Memeriksa kode lokal — hanya dari laptop; di server, repo itu sendiri yang akan ditimpa origin |
| 0b | Gerbang prasyarat server, seluruhnya sekaligus |
| 1 | `git fetch` + `reset --hard origin/main` |
| 2 | `npm ci --include=dev` |
| 3 | Build antarmuka **ke samping**, lalu ditukar — proses lama tidak pernah menyajikan direktori yang sedang dikosongkan |
| 3b | Mengarsipkan hasil build ke `/home/paadu/rilis/<sha>/` |
| 4 | Menampilkan migrasi tertunda dan **menunggu Anda mengetik `ya`** |
| 4b | **Cadangan `pg_dump`** — hanya bila ada migrasi, tepat sebelum ia berjalan |
| 4c | Menjalankan migrasi |
| 5 | `pm2 reload` — instance diganti satu per satu |
| 6 | Memanggil `/readyz` sampai menjawab 200 |

Bila langkah 6 gagal, ia menampilkan **30 baris terakhir log PM2** — tidak perlu
SSH manual untuk tahu sebabnya.

Migrasi tidak pernah berjalan diam-diam. Bila tidak ada yang tertunda, langkah 4
dilewati tanpa bertanya. Membatalkan di titik itu **tidak** menyegarkan proses,
sehingga kode lama tetap melayani.

Dijalankan **di server**, ada satu perilaku tambahan: bila langkah 1 ikut
memperbarui skrip deploy itu sendiri, prosesnya berhenti dan meminta Anda
menjalankannya ulang. Node sudah memuat skrip lama ke memori, dan melanjutkan
berarti menjalankan urutan langkah lama atas kode baru tanpa satu pun tanda di
layar.

Alamat, direktori, dan nama proses dapat diganti tanpa menyunting skrip:

```bash
DEPLOY_SSH=paadu@72.61.124.95 DEPLOY_DIR=/home/paadu/app DEPLOY_PM2=paadu-api npm run deploy
```

### Kembali ke rilis sebelumnya

```bash
npm run rollback                # kembali satu rilis
npm run rollback -- --daftar    # lihat rilis yang tersimpan
npm run rollback -- <sha>       # ke rilis tertentu
```

Berjalan dari laptop maupun dari server, dengan deteksi yang sama.

> **Rollback mengembalikan KODE. Ia tidak menggulung balik satu pun migrasi.**
>
> Itu bukan keterbatasan yang belum sempat diselesaikan. Membuang kolom berarti
> membuang data yang ditulis sejak migrasi itu berjalan — faktur yang diposting
> sepuluh menit lalu, nomor seri pajak yang sudah terpakai. Perintah yang
> melakukannya diam-diam sebagai bagian dari "kembalikan seperti semula" akan
> menghapus data seseorang tepat pada saat semua orang sedang panik.
>
> Membatalkan migrasi adalah keputusan tersendiri yang diambil orang.

Sebelum bertanya, rollback **menyebutkan migrasi mana saja** yang berjalan sejak
rilis tujuan di-deploy — dibaca dari `paadu_migrations`, bukan dari berkas di
repo. Bila tidak ada, ia mengatakannya juga.

Aturan migrasi aditif (D-161) yang membuat rollback aman dalam keadaan biasa:
kolom baru diabaikan kode lama, dan tidak ada kolom yang hilang. Bila salah satu
migrasi memakai pintu darurat `paadu:allow-breaking`, periksa alasannya dulu.

Hasil build setiap deploy diarsipkan, jadi rollback hanya menukar direktori dan
menyegarkan proses — tidak membangun ulang commit lama, yang menuntut toolchain
cocok dan dapat gagal justru saat semuanya sedang salah. **Lima rilis** disimpan;
yang membatasi bukan disk (satu rilis 1,1 MB) melainkan skema — menyimpan dua
puluh akan menyiratkan mundur dua puluh langkah itu mungkin, dan itu tidak benar.

Setelah rollback, HEAD di server terlepas dari branch. Itu disengaja: `main`
tetap menunjuk rilis baru, sehingga deploy berikutnya menariknya kembali ke depan
dan perbaikan yang sudah di-push tidak tampak sudah terpasang padahal belum.

#### Prasyarat deploy pertama

`npm run deploy` memeriksa seluruhnya **di detik pertama**, dalam satu sambungan SSH, dan berhenti sebelum menyentuh apa pun bila ada yang kurang — lengkap dengan perintah perbaikannya. Daftar ini hanya agar Anda dapat menyiapkannya lebih dulu.

| Prasyarat | Cara memenuhinya |
|---|---|
| Kunci SSH terpasang | `ssh paadu@<host>` berhasil tanpa kata sandi |
| Repo ter-clone | `git clone <repo> /home/paadu/app` |
| `.env` runtime | `cp .env.example .env` lalu isi `DATABASE_URL`, `PORT`, `TOKEN_SIGNING_SECRET`, `MFA_ENCRYPTION_KEY` |
| `.env.deploy` migrasi | Di **luar** direktori aplikasi — lihat di bawah |
| `pm2` terpasang | `npm install -g pm2` lalu `pm2 startup` |
| `curl` terpasang | Dipakai verifikasi kesehatan |
| Proses PM2 bernama `paadu-api` | `PAADU_DIR=/home/paadu/app pm2 start ecosystem.config.cjs && pm2 save` |

Proses PM2-nya harus sudah ada sebelum deploy pertama, karena `npm run deploy` **me-restart**, bukan membuat. Sekali saja:

```bash
cd /home/paadu/app
npm ci --include=dev && npm run build
PAADU_DIR=/home/paadu/app pm2 start ecosystem.config.cjs
pm2 save
```

`ecosystem.config.cjs` tidak menghardcode path. Ia membaca `PAADU_DIR` (bawaan `/home/paadu/app`), `PAADU_LOG_DIR` (bawaan `<PAADU_DIR>/log`), dan `PAADU_PM2_NAME` (bawaan `paadu-api`). Menyunting berkas itu di server akan bertabrakan pada `git pull` berikutnya — pasang variabelnya, jangan sunting berkasnya.

#### Yang harus ada di server sekali saja

`npm run deploy` tidak menyimpan kredensial apa pun. SSH memakai kunci yang sudah terpasang, dan kredensial migrasi tinggal di server:

```bash
# /home/paadu/.env.deploy — DI LUAR direktori aplikasi
MIGRATION_DATABASE_URL=postgresql://paadu_owner:...@localhost:5432/paadu
```

Letaknya di luar `app/` dengan sengaja: berkas `.env` di dalam direktori aplikasi dimuat proses runtime, dan kredensial pemilik basis data tidak boleh berada di lingkungan proses yang melayani permintaan (D-141).

#### Bila ingin menjalankannya manual

```bash
cd /home/paadu/app
git pull && npm ci --include=dev && npm run build:web
set -a && . /home/paadu/.env.deploy && set +a && npm run migrate
pm2 restart paadu-api && curl -i localhost:3000/healthz
```

Urutannya disengaja: **migrasi sebelum build dan restart.** Skema yang tertinggal di belakang kode adalah kegagalan saat permintaan pertama masuk; kode yang tertinggal di belakang skema biasanya masih berjalan.

`MIGRATION_DATABASE_URL` diberikan **di baris perintah itu saja**, tidak di `.env`. Bila lupa, `npm run migrate` jatuh ke `DATABASE_URL`, mendeteksi bahwa perannya bukan pemilik basis data, lalu berhenti dengan pesan yang menyebutkan sebabnya — sebelum menyentuh apa pun.

### Bila `npm start` menolak menyala

Ia gagal cepat dan menyebutkan apa yang kurang:

| Pesan | Artinya |
|---|---|
| `n variabel lingkungan belum dipasang` | `.env` belum lengkap, atau tidak terbaca dari `cwd` PM2 |
| `dist/web tidak memuat index.html` | `npm run build` belum dijalankan setelah `git pull` |

Variabel yang sudah ada di lingkungan **tidak** ditimpa `.env` — itu disengaja, supaya nilai dari PM2 atau manajer rahasia menang atas berkas yang tertinggal dari penyiapan pertama.

### Kredensial migrasi terpisah dari kredensial runtime

Di produksi, keduanya **bukan peran yang sama**:

| Variabel | Peran | Boleh apa |
|---|---|---|
| `DATABASE_URL` | `paadu_app` | Dibaca proses runtime. Tunduk RLS, bukan pemilik objek, tidak dapat mengubah skema. |
| `MIGRATION_DATABASE_URL` | `paadu_owner` | Hanya dibaca `npm run migrate`. Pemilik objek. |

`npm run migrate` membaca `MIGRATION_DATABASE_URL` lebih dulu dan jatuh ke `DATABASE_URL` bila kosong — cukup untuk lokal, karena pemilik basis data lokal memang superuser. Di produksi ia dicetak sebagai peringatan.

**Jangan letakkan `MIGRATION_DATABASE_URL` di `.env` yang dimuat proses runtime.** Berikan hanya saat perintahnya dijalankan:

```bash
MIGRATION_DATABASE_URL=postgresql://paadu_owner:...@host:5432/paadu npm run migrate
```

Peran migrasi sengaja **bukan superuser dan tanpa `BYPASSRLS`**. Superuser melewati Row Level Security sepenuhnya, sehingga kebijakan yang salah tidak terlihat sampai deploy — persis yang terjadi pada D-141. `tests/invariants/migrasi-non-superuser.test.ts` menjalankan seluruh migrasi sebagai peran seperti itu, dari basis data kosong, supaya kelas bug tersebut gagal di lokal lebih dulu.

### Perintah lain

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Basis data + API + web, satu proses |
| `npm run seed:dev` | Mengisi ulang data contoh (butuh `DATABASE_URL`) |
| `npm run seed:tax-dev` | Data pajak untuk satu company (butuh `DATABASE_URL`, dan `COMPANY_ID` bila company lebih dari satu) |
| `npm run migrate` | Migrasi saja |
| `npm test` | Seluruh test: unit, basis data, dan UI |
| `npm run lint` | Token, batas arsitektur, dan tabel append-only |
| `npm run typecheck` | TypeScript, tanpa emit |

---

## Mulai dari mana

| Anda | Mulai dari |
|---|---|
| Menyiapkan repo pertama kali | `SETUP.md` |
| Akan menulis kode | `docs/Build_Playbook_Claude_Code.md` |
| Engineer yang baru bergabung | `docs/Design_Handoff_Spec.md` |
| Desainer atau vendor | `docs/Brand_Book.md` |
| Product | `docs/Information_Architecture.md` dan `docs/Flow_Archetypes.md` |
| Mencari nilai apa pun | `docs/tokens.json` — sumber kebenaran tunggal |

Indeks seluruh dokumen: **`docs/README.md`**
Keputusan arsitektur yang sudah dikunci: **`docs/DECISIONS.md`**

---

## Struktur

```
CLAUDE.md              Aturan yang selalu berlaku, dibaca setiap sesi Claude Code
SETUP.md               Perintah Fase 0, jalankan sekali
LICENSE                Proprietary — belum dirilis
.env.example           Salin menjadi .env; tiga variabel yang benar-benar dipakai
.nvmrc                 Versi Node yang dipakai proyek dan CI
docs/                  48 dokumen desain dan arsitektur, plus tokens.json
src/
  shared/              Kernel bersama — Money, UUIDv7, manifest modul
  domain/              Entitas dan aturan bisnis, tanpa framework
  application/         Use case, port, dan orkestrasi
  infrastructure/      Basis data, transaksi, adapter luar
  interface/
    http/              Endpoint Fastify, kontrak kesalahan, idempotency
    web/               React — app shell dan component library
  db/                  Kontrak tingkat basis data lintas modul
  composition/         Satu-satunya yang mengenal seluruh modul
  styles/              Dibangkitkan Style Dictionary — jangan diedit tangan
migrations/            SQL bernomor, hanya menambah
tests/
  unit/                Murni, tanpa basis data
  integration/         Alur lintas lapisan di atas Postgres sungguhan
  invariants/          Yang paling penting — lihat Sesi D4 di build playbook
  ui/                  Perilaku keyboard dan audit aksesibilitas
tools/                 Style Dictionary, aturan lint, runner dan pemeriksa migrasi
.github/workflows/     CI — tujuh gerbang pada setiap push
```

Struktur `src/` mengikuti Clean Architecture. Arah ketergantungan dan batas antar modul **ditegakkan lint**, bukan konvensi — lihat `docs/DECISIONS.md` D-040 dan D-045.

---

## Cakupan

**19 modul** dirancang lengkap, masing-masing dengan business problem, skema, API, alur, matriks izin, aturan validasi, strategi pengujian, dan pengembangan lanjutan.

| Fase | Modul |
|---|---|
| 1 · Fondasi | Multi-tenant & Organization · Identity & Access Management · Notification, Audit & File Storage |
| 2 · Inti bisnis | Sales · Inventory · Purchasing · Accounting · Tax · POS |
| 3 · Operasional | HRIS & Payroll · Project & Timesheet · Fixed Assets · Manufacturing · Workflow Automation |
| 4 · Pertumbuhan | AI Assistant · Business Intelligence · Public API & Integration · Marketplace & SDK |
| 5 · Enterprise | AI Agents & Predictive Analytics · Resilience & Multi Region · Industry Solutions |

Ditambah dokumentasi desain penuh: brand, design token, component specs, information architecture, flow archetypes, spesifikasi layar, prototype berjalan, dan handoff spec.

---

## Tujuh Pola yang Berulang

Memahami ketujuhnya berarti memahami sebagian besar sistem. Rinciannya di `docs/README.md`.

1. **Bekukan di titik komitmen** — kurs saat submit, snapshot slip gaji, jadwal penyusutan, BOM saat rilis. Angka masa lalu tidak berubah karena keputusan hari ini.
2. **Buku besar, bukan angka** — mutasi stok, jurnal, audit log, saldo cuti. Saldo dihitung, bukan disimpan sebagai kolom yang diubah.
3. **Matriks konfigurasi dengan spesifisitas, plus penguji** — penentuan akun, penentuan pajak, tarif tagih.
4. **Pemisahan tugas** — pengaju bukan penyetuju, penghitung bukan pemposting, QC bukan produksi.
5. **Akun penampung untuk selisih waktu** — barang diterima belum ditagih, barang dalam proses.
6. **Batas kewenangan mesin** — AI, otomasi, dan agen tidak pernah memposting, menyetujui, membayar, atau menghapus.
7. **Invarian yang diuji sebagai properti** — pelanggarannya adalah insiden, meski belum ada yang mengeluh.

---

## Yang Masih Terbuka

Daftar lengkap di `docs/DECISIONS.md` bagian akhir.

**Menunggu keputusan profesional di luar tim** — urutan perhitungan pajak dan alokasi diskon (konsultan pajak) · tarif PPh, PPN, dan jaminan sosial (konsultan pajak dan ahli ketenagakerjaan) · kelompok penyusutan fiskal · metode pengakuan pendapatan proyek (akuntan) · retensi dokumen (penasihat hukum) · sasaran ketersediaan per tier (keputusan komersial).

**Aset brand** — nilai hex asli (seluruh sistem memakai perkiraan `#3A34B5`) · nama typeface wordmark · berkas SVG mark sumber.

**Perlu diuji** — keselamatan konteks company pada pengguna nyata · screen reader · pembedaan ikon rail · palet data-viz dengan simulator buta warna.

---

## Lisensi & Kerahasiaan

Proprietary dan belum dirilis — lihat `LICENSE`. Tidak ada izin memakai, menyalin, memodifikasi, atau mendistribusikan isi repositori ini tanpa izin tertulis.

Bila repo ini publik dan itu tidak disengaja, ubah visibilitasnya — `docs/` memuat positioning, roadmap, dan arsitektur lengkap sembilan belas modul.
 
