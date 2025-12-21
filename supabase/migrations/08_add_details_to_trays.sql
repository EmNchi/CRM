-- Migration: Add details column to trays table
-- Permite salvarea detaliilor comenzii specifice per tăviță (în loc de per lead)

-- Adaugă coloana details în tabelul trays
ALTER TABLE trays ADD COLUMN IF NOT EXISTS details TEXT;

-- Comentariu explicativ pentru coloană
COMMENT ON COLUMN trays.details IS 'Detalii comandă comunicate de client, specifice pentru această tăviță';
