import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'

import type {
  GoodsReceiptSummary,
  MatchPanel,
  PurchaseDocumentDetail,
  PurchaseDocumentSummary,
  WarehouseOption,
} from '#application/queries'

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
import { useFormat } from '../i18n/use-format.js'
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

/**
 * Nada badge per status pencocokan. Teksnya di berkas locale.
 *
 * Nada adalah keputusan visual dan tinggal di kode; teks adalah bahasa dan
 * tinggal di locale. Sebelumnya keduanya menyatu dalam satu objek, dan yang
 * menyatu seperti itu selalu berakhir setengah diterjemahkan.
 */
const NADA_PENCOCOKAN: Record<string, 'neutral' | 'success' | 'danger' | 'warning'> = {
  not_matched: 'neutral',
  matched: 'success',
  exception: 'danger',
  overridden: 'warning',
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
const CHIP_PESANAN = ['draft', 'pending_approval', 'approved'] as const
const CHIP_TAGIHAN = ['draft', 'approved', 'posted'] as const

export function DaftarPembelian({
  konteks,
  docType,
}: {
  readonly konteks: Konteks
  readonly docType: 'purchase_order' | 'bill'
}): ReactNode {
  const { t } = useTranslation('pembelian')
  const format = useFormat()
  const [state, setState] = useState<TableState<PurchaseDocumentSummary>>({ kind: 'loading' })
  const [semua, setSemua] = useState<readonly PurchaseDocumentSummary[]>([])
  const [filterAktif, setFilterAktif] = useState<readonly string[]>([])

  const chips: readonly FilterChip[] = (docType === 'bill' ? CHIP_TAGIHAN : CHIP_PESANAN).map(
    (id) => ({ id, label: labelFilter(id) }),
  )

  function labelFilter(id: string): string {
    return docType === 'bill'
      ? t(`chipTagihan.${id}` as 'chipTagihan.draft', { defaultValue: id })
      : t(`chipPesanan.${id}` as 'chipPesanan.draft', { defaultValue: id })
  }

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
        message: galat instanceof ApiError ? galat.message : t('daftar.gagal'),
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
        header: t('daftar.kolomNomor'),
        identifier: true,
        sortable: true,
        cell: (row) => row.number ?? t('daftar.belumBernomor'),
        sortValue: (row) => row.number ?? '',
      },
      {
        id: 'date',
        header: t('daftar.kolomTanggal'),
        sortable: true,
        cell: (row) => format.tanggalPendek(row.issueDate),
        sortValue: (row) => row.issueDate,
      },
      {
        id: 'vendor',
        header: t('daftar.kolomVendor'),
        sortable: true,
        cell: (row) => row.vendorName,
        sortValue: (row) => row.vendorName,
      },
      {
        id: 'status',
        header: t('daftar.kolomStatus'),
        cell: (row) => <StatusBadge status={status(row.lifecycleStatus)} />,
      },
    ]

    // Kolom pencocokan hanya bermakna untuk tagihan; pesanan tidak dicocokkan.
    if (docType === 'bill') {
      dasar.push({
        id: 'match',
        header: t('daftar.kolomPencocokan'),
        cell: (row) => (
          <Badge tone={NADA_PENCOCOKAN[row.matchStatus] ?? 'neutral'}>
            {t(`pencocokan.${row.matchStatus}` as 'pencocokan.matched', {
              defaultValue: row.matchStatus,
            })}
          </Badge>
        ),
      })
    }

    dasar.push({
      id: 'total',
      header: t('daftar.kolomTotal'),
      align: 'end',
      sortable: true,
      cell: (row) => format.angka(row.total, row.currency),
      sortValue: (row) => row.total,
    })

    return dasar
  }, [docType, t, format])

  const { preferences } = usePreferences()
  const tabel = useTabel(columns, (row) => [row.number, row.vendorName])

  return (
    <div className={styles.stack}>
      <FilterBar
        label={
          docType === 'bill' ? t('daftar.saringTagihan') : t('daftar.saringPesanan')
        }
        chips={chips}
        activeIds={filterAktif}
        search={{
          value: tabel.kueri,
          label: t('daftar.cari'),
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
        caption={docType === 'bill' ? t('daftar.captionTagihan') : t('daftar.captionPesanan')}
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
            {docType === 'bill' ? t('daftar.kosongTagihan') : t('daftar.kosongPesanan')}
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
/**
 * Ringkasan kuantitas: belum, sebagian, atau penuh.
 *
 * Sebelumnya labelnya dirakit dari potongan — `Belum ${kata}` dan
 * `${kata} penuh` — dan itu bekerja persis selama bahasanya satu. Bahasa
 * Inggris membalik urutannya ("Fully received", bukan "Received fully"), dan
 * perakitan semacam ini tidak punya cara mengetahuinya.
 *
 * Sekarang yang dikembalikan KUNCI, bukan kalimat. Yang memanggil menerjemahkan.
 */
function ringkasKuantitas(
  dokumen: PurchaseDocumentDetail | null,
  ambil: (baris: PurchaseDocumentDetail['lines'][number]) => number,
  sumbu: 'diterima' | 'ditagih',
): { readonly kunci: 'kuantitas.diterima.belum'; readonly penuh: boolean } {
  const kunci = (sisi: 'belum' | 'sebagian' | 'penuh') =>
    `kuantitas.${sumbu}.${sisi}` as 'kuantitas.diterima.belum'

  if (dokumen === null || dokumen.lines.length === 0) {
    return { kunci: kunci('belum'), penuh: false }
  }

  const dipesan = dokumen.lines.reduce((jumlah, baris) => jumlah + baris.qty, 0)
  const terpenuhi = dokumen.lines.reduce((jumlah, baris) => jumlah + ambil(baris), 0)

  if (terpenuhi <= 0) return { kunci: kunci('belum'), penuh: false }
  if (terpenuhi >= dipesan) return { kunci: kunci('penuh'), penuh: true }
  return { kunci: kunci('sebagian'), penuh: false }
}

export function DetailPesanan({
  konteks,
  documentId,
}: {
  readonly konteks: Konteks
  readonly documentId: string
}): ReactNode {
  const { t } = useTranslation('pembelian')
  const format = useFormat()
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
      setGalat(kesalahan instanceof ApiError ? kesalahan.message : t('pesanan.gagalMuat'))
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
                <Badge tone={penerimaan.penuh ? 'success' : 'neutral'}>
                  {t(penerimaan.kunci)}
                </Badge>
                <Badge tone={penagihan.penuh ? 'success' : 'neutral'}>{t(penagihan.kunci)}</Badge>
              </>
            ),
            tabs: (
              <Tabs
                label={t('pesanan.bagian')}
                activeId={tab}
                onSelect={setTab}
                items={[
                  { id: 'ringkasan', label: t('pesanan.tabRingkasan') },
                  { id: 'baris', label: t('pesanan.tabBaris'), count: dokumen.lines.length },
                  {
                    id: 'terkait',
                    label: t('pesanan.tabTerkait'),
                    count: dokumen.sourceDocumentId === null ? 0 : 1,
                  },
                  { id: 'aktivitas', label: t('pesanan.tabAktivitas') },
                ]}
              />
            ),
          },
    [dokumen, tab, penerimaan.kunci, penagihan.kunci, t],
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
        setGalat(t('pesanan.wajibKuantitas'))
        return
      }

      const gudangTujuan = gudang[0]
      if (gudangTujuan === undefined) {
        // Dinyatakan, bukan dibiarkan gagal sebagai galat validasi server yang
        // menyebut nama kolom.
        setGalat(t('pesanan.belumAdaGudang'))
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
        kesalahan instanceof ApiError ? kesalahan.message : t('pesanan.gagalTerima'),
      )
    } finally {
      setSedang(false)
    }
  }

  if (dokumen === null) {
    return galat === null ? (
      <p>{t('pesanan.memuat')}</p>
    ) : (
      <p className={styles.noticeDanger}>{galat}</p>
    )
  }

  const dapatMenerima = dokumen.lifecycleStatus === 'approved'

  return (
    <div className={styles.stack}>
      {galat !== null ? <p className={`${styles.notice} ${styles.noticeDanger}`}>{galat}</p> : null}

      <TabPanel id="ringkasan" activeId={tab}>
      <div className={styles.meta}>
        <div>
          <div className={styles.metaLabel}>{t('pesanan.nomor')}</div>
          <div className={styles.metaValue}>
            {dokumen.number ?? t('daftar.belumBernomor')}
          </div>
        </div>
        <div>
          <div className={styles.metaLabel}>{t('pesanan.vendor')}</div>
          <div className={styles.metaValue}>
            {dokumen.vendorName} {dokumen.vendorIsPkp ? <Badge tone="accent">PKP</Badge> : null}
          </div>
        </div>
        <div>
          <div className={styles.metaLabel}>{t('pesanan.total')}</div>
          <div className={styles.metaValue}>{format.angka(dokumen.total, dokumen.currency)}</div>
        </div>
      </div>
      </TabPanel>

      <TabPanel id="baris" activeId={tab}>
      <table className={styles.matchTable}>
        <caption>
          {t('pesanan.captionBaris')}
        </caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">{t('pesanan.kolomDeskripsi')}</th>
            <th scope="col" data-numeric="true">
              {t('pesanan.kolomDipesan')}
            </th>
            <th scope="col" data-numeric="true">
              {t('pesanan.kolomDiterima')}
            </th>
            <th scope="col" data-numeric="true">
              {t('pesanan.kolomDitagih')}
            </th>
            <th scope="col" data-numeric="true">
              {t('pesanan.kolomHargaSatuan')}
            </th>
            {dapatMenerima ? <th scope="col">{t('pesanan.kolomTerimaSekarang')}</th> : null}
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
              <td data-numeric="true">{format.angka(baris.unitPrice, dokumen.currency)}</td>
              {dapatMenerima ? (
                <td>
                  <TextField
                    label={t('pesanan.terimaBaris', { nomor: baris.lineNo })}
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
            {t('pesanan.tanpaSumber')}
          </p>
        ) : (
          <div className={styles.meta}>
            <div>
              <div className={styles.metaLabel}>{t('pesanan.dokumenSumber')}</div>
              <div className={styles.metaValue}>{dokumen.sourceDocumentId}</div>
            </div>
          </div>
        )}
      </TabPanel>

      <TabPanel id="aktivitas" activeId={tab}>
        <p className={styles.notice}>
          {t('pesanan.auditBelumAda')} <code>audit_log</code>
          {t('pesanan.auditBelumAdaLanjutan')}
        </p>
      </TabPanel>

      <div className={styles.row}>
        {dapatMenerima ? (
          <Button loading={sedang} onClick={() => void catatPenerimaan()}>
            {t('pesanan.catatPenerimaan')}
          </Button>
        ) : (
          <p className={styles.notice}>
            {t('pesanan.hanyaDisetujui')}
          </p>
        )}
        <Button variant="ghost" onClick={() => pergiKe('pembelian/pesanan')}>
          {t('pesanan.kembali')}
        </Button>
      </div>
    </div>
  )
}

// ── Daftar penerimaan ──────────────────────────────────────────────────────

export function DaftarPenerimaan({ konteks }: { readonly konteks: Konteks }): ReactNode {
  const { t } = useTranslation('pembelian')
  const format = useFormat()
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
        message: galat instanceof ApiError ? galat.message : t('penerimaan.gagal'),
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
        header: t('penerimaan.kolomNomor'),
        identifier: true,
        cell: (row) => row.number ?? '(tanpa nomor)',
      },
      {
        id: 'date',
        header: t('penerimaan.kolomTanggalTerima'),
        cell: (row) => format.tanggalPendek(row.receivedDate),
      },
      { id: 'po', header: t('penerimaan.kolomPesanan'), cell: (row) => row.purchaseOrderNumber ?? '—' },
      { id: 'vendor', header: t('penerimaan.kolomVendor'), cell: (row) => row.vendorName },
      {
        id: 'lines',
        header: t('penerimaan.kolomJumlahBaris'),
        align: 'end',
        cell: (row) => format.bilangan(row.lineCount),
      },
    ],
    [t, format],
  )

  const { preferences } = usePreferences()
  const tabel = useTabel(columns, (row) => [row.number, row.vendorName])

  return (
    <DataTable
      caption={t('penerimaan.caption')}
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
          {t('penerimaan.bukaPesanan')}
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
  const { t } = useTranslation('pembelian')
  const format = useFormat()
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
      setGalat([kesalahan instanceof ApiError ? kesalahan.message : t('tagihan.gagalMuat')])
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
          : [t('tagihan.gagalPosting')],
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
        ? t('tagihan.tertahanSelisih')
        : panel.matchStatus === 'not_matched'
          ? t('tagihan.tertahanBelumCocok')
          : null

  useHeaderHalaman(
    () =>
      panel === null || dokumen === null
        ? {}
        : {
            badges: (
              <>
                <StatusBadge status={status(panel.lifecycleStatus)} />
                <Badge tone={NADA_PENCOCOKAN[panel.matchStatus] ?? 'neutral'}>
                  {t(`pencocokan.${panel.matchStatus}` as 'pencocokan.matched', {
                    defaultValue: panel.matchStatus,
                  })}
                </Badge>
                <Badge tone={penerimaan.penuh ? 'success' : 'neutral'}>
                  {t(penerimaan.kunci)}
                </Badge>
              </>
            ),
            tabs: (
              <Tabs
                label={t('tagihan.bagian')}
                activeId={tab}
                onSelect={setTab}
                items={[
                  { id: 'ringkasan', label: t('tagihan.tabRingkasan') },
                  { id: 'baris', label: t('tagihan.tabBaris'), count: panel.lines.length },
                  {
                    id: 'terkait',
                    label: t('tagihan.tabTerkait'),
                    count: dokumen.sourceDocumentId === null ? 0 : 1,
                  },
                  { id: 'aktivitas', label: t('tagihan.tabAktivitas') },
                ]}
              />
            ),
          },
    [panel, dokumen, tab, penerimaan.kunci, t],
  )

  if (panel === null || dokumen === null) {
    return galat === null ? (
      <p>{t('tagihan.memuat')}</p>
    ) : (
      <p className={`${styles.notice} ${styles.noticeDanger}`}>{galat.join(' ')}</p>
    )
  }


  return (
    <div className={styles.stack}>
      {galat !== null ? (
        <div className={`${styles.notice} ${styles.noticeDanger}`}>
          <strong>{t('tagihan.tidakDapatDiposting')}</strong>
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
          <div className={styles.metaLabel}>{t('tagihan.nomor')}</div>
          <div className={styles.metaValue}>
            {panel.billNumber ?? t('daftar.belumBernomor')}
          </div>
        </div>
        <div>
          <div className={styles.metaLabel}>{t('tagihan.vendor')}</div>
          <div className={styles.metaValue}>{dokumen.vendorName}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>{t('tagihan.pencocokan')}</div>
          <div className={styles.metaValue}>
            <Badge tone={NADA_PENCOCOKAN[panel.matchStatus] ?? 'neutral'}>
              {t(`pencocokan.${panel.matchStatus}` as 'pencocokan.matched', {
                defaultValue: panel.matchStatus,
              })}
            </Badge>
          </div>
        </div>
      </div>

      {panel.overrideReason !== null ? (
        <p className={styles.notice}>
          <strong>{t('tagihan.pengecualianDisetujui')}</strong> {panel.overrideReason}
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
          {t('tagihan.captionBaris')}
        </caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">{t('tagihan.kolomDeskripsi')}</th>
            <th scope="col" data-numeric="true">
              {t('tagihan.kolomDipesan')}
            </th>
            <th scope="col" data-numeric="true">
              {t('tagihan.kolomDiterima')}
            </th>
            <th scope="col" data-numeric="true">
              {t('tagihan.kolomDitagih')}
            </th>
            <th scope="col" data-numeric="true">
              {t('tagihan.kolomHargaPesanan')}
            </th>
            <th scope="col" data-numeric="true">
              {t('tagihan.kolomHargaTagihan')}
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
                {baris.qtyBilledBefore > 0
                  ? t('tagihan.sebelumnya', { jumlah: format.bilangan(baris.qtyBilledBefore) })
                  : ''}
              </td>
              <td data-numeric="true">
                {format.angka(baris.orderedUnitPrice, dokumen.currency)}
              </td>
              <td data-numeric="true">
                {format.angka(baris.billedUnitPrice, dokumen.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </TabPanel>

      <TabPanel id="terkait" activeId={tab}>
        {dokumen.sourceDocumentId === null ? (
          <p className={styles.notice}>
            {t('tagihan.tanpaPesanan')}
          </p>
        ) : (
          <div className={styles.meta}>
            <div>
              <div className={styles.metaLabel}>{t('tagihan.pesananPembelian')}</div>
              <div className={styles.metaValue}>
                <a href={href(`pembelian/pesanan/${dokumen.sourceDocumentId}`)}>
                  {t('tagihan.bukaPesananSumber')}
                </a>
              </div>
            </div>
          </div>
        )}
      </TabPanel>

      <TabPanel id="aktivitas" activeId={tab}>
        <p className={styles.notice}>
          {t('tagihan.auditBelumAda')} <code>audit_log</code>{' '}
          {t('tagihan.auditBelumAdaLanjutan')}
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
            <strong>{t('tagihan.belumDapatDiposting')}</strong> {tertahan}
          </p>
        )}

        <div className={styles.row}>
          {panel.lifecycleStatus === 'approved' ? (
            <Button
              loading={sedang}
              disabled={tertahan !== null}
              onClick={() => void posting()}
            >
              {t('tagihan.posting')}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => pergiKe('pembelian/tagihan')}>
            {t('tagihan.kembali')}
          </Button>
        </div>
      </div>
    </div>
  )
}
