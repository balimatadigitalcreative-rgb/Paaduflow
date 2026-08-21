import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import type { AccountSummary, LedgerEntry } from '#application/queries'
import { formatAmount } from '#shared/money-format'

import { api, ApiError, perusahaan } from '../api/client.js'
import { Button } from '../components/button.js'
import { Select } from '../components/combobox.js'
import { FilterBar, type FilterChip } from '../components/filter-bar.js'
import { DataTable } from '../components/table/data-table.js'
import type { Column, TableState } from '../components/table/types.js'
import { href, pergiKe } from '../router.js'
import styles from './pages.module.css'

/**
 * Layar Akuntansi — baca saja.
 *
 * Tidak ada tombol yang menulis apa pun ke buku besar, dan itu disengaja:
 * seluruh jurnal lahir dari posting dokumen. Layar yang dapat menjurnal
 * langsung akan menjadi pintu kedua ke buku besar, dan pintu kedua selalu
 * menjadi pintu yang dipakai saat pintu pertama terasa merepotkan.
 */

interface Konteks {
  readonly companyId: string
  readonly companyName: string
  readonly currency: string
}

/** Lima klasifikasi akun, dan jumlahnya tetap — Modul Akuntansi. */
const CHIP_AKUN: readonly FilterChip[] = [
  { id: 'asset', label: 'Aset' },
  { id: 'liability', label: 'Kewajiban' },
  { id: 'equity', label: 'Ekuitas' },
  { id: 'revenue', label: 'Pendapatan' },
  { id: 'expense', label: 'Beban' },
]

export function BaganAkun({ konteks }: { readonly konteks: Konteks }): ReactNode {
  const [state, setState] = useState<TableState<AccountSummary>>({ kind: 'loading' })
  const [semua, setSemua] = useState<readonly AccountSummary[]>([])
  const [filterAktif, setFilterAktif] = useState<readonly string[]>([])

  const labelFilter = (id: string): string =>
    CHIP_AKUN.find((chip) => chip.id === id)?.label ?? id

  function tampilkan(baris: readonly AccountSummary[], filter: readonly string[]): void {
    if (baris.length === 0) {
      setState({ kind: 'empty' })
      return
    }
    const cocok = filter.length === 0 ? baris : baris.filter((row) => filter.includes(row.type))
    if (cocok.length === 0) {
      setState({ kind: 'no_match', activeFilters: filter.map(labelFilter) })
      return
    }
    setState({ kind: 'ready', rows: cocok, total: cocok.length, nextCursor: null })
  }

  async function muat(): Promise<void> {
    setState({ kind: 'loading' })
    try {
      const jawaban = await api.get<AccountSummary[]>(`${perusahaan(konteks.companyId)}/accounts`)
      setSemua(jawaban.data)
      tampilkan(jawaban.data, filterAktif)
    } catch (galat) {
      setState({
        kind: 'error',
        message: galat instanceof ApiError ? galat.message : 'Tidak dapat memuat bagan akun.',
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

  const columns: readonly Column<AccountSummary>[] = useMemo(
    () => [
      {
        id: 'code',
        header: 'Kode',
        identifier: true,
        sortable: true,
        cell: (row) => row.code,
        sortValue: (row) => row.code,
      },
      {
        id: 'name',
        header: 'Nama akun',
        sortable: true,
        cell: (row) => row.name,
        sortValue: (row) => row.name,
      },
      { id: 'type', header: 'Jenis', cell: (row) => row.type },
      {
        id: 'balance',
        header: 'Saldo',
        align: 'end',
        sortable: true,
        // Saldo sudah bertanda menurut jenis akun di server — aset dan beban
        // bertambah di debit, sisanya di kredit. Kalau layar yang menentukan
        // tandanya, seluruh pendapatan akan tampil negatif.
        cell: (row) => formatAmount(row.balance, konteks.currency),
        sortValue: (row) => row.balance,
      },
    ],
    [konteks.currency],
  )

  return (
    <div className={styles.stack}>
      <FilterBar
        label="Saring akun menurut klasifikasi"
        chips={CHIP_AKUN}
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

      {/*
        Bagan akun yang benar-benar kosong berarti company dibuat tanpa
        templatnya — kondisi yang tidak seharusnya terjadi. Aksi kosongnya
        karena itu bukan "buat akun pertama", melainkan memuat ulang.
      */}
      <DataTable
        caption="Bagan Akun"
        columns={columns}
        state={state}
        rowId={(row) => row.id}
        rowHref={(row) => href(`akuntansi/buku-besar/${row.id}`)}
        filter={Object.fromEntries(filterAktif.map((id) => [id, 'aktif']))}
        activeFilterLabels={filterAktif.map(labelFilter)}
        sort={[]}
        companyName={konteks.companyName}
        emptyAction={
          <Button variant="secondary" onClick={() => void muat()}>
            Muat ulang bagan akun
          </Button>
        }
        onSortChange={() => undefined}
        onRetry={() => void muat()}
        onClearFilters={() => ubahFilter([])}
      />
    </div>
  )
}

/**
 * Dari satu baris buku besar kembali ke dokumen yang melahirkannya.
 *
 * Ini pilar Terang, dan ia tidak opsional: angka agregat tanpa jalan ke
 * sumbernya tidak dapat dipertanggungjawabkan (Flow_Archetypes 6).
 *
 * Jalurnya lewat SEGMEN PATH, bukan query. Router memecah hash dengan `/` dan
 * tidak mengurai `?` sama sekali — `buku-besar?account=xxx` menjadi satu segmen
 * utuh yang tidak cocok dengan apa pun, dan kliknya berakhir di halaman yang
 * sama. Persis itu yang terjadi di sini sebelum diperbaiki.
 */
function jalurSumber(baris: LedgerEntry): string {
  if (baris.sourceId === null) return href('akuntansi/buku-besar')
  if (baris.sourceType === 'sales_document') return href(`penjualan/${baris.sourceId}`)
  if (baris.sourceType === 'purchase_document') return href(`pembelian/tagihan/${baris.sourceId}`)
  // `goods_receipt` belum punya halaman detail sendiri; daftarnya yang terdekat.
  if (baris.sourceType === 'goods_receipt') return href('pembelian/penerimaan')
  return href('akuntansi/buku-besar')
}

export function BukuBesar({
  konteks,
  accountId,
}: {
  readonly konteks: Konteks
  /** Datang dari rute — `akuntansi/buku-besar/<id>`. */
  readonly accountId?: string
}): ReactNode {
  const [akun, setAkun] = useState<readonly AccountSummary[]>([])
  const [terpilih, setTerpilih] = useState(accountId ?? '')
  const [state, setState] = useState<TableState<LedgerEntry>>({ kind: 'loading' })

  useEffect(() => {
    void api
      .get<AccountSummary[]>(`${perusahaan(konteks.companyId)}/accounts`)
      .then((jawaban) => setAkun(jawaban.data))
      .catch(() => undefined)
  }, [konteks.companyId])

  async function muat(accountId: string): Promise<void> {
    setState({ kind: 'loading' })
    try {
      const kueri = accountId === '' ? '' : `?account_id=${accountId}`
      const jawaban = await api.get<LedgerEntry[]>(
        `${perusahaan(konteks.companyId)}/general-ledger${kueri}`,
      )
      /*
       * Akun yang dipilih ADALAH filternya, jadi nol baris punya dua arti yang
       * berbeda dan tindakan yang berbeda pula:
       *
       *   tanpa akun terpilih  -> buku besar memang kosong. Jurnal lahir dari
       *                           posting dokumen, jadi aksinya ke sana.
       *   dengan akun terpilih -> ada jurnal, akun ini saja yang belum
       *                           tersentuh. Aksinya melepas pilihan.
       *
       * Menyamakan keduanya akan menyuruh akuntan membuat faktur baru padahal
       * yang perlu ia lakukan hanya mengganti akun.
       */
      if (jawaban.data.length === 0) {
        setState(
          accountId === ''
            ? { kind: 'empty' }
            : {
                kind: 'no_match',
                activeFilters: [
                  akun.find((item) => item.id === accountId)?.name ?? 'Akun terpilih',
                ],
              },
        )
      } else {
        setState({
          kind: 'ready',
          rows: jawaban.data,
          total: jawaban.data.length,
          nextCursor: jawaban.meta?.next_cursor ?? null,
        })
      }
    } catch (galat) {
      setState({
        kind: 'error',
        message: galat instanceof ApiError ? galat.message : 'Tidak dapat memuat buku besar.',
      })
    }
  }

  useEffect(() => {
    /*
     * Akun datang dari SEGMEN PATH, bukan dari query hash.
     *
     * Baris ini sebelumnya mengurai `?account=` dengan URLSearchParams, dan
     * tidak pernah sekali pun berjalan: router memecah hash dengan `/` dan
     * tidak mengenal `?`, sehingga `buku-besar?account=xxx` menjadi satu segmen
     * utuh yang tidak cocok dengan perbandingan mana pun. Halaman ini bahkan
     * tidak dirender — klik dari bagan akun berakhir kembali di bagan akun.
     *
     * Kode yang benar di atas kode yang tidak pernah dijalankan tetap tidak
     * berguna. Yang diperbaiki rutenya, dan filternya mengikuti.
     */
    const diminta = accountId ?? ''
    setTerpilih(diminta)
    void muat(diminta)
  }, [konteks.companyId, accountId])

  const columns: readonly Column<LedgerEntry>[] = useMemo(
    () => [
      {
        id: 'date',
        header: 'Tanggal',
        identifier: true,
        sortable: true,
        cell: (row) => row.journalDate,
        sortValue: (row) => row.journalDate,
      },
      { id: 'journal', header: 'Jurnal', cell: (row) => row.journalNumber ?? '(tanpa nomor)' },
      {
        id: 'account',
        header: 'Akun',
        cell: (row) => `${row.accountCode} — ${row.accountName}`,
      },
      {
        id: 'source',
        header: 'Sumber',
        // Menjawab "angka ini datang dari mana" tanpa membuka jurnalnya.
        cell: (row) => row.sourceType ?? '—',
      },
      {
        id: 'debit',
        header: 'Debit',
        align: 'end',
        cell: (row) => (row.debit === 0 ? '' : formatAmount(row.debit, konteks.currency)),
        sortValue: (row) => row.debit,
      },
      {
        id: 'credit',
        header: 'Kredit',
        align: 'end',
        cell: (row) => (row.credit === 0 ? '' : formatAmount(row.credit, konteks.currency)),
        sortValue: (row) => row.credit,
      },
      {
        id: 'running',
        header: 'Saldo berjalan',
        align: 'end',
        cell: (row) => formatAmount(row.runningBalance, konteks.currency),
        sortValue: (row) => row.runningBalance,
      },
    ],
    [konteks.currency],
  )

  return (
    <div className={styles.stack}>
      <div className={styles.row}>
        <Select
          id="buku-akun"
          label="Akun"
          value={terpilih}
          options={[
            { value: '', label: 'Semua akun' },
            ...akun.map((item) => ({ value: item.id, label: `${item.code} — ${item.name}` })),
          ]}
          onChange={(nilai) => {
            setTerpilih(nilai)
            void muat(nilai)
          }}
        />
      </div>

      <DataTable
        caption="Buku Besar"
        columns={columns}
        state={state}
        rowId={(row) => row.id}
        rowHref={(row) => jalurSumber(row)}
        filter={terpilih === '' ? {} : { account: terpilih }}
        activeFilterLabels={
          terpilih === ''
            ? []
            : [akun.find((item) => item.id === terpilih)?.name ?? 'Akun terpilih']
        }
        sort={[]}
        companyName={konteks.companyName}
        emptyAction={
          <Button onClick={() => pergiKe('penjualan/baru')}>Buat faktur pertama</Button>
        }
        onSortChange={() => undefined}
        onRetry={() => void muat(terpilih)}
        onClearFilters={() => {
          setTerpilih('')
          void muat('')
        }}
      />
    </div>
  )
}
