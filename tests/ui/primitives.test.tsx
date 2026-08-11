import { useState } from 'react'

import axe from 'axe-core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'

import { Gallery } from '#interface/web/gallery'
import { Button } from '#interface/web/components/button'
import { Checkbox, Switch } from '#interface/web/components/choice'
import { CurrencyInput } from '#interface/web/components/currency-input'
import { TextField } from '#interface/web/components/text-field'

/**
 * Perilaku keyboard dan aturan yang paling mudah dilanggar.
 *
 * Yang diuji di sini bukan bahwa komponen tampil, melainkan bahwa keputusan
 * yang tertulis di spesifikasi benar-benar terjadi — dan bahwa ia akan gagal
 * bila seseorang membalikkannya nanti.
 */

afterEach(() => {
  document.body.innerHTML = ''
})

test('galeri lolos audit aksesibilitas otomatis', async () => {
  const { container } = render(<Gallery />)

  const hasil = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })

  if (hasil.violations.length > 0) {
    console.error(
      hasil.violations
        .map((v) => `[${v.impact ?? 'tanpa-severity'}] ${v.id}: ${v.help} (${v.nodes.length} simpul)`)
        .join('\n'),
    )
  }

  expect(hasil.violations).toEqual([])
})

test('memuat tidak mengubah lebar tombol', async () => {
  const { rerender } = render(<Button>Terbitkan Faktur</Button>)
  const sebelum = screen.getByRole('button').textContent

  rerender(<Button loading>Terbitkan Faktur</Button>)

  // Label tetap di tempatnya; spinner menempati slot ikon. Tombol yang menyusut
  // menggeser seluruh baris aksi.
  expect(screen.getByRole('button').textContent).toBe(sebelum)
  expect(screen.getByRole('button')).toHaveProperty('ariaBusy', 'true')
})

test('tombol nonaktif tetap dapat difokus dan dibaca, tetapi tidak menjalankan aksi', async () => {
  const pengguna = userEvent.setup()
  const aksi = vi.fn()
  render(
    <Button disabled onClick={aksi}>
      Posting
    </Button>,
  )

  const tombol = screen.getByRole('button', { name: 'Posting' })
  await pengguna.click(tombol)

  expect(aksi).not.toHaveBeenCalled()
  // `aria-disabled`, bukan atribut `disabled`: tombol ber-disabled hilang dari
  // urutan fokus, sehingga pengguna keyboard tidak pernah tahu ia ada.
  expect(tombol.getAttribute('aria-disabled')).toBe('true')
  expect(tombol.hasAttribute('disabled')).toBe(false)
})

test('Enter dan Space mengaktifkan tombol', async () => {
  const pengguna = userEvent.setup()
  const aksi = vi.fn()
  render(<Button onClick={aksi}>Simpan</Button>)

  await pengguna.tab()
  await pengguna.keyboard('{Enter}')
  await pengguna.keyboard(' ')

  expect(aksi).toHaveBeenCalledTimes(2)
})

/**
 * Komponen ini terkendali: induknya yang memegang nilai. Pembungkus ini
 * meniru induk yang benar — tanpanya, tampilan kembali ke nilai lama setelah
 * blur, dan itu perilaku yang benar untuk komponen terkendali.
 */
function NominalTerkendali({ onChange }: { onChange: (nilai: number | null) => void }) {
  const [nilai, setNilai] = useState<number | null>(185_000)
  return (
    <CurrencyInput
      label="Total"
      currency="IDR"
      value={nilai}
      onChange={(berikutnya) => {
        setNilai(berikutnya)
        onChange(berikutnya)
      }}
    />
  )
}

test('nominal: mentah saat fokus, terformat saat blur', async () => {
  const pengguna = userEvent.setup()
  const onChange = vi.fn()
  render(<NominalTerkendali onChange={onChange} />)

  const input = screen.getByLabelText('Total')
  expect((input as HTMLInputElement).value).toBe('185.000')

  await pengguna.click(input)
  // Angka mentah saat fokus — pengguna mengedit angka, bukan teks terformat.
  expect((input as HTMLInputElement).value).toBe('185000')

  await pengguna.clear(input)
  await pengguna.type(input, '1234567')
  // Tidak diformat ulang di setiap ketukan; kursor tidak pernah melompat.
  expect((input as HTMLInputElement).value).toBe('1234567')

  await pengguna.tab()
  expect((input as HTMLInputElement).value).toBe('1.234.567')
  // Yang dilaporkan ke atas adalah angka mentah, bukan string terformat.
  expect(onChange).toHaveBeenLastCalledWith(1_234_567)
})

test('nominal menerima tempelan dengan konvensi pemisah apa pun', async () => {
  const pengguna = userEvent.setup()
  const onChange = vi.fn()
  render(<CurrencyInput label="Total" currency="USD" value={null} onChange={onChange} />)

  const input = screen.getByLabelText('Total')
  await pengguna.click(input)
  await pengguna.paste('1,234.56')
  await pengguna.tab()

  expect(onChange).toHaveBeenLastCalledWith(1234.56)
})

test('simbol mata uang berada di luar input, sehingga tidak ikut terpilih', () => {
  render(<CurrencyInput label="Total" currency="IDR" value={1000} onChange={() => undefined} />)

  const input = screen.getByLabelText('Total') as HTMLInputElement
  expect(input.value).not.toContain('Rp')
})

test('readonly dapat difokus dan disalin; disabled tidak dapat difokus', async () => {
  const pengguna = userEvent.setup()
  render(
    <>
      <TextField label="Nomor" value="INV/2026/08/0142" readOnly onChange={() => undefined} />
      <TextField label="Pembuat" value="Sistem" disabled onChange={() => undefined} />
    </>,
  )

  await pengguna.tab()
  // Nomor dokumen dan NPWP sering perlu disalin.
  expect(document.activeElement).toBe(screen.getByLabelText('Nomor'))

  await pengguna.tab()
  expect(document.activeElement).not.toBe(screen.getByLabelText('Pembuat'))
})

test('pesan error menggantikan helper text, tidak ditumpuk', () => {
  const { rerender } = render(
    <TextField label="Email" value="" helper="Dipakai mengirim faktur." onChange={() => undefined} />,
  )
  expect(screen.getByText('Dipakai mengirim faktur.')).toBeDefined()

  rerender(
    <TextField
      label="Email"
      value=""
      helper="Dipakai mengirim faktur."
      error="Format tidak dikenali."
      onChange={() => undefined}
    />,
  )

  // Menumpuk keduanya menggeser layout dan mendorong field di bawahnya.
  expect(screen.queryByText('Dipakai mengirim faktur.')).toBeNull()
  expect(screen.getByRole('alert').textContent).toBe('Format tidak dikenali.')
})

test('checkbox indeterminate untuk header tabel diumumkan sebagai mixed', () => {
  render(<Checkbox label="Pilih semua" checked={false} indeterminate onChange={() => undefined} />)

  const kotak = screen.getByRole('checkbox', { name: 'Pilih semua' }) as HTMLInputElement
  expect(kotak.indeterminate).toBe(true)
  expect(kotak.getAttribute('aria-checked')).toBe('mixed')
})

test('label seluruhnya dapat diklik, bukan hanya kotaknya', async () => {
  const pengguna = userEvent.setup()
  const onChange = vi.fn()
  render(<Checkbox label="Kirim salinan" checked={false} onChange={onChange} />)

  await pengguna.click(screen.getByText('Kirim salinan'))

  expect(onChange).toHaveBeenCalledWith(true)
})

test('switch memakai role switch dan berlaku seketika', async () => {
  const pengguna = userEvent.setup()
  const onChange = vi.fn()
  render(<Switch label="Notifikasi" checked={false} onChange={onChange} />)

  const saklar = screen.getByRole('switch', { name: 'Notifikasi' })
  await pengguna.click(saklar)

  expect(onChange).toHaveBeenCalledWith(true)
  // Tidak punya `name`: nilainya tidak pernah ikut terkirim bersama form,
  // karena switch tidak pernah menunggu tombol Simpan.
  expect(saklar.hasAttribute('name')).toBe(false)
})

test('badge status membawa titik indikator dan teks, bukan warna saja', () => {
  render(<Gallery />)

  const badge = screen.getByText('Diposting')
  // WCAG 1.4.1: warna tidak pernah menjadi satu-satunya pembeda makna.
  expect(badge.querySelector('span[aria-hidden="true"]')).not.toBeNull()
  expect(badge.textContent).toBe('Diposting')
})
