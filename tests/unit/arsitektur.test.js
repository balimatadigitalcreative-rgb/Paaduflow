import { RuleTester } from 'eslint'
import { test } from 'vitest'

import arsitektur from '../../tools/eslint-rules/index.js'

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
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
