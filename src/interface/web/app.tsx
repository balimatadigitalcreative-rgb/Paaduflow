import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { periodOf, formatPeriod } from '#shared/fiscal-period'

import { api, sesi } from './api/client.js'
import { Button } from './components/button.js'
import { Dasbor, type CompanyDapatDiakses } from './pages/dasbor.js'
import { BaganAkun, BukuBesar } from './pages/akuntansi.js'
import { HalamanMasuk } from './pages/masuk.js'
import {
  DaftarPembelian,
  DaftarPenerimaan,
  DetailPesanan,
  DetailTagihan,
} from './pages/pembelian.js'
import {
  DaftarFakturKeluaran,
  DaftarFakturMasukan,
  DetailFakturKeluaran,
  TerbitkanFakturPajak,
  KodePajak,
  NomorSeri,
  RekonsiliasiPajak,
} from './pages/pajak.js'
import { DaftarFaktur, DetailFaktur, FakturBaru } from './pages/penjualan.js'
import { pergiKe, useRoute } from './router.js'
import { AppShell } from './shell/app-shell.js'
import { PreferencesProvider } from './shell/preferences.js'
import type { ModuleLink, PaletteItem, SidebarItem } from './shell/types.js'

/**
 * Perakitan aplikasi.
 *
 * Yang perlu diperhatikan saat membaca:
 *
 * - **Company aktif tinggal di sini**, dan ia yang membentuk seluruh URL API
 *   lewat `perusahaan(companyId)`. Konteks company datang dari path, tidak
 *   pernah dari token (D-002).
 * - **Sidebar disaring izin, bukan dinonaktifkan.** Yang tidak boleh dilihat
 *   tidak diakui keberadaannya. Untuk sekarang seluruh item `permitted: true`
 *   karena izin efektif belum diambil ke sisi web — dicatat sebagai
 *   keterbatasan di D-135, bukan sebagai sesuatu yang sudah benar.
 * - **Tidak ada komponen baru.** Seluruh layar disusun dari pustaka C1–C3.
 */

const MODUL: readonly ModuleLink[] = [
  { id: 'dasbor', name: 'Dasbor', glyph: 'DB' },
  { id: 'penjualan', name: 'Penjualan', glyph: 'PJ' },
  { id: 'pembelian', name: 'Pembelian', glyph: 'PB' },
  { id: 'akuntansi', name: 'Akuntansi', glyph: 'AK' },
  { id: 'pajak', name: 'Pajak', glyph: 'PJK' },
]

const SIDEBAR: Record<string, readonly SidebarItem[]> = {
  dasbor: [{ id: 'dasbor', label: 'Ringkasan', group: 'Transaksi', permitted: true }],
  penjualan: [
    { id: 'penjualan', label: 'Faktur Penjualan', group: 'Transaksi', permitted: true },
    { id: 'penjualan/baru', label: 'Faktur baru', group: 'Transaksi', permitted: true },
  ],
  pembelian: [
    { id: 'pembelian/pesanan', label: 'Pesanan Pembelian', group: 'Transaksi', permitted: true },
    { id: 'pembelian/penerimaan', label: 'Penerimaan Barang', group: 'Transaksi', permitted: true },
    { id: 'pembelian/tagihan', label: 'Faktur Pembelian', group: 'Transaksi', permitted: true },
  ],
  akuntansi: [
    { id: 'akuntansi/bagan-akun', label: 'Bagan Akun', group: 'Data induk', permitted: true },
    { id: 'akuntansi/buku-besar', label: 'Buku Besar', group: 'Laporan', permitted: true },
  ],
  pajak: [
    { id: 'pajak/kode', label: 'Kode Pajak', group: 'Data induk', permitted: true },
    { id: 'pajak/nomor-seri', label: 'Nomor Seri', group: 'Data induk', permitted: true },
    { id: 'pajak/keluaran', label: 'Faktur Pajak Keluaran', group: 'Transaksi', permitted: true },
    { id: 'pajak/masukan', label: 'Faktur Pajak Masukan', group: 'Transaksi', permitted: true },
    { id: 'pajak/terbitkan', label: 'Terbitkan Faktur Pajak', group: 'Transaksi', permitted: true },
    { id: 'pajak/rekonsiliasi', label: 'Rekonsiliasi', group: 'Laporan', permitted: true },
  ],
}

const JUDUL: Record<string, { judul: string; remah: readonly string[] }> = {
  dasbor: { judul: 'Dasbor', remah: ['Dasbor'] },
  penjualan: { judul: 'Faktur Penjualan', remah: ['Penjualan', 'Faktur Penjualan'] },
  'penjualan/baru': { judul: 'Faktur Penjualan baru', remah: ['Penjualan', 'Baru'] },
  'pembelian/pesanan': { judul: 'Pesanan Pembelian', remah: ['Pembelian', 'Pesanan'] },
  'pembelian/penerimaan': { judul: 'Penerimaan Barang', remah: ['Pembelian', 'Penerimaan'] },
  'pembelian/tagihan': { judul: 'Faktur Pembelian', remah: ['Pembelian', 'Tagihan'] },
  'akuntansi/bagan-akun': { judul: 'Bagan Akun', remah: ['Akuntansi', 'Bagan Akun'] },
  'akuntansi/buku-besar': { judul: 'Buku Besar', remah: ['Akuntansi', 'Buku Besar'] },
  'pajak/kode': { judul: 'Kode Pajak', remah: ['Pajak', 'Kode Pajak'] },
  'pajak/nomor-seri': { judul: 'Nomor Seri Faktur Pajak', remah: ['Pajak', 'Nomor Seri'] },
  'pajak/keluaran': { judul: 'Faktur Pajak Keluaran', remah: ['Pajak', 'Faktur Pajak Keluaran'] },
  'pajak/masukan': { judul: 'Faktur Pajak Masukan', remah: ['Pajak', 'Faktur Pajak Masukan'] },
  'pajak/terbitkan': { judul: 'Terbitkan Faktur Pajak', remah: ['Pajak', 'Terbitkan'] },
  'pajak/rekonsiliasi': { judul: 'Rekonsiliasi Pajak', remah: ['Pajak', 'Rekonsiliasi'] },
}

const KUNCI_COMPANY = 'paadu.company_id'

export function App(): ReactNode {
  const [masuk, setMasuk] = useState(() => sesi.accessToken() !== null)
  const [companies, setCompanies] = useState<readonly CompanyDapatDiakses[]>([])
  const [companyId, setCompanyId] = useState<string>(
    () => localStorage.getItem(KUNCI_COMPANY) ?? '',
  )
  const [galat, setGalat] = useState<string | null>(null)
  const route = useRoute()

  const muatCompanies = useCallback(async (): Promise<void> => {
    try {
      const jawaban = await api.get<CompanyDapatDiakses[]>('/v1/me/companies')
      setCompanies(jawaban.data)

      // Company tersimpan yang tidak lagi dapat diakses harus dilupakan, bukan
      // dipertahankan sampai setiap permintaan menjawab 403.
      const masihAda = jawaban.data.some((company) => company.id === companyId)
      if (!masihAda) {
        const pertama = jawaban.data[0]?.id ?? ''
        setCompanyId(pertama)
        localStorage.setItem(KUNCI_COMPANY, pertama)
      }
    } catch {
      // Token kedaluwarsa adalah sebab paling umum. Keluar, jangan tampilkan
      // aplikasi kosong yang setiap tombolnya gagal.
      sesi.hapus()
      setMasuk(false)
      setGalat('Sesi berakhir. Silakan masuk lagi.')
    }
  }, [companyId])

  useEffect(() => {
    if (masuk) void muatCompanies()
  }, [masuk])

  const company = companies.find((item) => item.id === companyId)

  const konteks = useMemo(
    () => ({
      companyId,
      companyName: company?.legal_name ?? '',
      // Mata uang company belum dikirim `/v1/me/companies`; seluruh data contoh
      // memakai IDR. Dicatat di D-135.
      currency: 'IDR',
    }),
    [companyId, company?.legal_name],
  )

  const paletteItems: readonly PaletteItem[] = useMemo(
    () =>
      Object.entries(JUDUL).map(([path, entri]) => ({
        id: path,
        label: entri.judul,
        group: 'Navigasi' as const,
        permitted: true,
        run: () => pergiKe(path),
      })),
    [],
  )

  if (!masuk) {
    return (
      <PreferencesProvider>
        {galat !== null ? <p role="status">{galat}</p> : null}
        <HalamanMasuk
          onMasuk={() => {
            setGalat(null)
            setMasuk(true)
          }}
        />
      </PreferencesProvider>
    )
  }

  if (company === undefined) {
    return (
      <PreferencesProvider>
        <main>
          <p>
            {companies.length === 0
              ? 'Memuat company…'
              : 'Anda belum punya akses ke company mana pun.'}
          </p>
        </main>
      </PreferencesProvider>
    )
  }

  const bagian = route.path[0] ?? 'dasbor'
  const kunciHalaman = route.path.slice(0, 2).join('/')
  const modul = MODUL.find((item) => item.id === bagian) ?? MODUL[0]!
  const judul = JUDUL[kunciHalaman] ?? JUDUL[bagian] ?? JUDUL.dasbor!

  const periode = periodOf(new Date(), company.fiscal_year_start_month)

  return (
    <PreferencesProvider>
      <AppShell
        switcher={{
          tenant: {
            id: company.id,
            name: company.tenant_name,
            companies: companies.map((item) => ({
              id: item.id,
              legalName: item.legal_name,
              taxId: null,
              currency: 'IDR',
              fiscalYearLabel: formatPeriod(
                periodOf(new Date(), item.fiscal_year_start_month),
              ),
              status: 'active' as const,
            })),
          },
          otherTenants: [],
          activeCompanyId: companyId,
          onSwitch: (id) => {
            setCompanyId(id)
            localStorage.setItem(KUNCI_COMPANY, id)
          },
        }}
        modules={MODUL}
        activeModule={modul}
        sidebarItems={SIDEBAR[modul.id] ?? []}
        activeItemId={kunciHalaman === '' ? 'dasbor' : kunciHalaman}
        paletteItems={paletteItems}
        pageTitle={judul.judul}
        breadcrumb={judul.remah}
        fiscalPeriod={formatPeriod(periode)}
        onSelectModule={(id) => {
          const pertama = SIDEBAR[id]?.[0]?.id ?? id
          pergiKe(pertama)
        }}
        onSelectItem={(id) => pergiKe(id)}
      >
        <Halaman route={route} konteks={konteks} companies={companies} companyId={companyId}
          onPilihCompany={(id) => {
            setCompanyId(id)
            localStorage.setItem(KUNCI_COMPANY, id)
          }}
        />
        <p>
          <Button
            variant="ghost"
            onClick={() => {
              void api.keluar().then(() => setMasuk(false))
            }}
          >
            Keluar
          </Button>
        </p>
      </AppShell>
    </PreferencesProvider>
  )
}

function Halaman({
  route,
  konteks,
  companies,
  companyId,
  onPilihCompany,
}: {
  readonly route: { readonly path: readonly string[] }
  readonly konteks: { companyId: string; companyName: string; currency: string }
  readonly companies: readonly CompanyDapatDiakses[]
  readonly companyId: string
  readonly onPilihCompany: (id: string) => void
}): ReactNode {
  const [bagian, kedua, ketiga] = route.path

  if (bagian === undefined || bagian === 'dasbor') {
    return (
      <Dasbor
        companies={companies}
        activeCompanyId={companyId}
        onPilihCompany={onPilihCompany}
      />
    )
  }

  if (bagian === 'penjualan') {
    if (kedua === undefined) return <DaftarFaktur konteks={konteks} />
    if (kedua === 'baru') return <FakturBaru konteks={konteks} />
    return <DetailFaktur konteks={konteks} documentId={kedua} />
  }

  if (bagian === 'pembelian') {
    if (kedua === 'penerimaan') return <DaftarPenerimaan konteks={konteks} />
    if (kedua === 'pesanan') {
      return ketiga === undefined ? (
        <DaftarPembelian konteks={konteks} docType="purchase_order" />
      ) : (
        <DetailPesanan konteks={konteks} documentId={ketiga} />
      )
    }
    if (kedua === 'tagihan') {
      return ketiga === undefined ? (
        <DaftarPembelian konteks={konteks} docType="bill" />
      ) : (
        <DetailTagihan konteks={konteks} documentId={ketiga} />
      )
    }
    return <DaftarPembelian konteks={konteks} docType="purchase_order" />
  }

  if (bagian === 'akuntansi') {
    if (kedua === 'buku-besar') return <BukuBesar konteks={konteks} />
    return <BaganAkun konteks={konteks} />
  }

  if (bagian === 'pajak') {
    if (kedua === 'nomor-seri') return <NomorSeri konteks={konteks} />
    if (kedua === 'rekonsiliasi') return <RekonsiliasiPajak konteks={konteks} />
    if (kedua === 'masukan') return <DaftarFakturMasukan konteks={konteks} />
    if (kedua === 'terbitkan') return <TerbitkanFakturPajak konteks={konteks} />
    if (kedua === 'keluaran') {
      return ketiga === undefined ? (
        <DaftarFakturKeluaran konteks={konteks} />
      ) : (
        <DetailFakturKeluaran konteks={konteks} invoiceId={ketiga} />
      )
    }
    // Versi yang sedang diubah dibawa di PATH, bukan di query. Router ini
    // memecah hash dengan `/`, sehingga `?ubah=…` akan menempel di segmen
    // terakhir dan tidak pernah cocok dengan perbandingan mana pun.
    return <KodePajak konteks={konteks} {...(ketiga === undefined ? {} : { ubahId: ketiga })} />
  }

  return <p>Halaman tidak ditemukan.</p>
}
