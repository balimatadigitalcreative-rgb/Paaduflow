import { RuleTester } from 'eslint'
import { test } from 'vitest'

import arsitektur from '../../tools/eslint-rules/index.js'

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
})

const jsxRuleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

test('layer-direction menolak impor yang melawan arah ketergantungan', () => {
  ruleTester.run('layer-direction', arsitektur.rules['layer-direction'], {
    valid: [
      {
        name: 'domain boleh mengimpor shared',
        filename: 'src/domain/sales/invoice.ts',
        code: "import { Money } from '#shared/money'",
      },
      {
        name: 'application boleh mengimpor domain',
        filename: 'src/application/sales/post-invoice.ts',
        code: "import { Invoice } from '#domain/sales/invoice'",
      },
      {
        name: 'infrastructure boleh mengimpor domain',
        filename: 'src/infrastructure/modules/sales/invoice-repository.ts',
        code: "import { Invoice } from '#domain/sales/invoice'",
      },
      {
        name: 'composition boleh mengimpor lapisan mana pun',
        filename: 'src/composition/modules.ts',
        code: "import { salesModule } from '#application/sales/module'",
      },
      {
        name: 'paket luar tidak diperiksa',
        filename: 'src/domain/sales/invoice.ts',
        code: "import fastify from 'fastify'",
      },
    ],
    invalid: [
      {
        name: 'domain tidak boleh mengimpor infrastructure',
        filename: 'src/domain/sales/invoice.ts',
        code: "import { db } from '#infrastructure/db/client'",
        errors: [{ messageId: 'terlarang' }],
      },
      {
        name: 'interface tidak boleh melompati application ke domain',
        filename: 'src/interface/http/modules/sales/routes.ts',
        code: "import { Invoice } from '#domain/sales/invoice'",
        errors: [{ messageId: 'terlarang' }],
      },
      {
        name: 'shared tidak mengimpor lapisan mana pun',
        filename: 'src/shared/money.ts',
        code: "import { Invoice } from '#domain/sales/invoice'",
        errors: [{ messageId: 'terlarang' }],
      },
      {
        name: 'application tidak boleh mengimpor infrastructure',
        filename: 'src/application/sales/post-invoice.ts',
        code: "export { pool } from '#infrastructure/db/client'",
        errors: [{ messageId: 'terlarang' }],
      },
    ],
  })
})

test('no-cross-module-import menolak modul yang saling mengimpor', () => {
  ruleTester.run('no-cross-module-import', arsitektur.rules['no-cross-module-import'], {
    valid: [
      {
        name: 'impor di dalam modul yang sama',
        filename: 'src/domain/sales/invoice.ts',
        code: "import { Line } from './line'",
      },
      {
        name: 'shared bukan milik modul mana pun',
        filename: 'src/domain/sales/invoice.ts',
        code: "import { Money } from '#shared/money'",
      },
      {
        name: 'composition memang bertugas menyilangkan batas',
        filename: 'src/composition/modules.ts',
        code: "import { salesModule } from '#application/sales/module'",
      },
      {
        name: 'folder teknis di infrastructure bukan modul',
        filename: 'src/infrastructure/modules/sales/invoice-repository.ts',
        code: "import { pool } from '#infrastructure/db/client'",
      },
    ],
    invalid: [
      {
        name: 'domain lintas modul',
        filename: 'src/domain/sales/invoice.ts',
        code: "import { Item } from '#domain/inventory/item'",
        errors: [{ messageId: 'terlarang' }],
      },
      {
        name: 'domain lintas modul lewat jalur relatif',
        filename: 'src/domain/sales/invoice.ts',
        code: "import { Item } from '../inventory/item'",
        errors: [{ messageId: 'terlarang' }],
      },
      {
        name: 'application lintas modul',
        filename: 'src/application/sales/post-invoice.ts',
        code: "import { postJournal } from '#application/accounting/post-journal'",
        errors: [{ messageId: 'terlarang' }],
      },
      {
        name: 'interface lintas modul',
        filename: 'src/interface/web/modules/sales/invoice-page.tsx',
        code: "import { ItemPicker } from '#interface/web/modules/inventory/item-picker'",
        errors: [{ messageId: 'terlarang' }],
      },
      {
        name: 'impor dinamis juga diperiksa',
        filename: 'src/application/sales/post-invoice.ts',
        code: "const m = await import('#application/inventory/reserve')",
        errors: [{ messageId: 'terlarang' }],
      },
    ],
  })
})

test('no-style-prop-values menutup jalan pintas gaya inline di TSX', () => {
  jsxRuleTester.run('no-style-prop-values', arsitektur.rules['no-style-prop-values'], {
    valid: [
      {
        name: 'custom property untuk nilai yang baru diketahui saat berjalan',
        filename: 'src/interface/web/modules/sales/invoice-row.tsx',
        code: "const a = <tr style={{ '--row-height': tinggi }} />",
      },
      {
        name: 'komponen tanpa atribut style',
        filename: 'src/interface/web/components/button.tsx',
        code: 'const a = <button className={kelas} />',
      },
    ],
    invalid: [
      {
        name: 'nilai warna lolos dari jangkauan Stylelint',
        filename: 'src/interface/web/components/badge.tsx',
        code: "const a = <span style={{ color: '#FF0000' }} />",
        errors: [{ messageId: 'bukanCustomProperty' }],
      },
      {
        name: 'padding di luar skala',
        filename: 'src/interface/web/components/card.tsx',
        code: "const a = <div style={{ padding: '15px' }} />",
        errors: [{ messageId: 'bukanCustomProperty' }],
      },
      {
        name: 'z-index literal',
        filename: 'src/interface/web/components/dropdown.tsx',
        code: 'const a = <div style={{ zIndex: 9999 }} />',
        errors: [{ messageId: 'bukanCustomProperty' }],
      },
      {
        name: 'objek gaya yang disebar tidak dapat diperiksa',
        filename: 'src/interface/web/components/card.tsx',
        code: 'const a = <div style={{ ...gaya }} />',
        errors: [{ messageId: 'bukanObjek' }],
      },
      {
        name: 'gaya dari variabel juga tidak dapat diperiksa',
        filename: 'src/interface/web/components/card.tsx',
        code: 'const a = <div style={gaya} />',
        errors: [{ messageId: 'bukanObjek' }],
      },
    ],
  })
})
