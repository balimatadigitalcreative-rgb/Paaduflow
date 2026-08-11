import { identityModule } from '#application/identity/module'
import { organizationModule } from '#application/organization/module'
import type { ModuleManifest } from '#shared/module-manifest'

/**
 * Daftar modul yang dirakit ke dalam sistem.
 *
 * Menambah modul berarti menambah satu baris di sini dan satu folder di tiap
 * lapisan yang dipakainya. Tidak ada berkas lain yang perlu tahu.
 */
export const modules: readonly ModuleManifest[] = [organizationModule, identityModule]
