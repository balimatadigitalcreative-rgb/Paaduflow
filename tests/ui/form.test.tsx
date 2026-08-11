import axe from 'axe-core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'

import {
  ActionFooter,
  ErrorSummary,
  UnsavedChangesGuard,
} from '#interface/web/components/form/form'

afterEach(() => {
  document.body.innerHTML = ''
})

const GALAT = [
  { fieldId: 'npwp', label: 'NPWP', message: 'Format tidak dikenali.' },
  { fieldId: 'tanggal', label: 'Tanggal dokumen', message: 'Wajib diisi.' },
]

test('ringkasan error lolos audit aksesibilitas otomatis', async () => {
  const { container } = render(<ErrorSummary errors={GALAT} />)

  const hasil = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })

  if (hasil.violations.length > 0) {
    console.error(hasil.violations.map((v) => `[${v.impact ?? '-'}] ${v.id}: ${v.help}`).join('\n'))
  }
  expect(hasil.violations).toEqual([])
})

test('ringkasan error menerima fokus saat muncul', () => {
  const { rerender } = render(<ErrorSummary errors={[]} />)
  expect(screen.queryByRole('alert')).toBeNull()

  rerender(<ErrorSummary errors={GALAT} />)

  // Pengguna keyboard harus tahu form gagal disimpan, bukan menemukannya sendiri.
  expect(document.activeElement).toBe(screen.getByRole('alert'))
  expect(screen.getByRole('alert').textContent).toContain('2 isian')
})

test('tautan ringkasan memindahkan fokus ke field yang bermasalah', async () => {
  const pengguna = userEvent.setup()
  render(
    <>
      <ErrorSummary errors={GALAT} />
      <input id="npwp" aria-label="NPWP" />
      <input id="tanggal" aria-label="Tanggal dokumen" />
    </>,
  )

  await pengguna.click(screen.getByRole('link', { name: 'NPWP' }))

  // Untuk form pajak berisi tiga puluh field, menggulir mencari border merah
  // adalah tidak manusiawi.
  expect(document.activeElement).toBe(screen.getByLabelText('NPWP'))
})

test('action footer menyatakan ada perubahan belum tersimpan', () => {
  const { rerender } = render(
    <ActionFooter dirty={false} onSave={() => undefined} onCancel={() => undefined} />,
  )
  expect(screen.queryByText('Ada perubahan belum tersimpan')).toBeNull()

  rerender(<ActionFooter dirty onSave={() => undefined} onCancel={() => undefined} />)
  expect(screen.getByText('Ada perubahan belum tersimpan')).toBeDefined()
})

test('penjaga menyebut perubahan konteks saat berpindah company', () => {
  render(
    <UnsavedChangesGuard
      dirty
      pending={{ reason: 'switch_company', label: 'PT Nusantara Sentosa' }}
      onDiscard={() => undefined}
      onStay={() => undefined}
    />,
  )

  const dialog = screen.getByRole('alertdialog')
  // Akibatnya bukan sekadar kehilangan ketikan, melainkan bekerja di entitas
  // legal yang berbeda — jadi kalimatnya wajib menyebut itu.
  expect(dialog.textContent).toContain('mengubah konteks company')
  expect(dialog.textContent).toContain('PT Nusantara Sentosa')
})

test('penjaga membedakan pindah halaman dari pindah company', () => {
  render(
    <UnsavedChangesGuard
      dirty
      pending={{ reason: 'navigate', label: '/faktur' }}
      onDiscard={() => undefined}
      onStay={() => undefined}
    />,
  )

  expect(screen.getByRole('alertdialog').textContent).not.toContain('konteks company')
})

test('penjaga tidak menampilkan apa pun bila tidak ada yang ditahan', () => {
  render(
    <UnsavedChangesGuard dirty pending={null} onDiscard={() => undefined} onStay={() => undefined} />,
  )

  expect(screen.queryByRole('alertdialog')).toBeNull()
})

test('tetap di sini dan buang perubahan keduanya dapat dipilih', async () => {
  const pengguna = userEvent.setup()
  const tetap = vi.fn()
  const buang = vi.fn()

  render(
    <UnsavedChangesGuard
      dirty
      pending={{ reason: 'navigate', label: '/faktur' }}
      onDiscard={buang}
      onStay={tetap}
    />,
  )

  await pengguna.click(screen.getByRole('button', { name: 'Tetap di sini' }))
  await pengguna.click(screen.getByRole('button', { name: 'Buang perubahan' }))

  expect(tetap).toHaveBeenCalledTimes(1)
  expect(buang).toHaveBeenCalledTimes(1)
})
