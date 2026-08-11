import { defineModule } from '#shared/module-manifest'

/**
 * Modul 02 — Identity & Access Management.
 *
 * Sesi B1 membangun autentikasi dan sesi saja. Katalog izin masih kosong karena
 * peran dan izin lahir di Sesi B2; peristiwa di bawah sudah terbit sekarang.
 */
export const identityModule = defineModule({
  id: 'identity',
  name: 'Identity & Access Management',
  permissions: [],
  jobs: [],
  events: [
    'identity.user.registered',
    'identity.email.verified',
    'identity.login.succeeded',
    'identity.session.reuse_detected',
    'identity.password.changed',
  ],
})
