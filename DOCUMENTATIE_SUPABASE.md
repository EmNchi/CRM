# Documentație Completă - Directorul `lib/supabase/`

Această documentație oferă o explicație detaliată pentru toate componentele, funcțiile, tipurile și interfețele din directorul `lib/supabase/` al aplicației CRM.

---

## Cuprins

1. [supabaseClient.ts](#1-supabaseclientts)
2. [server.ts](#2-servertsts)
3. [dashboardOperations.ts](#3-dashboardoperationsts)
4. [imageOperations.ts](#4-imageoperationsts)
5. [leadOperations.ts](#5-leadoperationsts)
6. [optimized-queries.ts](#6-optimized-querieststs)
7. [partOperations.ts](#7-partoperationsts)
8. [pipelineOperations.ts](#8-pipelineoperationsts)
9. [serviceFileOperations.ts](#9-servicefileoperationsts)
10. [serviceOperations.ts](#10-serviceoperationsts)
11. [tagOperations.ts](#11-tagoperationsts)
12. [technicianOperations.ts](#12-technicianoperationsts)

---

## 1. supabaseClient.ts

### Descriere Generală
Acest fișier oferă o instanță singleton a clientului Supabase pentru partea de browser (client-side). Asigură că doar o singură instanță a clientului Supabase este creată și reutilizată în întreaga aplicație, prevenind reinițializări inutile și optimizând performanța.

### Detalii Tehnice
- **Tip**: Client Component (`'use client'`)
- **Pattern**: Singleton Pattern
- **Bibliotecă**: `@supabase/auth-helpers-nextjs`

### Funcții

#### `supabaseBrowser()`
**Tip returnat**: `ReturnType<typeof createClientComponentClient>`

**Descriere**: 
Creează sau returnează instanța existentă a clientului Supabase pentru browser. Această funcție implementează pattern-ul singleton pentru a preveni crearea multiplă a instanțelor clientului.

**Implementare**:
- Verifică dacă există deja o instanță (`_client`)
- Dacă nu există, creează o nouă instanță folosind `createClientComponentClient()`
- Returnează instanța existentă sau nou creată

**Utilizare**:
```typescript
import { supabaseBrowser } from './supabaseClient'
const supabase = supabaseBrowser()
```

**Avantaje**:
- Evită reinițializări inutile
- Reduce overhead-ul de memorie
- Asigură consistența în întreaga aplicație

---

## 2. server.ts

### Descriere Generală
Acest fișier oferă o instanță a clientului Supabase pentru partea de server (server-side), folosind contextul de autentificare din Next.js cookies.

### Detalii Tehnice
- **Tip**: Server Component (fără `'use client'`)
- **Bibliotecă**: `@supabase/auth-helpers-nextjs`
- **Dependență**: `next/headers` pentru cookies

### Funcții

#### `supabaseServer()`
**Tip returnat**: `ReturnType<typeof createServerComponentClient>`

**Descriere**:
Creează o instanță a clientului Supabase pentru server-side rendering, folosind cookies-urile Next.js pentru a obține contextul de autentificare al utilizatorului.

**Implementare**:
- Folosește `createServerComponentClient` din `@supabase/auth-helpers-nextjs`
- Pasează `cookies()` din `next/headers` pentru a accesa cookies-urile de autentificare
- Returnează o instanță configurată pentru server-side operations

**Utilizare**:
```typescript
import { supabaseServer } from './server'
const supabase = supabaseServer()
```

**Diferențe față de `supabaseBrowser()`**:
- Rulează pe server, nu în browser
- Folosește cookies pentru autentificare
- Nu poate accesa localStorage sau sessionStorage
- Este optim pentru Server Components și Server Actions din Next.js

---

## 3. dashboardOperations.ts

### Descriere Generală
Acest modul gestionează operațiunile legate de dashboard-ul aplicației, oferind funcții pentru calcularea metricilor și statisticilor agregate. Folosește funcții RPC (Remote Procedure Calls) din Supabase pentru eficiență maximă.

### Detalii Tehnice
- **Tip**: Client Component (`'use client'`)
- **Optimizări**: Folosește RPC pentru agregări complexe
- **Fallback**: Returnează valori goale în caz de eroare

### Interfețe și Tipuri

#### `DashboardMetrics`
Interfață care definește structura datelor pentru metricile dashboard-ului.

**Proprietăți**:
- `totalLeads: number` - Numărul total de lead-uri
- `totalRevenue: number` - Venitul total calculat
- `urgentLeads: number` - Numărul de lead-uri marcate ca urgente
- `newLeadsToday: number` - Numărul de lead-uri noi create astăzi
- `leadsByPipeline: Record<string, number>` - Distribuția lead-urilor pe pipeline-uri
- `leadsByStage: Record<string, number>` - Distribuția lead-urilor pe stage-uri
- `revenueByPipeline: Record<string, number>` - Venitul pe pipeline
- `revenueByStage: Record<string, number>` - Venitul pe stage
- `leadsOverTime: Array<{ date: string; count: number }>` - Evoluția lead-urilor în timp
- `topTechnicians: Array<{ name: string; leads: number; revenue: number }>` - Top tehnicieni
- `tagDistribution: Record<string, number>` - Distribuția tag-urilor
- `conversionRate: number` - Rata de conversie
- `averageLeadValue: number` - Valoarea medie a unui lead
- `paymentMethodStats: { cash: number; card: number; none: number }` - Statistici metode de plată

### Constante

#### `emptyMetrics`
O constantă care definește un obiect `DashboardMetrics` cu toate valorile setate la 0 sau obiecte/goale goale. Folosit ca valoare de fallback în caz de eroare.

### Funcții

#### `calculateDashboardMetrics(excludePipeline?: string)`
**Tip returnat**: `Promise<DashboardMetrics>`

**Parametri**:
- `excludePipeline?: string` - Numele pipeline-ului de exclus din calcule (implicit: 'Vanzari')

**Descriere**:
Obține metricile dashboard-ului folosind o singură apelare RPC către funcția `get_dashboard_stats` din baza de date. Această abordare este mult mai eficientă decât multiple query-uri individuale.

**Flux de execuție**:
1. Apelează `supabase.rpc('get_dashboard_stats')` cu parametrul `p_exclude_pipeline`
2. Procesează datele returnate
3. Calculează `averageLeadValue` ca raport între `totalRevenue` și `totalLeads`
4. Returnează obiectul `DashboardMetrics` completat
5. În caz de eroare, returnează `emptyMetrics`

**Optimizări**:
- O singură apelare RPC în loc de multiple query-uri
- Procesare eficientă a datelor agregate
- Conversie explicită a `totalRevenue` la `Number` pentru consistență

#### `calculateVanzariMetrics()`
**Tip returnat**: `Promise<DashboardMetrics>`

**Descriere**:
Funcție specializată pentru calcularea metricilor pentru pipeline-ul "Vanzari". Găsește pipeline-ul "Vanzari" și obține statisticile specifice pentru acesta.

**Flux de execuție**:
1. Caută pipeline-ul "Vanzari" folosind `ilike` pentru matching case-insensitive
2. Dacă nu găsește pipeline-ul, returnează `emptyMetrics`
3. Apelează `get_dashboard_stats` cu `p_exclude_pipeline: null` pentru a obține toate datele
4. Procesează și returnează metricile (similar cu `calculateDashboardMetrics`)

**Notă**: Comentariul din cod indică faptul că această funcție poate fi optimizată ulterior pentru a filtra mai eficient datele doar pentru pipeline-ul "Vanzari".

---

## 4. imageOperations.ts

### Descriere Generală
Acest modul gestionează operațiunile legate de imaginile asociate tăvițelor (trays). Oferă funcții pentru încărcarea, ștergerea și gestionarea referințelor de imagini folosind Supabase Storage și tabela `tray_images` din baza de date.

### Detalii Tehnice
- **Tip**: Client Component (`'use client'`)
- **Storage Bucket**: `tray_images`
- **Tabel asociat**: `tray_images` (pentru referințe/metadate)

### Constante

#### `TRAY_BUCKET_NAME`
Constanta care definește numele bucket-ului Supabase Storage pentru imagini: `'tray_images'`

### Interfețe și Tipuri

#### `TrayImage`
Interfață care definește structura unei imagini asociate unei tăvițe.

**Proprietăți**:
- `id: string` - ID-ul unic al înregistrării
- `tray_id: string` - ID-ul tăviței asociate
- `url: string` - URL-ul public al imaginii
- `filename: string` - Numele original al fișierului
- `file_path: string` - Calea în storage a fișierului
- `created_at: string` - Data și ora creării

### Funcții

#### `uploadTrayImage(trayId: string, file: File)`
**Tip returnat**: `Promise<{ url: string; path: string }>`

**Parametri**:
- `trayId: string` - ID-ul tăviței pentru care se încarcă imaginea
- `file: File` - Fișierul imagine de încărcat

**Descriere**:
Încarcă o imagine în Supabase Storage pentru o tăviță specifică. Creează o structură de directoare organizată pe baza ID-ului tăviței și a timestamp-ului.

**Flux de execuție**:
1. Extrage extensia fișierului din numele original
2. Generează un nume de fișier unic: `{trayId}/{timestamp}.{extensie}`
3. Încarcă fișierul în bucket-ul `tray_images` cu cache control de 3600 secunde
4. Obține URL-ul public al fișierului încărcat
5. Returnează obiectul cu `url` și `path`

**Caracteristici**:
- Organizare pe directoare bazată pe `trayId`
- Nume de fișier unic bazat pe timestamp
- Cache control pentru optimizare
- `upsert: false` - nu suprascrie fișiere existente

#### `deleteTrayImage(filePath: string)`
**Tip returnat**: `Promise<void>`

**Parametri**:
- `filePath: string` - Calea fișierului în storage de șters

**Descriere**:
Șterge o imagine din Supabase Storage folosind calea fișierului. Nu șterge automat referința din baza de date - aceasta trebuie făcută separat cu `deleteTrayImageReference`.

**Flux de execuție**:
1. Șterge fișierul din bucket-ul `tray_images` folosind `remove()`
2. Aruncă eroarea dacă operația eșuează

**Notă**: Pentru o ștergere completă, trebuie apelată și `deleteTrayImageReference()` pentru a elimina referința din baza de date.

#### `listTrayImages(trayId: string)`
**Tip returnat**: `Promise<TrayImage[]>`

**Parametri**:
- `trayId: string` - ID-ul tăviței pentru care se listează imaginile

**Descriere**:
Obține toate imaginile asociate unei tăvițe din baza de date, ordonate descrescător după data creării (cele mai recente primele).

**Flux de execuție**:
1. Interoghează tabela `tray_images` pentru toate înregistrările cu `tray_id` corespunzător
2. Selectează toate câmpurile necesare pentru `TrayImage`
3. Ordonează descrescător după `created_at`
4. Returnează array-ul de `TrayImage`

#### `saveTrayImageReference(trayId: string, url: string, filePath: string, filename: string)`
**Tip returnat**: `Promise<TrayImage>`

**Parametri**:
- `trayId: string` - ID-ul tăviței asociate
- `url: string` - URL-ul public al imaginii
- `filePath: string` - Calea în storage a fișierului
- `filename: string` - Numele original al fișierului

**Descriere**:
Salvează o referință către o imagine încărcată în tabela `tray_images` din baza de date. Această funcție trebuie apelată după `uploadTrayImage` pentru a păstra metadatele imaginii.

**Flux de execuție**:
1. Inserează o nouă înregistrare în `tray_images` cu toate datele necesare
2. Returnează înregistrarea creată folosind `.select().single()`
3. Aruncă eroarea dacă operația eșuează

**Utilizare tipică**:
```typescript
const { url, path } = await uploadTrayImage(trayId, file)
const imageRef = await saveTrayImageReference(trayId, url, path, file.name)
```

#### `deleteTrayImageReference(imageId: string)`
**Tip returnat**: `Promise<void>`

**Parametri**:
- `imageId: string` - ID-ul înregistrării din `tray_images` de șters

**Descriere**:
Șterge referința unei imagini din baza de date. Nu șterge fișierul din storage - aceasta trebuie făcută separat cu `deleteTrayImage`.

**Flux de execuție**:
1. Șterge înregistrarea din `tray_images` cu `id` corespunzător
2. Aruncă eroarea dacă operația eșuează

**Notă**: Pentru o ștergere completă, trebuie apelată și `deleteTrayImage()` pentru a elimina fișierul din storage.

---

## 5. leadOperations.ts

### Descriere Generală
Acest modul oferă operațiuni CRUD (Create, Read, Update, Delete) complete pentru lead-uri și integrare cu pipeline-urile. Include funcționalități pentru mutarea lead-urilor între pipeline-uri, atribuirea automată a tag-urilor de departament și logging de evenimente.

### Detalii Tehnice
- **Tip**: Client Component (`'use client'`)
- **Integrare**: Folosește `pipelineOperations` pentru mutarea lead-urilor
- **Automatizare**: Atribuie automat tag-uri de departament bazate pe numele pipeline-ului

### Tipuri Exportate

#### `PipelineOption`
Tip care definește opțiunile de pipeline disponibile.

**Proprietăți**:
- `id: string` - ID-ul pipeline-ului
- `name: string` - Numele pipeline-ului
- `is_active: boolean` - Dacă pipeline-ul este activ
- `active_stages: number` - Numărul de stage-uri active

#### `MoveResult`
Alias pentru `MoveItemResult` din `pipelineOperations`. Reprezintă rezultatul unei operații de mutare a unui lead într-un pipeline.

### Funcții Helper (Private)

#### `assignDepartmentTagToLead(leadId: string, pipelineName: string)`
**Tip returnat**: `Promise<void>`

**Parametri**:
- `leadId: string` - ID-ul lead-ului
- `pipelineName: string` - Numele pipeline-ului pentru determinarea tag-ului

**Descriere**:
Funcție helper privată care atribuie automat un tag de departament unui lead bazat pe numele pipeline-ului. Asigură că un lead poate avea doar un singur tag de departament la un moment dat.

**Logica de atribuire**:
- **Horeca**: Dacă numele pipeline-ului conține "HORECA"
- **Saloane**: Dacă numele conține "SALOANE" sau "SALON"
- **Frizerii**: Dacă numele conține "FRIZER" sau "BARBER"
- **Reparatii**: Dacă numele conține "REPARAT" sau "SERVICE"

**Flux de execuție**:
1. Determină tag-ul de departament bazat pe numele pipeline-ului
2. Caută tag-ul existent în baza de date sau îl creează dacă nu există
3. Verifică dacă tag-ul este deja atribuit lead-ului
4. Dacă nu este atribuit, îl atribuie
5. Elimină toate celelalte tag-uri de departament de pe lead (pentru a menține unicitatea)

**Culori tag-uri**:
- Horeca: `orange`
- Saloane: `green`
- Frizerii: `yellow`
- Reparatii: `blue`

### Funcții Publice

#### `getPipelineOptions()`
**Tip returnat**: `Promise<PipelineOption[]>`

**Descriere**:
Obține lista de pipeline-uri disponibile folosind funcția RPC `get_pipeline_options` din baza de date.

**Flux de execuție**:
1. Apelează `supabase.rpc('get_pipeline_options')`
2. Returnează array-ul de `PipelineOption` sau array gol în caz de eroare

#### `getPipelinesWithStages()`
**Tip returnat**: `Promise<{ data: PipelineWithStages[] | null; error: any }>`

**Descriere**:
Obține toate pipeline-urile active cu stage-urile lor asociate, organizate și sortate.

**Flux de execuție**:
1. Obține toate pipeline-urile active, sortate după `position`
2. Obține toate stage-urile active, sortate după `position`
3. Grupează stage-urile pe pipeline-uri
4. Returnează pipeline-urile cu stage-urile lor

**Structură returnată**:
```typescript
{
  data: [
    {
      id: string,
      name: string,
      // ... alte proprietăți pipeline
      stages: [
        { id: string, name: string, ... },
        // ...
      ]
    },
    // ...
  ],
  error: null | Error
}
```

#### `createLead(leadData: any)`
**Tip returnat**: `Promise<{ data: any | null; error: any }>`

**Parametri**:
- `leadData: any` - Datele lead-ului de creat

**Descriere**:
Creează un nou lead în baza de date.

**Flux de execuție**:
1. Inserează datele în tabela `leads`
2. Returnează lead-ul creat folosind `.select().single()`
3. Returnează eroarea dacă operația eșuează

#### `createLeadWithPipeline(leadData: any, pipelineId: string, stageId: string)`
**Tip returnat**: `Promise<{ data: { lead: any; assignment: any } | null; error: any }>`

**Parametri**:
- `leadData: any` - Datele lead-ului de creat
- `pipelineId: string` - ID-ul pipeline-ului în care să fie adăugat
- `stageId: string` - ID-ul stage-ului inițial

**Descriere**:
Creează un lead și îl adaugă automat într-un pipeline specificat, apoi atribuie automat tag-ul de departament corespunzător.

**Flux de execuție**:
1. Creează lead-ul folosind `createLead()`
2. Adaugă lead-ul în pipeline folosind `moveLeadToPipelineFn()` din `pipelineOperations`
3. Obține numele pipeline-ului din baza de date
4. Atribuie automat tag-ul de departament folosind `assignDepartmentTagToLead()`
5. Returnează lead-ul creat și assignment-ul (pipeline_item)

**Structură returnată**:
```typescript
{
  data: {
    lead: Lead,
    assignment: {
      id: string, // pipeline_item.id
      pipeline_id: string,
      stage_id: string
    }
  },
  error: null | Error
}
```

#### `moveLeadToPipeline(leadId: string, targetPipelineId: string, notes?: string)`
**Tip returnat**: `Promise<MoveResult>`

**Parametri**:
- `leadId: string` - ID-ul lead-ului de mutat
- `targetPipelineId: string` - ID-ul pipeline-ului țintă
- `notes?: string` - Note opționale pentru mutare

**Descriere**:
Mută un lead într-un pipeline nou folosind noua arhitectură cu `pipeline_items`. După mutare, atribuie automat tag-ul de departament corespunzător.

**Flux de execuție**:
1. Apelează `moveLeadToPipelineFn()` din `pipelineOperations`
2. Dacă mutarea reușește, obține numele pipeline-ului țintă
3. Atribuie automat tag-ul de departament
4. Returnează rezultatul mutării

#### `moveLeadToPipelineByName(leadId: string, targetPipelineName: string, notes?: string)`
**Tip returnat**: `Promise<MoveResult>`

**Parametri**:
- `leadId: string` - ID-ul lead-ului de mutat
- `targetPipelineName: string` - Numele pipeline-ului țintă
- `notes?: string` - Note opționale pentru mutare

**Descriere**:
Mută un lead într-un pipeline identificat după nume (nu ID). Găsește pipeline-ul activ cu numele specificat și apoi apelează `moveLeadToPipeline()`.

**Flux de execuție**:
1. Caută pipeline-ul activ cu numele specificat
2. Dacă nu găsește pipeline-ul sau nu este activ, returnează eroare
3. Apelează `moveLeadToPipeline()` cu ID-ul găsit

#### `updateLead(leadId: string, updates: any)`
**Tip returnat**: `Promise<{ data: any | null; error: any }>`

**Parametri**:
- `leadId: string` - ID-ul lead-ului de actualizat
- `updates: any` - Obiectul cu câmpurile de actualizat

**Descriere**:
Actualizează un lead existent în baza de date.

**Flux de execuție**:
1. Actualizează înregistrarea din `leads` cu `id` corespunzător
2. Returnează lead-ul actualizat folosind `.select().single()`
3. Returnează eroarea dacă operația eșuează

#### `deleteLead(leadId: string)`
**Tip returnat**: `Promise<{ success: boolean; error: any }>`

**Parametri**:
- `leadId: string` - ID-ul lead-ului de șters

**Descriere**:
Șterge un lead din baza de date.

**Flux de execuție**:
1. Șterge înregistrarea din `leads` cu `id` corespunzător
2. Returnează `{ success: true }` dacă operația reușește
3. Returnează eroarea dacă operația eșuează

#### `searchLeads(searchTerm: string)`
**Tip returnat**: `Promise<{ data: any[] | null; error: any }>`

**Parametri**:
- `searchTerm: string` - Termenul de căutare

**Descriere**:
Caută lead-uri după nume complet, email sau număr de telefon folosind matching case-insensitive.

**Flux de execuție**:
1. Caută în `full_name`, `email` și `phone_number` folosind `ilike` (case-insensitive)
2. Returnează toate lead-urile care se potrivesc
3. Returnează eroarea dacă operația eșuează

#### `updatePipelineAndStages(pipelineId: string, pipelineName: string, stages: { id: string; name: string }[])`
**Tip returnat**: `Promise<{ error: any }>`

**Parametri**:
- `pipelineId: string` - ID-ul pipeline-ului de actualizat
- `pipelineName: string` - Numele nou al pipeline-ului (sau null pentru a nu schimba)
- `stages: { id: string; name: string }[]` - Array-ul de stage-uri în ordinea finală

**Descriere**:
Actualizează numele unui pipeline și reordonează stage-urile folosind funcția RPC `update_pipeline_and_reorder_stages`.

**Flux de execuție**:
1. Mapează stage-urile la formatul necesar cu `position` bazat pe index
2. Apelează RPC-ul `update_pipeline_and_reorder_stages` cu datele procesate
3. Returnează eroarea dacă există

**Notă**: Dacă `pipelineName` este `null`, numele pipeline-ului nu se schimbă.

#### `logItemEvent(itemType: 'lead' | 'service_file' | 'tray', itemId: string, message: string, eventType?: string, payload?: Record<string, any>)`
**Tip returnat**: `Promise<any>`

**Parametri**:
- `itemType: 'lead' | 'service_file' | 'tray'` - Tipul item-ului pentru care se loghează evenimentul
- `itemId: string` - ID-ul item-ului
- `message: string` - Mesajul evenimentului
- `eventType?: string` - Tipul evenimentului (implicit: 'message')
- `payload?: Record<string, any>` - Date suplimentare opționale

**Descriere**:
Loghează un eveniment generic pentru un item (lead, service_file sau tray) în tabelul polimorf `items_events`. Obține automat informații despre actor (utilizatorul curent).

**Flux de execuție**:
1. Obține utilizatorul curent folosind `supabase.auth.getUser()`
2. Încearcă să obțină numele actorului din `app_members` sau `user_metadata`
3. Inserează evenimentul în `items_events` cu toate datele
4. Returnează evenimentul creat

**Structură eveniment**:
```typescript
{
  type: 'lead' | 'service_file' | 'tray',
  item_id: string,
  event_type: string,
  message: string,
  payload: Record<string, any>,
  actor_id: string | null,
  actor_name: string | null
}
```

#### `logLeadEvent(leadId: string, message: string, eventType?: string, payload?: Record<string, any>)`
**Tip returnat**: `Promise<any>`

**Parametri**:
- `leadId: string` - ID-ul lead-ului
- `message: string` - Mesajul evenimentului
- `eventType?: string` - Tipul evenimentului (implicit: 'message')
- `payload?: Record<string, any>` - Date suplimentare opționale

**Descriere**:
Wrapper specializat pentru `logItemEvent` care loghează evenimente specifice pentru lead-uri.

**Flux de execuție**:
1. Apelează `logItemEvent()` cu `itemType: 'lead'`

---

## 6. optimized-queries.ts

### Descriere Generală
Acest modul conține query-uri optimizate pentru Supabase, implementând principii de performanță precum select minimal, paginare, caching-friendly queries și batch queries în paralel. Este proiectat pentru a minimiza numărul de apeluri la baza de date și a maximiza eficiența.

### Detalii Tehnice
- **Tip**: Client Component (`'use client'`)
- **Principii**: Select minimal, paginare, batch queries, cache-friendly
- **Optimizări**: Folosește `Promise.all` pentru query-uri paralele

### Constante de Select

#### `LEAD_SELECT_MINIMAL`
String SQL pentru select minimal de lead-uri (doar câmpurile esențiale):
```sql
id, full_name, email, phone_number, created_at, updated_at
```

#### `LEAD_SELECT_LIST`
String SQL pentru select de lead-uri cu tags asociate:
```sql
id, full_name, email, phone_number, created_at, updated_at,
lead_tags(tag:tags(id, name, color))
```

#### `LEAD_SELECT_FULL`
String SQL pentru select complet de lead-uri cu toate relațiile:
```sql
*, lead_tags(tag:tags(id, name, color))
```

#### `TRAY_SELECT_MINIMAL`
String SQL pentru select minimal de tăvițe:
```sql
id, number, size, status, service_file_id, created_at
```

#### `TRAY_SELECT_WITH_ITEMS`
String SQL pentru select de tăvițe cu service_file și lead asociate:
```sql
id, number, size, status, service_file_id, created_at,
service_file:service_files!inner(
  id, number,
  lead:leads!inner(id, full_name)
)
```

### Interfețe

#### `PaginationOptions`
Interfață pentru opțiuni de paginare.

**Proprietăți**:
- `page?: number` - Numărul paginii (implicit: 0)
- `pageSize?: number` - Dimensiunea paginii (implicit: 50)

### Funcții

#### `getLeadsForKanban(pipelineId: string, stageId: string, options?: PaginationOptions)`
**Tip returnat**: `Promise<{ data: any[]; total: number; page: number; pageSize: number; hasMore: boolean }>`

**Parametri**:
- `pipelineId: string` - ID-ul pipeline-ului
- `stageId: string` - ID-ul stage-ului
- `options?: PaginationOptions` - Opțiuni de paginare

**Descriere**:
Obține lead-urile pentru un board Kanban specific, cu paginare și select optimizat. Folosește `pipeline_items` pentru a găsi lead-urile asociate cu un pipeline și stage specific.

**Flux de execuție**:
1. Calculează range-ul de paginare (`from`, `to`)
2. Interoghează `pipeline_items` filtrat după `pipeline_id`, `stage_id` și `item_type: 'lead'`
3. Face join cu `leads` pentru a obține datele complete
4. Ordonează după `sort_order`
5. Returnează datele cu informații de paginare

**Optimizări**:
- Select minimal cu doar câmpurile necesare
- Paginare pentru liste mari
- Count exact pentru `hasMore`

#### `getLeadById(leadId: string)`
**Tip returnat**: `Promise<any>`

**Parametri**:
- `leadId: string` - ID-ul lead-ului

**Descriere**:
Obține un lead complet cu toate relațiile (inclusiv tags) folosind `LEAD_SELECT_FULL`.

**Flux de execuție**:
1. Interoghează `leads` cu select complet
2. Returnează lead-ul cu tags asociate

#### `getTrayWithItems(trayId: string)`
**Tip returnat**: `Promise<{ tray: any; items: any[]; images: any[] }>`

**Parametri**:
- `trayId: string` - ID-ul tăviței

**Descriere**:
Obține o tăviță completă cu items-urile și imaginile asociate folosind batch queries în paralel pentru performanță maximă.

**Flux de execuție**:
1. Execută 3 query-uri în paralel folosind `Promise.all`:
   - Tray cu service_file și lead
   - Tray items cu servicii și departamente
   - Imagini asociate
2. Returnează obiectul cu toate datele

**Optimizări**:
- Batch queries în paralel
- Select optimizat cu doar câmpurile necesare
- Join-uri eficiente cu `!inner`

#### `getDashboardStats()`
**Tip returnat**: `Promise<any>`

**Descriere**:
Obține statisticile dashboard-ului folosind funcția RPC `get_dashboard_stats`, cu fallback la query-uri individuale în caz de eroare.

**Flux de execuție**:
1. Încearcă să apeleze `get_dashboard_stats` RPC
2. Dacă eșuează, execută query-uri individuale în paralel pentru:
   - Count de leads
   - Count de trays
   - Count de service_files
3. Returnează statisticile agregate

**Optimizări**:
- Preferă RPC pentru agregări complexe
- Fallback la query-uri paralele în caz de eroare
- Folosește `head: true` pentru count eficient

#### `loadStaticData()`
**Tip returnat**: `Promise<{ pipelines: any[]; stages: any[]; departments: any[]; instruments: any[]; services: any[]; technicians: any[] }>`

**Descriere**:
Încarcă toate datele statice necesare pentru inițializarea aplicației într-un singur batch. Folosit la mount pentru a popula cache-ul.

**Flux de execuție**:
1. Execută 6 query-uri în paralel folosind `Promise.all`:
   - Pipelines (sortate după `sort_order`)
   - Stages (sortate după `sort_order`)
   - Departments (sortate după `name`)
   - Instruments (doar active, sortate după `name`)
   - Services (doar active, sortate după `name`)
   - Technicians (din `app_members`, sortate după `name`)
2. Returnează toate datele într-un obiect structurat

**Optimizări**:
- Batch loading pentru reducerea numărului de round-trips
- Select optimizat cu doar câmpurile necesare
- Filtrare pentru date active (instruments, services)
- Sortare consistentă pentru UI predictibil

**Utilizare tipică**:
```typescript
const staticData = await loadStaticData()
// Populează cache-uri globale cu staticData
```

---

## 7. partOperations.ts

### Descriere Generală
Acest modul gestionează operațiunile CRUD pentru piese de schimb (parts). Oferă funcții pentru listarea, crearea și ștergerea pieselor, cu validare și autentificare pentru operațiunile de scriere.

### Detalii Tehnice
- **Tip**: Client Component (`'use client'`)
- **Autentificare**: Necesară pentru `createPart`
- **Conversie tipuri**: Prețurile sunt convertite explicit la `Number` pentru consistență

### Tipuri Exportate

#### `Part`
Tip care definește structura unei piese de schimb.

**Proprietăți**:
- `id: string` - ID-ul unic al piesei
- `name: string` - Numele piesei
- `price: number` - Prețul piesei
- `active: boolean` - Dacă piesa este activă
- `created_at: string` - Data și ora creării
- `updated_at: string` - Data și ora ultimei actualizări

### Funcții

#### `listParts()`
**Tip returnat**: `Promise<Part[]>`

**Descriere**:
Obține lista tuturor pieselor de schimb din baza de date, sortate alfabetic după nume.

**Flux de execuție**:
1. Interoghează tabela `parts` cu select optimizat
2. Ordonează după `name` crescător
3. Convertește `price` la `Number` pentru fiecare piesă
4. Returnează array-ul de `Part`

**Notă**: Prețurile sunt convertite explicit la `Number` deoarece în PostgreSQL pot fi returnate ca string-uri.

#### `createPart(input: { name: string; price: number })`
**Tip returnat**: `Promise<void>`

**Parametri**:
- `input: { name: string; price: number }` - Datele piesei de creat

**Descriere**:
Creează o nouă piesă de schimb în baza de date. Necesită autentificare pentru a înregistra utilizatorul care a creat piesa.

**Flux de execuție**:
1. Obține utilizatorul curent folosind `supabase.auth.getUser()`
2. Verifică dacă utilizatorul este autentificat
3. Inserează piesa cu:
   - `name` trimis (elimină spații)
   - `price` din input
   - `created_by` setat la ID-ul utilizatorului curent
4. Aruncă eroarea dacă operația eșuează

**Validări**:
- Verifică autentificarea utilizatorului
- Trimite numele pentru a elimina spații inutile

#### `deletePart(id: string)`
**Tip returnat**: `Promise<void>`

**Parametri**:
- `id: string` - ID-ul piesei de șters

**Descriere**:
Șterge o piesă de schimb din baza de date.

**Flux de execuție**:
1. Șterge înregistrarea din `parts` cu `id` corespunzător
2. Aruncă eroarea dacă operația eșuează

**Notă**: Nu există validare pentru dependențe (ex: dacă piesa este folosită în `tray_items`). Aceasta ar trebui gestionată la nivel de bază de date sau prin validări suplimentare.

---

## 8. pipelineOperations.ts

### Descriere Generală
Acest modul este cel mai complex și oferă logica centralizată pentru gestionarea item-urilor (leads, service files, trays) în pipeline-uri, implementând funcționalitatea board-ului Kanban. Include caching pentru optimizare, calculare de totaluri dinamice, gestionare de item-uri virtuale pentru pipeline-ul "Receptie" și logică complexă pentru mutarea item-urilor între stage-uri.

### Detalii Tehnice
- **Tip**: Client Component (`'use client'`)
- **Complexitate**: Foarte mare - conține logica principală a board-ului Kanban
- **Optimizări**: Caching pentru technicians, pipelines și stages
- **Specializări**: Logică specială pentru pipeline-ul "Receptie" și stage-uri specifice

### Cache-uri Globale

#### `technicianCache`
Map global care stochează mapping-ul între `user_id` și numele tehnicianului pentru a evita apeluri repetate la `auth.getUser()`.

**Structură**: `Map<string, string>` (user_id → nume)

#### `technicianCacheLoaded`
Flag boolean care indică dacă cache-ul de tehnicieni a fost încărcat.

#### `pipelinesCache` și `stagesCache`
Array-uri care stochează pipelines și stages pentru cache cu TTL.

#### `cacheTimestamp`
Timestamp-ul ultimei actualizări a cache-ului pentru pipelines și stages.

#### `CACHE_TTL`
Time-To-Live pentru cache-ul de pipelines și stages: `60000` ms (1 minut)

### Funcții Helper Private

#### `loadTechnicianCache()`
**Tip returnat**: `Promise<void>`

**Descriere**:
Încarcă cache-ul de tehnicieni o singură dată, obținând numele din `app_members` și mapându-le la `user_id`.

**Flux de execuție**:
1. Verifică dacă cache-ul este deja încărcat
2. Interoghează `app_members` pentru toți membrii
3. Mapează fiecare membru: `user_id → name || email.split('@')[0] || 'Necunoscut'`
4. Setează flag-ul `technicianCacheLoaded` la `true`

#### `getCachedPipelinesAndStages()`
**Tip returnat**: `Promise<{ pipelines: any[]; stages: any[] }>`

**Descriere**:
Obține pipelines și stages din cache sau din baza de date dacă cache-ul a expirat.

**Flux de execuție**:
1. Verifică dacă cache-ul este valid (în TTL)
2. Dacă este valid, returnează cache-ul
3. Dacă nu, execută query-uri paralele pentru pipelines și stages
4. Actualizează cache-ul și timestamp-ul
5. Returnează datele

### Tipuri Exportate

#### `PipelineItemType`
Type union care definește tipurile de item-uri din pipeline:
```typescript
'lead' | 'service_file' | 'tray'
```

#### `PipelineItem`
Tip care definește structura unui item din pipeline.

**Proprietăți**:
- `id: string` - ID-ul înregistrării din `pipeline_items`
- `type: PipelineItemType` - Tipul item-ului
- `item_id: string` - ID-ul item-ului real (lead/service_file/tray)
- `pipeline_id: string` - ID-ul pipeline-ului
- `stage_id: string` - ID-ul stage-ului curent
- `created_at: string` - Data creării
- `updated_at: string` - Data ultimei actualizări

#### `MoveItemResult`
Tip union care definește rezultatul unei operații de mutare.

**Variante**:
```typescript
// Succes
{
  ok: true,
  data: {
    pipeline_item_id: string,
    new_stage_id: string
  }[]
}

// Eroare
{
  ok: false,
  code?: string,
  message?: string
}
```

#### `KanbanItem`
Tip complex care definește structura unui item pentru board-ul Kanban.

**Proprietăți**:
- `id: string` - ID-ul item-ului
- `name: string` - Numele (din lead)
- `email: string` - Email-ul (din lead)
- `phone: string` - Telefonul (din lead)
- `stage: string` - Numele stage-ului
- `createdAt: string` - Data creării
- `campaignName?: string` - Numele campaniei
- `adName?: string` - Numele anunțului
- `formName?: string` - Numele formularului
- `leadId?: string` - ID-ul lead-ului asociat
- `stageId: string` - ID-ul stage-ului
- `pipelineId: string` - ID-ul pipeline-ului
- `assignmentId: string` - ID-ul `pipeline_item`
- `tags?: Tag[]` - Tag-urile asociate lead-ului
- `stageMovedAt?: string` - Data mutării în stage-ul curent
- `technician?: string | null` - Numele tehnicianului (pentru trays)
- `type: 'lead' | 'service_file' | 'tray'` - Tipul item-ului
- `serviceFileNumber?: string` - Numărul fișei de serviciu (pentru service_file)
- `serviceFileStatus?: string` - Statusul fișei (pentru service_file)
- `trayNumber?: string` - Numărul tăviței (pentru tray)
- `traySize?: string` - Dimensiunea tăviței (pentru tray)
- `trayStatus?: string` - Statusul tăviței (pentru tray)
- `total?: number` - Totalul calculat (suma tăvițelor pentru leads/service_files, totalul pentru trays)
- `isReadOnly?: boolean` - Flag pentru item-uri non-draggable (ex: service_files virtuale din Receptie)
- `inLucruSince?: string` - Timestamp pentru când a intrat în "IN LUCRU"
- `inAsteptareSince?: string` - Timestamp pentru când a intrat în "IN ASTEPTARE"

### Funcții Principale

#### `addLeadToPipeline(leadId: string, pipelineId: string, stageId: string)`
**Tip returnat**: `Promise<{ data: PipelineItem | null; error: any }>`

**Descriere**:
Creează o intrare în `pipeline_items` pentru un lead. Dacă există deja o intrare pentru acest lead în acest pipeline, actualizează stage-ul.

**Flux de execuție**:
1. Verifică dacă există deja o intrare pentru lead în pipeline
2. Dacă există, actualizează `stage_id` și `updated_at`
3. Dacă nu există, creează o nouă intrare
4. Returnează `PipelineItem` creat sau actualizat

#### `addServiceFileToPipeline(serviceFileId: string, pipelineId: string, stageId: string)`
**Tip returnat**: `Promise<{ data: PipelineItem | null; error: any }>`

**Descriere**:
Similar cu `addLeadToPipeline`, dar pentru service files.

#### `addTrayToPipeline(trayId: string, pipelineId: string, stageId: string)`
**Tip returnat**: `Promise<{ data: PipelineItem | null; error: any }>`

**Descriere**:
Similar cu `addLeadToPipeline`, dar pentru trays.

#### `moveItemToStage(type: PipelineItemType, itemId: string, pipelineId: string, newStageId: string, fromStageId?: string)`
**Tip returnat**: `Promise<{ data: PipelineItem | null; error: any }>`

**Descriere**:
Mută un item într-un alt stage din același pipeline. Include logică pentru detectarea stage-urilor "IN LUCRU" și "IN ASTEPTARE" (pentru viitoare tracking de timp).

**Flux de execuție**:
1. Găsește `pipeline_item` existent pentru item
2. Verifică dacă noul stage este "IN LUCRU" sau "IN ASTEPTARE"
3. Actualizează `stage_id` și `updated_at`
4. Returnează `PipelineItem` actualizat

**Notă**: Codul conține TODO-uri pentru adăugarea câmpurilor `in_lucru_since` și `in_asteptare_since` în `pipeline_items` pentru tracking de timp.

#### `getPipelineItems(pipelineId: string, stageId?: string, type?: PipelineItemType)`
**Tip returnat**: `Promise<{ data: PipelineItem[]; error: any }>`

**Descriere**:
Obține toate item-urile dintr-un pipeline, opțional filtrate după stage și/sau tip.

#### `getPipelineItemForItem(type: PipelineItemType, itemId: string, pipelineId: string)`
**Tip returnat**: `Promise<{ data: PipelineItem | null; error: any }>`

**Descriere**:
Obține `pipeline_item` pentru un item specific.

#### `removeItemFromPipeline(type: PipelineItemType, itemId: string, pipelineId: string)`
**Tip returnat**: `Promise<{ success: boolean; error: any }>`

**Descriere**:
Șterge un item dintr-un pipeline (elimină `pipeline_item`).

#### `getFirstActiveStage(pipelineId: string)`
**Tip returnat**: `Promise<{ id: string } | null>`

**Descriere**:
Helper privat care obține primul stage activ dintr-un pipeline, sortat după `position`.

#### `moveLeadToPipeline(leadId: string, targetPipelineId: string, targetStageId?: string, notes?: string)`
**Tip returnat**: `Promise<MoveItemResult>`

**Descriere**:
Mută un lead într-un pipeline nou. Dacă nu este specificat `targetStageId`, folosește primul stage activ.

**Flux de execuție**:
1. Obține `targetStageId` (sau primul stage activ)
2. Apelează `addLeadToPipeline()`
3. Returnează `MoveItemResult` cu rezultatul

#### `moveServiceFileToPipeline(serviceFileId: string, targetPipelineId: string, targetStageId?: string, notes?: string)`
**Tip returnat**: `Promise<MoveItemResult>`

**Descriere**:
Similar cu `moveLeadToPipeline`, dar pentru service files.

#### `moveTrayToPipeline(trayId: string, targetPipelineId: string, targetStageId?: string, notes?: string)`
**Tip returnat**: `Promise<MoveItemResult>`

**Descriere**:
Similar cu `moveLeadToPipeline`, dar pentru trays.

#### `getKanbanItems(pipelineId?: string)`
**Tip returnat**: `Promise<{ data: KanbanItem[]; error: any }>`

**Descriere**:
**FUNCȚIA PRINCIPALĂ** - Obține toate item-urile Kanban pentru un pipeline. Această funcție este extrem de complexă și optimizată, gestionând:
- Item-uri virtuale pentru pipeline-ul "Receptie"
- Calcularea totalurilor dinamice pentru leads/service_files/trays
- Mapping-ul de tehnicieni
- Gestionarea item-urilor read-only
- Logică specială pentru stage-uri specifice

**Flux de execuție (simplificat)**:
1. Încarcă cache-uri (technicians, pipelines, stages) în paralel
2. Obține toate `pipeline_items` pentru pipeline
3. **LOGICĂ SPECIALĂ RECEPTIE**: Dacă este pipeline "Receptie":
   - Găsește tăvițe din pipeline-urile departamentelor (Saloane, Horeca, Frizerii, Reparatii)
   - Determină stage-ul din Receptie bazat pe status-ul tăvițelor
   - Creează service_files virtuale pentru aceste tăvițe
4. Grupează item-urile după tip (lead/service_file/tray)
5. Obține datele pentru fiecare tip în paralel
6. Obține tags și tray_items în paralel
7. Calculează totalurile pentru trays (cu discount, urgent, subscription)
8. Calculează totalurile pentru leads și service_files (suma tuturor tăvițelor)
9. Mapăază tehnicienii folosind cache-ul
10. **LOGICĂ SPECIALĂ STAGE-URI**: Adaugă tăvițe din stage-uri specifice ("In asteptare" din Saloane/Frizerii/Horeca, "Astept piese" din Reparatii) în stage-ul "In asteptare" al pipeline-ului curent
11. Construiește și returnează array-ul de `KanbanItem`

**Optimizări**:
- Batch queries în paralel cu `Promise.all`
- Cache pentru technicians, pipelines, stages
- Calculare eficientă de totaluri
- Select minimal cu doar câmpurile necesare

**Complexitate**: Foarte mare - peste 1600 de linii de cod

#### `getSingleKanbanItem(type: PipelineItemType, itemId: string, pipelineId: string)`
**Tip returnat**: `Promise<{ data: KanbanItem | null; error: any }>`

**Descriere**:
Obține un singur item Kanban (pentru actualizări incrementale). Similar cu `getKanbanItems`, dar pentru un singur item.

#### `getKanbanItemsByType(type: PipelineItemType, pipelineId?: string)`
**Tip returnat**: `Promise<{ data: KanbanItem[]; error: any }>`

**Descriere**:
Obține item-urile Kanban filtrate după tip. Apelează `getKanbanItems` și filtrează rezultatul.

---

## 9. serviceFileOperations.ts

### Descriere Generală
Acest modul gestionează operațiunile CRUD pentru fișe de serviciu (service files), tăvițe (trays) și item-uri de tăviță (tray items). Include gestionarea explicită a scenariilor unde Row-Level Security (RLS) ar putea bloca join-urile directe, oferind un mecanism de fallback.

### Detalii Tehnice
- **Tip**: Client Component (`'use client'`)
- **RLS Handling**: Include fallback pentru cazuri când RLS blochează join-uri
- **Tipuri**: Definește tipuri TypeScript pentru ServiceFile, Tray și TrayItem

### Tipuri Exportate

#### `ServiceFile`
Tip care definește structura unei fișe de serviciu.

**Proprietăți**:
- `id: string` - ID-ul unic al fișei
- `lead_id: string` - ID-ul lead-ului asociat
- `number: string` - Numărul fișei
- `date: string` - Data fișei
- `status: 'noua' | 'in_lucru' | 'finalizata'` - Statusul fișei
- `notes: string | null` - Note suplimentare
- `office_direct: boolean` - Checkbox pentru "Office direct"
- `curier_trimis: boolean` - Checkbox pentru "Curier Trimis"
- `created_at: string` - Data creării
- `updated_at: string` - Data ultimei actualizări

#### `Tray`
Tip care definește structura unei tăvițe.

**Proprietăți**:
- `id: string` - ID-ul unic al tăviței
- `number: string` - Numărul tăviței
- `size: string` - Dimensiunea tăviței
- `service_file_id: string` - ID-ul fișei de serviciu asociate
- `status: 'in_receptie' | 'in_lucru' | 'gata'` - Statusul tăviței
- `urgent: boolean` - Flag pentru tăvițe urgente
- `created_at: string` - Data creării

#### `TrayItem`
Tip care definește structura unui item dintr-o tăviță.

**Proprietăți**:
- `id: string` - ID-ul unic al item-ului
- `tray_id: string` - ID-ul tăviței asociate
- `department_id: string | null` - ID-ul departamentului
- `instrument_id: string | null` - ID-ul instrumentului
- `service_id: string | null` - ID-ul serviciului
- `part_id: string | null` - ID-ul piesei de schimb
- `technician_id: string | null` - ID-ul tehnicianului
- `qty: number` - Cantitatea
- `notes: string | null` - Note (poate conține JSON cu date suplimentare)
- `pipeline: string | null` - Pipeline-ul asociat
- `service?: { id: string; name: string; price: number } | null` - Date despre serviciu (joined)

### Funcții pentru Service Files

#### `createServiceFile(data: {...})`
**Tip returnat**: `Promise<{ data: ServiceFile | null; error: any }>`

**Descriere**:
Creează o nouă fișă de serviciu.

**Parametri**:
- `lead_id: string` - ID-ul lead-ului
- `number: string` - Numărul fișei
- `date: string` - Data fișei
- `status?: 'noua' | 'in_lucru' | 'finalizata'` - Status (implicit: 'noua')
- `notes?: string | null` - Note
- `office_direct?: boolean` - Office direct (implicit: false)
- `curier_trimis?: boolean` - Curier trimis (implicit: false)

#### `getServiceFile(serviceFileId: string)`
**Tip returnat**: `Promise<{ data: ServiceFile | null; error: any }>`

**Descriere**:
Obține o fișă de serviciu după ID.

#### `listServiceFilesForLead(leadId: string)`
**Tip returnat**: `Promise<{ data: ServiceFile[]; error: any }>`

**Descriere**:
Obține toate fișele de serviciu pentru un lead, ordonate descrescător după data creării.

#### `updateServiceFile(serviceFileId: string, updates: Partial<...>)`
**Tip returnat**: `Promise<{ data: ServiceFile | null; error: any }>`

**Descriere**:
Actualizează o fișă de serviciu. Actualizează automat `updated_at`.

#### `deleteServiceFile(serviceFileId: string)`
**Tip returnat**: `Promise<{ success: boolean; error: any }>`

**Descriere**:
Șterge o fișă de serviciu.

### Funcții pentru Trays

#### `createTray(data: {...})`
**Tip returnat**: `Promise<{ data: Tray | null; error: any }>`

**Descriere**:
Creează o nouă tăviță.

**Parametri**:
- `number: string` - Numărul tăviței
- `size: string` - Dimensiunea
- `service_file_id: string` - ID-ul fișei de serviciu
- `status?: 'in_receptie' | 'in_lucru' | 'gata'` - Status (implicit: 'in_receptie')

#### `getTray(trayId: string)`
**Tip returnat**: `Promise<{ data: Tray | null; error: any }>`

**Descriere**:
Obține o tăviță după ID.

#### `listTraysForServiceFile(serviceFileId: string)`
**Tip returnat**: `Promise<{ data: Tray[]; error: any }>`

**Descriere**:
Obține toate tăvițele pentru o fișă de serviciu, ordonate crescător după data creării.

#### `updateTray(trayId: string, updates: Partial<Pick<Tray, 'number' | 'size' | 'status' | 'urgent'>>)`
**Tip returnat**: `Promise<{ data: Tray | null; error: any }>`

**Descriere**:
Actualizează o tăviță. Dacă nu există actualizări, returnează tăvița existentă.

#### `deleteTray(trayId: string)`
**Tip returnat**: `Promise<{ success: boolean; error: any }>`

**Descriere**:
Șterge o tăviță.

### Funcții pentru Tray Items

#### `createTrayItem(data: {...})`
**Tip returnat**: `Promise<{ data: TrayItem | null; error: any }>`

**Descriere**:
Creează un nou item într-o tăviță.

**Parametri**:
- `tray_id: string` - ID-ul tăviței
- `department_id?: string | null` - ID-ul departamentului
- `instrument_id?: string | null` - ID-ul instrumentului
- `service_id?: string | null` - ID-ul serviciului
- `part_id?: string | null` - ID-ul piesei
- `technician_id?: string | null` - ID-ul tehnicianului
- `qty: number` - Cantitatea
- `notes?: string | null` - Note (poate fi JSON)
- `pipeline?: string | null` - Pipeline-ul

#### `getTrayItem(trayItemId: string)`
**Tip returnat**: `Promise<{ data: TrayItem | null; error: any }>`

**Descriere**:
Obține un item de tăviță după ID.

#### `listTrayItemsForTray(trayId: string)`
**Tip returnat**: `Promise<{ data: TrayItem[]; error: any }>`

**Descriere**:
Obține toate item-urile pentru o tăviță, cu join la `services` pentru a obține numele și prețul serviciului.

**Caracteristici speciale**:
- Include fallback pentru cazuri când RLS blochează join-ul cu `services`
- Dacă join-ul eșuează, încarcă serviciile separat și le adaugă manual la items
- Logging detaliat pentru debugging

**Flux de execuție**:
1. Interoghează `tray_items` cu join la `services`
2. Verifică dacă există items cu `service_id` dar fără `service` (RLS block)
3. Dacă da, încarcă serviciile separat și le mapează manual
4. Returnează items cu serviciile asociate

#### `updateTrayItem(trayItemId: string, updates: Partial<...>)`
**Tip returnat**: `Promise<{ data: TrayItem | null; error: any }>`

**Descriere**:
Actualizează un item de tăviță.

#### `deleteTrayItem(trayItemId: string)`
**Tip returnat**: `Promise<{ success: boolean; error: any }>`

**Descriere**:
Șterge un item de tăviță.

---

## 10. serviceOperations.ts

### Descriere Generală
Acest modul gestionează operațiunile CRUD pentru servicii. Oferă funcții pentru listarea, crearea și ștergerea serviciilor, cu validare și autentificare pentru operațiunile de scriere.

### Detalii Tehnice
- **Tip**: Client Component (`'use client'`)
- **Autentificare**: Necesară pentru `createService`
- **Conversie tipuri**: Prețurile sunt convertite explicit la `Number` pentru consistență

### Tipuri Exportate

#### `Service`
Tip care definește structura unui serviciu.

**Proprietăți**:
- `id: string` - ID-ul unic al serviciului
- `name: string` - Numele serviciului
- `price: number` - Prețul serviciului
- `instrument_id: string | null` - ID-ul instrumentului asociat
- `department_id: string | null` - ID-ul departamentului asociat
- `time: string | null` - Timpul estimat pentru serviciu
- `active: boolean` - Dacă serviciul este activ
- `created_at: string` - Data creării
- `updated_at: string` - Data ultimei actualizări

### Funcții

#### `listServices()`
**Tip returnat**: `Promise<Service[]>`

**Descriere**:
Obține lista tuturor serviciilor din baza de date, sortate alfabetic după nume.

**Flux de execuție**:
1. Interoghează tabela `services` cu select optimizat
2. Ordonează după `name` crescător
3. Convertește `price` la `Number` pentru fiecare serviciu
4. Setează `instrument_id` și `department_id` la `null` dacă sunt `undefined`
5. Returnează array-ul de `Service`

**Notă**: Prețurile sunt convertite explicit la `Number` deoarece în PostgreSQL pot fi returnate ca string-uri.

#### `createService(input: { name: string; price: number })`
**Tip returnat**: `Promise<void>`

**Parametri**:
- `input: { name: string; price: number }` - Datele serviciului de creat

**Descriere**:
Creează un nou serviciu în baza de date. Necesită autentificare pentru a înregistra utilizatorul care a creat serviciul.

**Flux de execuție**:
1. Obține utilizatorul curent folosind `supabase.auth.getUser()`
2. Verifică dacă utilizatorul este autentificat
3. Inserează serviciul cu:
   - `name` trimis (elimină spații)
   - `price` din input
   - `created_by` setat la ID-ul utilizatorului curent
4. Aruncă eroarea dacă operația eșuează

**Validări**:
- Verifică autentificarea utilizatorului
- Trimite numele pentru a elimina spații inutile

**Notă**: `created_by` nu are default în SQL, deci trebuie inclus explicit.

#### `deleteService(id: string)`
**Tip returnat**: `Promise<void>`

**Parametri**:
- `id: string` - ID-ul serviciului de șters

**Descriere**:
Șterge un serviciu din baza de date.

**Flux de execuție**:
1. Șterge înregistrarea din `services` cu `id` corespunzător
2. Aruncă eroarea dacă operația eșuează

**Notă**: Nu există validare pentru dependențe (ex: dacă serviciul este folosit în `tray_items`). Aceasta ar trebui gestionată la nivel de bază de date sau prin validări suplimentare.

---

## 11. tagOperations.ts

### Descriere Generală
Acest modul gestionează operațiunile CRUD pentru tag-uri și asocierea lor cu lead-uri. Oferă funcții pentru listarea, crearea, actualizarea și ștergerea tag-urilor, precum și pentru asocierea/dezasocierea tag-urilor cu lead-uri.

### Detalii Tehnice
- **Tip**: Client Component (`'use client'`)
- **Funcționalități**: Toggle pentru asocierea tag-urilor, tag special "PINNED"

### Tipuri Exportate

#### `TagColor`
Type union care definește culorile disponibile pentru tag-uri:
```typescript
'green' | 'yellow' | 'red' | 'orange' | 'blue'
```

#### `Tag`
Tip care definește structura unui tag.

**Proprietăți**:
- `id: string` - ID-ul unic al tag-ului
- `name: string` - Numele tag-ului
- `color: TagColor` - Culoarea tag-ului

### Funcții

#### `listTags()`
**Tip returnat**: `Promise<Tag[]>`

**Descriere**:
Obține lista tuturor tag-urilor din baza de date, sortate alfabetic după nume.

**Flux de execuție**:
1. Interoghează tabela `tags` cu select optimizat (doar `id`, `name`, `color`)
2. Ordonează după `name` crescător
3. Returnează array-ul de `Tag`

**Utilizare**: Folosit în pagina de configurare (admin) pentru gestionarea tag-urilor.

#### `toggleLeadTag(leadId: string, tagId: string)`
**Tip returnat**: `Promise<{ removed: true } | { added: true }>`

**Parametri**:
- `leadId: string` - ID-ul lead-ului
- `tagId: string` - ID-ul tag-ului

**Descriere**:
Asociază sau dezasociază un tag cu un lead. Dacă tag-ul este deja asociat, îl elimină; dacă nu este asociat, îl adaugă.

**Flux de execuție**:
1. Verifică dacă există deja asocierea în `lead_tags`
2. Dacă există, șterge asocierea și returnează `{ removed: true }`
3. Dacă nu există, creează asocierea și returnează `{ added: true }`

**Utilizare**: Folosit pentru toggle-ul tag-urilor pe cardurile de lead din UI.

#### `createTag(name: string, color: TagColor)`
**Tip returnat**: `Promise<Tag>`

**Parametri**:
- `name: string` - Numele tag-ului
- `color: TagColor` - Culoarea tag-ului

**Descriere**:
Creează un nou tag în baza de date.

**Flux de execuție**:
1. Inserează tag-ul în tabela `tags` cu `name` și `color`
2. Returnează tag-ul creat folosind `.select().single()`
3. Aruncă eroarea dacă operația eșuează

#### `deleteTag(tagId: string)`
**Tip returnat**: `Promise<void>`

**Parametri**:
- `tagId: string` - ID-ul tag-ului de șters

**Descriere**:
Șterge un tag din baza de date.

**Flux de execuție**:
1. Șterge înregistrarea din `tags` cu `id` corespunzător
2. Aruncă eroarea dacă operația eșuează

**Notă**: Nu există validare pentru dependențe (ex: dacă tag-ul este asociat cu lead-uri). Aceasta ar trebui gestionată la nivel de bază de date sau prin validări suplimentare.

#### `updateTag(tagId: string, patch: Partial<Pick<Tag, 'name' | 'color'>>)`
**Tip returnat**: `Promise<Tag>`

**Parametri**:
- `tagId: string` - ID-ul tag-ului de actualizat
- `patch: Partial<Pick<Tag, 'name' | 'color'>>` - Obiectul cu câmpurile de actualizat

**Descriere**:
Actualizează un tag existent. Permite actualizarea doar a `name` și/sau `color`.

**Flux de execuție**:
1. Construiește obiectul de actualizare doar cu câmpurile specificate
2. Actualizează tag-ul în baza de date
3. Returnează tag-ul actualizat folosind `.select().single()`
4. Aruncă eroarea dacă operația eșuează

#### `getOrCreatePinnedTag()`
**Tip returnat**: `Promise<Tag>`

**Descriere**:
Găsește sau creează tag-ul special "PINNED" dacă nu există. Acest tag este folosit pentru a marca lead-urile importante.

**Flux de execuție**:
1. Caută tag-ul "PINNED" în baza de date
2. Dacă există, îl returnează
3. Dacă nu există, îl creează cu culoarea `'blue'` și îl returnează

**Utilizare**: Folosit pentru a asigura existența tag-ului "PINNED" în aplicație, care este necesar pentru funcționalitatea de pinning a lead-urilor.

---

## 12. technicianOperations.ts

### Descriere Generală
Acest modul gestionează operațiunile CRUD pentru tehnicieni. Oferă funcții pentru listarea, crearea și ștergerea tehnicienilor, cu validare și autentificare pentru operațiunile de scriere.

### Detalii Tehnice
- **Tip**: Client Component (`'use client'`)
- **Autentificare**: Necesară pentru `createTechnician`
- **Tabel**: `technicians`

### Tipuri Exportate

#### `Technician`
Tip care definește structura unui tehnician.

**Proprietăți**:
- `id: string` - ID-ul unic al tehnicianului
- `name: string` - Numele tehnicianului
- `active: boolean` - Dacă tehnicianul este activ
- `created_at: string` - Data creării
- `updated_at: string` - Data ultimei actualizări

### Funcții

#### `listTechnicians()`
**Tip returnat**: `Promise<Technician[]>`

**Descriere**:
Obține lista tuturor tehnicienilor din baza de date, sortate alfabetic după nume.

**Flux de execuție**:
1. Interoghează tabela `technicians` cu select optimizat
2. Ordonează după `name` crescător
3. Returnează array-ul de `Technician`

#### `createTechnician(name: string)`
**Tip returnat**: `Promise<void>`

**Parametri**:
- `name: string` - Numele tehnicianului

**Descriere**:
Creează un nou tehnician în baza de date. Necesită autentificare pentru a înregistra utilizatorul care a creat tehnicianul.

**Flux de execuție**:
1. Obține utilizatorul curent folosind `supabase.auth.getUser()`
2. Verifică dacă utilizatorul este autentificat
3. Inserează tehnicianul cu:
   - `name` trimis (elimină spații)
   - `created_by` setat la ID-ul utilizatorului curent
4. Aruncă eroarea dacă operația eșuează

**Validări**:
- Verifică autentificarea utilizatorului
- Trimite numele pentru a elimina spații inutile

#### `deleteTechnician(id: string)`
**Tip returnat**: `Promise<void>`

**Parametri**:
- `id: string` - ID-ul tehnicianului de șters

**Descriere**:
Șterge un tehnician din baza de date.

**Flux de execuție**:
1. Șterge înregistrarea din `technicians` cu `id` corespunzător
2. Aruncă eroarea dacă operația eșuează

**Notă**: Nu există validare pentru dependențe (ex: dacă tehnicianul este asociat cu `tray_items`). Aceasta ar trebui gestionată la nivel de bază de date sau prin validări suplimentare.

---

## Concluzie

Acest director `lib/supabase/` oferă o arhitectură completă și bine organizată pentru gestionarea tuturor operațiunilor legate de baza de date Supabase în aplicația CRM. Fiecare modul este specializat pe un domeniu specific și oferă funcții optimizate și tip-safe pentru interacțiunea cu baza de date.

### Principii de Design Observate:

1. **Separația responsabilităților**: Fiecare modul gestionează un domeniu specific
2. **Type Safety**: Toate funcțiile folosesc TypeScript cu tipuri bine definite
3. **Optimizare**: Query-uri optimizate, caching, batch operations
4. **Error Handling**: Toate funcțiile gestionează erorile în mod consistent
5. **Autentificare**: Operațiunile de scriere necesită autentificare
6. **Consistență**: Pattern-uri consistente în toate modulele

### Module Cheie:

- **supabaseClient.ts** și **server.ts**: Instanțe singleton pentru client și server
- **pipelineOperations.ts**: Logica complexă a board-ului Kanban
- **optimized-queries.ts**: Query-uri optimizate pentru performanță
- **leadOperations.ts**: Operațiuni complete pentru lead-uri cu integrare pipeline
- **serviceFileOperations.ts**: Gestionarea fișelor de serviciu, tăvițelor și item-urilor

Această documentație oferă o înțelegere completă a fiecărui modul și funcție, facilitând mentenanța și extinderea aplicației în viitor.


