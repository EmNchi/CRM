'use client'

import { supabaseBrowser } from './supabaseClient'
import type { Pipeline, Stage, Lead, LeadPipeline, PipelineWithStages, KanbanLead } from '../types/database'

const supabase = supabaseBrowser()

type MoveOk = { ok: true; data: { lead_pipeline_id: string; new_stage_id: string }[] }
type MoveErr = { ok: false; code?: string; message?: string }
export type MoveResult = MoveOk | MoveErr
export type PipelineOption = { id: string; name: string; is_active: boolean; active_stages: number }

export type BulkMoveResult = {
  action: "created" | "updated"
  pipeline_name: string
  pipeline_id: string
  assignment_id: string
  to_stage_id: string
  to_stage_name: string
  from_stage_id: string | null
  from_stage_name: string | null
}

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

export async function moveLeadToPipeline(
  leadId: string,
  targetPipelineId: string,
  notes?: string
): Promise<MoveResult> {
  const { data, error } = await supabase.rpc('move_lead_to_pipeline', {
    p_lead_id: leadId,
    p_target_pipeline_id: targetPipelineId,
    p_notes: notes ?? null,
  })

  if (error) {
    // error.details will contain our server-side "code" (e.g., TARGET_PIPELINE_NO_ACTIVE_STAGES)
    return { ok: false, code: (error as any)?.details, message: error.message }
  }

    // atribuie automat tag-ul de departament dupa mutare
  if (data && data.length > 0) {
    const { data: pipeline } = await supabase
      .from('pipelines')
      .select('name')
      .eq('id', targetPipelineId)
      .single()
    
    if (pipeline?.name) {
      await assignDepartmentTagToLead(leadId, pipeline.name)
    }
  }

  return { ok: true, data }
}

export async function moveLeadToPipelineByName(
  leadId: string,
  targetPipelineName: string,
  notes?: string
): Promise<MoveResult> {

  // 1) find the pipeline id (active only)
  const { data: pipeline, error: pErr } = await supabase
    .from('pipelines')
    .select('id')
    .eq('name', targetPipelineName)
    .eq('is_active', true)
    .single()

  if (pErr || !pipeline?.id) {
    return { ok: false, code: 'TARGET_PIPELINE_NOT_ACTIVE', message: pErr?.message ?? 'Pipeline not found or inactive' }
  }

  // 2) call main function
  return moveLeadToPipeline(leadId, pipeline.id, notes)
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

// Functie pentru a obtine un singur lead (pentru incremental updates)
export async function getSingleKanbanLead(leadId: string, pipelineId: string): Promise<{ data: KanbanLead | null, error: any }> {
  try {
    const { data, error } = await supabase
      .from('lead_pipelines')
      .select(`
        *,
        lead:leads(*),
        stage:stages(*)
      `)
      .eq('lead_id', leadId)
      .eq('pipeline_id', pipelineId)
      .single()

    if (error || !data) {
      return { data: null, error }
    }

    // Fetch tags pentru acest lead
    const { data: tagRows } = await supabase
      .from('v_lead_tags')
      .select('lead_id,tags')
      .eq('lead_id', leadId)
      .single()

    const tags = tagRows?.tags || []

    // Fetch stage history
    const { data: historyRow } = await supabase
      .from('stage_history')
      .select('moved_at')
      .eq('lead_id', leadId)
      .eq('to_stage_id', (data as any).stage.id)
      .order('moved_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Fetch technician
    const { data: quotesData } = await supabase
      .from('lead_quotes')
      .select('id')
      .eq('lead_id', leadId)
      .limit(1)
      .maybeSingle()

    let technician: string | null = null
    if (quotesData) {
      const { data: itemsData } = await supabase
        .from('lead_quote_items')
        .select('technician')
        .eq('quote_id', quotesData.id)
        .not('technician', 'is', null)
        .limit(1)
        .single()

      if (itemsData?.technician) {
        technician = itemsData.technician
      }
    }

    // Get pipeline name
    const { data: pipelineData } = await supabase
      .from('pipelines')
      .select('name')
      .eq('id', pipelineId)
      .single()

    const item = data as any
    const kanbanLead: KanbanLead = {
      id: item.lead.id,
      name: item.lead.full_name || 'Unknown',
      email: item.lead.email || '',
      phone: item.lead.phone_number || '',
      stage: item.stage.name,
      createdAt: item.lead.created_at,
      campaignName: item.lead.campaign_name,
      adName: item.lead.ad_name,
      formName: item.lead.form_name,
      leadId: item.lead.id,
      stageId: item.stage.id,
      pipelineId: item.pipeline_id,
      assignmentId: item.id,
      tags: tags as any,
      stageMovedAt: historyRow?.moved_at || undefined,
      technician: technician,
    }

    return { data: kanbanLead, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getKanbanLeads(pipelineId?: string) {
  try {
    // Step 1: Must run first - get lead_pipelines with joins
    let query = supabase
      .from('lead_pipelines')
      .select(`
        id,
        lead_id,
        pipeline_id,
        stage_id,
        lead:leads(id, full_name, email, phone_number, created_at, campaign_name, ad_name, form_name),
        stage:stages(id, name)
      `)

    if (pipelineId) {
      query = query.eq('pipeline_id', pipelineId)
    }

    const { data, error } = await query
    if (error) throw error
    if (!data || data.length === 0) {
      return { data: [], error: null }
    }

    const leadIds = data.map((item: any) => item.lead.id)
    const uniquePipelineIds = [...new Set(data.map((item: any) => item.pipeline_id))]
    
    // Build lead -> stage map for stage history lookup
    const leadStageMap = new Map<string, string>()
    data.forEach((item: any) => {
      leadStageMap.set(item.lead.id, item.stage.id)
    })
    const uniqueStageIds = [...new Set(leadStageMap.values())]

    // Step 2: Run all secondary queries IN PARALLEL
    const [tagsResult, historyResult, pipelinesResult, techniciansResult] = await Promise.all([
      // Tags query
      supabase
        .from('v_lead_tags')
        .select('lead_id, tags')
        .in('lead_id', leadIds),

      // Stage history query
      uniqueStageIds.length > 0
        ? supabase
            .from('stage_history')
            .select('lead_id, moved_at, to_stage_id')
            .in('lead_id', leadIds)
            .in('to_stage_id', uniqueStageIds)
            .order('moved_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),

      // Pipelines query (for department tags)
      supabase
        .from('pipelines')
        .select('id, name')
        .in('id', uniquePipelineIds),

      // Technicians: quotes + items (chained but separate from others)
      (async () => {
        const { data: quotesData } = await supabase
          .from('lead_quotes')
          .select('id, lead_id')
          .in('lead_id', leadIds)

        if (!quotesData || quotesData.length === 0) return new Map<string, string>()

        const quoteIds = quotesData.map((q: any) => q.id)
        const { data: itemsData } = await supabase
          .from('lead_quote_items')
          .select('quote_id, technician')
          .in('quote_id', quoteIds)
          .not('technician', 'is', null)

        if (!itemsData) return new Map<string, string>()

        // Build quote -> lead map
        const quoteToLeadMap = new Map<string, string>()
        quotesData.forEach((q: any) => quoteToLeadMap.set(q.id, q.lead_id))

        // Group technicians by lead
        const leadTechnicians = new Map<string, Set<string>>()
        itemsData.forEach((item: any) => {
          const leadId = quoteToLeadMap.get(item.quote_id)
          if (leadId && item.technician) {
            if (!leadTechnicians.has(leadId)) {
              leadTechnicians.set(leadId, new Set())
            }
            leadTechnicians.get(leadId)!.add(item.technician)
          }
        })

        const techMap = new Map<string, string>()
        leadTechnicians.forEach((techSet, leadId) => {
          const techs = Array.from(techSet).filter(Boolean)
          if (techs.length > 0) techMap.set(leadId, techs.join(', '))
        })
        return techMap
      })()
    ])

    // Process tags
    const tagMap = new Map<string, any[]>(
      (tagsResult.data ?? []).map((r: any) => [r.lead_id, r.tags])
    )

    // Process stage history
    const stageHistoryMap = new Map<string, string>()
    if (historyResult.data) {
      const latestByLeadAndStage = new Map<string, string>()
      historyResult.data.forEach((row: any) => {
        const key = `${row.lead_id}:${row.to_stage_id}`
        if (!latestByLeadAndStage.has(key)) {
          latestByLeadAndStage.set(key, row.moved_at)
        }
      })
      leadIds.forEach((leadId: string) => {
        const currentStageId = leadStageMap.get(leadId)
        if (currentStageId) {
          const movedAt = latestByLeadAndStage.get(`${leadId}:${currentStageId}`)
          if (movedAt) stageHistoryMap.set(leadId, movedAt)
        }
      })
    }

    const technicianMap = techniciansResult

    // Build final kanban leads
    const kanbanLeads: KanbanLead[] = data.map((item: any) => ({
      id: item.lead.id,
      name: item.lead.full_name || 'Unknown',
      email: item.lead.email || '',
      phone: item.lead.phone_number || '',
      stage: item.stage.name,
      createdAt: item.lead.created_at,
      campaignName: item.lead.campaign_name,
      adName: item.lead.ad_name,
      formName: item.lead.form_name,
      leadId: item.lead.id,
      stageId: item.stage.id,
      pipelineId: item.pipeline_id,
      assignmentId: item.id,
      tags: (tagMap.get(item.lead.id) ?? []) as any,
      stageMovedAt: stageHistoryMap.get(item.lead.id) || undefined,
      technician: technicianMap.get(item.lead.id) || null,
    }))

    return { data: kanbanLeads, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function moveLeadToStage(leadId: string, pipelineId: string, newStageId: string) {
  try {
    const { data: currentAssignment, error: fetchError } = await supabase
      .from('lead_pipelines')
      .select('*')
      .eq('lead_id', leadId)
      .eq('pipeline_id', pipelineId)
      .single()

    if (fetchError) throw fetchError

    const fromStageId = currentAssignment.stage_id

    const { data: updatedAssignment, error: updateError } = await supabase
      .from('lead_pipelines')
      .update({ stage_id: newStageId })
      .eq('lead_id', leadId)
      .eq('pipeline_id', pipelineId)
      .select()
      .single()

    if (updateError) throw updateError

    await supabase
      .from('stage_history')
      .insert([{
        lead_id: leadId,
        pipeline_id: pipelineId,
        from_stage_id: fromStageId,
        to_stage_id: newStageId
      }])

    return { data: updatedAssignment, error: null }
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

export async function createLeadWithPipeline(leadData: any, pipelineId: string, stageId: string) {
  try {
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert([leadData])
      .select()
      .single()

    if (leadError) throw leadError

    const { data: assignment, error: assignError } = await supabase
      .from('lead_pipelines')
      .insert([{
        lead_id: lead.id,
        pipeline_id: pipelineId,
        stage_id: stageId
      }])
      .select()
      .single()

    if (assignError) throw assignError

    // atribuie automat tag-ul de departament dupa creare
    const { data: pipeline } = await supabase
      .from('pipelines')
      .select('name')
      .eq('id', pipelineId)
      .single()
    
    if (pipeline?.name) {
      await assignDepartmentTagToLead(lead.id, pipeline.name)
    }

    return { data: { lead, assignment }, error: null }
  } catch (error) {
    return { data: null, error }
  }
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

export async function logLeadEvent(
  leadId: string,
  message: string,
  eventType: string = 'message',
  payload: Record<string, any> = {}
) {
  const supabase = supabaseBrowser()
  const { data: { user } } = await supabase.auth.getUser()
  const actorName =
    (user?.user_metadata as any)?.name ||
    (user?.user_metadata as any)?.full_name ||
    user?.email || null

  const { data, error } = await supabase
    .from("lead_events")
    .insert([{
      lead_id: leadId,
      event_type: eventType,
      message,
      payload,
      actor_id: user?.id ?? null,
      actor_name: actorName,
    }])
    .select("id, lead_id, event_type, message, actor_name, created_at") // ⬅️ return row
    .single()

  if (error) throw error
  return data
}


export async function bulkMoveLeadToPipelinesByNames(
  leadId: string,
  pipelineNames: string[],
  notes?: string
): Promise<BulkMoveResult[]> {
  const { data, error } = await supabase.rpc("bulk_move_lead_to_pipelines_by_names", {
    p_lead_id: leadId,
    p_pipeline_names: pipelineNames,
    p_notes: notes ?? null,
  })
  if (error) throw error

  // Atribuie automat tag-urile de departament pentru fiecare pipeline
  // daca lead-ul este in mai multe pipeline-uri, se va atribui tag-ul primului pipeline care se potriveste
  for (const pipelineName of pipelineNames) {
    await assignDepartmentTagToLead(leadId, pipelineName)
  }

  return (data ?? []) as BulkMoveResult[]
}

export async function autoMoveLeadConfirm(
  leadId: string,
  fromName = "IN LUCRU",
  toName = "DE CONFIRMAT"
) {
  const { data, error } = await supabase.rpc("auto_move_lead_confirm", {
    p_lead_id: leadId,
    p_from_name: fromName,
    p_to_name: toName,
  })
  if (error) throw error
  return data as Array<{
    pipeline_id: string
    pipeline_name: string | null
    from_stage_id: string
    from_stage_name: string
    to_stage_id: string
    to_stage_name: string
  }>
}

export async function moveLeadToStageAllPipelines(leadId: string, stageName: string) {
  const { data, error } = await supabase.rpc('move_lead_to_stage_all_pipelines', {
    p_lead_id: leadId,
    p_stage_name: stageName,
  })
  if (error) throw error
  return data // { moved: [...], skipped: [...] }
}

export async function getReceptieKanbanLeads(
  receptiePipelineId: string,
  sourcePipelineIds: string[],
  stageIds: {
    confirmari?: string | null
    inLucru?: string | null
    asteptare?: string | null
  }
): Promise<{ data: KanbanLead[] | null; error: any }> {
  try {
    const { data, error } = await supabase.rpc('get_receptie_kanban_leads', {
      p_receptie_pipeline_id: receptiePipelineId,
      p_source_pipeline_ids: sourcePipelineIds,
      p_confirmari_stage_id: stageIds.confirmari || null,
      p_in_lucru_stage_id: stageIds.inLucru || null,
      p_asteptare_stage_id: stageIds.asteptare || null,
    })

    if (error) throw error

    const kanbanLeads: KanbanLead[] = (data ?? []).map((row: any) => ({
      id: row.out_id,
      name: row.out_full_name || 'Unknown',
      email: row.out_email || '',
      phone: row.out_phone_number || '',
      stage: row.out_stage_name,
      createdAt: row.out_created_at,
      campaignName: row.out_campaign_name,
      adName: row.out_ad_name,
      formName: row.out_form_name,
      leadId: row.out_lead_id,
      stageId: row.out_stage_id,
      pipelineId: row.out_pipeline_id,
      assignmentId: row.out_assignment_id,
      tags: row.out_tags || [],
      stageMovedAt: row.out_stage_moved_at || undefined,
      technician: row.out_technician || null,
      originalPipelineId: row.out_original_pipeline_id || undefined,
      originalPipelineName: row.out_original_pipeline_name || undefined,
    }))

    return { data: kanbanLeads, error: null }
  } catch (error) {
    return { data: null, error }
  }
}