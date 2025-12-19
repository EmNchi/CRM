-- Migration: Add details column to tray_items
-- Camp pentru detalii comanda per tavita (nu la nivel de trays)

ALTER TABLE tray_items ADD COLUMN IF NOT EXISTS details TEXT;

-- Optional: migreaza detaliile existente din trays.details in tray_items.details
UPDATE tray_items ti
SET details = t.details
FROM trays t
WHERE ti.tray_id = t.id
  AND t.details IS NOT NULL
  AND (ti.details IS NULL OR ti.details = '');

COMMENT ON COLUMN tray_items.details IS 'Detalii comanda comunicate de client, specifice pentru aceasta tavita.';
