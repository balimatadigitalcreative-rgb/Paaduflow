# Fase 0 — Setup

Jalankan sekali, sebelum sesi Claude Code pertama. Sekitar 15 menit.

---

## 1. Klon repo

```bash
git clone https://github.com/balimatadigitalcreative-rgb/Paaduflow.git
cd Paaduflow
```

## 2. Ekstrak isi `paadu-flow-repo.zip` ke sini

Zip sudah berisi **seluruh struktur folder dan 48 dokumen**. Anda tidak perlu membuat folder secara manual.

```bash
unzip ~/Downloads/paadu-flow-repo.zip -d /tmp
cp -r /tmp/paadu-flow/. .
rm -rf /tmp/paadu-flow
```

Perhatikan titik pada `/tmp/paadu-flow/.` — ia menyalin isi folder termasuk berkas tersembunyi seperti `.gitignore`, bukan foldernya.

## 3. Verifikasi

```bash
ls docs | wc -l                      # harus 48
ls src/                              # harus: application domain infrastructure interface
head -5 CLAUDE.md                    # harus muncul judul Paadu Flow
```

**Bila `ls src/` menampilkan folder berkurung kurawal** seperti `{domain,application,...}`, itu sisa percobaan sebelumnya. Bersihkan lalu ekstrak ulang:

```bash
rm -rf 'src/{domain,application,infrastructure,interface}' 'tests/{unit,integration,invariants}'
```

> **Catatan bagi yang membuat folder manual.** Sintaks kurung kurawal seperti
> `mkdir -p src/{domain,application}` hanya berfungsi di **bash** dan **zsh**.
> Di **sh/dash** ia membuat satu folder bernama harfiah `{domain,application}`
> dan tetap keluar dengan kode sukses — gagal tanpa pesan error. Bila terpaksa
> membuat manual, jalankan lewat `bash -c '...'`.

## 4. Commit pertama

```bash
git add .
git commit -m "Fase 0: struktur repo, CLAUDE.md, register keputusan, dokumentasi desain

Menyiapkan fondasi sebelum sesi build pertama.
28 keputusan arsitektur dari fase desain dicatat di docs/DECISIONS.md.
Enam item menunggu validasi profesional — lihat bagian akhir DECISIONS.md."

git push
```

## 5. Uji sesi Claude Code pertama

```bash
claude
```

Lalu ketik:

```
Baca CLAUDE.md dan docs/README.md. Ringkas dalam 5 kalimat: produk ini apa,
ada berapa modul, dan tiga aturan teknis apa yang paling mengikat.
```

**Yang diharapkan:** ringkasan yang menyebut multi-tenant, 19 modul, dan menyinggung `tokens.json`, `document_version`, atau tabel append-only.

**Bila jawabannya kabur:** `docs/README.md` tidak terbaca atau `CLAUDE.md` terlalu panjang. Perbaiki sekarang — lima belas sesi berikutnya bergantung pada ini.

## 6. Lanjut ke Sesi A1

Buka `docs/Build_Playbook_Claude_Code.md`, mulai dari Sesi A1.

Sesi A1 memakai plan mode. Baca rencananya sampai habis sebelum menyetujui — ini satu-satunya sesi yang keputusannya menyentuh seluruh proyek selamanya.

---

## Catatan tentang visibilitas repo

Repo ini publik. Bila itu tidak disengaja, ubah sekarang selagi riwayat commit masih kosong: **Settings → General → Danger Zone → Change visibility**.

Pertimbangannya: `docs/` memuat positioning, roadmap lima fase, dan arsitektur sembilan belas modul secara lengkap — blueprint utuh bagi siapa pun yang ingin membangun hal serupa.
