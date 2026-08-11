import { AuthenticationService } from '#application/identity/authentication'
import type {
  BreachedPasswordList,
  IdentityDependencies,
  Mailer,
} from '#application/identity/ports'
import { SessionService } from '#application/identity/sessions'
import type { Queryable } from '#infrastructure/db/queryable'
import { Argon2PasswordHasher } from '#infrastructure/modules/identity/argon2-password-hasher'
import { AesSecretCipher, CryptoTokenFactory } from '#infrastructure/modules/identity/crypto-tokens'
import { JwtAccessTokenIssuer } from '#infrastructure/modules/identity/jwt-access-tokens'
import { OtpTotpService } from '#infrastructure/modules/identity/otp-totp-service'
import { PostgresIdentityRepository } from '#infrastructure/modules/identity/postgres-identity-repository'
import { uuidv7 } from '#shared/uuid'

/**
 * Perakitan modul identitas.
 *
 * Satu jalur perakitan dipakai proses `api` maupun test integrasi. Test yang
 * merakit sendiri akan menguji rakitannya sendiri, bukan rakitan yang berjalan
 * di produksi.
 */
export interface IdentityModuleOptions {
  readonly db: Queryable
  readonly tokenSigningSecret: string
  readonly mfaEncryptionKeyBase64: string
  readonly mailer: Mailer
  readonly breachList: BreachedPasswordList
  readonly now?: () => Date
  readonly newId?: () => string
}

export interface IdentityModule {
  readonly authentication: AuthenticationService
  readonly sessions: SessionService
  readonly dependencies: IdentityDependencies
}

export function createIdentityModule(options: IdentityModuleOptions): IdentityModule {
  const dependencies: IdentityDependencies = {
    repository: new PostgresIdentityRepository(options.db),
    hasher: new Argon2PasswordHasher(),
    breachList: options.breachList,
    tokens: new CryptoTokenFactory(),
    cipher: new AesSecretCipher(options.mfaEncryptionKeyBase64),
    totp: new OtpTotpService(),
    accessTokens: new JwtAccessTokenIssuer(options.tokenSigningSecret),
    mailer: options.mailer,
    now: options.now ?? (() => new Date()),
    newId: options.newId ?? (() => uuidv7()),
  }

  return {
    authentication: new AuthenticationService(dependencies),
    sessions: new SessionService(dependencies),
    dependencies,
  }
}
