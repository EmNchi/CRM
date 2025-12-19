-- Creează tabelul pentru a stoca multiple brand-uri și serial numbers pentru fiecare tray_item
-- Acest tabel permite ca un tray_item să aibă mai multe combinații de brand + serial_number

CREATE TABLE IF NOT EXISTS tray_item_brand_serials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tray_item_id UUID NOT NULL REFERENCES tray_items(id) ON DELETE CASCADE,
  brand TEXT,
  serial_number TEXT,
  garantie BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: fiecare combinație brand + serial_number trebuie să fie unică per tray_item
  CONSTRAINT unique_brand_serial_per_item UNIQUE (tray_item_id, brand, serial_number)
);

-- Index pentru performanță
CREATE INDEX IF NOT EXISTS idx_tray_item_brand_serials_tray_item_id 
  ON tray_item_brand_serials(tray_item_id);

-- Comentarii
COMMENT ON TABLE tray_item_brand_serials IS 'Stochează multiple combinații de brand și serial_number pentru fiecare tray_item';
COMMENT ON COLUMN tray_item_brand_serials.tray_item_id IS 'Referință la tray_item-ul părinte';
COMMENT ON COLUMN tray_item_brand_serials.brand IS 'Brand-ul instrumentului';
COMMENT ON COLUMN tray_item_brand_serials.serial_number IS 'Numărul de serie al instrumentului';
COMMENT ON COLUMN tray_item_brand_serials.garantie IS 'Dacă instrumentul are garanție';

-- Trigger pentru actualizarea updated_at
CREATE OR REPLACE FUNCTION update_tray_item_brand_serials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tray_item_brand_serials_updated_at
  BEFORE UPDATE ON tray_item_brand_serials
  FOR EACH ROW
  EXECUTE FUNCTION update_tray_item_brand_serials_updated_at();

-- Enable RLS
ALTER TABLE tray_item_brand_serials ENABLE ROW LEVEL SECURITY;

-- RLS Policies pentru tray_item_brand_serials
-- Simplificat: toți utilizatorii autentificați pot gestiona brand-urile și serial numbers
-- (similar cu tray_items care permite "Users can manage all data")
CREATE POLICY "Users can manage brand serials"
  ON tray_item_brand_serials FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);



