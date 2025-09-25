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

export async function getKanbanLeads(pipelineId?: string) {
  try {
    let query = supabase
      .from('lead_pipelines')
      .select(`
        *,
        lead:leads(*),
        stage:stages(*)
      `)

    if (pipelineId) {
      query = query.eq('pipeline_id', pipelineId)
    }

    const { data, error } = await query
    if (error) throw error

    const leadIds = (data ?? []).map((item: any) => item.lead.id)

    // fetch tags for all these leads in one shot
    let tagMap = new Map<string, any[]>()
    if (leadIds.length) {
      const { data: tagRows, error: tagErr } = await supabase
        .from('v_lead_tags')
        .select('lead_id,tags')
        .in('lead_id', leadIds)
      if (tagErr) throw tagErr
      tagMap = new Map((tagRows ?? []).map((r: any) => [r.lead_id, r.tags]))
    }

    const kanbanLeads: KanbanLead[] = (data ?? []).map((item: any) => ({
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
      // NEW:
      tags: (tagMap.get(item.lead.id) ?? []) as any,
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