import { describe, expect, test } from 'vitest'

import { canApprove } from '#application/sales/posting'
import { describeConflict, hasRealConflict, type AuditChange } from '#domain/sales/conflict'

const KAPAN = new Date('2026-08-11T03:00:00.000Z')

const PERUBAHAN: AuditChange[] = [
  { field: 'due_date', from: '2026-08-20', to: '2026-09-10', actorName: 'Ayu', changedAt: KAPAN },
]

describe('kontrak konflik', () => {
  test('menyebut field, nilai keduanya, siapa, dan kapan', () => {
    const laporan = describeConflict({ due_date: '2026-08-25' }, PERUBAHAN, 7)

    expect(laporan).toEqual({
      code: 'version_conflict',
      currentVersion: 7,
      fields: [
        {
          field: 'due_date',
          yourValue: '2026-08-25',
          theirValue: '2026-09-10',
          changedBy: 'Ayu',
          changedAt: KAPAN.toISOString(),
        },
      ],
      mergeable: [],
    })
  })

  test('field yang hanya Anda sentuh dipisahkan sebagai aman digabung', () => {
    const laporan = describeConflict(
      { due_date: '2026-08-25', description: 'Termin baru' },
      PERUBAHAN,
      7,
    )

    // Menolak seluruh kiriman karena orang lain mengubah field berbeda akan
    // membuat pengguna mengetik ulang pekerjaan yang tidak bertabrakan.
    expect(laporan.mergeable).toEqual(['description'])
    expect(laporan.fields).toHaveLength(1)
  })

  test('tidak ada yang bertabrakan berarti bukan konflik sungguhan', () => {
    const laporan = describeConflict({ description: 'Catatan' }, PERUBAHAN, 7)

    expect(hasRealConflict(laporan)).toBe(false)
    expect(laporan.mergeable).toEqual(['description'])
  })

  test('versi terkini selalu disertakan supaya klien dapat mengirim ulang', () => {
    expect(describeConflict({}, [], 12).currentVersion).toBe(12)
  })
})

describe('pemisahan tugas', () => {
  test('pengaju tidak dapat menyetujui dokumennya sendiri', () => {
    // Meski ia punya izin persetujuan — D-009.
    expect(canApprove({ submittedBy: 'user-1' }, 'user-1')).toBe(false)
    expect(canApprove({ submittedBy: 'user-1' }, 'user-2')).toBe(true)
  })

  test('dokumen tanpa pengaju dapat disetujui siapa pun yang berizin', () => {
    expect(canApprove({ submittedBy: null }, 'user-1')).toBe(true)
  })
})
