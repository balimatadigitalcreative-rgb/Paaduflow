# Module Design: Public API & Integration
*Phase 4 — Growth. Fondasi bagi Marketplace dan SDK.*

**Cakupan:** Service Account · Autentikasi Mesin · Kontrak API Publik · Versi & Deprecation · Rate Limiting · Webhook Keluar · Sandbox · Katalog Integrasi · Observabilitas.
**Dependency:** Modul 01, 02 (IAM), 03 (Notification, Audit), 14 (Otomasi).

---

## 1. Revisi Keputusan Modul 02

Modul 02 menetapkan bahwa izin bertanda `delegatable_to_machine = false` — posting, persetujuan, void, pembayaran, penghapusan — **tidak pernah** dapat diberikan ke pelaku mesin. Aturan itu benar untuk AI dan Otomasi, dan **terlalu kasar** untuk integrasi.

Toko daring yang membuat dan memposting faktur adalah kebutuhan nyata. Melarangnya total tidak menghasilkan sistem yang lebih aman — ia memaksa orang menempelkan kredensial manusia ke skrip, yang jauh lebih berbahaya: identitasnya tercampur dengan orang sungguhan, jejaknya menyesatkan, dan pencabutannya berarti mengunci orang itu dari pekerjaannya.

**Revisi:** ada dua kelas pelaku mesin.

| | **Agen dalam produk** | **Integrasi terkonfigurasi** |
|---|---|---|
| Contoh | AI Assistant, Otomasi Alur Kerja | Service account untuk toko daring, bank, marketplace |
| Identitas | Bertindak atas nama pengguna | Identitas bernama tersendiri |
| Kewenangan | Disimpulkan dari izin pengguna | Diberikan eksplisit, satu izin per satu |
| Dibuat oleh | Siapa saja yang berizin membuat aturan | Hanya tingkat tenant, dengan alasan tercatat |
| Izin sensitif | **Tidak pernah** | Dapat diberikan, dengan persetujuan tersendiri |

Yang membedakan bukan apakah ia mesin, melainkan **apakah kewenangannya diberikan secara sadar, bernama, dan dapat dicabut.**

Katalog izin karena itu memerlukan dua penanda, bukan satu: `delegatable_to_agent` dan `grantable_to_integration`. Perubahan ini masuk ke skema Modul 02.

---

## 2. Business Problem

Knowledge Base menyatakan API-first sebagai prinsip. Tanpa modul ini, prinsip itu berhenti sebagai niat.

Tiga masalah muncul saat API publik dibangun belakangan. **API publik menjadi lapisan terpisah** yang perilakunya menyimpang dari produk — bug yang tidak ada di aplikasi tetapi ada di API, dan sebaliknya. **Tidak ada kontrak versi**, sehingga setiap perbaikan internal merusak integrasi pelanggan tanpa peringatan. **Integrasi memakai akun manusia**, sehingga tidak ada yang tahu perubahan mana dilakukan orang dan mana dilakukan skrip.

---

## 3. Goals

- API publik adalah **himpunan bagian terkurasi** dari API yang dipakai produk, bukan implementasi terpisah.
- Kontrak versi yang dapat diandalkan, dengan kebijakan deprecation yang tertulis dan ditepati.
- Setiap integrasi punya **identitas bernama** yang dapat dicabut tanpa mengganggu siapa pun.
- Seluruh aksi integrasi tercatat dengan pelaku yang jelas.
- Webhook yang andal: bertanda tangan, dapat diulang, dan tidak pernah gagal diam-diam.
- Sandbox dengan data contoh, agar mitra dapat membangun tanpa menyentuh data produksi.

---

## 4. User Stories

- Sebagai pemilik toko daring, saya ingin pesanan dari toko saya otomatis menjadi faktur di sini.
- Sebagai admin, saya ingin mencabut akses satu integrasi tanpa mengganggu integrasi lain.
- Sebagai admin, saya ingin tahu persis apa yang dilakukan sebuah integrasi minggu lalu.
- Sebagai pengembang mitra, saya ingin membangun dan menguji tanpa data pelanggan sungguhan.
- Sebagai pengembang mitra, saya ingin diberi tahu jauh hari bila ada perubahan yang merusak.
- Sebagai sistem lain, saya ingin diberi tahu saat faktur diposting, tanpa menanyakannya terus-menerus.
- Sebagai admin, saya ingin melihat integrasi mana yang paling banyak memanggil dan mana yang paling sering gagal.
- Sebagai Security Engineer, saya ingin kunci yang bocor dapat dicabut dalam hitungan detik.

---

## 5. Functional Requirements

**Service account.** Identitas mesin bercakupan tenant, dengan daftar company yang dapat diaksesnya dan izin yang diberikan satu per satu. Dibuat hanya di tingkat tenant, dengan alasan yang tercatat.

**Kredensial.** Pasangan client ID dan secret dengan alur OAuth client credentials, menghasilkan access token berumur pendek. Kunci dapat dirotasi tanpa gangguan: dua kunci aktif bersamaan selama masa transisi.

**Kontrak API publik.** Himpunan endpoint yang ditandai publik, dengan jaminan stabilitas. Endpoint internal tidak muncul di dokumentasi publik dan ditolak bagi service account.

**Versi.** Versi di path (`/v1/`). Di dalam satu versi, perubahan **hanya bersifat menambah**: field baru boleh, field dihapus atau berubah arti tidak boleh. Versi baru berjalan berdampingan.

**Deprecation.** Pengumuman minimal enam bulan sebelum penghentian, header `Sunset` pada respons, notifikasi ke pemilik integrasi, dan laporan pemakaian endpoint yang akan dihentikan agar mitra tahu apakah ia terdampak.

**Rate limiting.** Per service account dan per kelas endpoint. Header `X-RateLimit-*` di setiap respons, dan `Retry-After` saat terlampaui.

**Idempotensi.** Wajib pada seluruh operasi tulis, dengan header `Idempotency-Key`. Percobaan ulang mengembalikan hasil yang sama.

**Pagination.** Berbasis kursor, bukan offset. Offset menghasilkan baris terlewat atau ganda saat ada penulisan bersamaan — dan integrasi selalu membaca saat orang lain menulis.

**Webhook.** Langganan per jenis peristiwa, bertanda tangan HMAC, dengan percobaan ulang berjeda meningkat, antrean gagal, dan endpoint pengulangan manual. Urutan **tidak dijamin**; setiap payload membawa `sequence` dan `occurred_at` agar penerima dapat mengurutkan sendiri.

**Sandbox.** Lingkungan terpisah dengan tenant contoh berisi data yang menyerupai produksi. Kunci sandbox tidak pernah berlaku di produksi.

**Katalog integrasi.** Daftar integrasi terpasang per tenant, dengan status, pemakaian, kesalahan terakhir, dan tombol cabut.

**Observabilitas.** Log permintaan per service account: endpoint, status, latensi, dan ID permintaan yang dapat dirujuk saat meminta dukungan.

---

## 6. Non Functional Requirements

- **API publik memakai layanan dan lapisan izin yang sama dengan antarmuka.** Tidak ada implementasi paralel yang dapat menyimpang.
- Kunci yang dicabut berhenti berlaku di bawah 10 detik.
- Rate limit dievaluasi tanpa menambah lebih dari 5ms per permintaan.
- Webhook terkirim dalam 30 detik pada kondisi normal; kegagalan diulang sampai 24 jam.
- Setiap permintaan membawa `X-Request-Id` yang muncul di log dan di audit trail.
- Kegagalan integrasi tidak pernah memengaruhi pengguna di antarmuka.
- Dokumentasi OpenAPI dihasilkan dari kode, bukan ditulis terpisah — dokumentasi yang ditulis tangan akan menyimpang dalam tiga bulan.

---

## 7. Database Design

**Table: `service_accounts`** — `tenant_id`, `name`, `description`, `purpose`, `company_ids` jsonb, `status` (active, suspended, revoked), `created_by`, `revoked_by`, `revoked_reason`, `last_used_at`, + audit baku.

**Table: `service_account_permissions`** — `service_account_id`, `permission_key`, `scope`, `granted_by`, `granted_at`, `requires_elevated_approval` (boolean), `approved_by`

Izin sensitif memerlukan persetujuan terpisah dari pemberian izin biasa, dan keduanya dicatat.

**Table: `api_credentials`** — `service_account_id`, `client_id`, `secret_hash`, `status`, `expires_at`, `rotated_from`, `last_used_at`, `last_used_ip`

**Table: `api_requests`** — `tenant_id`, `service_account_id`, `request_id`, `method`, `path`, `api_version`, `status_code`, `latency_ms`, `idempotency_key`, `created_at`

**Table: `webhook_subscriptions`** — `tenant_id`, `company_id`, `service_account_id`, `url`, `events` jsonb, `secret_hash`, `status`, `consecutive_failures`, `disabled_at`, `disabled_reason`

**Table: `webhook_deliveries`** — `subscription_id`, `event_id`, `sequence`, `payload` jsonb, `attempt`, `status`, `response_code`, `response_time_ms`, `next_retry_at`

**Table: `api_versions`** — `version`, `status` (current, deprecated, sunset), `released_at`, `deprecated_at`, `sunset_at`, `migration_guide_url`

**Table: `endpoint_usage`** — `api_version`, `endpoint`, `service_account_id`, `period`, `call_count`

Tabel terakhir yang memungkinkan pertanyaan penting saat deprecation: **siapa saja yang masih memakai endpoint ini, dan seberapa sering.**

---

## 8. API Design

```
POST   /oauth/token                             -> client credentials, token berumur pendek

GET    /v1/tenants/{id}/service-accounts
POST   /v1/tenants/{id}/service-accounts
POST   /v1/service-accounts/{id}/permissions    -> satu izin per panggilan, dengan alasan
POST   /v1/service-accounts/{id}/credentials/rotate
POST   /v1/service-accounts/{id}/revoke         -> berlaku di bawah 10 detik
GET    /v1/service-accounts/{id}/activity       -> log permintaan dan aksi

POST   /v1/tenants/{id}/webhooks
POST   /v1/webhooks/{id}/test
GET    /v1/webhooks/{id}/deliveries?status=
POST   /v1/webhook-deliveries/{id}/replay

GET    /v1/meta/versions                        -> status tiap versi dan tanggal sunset
GET    /v1/meta/openapi.json                    -> dihasilkan dari kode
GET    /v1/tenants/{id}/api-usage?period=
```

### Kontrak yang mengikat

**Endpoint publik tidak pernah menghapus atau mengubah arti field dalam satu versi.** Penambahan field bukan perubahan yang merusak; klien wajib mengabaikan field yang tidak dikenalnya, dan itu dinyatakan di dokumentasi.

**Seluruh operasi tulis menolak permintaan tanpa `Idempotency-Key`.** Bukan opsional — integrasi berjalan di jaringan yang tidak dapat diandalkan, dan percobaan ulang adalah kondisi normal.

**Pagination hanya berbasis kursor.** Parameter `offset` tidak disediakan sama sekali di API publik.

**Setiap respons kesalahan memakai model tiga sebab** dari Modul 02: `permission_denied`, `plan_restricted`, `state_restricted` — ditambah `rate_limited` dan `validation_failed`. Integrasi harus dapat membedakan "saya tidak berhak" dari "coba lagi nanti".

**Payload webhook tidak memuat data sensitif**, hanya identitas peristiwa dan entitasnya. Penerima memanggil API untuk mengambil detailnya, dengan izinnya sendiri. Ini mencegah kebocoran lewat endpoint yang salah konfigurasi.

---

## 9. UI Flow

**Katalog integrasi** — daftar service account dengan status, pemakaian 7 hari terakhir, kesalahan terakhir, dan tombol cabut yang terlihat.

**Pembuatan service account** — wizard: nama dan tujuan → pilih company → pilih izin satu per satu, dengan penanda jelas untuk izin sensitif dan alasan wajib → tampilkan kredensial **satu kali saja**.

**Aktivitas integrasi** — log permintaan dan aksi, dapat difilter, dengan `X-Request-Id` yang dapat disalin untuk dukungan.

**Webhook** — daftar langganan dengan tingkat keberhasilan, pengiriman terakhir, dan tombol uji serta ulangi. Kegagalan menampilkan payload dan respons, bukan hanya kode kesalahan.

**Rotasi kunci** — layar yang menjelaskan bahwa kunci lama tetap berlaku sampai tanggal tertentu, dengan hitungan mundur.

**Halaman versi API** — status tiap versi, tanggal sunset, dan **daftar endpoint yang dipakai tenant ini** yang akan terdampak.

---

## 10. Business Flow

Admin tenant membuat service account dengan tujuan tertulis → memilih company dan izin satu per satu → izin sensitif memerlukan persetujuan terpisah → kredensial ditampilkan sekali.

Integrasi memanggil `/oauth/token` → menerima access token berumur pendek → memanggil endpoint publik → setiap permintaan dicatat, setiap aksi masuk audit log dengan pelaku service account.

Saat peristiwa terjadi: webhook dikirim ke langganan yang cocok → gagal diulang berjeda meningkat → gagal berulang menonaktifkan langganan dengan notifikasi.

Saat versi didepresiasi: pengumuman dikirim ke pemilik seluruh integrasi yang masih memakainya, dengan daftar endpoint terdampak, disertai header `Sunset` pada setiap respons.

Saat kunci bocor: dicabut dari antarmuka, berlaku di bawah 10 detik, dan seluruh aktivitas kunci itu dapat ditinjau di satu tempat.

---

## 11. Permission Matrix

| Aksi | Tenant Owner | Tenant Admin | Company Admin | Pengguna |
|---|---|---|---|---|
| Lihat katalog integrasi | ✅ | ✅ | ✅ (company sendiri) | ❌ |
| **Buat service account** | ✅ | ✅ | ❌ | ❌ |
| Beri izin biasa | ✅ | ✅ | ❌ | ❌ |
| **Beri izin sensitif** | ✅ | ⚠️ | ❌ | ❌ |
| Rotasi kredensial | ✅ | ✅ | ❌ | ❌ |
| Cabut service account | ✅ | ✅ | ❌ | ❌ |
| Kelola webhook | ✅ | ✅ | ✅ (company sendiri) | ❌ |
| Lihat log aktivitas integrasi | ✅ | ✅ | ✅ (company sendiri) | ❌ |

⚠️ memerlukan persetujuan kedua dari Tenant Owner.

**Service account dibuat hanya di tingkat tenant.** Company Admin dapat melihat dan mengelola webhook company-nya, tetapi tidak dapat menciptakan identitas mesin baru — itu keputusan yang menyentuh seluruh tenant.

**Service account tidak dapat membuat service account lain**, tidak dapat mengubah izin, dan tidak dapat mengelola webhook. Tanpa batas ini, satu kunci yang bocor dapat memperbanyak dirinya.

---

## 12. Validation Rules

- Service account wajib punya tujuan tertulis; kolom kosong ditolak.
- Izin yang bertanda tidak dapat diberikan ke integrasi ditolak pada tingkat katalog.
- Izin sensitif memerlukan persetujuan kedua dan alasan.
- Kredensial ditampilkan sekali; tidak dapat dibaca ulang, hanya dirotasi.
- Kunci sandbox ditolak di produksi dan sebaliknya.
- Permintaan tulis tanpa `Idempotency-Key` ditolak.
- Webhook wajib HTTPS dengan sertifikat sah.
- Endpoint webhook yang gagal melebihi ambang dinonaktifkan otomatis dengan notifikasi.
- Endpoint internal ditolak bagi service account, meski izinnya tampak mencukupi.
- Versi yang sudah `sunset` mengembalikan `410` dengan tautan panduan migrasi, bukan `404`.

---

## 13. Testing Strategy

**Kontrak.** Uji kompatibilitas otomatis yang menggagalkan build bila field dihapus atau berubah arti dalam satu versi · dokumentasi OpenAPI cocok dengan perilaku nyata seluruh endpoint publik.

**Keamanan — yang terpenting di modul ini.** Service account tidak dapat mengakses company di luar cakupannya · tidak dapat memanggil endpoint internal · tidak dapat membuat atau mengubah service account · kunci yang dicabut berhenti berlaku di bawah 10 detik · kunci sandbox tidak berlaku di produksi · payload webhook tidak memuat data sensitif.

**Idempotensi.** Permintaan tulis yang sama dikirim tiga kali menghasilkan satu entitas · percobaan ulang setelah timeout mengembalikan hasil yang sama, bukan konflik.

**Pagination.** Membaca seluruh halaman sambil data ditulis bersamaan tidak melewatkan maupun menggandakan baris.

**Webhook.** Penerima yang lambat tidak memblokir pengiriman lain · kegagalan diulang sesuai jadwal · pengulangan manual menghasilkan payload identik · penerima menerima `sequence` yang memungkinkan pengurutan.

**E2E.** Integrasi dibuat sampai memposting faktur pertama, dengan seluruh jejak terlihat · rotasi kunci tanpa gangguan · pencabutan saat integrasi sedang berjalan · siklus deprecation penuh dari pengumuman sampai `410`.

---

## 14. Future Enhancements

- **OAuth atas nama pengguna** untuk aplikasi pihak ketiga yang bertindak untuk pengguna tertentu, bukan untuk tenant.
- **GraphQL** sebagai lapisan tambahan bagi integrasi yang membutuhkan pengambilan data fleksibel.
- **Webhook masuk** dengan verifikasi tanda tangan, sebagai pemicu bagi Modul 14.
- **Kuota berbasis paket** dengan penawaran peningkatan saat mendekati batas.
- **Portal pengembang** dengan kunci mandiri, dokumentasi interaktif, dan riwayat perubahan.
- **Streaming peristiwa** untuk integrasi bervolume tinggi, menggantikan webhook per peristiwa.
- **Sertifikasi mitra** — integrasi yang lolos tinjauan mendapat penanda di Marketplace.
- **Alat migrasi versi** yang menunjukkan perbedaan konkret pada payload yang benar-benar dipakai tenant itu.
