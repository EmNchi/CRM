'use client'

import { supabaseBrowser } from './supabaseClient'
import type { Pipeline, Stage, Lead, PipelineWithStages } from '../types/database'
import { moveLeadToPipeline as moveLeadToPipelineFn, type MoveItemResult } from './pipelineOperations'

const supabase = supabaseBrowser()

export type PipelineOption = { id: string; name: string; is_active: boolean; active_stages: number }

export type { MoveItemResult }
export type MoveResult = MoveItemResult

// functie helper pentru atribuirea automata a tag-urilor de departament
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


export async function getPipelineOptions(): Promise<PipelineOption[]> {
  const { data, error } = await supabase.rpc('get_pipeline_options')
  if (error) throw error
  return (data ?? []) as PipelineOption[]
}

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
 * Creează un lead și îl adaugă automat într-un pipeline
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

    // Atribuie automat tag-ul de departament după creare
    const { data: pipeline } = await supabase
      .from('pipelines')
      .select('name')
      .eq('id', pipelineId)
      .single()
    
    if (pipeline?.name) {
      await assignDepartmentTagToLead(lead.id, pipeline.name)
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
 * Mută un lead într-un pipeline (folosește noua arhitectură cu pipeline_items)
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
 * Mută un lead într-un pipeline pe baza numelui pipeline-ului
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

export async function deleteLead(leadId: string) {
  try {
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
 * Loghează un eveniment pentru un item (lead, service_file sau tray)
 * Folosește tabelul polimorf items_events
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
 * Loghează un eveniment pentru un lead
 * Folosește items_events pentru logging
 */
export async function logLeadEvent(
  leadId: string,
  message: string,
  eventType: string = 'message',
  payload: Record<string, any> = {}
) {
  return await logItemEvent('lead', leadId, message, eventType, payload)
}




