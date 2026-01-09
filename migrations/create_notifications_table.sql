-- ============================================================================
-- TABEL: notifications
-- Sistem de notificări pentru utilizatori (în special tehnicieni)
-- ============================================================================

-- Creare tabel
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- Indexuri pentru performanță
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Activare Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Utilizatorul poate vedea doar notificările proprii
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Sistemul poate insera notificări pentru orice utilizator
-- (necesită service_role key sau authenticated user)
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;
CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Policy: Utilizatorul poate actualiza doar notificările proprii (pentru read/read_at)
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Utilizatorul poate șterge doar notificările proprii
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- COMENTARII
-- ============================================================================

COMMENT ON TABLE notifications IS 'Sistem de notificări pentru utilizatori';
COMMENT ON COLUMN notifications.type IS 'Tip notificare: tray_received, tray_completed, tray_urgent, service_assigned, message_received, system';
COMMENT ON COLUMN notifications.data IS 'Date adiționale în format JSON (tray_ids, service_file_id, client_name, etc.)';
COMMENT ON COLUMN notifications.read IS 'Dacă notificarea a fost citită';
COMMENT ON COLUMN notifications.read_at IS 'Timestamp când a fost marcată ca citită';

