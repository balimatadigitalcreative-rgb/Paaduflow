# Module Design: Identity & Access Management
*Phase 1 — Foundation. Modul kedua, dibangun langsung setelah Multi-Tenant & Organization Foundation.*

**Cakupan:** Authentication · User · Role · Permission · Session · SSO · Invitation.
**Dependency:** Modul 01 (Tenant, Company).
**Menjadi dependency untuk:** seluruh modul lain tanpa kecuali.

---

## 1. Business Problem

Modul 01 menetapkan *di mana* data hidup — tenant dan company. Modul ini menetapkan *siapa yang boleh menyentuhnya*.

Tanpa model akses yang benar sejak awal, tiga hal terjadi dan ketiganya mahal. Pertama, setiap modul menerapkan pemeriksaan izinnya sendiri, sehingga tidak ada yang dapat menjawab pertanyaan "siapa saja yang bisa memposting jurnal di PT Nusantara Jaya" tanpa membaca kode. Kedua, kebocoran data lintas company terjadi lewat celah yang tidak terlihat — pencarian global, laporan, notifikasi. Ketiga, auditor meminta bukti pemisahan tugas dan tidak ada yang bisa memberikannya.

Situasinya diperberat oleh kenyataan bahwa Business OS multi-company. Satu orang wajar menjadi Direktur di satu PT dan staf gudang di PT lain dalam grup yang sama. Model akses yang menempelkan peran pada pengguna secara global tidak dapat menyatakan itu, dan setiap upaya menambalnya nanti akan menyentuh setiap tabel dan setiap endpoint.

---

## 2. Goals

- Satu identitas per orang, lintas seluruh tenant dan company yang ia akses.
- Peran melekat pada **pasangan pengguna–company**, bukan pada pengguna.
- Izin dapat diselesaikan menjadi predikat kueri, sehingga penyaringan dilakukan **di tingkat basis data**, bukan setelah data diambil.
- Setiap penolakan akses dapat menjelaskan **alasannya** — izin, paket langganan, atau keadaan dokumen.
- Pemisahan tugas dapat ditegakkan dan dibuktikan kepada auditor.
- AI dan otomasi punya identitas tersendiri yang **tidak pernah melebihi** izin manusia yang mendelegasikannya.
- Siap SSO korporat per tenant tanpa mengubah model inti.

---

## 3. User Stories

- Sebagai pemilik grup usaha, saya ingin memberi seseorang akses penuh di satu PT dan akses terbatas di PT lain, tanpa membuatkan dua akun.
- Sebagai Security Engineer, saya ingin jaminan bahwa hasil pencarian dan laporan tidak pernah memuat data yang tidak boleh dilihat pengguna — termasuk sekadar keberadaannya.
- Sebagai admin company, saya ingin tahu persis siapa yang punya akses ke apa, tanpa membaca kode.
- Sebagai auditor, saya ingin bukti bahwa pengaju dokumen tidak pernah menyetujui dokumennya sendiri.
- Sebagai pengguna, saya ingin masuk dengan akun perusahaan saya (SSO) dan tidak perlu mengingat kata sandi lain.
- Sebagai pengguna yang kehilangan perangkat, saya ingin mencabut sesi di perangkat lain tanpa mengganti kata sandi.
- Sebagai admin, saya ingin membuat peran kustom untuk struktur organisasi saya, tanpa menunggu rilis produk.

---

## 4. Functional Requirements

**Autentikasi.** Kata sandi dengan Argon2id · MFA berbasis TOTP dengan kode pemulihan sekali pakai · SSO OIDC dan SAML per tenant · masuk dengan tautan email untuk pemulihan · pembatasan laju dan penguncian bertahap.

**Sesi.** Access token berumur pendek + refresh token dengan rotasi dan deteksi penggunaan ulang · daftar sesi aktif per pengguna dengan perangkat, lokasi perkiraan, dan waktu terakhir · pencabutan per sesi maupun seluruhnya.

**Pengguna.** Satu identitas global per email · profil, preferensi (tema, kepadatan, modul tersemat) · status: aktif, ditangguhkan, dinonaktifkan.

**Keanggotaan dan akses.** Keanggotaan tenant terpisah dari akses company · satu peran per pasangan pengguna–company · akses dapat dicabut per company tanpa memengaruhi yang lain.

**Peran dan izin.** Peran bawaan sistem tidak dapat diubah · peran kustom dibuat per tenant dan dipakai lintas company-nya · izin berformat `modul.entitas.aksi:cakupan` · katalog izin terversi.

**Undangan.** Undangan menyertakan peran dan daftar company · berlaku 7 hari · dapat dikirim ulang dan dicabut · terlihat di daftar pengguna dengan status tertunda.

**Delegasi mesin.** Aksi AI dan otomasi berjalan atas nama pengguna dengan **irisan** izin pengguna itu · daftar izin yang tidak pernah dapat didelegasikan ke mesin.

**Audit.** Seluruh peristiwa autentikasi dan perubahan akses tercatat permanen.

---

## 5. Non Functional Requirements

**Penyaringan di tingkat kueri.** Izin wajib dapat diterjemahkan menjadi klausa `WHERE`. Mengambil seluruh baris lalu menyaring di aplikasi akan gagal pada tenant besar dan berisiko bocor lewat penghitungan total. Ini mengikat desain: cakupan izin harus sederhana dan terbatas.

**Resolusi izin di bawah 5ms.** Ia dipanggil di setiap permintaan. Izin efektif pengguna per company disimpan di cache dan diinvalidasi saat peran berubah.

**Ketersediaan.** Modul ini adalah titik kegagalan tunggal — sama seperti Modul 01. Wajib redundan dan berlatensi rendah.

**Auditabilitas.** Perubahan akses tidak dapat dihapus dari antarmuka oleh peran mana pun.

**Keamanan.** Kata sandi tidak pernah disimpan dapat dibalik · token disimpan sebagai hash · rahasia SSO terenkripsi saat diam · seluruh peristiwa autentikasi dibatasi laju per akun **dan** per IP.

**Isolasi.** Tidak ada kueri yang dapat melintasi tenant, bahkan dengan izin tertinggi sekalipun. Dukungan lintas tenant hanya lewat jalur impersonasi terpisah yang teraudit.

---

## 6. Database Design

**Table: `users`** — identitas global

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| email | citext, unique | unik lintas seluruh sistem |
| email_verified_at | timestamp, nullable | |
| full_name | varchar | |
| status | enum | active, suspended, deactivated |
| preferences | jsonb | tema, kepadatan, modul tersemat |
| created_at, updated_at, deleted_at | timestamp | |
| created_by, updated_by, deleted_by | UUID | |

**Table: `user_credentials`**

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| password_hash | text | Argon2id |
| password_changed_at | timestamp | |
| failed_attempts | int | |
| locked_until | timestamp, nullable | penguncian bertahap |

**Table: `mfa_factors`** — `user_id`, `type` (totp, recovery_code), `secret_encrypted`, `confirmed_at`, `last_used_at`

**Table: `tenant_memberships`**

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| tenant_id | UUID (FK) | |
| status | enum | invited, active, suspended, removed |
| is_owner | boolean | tenant owner, minimal satu per tenant |
| joined_at | timestamp | |

Unik: `(user_id, tenant_id)`.

**Table: `company_access`** — inti model ini

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| tenant_id | UUID (FK) | wajib, terindeks |
| company_id | UUID (FK) | |
| user_id | UUID (FK) | |
| role_id | UUID (FK) | |
| granted_by | UUID | |
| granted_at | timestamp | |

Unik: `(company_id, user_id)`. **Satu peran per pasangan pengguna–company.** Menumpuk banyak peran per company membuat izin efektif sulit dijelaskan dan sulit diaudit.

**Table: `roles`**

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| tenant_id | UUID, nullable | `NULL` berarti peran bawaan sistem |
| key | varchar | tenant_owner, tenant_admin, company_admin, member |
| name, description | varchar | |
| is_system | boolean | tidak dapat diubah atau dihapus |

**Table: `permissions`** — katalog, `key` (`penjualan.faktur.posting`), `module`, `entity`, `action`, `description`, `min_plan`, `delegatable_to_machine` (boolean)

**Table: `role_permissions`** — `role_id`, `permission_id`, `scope` (enum: `own`, `company`, `tenant`)

**Table: `sessions`** — `user_id`, `refresh_token_hash`, `device`, `ip`, `user_agent`, `last_seen_at`, `expires_at`, `revoked_at`, `replaced_by`

**Table: `sso_connections`** — `tenant_id`, `type` (oidc, saml), `config_encrypted`, `domain`, `enforce` (boolean), `default_role_id`

**Table: `invitations`** — `tenant_id`, `email`, `role_id`, `company_ids` (jsonb), `token_hash`, `expires_at`, `accepted_at`, `revoked_at`, `invited_by`

**Table: `auth_events`** — `user_id` nullable, `tenant_id` nullable, `type`, `actor_type` (human, ai, system), `ip`, `user_agent`, `metadata` jsonb, `created_at`. **Append-only.**

---

## 7. API Design

```
POST   /v1/auth/register                  -> memicu provisioning Modul 01
POST   /v1/auth/login                     -> access + refresh token, atau tantangan MFA
POST   /v1/auth/mfa/verify
POST   /v1/auth/refresh                   -> rotasi, deteksi penggunaan ulang
POST   /v1/auth/logout
GET    /v1/auth/sso/{tenant-slug}         -> mulai alur SSO
POST   /v1/auth/sso/callback

GET    /v1/me                             -> profil, keanggotaan tenant, akses company
GET    /v1/me/permissions?company_id=     -> izin efektif di company tersebut
PATCH  /v1/me/preferences
GET    /v1/me/sessions
DELETE /v1/me/sessions/{id}

GET    /v1/tenants/{id}/users             -> termasuk undangan tertunda
POST   /v1/tenants/{id}/invitations
POST   /v1/invitations/{token}/accept
DELETE /v1/invitations/{id}

GET    /v1/companies/{id}/access
POST   /v1/companies/{id}/access          -> beri akses, tetapkan peran
PATCH  /v1/companies/{id}/access/{userId}
DELETE /v1/companies/{id}/access/{userId}

GET    /v1/tenants/{id}/roles
POST   /v1/tenants/{id}/roles             -> peran kustom
PATCH  /v1/roles/{id}
GET    /v1/permissions                    -> katalog
```

### Kontrak yang mengikat seluruh produk

**Konteks company diambil dari path, bukan dari token.** Ini konsekuensi langsung keputusan URL di Information Architecture §2. Token membawa identitas dan keanggotaan tenant; otorisasi company diperiksa per permintaan terhadap `company_id` di path. Tanpa ini, berpindah company memerlukan penerbitan ulang token dan tautan lintas company tidak dapat bekerja.

**Penolakan akses membedakan tiga sebab.** Ini yang memungkinkan kebijakan tiga arah di Information Architecture §5.

```json
{ "success": false, "message": "...", "errors": [
  { "code": "permission_denied",  "required": "penjualan.faktur.posting", "ask": "Admin Company" },
  { "code": "plan_restricted",    "required_plan": "business" },
  { "code": "state_restricted",   "reason": "Periode fiskal sudah ditutup" } ] }
```

`permission_denied` → sembunyikan di UI. `plan_restricted` → tampilkan dengan tawaran upgrade. `state_restricted` → tampilkan nonaktif dengan alasan.

**`GET /v1/me/permissions` mengembalikan izin efektif**, bukan peran. Klien tidak pernah menyimpulkan izin dari nama peran.

---

## 8. UI Flow

**Masuk.** Email → deteksi domain SSO tenant → kata sandi atau redirect SSO → tantangan MFA bila aktif → pilih tenant bila lebih dari satu → dashboard company terakhir.

**Undangan.** Email → penerima yang belum punya akun membuat kata sandi lalu langsung masuk ke company yang diundang, **tanpa melewati onboarding company** · penerima yang sudah punya akun menerimanya sebagai notifikasi, dan menerimanya menambah akses tanpa mengganti apa pun.

**Kelola akses.** Pengaturan → Pengguna: daftar dengan kolom company yang diakses dan peran per company, undangan tertunda terlihat dengan tombol kirim ulang.

**Kelola peran.** Pengaturan → Peran: peran bawaan ditandai terkunci · pembuat peran kustom menampilkan izin dalam pohon per modul · **pratinjau dampak** sebelum menyimpan: berapa pengguna terpengaruh dan apa yang berubah bagi mereka.

**Sesi saya.** Pengaturan → Keamanan: daftar sesi aktif, sesi saat ini ditandai, cabut per sesi atau seluruhnya.

Mengikuti Layout System: pengaturan sebagai form `container-form` 640px, dan setiap field menampilkan asal nilainya.

---

## 9. Business Flow

Registrasi atau undangan → verifikasi → keanggotaan tenant aktif → akses company diberikan dengan peran → pengguna masuk → izin efektif diselesaikan dan disimpan di cache per pasangan pengguna–company → setiap permintaan diotorisasi terhadap `company_id` di path → perubahan peran menginvalidasi cache dan tercatat di `auth_events` → pencabutan akses menghentikan seluruh sesi aktif di company itu.

Karyawan keluar → akses company dicabut → keanggotaan tenant menjadi `removed` → **data yang ia buat tetap utuh**, hanya rujukan ke identitasnya yang dipertahankan untuk audit.

---

## 10. Permission Matrix

| Aksi | Tenant Owner | Tenant Admin | Company Admin | Member |
|---|---|---|---|---|
| Undang pengguna ke tenant | ✅ | ✅ | ❌ | ❌ |
| Beri akses company | ✅ | ✅ | ✅ (company sendiri) | ❌ |
| Ubah peran pengguna | ✅ | ✅ | ✅ (di bawah tingkatnya) | ❌ |
| Buat peran kustom | ✅ | ✅ | ❌ | ❌ |
| Ubah peran bawaan | ❌ | ❌ | ❌ | ❌ |
| Konfigurasi SSO | ✅ | ✅ | ❌ | ❌ |
| Lihat log autentikasi | ✅ | ✅ | ✅ (company sendiri) | ❌ |
| Cabut sesi pengguna lain | ✅ | ✅ | ❌ | ❌ |
| Cabut sesi sendiri | ✅ | ✅ | ✅ | ✅ |

**Tidak ada peran yang dapat menaikkan dirinya sendiri.** Company Admin hanya dapat memberikan peran yang setara atau di bawah tingkatnya.

**Tenant Owner tidak dapat dihapus bila ia satu-satunya.** Kepemilikan harus dialihkan lebih dulu.

---

## 11. Validation Rules

- Email unik lintas seluruh sistem, disimpan dan dibandingkan sebagai `citext`.
- Kata sandi minimal 12 karakter, diperiksa terhadap daftar kata sandi bocor. **Tanpa aturan komposisi karakter** — ia menurunkan entropi nyata dan mendorong pola yang mudah ditebak.
- Undangan hanya berlaku untuk email yang dituju; membukanya dengan akun lain ditolak.
- `company_id` pada pemberian akses wajib berada di tenant yang sama dengan peran.
- Peran kustom tidak dapat memuat izin yang tidak dimiliki pembuatnya.
- Izin bertanda `delegatable_to_machine = false` **tidak pernah** dapat diberikan ke aktor AI — mencakup seluruh aksi `*.posting`, `*.persetujuan`, dan `*.void`.
- Pengguna terakhir yang memegang `is_owner` di sebuah tenant tidak dapat dihapus.
- Perubahan kata sandi mencabut seluruh sesi kecuali sesi yang sedang berjalan.

### Pemisahan tugas

Pengaju dokumen tidak dapat menyetujui dokumennya sendiri, **meski memiliki izin persetujuan**. Ini bukan aturan izin — ia kebijakan yang ditegakkan di layanan persetujuan, karena ia bergantung pada relasi antara pengguna dan dokumen, bukan pada peran.

Konsekuensi: model izin **tidak** mencoba menyandikan hal seperti ini. Ambang nilai persetujuan juga bukan izin. Menyandikan keduanya ke dalam peran akan meledakkan jumlah peran dan membuatnya tidak dapat dipahami dalam setahun.

---

## 12. Testing Strategy

**Unit.** Resolusi izin efektif untuk seluruh kombinasi peran dan cakupan · penurunan predikat kueri dari cakupan izin · kebijakan penguncian bertahap.

**Integration.** Setiap endpoint diuji dengan pengguna yang **tidak** berwenang, memastikan penolakan yang benar dan **kode sebab yang benar** · rotasi refresh token dan deteksi penggunaan ulang · pencabutan sesi berlaku seketika.

**Negatif — isolasi.** Uji sengaja: pengguna dengan akses ke company A mencoba mengambil data company B lewat manipulasi path, lewat pencarian global, lewat laporan, dan lewat notifikasi. **Keempat jalur wajib diuji terpisah** — kebocoran biasanya terjadi di jalur ketiga dan keempat, bukan di endpoint utama.

**Negatif — eksistensi.** Pencarian tidak boleh membocorkan keberadaan data yang tidak diizinkan, termasuk lewat perbedaan jumlah hasil atau waktu respons.

**Load.** Resolusi izin pada tenant dengan 5.000 pengguna dan 200 company.

**E2E.** Undangan sampai akses pertama · SSO penuh · pergantian company dan konteks izinnya · pencabutan akses saat sesi sedang berjalan.

---

## 13. Future Enhancements

- **Impersonasi terkendali** untuk dukungan: memerlukan persetujuan pelanggan, berbatas waktu, seluruh aksi ditandai di audit trail, dan dilarang untuk aksi yang menulis ke buku besar.
- **ABAC** untuk aturan berbasis atribut — akses per cabang, wilayah, atau kategori barang.
- **Akses berjangka waktu** yang kedaluwarsa otomatis, untuk auditor dan konsultan eksternal.
- **Just-in-time access**: izin sensitif diminta saat dibutuhkan, disetujui, dan berakhir sendiri.
- **SCIM** untuk penyediaan pengguna otomatis dari direktori korporat.
- **Passkey** sebagai pengganti kata sandi.
- **Peninjauan akses berkala**: sistem meminta admin meninjau siapa punya akses apa setiap kuartal — kebutuhan umum audit SOC 2 dan ISO 27001.
- **Kunci API dan service account** dengan izin bercakupan sempit, untuk integrasi pihak ketiga di Fase 4.
