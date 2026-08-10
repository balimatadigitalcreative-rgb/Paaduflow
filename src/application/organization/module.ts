import { defineModule } from '#shared/module-manifest'

/**
 * Modul 01 — Multi-Tenant & Organization Foundation.
 *
 * Dependency root seluruh platform. Izin, pekerjaan, dan peristiwanya diisi di
 * Sesi A3 bersama migrasi fondasi; sekarang ia hadir supaya composition root
 * dan aturan batas modul punya modul nyata untuk dijaga.
 */
export const organizationModule = defineModule({
  id: 'organization',
  name: 'Multi-Tenant & Organization Foundation',
  permissions: [],
  jobs: [],
  events: [],
})
