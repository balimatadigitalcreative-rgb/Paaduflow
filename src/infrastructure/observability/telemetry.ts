/**
 * Observabilitas tiga lapis — Platform Architecture Resilience §7.
 *
 * Lapis ketiga yang paling sering terlewat, dan justru ia yang paling
 * menentukan: **pelanggaran invarian adalah insiden**, sekalipun tidak ada
 * pengguna yang mengeluh — karena ia berarti data sedang salah dan belum ada
 * yang menyadarinya.
 */

export type Severity = 'info' | 'warning' | 'incident'

export interface TechnicalEvent {
  readonly layer: 'technical'
  readonly name: 'request'
  readonly endpoint: string
  readonly method: string
  readonly status: number
  readonly durationMs: number
  readonly tenantId: string | null
  /** Menyambungkan log, jejak, dan audit trail menjadi satu rangkaian. */
  readonly requestId: string
}

export interface BusinessEvent {
  readonly layer: 'business'
  /** `invoice.posted`, `pos.sync.succeeded`, `automation.queue.depth`. */
  readonly name: string
  readonly value: number
  readonly tenantId: string | null
  readonly companyId: string | null
}

export interface InvariantEvent {
  readonly layer: 'invariant'
  readonly name: string
  readonly holds: boolean
  readonly detail: string
  readonly tenantId: string | null
  /** Selalu `incident` saat gagal — tidak pernah `warning`. */
  readonly severity: Severity
}

export type TelemetryEvent = TechnicalEvent | BusinessEvent | InvariantEvent

export interface TelemetrySink {
  emit(event: TelemetryEvent): void
}

/**
 * Anomali di lapis bisnis sering muncul **sebelum** metrik teknis, karena
 * pengguna berhenti memakai fitur yang rusak sebelum sistem melaporkannya
 * rusak. Karena itu ketiganya melewati satu jalur, bukan tiga jalur terpisah
 * yang hanya dua di antaranya dipantau.
 */
export class Telemetry {
  constructor(private readonly sink: TelemetrySink) {}

  request(event: Omit<TechnicalEvent, 'layer' | 'name'>): void {
    this.sink.emit({ layer: 'technical', name: 'request', ...event })
  }

  business(name: string, value: number, scope: { tenantId?: string; companyId?: string } = {}): void {
    this.sink.emit({
      layer: 'business',
      name,
      value,
      tenantId: scope.tenantId ?? null,
      companyId: scope.companyId ?? null,
    })
  }

  /**
   * Pelanggaran invarian selalu berat. Tidak ada jalan menurunkannya menjadi
   * peringatan — tanda tangannya memang tidak menerima severity.
   */
  invariant(name: string, holds: boolean, detail: string, tenantId: string | null = null): void {
    this.sink.emit({
      layer: 'invariant',
      name,
      holds,
      detail,
      tenantId,
      severity: holds ? 'info' : 'incident',
    })
  }
}

/** Keluaran baku: satu baris JSON per peristiwa, siap dibaca pengumpul log. */
export class ConsoleTelemetrySink implements TelemetrySink {
  emit(event: TelemetryEvent): void {
    const baris = JSON.stringify({ ts: new Date().toISOString(), ...event })
    if (event.layer === 'invariant' && !event.holds) console.error(baris)
    else console.log(baris)
  }
}

/** Menyimpan peristiwa di memori — dipakai test, bukan produksi. */
export class RecordingTelemetrySink implements TelemetrySink {
  readonly events: TelemetryEvent[] = []

  emit(event: TelemetryEvent): void {
    this.events.push(event)
  }
}

/**
 * Pemeriksaan invarian berkala.
 *
 * Kueri hidup sebagai data supaya daftarnya dapat dibaca tanpa membaca kode,
 * dan supaya menambah invarian berarti menambah satu baris.
 */
export interface InvariantCheck {
  readonly name: string
  readonly detail: string
  /** Mengembalikan selisih. Nol berarti invarian berlaku. */
  readonly sql: string
}

export const INVARIANT_CHECKS: readonly InvariantCheck[] = [
  {
    name: 'neraca_saldo_seimbang',
    detail: 'Jumlah debit sama dengan jumlah kredit di seluruh jurnal',
    sql: `SELECT COALESCE(sum(debit) - sum(credit), 0) AS selisih FROM journal_lines`,
  },
  {
    name: 'proyeksi_stok_sama_dengan_mutasi',
    detail: 'Saldo stok tersimpan sama dengan jumlah mutasinya',
    sql: `SELECT COALESCE(sum(b.qty_on_hand - m.jumlah), 0) AS selisih
            FROM stock_balances b
            JOIN (SELECT tenant_id, item_id, warehouse_id, sum(qty_base) AS jumlah
                    FROM stock_movements GROUP BY tenant_id, item_id, warehouse_id) m
              ON m.tenant_id = b.tenant_id AND m.item_id = b.item_id
             AND m.warehouse_id = b.warehouse_id`,
  },
  {
    name: 'baris_faktur_sama_dengan_dokumen',
    detail: 'Jumlah nilai baris sama dengan nilai dokumennya',
    sql: `SELECT COALESCE(count(*), 0) AS selisih FROM (
            SELECT d.id
              FROM sales_documents d
              JOIN sales_document_lines l ON l.tenant_id = d.tenant_id AND l.document_id = d.id
             GROUP BY d.id, d.tax_base
            HAVING sum(l.net_amount) <> d.tax_base) AS menyimpang`,
  },
  {
    name: 'nomor_dokumen_tanpa_celah',
    detail: 'Tidak ada lompatan pada urutan nomor dokumen per company',
    sql: `SELECT COALESCE(count(*), 0) AS selisih FROM (
            SELECT company_id
              FROM sales_documents
             WHERE number IS NOT NULL
             GROUP BY company_id
            HAVING count(*) <> max(CAST(right(number, 4) AS integer))) AS berlubang`,
  },
]
