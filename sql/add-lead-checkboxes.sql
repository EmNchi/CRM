-- Adaugă coloanele pentru checkbox-uri în tabelul leads
-- Aceste checkbox-uri sunt folosite în pipeline-ul Vanzari

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS no_deal BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS call_back BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS nu_raspunde BOOLEAN DEFAULT false;

-- Creează index-uri pentru performanță (opțional)
CREATE INDEX IF NOT EXISTS idx_leads_no_deal ON leads(no_deal) WHERE no_deal = true;
CREATE INDEX IF NOT EXISTS idx_leads_call_back ON leads(call_back) WHERE call_back = true;
CREATE INDEX IF NOT EXISTS idx_leads_nu_raspunde ON leads(nu_raspunde) WHERE nu_raspunde = true;






