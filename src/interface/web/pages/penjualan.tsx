import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import type {
  SalesDocumentDetail,
  SalesDocumentSummary,
} from '#application/queries'
import { formatAmount } from '#shared/money-format'

import { api, ApiError, perusahaan } from '../api/client.js'
import { Badge, StatusBadge, type DocumentStatus } from '../components/badge.js'
import { Button } from '../components/button.js'
import { Select } from '../components/combobox.js'
import { ErrorSummary, type FieldError } from '../components/form/form.js'
import { DateField } from '../components/pickers.js'
import { FilterBar, type FilterChip } from '../components/filter-bar.js'
import { DataTable } from '../components/table/data-table.js'
import { emptyLine, LineItemEditor, type EditableLine } from '../components/table/line-item-editor.js'
import type { Column, TableState } from '../components/table/types.js'
import { Tabs, TabPanel } from '../components/tabs.js'
import { useHeaderHalaman } from '../shell/page-header.js'
import { href, pergiKe } from '../router.js'
import styles from './pages.module.css'

/**
 * Layar Penjualan: daftar, detail, dan pembuatan faktur.
 *
 * Tujuan seluruh berkas ini satu kalimat: seseorang harus dapat membuat faktur
 * dari layar, mempostingnya, lalu melihat angkanya muncul di buku besar. Segala
 * sesuatu yang tidak melayani kalimat itu sengaja tidak ada.
 */

interface Konteks {
  readonly companyId: string
  readonly companyName: string
  readonly currency: string
}

/** Sumbu kedua dan ketiga — Information Architecture §3. */
const LABEL_PELUNASAN: Record<string, string> = {
  unpaid: 'Belum dibayar',
  partially_paid: 'Dibayar sebagian',
  paid: 'Lunas',
  overdue: 'Jatuh tempo',
  written_off: 'Dihapusbukukan',
}

const LABEL_PEMENUHAN: Record<string, string> = {
  not_fulfilled: 'Belum dikirim',
  partially_fulfilled: 'Terkirim sebagian',
  fulfilled: 'Terkirim',
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

// ── Daftar ─────────────────────────────────────────────────────────────────

/**
 * Quick filter chips ditetapkan saat desain modul, bukan dipilih pengguna —
 * Component_Specs_Composite §2. Ketiganya adalah pertanyaan yang benar-benar
 * dibawa orang ke daftar faktur.
 */
const CHIP_FAKTUR: readonly FilterChip[] = [
  { id: 'draft', label: 'Draf' },
  { id: 'pending_approval', label: 'Menunggu persetujuan' },
  { id: 'posted', label: 'Terposting' },
]

export function DaftarFaktur({ konteks }: { readonly konteks: Konteks }): ReactNode {
  const [state, setState] = useState<TableState<SalesDocumentSummary>>({ kind: 'loading' })
  const [semua, setSemua] = useState<readonly SalesDocumentSummary[]>([])
  const [filterAktif, setFilterAktif] = useState<readonly string[]>([])

  /**
   * Penyaringan dan pemilihan STATE dipisah dari pemuatan.
   *
   * Bedanya penting: "belum ada faktur sama sekali" dan "ada faktur tetapi
   * filternya tidak cocok" menuntut tindakan yang berbeda — membuat faktur
   * pertama, atau menghapus filter. Menyamakan keduanya membuat orang yang
   * salah menyetel filter menyimpulkan datanya hilang (§1.8).
   */
  function tampilkan(baris: readonly SalesDocumentSummary[], filter: readonly string[]): void {
    if (baris.length === 0) {
      setState({ kind: 'empty' })
      return
    }

    const cocok =
      filter.length === 0 ? baris : baris.filter((row) => filter.includes(row.lifecycleStatus))

    if (cocok.length === 0) {
      setState({
        kind: 'no_match',
        activeFilters: filter.map(
          (id) => CHIP_FAKTUR.find((chip) => chip.id === id)?.label ?? id,
        ),
      })
      return
    }

    setState({ kind: 'ready', rows: cocok, total: cocok.length, nextCursor: null })
  }

  async function muat(): Promise<void> {
    setState({ kind: 'loading' })
    try {
      const jawaban = await api.get<SalesDocumentSummary[]>(
        `${perusahaan(konteks.companyId)}/sales-documents`,
      )
      setSemua(jawaban.data)
      tampilkan(jawaban.data, filterAktif)
    } catch (galat) {
      setState({
        kind: 'error',
        message: galat instanceof ApiError ? galat.message : 'Tidak dapat memuat daftar faktur.',
      })
    }
  }

  useEffect(() => {
    void muat()
  }, [konteks.companyId])

  function ubahFilter(berikut: readonly string[]): void {
    setFilterAktif(berikut)
    tampilkan(semua, berikut)
  }

  const columns: readonly Column<SalesDocumentSummary>[] = useMemo(
    () => [
      {
        id: 'number',
        header: 'Nomor',
        identifier: true,
        sortable: true,
        // Draf belum bernomor — nomor diberikan saat submit (D-007). Ia tetap
        // harus dapat dibuka, jadi kolomnya menampilkan penanda, bukan kosong.
        cell: (row) => row.number ?? '(draf)',
        sortValue: (row) => row.number ?? '',
      },
      {
        id: 'date',
        header: 'Tanggal',
        sortable: true,
        cell: (row) => row.documentDate,
        sortValue: (row) => row.documentDate,
      },
      {
        id: 'customer',
        header: 'Customer',
        sortable: true,
        cell: (row) => row.customerName,
        sortValue: (row) => row.customerName,
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => <StatusBadge status={status(row.lifecycleStatus)} />,
      },
      {
        id: 'total',
        header: 'Total',
        align: 'end',
        sortable: true,
        cell: (row) => formatAmount(row.total, row.currency),
        sortValue: (row) => row.total,
      },
    ],
    [],
  )

  return (
    <div className={styles.stack}>
      <FilterBar
        label="Saring faktur menurut status"
        chips={CHIP_FAKTUR}
        activeIds={filterAktif}
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
        caption="Faktur Penjualan"
        columns={columns}
        state={state}
        rowId={(row) => row.id}
        rowHref={(row) => href(`penjualan/${row.id}`)}
        filter={Object.fromEntries(filterAktif.map((id) => [id, 'aktif']))}
        activeFilterLabels={filterAktif.map(
          (id) => CHIP_FAKTUR.find((chip) => chip.id === id)?.label ?? id,
        )}
        sort={[]}
        companyName={konteks.companyName}
        emptyAction={<Button onClick={() => pergiKe('penjualan/baru')}>Buat faktur pertama</Button>}
        onSortChange={() => undefined}
        onRetry={() => void muat()}
        onClearFilters={() => ubahFilter([])}
      />
    </div>
  )
}

// ── Detail ─────────────────────────────────────────────────────────────────

export function DetailFaktur({
  konteks,
  documentId,
}: {
  readonly konteks: Konteks
  readonly documentId: string
}): ReactNode {
  const [dokumen, setDokumen] = useState<SalesDocumentDetail | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const [sedang, setSedang] = useState(false)
  const [tab, setTab] = useState('ringkasan')

  async function muat(): Promise<void> {
    try {
      const jawaban = await api.get<SalesDocumentDetail>(
        `${perusahaan(konteks.companyId)}/sales-documents/${documentId}`,
      )
      setDokumen(jawaban.data)
    } catch (kesalahan) {
      setGalat(kesalahan instanceof ApiError ? kesalahan.message : 'Tidak dapat memuat faktur.')
    }
  }

  useEffect(() => {
    void muat()
  }, [documentId])

  /*
   * Tiga sumbu status tinggal di page header, bukan di dalam salah satu tab.
   *
   * Information Architecture §3 menuntut ketiganya terpisah dengan label jelas;
   * Screen_Specs §5 menempatkannya di page header. Keduanya terpenuhi di sini,
   * dan ada alasan praktis yang lebih kuat dari kepatuhan: status harus terbaca
   * dari tab mana pun. Menaruhnya di dalam tab "Ringkasan" berarti orang yang
   * sedang memeriksa baris tidak lagi melihat bahwa faktur ini sudah diposting.
   *
   * Urutan empat tab pertama baku di seluruh produk — Flow_Archetypes 1.
   */
  const jumlahTerkait = dokumen === null ? 0 : dokumen.journalId === null ? 0 : 1

  useHeaderHalaman(
    () =>
      dokumen === null
        ? {}
        : {
            badges: (
              <>
                <StatusBadge status={status(dokumen.lifecycleStatus)} />
                <Badge tone={dokumen.settlementStatus === 'paid' ? 'success' : 'neutral'}>
                  {LABEL_PELUNASAN[dokumen.settlementStatus] ?? dokumen.settlementStatus}
                </Badge>
                <Badge tone={dokumen.fulfillmentStatus === 'fulfilled' ? 'success' : 'neutral'}>
                  {LABEL_PEMENUHAN[dokumen.fulfillmentStatus] ?? dokumen.fulfillmentStatus}
                </Badge>
              </>
            ),
            tabs: (
              <Tabs
                label="Bagian faktur"
                activeId={tab}
                onSelect={setTab}
                items={[
                  { id: 'ringkasan', label: 'Ringkasan' },
                  { id: 'baris', label: 'Baris', count: dokumen.lines.length },
                  { id: 'terkait', label: 'Dokumen terkait', count: jumlahTerkait },
                  { id: 'aktivitas', label: 'Aktivitas' },
                ]}
              />
            ),
          },
    [dokumen, tab, jumlahTerkait],
  )

  /** Satu jalur untuk ketiga tindakan siklus hidup. */
  async function tindakan(
    aksi: 'submit' | 'approve' | 'post',
    body?: unknown,
  ): Promise<void> {
    setGalat(null)
    setPesan(null)
    setSedang(true)
    try {
      const jawaban = await api.post<{ number?: string; journal_id?: string }>(
        `${perusahaan(konteks.companyId)}/sales-documents/${documentId}/${aksi}`,
        body,
      )
      setPesan(
        aksi === 'submit'
          ? `Diajukan dengan nomor ${jawaban.data.number}.`
          : aksi === 'approve'
            ? 'Disetujui.'
            : `Diposting. Jurnal ${jawaban.data.journal_id} sudah masuk buku besar.`,
      )
      await muat()
    } catch (kesalahan) {
      // Pesan server ditampilkan apa adanya. Ia sudah menyebutkan sebabnya —
      // "Syarat belum terpenuhi", "Tidak ada aturan akun untuk …" — dan pesan
      // karangan layar akan lebih miskin daripada itu.
      setGalat(
        kesalahan instanceof ApiError ? kesalahan.message : 'Tindakan gagal tanpa keterangan.',
      )
    } finally {
      setSedang(false)
    }
  }

  if (dokumen === null) {
    return galat === null ? <p>Memuat…</p> : <p className={styles.noticeDanger}>{galat}</p>
  }

  const periode = dokumen.documentDate.slice(0, 7)

  return (
    <div className={styles.stack}>
      {galat !== null ? (
        <p className={`${styles.notice} ${styles.noticeDanger}`}>{galat}</p>
      ) : null}
      {pesan !== null ? (
        <p className={`${styles.notice} ${styles.noticeSuccess}`}>{pesan}</p>
      ) : null}

      <TabPanel id="ringkasan" activeId={tab}>
        <div className={styles.meta}>
          <div>
            <div className={styles.metaLabel}>Nomor</div>
            <div className={styles.metaValue}>{dokumen.number ?? '(belum bernomor)'}</div>
          </div>
          <div>
            <div className={styles.metaLabel}>Customer</div>
            <div className={styles.metaValue}>{dokumen.customerName}</div>
          </div>
          <div>
            <div className={styles.metaLabel}>Tanggal</div>
            <div className={styles.metaValue}>{dokumen.documentDate}</div>
          </div>
          <div>
            <div className={styles.metaLabel}>DPP</div>
            <div className={styles.metaValue}>{formatAmount(dokumen.taxBase, dokumen.currency)}</div>
          </div>
          <div>
            <div className={styles.metaLabel}>Pajak</div>
            <div className={styles.metaValue}>{formatAmount(dokumen.taxTotal, dokumen.currency)}</div>
          </div>
          <div>
            <div className={styles.metaLabel}>Total</div>
            <div className={styles.metaValue}>{formatAmount(dokumen.total, dokumen.currency)}</div>
          </div>
        </div>
      </TabPanel>

      <TabPanel id="baris" activeId={tab}>
        <table className={styles.matchTable}>
          <caption>Baris faktur</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Deskripsi</th>
              <th scope="col" data-numeric="true">Kuantitas</th>
              <th scope="col" data-numeric="true">Harga satuan</th>
              <th scope="col" data-numeric="true">DPP</th>
              <th scope="col" data-numeric="true">Pajak</th>
            </tr>
          </thead>
          <tbody>
            {dokumen.lines.map((baris) => (
              <tr key={baris.id}>
                <td>{baris.lineNo}</td>
                <td>
                  {baris.itemCode === null
                    ? baris.description
                    : `${baris.itemCode} — ${baris.description}`}
                </td>
                <td data-numeric="true">
                  {baris.qty} {baris.uom}
                </td>
                <td data-numeric="true">{formatAmount(baris.unitPrice, dokumen.currency)}</td>
                <td data-numeric="true">{formatAmount(baris.netAmount, dokumen.currency)}</td>
                <td data-numeric="true">{formatAmount(baris.taxAmount, dokumen.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabPanel>

      {/*
        Jejak dua arah — Flow_Archetypes 3. Yang ada sekarang baru satu arah:
        faktur menunjuk jurnalnya. Konversi penawaran → pesanan → faktur belum
        dibangun, dan menampilkan tab kosong yang menjanjikannya akan lebih
        menyesatkan daripada menyebutnya apa adanya.
      */}
      <TabPanel id="terkait" activeId={tab}>
        {dokumen.journalId === null ? (
          <p className={styles.notice}>
            Belum ada dokumen terkait. Jurnal akan muncul di sini setelah faktur diposting.
          </p>
        ) : (
          <div className={styles.meta}>
            <div>
              <div className={styles.metaLabel}>Jurnal</div>
              <div className={styles.metaValue}>
                <a href={href('akuntansi/buku-besar')}>Lihat di buku besar</a>
              </div>
            </div>
            <div>
              <div className={styles.metaLabel}>Diposting</div>
              <div className={styles.metaValue}>{dokumen.postedAt ?? '—'}</div>
            </div>
          </div>
        )}
      </TabPanel>

      <TabPanel id="aktivitas" activeId={tab}>
        <p className={styles.notice}>
          Audit trail belum tersedia di antarmuka. Perubahan sudah tercatat di{' '}
          <code>audit_log</code>, tetapi jalur bacanya belum dibangun — dicatat sebagai
          keterbatasan, bukan sebagai fitur yang hilang diam-diam.
        </p>
      </TabPanel>

      <div className={styles.row}>
        {/*
          Tombol muncul menurut status. Server tetap yang memutuskan — mesin
          transisi menolak perpindahan yang tidak ada di tabel, sehingga tombol
          yang salah muncul hanya menghasilkan penolakan, bukan dokumen rusak.
        */}
        {dokumen.lifecycleStatus === 'draft' ? (
          <Button loading={sedang} onClick={() => void tindakan('submit', { period_key: periode })}>
            Ajukan
          </Button>
        ) : null}
        {dokumen.lifecycleStatus === 'submitted' ? (
          <Button loading={sedang} onClick={() => void tindakan('approve')}>
            Setujui
          </Button>
        ) : null}
        {dokumen.lifecycleStatus === 'approved' ? (
          <Button loading={sedang} onClick={() => void tindakan('post')}>
            Posting ke buku besar
          </Button>
        ) : null}
        <Button variant="ghost" onClick={() => pergiKe('penjualan')}>
          Kembali ke daftar
        </Button>
      </div>
    </div>
  )
}

// ── Faktur baru ────────────────────────────────────────────────────────────

interface Pelanggan {
  readonly id: string
  readonly code: string
  readonly name: string
}

export function FakturBaru({ konteks }: { readonly konteks: Konteks }): ReactNode {
  const [pelanggan, setPelanggan] = useState<readonly Pelanggan[]>([])
  const [customerId, setCustomerId] = useState('')
  const [tanggal, setTanggal] = useState<Date | null>(() => new Date())
  const [lines, setLines] = useState<EditableLine[]>([emptyLine(crypto.randomUUID())])
  const [errors, setErrors] = useState<readonly FieldError[]>([])
  const [sedang, setSedang] = useState(false)

  useEffect(() => {
    void muatPelanggan()
  }, [konteks.companyId])

  async function muatPelanggan(): Promise<void> {
    try {
      const jawaban = await api.get<Pelanggan[]>(`${perusahaan(konteks.companyId)}/customers`)
      setPelanggan(jawaban.data)
      setCustomerId(jawaban.data[0]?.id ?? '')
    } catch {
      setErrors([
        {
          fieldId: 'faktur-customer',
          label: 'Customer',
          message: 'Daftar customer tidak dapat dimuat.',
        },
      ])
    }
  }

  async function simpan(): Promise<void> {
    setErrors([])
    setSedang(true)
    try {
      const jawaban = await api.post<{ id: string }>(
        `${perusahaan(konteks.companyId)}/sales-documents`,
        {
          customer_id: customerId,
          document_date: (tanggal ?? new Date()).toISOString().slice(0, 10),
          currency: konteks.currency,
          lines: lines
            .filter((baris) => baris.description.trim() !== '' && baris.quantity > 0)
            .map((baris) => ({
              item_id: null,
              warehouse_id: null,
              description: baris.description,
              qty: baris.quantity,
              uom: 'unit',
              unit_price: baris.unitPrice,
              discount_percent: baris.discountPercent,
              tax_rate_percent: baris.taxRatePercent,
            })),
        },
      )
      pergiKe(`penjualan/${jawaban.data.id}`)
    } catch (galat) {
      setErrors([
        {
          fieldId: 'faktur-customer',
          label: 'Faktur',
          message: galat instanceof ApiError ? galat.message : 'Faktur tidak dapat dibuat.',
        },
      ])
    } finally {
      setSedang(false)
    }
  }

  return (
    <div className={styles.stack}>
      {errors.length > 0 ? <ErrorSummary errors={errors} /> : null}

      <div className={styles.row}>
        <Select
          id="faktur-customer"
          label="Customer"
          value={customerId}
          options={pelanggan.map((item) => ({
            value: item.id,
            // Kode ikut ditampilkan: dua pelanggan bernama mirip adalah keadaan
            // biasa, dan nama sendirian tidak cukup membedakannya.
            label: `${item.code} — ${item.name}`,
          }))}
          onChange={setCustomerId}
          required
        />
        <DateField
          id="faktur-tanggal"
          label="Tanggal dokumen"
          value={tanggal}
          onChange={setTanggal}
        />
      </div>

      <LineItemEditor
        lines={lines}
        currency={konteks.currency}
        newId={() => crypto.randomUUID()}
        onChange={setLines}
      />

      <div className={styles.row}>
        <Button loading={sedang} disabled={customerId === ''} onClick={() => void simpan()}>
          Simpan sebagai draf
        </Button>
        <Button variant="ghost" onClick={() => pergiKe('penjualan')}>
          Batal
        </Button>
      </div>
    </div>
  )
}
