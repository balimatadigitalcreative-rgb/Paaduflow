# Module Design: AI Assistant
*Phase 4 — Growth. Modul pertama yang tidak menambah domain bisnis, melainkan cara baru mengakses empat belas modul yang sudah ada.*

**Cakupan:** Lapisan Semantik · Penjawaban Berdasar Data · Empat Permukaan Interaksi · Saran Inline · Ringkasan Terjadwal · Jejak & Audit · Tata Kelola Biaya · Batas Kewenangan.
**Dependency:** seluruh modul, lewat lapisan semantik dan lapisan izin — tidak pernah lewat akses langsung ke tabel.

---

## 1. Business Problem

Pemilik bisnis tidak kekurangan data; mereka kekurangan jawaban. Pertanyaan seperti "kenapa margin bulan ini turun" memerlukan menggabungkan penjualan, harga pokok, dan pembelian — pekerjaan yang di sebagian besar perusahaan dilakukan akuntan selama setengah hari, bila sempat.

Tetapi AI di produk bisnis punya tiga cara gagal yang khas, dan ketiganya merusak kepercayaan secara permanen.

**Angka yang salah tetapi terdengar meyakinkan.** Model bahasa akan menghasilkan angka yang masuk akal meski datanya tidak mendukungnya, dan pengguna yang mempercayainya sekali lalu menemukan kesalahannya tidak akan mempercayainya lagi.

**Kebocoran data lewat jalur AI.** Lapisan pengambilan data yang dibangun terpisah hampir selalu melewatkan aturan izin baris — sehingga staf gudang yang bertanya lewat AI dapat memperoleh angka yang tidak boleh ia lihat di antarmuka.

**Jawaban yang tidak dapat diverifikasi.** Angka tanpa jejak tidak dapat dipakai untuk keputusan, dan tidak dapat dipertanggungjawabkan saat ditanya auditor.

---

## 2. Goals

- **AI menjawab dari kueri terhadap data hidup**, bukan dari ringkasan yang disimpan atau indeks yang basi.
- **AI membaca lewat izin pengguna, tidak pernah di sekelilingnya.** Tidak ada jalur data istimewa.
- Setiap jawaban membawa **jejak yang dapat diverifikasi**: kueri, cakupan, jumlah baris, dan tautan ke transaksinya.
- Metrik didefinisikan sekali. "Margin kotor" berarti hal yang sama di AI, di laporan, dan di dashboard.
- **AI tidak pernah mengubah data tanpa konfirmasi eksplisit**, dan tidak pernah menyentuh buku besar.
- Bila pertanyaan tidak dapat dijawab dengan benar, AI mengatakannya.
- Data tenant tidak pernah dipakai melatih model.

---

## 3. User Stories

- Sebagai pemilik, saya ingin bertanya "kenapa margin Agustus turun" dan mendapat jawaban beserta angkanya.
- Sebagai pemilik, saya ingin dapat mengklik angka di jawaban AI sampai ke fakturnya.
- Sebagai akuntan, saya ingin AI memakai definisi metrik yang sama dengan laporan saya.
- Sebagai Security Engineer, saya ingin yakin AI tidak dapat menampilkan data yang tidak boleh dilihat penanyanya.
- Sebagai staf, saya ingin AI membantu mengisi form, tetapi saya yang memutuskan.
- Sebagai pemilik, saya ingin ringkasan mingguan yang menyebut hal yang tidak biasa, bukan mengulang angka yang sudah saya tahu.
- Sebagai admin, saya ingin tahu berapa biaya pemakaian AI dan siapa yang memakainya.
- Sebagai pengguna, saya ingin AI mengatakan tidak tahu daripada menebak.

---

## 4. Functional Requirements

### Lapisan semantik

Katalog metrik dan dimensi yang didefinisikan sekali dan dipakai bersama oleh AI, laporan, dan dashboard. Setiap metrik membawa nama, definisi bisnis, rumus, sumber data, dimensi yang berlaku, dan izin yang dibutuhkan.

**AI hanya dapat menanyakan apa yang ada di katalog ini.** Bukan SQL bebas. Konsekuensinya penting: jawaban dapat direproduksi, dapat diaudit, dan tidak pernah memakai definisi yang berbeda dari laporan resmi.

### Empat permukaan

| Permukaan | Bentuk |
|---|---|
| Global | Lewat `⌘K`, pertanyaan bebas lintas modul |
| Kontekstual | Panel kanan yang membawa konteks halaman aktif dan menampilkannya eksplisit |
| Inline | Saran di dalam form — kategori akun, pencocokan item, deteksi duplikat |
| Terjadwal | Ringkasan berkala yang menyoroti anomali, bukan mengulang angka rutin |

### Penjawaban

Pertanyaan diterjemahkan ke kueri terhadap lapisan semantik → kueri dijalankan **dengan filter izin pengguna dan konteks company aktif** → hasil diringkas menjadi jawaban → jejak dilampirkan.

Bila pertanyaan tidak dapat dinyatakan lewat lapisan semantik, AI menyatakan keterbatasannya dan menawarkan pertanyaan terdekat yang bisa dijawab.

### Aksi

AI dapat **mengusulkan**, tidak pernah **memutuskan**. Membuat dokumen berstatus draf, mengusulkan kategori, menandai anomali, menyiapkan ringkasan. Setiap aksi yang mengubah data menampilkan **persis apa yang akan berubah** dan menunggu konfirmasi.

### Memori percakapan

Bercakupan pengguna dan company. **Dihapus saat konteks company berpindah** — percakapan tentang PT A tidak boleh menjadi konteks jawaban tentang PT B.

### Tata kelola

Kuota pemakaian per tenant dan per pengguna, dengan peringatan sebelum batas. Laporan pemakaian per pengguna dan per permukaan.

---

## 5. Non Functional Requirements

- **Tidak ada jalur data istimewa.** AI memanggil layanan data yang sama dengan antarmuka, melewati lapisan izin yang sama. Ini diuji sebagai properti keamanan.
- **Seluruh data yang diambil diperlakukan sebagai data, tidak pernah sebagai instruksi.** Nama vendor, catatan, dan deskripsi item dapat memuat teks yang tampak seperti perintah; ia tidak pernah dieksekusi.
- Setiap pertanyaan dan jawaban tercatat, termasuk data apa yang diakses — pola pencatatan baca yang sama dengan data gaji di Modul 10.
- **Data tenant tidak dipakai melatih model**, dan ini dinyatakan di antarmuka, bukan hanya di kebijakan privasi.
- Jawaban untuk pertanyaan umum di bawah 5 detik; pertanyaan yang memerlukan agregasi besar berjalan asinkron dengan notifikasi.
- Kegagalan AI tidak pernah memblokir alur kerja. Panel yang gagal memuat tidak menghentikan halaman.
- Jawaban tanpa jejak **tidak diterbitkan.** Bila jejak tidak dapat dibangun, jawaban ditahan.

---

## 6. Database Design

**Table: `semantic_metrics`** — `company_id` (nullable untuk bawaan), `key`, `name`, `business_definition`, `formula` jsonb, `source_module`, `unit`, `required_permission`, `valid_from`, `status`

**Table: `semantic_dimensions`** — `key`, `name`, `source`, `allowed_metrics` jsonb, `required_permission`

**Table: `ai_conversations`** — `user_id`, `company_id`, `surface` (global, contextual, inline, scheduled), `context_type`, `context_id`, `started_at`, `ended_at`

**Table: `ai_messages`**

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| conversation_id | UUID | |
| role | enum | user, assistant |
| content | text | |
| queries_executed | jsonb | metrik, dimensi, filter, rentang |
| rows_scanned | int | bagian dari jejak |
| permission_context | jsonb | izin efektif saat kueri dijalankan |
| trace_complete | boolean | **jawaban tanpa jejak lengkap tidak diterbitkan** |
| tokens_used | int | |
| latency_ms | int | |
| created_at | timestamp | |

`permission_context` disimpan agar pertanyaan "kenapa AI menampilkan angka ini kepada orang ini" dapat dijawab enam bulan kemudian.

**Table: `ai_actions`** — `message_id`, `action_type`, `proposed_payload` jsonb, `status` (proposed, confirmed, rejected, expired), `confirmed_by`, `confirmed_at`, `resulting_entity_type`, `resulting_entity_id`

Aksi yang diusulkan tetapi tidak dikonfirmasi kedaluwarsa. Usulan yang menggantung bukan keputusan.

**Table: `ai_usage`** — `tenant_id`, `company_id`, `user_id`, `period`, `surface`, `message_count`, `tokens_used`, `estimated_cost`

**Table: `ai_feedback`** — `message_id`, `rating`, `reason`, `comment` — dipakai memperbaiki lapisan semantik, bukan melatih model.

---

## 7. API Design

```
GET    /v1/companies/{id}/semantic/metrics      -> katalog, difilter izin
POST   /v1/companies/{id}/semantic/metrics      -> definisi metrik kustom
POST   /v1/companies/{id}/semantic/query        -> dipakai AI, laporan, dan dashboard

POST   /v1/ai/conversations                     -> bercakupan company aktif
POST   /v1/ai/conversations/{id}/messages
GET    /v1/ai/messages/{id}/trace               -> kueri, cakupan, jumlah baris, tautan

POST   /v1/ai/actions/{id}/confirm              -> menampilkan diff sebelum konfirmasi
POST   /v1/ai/actions/{id}/reject

POST   /v1/ai/inline/suggest                    -> saran di dalam form
GET    /v1/companies/{id}/ai/scheduled-summaries
POST   /v1/companies/{id}/ai/scheduled-summaries

GET    /v1/tenants/{id}/ai/usage?period=
PATCH  /v1/tenants/{id}/ai/quota
POST   /v1/ai/messages/{id}/feedback
```

### Kontrak yang mengikat

**`/semantic/query` adalah satu-satunya jalan AI mengakses data.** Ia memakai lapisan izin yang sama dengan antarmuka. Endpoint AI yang mengakses tabel modul secara langsung adalah pelanggaran arsitektur.

**Endpoint yang sama dipakai laporan dan dashboard.** Inilah yang menjamin definisi metrik tidak pernah berbeda antara jawaban AI dan laporan resmi.

**`trace_complete = false` berarti jawaban tidak diterbitkan.** Ini penegakan aturan "selalu sebutkan sumber" dari Brand Strategy di tingkat sistem, bukan di tingkat prompt.

**Aksi selalu dua langkah.** Usulan lalu konfirmasi, dengan diff yang menampilkan nilai sebelum dan sesudah. Tidak ada endpoint yang menjalankan aksi AI dalam satu langkah.

**Katalog aksi AI adalah irisan** dari izin pengguna dan izin yang dapat didelegasikan ke mesin — sama persis dengan Otomasi di Modul 14. Aksi posting, persetujuan, void, pembayaran, penghapusan, dan perubahan izin **tidak ada di katalog.**

---

## 8. UI Flow

**Panel kontekstual** — 360px di kanan, **bukan modal**, karena pengguna harus tetap melihat data yang ditanyakan. Header menampilkan konteks eksplisit: `Konteks: Faktur INV/2026/08/0142`.

**Jawaban** — kesimpulan lebih dulu, lalu bukti, lalu jejak. Angka di dalam jawaban dapat diklik sampai ke transaksinya.

**Jejak** — dapat dibuka: metrik apa yang dipakai, rentang tanggal, filter yang berlaku, berapa baris yang dipindai. Ini yang membedakan alat kerja dari mainan.

**Usulan aksi** — kartu dengan diff: nilai sekarang di kiri, nilai usulan di kanan, tombol konfirmasi dan tolak. Tidak pernah dijalankan otomatis.

**Saran inline** — muncul sebagai isian bertanda, bukan sebagai nilai yang sudah terisi. Pengguna menerima atau mengabaikan; diam bukan berarti setuju.

**Ringkasan terjadwal** — menyoroti yang tidak biasa. Ringkasan yang mengulang angka yang sudah diketahui akan berhenti dibaca dalam dua minggu.

**Indikator pelaku AI** — di activity feed, ikon dan warna yang membedakan AI dari manusia dan sistem, sesuai Component Specs Composite §9.

---

## 9. Business Flow

Pengguna bertanya → pertanyaan diterjemahkan ke satu atau beberapa kueri semantik → kueri dijalankan dengan konteks izin pengguna dan company aktif → hasil diringkas → jejak dibangun → jawaban diterbitkan bila jejaknya lengkap.

Bila pertanyaan di luar katalog: AI menyatakan keterbatasannya dan menawarkan pertanyaan terdekat yang dapat dijawab. Ia tidak mengarang pendekatan.

Bila jawaban memerlukan aksi: usulan dibuat, ditampilkan sebagai diff, dan menunggu konfirmasi. Konfirmasi menjalankan aksi sebagai **pelaku AI atas nama pengguna**, tercatat di audit log dengan kedua identitas.

Ringkasan terjadwal: kueri dijalankan atas nama penerima, dengan izin penerima — sehingga dua orang berbeda menerima ringkasan yang berbeda dari jadwal yang sama.

---

## 10. Permission Matrix

| Aksi | Tenant Owner | Company Admin | Pengguna |
|---|---|---|---|
| Bertanya lewat AI | ✅ | ✅ | ✅ |
| Melihat data lewat AI | mengikuti izin data pengguna itu sendiri | | |
| Mengonfirmasi aksi AI | mengikuti izin aksi yang bersangkutan | | |
| Definisikan metrik kustom | ✅ | ✅ | ❌ |
| Atur ringkasan terjadwal | ✅ | ✅ | ✅ (untuk diri sendiri) |
| Lihat pemakaian dan biaya AI | ✅ | ✅ | ❌ |
| Atur kuota | ✅ | ❌ | ❌ |
| Nonaktifkan AI untuk company | ✅ | ✅ | ❌ |

**Izin AI bukan izin tersendiri.** Ia turunan: apa yang dapat dilihat pengguna di antarmuka, itu yang dapat dilihatnya lewat AI. Membuat izin AI terpisah akan menciptakan dua model yang menyimpang.

**AI dapat dinonaktifkan per company.** Sebagian perusahaan memiliki kewajiban kerahasiaan yang membuat mereka memilih tidak memakainya, dan itu harus dihormati tanpa kehilangan akses ke sisa produk.

---

## 11. Validation Rules

- Kueri di luar katalog semantik ditolak; AI tidak dapat menyusun kueri bebas.
- Jawaban tanpa jejak lengkap tidak diterbitkan.
- Aksi yang izinnya tidak dapat didelegasikan ke mesin tidak ada di katalog aksi AI.
- Aksi yang diusulkan kedaluwarsa setelah periode tertentu bila tidak dikonfirmasi.
- Konteks percakapan dihapus saat company berpindah.
- Data yang diambil tidak pernah diperlakukan sebagai instruksi.
- Pemakaian melebihi kuota memblokir permintaan baru dengan pesan yang jelas, tidak menurunkan kualitas jawaban diam-diam.
- Metrik kustom tidak dapat merujuk data di luar izin pembuatnya.
- Ringkasan terjadwal berjalan dengan izin penerimanya, bukan izin pembuatnya.

---

## 12. Testing Strategy

**Keamanan — yang terpenting di modul ini.** Pengguna dengan izin terbatas bertanya tentang data yang tidak boleh dilihatnya: AI tidak menampilkannya, dan **tidak mengakui keberadaannya** · AI tidak dapat mengakses company lain lewat pertanyaan yang menyebut namanya · data yang memuat teks menyerupai instruksi tidak mengubah perilaku · aksi terlarang tidak muncul di katalog lewat jalur mana pun.

**Ketepatan.** Jawaban AI untuk metrik yang sama menghasilkan angka identik dengan laporan resmi · pertanyaan yang sama pada data yang sama menghasilkan kueri yang sama.

**Jejak.** Setiap jawaban yang diterbitkan punya jejak yang dapat dijalankan ulang dan menghasilkan angka yang sama · jawaban tanpa jejak tidak pernah lolos.

**Keterbatasan.** Pertanyaan di luar katalog menghasilkan pernyataan keterbatasan, bukan angka karangan · pertanyaan ambigu menghasilkan klarifikasi, bukan asumsi.

**Isolasi konteks.** Percakapan tentang satu company tidak memengaruhi jawaban setelah berpindah company.

**E2E.** Pertanyaan analitis sampai penelusuran ke faktur sumber · usulan aksi sampai konfirmasi dan tercatat di audit log dengan pelaku AI · ringkasan terjadwal untuk dua penerima dengan izin berbeda menghasilkan isi berbeda.

---

## 13. Future Enhancements

- **Metrik kustom lewat bahasa biasa**, yang tetap harus ditinjau dan disetujui sebelum masuk katalog.
- **Penjelasan anomali otomatis** — bukan hanya menandai yang tidak biasa, tetapi menelusuri penyebabnya lintas modul.
- **Simulasi skenario** — dampak menaikkan harga 5% terhadap margin dan volume, dihitung dari data historis.
- **AI dalam bahasa daerah** untuk pengguna di luar pusat kota.
- **Masukan suara** untuk pengguna lapangan dan gudang.
- **Agen dengan tugas berjangkauan lebih panjang** di Fase 5 — tetap dengan batas kewenangan yang sama, dan tetap dengan manusia yang memutuskan.
- **Katalog metrik bersama** antar tenant di industri yang sama, sebagai tolok ukur anonim.
- **Penjelasan untuk auditor** — mengapa sebuah angka berbeda dari periode lalu, dalam bentuk yang dapat dilampirkan.
