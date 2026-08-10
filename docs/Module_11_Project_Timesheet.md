# Module Design: Project & Timesheet
*Phase 3 — Operations. Modul yang membuat perusahaan jasa dapat memakai Business OS, bukan hanya perusahaan dagang.*

**Cakupan:** Proyek · Fase & Tugas · Timesheet · Anggaran · Biaya Proyek · Penagihan · Pengakuan Pendapatan · Perubahan Lingkup · Margin Proyek.
**Dependency:** Modul 01, 02, 03, 04 (Penjualan), 07 (Akuntansi), 10 (HRIS).

---

## 1. Business Problem

Perusahaan jasa dan kontraktor kehilangan uang di tempat yang tidak terlihat: **proyek yang menghasilkan pendapatan besar tetapi rugi**, dan tidak ada yang tahu sampai proyeknya selesai.

Tiga kegagalan model menyebabkannya. **Biaya karyawan tidak dibebankan ke proyek** — gaji masuk sebagai beban umum, sehingga proyek terlihat untung padahal tim menghabiskan tiga kali lipat waktu yang direncanakan. **Tarif biaya dan tarif tagih disamakan**, sehingga margin selalu nol atau selalu salah. **Pekerjaan yang sudah dilakukan tetapi belum ditagih tidak tercatat**, sehingga laporan keuangan tidak mencerminkan nilai yang sebenarnya sudah dihasilkan.

Untuk perusahaan yang menerima proyek berikutnya berdasarkan margin proyek sebelumnya, angka yang salah berarti keputusan yang salah — berulang kali.

---

## 2. Goals

- **Proyek adalah dimensi di buku besar, bukan buku besar terpisah.** Laba rugi proyek adalah GL yang difilter dimensi.
- **Tarif biaya dan tarif tagih adalah dua angka berbeda** yang tidak pernah tercampur.
- Pekerjaan yang sudah dilakukan tetapi belum ditagih tercatat sebagai aset, bukan tidak ada.
- Anggaran versus realisasi terlihat sepanjang proyek berjalan, bukan setelah selesai.
- Empat model penagihan didukung tanpa mesin terpisah untuk masing-masing.
- Timesheet yang disetujui menjadi biaya dan menjadi dasar tagihan dalam satu langkah.

---

## 3. User Stories

- Sebagai manajer proyek, saya ingin tahu margin proyek hari ini, bukan setelah proyek selesai.
- Sebagai konsultan, saya ingin mengisi timesheet mingguan dari ponsel dalam dua menit.
- Sebagai manajer proyek, saya ingin menyetujui timesheet tim sebelum masuk ke tagihan klien.
- Sebagai finance, saya ingin menagih berdasarkan jam yang sudah disetujui, tanpa mengetik ulang.
- Sebagai finance, saya ingin pekerjaan yang belum ditagih muncul di neraca sebagai aset.
- Sebagai pemilik, saya ingin tahu proyek mana yang melewati anggaran sebelum terlambat.
- Sebagai manajer proyek, saya ingin perubahan lingkup tercatat dan disetujui klien, bukan menjadi pekerjaan gratis.
- Sebagai karyawan, saya ingin waktu saya masuk ke proyek yang benar tanpa mencari-cari.

---

## 4. Functional Requirements

**Proyek.** Kode, pelanggan, model penagihan, nilai kontrak, tanggal mulai dan target selesai, manajer proyek, dan status. **Setiap proyek adalah nilai dimensi** di modul Akuntansi.

**Fase dan tugas.** Hierarki dua tingkat, dengan anggaran jam dan anggaran biaya per fase. Cukup untuk perencanaan dan pembebanan — bukan alat manajemen proyek penuh.

**Timesheet.** Entri per karyawan per hari per tugas, dengan penanda dapat ditagih atau tidak. Pengisian mingguan dengan penyalinan dari minggu sebelumnya. **Memerlukan persetujuan** sebelum menjadi biaya dan dasar tagihan.

**Dua tarif.** Tarif biaya berasal dari karyawan — dihitung dari total biaya karyawan di Modul 10, bukan dari gaji pokok saja. Tarif tagih berasal dari proyek, peran, atau karyawan, dengan urutan prioritas yang jelas.

**Biaya proyek non-tenaga.** Pembelian yang dibebankan ke proyek, reimbursement, dan pemakaian barang dari persediaan — semuanya membawa dimensi proyek.

**Anggaran.** Per proyek dan per fase, dalam jam dan dalam nilai. Peringatan saat realisasi melewati ambang persentase.

**Model penagihan.**

| Model | Cara menagih |
|---|---|
| Waktu dan bahan | Dari timesheet disetujui dan biaya yang dapat ditagih |
| Harga tetap | Sesuai jadwal termin, terlepas dari jam aktual |
| Milestone | Saat milestone diselesaikan dan diterima |
| Retainer | Nilai tetap berkala, dengan sisa jam yang dapat dipindahkan atau hangus |

**Perubahan lingkup.** Dokumen tersendiri dengan nilai tambahan, memerlukan persetujuan internal dan penerimaan klien. Nilai kontrak berubah hanya lewat jalur ini.

**Pengakuan pendapatan.** Metode per proyek. Menghasilkan pekerjaan dalam proses — pendapatan yang sudah dihasilkan tetapi belum ditagih sebagai aset, dan tagihan yang melebihi pekerjaan sebagai kewajiban.

**Laporan.** Margin per proyek dan per fase · anggaran versus realisasi · utilisasi karyawan · pekerjaan belum ditagih · profitabilitas per pelanggan.

---

## 5. Non Functional Requirements

- **Tidak ada buku besar proyek terpisah.** Seluruh angka proyek dibaca dari GL dengan filter dimensi, sehingga laba rugi proyek dan laba rugi perusahaan tidak akan pernah berbeda.
- Perhitungan margin proyek pada 500 proyek aktif selesai di bawah 2 detik.
- Timesheet berfungsi luring di ponsel dan tersinkron kemudian, karena konsultan lapangan sering tanpa koneksi.
- Tarif biaya karyawan **tidak pernah menampilkan gaji karyawan.** Ia angka turunan, dan orang yang melihat biaya proyek tidak dengan sendirinya berhak melihat gaji.
- Perubahan tarif berlaku ke depan, tidak mengubah entri waktu yang sudah disetujui.

---

## 6. Database Design

**Table: `projects`** — `company_id`, `code`, `name`, `customer_id`, `manager_id`, `billing_model`, `contract_value`, `currency`, `start_date`, `target_end_date`, `revenue_recognition_method`, `dimension_value_id`, `status` (draft, active, on_hold, completed, closed, cancelled), + audit baku.

`dimension_value_id` menautkan proyek ke nilai dimensi di Modul 07. Inilah yang membuat proyek menjadi dimensi GL, bukan sistem terpisah.

**Table: `project_phases`** — `project_id`, `code`, `name`, `budget_hours`, `budget_cost`, `budget_revenue`, `start_date`, `end_date`, `status`
**Table: `project_tasks`** — `phase_id`, `name`, `assignee_id`, `estimated_hours`, `billable_default`, `status`

**Table: `timesheet_entries`**

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| company_id, employee_id | UUID | |
| project_id, phase_id, task_id | UUID | |
| entry_date | date | |
| hours | numeric(5,2) | |
| billable | boolean | |
| description | text | |
| cost_rate, cost_amount | numeric | **dibekukan saat disetujui** |
| billing_rate, billing_amount | numeric | **dibekukan saat disetujui** |
| status | enum | draft, submitted, approved, rejected, billed |
| approved_by, approved_at | | |
| billed_document_id | UUID, nullable | |

Kedua tarif dan kedua nilai **disalin saat persetujuan**, bukan dirujuk. Perubahan tarif bulan depan tidak boleh mengubah biaya proyek bulan lalu — pola yang sama dengan kurs terkunci di Penjualan dan snapshot slip gaji di Payroll.

**Table: `billing_rates`** — `company_id`, `project_id` (nullable), `role_id` (nullable), `employee_id` (nullable), `rate`, `currency`, `valid_from`, `valid_to`, `specificity`

Pencarian mengambil `specificity` tertinggi yang cocok. Pola identik dengan penentuan akun dan penentuan pajak.

**Table: `employee_cost_rates`** — `employee_id`, `rate`, `valid_from`, `valid_to`, `basis` (calculated, manual)

Bila `calculated`, tarif diturunkan dari total biaya karyawan di Modul 10 dibagi jam kerja standar. **Nilai ini disimpan sebagai angka, bukan dihitung saat dibaca** — sehingga modul Proyek tidak pernah perlu akses ke data gaji.

**Table: `project_costs`** — biaya non-tenaga: `project_id`, `phase_id`, `source_type` (bill, expense, inventory_issue), `source_id`, `amount`, `billable`, `markup_pct`, `billed_document_id`

**Table: `change_orders`** — `project_id`, `number`, `description`, `value_change`, `hours_change`, `status` (draft, pending_internal, pending_client, accepted, rejected), `accepted_at`

**Table: `project_milestones`** — `project_id`, `name`, `amount`, `due_date`, `status` (pending, delivered, accepted, billed)

**Table: `revenue_recognition_entries`** — `project_id`, `period`, `method`, `percent_complete`, `recognized_revenue`, `billed_amount`, `wip_amount`, `deferred_amount`, `journal_id`

---

## 7. API Design

```
GET    /v1/companies/{id}/projects?status=&customer_id=&manager_id=
POST   /v1/companies/{id}/projects
GET    /v1/projects/{id}/summary                -> anggaran, realisasi, margin, WIP

GET    /v1/me/timesheets?week=
POST   /v1/me/timesheets                        -> entri massal per minggu
POST   /v1/me/timesheets/copy-previous-week
POST   /v1/timesheets/{id}/submit
POST   /v1/timesheets/approve                   -> massal, per proyek per minggu
POST   /v1/timesheets/{id}/reject               -> alasan wajib

POST   /v1/projects/{id}/costs                  -> pembebanan biaya non-tenaga
POST   /v1/projects/{id}/change-orders
POST   /v1/change-orders/{id}/accept

GET    /v1/projects/{id}/billable               -> yang siap ditagih, per jenis
POST   /v1/projects/{id}/bill                   -> membuat faktur di Modul 04
POST   /v1/milestones/{id}/deliver
POST   /v1/milestones/{id}/accept

POST   /v1/companies/{id}/revenue-recognition/run?period=
GET    /v1/companies/{id}/reports/project-margin?period=
GET    /v1/companies/{id}/reports/utilization?period=
GET    /v1/companies/{id}/reports/wip?as_of=
```

### Kontrak yang mengikat

**`/projects/{id}/bill` tidak membuat dokumen penagihan sendiri.** Ia memanggil Modul 04 untuk membuat faktur, dan menandai entri yang ditagih. Satu jenis dokumen faktur di seluruh produk, satu tempat perhitungan pajak, satu tempat penomoran.

**Tarif dibekukan saat persetujuan timesheet, bukan saat penagihan.** Waktu antara pekerjaan dilakukan dan tagihan diterbitkan bisa berminggu-minggu; tarif yang berubah di antaranya tidak boleh mengubah biaya yang sudah tercatat.

**`/projects/{id}/summary` membaca angka dari GL dengan filter dimensi**, bukan dari tabel ringkasan proyek. Tidak ada tempat kedua yang menyimpan angka keuangan proyek.

**Modul ini tidak pernah membaca tabel gaji.** Ia membaca `employee_cost_rates`, yang diisi Modul 10 sebagai angka turunan.

---

## 8. UI Flow

**Daftar proyek** — data table dengan kolom margin, persentase anggaran terpakai, dan status. Proyek yang melewati ambang anggaran ditandai.

**Ringkasan proyek** — kartu KPI: nilai kontrak, tertagih, belum ditagih, biaya, margin. Setiap kartu dapat ditelusuri ke transaksinya, sesuai Archetype 6.

**Timesheet mingguan** — grid dengan baris proyek dan kolom hari, penyalinan dari minggu lalu, dan total per hari yang terlihat. Dirancang agar selesai dalam dua menit, karena timesheet yang merepotkan akan diisi asal-asalan di akhir bulan.

**Persetujuan timesheet** — per proyek per minggu, dengan total jam dan nilai terlihat sebelum menyetujui. Persetujuan massal dengan pengecualian per baris.

**Penyiapan tagihan** — daftar yang siap ditagih dikelompokkan per jenis (jam, biaya, milestone), dapat dipilih sebagian, lalu menghasilkan draf faktur di Modul 04.

**Anggaran versus realisasi** — per fase, dengan proyeksi penyelesaian berdasarkan laju saat ini.

---

## 9. Business Flow

Proyek dibuat dari peluang atau pesanan yang menang → nilai dimensi dibuat di Akuntansi → fase dan anggaran ditetapkan → tim mengisi timesheet → manajer proyek menyetujui → **tarif biaya dan tarif tagih dibekukan** → biaya masuk ke GL dengan dimensi proyek.

Biaya non-tenaga: tagihan pembelian atau pemakaian barang yang membawa dimensi proyek otomatis masuk ke biaya proyek, tanpa input ulang.

Penagihan: sesuai model. Waktu dan bahan menagih dari entri yang disetujui; harga tetap menagih sesuai termin; milestone menagih saat diterima klien.

Akhir periode: pengakuan pendapatan dijalankan → persentase penyelesaian dihitung → pendapatan yang diakui dibandingkan dengan yang tertagih → selisihnya menjadi pekerjaan dalam proses atau pendapatan diterima di muka → jurnal diposting.

Perubahan lingkup: dokumen dibuat → disetujui internal → diterima klien → nilai kontrak berubah → anggaran disesuaikan.

---

## 10. Permission Matrix

| Aksi | Tenant Owner | Company Admin | Manajer Proyek | Finance | Karyawan |
|---|---|---|---|---|---|
| Lihat daftar proyek | ✅ | ✅ | ✅ | ✅ | ✅ (yang diikuti) |
| Buat dan ubah proyek | ✅ | ✅ | ✅ (milik sendiri) | ❌ | ❌ |
| **Lihat margin proyek** | ✅ | ✅ | ✅ (milik sendiri) | ✅ | ❌ |
| Isi timesheet sendiri | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Setujui timesheet** | ✅ | ✅ | ✅ (proyek sendiri) | ❌ | ❌ |
| Ubah tarif tagih | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ubah tarif biaya karyawan | ✅ | ❌ | ❌ | ❌ | ❌ |
| Terbitkan tagihan proyek | ✅ | ✅ | ❌ | ✅ | ❌ |
| Setujui perubahan lingkup | ✅ | ✅ | ❌ | ❌ | ❌ |
| Jalankan pengakuan pendapatan | ✅ | ✅ | ❌ | ✅ | ❌ |

**Karyawan tidak melihat margin proyek**, meski mengerjakannya. Margin memuat tarif biaya, yang meski bukan gaji, cukup dekat untuk disimpulkan.

**Manajer proyek tidak dapat menyetujui timesheet-nya sendiri**, dengan pola pemisahan tugas yang sama seperti modul lain.

**Yang menyetujui timesheet bukan yang menerbitkan tagihan.**

---

## 11. Validation Rules

- Entri waktu tidak dapat dibuat untuk proyek berstatus `completed` atau `closed`.
- Total jam per karyawan per hari tidak boleh melebihi batas yang dikonfigurasi tanpa persetujuan.
- Entri waktu tidak dapat diubah setelah disetujui; koreksi lewat entri penyesuaian bertanda.
- Entri yang sudah ditagih tidak dapat diubah maupun dihapus.
- Timesheet tidak dapat diisi untuk periode di masa depan melebihi hari berjalan.
- Nilai kontrak hanya berubah lewat perubahan lingkup yang diterima.
- Penagihan tidak boleh melebihi nilai kontrak untuk model harga tetap dan milestone, kecuali ada perubahan lingkup.
- Proyek tidak dapat ditutup bila masih ada timesheet belum disetujui atau biaya belum ditagih yang seharusnya ditagih.
- Tarif tagih wajib ada sebelum entri dapat ditandai dapat ditagih.

### Yang wajib divalidasi profesional

**Metode pengakuan pendapatan** yang berlaku untuk jenis kontrak masing-masing · **perlakuan pekerjaan dalam proses** dan pendapatan diterima di muka dalam laporan keuangan · **saat pengakuan pendapatan** untuk kontrak jangka panjang · **perlakuan pajak** atas termin yang ditagih sebelum pekerjaan selesai.

---

## 12. Testing Strategy

**Unit.** Pemilihan tarif tagih berdasarkan spesifisitas · perhitungan persentase penyelesaian untuk setiap metode · perhitungan pekerjaan dalam proses dan pendapatan diterima di muka.

**Invarian.** Jumlah biaya proyek dari timesheet dan biaya lain sama dengan saldo GL dengan filter dimensi proyek · nilai tertagih ditambah belum ditagih tidak melebihi nilai kontrak ditambah perubahan lingkup diterima · pendapatan diakui dikurangi tertagih sama dengan pekerjaan dalam proses dikurangi pendapatan diterima di muka.

**Pembekuan tarif.** Entri disetujui, tarif diubah, entri dihitung ulang: nilainya tidak berubah.

**Negatif.** Manajer proyek menyetujui timesheet-nya sendiri ditolak · karyawan mengakses margin proyek ditolak · penagihan melebihi kontrak tanpa perubahan lingkup ditolak · entri waktu ke proyek tertutup ditolak.

**E2E.** Proyek dari pembuatan sampai penutupan dengan keempat model penagihan · perubahan lingkup di tengah proyek · pengakuan pendapatan lintas tiga periode · timesheet luring lalu tersinkron.

---

## 13. Future Enhancements

- **Perencanaan sumber daya** — siapa dialokasikan ke proyek mana, dengan deteksi kelebihan beban.
- **Papan Gantt** untuk ketergantungan antar tugas.
- **Portal klien** — klien melihat progres, menyetujui milestone, dan melihat tagihan.
- **Proyek internal** untuk melacak biaya kegiatan non-tagih seperti riset dan pelatihan.
- **Perkiraan pendapatan** dari pipeline proyek, terhubung ke CRM.
- **Analisis utilisasi lanjutan** — jam tagih versus jam tersedia per orang dan per tim.
- **Templat proyek** dengan fase, tugas, dan anggaran standar per jenis pekerjaan.
- **Peringatan margin oleh AI** — proyek yang lajunya menunjukkan akan rugi sebelum setengah jalan.
