import { useState } from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test } from 'vitest'

import {
  emptyLine,
  LineItemEditor,
  type EditableLine,
} from '#interface/web/components/table/line-item-editor'

/**
 * Perilaku keyboard editor baris.
 *
 * Orang yang menginput empat puluh baris faktur tidak akan menyentuh tetikus,
 * jadi setiap pintasan diuji — bukan hanya didokumentasikan.
 */

let urutan = 0

function Editor({ awal }: { awal?: EditableLine[] }) {
  const [lines, setLines] = useState<EditableLine[]>(
    awal ?? [{ ...emptyLine('l-1'), description: 'Baris pertama', quantity: 2, unitPrice: 100_000 }],
  )

  return (
    <LineItemEditor
      lines={lines}
      currency="IDR"
      newId={() => `baru-${(urutan += 1)}`}
      onChange={setLines}
    />
  )
}

afterEach(() => {
  document.body.innerHTML = ''
})

test('Enter turun satu baris pada kolom yang sama', async () => {
  const pengguna = userEvent.setup()
  render(
    <Editor
      awal={[
        { ...emptyLine('a'), description: 'Satu' },
        { ...emptyLine('b'), description: 'Dua' },
      ]}
    />,
  )

  screen.getByLabelText('Kuantitas baris 1').focus()
  await pengguna.keyboard('{Enter}')

  expect(document.activeElement).toBe(screen.getByLabelText('Kuantitas baris 2'))
})

test('Enter di sel terakhir baris terakhir menambah baris baru dan memindahkan fokus', async () => {
  const pengguna = userEvent.setup()
  render(<Editor />)

  expect(screen.getAllByLabelText(/^Deskripsi baris/)).toHaveLength(1)

  screen.getByLabelText('Pajak % baris 1').focus()
  await pengguna.keyboard('{Enter}')

  expect(screen.getAllByLabelText(/^Deskripsi baris/)).toHaveLength(2)
  expect(document.activeElement).toBe(screen.getByLabelText('Deskripsi baris 2'))
})

test('Ctrl+D menyalin nilai dari baris di atas', async () => {
  const pengguna = userEvent.setup()
  render(
    <Editor
      awal={[
        { ...emptyLine('a'), unitPrice: 250_000 },
        { ...emptyLine('b'), unitPrice: 0 },
      ]}
    />,
  )

  const target = screen.getByLabelText('Harga satuan baris 2') as HTMLInputElement
  target.focus()
  await pengguna.keyboard('{Control>}d{/Control}')

  expect(target.value).toBe('250000')
})

test('Ctrl+Backspace menghapus baris, tetapi tidak pernah baris terakhir', async () => {
  const pengguna = userEvent.setup()
  render(
    <Editor
      awal={[
        { ...emptyLine('a'), description: 'Satu' },
        { ...emptyLine('b'), description: 'Dua' },
      ]}
    />,
  )

  screen.getByLabelText('Deskripsi baris 2').focus()
  await pengguna.keyboard('{Control>}{Backspace}{/Control}')
  expect(screen.getAllByLabelText(/^Deskripsi baris/)).toHaveLength(1)

  // Baris terakhir bertahan: dokumen tanpa satu pun baris bukan keadaan yang
  // dapat disimpan.
  screen.getByLabelText('Deskripsi baris 1').focus()
  await pengguna.keyboard('{Control>}{Backspace}{/Control}')
  expect(screen.getAllByLabelText(/^Deskripsi baris/)).toHaveLength(1)
})

test('menempel dua ratus baris dari Excel mengisi seluruhnya sekaligus', async () => {
  const pengguna = userEvent.setup()
  render(<Editor />)

  // Bentuk tempelan spreadsheet: kolom dipisah tab, baris dipisah newline.
  const blok = Array.from(
    { length: 200 },
    (_, index) => `Item ${index + 1}\t2\t${(index + 1) * 1000}\t0\t11`,
  ).join('\n')

  screen.getByLabelText('Deskripsi baris 1').focus()
  await pengguna.paste(blok)

  const deskripsi = screen.getAllByLabelText(/^Deskripsi baris/)
  expect(deskripsi).toHaveLength(200)
  expect((deskripsi[0] as HTMLInputElement).value).toBe('Item 1')
  expect((deskripsi[199] as HTMLInputElement).value).toBe('Item 200')
  expect((screen.getByLabelText('Harga satuan baris 200') as HTMLInputElement).value).toBe('200000')
})

test('tempelan memakai pemisah ribuan Indonesia tetap terbaca', async () => {
  const pengguna = userEvent.setup()
  render(<Editor />)

  screen.getByLabelText('Deskripsi baris 1').focus()
  await pengguna.paste('Jasa konsultasi\t1\t1.250.000\t0\t11')

  expect((screen.getByLabelText('Harga satuan baris 1') as HTMLInputElement).value).toBe('1250000')
})

test('total dihitung ulang seketika dan ditampilkan terformat', async () => {
  const pengguna = userEvent.setup()
  render(<Editor />)

  // 2 × 100.000 = 200.000, pajak 11% → total 222.000.
  expect(screen.getByText('222.000')).toBeDefined()

  const harga = screen.getByLabelText('Harga satuan baris 1')
  await pengguna.clear(harga)
  await pengguna.type(harga, '300000')

  // 2 × 300.000 = 600.000, pajak 11% → 666.000.
  expect(screen.getByText('666.000')).toBeDefined()
})

test('setiap sel punya label yang menyebut kolom dan nomor barisnya', () => {
  render(<Editor />)

  // Tanpa ini, screen reader hanya membacakan deretan angka tanpa konteks.
  expect(screen.getByLabelText('Deskripsi baris 1')).toBeDefined()
  expect(screen.getByLabelText('Kuantitas baris 1')).toBeDefined()
  expect(screen.getByLabelText('Pajak % baris 1')).toBeDefined()
})
