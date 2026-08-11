-- Up Migration
--
-- Butir 4: nomor dokumen diberikan saat submit, tanpa celah.
--
-- Bukan SEQUENCE. Sequence tidak ikut dibatalkan saat transaksi gagal, jadi ia
-- meninggalkan celah — dan celah pada urutan nomor dokumen adalah temuan audit,
-- bukan ketidakrapian (D-007).

CREATE TABLE document_sequences (
  tenant_id     uuid NOT NULL,
  company_id    uuid NOT NULL,
  document_type text NOT NULL,
  -- Kunci periode memisahkan urutan per bulan atau per tahun fiskal. String
  -- kosong berarti satu urutan berkelanjutan.
  period_key    text NOT NULL DEFAULT '',
  next_value    bigint NOT NULL DEFAULT 1 CHECK (next_value > 0),
  prefix        text NOT NULL DEFAULT '',
  padding       integer NOT NULL DEFAULT 4 CHECK (padding BETWEEN 1 AND 12),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, company_id, document_type, period_key),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id)
);

ALTER TABLE document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sequences FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON document_sequences
  USING (tenant_id = paadu.current_tenant_id())
  WITH CHECK (tenant_id = paadu.current_tenant_id());

CREATE TRIGGER t20_updated_at BEFORE UPDATE ON document_sequences
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON document_sequences TO paadu_app;
GRANT SELECT ON document_sequences TO paadu_analytics;

-- Penguncian baris, bukan periksa-lalu-tulis. Dua submit bersamaan atas jenis
-- dokumen yang sama akan berbaris, bukan bertabrakan.
--
-- Harganya nyata dan disengaja: submit untuk satu jenis dokumen di satu company
-- menjadi serial. Kuncinya sesempit mungkin — per (company, jenis, periode) —
-- supaya modul lain tidak ikut menunggu.

CREATE FUNCTION paadu.next_document_number(
  p_company uuid,
  p_type    text,
  p_period  text DEFAULT ''
) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_tenant uuid := paadu.current_tenant_id();
  v_next   bigint;
  v_prefix text;
  v_pad    integer;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Konteks tenant belum dipasang; penomoran ditolak'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO document_sequences (tenant_id, company_id, document_type, period_key)
  VALUES (v_tenant, p_company, p_type, p_period)
  ON CONFLICT DO NOTHING;

  SELECT next_value, prefix, padding
    INTO v_next, v_prefix, v_pad
    FROM document_sequences
   WHERE tenant_id = v_tenant
     AND company_id = p_company
     AND document_type = p_type
     AND period_key = p_period
     FOR UPDATE;

  UPDATE document_sequences
     SET next_value = next_value + 1
   WHERE tenant_id = v_tenant
     AND company_id = p_company
     AND document_type = p_type
     AND period_key = p_period;

  RETURN v_prefix
       || upper(p_type)
       || CASE WHEN p_period = '' THEN '' ELSE '-' || p_period END
       || '-'
       || lpad(v_next::text, v_pad, '0');
END
$$;

GRANT EXECUTE ON FUNCTION paadu.next_document_number(uuid, text, text) TO paadu_app;

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
