# Paadu Flow

**Business Operating System** — platform multi-tenant, multi-company untuk individu, UMKM, hingga enterprise Indonesia.

> **Status: pra-implementasi.** Repo ini berisi dokumentasi desain dan arsitektur lengkap, plus struktur folder. Belum ada kode aplikasi. Sesi build pertama dimulai dari `SETUP.md`.

---

## Mulai dari mana

| Anda | Mulai dari |
|---|---|
| Menyiapkan repo pertama kali | `SETUP.md` |
| Akan menulis kode | `docs/Build_Playbook_Claude_Code.md` |
| Engineer yang baru bergabung | `docs/Design_Handoff_Spec.md` |
| Desainer atau vendor | `docs/Brand_Book.md` |
| Product | `docs/Information_Architecture.md` dan `docs/Flow_Archetypes.md` |
| Mencari nilai apa pun | `docs/tokens.json` — sumber kebenaran tunggal |

Indeks seluruh dokumen: **`docs/README.md`**
Keputusan arsitektur yang sudah dikunci: **`docs/DECISIONS.md`**

---

## Struktur

```
CLAUDE.md              Aturan yang selalu berlaku, dibaca setiap sesi Claude Code
SETUP.md               Perintah Fase 0, jalankan sekali
docs/                  48 dokumen desain dan arsitektur
src/
  domain/              Entitas dan aturan bisnis, tanpa framework
  application/         Use case dan orkestrasi
  infrastructure/      Basis data, antrean, penyimpanan
  interface/           API dan UI
migrations/
tests/
  unit/
  integration/
  invariants/          Yang paling penting — lihat Sesi D4 di build playbook
tools/
```

Struktur `src/` mengikuti Clean Architecture sesuai Engineering Standards. Isinya ditentukan di Sesi A1.

---

## Cakupan

**19 modul** dirancang lengkap, masing-masing dengan business problem, skema, API, alur, matriks izin, aturan validasi, strategi pengujian, dan pengembangan lanjutan.

| Fase | Modul |
|---|---|
| 1 · Fondasi | Multi-tenant & Organization · Identity & Access Management · Notification, Audit & File Storage |
| 2 · Inti bisnis | Sales · Inventory · Purchasing · Accounting · Tax · POS |
| 3 · Operasional | HRIS & Payroll · Project & Timesheet · Fixed Assets · Manufacturing · Workflow Automation |
| 4 · Pertumbuhan | AI Assistant · Business Intelligence · Public API & Integration · Marketplace & SDK |
| 5 · Enterprise | AI Agents & Predictive Analytics · Resilience & Multi Region · Industry Solutions |

Ditambah dokumentasi desain penuh: brand, design token, component specs, information architecture, flow archetypes, spesifikasi layar, prototype berjalan, dan handoff spec.

---

## Tujuh Pola yang Berulang

Memahami ketujuhnya berarti memahami sebagian besar sistem. Rinciannya di `docs/README.md`.

1. **Bekukan di titik komitmen** — kurs saat submit, snapshot slip gaji, jadwal penyusutan, BOM saat rilis. Angka masa lalu tidak berubah karena keputusan hari ini.
2. **Buku besar, bukan angka** — mutasi stok, jurnal, audit log, saldo cuti. Saldo dihitung, bukan disimpan sebagai kolom yang diubah.
3. **Matriks konfigurasi dengan spesifisitas, plus penguji** — penentuan akun, penentuan pajak, tarif tagih.
4. **Pemisahan tugas** — pengaju bukan penyetuju, penghitung bukan pemposting, QC bukan produksi.
5. **Akun penampung untuk selisih waktu** — barang diterima belum ditagih, barang dalam proses.
6. **Batas kewenangan mesin** — AI, otomasi, dan agen tidak pernah memposting, menyetujui, membayar, atau menghapus.
7. **Invarian yang diuji sebagai properti** — pelanggarannya adalah insiden, meski belum ada yang mengeluh.

---

## Yang Masih Terbuka

Daftar lengkap di `docs/DECISIONS.md` bagian akhir.

**Menunggu keputusan profesional di luar tim** — urutan perhitungan pajak dan alokasi diskon (konsultan pajak) · tarif PPh, PPN, dan jaminan sosial (konsultan pajak dan ahli ketenagakerjaan) · kelompok penyusutan fiskal · metode pengakuan pendapatan proyek (akuntan) · retensi dokumen (penasihat hukum) · sasaran ketersediaan per tier (keputusan komersial).

**Aset brand** — nilai hex asli (seluruh sistem memakai perkiraan `#3A34B5`) · nama typeface wordmark · berkas SVG mark sumber.

**Perlu diuji** — keselamatan konteks company pada pengguna nyata · screen reader · pembedaan ikon rail · palet data-viz dengan simulator buta warna.

---

## Lisensi & Kerahasiaan

Belum ditetapkan. Bila repo ini publik dan itu tidak disengaja, ubah visibilitasnya sebelum riwayat commit bertambah — `docs/` memuat positioning, roadmap, dan arsitektur lengkap sembilan belas modul.
