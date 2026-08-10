import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dir = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '#shared': dir('./src/shared'),
      '#domain': dir('./src/domain'),
      '#application': dir('./src/application'),
      '#infrastructure': dir('./src/infrastructure'),
      '#interface': dir('./src/interface'),
      '#composition': dir('./src/composition'),
    },
  },
  test: {
    include: ['tests/**/*.test.{ts,js}'],
    environment: 'node',
  },
})
