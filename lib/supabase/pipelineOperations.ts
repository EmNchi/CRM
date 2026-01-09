'use client'

/**
 * Pipeline Operations
 * 
 * This file contains pipeline item mutation operations.
 * The getKanbanItems and related query functions have been refactored into
 * the modular kanban/ directory for better maintainability.
 * 
 * Architecture:
 * - This file: Mutation operations (add, move, remove items)
 * - ./kanban/: Query operations (getKanbanItems, getSingleKanbanItem)
 */

import { supabaseBrowser } from './supabaseClient'

// ==================== RE-EXPORTS FROM KANBAN MODULE ====================
// For backward compatibility, re-export the query functions from the new module

export { 
  getKanbanItems, 
  getSingleKanbanItem,
  getKanbanItemsByType,
  type KanbanItem,
  type PipelineItemType,
  type MoveItemResult,
  type PipelineItem
} from './kanban'

// Re-export types for backward compatibility
export type { KanbanItem as KanbanItemType } from './kanban'

// ==================== MUTATION OPERATIONS ====================

/**
 * Adaugă sau actualizează un item într-un pipeline (funcție generică).
 * Această funcție este folosită intern pentru a adăuga orice tip de item (lead, service_file, tray)
 * într-un pipeline. Dacă item-ul există deja în pipeline, funcția actualizează doar stage-ul.
 * Dacă nu există, creează o nouă înregistrare în pipeline_items.
 * 
 * @param type - Tipul item-ului: 'lead', 'service_file' sau 'tray'
 * @param itemId - ID-ul item-ului de adăugat
 * @param pipelineId - ID-ul pipeline-ului în care se adaugă item-ul
 * @param stageId - ID-ul stage-ului în care se plasează item-ul
 * @returns Obiect cu data pipeline_item-ului creat/actualizat sau null și eroarea dacă există
 */
async function addItemToPipeline(
  type: 'lead' | 'service_file' | 'tray',
  itemId: string,
  pipelineId: string,
  stageId: string
): Promise<{ data: any | null; error: any }> {
  try {
    const supabase = supabaseBrowser()
    
    // Check if item already exists in this pipeline
    const { data: existing } = await supabase
      .from('pipeline_items')
      .select('*')
      .eq('type', type)
      .eq('item_id', itemId)
      .eq('pipeline_id', pipelineId)
      .maybeSingle()

    if (existing) {
      // Update existing item's stage
      const { data, error } = await supabase
        .from('pipeline_items')
        .update({
          stage_id: stageId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    }

    // Create new item
    const { data, error } = await supabase
      .from('pipeline_items')
      .insert([{
        type,
        item_id: itemId,
        pipeline_id: pipelineId,
        stage_id: stageId,
      }])
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Adaugă un lead într-un pipeline specificat.
 * Această funcție este un wrapper peste addItemToPipeline specializat pentru lead-uri.
 * Lead-ul este adăugat în pipeline_items și plasat în stage-ul specificat.
 * 
 * @param leadId - ID-ul lead-ului de adăugat
 * @param pipelineId - ID-ul pipeline-ului în care se adaugă lead-ul
 * @param stageId - ID-ul stage-ului în care se plasează lead-ul
 * @returns Obiect cu data pipeline_item-ului creat/actualizat sau null și eroarea dacă există
 */
export async function addLeadToPipeline(
  leadId: string,
  pipelineId: string,
  stageId: string
): Promise<{ data: any | null; error: any }> {
  return addItemToPipeline('lead', leadId, pipelineId, stageId)
}

/**
 * Adaugă o fișă de serviciu într-un pipeline specificat.
 * Această funcție este un wrapper peste addItemToPipeline specializat pentru service files.
 * Fișa de serviciu este adăugată în pipeline_items și plasată în stage-ul specificat.
 * 
 * @param serviceFileId - ID-ul fișei de serviciu de adăugat
 * @param pipelineId - ID-ul pipeline-ului în care se adaugă fișa
 * @param stageId - ID-ul stage-ului în care se plasează fișa
 * @returns Obiect cu data pipeline_item-ului creat/actualizat sau null și eroarea dacă există
 */
export async function addServiceFileToPipeline(
  serviceFileId: string,
  pipelineId: string,
  stageId: string
): Promise<{ data: any | null; error: any }> {
  return addItemToPipeline('service_file', serviceFileId, pipelineId, stageId)
}

/**
 * Adaugă o tăviță într-un pipeline specificat.
 * Această funcție este un wrapper peste addItemToPipeline specializat pentru tăvițe.
 * Tăvița este adăugată în pipeline_items și plasată în stage-ul specificat.
 * 
 * @param trayId - ID-ul tăviței de adăugat
 * @param pipelineId - ID-ul pipeline-ului în care se adaugă tăvița
 * @param stageId - ID-ul stage-ului în care se plasează tăvița
 * @returns Obiect cu data pipeline_item-ului creat/actualizat sau null și eroarea dacă există
 */
export async function addTrayToPipeline(
  trayId: string,
  pipelineId: string,
  stageId: string
): Promise<{ data: any | null; error: any }> {
  return addItemToPipeline('tray', trayId, pipelineId, stageId)
}

/**
 * Mută un item într-un alt stage din același pipeline.
 * Această funcție actualizează stage-ul unui item care este deja în pipeline.
 * Item-ul rămâne în același pipeline, doar stage-ul se schimbă.
 * Funcția verifică mai întâi dacă item-ul există în pipeline-ul specificat.
 * 
 * @param type - Tipul item-ului: 'lead', 'service_file' sau 'tray'
 * @param itemId - ID-ul item-ului de mutat
 * @param pipelineId - ID-ul pipeline-ului în care se află item-ul
 * @param newStageId - ID-ul noului stage în care se mută item-ul
 * @param fromStageId - ID-ul stage-ului de origine (opțional, pentru validare)
 * @returns Obiect cu data pipeline_item-ului actualizat sau null și eroarea dacă există
 */
export async function moveItemToStage(
  type: 'lead' | 'service_file' | 'tray',
  itemId: string,
  pipelineId: string,
  newStageId: string,
  fromStageId?: string
): Promise<{ data: any | null; error: any }> {
  try {
    const supabase = supabaseBrowser()
    
    const { data: current, error: fetchError } = await supabase
      .from('pipeline_items')
      .select('*')
      .eq('type', type)
      .eq('item_id', itemId)
      .eq('pipeline_id', pipelineId)
      .maybeSingle()

    if (fetchError) {
      throw fetchError
    }
    
    if (!current) {
      throw new Error(`Item of type "${type}" with id "${itemId}" not found in the specified pipeline`)
    }

    const { data, error } = await supabase
      .from('pipeline_items')
      .update({
        stage_id: newStageId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', (current as any).id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Obține toate item-urile dintr-un pipeline (opțional filtrate).
 * Această funcție permite obținerea tuturor item-urilor dintr-un pipeline, cu opțiuni
 * de filtrare după stage sau tip de item. Rezultatele sunt sortate descrescător după
 * data creării (cele mai noi primele).
 * 
 * @param pipelineId - ID-ul pipeline-ului pentru care se caută item-urile
 * @param stageId - ID-ul stage-ului pentru filtrare (opțional)
 * @param type - Tipul item-ului pentru filtrare: 'lead', 'service_file' sau 'tray' (opțional)
 * @returns Obiect cu array-ul de pipeline_items sau array gol și eroarea dacă există
 */
export async function getPipelineItems(
  pipelineId: string,
  stageId?: string,
  type?: 'lead' | 'service_file' | 'tray'
): Promise<{ data: any[]; error: any }> {
  try {
    const supabase = supabaseBrowser()
    
    let query = supabase
      .from('pipeline_items')
      .select('*')
      .eq('pipeline_id', pipelineId)

    if (stageId) {
      query = query.eq('stage_id', stageId)
    }

    if (type) {
      query = query.eq('type', type)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) throw error
    return { data: data ?? [], error: null }
  } catch (error) {
    return { data: [], error }
  }
}

/**
 * Obține pipeline_item-ul pentru un item specific.
 * Această funcție caută înregistrarea din pipeline_items care asociază un item
 * (lead, service_file sau tray) cu un pipeline specific. Este folosită pentru a
 * verifica dacă un item este deja într-un pipeline și în ce stage se află.
 * 
 * @param type - Tipul item-ului: 'lead', 'service_file' sau 'tray'
 * @param itemId - ID-ul item-ului pentru care se caută pipeline_item-ul
 * @param pipelineId - ID-ul pipeline-ului în care se caută
 * @returns Obiect cu data pipeline_item-ului sau null dacă nu există și eroarea dacă există
 */
export async function getPipelineItemForItem(
  type: 'lead' | 'service_file' | 'tray',
  itemId: string,
  pipelineId: string
): Promise<{ data: any | null; error: any }> {
  try {
    const supabase = supabaseBrowser()
    
    const { data, error } = await supabase
      .from('pipeline_items')
      .select('*')
      .eq('type', type)
      .eq('item_id', itemId)
      .eq('pipeline_id', pipelineId)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Elimină un item dintr-un pipeline.
 * Această funcție șterge înregistrarea din pipeline_items, ceea ce înseamnă că
 * item-ul nu va mai apărea în acel pipeline. Item-ul în sine (lead, service_file sau tray)
 * nu este șters, doar asocierea cu pipeline-ul este eliminată.
 * 
 * @param type - Tipul item-ului: 'lead', 'service_file' sau 'tray'
 * @param itemId - ID-ul item-ului de eliminat din pipeline
 * @param pipelineId - ID-ul pipeline-ului din care se elimină item-ul
 * @returns Obiect cu success: true dacă eliminarea a reușit, false altfel, și eroarea dacă există
 */
export async function removeItemFromPipeline(
  type: 'lead' | 'service_file' | 'tray',
  itemId: string,
  pipelineId: string
): Promise<{ success: boolean; error: any }> {
  try {
    const supabase = supabaseBrowser()
    
    const { error } = await supabase
      .from('pipeline_items')
      .delete()
      .eq('type', type)
      .eq('item_id', itemId)
      .eq('pipeline_id', pipelineId)

    if (error) throw error
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error }
  }
}

/**
 * Obține primul stage activ dintr-un pipeline (funcție helper).
 * Această funcție este folosită intern pentru a găsi stage-ul inițial când un item
 * este adăugat într-un pipeline fără a specifica un stage. Returnează stage-ul cu
 * cea mai mică poziție (primul din workflow).
 * 
 * @param pipelineId - ID-ul pipeline-ului pentru care se caută primul stage activ
 * @returns Obiect cu id-ul primului stage activ sau null dacă nu există stage-uri active
 */
async function getFirstActiveStage(pipelineId: string): Promise<{ id: string } | null> {
  const supabase = supabaseBrowser()
  
  const { data: stages, error: stagesError } = await supabase
    .from('stages')
    .select('id')
    .eq('pipeline_id', pipelineId)
    .eq('is_active', true)
    .order('position', { ascending: true })
    .limit(1)

  if (stagesError || !stages || stages.length === 0) {
    return null
  }
  return { id: stages[0].id }
}

// Type for move results
type MoveResult = {
  ok: true
  data: { pipeline_item_id: string; new_stage_id: string }[]
} | {
  ok: false
  code?: string
  message?: string
}

/**
 * Mută un lead într-un pipeline nou.
 * Această funcție mută un lead dintr-un pipeline în altul, sau îl adaugă într-un pipeline
 * dacă nu era deja într-unul. Dacă nu se specifică un stage țintă, lead-ul este plasat
 * automat în primul stage activ al pipeline-ului țintă. Funcția returnează un rezultat
 * structurat cu ok: true/false și detalii despre mutare sau eroare.
 * 
 * @param leadId - ID-ul lead-ului de mutat
 * @param targetPipelineId - ID-ul pipeline-ului țintă
 * @param targetStageId - ID-ul stage-ului țintă (opțional, se folosește primul stage activ dacă nu se specifică)
 * @param notes - Note opționale despre mutare (pentru istoric)
 * @returns Rezultat structurat cu:
 *   - ok: true dacă mutarea a reușit, false altfel
 *   - data: Array cu pipeline_item_id și new_stage_id (dacă ok: true)
 *   - code și message: Cod și mesaj de eroare (dacă ok: false)
 */
export async function moveLeadToPipeline(
  leadId: string,
  targetPipelineId: string,
  targetStageId?: string,
  notes?: string
): Promise<MoveResult> {
  try {
    let stageId = targetStageId
    if (!stageId) {
      const firstStage = await getFirstActiveStage(targetPipelineId)
      if (!firstStage) {
        return {
          ok: false,
          code: 'TARGET_PIPELINE_NO_ACTIVE_STAGES',
          message: 'Target pipeline has no active stages',
        }
      }
      stageId = firstStage.id
    }

    const result = await addLeadToPipeline(leadId, targetPipelineId, stageId)

    if (result.error) {
      return {
        ok: false,
        code: 'MOVE_ERROR',
        message: result.error.message,
      }
    }

    return {
      ok: true,
      data: [{
        pipeline_item_id: result.data!.id,
        new_stage_id: stageId,
      }],
    }
  } catch (error: any) {
    return {
      ok: false,
      code: 'UNKNOWN_ERROR',
      message: error?.message || 'Unknown error',
    }
  }
}

/**
 * Mută o fișă de serviciu într-un pipeline nou.
 * Această funcție mută o fișă de serviciu dintr-un pipeline în altul, sau o adaugă într-un
 * pipeline dacă nu era deja într-unul. Dacă nu se specifică un stage țintă, fișa este plasată
 * automat în primul stage activ al pipeline-ului țintă. Funcția returnează un rezultat
 * structurat cu ok: true/false și detalii despre mutare sau eroare.
 * 
 * @param serviceFileId - ID-ul fișei de serviciu de mutat
 * @param targetPipelineId - ID-ul pipeline-ului țintă
 * @param targetStageId - ID-ul stage-ului țintă (opțional, se folosește primul stage activ dacă nu se specifică)
 * @param notes - Note opționale despre mutare (pentru istoric)
 * @returns Rezultat structurat cu:
 *   - ok: true dacă mutarea a reușit, false altfel
 *   - data: Array cu pipeline_item_id și new_stage_id (dacă ok: true)
 *   - code și message: Cod și mesaj de eroare (dacă ok: false)
 */
export async function moveServiceFileToPipeline(
  serviceFileId: string,
  targetPipelineId: string,
  targetStageId?: string,
  notes?: string
): Promise<MoveResult> {
  try {
    let stageId = targetStageId
    if (!stageId) {
      const firstStage = await getFirstActiveStage(targetPipelineId)
      if (!firstStage) {
        return {
          ok: false,
          code: 'TARGET_PIPELINE_NO_ACTIVE_STAGES',
          message: 'Target pipeline has no active stages',
        }
      }
      stageId = firstStage.id
    }

    const result = await addServiceFileToPipeline(serviceFileId, targetPipelineId, stageId)

    if (result.error) {
      return {
        ok: false,
        code: 'MOVE_ERROR',
        message: result.error.message,
      }
    }

    return {
      ok: true,
      data: [{
        pipeline_item_id: result.data!.id,
        new_stage_id: stageId,
      }],
    }
  } catch (error: any) {
    return {
      ok: false,
      code: 'UNKNOWN_ERROR',
      message: error?.message || 'Unknown error',
    }
  }
}

/**
 * Mută o tăviță într-un pipeline nou.
 * Această funcție mută o tăviță dintr-un pipeline în altul, sau o adaugă într-un pipeline
 * dacă nu era deja într-unul. Dacă nu se specifică un stage țintă, tăvița este plasată
 * automat în primul stage activ al pipeline-ului țintă. Funcția returnează un rezultat
 * structurat cu ok: true/false și detalii despre mutare sau eroare.
 * 
 * @param trayId - ID-ul tăviței de mutat
 * @param targetPipelineId - ID-ul pipeline-ului țintă
 * @param targetStageId - ID-ul stage-ului țintă (opțional, se folosește primul stage activ dacă nu se specifică)
 * @param notes - Note opționale despre mutare (pentru istoric)
 * @returns Rezultat structurat cu:
 *   - ok: true dacă mutarea a reușit, false altfel
 *   - data: Array cu pipeline_item_id și new_stage_id (dacă ok: true)
 *   - code și message: Cod și mesaj de eroare (dacă ok: false)
 */
export async function moveTrayToPipeline(
  trayId: string,
  targetPipelineId: string,
  targetStageId?: string,
  notes?: string
): Promise<MoveResult> {
  try {
    let stageId = targetStageId
    if (!stageId) {
      const firstStage = await getFirstActiveStage(targetPipelineId)
      if (!firstStage) {
        return {
          ok: false,
          code: 'TARGET_PIPELINE_NO_ACTIVE_STAGES',
          message: 'Target pipeline has no active stages',
        }
      }
      stageId = firstStage.id
    }

    const result = await addTrayToPipeline(trayId, targetPipelineId, stageId)

    if (result.error) {
      return {
        ok: false,
        code: 'MOVE_ERROR',
        message: result.error.message,
      }
    }

    return {
      ok: true,
      data: [{
        pipeline_item_id: result.data!.id,
        new_stage_id: stageId,
      }],
    }
  } catch (error: any) {
    return {
      ok: false,
      code: 'UNKNOWN_ERROR',
      message: error?.message || 'Unknown error',
    }
  }
}

/**
 * Mişte lead-urile care au cel puţin o fişă de serviciu în stagiul "Lead-uri Vechi" din pipeline-ul "Vânzări".
 * Această funcție identifică toate lead-urile care au cel puţin o fişă de serviciu asociată,
 * și le mişte automat în stagiul "Lead-uri Vechi" din pipeline-ul de vânzări.
 * 
 * @returns Obiect cu rezultat: { success: boolean, movedLeadsCount: number, error?: any }
 */
export async function moveLeadsWithServiceFilesToOldStage(): Promise<{
  success: boolean
  movedLeadsCount: number
  error?: any
}> {
  try {
    const supabase = supabaseBrowser()
    
    // 1. Găsește pipeline-ul "Vânzări"
    const { data: pipelines, error: pipelineError } = await supabase
      .from('pipelines')
      .select('id, name, stages(id, name)')
      .ilike('name', '%Vânzări%')
    
    if (pipelineError) {
      throw new Error(`Error fetching pipelines: ${pipelineError.message}`)
    }
    
    const vanzariPipeline = pipelines?.[0]
    if (!vanzariPipeline) {
      throw new Error('Pipeline "Vânzări" not found')
    }
    
    // 2. Găsește stagiul "Lead-uri Vechi" în pipeline-ul Vânzări
    const oldLeadsStage = (vanzariPipeline.stages as any[])?.find((s: any) =>
      s.name?.toLowerCase().includes('vechi') || s.name?.toLowerCase().includes('old')
    )
    
    if (!oldLeadsStage) {
      throw new Error('Stage "Lead-uri Vechi" not found in Vânzări pipeline')
    }
    
    // 3. Găsește toate lead-urile care au cel puţin o fişă de serviciu
    // SELECT lead_id din service_files, apoi DISTINCT pentru a obţine lead-urile unice
    const { data: serviceFileLeads, error: sfError } = await supabase
      .from('service_files')
      .select('lead_id')
    
    if (sfError) {
      throw new Error(`Error fetching service files: ${sfError.message}`)
    }
    
    // Obţine lista unică de lead IDs
    const leadIdsWithServiceFiles = [...new Set(
      (serviceFileLeads as any[])
        ?.map((sf: any) => sf.lead_id)
        .filter((id: string | null) => id !== null && id !== undefined) || []
    )]
    
    if (leadIdsWithServiceFiles.length === 0) {
      return { success: true, movedLeadsCount: 0 }
    }
    
    // 4. Pentru fiecare lead, mişte-l în stagiul "Lead-uri Vechi"
    let movedCount = 0
    
    for (const leadId of leadIdsWithServiceFiles) {
      try {
        // Verifică dacă lead-ul este deja în pipeline-ul Vânzări
        const { data: existingItem, error: checkError } = await supabase
          .from('pipeline_items')
          .select('id')
          .eq('type', 'lead')
          .eq('item_id', leadId)
          .eq('pipeline_id', vanzariPipeline.id)
          .maybeSingle()
        
        if (checkError && checkError.code !== 'PGRST116') {
          console.warn(`[moveLeadsWithServiceFilesToOldStage] Error checking lead ${leadId}:`, checkError)
          continue
        }
        
        if (existingItem) {
          // Lead-ul este deja în pipeline, mişte-l în stagiul "Lead-uri Vechi"
          const { error: moveError } = await supabase
            .from('pipeline_items')
            .update({
              stage_id: oldLeadsStage.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingItem.id)
          
          if (moveError) {
            console.warn(`[moveLeadsWithServiceFilesToOldStage] Error moving lead ${leadId}:`, moveError)
          } else {
            movedCount++
          }
        } else {
          // Lead-ul nu este în pipeline, adaug-ă-l
          const { error: addError } = await supabase
            .from('pipeline_items')
            .insert({
              type: 'lead',
              item_id: leadId,
              pipeline_id: vanzariPipeline.id,
              stage_id: oldLeadsStage.id,
            })
          
          if (addError) {
            console.warn(`[moveLeadsWithServiceFilesToOldStage] Error adding lead ${leadId}:`, addError)
          } else {
            movedCount++
          }
        }
      } catch (err) {
        console.error(`[moveLeadsWithServiceFilesToOldStage] Unexpected error for lead ${leadId}:`, err)
      }
    }
    
    return { success: true, movedLeadsCount: movedCount }
  } catch (error: any) {
    return {
      success: false,
      movedLeadsCount: 0,
      error: error?.message || 'Unknown error',
    }
  }
}
