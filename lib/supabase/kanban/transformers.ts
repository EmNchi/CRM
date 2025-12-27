/**
 * Kanban Transformers
 * 
 * Functions that transform raw data into KanbanItem format.
 * Pure transformation logic - no database calls.
 */

import type { 
  KanbanItem, 
  KanbanTag,
  PipelineItemWithStage,
  RawLead,
  RawServiceFile,
  RawTray,
  RawTrayItem
} from './types'
import { getTechnicianName } from './cache'
import { URGENT_MARKUP_PCT, matchesStagePattern } from './constants'

// ==================== LEAD TRANSFORMER ====================

/**
 * Transform a raw lead into a KanbanItem
 */
export function transformLeadToKanbanItem(
  lead: RawLead,
  pipelineItem: PipelineItemWithStage,
  tags: KanbanTag[] = [],
  total: number = 0
): KanbanItem {
  return {
    id: lead.id,
    name: lead.full_name || 'Unknown',
    email: lead.email || '',
    phone: lead.phone_number || '',
    stage: pipelineItem.stage?.name || '',
    createdAt: lead.created_at,
    campaignName: lead.campaign_name || undefined,
    adName: lead.ad_name || undefined,
    formName: lead.form_name || undefined,
    leadId: lead.id,
    stageId: pipelineItem.stage_id,
    pipelineId: pipelineItem.pipeline_id,
    assignmentId: pipelineItem.id,
    tags,
    stageMovedAt: pipelineItem.updated_at,
    type: 'lead',
    total,
  }
}

// ==================== SERVICE FILE TRANSFORMER ====================

/**
 * Transform a raw service file into a KanbanItem
 */
export function transformServiceFileToKanbanItem(
  serviceFile: RawServiceFile,
  pipelineItem: PipelineItemWithStage,
  tags: KanbanTag[] = [],
  total: number = 0,
  isReadOnly: boolean = false
): KanbanItem {
  const lead = serviceFile.lead
  
  return {
    id: serviceFile.id,
    name: lead?.full_name || 'Unknown',
    email: lead?.email || '',
    phone: lead?.phone_number || '',
    stage: pipelineItem.stage?.name || '',
    createdAt: serviceFile.created_at,
    campaignName: lead?.campaign_name || undefined,
    adName: lead?.ad_name || undefined,
    formName: lead?.form_name || undefined,
    leadId: lead?.id,
    stageId: pipelineItem.stage_id,
    pipelineId: pipelineItem.pipeline_id,
    assignmentId: pipelineItem.id,
    tags,
    stageMovedAt: pipelineItem.updated_at,
    type: 'service_file',
    serviceFileNumber: serviceFile.number,
    serviceFileStatus: serviceFile.status,
    isReadOnly,
    total,
  }
}

// ==================== TRAY TRANSFORMER ====================

/**
 * Transform a raw tray into a KanbanItem
 */
export function transformTrayToKanbanItem(
  tray: RawTray,
  pipelineItem: PipelineItemWithStage,
  tags: KanbanTag[] = [],
  technician: string | null = null,
  total: number = 0,
  isReadOnly: boolean = false
): KanbanItem {
  const lead = tray.service_file?.lead
  const stageName = pipelineItem.stage?.name?.toUpperCase() || ''
  
  // Calculate in_lucru_since and in_asteptare_since based on current stage
  const isInLucru = matchesStagePattern(stageName, 'IN_LUCRU')
  const isInAsteptare = matchesStagePattern(stageName, 'IN_ASTEPTARE')
  
  return {
    id: tray.id,
    name: lead?.full_name || 'Unknown',
    email: lead?.email || '',
    phone: lead?.phone_number || '',
    stage: pipelineItem.stage?.name || '',
    createdAt: tray.created_at,
    campaignName: lead?.campaign_name || undefined,
    adName: lead?.ad_name || undefined,
    formName: lead?.form_name || undefined,
    leadId: lead?.id,
    stageId: pipelineItem.stage_id,
    pipelineId: pipelineItem.pipeline_id,
    assignmentId: pipelineItem.id,
    tags,
    stageMovedAt: pipelineItem.updated_at,
    technician,
    type: 'tray',
    trayNumber: tray.number,
    traySize: tray.size,
    trayStatus: tray.status,
    total,
    isReadOnly,
    inLucruSince: isInLucru ? pipelineItem.updated_at : undefined,
    inAsteptareSince: isInAsteptare ? pipelineItem.updated_at : undefined,
  }
}

// ==================== TECHNICIAN EXTRACTION ====================

/**
 * Extract technician mapping from tray items
 * Returns a map of tray_id -> technician name
 */
export function extractTechnicianMap(
  trayItems: RawTrayItem[]
): Map<string, string> {
  const technicianMap = new Map<string, string>()
  
  trayItems.forEach(ti => {
    if (!technicianMap.has(ti.tray_id) && ti.technician_id) {
      const techName = getTechnicianName(ti.technician_id)
      technicianMap.set(ti.tray_id, techName)
    }
  })
  
  return technicianMap
}

// ==================== TOTAL CALCULATION ====================

interface TrayItemWithParsedNotes extends RawTrayItem {
  parsedNotes?: {
    price?: number
    discount_pct?: number
    urgent?: boolean
    item_type?: 'service' | 'part'
  }
}

/**
 * Calculate total for a single tray
 */
export function calculateTrayTotal(
  trayId: string,
  trayItems: RawTrayItem[],
  servicePrices: Map<string, number>,
  subscriptionType: string = ''
): number {
  const items = trayItems.filter(ti => ti.tray_id === trayId)
  
  // Filter visible items (those with item_type in notes)
  const visibleItems = items.filter(ti => {
    if (!ti.notes) return true
    try {
      const notesData = JSON.parse(ti.notes)
      return notesData.item_type !== null && notesData.item_type !== undefined
    } catch {
      return true
    }
  })
  
  let subtotal = 0
  let totalDiscount = 0
  let urgentAmount = 0
  let servicesTotal = 0
  let partsTotal = 0
  
  visibleItems.forEach(ti => {
    const qty = ti.qty || 1
    let itemPrice = 0
    let discountPct = 0
    let isUrgent = false
    let itemType: 'service' | 'part' | null = null
    
    // Parse notes if JSON
    if (ti.notes) {
      try {
        const notesData = JSON.parse(ti.notes)
        itemPrice = notesData.price || 0
        discountPct = notesData.discount_pct || 0
        isUrgent = notesData.urgent || false
        itemType = notesData.item_type || null
      } catch {
        // Notes is not JSON
      }
    }
    
    // Fallback to service price
    if (!itemPrice && ti.service_id) {
      itemPrice = servicePrices.get(ti.service_id) || 0
      if (!itemType) itemType = 'service'
    }
    
    if (!itemType && !ti.service_id) {
      itemType = 'part'
    }
    
    const base = qty * itemPrice
    const disc = base * (Math.min(100, Math.max(0, discountPct)) / 100)
    const afterDisc = base - disc
    const urgent = isUrgent ? afterDisc * (URGENT_MARKUP_PCT / 100) : 0
    
    subtotal += base
    totalDiscount += disc
    urgentAmount += urgent
    
    const itemTotal = afterDisc + urgent
    if (itemType === 'service') {
      servicesTotal += itemTotal
    } else if (itemType === 'part') {
      partsTotal += itemTotal
    }
  })
  
  // Apply subscription discounts
  let subscriptionDiscount = 0
  if (subscriptionType === 'services' || subscriptionType === 'both') {
    subscriptionDiscount += servicesTotal * 0.10
  }
  if (subscriptionType === 'parts' || subscriptionType === 'both') {
    subscriptionDiscount += partsTotal * 0.05
  }
  
  return Math.max(0, subtotal - totalDiscount + urgentAmount - subscriptionDiscount)
}

/**
 * Calculate totals for multiple trays
 * Returns a map of tray_id -> total
 */
export function calculateTrayTotals(
  trayIds: string[],
  trayItems: RawTrayItem[],
  servicePrices: Map<string, number>
): Map<string, number> {
  const totalsMap = new Map<string, number>()
  
  trayIds.forEach(trayId => {
    totalsMap.set(trayId, calculateTrayTotal(trayId, trayItems, servicePrices))
  })
  
  return totalsMap
}

// ==================== TRAY FILTERING ====================

/**
 * Filter trays for department pipelines based on technician assignment
 * Rules:
 * - User can see trays where they have at least one item assigned
 * - User can see trays with no technician assigned
 * - Trays in "Noua" stage are NOT visible to the assigned technician
 */
export function filterTraysForUser(
  trayIds: string[],
  trayItems: RawTrayItem[],
  pipelineItems: PipelineItemWithStage[],
  currentUserId: string
): string[] {
  // Build map of tray -> set of technician IDs
  const trayTechnicianMap = new Map<string, Set<string | null>>()
  
  trayItems.forEach(ti => {
    if (!trayTechnicianMap.has(ti.tray_id)) {
      trayTechnicianMap.set(ti.tray_id, new Set())
    }
    trayTechnicianMap.get(ti.tray_id)!.add(ti.technician_id || null)
  })
  
  // Build map of tray -> stage name
  const trayStageMap = new Map<string, string>()
  pipelineItems.forEach(pi => {
    if (pi.type === 'tray' && pi.stage) {
      trayStageMap.set(pi.item_id, pi.stage.name?.toLowerCase() || '')
    }
  })
  
  return trayIds.filter(trayId => {
    const techIds = trayTechnicianMap.get(trayId)
    const stageName = trayStageMap.get(trayId) || ''
    const isNouaStage = matchesStagePattern(stageName, 'NOUA')
    
    // If no items for this tray, include it (empty tray)
    if (!techIds || techIds.size === 0) {
      return true
    }
    
    // Check if current user has at least one item assigned
    if (techIds.has(currentUserId)) {
      // EXCEPTION: If tray is in "Noua" stage and assigned to technician, exclude it
      if (isNouaStage) {
        return false
      }
      return true
    }
    
    // Check if all items have no technician (visible to all)
    const hasOnlyNullTechnicians = techIds.size === 1 && techIds.has(null)
    if (hasOnlyNullTechnicians) {
      return true
    }
    
    return false
  })
}

// ==================== PIPELINE ITEM GROUPING ====================

/**
 * Group pipeline items by type
 */
export function groupPipelineItemsByType(
  pipelineItems: PipelineItemWithStage[]
): {
  leads: string[]
  serviceFiles: string[]
  trays: string[]
  itemMap: Map<string, PipelineItemWithStage>
} {
  const leads: string[] = []
  const serviceFiles: string[] = []
  const trays: string[] = []
  const itemMap = new Map<string, PipelineItemWithStage>()
  
  pipelineItems.forEach(item => {
    const key = `${item.type}:${item.item_id}`
    itemMap.set(key, item)
    
    if (item.type === 'lead') leads.push(item.item_id)
    else if (item.type === 'service_file') serviceFiles.push(item.item_id)
    else if (item.type === 'tray') trays.push(item.item_id)
  })
  
  return { leads, serviceFiles, trays, itemMap }
}

/**
 * Get pipeline item from map
 */
export function getPipelineItem(
  itemMap: Map<string, PipelineItemWithStage>,
  type: string,
  itemId: string
): PipelineItemWithStage | undefined {
  return itemMap.get(`${type}:${itemId}`)
}

