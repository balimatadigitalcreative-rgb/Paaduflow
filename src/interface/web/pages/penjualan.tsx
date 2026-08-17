import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import type {
  SalesDocumentDetail,
  SalesDocumentSummary,
} from '#application/queries'
import { formatAmount } from '#shared/money-format'

import { api, ApiError, perusahaan } from '../api/client.js'
import { StatusBadge, type DocumentStatus } from '../components/badge.js'
import { Button } from '../components/button.js'
import { Select } from '../components/combobox.js'
import { ErrorSummary, type FieldError } from '../components/form/form.js'
import { DateField } from '../components/pickers.js'
import { DataTable } from '../components/table/data-table.js'
import { emptyLine, LineItemEditor, type EditableLine } from '../components/table/line-item-editor.js'
import type { Column, TableState } from '../components/table/types.js'
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

export function DaftarFaktur({ konteks }: { readonly konteks: Konteks }): ReactNode {
  const [state, setState] = useState<TableState<SalesDocumentSummary>>({ kind: 'loading' })

  async function muat(): Promise<void> {
    setState({ kind: 'loading' })
    try {
      const jawaban = await api.get<SalesDocumentSummary[]>(
        `${perusahaan(konteks.companyId)}/sales-documents`,
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
        message: galat instanceof ApiError ? galat.message : 'Tidak dapat memuat daftar faktur.',
      })
    }
  }

  useEffect(() => {
    void muat()
  }, [konteks.companyId])

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
      <div className={styles.row}>
        <Button onClick={() => pergiKe('penjualan/baru')}>Faktur baru</Button>
      </div>

      <DataTable
        caption="Faktur Penjualan"
        columns={columns}
        state={state}
        rowId={(row) => row.id}
        rowHref={(row) => href(`penjualan/${row.id}`)}
        filter={{}}
        sort={[]}
        companyName={konteks.companyName}
        onSortChange={() => undefined}
        onRetry={() => void muat()}
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
          <div className={styles.metaLabel}>Status</div>
          <div className={styles.metaValue}>
            <StatusBadge status={status(dokumen.lifecycleStatus)} />
          </div>
        </div>
        <div>
          <div className={styles.metaLabel}>Total</div>
          <div className={styles.metaValue}>{formatAmount(dokumen.total, dokumen.currency)}</div>
        </div>
        {dokumen.journalId !== null ? (
          <div>
            <div className={styles.metaLabel}>Jurnal</div>
            <div className={styles.metaValue}>
              <a href={href('akuntansi/buku-besar')}>Lihat di buku besar</a>
            </div>
          </div>
        ) : null}
      </div>

      <table className={styles.matchTable}>
        <caption>Baris faktur</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Deskripsi</th>
            <th scope="col" data-numeric="true">
              Kuantitas
            </th>
            <th scope="col" data-numeric="true">
              Harga satuan
            </th>
            <th scope="col" data-numeric="true">
              DPP
            </th>
            <th scope="col" data-numeric="true">
              Pajak
            </th>
          </tr>
        </thead>
        <tbody>
          {dokumen.lines.map((baris) => (
            <tr key={baris.id}>
              <td>{baris.lineNo}</td>
              <td>
                {baris.itemCode === null ? baris.description : `${baris.itemCode} — ${baris.description}`}
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
