import {
  IconBook2,
  IconChecklist,
  IconPackage,
  IconReceipt,
  IconShoppingCart,
} from '@tabler/icons-react'
import type {
  ModuleLink,
  PaletteItem,
  SidebarItem,
  TenantSummary,
} from './shell/types.js'

/**
 * Data contoh untuk menjalankan shell sebelum modul mana pun ada.
 *
 * Ia hidup di satu berkas supaya jelas apa yang belum nyata. Saat modul
 * pertama menyediakan datanya sendiri, berkas ini menyusut, bukan menyebar.
 */

export const TENANT: TenantSummary = {
  id: 'tenant-nusantara',
  name: 'Nusantara Group',
  companies: [
    {
      id: 'company-jaya',
      legalName: 'PT Nusantara Jaya',
      taxId: '01.234.567.8-901.000',
      currency: 'IDR',
      fiscalYearLabel: 'FY2026 Jan–Des',
      status: 'active',
    },
    {
      id: 'company-sentosa',
      legalName: 'PT Nusantara Sentosa',
      taxId: '02.345.678.9-012.000',
      currency: 'IDR',
      // Periode fiskal berbeda adalah pembeda paling menentukan saat menginput.
      fiscalYearLabel: 'FY2026 Apr–Mar',
      status: 'active',
    },
    {
      id: 'company-lama',
      legalName: 'PT Nusantara Lama',
      taxId: null,
      currency: 'IDR',
      fiscalYearLabel: 'FY2025 Jan–Des',
      status: 'inactive',
    },
  ],
}

export const MODULES: readonly ModuleLink[] = [
  { id: 'penjualan', name: 'Penjualan', glyph: IconReceipt },
  { id: 'pembelian', name: 'Pembelian', glyph: IconShoppingCart },
  { id: 'persediaan', name: 'Persediaan', glyph: IconPackage },
  { id: 'akuntansi', name: 'Akuntansi', glyph: IconBook2 },
  { id: 'persetujuan', name: 'Persetujuan', glyph: IconChecklist, pendingCount: 3 },
]

export const SIDEBAR_ITEMS: readonly SidebarItem[] = [
  { id: 'faktur', label: 'Faktur Penjualan', group: 'Transaksi', permitted: true },
  { id: 'pesanan', label: 'Pesanan Penjualan', group: 'Transaksi', permitted: true },
  { id: 'penawaran', label: 'Penawaran', group: 'Transaksi', permitted: true },
  { id: 'pelanggan', label: 'Customer', group: 'Data induk', permitted: true },
  { id: 'item', label: 'Item', group: 'Data induk', permitted: true },
  { id: 'laba-rugi', label: 'Laba Rugi', group: 'Laporan', permitted: true },
  // Tidak diizinkan: tidak dirender sama sekali, bukan dirender nonaktif.
  { id: 'pengaturan-penjualan', label: 'Pengaturan Penjualan', group: 'Pengaturan', permitted: false },
]

export function paletteItems(onNavigate: (id: string) => void): readonly PaletteItem[] {
  return [
    {
      id: 'nav-faktur',
      label: 'Faktur Penjualan',
      group: 'Navigasi',
      hint: 'g lalu f',
      permitted: true,
      run: () => onNavigate('faktur'),
    },
    {
      id: 'nav-laba-rugi',
      label: 'Laporan Laba Rugi',
      group: 'Navigasi',
      permitted: true,
      run: () => onNavigate('laba-rugi'),
    },
    {
      id: 'aksi-faktur-baru',
      label: 'Buat Faktur Penjualan',
      group: 'Aksi',
      permitted: true,
      run: () => onNavigate('faktur'),
    },
    {
      id: 'aksi-posting',
      label: 'Posting Jurnal',
      group: 'Aksi',
      // Tidak diizinkan bagi pengguna ini: ia tidak muncul, dan tidak dihitung.
      permitted: false,
      run: () => undefined,
    },
    {
      id: 'entitas-inv-142',
      label: 'INV/2026/08/0142',
      group: 'Entitas',
      hint: 'Faktur Penjualan',
      permitted: true,
      run: () => onNavigate('faktur'),
    },
    {
      id: 'ai-tanya',
      label: 'Tanya asisten tentang halaman ini',
      group: 'AI',
      permitted: true,
      run: () => onNavigate('faktur'),
    },
  ]
}
