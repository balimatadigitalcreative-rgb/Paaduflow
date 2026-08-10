# Module Design: Workflow Automation
*Phase 3 — Operations. Modul terakhir Fase 3, dan satu-satunya tanpa domain bisnisnya sendiri.*

**Cakupan:** Pemicu · Kondisi · Aksi · Otomasi Terjadwal · Simulasi · Log Eksekusi · Pembatas · Webhook Keluar.
**Dependency:** Modul 01, 02 (IAM), 03 (Notification, Audit, Event).
**Menyentuh:** seluruh modul, lewat bus peristiwa — tidak pernah lewat akses langsung ke tabelnya.

---

## 1. Business Problem

Setiap perusahaan punya aturan kecil yang tidak layak menjadi fitur produk: beri tahu manajer bila ada faktur di atas nilai tertentu, tandai pelanggan yang tiga kali telat bayar, buatkan tugas tindak lanjut tujuh hari setelah pengiriman.

Tanpa modul ini, aturan seperti itu punya tiga nasib. **Ia menjadi permintaan fitur** yang mengantre berbulan-bulan dan menghasilkan produk yang penuh pengaturan khusus untuk satu pelanggan. **Ia menjadi pekerjaan manual** yang dikerjakan seseorang setiap pagi dan terlewat saat orang itu cuti. **Ia menjadi skrip di luar sistem** yang mengakses basis data langsung, tanpa izin, tanpa jejak audit, dan tanpa yang tahu saat ia rusak.

Masalah keempat muncul justru setelah modul ini ada: **otomasi yang terlalu berkuasa.** Sistem yang mengizinkan otomasi memposting jurnal atau menyetujui pengajuan berarti seluruh kontrol pemisahan tugas yang dibangun di tiga belas modul sebelumnya dapat dilewati oleh satu aturan yang dibuat orang yang tidak memahami akibatnya.

---

## 2. Goals

- Pengguna dapat membuat aturan tanpa pengembang, dan **tanpa dapat merusak apa pun**.
- **Otomasi berjalan sebagai pelaku mesin** dengan irisan izin pembuatnya — tidak pernah lebih.
- Batas kewenangan mesin sama persis dengan batas AI, dan berasal dari sumber yang sama di Modul 02.
- **Persetujuan bukan otomasi.** Ia fitur tersendiri, dan otomasi tidak dapat mengubah maupun melewatinya.
- Setiap eksekusi tercatat, dapat ditelusuri, dan dapat dijelaskan.
- Aturan dapat disimulasikan sebelum diaktifkan.
- Kegagalan tidak pernah senyap.

---

## 3. User Stories

- Sebagai pemilik, saya ingin diberi tahu bila ada faktur di atas Rp 500 juta, tanpa meminta fitur baru.
- Sebagai manajer penjualan, saya ingin tugas tindak lanjut otomatis muncul tujuh hari setelah penawaran dikirim.
- Sebagai finance, saya ingin pengingat penagihan terkirim otomatis pada hari ketiga setelah jatuh tempo.
- Sebagai admin, saya ingin menguji aturan pada data nyata sebelum mengaktifkannya.
- Sebagai admin, saya ingin tahu mengapa sebuah otomasi tidak berjalan kemarin.
- Sebagai Security Engineer, saya ingin yakin otomasi tidak dapat memposting jurnal atau menyetujui apa pun.
- Sebagai admin, saya ingin mematikan seluruh otomasi seketika bila ada yang salah.
- Sebagai pengembang integrasi, saya ingin sistem lain diberi tahu saat faktur diposting.

---

## 4. Functional Requirements

**Pemicu.** Tiga jenis: peristiwa dari modul (`invoice.posted`, `stock.below_reorder_point`), jadwal (harian, mingguan, tanggal tertentu), dan perubahan field pada entitas.

**Kondisi.** Ekspresi terhadap data peristiwa dan entitas terkait. Perbandingan, rentang, keanggotaan himpunan, dan gabungan AND/OR bertingkat — dengan kedalaman terbatas agar tetap dapat dibaca dan dievaluasi cepat.

**Aksi.** Daftar tertutup, bukan skrip bebas:

| Aksi | Catatan |
|---|---|
| Kirim notifikasi | Ke pengguna, peran, atau atasan pemilik entitas |
| Buat dokumen draf | **Selalu draf**, tidak pernah langsung terposting |
| Buat atau tetapkan tugas | Dengan tenggat dan penanggung jawab |
| Ubah field non-finansial | Prioritas, tag, penanggung jawab, kategori |
| Panggil webhook | Dengan penandatanganan dan percobaan ulang |
| Jadwalkan aksi lanjutan | Dengan penundaan |

**Daftar aksi tertutup adalah keputusan keamanan.** Skrip bebas berarti kemampuan yang tidak dapat diaudit sebelum dijalankan.

**Simulasi.** Menjalankan aturan terhadap data historis dan menampilkan apa yang **akan** terjadi, tanpa melakukannya. Wajib dijalankan sebelum aktivasi pertama.

**Versi.** Perubahan aturan menghasilkan versi baru. Eksekusi yang sedang berjalan menyelesaikan diri pada versinya sendiri.

**Log eksekusi.** Setiap eksekusi mencatat pemicu, data masukan, hasil evaluasi kondisi, aksi yang dijalankan, dan hasilnya. Ini yang membuat otomasi dapat dijelaskan, dan tanpanya ia menjadi kotak hitam yang ditakuti.

**Pembatas.** Batas aksi per eksekusi, batas eksekusi per jam per aturan, kedalaman rantai maksimal, dan deteksi lingkaran. Plus **saklar mati** per aturan dan per company.

**Kegagalan.** Percobaan ulang dengan jeda meningkat, lalu masuk antrean gagal dengan notifikasi ke pemilik aturan. **Tidak pernah gagal diam-diam.**

---

## 5. Non Functional Requirements

- Otomasi **tidak pernah memblokir jalur transaksi.** Ia berjalan asinkron setelah peristiwa diterbitkan; kegagalan otomasi tidak pernah menggagalkan transaksi bisnis.
- Evaluasi kondisi di bawah 50ms per aturan.
- Aturan berlaku pada company tempat ia dibuat; aturan tingkat tenant memerlukan izin terpisah.
- Aksi berjalan dengan **irisan** izin pembuat aturan dan izin yang dapat didelegasikan ke mesin, dievaluasi ulang saat eksekusi — bukan saat pembuatan.
- Bila pembuat aturan kehilangan izinnya, aturannya berhenti berjalan dan pemiliknya diberi tahu.
- Log eksekusi tersimpan minimal 90 hari, dan seluruh aksi juga tercatat di audit log dengan pelaku bertanda mesin.

---

## 6. Database Design

**Table: `automations`**

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| tenant_id, company_id | UUID | `company_id` null berarti tingkat tenant |
| name, description | varchar | |
| trigger_type | enum | event, schedule, field_change |
| trigger_config | jsonb | nama peristiwa, ekspresi jadwal, atau field |
| conditions | jsonb | pohon kondisi |
| status | enum | draft, simulated, active, paused, disabled |
| version | int | |
| owner_id | UUID | pemilik aturan; izinnya yang membatasi |
| max_executions_per_hour | int | |
| last_simulated_at | timestamp | |
| + audit baku | | |

Aturan tidak dapat diaktifkan bila `last_simulated_at` kosong. Simulasi bukan anjuran.

**Table: `automation_actions`** — `automation_id`, `sequence`, `action_type`, `config` jsonb, `delay_minutes`, `continue_on_error` (boolean)

**Table: `automation_versions`** — snapshot penuh definisi aturan per versi, sehingga eksekusi lama dapat dijelaskan dengan definisi yang berlaku saat itu.

**Table: `automation_executions`**

`automation_id` · `version` · `trigger_event_id` · `entity_type`, `entity_id` · `started_at`, `finished_at` · `condition_result` (boolean) · `condition_trace` jsonb · `status` (matched, skipped, succeeded, partial, failed) · `chain_depth` · `parent_execution_id`

`condition_trace` menyimpan hasil evaluasi tiap cabang kondisi. Inilah yang menjawab "kenapa aturan ini tidak jalan kemarin" tanpa menebak.

**Table: `automation_action_results`** — `execution_id`, `action_sequence`, `action_type`, `status`, `output` jsonb, `error`, `attempts`, `permission_denied` (boolean)

**Table: `webhook_endpoints`** — `company_id`, `url`, `secret_encrypted`, `events` jsonb, `status`, `failure_count`, `disabled_at`

Endpoint yang gagal berulang dinonaktifkan otomatis dengan notifikasi, agar tidak menjadi antrean yang menumpuk selamanya.

---

## 7. API Design

```
GET    /v1/companies/{id}/automations?status=&trigger=
POST   /v1/companies/{id}/automations           -> selalu dibuat sebagai draf
PATCH  /v1/automations/{id}                     -> menghasilkan versi baru
POST   /v1/automations/{id}/simulate            -> body: periode data historis
GET    /v1/automations/{id}/simulation/{runId}  -> apa yang akan terjadi, per entitas
POST   /v1/automations/{id}/activate            -> ditolak bila belum disimulasikan
POST   /v1/automations/{id}/pause
POST   /v1/companies/{id}/automations/kill-switch -> menghentikan seluruh aturan company

GET    /v1/automations/{id}/executions?status=&from=&to=
GET    /v1/executions/{id}                      -> jejak kondisi dan hasil tiap aksi
POST   /v1/executions/{id}/retry                -> hanya untuk yang gagal

GET    /v1/triggers                             -> katalog peristiwa yang tersedia
GET    /v1/actions                              -> katalog aksi dan izin yang dibutuhkannya

POST   /v1/companies/{id}/webhooks
POST   /v1/webhooks/{id}/test
```

### Kontrak yang mengikat

**`/activate` ditolak bila aturan belum pernah disimulasikan.** Aturan yang belum pernah diuji tidak boleh menyentuh data nyata.

**Izin dievaluasi saat eksekusi, bukan saat pembuatan.** Aturan yang dibuat manajer yang kemudian pindah jabatan berhenti berjalan, dan pemiliknya diberi tahu — bukan terus berjalan dengan izin yang sudah tidak dimiliki siapa pun.

**Aksi yang ditolak izin dicatat sebagai `permission_denied`, bukan sebagai kegagalan teknis.** Pembedaan ini penting saat mendiagnosis: satu berarti aturannya salah, satu lagi berarti sistemnya bermasalah.

**Otomasi tidak dapat memicu dirinya sendiri melebihi kedalaman rantai maksimal.** Eksekusi yang melewati batas dihentikan dan dicatat, tidak dibiarkan berjalan.

**Katalog aksi menyatakan izin yang dibutuhkan masing-masing**, sehingga pembuat aturan tahu sebelum menyimpan apakah aturannya akan dapat berjalan.

---

## 8. UI Flow

**Daftar otomasi** — dengan kolom status, jumlah eksekusi 24 jam terakhir, dan jumlah kegagalan. Aturan yang gagal berulang ditandai.

**Pembuat aturan** — tiga langkah: pemicu, kondisi, aksi. Kondisi dibangun dengan pemilih field dan operator, bukan diketik sebagai ekspresi. Setiap aksi menampilkan izin yang dibutuhkannya dan apakah pembuat memilikinya.

**Simulasi** — pilih rentang data historis, jalankan, lalu lihat daftar entitas yang **akan** terkena beserta aksi yang **akan** dijalankan. Ini layar yang mencegah sebagian besar kesalahan.

**Log eksekusi** — daftar dengan filter status. Membuka satu eksekusi menampilkan jejak kondisi per cabang: mana yang benar, mana yang salah, dan karena itu mengapa aturan berjalan atau tidak.

**Saklar mati** — tombol yang terlihat di halaman daftar, dengan konfirmasi yang menyebut berapa aturan akan dihentikan.

---

## 9. Business Flow

Aturan dibuat sebagai draf → disimulasikan terhadap data historis → hasil ditinjau → diaktifkan.

Saat berjalan: peristiwa diterbitkan modul → aturan yang cocok pemicunya diambil → kondisi dievaluasi dan jejaknya disimpan → bila cocok, aksi dijalankan berurutan sebagai pelaku mesin → izin diperiksa per aksi → hasil dicatat di log eksekusi dan di audit log.

Bila aksi gagal karena masalah teknis: percobaan ulang dengan jeda meningkat, lalu antrean gagal dan notifikasi ke pemilik.

Bila aksi gagal karena izin: dicatat, dihentikan, dan pemilik aturan diberi tahu bahwa aturannya tidak dapat berjalan lagi.

Bila rantai eksekusi melewati kedalaman maksimal atau batas laju: dihentikan, dicatat, dan aturan dijeda otomatis dengan notifikasi. Otomasi yang lepas kendali dihentikan sistem, bukan menunggu ditemukan orang.

---

## 10. Permission Matrix

| Aksi | Tenant Owner | Tenant Admin | Company Admin | Pengguna |
|---|---|---|---|---|
| Lihat daftar otomasi | ✅ | ✅ | ✅ | ✅ (milik sendiri) |
| Buat otomasi tingkat company | ✅ | ✅ | ✅ | ❌ |
| **Buat otomasi tingkat tenant** | ✅ | ✅ | ❌ | ❌ |
| Simulasikan | ✅ | ✅ | ✅ | ❌ |
| **Aktifkan otomasi** | ✅ | ✅ | ✅ | ❌ |
| Jeda dan nonaktifkan | ✅ | ✅ | ✅ | ❌ |
| **Saklar mati company** | ✅ | ✅ | ✅ | ❌ |
| Lihat log eksekusi | ✅ | ✅ | ✅ | ❌ |
| Kelola webhook | ✅ | ✅ | ✅ | ❌ |

**Otomasi tidak dapat mengubah izin, peran, maupun otomasi lain.** Tanpa batas ini, satu aturan dapat menaikkan izin pembuatnya dan seluruh model keamanan runtuh.

**Otomasi tidak dapat menghapus apa pun.** Penghapusan selalu keputusan manusia.

---

## 11. Validation Rules

- Aturan tidak dapat diaktifkan tanpa simulasi yang berhasil.
- Aksi yang memerlukan izin yang tidak dimiliki pemilik aturan ditolak saat penyimpanan, bukan saat eksekusi.
- Aksi yang izinnya bertanda tidak dapat didelegasikan ke mesin **tidak muncul di katalog aksi sama sekali**.
- Kedalaman kondisi bertingkat dibatasi; melewatinya ditolak dengan penjelasan.
- Jadwal tidak boleh lebih sering dari batas yang dikonfigurasi.
- Aturan yang gagal melebihi ambang dalam jendela waktu dijeda otomatis.
- Webhook wajib memakai HTTPS; endpoint yang gagal berulang dinonaktifkan otomatis.
- Aturan tidak dapat dihapus bila punya riwayat eksekusi; ia dinonaktifkan, agar log tetap dapat dijelaskan.
- Dokumen yang dibuat otomasi selalu berstatus draf, tanpa pengecualian.

---

## 12. Testing Strategy

**Unit.** Evaluasi pohon kondisi termasuk cabang bertingkat · perhitungan jadwal lintas zona waktu · deteksi lingkaran dan kedalaman rantai.

**Keamanan — yang terpenting di modul ini.** Otomasi tidak dapat memposting dokumen lewat jalur mana pun · tidak dapat menyetujui pengajuan · tidak dapat mengubah izin atau data gaji · tidak dapat menghapus · aksi berjalan dengan irisan izin, bukan izin penuh pemilik · pemilik kehilangan izin menghentikan aturannya.

**Ketahanan.** Aturan yang memicu dirinya sendiri berhenti di kedalaman maksimal · aturan yang berjalan 10.000 kali per jam dijeda otomatis · kegagalan otomasi tidak pernah menggagalkan transaksi bisnis yang memicunya.

**Simulasi.** Hasil simulasi sama dengan hasil eksekusi nyata pada data yang sama · simulasi tidak menghasilkan efek samping apa pun.

**Versi.** Aturan diubah saat ada eksekusi berjalan: eksekusi itu selesai pada versi lamanya · log eksekusi lama dapat dijelaskan dengan definisi versinya.

**E2E.** Aturan dibuat, disimulasikan, diaktifkan, dipicu, dan tercatat · aturan gagal lalu masuk antrean dan pemiliknya diberi tahu · saklar mati menghentikan seluruh aturan seketika.

---

## 13. Future Enhancements

- **Templat otomasi** siap pakai per industri, sehingga pengguna tidak memulai dari layar kosong.
- **Alur bercabang** dengan langkah bersyarat, bukan hanya daftar aksi berurutan.
- **Otomasi berbantuan AI** — pengguna menjelaskan aturannya dalam bahasa biasa, sistem menyusun draf aturan yang tetap harus disimulasikan dan disetujui manusia.
- **Webhook masuk** sebagai pemicu, untuk integrasi dua arah.
- **Analisis dampak** — aturan mana yang paling sering berjalan, dan mana yang tidak pernah cocok sejak dibuat.
- **Persetujuan untuk aturan berdampak luas** sebelum aktivasi, saat aturan menyentuh banyak entitas.
- **Otomasi lintas company** dalam satu tenant, dengan izin tersendiri.
- **Marketplace otomasi** di Fase 4, dengan aturan yang dibagikan antar tenant setelah ditinjau.
