import { RULES } from './tools/stylelint-rules/index.js'

/** Kelima aturan token aktif sebagai error — Design_Tokens.md §11. */
const tokenRules = Object.fromEntries(RULES.map((rule) => [rule, true]))

export default {
  plugins: ['./tools/stylelint-rules/index.js'],
  rules: tokenRules,
  ignoreFiles: [
    // Dibangkitkan dari docs/tokens.json. Ia memang berisi hex dan nama Lapis 1 —
    // di sinilah satu-satunya tempat keduanya boleh ada.
    'src/styles/tokens.css',
    // Fixture memang melanggar dengan sengaja. Ia diperiksa lewat test, bukan
    // lewat lint biasa.
    'tests/fixtures/**',
    'node_modules/**',
    'dist/**',
  ],
}
