/**
 * Pipeline token — D-025.
 *
 * `docs/tokens.json` adalah sumber kebenaran tunggal. Berkas ini membangkitkan
 * `src/styles/tokens.css` dan `src/styles/tokens.ts`. Keduanya ada di
 * `.gitignore`; mengeditnya dengan tangan berarti perubahan itu hilang pada
 * build berikutnya.
 *
 * Dua hal yang tidak diserahkan ke format bawaan Style Dictionary:
 *
 * 1. Nama token semantik membuang awalan `semantic.light` dan `semantic.dark`,
 *    supaya komponen menulis `var(--text-primary)` — bukan nama yang memuat
 *    mode di dalamnya. Mode berpindah lewat selektor, bukan lewat nama.
 *
 * 2. Rujukan dipertahankan sebagai `var(--neutral-50)`, bukan diratakan menjadi
 *    hex. Tanpa itu, penurunan ramp brand per tenant (Design_Tokens §10) harus
 *    menulis ulang seluruh token semantik, bukan cukup mengganti Lapis 1.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import StyleDictionary from 'style-dictionary'

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)))
const SOURCE = resolve(root, 'docs/tokens.json')
const OUT_DIR = resolve(root, 'src/styles')

const HEADER = [
  '/**',
  ' * DIBANGKITKAN OTOMATIS — JANGAN DIEDIT.',
  ' * Sumber: docs/tokens.json · Pembangkit: tools/style-dictionary/build.js',
  ' * Jalankan `npm run tokens:build` setelah mengubah sumbernya.',
  ' */',
].join('\n')

/** Nama custom property. Token semantik kehilangan awalan mode-nya. */
function cssName(path) {
  const segments = path[0] === 'semantic' ? path.slice(2) : path
  return `--${segments.join('-')}`
}

function isReference(value) {
  return typeof value === 'string' && /^\{[^{}]+\}$/.test(value)
}

function referenceToVar(value) {
  return `var(--${value.slice(1, -1).split('.').join('-')})`
}

function colorToString(value) {
  if (typeof value === 'string') return value
  if (value !== null && typeof value === 'object' && typeof value.hex === 'string') return value.hex
  throw new Error(`Nilai warna tidak dikenali: ${JSON.stringify(value)}`)
}

function quoteFontFamily(name) {
  return /\s/.test(name) ? `"${name}"` : name
}

/** Nilai CSS akhir. Rujukan tetap rujukan; sisanya diformat menurut tipenya. */
function cssValue(token) {
  const original = token.original?.$value ?? token.original?.value
  if (isReference(original)) return referenceToVar(original)

  const value = token.$value ?? token.value
  switch (token.$type ?? token.type) {
    case 'color':
      return colorToString(value)
    case 'fontFamily':
      return (Array.isArray(value) ? value : [value]).map(quoteFontFamily).join(', ')
    case 'cubicBezier':
      return `cubic-bezier(${value.join(', ')})`
    default:
      return String(value)
  }
}

function partition(allTokens) {
  const primitives = []
  const light = []
  const dark = []
  for (const token of allTokens) {
    if (token.path[0] !== 'semantic') primitives.push(token)
    else if (token.path[1] === 'light') light.push(token)
    else if (token.path[1] === 'dark') dark.push(token)
  }
  return { primitives, light, dark }
}

function declarations(tokens, indent = '  ') {
  return tokens.map((token) => `${indent}${cssName(token.path)}: ${cssValue(token)};`).join('\n')
}

/** Sisipkan komentar setiap kali kelompok token Lapis 1 berganti. */
function groupedDeclarations(tokens) {
  const lines = []
  let group = null
  for (const token of tokens) {
    if (token.path[0] !== group) {
      group = token.path[0]
      lines.push(`${lines.length === 0 ? '' : '\n'}  /* ${group} */`)
    }
    lines.push(`  ${cssName(token.path)}: ${cssValue(token)};`)
  }
  return lines.join('\n')
}

const cssFormat = ({ dictionary }) => {
  const { primitives, light, dark } = partition(dictionary.allTokens)
  return [
    HEADER,
    '',
    ':root {',
    '  /* ── Lapis 1 — primitive ─────────────────────────────────────────── */',
    groupedDeclarations(primitives),
    '',
    '  /* ── Lapis 2 — semantic (light) ──────────────────────────────────── */',
    declarations(light),
    '}',
    '',
    '[data-theme="dark"] {',
    '  /* ── Lapis 2 — semantic (dark) ───────────────────────────────────── */',
    '  /* Elevasi dark mode memakai kenaikan lightness surface, bukan bayangan. */',
    declarations(dark),
    '}',
    '',
  ].join('\n')
}

/** Kelompok Lapis 1 yang juga berguna saat berjalan, bukan hanya di CSS. */
const RUNTIME_GROUPS = [
  ['space', 'space'],
  ['size', 'size'],
  ['radius', 'radius'],
  ['border-width', 'borderWidth'],
  ['z', 'z'],
  ['duration', 'duration'],
  ['breakpoint', 'breakpoint'],
  ['opacity', 'opacity'],
]

function tsRecord(name, tokens) {
  const entries = tokens
    .map((token) => `  '${token.path.slice(1).join('-')}': '${cssValue(token)}',`)
    .join('\n')
  const typeName = `${name.charAt(0).toUpperCase()}${name.slice(1)}Token`
  return [
    `export const ${name} = {`,
    entries,
    '} as const',
    '',
    `export type ${typeName} = keyof typeof ${name}`,
    '',
  ].join('\n')
}

function unionType(name, tokens, note) {
  const members = tokens.map((token) => `  | '${cssName(token.path)}'`).join('\n')
  return [note, `export type ${name} =`, members, ''].join('\n')
}

const tsFormat = ({ dictionary }) => {
  const { primitives, light, dark } = partition(dictionary.allTokens)
  const blocks = [HEADER, '']

  for (const [group, exportName] of RUNTIME_GROUPS) {
    const tokens = primitives.filter((token) => token.path[0] === group)
    if (tokens.length > 0) blocks.push(tsRecord(exportName, tokens))
  }

  blocks.push(
    unionType(
      'PrimitiveTokenName',
      primitives,
      '/** Lapis 1. Komponen tidak boleh merujuk token warna di sini — lihat D-046. */',
    ),
  )
  blocks.push(
    unionType(
      'SemanticTokenName',
      light,
      '/** Lapis 2. Inilah yang dibaca komponen. Nama identik di light dan dark. */',
    ),
  )
  blocks.push(
    `/** Jumlah token semantik per mode. Ketimpangan berarti satu mode tertinggal. */`,
    `export const SEMANTIC_TOKEN_COUNT = { light: ${light.length}, dark: ${dark.length} } as const`,
    '',
    'export type TokenName = PrimitiveTokenName | SemanticTokenName',
    '',
  )

  return blocks.join('\n')
}

const dictionary = new StyleDictionary({
  source: [SOURCE],
  usesDtcg: true,
  log: { verbosity: 'silent' },
  hooks: {
    formats: {
      'paadu/css': cssFormat,
      'paadu/ts': tsFormat,
    },
  },
  platforms: {
    css: {
      transforms: [],
      buildPath: `${OUT_DIR}/`,
      files: [{ destination: 'tokens.css', format: 'paadu/css' }],
    },
  },
})

await mkdir(OUT_DIR, { recursive: true })
await dictionary.buildAllPlatforms()

// Berkas TS dibangkitkan dari kamus yang sama, tanpa platform kedua — supaya
// keduanya dijamin berasal dari satu pembacaan sumber yang sama.
const built = await dictionary.getPlatformTokens('css')
await mkdir(dirname(`${OUT_DIR}/tokens.ts`), { recursive: true })
await writeFile(`${OUT_DIR}/tokens.ts`, tsFormat({ dictionary: built }), 'utf8')

console.log(`tokens.css dan tokens.ts dibangkitkan dari ${SOURCE}`)
