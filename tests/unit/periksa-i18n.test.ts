import { describe, expect, test } from 'vitest'

import { hitungStringKeras, periksaI18n } from '../../tools/i18n/periksa.js'

/**
 * Pemeriksa string keras, diuji terhadap kebocoran SUNGGUHAN.
 *
 * Setiap potongan di bawah pernah ada di repo ini dan lolos versi pemeriksa
 * sebelumnya — lalu sampai ke layar produksi, tempat "Bulan" dan "4 faktur"
 * berdiri di antara label berbahasa Inggris.
 *
 * Diuji dengan bentuk aslinya, bukan dengan contoh yang dikarang. Contoh yang
 * dikarang di dalam test dibuat agar cocok dengan polanya, sehingga ia lolos
 * meski polanya salah.
 */

const jsx = (isi: string): number => hitungStringKeras(isi, true)

describe('kebocoran yang lolos versi sebelumnya', () => {
  test('kata pendek di dalam JSX — "Bulan", "Umur", "Nilai"', () => {
    /*
     * Pola lama menuntut enam huruf (`[A-Z][a-zA-Z][^<>{}]{4,}`). Ketiga kata
     * ini lebih pendek, dan ketiganya adalah kepala kolom pada tabel yang
     * dibaca screen reader — tempat yang paling tidak terlihat mata.
     */
    expect(jsx('<th scope="col">Bulan</th>')).toBe(1)
    expect(jsx('<th scope="col">Umur</th>')).toBe(1)
    expect(jsx('<th scope="col">Nilai</th>')).toBe(1)
  })

  test('templat berisi kata — "4 faktur"', () => {
    // Tidak berbentuk `>Teks<` sama sekali, jadi tidak ada pola teks JSX yang
    // dapat melihatnya.
    expect(jsx('{satu.count === 0 ? "—" : `${satu.count} faktur`}')).toBe(1)
    expect(jsx('setSukses(`Faktur ${nomor} disetujui dan siap diposting.`)')).toBe(1)
    expect(jsx('<Checkbox label={`Pilih baris ${id}`} />')).toBe(1)
  })

  test('locale yang dipatok — toLocaleString("id-ID")', () => {
    /*
     * Bukan kalimat, jadi tidak akan pernah tertangkap pola teks mana pun.
     * Akibatnya halus dan bertahan lama: angkanya benar, hanya pemisahnya
     * mengikuti bahasa yang salah.
     */
    expect(jsx("<td>{satu.toLocaleString('id-ID')}</td>")).toBe(1)
    expect(jsx('const x = n.toLocaleDateString("en-US")')).toBe(1)
  })
})

describe('yang TIDAK boleh dikeluhkan', () => {
  test('akronim dan istilah pajak lolos', () => {
    /*
     * D-150: NPWP, PPN, PKP tidak pernah diterjemahkan. Pemeriksa yang
     * mengeluhkannya melatih orang mengabaikan seluruh keluarannya.
     */
    expect(jsx('<Badge tone="accent">PKP</Badge>')).toBe(0)
    expect(jsx('<th scope="col">DPP</th>')).toBe(0)
    expect(jsx('<th scope="col">PPN</th>')).toBe(0)
  })

  test('jalur, kelas, dan kunci lolos', () => {
    expect(jsx('href={`#/pajak/keluaran/${row.id}`}')).toBe(0)
    expect(jsx('className={`${styles.kartu} ${styles.aktif}`}')).toBe(0)
    expect(jsx('const url = `${perusahaan(id)}/reports/tax-reconciliation?period=${masa}`')).toBe(0)
  })

  test('templat tanpa kata alami lolos', () => {
    expect(jsx('`${row.code} — ${row.name}`')).toBe(0)
    expect(jsx('`${tanda}${persen}%`')).toBe(0)
  })

  test('sintaks generik di berkas .ts tidak dikira teks', () => {
    // `adaJsx: false` — di `.ts`, `>TableState<` adalah tipe, bukan kalimat.
    expect(hitungStringKeras('function f(): Promise<TableState<Baris>> {}', false)).toBe(0)
  })

  test('teks di dalam komentar tidak dihitung', () => {
    expect(jsx('// nanti tulis <th>Bulan</th> di sini\nconst a = 1')).toBe(0)
  })
})

describe('seluruh repo', () => {
  test('tidak ada string keras yang tersisa di layar produk', () => {
    const { stringKeras, locale } = periksaI18n()

    expect(locale, `kunci locale menyimpang:\n${locale.join('\n')}`).toEqual([])
    expect(stringKeras, `string keras tersisa:\n${stringKeras.join('\n')}`).toEqual([])
  })
})
