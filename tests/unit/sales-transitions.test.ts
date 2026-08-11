import { describe, expect, test } from 'vitest'

import {
  evaluateConversion,
  isFullyConverted,
  remainingOf,
  type SourceLine,
} from '#domain/sales/conversion'
import {
  evaluateTransition,
  isEditable,
  needsNumber,
  type Transition,
} from '#domain/sales/transitions'

const TRANSISI: Transition[] = [
  { docType: 'invoice', from: 'draft', to: 'submitted', requires: [] },
  { docType: 'invoice', from: 'submitted', to: 'approved', requires: [] },
  { docType: 'invoice', from: 'pending_approval', to: 'approved', requires: ['not_own_document'] },
  { docType: 'invoice', from: 'approved', to: 'posted', requires: ['fiscal_period_open'] },
  { docType: 'invoice', from: 'posted', to: 'void', requires: ['reversal_journal'] },
]

describe('transisi', () => {
  test('perpindahan yang ada di tabel diizinkan', () => {
    expect(
      evaluateTransition(TRANSISI, {
        docType: 'invoice',
        from: 'draft',
        to: 'submitted',
        satisfied: [],
      }),
    ).toEqual({ kind: 'allowed' })
  })

  test('perpindahan yang tidak ada ditolak, dengan tujuan yang tersedia', () => {
    const hasil = evaluateTransition(TRANSISI, {
      docType: 'invoice',
      from: 'draft',
      to: 'posted',
      satisfied: [],
    })

    expect(hasil.kind).toBe('not_permitted')
    if (hasil.kind !== 'not_permitted') throw new Error('tidak mungkin')
    // Menyebutkan tujuan yang tersedia mengubah penolakan menjadi petunjuk.
    expect(hasil.available).toEqual(['submitted'])
  })

  test('syarat yang belum dipenuhi disebutkan satu per satu', () => {
    const hasil = evaluateTransition(TRANSISI, {
      docType: 'invoice',
      from: 'approved',
      to: 'posted',
      satisfied: [],
    })

    expect(hasil).toEqual({ kind: 'requirements_unmet', missing: ['fiscal_period_open'] })
  })

  test('syarat terpenuhi membuka perpindahan', () => {
    expect(
      evaluateTransition(TRANSISI, {
        docType: 'invoice',
        from: 'approved',
        to: 'posted',
        satisfied: ['fiscal_period_open'],
      }),
    ).toEqual({ kind: 'allowed' })
  })

  test('jenis dokumen lain tidak mewarisi transisi', () => {
    // Penawaran tidak pernah menjadi posted, berapa pun syarat yang dipenuhi.
    expect(
      evaluateTransition(TRANSISI, {
        docType: 'quotation',
        from: 'approved',
        to: 'posted',
        satisfied: ['fiscal_period_open'],
      }).kind,
    ).toBe('not_permitted')
  })

  test('dokumen terposting hanya dapat menuju void, dan itu pun bersyarat', () => {
    const hasil = evaluateTransition(TRANSISI, {
      docType: 'invoice',
      from: 'posted',
      to: 'void',
      satisfied: [],
    })

    expect(hasil).toEqual({ kind: 'requirements_unmet', missing: ['reversal_journal'] })
    expect(isEditable('posted')).toBe(false)
    expect(isEditable('draft')).toBe(true)
  })

  test('nomor diberikan saat submit, bukan saat draf', () => {
    expect(needsNumber('submitted')).toBe(true)
    expect(needsNumber('draft')).toBe(false)
  })
})

describe('konversi', () => {
  const baris: SourceLine[] = [
    { id: 'l1', lineNo: 1, qty: 10, qtyInvoiced: 4, qtyDelivered: 10 },
    { id: 'l2', lineNo: 2, qty: 5, qtyInvoiced: 5, qtyDelivered: 0 },
  ]

  test('sisa dihitung per baris, per jenis konversi', () => {
    expect(remainingOf(baris[0]!, 'invoice')).toBe(6)
    expect(remainingOf(baris[0]!, 'delivery')).toBe(0)
    expect(remainingOf(baris[1]!, 'invoice')).toBe(0)
  })

  test('konversi dalam sisa diizinkan', () => {
    expect(evaluateConversion(baris, [{ sourceLineId: 'l1', qty: 6 }], 'invoice')).toEqual({
      kind: 'allowed',
      total: 6,
    })
  })

  test('melebihi sisa ditolak dengan angka sisanya', () => {
    const hasil = evaluateConversion(baris, [{ sourceLineId: 'l1', qty: 7 }], 'invoice')

    expect(hasil).toEqual({
      kind: 'exceeds_remaining',
      lines: [{ lineNo: 1, requested: 7, remaining: 6 }],
    })
  })

  test('seluruh baris yang melebihi dikumpulkan, bukan berhenti di yang pertama', () => {
    // Orang yang mengonversi lima puluh baris tidak boleh diberi tahu satu
    // kesalahan per percobaan.
    const hasil = evaluateConversion(
      baris,
      [
        { sourceLineId: 'l1', qty: 99 },
        { sourceLineId: 'l2', qty: 1 },
      ],
      'invoice',
    )

    if (hasil.kind !== 'exceeds_remaining') throw new Error('tidak mungkin')
    expect(hasil.lines.map((item) => item.lineNo)).toEqual([1, 2])
  })

  test('baris yang tidak dikenal ditolak, bukan diabaikan', () => {
    expect(evaluateConversion(baris, [{ sourceLineId: 'entah', qty: 1 }], 'invoice')).toEqual({
      kind: 'unknown_line',
      sourceLineId: 'entah',
    })
  })

  test('permintaan kosong atau nol tidak menghasilkan dokumen kosong', () => {
    expect(evaluateConversion(baris, [], 'invoice').kind).toBe('nothing_to_convert')
    expect(evaluateConversion(baris, [{ sourceLineId: 'l1', qty: 0 }], 'invoice').kind).toBe(
      'nothing_to_convert',
    )
  })

  test('dokumen selesai bila seluruh barisnya habis', () => {
    expect(isFullyConverted(baris, 'invoice')).toBe(false)
    expect(isFullyConverted([baris[1]!], 'invoice')).toBe(true)
  })
})
