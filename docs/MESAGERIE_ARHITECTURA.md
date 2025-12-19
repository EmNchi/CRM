# 📨 Arhitectura Sistemului de Mesagerie

## 🎯 Scop
Sistem de mesagerie integrat în CRM pentru comunicare între utilizatori, comentarii pe lead-uri/fișe de serviciu, și notificări.

## 📊 Tipuri de Conversații

### 1. **Conversație Directă** (`direct`)
- Mesagerie între 2 utilizatori
- Utilizat pentru comunicare privată

### 2. **Conversație pe Lead** (`lead`)
- Comentarii și discuții despre un lead specific
- Toți utilizatorii cu acces la lead pot participa

### 3. **Conversație pe Fișă de Serviciu** (`service_file`)
- Comentarii despre o fișă de serviciu specifică
- Utilizat pentru coordonare tehnică

### 4. **Conversație pe Tăviță** (`tray`)
- **Conversație dedicată pentru fiecare tăviță**
- Comentarii și discuții specifice despre o tăviță
- Participanți: utilizatorii cu acces la lead + tehnicianul care lucrează la tăviță
- Utilizat pentru coordonare detaliată la nivel de tăviță

### 5. **Conversație Generală** (`general`)
- Canal general pentru anunțuri și discuții echipă

## 🗄️ Structura Bazei de Date

### 1. Tabel: `conversations`
Stochează conversațiile/thread-urile.

```sql
- id (UUID, PK)
- type (TEXT) - 'direct' | 'lead' | 'service_file' | 'tray' | 'general'
- related_id (UUID, nullable) - ID-ul entității legate (lead_id, service_file_id sau tray_id)
- title (TEXT, nullable) - Titlu pentru conversații generale
- created_by (UUID, FK -> auth.users) - Utilizatorul care a creat conversația
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
- last_message_at (TIMESTAMPTZ, nullable) - Timestamp ultimului mesaj
```

**Logica:**
- `type = 'direct'` → `related_id = NULL` (participanții sunt în `conversation_participants`)
- `type = 'lead'` → `related_id = lead.id`
- `type = 'service_file'` → `related_id = service_file.id`
- `type = 'tray'` → `related_id = tray.id` - **Conversație dedicată pentru fiecare tăviță**
- `type = 'general'` → `related_id = NULL`, `title` este obligatoriu

### 2. Tabel: `conversation_participants`
Participanții la conversații.

```sql
- id (UUID, PK)
- conversation_id (UUID, FK -> conversations.id, ON DELETE CASCADE)
- user_id (UUID, FK -> auth.users)
- role (TEXT) - 'owner' | 'participant' | 'admin'
- joined_at (TIMESTAMPTZ)
- last_read_at (TIMESTAMPTZ, nullable) - Ultima dată când utilizatorul a citit conversația
- muted (BOOLEAN, default false) - Dacă utilizatorul a dezactivat notificările
```

**Logica:**
- Pentru `direct`: exact 2 participanți
- Pentru `lead`/`service_file`: participanții se adaugă automat (toți cu acces)
- Pentru `tray`: participanții se adaugă automat (toți cu acces la lead + tehnicianul tăviței)
- Pentru `general`: toți utilizatorii autentificați

### 3. Tabel: `messages`
Mesajele din conversații.

```sql
- id (UUID, PK)
- conversation_id (UUID, FK -> conversations.id, ON DELETE CASCADE)
- sender_id (UUID, FK -> auth.users)
- content (TEXT) - Conținutul mesajului
- message_type (TEXT) - 'text' | 'file' | 'system' | 'image'
- file_url (TEXT, nullable) - URL pentru fișiere atașate
- file_name (TEXT, nullable) - Numele fișierului
- file_size (INTEGER, nullable) - Dimensiunea în bytes
- reply_to_id (UUID, FK -> messages.id, nullable) - Mesaj la care se răspunde
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
- edited_at (TIMESTAMPTZ, nullable) - Dacă mesajul a fost editat
- deleted_at (TIMESTAMPTZ, nullable) - Soft delete
```

**Logica:**
- `message_type = 'system'` → mesaje automate (ex: "X a adăugat Y la conversație")
- `reply_to_id` → permite threading/reply-uri
- `deleted_at` → soft delete pentru a păstra istoricul

### 4. Tabel: `message_reads` (Opțional - pentru read receipts)
Citiri mesaje.

```sql
- id (UUID, PK)
- message_id (UUID, FK -> messages.id, ON DELETE CASCADE)
- user_id (UUID, FK -> auth.users)
- read_at (TIMESTAMPTZ)
```

**Logica:**
- Track pentru fiecare mesaj care l-a citit fiecare utilizator
- Permite "read receipts" (✓✓ citit, ✓ trimis)

## 🔐 Row Level Security (RLS)

### `conversations`
- **SELECT**: Utilizatorii pot vedea conversațiile la care participă
- **INSERT**: Utilizatorii pot crea conversații (cu restricții bazate pe tip)
- **UPDATE**: Doar creatorul sau adminii pot actualiza
- **DELETE**: Doar creatorul sau adminii pot șterge

### `conversation_participants`
- **SELECT**: Utilizatorii pot vedea participanții la conversațiile lor
- **INSERT**: Doar creatorul conversației sau adminii pot adăuga participanți
- **UPDATE**: Utilizatorii pot actualiza propriul `last_read_at` și `muted`
- **DELETE**: Doar creatorul sau adminii pot elimina participanți

### `messages`
- **SELECT**: Utilizatorii pot vedea mesajele din conversațiile la care participă
- **INSERT**: Utilizatorii pot trimite mesaje doar în conversațiile la care participă
- **UPDATE**: Doar expeditorul poate edita propriile mesaje (în 15 minute)
- **DELETE**: Soft delete - doar expeditorul sau adminii

### `message_reads`
- **SELECT**: Utilizatorii pot vedea propriile citiri
- **INSERT**: Utilizatorii pot marca mesajele ca citite
- **UPDATE/DELETE**: Nu este necesar

## 🔄 Logica de Funcționare

### Crearea Conversațiilor

#### 1. Conversație Directă
```typescript
// Creează conversație directă între 2 utilizatori
// Verifică dacă există deja o conversație directă între ei
// Dacă nu, creează nouă conversație + 2 participanți
```

#### 2. Conversație pe Lead
```typescript
// Când se deschide un lead, se creează automat conversația (dacă nu există)
// Toți utilizatorii cu acces la lead sunt adăugați automat ca participanți
// Accesul se bazează pe user_pipeline_permissions
```

#### 3. Conversație pe Fișă de Serviciu
```typescript
// Similar cu lead, dar legat de service_file
// Participanții sunt toți utilizatorii cu acces la lead-ul asociat
```

#### 4. Conversație pe Tăviță
```typescript
// Când se deschide o tăviță, se creează automat conversația (dacă nu există)
// Participanții sunt:
// - Toți utilizatorii cu acces la lead-ul asociat (din service_file)
// - Tehnicianul care lucrează la tăviță (din tray_items.technician_id)
// Funcție: auto_add_participants_to_tray_conversation(tray_id)
```

#### 5. Conversație Generală
```typescript
// Creează manual de către admin/owner
// Toți utilizatorii autentificați sunt participanți
```

### Trimiterea Mesajelor

1. **Validare**: Verifică dacă utilizatorul participă la conversație
2. **Creare mesaj**: Inserează în `messages`
3. **Actualizare conversație**: Update `conversations.last_message_at` și `updated_at`
4. **Notificări**: Trimite notificări către participanții care nu au conversația mutată
5. **Real-time**: Folosește Supabase Realtime pentru broadcast

### Citirea Mesajelor

1. **Marcare citită**: Update `conversation_participants.last_read_at`
2. **Read receipts**: Inserează în `message_reads` pentru fiecare mesaj citit
3. **Badge unread**: Calculează numărul de mesaje necitite (`last_message_at > last_read_at`)

## 📡 Real-time cu Supabase

### Subscriptions
```typescript
// Ascultă mesaje noi
supabase
  .channel('messages')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`
  }, (payload) => {
    // Adaugă mesaj nou în UI
  })
  .subscribe()

// Ascultă actualizări conversații (last_message_at)
supabase
  .channel('conversations')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'conversations'
  }, (payload) => {
    // Actualizează lista de conversații
  })
  .subscribe()
```

## 🎨 UI/UX Considerații

### Componente Necesare
1. **ConversationList** - Lista conversațiilor (sidebar)
2. **ConversationView** - Vizualizarea unei conversații
3. **MessageInput** - Input pentru mesaje noi
4. **MessageBubble** - Bula de mesaj
5. **FileUpload** - Upload fișiere
6. **TypingIndicator** - Indicator "X scrie..."

### Features
- ✅ Badge cu numărul de mesaje necitite
- ✅ Indicatori de citire (✓ trimis, ✓✓ citit)
- ✅ Editare mesaje (în 15 minute)
- ✅ Ștergere mesaje (soft delete)
- ✅ Reply la mesaje
- ✅ Upload fișiere/imagine
- ✅ Căutare în conversații
- ✅ Filtrare conversații (toate, necitite, directe, lead-uri)

## 🔧 Funcții Helper SQL

### 1. `get_unread_count(user_id)`
Calculează numărul de mesaje necitite pentru un utilizator.

### 2. `mark_conversation_read(conversation_id, user_id)`
Marchează toate mesajele dintr-o conversație ca citite.

### 3. `auto_add_participants_to_lead_conversation(lead_id)`
Adaugă automat participanții la conversația unui lead.

### 4. `auto_add_participants_to_tray_conversation(tray_id)`
Adaugă automat participanții la conversația unei tăvițe:
- Toți utilizatorii cu acces la lead-ul asociat (din service_file)
- Tehnicianul care lucrează la tăviță (din tray_items.technician_id)

## 📝 Indexuri pentru Performanță

```sql
-- conversations
CREATE INDEX idx_conversations_type_related ON conversations(type, related_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);

-- conversation_participants
CREATE INDEX idx_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_participants_conversation ON conversation_participants(conversation_id);
CREATE UNIQUE INDEX idx_participants_unique ON conversation_participants(conversation_id, user_id);

-- messages
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_reply ON messages(reply_to_id);

-- message_reads
CREATE INDEX idx_reads_message_user ON message_reads(message_id, user_id);
```

## 🚀 Plan de Implementare

### Faza 1: Baza de Date
- [x] Creare tabele
- [x] RLS policies
- [x] Indexuri
- [x] Funcții helper SQL

### Faza 2: Backend/API
- [ ] Funcții TypeScript pentru CRUD conversații
- [ ] Funcții pentru mesaje
- [ ] Integrare Supabase Realtime

### Faza 3: Frontend
- [ ] Componente UI
- [ ] Integrare în layout-ul existent
- [ ] Real-time updates

### Faza 4: Features Avansate
- [ ] Upload fișiere
- [ ] Editare/ștergere mesaje
- [ ] Reply threading
- [ ] Căutare



