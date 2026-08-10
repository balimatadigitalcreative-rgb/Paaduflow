# Module Design: Notification, Audit Log & File Storage
*Phase 1 — Foundation. Tiga layanan lintas modul, digabung karena ketiganya dikonsumsi oleh setiap modul lain dan tidak berdiri sebagai domain bisnis tersendiri.*

**Dependency:** Modul 01 (Tenant, Company), Modul 02 (IAM).
**Menjadi dependency untuk:** seluruh modul Fase 2 ke atas.

---

## 1. Business Problem

Ketiga layanan ini punya pola kegagalan yang sama: mereka terasa sepele sampai dibangun per modul, lalu menjadi mustahil diperbaiki.

**Notifikasi** yang dibangun per modul menghasilkan sepuluh gaya berbeda, tidak ada preferensi terpusat, dan pengguna yang kebanjiran akan mematikan semuanya — termasuk yang benar-benar butuh tindakan. Setelah itu approval menumpuk dan tidak ada yang tahu.

**Audit log** yang dibangun per modul menghasilkan format berbeda di tiap tabel, dan saat auditor meminta "seluruh perubahan pada faktur ini beserta pelakunya", jawabannya harus dirakit dari enam tempat. Lebih buruk, audit trail yang dapat diubah tidak bernilai sebagai bukti.

**File storage** yang tidak punya model akses tunggal akan melahirkan sistem izin kedua yang menyimpang dari yang pertama. Lampiran faktur yang bisa diunduh orang yang tidak boleh melihat fakturnya adalah kebocoran, dan ia hampir selalu terjadi lewat URL file yang lolos dari pemeriksaan.

---

## 2. Goals

- Satu kanal notifikasi terpusat dengan preferensi per pengguna, per kategori, per saluran.
- Satu audit log append-only yang menjadi **satu-satunya sumber** bagi tampilan aktivitas pengguna maupun ekspor kepatuhan.
- Izin file **diturunkan dari dokumen induknya**, bukan dari daftar akses tersendiri.
- Ketiganya tidak pernah memperlambat jalur transaksi utama.
- Retensi dapat dibuktikan dan dapat ditegakkan.

---

## 3. User Stories

- Sebagai pemilik bisnis, saya ingin diberi tahu saat ada yang butuh persetujuan saya, tanpa dibanjiri hal yang tidak perlu.
- Sebagai pengguna lintas company, saya ingin setiap notifikasi menyebut company mana yang dimaksud.
- Sebagai akuntan, saya ingin melihat siapa mengubah angka ini, kapan, dari berapa menjadi berapa.
- Sebagai auditor, saya ingin ekspor lengkap yang dapat diverifikasi bahwa isinya tidak diubah.
- Sebagai admin, saya ingin yakin lampiran faktur hanya dapat diunduh orang yang boleh melihat fakturnya.
- Sebagai pengguna lapangan, saya ingin memotret struk dari ponsel dan melampirkannya langsung.
- Sebagai pengguna, saya ingin notifikasi tidak masuk di tengah malam.

---

## 4. Functional Requirements

### 4a. Notification

Peristiwa dipublikasikan modul → aturan menentukan siapa penerimanya → preferensi menentukan salurannya → pengiriman tercatat.

**Kategori:** perlu tindakan · selesai · informasi · keamanan. **Hanya "perlu tindakan" yang dihitung di badge**, sesuai Component Specs AppShell §5.

**Saluran:** dalam aplikasi (selalu aktif, tidak dapat dimatikan) · email · push mobile · WhatsApp · webhook.

**Preferensi** per pengguna, per kategori, per saluran. Kategori keamanan tidak dapat dimatikan.

**Penggabungan.** Notifikasi sejenis dalam jendela waktu digabung menjadi satu — "3 faktur menunggu persetujuan", bukan tiga pesan terpisah.

**Jam tenang** per pengguna dengan zona waktu. Notifikasi non-mendesak ditahan sampai jam kerja; kategori keamanan menembusnya.

**Konteks company wajib disebut** di setiap notifikasi lintas company, dan tautannya membawa `company_slug` sesuai skema URL di Information Architecture §2.

### 4b. Audit Log

**Setiap peristiwa mencatat:** tenant, company, pelaku dan jenis pelakunya, aksi, entitas dan ID-nya, nilai sebelum dan sesudah per field yang berubah, waktu, IP, user agent, dan ID permintaan.

**Append-only.** Tidak ada `UPDATE` maupun `DELETE` — ditegakkan di tingkat izin basis data, bukan hanya konvensi aplikasi.

**Dua proyeksi dari satu sumber:** *activity feed* yang disaring izin dan ditulis dalam bahasa manusia, dan *ekspor kepatuhan* yang lengkap dan mentah.

**Rantai hash per tenant** agar penghapusan atau penyisipan baris dapat terdeteksi.

**Ditulis asinkron lewat outbox** agar tidak menambah latensi transaksi, tetapi dalam transaksi yang sama dengan perubahan datanya — sehingga tidak mungkin ada perubahan tanpa jejak.

### 4c. File Storage

**Unggah langsung ke penyimpanan objek** lewat presigned URL. Berkas tidak pernah melewati server aplikasi.

**Pemindaian antivirus** sebelum berkas terlihat. Sebelum lolos, statusnya `scanning` dan tidak dapat diunduh.

**Deduplikasi** berdasarkan hash konten di dalam satu tenant.

**Turunan gambar** (thumbnail, versi terkompresi) dibuat asinkron.

**Unduhan lewat URL bertanda tangan berumur pendek**, dibuat per permintaan setelah izin diperiksa. Tidak ada URL publik permanen.

**Kuota** per paket langganan, dengan peringatan di 80%.

**Region penyimpanan mengikuti `region` tenant** dari Modul 01.

---

## 5. Non Functional Requirements

- Publikasi peristiwa tidak menambah lebih dari 5ms pada jalur transaksi.
- Pengiriman notifikasi **idempoten** — percobaan ulang tidak pernah mengirim dua kali. Kunci idempotensi dari `(event_id, user_id, channel)`.
- Audit log tahan terhadap kehilangan: bila penulisan proyeksi gagal, log inti tetap ada dan proyeksi dibangun ulang.
- Ekspor audit untuk 12 bulan pada tenant besar berjalan asinkron dan selesai di bawah 10 menit.
- Unduhan file diotorisasi per permintaan; URL bertanda tangan berlaku maksimal 5 menit.
- Retensi audit dan dokumen keuangan **wajib dikonfirmasi ke penasihat hukum** — regulasi Indonesia mensyaratkan penyimpanan dokumen perusahaan dalam jangka panjang, dan angkanya harus ditetapkan legal, bukan diasumsikan tim produk.

---

## 6. Database Design

**Table: `notification_events`** — peristiwa mentah yang dipublikasikan modul

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| tenant_id, company_id | UUID (FK) | company nullable untuk peristiwa tingkat tenant |
| type | varchar | `invoice.approval_requested` |
| entity_type, entity_id | varchar, UUID | |
| payload | jsonb | data untuk merender template |
| actor_id, actor_type | UUID, enum | human, ai, system |
| created_at | timestamp | |

**Table: `notifications`** — hasil penargetan, satu baris per penerima

`id` · `event_id` · `user_id` · `tenant_id` · `company_id` · `category` (action_required, completed, info, security) · `read_at` · `acted_at` · `group_key` · `created_at`

**Table: `notification_deliveries`** — `notification_id`, `channel`, `status` (queued, sent, delivered, failed, suppressed), `provider_message_id`, `attempts`, `error`, `sent_at`. Unik: `(notification_id, channel)`.

**Table: `notification_preferences`** — `user_id`, `category`, `channel`, `enabled`, `quiet_hours_start`, `quiet_hours_end`, `timezone`

**Table: `audit_log`**

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| tenant_id | UUID | wajib, bagian indeks utama |
| company_id | UUID, nullable | |
| sequence | bigint | urut per tenant, tanpa celah |
| actor_id | UUID, nullable | null untuk sistem |
| actor_type | enum | human, ai, system |
| on_behalf_of | UUID, nullable | diisi saat pelaku AI atau impersonasi |
| action | varchar | `invoice.posted` |
| entity_type, entity_id | varchar, UUID | |
| changes | jsonb | `{"field": {"from": …, "to": …}}` |
| request_id, ip, user_agent | varchar | |
| prev_hash, hash | varchar | rantai hash per tenant |
| created_at | timestamp | |

**Tanpa kolom `updated_at` dan `deleted_at`** — tabel ini tidak pernah berubah. Peran basis data aplikasi hanya diberi `INSERT` dan `SELECT`.

**Table: `files`**

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| tenant_id, company_id | UUID (FK) | |
| storage_key | varchar | |
| content_hash | varchar | untuk deduplikasi |
| filename, mime_type, size_bytes | | |
| status | enum | uploading, scanning, ready, quarantined, deleted |
| uploaded_by | UUID | |
| created_at, deleted_at | timestamp | |

**Table: `file_attachments`** — `file_id`, `entity_type`, `entity_id`, `attached_by`, `attached_at`. **Inilah yang menentukan izin file.**

---

## 7. API Design

```
GET    /v1/me/notifications?category=&company_id=&unread=
POST   /v1/notifications/{id}/read
POST   /v1/notifications/read-all
GET    /v1/me/notification-preferences
PATCH  /v1/me/notification-preferences

GET    /v1/companies/{id}/audit?entity_type=&entity_id=&actor=&from=&to=
GET    /v1/{entity}/{id}/activity          -> proyeksi activity feed
POST   /v1/companies/{id}/audit/exports    -> pekerjaan asinkron
GET    /v1/companies/{id}/audit/verify     -> verifikasi rantai hash

POST   /v1/companies/{id}/files            -> mengembalikan presigned upload URL
POST   /v1/files/{id}/complete             -> memicu pemindaian
POST   /v1/files/{id}/attach               -> body: entity_type, entity_id
GET    /v1/files/{id}/download             -> redirect ke URL bertanda tangan 5 menit
DELETE /v1/files/{id}/attach/{attachmentId}
```

### Kontrak yang mengikat

**`GET /v1/files/{id}/download` memeriksa izin terhadap dokumen induk**, bukan terhadap file. Bila sebuah file terlampir ke faktur, izinnya adalah izin baca faktur itu. File tanpa lampiran hanya dapat diakses pengunggahnya.

Ini menghindari sistem izin kedua. Konsekuensinya: file yang terlampir ke dua dokumen dapat diakses oleh siapa pun yang boleh membaca salah satunya — dan itu perilaku yang benar, bukan celah.

**Audit tidak punya endpoint tulis, ubah, maupun hapus.** Ia hanya ditulis dari dalam oleh layanan, lewat outbox.

**`/activity` dan `/audit` mengembalikan hal berbeda dari sumber yang sama.** `/activity` disaring izin dan dimanusiakan; `/audit` lengkap dan memerlukan izin audit tersendiri.

---

## 8. UI Flow

**Notification center** dari top bar, tiga kelompok: perlu tindakan · selesai · informasi. Item lintas company menampilkan nama company-nya. Badge hanya menghitung kelompok pertama.

**Preferensi** di Pengaturan → Notifikasi: matriks kategori × saluran, plus jam tenang dan zona waktu. Baris kategori keamanan ditampilkan terkunci dengan alasan.

**Activity feed** sebagai tab keempat di setiap halaman detail dokumen, sesuai struktur tab baku di Flow Archetypes §1. Dikelompokkan per hari, pelaku dibedakan visual antara manusia, AI, dan sistem.

**Audit log** di Pengaturan → Log: filter entitas, pelaku, rentang tanggal. Tombol ekspor dan tombol verifikasi integritas.

**Lampiran** di halaman detail dokumen: seret dan lepas, atau ambil foto di mobile. Berkas dalam status `scanning` tampil dengan indikator dan tidak dapat diunduh.

---

## 9. Business Flow

Modul menerbitkan peristiwa dalam transaksi yang sama dengan perubahan datanya → outbox menjamin peristiwa terkirim tepat sekali → mesin aturan menentukan penerima berdasarkan peran dan akses company mereka → preferensi dan jam tenang menentukan saluran dan waktu → notifikasi sejenis digabung → pengiriman dicatat per saluran → tindakan pengguna menutup notifikasi bagi seluruh penerima lain di kelompok yang sama.

Butir terakhir penting: bila satu dari tiga penyetuju sudah menyetujui, notifikasi bagi dua lainnya harus ditutup. Notifikasi yang menuntut tindakan yang sudah tidak relevan adalah cara tercepat membuat orang berhenti membacanya.

---

## 10. Permission Matrix

| Aksi | Tenant Owner | Tenant Admin | Company Admin | Member |
|---|---|---|---|---|
| Lihat notifikasi sendiri | ✅ | ✅ | ✅ | ✅ |
| Ubah preferensi sendiri | ✅ | ✅ | ✅ | ✅ |
| Lihat activity feed dokumen | mengikuti izin baca dokumen | | | |
| Lihat audit log company | ✅ | ✅ | ✅ | ❌ |
| Ekspor audit log | ✅ | ✅ | ✅ | ❌ |
| Verifikasi rantai hash | ✅ | ✅ | ✅ | ❌ |
| **Hapus audit log** | ❌ | ❌ | ❌ | ❌ |
| Unggah dan lampirkan file | mengikuti izin ubah dokumen | | | |
| Unduh file | mengikuti izin baca dokumen induk | | | |
| Lepas lampiran | mengikuti izin ubah dokumen, dan **hanya bila dokumen belum diposting** | | | |

Baris audit log yang dicoret di seluruh kolom adalah inti modul ini. Tidak ada peran, termasuk pemilik tenant, yang dapat menghapus jejak.

---

## 11. Validation Rules

- Peristiwa tanpa `tenant_id` ditolak di tingkat layanan.
- Notifikasi kategori keamanan tidak dapat dinonaktifkan; upaya mengubahnya ditolak.
- Jam tenang tidak berlaku untuk kategori keamanan.
- `changes` pada audit log **tidak pernah memuat** kata sandi, token, rahasia, atau nomor kartu — daftar field terlarang ditegakkan di serializer, bukan diserahkan ke pemanggil.
- Lampiran tidak dapat dilepas dari dokumen yang sudah diposting. Ia hanya dapat ditambah.
- Unggahan menolak tipe berkas yang dapat dieksekusi.
- Ukuran berkas maksimal per paket; melewati kuota tenant menolak unggahan dengan pesan yang menyebut sisa kuota.
- Berkas berstatus `quarantined` tidak pernah dapat diunduh oleh siapa pun, termasuk pengunggahnya.
- Nomor urut audit per tenant tidak boleh punya celah; celah adalah indikasi manipulasi dan memicu peringatan.

---

## 12. Testing Strategy

**Unit.** Penggabungan notifikasi · perhitungan jam tenang lintas zona waktu · perhitungan rantai hash · serializer yang menyaring field sensitif.

**Integration.** Outbox menjamin tepat sekali · percobaan ulang pengiriman tidak menghasilkan duplikat · tindakan satu penyetuju menutup notifikasi penyetuju lain · izin unduh file mengikuti dokumen induk.

**Negatif.** Pengguna tanpa akses ke faktur mencoba mengunduh lampirannya lewat `file_id` langsung · upaya `UPDATE` dan `DELETE` pada `audit_log` ditolak di tingkat basis data · berkas `scanning` dan `quarantined` tidak dapat diunduh · manipulasi satu baris audit terdeteksi oleh verifikasi rantai.

**Load.** Satu peristiwa yang menargetkan 500 penerima · ekspor audit 12 bulan pada tenant besar.

**E2E.** Faktur diajukan sampai notifikasi persetujuan diterima di dua saluran · foto struk dari mobile sampai terlampir dan terpindai · ekspor audit lalu diverifikasi ulang.

---

## 13. Future Enhancements

- **Aturan notifikasi kustom per tenant** — "beri tahu saya bila ada faktur di atas Rp 500 juta".
- **Ringkasan harian dan mingguan** menggantikan notifikasi individual bagi pengguna yang memilihnya.
- **WhatsApp Business** sebagai saluran penuh — relevan untuk pasar Indonesia, tetapi memerlukan persetujuan template dan model biaya per pesan yang harus dihitung sebelum dijanjikan.
- **Penandatanganan digital** pada ekspor audit, agar dapat diverifikasi pihak ketiga tanpa akses sistem.
- **Penyimpanan audit tidak dapat ditulis ulang** (WORM) untuk pelanggan dengan kebutuhan regulasi ketat.
- **OCR pada struk dan faktur** yang diunggah, mengisi draf dokumen otomatis — masuk ke jalur AI di Fase 4.
- **Penyimpanan objek milik pelanggan** untuk enterprise yang mensyaratkan data berada di infrastrukturnya sendiri.
- **Anotasi pada lampiran** — menandai bagian struk atau kontrak langsung di aplikasi.
