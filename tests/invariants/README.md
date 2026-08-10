# Invariant Test

**Folder terpenting di repo ini.**

Menguji hal yang harus SELALU benar, dengan membangkitkan ratusan transaksi acak lalu memeriksa apakah kebenaran itu bertahan.

Enam invarian inti:

1. Neraca saldo selalu seimbang
2. Akun kontrol piutang sama dengan sisa tagihan di Penjualan
3. Akun persediaan sama dengan nilai persediaan
4. Saldo stok sama dengan jumlah mutasi
5. Jumlah baris faktur sama dengan subtotalnya
6. Tidak ada celah pada nomor dokumen

Pelanggaran invarian adalah insiden, meski belum ada pengguna yang mengeluh.

Dibangun di Sesi A3, dilengkapi di Sesi D4 — gerbang sebelum modul lain dibangun.
