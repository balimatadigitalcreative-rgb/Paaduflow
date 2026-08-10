# Module Design: HRIS & Payroll
*Phase 3 — Operations. Modul pertama yang membawa data lebih sensitif daripada seluruh modul sebelumnya.*

**Cakupan:** Karyawan · Struktur Organisasi · Kehadiran · Cuti · Lembur · Komponen Gaji · Perhitungan Penggajian · Slip Gaji · Pelaporan Ketenagakerjaan.
**Dependency:** Modul 01, 02, 03, 07 (Akuntansi), 08 (Pajak).
**Menyusul di modul terpisah:** Rekrutmen dan Penilaian Kinerja.

> **Peringatan yang berlaku untuk seluruh dokumen ini.** Modul ini menyentuh regulasi ketenagakerjaan dan perpajakan Indonesia. Dokumen ini merancang **sistem yang dapat dikonfigurasi**, bukan menetapkan aturannya. Setiap tarif, batas, formula, dan tenggat wajib ditetapkan konsultan pajak dan ahli ketenagakerjaan, lalu dimasukkan sebagai konfigurasi bertanggal berlaku.

---

## 1. Business Problem

Penggajian punya sifat yang tidak dimiliki modul lain: **ia salah di depan orang.** Kesalahan faktur ditemukan akuntan; kesalahan slip gaji ditemukan oleh orang yang gajinya salah, dan kepercayaan yang hilang tidak pulih dengan koreksi bulan berikutnya.

Tiga kegagalan model muncul berulang. **Formula dan tarif ditulis di kode**, sehingga setiap perubahan regulasi — yang di Indonesia terjadi cukup sering — memerlukan rilis, dan penggajian bulan lalu ikut berubah bila dihitung ulang. **Saldo cuti disimpan sebagai angka yang di-*update***, sehingga saat karyawan protes tidak ada cara menelusuri dari mana angkanya. **Data gaji dapat dilihat siapa pun yang punya akses admin**, padahal ia data paling sensitif di seluruh sistem — dan kebocorannya merusak hubungan kerja secara permanen.

---

## 2. Goals

- **Karyawan dan pengguna adalah dua hal berbeda**, dan modul ini tidak mengasumsikan keduanya sama.
- Seluruh komponen gaji, tarif, dan formula adalah **konfigurasi bertanggal berlaku**.
- Penggajian yang sudah diposting membeku sebagai snapshot; koreksi lewat siklus tersendiri.
- **Saldo cuti adalah buku besar, bukan angka** — pola yang sama dengan stok dan jurnal.
- Kontribusi pemberi kerja dan potongan pekerja tidak pernah tercampur.
- **Akses data gaji lebih ketat daripada seluruh modul lain**, termasuk lebih ketat daripada Company Admin.
- Penggajian memposting ke Akuntansi lewat penentuan akun, tanpa menyebut nomor akun.

---

## 3. User Stories

- Sebagai HR, saya ingin mencatat karyawan pabrik yang tidak pernah memakai aplikasi ini.
- Sebagai karyawan, saya ingin mengajukan cuti dari ponsel dan tahu sisa saldo saya beserta asal-usulnya.
- Sebagai karyawan, saya ingin melihat slip gaji saya sendiri dan tidak ada yang lain.
- Sebagai HR, saya ingin menjalankan penggajian dan meninjau hasilnya sebelum apa pun dibayarkan.
- Sebagai HR, saya ingin regulasi berubah tanpa penggajian bulan lalu ikut berubah.
- Sebagai atasan, saya ingin menyetujui cuti tim saya tanpa melihat gaji mereka.
- Sebagai pemilik, saya ingin tahu total biaya karyawan termasuk kontribusi perusahaan, bukan hanya gaji yang dibayarkan.
- Sebagai akuntan, saya ingin jurnal penggajian terbentuk otomatis dan cocok dengan yang dibayarkan.

---

## 4. Functional Requirements

**Karyawan.** Data pribadi, data kepegawaian, kontrak dan masa berlakunya, penempatan, jabatan, atasan, dan riwayat perubahan. **Dapat ada tanpa akun pengguna**; bila ada, keduanya ditautkan tetapi tetap terpisah.

**Struktur organisasi.** Hierarki jabatan dan atasan, dengan tanggal berlaku sehingga struktur historis dapat dibaca.

**Kehadiran.** Sumber: absen mandiri lewat ponsel dengan lokasi, mesin absensi, atau input manual. Periode kehadiran dapat berbeda dari bulan kalender. Menghasilkan data lembur, keterlambatan, dan ketidakhadiran.

**Cuti.** Jenis cuti dapat dikonfigurasi. **Saldo berupa buku besar**: akrual, pemakaian, penyesuaian, pemindahan sisa, dan kedaluwarsa — masing-masing sebagai baris tersendiri.

**Komponen gaji.** Setiap komponen membawa jenis (pendapatan atau potongan), formula, tanggal berlaku, penanda kena pajak, penanda menjadi dasar jaminan sosial, dan akun tujuan. Komponen bersifat data, bukan kode.

**Siklus penggajian.** Draf → hitung → tinjau → setujui → posting → bayar. Hasil perhitungan dapat ditinjau per karyawan sebelum apa pun dibayarkan. **Setelah posting, slip membeku.**

**Siklus luar jadwal.** Untuk koreksi, tunjangan hari raya, bonus, dan pesangon — terpisah dari siklus reguler agar tidak mengubah snapshot yang sudah diposting.

**Slip gaji.** Dapat diakses karyawan sendiri, menampilkan komponen pendapatan, potongan, dan **kontribusi pemberi kerja secara terpisah dan jelas**.

**Pelaporan.** Data yang dibutuhkan untuk pelaporan pajak penghasilan karyawan dan jaminan sosial, diserahkan ke modul Pajak dan diekspor dalam format yang diperlukan.

---

## 5. Non Functional Requirements

- **Perhitungan dapat direproduksi.** Menghitung ulang penggajian bulan lalu menghasilkan angka yang sama persis, karena tarif diambil dari tanggal periode, bukan tanggal hari ini.
- Penggajian 5.000 karyawan selesai di bawah 2 menit, dan dapat dijalankan ulang tanpa efek samping sebelum diposting.
- **Data gaji terenkripsi saat diam**, dan setiap akses ke data gaji tercatat di audit log — termasuk akses baca.
- Slip gaji hanya dapat diakses pemiliknya dan peran yang secara eksplisit berwenang.
- Saldo cuti dihitung dari buku besar; proyeksi saldo dapat dibangun ulang sepenuhnya.
- Posting penggajian bersifat atomik: slip, jurnal, dan kewajiban pajak berhasil bersama atau gagal bersama.

---

## 6. Database Design

**Table: `employees`** — `company_id`, `employee_no`, `user_id` (nullable), `full_name`, `national_id`, `tax_id`, `social_security_ids` jsonb, `birth_date`, `hire_date`, `termination_date`, `status`, `department_id`, `position_id`, `manager_id`, `tax_status` (status keluarga untuk perhitungan pajak), + audit baku.

`user_id` nullable adalah inti keputusan ini. Karyawan pabrik yang tidak pernah membuka aplikasi tetap tercatat penuh.

**Table: `employee_contracts`** — `employee_id`, `type`, `start_date`, `end_date`, `base_salary`, `terms` jsonb, `status`. Perubahan gaji adalah kontrak baru, bukan pengubahan angka.

**Table: `attendance_records`** — `employee_id`, `date`, `check_in`, `check_out`, `source` (mobile, device, manual), `location` jsonb, `status` (present, late, absent, leave, holiday), `overtime_minutes`, `approved_by`

**Table: `leave_types`** — `company_id`, `code`, `name`, `accrual_rule` jsonb, `max_carry_over`, `expires_after_months`, `requires_approval`, `paid`

**Table: `leave_ledger`** — **append-only**

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| employee_id, leave_type_id | UUID | |
| entry_type | enum | accrual, usage, adjustment, carry_over, expiry |
| days | numeric(6,2) | positif menambah, negatif mengurangi |
| effective_date | date | |
| source_type, source_id | | pengajuan cuti pemicu |
| reason | text | wajib untuk `adjustment` |

Saldo cuti tidak pernah disimpan sebagai kolom. Ia dijumlahkan dari buku ini, dengan proyeksi untuk performa.

**Table: `leave_requests`** — `employee_id`, `leave_type_id`, `start_date`, `end_date`, `days`, `reason`, `lifecycle_status`, `approved_by`

**Table: `payroll_components`**

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| company_id | UUID | |
| code, name | varchar | |
| type | enum | earning, deduction, employer_contribution |
| formula | jsonb | referensi komponen lain, tarif, batas |
| valid_from, valid_to | date | **bertanggal berlaku** |
| is_taxable | boolean | |
| is_social_security_base | boolean | |
| gl_account_id | UUID | |
| sequence | int | urutan perhitungan |

`type = employer_contribution` adalah yang membuat kontribusi perusahaan tidak pernah tercampur dengan potongan pekerja.

**Table: `payroll_runs`** — `company_id`, `period`, `type` (regular, off_cycle), `status` (draft, calculated, reviewed, approved, posted, paid), `employee_count`, `total_gross`, `total_net`, `total_employer_cost`, `snapshot` jsonb

**Table: `payslips`** — `run_id`, `employee_id`, `gross`, `total_deductions`, `net`, `employer_cost`, `snapshot` jsonb

`snapshot` menyimpan slip sebagaimana diposting. **Ia tidak pernah dihitung ulang** dari komponen — pola yang sama dengan laporan pajak di Modul 08.

**Table: `payslip_lines`** — `payslip_id`, `component_id`, `component_code`, `component_name`, `amount`, `type`

Kode dan nama komponen disalin, bukan hanya dirujuk, sehingga slip lama tetap terbaca meski komponennya kemudian diubah namanya.

---

## 7. API Design

```
GET    /v1/companies/{id}/employees?q=&department=&status=
POST   /v1/companies/{id}/employees
POST   /v1/employees/{id}/contracts             -> perubahan gaji = kontrak baru

POST   /v1/companies/{id}/attendance/import     -> dari mesin absensi
POST   /v1/me/attendance/check-in               -> absen mandiri, dengan lokasi
GET    /v1/employees/{id}/attendance?period=

GET    /v1/me/leave-balance                     -> saldo per jenis, dengan rincian asal
GET    /v1/employees/{id}/leave-ledger          -> buku besar cuti
POST   /v1/me/leave-requests
POST   /v1/leave-requests/{id}/approve
POST   /v1/companies/{id}/leave-accruals/run    -> akrual periodik

GET    /v1/companies/{id}/payroll-components?as_of=
POST   /v1/companies/{id}/payroll-components    -> perubahan = versi baru

POST   /v1/companies/{id}/payroll-runs
POST   /v1/payroll-runs/{id}/calculate          -> dapat dijalankan ulang selama draf
GET    /v1/payroll-runs/{id}/review             -> per karyawan, dengan perbandingan periode lalu
POST   /v1/payroll-runs/{id}/approve
POST   /v1/payroll-runs/{id}/post               -> membekukan slip, memposting jurnal
POST   /v1/payroll-runs/{id}/mark-paid

GET    /v1/me/payslips                          -> hanya milik sendiri
GET    /v1/payslips/{id}                        -> pemeriksaan akses ketat
GET    /v1/companies/{id}/reports/employee-cost?period=
```

### Kontrak yang mengikat

**`/calculate` dapat dijalankan berulang selama status masih draf**, dan setiap kali membuang hasil sebelumnya. Ini penting: HR akan menemukan kesalahan data saat meninjau, memperbaikinya, dan menghitung ulang.

**`/post` membekukan snapshot.** Setelah itu, mengubah komponen gaji tidak mengubah slip yang sudah terbit. Koreksi memerlukan siklus luar jadwal.

**`GET /payslips/{id}` memeriksa akses pada tingkat data, bukan hanya tingkat aksi.** Memiliki izin "lihat slip gaji" tidak berarti dapat melihat slip siapa pun — lihat §10.

**Modul ini tidak pernah mengirim nomor akun ke Akuntansi.** Komponen membawa `gl_account_id` sebagai konfigurasi, dan posting tetap melalui penentuan akun.

---

## 8. UI Flow

**Direktori karyawan** — data table dengan filter departemen dan status. Kolom gaji **tidak muncul** kecuali pengguna berwenang.

**Profil karyawan** — tab: Pribadi · Kepegawaian · Kehadiran · Cuti · Gaji. Tab Gaji tersembunyi bagi yang tidak berwenang, bukan ditampilkan kosong.

**Pengajuan cuti** — mode ponsel, saldo terlihat sebelum mengajukan, dan **rincian asal saldo dapat dibuka** sehingga karyawan dapat menelusuri sendiri.

**Persetujuan cuti** — daftar kerja atasan, menampilkan kalender tim agar tumpang tindih terlihat.

**Siklus penggajian** — wizard: pilih periode → hitung → **layar peninjauan dengan perbandingan terhadap periode lalu per karyawan**, selisih besar ditandai → setujui → posting.

Layar peninjauan itu yang mencegah sebagian besar kesalahan. Karyawan yang gajinya tiba-tiba naik dua kali lipat karena salah input lembur akan terlihat sebagai baris bertanda, bukan sebagai kejutan di hari gajian.

**Slip gaji** — pendapatan, potongan, dan kontribusi pemberi kerja dalam tiga blok terpisah dengan label jelas.

---

## 9. Business Flow

Karyawan direkam → kontrak dibuat → kehadiran terkumpul sepanjang periode → cuti diajukan, disetujui, dan tercatat di buku besar cuti → periode penggajian ditutup → siklus dibuat.

Perhitungan: komponen dievaluasi berurutan sesuai `sequence` → penghasilan bruto terbentuk → dasar jaminan sosial dan dasar pajak dihitung dari penanda komponen → potongan wajib dihitung → potongan lain diterapkan → penghasilan neto terbentuk. **Kontribusi pemberi kerja dihitung di jalur terpisah** dan tidak pernah mengurangi neto.

Tinjau → setujui → posting: slip membeku, jurnal terbentuk (beban gaji, beban kontribusi perusahaan, utang pajak, utang jaminan sosial, utang gaji), kewajiban pajak diserahkan ke modul Pajak → pembayaran dilakukan → utang gaji dilunasi.

Bila ditemukan kesalahan setelah posting: **slip tidak pernah diedit.** Siklus luar jadwal dibuat dengan koreksi, dan karyawan menerima slip tambahan yang menjelaskan penyesuaiannya.

---

## 10. Permission Matrix

Modul ini **memerlukan perluasan model izin Modul 02**. RBAC tingkat aksi tidak cukup, karena pertanyaannya bukan "boleh melihat slip gaji?" melainkan "boleh melihat slip gaji **siapa**?".

| Aksi | Tenant Owner | Company Admin | HR Manager | HR Staff | Atasan | Karyawan |
|---|---|---|---|---|---|---|
| Lihat data karyawan non-gaji | ✅ | ✅ | ✅ | ✅ | ✅ (tim sendiri) | ✅ (sendiri) |
| **Lihat data gaji** | ⚠️ | ⚠️ | ✅ | ⚠️ | ❌ | ✅ (sendiri) |
| Ubah kontrak dan gaji | ⚠️ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Setujui cuti | ✅ | ✅ | ✅ | ❌ | ✅ (tim sendiri) | ❌ |
| Sesuaikan saldo cuti | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ubah komponen gaji | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Jalankan perhitungan | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Setujui dan posting penggajian** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Lihat total biaya karyawan agregat | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

⚠️ berarti **memerlukan pemberian eksplisit, tidak melekat pada peran.** Company Admin secara bawaan tidak melihat gaji siapa pun. Ini menyimpang dari pola modul lain, dan penyimpangannya disengaja: di sebagian besar perusahaan, orang yang mengelola sistem bukan orang yang berhak tahu gaji rekan kerjanya.

**Atasan dapat menyetujui cuti tanpa melihat gaji.** Dua kewenangan berbeda yang sering digabung dan seharusnya tidak.

**Setiap akses baca ke data gaji tercatat di audit log** — satu-satunya tempat di produk ini di mana membaca dicatat, bukan hanya mengubah.

---

## 11. Validation Rules

- Karyawan tidak dapat dihapus; hanya diberi tanggal berakhir. Data penggajiannya tetap ada untuk keperluan pelaporan.
- Kontrak tidak boleh tumpang tindih periodenya untuk karyawan yang sama.
- Pengajuan cuti tidak boleh melebihi saldo pada tanggal mulai, kecuali jenis cuti mengizinkan saldo negatif.
- Cuti tidak dapat diajukan untuk periode penggajian yang sudah diposting.
- Penyesuaian saldo cuti wajib menyertakan alasan.
- Komponen gaji tidak dapat diubah formulanya; hanya ditutup dan digantikan versi baru dengan tanggal berlaku.
- Siklus penggajian tidak dapat diposting bila masih ada karyawan tanpa data wajib untuk perhitungan pajak.
- Satu periode hanya boleh punya satu siklus reguler; sisanya harus luar jadwal.
- Kehadiran periode yang sudah diposting tidak dapat diubah; koreksinya masuk ke siklus berikutnya.

### Yang wajib ditetapkan profesional

Seluruh nilai berikut adalah **konfigurasi**: tarif dan metode perhitungan pajak penghasilan karyawan · tarif dan batas kontribusi jaminan sosial untuk pekerja dan pemberi kerja · komponen mana yang menjadi dasar pajak dan dasar jaminan sosial · perhitungan lembur · hak cuti minimum dan aturan pemindahan sisa · perhitungan pesangon · tenggat setor dan lapor.

---

## 12. Testing Strategy

**Unit.** Evaluasi komponen berurutan termasuk komponen yang merujuk komponen lain · perhitungan saldo cuti dari buku besar termasuk pemindahan sisa dan kedaluwarsa · pemilihan versi komponen berdasarkan tanggal periode.

**Reproduksibilitas.** Penggajian periode lalu, dihitung ulang setelah komponen berubah, menghasilkan angka yang sama persis. Diuji dengan mengubah komponen di tengah rangkaian pengujian.

**Invarian.** Bruto dikurangi total potongan sama dengan neto, untuk setiap slip · jumlah seluruh slip sama dengan total siklus · jurnal penggajian berimbang dan totalnya sama dengan yang dibayarkan ditambah kewajiban yang terbentuk · saldo cuti dari proyeksi sama dengan jumlah buku besar.

**Akses — pengujian yang paling penting di modul ini.** Pengguna dengan izin HR Staff tidak dapat mengambil slip gaji lewat ID langsung · atasan tidak dapat mengakses data gaji timnya · karyawan tidak dapat mengakses slip karyawan lain · Company Admin tanpa pemberian eksplisit tidak melihat kolom gaji di endpoint mana pun · setiap akses baca tercatat.

**E2E.** Karyawan baru sampai slip gaji pertama · pengajuan cuti sampai terpotong di penggajian · koreksi lewat siklus luar jadwal · perubahan regulasi di tengah tahun dengan periode di kedua sisi tanggal berlaku.

---

## 13. Future Enhancements

- **Rekrutmen** — lowongan, pelamar, tahap seleksi, sampai menjadi karyawan.
- **Penilaian kinerja** — sasaran, tinjauan berkala, dan kalibrasi.
- **Portal karyawan penuh** — perubahan data mandiri dengan persetujuan, klaim, dan reimbursement.
- **Pengaturan jadwal shift** untuk ritel dan manufaktur, terhubung ke kehadiran.
- **Absensi berbasis wajah atau biometrik** lewat perangkat, dengan penyimpanan data biometrik yang sesuai regulasi.
- **Simulasi biaya** — dampak kenaikan gaji terhadap total biaya perusahaan sebelum diputuskan.
- **Integrasi bank** untuk pembayaran gaji massal.
- **Pelaporan otomatis** ke sistem pajak dan jaminan sosial.
