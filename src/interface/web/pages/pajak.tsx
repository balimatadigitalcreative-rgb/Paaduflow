import { useEffect, useMemo, useState } from 'react'
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
import { DataTable } from '../components/table/data-table.js'
import type { Column, TableState } from '../components/table/types.js'
import { TextField } from '../components/text-field.js'
import { pergiKe } from '../router.js'
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

const LABEL_JENIS: Record<string, string> = {
  vat_out: 'PPN Keluaran',
  vat_in: 'PPN Masukan',
  withholding: 'PPh Potong Pungut',
  exempt: 'Dibebaskan',
  not_collected: 'Tidak Dipungut',
}

const LABEL_DASAR: Record<string, string> = { net: 'Neto', gross: 'Bruto' }

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
        message: galat instanceof ApiError ? galat.message : 'Tidak dapat memuat kode pajak.',
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
        header: 'Kode',
        identifier: true,
        sortable: true,
        cell: (row) => row.code,
        sortValue: (row) => row.code,
      },
      { id: 'name', header: 'Nama', cell: (row) => row.name },
      { id: 'type', header: 'Jenis', cell: (row) => LABEL_JENIS[row.taxType] ?? row.taxType },
      {
        id: 'rate',
        header: 'Tarif',
        align: 'end',
        sortable: true,
        cell: (row) => formatTarif(row.rate),
        sortValue: (row) => row.rate,
      },
      {
        id: 'valid_from',
        header: 'Berlaku dari',
        sortable: true,
        cell: (row) => row.validFrom,
        sortValue: (row) => row.validFrom,
      },
      {
        id: 'valid_to',
        header: 'Berlaku sampai',
        // Batasnya setengah terbuka: tanggal ini TIDAK ikut memakai tarif baris
        // ini. Disebut apa adanya supaya tidak dibaca sebagai hari terakhir.
        cell: (row) =>
          row.validTo === null ? (
            <Badge tone="success">Masih berlaku</Badge>
          ) : (
            `sebelum ${row.validTo}`
          ),
      },
      { id: 'base', header: 'Dasar', cell: (row) => LABEL_DASAR[row.calculationBase] ?? row.calculationBase },
      {
        id: 'account',
        header: 'Akun buku besar',
        cell: (row) => `${row.glAccountCode} — ${row.glAccountName}`,
      },
      {
        id: 'creditable',
        header: 'Dapat dikreditkan',
        cell: (row) => (row.isCreditable ? 'Ya' : 'Tidak'),
      },
      {
        id: 'aksi',
        header: 'Aksi',
        cell: (row) => (
          <Button variant="secondary" onClick={() => pergiKe(`pajak/kode/${row.id}`)}>
            Ubah tarif
          </Button>
        ),
      },
    ],
    [],
  )

  const dipilih = ubahId === undefined ? null : (versi.find((baris) => baris.id === ubahId) ?? null)

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
        caption="Kode Pajak — seluruh versi"
        columns={columns}
        state={state}
        rowId={(row) => row.id}
        rowHref={(row) => `#/pajak/kode/${row.id}`}
        filter={{}}
        sort={[]}
        companyName={konteks.companyName}
        emptyAction={
          <Button variant="secondary" onClick={() => void muat()}>
            Muat ulang kode pajak
          </Button>
        }
        onSortChange={() => undefined}
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
          : 'Tidak dapat memuat pemakaian nomor seri.',
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
            Coba lagi
          </Button>
        </div>
      </div>
    )
  }

  if (ringkasan === null) return <p role="status">Memuat pemakaian nomor seri…</p>

  const terpakaiSemua =
    ringkasan.used + ringkasan.cancelled + ringkasan.expired + ringkasan.available
  const seimbang = terpakaiSemua === ringkasan.allocated

  return (
    <div className={styles.stack}>
      <div className={styles.meta}>
        <div>
          <div className={styles.metaLabel}>Company</div>
          <div className={styles.metaValue}>{konteks.companyName}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>Total dialokasikan</div>
          <div className={styles.metaValue}>{ringkasan.allocated}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>Sisa alokasi</div>
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
              {`${ringkasan.available} nomor tersisa`}
            </Badge>
          </div>
        </div>
      </div>

      {ringkasan.available === 0 ? (
        <p className={styles.noticeDanger} role="alert">
          Tidak ada nomor tersisa. Faktur pajak keluaran berikutnya akan ditolak sampai alokasi
          baru dicatat.
        </p>
      ) : null}

      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.metaLabel}>Terpakai</span>
          <strong className={styles.metaValue}>{ringkasan.used}</strong>
          <p>Melekat pada faktur pajak keluaran yang sudah terbit.</p>
        </div>
        <div className={styles.card}>
          <span className={styles.metaLabel}>Batal</span>
          <strong className={styles.metaValue}>{ringkasan.cancelled}</strong>
          <p>
            Tidak kembali ke pool, dan tidak dapat dipakai ulang oleh siapa pun — termasuk lewat
            basis data.
          </p>
        </div>
        <div className={styles.card}>
          <span className={styles.metaLabel}>Kedaluwarsa</span>
          <strong className={styles.metaValue}>{ringkasan.expired}</strong>
          <p>Lewat tanggal berlaku alokasinya sebelum sempat dipakai.</p>
        </div>
        <div className={styles.card}>
          <span className={styles.metaLabel}>Tersisa</span>
          <strong className={styles.metaValue}>{ringkasan.available}</strong>
          <p>Siap diambil penerbitan berikutnya, dari nomor terkecil.</p>
        </div>
      </div>

      <p className={seimbang ? styles.notice : styles.noticeDanger} role="status">
        {seimbang
          ? `${ringkasan.used} terpakai + ${ringkasan.cancelled} batal + ${ringkasan.expired} kedaluwarsa + ${ringkasan.available} tersisa = ${ringkasan.allocated} dialokasikan.`
          : `Tidak seimbang: keempatnya berjumlah ${terpakaiSemua}, sedangkan yang dialokasikan ${ringkasan.allocated}. Ini temuan, bukan tampilan.`}
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
const LABEL_STATUS_FAKTUR: Record<string, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }> = {
  draft: { label: 'Draf', tone: 'neutral' },
  issued: { label: 'Terbit', tone: 'success' },
  cancelled: { label: 'Batal', tone: 'danger' },
  replaced: { label: 'Diganti', tone: 'warning' },
}

function StatusFaktur({ status }: { readonly status: string }): ReactNode {
  const rupa = LABEL_STATUS_FAKTUR[status]
  return rupa === undefined ? <>{status}</> : <Badge tone={rupa.tone}>{rupa.label}</Badge>
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

export function DaftarFakturKeluaran({ konteks }: { readonly konteks: Konteks }): ReactNode {
  const [state, setState] = useState<TableState<FakturKeluaranRingkas>>({ kind: 'loading' })

  async function muat(): Promise<void> {
    setState({ kind: 'loading' })
    try {
      const jawaban = await api.get<FakturKeluaranRingkas[]>(
        `${perusahaan(konteks.companyId)}/output-tax-invoices`,
      )
      setState(
        jawaban.data.length === 0
          ? { kind: 'empty' }
          : {
              kind: 'ready',
              rows: jawaban.data,
              total: jawaban.data.length,
              nextCursor: jawaban.meta?.next_cursor ?? null,
            },
      )
    } catch (galat) {
      setState({
        kind: 'error',
        message:
          galat instanceof ApiError ? galat.message : 'Tidak dapat memuat faktur pajak keluaran.',
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
        header: 'Nomor',
        identifier: true,
        sortable: true,
        // Draf memang belum bernomor — nomor melekat saat terbit, bukan saat
        // draf dibuat (D-007).
        cell: (row) => row.formattedNumber ?? '(belum bernomor)',
        sortValue: (row) => row.formattedNumber ?? '',
      },
      { id: 'customer', header: 'Pelanggan', cell: (row) => row.customerName },
      {
        id: 'npwp',
        header: 'NPWP',
        cell: (row) => row.customerNpwp ?? '—',
      },
      {
        id: 'date',
        header: 'Tanggal',
        sortable: true,
        cell: (row) => row.invoiceDate,
        sortValue: (row) => row.invoiceDate,
      },
      { id: 'period', header: 'Masa', cell: (row) => row.taxPeriod },
      { id: 'code', header: 'Kode', cell: (row) => row.taxCode },
      {
        id: 'base',
        header: 'DPP',
        align: 'end',
        sortable: true,
        cell: (row) => formatAmount(row.baseAmount, konteks.currency),
        sortValue: (row) => row.baseAmount,
      },
      {
        id: 'tax',
        header: 'PPN',
        align: 'end',
        sortable: true,
        cell: (row) => formatAmount(row.taxAmount, konteks.currency),
        sortValue: (row) => row.taxAmount,
      },
      { id: 'status', header: 'Status', cell: (row) => <StatusFaktur status={row.status} /> },
    ],
    [konteks.currency],
  )

  return (
    <DataTable
      caption="Faktur Pajak Keluaran"
      columns={columns}
      state={state}
      rowId={(row) => row.id}
      rowHref={(row) => `#/pajak/keluaran/${row.id}`}
      filter={{}}
      sort={[]}
      companyName={konteks.companyName}
      emptyAction={
        <Button onClick={() => pergiKe('pajak/terbitkan')}>Terbitkan faktur pajak</Button>
      }
      onSortChange={() => undefined}
      onRetry={() => void muat()}
    />
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
        kesalahan instanceof ApiError ? kesalahan.message : 'Tidak dapat memuat faktur penjualan.',
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
        `Faktur pajak ${terbit.data.number} terbit, mencakup ${terpilih.length} faktur penjualan.`,
      )
      await muat()
    } catch (kesalahan) {
      // Pesan server sudah menyebut cara melengkapinya — "Lengkapi di Pelanggan
      // → Data Pajak". Mengarang pesan sendiri akan menggantikan yang menuntun
      // dengan yang umum.
      setGalat(
        kesalahan instanceof ApiError
          ? kesalahan.message
          : 'Faktur pajak tidak dapat diterbitkan.',
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
          <div className={styles.metaLabel}>Company</div>
          <div className={styles.metaValue}>{konteks.companyName}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>Faktur terpilih</div>
          <div className={styles.metaValue}>{terpilih.length}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>DPP</div>
          <div className={styles.metaValue}>{formatAmount(totalDpp, konteks.currency)}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>PPN</div>
          <div className={styles.metaValue}>{formatAmount(totalPpn, konteks.currency)}</div>
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
          Tidak ada faktur penjualan yang menunggu difakturpajakkan. Faktur muncul di sini setelah
          diposting, dan hilang setelah tercakup faktur pajak.
        </p>
      ) : (
        <>
          <table className={styles.matchTable}>
            <caption>
              Faktur penjualan terposting yang belum tercakup — pilih satu atau beberapa
            </caption>
            <thead>
              <tr>
                <th scope="col">Pilih</th>
                <th scope="col">Nomor</th>
                <th scope="col">Pelanggan</th>
                <th scope="col">NPWP</th>
                <th scope="col">Tanggal</th>
                <th scope="col" data-numeric="true">
                  DPP
                </th>
                <th scope="col" data-numeric="true">
                  PPN
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
                        label={`Pilih ${baris.number ?? baris.id}`}
                        checked={dipilih.includes(baris.id)}
                        onChange={(nyala) =>
                          setDipilih((lama) =>
                            nyala ? [...lama, baris.id] : lama.filter((id) => id !== baris.id),
                          )
                        }
                      />
                    </td>
                    <td>{baris.number ?? '(tanpa nomor)'}</td>
                    <td>{baris.customerName}</td>
                    <td>{npwpKosong ? 'belum diisi' : baris.customerNpwp}</td>
                    <td>{baris.documentDate}</td>
                    <td data-numeric="true">{formatAmount(baris.taxBase, baris.currency)}</td>
                    <td data-numeric="true">{formatAmount(baris.taxTotal, baris.currency)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <Select
            id="kode-pajak-terbit"
            label="Kode pajak"
            helper="Hanya kode PPN keluaran yang masa berlakunya masih terbuka."
            value={kodeDipilih}
            options={kode.map((item) => ({
              value: item.id,
              label: `${item.code} — ${formatTarif(item.rate)} sejak ${item.validFrom}`,
            }))}
            onChange={setKodeDipilih}
          />

          {bedaPelanggan ? (
            <p className={styles.noticeDanger} role="alert">
              Faktur yang dipilih milik pelanggan berbeda. Satu faktur pajak membawa satu NPWP, jadi
              terbitkan terpisah per pelanggan.
            </p>
          ) : null}
          {tanpaNpwp ? (
            <p className={styles.noticeDanger} role="alert">
              Ada pelanggan yang NPWP-nya belum diisi. Faktur pajak keluaran memerlukan NPWP
              pelanggan — lengkapi di Pelanggan → Data Pajak, lalu muat ulang halaman ini.
            </p>
          ) : null}

          <div className={styles.row}>
            <Button loading={menyimpan} disabled={!dapatTerbit} onClick={() => void terbitkan()}>
              Terbitkan faktur pajak
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
  const [faktur, setFaktur] = useState<FakturKeluaranDetail | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

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
            : 'Tidak dapat memuat faktur pajak ini.',
        )
      })
  }, [konteks.companyId, invoiceId])

  if (galat !== null) {
    return (
      <div className={styles.stack}>
        <p className={styles.noticeDanger} role="alert">
          {galat}
        </p>
        <div>
          <Button variant="secondary" onClick={() => pergiKe('pajak/keluaran')}>
            Kembali ke daftar
          </Button>
        </div>
      </div>
    )
  }

  if (faktur === null) return <p role="status">Memuat faktur pajak…</p>

  return (
    <div className={styles.stack}>
      <div className={styles.meta}>
        <div>
          <div className={styles.metaLabel}>Company</div>
          <div className={styles.metaValue}>{konteks.companyName}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>Nomor</div>
          <div className={styles.metaValue}>{faktur.formattedNumber ?? '(belum bernomor)'}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>Status</div>
          <div className={styles.metaValue}>
            <StatusFaktur status={faktur.status} />
          </div>
        </div>
        <div>
          <div className={styles.metaLabel}>Pelanggan</div>
          <div className={styles.metaValue}>{faktur.customerName}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>NPWP pelanggan</div>
          <div className={styles.metaValue}>{faktur.customerNpwp ?? '—'}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>Tanggal</div>
          <div className={styles.metaValue}>{faktur.invoiceDate}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>Masa pajak</div>
          <div className={styles.metaValue}>{faktur.taxPeriod}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>Kode pajak</div>
          <div className={styles.metaValue}>{`${faktur.taxCode} · ${formatTarif(faktur.taxRate)}`}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>DPP</div>
          <div className={styles.metaValue}>
            {formatAmount(faktur.baseAmount, konteks.currency)}
          </div>
        </div>
        <div>
          <div className={styles.metaLabel}>PPN</div>
          <div className={styles.metaValue}>{formatAmount(faktur.taxAmount, konteks.currency)}</div>
        </div>
      </div>

      {faktur.status === 'cancelled' ? (
        <p className={styles.noticeDanger} role="status">
          {`Dibatalkan${faktur.cancelledAt === null ? '' : ` pada ${faktur.cancelledAt.slice(0, 10)}`}. Alasan: ${faktur.cancelReason ?? '(tidak dicatat)'} — nomor ${faktur.formattedNumber ?? ''} tidak kembali ke pool dan tidak dapat dipakai ulang.`}
        </p>
      ) : null}

      <table className={styles.matchTable}>
        <caption>
          Faktur penjualan yang dicakup — satu faktur pajak dapat mencakup lebih dari satu
        </caption>
        <thead>
          <tr>
            <th scope="col">Faktur penjualan</th>
            <th scope="col" data-numeric="true">
              DPP
            </th>
            <th scope="col" data-numeric="true">
              PPN
            </th>
          </tr>
        </thead>
        <tbody>
          {faktur.sources.length === 0 ? (
            <tr>
              <td colSpan={3}>Tidak ada faktur penjualan yang tercatat sebagai sumber.</td>
            </tr>
          ) : (
            faktur.sources.map((sumber) => (
              <tr key={sumber.salesDocumentId}>
                <td>{sumber.salesDocumentNumber ?? '(belum bernomor)'}</td>
                <td data-numeric="true">{formatAmount(sumber.baseAmount, konteks.currency)}</td>
                <td data-numeric="true">{formatAmount(sumber.taxAmount, konteks.currency)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div>
        <Button variant="secondary" onClick={() => pergiKe('pajak/keluaran')}>
          Kembali ke daftar
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

export function DaftarFakturMasukan({ konteks }: { readonly konteks: Konteks }): ReactNode {
  const [state, setState] = useState<TableState<FakturMasukan>>({ kind: 'loading' })

  async function muat(): Promise<void> {
    setState({ kind: 'loading' })
    try {
      const jawaban = await api.get<FakturMasukan[]>(
        `${perusahaan(konteks.companyId)}/input-tax-invoices`,
      )
      setState(
        jawaban.data.length === 0
          ? { kind: 'empty' }
          : {
              kind: 'ready',
              rows: jawaban.data,
              total: jawaban.data.length,
              nextCursor: jawaban.meta?.next_cursor ?? null,
            },
      )
    } catch (galat) {
      setState({
        kind: 'error',
        message:
          galat instanceof ApiError ? galat.message : 'Tidak dapat memuat faktur pajak masukan.',
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
        header: 'Nomor faktur vendor',
        identifier: true,
        sortable: true,
        cell: (row) => row.supplierNumber,
        sortValue: (row) => row.supplierNumber,
      },
      {
        id: 'vendor',
        header: 'Vendor',
        cell: (row) => (row.vendorIsPkp ? row.vendorName : `${row.vendorName} (non-PKP)`),
      },
      { id: 'npwp', header: 'NPWP vendor', cell: (row) => row.vendorNpwp ?? '—' },
      {
        id: 'date',
        header: 'Tanggal',
        sortable: true,
        cell: (row) => row.invoiceDate,
        sortValue: (row) => row.invoiceDate,
      },
      { id: 'period', header: 'Masa', cell: (row) => row.taxPeriod },
      {
        id: 'credit_period',
        header: 'Masa kredit',
        // Boleh berbeda dari masa fakturnya. Menyamakan keduanya di layar akan
        // menyembunyikan faktur yang sengaja dikreditkan di masa lain.
        cell: (row) => row.creditPeriod ?? '—',
      },
      {
        id: 'tax',
        header: 'PPN',
        align: 'end',
        sortable: true,
        cell: (row) => formatAmount(row.taxAmount, konteks.currency),
        sortValue: (row) => row.taxAmount,
      },
      {
        id: 'kelengkapan',
        header: 'Kelengkapan',
        cell: (row) => {
          if (row.validatedAt === null) return <Badge>Belum divalidasi</Badge>
          if (row.defects.length === 0) {
            return (
              <Badge tone={row.isCreditable ? 'success' : 'warning'}>
                {row.isCreditable ? 'Lengkap — dapat dikreditkan' : 'Lengkap — tidak dikreditkan'}
              </Badge>
            )
          }
          return (
            <span>
              <Badge tone="danger">
                {row.defects.length === 1 ? '1 syarat kurang' : `${row.defects.length} syarat kurang`}
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
    [konteks.currency],
  )

  return (
    <DataTable
      caption="Faktur Pajak Masukan"
      columns={columns}
      state={state}
      rowId={(row) => row.id}
      // Belum ada layar detail faktur masukan, dan menautkan ke halaman yang
      // tidak ada lebih buruk daripada menautkan ke diri sendiri. Seluruh yang
      // perlu dibaca — termasuk apa yang kurang — sudah ada di baris ini.
      rowHref={() => '#/pajak/masukan'}
      filter={{}}
      sort={[]}
      companyName={konteks.companyName}
      emptyAction={
        <Button variant="secondary" onClick={() => pergiKe('pembelian/tagihan')}>
          Buka faktur pembelian
        </Button>
      }
      onSortChange={() => undefined}
      onRetry={() => void muat()}
    />
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
        kesalahan instanceof ApiError ? kesalahan.message : 'Tidak dapat memuat rekonsiliasi.',
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
          <div className={styles.metaLabel}>Company</div>
          <div className={styles.metaValue}>{konteks.companyName}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>Masa pajak</div>
          <div className={styles.metaValue}>{hasil?.period ?? dipilih}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>Keadaan</div>
          <div className={styles.metaValue}>
            {hasil === null ? (
              '—'
            ) : hasil.balanced ? (
              <Badge tone="success">Cocok</Badge>
            ) : (
              <Badge tone="danger">Ada selisih</Badge>
            )}
          </div>
        </div>
      </div>

      <div className={styles.row}>
        <Select
          id="masa-pajak"
          label="Masa pajak"
          helper="Bulan kalender. Masa pajak tidak mengikuti tahun fiskal company."
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
          Tidak ada pajak tercatat pada masa ini. Buku pajak dan buku besar sama-sama kosong, dan
          itu memang cocok.
        </p>
      ) : null}

      {hasil !== null && hasil.rows.length > 0 ? (
        <>
          <table className={styles.matchTable}>
            <caption>
              Buku pajak berdampingan dengan akun pajak di buku besar — selisih dihitung per kode
              pajak
            </caption>
            <thead>
              <tr>
                <th scope="col">Akun buku besar</th>
                <th scope="col">Kode pajak yang mengisinya</th>
                <th scope="col" data-numeric="true">
                  Buku pajak
                </th>
                <th scope="col" data-numeric="true">
                  Buku besar
                </th>
                <th scope="col" data-numeric="true">
                  Selisih
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
                      ? '(tidak ada baris buku pajak)'
                      : baris.codes
                          .map(
                            (kode) =>
                              `${kode.tax_code} ${formatAmount(kode.tax_ledger_total, konteks.currency)}`,
                          )
                          .join(' · ')}
                  </td>
                  <td data-numeric="true">
                    {formatAmount(baris.tax_ledger_total, konteks.currency)}
                  </td>
                  <td data-numeric="true">
                    {formatAmount(baris.general_ledger_total, konteks.currency)}
                  </td>
                  <td data-numeric="true">{formatAmount(baris.difference, konteks.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className={hasil.balanced ? styles.noticeSuccess : styles.noticeDanger} role="status">
            {hasil.balanced
              ? 'Setiap akun pajak cocok antara buku pajak dan buku besar.'
              : `${hasil.rows.filter((baris) => baris.difference !== 0).length} akun berselisih. Baris yang bertanda di atas menunjukkan akun mana, beserta kode pajak yang mengisi sisi buku pajaknya.`}
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
      daftar.push({ fieldId: 'tarif-baru', label: 'Tarif baru', message: 'Isi dengan angka.' })
    } else if (angka < 0 || angka > 100) {
      daftar.push({
        fieldId: 'tarif-baru',
        label: 'Tarif baru',
        message: 'Nilainya antara 0 dan 100.',
      })
    }

    if (berlaku === null) {
      daftar.push({
        fieldId: 'berlaku-dari',
        label: 'Berlaku dari',
        message: 'Isi tanggal mulai berlakunya versi baru.',
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
        `Versi baru ${dasar.code} dibuat. Versi ${formatTarif(dasar.rate)} ditutup pada ${tanggalKeTeks(berlaku)}.`,
      )
    } catch (galat) {
      // Pesan server sudah menjelaskan sebabnya dengan tepat — "harus berlaku
      // setelah …", "versi sebelumnya sudah ditutup …". Mengarang pesan sendiri
      // di sini akan menggantikan yang benar dengan yang umum.
      setGalatServer(
        galat instanceof ApiError ? galat.message : 'Versi baru tidak dapat disimpan.',
      )
    } finally {
      setMenyimpan(false)
    }
  }

  return (
    <section className={styles.stack} aria-label={`Versi baru untuk ${dasar.code}`}>
      <h3>{`Versi baru untuk ${dasar.code}`}</h3>

      <p className={styles.notice}>
        {`Tarif tidak pernah diubah. Menyimpan formulir ini MEMBUAT VERSI BARU: versi ${formatTarif(dasar.rate)} yang berlaku sejak ${dasar.validFrom} akan ditutup pada tanggal yang Anda isi di bawah, dan seluruh dokumen bertanggal sebelum tanggal itu tetap dihitung dengan tarif lama.`}
      </p>

      <ErrorSummary errors={errors} />

      {galatServer !== null ? (
        <p className={styles.noticeDanger} role="alert">
          {galatServer}
        </p>
      ) : null}

      <TextField id="kode-pajak" label="Kode" value={dasar.code} readOnly onChange={() => undefined} />
      <TextField
        id="jenis-pajak"
        label="Jenis pajak"
        value={LABEL_JENIS[dasar.taxType] ?? dasar.taxType}
        readOnly
        onChange={() => undefined}
      />
      <TextField id="nama-pajak" label="Nama" value={nama} onChange={setNama} />
      <TextField
        id="tarif-baru"
        label="Tarif baru"
        required
        value={tarif}
        placeholder="11"
        helper="Dalam persen. Tarif versi ini tidak dapat diubah lagi setelah disimpan."
        {...galatField(errors, 'tarif-baru')}
        onChange={setTarif}
      />
      <DateField
        id="berlaku-dari"
        label="Berlaku dari"
        required
        value={berlaku}
        helper="Hari pertama versi baru berlaku, sekaligus hari versi lama berhenti berlaku."
        {...galatField(errors, 'berlaku-dari')}
        onChange={setBerlaku}
      />
      <Select
        id="dasar-hitung"
        label="Dasar perhitungan"
        value={dasarHitung}
        options={[
          { value: 'net', label: 'Neto — tarif dikalikan ke dasar' },
          { value: 'gross', label: 'Bruto — dasar dikeluarkan dari nilai termasuk pajak' },
        ]}
        onChange={setDasarHitung}
      />
      <Select
        id="akun-pajak"
        label="Akun buku besar"
        value={akunId}
        options={akun.map((item) => ({ value: item.id, label: `${item.code} — ${item.name}` }))}
        onChange={setAkunId}
      />
      <Checkbox
        id="dapat-dikreditkan"
        label="Dapat dikreditkan"
        checked={kreditable}
        onChange={setKreditable}
      />

      <div className={styles.row}>
        <Button variant="ghost" onClick={onBatal}>
          Batal
        </Button>
        <Button loading={menyimpan} onClick={() => void simpan()}>
          Buat versi baru
        </Button>
      </div>
    </section>
  )
}
