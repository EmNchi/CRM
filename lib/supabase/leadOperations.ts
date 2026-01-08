'use client'

import { supabaseBrowser } from './supabaseClient'
import type { Pipeline, Stage, Lead, PipelineWithStages } from '../types/database'
import { moveLeadToPipeline as moveLeadToPipelineFn, type MoveItemResult } from './pipelineOperations'

const supabase = supabaseBrowser()

export type PipelineOption = { id: string; name: string; is_active: boolean; active_stages: number }

export type { MoveItemResult }
export type MoveResult = MoveItemResult

/**
 * Funcție helper pentru atribuirea automată a tag-urilor de departament unui lead.
 * Această funcție analizează numele pipeline-ului și atribuie automat tag-ul corespunzător
 * departamentului (Horeca, Saloane, Frizerii, Reparatii). Dacă tag-ul nu există, îl creează.
 * Un lead poate avea doar un singur tag de departament, deci funcția elimină automat
 * celelalte tag-uri de departament înainte de a atribui noul tag.
 * 
 * @param leadId - ID-ul lead-ului căruia i se atribuie tag-ul
 * @param pipelineName - Numele pipeline-ului din care se deduce departamentul
 */
async function assignDepartmentTagToLead(leadId: string, pipelineName: string) {
  const departmentTags = [
    { name: 'Horeca', color: 'orange' as const },
    { name: 'Saloane', color: 'green' as const },
    { name: 'Frizerii', color: 'yellow' as const },
    { name: 'Reparatii', color: 'blue' as const },
  ]

  // Determină tag-ul de departament bazat pe numele pipeline-ului
  const pipelineNameUpper = pipelineName.toUpperCase()
  let departmentTagName: string | null = null
  if (pipelineNameUpper.includes('HORECA')) {
    departmentTagName = 'Horeca'
  } else if (pipelineNameUpper.includes('SALOANE') || pipelineNameUpper.includes('SALON')) {
    departmentTagName = 'Saloane'
  } else if (pipelineNameUpper.includes('FRIZER') || pipelineNameUpper.includes('BARBER')) {
    departmentTagName = 'Frizerii'
  } else if (pipelineNameUpper.includes('REPARAT') || pipelineNameUpper.includes('SERVICE')) {
    departmentTagName = 'Reparatii'
  }

  if (!departmentTagName) return

  // gaseste sau creeaza tag-ul
  const { data: existingTag } = await supabase
    .from('tags')
    .select('id')
    .eq('name', departmentTagName)
    .single()

  let tagId: string
  if (existingTag) {
    tagId = existingTag.id
  } else {
    const tagData = departmentTags.find(t => t.name === departmentTagName)
    if (!tagData) return
    
    const { data: newTag, error: tagError } = await supabase
      .from('tags')
      .insert([{ name: tagData.name, color: tagData.color }] as any)
      .select('id')
      .single()
    
    if (tagError || !newTag) return
    tagId = newTag.id
  }

  // verifica daca tag-ul este deja atribuit
  const { data: existingAssignment } = await supabase
    .from('lead_tags')
    .select('lead_id')
    .eq('lead_id', leadId)
    .eq('tag_id', tagId)
    .maybeSingle()

  // atribuie tag-ul daca nu este deja atribuit
  if (!existingAssignment) {
    await supabase
      .from('lead_tags')
      .insert([{ lead_id: leadId, tag_id: tagId }] as any)
  }

  // elimina celelalte tag-uri de departament (un lead poate avea doar un tag de departament)
  const otherDepartmentTags = departmentTags.filter(t => t.name !== departmentTagName)
  const otherTagNames = otherDepartmentTags.map(t => t.name)
  
  const { data: otherTags } = await supabase
    .from('tags')
    .select('id')
    .in('name', otherTagNames)

  if (otherTags && otherTags.length > 0) {
    const otherTagIds = otherTags.map(t => t.id)
    await supabase
      .from('lead_tags')
      .delete()
      .eq('lead_id', leadId)
      .in('tag_id', otherTagIds)
  }
}


/**
 * Obține lista de opțiuni de pipeline-uri disponibile.
 * Folosește o funcție RPC (Remote Procedure Call) din Supabase pentru a obține
 * pipeline-urile active cu numărul de stage-uri active pentru fiecare.
 * Această funcție este folosită în dropdown-uri și selecții de pipeline-uri.
 * 
 * @returns Array cu opțiunile de pipeline-uri, fiecare conținând:
 *   - id: ID-ul pipeline-ului
 *   - name: Numele pipeline-ului
 *   - is_active: Dacă pipeline-ul este activ
 *   - active_stages: Numărul de stage-uri active din pipeline
 * @throws Eroare dacă apelul RPC eșuează
 */
export async function getPipelineOptions(): Promise<PipelineOption[]> {
  const { data, error } = await supabase.rpc('get_pipeline_options')
  if (error) throw error
  return (data ?? []) as PipelineOption[]
}

/**
 * Obține toate pipeline-urile active cu stage-urile lor asociate.
 * Funcția încarcă pipeline-urile și stage-urile active, apoi grupează stage-urile
 * sub pipeline-urile corespunzătoare. Rezultatul este folosit pentru a construi
 * structura completă a pipeline-urilor în interfață.
 * 
 * @returns Obiect cu:
 *   - data: Array de pipeline-uri, fiecare cu un array de stage-uri asociate
 *   - error: null dacă reușește, sau eroarea dacă apare o problemă
 */
export async function getPipelinesWithStages() {
  try {
    const { data: pipelines, error: pipelineError } = await supabase
      .from('pipelines')
      .select('*')
      .eq('is_active', true)
      .order('position')

    if (pipelineError) throw pipelineError

    const { data: stages, error: stageError } = await supabase
      .from('stages')
      .select('*')
      .eq('is_active', true)
      .order('position')

    if (stageError) throw stageError

    const pipelinesWithStages = pipelines.map(pipeline => ({
      ...pipeline,
      stages: stages.filter(stage => stage.pipeline_id === pipeline.id)
    }))

    return { data: pipelinesWithStages, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Creează un nou lead în baza de date.
 * Un lead reprezintă un potențial client care a completat un formular sau a fost
 * adăugat manual în sistem. Lead-ul conține informații de contact (nume, email, telefon)
 * și detalii despre sursa lead-ului (campanie, anunț, formular, etc.).
 * 
 * @param leadData - Datele lead-ului de creat (orice câmpuri din tabelul leads)
 * @returns Obiect cu:
 *   - data: Lead-ul creat sau null dacă apare o eroare
 *   - error: null dacă reușește, sau eroarea dacă apare o problemă
 */
export async function createLead(leadData: any) {
  try {
    const { data, error } = await supabase
      .from('leads')
      .insert([leadData])
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Creează un lead și îl adaugă automat într-un pipeline specificat.
 * Această funcție combină crearea lead-ului cu adăugarea sa într-un pipeline,
 * asigurând că lead-ul este imediat disponibil în workflow-ul corespunzător.
 * După creare, atribuie automat tag-ul de departament bazat pe numele pipeline-ului.
 * 
 * @param leadData - Datele lead-ului de creat
 * @param pipelineId - ID-ul pipeline-ului în care se adaugă lead-ul
 * @param stageId - ID-ul stage-ului inițial în care se plasează lead-ul
 * @returns Obiect cu:
 *   - data: Obiect cu lead-ul creat și assignment-ul în pipeline, sau null dacă apare o eroare
 *   - error: null dacă reușește, sau eroarea dacă apare o problemă
 */
export async function createLeadWithPipeline(
  leadData: any,
  pipelineId: string,
  stageId: string
): Promise<{ data: { lead: any; assignment: any } | null; error: any }> {
  try {
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert([leadData])
      .select()
      .single()

    if (leadError) throw leadError

    // Adaugă lead-ul în pipeline
    const moveResult = await moveLeadToPipelineFn(lead.id, pipelineId, stageId)

    if (!moveResult.ok || !moveResult.data || moveResult.data.length === 0) {
      const errorMessage = moveResult.ok === false ? moveResult.message : 'Nu s-a putut adăuga lead-ul în pipeline'
      throw new Error(errorMessage)
    }

    // Atribuie automat tag-ul de departament după criere
    const { data: pipeline } = await supabase
      .from('pipelines')
      .select('name')
      .eq('id', pipelineId)
      .single()
    
    if (pipeline?.name) {
      await assignDepartmentTagToLead(lead.id, pipeline.name)
    }

    // ✅ TRIGGER: Crează conversație PUBLICĂ pentru lead cand se creează lead-ul
    try {
      console.log('🔍 Creating conversation for newly created lead:', lead.id)
      
      // Obține current user ID
      const { data: { session } } = await supabase.auth.getSession()
      const currentUserId = session?.user?.id
      
      if (!currentUserId) {
        console.warn('⚠️ No authenticated user found - cannot create conversation')
      } else {
        // Verifică dacă conversația deja există (safety check)
        const { data: existingConv, error: searchError } = await supabase
          .from('conversations')
          .select('id')
          .eq('related_id', lead.id)
          .eq('type', 'lead')
          .maybeSingle()

        if (searchError && searchError.code !== 'PGRST116') {
          console.warn('⚠️ Error searching for conversation:', searchError)
        } else if (!existingConv) {
          // Conversația nu există, crează-o
          console.log('➕ Creating new conversation for lead:', lead.id)
          const { data: newConv, error: insertError } = await supabase
            .from('conversations')
            .insert({
              related_id: lead.id,
              type: 'lead',
              created_by: currentUserId, // Created by current user
            })
            .select('id')
            .single()

          if (insertError) {
            console.error('❌ Error creating conversation:', insertError)
          } else {
            console.log('✅ Conversation created successfully for lead:', newConv?.id)
          }
        } else {
          console.log('✅ Conversation already exists for lead:', existingConv.id)
        }
      }
    } catch (convError) {
      console.error('⚠️ Error in conversation creation process:', convError)
      // Nu oprim procesul dacă crearea conversației eșuează
    }

    return {
      data: {
        lead,
        assignment: { id: moveResult.data[0].pipeline_item_id, pipeline_id: pipelineId, stage_id: stageId },
      },
      error: null,
    }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Mută un lead într-un pipeline specificat (folosește noua arhitectură cu pipeline_items).
 * Această funcție mută un lead dintr-un pipeline în altul, sau îl adaugă într-un pipeline
 * dacă nu era deja într-unul. Lead-ul este plasat automat în primul stage activ al pipeline-ului
 * țintă dacă nu se specifică un stage. După mutare, atribuie automat tag-ul de departament
 * bazat pe numele noului pipeline.
 * 
 * @param leadId - ID-ul lead-ului de mutat
 * @param targetPipelineId - ID-ul pipeline-ului țintă
 * @param notes - Note opționale despre mutare (pentru istoric)
 * @returns Rezultatul mutării cu ok: true/false, data cu pipeline_item_id și new_stage_id, sau eroare
 */
export async function moveLeadToPipeline(
  leadId: string,
  targetPipelineId: string,
  notes?: string
): Promise<MoveResult> {
  const result = await moveLeadToPipelineFn(leadId, targetPipelineId, undefined, notes)

  // Atribuie automat tag-ul de departament după mutare
  if (result.ok && result.data && result.data.length > 0) {
    const { data: pipeline } = await supabase
      .from('pipelines')
      .select('name')
      .eq('id', targetPipelineId)
      .single()

    if (pipeline?.name) {
      await assignDepartmentTagToLead(leadId, pipeline.name)
    }
  }

  return result
}

/**
 * Mută un lead într-un pipeline identificat după nume (nu după ID).
 * Această funcție este o variantă convenabilă care permite mutarea unui lead folosind
 * numele pipeline-ului în loc de ID. Funcția caută pipeline-ul activ cu numele specificat
 * și apoi apelează moveLeadToPipeline cu ID-ul găsit.
 * 
 * @param leadId - ID-ul lead-ului de mutat
 * @param targetPipelineName - Numele pipeline-ului țintă (trebuie să fie exact)
 * @param notes - Note opționale despre mutare (pentru istoric)
 * @returns Rezultatul mutării cu ok: true/false, data cu pipeline_item_id și new_stage_id, sau eroare
 */
export async function moveLeadToPipelineByName(
  leadId: string,
  targetPipelineName: string,
  notes?: string
): Promise<MoveResult> {
  // Găsește pipeline-ul după nume (doar active)
  const { data: pipeline, error: pErr } = await supabase
    .from('pipelines')
    .select('id')
    .eq('name', targetPipelineName)
    .eq('is_active', true)
    .single()

  if (pErr || !pipeline?.id) {
    return { ok: false, code: 'TARGET_PIPELINE_NOT_ACTIVE', message: pErr?.message ?? 'Pipeline not found or inactive' }
  }

  return moveLeadToPipeline(leadId, pipeline.id, notes)
}


/**
 * Actualizează un lead existent în baza de date.
 * Permite modificarea oricăror câmpuri ale lead-ului: nume, email, telefon, detalii despre
 * campanie, anunț, formular, etc. Funcția este folosită pentru editarea informațiilor unui client.
 * 
 * @param leadId - ID-ul lead-ului de actualizat
 * @param updates - Obiect cu câmpurile de actualizat (orice câmpuri din tabelul leads)
 * @returns Obiect cu:
 *   - data: Lead-ul actualizat sau null dacă apare o eroare
 *   - error: null dacă reușește, sau eroarea dacă apare o problemă
 */
export async function updateLead(leadId: string, updates: any) {
  try {
    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', leadId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Șterge un lead din baza de date și toate datele asociate.
 * ATENȚIE: Ștergerea unui lead este ireversibilă și va șterge toate datele asociate:
 * fișe de serviciu, tăvițe, item-uri, evenimente, tag-uri, etc.
 * Folosiți cu precauție, deoarece operația este permanentă.
 * 
 * Ordinea de ștergere:
 * 1. Șterge toate fișele de serviciu (care vor șterge automat tăvițele și tray_items prin cascade)
 * 2. Șterge pipeline_items pentru lead și service_files
 * 3. Șterge lead_tags
 * 4. Șterge stage_history
 * 5. Șterge lead-ul
 * 
 * @param leadId - ID-ul lead-ului de șters
 * @returns Obiect cu:
 *   - success: true dacă ștergerea a reușit, false altfel
 *   - error: null dacă reușește, sau eroarea dacă apare o problemă
 */
export async function deleteLead(leadId: string) {
  try {
    // 1. Obține toate fișele de serviciu pentru acest lead
    const { data: serviceFiles, error: sfError } = await supabase
      .from('service_files')
      .select('id')
      .eq('lead_id', leadId)

    if (sfError) throw sfError

    // 2. Șterge toate fișele de serviciu (cascade va șterge automat tăvițele și tray_items)
    if (serviceFiles && serviceFiles.length > 0) {
      const serviceFileIds = serviceFiles.map(sf => sf.id)
      
      // Șterge pipeline_items pentru service_files
      const { error: piError } = await supabase
        .from('pipeline_items')
        .delete()
        .in('item_id', serviceFileIds)
        .eq('type', 'service_file')

      if (piError) throw piError

      // Șterge fișele de serviciu (cascade va șterge trays și tray_items)
      const { error: deleteSfError } = await supabase
        .from('service_files')
        .delete()
        .eq('lead_id', leadId)

      if (deleteSfError) throw deleteSfError
    }

    // 3. Șterge pipeline_items pentru lead
    const { error: leadPiError } = await supabase
      .from('pipeline_items')
      .delete()
      .eq('item_id', leadId)
      .eq('type', 'lead')

    if (leadPiError) throw leadPiError

    // 4. Șterge lead_tags
    const { error: tagsError } = await supabase
      .from('lead_tags')
      .delete()
      .eq('lead_id', leadId)

    if (tagsError) throw tagsError

    // 5. Șterge stage_history
    const { error: historyError } = await supabase
      .from('stage_history')
      .delete()
      .eq('lead_id', leadId)

    if (historyError) throw historyError

    // 6. Șterge lead-ul
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId)

    if (error) throw error
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error }
  }
}

/**
 * Caută lead-uri după un termen de căutare.
 * Funcția caută în trei câmpuri principale: nume complet, email și număr de telefon.
 * Căutarea este case-insensitive și folosește pattern matching (ilike) pentru a găsi
 * potriviri parțiale. Rezultatele includ toate lead-urile care conțin termenul de căutare
 * în oricare dintre cele trei câmpuri.
 * 
 * @param searchTerm - Termenul de căutare (se caută în nume, email, telefon)
 * @returns Obiect cu:
 *   - data: Array cu lead-urile găsite sau null dacă apare o eroare
 *   - error: null dacă reușește, sau eroarea dacă apare o problemă
 */
export async function searchLeads(searchTerm: string) {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%`)

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Actualizează un pipeline și reordonează stage-urile sale.
 * Această funcție permite modificarea numelui unui pipeline și reordonarea stage-urilor
 * într-o singură operație atomică. Folosește o funcție RPC din Supabase pentru a asigura
 * consistența datelor. Stage-urile sunt reordonate în funcție de ordinea în array-ul furnizat.
 * 
 * @param pipelineId - ID-ul pipeline-ului de actualizat
 * @param pipelineName - Noul nume al pipeline-ului (sau null pentru a păstra numele actual)
 * @param stages - Array cu stage-urile în ordinea finală dorită (fiecare cu id și name)
 * @returns Obiect cu error: null dacă reușește, sau eroarea dacă apare o problemă
 */
export async function updatePipelineAndStages(
  pipelineId: string,
  pipelineName: string,                     // pass current/new name
  stages: { id: string; name: string }[]    // final order
) {
  const payload = stages.map((s, i) => ({ id: s.id, position: i, name: s.name.trim() }))
  const { error } = await supabase.rpc('update_pipeline_and_reorder_stages', {
    p_pipeline_id: pipelineId,
    p_pipeline_name: pipelineName?.trim() ?? null, // send null if you want to skip renaming
    p_items: payload
})
  return { error }
}

/**
 * Loghează un eveniment pentru un item (lead, service_file sau tray).
 * Această funcție creează o înregistrare în tabelul items_events pentru a urmări istoricul
 * acțiunilor și schimbărilor asupra unui item. Evenimentele pot fi mesaje, mutări de stage,
 * actualizări, etc. Funcția identifică automat utilizatorul curent și încearcă să obțină
 * numele acestuia din app_members sau user_metadata.
 * 
 * @param itemType - Tipul item-ului: 'lead', 'service_file' sau 'tray'
 * @param itemId - ID-ul item-ului pentru care se loghează evenimentul
 * @param message - Mesajul evenimentului (descrierea acțiunii)
 * @param eventType - Tipul evenimentului (ex: 'message', 'stage_change', 'update') - implicit 'message'
 * @param payload - Obiect JSON opțional cu date suplimentare despre eveniment
 * @returns Datele evenimentului creat (id, type, item_id, event_type, message, actor_name, created_at)
 * @throws Eroare dacă crearea evenimentului eșuează
 */
export async function logItemEvent(
  itemType: 'lead' | 'service_file' | 'tray',
  itemId: string,
  message: string,
  eventType: string = 'message',
  payload: Record<string, any> = {}
) {
  const supabase = supabaseBrowser()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Încearcă să obțină numele utilizatorului din diferite surse
  let actorName: string | null = null
  
  if (user?.id) {
    // Obține numele din app_members sau user_metadata
    const { data: memberData } = await supabase
      .from('app_members')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    // Dacă app_members are un câmp 'name', folosește-l
    if (memberData && (memberData as any).name) {
      actorName = (memberData as any).name
    } else {
      // Fallback la user_metadata sau email
      actorName =
        (user?.user_metadata as any)?.name ||
        (user?.user_metadata as any)?.full_name ||
        user?.email ||
        null
    }
  }

  const { data, error } = await supabase
    .from("items_events")
    .insert([{
      type: itemType,
      item_id: itemId,
      event_type: eventType,
      message,
      payload,
      actor_id: user?.id ?? null,
      actor_name: actorName,
    }] as any)
    .select("id, type, item_id, event_type, message, actor_name, created_at")
    .single()

  if (error) throw error
  return data
}

/**
 * Loghează un eveniment pentru un lead (wrapper peste logItemEvent).
 * Această funcție este un wrapper convenabil care apelează logItemEvent cu itemType='lead'.
 * Este folosită pentru a simplifica logarea evenimentelor specifice lead-urilor.
 * 
 * @param leadId - ID-ul lead-ului pentru care se loghează evenimentul
 * @param message - Mesajul evenimentului (descrierea acțiunii)
 * @param eventType - Tipul evenimentului (ex: 'message', 'stage_change', 'update') - implicit 'message'
 * @param payload - Obiect JSON opțional cu date suplimentare despre eveniment
 * @returns Datele evenimentului creat (id, type, item_id, event_type, message, actor_name, created_at)
 * @throws Eroare dacă crearea evenimentului eșuează
 */
export async function logLeadEvent(
  leadId: string,
  message: string,
  eventType: string = 'message',
  payload: Record<string, any> = {}
) {
  return await logItemEvent('lead', leadId, message, eventType, payload)
}




