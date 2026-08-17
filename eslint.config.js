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
        URL: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
  },
  {
    // PM2 memuat berkas ekosistem sebagai CommonJS, sehingga `module` di sana
    // memang ada — berbeda dengan sisa repo yang seluruhnya ESM.
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { module: 'writable' } },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { arsitektur },
    rules: {
      'arsitektur/layer-direction': 'error',
      'arsitektur/no-cross-module-import': 'error',
    },
  },
  {
    files: ['src/interface/web/**/*.tsx'],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { arsitektur },
    rules: {
      'arsitektur/no-style-prop-values': 'error',
    },
  },
)
