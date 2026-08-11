import { useState } from 'react'

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'

import { Combobox, type ComboboxState } from '#interface/web/components/combobox'
import { Avatar, DelayedLoading, SkeletonText, Tooltip } from '#interface/web/components/feedback'
import { FiscalPeriodPicker } from '#interface/web/components/pickers'
import { DateField } from '#interface/web/components/pickers'
import { periodOf } from '#shared/fiscal-period'

afterEach(() => {
  document.body.innerHTML = ''
})

function Kotak({ state }: { state: ComboboxState }) {
  return (
    <Combobox
      label="Customer"
      value={null}
      state={state}
      onSearch={() => undefined}
      onChange={() => undefined}
    />
  )
}

test('combobox membedakan kosong dari tidak ada hasil pencarian', async () => {
  const pengguna = userEvent.setup()

  const { rerender } = render(<Kotak state={{ kind: 'empty' }} />)
  await pengguna.click(screen.getByLabelText('Customer'))
  expect(screen.getByText('Belum ada data.')).toBeDefined()

  rerender(<Kotak state={{ kind: 'no_match' }} />)
  // Dua keadaan yang berbeda: "belum ada apa-apa" menuntut membuat data,
  // "tidak cocok" menuntut mengubah pencarian.
  expect(screen.getByText('Tidak ada hasil untuk pencarian ini.')).toBeDefined()
  expect(screen.queryByText('Belum ada data.')).toBeNull()
})

test('combobox menampilkan keadaan memuat dan gagal muat', async () => {
  const pengguna = userEvent.setup()

  const { rerender } = render(<Kotak state={{ kind: 'loading' }} />)
  await pengguna.click(screen.getByLabelText('Customer'))
  expect(screen.getByText('Memuat…')).toBeDefined()

  rerender(<Kotak state={{ kind: 'error', message: 'Gagal memuat pelanggan.' }} />)
  expect(screen.getByRole('alert').textContent).toBe('Gagal memuat pelanggan.')
})

test('opsi terpilih tetap terbaca meski di luar halaman hasil saat ini', () => {
  render(
    <Combobox
      label="Customer"
      // Hasil pencarian tidak memuat opsi ini; nilainya datang dari `value`.
      value={{ value: 'c-9', label: 'PT Jauh Di Halaman Lain' }}
      state={{ kind: 'ready', options: [{ value: 'c-1', label: 'PT Dekat' }] }}
      onSearch={() => undefined}
      onChange={() => undefined}
    />,
  )

  expect((screen.getByLabelText('Customer') as HTMLInputElement).value).toBe(
    'PT Jauh Di Halaman Lain',
  )
})

test('combobox dapat dipilih dengan panah dan Enter', async () => {
  const pengguna = userEvent.setup()
  const onChange = vi.fn()

  render(
    <Combobox
      label="Customer"
      value={null}
      state={{
        kind: 'ready',
        options: [
          { value: 'c-1', label: 'PT Satu' },
          { value: 'c-2', label: 'PT Dua' },
        ],
      }}
      onSearch={() => undefined}
      onChange={onChange}
    />,
  )

  await pengguna.click(screen.getByLabelText('Customer'))
  await pengguna.keyboard('{ArrowDown}{Enter}')

  expect(onChange).toHaveBeenCalledWith({ value: 'c-2', label: 'PT Dua' })
})

test('pemilih periode fiskal menampilkan label fiskal dan bulan kalender', () => {
  render(
    <FiscalPeriodPicker
      label="Periode"
      fiscalYear={2026}
      fiscalYearStartMonth={4}
      value={periodOf(new Date(2026, 8, 10), 4)}
      onChange={() => undefined}
    />,
  )

  const pilihan = screen.getByLabelText('Periode') as HTMLSelectElement
  // Keduanya, selalu bersamaan.
  expect([...pilihan.options].map((o) => o.textContent)).toContain('FY2026 P6 · Sep 2026')
  expect(pilihan.value).toBe('2026-06')
})

test('tanggal dapat diketik dalam berbagai bentuk lalu dirapikan saat blur', async () => {
  const pengguna = userEvent.setup()

  function Terkendali() {
    const [nilai, setNilai] = useState<Date | null>(null)
    return <DateField label="Tanggal" value={nilai} onChange={setNilai} />
  }

  render(<Terkendali />)
  const input = screen.getByLabelText('Tanggal')

  // Akuntan mengetik tanggal jauh lebih cepat daripada mengkliknya.
  await pengguna.type(input, '10/8/2026')
  await pengguna.tab()

  expect((input as HTMLInputElement).value).toBe('10 Agu 2026')
})

test('tooltip muncul setelah jeda, bukan seketika', async () => {
  const pengguna = userEvent.setup()

  render(
    <Tooltip label="Faktur Penjualan">
      <button type="button">Pj</button>
    </Tooltip>,
  )

  await pengguna.tab()

  // Tooltip yang muncul seketika akan berkedip di setiap gerakan tetikus.
  expect(screen.queryByRole('tooltip')).toBeNull()

  const tooltip = await screen.findByRole('tooltip', {}, { timeout: 2000 })
  expect(tooltip.textContent).toBe('Faktur Penjualan')
})

test('pemuatan di bawah 300ms tidak menampilkan apa pun', async () => {
  render(
    <DelayedLoading loading skeleton={<SkeletonText />}>
      <p>Selesai</p>
    </DelayedLoading>,
  )

  // Indikator yang berkedip lebih mengganggu daripada jeda singkat yang bahkan
  // tidak sempat terlihat.
  expect(document.body.textContent).toBe('')

  await waitFor(
    () => {
      expect(document.querySelector('span[aria-hidden="true"]')).not.toBeNull()
    },
    { timeout: 2000 },
  )
})

test('avatar membedakan orang dan company lewat bentuk, dan namanya terbaca', () => {
  render(
    <>
      <Avatar name="Ayu Saraswati" />
      <Avatar name="PT Nusantara Jaya" shape="square" />
    </>,
  )

  // Nama lengkap tersedia bagi screen reader, bukan hanya inisial.
  expect(screen.getByText('Ayu Saraswati')).toBeDefined()
  expect(screen.getByText('PT Nusantara Jaya')).toBeDefined()
})
