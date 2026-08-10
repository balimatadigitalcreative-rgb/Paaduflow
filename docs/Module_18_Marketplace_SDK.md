# Module Design: Marketplace & SDK
*Phase 4 — Growth. Modul terakhir Fase 4, dibangun di atas Public API.*

**Cakupan:** Model Aplikasi · Batas Isolasi · Pemasangan & Persetujuan · Antarmuka Tertanam · Ekstensi Data · Tinjauan & Publikasi · Versi Aplikasi · SDK & Alat Pengembang · Sandbox · Penagihan Aplikasi.
**Dependency:** Modul 01, 02 (IAM), 03 (Audit), 14 (Otomasi), 15 (Semantik), 17 (Public API).

---

## 1. Business Problem

Success Metrics di Knowledge Base menyatakan integrasi pihak ketiga harus dapat dilakukan **tanpa mengubah kode inti**. Marketplace adalah bentuk konkret dari janji itu — dan juga cara paling cepat merusak produk bila dirancang salah.

Tiga kegagalan model muncul pada platform yang membuka diri terlalu longgar. **Kode pihak ketiga dijalankan di infrastruktur sendiri**, yang di lingkungan multi-tenant berarti satu aplikasi bermasalah dapat menyentuh data tenant lain — dan tidak ada cara meyakinkan pelanggan bahwa itu tidak akan terjadi. **Aplikasi meminta akses menyeluruh** karena lebih mudah dibangun begitu, dan pengguna menyetujuinya karena tidak diberi pilihan lain. **Aplikasi terlihat asing di dalam produk**, sehingga pengguna tidak tahu mana bagian produk dan mana bagian pihak ketiga — dan menyalahkan produk saat aplikasi gagal.

---

## 2. Goals

- **Tidak ada kode pihak ketiga yang berjalan di infrastruktur kami.** Ini batas yang membuat platform multi-tenant tetap dapat dipertanggungjawabkan.
- Aplikasi meminta cakupan izin spesifik, bukan akses menyeluruh, dan pengguna melihat persis apa yang diminta.
- Aplikasi tertanam memakai design token yang sama, sehingga produk tidak terasa tambal sulam.
- Pembaruan aplikasi yang meminta izin baru **memerlukan persetujuan ulang**, tidak pernah otomatis.
- Aplikasi bermasalah dapat dihentikan di seluruh tenant dalam hitungan menit.
- Pengembang dapat membangun, menguji, dan merilis tanpa menyentuh data produksi.

---

## 3. User Stories

- Sebagai pemilik bisnis, saya ingin memasang aplikasi pengiriman tanpa meminta bantuan pengembang.
- Sebagai pemilik bisnis, saya ingin melihat persis data apa yang akan diakses aplikasi sebelum memasangnya.
- Sebagai admin, saya ingin mencabut satu aplikasi tanpa mengganggu yang lain.
- Sebagai admin, saya ingin tahu apa yang dilakukan aplikasi minggu lalu.
- Sebagai pengembang mitra, saya ingin membangun aplikasi tanpa mempelajari seluruh produk.
- Sebagai pengembang mitra, saya ingin antarmuka aplikasi saya terlihat menyatu, bukan seperti tempelan.
- Sebagai pengembang mitra, saya ingin menguji di lingkungan yang menyerupai produksi.
- Sebagai Security Engineer, saya ingin yakin aplikasi tidak dapat menyentuh data tenant lain.

---

## 4. Model Aplikasi

Tiga jenis, dan seluruhnya berjalan di luar infrastruktur kami.

| Jenis | Bentuk | Contoh |
|---|---|---|
| **Integrasi** | Server ke server lewat API publik dan webhook | Sinkronisasi marketplace, koneksi bank, ekspedisi |
| **Antarmuka tertanam** | Iframe di panel, tab, atau aksi, dengan jembatan pesan | Kalkulator ongkir di halaman faktur, dasbor mitra |
| **Ekstensi data** | Definisi deklaratif, bukan kode | Field kustom, templat laporan, definisi metrik, aturan otomasi |

**Ekstensi data adalah satu-satunya yang "berjalan" di dalam sistem kami** — dan ia bukan kode, melainkan definisi yang dievaluasi mesin yang sudah ada: aturan otomasi memakai Modul 14, metrik memakai Modul 15. Tidak ada penafsir baru yang perlu diamankan.

### Batas isolasi

**Backend: tidak ada eksekusi kode pihak ketiga.** Aplikasi berjalan di server pembuatnya dan berkomunikasi lewat API publik dan webhook, memakai service account dari Modul 17.

**Frontend: iframe dengan jembatan pesan terbatas.** Aplikasi tertanam tidak memiliki akses ke DOM induk, cookie, maupun token. Ia menerima konteks (company aktif, entitas yang dibuka, tema) lewat `postMessage`, dan meminta data lewat API dengan tokennya sendiri. Daftar pesan yang diizinkan bersifat tertutup.

Konsekuensinya penting dan patut dinyatakan terang: **aplikasi tidak dapat menyentuh data tenant lain karena ia tidak pernah berada di tempat data itu disimpan.**

---

## 5. Functional Requirements

**Katalog.** Daftar aplikasi dengan kategori, deskripsi, tangkapan layar, izin yang diminta, pengembang, harga, dan status tinjauan.

**Pemasangan.** Alur persetujuan yang menampilkan: izin yang diminta dalam bahasa manusia, company yang akan diakses, dan ke mana data akan dikirim. Persetujuan membuat service account dengan izin persis itu — tidak lebih.

**Pembaruan.** Versi baru yang **tidak** menambah izin dipasang otomatis. Versi yang menambah izin **menunggu persetujuan ulang**, dan versi lama tetap berjalan sampai disetujui.

**Pencabutan.** Satu tombol. Service account dicabut, langganan webhook dihentikan, antarmuka tertanam hilang. Data yang aplikasi buat **di dalam** Paadu Flow tetap ada — itu data tenant. Data di sisi aplikasi menjadi tanggung jawab pengembangnya, dan itu dinyatakan saat pemasangan.

**Tinjauan dan publikasi.** Pengajuan → pemeriksaan otomatis (manifes, cakupan izin, endpoint, kebijakan privasi) → tinjauan manusia → publikasi. Aplikasi internal tenant dapat dipasang tanpa publikasi.

**Saklar mati platform.** Menghentikan sebuah aplikasi di seluruh tenant, dengan notifikasi ke pemasangnya. Dipakai saat ditemukan masalah keamanan.

**Aktivitas aplikasi.** Log permintaan dan aksi per aplikasi per tenant, dapat dilihat pemasangnya — bukan hanya oleh kami.

**Penagihan.** Aplikasi gratis, berbayar sekali, atau berlangganan. Penagihan lewat platform, dengan bagi hasil. Pembatalan langganan mencabut aplikasi pada akhir periode.

---

## 6. SDK & Alat Pengembang

**Klien resmi** untuk beberapa bahasa, **dihasilkan dari OpenAPI** yang sendiri dihasilkan dari kode. Rantai ini memastikan klien tidak pernah menyimpang dari perilaku nyata.

**Kit antarmuka tertanam** — komponen yang memakai design token yang sama dengan produk: tombol, input, tabel, kartu, dan status. Pengembang tidak perlu menebak gaya, dan pengguna tidak melihat tambal sulam. Tema mengikuti tema pengguna, termasuk mode gelap dan kepadatan.

**CLI** — membuat kerangka aplikasi, menjalankan lingkungan lokal, memvalidasi manifes, dan merilis versi.

**Manifes aplikasi** — berkas deklaratif berisi identitas, izin yang diminta beserta alasannya, titik penanaman antarmuka, langganan webhook, dan ekstensi data. **Izin yang tidak tercantum di manifes tidak dapat diminta saat berjalan.**

**Sandbox** — tenant contoh berisi data yang menyerupai produksi, dapat diatur ulang kapan saja. Kunci sandbox tidak berlaku di produksi.

**Dokumentasi** — panduan, referensi yang dihasilkan otomatis, dan contoh aplikasi yang berjalan.

---

## 7. Non Functional Requirements

- Antarmuka tertanam dibatasi Content Security Policy ketat; iframe tidak memiliki akses ke induknya.
- Kegagalan aplikasi tertanam **tidak pernah merusak halaman induk**. Panel yang gagal menampilkan pesan, bukan layar kosong.
- Aplikasi yang lambat tidak menahan pemuatan halaman; antarmuka tertanam dimuat asinkron.
- Pencabutan berlaku di bawah 10 detik, mewarisi jaminan Modul 17.
- Saklar mati platform berlaku ke seluruh tenant di bawah 5 menit.
- Manifes divalidasi sebelum publikasi; izin di luar katalog ditolak.
- Aplikasi tidak dapat meminta izin yang bertanda tidak dapat diberikan ke integrasi.

---

## 8. Database Design

**Table: `marketplace_apps`** — `slug`, `name`, `developer_id`, `category`, `description`, `privacy_policy_url`, `support_url`, `pricing_model`, `status` (draft, in_review, published, suspended, delisted), `suspended_reason`

**Table: `app_versions`** — `app_id`, `version`, `manifest` jsonb, `changelog`, `status` (draft, in_review, approved, rejected, published), `reviewed_by`, `published_at`

`manifest` menyimpan seluruh deklarasi versi itu. Perubahan izin terdeteksi dengan membandingkan manifes antar versi — bukan dengan mempercayai pengembang menyatakannya.

**Table: `app_installations`** — `tenant_id`, `app_id`, `app_version_id`, `company_ids` jsonb, `service_account_id`, `installed_by`, `installed_at`, `status` (active, pending_consent, suspended, uninstalled), `uninstalled_at`

**Table: `app_consents`** — `installation_id`, `app_version_id`, `granted_permissions` jsonb, `granted_by`, `granted_at`, `ip`

Setiap persetujuan disimpan sebagai catatan tersendiri, sehingga pertanyaan "siapa menyetujui akses ini dan kapan" dapat dijawab bertahun-tahun kemudian.

**Table: `app_ui_extensions`** — `app_version_id`, `slot` (invoice_detail_panel, customer_tab, list_action, dashboard_widget), `title`, `icon`, `url`, `required_permissions` jsonb

**Table: `app_data_extensions`** — `app_version_id`, `type` (custom_field, report_template, metric, automation), `definition` jsonb

**Table: `app_reviews`** — `app_version_id`, `reviewer_id`, `checklist` jsonb, `result`, `notes`

**Table: `app_usage`** — `installation_id`, `period`, `api_calls`, `webhook_deliveries`, `ui_loads`, `errors`

**Table: `app_subscriptions`** — `installation_id`, `plan`, `price`, `currency`, `billing_period`, `status`, `next_billing_at`, `revenue_share_pct`

---

## 9. API Design

```
GET    /v1/marketplace/apps?category=&q=
GET    /v1/marketplace/apps/{slug}
POST   /v1/tenants/{id}/installations           -> memulai alur persetujuan
POST   /v1/installations/{id}/consent           -> membuat service account
POST   /v1/installations/{id}/reconsent         -> untuk versi yang menambah izin
DELETE /v1/installations/{id}                   -> mencabut
GET    /v1/installations/{id}/activity

POST   /v1/developer/apps
POST   /v1/developer/apps/{id}/versions         -> unggah manifes
POST   /v1/developer/versions/{id}/submit
GET    /v1/developer/versions/{id}/review-status
POST   /v1/developer/sandbox/reset

POST   /v1/platform/apps/{id}/suspend           -> saklar mati, seluruh tenant
GET    /v1/platform/apps/{id}/installations
```

### Kontrak yang mengikat

**Persetujuan menghasilkan service account dengan izin persis dari manifes.** Tidak ada jalur yang memberi izin melebihi yang disetujui, dan izin tidak dapat ditambah saat berjalan.

**Perbedaan izin antar versi dihitung sistem dari manifes**, bukan dinyatakan pengembang. Versi yang menambah izin tidak dapat dipasang otomatis, apa pun yang tertulis di changelog.

**Antarmuka tertanam menerima konteks lewat daftar pesan tertutup.** Pesan di luar daftar diabaikan tanpa balasan. Iframe tidak pernah menerima token pengguna.

**Aplikasi tidak dapat memanggil endpoint platform.** Endpoint di bawah `/v1/platform/` dan `/v1/developer/` ditolak bagi service account aplikasi.

---

## 10. UI Flow

**Katalog** — kartu aplikasi dengan kategori dan pencarian. Halaman detail menampilkan **izin yang diminta di atas lipatan**, bukan disembunyikan di bawah deskripsi pemasaran.

**Layar persetujuan** — daftar izin dalam bahasa manusia ("Membaca faktur dan pelanggan", bukan `sales.invoice.read:company`), company yang dipilih, dan pernyataan ke mana data dikirim. Tombol pasang tidak aktif sampai seluruhnya terlihat.

**Aplikasi terpasang** — daftar dengan status, pemakaian, kesalahan terakhir, dan tombol cabut. Aplikasi yang menunggu persetujuan ulang ditandai jelas dengan **apa yang berubah**.

**Aktivitas aplikasi** — log yang dapat dibaca pemasang, bukan hanya kami.

**Antarmuka tertanam** — dimuat di panel atau tab dengan penanda halus bahwa ini disediakan pihak ketiga, plus tautan ke dukungannya. Pengguna harus dapat membedakan tanpa harus menebak.

**Portal pengembang** — aplikasi, versi, status tinjauan, sandbox, dan statistik pemasangan.

---

## 11. Permission Matrix

| Aksi | Tenant Owner | Tenant Admin | Company Admin | Pengguna |
|---|---|---|---|---|
| Menjelajah katalog | ✅ | ✅ | ✅ | ✅ |
| **Memasang aplikasi** | ✅ | ✅ | ❌ | ❌ |
| Menyetujui izin | ✅ | ✅ | ❌ | ❌ |
| **Menyetujui izin sensitif** | ✅ | ⚠️ | ❌ | ❌ |
| Mencabut aplikasi | ✅ | ✅ | ❌ | ❌ |
| Melihat aktivitas aplikasi | ✅ | ✅ | ✅ (company sendiri) | ❌ |
| Memakai antarmuka tertanam | mengikuti izin pengguna itu sendiri | | | |
| Mengelola langganan berbayar | ✅ | ✅ | ❌ | ❌ |

⚠️ memerlukan persetujuan kedua dari Tenant Owner.

**Pemasangan hanya di tingkat tenant**, karena aplikasi membawa risiko yang melampaui satu company.

**Antarmuka tertanam tetap tunduk pada izin pengguna.** Aplikasi yang berhak membaca faktur tidak membuat penggunanya berhak melihat faktur yang tidak boleh ia lihat — data tetap diambil dengan izin pengguna.

---

## 12. Validation Rules

- Manifes wajib mencantumkan alasan untuk setiap izin; alasan kosong ditolak saat tinjauan.
- Izin di luar katalog, atau yang bertanda tidak dapat diberikan ke integrasi, ditolak saat validasi manifes.
- Aplikasi tidak dapat meminta izin di tingkat tenant untuk operasi yang bercakupan company.
- Versi yang menambah izin tidak dapat menggantikan versi terpasang tanpa persetujuan ulang.
- URL antarmuka tertanam wajib HTTPS dengan sertifikat sah.
- Aplikasi yang tingkat kesalahannya melewati ambang ditangguhkan otomatis dengan notifikasi ke pengembang dan pemasang.
- Aplikasi tidak dapat dihapus dari katalog bila masih terpasang; ia di-*delist* sehingga tidak dapat dipasang baru tetapi yang terpasang tetap berjalan sampai dicabut.
- Kebijakan privasi wajib ada dan dapat diakses sebelum publikasi.

---

## 13. Testing Strategy

**Isolasi — yang terpenting di modul ini.** Aplikasi tidak dapat mengakses tenant lain lewat jalur mana pun · iframe tidak dapat membaca DOM, cookie, atau token induk · pesan di luar daftar diabaikan · aplikasi tidak dapat memanggil endpoint platform maupun developer.

**Persetujuan.** Service account yang dihasilkan memiliki izin persis dari manifes, tidak lebih · versi dengan izin tambahan tidak terpasang otomatis · perbedaan izin dihitung benar untuk seluruh bentuk perubahan manifes.

**Pencabutan.** Pencabutan menghentikan API, webhook, dan antarmuka di bawah 10 detik · saklar mati platform berlaku ke seluruh tenant di bawah 5 menit · data tenant yang dibuat aplikasi tetap ada setelah pencabutan.

**Ketahanan.** Aplikasi tertanam yang gagal, lambat, atau mengembalikan kesalahan tidak merusak halaman induk · aplikasi yang tidak merespons tidak menahan pemuatan.

**E2E.** Pengembang membuat aplikasi di sandbox sampai dipublikasikan · tenant memasang, memakai, memperbarui dengan izin tambahan, lalu mencabut · saklar mati saat aplikasi sedang dipakai banyak tenant.

---

## 14. Future Enhancements

- **Sertifikasi mitra** dengan penanda di katalog dan tinjauan keamanan berkala.
- **Aplikasi privat antar tenant** untuk konsultan yang melayani banyak klien.
- **Bagi hasil dan penagihan lanjutan** dengan model berbasis pemakaian.
- **Aplikasi templat industri** yang memasang beberapa ekstensi sekaligus sebagai satu paket.
- **Peninjauan izin berkala** — sistem meminta tenant meninjau ulang aplikasi terpasang setiap kuartal.
- **Kotak pasir untuk antarmuka tertanam** yang lebih ketat lagi, dengan pembatasan jaringan dari sisi iframe.
- **Marketplace ekstensi data** tanpa server — templat laporan dan otomasi yang tidak memerlukan infrastruktur pengembang sama sekali.
- **Peringkat dan ulasan** dari pemasang terverifikasi.
