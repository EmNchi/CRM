-- Extinde sistemul de mesagerie cu suport pentru attachmente și mențiuni

-- 1. Adaugă coloane la messages pentru metadata
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS has_attachments boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 2. Creează tabel pentru attachmente de mesaje
CREATE TABLE IF NOT EXISTS message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  attachment_type varchar(50) NOT NULL CHECK (attachment_type IN ('image', 'file', 'link')),
  url text NOT NULL,
  display_name text,
  file_size integer,
  mime_type text,
  created_at timestamp with time zone DEFAULT now(),
  
  UNIQUE(message_id, url)
);

-- 3. Creează tabel pentru mentioned entities în mesaje
CREATE TABLE IF NOT EXISTS message_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  mention_type varchar(50) NOT NULL CHECK (mention_type IN ('service', 'tag', 'contact', 'image', 'instrument')),
  entity_id text,
  entity_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  
  UNIQUE(message_id, mention_type, entity_id)
);

-- 4. Indexi pentru performance
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_message_id ON message_mentions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_type ON message_mentions(mention_type);

-- 5. RLS policies pentru message_attachments
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_attachments_select" ON message_attachments
  FOR SELECT USING (true);

CREATE POLICY "message_attachments_insert" ON message_attachments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "message_attachments_delete" ON message_attachments
  FOR DELETE USING (true);

-- 6. RLS policies pentru message_mentions
ALTER TABLE message_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_mentions_select" ON message_mentions
  FOR SELECT USING (true);

CREATE POLICY "message_mentions_insert" ON message_mentions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "message_mentions_delete" ON message_mentions
  FOR DELETE USING (true);

