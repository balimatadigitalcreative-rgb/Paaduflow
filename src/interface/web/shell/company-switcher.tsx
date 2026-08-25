import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconChevronDown } from '@tabler/icons-react'
import type { ReactNode } from 'react'

import styles from './shell.module.css'
import type { CompanySummary, TenantSummary } from './types.js'

/**
 * Pengalih tenant dan company — komponen paling berisiko di seluruh produk.
 *
 * Salah konteks company berarti transaksi keuangan masuk ke entitas legal yang
 * salah. Karena itu: pemicunya tidak pernah bersembunyi di balik ikon, setiap
 * baris menampilkan empat metadata pembeda, dan perpindahannya tidak pernah
 * senyap.
 */

export interface CompanySwitcherProps {
  readonly tenant: TenantSummary
  readonly otherTenants: readonly TenantSummary[]
  readonly activeCompanyId: string
  onSwitch(companyId: string): void
}

function initials(name: string): string {
  return name
    .replace(/^PT\.?\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((kata) => kata.charAt(0).toUpperCase())
    .join('')
}

export function CompanySwitcher({
  tenant,
  otherTenants,
  activeCompanyId,
  onSwitch,
}: CompanySwitcherProps): ReactNode {
  const { t } = useTranslation('shell')

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const panelId = useId()

  const active =
    tenant.companies.find((company) => company.id === activeCompanyId) ?? tenant.companies[0]

  const cocok = (company: CompanySummary): boolean =>
    company.legalName.toLowerCase().includes(query.trim().toLowerCase())

  // Company `inactive` ditampilkan di grup terpisah, tidak disembunyikan —
  // pengguna perlu tahu ia ada.
  const aktif = tenant.companies.filter((company) => company.status === 'active' && cocok(company))
  const nonaktif = tenant.companies.filter(
    (company) => company.status === 'inactive' && cocok(company),
  )
  const terurut = [...aktif, ...nonaktif]

  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  function tutup(): void {
    setOpen(false)
    setQuery('')
    setHighlighted(0)
    // Fokus kembali ke pemicu — tanpa ini, pengguna keyboard terlempar ke awal
    // dokumen setiap kali menutup panel.
    triggerRef.current?.focus()
  }

  function pilih(company: CompanySummary): void {
    onSwitch(company.id)
    tutup()
  }

  function onKeyDown(event: React.KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      tutup()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((index) => Math.min(index + 1, terurut.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      const dipilih = terurut[highlighted]
      if (dipilih !== undefined) {
        event.preventDefault()
        pilih(dipilih)
      }
    }
  }

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        className={styles.companyTrigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((sebelumnya) => !sebelumnya)}
      >
        {/*
          Avatar company memakai rounded square; avatar ORANG memakai lingkaran
          — Component_Specs_AppShell §1. Pembedaan bentuk itu penting justru di
          top bar, tempat keduanya bersebelahan.
        */}
        <span className={styles.companyAvatar} aria-hidden="true">
          {initials(active?.legalName ?? '?')}
        </span>

        {/*
          Company sebagai teks utama, tenant sebagai teks sekunder di bawahnya.
          Sebelumnya keduanya dijejalkan satu baris dipisah garis miring, dan di
          layar sempit yang terpotong justru nama company — satu hal yang paling
          tidak boleh hilang (§1: pemicu adalah elemen terakhir yang dipotong).
        */}
        <span className={styles.companyTeks}>
          <span className={styles.companyName}>{active?.legalName}</span>
          <span className={styles.tenantName}>{tenant.name}</span>
        </span>

        <IconChevronDown className={styles.chevron} stroke={1.5} aria-hidden="true" />
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={t('company.pilih')}
          className={styles.switcherPanel}
          onKeyDown={onKeyDown}
        >
          <input
            ref={searchRef}
            type="search"
            className={styles.paletteInput}
            placeholder={t('company.cari')}
            aria-label={t('company.cari')}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setHighlighted(0)
            }}
          />

          <ul role="listbox" aria-label={t('company.label')} className={styles.paletteList}>
            {aktif.length > 0 ? (
              <li role="presentation" className={styles.groupLabel}>
                {tenant.name}
              </li>
            ) : null}
            {terurut.map((company, index) => (
              <li key={company.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={index === highlighted}
                  className={styles.companyOption}
                  onClick={() => pilih(company)}
                  onMouseEnter={() => setHighlighted(index)}
                >
                  <span className={styles.companyAvatar} aria-hidden="true">
                    {initials(company.legalName)}
                  </span>
                  <span>
                    <span className={styles.companyName}>{company.legalName}</span>
                    {/* Empat metadata pembeda. Periode fiskal yang berbeda
                        adalah pembeda paling menentukan saat menginput. */}
                    <span className={styles.companyMeta}>
                      <span>{company.taxId ?? 'Tanpa NPWP'}</span>
                      <span>{company.currency}</span>
                      <span>{company.fiscalYearLabel}</span>
                      {company.status === 'inactive' ? <span>{t('company.nonaktif')}</span> : null}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {otherTenants.length > 0 ? (
            <>
              <p className={styles.groupLabel}>{t('company.tenantLain')}</p>
              <ul role="list" className={styles.paletteList}>
                {otherTenants.map((lain) => (
                  <li key={lain.id}>
                    {/* Berpindah tenant memuat ulang aplikasi sepenuhnya —
                        perpindahan yang lebih besar, ditandai berbeda. */}
                    <span className={styles.navItem}>{lain.name} — muat ulang aplikasi</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
