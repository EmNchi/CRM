/**
 * Receptie Pipeline Strategy
 * 
 * Handles the Receptie pipeline which displays service files.
 * Also handles "virtual" service files based on trays in department pipelines
 * that are in specific stages (In Lucru, In Asteptare, Finalizare).
 */

import { supabaseBrowser } from '../../supabaseClient'
import type { PipelineStrategy } from './base'
import type { KanbanItem, KanbanContext, PipelineItemWithStage, RawServiceFile } from '../types'
import { 
  fetchPipelineItems, 
  fetchServiceFilesByIds,
  fetchTagsForLeads,
  fetchTrayItems,
  fetchServicePrices,
  fetchTraysForServiceFiles,
  fetchStagesForPipeline
} from '../fetchers'
import { loadTechnicianCache } from '../cache'
import { 
  groupPipelineItemsByType, 
  getPipelineItem,
  transformServiceFileToKanbanItem,
  calculateTrayTotals
} from '../transformers'
import { 
  DEPARTMENT_PIPELINES, 
  findStageByPattern,
  matchesStagePattern 
} from '../constants'

export class ReceptiePipelineStrategy implements PipelineStrategy {
  
  canHandle(context: KanbanContext): boolean {
    return context.pipelineInfo.isReceptie
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
    let { serviceFiles, itemMap } = groupPipelineItemsByType(pipelineItems)
    
    // Fetch Receptie stages for virtual item mapping
    const receptieStages = await this.getReceptieStages(context.pipelineId)
    
    // IMPORTANT: Load service files with office_direct or curier_trimis directly from DB
    // even if they're not in pipeline_items yet
    const supabase = supabaseBrowser()
    const { data: directServiceFiles } = await supabase
      .from('service_files')
      .select(`
        id, lead_id, number, status, created_at, office_direct, curier_trimis,
        lead:leads(id, full_name, email, phone_number, created_at, campaign_name, ad_name, form_name, tray_details, city, company_name, company_address, address, address2, zip)
      `)
      .or('office_direct.eq.true,curier_trimis.eq.true')
    
    // Add direct service files to the list if not already present
    if (directServiceFiles && directServiceFiles.length > 0) {
      directServiceFiles.forEach((sf: any) => {
        if (!serviceFiles.includes(sf.id)) {
          serviceFiles.push(sf.id)
        }
        // Create pipeline item if it doesn't exist
        const existingItem = itemMap.get(`service_file:${sf.id}`)
        if (!existingItem) {
          // Find appropriate stage based on checkbox
          let targetStage = receptieStages.find(s => {
            const nameLower = s.name.toLowerCase()
            if (sf.office_direct && (nameLower.includes('office') && nameLower.includes('direct'))) {
              return true
            }
            if (sf.curier_trimis && (nameLower.includes('curier') && nameLower.includes('trimis'))) {
              return true
            }
            return false
          })
          // Fallback to first active stage if no match
          if (!targetStage) {
            targetStage = receptieStages.find(s => s.name) || receptieStages[0]
          }
          if (targetStage) {
            const virtualItem: PipelineItemWithStage = {
              id: `virtual_${sf.id}`,
              type: 'service_file',
              item_id: sf.id,
              pipeline_id: context.pipelineId,
              stage_id: targetStage.id,
              created_at: sf.created_at,
              updated_at: new Date().toISOString(),
              stage: targetStage,
              isReadOnly: false
            }
            itemMap.set(`service_file:${sf.id}`, virtualItem)
          }
        }
      })
    }
    
    // Get virtual service files from department pipelines
    const virtualItems = await this.loadVirtualServiceFiles(
      context,
      serviceFiles,
      receptieStages,
      itemMap
    )
    
    // Merge virtual items
    virtualItems.serviceFiles.forEach(sf => {
      if (!serviceFiles.includes(sf.id)) {
        serviceFiles.push(sf.id)
      }
    })
    
    virtualItems.pipelineItems.forEach(pi => {
      itemMap.set(`service_file:${pi.item_id}`, pi)
    })
    
    if (serviceFiles.length === 0) {
      return []
    }
    
    // Fetch service files (excluding those already in virtualItems and directServiceFiles)
    const sfIdsToFetch = serviceFiles.filter(
      id => !virtualItems.serviceFileData.has(id) && 
            !(directServiceFiles?.some((sf: any) => sf.id === id))
    )
    
    const { data: fetchedServiceFiles } = await fetchServiceFilesByIds(sfIdsToFetch)
    
    // Merge service file data
    const allServiceFiles: RawServiceFile[] = [
      ...fetchedServiceFiles,
      ...Array.from(virtualItems.serviceFileData.values()),
      ...(directServiceFiles || [])
    ]
    
    // Filter service files: Receptie should show those with office_direct = true OR curier_trimis = true
    const filteredServiceFiles = allServiceFiles.filter(sf => {
      // For Receptie, show service files with office_direct = true or curier_trimis = true
      return sf.office_direct === true || sf.curier_trimis === true
    })
    
    // Get all lead IDs for tags
    const leadIds = filteredServiceFiles
      .map(sf => sf.lead?.id)
      .filter(Boolean) as string[]
    
    // Fetch tags and calculate totals
    const [{ data: tagMap }, totalsData] = await Promise.all([
      fetchTagsForLeads(leadIds),
      this.calculateServiceFileTotals(filteredServiceFiles.map(sf => sf.id))
    ])
    
    // Transform to KanbanItems
    const kanbanItems: KanbanItem[] = []
    
    filteredServiceFiles.forEach(serviceFile => {
      const pipelineItem = getPipelineItem(itemMap, 'service_file', serviceFile.id)
      if (!pipelineItem || !serviceFile.lead) return
      
      const leadId = serviceFile.lead.id
      const tags = tagMap.get(leadId) || []
      const total = totalsData.get(serviceFile.id) || 0
      const isReadOnly = (pipelineItem as any).isReadOnly || false
      
      kanbanItems.push(transformServiceFileToKanbanItem(
        serviceFile,
        pipelineItem,
        tags,
        total,
        isReadOnly
      ))
    })
    
    return kanbanItems
  }
  
  /**
   * Get stages for the Receptie pipeline
   */
  private async getReceptieStages(
    pipelineId: string
  ): Promise<Array<{ id: string; name: string }>> {
    const { data } = await fetchStagesForPipeline(pipelineId)
    return data
  }
  
  /**
   * Load virtual service files based on trays in department pipelines
   * that are in specific stages (In Lucru, In Asteptare, Finalizare)
   */
  private async loadVirtualServiceFiles(
    context: KanbanContext,
    existingServiceFiles: string[],
    receptieStages: Array<{ id: string; name: string }>,
    itemMap: Map<string, PipelineItemWithStage>
  ): Promise<{
    serviceFiles: Array<{ id: string }>
    pipelineItems: PipelineItemWithStage[]
    serviceFileData: Map<string, RawServiceFile>
  }> {
    const result = {
      serviceFiles: [] as Array<{ id: string }>,
      pipelineItems: [] as PipelineItemWithStage[],
      serviceFileData: new Map<string, RawServiceFile>()
    }
    
    const supabase = supabaseBrowser()
    
    // Find department pipelines
    const deptPipelines = context.allPipelines.filter(p => 
      DEPARTMENT_PIPELINES.some(dept => 
        p.name.toLowerCase() === dept.toLowerCase()
      )
    )
    
    if (deptPipelines.length === 0) {
      return result
    }
    
    const deptPipelineIds = deptPipelines.map(p => p.id)
    
    // Find stages in department pipelines that matter for Receptie
    const relevantDeptStages = context.allStages.filter(s => 
      deptPipelineIds.includes(s.pipeline_id) &&
      (matchesStagePattern(s.name, 'IN_LUCRU') ||
       matchesStagePattern(s.name, 'IN_ASTEPTARE') ||
       matchesStagePattern(s.name, 'FINALIZARE'))
    )
    
    if (relevantDeptStages.length === 0) {
      return result
    }
    
    const targetStageIds = relevantDeptStages.map(s => s.id)
    
    // Find trays in these stages
    const { data: trayPipelineItems } = await supabase
      .from('pipeline_items')
      .select('item_id, stage_id')
      .eq('type', 'tray')
      .in('stage_id', targetStageIds)
    
    if (!trayPipelineItems || trayPipelineItems.length === 0) {
      return result
    }
    
    const trayIds = trayPipelineItems.map(item => item.item_id)
    
    // Map tray to stage type
    const trayToStageType = new Map<string, 'in_lucru' | 'in_asteptare' | 'finalizare'>()
    trayPipelineItems.forEach(item => {
      const stage = relevantDeptStages.find(s => s.id === item.stage_id)
      if (stage) {
        if (matchesStagePattern(stage.name, 'IN_LUCRU')) {
          trayToStageType.set(item.item_id, 'in_lucru')
        } else if (matchesStagePattern(stage.name, 'IN_ASTEPTARE')) {
          trayToStageType.set(item.item_id, 'in_asteptare')
        } else if (matchesStagePattern(stage.name, 'FINALIZARE')) {
          trayToStageType.set(item.item_id, 'finalizare')
        }
      }
    })
    
    // Get trays with service file and lead data
    const { data: trays } = await supabase
      .from('trays')
      .select(`
        id,
        service_file_id,
        service_file:service_files!inner(
          id, lead_id, number, status, created_at, office_direct, curier_trimis,
          lead:leads!inner(id, full_name, email, phone_number, created_at, campaign_name, ad_name, form_name, tray_details)
        )
      `)
      .in('id', trayIds)
    
    if (!trays || trays.length === 0) {
      return result
    }
    
    // Get all trays for these service files to determine combined status
    const serviceFileIds = [...new Set(trays.map(t => t.service_file_id).filter(Boolean))]
    const { data: allTraysForSfs } = await supabase
      .from('trays')
      .select('id, service_file_id')
      .in('service_file_id', serviceFileIds)
    
    // Get stage status for all these trays
    const allTrayIds = allTraysForSfs?.map(t => t.id) || []
    const { data: allTrayPipelineItems } = await supabase
      .from('pipeline_items')
      .select('item_id, stage_id')
      .eq('type', 'tray')
      .in('item_id', allTrayIds)
      .in('pipeline_id', deptPipelineIds)
    
    // Map all trays to their stage types
    const allTrayToStageType = new Map<string, string>()
    allTrayPipelineItems?.forEach(item => {
      const stage = context.allStages.find(s => s.id === item.stage_id)
      if (stage) {
        if (matchesStagePattern(stage.name, 'IN_LUCRU')) {
          allTrayToStageType.set(item.item_id, 'in_lucru')
        } else if (matchesStagePattern(stage.name, 'IN_ASTEPTARE')) {
          allTrayToStageType.set(item.item_id, 'in_asteptare')
        } else if (matchesStagePattern(stage.name, 'FINALIZARE')) {
          allTrayToStageType.set(item.item_id, 'finalizare')
        }
      }
    })
    
    // Group trays by service file and determine Receptie stage
    const sfToReceptieStage = new Map<string, { id: string; name: string }>()
    
    for (const sfId of serviceFileIds) {
      const sfTrays = allTraysForSfs?.filter(t => t.service_file_id === sfId) || []
      const sfTrayIds = sfTrays.map(t => t.id)
      
      // Get stage types for all trays in this service file
      const stageTypes = sfTrayIds
        .map(id => allTrayToStageType.get(id))
        .filter(Boolean) as string[]
      
      const hasInLucru = stageTypes.includes('in_lucru')
      const hasInAsteptare = stageTypes.includes('in_asteptare')
      const allFinalizare = stageTypes.length > 0 && stageTypes.every(s => s === 'finalizare')
      
      // Determine Receptie stage based on priority
      let receptieStage: { id: string; name: string } | undefined
      
      if (hasInLucru) {
        receptieStage = findStageByPattern(receptieStages, 'IN_LUCRU')
      } else if (hasInAsteptare) {
        receptieStage = findStageByPattern(receptieStages, 'IN_ASTEPTARE')
      } else if (allFinalizare) {
        receptieStage = findStageByPattern(receptieStages, 'DE_FACTURAT')
      }
      
      // Fallback
      if (!receptieStage) {
        receptieStage = findStageByPattern(receptieStages, 'IN_LUCRU')
      }
      
      if (receptieStage) {
        sfToReceptieStage.set(sfId, receptieStage)
      }
    }
    
    // Create virtual pipeline items for service files not already in Receptie
    const existingSet = new Set(existingServiceFiles)
    
    for (const tray of trays) {
      if (!tray.service_file) continue
      
      const sfId = tray.service_file.id
      if (existingSet.has(sfId)) continue
      if (result.serviceFileData.has(sfId)) continue
      
      const receptieStage = sfToReceptieStage.get(sfId)
      if (!receptieStage) continue
      
      // Store service file data
      result.serviceFileData.set(sfId, tray.service_file as any)
      result.serviceFiles.push({ id: sfId })
      
      // Create virtual pipeline item
      const virtualPipelineItem: PipelineItemWithStage = {
        id: `virtual_${sfId}`,
        type: 'service_file',
        item_id: sfId,
        pipeline_id: context.pipelineId,
        stage_id: receptieStage.id,
        created_at: tray.service_file.created_at,
        updated_at: new Date().toISOString(),
        stage: receptieStage,
        isReadOnly: true
      }
      
      result.pipelineItems.push(virtualPipelineItem)
    }
    
    return result
  }
  
  /**
   * Calculate totals for service files
   */
  private async calculateServiceFileTotals(
    serviceFileIds: string[]
  ): Promise<Map<string, number>> {
    const totals = new Map<string, number>()
    
    if (serviceFileIds.length === 0) {
      return totals
    }
    
    // Get all trays for these service files
    const { data: trays } = await fetchTraysForServiceFiles(serviceFileIds)
    if (trays.length === 0) {
      return totals
    }
    
    const trayIds = trays.map(t => t.id)
    
    // Get tray items and prices
    const [{ data: trayItems }, servicePricesResult] = await Promise.all([
      fetchTrayItems(trayIds),
      this.getServicePrices(trayIds)
    ])
    
    // Calculate tray totals
    const trayTotals = calculateTrayTotals(trayIds, trayItems, servicePricesResult)
    
    // Aggregate to service file totals
    trays.forEach(t => {
      const trayTotal = trayTotals.get(t.id) || 0
      const currentTotal = totals.get(t.service_file_id) || 0
      totals.set(t.service_file_id, currentTotal + trayTotal)
    })
    
    return totals
  }
  
  /**
   * Get service prices for trays
   */
  private async getServicePrices(trayIds: string[]): Promise<Map<string, number>> {
    const { data: trayItems } = await fetchTrayItems(trayIds)
    
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

