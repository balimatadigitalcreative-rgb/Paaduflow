import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import type {
  GoodsReceiptSummary,
  MatchPanel,
  PurchaseDocumentDetail,
  PurchaseDocumentSummary,
  WarehouseOption,
} from '#application/queries'
import { formatAmount } from '#shared/money-format'

import { api, ApiError, perusahaan } from '../api/client.js'
import { Badge, StatusBadge, type DocumentStatus } from '../components/badge.js'
import { Button } from '../components/button.js'
import { FilterBar, type FilterChip } from '../components/filter-bar.js'
import { Tabs, TabPanel } from '../components/tabs.js'
import { useToast } from '../components/toast.js'
import { useHeaderHalaman } from '../shell/page-header.js'
import { DataTable } from '../components/table/data-table.js'
import { useTabel } from '../components/table/use-tabel.js'
import { usePreferences } from '../shell/preferences.js'
import type { Column, TableState } from '../components/table/types.js'
import { TextField } from '../components/text-field.js'
import { href, pergiKe } from '../router.js'
import styles from './pages.module.css'

/**
 * Layar Pembelian: daftar pesanan, penerimaan barang, dan tagihan dengan panel
 * pencocokan tiga arah.
 *
 * Panel pencocokan adalah alasan utama layar ini ada. Angkanya datang **dari
 * server**, dihitung oleh fungsi yang sama dengan yang dipakai posting. Layar
 * tidak menghitung ulang apa pun: panel yang memakai rumusnya sendiri akan
 * suatu hari menampilkan hijau pada tagihan yang ditolak posting, dan orang
 * akan percaya pada yang hijau.
 */

interface Konteks {
  readonly companyId: string
  readonly companyName: string
}

const STATUS_DIKENAL = new Set([
  'draft',
  'submitted',
  'pending_approval',
  'approved',
  'rejected',
  'posted',
  'cancelled',
  'void',
  'closed',
])

function status(nilai: string): DocumentStatus {
  return (STATUS_DIKENAL.has(nilai) ? nilai : 'draft') as DocumentStatus
}

const LABEL_PENCOCOKAN: Record<string, { teks: string; nada: 'neutral' | 'success' | 'danger' | 'warning' }> = {
  not_matched: { teks: 'Belum dicocokkan', nada: 'neutral' },
  matched: { teks: 'Cocok', nada: 'success' },
  exception: { teks: 'Ada selisih', nada: 'danger' },
  overridden: { teks: 'Selisih disetujui', nada: 'warning' },
}

// ── Daftar dokumen pembelian ───────────────────────────────────────────────

/**
 * Quick filter chips ditetapkan saat desain modul — Component_Specs_Composite §2.
 *
 * Berbeda per jenis dokumen, karena pertanyaan yang dibawa orang ke kedua daftar
 * memang berbeda. Ke pesanan: mana yang masih menunggu persetujuan, mana yang
 * barangnya belum datang. Ke tagihan: mana yang belum diposting, mana yang belum
 * dibayar.
 */
const CHIP_PESANAN: readonly FilterChip[] = [
  { id: 'draft', label: 'Draf' },
  { id: 'pending_approval', label: 'Menunggu persetujuan' },
  { id: 'approved', label: 'Disetujui' },
]

const CHIP_TAGIHAN: readonly FilterChip[] = [
  { id: 'draft', label: 'Draf' },
  { id: 'approved', label: 'Siap diposting' },
  { id: 'posted', label: 'Terposting' },
]

export function DaftarPembelian({
  konteks,
  docType,
}: {
  readonly konteks: Konteks
  readonly docType: 'purchase_order' | 'bill'
}): ReactNode {
  const [state, setState] = useState<TableState<PurchaseDocumentSummary>>({ kind: 'loading' })
  const [semua, setSemua] = useState<readonly PurchaseDocumentSummary[]>([])
  const [filterAktif, setFilterAktif] = useState<readonly string[]>([])

  const chips = docType === 'bill' ? CHIP_TAGIHAN : CHIP_PESANAN
  const labelFilter = (id: string): string =>
    chips.find((chip) => chip.id === id)?.label ?? id

  /**
   * "Belum ada dokumen" dan "ada dokumen, filternya tidak cocok" adalah dua
   * keadaan berbeda dengan tindakan berbeda — §1.8. Menyamakan keduanya membuat
   * orang yang salah menyetel filter menyimpulkan datanya hilang.
   */
  function tampilkan(baris: readonly PurchaseDocumentSummary[], filter: readonly string[]): void {
    if (baris.length === 0) {
      setState({ kind: 'empty' })
      return
    }

    const cocok =
      filter.length === 0 ? baris : baris.filter((row) => filter.includes(row.lifecycleStatus))

    if (cocok.length === 0) {
      setState({ kind: 'no_match', activeFilters: filter.map(labelFilter) })
      return
    }

    setState({ kind: 'ready', rows: cocok, total: cocok.length, nextCursor: null })
  }

  async function muat(): Promise<void> {
    setState({ kind: 'loading' })
    try {
      const jawaban = await api.get<PurchaseDocumentSummary[]>(
        `${perusahaan(konteks.companyId)}/purchase-documents?doc_type=${docType}`,
      )
      setSemua(jawaban.data)
      tampilkan(jawaban.data, filterAktif)
    } catch (galat) {
      setState({
        kind: 'error',
        message: galat instanceof ApiError ? galat.message : 'Tidak dapat memuat daftar.',
      })
    }
  }

  useEffect(() => {
    void muat()
  }, [konteks.companyId, docType])

  function ubahFilter(berikut: readonly string[]): void {
    setFilterAktif(berikut)
    tampilkan(semua, berikut)
  }

  const columns: readonly Column<PurchaseDocumentSummary>[] = useMemo(() => {
    const dasar: Column<PurchaseDocumentSummary>[] = [
      {
        id: 'number',
        header: 'Nomor',
        identifier: true,
        sortable: true,
        cell: (row) => row.number ?? '(draf)',
        sortValue: (row) => row.number ?? '',
      },
      {
        id: 'date',
        header: 'Tanggal',
        sortable: true,
        cell: (row) => row.issueDate,
        sortValue: (row) => row.issueDate,
      },
      {
        id: 'vendor',
        header: 'Vendor',
        sortable: true,
        cell: (row) => row.vendorName,
        sortValue: (row) => row.vendorName,
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => <StatusBadge status={status(row.lifecycleStatus)} />,
      },
    ]

    // Kolom pencocokan hanya bermakna untuk tagihan; pesanan tidak dicocokkan.
    if (docType === 'bill') {
      dasar.push({
        id: 'match',
        header: 'Pencocokan',
        cell: (row) => {
          const label = LABEL_PENCOCOKAN[row.matchStatus]
          return <Badge tone={label?.nada ?? 'neutral'}>{label?.teks ?? row.matchStatus}</Badge>
        },
      })
    }

    dasar.push({
      id: 'total',
      header: 'Total',
      align: 'end',
      sortable: true,
      cell: (row) => formatAmount(row.total, row.currency),
      sortValue: (row) => row.total,
    })

    return dasar
  }, [docType])

  const { preferences } = usePreferences()
  const tabel = useTabel(columns, (row) => [row.number, row.vendorName])

  return (
    <div className={styles.stack}>
      <FilterBar
        label={
          docType === 'bill'
            ? 'Saring tagihan menurut status'
            : 'Saring pesanan menurut status'
        }
        chips={chips}
        activeIds={filterAktif}
        search={{
          value: tabel.kueri,
          label: 'Cari nomor atau vendor',
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

      {/*
        Aksi state kosong mengarah ke langkah yang benar-benar pertama.
        Pembelian bermula dari pesanan, bukan dari tagihan — menawarkan "buat
        tagihan" di company yang belum punya apa pun akan mengantar orang ke
        form yang gagal di field pertama.
      */}
      <DataTable
        caption={docType === 'bill' ? 'Faktur Pembelian' : 'Pesanan Pembelian'}
        columns={columns}
        state={tabel.terapkan(state, filterAktif.map(labelFilter))}
        rowId={(row) => row.id}
        rowHref={(row) =>
          href(docType === 'bill' ? `pembelian/tagihan/${row.id}` : `pembelian/pesanan/${row.id}`)
        }
        filter={Object.fromEntries(filterAktif.map((id) => [id, 'aktif']))}
        activeFilterLabels={filterAktif.map(labelFilter)}
        sort={tabel.sort}
        density={preferences.density}
        companyName={konteks.companyName}
        emptyAction={
          <Button variant="secondary" onClick={() => pergiKe('pembelian/pesanan')}>
            {docType === 'bill' ? 'Mulai dari pesanan pembelian' : 'Pelajari alur pembelian'}
          </Button>
        }
        onSortChange={tabel.setSort}
        onRetry={() => void muat()}
        onClearFilters={() => ubahFilter([])}
      />
    </div>
  )
}

// ── Detail pesanan, dengan pencatatan penerimaan ───────────────────────────

/**
 * Menurunkan sumbu penerimaan dan penagihan dari kuantitas per baris.
 *
 * Tiga keadaan, bukan dua: belum sama sekali, sebagian, dan penuh. "Sebagian"
 * adalah keadaan yang paling sering terjadi dan paling sering hilang kalau
 * hanya ada penanda biner - dan justru itulah yang perlu dilihat orang
 * pembelian sebelum menyetujui tagihan.
 */
function ringkasKuantitas(
  dokumen: PurchaseDocumentDetail | null,
  ambil: (baris: PurchaseDocumentDetail['lines'][number]) => number,
  kata: string,
): { readonly label: string; readonly penuh: boolean } {
  if (dokumen === null || dokumen.lines.length === 0) {
    return { label: `Belum ${kata}`, penuh: false }
  }

  const dipesan = dokumen.lines.reduce((jumlah, baris) => jumlah + baris.qty, 0)
  const terpenuhi = dokumen.lines.reduce((jumlah, baris) => jumlah + ambil(baris), 0)

  if (terpenuhi <= 0) return { label: `Belum ${kata}`, penuh: false }
  if (terpenuhi >= dipesan) return { label: `${kata[0]!.toUpperCase()}${kata.slice(1)} penuh`, penuh: true }
  return { label: `Sebagian ${kata}`, penuh: false }
}

export function DetailPesanan({
  konteks,
  documentId,
}: {
  readonly konteks: Konteks
  readonly documentId: string
}): ReactNode {
  const [dokumen, setDokumen] = useState<PurchaseDocumentDetail | null>(null)
  const [terima, setTerima] = useState<Record<string, string>>({})
  const [gudang, setGudang] = useState<readonly WarehouseOption[]>([])
  const [galat, setGalat] = useState<string | null>(null)
  const [sedang, setSedang] = useState(false)
  const [tab, setTab] = useState('ringkasan')
  const toast = useToast()

  async function muat(): Promise<void> {
    try {
      const jawaban = await api.get<PurchaseDocumentDetail>(
        `${perusahaan(konteks.companyId)}/purchase-documents/${documentId}`,
      )
      setDokumen(jawaban.data)
    } catch (kesalahan) {
      setGalat(kesalahan instanceof ApiError ? kesalahan.message : 'Tidak dapat memuat pesanan.')
    }
  }

  useEffect(() => {
    void muat()
    void api
      .get<WarehouseOption[]>(`${perusahaan(konteks.companyId)}/warehouses`)
      .then((jawaban) => setGudang(jawaban.data))
      .catch(() => undefined)
  }, [documentId])

  /*
   * Tiga sumbu status di page header, tab baku di bawahnya.
   *
   * `purchase_documents` TIDAK menyimpan `settlement_status` maupun
   * `fulfillment_status` - ia hanya punya `lifecycle_status` dan
   * `match_status`. Penyimpangan dari aturan tiga sumbu itu ada di skema, dan
   * memperbaikinya adalah migrasi tersendiri, bukan pekerjaan layar.
   *
   * Yang dilakukan di sini: menurunkan kedua sumbu sisanya dari kuantitas per
   * baris, yang memang sudah dikirim dan memang sumber kebenarannya. Angkanya
   * dihitung dari data yang sama dengan yang ditampilkan tab Baris, jadi tidak
   * ada dua rumus yang dapat menyimpang. Ini bukan pengganti kolomnya - ini
   * cara jujur menampilkan apa yang benar-benar diketahui sistem hari ini.
   */
  const penerimaan = ringkasKuantitas(dokumen, (baris) => baris.qtyReceived, 'diterima')
  const penagihan = ringkasKuantitas(dokumen, (baris) => baris.qtyBilled, 'ditagih')

  useHeaderHalaman(
    () =>
      dokumen === null
        ? {}
        : {
            badges: (
              <>
                <StatusBadge status={status(dokumen.lifecycleStatus)} />
                <Badge tone={penerimaan.penuh ? 'success' : 'neutral'}>{penerimaan.label}</Badge>
                <Badge tone={penagihan.penuh ? 'success' : 'neutral'}>{penagihan.label}</Badge>
              </>
            ),
            tabs: (
              <Tabs
                label="Bagian pesanan"
                activeId={tab}
                onSelect={setTab}
                items={[
                  { id: 'ringkasan', label: 'Ringkasan' },
                  { id: 'baris', label: 'Baris', count: dokumen.lines.length },
                  {
                    id: 'terkait',
                    label: 'Dokumen terkait',
                    count: dokumen.sourceDocumentId === null ? 0 : 1,
                  },
                  { id: 'aktivitas', label: 'Aktivitas' },
                ]}
              />
            ),
          },
    [dokumen, tab, penerimaan.label, penagihan.label],
  )

  async function catatPenerimaan(): Promise<void> {
    if (dokumen === null) return
    setGalat(null)
    setSedang(true)

    try {
      const baris = dokumen.lines
        .map((item) => ({ po_line_id: item.id, qty_received: Number(terima[item.id] ?? '0') }))
        .filter((item) => item.qty_received > 0)

      if (baris.length === 0) {
        setGalat('Isi kuantitas diterima pada sedikitnya satu baris.')
        return
      }

      const gudangTujuan = gudang[0]
      if (gudangTujuan === undefined) {
        // Dinyatakan, bukan dibiarkan gagal sebagai galat validasi server yang
        // menyebut nama kolom.
        setGalat('Company ini belum punya gudang. Buat gudang lebih dulu.')
        return
      }

      await api.post(`${perusahaan(konteks.companyId)}/goods-receipts`, {
        purchase_order_id: documentId,
        warehouse_id: gudangTujuan.id,
        received_date: new Date().toISOString().slice(0, 10),
        lines: baris,
      })
      /*
       * Toast yang menyebut objeknya - Component_Specs_Composite section 6.
       *
       * "Penerimaan dicatat" tidak dapat diverifikasi orang gudang yang sedang
       * menangani lima pesanan sekaligus. Nomor pesanan dan jumlah barisnya
       * membuat konfirmasi ini dapat dicocokkan dengan yang ada di tangannya.
       *
       * Aman sebagai toast: seluruh isinya tetap ada di halaman setelah
       * dokumen dimuat ulang. Toast yang membawa satu-satunya salinan sebuah
       * informasi adalah bug.
       */
      toast({
        message: `Penerimaan atas ${dokumen.number ?? 'pesanan ini'} tercatat untuk ${baris.length} baris. Persediaan bertambah.`,
        tone: 'baik',
      })
      setTerima({})
      await muat()
    } catch (kesalahan) {
      setGalat(
        kesalahan instanceof ApiError ? kesalahan.message : 'Penerimaan tidak dapat dicatat.',
      )
    } finally {
      setSedang(false)
    }
  }

  if (dokumen === null) {
    return galat === null ? <p>Memuat…</p> : <p className={styles.noticeDanger}>{galat}</p>
  }

  const dapatMenerima = dokumen.lifecycleStatus === 'approved'

  return (
    <div className={styles.stack}>
      {galat !== null ? <p className={`${styles.notice} ${styles.noticeDanger}`}>{galat}</p> : null}

      <TabPanel id="ringkasan" activeId={tab}>
      <div className={styles.meta}>
        <div>
          <div className={styles.metaLabel}>Nomor</div>
          <div className={styles.metaValue}>{dokumen.number ?? '(belum bernomor)'}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>Vendor</div>
          <div className={styles.metaValue}>
            {dokumen.vendorName} {dokumen.vendorIsPkp ? <Badge tone="accent">PKP</Badge> : null}
          </div>
        </div>
        <div>
          <div className={styles.metaLabel}>Total</div>
          <div className={styles.metaValue}>{formatAmount(dokumen.total, dokumen.currency)}</div>
        </div>
      </div>
      </TabPanel>

      <TabPanel id="baris" activeId={tab}>
      <table className={styles.matchTable}>
        <caption>
          Baris pesanan — kuantitas diterima dan ditagih dilacak per baris, bukan per dokumen
        </caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Deskripsi</th>
            <th scope="col" data-numeric="true">
              Dipesan
            </th>
            <th scope="col" data-numeric="true">
              Diterima
            </th>
            <th scope="col" data-numeric="true">
              Ditagih
            </th>
            <th scope="col" data-numeric="true">
              Harga satuan
            </th>
            {dapatMenerima ? <th scope="col">Terima sekarang</th> : null}
          </tr>
        </thead>
        <tbody>
          {dokumen.lines.map((baris) => (
            <tr key={baris.id}>
              <td>{baris.lineNo}</td>
              <td>{baris.description}</td>
              <td data-numeric="true">
                {baris.qty} {baris.uom}
              </td>
              <td data-numeric="true">{baris.qtyReceived}</td>
              <td data-numeric="true">{baris.qtyBilled}</td>
              <td data-numeric="true">{formatAmount(baris.unitPrice, dokumen.currency)}</td>
              {dapatMenerima ? (
                <td>
                  <TextField
                    label={`Diterima baris ${baris.lineNo}`}
                    value={terima[baris.id] ?? ''}
                    onChange={(nilai) => setTerima((lama) => ({ ...lama, [baris.id]: nilai }))}
                  />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      </TabPanel>

      {/*
        Jejak dua arah - Flow_Archetypes 3. Pesanan menunjuk dokumen sumbernya
        bila ia lahir dari RFQ; arah sebaliknya belum dibangun.
      */}
      <TabPanel id="terkait" activeId={tab}>
        {dokumen.sourceDocumentId === null ? (
          <p className={styles.notice}>
            Pesanan ini dibuat langsung, bukan dari RFQ. Penerimaan dan tagihan yang lahir
            darinya belum ditautkan balik ke sini.
          </p>
        ) : (
          <div className={styles.meta}>
            <div>
              <div className={styles.metaLabel}>Dokumen sumber</div>
              <div className={styles.metaValue}>{dokumen.sourceDocumentId}</div>
            </div>
          </div>
        )}
      </TabPanel>

      <TabPanel id="aktivitas" activeId={tab}>
        <p className={styles.notice}>
          Audit trail belum tersedia di antarmuka. Perubahan sudah tercatat di{' '}
          <code>audit_log</code>, tetapi jalur bacanya belum dibangun.
        </p>
      </TabPanel>

      <div className={styles.row}>
        {dapatMenerima ? (
          <Button loading={sedang} onClick={() => void catatPenerimaan()}>
            Catat penerimaan
          </Button>
        ) : (
          <p className={styles.notice}>
            Penerimaan hanya dapat dicatat atas pesanan berstatus disetujui.
          </p>
        )}
        <Button variant="ghost" onClick={() => pergiKe('pembelian/pesanan')}>
          Kembali ke daftar
        </Button>
      </div>
    </div>
  )
}

// ── Daftar penerimaan ──────────────────────────────────────────────────────

export function DaftarPenerimaan({ konteks }: { readonly konteks: Konteks }): ReactNode {
  const [state, setState] = useState<TableState<GoodsReceiptSummary>>({ kind: 'loading' })

  async function muat(): Promise<void> {
    setState({ kind: 'loading' })
    try {
      const jawaban = await api.get<GoodsReceiptSummary[]>(
        `${perusahaan(konteks.companyId)}/goods-receipts`,
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
        message: galat instanceof ApiError ? galat.message : 'Tidak dapat memuat penerimaan.',
      })
    }
  }

  useEffect(() => {
    void muat()
  }, [konteks.companyId])

  const columns: readonly Column<GoodsReceiptSummary>[] = useMemo(
    () => [
      {
        id: 'number',
        header: 'Nomor',
        identifier: true,
        cell: (row) => row.number ?? '(tanpa nomor)',
      },
      { id: 'date', header: 'Tanggal terima', cell: (row) => row.receivedDate },
      { id: 'po', header: 'Pesanan', cell: (row) => row.purchaseOrderNumber ?? '—' },
      { id: 'vendor', header: 'Vendor', cell: (row) => row.vendorName },
      { id: 'lines', header: 'Jumlah baris', align: 'end', cell: (row) => row.lineCount },
    ],
    [],
  )

  const { preferences } = usePreferences()
  const tabel = useTabel(columns, (row) => [row.number, row.vendorName])

  return (
    <DataTable
      caption="Penerimaan Barang"
      columns={columns}
      state={tabel.terapkan(state, [])}
      rowId={(row) => row.id}
      rowHref={(row) => href(`pembelian/pesanan/${row.purchaseOrderId}`)}
      filter={{}}
      sort={tabel.sort}
      density={preferences.density}
      companyName={konteks.companyName}
      emptyAction={
        <Button variant="secondary" onClick={() => pergiKe('pembelian/pesanan')}>
          Buka pesanan pembelian
        </Button>
      }
      onSortChange={tabel.setSort}
      onRetry={() => void muat()}
    />
  )
}

// ── Tagihan dengan panel pencocokan tiga arah ──────────────────────────────

export function DetailTagihan({
  konteks,
  documentId,
}: {
  readonly konteks: Konteks
  readonly documentId: string
}): ReactNode {
  const [panel, setPanel] = useState<MatchPanel | null>(null)
  const [dokumen, setDokumen] = useState<PurchaseDocumentDetail | null>(null)
  const [galat, setGalat] = useState<string[] | null>(null)
  const [sedang, setSedang] = useState(false)
  const [tab, setTab] = useState('ringkasan')
  const toast = useToast()

  async function muat(): Promise<void> {
    try {
      const [detail, cocok] = await Promise.all([
        api.get<PurchaseDocumentDetail>(
          `${perusahaan(konteks.companyId)}/purchase-documents/${documentId}`,
        ),
        api.get<MatchPanel>(`${perusahaan(konteks.companyId)}/bills/${documentId}/match`),
      ])
      setDokumen(detail.data)
      setPanel(cocok.data)
    } catch (kesalahan) {
      setGalat([kesalahan instanceof ApiError ? kesalahan.message : 'Tidak dapat memuat tagihan.'])
    }
  }

  useEffect(() => {
    void muat()
  }, [documentId])

  async function posting(): Promise<void> {
    setGalat(null)
    setSedang(true)
    try {
      // Tanpa badan permintaan. Tidak ada `force`, dan memang tidak ada bentuk
      // permintaan yang dapat menyatakannya — D-117.
      const jawaban = await api.post<{ journal_id: string }>(
        `${perusahaan(konteks.companyId)}/bills/${documentId}/post`,
      )
      toast({
        message: `Tagihan ${panel?.billNumber ?? 'ini'} diposting. Jurnal ${jawaban.data.journal_id} sudah masuk buku besar.`,
        tone: 'baik',
      })
      await muat()
    } catch (kesalahan) {
      setGalat(
        kesalahan instanceof ApiError
          ? kesalahan.errors.map(
              (butir) => (butir.message as string | undefined) ?? kesalahan.message,
            )
          : ['Posting gagal tanpa keterangan.'],
      )
      await muat()
    } finally {
      setSedang(false)
    }
  }

  /*
   * Tiga sumbu untuk tagihan, dipilih menurut apa yang benar-benar disimpan.
   *
   * Sumbu kedua adalah HASIL PENCOCOKAN TIGA ARAH, bukan pelunasan. Itu bukan
   * kompromi: pencocokan satu-satunya hal yang menentukan boleh-tidaknya
   * tagihan ini diposting, dan ia pertanyaan yang dibawa orang ke layar ini.
   * `purchase_documents` tidak menyimpan pelunasan sama sekali.
   *
   * Sumbu ketiga diturunkan dari kuantitas per baris - sumber yang sama dengan
   * yang ditampilkan tab Baris, jadi tidak ada dua rumus yang dapat menyimpang.
   *
   * Dipanggil SEBELUM return bersyarat di bawah. Hook yang berada di belakang
   * early return akan berubah jumlahnya saat dokumen selesai dimuat, dan itu
   * menghentikan React - bukan sekadar melanggar aturan di atas kertas.
   */
  const label = panel === null ? undefined : LABEL_PENCOCOKAN[panel.matchStatus]
  const penerimaan = ringkasKuantitas(dokumen, (baris) => baris.qtyReceived, 'diterima')

  /*
   * Alasan tagihan tertahan, atau null bila memang tidak ada.
   *
   * Disebut apa adanya termasuk selisihnya. "Gagal pencocokan" tidak dapat
   * ditindaklanjuti; "vendor menagih 14% di atas pesanan" dapat — orang tahu
   * harus menelepon siapa dan menanyakan apa.
   */
  const tertahan =
    panel === null
      ? null
      : panel.matchStatus === 'exception'
        ? 'Pencocokan tiga arah menemukan selisih yang belum disetujui. Periksa tab Baris, lalu setujui pengecualiannya bila selisihnya memang disepakati.'
        : panel.matchStatus === 'not_matched'
          ? 'Pencocokan tiga arah belum dijalankan atas tagihan ini.'
          : null

  useHeaderHalaman(
    () =>
      panel === null || dokumen === null
        ? {}
        : {
            badges: (
              <>
                <StatusBadge status={status(panel.lifecycleStatus)} />
                <Badge tone={label?.nada ?? 'neutral'}>{label?.teks ?? panel.matchStatus}</Badge>
                <Badge tone={penerimaan.penuh ? 'success' : 'neutral'}>{penerimaan.label}</Badge>
              </>
            ),
            tabs: (
              <Tabs
                label="Bagian tagihan"
                activeId={tab}
                onSelect={setTab}
                items={[
                  { id: 'ringkasan', label: 'Ringkasan' },
                  { id: 'baris', label: 'Baris', count: panel.lines.length },
                  {
                    id: 'terkait',
                    label: 'Dokumen terkait',
                    count: dokumen.sourceDocumentId === null ? 0 : 1,
                  },
                  { id: 'aktivitas', label: 'Aktivitas' },
                ]}
              />
            ),
          },
    [panel, dokumen, tab, penerimaan.label, label],
  )

  if (panel === null || dokumen === null) {
    return galat === null ? (
      <p>Memuat…</p>
    ) : (
      <p className={`${styles.notice} ${styles.noticeDanger}`}>{galat.join(' ')}</p>
    )
  }


  return (
    <div className={styles.stack}>
      {galat !== null ? (
        <div className={`${styles.notice} ${styles.noticeDanger}`}>
          <strong>Tagihan tidak dapat diposting.</strong>
          <ul>
            {galat.map((baris) => (
              <li key={baris}>{baris}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <TabPanel id="ringkasan" activeId={tab}>
      <div className={styles.meta}>
        <div>
          <div className={styles.metaLabel}>Nomor</div>
          <div className={styles.metaValue}>{panel.billNumber ?? '(belum bernomor)'}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>Vendor</div>
          <div className={styles.metaValue}>{dokumen.vendorName}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>Pencocokan</div>
          <div className={styles.metaValue}>
            <Badge tone={label?.nada ?? 'neutral'}>{label?.teks ?? panel.matchStatus}</Badge>
          </div>
        </div>
      </div>

      {panel.overrideReason !== null ? (
        <p className={styles.notice}>
          <strong>Pengecualian disetujui:</strong> {panel.overrideReason}
        </p>
      ) : null}

      {/*
        Panel pencocokan tiga arah. Dipesan, diterima, dan ditagih berdampingan
        pada baris yang sama — itu seluruh gunanya. Selisihnya datang dari
        server beserta kalimat penjelasnya.
      */}
      </TabPanel>

      <TabPanel id="baris" activeId={tab}>
      <table className={styles.matchTable}>
        <caption>
          Pencocokan tiga arah — dipesan, diterima, dan ditagih pada baris yang sama
        </caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Deskripsi</th>
            <th scope="col" data-numeric="true">
              Dipesan
            </th>
            <th scope="col" data-numeric="true">
              Diterima
            </th>
            <th scope="col" data-numeric="true">
              Ditagih
            </th>
            <th scope="col" data-numeric="true">
              Harga pesanan
            </th>
            <th scope="col" data-numeric="true">
              Harga tagihan
            </th>
          </tr>
        </thead>
        <tbody>
          {panel.lines.map((baris) => (
            <tr key={baris.lineNo} data-variance={baris.variances.length > 0}>
              <td>{baris.lineNo}</td>
              <td>
                {baris.description}
                {/* Selisih ditulis sebagai teks, bukan hanya diwarnai. Warna
                    sendirian tidak terbaca sebagian orang, dan hilang saat
                    dicetak. */}
                {baris.variances.map((selisih) => (
                  <div key={selisih.kind} className={styles.varianceNote}>
                    {selisih.message}
                  </div>
                ))}
              </td>
              <td data-numeric="true">{baris.qtyOrdered}</td>
              <td data-numeric="true">{baris.qtyReceived}</td>
              <td data-numeric="true">
                {baris.qtyBilled}
                {baris.qtyBilledBefore > 0 ? ` (+${baris.qtyBilledBefore} sebelumnya)` : ''}
              </td>
              <td data-numeric="true">
                {formatAmount(baris.orderedUnitPrice, dokumen.currency)}
              </td>
              <td data-numeric="true">
                {formatAmount(baris.billedUnitPrice, dokumen.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </TabPanel>

      <TabPanel id="terkait" activeId={tab}>
        {dokumen.sourceDocumentId === null ? (
          <p className={styles.notice}>
            Tagihan ini tidak menunjuk pesanan pembelian mana pun. Pencocokan tiga arah tetap
            berjalan atas baris yang ada, tetapi jejak konversinya tidak tercatat.
          </p>
        ) : (
          <div className={styles.meta}>
            <div>
              <div className={styles.metaLabel}>Pesanan pembelian</div>
              <div className={styles.metaValue}>
                <a href={href(`pembelian/pesanan/${dokumen.sourceDocumentId}`)}>
                  Buka pesanan sumber
                </a>
              </div>
            </div>
          </div>
        )}
      </TabPanel>

      <TabPanel id="aktivitas" activeId={tab}>
        <p className={styles.notice}>
          Audit trail belum tersedia di antarmuka. Persetujuan pengecualian tercatat di{' '}
          <code>audit_log</code> beserta alasannya, tetapi jalur bacanya belum dibangun.
        </p>
      </TabPanel>

      {/*
        Tombol posting NONAKTIF saat pencocokan berstatus exception, dengan
        alasannya terlihat di sebelahnya.
        
        Server tetap menolaknya — itu penjaga yang sebenarnya. Tetapi tombol
        aktif yang selalu gagal mengajari orang bahwa penolakan sistem ini acak,
        dan orang yang percaya begitu akan mencari jalan memutar. Menonaktifkan
        beserta sebabnya membuat kontrolnya terbaca sebagai keputusan, bukan
        sebagai gangguan.
      */}
      <div className={styles.stack}>
        {tertahan === null ? null : (
          <p className={`${styles.notice} ${styles.noticeDanger}`} role="status">
            <strong>Tagihan ini belum dapat diposting.</strong> {tertahan}
          </p>
        )}

        <div className={styles.row}>
          {panel.lifecycleStatus === 'approved' ? (
            <Button
              loading={sedang}
              disabled={tertahan !== null}
              onClick={() => void posting()}
            >
              Posting tagihan
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => pergiKe('pembelian/tagihan')}>
            Kembali ke daftar
          </Button>
        </div>
      </div>
    </div>
  )
}
