-- Adaugă coloanele pentru date de facturare în tabelul leads
-- Aceste câmpuri sunt folosite în formularul de facturare

-- Adaugă coloana billing_nume_prenume (Nume și Prenume pentru facturare)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS billing_nume_prenume TEXT;

-- Adaugă coloana billing_nume_companie (Nume Companie pentru facturare)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS billing_nume_companie TEXT;

-- Adaugă coloana billing_cui (CUI pentru facturare)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS billing_cui TEXT;

-- Adaugă coloana billing_strada (Stradă pentru facturare)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS billing_strada TEXT;

-- Adaugă coloana billing_oras (Oraș pentru facturare)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS billing_oras TEXT;

-- Adaugă coloana billing_judet (Județ pentru facturare)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS billing_judet TEXT;

-- Adaugă coloana billing_cod_postal (Cod poștal pentru facturare)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS billing_cod_postal TEXT;

-- Creează index-uri pentru performanță (opțional)
CREATE INDEX IF NOT EXISTS idx_leads_billing_cui ON leads(billing_cui) WHERE billing_cui IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_billing_oras ON leads(billing_oras) WHERE billing_oras IS NOT NULL;

-- Comentarii pentru documentație
COMMENT ON COLUMN leads.billing_nume_prenume IS 'Nume și prenume pentru facturare';
COMMENT ON COLUMN leads.billing_nume_companie IS 'Nume companie pentru facturare';
COMMENT ON COLUMN leads.billing_cui IS 'CUI pentru facturare';
COMMENT ON COLUMN leads.billing_strada IS 'Strada pentru facturare';
COMMENT ON COLUMN leads.billing_oras IS 'Oraș pentru facturare';
COMMENT ON COLUMN leads.billing_judet IS 'Județ pentru facturare';
COMMENT ON COLUMN leads.billing_cod_postal IS 'Cod poștal pentru facturare';

