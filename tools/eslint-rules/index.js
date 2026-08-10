/**
 * Aturan lint yang menegakkan D-040 — batas arsitektur.
 *
 * Dua hal yang dijaga, keduanya menggagalkan build:
 *
 * 1. `layer-direction` — arah ketergantungan antar lapisan.
 *    interface → application → domain. Infrastruktur mengenal domain,
 *    tidak sebaliknya. Domain tidak mengenal siapa pun kecuali shared.
 *
 * 2. `no-cross-module-import` — modul tidak saling mengimpor.
 *    Lintas modul hanya lewat port yang disuntik di composition root
 *    atau lewat peristiwa domain di outbox.
 *
 * Modul dikenali dari jalur berkas:
 *   src/domain/<modul>/...
 *   src/application/<modul>/...
 *   src/infrastructure/modules/<modul>/...
 *   src/interface/http/modules/<modul>/...
 *   src/interface/web/modules/<modul>/...
 *
 * Segmen `modules/` dipakai eksplisit di infrastructure dan interface karena
 * kedua lapisan itu juga memuat folder teknis (db, outbox, jobs, components)
 * yang bukan modul. Tanpa segmen itu, batas modul harus ditebak dari daftar
 * nama — dan daftar yang harus dirawat manual akan tertinggal.
 */

const LAYER_ALLOWED = {
  shared: ['shared'],
  domain: ['domain', 'shared'],
  application: ['application', 'domain', 'shared'],
  infrastructure: ['infrastructure', 'application', 'domain', 'shared'],
  interface: ['interface', 'application', 'shared'],
  composition: ['composition', 'interface', 'infrastructure', 'application', 'domain', 'shared'],
}

const LAYERS = Object.keys(LAYER_ALLOWED)

const toPosix = (value) => value.replace(/\\/g, '/')

/** Segmen jalur setelah `src/`, atau null bila berkas berada di luar src. */
function segmentsAfterSrc(filePath) {
  const posix = toPosix(filePath)
  const marker = posix.lastIndexOf('/src/')
  if (marker !== -1) return posix.slice(marker + 5).split('/').filter(Boolean)
  if (posix.startsWith('src/')) return posix.slice(4).split('/').filter(Boolean)
  return null
}

function moduleOf(layer, rest) {
  if (layer === 'domain' || layer === 'application') {
    return rest.length > 1 ? rest[0] : null
  }
  const marker = rest.indexOf('modules')
  if (marker !== -1 && rest.length > marker + 2) return rest[marker + 1]
  return null
}

function locate(segments) {
  if (segments === null || segments.length === 0) return null
  const [layer, ...rest] = segments
  if (!LAYERS.includes(layer)) return null
  return { layer, module: moduleOf(layer, rest) }
}

/** Menempatkan target impor. Paket luar menghasilkan null dan tidak diperiksa. */
function locateImport(specifier, fromFile) {
  if (specifier.startsWith('#')) {
    const segments = specifier.slice(1).split('/').filter(Boolean)
    return locate(segments)
  }
  if (specifier.startsWith('.')) {
    const base = toPosix(fromFile).split('/').slice(0, -1)
    for (const segment of specifier.split('/')) {
      if (segment === '.' || segment === '') continue
      if (segment === '..') base.pop()
      else base.push(segment)
    }
    return locate(segmentsAfterSrc(base.join('/')))
  }
  return null
}

function sourceVisitor(handle) {
  const visit = (node) => {
    if (node.source && typeof node.source.value === 'string') {
      handle(node.source, node.source.value)
    }
  }
  return {
    ImportDeclaration: visit,
    ExportNamedDeclaration: visit,
    ExportAllDeclaration: visit,
    ImportExpression: (node) => {
      if (node.source.type === 'Literal' && typeof node.source.value === 'string') {
        handle(node.source, node.source.value)
      }
    },
  }
}

function createRule(check) {
  return (context) => {
    const from = locate(segmentsAfterSrc(context.filename))
    if (from === null) return {}
    return sourceVisitor((node, specifier) => {
      const to = locateImport(specifier, context.filename)
      if (to === null) return
      check(context, node, from, to)
    })
  }
}

const layerDirection = {
  meta: {
    type: 'problem',
    docs: { description: 'Menegakkan arah ketergantungan antar lapisan (D-040).' },
    schema: [],
    messages: {
      terlarang:
        "Lapisan '{{from}}' tidak boleh mengimpor '{{to}}'. Arah ketergantungan: interface → application → domain; infrastruktur mengenal domain, tidak sebaliknya.",
    },
  },
  create: createRule((context, node, from, to) => {
    if (LAYER_ALLOWED[from.layer].includes(to.layer)) return
    context.report({
      node,
      messageId: 'terlarang',
      data: { from: from.layer, to: to.layer },
    })
  }),
}

const noCrossModuleImport = {
  meta: {
    type: 'problem',
    docs: { description: 'Melarang impor langsung antar modul (D-040).' },
    schema: [],
    messages: {
      terlarang:
        "Modul '{{from}}' tidak boleh mengimpor modul '{{to}}' secara langsung. Pakai port yang disuntik di composition root, atau peristiwa domain lewat outbox.",
    },
  },
  create: createRule((context, node, from, to) => {
    if (from.module === null || to.module === null) return
    if (from.module === to.module) return
    context.report({
      node,
      messageId: 'terlarang',
      data: { from: from.module, to: to.module },
    })
  }),
}

export default {
  meta: { name: 'arsitektur', version: '1.0.0' },
  rules: {
    'layer-direction': layerDirection,
    'no-cross-module-import': noCrossModuleImport,
  },
}
