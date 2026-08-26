# Migrations

Migrasi basis data, berurutan dan hanya bersifat menambah.

## Mengapa hanya menambah

`pm2 reload` mengganti instance satu per satu (D-157). Selama beberapa detik,
kode **lama** dan kode **baru** melayani permintaan dari basis data yang sama —
dan migrasi sudah berjalan sebelum reload dimulai.

Kolom yang dihapus membuat setiap `SELECT` kode lama gagal. Kolom `NOT NULL`
tanpa bawaan membuat setiap `INSERT` kode lama gagal. `INSERT` yang gagal di
tengah posting faktur adalah dokumen yang hilang, pada saat orangnya sedang
menatap layar.

## Aturan yang mengikat

- Kolom baru selalu nullable atau punya nilai bawaan
- Kolom tidak pernah dihapus atau diubah artinya dalam satu rilis
- Batasan baru dipasang `NOT VALID` lebih dulu, divalidasi terpisah
- Perubahan yang merusak dipecah tiga rilis — contoh utuhnya di D-161

Ditegakkan `npm run check:migrations`, yang berjalan di pre-commit dan di CI.
Aturan isinya berlaku sejak **0026**; yang sebelumnya sudah diterapkan produksi
dan tidak dapat diubah lagi.

## Dua penanda

```sql
-- paadu:allow-breaking <alasan, minimal 20 karakter>
```
"Saya tahu ini merusak, dan berikut sebabnya boleh." Meloloskan satu pernyataan
dari pemeriksaan. Alasannya boleh berlanjut ke baris komentar berikutnya.

```sql
-- paadu:jalankan-manual <alasan, minimal 20 karakter>
```
"Ini mengunci tabel; jangan jalankan sebaris deploy." Penjalan migrasi akan
menolaknya dan menyebutkan perintah penggantinya:

```
npm run migrate:manual -- 0027_nama_migrasi
```

Perintah itu menjalankannya **di luar** transaksi tunggal, sehingga
`CREATE INDEX CONCURRENTLY` dan `VALIDATE CONSTRAINT` bekerja. Harganya: bila
pernyataan kelima gagal, empat yang pertama tetap diterapkan.

## Perintah

| | |
|---|---|
| `npm run migrate` | Menjalankan seluruh migrasi tertunda, dalam satu transaksi |
| `npm run migrate:manual -- <nama>` | Menjalankan satu migrasi bertanda, di luar transaksi |
| `npm run check:migrations` | Memeriksa aturan, nomor urut, dan sidik jari |
| `npm run check:migrations -- --update` | Mencatat sidik jari migrasi baru |

Cadangan pra-migrasi diambil otomatis oleh `npm run deploy` (D-162).
