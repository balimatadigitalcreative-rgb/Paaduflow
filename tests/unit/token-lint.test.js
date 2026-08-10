import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import stylelint from 'stylelint'
import { describe, expect, test } from 'vitest'

import { RULES } from '../../tools/stylelint-rules/index.js'

const root = fileURLToPath(new URL('../../', import.meta.url))
const fixture = (name) => fileURLToPath(new URL(`../fixtures/tokens/${name}.css`, import.meta.url))

const allRules = Object.fromEntries(RULES.map((rule) => [rule, true]))

async function lint(fixtureName, rules) {
  const code = await readFile(fixture(fixtureName), 'utf8')
  const { results } = await stylelint.lint({
    code,
    codeFilename: fixture(fixtureName),
    configBasedir: root,
    config: { plugins: ['./tools/stylelint-rules/index.js'], rules },
  })
  return results[0].warnings
}

/** Setiap aturan dipasangkan dengan fixture yang melanggarnya, dan hanya itu. */
const KASUS = [
  { rule: 'paadu/no-raw-hex', fixture: 'no-raw-hex', jumlah: 2 },
  { rule: 'paadu/spacing-scale', fixture: 'spacing-scale', jumlah: 2 },
  { rule: 'paadu/no-literal-z-index', fixture: 'no-literal-z-index', jumlah: 1 },
  { rule: 'paadu/no-opacity-on-text', fixture: 'no-opacity-on-text', jumlah: 1 },
  { rule: 'paadu/no-primitive-color-token', fixture: 'no-primitive-color-token', jumlah: 2 },
]

describe.each(KASUS)('$rule', ({ rule, fixture: fixtureName, jumlah }) => {
  test('menolak berkas fixture yang melanggar', async () => {
    const warnings = await lint(fixtureName, allRules)
    const milikAturan = warnings.filter((warning) => warning.rule === rule)

    expect(milikAturan).toHaveLength(jumlah)
    for (const warning of milikAturan) {
      expect(warning.severity).toBe('error')
    }
  })

  test('fixture-nya bersih begitu aturan ini dicabut — jadi aturan inilah yang menangkapnya', async () => {
    const tanpaAturan = { ...allRules }
    delete tanpaAturan[rule]

    const warnings = await lint(fixtureName, tanpaAturan)

    // Pemeriksaan inilah yang membuat test di atas tidak bisa lulus karena
    // kebetulan. Bila aturan dihapus dari plugin, test pertama gagal; bila
    // fixture-nya kebetulan melanggar aturan lain, test ini yang gagal.
    expect(warnings).toHaveLength(0)
  })
})

test('berkas yang menuruti token tidak memicu satu aturan pun', async () => {
  const warnings = await lint('sah', allRules)
  expect(warnings).toEqual([])
})
