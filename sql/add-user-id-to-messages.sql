-- Tabela messages foloseste sender_id (deja exista)
-- Actualizeaza RLS policies pentru messages cu sender_id

DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;
DROP POLICY IF EXISTS "messages_delete" ON messages;

-- Permite SELECT la toate mesajele
CREATE POLICY "messages_select" ON messages
  FOR SELECT
  USING (true);

-- Permite INSERT doar utilizatorului autentificat
CREATE POLICY "messages_insert" ON messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
  );

-- Permite UPDATE doar la mesajele proprii
CREATE POLICY "messages_update" ON messages
  FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- Permite DELETE doar la mesajele proprii
CREATE POLICY "messages_delete" ON messages
  FOR DELETE
  USING (auth.uid() = sender_id);

-- Re-enable RLS pe messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

