import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'

import type { AccountSummary, TaxCodeVersion } from '#application/queries'
import { monthLabel } from '#shared/fiscal-period'
import { formatAmount } from '#shared/money-format'

import { api, ApiError, perusahaan } from '../api/client.js'
import { Badge } from '../components/badge.js'
import { Button } from '../components/button.js'
import { Checkbox } from '../components/choice.js'
import { Select } from '../components/combobox.js'
import { ErrorSummary, type FieldError } from '../components/form/form.js'
import { DateField } from '../components/pickers.js'
import { FilterBar, type FilterChip } from '../components/filter-bar.js'
import { Tabs, TabPanel } from '../components/tabs.js'
import { useHeaderHalaman } from '../shell/page-header.js'
import { DataTable } from '../components/table/data-table.js'
import { useTabel } from '../components/table/use-tabel.js'
import { usePreferences } from '../shell/preferences.js'
import type { Column, TableState } from '../components/table/types.js'
import { TextField } from '../components/text-field.js'
import { useFormat } from '../i18n/use-format.js'
import { href, pergiKe } from '../router.js'
import styles from './pages.module.css'

/**
 * Layar Pajak — Kode Pajak.
 *
 * Satu keputusan membentuk seluruh halaman ini: **tarif tidak pernah diubah.**
 * Ia ditutup dan digantikan versi baru (D-124), sehingga dokumen lama tetap
 * dapat dihitung ulang dengan angka yang sama persis.
 *
 * Akibatnya bagi layar: daftar menampilkan satu baris per VERSI, bukan per
 * kode. Menyatukan versi menjadi satu baris akan menyembunyikan tepat hal yang
 * harus dilihat orang sebelum ia mengganti tarif — sejak kapan yang berlaku
 * sekarang berlaku, dan tarif mana yang dipakai dokumen tahun lalu.
 *
 * Formulirnya karena itu tidak berjudul "Ubah tarif" begitu saja: ia
 * menyebutkan versi mana yang akan ditutup dan pada tanggal berapa. Formulir
 * yang tampak seperti pengubahan akan dipakai seperti pengubahan.
 */

interface Konteks {
  readonly companyId: string
  readonly companyName: string
  readonly currency: string
}



/** Tarif disimpan `numeric(7,4)`; nol di belakang koma tidak perlu ikut tampil. */
function formatTarif(rate: number): string {
  return `${Number(rate.toFixed(4))}%`
}

/**
 * Prop `error` hanya disertakan bila memang ada.
 *
 * `exactOptionalPropertyTypes` membedakan "tidak dikirim" dari "dikirim
 * undefined", dan pembedaan itu benar: field tanpa galat tidak boleh membawa
 * atribut galat kosong ke ARIA.
 */
function galatField(errors: readonly FieldError[], fieldId: string): { error?: string } {
  const pesan = errors.find((item) => item.fieldId === fieldId)?.message
  return pesan === undefined ? {} : { error: pesan }
}

function tanggalKeTeks(nilai: Date | null): string {
  if (nilai === null) return ''
  const bulan = String(nilai.getMonth() + 1).padStart(2, '0')
  const hari = String(nilai.getDate()).padStart(2, '0')
  return `${nilai.getFullYear()}-${bulan}-${hari}`
}

export function KodePajak({
  konteks,
  ubahId,
}: {
  readonly konteks: Konteks
  readonly ubahId?: string
}): ReactNode {
  const { t } = useTranslation('pajak')
  const format = useFormat()
  const [state, setState] = useState<TableState<TaxCodeVersion>>({ kind: 'loading' })
  const [versi, setVersi] = useState<readonly TaxCodeVersion[]>([])
  const [akun, setAkun] = useState<readonly AccountSummary[]>([])
  const [sukses, setSukses] = useState<string | null>(null)

  async function muat(): Promise<void> {
    setState({ kind: 'loading' })
    try {
      const jawaban = await api.get<TaxCodeVersion[]>(`${perusahaan(konteks.companyId)}/tax-codes`)
      setVersi(jawaban.data)
      setState(
        jawaban.data.length === 0
          ? { kind: 'empty' }
          : { kind: 'ready', rows: jawaban.data, total: jawaban.data.length, nextCursor: null },
      )
    } catch (galat) {
      setState({
        kind: 'error',
        message: galat instanceof ApiError ? galat.message : t('kode.gagal'),
      })
    }
  }

  useEffect(() => {
    void muat()
    void api
      .get<AccountSummary[]>(`${perusahaan(konteks.companyId)}/accounts`)
      .then((jawaban) => setAkun(jawaban.data))
      .catch(() => undefined)
  }, [konteks.companyId])

  const columns: readonly Column<TaxCodeVersion>[] = useMemo(
    () => [
      {
        id: 'code',
        header: t('kode.kolomKode'),
        identifier: true,
        sortable: true,
        cell: (row) => row.code,
        sortValue: (row) => row.code,
      },
      { id: 'name', header: t('kode.kolomNama'), cell: (row) => row.name },
      {
        id: 'type',
        header: t('kode.kolomJenis'),
        cell: (row) => t(`jenis.${row.taxType}` as 'jenis.vat_out', { defaultValue: row.taxType }),
      },
      {
        id: 'rate',
        header: t('kode.kolomTarif'),
        align: 'end',
        sortable: true,
        cell: (row) => formatTarif(row.rate),
        sortValue: (row) => row.rate,
      },
      {
        id: 'valid_from',
        header: t('kode.kolomBerlakuDari'),
        sortable: true,
        cell: (row) => format.tanggalPendek(row.validFrom),
        sortValue: (row) => row.validFrom,
      },
      {
        id: 'valid_to',
        header: t('kode.kolomBerlakuSampai'),
        // Batasnya setengah terbuka: tanggal ini TIDAK ikut memakai tarif baris
        // ini. Disebut apa adanya supaya tidak dibaca sebagai hari terakhir.
        cell: (row) =>
          row.validTo === null ? (
            <Badge tone="success">{t('kode.masihBerlaku')}</Badge>
          ) : (
            t('kode.sebelum', { tanggal: format.tanggalPendek(row.validTo) })
          ),
      },
      {
        id: 'base',
        header: t('kode.kolomDasar'),
        cell: (row) =>
          t(`dasar.${row.calculationBase}` as 'dasar.net', { defaultValue: row.calculationBase }),
      },
      {
        id: 'account',
        header: t('kode.kolomAkun'),
        cell: (row) => `${row.glAccountCode} — ${row.glAccountName}`,
      },
      {
        id: 'creditable',
        header: t('kode.kolomDapatDikreditkan'),
        cell: (row) => (row.isCreditable ? t('kode.ya') : t('kode.tidak')),
      },
      {
        id: 'aksi',
        header: t('kode.kolomAksi'),
        cell: (row) => (
          <Button variant="secondary" onClick={() => pergiKe(`pajak/kode/${row.id}`)}>
            {t('kode.ubahTarif')}
          </Button>
        ),
      },
    ],
    [t, format],
  )

  const dipilih = ubahId === undefined ? null : (versi.find((baris) => baris.id === ubahId) ?? null)

  const { preferences } = usePreferences()
  const tabel = useTabel(columns, (row) => [row.code, row.name])

  return (
    <div className={styles.stack}>
      {sukses !== null ? (
        <p className={styles.noticeSuccess} role="status">
          {sukses}
        </p>
      ) : null}

      {dipilih !== null ? (
        <FormVersiBaru
          konteks={konteks}
          dasar={dipilih}
          akun={akun}
          onBatal={() => pergiKe('pajak/kode')}
          onSelesai={(pesan) => {
            setSukses(pesan)
            pergiKe('pajak/kode')
            void muat()
          }}
        />
      ) : null}

      <DataTable
        caption={t('kode.caption')}
        columns={columns}
        state={tabel.terapkan(state, [])}
        rowId={(row) => row.id}
        rowHref={(row) => `#/pajak/kode/${row.id}`}
        filter={{}}
        sort={tabel.sort}
        density={preferences.density}
        companyName={konteks.companyName}
        emptyAction={
          <Button variant="secondary" onClick={() => void muat()}>
            {t('kode.muatUlang')}
          </Button>
        }
        onSortChange={tabel.setSort}
        onRetry={() => void muat()}
      />
    </div>
  )
}

/**
 * Layar Pajak — Nomor Seri.
 *
 * Empat angka ditampilkan berdampingan dan tidak pernah dijumlahkan menjadi
 * satu: terpakai, batal, kedaluwarsa, tersisa. Alasannya bukan selera tata
 * letak. **Nomor batal tidak pernah kembali ke pool** (Module 08 §8), sehingga
 * "terpakai + batal" bukan angka yang berarti apa pun, dan satu angka gabungan
 * akan membuat orang mengira nomor batal masih dapat dipakai lagi.
 *
 * Penjumlahan keempatnya ditampilkan apa adanya terhadap total dialokasikan —
 * invarian yang sama yang dijaga `tests/invariants/nomor-seri-pajak.test.ts`.
 * Bila suatu hari ia tidak seimbang, layar inilah yang memperlihatkannya lebih
 * dulu daripada laporan mana pun.
 */
interface RingkasanSeri {
  readonly allocated: number
  readonly available: number
  readonly used: number
  readonly cancelled: number
  readonly expired: number
}

export function NomorSeri({ konteks }: { readonly konteks: Konteks }): ReactNode {
  const { t } = useTranslation('pajak')
  const format = useFormat()
  const [ringkasan, setRingkasan] = useState<RingkasanSeri | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  async function muat(): Promise<void> {
    setGalat(null)
    try {
      const jawaban = await api.get<RingkasanSeri>(
        `${perusahaan(konteks.companyId)}/tax-serials/usage`,
      )
      setRingkasan(jawaban.data)
    } catch (kesalahan) {
      setRingkasan(null)
      setGalat(
        kesalahan instanceof ApiError
          ? kesalahan.message
          : t('seri.gagal'),
      )
    }
  }

  useEffect(() => {
    void muat()
  }, [konteks.companyId])

  if (galat !== null) {
    return (
      <div className={styles.stack}>
        <p className={styles.noticeDanger} role="alert">
          {galat}
        </p>
        <div>
          <Button variant="secondary" onClick={() => void muat()}>
            {t('aksi.cobaLagi', { ns: 'umum' })}
          </Button>
        </div>
      </div>
    )
  }

  if (ringkasan === null) return <p role="status">{t('seri.memuat')}</p>

  const terpakaiSemua =
    ringkasan.used + ringkasan.cancelled + ringkasan.expired + ringkasan.available
  const seimbang = terpakaiSemua === ringkasan.allocated

  return (
    <div className={styles.stack}>
      <div className={styles.meta}>
        <div>
          <div className={styles.metaLabel}>{t('seri.company')}</div>
          <div className={styles.metaValue}>{konteks.companyName}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>{t('seri.totalDialokasikan')}</div>
          <div className={styles.metaValue}>{format.bilangan(ringkasan.allocated)}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>{t('seri.sisaAlokasi')}</div>
          <div className={styles.metaValue}>
            <Badge
              tone={
                ringkasan.available === 0
                  ? 'danger'
                  : ringkasan.available <= 10
                    ? 'warning'
                    : 'success'
              }
            >
              {t('seri.tersisaBadge', { count: ringkasan.available })}
            </Badge>
          </div>
        </div>
      </div>

      {ringkasan.available === 0 ? (
        <p className={styles.noticeDanger} role="alert">
          {t('seri.habis')}
        </p>
      ) : null}

      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.metaLabel}>{t('seri.terpakai')}</span>
          <strong className={styles.metaValue}>{format.bilangan(ringkasan.used)}</strong>
          <p>{t('seri.terpakaiPenjelasan')}</p>
        </div>
        <div className={styles.card}>
          <span className={styles.metaLabel}>{t('seri.batal')}</span>
          <strong className={styles.metaValue}>{format.bilangan(ringkasan.cancelled)}</strong>
          <p>{t('seri.batalPenjelasan')}</p>
        </div>
        <div className={styles.card}>
          <span className={styles.metaLabel}>{t('seri.kedaluwarsa')}</span>
          <strong className={styles.metaValue}>{format.bilangan(ringkasan.expired)}</strong>
          <p>{t('seri.kedaluwarsaPenjelasan')}</p>
        </div>
        <div className={styles.card}>
          <span className={styles.metaLabel}>{t('seri.tersisa')}</span>
          <strong className={styles.metaValue}>{format.bilangan(ringkasan.available)}</strong>
          <p>{t('seri.tersisaPenjelasan')}</p>
        </div>
      </div>

      <p className={seimbang ? styles.notice : styles.noticeDanger} role="status">
        {seimbang
          ? t('seri.seimbang', {
              terpakai: format.bilangan(ringkasan.used),
              batal: format.bilangan(ringkasan.cancelled),
              kedaluwarsa: format.bilangan(ringkasan.expired),
              tersisa: format.bilangan(ringkasan.available),
              dialokasikan: format.bilangan(ringkasan.allocated),
            })
          : t('seri.tidakSeimbang', {
              jumlah: format.bilangan(terpakaiSemua),
              dialokasikan: format.bilangan(ringkasan.allocated),
            })}
      </p>
    </div>
  )
}

/**
 * Layar Pajak — Faktur Pajak Keluaran.
 *
 * Nomor tetap ditampilkan pada faktur yang batal. Menyembunyikannya akan
 * membuat orang mengira nomor itu kembali tersedia, padahal nomor batal tidak
 * pernah kembali ke pool (Module 08 §8) — hal yang sama yang ditegaskan halaman
 * Nomor Seri.
 *
 * Rantai faktur pengganti sengaja tidak ditampilkan. Kolomnya ada di basis
 * data, tetapi aturan formalnya menunggu konsultan pajak (V-07), dan layar yang
 * menampilkannya akan segera diikuti pertanyaan "di mana tombol membuatnya".
 */
/** Nada badge per status faktur pajak. Teksnya di `pajak.statusFaktur`. */
const NADA_STATUS_FAKTUR: Record<string, 'neutral' | 'success' | 'warning' | 'danger'> = {
  draft: 'neutral',
  issued: 'success',
  cancelled: 'danger',
  replaced: 'warning',
}

function StatusFaktur({ status }: { readonly status: string }): ReactNode {
  const { t } = useTranslation('pajak')
  const nada = NADA_STATUS_FAKTUR[status]

  return nada === undefined ? (
    <>{status}</>
  ) : (
    <Badge tone={nada}>
      {t(`statusFaktur.${status}` as 'statusFaktur.issued', { defaultValue: status })}
    </Badge>
  )
}

interface FakturKeluaranRingkas {
  readonly id: string
  readonly formattedNumber: string | null
  readonly customerName: string
  readonly customerNpwp: string | null
  readonly invoiceDate: string
  readonly taxPeriod: string
  readonly taxCode: string
  readonly baseAmount: number
  readonly taxAmount: number
  readonly status: string
}

interface FakturKeluaranDetail extends FakturKeluaranRingkas {
  readonly serialNumber: number | null
  readonly taxRate: number
  readonly issuedAt: string | null
  readonly cancelledAt: string | null
  readonly cancelReason: string | null
  readonly sources: readonly {
    readonly salesDocumentId: string
    readonly salesDocumentNumber: string | null
    readonly baseAmount: number
    readonly taxAmount: number
  }[]
}

/**
 * Chip untuk faktur pajak keluaran - Component_Specs_Composite section 2.
 *
 * Ketiganya pertanyaan yang dibawa orang pajak ke daftar ini menjelang
 * pelaporan masa: mana yang sudah terbit, mana yang dibatalkan, mana yang
 * diganti. Status draf sengaja tidak masuk - faktur pajak draf tidak pernah
 * dilaporkan, jadi ia bukan pertanyaan yang muncul di sini.
 */
const CHIP_KELUARAN = ['issued', 'cancelled', 'replaced'] as const

export function DaftarFakturKeluaran({ konteks }: { readonly konteks: Konteks }): ReactNode {
  const { t } = useTranslation('pajak')
  const format = useFormat()
  const [state, setState] = useState<TableState<FakturKeluaranRingkas>>({ kind: 'loading' })
  const [semua, setSemua] = useState<readonly FakturKeluaranRingkas[]>([])
  const [filterAktif, setFilterAktif] = useState<readonly string[]>([])

  const labelFilter = (id: string): string =>
    t(`statusFaktur.${id}` as 'statusFaktur.issued', { defaultValue: id })

  const chip: readonly FilterChip[] = CHIP_KELUARAN.map((id) => ({ id, label: labelFilter(id) }))

  function tampilkan(baris: readonly FakturKeluaranRingkas[], filter: readonly string[]): void {
    if (baris.length === 0) {
      setState({ kind: 'empty' })
      return
    }
    const cocok = filter.length === 0 ? baris : baris.filter((row) => filter.includes(row.status))
    if (cocok.length === 0) {
      setState({ kind: 'no_match', activeFilters: filter.map(labelFilter) })
      return
    }
    setState({ kind: 'ready', rows: cocok, total: cocok.length, nextCursor: null })
  }

  function ubahFilter(berikut: readonly string[]): void {
    setFilterAktif(berikut)
    tampilkan(semua, berikut)
  }

  async function muat(): Promise<void> {
    setState({ kind: 'loading' })
    try {
      const jawaban = await api.get<FakturKeluaranRingkas[]>(
        `${perusahaan(konteks.companyId)}/output-tax-invoices`,
      )
      setSemua(jawaban.data)
      tampilkan(jawaban.data, filterAktif)
    } catch (galat) {
      setState({
        kind: 'error',
        message:
          galat instanceof ApiError ? galat.message : t('keluaran.gagal'),
      })
    }
  }

  useEffect(() => {
    void muat()
  }, [konteks.companyId])

  const columns: readonly Column<FakturKeluaranRingkas>[] = useMemo(
    () => [
      {
        id: 'number',
        header: t('keluaran.kolomNomor'),
        identifier: true,
        sortable: true,
        // Draf memang belum bernomor — nomor melekat saat terbit, bukan saat
        // draf dibuat (D-007).
        cell: (row) => row.formattedNumber ?? t('detail.belumBernomor'),
        sortValue: (row) => row.formattedNumber ?? '',
      },
      { id: 'customer', header: t('keluaran.kolomPelanggan'), cell: (row) => row.customerName },
      {
        id: 'npwp',
        header: t('keluaran.kolomNpwp'),
        cell: (row) => row.customerNpwp ?? '—',
      },
      {
        id: 'date',
        header: t('keluaran.kolomTanggal'),
        sortable: true,
        cell: (row) => format.tanggalPendek(row.invoiceDate),
        sortValue: (row) => row.invoiceDate,
      },
      { id: 'period', header: t('keluaran.kolomMasa'), cell: (row) => row.taxPeriod },
      { id: 'code', header: t('keluaran.kolomKode'), cell: (row) => row.taxCode },
      {
        id: 'base',
        header: t('keluaran.kolomDpp'),
        align: 'end',
        sortable: true,
        cell: (row) => format.angka(row.baseAmount, konteks.currency),
        sortValue: (row) => row.baseAmount,
      },
      {
        id: 'tax',
        header: t('keluaran.kolomPpn'),
        align: 'end',
        sortable: true,
        cell: (row) => format.angka(row.taxAmount, konteks.currency),
        sortValue: (row) => row.taxAmount,
      },
      {
        id: 'status',
        header: t('keluaran.kolomStatus'),
        cell: (row) => <StatusFaktur status={row.status} />,
      },
    ],
    [konteks.currency, t, format],
  )

  const { preferences } = usePreferences()
  const tabel = useTabel(columns, (row) => [row.formattedNumber, row.customerName])

  return (
    <div className={styles.stack}>
      <FilterBar
        label={t('keluaran.saring')}
        chips={chip}
        activeIds={filterAktif}
        search={{
          value: tabel.kueri,
          label: t('keluaran.cari'),
          onChange: tabel.setKueri,
        }}
        onToggle={(id) =>
          ubahFilter(
            filterAktif.includes(id)
              ? filterAktif.filter((aktif) => aktif !== id)
              : [...filterAktif, id],
          )
        }
        onClearAll={() => ubahFilter([])}
      />

    <DataTable
      caption={t('keluaran.caption')}
      columns={columns}
      state={tabel.terapkan(state, filterAktif.map(labelFilter))}
      rowId={(row) => row.id}
      rowHref={(row) => `#/pajak/keluaran/${row.id}`}
      filter={Object.fromEntries(filterAktif.map((id) => [id, 'aktif']))}
      activeFilterLabels={filterAktif.map(labelFilter)}
      sort={tabel.sort}
      density={preferences.density}
      companyName={konteks.companyName}
      emptyAction={
        <Button onClick={() => pergiKe('pajak/terbitkan')}>{t('keluaran.terbitkan')}</Button>
      }
      onSortChange={tabel.setSort}
      onRetry={() => void muat()}
      onClearFilters={() => ubahFilter([])}
    />
    </div>
  )
}

/**
 * Layar Pajak — Terbitkan Faktur Pajak Keluaran.
 *
 * Jembatan yang sebelumnya tidak ada: memposting faktur penjualan menulis PPN
 * ke buku besar, tetapi buku pajak hanya terisi ketika faktur pajak
 * diterbitkan. Tanpa layar ini, rekonsiliasi selalu melaporkan selisih dan
 * tidak ada tombol mana pun yang dapat menutupnya.
 *
 * Satu faktur pajak boleh mencakup beberapa faktur penjualan (Module 08 §4),
 * tetapi seluruhnya harus milik pelanggan yang sama — NPWP dan nama pelanggan
 * disalin ke faktur pajak, dan satu faktur tidak dapat memuat dua NPWP.
 */
interface FakturLayak {
  readonly id: string
  readonly number: string | null
  readonly customerId: string
  readonly customerName: string
  readonly customerNpwp: string | null
  readonly documentDate: string
  readonly taxBase: number
  readonly taxTotal: number
  readonly currency: string
}

export function TerbitkanFakturPajak({ konteks }: { readonly konteks: Konteks }): ReactNode {
  const { t } = useTranslation('pajak')
  const format = useFormat()
  const [kandidat, setKandidat] = useState<readonly FakturLayak[]>([])
  const [dipilih, setDipilih] = useState<readonly string[]>([])
  const [kode, setKode] = useState<readonly TaxCodeVersion[]>([])
  const [kodeDipilih, setKodeDipilih] = useState('')
  const [galat, setGalat] = useState<string | null>(null)
  const [sukses, setSukses] = useState<string | null>(null)
  const [menyimpan, setMenyimpan] = useState(false)

  async function muat(): Promise<void> {
    setGalat(null)
    try {
      const [layak, kodePajak] = await Promise.all([
        api.get<FakturLayak[]>(`${perusahaan(konteks.companyId)}/sales-invoices-eligible-for-tax`),
        api.get<TaxCodeVersion[]>(`${perusahaan(konteks.companyId)}/tax-codes`),
      ])
      setKandidat(layak.data)
      setDipilih([])

      // Hanya kode keluaran yang masih berlaku. Menawarkan versi yang sudah
      // ditutup akan membuat faktur pajak lahir dengan tarif kedaluwarsa.
      const keluaran = kodePajak.data.filter(
        (item) => item.taxType === 'vat_out' && item.validTo === null,
      )
      setKode(keluaran)
      setKodeDipilih(keluaran[0]?.id ?? '')
    } catch (kesalahan) {
      setGalat(
        kesalahan instanceof ApiError ? kesalahan.message : t('terbitkan.gagalFaktur'),
      )
    }
  }

  useEffect(() => {
    void muat()
  }, [konteks.companyId])

  const terpilih = kandidat.filter((item) => dipilih.includes(item.id))
  const pelangganTerpilih = terpilih[0]
  const bedaPelanggan = terpilih.some((item) => item.customerId !== pelangganTerpilih?.customerId)
  const tanpaNpwp = terpilih.some(
    (item) => item.customerNpwp === null || item.customerNpwp.trim() === '',
  )
  const totalDpp = terpilih.reduce((jumlah, item) => jumlah + item.taxBase, 0)
  const totalPpn = terpilih.reduce((jumlah, item) => jumlah + item.taxTotal, 0)

  async function terbitkan(): Promise<void> {
    if (pelangganTerpilih === undefined || kodeDipilih === '') return
    setMenyimpan(true)
    setGalat(null)
    setSukses(null)

    try {
      const draf = await api.post<{ id: string }>(
        `${perusahaan(konteks.companyId)}/output-tax-invoices`,
        {
          customer_id: pelangganTerpilih.customerId,
          invoice_date: terpilih[terpilih.length - 1]!.documentDate,
          tax_code_id: kodeDipilih,
          base_amount: totalDpp,
          tax_amount: totalPpn,
          sources: terpilih.map((item) => ({
            sales_document_id: item.id,
            base_amount: item.taxBase,
            tax_amount: item.taxTotal,
          })),
        },
      )

      // Dua langkah dengan sengaja: draf lahir tanpa nomor, dan nomor seri baru
      // melekat saat terbit. Menggabungkannya akan membuat nomor terpakai oleh
      // draf yang mungkin tidak pernah jadi.
      const terbit = await api.post<{ number: string }>(
        `${perusahaan(konteks.companyId)}/output-tax-invoices/${draf.data.id}/issue`,
      )
      setSukses(
        t('pesan.terbit', { nomor: terbit.data.number, count: terpilih.length }),
      )
      await muat()
    } catch (kesalahan) {
      // Pesan server sudah menyebut cara melengkapinya — "Lengkapi di Pelanggan
      // → Data Pajak". Mengarang pesan sendiri akan menggantikan yang menuntun
      // dengan yang umum.
      setGalat(
        kesalahan instanceof ApiError
          ? kesalahan.message
          : t('terbitkan.gagalTerbit'),
      )
    } finally {
      setMenyimpan(false)
    }
  }

  const dapatTerbit =
    terpilih.length > 0 && !bedaPelanggan && !tanpaNpwp && kodeDipilih !== '' && !menyimpan

  return (
    <div className={styles.stack}>
      <div className={styles.meta}>
        <div>
          <div className={styles.metaLabel}>{t('terbitkan.company')}</div>
          <div className={styles.metaValue}>{konteks.companyName}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>{t('terbitkan.fakturTerpilih')}</div>
          <div className={styles.metaValue}>{format.bilangan(terpilih.length)}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>{t('terbitkan.dpp')}</div>
          <div className={styles.metaValue}>{format.angka(totalDpp, konteks.currency)}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>{t('terbitkan.ppn')}</div>
          <div className={styles.metaValue}>{format.angka(totalPpn, konteks.currency)}</div>
        </div>
      </div>

      {sukses !== null ? (
        <p className={styles.noticeSuccess} role="status">
          {sukses}
        </p>
      ) : null}
      {galat !== null ? (
        <p className={styles.noticeDanger} role="alert">
          {galat}
        </p>
      ) : null}

      {kandidat.length === 0 ? (
        <p className={styles.notice} role="status">
          {t('terbitkan.kosong')}
        </p>
      ) : (
        <>
          <table className={styles.matchTable}>
            <caption>
              {t('terbitkan.caption')}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('terbitkan.kolomPilih')}</th>
                <th scope="col">{t('terbitkan.kolomNomor')}</th>
                <th scope="col">{t('terbitkan.kolomPelanggan')}</th>
                <th scope="col">{t('terbitkan.kolomNpwp')}</th>
                <th scope="col">{t('terbitkan.kolomTanggal')}</th>
                <th scope="col" data-numeric="true">
                  {t('terbitkan.dpp')}
                </th>
                <th scope="col" data-numeric="true">
                  {t('terbitkan.ppn')}
                </th>
              </tr>
            </thead>
            <tbody>
              {kandidat.map((baris) => {
                const npwpKosong = baris.customerNpwp === null || baris.customerNpwp.trim() === ''
                return (
                  <tr key={baris.id} data-variance={npwpKosong}>
                    <td>
                      <Checkbox
                        id={`pilih-${baris.id}`}
                        label={t('terbitkan.pilihBaris', { nomor: baris.number ?? baris.id })}
                        checked={dipilih.includes(baris.id)}
                        onChange={(nyala) =>
                          setDipilih((lama) =>
                            nyala ? [...lama, baris.id] : lama.filter((id) => id !== baris.id),
                          )
                        }
                      />
                    </td>
                    <td>{baris.number ?? t('terbitkan.tanpaNomor')}</td>
                    <td>{baris.customerName}</td>
                    <td>{npwpKosong ? t('terbitkan.npwpKosong') : baris.customerNpwp}</td>
                    <td>{format.tanggalPendek(baris.documentDate)}</td>
                    <td data-numeric="true">{format.angka(baris.taxBase, baris.currency)}</td>
                    <td data-numeric="true">{format.angka(baris.taxTotal, baris.currency)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <Select
            id="kode-pajak-terbit"
            label={t('terbitkan.kodePajak')}
            helper={t('terbitkan.kodePajakHelper')}
            value={kodeDipilih}
            options={kode.map((item) => ({
              value: item.id,
              label: t('terbitkan.opsiKode', {
                kode: item.code,
                tarif: formatTarif(item.rate),
                tanggal: format.tanggalPendek(item.validFrom),
              }),
            }))}
            onChange={setKodeDipilih}
          />

          {bedaPelanggan ? (
            <p className={styles.noticeDanger} role="alert">
              {t('terbitkan.bedaPelanggan')}
            </p>
          ) : null}
          {tanpaNpwp ? (
            <p className={styles.noticeDanger} role="alert">
              {t('terbitkan.tanpaNpwp')}
            </p>
          ) : null}

          <div className={styles.row}>
            <Button loading={menyimpan} disabled={!dapatTerbit} onClick={() => void terbitkan()}>
              {t('terbitkan.tombol')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export function DetailFakturKeluaran({
  konteks,
  invoiceId,
}: {
  readonly konteks: Konteks
  readonly invoiceId: string
}): ReactNode {
  const { t } = useTranslation('pajak')
  const format = useFormat()
  const [faktur, setFaktur] = useState<FakturKeluaranDetail | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [tab, setTab] = useState('ringkasan')

  useEffect(() => {
    setGalat(null)
    void api
      .get<FakturKeluaranDetail>(
        `${perusahaan(konteks.companyId)}/output-tax-invoices/${invoiceId}`,
      )
      .then((jawaban) => setFaktur(jawaban.data))
      .catch((kesalahan: unknown) => {
        setFaktur(null)
        setGalat(
          kesalahan instanceof ApiError
            ? kesalahan.message
            : t('detail.gagal'),
        )
      })
  }, [konteks.companyId, invoiceId])

  /*
   * Faktur pajak punya SATU sumbu siklus hidup, dan itu memang jumlahnya.
   *
   * Tidak ada pelunasan dan tidak ada pemenuhan di sini - faktur pajak bukan
   * dokumen komersial, ia dokumen pelaporan. Memaksakan tiga badge dengan
   * mengarang dua sumbu akan membuat layar terlihat seragam dan berbohong.
   *
   * Dua badge sisanya karena itu menyebut hal yang benar-benar menentukan
   * nasib faktur ini: masa pajaknya, dan apakah nomor serinya sudah terpakai.
   */
  useHeaderHalaman(
    () =>
      faktur === null
        ? {}
        : {
            badges: (
              <>
                <StatusFaktur status={faktur.status} />
                <Badge tone="neutral">{t('detail.masa', { masa: faktur.taxPeriod })}</Badge>
                {faktur.serialNumber === null ? null : (
                  <Badge tone="neutral">{t('detail.seri', { nomor: faktur.serialNumber })}</Badge>
                )}
              </>
            ),
            tabs: (
              <Tabs
                label={t('detail.bagian')}
                activeId={tab}
                onSelect={setTab}
                items={[
                  { id: 'ringkasan', label: t('detail.tabRingkasan') },
                  { id: 'baris', label: t('detail.tabBaris'), count: faktur.sources.length },
                  { id: 'terkait', label: t('detail.tabTerkait'), count: faktur.sources.length },
                  { id: 'aktivitas', label: t('detail.tabAktivitas') },
                ]}
              />
            ),
          },
    [faktur, tab, t],
  )

  if (galat !== null) {
    return (
      <div className={styles.stack}>
        <p className={styles.noticeDanger} role="alert">
          {galat}
        </p>
        <div>
          <Button variant="secondary" onClick={() => pergiKe('pajak/keluaran')}>
            {t('detail.kembali')}
          </Button>
        </div>
      </div>
    )
  }

  if (faktur === null) return <p role="status">{t('detail.memuat')}</p>

  return (
    <div className={styles.stack}>
      <TabPanel id="ringkasan" activeId={tab}>
      <div className={styles.meta}>
        <div>
          <div className={styles.metaLabel}>{t('detail.company')}</div>
          <div className={styles.metaValue}>{konteks.companyName}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>{t('detail.nomor')}</div>
          <div className={styles.metaValue}>
            {faktur.formattedNumber ?? t('detail.belumBernomor')}
          </div>
        </div>
        <div>
          <div className={styles.metaLabel}>{t('detail.status')}</div>
          <div className={styles.metaValue}>
            <StatusFaktur status={faktur.status} />
          </div>
        </div>
        <div>
          <div className={styles.metaLabel}>{t('detail.pelanggan')}</div>
          <div className={styles.metaValue}>{faktur.customerName}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>{t('detail.npwpPelanggan')}</div>
          <div className={styles.metaValue}>{faktur.customerNpwp ?? '—'}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>{t('detail.tanggal')}</div>
          <div className={styles.metaValue}>{format.tanggal(faktur.invoiceDate)}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>{t('detail.masaPajak')}</div>
          <div className={styles.metaValue}>{faktur.taxPeriod}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>{t('detail.kodePajak')}</div>
          <div className={styles.metaValue}>{`${faktur.taxCode} · ${formatTarif(faktur.taxRate)}`}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>DPP</div>
          <div className={styles.metaValue}>
            {formatAmount(faktur.baseAmount, konteks.currency)}
          </div>
        </div>
        <div>
          <div className={styles.metaLabel}>{t('detail.ppn')}</div>
          <div className={styles.metaValue}>{format.angka(faktur.taxAmount, konteks.currency)}</div>
        </div>
      </div>

      {faktur.status === 'cancelled' ? (
        <p className={styles.noticeDanger} role="status">
          {t('detail.dibatalkan', {
            pada:
              faktur.cancelledAt === null
                ? ''
                : t('detail.dibatalkanPada', {
                    tanggal: format.tanggal(faktur.cancelledAt.slice(0, 10)),
                  }),
            alasan: faktur.cancelReason ?? t('detail.alasanTidakDicatat'),
            nomor: faktur.formattedNumber ?? '',
          })}
        </p>
      ) : null}

      </TabPanel>

      <TabPanel id="baris" activeId={tab}>
      <table className={styles.matchTable}>
        <caption>
          {t('detail.captionSumber')}
        </caption>
        <thead>
          <tr>
            <th scope="col">{t('detail.kolomFakturPenjualan')}</th>
            <th scope="col" data-numeric="true">
              {t('detail.dpp')}
            </th>
            <th scope="col" data-numeric="true">
              {t('detail.ppn')}
            </th>
          </tr>
        </thead>
        <tbody>
          {faktur.sources.length === 0 ? (
            <tr>
              <td colSpan={3}>{t('detail.tanpaSumber')}</td>
            </tr>
          ) : (
            faktur.sources.map((sumber) => (
              <tr key={sumber.salesDocumentId}>
                <td>{sumber.salesDocumentNumber ?? t('detail.belumBernomor')}</td>
                <td data-numeric="true">{format.angka(sumber.baseAmount, konteks.currency)}</td>
                <td data-numeric="true">{format.angka(sumber.taxAmount, konteks.currency)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </TabPanel>

      {/*
        Jejak dua arah yang benar-benar ada - Flow_Archetypes 3. Satu faktur
        pajak dapat menghimpun beberapa faktur penjualan, dan tab ini
        menyebutkan seluruhnya beserta porsinya masing-masing.
      */}
      <TabPanel id="terkait" activeId={tab}>
        {faktur.sources.length === 0 ? (
          <p className={styles.notice}>
            {t('detail.tanpaSumberTerkait')}
          </p>
        ) : (
          <ul>
            {faktur.sources.map((sumber) => (
              <li key={sumber.salesDocumentId}>
                <a href={href(`penjualan/${sumber.salesDocumentId}`)}>
                  {sumber.salesDocumentNumber ?? t('detail.belumBernomor')}
                </a>
                {t('detail.rincianSumber', {
                  dpp: format.angka(sumber.baseAmount, konteks.currency),
                  ppn: format.angka(sumber.taxAmount, konteks.currency),
                })}
              </li>
            ))}
          </ul>
        )}
      </TabPanel>

      <TabPanel id="aktivitas" activeId={tab}>
        {faktur.cancelledAt === null ? (
          <p className={styles.notice}>
            {t('detail.auditBelumAda')} <code>audit_log</code>
            {t('detail.auditBelumAdaLanjutan')}
          </p>
        ) : (
          <div className={styles.meta}>
            <div>
              <div className={styles.metaLabel}>{t('detail.labelDibatalkan')}</div>
              <div className={styles.metaValue}>{faktur.cancelledAt}</div>
            </div>
            <div>
              <div className={styles.metaLabel}>{t('detail.alasan')}</div>
              <div className={styles.metaValue}>{faktur.cancelReason ?? '—'}</div>
            </div>
          </div>
        )}
      </TabPanel>

      <div>
        <Button variant="secondary" onClick={() => pergiKe('pajak/keluaran')}>
          {t('detail.kembali')}
        </Button>
      </div>
    </div>
  )
}

/**
 * Layar Pajak — Faktur Pajak Masukan.
 *
 * Kolom "Kelengkapan" tidak pernah berhenti pada bendera merah. Ia menyebutkan
 * kalimat cacatnya apa adanya — "NPWP vendor kosong", bukan "tidak valid" —
 * karena orang yang membuka layar ini sedang mencari apa yang harus
 * dilengkapi, bukan konfirmasi bahwa ada yang salah.
 *
 * Kalimat itu datang dari `input_tax_invoice_defects`, ditulis saat validasi
 * berjalan. Layar tidak menerjemahkan kode cacat menjadi kalimat sendiri:
 * terjemahan kedua akan menyimpang dari yang pertama begitu aturannya berubah.
 */
interface FakturMasukan {
  readonly id: string
  readonly supplierNumber: string
  readonly vendorName: string
  readonly vendorNpwp: string | null
  readonly vendorIsPkp: boolean
  readonly invoiceDate: string
  readonly taxPeriod: string
  readonly creditPeriod: string | null
  readonly taxCode: string
  readonly baseAmount: number
  readonly taxAmount: number
  readonly isCreditable: boolean
  readonly validatedAt: string | null
  readonly defects: readonly { readonly code: string; readonly detail: string }[]
}

/**
 * Chip untuk faktur pajak masukan.
 *
 * Bukan status, melainkan dapat-tidaknya dikreditkan - itulah satu-satunya
 * pertanyaan yang menentukan angka di SPT Masa. Vendor non-PKP dipisahkan
 * sendiri karena ia sebab paling umum sebuah faktur tidak dapat dikreditkan,
 * dan orang perlu melihat daftarnya untuk menagih perbaikan.
 */
const CHIP_MASUKAN = ['creditable', 'non_creditable', 'non_pkp'] as const

function cocokMasukan(baris: FakturMasukan, id: string): boolean {
  if (id === 'creditable') return baris.isCreditable
  if (id === 'non_creditable') return !baris.isCreditable
  return !baris.vendorIsPkp
}

export function DaftarFakturMasukan({ konteks }: { readonly konteks: Konteks }): ReactNode {
  const { t } = useTranslation('pajak')
  const format = useFormat()
  const [state, setState] = useState<TableState<FakturMasukan>>({ kind: 'loading' })
  const [semua, setSemua] = useState<readonly FakturMasukan[]>([])
  const [filterAktif, setFilterAktif] = useState<readonly string[]>([])

  const labelFilter = (id: string): string =>
    t(`chipMasukan.${id}` as 'chipMasukan.creditable', { defaultValue: id })

  const chip: readonly FilterChip[] = CHIP_MASUKAN.map((id) => ({ id, label: labelFilter(id) }))

  function tampilkan(baris: readonly FakturMasukan[], filter: readonly string[]): void {
    if (baris.length === 0) {
      setState({ kind: 'empty' })
      return
    }
    const cocok =
      filter.length === 0
        ? baris
        : baris.filter((row) => filter.some((id) => cocokMasukan(row, id)))
    if (cocok.length === 0) {
      setState({ kind: 'no_match', activeFilters: filter.map(labelFilter) })
      return
    }
    setState({ kind: 'ready', rows: cocok, total: cocok.length, nextCursor: null })
  }

  function ubahFilter(berikut: readonly string[]): void {
    setFilterAktif(berikut)
    tampilkan(semua, berikut)
  }

  async function muat(): Promise<void> {
    setState({ kind: 'loading' })
    try {
      const jawaban = await api.get<FakturMasukan[]>(
        `${perusahaan(konteks.companyId)}/input-tax-invoices`,
      )
      setSemua(jawaban.data)
      tampilkan(jawaban.data, filterAktif)
    } catch (galat) {
      setState({
        kind: 'error',
        message:
          galat instanceof ApiError ? galat.message : t('masukan.gagal'),
      })
    }
  }

  useEffect(() => {
    void muat()
  }, [konteks.companyId])

  const columns: readonly Column<FakturMasukan>[] = useMemo(
    () => [
      {
        id: 'number',
        header: t('masukan.kolomNomorVendor'),
        identifier: true,
        sortable: true,
        cell: (row) => row.supplierNumber,
        sortValue: (row) => row.supplierNumber,
      },
      {
        id: 'vendor',
        header: t('masukan.kolomVendor'),
        cell: (row) =>
          row.vendorIsPkp ? row.vendorName : t('masukan.vendorNonPkp', { nama: row.vendorName }),
      },
      { id: 'npwp', header: t('masukan.kolomNpwpVendor'), cell: (row) => row.vendorNpwp ?? '—' },
      {
        id: 'date',
        header: t('masukan.kolomTanggal'),
        sortable: true,
        cell: (row) => format.tanggalPendek(row.invoiceDate),
        sortValue: (row) => row.invoiceDate,
      },
      { id: 'period', header: t('masukan.kolomMasa'), cell: (row) => row.taxPeriod },
      {
        id: 'credit_period',
        header: t('masukan.kolomMasaKredit'),
        // Boleh berbeda dari masa fakturnya. Menyamakan keduanya di layar akan
        // menyembunyikan faktur yang sengaja dikreditkan di masa lain.
        cell: (row) => row.creditPeriod ?? '—',
      },
      {
        id: 'tax',
        header: t('masukan.kolomPpn'),
        align: 'end',
        sortable: true,
        cell: (row) => format.angka(row.taxAmount, konteks.currency),
        sortValue: (row) => row.taxAmount,
      },
      {
        id: 'kelengkapan',
        header: t('masukan.kolomKelengkapan'),
        cell: (row) => {
          if (row.validatedAt === null) return <Badge>{t('masukan.belumDivalidasi')}</Badge>
          if (row.defects.length === 0) {
            return (
              <Badge tone={row.isCreditable ? 'success' : 'warning'}>
                {row.isCreditable
                  ? t('masukan.lengkapDikreditkan')
                  : t('masukan.lengkapTidakDikreditkan')}
              </Badge>
            )
          }
          return (
            <span>
              <Badge tone="danger">
                {t('masukan.syaratKurang', { count: row.defects.length })}
              </Badge>
              {/* Kalimatnya ikut ditampilkan, bukan disembunyikan di balik
                  tooltip: yang tersembunyi tidak menolong siapa pun yang
                  sedang menelusuri daftar. */}
              <ul>
                {row.defects.map((cacat) => (
                  <li key={cacat.code}>{cacat.detail}</li>
                ))}
              </ul>
            </span>
          )
        },
      },
    ],
    [konteks.currency, t, format],
  )

  const { preferences } = usePreferences()
  const tabel = useTabel(columns, (row) => [row.supplierNumber, row.vendorName])

  return (
    <div className={styles.stack}>
      <FilterBar
        label={t('masukan.saring')}
        chips={chip}
        activeIds={filterAktif}
        search={{
          value: tabel.kueri,
          label: t('masukan.cari'),
          onChange: tabel.setKueri,
        }}
        onToggle={(id) =>
          ubahFilter(
            filterAktif.includes(id)
              ? filterAktif.filter((aktif) => aktif !== id)
              : [...filterAktif, id],
          )
        }
        onClearAll={() => ubahFilter([])}
      />

    <DataTable
      caption={t('masukan.caption')}
      columns={columns}
      state={tabel.terapkan(state, filterAktif.map(labelFilter))}
      rowId={(row) => row.id}
      // Belum ada layar detail faktur masukan, dan menautkan ke halaman yang
      // tidak ada lebih buruk daripada menautkan ke diri sendiri. Seluruh yang
      // perlu dibaca — termasuk apa yang kurang — sudah ada di baris ini.
      rowHref={() => '#/pajak/masukan'}
      filter={Object.fromEntries(filterAktif.map((id) => [id, 'aktif']))}
      activeFilterLabels={filterAktif.map(labelFilter)}
      sort={tabel.sort}
      density={preferences.density}
      companyName={konteks.companyName}
      emptyAction={
        <Button variant="secondary" onClick={() => pergiKe('pembelian/tagihan')}>
          {t('masukan.bukaPembelian')}
        </Button>
      }
      onSortChange={tabel.setSort}
      onRetry={() => void muat()}
      onClearFilters={() => ubahFilter([])}
    />
    </div>
  )
}

/**
 * Layar Pajak — Rekonsiliasi.
 *
 * Buku pajak dan buku besar diletakkan berdampingan **per kode pajak**, bukan
 * sebagai satu angka gabungan. Satu angka gabungan yang bukan nol tidak memberi
 * tahu siapa pun harus melihat ke mana; selisih per kode langsung menunjuk
 * kodenya, dan lewat kode itu, akun buku besarnya.
 *
 * Masa yang dipilih adalah BULAN KALENDER, bukan periode fiskal. Masa pajak
 * tidak mengenal tahun fiskal company — karena itu `FiscalPeriodPicker` sengaja
 * tidak dipakai di sini meski ia ada: kuncinya `FY2026-03`, dan mengirimkannya
 * ke endpoint yang menunggu `2026-03` akan meminta bulan yang salah pada
 * company yang tahun fiskalnya tidak dimulai Januari.
 */
interface KodeRekonsiliasi {
  readonly tax_code: string
  readonly tax_code_id: string
  readonly tax_ledger_total: number
}

interface BarisRekonsiliasi {
  readonly gl_account_id: string
  readonly tax_ledger_total: number
  readonly general_ledger_total: number
  readonly difference: number
  readonly codes: readonly KodeRekonsiliasi[]
}

interface Rekonsiliasi {
  readonly period: string
  readonly balanced: boolean
  readonly rows: readonly BarisRekonsiliasi[]
}

/** Dua belas bulan kalender terakhir, terbaru lebih dulu. */
function masaTerakhir(jumlah: number): readonly { value: string; label: string }[] {
  const sekarang = new Date()
  return Array.from({ length: jumlah }, (_, mundur) => {
    const bulan = new Date(sekarang.getFullYear(), sekarang.getMonth() - mundur, 1)
    const nomor = bulan.getMonth() + 1
    return {
      value: `${bulan.getFullYear()}-${String(nomor).padStart(2, '0')}`,
      label: `${monthLabel(nomor)} ${bulan.getFullYear()}`,
    }
  })
}

export function RekonsiliasiPajak({ konteks }: { readonly konteks: Konteks }): ReactNode {
  const { t } = useTranslation('pajak')
  const format = useFormat()
  const masa = useMemo(() => masaTerakhir(12), [])
  const [dipilih, setDipilih] = useState(masa[0]!.value)
  const [hasil, setHasil] = useState<Rekonsiliasi | null>(null)
  const [akun, setAkun] = useState<readonly AccountSummary[]>([])
  const [galat, setGalat] = useState<string | null>(null)

  async function muat(periode: string): Promise<void> {
    setGalat(null)
    try {
      const jawaban = await api.get<Rekonsiliasi>(
        `${perusahaan(konteks.companyId)}/reports/tax-reconciliation?period=${periode}`,
      )
      setHasil(jawaban.data)
    } catch (kesalahan) {
      setHasil(null)
      setGalat(
        kesalahan instanceof ApiError ? kesalahan.message : t('rekonsiliasi.gagal'),
      )
    }
  }

  useEffect(() => {
    void muat(dipilih)
    void api
      .get<AccountSummary[]>(`${perusahaan(konteks.companyId)}/accounts`)
      .then((jawaban) => setAkun(jawaban.data))
      .catch(() => undefined)
  }, [konteks.companyId])

  // Endpoint rekonsiliasi hanya membawa id akun. Namanya diambil dari bagan akun
  // yang sudah dimuat, supaya kolomnya terbaca tanpa endpoint baru.
  const namaAkun = (id: string): string => {
    const ketemu = akun.find((item) => item.id === id)
    return ketemu === undefined ? '—' : `${ketemu.code} — ${ketemu.name}`
  }

  return (
    <div className={styles.stack}>
      <div className={styles.meta}>
        <div>
          <div className={styles.metaLabel}>{t('rekonsiliasi.company')}</div>
          <div className={styles.metaValue}>{konteks.companyName}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>{t('rekonsiliasi.masaPajak')}</div>
          <div className={styles.metaValue}>{hasil?.period ?? dipilih}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>{t('rekonsiliasi.keadaan')}</div>
          <div className={styles.metaValue}>
            {hasil === null ? (
              '—'
            ) : hasil.balanced ? (
              <Badge tone="success">{t('rekonsiliasi.cocok')}</Badge>
            ) : (
              <Badge tone="danger">{t('rekonsiliasi.adaSelisih')}</Badge>
            )}
          </div>
        </div>
      </div>

      <div className={styles.row}>
        <Select
          id="masa-pajak"
          label={t('rekonsiliasi.masaPajak')}
          helper={t('rekonsiliasi.masaPajakHelper')}
          value={dipilih}
          options={masa.map((item) => ({ value: item.value, label: item.label }))}
          onChange={(nilai) => {
            setDipilih(nilai)
            void muat(nilai)
          }}
        />
      </div>

      {galat !== null ? (
        <p className={styles.noticeDanger} role="alert">
          {galat}
        </p>
      ) : null}

      {hasil !== null && hasil.rows.length === 0 ? (
        <p className={styles.notice} role="status">
          {t('rekonsiliasi.kosong')}
        </p>
      ) : null}

      {hasil !== null && hasil.rows.length > 0 ? (
        <>
          <table className={styles.matchTable}>
            <caption>
              {t('rekonsiliasi.caption')}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('rekonsiliasi.kolomAkun')}</th>
                <th scope="col">{t('rekonsiliasi.kolomKode')}</th>
                <th scope="col" data-numeric="true">
                  {t('rekonsiliasi.kolomBukuPajak')}
                </th>
                <th scope="col" data-numeric="true">
                  {t('rekonsiliasi.kolomBukuBesar')}
                </th>
                <th scope="col" data-numeric="true">
                  {t('rekonsiliasi.kolomSelisih')}
                </th>
              </tr>
            </thead>
            <tbody>
              {hasil.rows.map((baris) => (
                <tr key={baris.gl_account_id} data-variance={baris.difference !== 0}>
                  <td>{namaAkun(baris.gl_account_id)}</td>
                  <td>
                    {/* Rincian per kode hanya ada di sisi buku pajak. Buku besar
                        tidak menyimpan kode pajak, jadi angkanya tidak dapat
                        dibagi ke sini tanpa mengarang. */}
                    {baris.codes.length === 0
                      ? t('rekonsiliasi.tanpaBarisBukuPajak')
                      : baris.codes
                          .map(
                            (kode) =>
                              `${kode.tax_code} ${format.angka(kode.tax_ledger_total, konteks.currency)}`,
                          )
                          .join(' · ')}
                  </td>
                  <td data-numeric="true">
                    {format.angka(baris.tax_ledger_total, konteks.currency)}
                  </td>
                  <td data-numeric="true">
                    {format.angka(baris.general_ledger_total, konteks.currency)}
                  </td>
                  <td data-numeric="true">{format.angka(baris.difference, konteks.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className={hasil.balanced ? styles.noticeSuccess : styles.noticeDanger} role="status">
            {hasil.balanced
              ? t('rekonsiliasi.semuaCocok')
              : t('rekonsiliasi.berselisih', {
                  count: hasil.rows.filter((baris) => baris.difference !== 0).length,
                })}
          </p>
        </>
      ) : null}
    </div>
  )
}

/**
 * Formulir versi baru.
 *
 * Judul, penjelasan, dan tombolnya semuanya menyebut kata "versi baru". Yang
 * dikunci pun disengaja: kode dan jenis pajak dibuat `readOnly`, karena versi
 * baru dari sebuah kode harus tetap kode yang sama — mengubahnya di sini akan
 * diam-diam membuat kode lain, bukan mengganti tarif.
 */
function FormVersiBaru({
  konteks,
  dasar,
  akun,
  onBatal,
  onSelesai,
}: {
  readonly konteks: Konteks
  readonly dasar: TaxCodeVersion
  readonly akun: readonly AccountSummary[]
  readonly onBatal: () => void
  readonly onSelesai: (pesan: string) => void
}): ReactNode {
  const { t } = useTranslation('pajak')
  const format = useFormat()
  const [nama, setNama] = useState(dasar.name)
  const [tarif, setTarif] = useState('')
  const [berlaku, setBerlaku] = useState<Date | null>(null)
  const [dasarHitung, setDasarHitung] = useState(dasar.calculationBase)
  const [akunId, setAkunId] = useState(dasar.glAccountId)
  const [kreditable, setKreditable] = useState(dasar.isCreditable)
  const [errors, setErrors] = useState<readonly FieldError[]>([])
  const [galatServer, setGalatServer] = useState<string | null>(null)
  const [menyimpan, setMenyimpan] = useState(false)

  function periksa(): readonly FieldError[] {
    const daftar: FieldError[] = []
    const angka = Number(tarif.replace(',', '.'))

    if (tarif.trim() === '' || Number.isNaN(angka)) {
      daftar.push({
        fieldId: 'tarif-baru',
        label: t('versiBaru.tarifBaru'),
        message: t('versiBaru.tarifWajib'),
      })
    } else if (angka < 0 || angka > 100) {
      daftar.push({
        fieldId: 'tarif-baru',
        label: t('versiBaru.tarifBaru'),
        message: t('versiBaru.tarifRentang'),
      })
    }

    if (berlaku === null) {
      daftar.push({
        fieldId: 'berlaku-dari',
        label: t('versiBaru.berlakuDari'),
        message: t('versiBaru.berlakuDariWajib'),
      })
    }

    return daftar
  }

  async function simpan(): Promise<void> {
    const masalah = periksa()
    setErrors(masalah)
    setGalatServer(null)
    if (masalah.length > 0) return

    setMenyimpan(true)
    try {
      await api.post(`${perusahaan(konteks.companyId)}/tax-codes`, {
        code: dasar.code,
        name: nama,
        tax_type: dasar.taxType,
        rate: Number(tarif.replace(',', '.')),
        valid_from: tanggalKeTeks(berlaku),
        calculation_base: dasarHitung,
        gl_account_id: akunId,
        is_creditable: kreditable,
      })
      onSelesai(
        t('versiBaru.berhasil', {
          kode: dasar.code,
          tarif: formatTarif(dasar.rate),
          tanggal: format.tanggalPendek(tanggalKeTeks(berlaku)),
        }),
      )
    } catch (galat) {
      // Pesan server sudah menjelaskan sebabnya dengan tepat — "harus berlaku
      // setelah …", "versi sebelumnya sudah ditutup …". Mengarang pesan sendiri
      // di sini akan menggantikan yang benar dengan yang umum.
      setGalatServer(
        galat instanceof ApiError ? galat.message : t('versiBaru.gagalSimpan'),
      )
    } finally {
      setMenyimpan(false)
    }
  }

  return (
    <section className={styles.stack} aria-label={t('versiBaru.judul', { kode: dasar.code })}>
      <h3>{t('versiBaru.judul', { kode: dasar.code })}</h3>

      <p className={styles.notice}>
        {t('versiBaru.penjelasan', {
          tarif: formatTarif(dasar.rate),
          sejak: format.tanggalPendek(dasar.validFrom),
        })}
      </p>

      <ErrorSummary errors={errors} />

      {galatServer !== null ? (
        <p className={styles.noticeDanger} role="alert">
          {galatServer}
        </p>
      ) : null}

      <TextField
        id="kode-pajak"
        label={t('versiBaru.kode')}
        value={dasar.code}
        readOnly
        onChange={() => undefined}
      />
      <TextField
        id="jenis-pajak"
        label={t('versiBaru.jenisPajak')}
        value={t(`jenis.${dasar.taxType}` as 'jenis.vat_out', { defaultValue: dasar.taxType })}
        readOnly
        onChange={() => undefined}
      />
      <TextField id="nama-pajak" label={t('versiBaru.nama')} value={nama} onChange={setNama} />
      <TextField
        id="tarif-baru"
        label={t('versiBaru.tarifBaru')}
        required
        value={tarif}
        placeholder="11"
        helper={t('versiBaru.tarifHelper')}
        {...galatField(errors, 'tarif-baru')}
        onChange={setTarif}
      />
      <DateField
        id="berlaku-dari"
        label={t('versiBaru.berlakuDari')}
        required
        value={berlaku}
        helper={t('versiBaru.berlakuDariHelper')}
        {...galatField(errors, 'berlaku-dari')}
        onChange={setBerlaku}
      />
      <Select
        id="dasar-hitung"
        label={t('versiBaru.dasarPerhitungan')}
        value={dasarHitung}
        options={[
          { value: 'net', label: t('versiBaru.dasarNet') },
          { value: 'gross', label: t('versiBaru.dasarGross') },
        ]}
        onChange={setDasarHitung}
      />
      <Select
        id="akun-pajak"
        label={t('versiBaru.akunBukuBesar')}
        value={akunId}
        options={akun.map((item) => ({ value: item.id, label: `${item.code} — ${item.name}` }))}
        onChange={setAkunId}
      />
      <Checkbox
        id="dapat-dikreditkan"
        label={t('versiBaru.dapatDikreditkan')}
        checked={kreditable}
        onChange={setKreditable}
      />

      <div className={styles.row}>
        <Button variant="ghost" onClick={onBatal}>
          {t('aksi.batal', { ns: 'umum' })}
        </Button>
        <Button loading={menyimpan} onClick={() => void simpan()}>
          {t('versiBaru.simpan')}
        </Button>
      </div>
    </section>
  )
}
