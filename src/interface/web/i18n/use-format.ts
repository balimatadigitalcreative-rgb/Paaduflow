import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { akuntansi, angka, bulanTahun, localeUntuk, tanggal, tanggalPendek, uang } from './format.js'

/**
 * Pemformat yang terikat bahasa yang sedang aktif.
 *
 * Ada karena alternatifnya sudah terbukti gagal: setiap pemanggilan meneruskan
 * `i18n.language` sendiri, dan yang lupa akan tetap benar di layar Indonesia —
 * sehingga kelalaiannya baru terlihat setelah seseorang beralih ke Inggris.
 * Tiga tempat di repo ini memanggil `toLocaleString('id-ID')` secara harfiah
 * justru karena itu.
 *
 * Yang dikembalikan hanya `string`, sama seperti `format.ts` — lihat D-151.
 * Tidak ada satu pun jalan dari sini yang memulangkan `number`.
 */
export function useFormat(): {
  readonly locale: string
  readonly bahasa: string
  angka(nilai: number, mataUang: string): string
  uang(nilai: number, mataUang: string): string
  akuntansi(nilai: number | null | undefined, mataUang: string): string
  bilangan(nilai: number): string
  persen(nilai: number): string
  tanggal(iso: string): string
  tanggalPendek(iso: string): string
  bulanTahun(kunci: string): string
  bulanSingkat(kunci: string): string
  namaBulan(nomor: number): string
} {
  const { i18n } = useTranslation()
  const bahasa = i18n.language

  return useMemo(
    () => ({
      locale: localeUntuk(bahasa),
      bahasa,
      angka: (nilai, mataUang) => angka(nilai, mataUang, bahasa),
      uang: (nilai, mataUang) => uang(nilai, mataUang, bahasa),
      akuntansi: (nilai, mataUang) => akuntansi(nilai, mataUang, bahasa),
      bilangan: (nilai) => new Intl.NumberFormat(localeUntuk(bahasa)).format(nilai),

      /*
       * Persentase perubahan: satu desimal, dan TANPA tanda.
       *
       * Tandanya ditambahkan pemanggil bersama panahnya, karena arah yang baik
       * tidak selalu arah yang naik — piutang jatuh tempo yang bertambah adalah
       * kabar buruk (Component_Specs_Composite §8).
       */
      persen: (nilai) =>
        new Intl.NumberFormat(localeUntuk(bahasa), { maximumFractionDigits: 1 }).format(nilai),

      tanggal: (iso) => tanggal(iso, bahasa),
      tanggalPendek: (iso) => tanggalPendek(iso, bahasa),
      bulanTahun: (kunci) => bulanTahun(kunci, bahasa),

      /*
       * `Agu 26` / `Aug 26` — untuk sumbu grafik, tempat lebar kolom menentukan
       * berapa banyak bulan yang muat sebelum labelnya bertumpuk.
       *
       * Menggantikan larik singkatan bulan Indonesia yang ditulis tangan di
       * halaman dasbor. Larik seperti itu benar sampai bahasa kedua muncul, lalu
       * diam-diam salah — dan sumbu grafik bukan tempat orang mencari kesalahan.
       */
      bulanSingkat: (kunci) => {
        const [tahun, bulan] = kunci.split('-').map(Number)
        if (tahun === undefined || bulan === undefined) return kunci

        const nama = new Intl.DateTimeFormat(localeUntuk(bahasa), {
          month: 'short',
          timeZone: 'UTC',
        }).format(new Date(Date.UTC(tahun, bulan - 1, 1)))

        return `${nama} ${String(tahun).slice(2)}`
      },

      /*
       * Nama bulan dari nomornya — untuk awal tahun fiskal dan label periode.
       *
       * `monthLabel` di `#shared/fiscal-period` memulangkan nama Indonesia dari
       * larik tetap. Itu benar di sisi server, tempat ia dipakai membentuk kunci
       * dan label yang tidak dilihat siapa pun; di layar ia harus mengikuti
       * bahasa pembacanya.
       */
      namaBulan: (nomor) =>
        nomor < 1 || nomor > 12
          ? '—'
          : new Intl.DateTimeFormat(localeUntuk(bahasa), {
              month: 'long',
              timeZone: 'UTC',
            }).format(new Date(Date.UTC(2000, nomor - 1, 1))),
    }),
    [bahasa],
  )
}
