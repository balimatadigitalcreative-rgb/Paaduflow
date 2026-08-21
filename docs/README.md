# Paadu Flow — Indeks Proyek
*Business Operating System · dokumentasi desain dan arsitektur lengkap*

---

## Bagian 1 — Desain Produk (Fase 0–8)

| Step | Dokumen |
|---|---|
| — | `Paadu_Flow_Design_to_Prototype_Playbook.md` — peta jalan seluruh fase |
| 0.1 | `Brand_Clearance_Report.md` |
| 0.2 | `Brand_Strategy.md` |
| 1.1 | `Logo_System.md` |
| 1.2 | `Color_System.md` |
| 1.3 | `Typography_System.md` |
| 1.4 | `Brand_Book.md` · `Paadu_Flow_Brand_Guidelines_16x9.pdf` |
| 2.1 | `Design_Tokens.md` · **`tokens.json`** |
| 2.2 | `Layout_System.md` |
| 3.1–3.4 | `Component_Specs_Primitives.md` · `Component_Specs_Composite.md` · `Component_Specs_AppShell.md` · `Component_Specs_Feedback_States.md` |
| 4.1 | `Information_Architecture.md` |
| 5.1–5.2 | `Flow_Onboarding_Provisioning.md` · `Flow_Archetypes.md` |
| 6.1 | `Screen_Specs_HiFi.md` |
| 7.1–7.3 | `Prototype_Spec.md` · `mock_data.json` · **`Paadu_Flow_Prototype.jsx`** |
| 8.1–8.2 | `Audit_Accessibility_Quality.md` · **`Design_Handoff_Spec.md`** |

## Bagian 2 — Arsitektur Modul

**Fase 1 · Fondasi**
| `Module_01_Multi_Tenant_Organization_Foundation.md` — tenant dan company
| `Module_02_Identity_Access_Management.md` — identitas, peran, izin, SSO
| `Module_03_Notification_Audit_FileStorage.md` — notifikasi, audit log, berkas

**Fase 2 · Inti Bisnis**
| `Module_04_Sales.md` · `Module_05_Inventory.md` · `Module_06_Purchasing.md`
| `Module_07_Accounting.md` · `Module_08_Tax.md` · `Module_09_POS.md`

**Fase 3 · Operasional**
| `Module_10_HRIS_Payroll.md` · `Module_11_Project_Timesheet.md` · `Module_12_Fixed_Assets.md`
| `Module_13_Manufacturing.md` · `Module_14_Workflow_Automation.md`

**Fase 4 · Pertumbuhan**
| `Module_15_AI_Assistant.md` · `Module_16_Business_Intelligence.md`
| `Module_17_Public_API_Integration.md` · `Module_18_Marketplace_SDK.md`

**Fase 5 · Enterprise**
| `Module_19_AI_Agents_Predictive.md`
| `Platform_Architecture_Resilience.md` — multi region, HA, DR
| `Platform_Architecture_Industry_Solutions.md` — kerangka solusi industri

---

## Mulai dari mana

**Engineer** → `Design_Handoff_Spec.md`, lalu `Module_01` dan `Module_02`.
**Desainer atau vendor** → `Brand_Book.md`.
**Product** → `Information_Architecture.md` dan `Flow_Archetypes.md`.
**Nilai apa pun** → `tokens.json` adalah sumber kebenaran tunggal.

---

## Pola yang Berulang di Seluruh Modul

Tujuh pola muncul berkali-kali. Memahaminya sekali berarti memahami sebagian besar sistem.

**1 · Bekukan di titik komitmen.** Kurs saat submit · snapshot slip gaji · snapshot laporan pajak · tarif timesheet saat persetujuan · jadwal penyusutan · BOM saat rilis · rencana agen saat disetujui. Angka masa lalu tidak pernah berubah karena keputusan hari ini.

**2 · Buku besar, bukan angka.** Mutasi stok · jurnal · audit log · saldo cuti. Saldo dihitung, tidak disimpan sebagai kolom yang diubah.

**3 · Matriks konfigurasi dengan spesifisitas, plus penguji.** Penentuan akun · penentuan pajak · tarif tagih · toleransi pencocokan. Modul tidak pernah menyebut nomor akun atau tarif.

**4 · Pemisahan tugas.** Pengaju bukan penyetuju · penghitung bukan pemposting · yang menjual bukan yang mengakui pendapatan · QC bukan produksi.

**5 · Akun penampung untuk selisih waktu.** Barang diterima belum ditagih · barang dalam proses · pekerjaan proyek belum ditagih.

**6 · Batas kewenangan mesin.** AI, otomasi, dan agen tidak pernah memposting, menyetujui, membayar, atau menghapus. Integrasi terkonfigurasi adalah pengecualian yang bernama, eksplisit, dan dapat dicabut.

**7 · Invarian yang diuji sebagai properti.** Neraca saldo seimbang · akun kontrol sama dengan buku pembantu · WIP sama dengan perintah kerja terbuka · aset di GL sama dengan register. Pelanggarannya adalah insiden, meski belum ada yang mengeluh.

---

## Yang Masih Terbuka

**Perlu keputusan profesional di luar dokumen ini**
- Urutan perhitungan pajak dan alokasi diskon — konsultan pajak
- Tarif dan aturan PPh, PPN, BPJS — konsultan pajak dan ahli ketenagakerjaan
- Kelompok dan tarif penyusutan fiskal — konsultan pajak
- Metode pengakuan pendapatan proyek — akuntan
- Retensi dokumen dan audit — penasihat hukum
- Sasaran ketersediaan per tier — keputusan komersial

**Perlu dibangun sebelum modul terkait**
- Kolom `document_version` di setiap tabel transaksional
- Tiga kolom status terpisah, bukan satu enum
- Klasifikasi data dan izin tingkat data — prasyarat industri teregulasi

**Perlu diuji**
- Uji keselamatan konteks company pada pengguna nyata
- Uji screen reader
- Uji pembedaan ikon rail
- Simulator buta warna untuk palet data-viz

**Aset brand**
- Nilai hex brand asli — seluruh sistem memakai perkiraan `#3A34B5`
- Nama typeface wordmark
- File SVG mark sumber

---

## Operasional

| Dokumen | Isi |
|---|---|
| `DECISIONS.md` | Keputusan arsitektur dan penyimpangan dari dokumen desain |
| `DEMO.md` | Naskah demo sepuluh menit untuk calon pelanggan — setiap langkahnya diuji di `tests/integration/seed-demo.test.ts` |
