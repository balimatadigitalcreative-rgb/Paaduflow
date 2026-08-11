/**
 * Kontrak konflik edit — D-004, Component_Specs_Feedback_States §6.
 *
 * `409` yang hanya berbunyi "dokumen sudah berubah" memaksa pengguna memuat
 * ulang dan membandingkan sendiri. Yang berguna adalah jawaban yang menyebut
 * **field mana yang bentrok, siapa mengubahnya, dan kapan** — dan ketiganya
 * sudah tersimpan di `audit_log` sejak migrasi `0005`.
 */

export interface AuditChange {
  readonly field: string
  readonly from: unknown
  readonly to: unknown
  readonly actorName: string
  readonly changedAt: Date
}

export interface ConflictField {
  readonly field: string
  readonly yourValue: unknown
  readonly theirValue: unknown
  readonly changedBy: string
  readonly changedAt: string
}

export interface ConflictReport {
  readonly code: 'version_conflict'
  readonly currentVersion: number
  readonly fields: readonly ConflictField[]
  /** Field yang Anda ubah tetapi tidak disentuh orang lain — aman digabung. */
  readonly mergeable: readonly string[]
}

/**
 * Menyusun laporan konflik dari perubahan yang Anda kirim dan perubahan yang
 * tercatat sejak versi yang Anda pegang.
 *
 * Field yang hanya Anda sentuh dipisahkan sebagai `mergeable`: menolak seluruh
 * kiriman karena orang lain mengubah field yang berbeda akan membuat pengguna
 * mengetik ulang pekerjaan yang sebenarnya tidak bertabrakan.
 */
export function describeConflict(
  attempted: Readonly<Record<string, unknown>>,
  changesSince: readonly AuditChange[],
  currentVersion: number,
): ConflictReport {
  const bentrok: ConflictField[] = []
  const aman: string[] = []

  for (const [field, nilaiAnda] of Object.entries(attempted)) {
    const milikOrangLain = changesSince.find((change) => change.field === field)

    if (milikOrangLain === undefined) {
      aman.push(field)
      continue
    }

    bentrok.push({
      field,
      yourValue: nilaiAnda,
      theirValue: milikOrangLain.to,
      changedBy: milikOrangLain.actorName,
      changedAt: milikOrangLain.changedAt.toISOString(),
    })
  }

  return { code: 'version_conflict', currentVersion, fields: bentrok, mergeable: aman }
}

export function hasRealConflict(report: ConflictReport): boolean {
  return report.fields.length > 0
}
