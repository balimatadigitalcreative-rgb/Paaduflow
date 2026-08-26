import { useEffect, useRef, useState } from 'react'
import type { Icon } from '@tabler/icons-react'
import {
  IconBell,
  IconDeviceDesktop,
  IconLayoutGrid,
  IconLogout,
  IconMenu2,
  IconMoon,
  IconSearch,
  IconSun,
} from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { BAHASA, type Bahasa } from '../i18n/index.js'

import { CommandPalette } from './command-palette.js'
import { CompanySwitcher, type CompanySwitcherProps } from './company-switcher.js'
import { usePreferences } from './preferences.js'
import styles from './shell.module.css'
import {
  MAX_PINNED_MODULES,
  SIDEBAR_ORDER,
  type ModuleLink,
  type PaletteItem,
  type SidebarItem,
} from './types.js'

/**
 * App shell — Layout_System §3, Component_Specs_AppShell §7.
 *
 * Urutan fokus mengikuti struktur visual: top bar → rail → sidebar → konten →
 * panel kanan. Ia tidak pernah diatur dengan `tabindex` positif; urutan DOM
 * yang menentukan, karena itulah satu-satunya urutan yang tidak akan menyimpang
 * saat tata letak berubah.
 */

/**
 * Lima tujuan di bottom tab bar — Layout_System §5.
 *
 * Batasnya perhatian orang, bukan lebar layar. Menambah tujuan keenam di layar
 * yang kebetulan lebih lebar hanya membuat navigasi berubah bentuk antar
 * perangkat, dan yang hafal satu berhenti hafal yang lain.
 */
const MAX_BOTTOM_TABS = 5

/** Enam detik — Component_Specs_AppShell §1 butir 5. */
const UMUR_BANNER_MS = 6000

/**
 * Ketebalan garis ikon Tabler.
 *
 * Bawaannya 2, dan pada 20px itu terbaca tebal — set ini dirancang outline
 * ringan. Ukurannya sendiri datang dari CSS (`--size-icon`), bukan dari prop,
 * supaya ikon tidak pernah tampil dua ukuran berbeda dalam satu baris.
 */
const STROKE_IKON = 1.5

/**
 * Apakah viewport berada di bawah 768px — Layout_System §5.
 *
 * Dipakai untuk merender bottom tab bar ATAU module rail, tidak pernah
 * keduanya. Menyembunyikan salah satunya dengan CSS saja menyisakan dua
 * landmark navigasi bernama sama di pohon aksesibilitas pada peramban yang
 * memperlakukan `display:none` berbeda, dan dua navigasi bernama "Modul"
 * membuat screen reader menyebutkan keduanya berurutan.
 *
 * `matchMedia` dijaga karena lingkungan uji tidak selalu menyediakannya.
 * Bila tidak ada, jawabannya "bukan ponsel" — kegagalan yang aman, karena
 * rail yang muncul di layar sempit masih dapat dipakai, sedangkan bottom bar
 * di layar lebar akan menutupi konten.
 */
function useLayarSempit(): boolean {
  const [sempit, setSempit] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined

    const kueri = window.matchMedia('(max-width: 767px)')
    const dengar = (): void => setSempit(kueri.matches)
    dengar()

    kueri.addEventListener('change', dengar)
    return () => kueri.removeEventListener('change', dengar)
  }, [])

  return sempit
}

export interface AppShellProps {
  readonly switcher: CompanySwitcherProps
  readonly modules: readonly ModuleLink[]
  readonly activeModule: ModuleLink
  readonly sidebarItems: readonly SidebarItem[]
  readonly activeItemId: string
  readonly paletteItems: readonly PaletteItem[]
  readonly pageTitle: string
  readonly breadcrumb: readonly string[]
  /** Lapis 2: konteks diulang di titik kerja. */
  readonly fiscalPeriod: string
  /**
   * Susunan page header ditetapkan Component_Specs_Composite §7 dan sama di
   * seluruh produk: breadcrumb → judul → badge status → baris konteks → aksi
   * primer → tab. Slot berikut mengisi tiga yang belum ada.
   *
   * Ketiganya opsional karena tidak setiap halaman punya status atau tab —
   * tetapi urutannya tidak dapat diubah halaman, dan itulah gunanya di sini
   * alih-alih digambar ulang per layar.
   */
  readonly statusBadges?: ReactNode
  /** Satu saja. Bila terasa ada dua, hierarkinya belum diputuskan (§7). */
  readonly primaryAction?: ReactNode
  readonly tabs?: ReactNode
  readonly children: ReactNode
  readonly panel?: ReactNode
  /** Ditampilkan di menu profil — §6 menuntut peran ikut disebut. */
  readonly userName?: string
  readonly userRole?: string
  /** Mengganti bahasa antarmuka. Pilihannya disimpan per pengguna di server. */
  onPilihBahasa?(bahasa: Bahasa): void
  /**
   * Keluar dari sesi.
   *
   * Opsional agar harness dan galeri dapat merender shell tanpa sesi. Bila
   * tidak diberikan, item "Keluar" TIDAK dirender sama sekali — bukan dirender
   * lalu diam. Menu yang menawarkan tindakan dan tidak mengerjakannya lebih
   * buruk daripada menu yang tidak menawarkannya: orang mengkliknya, tidak ada
   * yang terjadi, dan yang disimpulkan adalah aplikasinya menggantung.
   */
  onKeluar?(): void
  onSelectModule(moduleId: string): void
  onSelectItem(itemId: string): void
}

/**
 * Nama produk. TIDAK diterjemahkan, dan bukan karena terlupakan.
 *
 * Nama tidak punya terjemahan — alasan yang sama dengan istilah pajak di D-150.
 * Ia konstanta, bukan literal di tengah JSX, supaya pemeriksa i18n tidak perlu
 * mengenal daftar pengecualian dan pembaca berikutnya tidak perlu menebak
 * apakah baris ini terlewat.
 */
const MEREK = 'Paadu'

export function AppShell(props: AppShellProps): ReactNode {
  const { t } = useTranslation('shell')

  /** Tujuan yang benar-benar dapat dibuka pengguna ini, lintas grup. */
  const jumlahTujuan = props.sidebarItems.filter((item) => item.permitted).length
  const { preferences, setTheme, setDensity, toggleSidebar } = usePreferences()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [contextMessage, setContextMessage] = useState<string | null>(null)

  /*
   * Drawer navigasi untuk viewport di bawah 1024px.
   *
   * Satu state untuk rail DAN sidebar, bukan dua. Keduanya keluar dari aliran
   * dokumen bersamaan (Component_Specs_AppShell §8), jadi memisahkannya hanya
   * menciptakan keadaan yang tidak dapat dicapai pengguna — sidebar terbuka
   * tanpa rail-nya.
   *
   * `null` berarti belum pernah dibuka; itu dibedakan dari `false` supaya
   * fokus tidak dipaksa kembali ke pemicu saat halaman pertama dimuat.
   */
  const layarSempit = useLayarSempit()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pemicuDrawer = useRef<HTMLButtonElement | null>(null)
  const drawerPertama = useRef<HTMLButtonElement | null>(null)

  const tersemat = props.modules.slice(0, MAX_PINNED_MODULES)
  const companyAktif =
    props.switcher.tenant.companies.find((c) => c.id === props.switcher.activeCompanyId) ??
    props.switcher.tenant.companies[0]

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null
      const sedangMengetik =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      // Pintasan tidak aktif saat fokus berada di field input —
      // Component_Specs_AppShell §7.
      if (sedangMengetik === true && event.key !== 'Escape') return

      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (event.key === '[') {
        event.preventDefault()
        toggleSidebar()
      }
      // Esc menutup lapisan teratas — §7. Drawer ditutup lebih dulu daripada
      // palette karena ia yang menutupi seluruh layar di viewport sempit.
      if (event.key === 'Escape') {
        setDrawerOpen((terbuka) => {
          if (terbuka) pemicuDrawer.current?.focus()
          return false
        })
      }
    }

    globalThis.addEventListener?.('keydown', onKeyDown)
    return () => globalThis.removeEventListener?.('keydown', onKeyDown)
  }, [toggleSidebar])

  /*
   * Fokus dipindahkan ke dalam drawer saat ia dibuka, dan dikembalikan ke
   * pemicunya saat ditutup — Component_Specs_AppShell §8.
   *
   * Tanpa ini, pengguna keyboard yang membuka drawer tetap berada di top bar
   * dan harus menekan Tab melewati seluruh chrome untuk mencapai navigasi yang
   * baru saja ia minta.
   */
  useEffect(() => {
    if (drawerOpen) drawerPertama.current?.focus()
  }, [drawerOpen])

  function tutupDrawer(): void {
    setDrawerOpen(false)
    pemicuDrawer.current?.focus()
  }

  /*
   * Banner konteks menetap enam detik, lalu hilang sendiri — §1 butir 5.
   *
   * Enam detik, bukan selamanya: banner yang menuntut ditutup manual akan
   * ditutup tanpa dibaca dalam seminggu, dan lapis ketiga berhenti bekerja.
   * Tetap dapat ditutup lebih awal.
   */
  useEffect(() => {
    if (contextMessage === null) return undefined
    const jam = setTimeout(() => setContextMessage(null), UMUR_BANNER_MS)
    return () => clearTimeout(jam)
  }, [contextMessage])

  function pindahCompany(companyId: string): void {
    props.switcher.onSwitch(companyId)
    const company = props.switcher.tenant.companies.find((item) => item.id === companyId)
    setContextMessage(t('company.berpindah', { nama: company?.legalName ?? t('company.lain') }))
    // Drawer ditutup supaya banner konteks tidak tertutup olehnya di ponsel —
    // lapis ketiga tidak berguna bila tidak terlihat.
    setDrawerOpen(false)
  }

  return (
    <div
      className={styles.shell}
      data-density={preferences.density}
      data-drawer={drawerOpen}
      {...(preferences.theme === 'system' ? {} : { 'data-theme': preferences.theme })}
    >
      <div className={styles.skipLinks}>
        <a href="#konten-utama" className={styles.skipLink}>
          {t('navigasi.lewatiKeKonten')}
        </a>
        <a href="#navigasi-modul" className={styles.skipLink}>
          {t('navigasi.lewatiKeModul')}
        </a>
      </div>

      <header className={styles.topBar}>
        {/*
          Tombol menu hanya terlihat di bawah 1024px lewat CSS, tetapi selalu
          dirender. Menghapusnya dari DOM saat layar melebar akan mengubah
          urutan fokus tepat ketika perangkat diputar.

          Namanya TETAP "Navigasi", dan keadaannya disampaikan `aria-expanded`.
          Menggantinya menjadi "Tutup navigasi" saat terbuka membuat dua tombol
          berbeda bernama sama — tombol ini dan backdrop-nya — sehingga
          pengguna screen reader yang menelusuri daftar tombol tidak punya cara
          membedakan keduanya.
        */}
        <button
          type="button"
          ref={pemicuDrawer}
          className={styles.menuButton}
          aria-label={t('navigasi.buka')}
          aria-expanded={drawerOpen}
          aria-controls="navigasi-modul"
          onClick={() => (drawerOpen ? tutupDrawer() : setDrawerOpen(true))}
        >
          <IconMenu2 className={styles.ikon} stroke={STROKE_IKON} />
        </button>

        <a href="#beranda" className={styles.mark}>
          {MEREK}
        </a>

        <CompanySwitcher {...props.switcher} onSwitch={pindahCompany} />

        <button type="button" className={styles.cariTrigger} onClick={() => setPaletteOpen(true)}>
          <IconSearch className={styles.ikon} stroke={STROKE_IKON} />
          <span>{t('navigasi.cari')}</span>
          <span className={styles.paletteHint}>⌘K</span>
        </button>

        <span className={styles.topBarSpacer} />

        {/*
          Notifikasi belum punya isi. Ia tetap dirender supaya susunan top bar
          tidak berubah saat fiturnya masuk — top bar yang bergeser tempatnya
          memaksa orang mencari ulang apa yang sudah dihafal.
        */}
        <button type="button" className={styles.topBarIkon} aria-label={t('navigasi.notifikasi')} disabled>
          <IconBell className={styles.ikon} stroke={STROKE_IKON} />
        </button>

        {/*
          Tema dan kepadatan adalah PENGATURAN, bukan navigasi.

          Keduanya sebelumnya terpampang di top bar sebagai select mentah. Top
          bar adalah chrome permanen: setiap piksel di sana diambil dari data,
          dan setiap kontrol di sana bersaing dengan pengalih company — satu
          kontrol yang paling tidak boleh terlewat (Layout_System §4).

          Sekarang keduanya di menu profil, tempat Component_Specs_AppShell §6
          memang menempatkannya, bersama nama pengguna dan keluar.
        */}
        <MenuPengguna
          preferences={preferences}
          setTheme={setTheme}
          setDensity={setDensity}
          nama={props.userName}
          peran={props.userRole}
          {...(props.onPilihBahasa === undefined ? {} : { onPilihBahasa: props.onPilihBahasa })}
          {...(props.onKeluar === undefined ? {} : { onKeluar: props.onKeluar })}
        />
      </header>

      {/*
        Backdrop hanya terlihat di bawah 1024px dan hanya saat drawer terbuka.
        Ia tombol, bukan div: menutup drawer dengan mengklik di luarnya adalah
        aksi, dan aksi harus dapat dicapai keyboard maupun screen reader.
      */}
      {drawerOpen ? (
        <button
          type="button"
          className={styles.drawerBackdrop}
          aria-label={t('navigasi.tutup')}
          onClick={tutupDrawer}
        />
      ) : null}

      {layarSempit ? null : (
      <nav id="navigasi-modul" className={styles.rail} aria-label={t('navigasi.modul')}>
        {tersemat.map((module, nomor) => (
          <button
            key={module.id}
            type="button"
            {...(nomor === 0 ? { ref: drawerPertama } : {})}
            className={styles.railButton}
            // Ikon wajib punya label. Ikon tanpa label adalah teka-teki.
            aria-label={module.name}
            title={module.name}
            aria-current={module.id === props.activeModule.id ? 'page' : undefined}
            onClick={() => props.onSelectModule(module.id)}
          >
            <module.glyph className={styles.ikon} stroke={STROKE_IKON} />
            {module.pendingCount !== undefined && module.pendingCount > 0 ? (
              <span className={styles.railBadge}>
                {module.pendingCount}
                <span className={styles.visuallyHidden}> menunggu tindakan</span>
              </span>
            ) : null}
          </button>
        ))}
        <button type="button" className={styles.railButton} aria-label={t('navigasi.semuaModul')} title={t('navigasi.semuaModul')}>
          <IconLayoutGrid className={styles.ikon} stroke={STROKE_IKON} />
        </button>
      </nav>
      )}

      {/*
        Sidebar hanya dirender bila modulnya punya LEBIH DARI SATU tujuan.

        Dasbor punya satu layar. Kolom 240px yang berisi satu item — dan item
        itu adalah halaman yang sedang dibuka — tidak memberi tahu apa pun:
        rail sudah menunjukkan modul mana yang aktif, dan page header sudah
        menyebut nama halamannya. Yang tersisa hanya ruang kosong yang membuat
        halaman terlihat belum selesai.

        Yang TIDAK dilakukan: mengarang sub-halaman untuk mengisi kolom. Itu
        keputusan produk yang diambil demi tata letak, dan urutan itu selalu
        salah. Layout_System §3 pun menyebut pengelompokan baku berlaku "untuk
        modul transaksional" — dasbor bukan salah satunya.
      */}
      {jumlahTujuan < 2 ? null : (
      <nav
        className={styles.sidebar}
        data-collapsed={preferences.sidebarCollapsed}
        aria-label={t('navigasi.navigasiModul', { modul: props.activeModule.name })}
      >
        {SIDEBAR_ORDER.map((group) => {
          // Item tanpa izin disembunyikan, bukan dinonaktifkan. Grup yang
          // menjadi kosong ikut hilang — menu tidak pernah tampil berisi nol item.
          const isi = props.sidebarItems.filter((item) => item.group === group && item.permitted)
          if (isi.length === 0) return null
          return (
            <div key={group}>
              {/* Nama grup diterjemahkan. Ia sempat dirender apa adanya, dan
                  "TRANSAKSI" berdiri di sebelah "Dashboard" di layar Inggris. */}
              <p className={styles.groupLabel}>{t(`grup.${group}`)}</p>
              <ul role="list" className={styles.paletteList}>
                {isi.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={styles.navItem}
                      aria-current={item.id === props.activeItemId ? 'page' : undefined}
                      onClick={() => props.onSelectItem(item.id)}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </nav>
      )}

      <div className={styles.content}>
        {/* Perpindahan konteks diumumkan assertive, bukan polite. Ia memengaruhi
            kebenaran seluruh data di layar, jadi ia harus menyela. */}
        <div aria-live="assertive" aria-atomic="true">
          {contextMessage === null ? null : (
            <div className={styles.contextBanner}>
              <span>{contextMessage}</span>
              <button
                type="button"
                className={styles.navItem}
                onClick={() => setContextMessage(null)}
              >
                {t('aksi.tutup', { ns: 'umum' })}
              </button>
            </div>
          )}
        </div>

        <div className={styles.contentRow}>
          <main id="konten-utama" className={styles.content} tabIndex={-1}>
            <div className={styles.pageHeader}>
              <nav aria-label={t('navigasi.breadcrumb')}>
                <ol role="list" className={styles.breadcrumb}>
                  {props.breadcrumb.map((segment, index) => (
                    <li key={segment}>
                      {index === props.breadcrumb.length - 1 ? (
                        <span aria-current="page">{segment}</span>
                      ) : (
                        <a href={`#${segment}`}>{segment}</a>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>

              <div className={styles.titleRow}>
                <div className={styles.titleGroup}>
                  <h1 className={styles.pageTitle}>{props.pageTitle}</h1>
                  {props.statusBadges}
                </div>
                {props.primaryAction === undefined ? null : (
                  <div className={styles.primaryAction}>{props.primaryAction}</div>
                )}
              </div>

              <p className={styles.contextRow}>
                <strong>{companyAktif?.legalName}</strong> · {props.fiscalPeriod} ·{' '}
                {companyAktif?.currency}
              </p>

              {props.tabs}
            </div>

            <div className={styles.body}>{props.children}</div>
          </main>

          {props.panel === undefined ? null : (
            <aside className={styles.panel} aria-label={t('navigasi.panelDetail')}>
              {props.panel}
            </aside>
          )}
        </div>
      </div>

      {/*
        Bottom tab bar — Layout_System §5, maksimal lima tujuan.
        Hanya terlihat di bawah 768px lewat CSS.

        Lima, bukan "sebanyak yang muat". Batasnya bukan lebar layar melainkan
        berapa tujuan yang dapat dikenali orang tanpa membaca satu per satu, dan
        angka itu tidak berubah walau layarnya melebar.

        Label ikut ditampilkan, tidak hanya ikon. Ikon tanpa label adalah
        teka-teki (§2), dan di ponsel tidak ada hover untuk memunculkan tooltip.
      */}
      {layarSempit ? (
      <nav id="navigasi-modul" className={styles.bottomBar} aria-label={t('navigasi.modul')}>
        {props.modules.slice(0, MAX_BOTTOM_TABS).map((module) => (
          <button
            key={module.id}
            type="button"
            className={styles.bottomItem}
            aria-current={module.id === props.activeModule.id ? 'page' : undefined}
            onClick={() => props.onSelectModule(module.id)}
          >
            <module.glyph className={styles.ikon} stroke={STROKE_IKON} />
            <span>{module.name}</span>
          </button>
        ))}
      </nav>
      ) : null}

      <CommandPalette
        open={paletteOpen}
        items={props.paletteItems}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  )
}


/**
 * Menu profil — Component_Specs_AppShell §6.
 *
 * Isinya: nama pengguna, perannya, tema, kepadatan, lalu keluar. Peran ikut
 * disebut karena pengguna sering tidak tahu mengapa suatu menu tidak terlihat,
 * dan jawabannya hampir selalu perannya.
 *
 * Tema dan kepadatan dirender sebagai `radiogroup`, bukan `select`. Keduanya
 * pilihan dari himpunan tetap yang pendek, dan radio menunjukkan seluruh
 * pilihan sekaligus beserta mana yang aktif — select menyembunyikan keduanya di
 * balik satu klik.
 */
function MenuPengguna({
  preferences,
  setTheme,
  setDensity,
  nama,
  peran,
  onPilihBahasa,
  onKeluar,
}: {
  readonly preferences: { theme: string; density: string }
  setTheme: (nilai: 'system' | 'light' | 'dark') => void
  setDensity: (nilai: 'comfortable' | 'compact') => void
  readonly nama?: string | undefined
  readonly peran?: string | undefined
  onPilihBahasa?(bahasa: Bahasa): void
  onKeluar?(): void
}): ReactNode {
  const { t, i18n } = useTranslation('shell')
  const [open, setOpen] = useState(false)
  const pemicu = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return
      setOpen(false)
      pemicu.current?.focus()
    }
    globalThis.addEventListener?.('keydown', onKeyDown)
    return () => globalThis.removeEventListener?.('keydown', onKeyDown)
  }, [open])

  const inisial = (nama ?? 'Pengguna')
    .split(' ')
    .slice(0, 2)
    .map((bagian) => bagian.charAt(0).toUpperCase())
    .join('')

  return (
    <div className={styles.menuPengguna}>
      <button
        ref={pemicu}
        type="button"
        className={styles.userAvatar}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          nama === undefined
            ? t('menuPengguna.pemicu')
            : t('menuPengguna.pemicuDengan', { nama })
        }
        onClick={() => setOpen((sebelum) => !sebelum)}
      >
        {inisial}
      </button>

      {open ? (
        <>
          {/* Menutup dengan mengklik di luar adalah aksi, jadi ia tombol. */}
          <button
            type="button"
            className={styles.menuBackdrop}
            aria-label={t('menuPengguna.tutup')}
            onClick={() => {
              setOpen(false)
              pemicu.current?.focus()
            }}
          />

          <div className={styles.menuPanel} role="menu" aria-label={t('menuPengguna.pemicu')}>
            <div className={styles.menuIdentitas}>
              <strong>{nama ?? 'Pengguna'}</strong>
              {peran === undefined ? null : <span className={styles.menuPeran}>{peran}</span>}
            </div>

            <PilihanMenu
              label={t('menuPengguna.tema')}
              nilai={preferences.theme}
              onPilih={(nilai) => setTheme(nilai as 'system' | 'light' | 'dark')}
              pilihan={[
                { nilai: 'system', label: t('menuPengguna.temaSistem'), Ikon: IconDeviceDesktop },
                { nilai: 'light', label: t('menuPengguna.temaTerang'), Ikon: IconSun },
                { nilai: 'dark', label: t('menuPengguna.temaGelap'), Ikon: IconMoon },
              ]}
            />

            <PilihanMenu
              label={t('menuPengguna.kepadatan')}
              nilai={preferences.density}
              onPilih={(nilai) => setDensity(nilai as 'comfortable' | 'compact')}
              pilihan={[
                { nilai: 'comfortable', label: t('menuPengguna.kepadatanLega') },
                { nilai: 'compact', label: t('menuPengguna.kepadatanPadat') },
              ]}
            />

            {/*
              Nama bahasa ditulis DALAM bahasa itu sendiri — "English", bukan
              "Inggris". Orang yang tersesat di antarmuka berbahasa asing mencari
              kata yang ia kenali, dan menerjemahkan nama bahasa justru
              menyembunyikannya dari satu-satunya orang yang membutuhkannya.
            */}
            {onPilihBahasa === undefined ? null : (
              <PilihanMenu
                label={t('menuPengguna.bahasa')}
                nilai={i18n.language}
                onPilih={(nilai) => onPilihBahasa(nilai as Bahasa)}
                pilihan={BAHASA.map((satu) => ({
                  nilai: satu,
                  label: t(satu === 'id' ? 'menuPengguna.bahasaId' : 'menuPengguna.bahasaEn'),
                }))}
              />
            )}

            {/*
              Menu ditutup SEBELUM keluar dijalankan.

              Keluar mengganti seluruh pohon dengan layar masuk, dan panel yang
              masih terbuka saat itu meninggalkan `menuBackdrop` di atas form —
              layar masuk yang tampil tetapi tidak dapat diklik.
            */}
            {onKeluar === undefined ? null : (
              <button
                type="button"
                className={styles.menuItem}
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onKeluar()
                }}
              >
                <IconLogout className={styles.ikon} stroke={STROKE_IKON} />
                <span>{t('aksi.keluar', { ns: 'umum' })}</span>
              </button>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

function PilihanMenu({
  label,
  nilai,
  pilihan,
  onPilih,
}: {
  readonly label: string
  readonly nilai: string
  readonly pilihan: readonly {
    nilai: string
    label: string
    Ikon?: Icon
  }[]
  onPilih: (nilai: string) => void
}): ReactNode {
  return (
    <div className={styles.menuGrup} role="group" aria-label={label}>
      <span className={styles.menuLabel}>{label}</span>
      <div className={styles.menuPilihan} role="radiogroup" aria-label={label}>
        {pilihan.map((satu) => (
          <button
            key={satu.nilai}
            type="button"
            role="radio"
            aria-checked={satu.nilai === nilai}
            className={styles.menuOpsi}
            onClick={() => onPilih(satu.nilai)}
          >
            {satu.Ikon === undefined ? null : (
              <satu.Ikon className={styles.ikon} stroke={STROKE_IKON} />
            )}
            <span>{satu.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
