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
 * Add or update a pipeline item (generic function)
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
 * Add a lead to a pipeline
 */
export async function addLeadToPipeline(
  leadId: string,
  pipelineId: string,
  stageId: string
): Promise<{ data: any | null; error: any }> {
  return addItemToPipeline('lead', leadId, pipelineId, stageId)
}

/**
 * Add a service file to a pipeline
 */
export async function addServiceFileToPipeline(
  serviceFileId: string,
  pipelineId: string,
  stageId: string
): Promise<{ data: any | null; error: any }> {
  return addItemToPipeline('service_file', serviceFileId, pipelineId, stageId)
}

/**
 * Add a tray to a pipeline
 */
export async function addTrayToPipeline(
  trayId: string,
  pipelineId: string,
  stageId: string
): Promise<{ data: any | null; error: any }> {
  return addItemToPipeline('tray', trayId, pipelineId, stageId)
}

/**
 * Move an item to a different stage within the same pipeline
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
 * Get all pipeline items (optionally filtered)
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
 * Get pipeline item for a specific item
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
 * Remove an item from a pipeline
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
 * Get the first active stage for a pipeline
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
 * Move a lead to a new pipeline
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
 * Move a service file to a new pipeline
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
 * Move a tray to a new pipeline
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
