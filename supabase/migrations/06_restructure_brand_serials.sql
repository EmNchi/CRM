-- Restructurare: 2 tabele separate pentru brand-uri și serial numbers
-- Structura: tray_item -> tray_item_brands -> tray_item_brand_serials

-- 1. Creează tabelul pentru brand-uri per tray_item
CREATE TABLE IF NOT EXISTS tray_item_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tray_item_id UUID NOT NULL REFERENCES tray_items(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  garantie BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Modifică tray_item_brand_serials pentru a referi brand-ul, nu tray_item direct
-- Mai întâi șterge tabelul vechi dacă există
DROP TABLE IF EXISTS tray_item_brand_serials CASCADE;

-- 3. Creează noul tabel pentru serial numbers per brand
CREATE TABLE IF NOT EXISTS tray_item_brand_serials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES tray_item_brands(id) ON DELETE CASCADE,
  serial_number TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexuri pentru performanță
CREATE INDEX IF NOT EXISTS idx_tray_item_brands_tray_item_id 
  ON tray_item_brands(tray_item_id);

CREATE INDEX IF NOT EXISTS idx_tray_item_brand_serials_brand_id 
  ON tray_item_brand_serials(brand_id);

-- Comentarii
COMMENT ON TABLE tray_item_brands IS 'Brand-uri pentru fiecare tray_item';
COMMENT ON TABLE tray_item_brand_serials IS 'Serial numbers pentru fiecare brand';

-- Trigger pentru updated_at pe tray_item_brands
CREATE OR REPLACE FUNCTION update_tray_item_brands_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tray_item_brands_updated_at ON tray_item_brands;
CREATE TRIGGER update_tray_item_brands_updated_at
  BEFORE UPDATE ON tray_item_brands
  FOR EACH ROW
  EXECUTE FUNCTION update_tray_item_brands_updated_at();

-- Enable RLS
ALTER TABLE tray_item_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE tray_item_brand_serials ENABLE ROW LEVEL SECURITY;

-- RLS Policies pentru tray_item_brands
DROP POLICY IF EXISTS "Allow SELECT brands" ON tray_item_brands;
DROP POLICY IF EXISTS "Allow INSERT brands" ON tray_item_brands;
DROP POLICY IF EXISTS "Allow UPDATE brands" ON tray_item_brands;
DROP POLICY IF EXISTS "Allow DELETE brands" ON tray_item_brands;

CREATE POLICY "Allow SELECT brands" ON tray_item_brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow INSERT brands" ON tray_item_brands FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow UPDATE brands" ON tray_item_brands FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow DELETE brands" ON tray_item_brands FOR DELETE TO authenticated USING (true);

-- RLS Policies pentru tray_item_brand_serials
DROP POLICY IF EXISTS "Allow SELECT serials" ON tray_item_brand_serials;
DROP POLICY IF EXISTS "Allow INSERT serials" ON tray_item_brand_serials;
DROP POLICY IF EXISTS "Allow UPDATE serials" ON tray_item_brand_serials;
DROP POLICY IF EXISTS "Allow DELETE serials" ON tray_item_brand_serials;

CREATE POLICY "Allow SELECT serials" ON tray_item_brand_serials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow INSERT serials" ON tray_item_brand_serials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow UPDATE serials" ON tray_item_brand_serials FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow DELETE serials" ON tray_item_brand_serials FOR DELETE TO authenticated USING (true);



