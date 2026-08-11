-- Up Migration
--
-- Inti persediaan — Module 05, D-014.
--
-- Keputusan yang membentuk seluruh tabel di bawah: **stok adalah buku besar,
-- saldo adalah proyeksi.** `stock_movements` append-only dan tidak pernah
-- diubah; `stock_balances` dapat dibangun ulang sepenuhnya darinya, dan bila
-- keduanya berbeda, mutasi yang benar.

CREATE TYPE item_type AS ENUM ('stock', 'service', 'non_stock');
CREATE TYPE warehouse_type AS ENUM ('physical', 'transit', 'consignment', 'damaged');
CREATE TYPE stock_movement_type AS ENUM (
  'receipt', 'shipment', 'adjustment', 'transfer_out', 'transfer_in', 'production', 'consumption'
);

CREATE TABLE items (
  id            uuid NOT NULL,
  tenant_id     uuid NOT NULL,
  company_id    uuid NOT NULL,
  code          text NOT NULL,
  name          text NOT NULL,
  -- Butir 7 Design_Handoff_Spec §2: pemisahan pendapatan barang dan jasa di
  -- laba rugi bergantung pada kolom ini.
  type          item_type NOT NULL,
  category_id   uuid,
  base_uom      text NOT NULL,
  track_batch   boolean NOT NULL DEFAULT false,
  track_serial  boolean NOT NULL DEFAULT false,
  reorder_point numeric(18, 4),
  reorder_qty   numeric(18, 4),
  barcode       text,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid,
  deleted_at    timestamptz,
  deleted_by    uuid,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  UNIQUE (tenant_id, company_id, code)
);

-- Satu karung = 25 kg disimpan sebagai faktor, bukan sebagai item terpisah.
CREATE TABLE uom_conversions (
  id             uuid NOT NULL,
  tenant_id      uuid NOT NULL,
  item_id        uuid NOT NULL,
  uom            text NOT NULL,
  factor_to_base numeric(18, 6) NOT NULL CHECK (factor_to_base > 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, item_id) REFERENCES items (tenant_id, id),
  UNIQUE (tenant_id, item_id, uom)
);

CREATE TABLE warehouses (
  id         uuid NOT NULL,
  tenant_id  uuid NOT NULL,
  company_id uuid NOT NULL,
  code       text NOT NULL,
  name       text NOT NULL,
  type       warehouse_type NOT NULL DEFAULT 'physical',
  parent_id  uuid,
  address    text,
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  FOREIGN KEY (tenant_id, parent_id) REFERENCES warehouses (tenant_id, id),
  UNIQUE (tenant_id, company_id, code)
);

-- ── Buku besar stok ───────────────────────────────────────────────────────
--
-- Append-only. Koreksi selalu lewat mutasi lawan, tidak pernah lewat
-- pengubahan baris — sama seperti jurnal dan audit log.

CREATE TABLE stock_movements (
  id           uuid NOT NULL,
  tenant_id    uuid NOT NULL,
  company_id   uuid NOT NULL,
  item_id      uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  -- Urut per company, dipakai proyeksi saldo untuk tahu sampai mana ia terbaca.
  sequence     bigint NOT NULL,
  type         stock_movement_type NOT NULL,
  -- Positif masuk, negatif keluar. SELALU satuan dasar; konversi hanya di
  -- lapis tampilan dan input.
  qty_base     numeric(18, 4) NOT NULL CHECK (qty_base <> 0),
  unit_cost    numeric(19, 4),
  source_type  text,
  source_id    uuid,
  moved_at     timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  FOREIGN KEY (tenant_id, item_id) REFERENCES items (tenant_id, id),
  FOREIGN KEY (tenant_id, warehouse_id) REFERENCES warehouses (tenant_id, id),
  UNIQUE (tenant_id, company_id, sequence)
);

CREATE INDEX stock_movements_posisi_idx
  ON stock_movements (tenant_id, item_id, warehouse_id, sequence);

-- ── Proyeksi saldo ────────────────────────────────────────────────────────
--
-- `qty_available` TIDAK disimpan. Ia kolom terhitung, sehingga tidak mungkin
-- menyimpan nilai yang tidak sama dengan qty_on_hand − qty_reserved.

CREATE TABLE stock_balances (
  tenant_id              uuid NOT NULL,
  company_id             uuid NOT NULL,
  item_id                uuid NOT NULL,
  warehouse_id           uuid NOT NULL,
  qty_on_hand            numeric(18, 4) NOT NULL DEFAULT 0,
  qty_reserved           numeric(18, 4) NOT NULL DEFAULT 0 CHECK (qty_reserved >= 0),
  qty_in_transit         numeric(18, 4) NOT NULL DEFAULT 0,
  qty_available          numeric(18, 4) GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED,
  value                  numeric(19, 4) NOT NULL DEFAULT 0,
  last_movement_sequence bigint NOT NULL DEFAULT 0,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, item_id, warehouse_id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id),
  FOREIGN KEY (tenant_id, item_id) REFERENCES items (tenant_id, id),
  FOREIGN KEY (tenant_id, warehouse_id) REFERENCES warehouses (tenant_id, id)
);

CREATE TABLE stock_reservations (
  id           uuid NOT NULL,
  tenant_id    uuid NOT NULL,
  company_id   uuid NOT NULL,
  item_id      uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  qty_base     numeric(18, 4) NOT NULL CHECK (qty_base > 0),
  source_type  text NOT NULL,
  source_id    uuid,
  expires_at   timestamptz,
  released_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, item_id) REFERENCES items (tenant_id, id),
  FOREIGN KEY (tenant_id, warehouse_id) REFERENCES warehouses (tenant_id, id)
);

CREATE INDEX stock_reservations_aktif_idx
  ON stock_reservations (tenant_id, item_id, warehouse_id)
  WHERE released_at IS NULL;

-- Lapisan biaya FIFO, dikonsumsi berurutan saat pengeluaran.
CREATE TABLE cost_layers (
  id                 uuid NOT NULL,
  tenant_id          uuid NOT NULL,
  item_id            uuid NOT NULL,
  warehouse_id       uuid NOT NULL,
  received_at        timestamptz NOT NULL DEFAULT now(),
  qty_remaining      numeric(18, 4) NOT NULL CHECK (qty_remaining >= 0),
  unit_cost          numeric(19, 4) NOT NULL,
  source_movement_id uuid NOT NULL,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, item_id) REFERENCES items (tenant_id, id),
  FOREIGN KEY (tenant_id, warehouse_id) REFERENCES warehouses (tenant_id, id),
  FOREIGN KEY (tenant_id, source_movement_id) REFERENCES stock_movements (tenant_id, id)
);

CREATE INDEX cost_layers_fifo_idx
  ON cost_layers (tenant_id, item_id, warehouse_id, received_at)
  WHERE qty_remaining > 0;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['items', 'uom_conversions', 'warehouses', 'stock_movements',
                           'stock_balances', 'stock_reservations', 'cost_layers'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I
         USING (tenant_id = paadu.current_tenant_id())
         WITH CHECK (tenant_id = paadu.current_tenant_id())', t);
    EXECUTE format('GRANT SELECT ON public.%I TO paadu_analytics', t);
  END LOOP;
END $$;

-- `stock_movements` append-only: hanya SELECT dan INSERT, sama seperti jurnal.
GRANT SELECT, INSERT ON stock_movements TO paadu_app;

GRANT SELECT, INSERT, UPDATE ON items, uom_conversions, warehouses TO paadu_app;
GRANT SELECT, INSERT, UPDATE ON stock_balances, stock_reservations, cost_layers TO paadu_app;

CREATE TRIGGER t20_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();
CREATE TRIGGER t20_updated_at BEFORE UPDATE ON warehouses
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();
CREATE TRIGGER t20_updated_at BEFORE UPDATE ON stock_balances
  FOR EACH ROW EXECUTE FUNCTION paadu.set_updated_at();

-- ── Membangun ulang proyeksi dari buku besar ──────────────────────────────
--
-- Bukti bahwa saldo memang proyeksi: fungsi ini menghitung ulang seluruhnya
-- dari mutasi. Bila hasilnya berbeda dari yang tersimpan, mutasi yang benar.
--
-- Reservasi tidak ikut dibangun ulang dari mutasi — ia bukan mutasi, melainkan
-- janji atas stok yang masih ada.

CREATE FUNCTION paadu.rebuild_stock_balances(p_company uuid) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
  v_tenant uuid := paadu.current_tenant_id();
  v_rows   bigint;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Konteks tenant belum dipasang' USING ERRCODE = '42501';
  END IF;

  WITH dihitung AS (
    SELECT m.item_id,
           m.warehouse_id,
           sum(m.qty_base) AS qty_on_hand,
           sum(m.qty_base * COALESCE(m.unit_cost, 0)) AS value,
           max(m.sequence) AS last_sequence
      FROM stock_movements m
     WHERE m.tenant_id = v_tenant AND m.company_id = p_company
     GROUP BY m.item_id, m.warehouse_id
  ), ditulis AS (
    INSERT INTO stock_balances
      (tenant_id, company_id, item_id, warehouse_id, qty_on_hand, value, last_movement_sequence)
    SELECT v_tenant, p_company, item_id, warehouse_id, qty_on_hand, value, last_sequence
      FROM dihitung
    ON CONFLICT (tenant_id, item_id, warehouse_id) DO UPDATE
      SET qty_on_hand = EXCLUDED.qty_on_hand,
          value = EXCLUDED.value,
          last_movement_sequence = EXCLUDED.last_movement_sequence,
          updated_at = now()
    RETURNING 1
  )
  SELECT count(*) INTO v_rows FROM ditulis;

  RETURN v_rows;
END
$$;

GRANT EXECUTE ON FUNCTION paadu.rebuild_stock_balances(uuid) TO paadu_app;

-- Down Migration
DO $$
BEGIN
  RAISE EXCEPTION 'Migrasi Paadu Flow bersifat maju saja. Tulis migrasi baru yang mencabut perubahan ini.';
END $$;
