import type { ReactNode } from 'react'

import { monthLabel } from '#shared/fiscal-period'

import { Badge } from '../components/badge.js'
import { Button } from '../components/button.js'
import { href } from '../router.js'
import styles from './pages.module.css'

/**
 * Dasbor sederhana: company yang dapat diakses, dan jalan pintas ke tiap modul.
 *
 * Bukan ringkasan angka. Ringkasan yang benar memerlukan laporan yang belum
 * dibangun, dan dasbor berisi angka karangan lebih buruk daripada dasbor yang
 * jujur mengatakan ia baru berisi navigasi.
 */

export interface CompanyDapatDiakses {
  readonly id: string
  readonly tenant_name: string
  readonly legal_name: string
  readonly fiscal_year_start_month: number
  readonly role: string
}

const LABEL_PERAN: Record<string, string> = {
  tenant_owner: 'Pemilik Tenant',
  tenant_admin: 'Admin Tenant',
  company_admin: 'Admin Company',
  member: 'Anggota',
}

export function Dasbor({
  companies,
  activeCompanyId,
  onPilihCompany,
}: {
  readonly companies: readonly CompanyDapatDiakses[]
  readonly activeCompanyId: string
  readonly onPilihCompany: (id: string) => void
}): ReactNode {
  return (
    <div className={styles.stack}>
      <section className={styles.stack}>
        <h2>Company yang dapat Anda akses</h2>
        <div className={styles.cards}>
          {companies.map((company) => (
            <div
              key={company.id}
              className={`${styles.card} ${company.id === activeCompanyId ? styles.cardActive : ''}`}
            >
              <strong>{company.legal_name}</strong>
              <span className={styles.metaLabel}>{company.tenant_name}</span>
              <span className={styles.metaLabel}>
                {/* Tahun fiskal ikut ditampilkan karena ia berbeda antar company
                    dan menentukan periode yang sedang berjalan. */}
                Tahun fiskal mulai {monthLabel(company.fiscal_year_start_month)}
              </span>
              <div>
                <Badge tone="accent">{LABEL_PERAN[company.role] ?? company.role}</Badge>
              </div>
              {company.id === activeCompanyId ? (
                <Badge tone="success">Sedang aktif</Badge>
              ) : (
                <Button variant="secondary" onClick={() => onPilihCompany(company.id)}>
                  Beralih ke company ini
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.stack}>
        <h2>Mulai dari mana</h2>
        <div className={styles.cards}>
          <div className={styles.card}>
            <strong>Penjualan</strong>
            <p>Buat faktur, ajukan, setujui, lalu posting ke buku besar.</p>
            <a href={href('penjualan')}>Buka daftar faktur</a>
          </div>
          <div className={styles.card}>
            <strong>Pembelian</strong>
            <p>Pesanan, penerimaan barang, dan tagihan dengan pencocokan tiga arah.</p>
            <a href={href('pembelian/pesanan')}>Buka pesanan pembelian</a>
          </div>
          <div className={styles.card}>
            <strong>Akuntansi</strong>
            <p>Bagan akun dan buku besar. Baca saja — jurnal lahir dari posting dokumen.</p>
            <a href={href('akuntansi/bagan-akun')}>Buka bagan akun</a>
          </div>
        </div>
      </section>
    </div>
  )
}
