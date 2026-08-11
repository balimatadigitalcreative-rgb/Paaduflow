-- Up Migration
--
-- Tabel append-only: audit_log, journals, journal_lines.
--
-- Ketiganya dibuat di fondasi, bukan di modulnya, karena hak akses dan
-- constraint yang menjaganya harus berlaku sejak baris pertama. Modul 03 dan 07
-- menambah kolom dan tabel di atasnya; keduanya tidak pernah mengubah bentuk
-- yang ada.

-- ── audit_log ──────────────────────────────────────────────────────────────

CREATE TABLE audit_log (
  id           uuid NOT NULL,
  tenant_id    uuid NOT NULL,
  company_id   uuid,
  -- Urut per tenant, tanpa celah. Celah berarti baris hilang.
  sequence     bigint NOT NULL,
  actor_id     uuid,
  -- Butir 6. Aksi AI harus dapat dibedakan tanpa menebak dari actor_id.
  actor_type   actor_type NOT NULL,
  on_behalf_of uuid,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    uuid,
  changes      jsonb,
  request_id   text,
  ip           inet,
  user_agent   text,
  prev_hash    text,
  hash         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, sequence)
);

-- Tanpa updated_at dan deleted_at. Tabel ini tidak pernah berubah, dan kolom
-- yang tidak dapat berubah tetapi ada akan menipu pembacanya.

CREATE INDEX audit_log_entity_idx ON audit_log (tenant_id, entity_type, entity_id, created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_log
  USING (tenant_id = paadu.current_tenant_id())
  WITH CHECK (tenant_id = paadu.current_tenant_id());

-- ── journals ───────────────────────────────────────────────────────────────

CREATE TYPE journal_type AS ENUM ('auto', 'manual', 'adjustment', 'closing', 'opening', 'reversal');

CREATE TABLE journals (
  id             uuid NOT NULL,
  tenant_id      uuid NOT NULL,
  company_id     uuid NOT NULL,
  number         text,
  journal_date   date NOT NULL,
  fiscal_year    integer NOT NULL,
  fiscal_period  integer NOT NULL CHECK (fiscal_period BETWEEN 1 AND 12),
  type           journal_type NOT NULL,
  source_type    text,
  source_id      uuid,
  description    text,
  reverses_id    uuid,
  currency       char(3) NOT NULL,
  exchange_rate  numeric(19, 8) NOT NULL DEFAULT 1,
  posted_at      timestamptz,
  posted_by      uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  FOREIGN KEY (tenant_id, reverses_id) REFERENCES journals (tenant_id, id),
  UNIQUE (tenant_id, company_id, number)
);

CREATE INDEX journals_company_date_idx ON journals (tenant_id, company_id, journal_date DESC);

ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE journals FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON journals
  USING (tenant_id = paadu.current_tenant_id())
  WITH CHECK (tenant_id = paadu.current_tenant_id());

-- ── journal_lines ──────────────────────────────────────────────────────────
--
-- account_id belum punya foreign key: tabel accounts dibangun di Sesi D1.
-- Menambahkan FK-nya nanti bersifat menambah, jadi menundanya aman.

CREATE TABLE journal_lines (
  id             uuid NOT NULL,
  tenant_id      uuid NOT NULL,
  journal_id     uuid NOT NULL,
  line_no        integer NOT NULL CHECK (line_no > 0),
  account_id     uuid NOT NULL,
  debit          numeric(19, 4) NOT NULL DEFAULT 0,
  credit         numeric(19, 4) NOT NULL DEFAULT 0,
  currency       char(3) NOT NULL,
  amount_foreign numeric(19, 4),
  exchange_rate  numeric(19, 8),
  dimension_1_id uuid,
  dimension_2_id uuid,
  dimension_3_id uuid,
  description    text,
  source_line_id uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, journal_id) REFERENCES journals (tenant_id, id),
  UNIQUE (tenant_id, journal_id, line_no),
  -- Satu baris tidak boleh memuat debit dan kredit sekaligus, dan tidak ada
  -- nilai negatif — nilai negatif adalah cara menulis sisi lawan diam-diam.
  CONSTRAINT journal_lines_single_side CHECK (debit = 0 OR credit = 0),
  CONSTRAINT journal_lines_non_negative CHECK (debit >= 0 AND credit >= 0)
);

CREATE INDEX journal_lines_journal_idx ON journal_lines (tenant_id, journal_id, line_no);
CREATE INDEX journal_lines_account_idx ON journal_lines (tenant_id, account_id);

ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON journal_lines
  USING (tenant_id = paadu.current_tenant_id())
  WITH CHECK (tenant_id = paadu.current_tenant_id());

-- ── Jurnal berimbang, ditegakkan basis data ────────────────────────────────
--
-- Pemeriksaan tidak boleh berjalan per baris: jurnal dan barisnya disisipkan
-- dalam satu transaksi, jadi setelah baris pertama jurnalnya memang belum
-- berimbang. CONSTRAINT TRIGGER yang DEFERRABLE INITIALLY DEFERRED menundanya
-- sampai COMMIT, saat seluruh baris sudah ada.

CREATE FUNCTION paadu.assert_journal_balanced() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_tenant  uuid := COALESCE(NEW.tenant_id, OLD.tenant_id);
  v_journal uuid := COALESCE(NEW.journal_id, OLD.journal_id);
  v_debit   numeric(19, 4);
  v_credit  numeric(19, 4);
  v_lines   bigint;
BEGIN
  SELECT count(*), COALESCE(sum(debit), 0), COALESCE(sum(credit), 0)
    INTO v_lines, v_debit, v_credit
    FROM journal_lines
   WHERE tenant_id = v_tenant AND journal_id = v_journal;

  IF v_lines = 0 THEN
    RAISE EXCEPTION 'Jurnal % tidak punya baris', v_journal
      USING ERRCODE = '23514';
  END IF;

  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'Jurnal % tidak berimbang: debit % ≠ kredit %', v_journal, v_debit, v_credit
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER assert_balanced_on_line
  AFTER INSERT ON journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION paadu.assert_journal_balanced();

-- Trigger di journal_lines saja tidak cukup: jurnal tanpa baris sama sekali
-- tidak pernah memicunya, dan akan lolos.
CREATE FUNCTION paadu.assert_journal_has_lines() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_debit  numeric(19, 4);
  v_credit numeric(19, 4);
  v_lines  bigint;
BEGIN
  SELECT count(*), COALESCE(sum(debit), 0), COALESCE(sum(credit), 0)
    INTO v_lines, v_debit, v_credit
    FROM journal_lines
   WHERE tenant_id = NEW.tenant_id AND journal_id = NEW.id;

  IF v_lines = 0 THEN
    RAISE EXCEPTION 'Jurnal % disimpan tanpa satu pun baris', NEW.id
      USING ERRCODE = '23514';
  END IF;

  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'Jurnal % tidak berimbang: debit % ≠ kredit %', NEW.id, v_debit, v_credit
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER assert_has_lines_on_journal
  AFTER INSERT ON journals
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION paadu.assert_journal_has_lines();

-- ── Hak akses append-only ──────────────────────────────────────────────────
--
-- Inilah penegakan sebenarnya. Bukan trigger yang menolak UPDATE, melainkan
-- peran yang tidak pernah diberi hak untuk melakukannya (D-005). Trigger dapat
-- dinonaktifkan oleh pemilik tabel; hak yang tidak diberikan tidak dapat
-- dipakai.
--
-- Daftar tabel ini kembar dengan src/db/append-only-tables.ts. Test invarian
-- membandingkan keduanya terhadap katalog Postgres, sehingga keduanya tidak
-- dapat menyimpang diam-diam.

GRANT SELECT, INSERT ON audit_log     TO paadu_app;
GRANT SELECT, INSERT ON journals      TO paadu_app;
GRANT SELECT, INSERT ON journal_lines TO paadu_app;

GRANT SELECT ON audit_log, journals, journal_lines TO paadu_analytics;

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
