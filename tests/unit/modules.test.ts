import { expect, test } from 'vitest'

import { modules } from '#composition/modules'

test('setiap modul terdaftar tepat sekali', () => {
  const ids = modules.map((module) => module.id)
  expect(new Set(ids).size).toBe(ids.length)
})

test('id modul kebab-case, karena dipakai di katalog izin dan URL', () => {
  for (const module of modules) {
    expect(module.id).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/)
  }
})

test('izin memakai format modul.entitas.aksi:cakupan', () => {
  for (const module of modules) {
    for (const permission of module.permissions) {
      expect(permission).toMatch(/^[a-z-]+\.[a-z-]+\.[a-z-]+:[a-z-]+$/)
      expect(permission.startsWith(`${module.id}.`)).toBe(true)
    }
  }
})
