-- ============================================
-- SISTEM DE MESAGERIE - MIGRAȚIE COMPLETĂ
-- ============================================

-- ============================================
-- 1. CREARE TABELE
-- ============================================

-- Tabel: conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('direct', 'lead', 'service_file', 'tray', 'general')),
  related_id UUID, -- lead_id, service_file_id sau tray_id (NULL pentru direct/general)
  title TEXT, -- Titlu pentru conversații generale
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  
  -- Constraint: related_id este obligatoriu pentru lead/service_file/tray
  CONSTRAINT check_related_id CHECK (
    (type IN ('lead', 'service_file', 'tray') AND related_id IS NOT NULL) OR
    (type IN ('direct', 'general') AND related_id IS NULL)
  ),
  
  -- Constraint: title este obligatoriu pentru general
  CONSTRAINT check_title CHECK (
    (type = 'general' AND title IS NOT NULL) OR
    (type != 'general')
  )
);

-- Tabel: conversation_participants
CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('owner', 'participant', 'admin')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,
  muted BOOLEAN DEFAULT false,
  
  -- Constraint: un utilizator poate participa o singură dată la o conversație
  CONSTRAINT unique_participant UNIQUE (conversation_id, user_id)
);

-- Tabel: messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'system', 'image')),
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- Tabel: message_reads (pentru read receipts)
CREATE TABLE IF NOT EXISTS message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: un utilizator poate marca un mesaj ca citit o singură dată
  CONSTRAINT unique_read UNIQUE (message_id, user_id)
);

-- ============================================
-- 2. INDEXURI PENTRU PERFORMANȚĂ
-- ============================================

-- conversations
CREATE INDEX IF NOT EXISTS idx_conversations_type_related 
  ON conversations(type, related_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message 
  ON conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_conversations_created_by 
  ON conversations(created_by);

-- conversation_participants
CREATE INDEX IF NOT EXISTS idx_participants_user 
  ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_conversation 
  ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_participants_last_read 
  ON conversation_participants(conversation_id, last_read_at);

-- messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation 
  ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender 
  ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_reply 
  ON messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_not_deleted 
  ON messages(conversation_id, created_at DESC) WHERE deleted_at IS NULL;

-- message_reads
CREATE INDEX IF NOT EXISTS idx_reads_message_user 
  ON message_reads(message_id, user_id);
CREATE INDEX IF NOT EXISTS idx_reads_user 
  ON message_reads(user_id);

-- ============================================
-- 3. FUNCȚII HELPER SQL
-- ============================================

-- Funcție: Calculează numărul de mesaje necitite pentru un utilizator
CREATE OR REPLACE FUNCTION get_unread_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  unread_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO unread_count
  FROM conversations c
  INNER JOIN conversation_participants cp ON cp.conversation_id = c.id
  LEFT JOIN messages m ON m.conversation_id = c.id 
    AND m.deleted_at IS NULL
    AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamptz)
  WHERE cp.user_id = p_user_id
    AND cp.muted = false
    AND (c.last_message_at IS NULL OR c.last_message_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamptz));
  
  RETURN COALESCE(unread_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funcție: Marchează o conversație ca citită pentru un utilizator
CREATE OR REPLACE FUNCTION mark_conversation_read(p_conversation_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE conversation_participants
  SET last_read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND user_id = p_user_id;
  
  -- Marchează toate mesajele din conversație ca citite
  INSERT INTO message_reads (message_id, user_id, read_at)
  SELECT m.id, p_user_id, NOW()
  FROM messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM message_reads mr 
      WHERE mr.message_id = m.id AND mr.user_id = p_user_id
    )
  ON CONFLICT (message_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funcție: Actualizează last_message_at când se adaugă un mesaj nou
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at,
      updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Actualizează last_message_at automat
DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON messages;
CREATE TRIGGER trigger_update_conversation_last_message
  AFTER INSERT ON messages
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NULL)
  EXECUTE FUNCTION update_conversation_last_message();

-- Funcție: Adaugă automat participanții la conversația unui lead
CREATE OR REPLACE FUNCTION auto_add_participants_to_lead_conversation(p_lead_id UUID)
RETURNS VOID AS $$
DECLARE
  v_conversation_id UUID;
  v_user_id UUID;
BEGIN
  -- Găsește sau creează conversația pentru lead
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE type = 'lead' AND related_id = p_lead_id
  LIMIT 1;
  
  -- Dacă nu există, creează-o
  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (type, related_id, created_by)
    VALUES ('lead', p_lead_id, auth.uid())
    RETURNING id INTO v_conversation_id;
  END IF;
  
  -- Adaugă toți utilizatorii cu acces la lead (owner/admin + cei cu permisiuni pipeline)
  FOR v_user_id IN
    SELECT DISTINCT user_id
    FROM (
      -- Owner și admin
      SELECT user_id FROM app_members WHERE role IN ('owner', 'admin')
      UNION
      -- Utilizatori cu permisiuni pipeline pentru lead-ul dat
      SELECT DISTINCT upp.user_id
      FROM user_pipeline_permissions upp
      INNER JOIN leads l ON l.pipeline_id = upp.pipeline_id
      WHERE l.id = p_lead_id
    ) AS allowed_users
  LOOP
    INSERT INTO conversation_participants (conversation_id, user_id, role)
    VALUES (
      v_conversation_id,
      v_user_id,
      CASE 
        WHEN EXISTS (SELECT 1 FROM app_members WHERE user_id = v_user_id AND role IN ('owner', 'admin'))
        THEN 'admin'
        ELSE 'participant'
      END
    )
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funcție: Adaugă automat participanții la conversația unei tăvițe
CREATE OR REPLACE FUNCTION auto_add_participants_to_tray_conversation(p_tray_id UUID)
RETURNS VOID AS $$
DECLARE
  v_conversation_id UUID;
  v_user_id UUID;
  v_service_file_id UUID;
  v_lead_id UUID;
BEGIN
  -- Găsește service_file_id și lead_id pentru tăviță
  SELECT t.service_file_id, sf.lead_id
  INTO v_service_file_id, v_lead_id
  FROM trays t
  INNER JOIN service_files sf ON sf.id = t.service_file_id
  WHERE t.id = p_tray_id
  LIMIT 1;
  
  IF v_service_file_id IS NULL OR v_lead_id IS NULL THEN
    RAISE EXCEPTION 'Tăvița nu are service_file sau lead asociat';
  END IF;
  
  -- Găsește sau creează conversația pentru tăviță
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE type = 'tray' AND related_id = p_tray_id
  LIMIT 1;
  
  -- Dacă nu există, creează-o
  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (type, related_id, created_by)
    VALUES ('tray', p_tray_id, auth.uid())
    RETURNING id INTO v_conversation_id;
  END IF;
  
  -- Adaugă toți utilizatorii cu acces la lead (owner/admin + cei cu permisiuni pipeline)
  -- + tehnicianul care lucrează la tăviță (dacă există)
  FOR v_user_id IN
    SELECT DISTINCT user_id
    FROM (
      -- Owner și admin
      SELECT user_id FROM app_members WHERE role IN ('owner', 'admin')
      UNION
      -- Utilizatori cu permisiuni pipeline pentru lead-ul asociat
      SELECT DISTINCT upp.user_id
      FROM user_pipeline_permissions upp
      INNER JOIN leads l ON l.pipeline_id = upp.pipeline_id
      WHERE l.id = v_lead_id
      UNION
      -- Tehnicianul care lucrează la tăviță (din tray_items)
      SELECT DISTINCT ti.technician_id
      FROM tray_items ti
      WHERE ti.tray_id = p_tray_id
        AND ti.technician_id IS NOT NULL
    ) AS allowed_users
  LOOP
    INSERT INTO conversation_participants (conversation_id, user_id, role)
    VALUES (
      v_conversation_id,
      v_user_id,
      CASE 
        WHEN EXISTS (SELECT 1 FROM app_members WHERE user_id = v_user_id AND role IN ('owner', 'admin'))
        THEN 'admin'
        ELSE 'participant'
      END
    )
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. ACTIVARE RLS
-- ============================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RLS POLICIES - conversations
-- ============================================

-- SELECT: Utilizatorii pot vedea conversațiile la care participă
CREATE POLICY "Users can view conversations they participate in"
  ON conversations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversations.id
        AND cp.user_id = auth.uid()
    )
  );

-- INSERT: Utilizatorii pot crea conversații
CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- UPDATE: Doar creatorul sau adminii pot actualiza
CREATE POLICY "Creators and admins can update conversations"
  ON conversations FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM app_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- DELETE: Doar creatorul sau adminii pot șterge
CREATE POLICY "Creators and admins can delete conversations"
  ON conversations FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM app_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================
-- 6. RLS POLICIES - conversation_participants
-- ============================================

-- SELECT: Utilizatorii pot vedea participanții la conversațiile lor
CREATE POLICY "Users can view participants in their conversations"
  ON conversation_participants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp2
      WHERE cp2.conversation_id = conversation_participants.conversation_id
        AND cp2.user_id = auth.uid()
    )
  );

-- INSERT: Doar creatorul conversației sau adminii pot adăuga participanți
CREATE POLICY "Creators and admins can add participants"
  ON conversation_participants FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_participants.conversation_id
        AND (c.created_by = auth.uid() OR EXISTS (
          SELECT 1 FROM app_members
          WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        ))
    )
  );

-- UPDATE: Utilizatorii pot actualiza propriul last_read_at și muted
CREATE POLICY "Users can update own participant data"
  ON conversation_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: Doar creatorul sau adminii pot elimina participanți
CREATE POLICY "Creators and admins can remove participants"
  ON conversation_participants FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_participants.conversation_id
        AND (c.created_by = auth.uid() OR EXISTS (
          SELECT 1 FROM app_members
          WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        ))
    )
  );

-- ============================================
-- 7. RLS POLICIES - messages
-- ============================================

-- SELECT: Utilizatorii pot vedea mesajele din conversațiile la care participă
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
    )
  );

-- INSERT: Utilizatorii pot trimite mesaje doar în conversațiile la care participă
CREATE POLICY "Users can send messages in their conversations"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
    )
  );

-- UPDATE: Doar expeditorul poate edita propriile mesaje (în 15 minute)
CREATE POLICY "Users can edit own messages within 15 minutes"
  ON messages FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    AND deleted_at IS NULL
    AND created_at > NOW() - INTERVAL '15 minutes'
  )
  WITH CHECK (
    sender_id = auth.uid()
    AND deleted_at IS NULL
  );

-- DELETE: Soft delete - doar expeditorul sau adminii
CREATE POLICY "Users and admins can delete messages"
  ON messages FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM app_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (true); -- Permite setarea deleted_at

-- ============================================
-- 8. RLS POLICIES - message_reads
-- ============================================

-- SELECT: Utilizatorii pot vedea propriile citiri
CREATE POLICY "Users can view own reads"
  ON message_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- INSERT: Utilizatorii pot marca mesajele ca citite
CREATE POLICY "Users can mark messages as read"
  ON message_reads FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp
      INNER JOIN messages m ON m.conversation_id = cp.conversation_id
      WHERE m.id = message_reads.message_id
        AND cp.user_id = auth.uid()
    )
  );

-- ============================================
-- 9. TRIGGERS PENTRU AUTO-CREARE CONVERSAȚII
-- ============================================

-- Trigger: Creează automat conversația când se creează o tăviță nouă
CREATE OR REPLACE FUNCTION create_tray_conversation_on_tray_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Creează conversația pentru tăviță
  INSERT INTO conversations (type, related_id, created_by)
  VALUES ('tray', NEW.id, COALESCE(auth.uid(), NEW.id::uuid)) -- Fallback dacă nu există auth.uid()
  RETURNING id INTO v_conversation_id;
  
  -- Adaugă automat participanții
  PERFORM auto_add_participants_to_tray_conversation(NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplică trigger-ul pe tabelul trays (dacă există)
-- Notă: Acest trigger va funcționa doar dacă tabelul trays există
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trays') THEN
    DROP TRIGGER IF EXISTS trigger_create_tray_conversation ON trays;
    CREATE TRIGGER trigger_create_tray_conversation
      AFTER INSERT ON trays
      FOR EACH ROW
      EXECUTE FUNCTION create_tray_conversation_on_tray_insert();
  END IF;
END $$;

-- ============================================
-- 10. COMENTARII PENTRU DOCUMENTAȚIE
-- ============================================

COMMENT ON TABLE conversations IS 'Conversații/thread-uri pentru mesagerie';
COMMENT ON TABLE conversation_participants IS 'Participanții la conversații';
COMMENT ON TABLE messages IS 'Mesajele din conversații';
COMMENT ON TABLE message_reads IS 'Citiri mesaje pentru read receipts';

COMMENT ON COLUMN conversations.type IS 'Tip conversație: direct, lead, service_file, tray, general';
COMMENT ON COLUMN conversations.related_id IS 'ID-ul entității legate (lead_id, service_file_id sau tray_id)';
COMMENT ON COLUMN messages.message_type IS 'Tip mesaj: text, file, system, image';
COMMENT ON COLUMN messages.deleted_at IS 'Soft delete - mesajul nu este șters fizic';

-- ============================================
-- 11. ENABLE REALTIME (pentru Supabase Realtime)
-- ============================================

-- Activează Realtime pentru tabelele de mesagerie
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;



