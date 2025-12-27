/**
 * Kanban Data Fetchers
 * 
 * Pure data fetching functions that retrieve raw data from Supabase.
 * These functions do NOT contain business logic - they just fetch data.
 */

import { supabaseBrowser } from '../supabaseClient'
import type { 
  PipelineItemWithStage, 
  RawLead, 
  RawServiceFile, 
  RawTray,
  RawTrayItem,
  KanbanTag
} from './types'

// ==================== PIPELINE ITEMS ====================

/**
 * Fetch all pipeline items for a pipeline with stage info
 */
export async function fetchPipelineItems(
  pipelineId: string
): Promise<{ data: PipelineItemWithStage[]; error: any }> {
  const supabase = supabaseBrowser()
  
  const { data, error } = await supabase
    .from('pipeline_items')
    .select(`
      id, type, item_id, pipeline_id, stage_id, created_at, updated_at,
      stage:stages(id, name)
    `)
    .eq('pipeline_id', pipelineId)
  
  if (error) return { data: [], error }
  return { data: (data || []) as PipelineItemWithStage[], error: null }
}

/**
 * Fetch a single pipeline item
 */
export async function fetchSinglePipelineItem(
  type: string,
  itemId: string,
  pipelineId: string
): Promise<{ data: PipelineItemWithStage | null; error: any }> {
  const supabase = supabaseBrowser()
  
  const { data, error } = await supabase
    .from('pipeline_items')
    .select(`
      id, type, item_id, pipeline_id, stage_id, created_at, updated_at,
      stage:stages(id, name)
    `)
    .eq('type', type)
    .eq('item_id', itemId)
    .eq('pipeline_id', pipelineId)
    .single()
  
  if (error) return { data: null, error }
  return { data: data as PipelineItemWithStage, error: null }
}

// ==================== LEADS ====================

/**
 * Fetch leads by IDs
 */
export async function fetchLeadsByIds(
  leadIds: string[]
): Promise<{ data: RawLead[]; error: any }> {
  if (leadIds.length === 0) return { data: [], error: null }
  
  const supabase = supabaseBrowser()
  
  const { data, error } = await supabase
    .from('leads')
    .select('id, full_name, email, phone_number, created_at, campaign_name, ad_name, form_name, tray_details')
    .in('id', leadIds)
  
  if (error) return { data: [], error }
  return { data: (data || []) as RawLead[], error: null }
}

// ==================== SERVICE FILES ====================

/**
 * Fetch service files by IDs with lead data
 */
export async function fetchServiceFilesByIds(
  serviceFileIds: string[]
): Promise<{ data: RawServiceFile[]; error: any }> {
  if (serviceFileIds.length === 0) return { data: [], error: null }
  
  const supabase = supabaseBrowser()
  
  const { data, error } = await supabase
    .from('service_files')
    .select(`
      id, lead_id, number, status, created_at,
      lead:leads(id, full_name, email, phone_number, created_at, campaign_name, ad_name, form_name, tray_details)
    `)
    .in('id', serviceFileIds)
  
  if (error) return { data: [], error }
  return { data: (data || []) as RawServiceFile[], error: null }
}

/**
 * Fetch all service files for given lead IDs
 */
export async function fetchServiceFilesForLeads(
  leadIds: string[]
): Promise<{ data: Array<{ id: string; lead_id: string }>; error: any }> {
  if (leadIds.length === 0) return { data: [], error: null }
  
  const supabase = supabaseBrowser()
  
  const { data, error } = await supabase
    .from('service_files')
    .select('id, lead_id')
    .in('lead_id', leadIds)
  
  if (error) return { data: [], error }
  return { data: data || [], error: null }
}

// ==================== TRAYS ====================

/**
 * Fetch trays by IDs with service file and lead data
 */
export async function fetchTraysByIds(
  trayIds: string[]
): Promise<{ data: RawTray[]; error: any }> {
  if (trayIds.length === 0) return { data: [], error: null }
  
  const supabase = supabaseBrowser()
  
  const { data, error } = await supabase
    .from('trays')
    .select(`
      id, number, size, status, created_at, service_file_id,
      service_file:service_files!inner(lead_id, lead:leads!inner(id, full_name, email, phone_number, created_at, campaign_name, ad_name, form_name, tray_details))
    `)
    .in('id', trayIds)
  
  if (error) return { data: [], error }
  return { data: (data || []) as RawTray[], error: null }
}

/**
 * Fetch all trays for given service file IDs
 */
export async function fetchTraysForServiceFiles(
  serviceFileIds: string[]
): Promise<{ data: Array<{ id: string; service_file_id: string }>; error: any }> {
  if (serviceFileIds.length === 0) return { data: [], error: null }
  
  const supabase = supabaseBrowser()
  
  const { data, error } = await supabase
    .from('trays')
    .select('id, service_file_id')
    .in('service_file_id', serviceFileIds)
  
  if (error) return { data: [], error }
  return { data: data || [], error: null }
}

// ==================== TRAY ITEMS ====================

/**
 * Fetch tray items for given tray IDs
 */
export async function fetchTrayItems(
  trayIds: string[]
): Promise<{ data: RawTrayItem[]; error: any }> {
  if (trayIds.length === 0) return { data: [], error: null }
  
  const supabase = supabaseBrowser()
  
  const { data, error } = await supabase
    .from('tray_items')
    .select('tray_id, technician_id, notes, qty, service_id')
    .in('tray_id', trayIds)
  
  if (error) return { data: [], error }
  return { data: (data || []) as RawTrayItem[], error: null }
}

/**
 * Fetch tray items filtered by department
 */
export async function fetchTrayItemsByDepartment(
  departmentId: string
): Promise<{ data: Array<{ tray_id: string }>; error: any }> {
  const supabase = supabaseBrowser()
  
  const { data, error } = await supabase
    .from('tray_items')
    .select('tray_id')
    .eq('department_id', departmentId)
  
  if (error) return { data: [], error }
  return { data: data || [], error: null }
}

// ==================== TAGS ====================

/**
 * Fetch tags for given lead IDs
 */
export async function fetchTagsForLeads(
  leadIds: string[]
): Promise<{ data: Map<string, KanbanTag[]>; error: any }> {
  if (leadIds.length === 0) return { data: new Map(), error: null }
  
  const supabase = supabaseBrowser()
  
  const { data, error } = await supabase
    .from('v_lead_tags')
    .select('lead_id, tags')
    .in('lead_id', leadIds)
  
  if (error) return { data: new Map(), error }
  
  const tagMap = new Map<string, KanbanTag[]>()
  if (data) {
    data.forEach((r: any) => tagMap.set(r.lead_id, r.tags || []))
  }
  
  return { data: tagMap, error: null }
}

// ==================== SERVICES (for pricing) ====================

/**
 * Fetch service prices by IDs
 */
export async function fetchServicePrices(
  serviceIds: string[]
): Promise<{ data: Map<string, number>; error: any }> {
  if (serviceIds.length === 0) return { data: new Map(), error: null }
  
  const supabase = supabaseBrowser()
  
  const { data, error } = await supabase
    .from('services')
    .select('id, price')
    .in('id', serviceIds)
  
  if (error) return { data: new Map(), error }
  
  const priceMap = new Map<string, number>()
  if (data) {
    data.forEach((s: any) => priceMap.set(s.id, s.price || 0))
  }
  
  return { data: priceMap, error: null }
}

// ==================== STAGES ====================

/**
 * Fetch stages for a pipeline
 */
export async function fetchStagesForPipeline(
  pipelineId: string
): Promise<{ data: Array<{ id: string; name: string }>; error: any }> {
  const supabase = supabaseBrowser()
  
  const { data, error } = await supabase
    .from('stages')
    .select('id, name')
    .eq('pipeline_id', pipelineId)
  
  if (error) return { data: [], error }
  return { data: data || [], error: null }
}

/**
 * Fetch stages by IDs
 */
export async function fetchStagesByIds(
  stageIds: string[]
): Promise<{ data: Array<{ id: string; name: string; pipeline_id: string }>; error: any }> {
  if (stageIds.length === 0) return { data: [], error: null }
  
  const supabase = supabaseBrowser()
  
  const { data, error } = await supabase
    .from('stages')
    .select('id, name, pipeline_id')
    .in('id', stageIds)
  
  if (error) return { data: [], error }
  return { data: data || [], error: null }
}

// ==================== PIPELINE ITEM MUTATIONS ====================

/**
 * Create pipeline items in bulk
 */
export async function createPipelineItems(
  items: Array<{ type: string; item_id: string; pipeline_id: string; stage_id: string }>
): Promise<{ data: any[]; error: any }> {
  if (items.length === 0) return { data: [], error: null }
  
  const supabase = supabaseBrowser()
  
  const { data, error } = await supabase
    .from('pipeline_items')
    .insert(items)
    .select()
  
  if (error) return { data: [], error }
  return { data: data || [], error: null }
}

