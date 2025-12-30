/**
 * Kanban Types
 * 
 * Centralized type definitions for the Kanban system.
 * This file contains all interfaces and types used across the kanban module.
 */

// ==================== PIPELINE ITEM TYPES ====================

export type PipelineItemType = 'lead' | 'service_file' | 'tray'

export interface PipelineItem {
  id: string
  type: PipelineItemType
  item_id: string
  pipeline_id: string
  stage_id: string
  created_at: string
  updated_at: string
}

export interface PipelineItemWithStage extends PipelineItem {
  stage: {
    id: string
    name: string
  } | null
  isReadOnly?: boolean
}

// ==================== KANBAN ITEM (OUTPUT) ====================

export interface KanbanItem {
  id: string
  name: string
  email: string
  phone: string
  stage: string
  createdAt: string
  campaignName?: string
  adName?: string
  formName?: string
  leadId?: string
  stageId: string
  pipelineId: string
  assignmentId: string
  tags?: KanbanTag[]
  stageMovedAt?: string
  technician?: string | null
  type: PipelineItemType
  // Service file specific
  serviceFileNumber?: string
  serviceFileStatus?: string
  // Tray specific
  trayNumber?: string
  traySize?: string
  trayStatus?: string
  // Totals
  total?: number
  // Read-only flag
  isReadOnly?: boolean
  // Timestamps for specific stages
  inLucruSince?: string
  inAsteptareSince?: string
  // Câmpuri adresă și companie
  city?: string | null
  company_name?: string | null
  company_address?: string | null
  address?: string | null
  address2?: string | null
  zip?: string | null
}

export interface KanbanTag {
  id: string
  name: string
  color: 'green' | 'yellow' | 'red' | 'blue' | 'orange'
}

// ==================== RAW DATA TYPES ====================

export interface RawLead {
  id: string
  full_name: string | null
  email: string | null
  phone_number: string | null
  created_at: string
  campaign_name?: string | null
  ad_name?: string | null
  form_name?: string | null
  tray_details?: any
  city?: string | null
  company_name?: string | null
  company_address?: string | null
  address?: string | null
  address2?: string | null
  zip?: string | null
}

export interface RawServiceFile {
  id: string
  lead_id: string
  number: string
  status: string
  created_at: string
  office_direct?: boolean
  curier_trimis?: boolean
  lead?: RawLead | null
}

export interface RawTray {
  id: string
  number: string
  size: string
  status: string
  created_at: string
  service_file_id: string
  service_file?: {
    lead_id: string
    lead?: RawLead | null
  } | null
}

export interface RawTrayItem {
  tray_id: string
  technician_id: string | null
  notes: string | null
  qty: number
  service_id: string | null
}

// ==================== PIPELINE CONTEXT ====================

export interface PipelineInfo {
  id: string
  name: string
  isReceptie: boolean
  isCurier: boolean
  isDepartment: boolean
}

export interface KanbanContext {
  pipelineId: string
  pipelineInfo: PipelineInfo
  currentUserId?: string
  isAdminOrOwner: boolean
  allPipelines: Array<{ id: string; name: string }>
  allStages: Array<{ id: string; name: string; pipeline_id: string }>
}

// ==================== RESULT TYPES ====================

export interface KanbanResult {
  data: KanbanItem[]
  error: any
}

export interface DataFetchResult<T> {
  data: T | null
  error: any
}

// ==================== MOVE RESULT TYPE ====================

export type MoveItemResult = {
  ok: true
  data: {
    pipeline_item_id: string
    new_stage_id: string
  }[]
} | {
  ok: false
  code?: string
  message?: string
}
