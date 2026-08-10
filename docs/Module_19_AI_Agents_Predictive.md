# Module Design: AI Agents & Predictive Analytics
*Phase 5 — Enterprise. Dibangun di atas lapisan semantik dan batas kewenangan dari Modul 15.*

**Cakupan:** Agen Tugas · Rencana & Amplop Batas · Titik Henti · Log Eksekusi · Model Peramalan · Ketidakpastian · Penjelasan · Pengujian Mundur · Pemantauan Penurunan Mutu.
**Dependency:** Modul 02 (IAM), 03 (Audit), 14 (Otomasi), 15 (AI Assistant), 16 (BI), 17 (API).

---

## 1. Business Problem

Modul 15 menjawab pertanyaan. Modul ini mengerjakan tugas dan memperkirakan masa depan — dan keduanya membawa risiko yang berbeda jenis.

**Agen** berguna karena ia mengerjakan rangkaian panjang: menagih seluruh faktur jatuh tempo, merapikan data pelanggan ganda, menyiapkan berkas tutup bulan. Tetapi model persetujuan dari Modul 15 — konfirmasi per aksi — **tidak berfungsi untuk empat belas langkah.** Orang akan menyetujui tanpa membaca pada langkah keempat, dan setelah itu persetujuan berhenti bermakna.

**Peramalan** berguna karena keputusan bisnis selalu tentang masa depan. Tetapi angka ramalan yang ditampilkan tanpa ketidakpastiannya akan diperlakukan seperti fakta — dan keputusan yang diambil dari angka tunggal yang tampak pasti adalah cara paling halus untuk salah.

---

## 2. Goals

- **Persetujuan pindah dari per-aksi ke per-rencana**, tanpa mengurangi kendali manusia.
- Setiap agen berjalan di dalam **amplop batas** yang eksplisit dan tidak dapat dilampauinya.
- Batas izin **tidak berubah sama sekali** dari Modul 15: agen tetap tidak dapat memposting, menyetujui, membayar, atau menghapus.
- Setiap langkah agen dapat diperiksa kemudian: apa yang dilihatnya, apa yang diputuskannya, apa hasilnya.
- **Ramalan selalu membawa ketidakpastiannya**, dan tidak pernah masuk ke buku besar.
- Model diuji terhadap masa lalu sebelum dipublikasikan, dan dipantau setelahnya.

---

## 3. User Stories

- Sebagai finance, saya ingin memberi tugas "tagih seluruh faktur jatuh tempo" dan meninjau rencananya sebelum berjalan.
- Sebagai finance, saya ingin agen berhenti dan bertanya bila menemukan sesuatu yang tidak biasa.
- Sebagai admin, saya ingin tahu persis apa yang dikerjakan agen semalam, langkah demi langkah.
- Sebagai admin, saya ingin menghentikan agen yang sedang berjalan seketika.
- Sebagai pemilik, saya ingin proyeksi kas tiga bulan ke depan beserta seberapa yakin sistem terhadapnya.
- Sebagai pemilik, saya ingin tahu faktor apa yang membuat ramalan ini seperti ini.
- Sebagai akuntan, saya ingin yakin ramalan tidak pernah tercampur dengan angka pembukuan.
- Sebagai admin, saya ingin diberi tahu bila akurasi model menurun.

---

## 4. AI Agents

### 4.1 Rencana lebih dulu, bukan aksi satu per satu

Agen menerima tugas → menyusun rencana lengkap → **rencana ditampilkan seluruhnya** → manusia menyetujui, menolak, atau mengubahnya → eksekusi berjalan di dalam amplop yang disetujui.

Rencana menyebutkan: langkah apa, entitas mana yang akan disentuh, aksi apa yang akan dijalankan, dan di titik mana ia akan berhenti bertanya.

**Perubahan rencana di tengah jalan menghentikan agen dan meminta persetujuan ulang.** Agen yang menemukan bahwa rencananya tidak memadai tidak boleh menyusun rencana baru sendiri lalu melanjutkan.

### 4.2 Amplop batas

Ditetapkan saat persetujuan, tidak dapat dinaikkan agen:

| Batas | Contoh |
|---|---|
| Maksimal langkah | 20 |
| Maksimal waktu berjalan | 30 menit |
| Maksimal biaya | kuota token |
| Cakupan entitas | hanya faktur di company ini, jatuh tempo, di bawah nilai tertentu |
| Aksi yang dilarang | tetap mengikuti katalog Modul 15 |

Melewati batas menghentikan agen dan memberi tahu pemiliknya. **Agen tidak pernah meminta perpanjangan sendiri.**

### 4.3 Titik henti

Ditandai di rencana: sebelum aksi yang tidak dapat diurungkan, saat menemukan hal di luar dugaan, dan pada ambang jumlah entitas yang terpengaruh.

Agen berhenti, menyajikan apa yang ditemukannya, dan menunggu. Berhenti bukan kegagalan — ia perilaku yang dirancang.

### 4.4 Log eksekusi

Per langkah: masukan yang dibaca, kueri semantik yang dijalankan, keputusan yang diambil, aksi yang dijalankan, dan hasilnya. Sama polanya dengan `condition_trace` di Modul 14 — **agen yang tidak dapat dijelaskan akan dimatikan orang, cepat atau lambat.**

### 4.5 Batas yang tidak berubah

Izin dievaluasi **di setiap langkah**, bukan sekali di awal. Pemilik yang kehilangan izin di tengah jalan menghentikan agennya.

Agen **tidak dapat**: membuat atau mengubah agen lain, membuat atau mengubah aturan otomasi, mengubah izin, mengubah amplopnya sendiri, atau menjalankan aksi di luar katalog Modul 15.

---

## 5. Predictive Analytics

### 5.1 Ramalan bukan catatan

**Angka ramalan tidak pernah masuk ke buku besar, tidak pernah menjadi dasar dokumen, dan selalu ditandai berbeda secara visual** dari angka aktual. Pembedaan ini mutlak: pembukuan mencatat apa yang terjadi, ramalan menduga apa yang mungkin terjadi.

### 5.2 Selalu dengan ketidakpastian

Setiap ramalan menyajikan rentang, bukan satu angka. Rentang yang lebar dinyatakan apa adanya — **model yang tidak yakin harus terlihat tidak yakin.**

Bila data historis tidak cukup untuk meramal dengan wajar, sistem mengatakannya dan tidak menampilkan angka.

### 5.3 Selalu dapat dijelaskan

Setiap ramalan menyebutkan faktor pendorong utamanya beserta arah pengaruhnya, dengan tautan ke data historis yang mendasarinya. Ramalan tanpa penjelasan tidak dapat dipakai untuk keputusan, dan tidak dapat diperdebatkan — padahal diperdebatkan adalah cara ia menjadi berguna.

### 5.4 Diuji terhadap masa lalu sebelum dipublikasikan

Model dijalankan terhadap data historis dan hasilnya dibandingkan dengan kenyataan. **Akurasi ditampilkan ke pengguna**, bukan disimpan tim data. Model yang tidak lolos ambang akurasi tidak dipublikasikan.

### 5.5 Dipantau setelah dipublikasikan

Akurasi dilacak berjalan. Model yang menurun melewati ambang **ditarik otomatis** dan digantikan penanda bahwa ramalan untuk area itu sedang tidak tersedia — bukan dibiarkan menampilkan angka yang sudah tidak dapat dipercaya.

### 5.6 Data siapa yang melatih apa

Ini perlu dinyatakan tegas, karena tampak bertentangan dengan Modul 15.

**Modul 15 menyatakan data tenant tidak dipakai melatih model bahasa.** Itu tetap berlaku.

**Model peramalan statistik dilatih dari data tenant itu sendiri, untuk tenant itu sendiri.** Ini bukan pengecualian — ia hal yang berbeda: perhitungan atas data pelanggan untuk kepentingan pelanggan itu, tidak keluar dari batas tenant, dan tidak memperbaiki apa pun bagi tenant lain.

**Model gabungan lintas tenant** — misalnya tolok ukur industri — hanya dengan **persetujuan eksplisit**, dengan anonimisasi dan ambang jumlah peserta minimum agar satu tenant tidak dapat disimpulkan.

### 5.7 Kasus pemakaian awal

Proyeksi arus kas · peramalan permintaan per barang dan per outlet · risiko keterlambatan bayar per pelanggan · risiko kehabisan stok · deteksi anomali margin · perkiraan penyelesaian proyek.

---

## 6. Database Design

**Table: `agent_definitions`** — `company_id`, `name`, `task_template`, `default_envelope` jsonb, `allowed_actions` jsonb, `owner_id`, `status`

**Table: `agent_runs`**

`agent_id` · `triggered_by` · `task_input` · `plan` jsonb · `plan_approved_by`, `plan_approved_at` · `envelope` jsonb · `status` (planning, awaiting_approval, running, paused, completed, stopped, failed) · `steps_used`, `time_used_ms`, `cost_used` · `stopped_reason`

`plan` dan `envelope` disimpan sebagai snapshot pada saat persetujuan — bukan dirujuk. Rencana yang disetujui itulah yang berlaku, bukan definisi agen yang mungkin berubah kemudian.

**Table: `agent_steps`** — `run_id`, `sequence`, `intent`, `queries_executed` jsonb, `decision`, `action_type`, `action_payload` jsonb, `result`, `permission_check` jsonb, `checkpoint` (boolean), `duration_ms`

**Table: `agent_checkpoints`** — `run_id`, `step_sequence`, `question`, `context` jsonb, `answered_by`, `answer`, `answered_at`

**Table: `forecast_models`** — `company_id`, `type`, `target_metric`, `algorithm`, `trained_at`, `training_window`, `backtest_accuracy` jsonb, `status` (training, backtesting, published, degraded, retired), `retired_reason`

**Table: `forecasts`** — `model_id`, `entity_type`, `entity_id`, `horizon`, `period`, `point_estimate`, `lower_bound`, `upper_bound`, `confidence_level`, `drivers` jsonb, `generated_at`

`lower_bound` dan `upper_bound` **tidak boleh null.** Ramalan tanpa rentang tidak dapat disimpan.

**Table: `forecast_accuracy`** — `model_id`, `period`, `predicted`, `actual`, `error`, `within_bounds` (boolean)

Tabel ini yang menjalankan pemantauan penurunan mutu, dan yang membuat akurasi dapat ditampilkan ke pengguna.

---

## 7. API Design

```
POST   /v1/companies/{id}/agent-runs            -> tugas, agen menyusun rencana
GET    /v1/agent-runs/{id}/plan                 -> rencana lengkap sebelum persetujuan
POST   /v1/agent-runs/{id}/approve              -> body: envelope, penyesuaian rencana
POST   /v1/agent-runs/{id}/reject
POST   /v1/agent-runs/{id}/stop                 -> berlaku seketika
GET    /v1/agent-runs/{id}/steps                -> log per langkah
POST   /v1/agent-checkpoints/{id}/answer

GET    /v1/companies/{id}/forecasts?type=&entity=&horizon=
GET    /v1/forecasts/{id}/explain               -> faktor pendorong dengan tautan data
GET    /v1/companies/{id}/forecast-models
GET    /v1/forecast-models/{id}/accuracy        -> hasil uji mundur dan akurasi berjalan
POST   /v1/companies/{id}/benchmarks/opt-in     -> persetujuan eksplisit, dapat dicabut
```

### Kontrak yang mengikat

**Agen tidak dapat berjalan tanpa rencana yang disetujui.** Tidak ada mode langsung jalan.

**`/stop` berlaku seketika**, termasuk saat agen sedang di tengah langkah. Langkah yang belum selesai dibatalkan; yang sudah selesai tetap tercatat.

**Izin diperiksa di setiap langkah**, dan hasilnya disimpan di `permission_check` — sehingga pertanyaan "kenapa agen boleh melakukan itu" dapat dijawab kemudian.

**Ramalan tanpa `lower_bound` dan `upper_bound` ditolak di tingkat basis data.**

**Endpoint ramalan tidak pernah dipanggil modul transaksional.** Tidak ada jalur yang memungkinkan angka ramalan menjadi nilai dokumen.

---

## 8. UI Flow

**Pemberian tugas** — bahasa biasa, dengan contoh tugas yang tersedia agar pengguna tahu batas kemampuannya.

**Peninjauan rencana** — daftar langkah bernomor, entitas yang terpengaruh dengan jumlahnya, titik henti ditandai, dan amplop yang dapat disesuaikan sebelum menyetujui. **Ini layar terpenting di modul ini** — di sinilah kendali manusia benar-benar terjadi.

**Pemantauan berjalan** — progres langkah, waktu dan biaya terpakai terhadap amplop, tombol henti yang selalu terlihat.

**Titik henti** — agen menyajikan temuan dan pertanyaannya, dengan konteks yang cukup untuk memutuskan tanpa membuka layar lain.

**Log eksekusi** — dapat dibaca kemudian, per langkah, dengan kueri dan keputusan yang terlihat.

**Ramalan** — selalu digambar sebagai rentang, dengan garis aktual dan area ketidakpastian yang jelas berbeda. Angka ramalan memakai gaya visual berbeda dari angka aktual di seluruh produk.

**Penjelasan** — faktor pendorong dengan arah dan besarnya, dapat ditelusuri ke data.

**Akurasi model** — ditampilkan di samping ramalannya, bukan disembunyikan. Pengguna berhak tahu seberapa sering model ini benar.

---

## 9. Permission Matrix

| Aksi | Tenant Owner | Company Admin | Manajer | Pengguna |
|---|---|---|---|---|
| Menjalankan agen | ✅ | ✅ | ✅ | ❌ |
| **Menyetujui rencana** | ✅ | ✅ | ✅ (dalam izinnya) | ❌ |
| Menaikkan amplop di atas bawaan | ✅ | ✅ | ❌ | ❌ |
| Menghentikan agen | ✅ | ✅ | ✅ (miliknya) | ❌ |
| Melihat log eksekusi | ✅ | ✅ | ✅ (miliknya) | ❌ |
| Mendefinisikan agen baru | ✅ | ✅ | ❌ | ❌ |
| Melihat ramalan | ✅ | ✅ | ✅ | ✅ (dalam izin datanya) |
| Melatih dan publikasi model | ✅ | ✅ | ❌ | ❌ |
| **Ikut serta tolok ukur lintas tenant** | ✅ | ❌ | ❌ | ❌ |

**Agen berjalan dengan irisan izin pemiliknya dan katalog aksi mesin.** Menyetujui rencana tidak menaikkan izin — ia hanya mengizinkan menjalankan apa yang memang sudah boleh.

---

## 10. Validation Rules

- Agen tidak dapat berjalan tanpa rencana yang disetujui manusia.
- Amplop tidak dapat dinaikkan oleh agen, dalam kondisi apa pun.
- Rencana yang berubah di tengah jalan menghentikan eksekusi dan meminta persetujuan ulang.
- Aksi di luar katalog Modul 15 tidak muncul di rencana, dan ditolak bila muncul.
- Izin diperiksa per langkah; pemilik kehilangan izin menghentikan agen.
- Ramalan tanpa rentang ditolak.
- Model tanpa hasil uji mundur tidak dapat dipublikasikan.
- Model dengan akurasi di bawah ambang ditarik otomatis.
- Angka ramalan tidak dapat dipakai sebagai nilai di dokumen transaksional mana pun.
- Tolok ukur lintas tenant memerlukan persetujuan eksplisit dan jumlah peserta minimum.

---

## 11. Testing Strategy

**Keamanan agen — yang terpenting di modul ini.** Agen tidak dapat memposting, menyetujui, membayar, atau menghapus lewat jalur mana pun · tidak dapat mengubah amplopnya, agen lain, aturan otomasi, maupun izin · pencabutan izin pemilik menghentikan agen yang sedang berjalan · perintah henti berlaku seketika.

**Amplop.** Agen yang mencoba melewati batas langkah, waktu, biaya, atau cakupan dihentikan dan dicatat, bukan dibiarkan.

**Rencana.** Rencana yang disetujui adalah yang dijalankan; perubahan definisi agen setelah persetujuan tidak memengaruhi eksekusi berjalan.

**Ramalan.** Ramalan tanpa rentang ditolak · model tanpa uji mundur tidak terpublikasi · penurunan akurasi memicu penarikan · angka ramalan tidak dapat masuk ke dokumen transaksional lewat endpoint mana pun.

**Reproduksibilitas.** Menjalankan ulang ramalan pada data historis yang sama menghasilkan angka yang sama.

**E2E.** Tugas diberikan sampai selesai dengan dua titik henti dijawab manusia · agen dihentikan di tengah jalan dan lognya tetap utuh · model dilatih, diuji mundur, dipublikasikan, menurun, dan ditarik.

---

## 12. Future Enhancements

- **Agen terjadwal** yang menjalankan tugas berulang dengan rencana yang sudah disetujui sebelumnya, dan meminta persetujuan ulang bila rencananya berbeda dari biasanya.
- **Agen yang belajar dari koreksi** — bukan melatih model, melainkan menyimpan preferensi keputusan tenant sebagai konteks.
- **Simulasi agen** yang menjalankan rencana penuh tanpa efek samping, seperti simulasi otomasi di Modul 14.
- **Ramalan berbasis skenario** — dampak menaikkan harga, menambah cabang, atau kehilangan pelanggan besar.
- **Ramalan multi-company** untuk grup usaha, dengan penjabaran mata uang.
- **Peringatan dini** yang memicu aturan otomasi saat ramalan melewati ambang.
- **Penjelasan naratif** untuk ramalan, memakai AI dari Modul 15 dengan jejak yang sama.
- **Tolok ukur industri** yang benar-benar berguna: bukan rata-rata, melainkan sebaran dan posisi relatif.
