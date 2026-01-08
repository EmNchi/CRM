/**
 * Department Pipeline Strategy
 * 
 * Handles department pipelines (Saloane, Horeca, Frizerii, Reparatii).
 * These pipelines display trays assigned to the department.
 * Special filtering applies for non-admin users (see only their assigned trays).
 */

import { supabaseBrowser } from '../../supabaseClient'
import type { PipelineStrategy } from './base'
import type { KanbanItem, KanbanContext, PipelineItemWithStage } from '../types'
import { 
  fetchPipelineItems, 
  fetchTraysByIds, 
  fetchTrayItems,
  fetchTagsForLeads,
  fetchServicePrices,
  fetchTrayItemsByDepartment,
  createPipelineItems
} from '../fetchers'
import { loadTechnicianCache, getStagesForPipeline } from '../cache'
import { 
  groupPipelineItemsByType, 
  getPipelineItem,
  transformTrayToKanbanItem,
  extractTechnicianMap,
  calculateTrayTotals,
  filterTraysForUser
} from '../transformers'
import { findStageByPattern } from '../constants'

export class DepartmentPipelineStrategy implements PipelineStrategy {
  
  canHandle(context: KanbanContext): boolean {
    return context.pipelineInfo.isDepartment
  }
  
  async loadItems(context: KanbanContext): Promise<KanbanItem[]> {
    // Load technician cache in parallel with initial data
    const [_, pipelineItemsResult] = await Promise.all([
      loadTechnicianCache(),
      fetchPipelineItems(context.pipelineId)
    ])
    
    if (pipelineItemsResult.error) {
      throw pipelineItemsResult.error
    }
    
    let pipelineItems = pipelineItemsResult.data
    let { trays, itemMap } = groupPipelineItemsByType(pipelineItems)
    
    // Auto-create pipeline_items for trays that belong to this department
    // but don't have a pipeline_item yet
    const autoCreatedItems = await this.autoCreateMissingTrayItems(
      context,
      pipelineItems,
      trays
    )
    
    if (autoCreatedItems.length > 0) {
      // Merge auto-created items
      autoCreatedItems.forEach(item => {
        const key = `tray:${item.item_id}`
        itemMap.set(key, item as PipelineItemWithStage)
        trays.push(item.item_id)
      })
    }
    
    if (trays.length === 0) {
      return []
    }
    
    // Fetch tray items first (needed for filtering and technician mapping)
    const { data: trayItems } = await fetchTrayItems(trays)
    
    // Filter trays for non-admin users
    let filteredTrayIds = trays
    if (context.currentUserId && !context.isAdminOrOwner) {
      filteredTrayIds = filterTraysForUser(
        trays, 
        trayItems, 
        pipelineItems,
        context.currentUserId
      )
    }
    
    if (filteredTrayIds.length === 0) {
      return []
    }
    
    // Fetch remaining data in parallel
    const [traysResult, servicePricesResult] = await Promise.all([
      fetchTraysByIds(filteredTrayIds),
      this.getServicePrices(trayItems)
    ])
    
    if (traysResult.error) {
      throw traysResult.error
    }
    
    // Get all lead IDs for tag fetching
    const leadIds = traysResult.data
      .map(t => t.service_file?.lead?.id)
      .filter(Boolean) as string[]
    
    const { data: tagMap } = await fetchTagsForLeads(leadIds)
    
    // Calculate totals and extract technicians
    const trayTotals = calculateTrayTotals(filteredTrayIds, trayItems, servicePricesResult)
    const technicianMap = extractTechnicianMap(trayItems)
    
    // Transform to KanbanItems
    const kanbanItems: KanbanItem[] = []
    
    traysResult.data.forEach(tray => {
      const pipelineItem = getPipelineItem(itemMap, 'tray', tray.id)
      if (!pipelineItem || !tray.service_file?.lead) return
      
      const leadId = tray.service_file.lead.id
      const leadTagsRaw = tagMap.get(leadId) || []
      const leadTags = Array.isArray(leadTagsRaw) ? leadTagsRaw : []
      
      // IMPORTANT: Pentru tăvițe, tag-ul "urgent" vine din câmpul urgent al fișei de serviciu, nu din tag-urile lead-ului
      // Filtrează tag-ul "urgent" din tag-urile lead-ului și adaugă-l doar dacă fișa are urgent = true
      const tagsWithoutUrgent = leadTags.filter(tag => tag?.name?.toLowerCase() !== 'urgent')
      const trayTags = [...tagsWithoutUrgent]
      
      // Adaugă tag-ul "urgent" doar dacă fișa de serviciu are urgent = true
      if (tray.service_file?.urgent === true) {
        // Caută tag-ul "urgent" în lista de tag-uri existente sau creează unul nou
        const urgentTag = leadTags.find(tag => tag?.name?.toLowerCase() === 'urgent')
        if (urgentTag) {
          trayTags.push(urgentTag)
        } else {
          // Creează un tag "urgent" temporar pentru afișare
          trayTags.push({
            id: `urgent_${tray.id}`,
            name: 'URGENT',
            color: 'red' as const
          })
        }
      }
      
      const technician = technicianMap.get(tray.id) || null
      const total = trayTotals.get(tray.id) || 0
      
      kanbanItems.push(transformTrayToKanbanItem(
        tray,
        pipelineItem,
        trayTags,
        technician,
        total,
        false // Not read-only in department pipelines
      ))
    })
    
    return kanbanItems
  }
  
  /**
   * Auto-create pipeline_items for trays that belong to this department
   * but don't have a pipeline_item yet
   */
  private async autoCreateMissingTrayItems(
    context: KanbanContext,
    existingPipelineItems: PipelineItemWithStage[],
    existingTrayIds: string[]
  ): Promise<any[]> {
    // Find all trays that have tray_items with department_id = pipelineId
    const { data: deptTrayItems } = await fetchTrayItemsByDepartment(context.pipelineId)
    
    if (!deptTrayItems || deptTrayItems.length === 0) {
      return []
    }
    
    // Get unique tray IDs from department
    const deptTrayIds = [...new Set(deptTrayItems.map(ti => ti.tray_id).filter(Boolean))]
    
    // Find which ones don't have pipeline_items yet
    const existingSet = new Set(existingTrayIds)
    const missingTrayIds = deptTrayIds.filter(id => !existingSet.has(id))
    
    if (missingTrayIds.length === 0) {
      return []
    }
    
    // Find the "Noua" stage (or first stage) for this pipeline
    const pipelineStages = getStagesForPipeline(context.allStages, context.pipelineId)
    let defaultStage = findStageByPattern(pipelineStages, 'NOUA')
    if (!defaultStage && pipelineStages.length > 0) {
      defaultStage = pipelineStages[0]
    }
    
    if (!defaultStage) {
      return []
    }
    
    // Create pipeline_items for missing trays
    const itemsToCreate = missingTrayIds.map(trayId => ({
      type: 'tray',
      item_id: trayId,
      pipeline_id: context.pipelineId,
      stage_id: defaultStage!.id
    }))
    
    const { data: createdItems } = await createPipelineItems(itemsToCreate)
    
    return createdItems || []
  }
  
  /**
   * Get service prices for tray items
   */
  private async getServicePrices(
    trayItems: Array<{ service_id: string | null }>
  ): Promise<Map<string, number>> {
    const serviceIds = [...new Set(
      trayItems.map(ti => ti.service_id).filter(Boolean)
    )] as string[]
    
    if (serviceIds.length === 0) {
      return new Map()
    }
    
    const { data: prices } = await fetchServicePrices(serviceIds)
    return prices
  }
}

