-- Adaugă coloanele pentru date de livrare în tabelul leads
-- Aceste câmpuri sunt folosite în formularul de creare lead nou din pipeline-ul Vanzari

-- Adaugă coloana judet (județ)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS judet TEXT;

-- Adaugă coloana strada (stradă)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS strada TEXT;

-- Creează index-uri pentru performanță (opțional, dacă vei căuta frecvent după aceste câmpuri)
CREATE INDEX IF NOT EXISTS idx_leads_judet ON leads(judet) WHERE judet IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_strada ON leads(strada) WHERE strada IS NOT NULL;

-- Comentarii pentru documentație
COMMENT ON COLUMN leads.judet IS 'Județul pentru livrare';
COMMENT ON COLUMN leads.strada IS 'Strada și numărul pentru livrare';


