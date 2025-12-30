# Secvențe de cod pentru atribuirea card-urilor în stage-uri

## 1. Mutarea fișei în pipeline (preturi.tsx)

```typescript
// Linia 904-943 din components/preturi.tsx
async function handleDeliveryCheckboxChange(isOfficeDirect: boolean) {
  if (!fisaId || pipelinesWithIds.length === 0) return

  try {
    // 1. Găsește pipeline-ul corespunzător
    const targetPipelineName = isOfficeDirect ? 'receptie' : 'curier'
    const pipeline = pipelinesWithIds.find(p => p.name.toLowerCase().includes(targetPipelineName))
    
    // 2. Obține stage-urile pentru pipeline-ul țintă
    const { data: pipelinesData } = await getPipelinesWithStages()
    const pipelineData = pipelinesData?.find((p: any) => p.id === pipeline.id)
    
    // 3. Caută stage-ul după nume
    const stageSearchTerms = isOfficeDirect 
      ? ['office', 'direct']      // Pentru "Office Direct"
      : ['curier', 'trimis']       // Pentru "Curier Trimis"
    
    let stage = pipelineData.stages.find((s: any) => {
      if (s.is_active === false) return false
      const name = s.name.toLowerCase()
      // Verifică că toate termenii sunt prezenți în numele stage-ului
      return stageSearchTerms.every(term => name.includes(term))
    })

    // 4. Dacă nu găsește stage-ul specific, folosește primul stage activ
    if (!stage) {
      stage = pipelineData.stages.find((s: any) => s.is_active !== false)
    }
    
    // 5. Mută fișa în pipeline-ul și stage-ul găsit
    const result = await moveServiceFileToPipeline(fisaId, pipeline.id, stage.id)
  }
}
```

**Observații:**
- Pentru "Office Direct": caută stage-uri care conțin "office" ȘI "direct"
- Pentru "Curier Trimis": caută stage-uri care conțin "curier" ȘI "trimis"
- Dacă nu găsește, folosește primul stage activ (de aceea apare în "MESSENGER")

---

## 2. Crearea/Actualizarea pipeline_item (pipelineOperations.ts)

```typescript
// Linia 47-98 din lib/supabase/pipelineOperations.ts
async function addItemToPipeline(
  type: 'lead' | 'service_file' | 'tray',
  itemId: string,
  pipelineId: string,
  stageId: string  // <-- Stage-ul în care se plasează card-ul
): Promise<{ data: any | null; error: any }> {
  const supabase = supabaseBrowser()
  
  // Verifică dacă item-ul există deja în acest pipeline
  const { data: existing } = await supabase
    .from('pipeline_items')
    .select('*')
    .eq('type', type)
    .eq('item_id', itemId)
    .eq('pipeline_id', pipelineId)
    .maybeSingle()

  if (existing) {
    // Actualizează stage-ul existent
    const { data, error } = await supabase
      .from('pipeline_items')
      .update({
        stage_id: stageId,  // <-- Stage-ul în care apare card-ul
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()
  } else {
    // Creează un nou pipeline_item
    const { data, error } = await supabase
      .from('pipeline_items')
      .insert([{
        type,
        item_id: itemId,
        pipeline_id: pipelineId,
        stage_id: stageId,  // <-- Stage-ul în care apare card-ul
      }])
      .select()
      .single()
  }
}
```

**Observații:**
- `stage_id` determină în ce stage apare card-ul
- Dacă item-ul există deja, se actualizează doar `stage_id`
- Dacă nu există, se creează un nou `pipeline_item` cu `stage_id`

---

## 3. Încărcarea pipeline_items cu informații despre stage (fetchers.ts)

```typescript
// Linia 29-44 din lib/supabase/kanban/fetchers.ts
export async function fetchPipelineItems(
  pipelineId: string
): Promise<{ data: PipelineItemWithStage[]; error: any }> {
  const supabase = supabaseBrowser()
  
  const { data, error } = await supabase
    .from('pipeline_items')
    .select(`
      id, type, item_id, pipeline_id, stage_id, created_at, updated_at,
      stage:stages(id, name)  // <-- Join cu tabelul stages pentru a obține numele stage-ului
    `)
    .eq('pipeline_id', pipelineId)
  
  return { data: (data || []) as PipelineItemWithStage[], error: null }
}
```

**Observații:**
- Query-ul face JOIN cu `stages` pentru a obține `stage.name`
- `stage_id` este folosit pentru JOIN
- Rezultatul conține `stage: { id, name }` pentru fiecare `pipeline_item`

---

## 4. Transformarea în KanbanItem pentru afișare (transformers.ts)

```typescript
// Linia 83-120 din lib/supabase/kanban/transformers.ts
export function transformServiceFileToKanbanItem(
  serviceFile: RawServiceFile,
  pipelineItem: PipelineItemWithStage,  // <-- Conține stage: { id, name }
  tags: KanbanTag[] = [],
  total: number = 0,
  isReadOnly: boolean = false
): KanbanItem {
  const lead = serviceFile.lead
  
  return {
    id: serviceFile.id,
    name: lead?.full_name || 'Unknown',
    stage: pipelineItem.stage?.name || '',  // <-- Numele stage-ului pentru afișare
    stageId: pipelineItem.stage_id,         // <-- ID-ul stage-ului
    pipelineId: pipelineItem.pipeline_id,
    // ... alte câmpuri
  }
}
```

**Observații:**
- `pipelineItem.stage?.name` este folosit pentru a afișa card-ul în stage-ul corect
- Dacă `stage` este null, se folosește string gol
- `stageId` este folosit pentru a identifica stage-ul în UI

---

## 5. Verificare denumiri stage-uri

Pentru a verifica dacă denumirile stage-urilor corespund, rulează aceste query-uri SQL:

```sql
-- Stage-uri din Curier
SELECT s.id, s.name, s.is_active
FROM stages s
JOIN pipelines p ON s.pipeline_id = p.id
WHERE p.name ILIKE '%curier%'
ORDER BY s.name;

-- Stage-uri din Receptie
SELECT s.id, s.name, s.is_active
FROM stages s
JOIN pipelines p ON s.pipeline_id = p.id
WHERE p.name ILIKE '%receptie%'
ORDER BY s.name;

-- Verifică dacă există stage-ul "OFFICE DIRECT" în Receptie
SELECT s.id, s.name, p.name as pipeline_name
FROM stages s
JOIN pipelines p ON s.pipeline_id = p.id
WHERE p.name ILIKE '%receptie%'
  AND s.name ILIKE '%office%direct%';

-- Verifică dacă există stage-ul "CURIER TRIMIS" în Curier
SELECT s.id, s.name, p.name as pipeline_name
FROM stages s
JOIN pipelines p ON s.pipeline_id = p.id
WHERE p.name ILIKE '%curier%'
  AND s.name ILIKE '%curier%trimis%';
```

---

## Probleme posibile și soluții

### Problema 1: Card-ul apare în "MESSENGER" în loc de "OFFICE DIRECT"
**Cauză:** Stage-ul "OFFICE DIRECT" nu există în Receptie sau nu este găsit corect
**Soluție:** 
- Verifică dacă există stage-ul "OFFICE DIRECT" în Receptie (query SQL de mai sus)
- Dacă nu există, creează-l sau mută-l din Curier în Receptie

### Problema 2: Card-ul nu apare deloc
**Cauză:** 
- `pipeline_item` nu a fost creat corect
- `stage_id` este null sau invalid
- Query-ul de încărcare nu găsește `pipeline_item`

**Soluție:**
```sql
-- Verifică dacă există pipeline_item pentru fișă
SELECT 
  pi.id,
  pi.type,
  pi.item_id,
  pi.pipeline_id,
  pi.stage_id,
  s.name as stage_name,
  p.name as pipeline_name
FROM pipeline_items pi
JOIN pipelines p ON pi.pipeline_id = p.id
LEFT JOIN stages s ON pi.stage_id = s.id
WHERE pi.type = 'service_file'
  AND pi.item_id = 'ID_FISA_AICI'  -- Înlocuiește cu ID-ul real
```

### Problema 3: Căutarea stage-ului nu funcționează
**Cauză:** Numele stage-ului nu conține toate termenii căutați
**Exemplu:** 
- Stage-ul se numește "OFFICE DIRECT" dar căutarea folosește `['office', 'direct']`
- Stage-ul se numește "CURIER TRIMIS" dar căutarea folosește `['curier', 'trimis']`

**Soluție:** Verifică exact cum se numesc stage-urile în baza de date și ajustează termenii de căutare

