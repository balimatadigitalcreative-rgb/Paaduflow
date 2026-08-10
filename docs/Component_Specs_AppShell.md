# Paadu Flow — App Shell Component Specs
### Step 3.3 · Fase 3 — Core Component Library

**Input:** Layout System (2.2), Primitive (3.1), Composite (3.2).

**Cakupan dokumen ini.** Step 2.2 menetapkan *struktur dan keputusan layout* shell — pola navigasi, lebar, breakpoint, dan empat lapis indikator konteks. Dokumen ini menetapkan *komponen dan perilakunya*: interaksi, state, keyboard, dan aksesibilitas. Aturan layout tidak diulang; rujuk `Layout_System.md`.

---

## 1. Tenant & Company Switcher

Komponen paling berisiko di seluruh produk. Salah konteks company berarti transaksi masuk ke entitas legal yang salah — masalah integritas data, prioritas kedua di Decision Principles.

### Anatomi

Pemicu di top bar menampilkan `Tenant / Company`, dengan nama company sebagai elemen lebih tebal. **Tidak pernah tersembunyi di balik ikon.**

Panel berisi: pencarian → grup company di tenant aktif → grup tenant lain (bila pengguna punya akses) → footer aksi.

Setiap baris company menampilkan **inisial, nama legal, tax ID, mata uang default, dan periode fiskal**. Empat metadata itu bukan hiasan — merekalah yang membuat dua company bernama mirip dapat dibedakan, dan periode fiskal yang berbeda (Jan–Des vs Apr–Mar) adalah pembeda paling menentukan saat menginput transaksi.

### Bentuk avatar membawa makna

**Company memakai rounded square. Orang memakai lingkaran.** Pembedaan bentuk ini konsisten di seluruh produk dan penting justru di top bar, tempat avatar company dan avatar pengguna bersebelahan.

### Perilaku perpindahan

1. Pengguna memilih company
2. Bila ada perubahan belum tersimpan di halaman aktif → konfirmasi lebih dulu, dan konfirmasi itu **menyebut bahwa konteks akan berubah**
3. Konteks berpindah, aplikasi kembali ke dashboard modul yang sama (bukan ke halaman yang sama — ID dokumen tidak berlaku lintas company)
4. **Banner konfirmasi selebar konten** muncul menyebut nama company baru. Bukan toast di pojok — banner yang tidak bisa dilewatkan mata
5. Banner menetap 6 detik, dan dapat ditutup manual

Berpindah ke **tenant lain** adalah perpindahan yang lebih besar: ia memuat ulang aplikasi sepenuhnya dan diberi ikon berbeda di daftar.

### Keyboard

`⌘K` lalu ketik nama company juga membuka jalur ini. Di dalam panel: panah untuk memilih, `Enter` untuk pindah, `Esc` untuk menutup. Fokus kembali ke pemicu saat ditutup.

### Aturan

- Daftar company **selalu dicari sisi server** bila tenant punya lebih dari 20 company
- Company berstatus `inactive` ditampilkan di grup terpisah, tidak disembunyikan — pengguna perlu tahu ia ada
- **Warna tidak pernah dipakai membedakan company** (lihat Layout System §4)
- Pemicu adalah elemen terakhir yang dipotong saat top bar menyempit

---

## 2. Module Rail

Maksimal **8 modul tersemat** + tombol launcher. Bersifat per pengguna, bukan per tenant.

| Interaksi | Perilaku |
|---|---|
| Klik ikon | Pindah modul, sidebar berganti isi |
| Hover | Tooltip berisi nama modul, delay 400ms |
| Drag | Ubah urutan sematan |
| Klik kanan / menu | Lepas sematan |
| Klik launcher | Grid seluruh modul dengan pencarian |

**Ikon wajib punya tooltip.** Ikon tanpa label adalah teka-teki, dan pola rail hanya berhasil bila ikonnya dapat dibedakan (lihat uji pembedaan di 3.1 §0).

**Badge jumlah** hanya untuk hal yang menunggu tindakan pengguna — approval tertunda, dokumen ditolak. Bukan untuk "ada data baru". Badge yang tidak dapat dikosongkan akan diabaikan dalam seminggu.

Modul yang baru dipasang tenant muncul di launcher dengan penanda "baru" selama 14 hari, **tidak otomatis disematkan** — rail milik pengguna.

---

## 3. Contextual Sidebar

Pengelompokan baku untuk seluruh modul transaksional: **Transaksi · Data induk · Laporan · Pengaturan**. Keseragaman ini disengaja — pengguna yang hafal struktur satu modul otomatis hafal semuanya.

- Item aktif ditandai latar dan bobot medium, bukan warna teks saja
- Grup dapat diciutkan; state disimpan per pengguna per modul
- Sidebar dapat diciutkan ke 46px (ikon saja); state disimpan per pengguna
- Item yang tidak diizinkan permission **disembunyikan**, bukan dinonaktifkan — kebijakan ini ditetapkan penuh di Step 4.1

---

## 4. Breadcrumb

Menampilkan jalur hierarkis, bukan riwayat navigasi. Maksimal 4 segmen.

Bila lebih dalam: segmen tengah diringkas menjadi `…` dengan menu. **Segmen pertama dan terakhir tidak pernah diringkas.**

Nama entitas dinamis dipotong pada 32 karakter dengan ellipsis, dan tooltip menampilkan nama penuh. Segmen terakhir bukan tautan.

---

## 5. Notification Center

Panel dari top bar. Tiga kelompok: **perlu tindakan** · **selesai** · **informasi**.

"Perlu tindakan" selalu di atas dan tidak pernah otomatis hilang — approval tertunda, dokumen ditolak, pembayaran gagal.

Notifikasi dibatasi konteks company aktif secara default, dengan toggle "semua company" bagi pengguna lintas company. Notifikasi dari company lain **wajib menampilkan nama company-nya**, dan membukanya memicu perpindahan konteks yang dikonfirmasi.

Badge angka hanya menghitung kelompok "perlu tindakan".

---

## 6. User Menu & AI Dock

**User menu:** nama, email, company aktif, peran di company itu, lalu — profil, preferensi (tema, density, bahasa), pintasan keyboard, bantuan, keluar. Menampilkan peran di sini penting: pengguna sering tidak tahu mengapa suatu menu tidak terlihat.

**AI dock:** dipicu dari top bar atau `⌘K`. Terbuka sebagai panel kanan 360px, bukan modal — pengguna harus tetap melihat data yang sedang ditanyakan. Panel membawa konteks halaman aktif dan menampilkannya secara eksplisit (`Konteks: Faktur INV/2026/08/0142`), agar pengguna tahu apa yang sedang dibaca AI.

---

## 7. Aksesibilitas Shell

Bagian yang paling sering terlewat dan paling sulit ditambal belakangan.

### Landmark

```
<header>  top bar          → role="banner"
<nav>     module rail      → aria-label="Modul"
<nav>     sidebar          → aria-label="Navigasi <nama modul>"
<main>    content area     → role="main"
<aside>   panel kanan      → aria-label="Detail" / "Asisten AI"
```

### Skip links

Tautan lewati wajib ada dan menjadi elemen pertama yang menerima fokus: **Lewati ke konten utama** dan **Lewati ke navigasi modul**. Tanpa ini, pengguna keyboard melewati 20+ elemen chrome di setiap halaman.

### Urutan fokus

Top bar → module rail → sidebar → konten → panel kanan. Urutan ini mengikuti struktur visual dan tidak boleh diubah dengan `tabindex` positif.

### Pengumuman perubahan konteks

Perpindahan company diumumkan lewat `aria-live="assertive"`, bukan `polite`. Ini pengecualian yang dibenarkan: perubahan konteks memengaruhi kebenaran seluruh data di layar, jadi ia harus menyela.

Navigasi halaman diumumkan lewat `aria-live="polite"` dengan judul halaman baru.

### Pintasan keyboard

| Pintasan | Aksi |
|---|---|
| `⌘K` | Command palette |
| `?` | Overlay bantuan pintasan |
| `g` lalu `d` | Ke dashboard |
| `[` | Ciutkan/buka sidebar |
| `Esc` | Tutup lapisan teratas |

Pintasan **tidak aktif saat fokus berada di field input**. Overlay bantuan wajib ada — pintasan yang tidak dapat ditemukan sama dengan tidak ada.

---

## 8. Transisi Responsif

| Viewport | Rail | Sidebar | Panel kanan |
|---|---|---|---|
| ≥1280 | Inline | Inline | Inline |
| 1024–1279 | Inline | Inline, dapat diciutkan | Overlay |
| 768–1023 | Drawer overlay | Drawer overlay | Overlay |
| <768 | Bottom tab bar (maks 5) | Drawer | Bottom sheet |

Drawer overlay memakai focus trap dan mengembalikan fokus ke tombol pemicu saat ditutup.

**Pengalih company tetap ada di semua viewport**, termasuk mobile. Ia tidak pernah dipindahkan ke dalam menu.

---

## 9. Risiko & Item Terbuka

| Item | Status | Dampak |
|---|---|---|
| Uji keselamatan konteks company | Belum dilakukan | Uji apakah pengguna benar-benar menyadari perpindahan — ini uji keselamatan data, bukan uji kegunaan |
| Uji pembedaan ikon rail | Belum dilakukan | Menentukan apakah pola rail berhasil |
| Perilaku shell saat offline | Belum dirancang | Product Requirements menyebut offline untuk modul terpilih |
| Default sematan per peran | Ditunda | Dipetakan bersama Permission Matrix di Step 4.1 |
| Konflik pintasan dengan browser | Belum diaudit | `⌘K` aman; kombinasi lain perlu diperiksa lintas OS dan browser |
