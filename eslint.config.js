import js from '@eslint/js'
import tseslint from 'typescript-eslint'

import arsitektur from './tools/eslint-rules/index.js'

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      // Dibangkitkan Style Dictionary — lihat D-025
      'src/styles/tokens.css',
      'src/styles/tokens.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { arsitektur },
    rules: {
      'arsitektur/layer-direction': 'error',
      'arsitektur/no-cross-module-import': 'error',
    },
  },
)
