/**
 * Lima aturan penegakan token — Design_Tokens.md §11.
 *
 * "Aturan yang tidak ditegakkan mesin akan dilanggar dalam tiga bulan."
 * Kelimanya menggagalkan build, bukan memberi peringatan.
 *
 * Nilai yang diizinkan dibaca langsung dari `docs/tokens.json` saat lint
 * berjalan. Menambah nilai ke skala berarti mengubah sumber kebenaran, bukan
 * mengubah berkas aturan ini — dan itu memang jalur yang benar menurut §11.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import stylelint from 'stylelint'

const { createPlugin, utils } = stylelint

const tokens = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../docs/tokens.json', import.meta.url)), 'utf8'),
)

/** Nilai px yang sah, diambil dari skala spacing. */
const SPACING_PX = new Set(
  Object.values(tokens.space)
    .filter((entry) => entry !== null && typeof entry === 'object' && '$value' in entry)
    .map((entry) => Number.parseFloat(entry.$value)),
)

/** Ramp warna Lapis 1. Komponen tidak boleh menyebut satu pun dari ini. */
const PRIMITIVE_COLOR_RAMPS = Object.entries(tokens)
  .filter(([name, group]) => name !== 'semantic' && group?.$type === 'color')
  .map(([name]) => name)

const TEXT_PROPERTIES = new Set([
  'color',
  'font',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'letter-spacing',
  'line-height',
  'text-align',
  'text-decoration',
  'text-transform',
  'white-space',
])

const HEX = /#[0-9a-f]{3,8}\b/gi
const PX = /(-?\d*\.?\d+)px/g
const CSS_VAR = /var\(\s*(--[a-z0-9-]+)/gi

function definePlugin(ruleName, messages, walk) {
  const ruleFunction = (primary) => (root, result) => {
    if (!utils.validateOptions(result, ruleName, { actual: primary, possible: [true] })) return
    walk(root, (node, message, word) => {
      utils.report({ result, ruleName, message, node, word })
    })
  }
  ruleFunction.ruleName = ruleName
  ruleFunction.messages = messages
  ruleFunction.meta = { url: 'docs/Design_Tokens.md#11-tata-kelola' }
  return createPlugin(ruleName, ruleFunction)
}

/* ── 1. Nilai warna hex mentah ──────────────────────────────────────────── */

const noRawHex = 'paadu/no-raw-hex'
const noRawHexMessages = utils.ruleMessages(noRawHex, {
  rejected: (hex) =>
    `Nilai hex "${hex}" ditulis langsung. Pakai token semantik seperti var(--text-primary) — ` +
    `komponen yang mengunci diri ke warna harus diedit satu per satu saat brand atau dark mode berubah.`,
})

const noRawHexPlugin = definePlugin(noRawHex, noRawHexMessages, (root, report) => {
  root.walkDecls((decl) => {
    for (const match of decl.value.matchAll(HEX)) {
      report(decl, noRawHexMessages.rejected(match[0]), match[0])
    }
  })
})

/* ── 2. Nilai px di luar skala spacing ──────────────────────────────────── */

const spacingScale = 'paadu/spacing-scale'
const spacingScaleMessages = utils.ruleMessages(spacingScale, {
  rejected: (value) =>
    `${value} tidak ada di skala spacing docs/tokens.json. Pakai var(--space-*) atau token ukuran ` +
    `yang sesuai. Nilai di luar skala adalah bug, bukan penyesuaian.`,
})

const spacingScalePlugin = definePlugin(spacingScale, spacingScaleMessages, (root, report) => {
  root.walkDecls((decl) => {
    for (const match of decl.value.matchAll(PX)) {
      if (SPACING_PX.has(Number.parseFloat(match[1]))) continue
      report(decl, spacingScaleMessages.rejected(match[0]), match[0])
    }
  })
})

/* ── 3. z-index literal ─────────────────────────────────────────────────── */

const noLiteralZIndex = 'paadu/no-literal-z-index'
const noLiteralZIndexMessages = utils.ruleMessages(noLiteralZIndex, {
  rejected: (value) =>
    `z-index: ${value} ditulis langsung. Pakai var(--z-*) dari skala. Nilai literal membuat urutan ` +
    `lapisan hanya dapat diketahui dengan membaca seluruh kode.`,
})

const noLiteralZIndexPlugin = definePlugin(
  noLiteralZIndex,
  noLiteralZIndexMessages,
  (root, report) => {
    root.walkDecls(/^z-index$/i, (decl) => {
      if (/^var\(\s*--z-/i.test(decl.value.trim())) return
      report(decl, noLiteralZIndexMessages.rejected(decl.value), decl.value)
    })
  },
)

/* ── 4. opacity pada elemen yang memuat teks ────────────────────────────── */

const noOpacityOnText = 'paadu/no-opacity-on-text'
const noOpacityOnTextMessages = utils.ruleMessages(noOpacityOnText, {
  rejected: (property) =>
    `opacity dipakai pada aturan yang juga mengatur "${property}". Teks disabled memakai token warna ` +
    `seperti var(--text-disabled) — opacity berlipat terhadap latar dan menghasilkan kontras yang ` +
    `berbeda di setiap surface.`,
})

const noOpacityOnTextPlugin = definePlugin(
  noOpacityOnText,
  noOpacityOnTextMessages,
  (root, report) => {
    root.walkDecls(/^opacity$/i, (decl) => {
      const parent = decl.parent
      if (parent === undefined || parent.type !== 'rule') return
      let textProperty = null
      parent.walkDecls((sibling) => {
        if (textProperty === null && TEXT_PROPERTIES.has(sibling.prop.toLowerCase())) {
          textProperty = sibling.prop
        }
      })
      if (textProperty === null) return
      report(decl, noOpacityOnTextMessages.rejected(textProperty), decl.value)
    })
  },
)

/* ── 5. Rujukan ke token warna Lapis 1 ──────────────────────────────────── */

const noPrimitiveColorToken = 'paadu/no-primitive-color-token'
const noPrimitiveColorTokenMessages = utils.ruleMessages(noPrimitiveColorToken, {
  rejected: (name) =>
    `${name} adalah token warna Lapis 1. Komponen hanya membaca Lapis 2 dan 3 — pakai token peran ` +
    `seperti var(--action-primary-bg), supaya dark mode dan brand tenant tidak perlu menyentuh komponen.`,
})

const isPrimitiveColor = (name) =>
  PRIMITIVE_COLOR_RAMPS.some((ramp) => name.startsWith(`--${ramp}-`))

const noPrimitiveColorTokenPlugin = definePlugin(
  noPrimitiveColorToken,
  noPrimitiveColorTokenMessages,
  (root, report) => {
    root.walkDecls((decl) => {
      for (const match of decl.value.matchAll(CSS_VAR)) {
        if (!isPrimitiveColor(match[1])) continue
        report(decl, noPrimitiveColorTokenMessages.rejected(match[1]), match[1])
      }
    })
  },
)

export const RULES = [
  noRawHex,
  spacingScale,
  noLiteralZIndex,
  noOpacityOnText,
  noPrimitiveColorToken,
]

export default [
  noRawHexPlugin,
  spacingScalePlugin,
  noLiteralZIndexPlugin,
  noOpacityOnTextPlugin,
  noPrimitiveColorTokenPlugin,
]
