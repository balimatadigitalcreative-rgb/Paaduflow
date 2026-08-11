import { describe, expect, test } from 'vitest'

import { authorize, planSatisfies, toErrorEnvelope } from '#domain/identity/authorization'
import {
  denyAll,
  isDenyAll,
  parsePermissionKey,
  scopeSatisfies,
  scopeToFilter,
} from '#domain/identity/permission'
import { scopePredicate } from '#infrastructure/db/scoped-query'

const KONTEKS = {
  tenantId: 'aaaaaaaa-0000-7000-8000-000000000001',
  userId: 'bbbbbbbb-0000-7000-8000-000000000002',
  companyId: 'cccccccc-0000-7000-8000-000000000003',
  accessibleCompanyIds: [
    'cccccccc-0000-7000-8000-000000000003',
    'dddddddd-0000-7000-8000-000000000004',
  ],
}

describe('kunci izin', () => {
  test('format modul.entitas.aksi diurai', () => {
    expect(parsePermissionKey('penjualan.faktur.posting')).toEqual({
      moduleId: 'penjualan',
      entity: 'faktur',
      action: 'posting',
    })
  })

  test('bentuk yang tidak sesuai ditolak, bukan diterima setengah', () => {
    for (const salah of ['penjualan.faktur', 'Penjualan.Faktur.Posting', 'a..b', '']) {
      expect(parsePermissionKey(salah)).toBeNull()
    }
  })
})

describe('cakupan menjadi filter baris', () => {
  test('cakupan company mengunci ke satu company', () => {
    expect(scopeToFilter('company', KONTEKS)).toEqual({
      tenantId: KONTEKS.tenantId,
      companyIds: [KONTEKS.companyId],
      ownerId: null,
    })
  })

  test('cakupan own menambahkan pemiliknya', () => {
    expect(scopeToFilter('own', KONTEKS)).toEqual({
      tenantId: KONTEKS.tenantId,
      companyIds: [KONTEKS.companyId],
      ownerId: KONTEKS.userId,
    })
  })

  test('cakupan tenant tetap daftar tertutup, bukan seluruh tenant', () => {
    // "Seluruh tenant" berarti seluruh company yang penggunanya punya akses —
    // bukan seluruh company yang ada di tenant itu.
    expect(scopeToFilter('tenant', KONTEKS)).toEqual({
      tenantId: KONTEKS.tenantId,
      companyIds: KONTEKS.accessibleCompanyIds,
      ownerId: null,
    })
  })

  test('cakupan yang lebih luas memenuhi yang lebih sempit', () => {
    expect(scopeSatisfies('tenant', 'company')).toBe(true)
    expect(scopeSatisfies('company', 'own')).toBe(true)
    expect(scopeSatisfies('own', 'company')).toBe(false)
  })

  test('filter buntu tidak mencocokkan apa pun', () => {
    expect(isDenyAll(denyAll(KONTEKS.tenantId))).toBe(true)
    expect(isDenyAll(scopeToFilter('company', KONTEKS))).toBe(false)
  })
})

describe('predikat SQL', () => {
  test('selalu memuat tenant, daftar company, dan hapus lunak', () => {
    const predikat = scopePredicate(scopeToFilter('company', KONTEKS), 't')

    expect(predikat.sql).toBe(
      't.tenant_id = $1::uuid AND t.company_id = ANY($2::uuid[]) AND t.deleted_at IS NULL',
    )
    expect(predikat.params).toEqual([KONTEKS.tenantId, [KONTEKS.companyId]])
  })

  test('cakupan own menambahkan pembatasan pembuat', () => {
    const predikat = scopePredicate(scopeToFilter('own', KONTEKS), 't')

    expect(predikat.sql).toContain('t.created_by = $3::uuid')
    expect(predikat.params[2]).toBe(KONTEKS.userId)
  })

  test('nomor parameter bergeser bila pemanggil sudah memakai sebagian', () => {
    const predikat = scopePredicate(scopeToFilter('company', KONTEKS), 'x', 5)
    expect(predikat.sql).toBe(
      'x.tenant_id = $6::uuid AND x.company_id = ANY($7::uuid[]) AND x.deleted_at IS NULL',
    )
  })

  test('filter buntu tetap menghasilkan kueri, dengan daftar company kosong', () => {
    // Bukan pengecualian. Jalur pencarian yang menggabungkan banyak entitas
    // harus dapat melewati satu entitas tanpa menggagalkan permintaan, dan
    // tanpa pernah mengakui entitas itu ada.
    const predikat = scopePredicate(denyAll(KONTEKS.tenantId), 't')
    expect(predikat.params[1]).toEqual([])
  })
})

describe('kontrak kesalahan tiga sebab', () => {
  const punyaIzin = [{ key: 'penjualan.faktur.baca', scope: 'company' as const }]
  const syarat = {
    key: 'penjualan.faktur.baca',
    scope: 'company' as const,
    minPlan: 'business' as const,
    ask: 'Admin Company',
  }

  test('izin diperiksa sebelum paket', () => {
    // Pengguna tanpa izin DAN tanpa paket harus menerima permission_denied.
    // plan_restricted dirancang untuk ditampilkan; menjawabnya di sini akan
    // mengakui keberadaan fitur yang seharusnya disembunyikan.
    const hasil = authorize([], syarat, 'trial')

    expect(hasil).toEqual({
      allowed: false,
      denial: {
        code: 'permission_denied',
        required: 'penjualan.faktur.baca:company',
        ask: 'Admin Company',
      },
    })
  })

  test('punya izin tetapi paket kurang menghasilkan plan_restricted', () => {
    expect(authorize(punyaIzin, syarat, 'starter')).toEqual({
      allowed: false,
      denial: {
        code: 'plan_restricted',
        required: 'penjualan.faktur.baca',
        requiredPlan: 'business',
      },
    })
  })

  test('izin dan paket cukup menghasilkan izin beserta cakupannya', () => {
    expect(authorize(punyaIzin, syarat, 'enterprise')).toEqual({
      allowed: true,
      scope: 'company',
    })
  })

  test('cakupan yang lebih luas memenuhi syarat yang lebih sempit', () => {
    const bercakupanTenant = [{ key: 'penjualan.faktur.baca', scope: 'tenant' as const }]
    expect(authorize(bercakupanTenant, { ...syarat, minPlan: 'trial' }, 'trial')).toEqual({
      allowed: true,
      scope: 'tenant',
    })
  })

  test('perbandingan paket berurutan', () => {
    expect(planSatisfies('enterprise', 'business')).toBe(true)
    expect(planSatisfies('trial', 'starter')).toBe(false)
  })

  test('amplop galat memakai bentuk yang sama untuk ketiga sebab', () => {
    const amplop = toErrorEnvelope({ code: 'state_restricted', reason: 'Periode fiskal ditutup' })
    expect(amplop.success).toBe(false)
    expect(amplop.errors[0]).toEqual({
      code: 'state_restricted',
      reason: 'Periode fiskal ditutup',
    })
  })
})
