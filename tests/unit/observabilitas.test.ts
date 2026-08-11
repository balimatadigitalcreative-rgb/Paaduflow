import { expect, test } from 'vitest'

import {
  INVARIANT_CHECKS,
  RecordingTelemetrySink,
  Telemetry,
} from '#infrastructure/observability/telemetry'

import { findViolations } from '../../tools/db/check-append-only.js'

const TABEL = ['audit_log', 'journals', 'journal_lines']

test('penulisan terlarang pada tabel append-only tertangkap di kode', () => {
  const contoh = [
    `await db.query('UPDATE audit_log SET action = $1')`,
    `await db.query('DELETE FROM journals WHERE id = $1')`,
    `await db.query('TRUNCATE journal_lines')`,
  ]

  for (const teks of contoh) {
    expect(findViolations(teks, TABEL)).toHaveLength(1)
  }
})

test('SQL yang menyeberang baris tetap tertangkap', () => {
  // Bentuk yang paling sering ditulis: template literal berbaris banyak.
  const teks = `await db.query(\`\n  UPDATE\n  audit_log SET action = 'x'\`)`
  expect(findViolations(teks, TABEL).length).toBeGreaterThan(0)
})

test('penulisan yang sah tidak ikut tertangkap', () => {
  const contoh = [
    `await db.query('INSERT INTO audit_log (id) VALUES ($1)')`,
    `await db.query('SELECT * FROM journals')`,
    // Tabel lain bebas — outbox memang bukan append-only (D-035).
    `await db.query('UPDATE outbox_messages SET published_at = now()')`,
  ]

  for (const teks of contoh) {
    expect(findViolations(teks, TABEL)).toEqual([])
  }
})

test('pintu darurat melewatkan satu baris, bukan seluruh berkas', () => {
  const teks = [
    `-- paadu:allow-append-only-write pemulihan setelah insiden`,
    `await db.query('UPDATE audit_log SET hash = $1')`,
    `await db.query('DELETE FROM journals WHERE id = $1')`,
  ].join('\n')

  expect(findViolations(teks, TABEL)).toHaveLength(1)
})

test('pelanggaran invarian selalu insiden, tidak pernah peringatan', () => {
  const sink = new RecordingTelemetrySink()
  const telemetry = new Telemetry(sink)

  telemetry.invariant('neraca_saldo_seimbang', false, 'selisih 1500')
  telemetry.invariant('neraca_saldo_seimbang', true, 'selisih 0')

  // "Belum ada pengguna yang mengeluh" bukan alasan menurunkan tingkatnya:
  // ia berarti data sedang salah dan belum ada yang menyadarinya.
  expect(sink.events[0]).toMatchObject({ layer: 'invariant', severity: 'incident' })
  expect(sink.events[1]).toMatchObject({ layer: 'invariant', severity: 'info' })
})

test('ketiga lapis melewati satu jalur yang sama', () => {
  const sink = new RecordingTelemetrySink()
  const telemetry = new Telemetry(sink)

  telemetry.request({
    endpoint: '/v1/companies/:companyId/access',
    method: 'GET',
    status: 200,
    durationMs: 42,
    tenantId: 't-1',
    requestId: 'req-1',
  })
  telemetry.business('invoice.posted', 1, { tenantId: 't-1', companyId: 'c-1' })
  telemetry.invariant('nomor_dokumen_tanpa_celah', true, 'selisih 0', 't-1')

  // Anomali di lapis bisnis sering muncul sebelum metrik teknis. Tiga jalur
  // terpisah berarti hanya dua di antaranya yang benar-benar dipantau.
  expect(sink.events.map((event) => event.layer)).toEqual(['technical', 'business', 'invariant'])
})

test('setiap peristiwa teknis membawa X-Request-Id', () => {
  const sink = new RecordingTelemetrySink()
  new Telemetry(sink).request({
    endpoint: '/v1/auth/login',
    method: 'POST',
    status: 401,
    durationMs: 118,
    tenantId: null,
    requestId: 'jejak-dari-gateway',
  })

  expect(sink.events[0]).toMatchObject({ requestId: 'jejak-dari-gateway' })
})

test('daftar pemeriksaan invarian berkala lengkap dan dapat dibaca', () => {
  expect(INVARIANT_CHECKS.map((check) => check.name)).toEqual([
    'neraca_saldo_seimbang',
    'proyeksi_stok_sama_dengan_mutasi',
    'baris_faktur_sama_dengan_dokumen',
    'nomor_dokumen_tanpa_celah',
  ])

  // Kueri hidup sebagai data supaya menambah invarian berarti menambah satu
  // baris, bukan menyunting kode penjadwal.
  for (const check of INVARIANT_CHECKS) {
    expect(check.sql).toContain('selisih')
    expect(check.detail.length).toBeGreaterThan(10)
  }
})
