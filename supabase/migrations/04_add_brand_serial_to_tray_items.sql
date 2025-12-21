-- Adaugă câmpuri dedicate pentru brand și serial_number în tabelul tray_items
-- Aceste câmpuri vor permite salvarea brand-ului și serial number-ului pentru fiecare instrument într-o tavita

-- Verifică dacă coloanele există deja înainte de a le adăuga
DO $$ 
BEGIN
  -- Adaugă câmpul brand
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tray_items' 
    AND column_name = 'brand'
  ) THEN
    ALTER TABLE tray_items 
    ADD COLUMN brand TEXT;
    
    COMMENT ON COLUMN tray_items.brand IS 'Brand-ul instrumentului';
  END IF;

  -- Adaugă câmpul serial_number
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tray_items' 
    AND column_name = 'serial_number'
  ) THEN
    ALTER TABLE tray_items 
    ADD COLUMN serial_number TEXT;
    
    COMMENT ON COLUMN tray_items.serial_number IS 'Numărul de serie al instrumentului';
  END IF;
END $$;

-- Migrare date existente din notes JSON la câmpuri dedicate
-- Actualizează brand și serial_number din notes JSON pentru items existente
UPDATE tray_items
SET 
  brand = CASE 
    WHEN notes IS NOT NULL THEN
      COALESCE(
        (notes::jsonb->>'brand')::text,
        brand
      )
    ELSE brand
  END,
  serial_number = CASE 
    WHEN notes IS NOT NULL THEN
      COALESCE(
        (notes::jsonb->>'serial_number')::text,
        serial_number
      )
    ELSE serial_number
  END
WHERE notes IS NOT NULL 
  AND (notes::jsonb ? 'brand' OR notes::jsonb ? 'serial_number');



