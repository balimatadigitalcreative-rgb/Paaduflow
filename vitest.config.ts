import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const dir = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url))

const alias = {
  '#shared': dir('./src/shared'),
  '#domain': dir('./src/domain'),
  '#application': dir('./src/application'),
  '#infrastructure': dir('./src/infrastructure'),
  '#interface': dir('./src/interface'),
  '#composition': dir('./src/composition'),
  '#styles': dir('./src/styles'),
}

export default defineConfig({
  resolve: { alias },
  test: {
    // Dipisah supaya test unit tidak ikut menunggu PostgreSQL menyala.
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.{ts,js}'],
          environment: 'node',
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'db',
          include: ['tests/invariants/**/*.test.ts', 'tests/integration/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['tests/invariants/global-setup.ts'],
          // Menyalakan PostgreSQL dan menjalankan migrasi memakan waktu nyata.
          hookTimeout: 180_000,
          testTimeout: 60_000,
          // Berkas test boleh berjalan bersamaan: masing-masing menyeed tenant
          // sendiri, dan isolasi antar tenant justru yang sedang diuji di sini.
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'ui',
          include: ['tests/ui/**/*.test.tsx'],
          // Audit aksesibilitas otomatis butuh DOM sungguhan. Ia menangkap
          // sekitar sepertiga masalah nyata; sisanya butuh screen reader.
          environment: 'jsdom',
        },
      },
    ],
  },
})
