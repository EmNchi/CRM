-- Adaugă câmpul tray_details în tabelul leads pentru a stoca detaliile comenzii comunicate de client

-- Verifică dacă coloana există deja înainte de a o adăuga
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'leads' 
    AND column_name = 'tray_details'
  ) THEN
    ALTER TABLE leads 
    ADD COLUMN tray_details TEXT;
    
    COMMENT ON COLUMN leads.tray_details IS 'Detalii despre comanda comunicată de client pentru tavita';
  END IF;
END $$;



