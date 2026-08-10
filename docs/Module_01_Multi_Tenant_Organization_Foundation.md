# Module Design: Multi-Tenant & Organization Foundation
*Phase 1 — Foundation. Modul pertama yang harus dibangun karena menjadi dependency root untuk seluruh modul lain di Business OS.*

---

## 1. Business Problem
Business OS harus melayani beragam skala pelanggan dalam satu platform SaaS — dari individu, UMKM, hingga enterprise/multinational dengan banyak entitas legal (PT/anak perusahaan) sekaligus. Tanpa model data isolasi yang jelas antar organisasi (tenant) dan antar entitas legal (company) di dalamnya, tidak ada modul lain (Finance, CRM, HRM, dst) yang bisa dibangun secara aman, konsisten, dan scalable. Ini adalah fondasi yang menentukan struktur data seluruh platform untuk 20 tahun ke depan.

## 2. Goals
- Menyediakan model isolasi data yang jelas dan konsisten antar tenant, dan antar company di dalam satu tenant.
- Mendukung onboarding self-serve (UMKM) maupun onboarding terkelola/assisted (enterprise).
- Menjadi dependency root: setiap tabel di modul lain wajib membawa `tenant_id` dan `company_id` sesuai Database Guidelines.
- Siap untuk horizontal scaling ke jutaan pengguna dan ribuan organisasi tanpa perubahan struktural.

## 3. User Stories
- Sebagai calon pelanggan, saya ingin mendaftar dan otomatis mendapat tenant baru agar bisa langsung mencoba platform.
- Sebagai admin tenant, saya ingin membuat banyak company di bawah tenant saya agar bisa mengelola grup usaha (holding dengan beberapa PT) dalam satu akun.
- Sebagai user dengan akses ke banyak company, saya ingin berpindah konteks company dengan cepat tanpa logout.
- Sebagai Security Engineer, saya ingin jaminan bahwa data satu tenant tidak pernah bisa diakses oleh tenant lain, bahkan jika terjadi bug di level aplikasi.
- Sebagai Business Consultant/Sales Ops, saya ingin tenant punya status lifecycle yang jelas (trial, active, suspended, churned) untuk keperluan billing dan retensi.

## 4. Functional Requirements
- CRUD Tenant (organisasi) dan CRUD Company (entitas legal di bawah tenant).
- Tenant settings: plan/subscription tier, region, status (trial/active/suspended/churned).
- Company settings: nama legal, tax ID/NPWP, mata uang default, tahun fiskal, alamat.
- Tenant & Company switcher di UI untuk user dengan akses lintas company.
- Tenant lifecycle management (trial → active → suspended → churned) dengan trigger notifikasi di setiap transisi.
- Endpoint provisioning otomatis saat registrasi baru (auto-create tenant + company pertama).

## 5. Non-Functional Requirements
- **Data isolation**: filter `tenant_id` wajib di-enforce di service layer/repository layer (bukan hanya di query manual) — mencegah kebocoran data lintas tenant meski ada human error di level kode modul lain.
- **Scalability**: schema didesain agar siap di-shard per tenant di masa depan jika volume transaksi sangat besar.
- **Performance**: `tenant_id` menjadi bagian dari composite index utama di hampir semua tabel turunan.
- **Auditability**: setiap perubahan tenant/company tercatat lengkap di audit log (siapa, kapan, perubahan apa).
- **High Availability**: modul ini menjadi single point of failure jika didesain buruk — wajib redundant dan low-latency karena dipanggil di setiap request (context resolution).

## 6. Database Design

**Table: `tenants`**
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| name | varchar | |
| slug | varchar, unique | untuk subdomain/URL |
| plan_type | enum | trial, starter, business, enterprise |
| status | enum | trial, active, suspended, churned |
| region | varchar | untuk data residency di masa depan |
| trial_ends_at | timestamp, nullable | |
| created_at, updated_at, deleted_at | timestamp | |
| created_by, updated_by, deleted_by | UUID | |

**Table: `companies`**
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| tenant_id | UUID (FK → tenants.id) | wajib, indexed |
| legal_name | varchar | |
| tax_id | varchar, nullable | format bervariasi per negara |
| default_currency | varchar(3) | ISO 4217 |
| fiscal_year_start_month | int | 1–12 |
| status | enum | active, inactive | |
| created_at, updated_at, deleted_at | timestamp | |
| created_by, updated_by, deleted_by | UUID | |

**Rules mengikuti Database Guidelines:** UUID sebagai PK, audit columns lengkap, tidak ada relasi implisit, `tenant_id` wajib di semua tabel turunan di modul lain.

## 7. API Design
Mengikuti API Standards (RESTful, versioned, konsisten response format `{success, message, data}` / `{success, message, errors}`).

```
POST   /v1/tenants                     -> provisioning tenant baru (dipicu saat registrasi)
GET    /v1/tenants/{id}                -> detail tenant
PATCH  /v1/tenants/{id}                -> update settings tenant
POST   /v1/tenants/{id}/companies      -> tambah company baru
GET    /v1/tenants/{id}/companies      -> list company (dengan pagination, filtering, sorting)
GET    /v1/companies/{id}              -> detail company
PATCH  /v1/companies/{id}              -> update company
DELETE /v1/companies/{id}              -> soft delete company
```
Semua endpoint wajib idempotent-safe untuk operasi create (idempotency key), dan terdokumentasi via OpenAPI.

## 8. UI Flow
1. Onboarding wizard: Registrasi → Buat Tenant → Buat Company pertama → Invite anggota tim.
2. Tenant/Company switcher: komponen reusable di top navigation, muncul jika user punya akses ke >1 company.
3. Settings page: Tenant Settings (plan, billing, region) dan Company Settings (legal info, fiscal year) sebagai dua tab terpisah.
4. Mengikuti UI/UX Guidelines: maksimal 3 klik untuk switch company, dark mode ready, keyboard friendly.

## 9. Business Flow
Registrasi → auto-provisioning tenant (status: trial) + company pertama → user mulai menggunakan platform → sebelum trial berakhir, sistem trigger notifikasi upgrade → user pilih plan → status berubah ke active → billing berjalan → jika pembayaran gagal berulang, status menjadi suspended → jika tidak diselesaikan dalam periode tertentu, status menjadi churned (data tetap disimpan sesuai retention policy, tidak langsung dihapus).

## 10. Permission Matrix
| Action | Tenant Owner | Tenant Admin | Company Admin | Member |
|---|---|---|---|---|
| Create/Delete Tenant | ✅ (create only via registrasi) | ❌ | ❌ | ❌ |
| Update Tenant Settings | ✅ | ✅ | ❌ | ❌ |
| Create/Delete Company | ✅ | ✅ | ❌ | ❌ |
| Update Company Settings | ✅ | ✅ | ✅ (company sendiri) | ❌ |
| View Company | ✅ | ✅ | ✅ | ✅ (jika diberi akses) |

## 11. Validation Rules
- `tenant.slug` harus unik secara global, lowercase, alfanumerik + dash.
- `company.tax_id` divalidasi sesuai format negara terdaftar (mis. NPWP 15/16 digit untuk Indonesia).
- Tidak boleh ada company tanpa tenant_id yang valid (FK constraint + validasi di service layer).
- `fiscal_year_start_month` harus di rentang 1–12.
- Tenant tidak bisa dihapus permanen jika masih punya company aktif (soft delete berjenjang).

## 12. Testing Strategy
- **Unit test**: logika resolusi tenant context, validasi format tax_id per negara.
- **Integration test**: memastikan query dari service modul lain (mis. modul Finance) tidak pernah bisa mengembalikan data lintas tenant meski dicoba secara sengaja (negative test untuk data isolation).
- **Load test**: simulasi ribuan tenant dengan volume transaksi tinggi untuk memvalidasi index dan strategi sharding di masa depan.
- **E2E test**: alur onboarding penuh dari registrasi sampai company pertama aktif.

## 13. Future Enhancements
- Custom domain per tenant (mis. `app.namacompany.com`).
- Data residency/region pinning penuh (bukan hanya kolom metadata, tapi penempatan data fisik).
- Tenant-level feature flags untuk rollout bertahap.
- Marketplace: instalasi third-party app per tenant tanpa mengubah kode inti.
- Tenant hierarchy (holding company dengan sub-tenant) jika dibutuhkan skenario enterprise yang lebih kompleks dari sekadar multi-company.
