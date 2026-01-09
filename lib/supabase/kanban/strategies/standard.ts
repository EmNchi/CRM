/**
 * Standard Pipeline Strategy
 * 
 * Handles standard pipelines (e.g., Vanzari) that display leads.
 * This is the simplest strategy - just loads leads from pipeline_items.
 */

import type { PipelineStrategy } from './base'
import type { KanbanItem, KanbanContext, KanbanTag } from '../types'
import { 
  fetchPipelineItems, 
  fetchLeadsByIds, 
  fetchTagsForLeads,
  fetchServiceFilesForLeads,
  fetchTraysForServiceFiles,
  fetchTrayItems,
  fetchServicePrices
} from '../fetchers'
import { loadTechnicianCache } from '../cache'
import { 
  groupPipelineItemsByType, 
  getPipelineItem,
  transformLeadToKanbanItem,
  calculateTrayTotals
} from '../transformers'

export class StandardPipelineStrategy implements PipelineStrategy {
  
  canHandle(context: KanbanContext): boolean {
    // Standard pipelines are those that are NOT receptie, curier, or department
    return !context.pipelineInfo.isReceptie && 
           !context.pipelineInfo.isCurier && 
           !context.pipelineInfo.isDepartment
  }
  
  async loadItems(context: KanbanContext): Promise<KanbanItem[]> {
    // Load technician cache in parallel with pipeline items
    const [_, pipelineItemsResult] = await Promise.all([
      loadTechnicianCache(),
      fetchPipelineItems(context.pipelineId)
    ])
    
    if (pipelineItemsResult.error) {
      throw pipelineItemsResult.error
    }
    
    const pipelineItems = pipelineItemsResult.data
    const { leads, itemMap } = groupPipelineItemsByType(pipelineItems)
    
    // Only process leads for standard pipelines
    if (leads.length === 0) {
      return []
    }
    
    // Fetch leads and calculate their totals
    const [leadsResult, totalsData] = await Promise.all([
      fetchLeadsByIds(leads),
      this.calculateLeadTotals(leads)
    ])
    
    if (leadsResult.error) {
      throw leadsResult.error
    }
    
    // Fetch tags for all leads
    const { data: tagMap } = await fetchTagsForLeads(leads)
    
    // Transform leads to KanbanItems
    const kanbanItems: KanbanItem[] = []
    
    // Sortează leads-urile în ordinea inversă (cel mai nou prim)
    const sortedLeads = [...leadsResult.data].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime()
      const dateB = new Date(b.created_at || 0).getTime()
      return dateB - dateA // Descending: newest first
    })
    
    sortedLeads.forEach(lead => {
      const pipelineItem = getPipelineItem(itemMap, 'lead', lead.id)
      if (!pipelineItem) return
      
      const tags = tagMap.get(lead.id) || []
      const total = totalsData.leadTotals.get(lead.id) || 0
      
      kanbanItems.push(transformLeadToKanbanItem(lead, pipelineItem, tags, total))
    })
    
    return kanbanItems
  }
  
  /**
   * Calculate totals for leads by summing all their service files and trays
   */
  private async calculateLeadTotals(
    leadIds: string[]
  ): Promise<{ leadTotals: Map<string, number> }> {
    const leadTotals = new Map<string, number>()
    
    if (leadIds.length === 0) {
      return { leadTotals }
    }
    
    // Get all service files for these leads
    const { data: serviceFiles } = await fetchServiceFilesForLeads(leadIds)
    if (serviceFiles.length === 0) {
      return { leadTotals }
    }
    
    const serviceFileIds = serviceFiles.map(sf => sf.id)
    
    // Get all trays for these service files
    const { data: trays } = await fetchTraysForServiceFiles(serviceFileIds)
    if (trays.length === 0) {
      return { leadTotals }
    }
    
    const trayIds = trays.map(t => t.id)
    
    // Get tray items and calculate totals
    const { data: trayItems } = await fetchTrayItems(trayIds)
    
    // Get service prices
    const serviceIds = [...new Set(trayItems.map(ti => ti.service_id).filter(Boolean))] as string[]
    const { data: servicePrices } = await fetchServicePrices(serviceIds)
    
    // Calculate tray totals
    const trayTotals = calculateTrayTotals(trayIds, trayItems, servicePrices)
    
    // Aggregate to service file totals
    const sfTotals = new Map<string, number>()
    trays.forEach(t => {
      const trayTotal = trayTotals.get(t.id) || 0
      const currentTotal = sfTotals.get(t.service_file_id) || 0
      sfTotals.set(t.service_file_id, currentTotal + trayTotal)
    })
    
    // Aggregate to lead totals
    serviceFiles.forEach(sf => {
      const sfTotal = sfTotals.get(sf.id) || 0
      const currentTotal = leadTotals.get(sf.lead_id) || 0
      leadTotals.set(sf.lead_id, currentTotal + sfTotal)
    })
    
    return { leadTotals }
  }
}

