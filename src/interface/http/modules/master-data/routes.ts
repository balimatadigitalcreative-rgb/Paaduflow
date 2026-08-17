import type { AppServices } from '#application/app-services'
import { Type } from '@sinclair/typebox'

import { requireCompany, requireUser, type PaaduServer } from '../../app.js'

/**
 * Data induk — pelanggan, vendor, barang, gudang.
 *
 * Baca saja, dan tanpa kursor: keempatnya adalah daftar pendek yang dipakai
 * mengisi kotak pilihan. Saat salah satunya tumbuh melewati layar, ia pindah ke
 * pencarian ber-kursor seperti daftar dokumen — bukan ke halaman bernomor.
 *
 * Izinnya menumpang izin baca modul yang memakainya: siapa yang boleh melihat
 * faktur boleh melihat daftar pelanggan, karena nama pelanggan sudah tampil di
 * fakturnya.
 */

const JalurCompany = Type.Object({ companyId: Type.String({ format: 'uuid' }) })

export function registerMasterDataRoutes(app: PaaduServer, services: AppServices): void {
  const daftar = [
    { path: 'customers', izin: 'penjualan.faktur.baca', ambil: 'customers' },
    { path: 'vendors', izin: 'pembelian.pesanan.kelola', ambil: 'vendors' },
    { path: 'items', izin: 'penjualan.faktur.baca', ambil: 'items' },
    { path: 'warehouses', izin: 'penjualan.faktur.baca', ambil: 'warehouses' },
  ] as const

  for (const entri of daftar) {
    app.get(
      `/v1/companies/:companyId/${entri.path}`,
      { schema: { params: JalurCompany } },
      async (request, reply) => {
        if (!(await requireUser(request, reply, services))) return reply
        if (!(await requireCompany(request, reply, services, request.params.companyId))) return reply

        const user = request.authenticated!
        const company = request.company!

        const hasil = await services.withCompanyContext(
          { tenantId: company.tenantId, userId: user.userId },
          async (scoped) => {
            const izin = await scoped.authorization.authorize(
              { userId: user.userId, companyId: company.companyId },
              { key: entri.izin, scope: 'company', ask: 'Admin Company' },
            )
            if (!izin.allowed) {
              return {
                status: 403,
                body: { success: false, message: 'Tidak diizinkan.', errors: [izin.denial] },
              }
            }
            return {
              status: 200,
              body: {
                success: true,
                data: await scoped.masterData[entri.ambil](company.companyId),
              },
            }
          },
        )

        return reply.status(hasil.status).send(hasil.body)
      },
    )
  }
}
