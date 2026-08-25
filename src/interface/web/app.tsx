import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  IconBook2,
  IconLayoutDashboard,
  IconReceipt,
  IconReceiptTax,
  IconShoppingCart,
} from '@tabler/icons-react'
import type { ReactNode } from 'react'

import { periodOf, formatPeriod } from '#shared/fiscal-period'

import { ApiError, api, onSesiHabis, sesi, type Profil } from './api/client.js'
import { BAHASA, gantiBahasa, simpanBahasa, type Bahasa } from './i18n/index.js'
import { Button } from './components/button.js'
import { Dasbor, type CompanyDapatDiakses } from './pages/dasbor.js'
import { BaganAkun, BukuBesar } from './pages/akuntansi.js'
import { LabaRugi } from './pages/laba-rugi.js'
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
import styles from './pages/pages.module.css'
import { AppShell } from './shell/app-shell.js'
import { ToastProvider } from './components/toast.js'
import { PreferencesProvider } from './shell/preferences.js'
import { PenyediaHeaderHalaman, type IsiHeaderHalaman } from './shell/page-header.js'
import type { ModuleLink, PaletteItem, SidebarItem } from './shell/types.js'
import type shell from './i18n/locales/id/shell.json'

/*
 * Id navigasi diturunkan DARI berkas locale, bukan ditulis ulang di sini.
 *
 * Akibatnya menambah halaman tanpa menambah terjemahannya gagal saat build,
 * bukan menghasilkan label kosong di sidebar. Arahnya sengaja begini — berkas
 * locale yang menjadi acuan, dan kode yang harus menyesuaikan.
 */
type IdModul = keyof (typeof shell)['modul']
type IdSidebar = keyof (typeof shell)['sidebar']
type KunciJudul = `judul.${keyof (typeof shell)['judul']}`
type KunciRemah = `remah.${keyof (typeof shell)['remah']}`
type KunciAksi = `aksiPrimer.${keyof (typeof shell)['aksiPrimer']}`

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

/**
 * Ikon dipilih menurut apa yang DIKERJAKAN modul, bukan menurut nama modulnya.
 *
 * Uji pembedaan ikon di Layout_System §7 menuntut kelimanya dapat dibedakan
 * sekilas tanpa label. Nota dan keranjang berbeda bentuk luar; buku besar dan
 * nota-berpersen berbeda dari keduanya. Yang dihindari: lima varian dokumen
 * yang hanya berbeda isinya, karena pada 20px isinya tidak terbaca.
 */
const IKON_MODUL: readonly { id: IdModul; glyph: ModuleLink['glyph'] }[] = [
  { id: 'dasbor', glyph: IconLayoutDashboard },
  { id: 'penjualan', glyph: IconReceipt },
  { id: 'pembelian', glyph: IconShoppingCart },
  { id: 'akuntansi', glyph: IconBook2 },
  { id: 'pajak', glyph: IconReceiptTax },
]

/**
 * Struktur sidebar tanpa teks.
 *
 * Yang tersimpan di sini adalah id dan pengelompokannya; labelnya diambil dari
 * berkas locale saat render. Menyimpan teks di sini berarti sidebar tetap
 * berbahasa Indonesia setelah orang beralih ke Inggris — dan sidebar adalah
 * hal pertama yang dilihat orang, sehingga kelalaiannya paling cepat terlihat.
 */
const SIDEBAR: Record<string, readonly { id: IdSidebar; group: SidebarItem['group'] }[]> = {
  dasbor: [{ id: 'dasbor', group: 'Transaksi' }],
  penjualan: [
    { id: 'penjualan', group: 'Transaksi' },
    { id: 'penjualan/baru', group: 'Transaksi' },
  ],
  pembelian: [
    { id: 'pembelian/pesanan', group: 'Transaksi' },
    { id: 'pembelian/penerimaan', group: 'Transaksi' },
    { id: 'pembelian/tagihan', group: 'Transaksi' },
  ],
  akuntansi: [
    { id: 'akuntansi/bagan-akun', group: 'Data induk' },
    { id: 'akuntansi/laba-rugi', group: 'Laporan' },
    { id: 'akuntansi/buku-besar', group: 'Laporan' },
  ],
  pajak: [
    { id: 'pajak/kode', group: 'Data induk' },
    { id: 'pajak/nomor-seri', group: 'Data induk' },
    { id: 'pajak/keluaran', group: 'Transaksi' },
    { id: 'pajak/masukan', group: 'Transaksi' },
    { id: 'pajak/terbitkan', group: 'Transaksi' },
    { id: 'pajak/rekonsiliasi', group: 'Laporan' },
  ],
}

/**
 * Judul halaman dan remah roti, sebagai KUNCI terjemahan.
 *
 * Remahnya larik kunci, bukan larik kata. Sebagian potongan berulang di banyak
 * jalur — "Penjualan" muncul di tiga tempat — dan menuliskannya sebagai teks
 * berarti menerjemahkannya berkali-kali, dengan peluang berbeda-beda.
 */
const JUDUL: Record<string, { judul: KunciJudul; remah: readonly KunciRemah[] }> = {
  dasbor: { judul: 'judul.dasbor', remah: ['remah.dasbor'] },
  penjualan: { judul: 'judul.penjualan', remah: ['remah.penjualan', 'remah.fakturPenjualan'] },
  'penjualan/baru': { judul: 'judul.penjualan/baru', remah: ['remah.penjualan', 'remah.baru'] },
  'pembelian/pesanan': {
    judul: 'judul.pembelian/pesanan',
    remah: ['remah.pembelian', 'remah.pesanan'],
  },
  'pembelian/penerimaan': {
    judul: 'judul.pembelian/penerimaan',
    remah: ['remah.pembelian', 'remah.penerimaan'],
  },
  'pembelian/tagihan': {
    judul: 'judul.pembelian/tagihan',
    remah: ['remah.pembelian', 'remah.tagihan'],
  },
  'akuntansi/bagan-akun': {
    judul: 'judul.akuntansi/bagan-akun',
    remah: ['remah.akuntansi', 'remah.baganAkun'],
  },
  'akuntansi/laba-rugi': {
    judul: 'judul.akuntansi/laba-rugi',
    remah: ['remah.akuntansi', 'remah.labaRugi'],
  },
  'akuntansi/buku-besar': {
    judul: 'judul.akuntansi/buku-besar',
    remah: ['remah.akuntansi', 'remah.bukuBesar'],
  },
  'pajak/kode': { judul: 'judul.pajak/kode', remah: ['remah.pajak', 'remah.kodePajak'] },
  'pajak/nomor-seri': {
    judul: 'judul.pajak/nomor-seri',
    remah: ['remah.pajak', 'remah.nomorSeri'],
  },
  'pajak/keluaran': {
    judul: 'judul.pajak/keluaran',
    remah: ['remah.pajak', 'remah.fakturPajakKeluaran'],
  },
  'pajak/masukan': {
    judul: 'judul.pajak/masukan',
    remah: ['remah.pajak', 'remah.fakturPajakMasukan'],
  },
  'pajak/terbitkan': { judul: 'judul.pajak/terbitkan', remah: ['remah.pajak', 'remah.terbitkan'] },
  'pajak/rekonsiliasi': {
    judul: 'judul.pajak/rekonsiliasi',
    remah: ['remah.pajak', 'remah.rekonsiliasi'],
  },
}

/**
 * Aksi primer per halaman — Component_Specs_Composite §7.
 *
 * Satu saja. Bila terasa ada dua, hierarkinya belum diputuskan. Diletakkan di
 * sini, bukan di badan halaman, karena page header adalah tempatnya menurut
 * Layout_System §3 — dan tempat yang tetap membuatnya dapat ditemukan tanpa
 * dicari ulang di setiap modul.
 */
const AKSI_PRIMER: Record<string, { readonly label: KunciAksi; readonly tujuan: string }> = {
  penjualan: { label: 'aksiPrimer.fakturBaru', tujuan: 'penjualan/baru' },
  'pajak/kode': { label: 'aksiPrimer.terbitkanFakturPajak', tujuan: 'pajak/terbitkan' },
  'pajak/keluaran': { label: 'aksiPrimer.terbitkanFakturPajak', tujuan: 'pajak/terbitkan' },
}

const KUNCI_COMPANY = 'paadu.company_id'



/**
 * Tiga keadaan, bukan satu daftar.
 *
 * Sebelumnya `companies` hanyalah array yang dimulai kosong, sehingga "belum
 * dijawab" dan "dijawab, memang tidak ada" tidak dapat dibedakan. Pengguna yang
 * akunnya belum diberi company mana pun melihat "Memuat company…" selamanya —
 * indikator yang menjanjikan sesuatu yang tidak akan pernah datang.
 *
 * Daftar kosong bukan kegagalan, dan bukan pula kelambatan. Ia jawaban yang
 * sah, dan satu-satunya cara menampilkannya jujur adalah membuatnya keadaan
 * tersendiri. Ini pola yang sama dengan `TableState` di pustaka tabel, yang
 * memang sudah memisahkan `loading`, `empty`, dan `error`.
 */
type MuatCompany =
  | { readonly kind: 'memuat' }
  | { readonly kind: 'siap'; readonly daftar: readonly CompanyDapatDiakses[] }
  | { readonly kind: 'galat'; readonly pesan: string }

export function App(): ReactNode {
  const { t } = useTranslation('shell')
  const [masuk, setMasuk] = useState(() => sesi.accessToken() !== null)
  const [muat, setMuat] = useState<MuatCompany>({ kind: 'memuat' })
  const [companyId, setCompanyId] = useState<string>(
    () => localStorage.getItem(KUNCI_COMPANY) ?? '',
  )
  const [galat, setGalat] = useState<string | null>(null)
  const [header, setHeader] = useState<IsiHeaderHalaman>({})
  const [profil, setProfil] = useState<Profil | null>(null)
  const route = useRoute()

  const keluar = useCallback((): void => {
    void api.keluar().then(() => {
      setMasuk(false)
      setMuat({ kind: 'memuat' })
      setProfil(null)
    })
  }, [])

  /**
   * Mengganti bahasa: layar lebih dulu, server menyusul.
   *
   * Urutannya penting. Menunggu server menjawab sebelum layar berganti membuat
   * pengalih terasa rusak di jaringan lambat — orang mengklik, tidak ada yang
   * terjadi, lalu mengklik lagi. Kegagalan menyimpan pun tidak mengembalikan
   * layar ke bahasa lama: pilihannya tetap dihormati sesi ini, hanya tidak
   * terbawa ke perangkat berikutnya.
   */
  const pilihBahasa = useCallback((bahasa: Bahasa): void => {
    simpanBahasa(bahasa)
    void gantiBahasa(bahasa)
    void api.simpanBahasa(bahasa).catch(() => undefined)
  }, [])

  const muatCompanies = useCallback(async (): Promise<void> => {
    setMuat({ kind: 'memuat' })
    try {
      const jawaban = await api.get<CompanyDapatDiakses[]>('/v1/me/companies')
      setMuat({ kind: 'siap', daftar: jawaban.data })

      // Company tersimpan yang tidak lagi dapat diakses harus dilupakan, bukan
      // dipertahankan sampai setiap permintaan menjawab 403.
      const masihAda = jawaban.data.some((company) => company.id === companyId)
      if (!masihAda) {
        const pertama = jawaban.data[0]?.id ?? ''
        setCompanyId(pertama)
        localStorage.setItem(KUNCI_COMPANY, pertama)
      }
    } catch (kesalahan) {
      /*
       * Sesi mati sudah ditangani terpusat di klien API, dan layar masuk akan
       * menggantikan yang ini — tidak ada yang perlu ditampilkan di sini.
       *
       * Sisanya adalah kegagalan yang dapat dicoba lagi: server sedang mati,
       * jaringan putus, 500. Sebelumnya semuanya diperlakukan sebagai token
       * kedaluwarsa dan pengguna dikeluarkan, sehingga satu gangguan jaringan
       * sesaat membuang sesi yang sebenarnya masih sah.
       */
      if (kesalahan instanceof ApiError && kesalahan.status === 401) return
      setMuat({
        kind: 'galat',
        pesan:
          kesalahan instanceof ApiError
            ? kesalahan.message
            : t('masuk.tidakTerhubung', { ns: 'umum' }),
      })
    }
  }, [companyId])

  useEffect(() => {
    if (masuk) void muatCompanies()
  }, [masuk])

  /*
   * Profil diambil TERPISAH dari daftar company, dan itu disengaja.
   *
   * Pengguna yang belum diberi company mana pun tetap harus melihat namanya dan
   * tetap harus dapat mengganti bahasa. Menggabungkan keduanya dalam satu
   * permintaan akan membuat menu profil kosong justru pada layar yang paling
   * membutuhkan penjelasan.
   */
  useEffect(() => {
    if (!masuk) return
    void api
      .profil()
      .then(async (jawaban) => {
        setProfil(jawaban.data)

        /*
         * Bahasa dari server MENANG atas tebakan localStorage.
         *
         * Tebakan itu ada supaya layar pertama tidak berkedip; begitu jawaban
         * yang sebenarnya tiba, ia yang berlaku — termasuk saat orang yang sama
         * masuk dari perangkat yang belum pernah dipakainya.
         */
        const dariServer = jawaban.data.language
        if (!BAHASA.includes(dariServer as Bahasa)) return
        simpanBahasa(dariServer as Bahasa)
        await gantiBahasa(dariServer as Bahasa)
      })
      .catch(() => {
        // Profil gagal diambil bukan alasan menghalangi orang bekerja. Menu
        // menampilkan sapaan umum, dan bahasanya tetap yang tersimpan lokal.
      })
  }, [masuk])

  // Satu penangan untuk seluruh aplikasi: permintaan mana pun yang ditolak
  // karena sesinya mati membawa pengguna ke halaman masuk.
  useEffect(() => {
    onSesiHabis(() => {
      setMasuk(false)
      setMuat({ kind: 'memuat' })
      setGalat(t('gerbang.sesiBerakhir'))
    })
    return () => onSesiHabis(null)
  }, [])

  /*
   * Header dikosongkan saat rute berganti.
   *
   * Halaman baru mengisinya lewat efeknya sendiri, yang berjalan SETELAH render
   * pertama. Tanpa pengosongan di sini, badge "Terposting" milik faktur
   * sebelumnya sempat terlihat satu frame di atas judul halaman yang sudah
   * berganti — dan badge status yang salah lebih buruk daripada tidak ada.
   */
  const jalur = route.path.join('/')
  useEffect(() => {
    setHeader({})
  }, [jalur])

  const companies = muat.kind === 'siap' ? muat.daftar : []

  /*
   * Cadangan ke company pertama menutup satu keadaan mustahil yang dulu
   * berakhir di layar yang sama dengan "sedang memuat": daftar terisi, tetapi
   * `companyId` belum sempat menunjuk salah satunya. Dengan cadangan ini,
   * `company` kosong berarti tepat satu hal — daftarnya memang kosong.
   */
  const company = companies.find((item) => item.id === companyId) ?? companies[0]

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

  /*
   * Modul, sidebar, dan palet dirakit ulang setiap bahasa berganti.
   *
   * `useMemo` bergantung pada `t`, yang identitasnya berubah saat bahasa
   * berganti — itulah yang membuat rail dan sidebar ikut berganti tanpa perlu
   * satu pun pemicu tambahan.
   */
  const MODUL: readonly ModuleLink[] = useMemo(
    () => IKON_MODUL.map((satu) => ({ ...satu, name: t(`modul.${satu.id}`) })),
    [t],
  )

  const sidebarUntuk = useCallback(
    (modulId: string): readonly SidebarItem[] =>
      (SIDEBAR[modulId] ?? []).map((satu) => ({
        id: satu.id,
        label: t(`sidebar.${satu.id}`),
        group: satu.group,
        permitted: true,
      })),
    [t],
  )

  const paletteItems: readonly PaletteItem[] = useMemo(
    () =>
      Object.entries(JUDUL).map(([path, entri]) => ({
        id: path,
        label: t(entri.judul),
        group: 'Navigasi' as const,
        permitted: true,
        run: () => pergiKe(path),
      })),
    [t],
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

  if (muat.kind === 'memuat') {
    return (
      <PreferencesProvider>
        <main className={styles.masuk}>
          <p role="status">{t('gerbang.memuatCompany')}</p>
        </main>
      </PreferencesProvider>
    )
  }

  /*
   * Gagal memuat bukan alasan mengeluarkan pengguna. Sesinya masih sah; yang
   * gagal permintaannya. Karena itu tersedia "Coba lagi" — dan "Keluar", supaya
   * tidak ada layar yang menjadi jalan buntu.
   */
  if (muat.kind === 'galat') {
    return (
      <PreferencesProvider>
        <main className={styles.masuk}>
          <h1>{t('gerbang.gagalJudul')}</h1>
          <p className={styles.noticeDanger} role="alert">
            {muat.pesan}
          </p>
          <div className={styles.row}>
            <Button variant="secondary" onClick={() => void muatCompanies()}>
              {t('aksi.cobaLagi', { ns: 'umum' })}
            </Button>
            <Button variant="ghost" onClick={keluar}>
              {t('aksi.keluar', { ns: 'umum' })}
            </Button>
          </div>
        </main>
      </PreferencesProvider>
    )
  }

  /*
   * Daftar kosong bagi pengguna yang sudah masuk: kondisi sah, bukan kegagalan
   * dan bukan kelambatan. Yang disebut adalah apa adanya — akunnya berlaku,
   * aksesnya yang belum ada — beserta siapa yang dapat memberikannya. Menahan
   * indikator memuat di sini akan menjanjikan sesuatu yang tidak akan datang.
   */
  if (company === undefined) {
    return (
      <PreferencesProvider>
        <main className={styles.masuk}>
          <h1>{t('gerbang.kosongJudul')}</h1>
          <p>{t('gerbang.kosongPenjelasan')}</p>
          <div className={styles.row}>
            <Button variant="secondary" onClick={() => void muatCompanies()}>
              {t('gerbang.periksaLagi')}
            </Button>
            <Button variant="ghost" onClick={keluar}>
              {t('aksi.keluar', { ns: 'umum' })}
            </Button>
          </div>
        </main>
      </PreferencesProvider>
    )
  }

  const bagian = route.path[0] ?? 'dasbor'
  const kunciHalaman = route.path.slice(0, 2).join('/')
  const modul = MODUL.find((item) => item.id === bagian) ?? MODUL[0]!
  const judul = JUDUL[kunciHalaman] ?? JUDUL[bagian] ?? JUDUL.dasbor!

  const periode = periodOf(new Date(), company.fiscal_year_start_month)
  const aksiPrimer = AKSI_PRIMER[kunciHalaman]

  return (
    <PreferencesProvider>
      <ToastProvider>
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

            /*
             * Kembali ke akar modul, bukan bertahan di halaman yang sama —
             * Component_Specs_AppShell §1 butir 3.
             *
             * ID dokumen tidak berlaku lintas company. Bertahan di
             * `penjualan/<id>` setelah berpindah akan meminta dokumen milik
             * company lain: paling baik 404, paling buruk layar yang terlihat
             * normal padahal menampilkan entitas legal yang salah.
             */
            const modulSekarang = route.path[0] ?? 'dasbor'
            const tujuan = SIDEBAR[modulSekarang]?.[0]?.id ?? modulSekarang
            pergiKe(tujuan)
          },
        }}
        modules={MODUL}
        activeModule={modul}
        sidebarItems={sidebarUntuk(modul.id)}
        activeItemId={kunciHalaman === '' ? 'dasbor' : kunciHalaman}
        paletteItems={paletteItems}
        pageTitle={t(judul.judul)}
        breadcrumb={judul.remah.map((kunci) => t(kunci))}
        {...(header.badges === undefined ? {} : { statusBadges: header.badges })}
        {...(header.tabs === undefined ? {} : { tabs: header.tabs })}
        {...(aksiPrimer === undefined
          ? {}
          : {
              primaryAction: (
                <Button onClick={() => pergiKe(aksiPrimer.tujuan)}>{t(aksiPrimer.label)}</Button>
              ),
            })}
        fiscalPeriod={formatPeriod(periode)}
        userName={profil?.full_name ?? 'Pengguna'}
        userRole={t(`peran.${company.role}`, { defaultValue: company.role })}
        onPilihBahasa={pilihBahasa}
        onKeluar={keluar}
        onSelectModule={(id) => {
          const pertama = SIDEBAR[id]?.[0]?.id ?? id
          pergiKe(pertama)
        }}
        onSelectItem={(id) => pergiKe(id)}
      >
        <PenyediaHeaderHalaman pasang={setHeader}>
          <Halaman route={route} konteks={konteks} companies={companies} companyId={companyId}
            onPilihCompany={(id) => {
              setCompanyId(id)
              localStorage.setItem(KUNCI_COMPANY, id)
            }}
          />
        </PenyediaHeaderHalaman>
        <p>
          <Button variant="ghost" onClick={keluar}>
            {t('aksi.keluar', { ns: 'umum' })}
          </Button>
        </p>
      </AppShell>
      </ToastProvider>
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
  // Kait di atas seluruh cabang: `Halaman` mengembalikan lebih awal di hampir
  // setiap jalur, dan kait di bawah salah satunya akan mengubah jumlah kait
  // antar render.
  const { t } = useTranslation('shell')
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
    // Akun yang sedang dilihat dibawa di PATH — `akuntansi/buku-besar/<id>`.
    // Query string tidak dikenal router ini sama sekali.
    if (kedua === 'laba-rugi') return <LabaRugi konteks={konteks} />
    if (kedua === 'buku-besar') {
      return <BukuBesar konteks={konteks} {...(ketiga === undefined ? {} : { accountId: ketiga })} />
    }
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

  return <p>{t('judul.tidakDitemukan')}</p>
}
