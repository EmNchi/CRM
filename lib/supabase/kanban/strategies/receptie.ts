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
import { moveItemToStage } from '../../pipelineOperations'
import { loadTechnicianCache, getTechnicianName } from '../cache'
import { 
  groupPipelineItemsByType, 
  getPipelineItem,
  transformServiceFileToKanbanItem,
  transformTrayToKanbanItem,
  extractTechnicianMap,
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
        id, lead_id, number, status, created_at, office_direct, curier_trimis, urgent,
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
            !(directServiceFiles && Array.isArray(directServiceFiles) && (() => {
        // FOLOSIM FOR LOOP ÎN LOC DE .some() - MAI SIGUR
        for (let i = 0; i < directServiceFiles.length; i++) {
          const sf = directServiceFiles[i] as any
          if (sf && sf.id === id) {
            return true
          }
        }
        return false
      })())
    )
    
    const { data: fetchedServiceFiles } = await fetchServiceFilesByIds(sfIdsToFetch)
    
    // Merge service file data
    const allServiceFiles: RawServiceFile[] = [
      ...fetchedServiceFiles,
      ...Array.from(virtualItems.serviceFileData.values()),
      ...(directServiceFiles || [])
    ]
    
    // Get all lead IDs for tags BEFORE filtering
    const allLeadIds = allServiceFiles
      .map(sf => sf.lead?.id)
      .filter(Boolean) as string[]
    
    // Fetch tags for all service files to check for department tags
    const { data: tagMap } = await fetchTagsForLeads(allLeadIds)
    
    // Tag-uri de departament care trebuie să apară în Recepție
    const departmentTags = ['Horeca', 'Saloane', 'Frizerii', 'Reparatii']
    
    // Identifică fișele care au tag-uri de departament
    const serviceFilesWithDepartmentTags = new Set<string>()
    allServiceFiles.forEach(sf => {
      if (sf.lead?.id) {
        const leadTags = tagMap.get(sf.lead.id) || []
        // FOLOSIM FOR LOOP ÎN LOC DE .some() - MAI SIGUR
        let hasDepartmentTag = false
        if (Array.isArray(leadTags)) {
          for (let i = 0; i < leadTags.length; i++) {
            const tag = leadTags[i]
            if (tag && tag.name && departmentTags.includes(tag.name)) {
              hasDepartmentTag = true
              break
            }
          }
        }
        if (hasDepartmentTag) {
          serviceFilesWithDepartmentTags.add(sf.id)
        }
      }
    })
    
    // Filter service files: Receptie should show those with office_direct = true OR curier_trimis = true
    // OR those that have trays in work (from virtual items) OR those with department tags
    const virtualServiceFileIds = new Set(virtualItems.serviceFileData.keys())
    const filteredServiceFiles = allServiceFiles.filter(sf => {
      // For Receptie, show service files with office_direct = true or curier_trimis = true
      // OR service files that have trays in work (from virtual items)
      // OR service files with department tags (Horeca, Saloane, Frizerii, Reparatii)
      return sf.office_direct === true || 
             sf.curier_trimis === true || 
             virtualServiceFileIds.has(sf.id) ||
             serviceFilesWithDepartmentTags.has(sf.id)
    })
    
    // Get lead IDs for filtered service files
    const leadIds = filteredServiceFiles
      .map(sf => sf.lead?.id)
      .filter(Boolean) as string[]
    
    // Calculate totals and get technician names
    const [totalsData, technicianMap] = await Promise.all([
      this.calculateServiceFileTotals(filteredServiceFiles.map(sf => sf.id)),
      this.getTechnicianMapForServiceFiles(filteredServiceFiles.map(sf => sf.id))
    ])
    
    // Load trays info from department pipelines to get tray/technician info and determine status
    const traysInfo = await this.getAllTraysInfoForServiceFiles(context, filteredServiceFiles.map(sf => sf.id))
    
    // Find stages in Receptie for automatic movement
    const inLucruStage = findStageByPattern(receptieStages, 'IN_LUCRU')
    const inAsteptareStage = findStageByPattern(receptieStages, 'IN_ASTEPTARE')
    const deFacturatStage = findStageByPattern(receptieStages, 'DE_FACTURAT')
    const coletAjunsStage = findStageByPattern(receptieStages, 'COLET_AJUNS')
    
    // Check which service files have trays in department pipelines
    const serviceFilesWithTraysInDepartments = await this.getServiceFilesWithTraysInDepartments(
      context,
      filteredServiceFiles.map(sf => sf.id)
    )
    
    // Move service files to appropriate stage based on tray status
    const movePromises: Promise<any>[] = []
    filteredServiceFiles.forEach(serviceFile => {
      const pipelineItem = getPipelineItem(itemMap, 'service_file', serviceFile.id)
      if (!pipelineItem) return
      
      // Get tray status info for this service file
      const serviceFileTraysInfo = traysInfo.get(serviceFile.id)
      const hasTraysInDepartments = serviceFilesWithTraysInDepartments.has(serviceFile.id)
      
      // Verifică dacă fișa are tag-uri de departament
      let departmentTagStage: { id: string; name: string } | undefined
      if (serviceFile.lead?.id) {
        const leadTags = tagMap.get(serviceFile.lead.id) || []
        for (const tag of leadTags) {
          if (departmentTags.includes(tag.name)) {
            // NU FACEM MAPARE LA STAGE pentru tag-uri de departament
            // Tags-urile sunt doar pentru informații, nu pentru routing în Recepție
            break
          }
        }
      }
      
      // Determine target stage based on priority: In Asteptare > In Lucru > De Facturat > Colet Ajuns
      // IMPORTANT: Tag-urile de departament NU determina stage-ul în Recepție
      let targetStage: { id: string; name: string } | undefined
      
      // Verifică dacă există tăvițe cu status specific
      if (serviceFileTraysInfo && serviceFileTraysInfo.trays.length > 0) {
        // Prioritatea: In Asteptare > In Lucru > De Facturat
        if (serviceFileTraysInfo.hasInAsteptare && inAsteptareStage) {
          // Dacă există tăvițe în "In Asteptare" sau "Astept Piese", mută în "In Asteptare"
          targetStage = inAsteptareStage
        } else if (serviceFileTraysInfo.hasInLucru && inLucruStage) {
          // Dacă nu există tăvițe în așteptare, verifică "In Lucru"
          targetStage = inLucruStage
        } else if (serviceFileTraysInfo.allFinalizare && deFacturatStage) {
          // Dacă toate tăvițele sunt finalizate, mută în "De Facturat"
          targetStage = deFacturatStage
        }
      }
      
      // Dacă nu s-a setat un stage specific și există tăvițe în departamente, mută în COLET AJUNS
      // Această verificare se face după verificarea status-urilor specifice pentru a respecta prioritatea
      if (!targetStage && hasTraysInDepartments && coletAjunsStage) {
        targetStage = coletAjunsStage
      }
      
      // Move to target stage if different from current stage
      if (targetStage && pipelineItem.stage_id !== targetStage.id) {
        movePromises.push(
          moveItemToStage('service_file', serviceFile.id, context.pipelineId, targetStage.id)
            .then(() => {
              // Update pipelineItem to reflect new stage
              const updatedItem: PipelineItemWithStage = {
                ...pipelineItem,
                stage_id: targetStage!.id,
                stage: targetStage!,
                updated_at: new Date().toISOString()
              }
              itemMap.set(`service_file:${serviceFile.id}`, updatedItem)
            })
            .catch(err => console.error(`Error moving service file to ${targetStage!.name}:`, err))
        )
      }
    })
    
    // Wait for all moves to complete (but don't block if some fail)
    await Promise.allSettled(movePromises)
    
    // Transform service files to KanbanItems
    const kanbanItems: KanbanItem[] = []
    
    filteredServiceFiles.forEach(serviceFile => {
      const pipelineItem = getPipelineItem(itemMap, 'service_file', serviceFile.id)
      if (!pipelineItem || !serviceFile.lead) return
      
      const leadId = serviceFile.lead.id
      const leadTagsRaw = tagMap.get(leadId) || []
      const leadTags = Array.isArray(leadTagsRaw) ? leadTagsRaw : []
      
      // IMPORTANT: Pentru fișele de serviciu, tag-ul "urgent" vine din câmpul urgent al fișei, nu din tag-urile lead-ului
      // Filtrează tag-ul "urgent" din tag-urile lead-ului și adaugă-l doar dacă fișa are urgent = true
      const tagsWithoutUrgent = leadTags.filter(tag => tag?.name?.toLowerCase() !== 'urgent')
      const serviceFileTags = [...tagsWithoutUrgent]
      
      // Adaugă tag-ul "urgent" doar dacă fișa de serviciu are urgent = true
      if (serviceFile?.urgent === true) {
        // Caută tag-ul "urgent" în lista de tag-uri existente sau creează unul nou
        const urgentTag = leadTags.find(tag => tag?.name?.toLowerCase() === 'urgent')
        if (urgentTag) {
          serviceFileTags.push(urgentTag)
        } else {
          // Creează un tag "urgent" temporar pentru afișare
          serviceFileTags.push({
            id: `urgent_${serviceFile.id}`,
            name: 'URGENT',
            color: 'red' as const
          })
        }
      }
      
      const total = totalsData.get(serviceFile.id) || 0
      const isReadOnly = (pipelineItem as any).isReadOnly || false
      const technician = technicianMap.get(serviceFile.id) || null
      
      const kanbanItem = transformServiceFileToKanbanItem(
        serviceFile,
        pipelineItem,
        serviceFileTags,
        total,
        isReadOnly
      )
      
      // Add technician name to the kanban item
      if (technician) {
        (kanbanItem as any).technician = technician
      }
      
      // Add trays info for this service file (including those without technician)
      const serviceFileTraysInfo = traysInfo.get(serviceFile.id)
      if (serviceFileTraysInfo && serviceFileTraysInfo.trays.length > 0) {
        (kanbanItem as any).traysInLucru = serviceFileTraysInfo.trays
      }
      
      kanbanItems.push(kanbanItem)
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
    // FOLOSIM FOR LOOP ÎN LOC DE .some() - MAI SIGUR
    const deptPipelines = context.allPipelines.filter(p => {
      if (!p || !p.name) return false
      const pNameLower = p.name.toLowerCase()
      for (let i = 0; i < DEPARTMENT_PIPELINES.length; i++) {
        const dept = DEPARTMENT_PIPELINES[i]
        if (pNameLower === dept.toLowerCase()) {
          return true
        }
      }
      return false
    })
  
    
    if (deptPipelines.length === 0) {
      return result
    }
    
    const deptPipelineIds = deptPipelines.map(p => p.id)
    
    // Find stages in department pipelines that matter for Receptie
    // Include "ASTEPT_PIESE" în verificarea pentru "IN_ASTEPTARE"
    // IMPORTANT: Include și stagiul "NOUĂ" pentru tăvițele fără tehnician atribuit
    const relevantDeptStages = context.allStages.filter(s => 
      deptPipelineIds.includes(s.pipeline_id) &&
      (matchesStagePattern(s.name, 'IN_LUCRU') ||
       matchesStagePattern(s.name, 'IN_ASTEPTARE') ||
       matchesStagePattern(s.name, 'ASTEPT_PIESE') ||
       matchesStagePattern(s.name, 'FINALIZARE') ||
       matchesStagePattern(s.name, 'NOUA'))     // Include tăvițe neatribuite din stagiul Nouă
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
    
    const trayIds = (trayPipelineItems as Array<{ item_id: string }>).map(item => item.item_id)
    
    // Map tray to stage type
    // Include "ASTEPT_PIESE" în verificarea pentru "in_asteptare"
    // IMPORTANT: Pentru tăvițele din stagiul "NOUĂ", include doar cele fără tehnician
    const trayToStageType = new Map<string, 'in_lucru' | 'in_asteptare' | 'finalizare' | 'new_unassigned'>()
    ;(trayPipelineItems as Array<{ item_id: string; stage_id: string }>).forEach(item => {
      const stage = relevantDeptStages.find(s => s.id === item.stage_id)
      if (stage) {
        if (matchesStagePattern(stage.name, 'IN_LUCRU')) {
          trayToStageType.set(item.item_id, 'in_lucru')
        } else if (matchesStagePattern(stage.name, 'IN_ASTEPTARE') || matchesStagePattern(stage.name, 'ASTEPT_PIESE')) {
          trayToStageType.set(item.item_id, 'in_asteptare')
        } else if (matchesStagePattern(stage.name, 'FINALIZARE')) {
          trayToStageType.set(item.item_id, 'finalizare')
        } else if (matchesStagePattern(stage.name, 'NOUA')) {
          // Marca ca 'new_unassigned' - va fi verificat mai târziu dacă are tehnician
          trayToStageType.set(item.item_id, 'new_unassigned')
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
    const serviceFileIds = [...new Set((trays as Array<{ service_file_id: string | null }>).map(t => t.service_file_id).filter(Boolean) as string[])]
    const { data: allTraysForSfs } = await supabase
      .from('trays')
      .select('id, service_file_id')
      .in('service_file_id', serviceFileIds)
    
    // Get stage status for all these trays
    const allTrayIds = (allTraysForSfs as Array<{ id: string }> | null)?.map(t => t.id) || []
    const { data: allTrayPipelineItems } = await supabase
      .from('pipeline_items')
      .select('item_id, stage_id')
      .eq('type', 'tray')
      .in('item_id', allTrayIds)
      // IMPORTANT: NU filtram după pipeline_id - vrem TOATE tăvițele indiferent de pipeline
      // deoarece o fişă de serviciu poate avea tăvițe în orice pipeline (departament)
    
    // Map all trays to their stage types
    // IMPORTANT: Pentru tăvițele din stagiul "NOUĂ", marcăm ca 'new_unassigned' pentru filtrare ulterioară
    const allTrayToStageType = new Map<string, string>()
    ;(allTrayPipelineItems as Array<{ item_id: string; stage_id: string }> | null)?.forEach(item => {
      const stage = context.allStages.find(s => s.id === item.stage_id)
      if (stage) {
        if (matchesStagePattern(stage.name, 'IN_LUCRU')) {
          allTrayToStageType.set(item.item_id, 'in_lucru')
        } else if (matchesStagePattern(stage.name, 'IN_ASTEPTARE') || matchesStagePattern(stage.name, 'ASTEPT_PIESE')) {
          allTrayToStageType.set(item.item_id, 'in_asteptare')
        } else if (matchesStagePattern(stage.name, 'FINALIZARE')) {
          allTrayToStageType.set(item.item_id, 'finalizare')
        } else if (matchesStagePattern(stage.name, 'NOUA')) {
          allTrayToStageType.set(item.item_id, 'new_unassigned')
        }
      }
    })
    
    // Group trays by service file and determine Receptie stage
    const sfToReceptieStage = new Map<string, { id: string; name: string }>()
    
    for (const sfId of serviceFileIds) {
      const sfTrays = (allTraysForSfs as Array<{ id: string; service_file_id: string | null }> | null)?.filter(t => t.service_file_id === sfId) || []
      const sfTrayIds = sfTrays.map(t => t.id)
      
      // Get stage types for all trays in this service file
      const stageTypes = sfTrayIds
        .map(id => allTrayToStageType.get(id))
        .filter(Boolean) as string[]
      
      const hasInLucru = stageTypes.includes('in_lucru')
      const hasInAsteptare = stageTypes.includes('in_asteptare')
      const hasNewUnassigned = stageTypes.includes('new_unassigned')
      const allFinalizare = stageTypes.length > 0 && stageTypes.every(s => s === 'finalizare')
      
      // Determine Receptie stage based on priority: In Asteptare > In Lucru > De Facturat > Colet Ajuns (new_unassigned)
      // IMPORTANT: "In Asteptare" are prioritate mai mare decât "In Lucru" și "De Facturat"
      let receptieStage: { id: string; name: string } | undefined
      
      if (hasInAsteptare) {
        // Dacă există tăvițe în "In Asteptare" sau "Astept Piese", mută în "In Asteptare"
        receptieStage = findStageByPattern(receptieStages, 'IN_ASTEPTARE')
      } else if (hasInLucru) {
        // Dacă nu există tăvițe în așteptare, verifică "In Lucru"
        receptieStage = findStageByPattern(receptieStages, 'IN_LUCRU')
      } else if (allFinalizare) {
        // Dacă toate tăvițele sunt finalizate, mută în "De Facturat"
        receptieStage = findStageByPattern(receptieStages, 'DE_FACTURAT')
      } else if (hasNewUnassigned) {
        // Dacă sunt tăvițe neatribuite din stagiul NOUĂ, pune-le în COLET AJUNS
        receptieStage = findStageByPattern(receptieStages, 'COLET_AJUNS')
      }
      
      // Fallback - dacă nu e nicio altă situație
      if (!receptieStage) {
        receptieStage = findStageByPattern(receptieStages, 'COLET_AJUNS')
      }
      
      if (receptieStage) {
        sfToReceptieStage.set(sfId, receptieStage)
      }
    }
    
    // Create virtual pipeline items for service files not already in Receptie
    const existingSet = new Set(existingServiceFiles)
    
    for (const tray of trays as Array<{ service_file?: any }>) {
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
  
  /**
   * Check which service files have trays in department pipelines
   */
  private async getServiceFilesWithTraysInDepartments(
    context: KanbanContext,
    serviceFileIds: string[]
  ): Promise<Set<string>> {
    const result = new Set<string>()
    
    if (serviceFileIds.length === 0) {
      return result
    }
    
    const supabase = supabaseBrowser()
    
    // Find department pipelines
    // FOLOSIM FOR LOOP ÎN LOC DE .some() - MAI SIGUR
    const deptPipelines = context.allPipelines.filter(p => {
      if (!p || !p.name) return false
      const pNameLower = p.name.toLowerCase()
      for (let i = 0; i < DEPARTMENT_PIPELINES.length; i++) {
        const dept = DEPARTMENT_PIPELINES[i]
        if (pNameLower === dept.toLowerCase()) {
          return true
        }
      }
      return false
    })
    
    if (deptPipelines.length === 0) {
      return result
    }
    
    const deptPipelineIds = deptPipelines.map(p => p.id)
    
    // Get all trays for these service files
    const { data: allTrays } = await supabase
      .from('trays')
      .select('id, service_file_id')
      .in('service_file_id', serviceFileIds)
    
    if (!allTrays || allTrays.length === 0) {
      return result
    }
    
    const allTrayIds = (allTrays as Array<{ id: string }>).map(t => t.id)
    
    // Get all tray pipeline items from department pipelines
    const { data: trayPipelineItems } = await supabase
      .from('pipeline_items')
      .select('item_id, pipeline_id')
      .eq('type', 'tray')
      .in('item_id', allTrayIds)
      .in('pipeline_id', deptPipelineIds)
    
    if (!trayPipelineItems || trayPipelineItems.length === 0) {
      return result
    }
    
    // Map tray IDs to service file IDs
    const trayToServiceFile = new Map<string, string>()
    ;(allTrays as Array<{ id: string; service_file_id: string | null }>).forEach(tray => {
      if (tray.service_file_id) {
        trayToServiceFile.set(tray.id, tray.service_file_id)
      }
    })
    
    // Find service files that have trays in department pipelines
    const trayIdsInDepartments = new Set(
      (trayPipelineItems as Array<{ item_id: string }>).map(item => item.item_id)
    )
    
    trayIdsInDepartments.forEach(trayId => {
      const serviceFileId = trayToServiceFile.get(trayId)
      if (serviceFileId) {
        result.add(serviceFileId)
      }
    })
    
    return result
  }
  
  /**
   * Get technician names for service files based on their trays
   */
  private async getTechnicianMapForServiceFiles(
    serviceFileIds: string[]
  ): Promise<Map<string, string>> {
    const technicianMap = new Map<string, string>()
    
    if (serviceFileIds.length === 0) {
      return technicianMap
    }
    
    const supabase = supabaseBrowser()
    
    // Get all trays for these service files
    const { data: trays } = await fetchTraysForServiceFiles(serviceFileIds)
    if (!trays || trays.length === 0) {
      return technicianMap
    }
    
    const trayIds = trays.map(t => t.id)
    
    // Get tray items with technician_id
    const { data: trayItems } = await fetchTrayItems(trayIds)
    if (!trayItems || trayItems.length === 0) {
      return technicianMap
    }
    
    // Group tray items by service file and find first technician
    const serviceFileToTrayIds = new Map<string, string[]>()
    trays.forEach(t => {
      if (!serviceFileToTrayIds.has(t.service_file_id)) {
        serviceFileToTrayIds.set(t.service_file_id, [])
      }
      serviceFileToTrayIds.get(t.service_file_id)!.push(t.id)
    })
    
    // For each service file, find the first technician from its trays
    serviceFileIds.forEach(sfId => {
      const trayIdsForSf = serviceFileToTrayIds.get(sfId) || []
      const itemsForSf = trayItems.filter(ti => trayIdsForSf.includes(ti.tray_id))
      
      // Find first technician_id
      const firstTechnicianId = itemsForSf.find(ti => ti.technician_id)?.technician_id
      if (firstTechnicianId) {
        const techName = getTechnicianName(firstTechnicianId)
        if (techName) {
          technicianMap.set(sfId, techName)
        }
      }
    })
    
    return technicianMap
  }
  
  /**
   * Get information about all trays for service files in department pipelines
   * Returns a map: service_file_id -> {trays: array, hasInLucru: boolean, hasInAsteptare: boolean, allFinalizare: boolean}
   */
  private async getAllTraysInfoForServiceFiles(
    context: KanbanContext,
    serviceFileIds: string[]
  ): Promise<Map<string, {
    trays: Array<{ trayNumber: string | null; traySize: string | null; technician: string | null; status: 'in_lucru' | 'in_asteptare' | 'finalizare' | 'noua' | null; department: string | null }>
    hasInLucru: boolean
    hasInAsteptare: boolean
    allFinalizare: boolean
    hasNoua: boolean
  }>> {
    const result = new Map<string, {
      trays: Array<{ trayNumber: string | null; traySize: string | null; technician: string | null; status: 'in_lucru' | 'in_asteptare' | 'finalizare' | 'noua' | null; department: string | null }>
      hasInLucru: boolean
      hasInAsteptare: boolean
      allFinalizare: boolean
      hasNoua: boolean
    }>()
    
    if (serviceFileIds.length === 0) {
      return result
    }
    
    const supabase = supabaseBrowser()
    
    // Find department pipelines
    // FOLOSIM FOR LOOP ÎN LOC DE .some() - MAI SIGUR
    const deptPipelines = context.allPipelines.filter(p => {
      if (!p || !p.name) return false
      const pNameLower = p.name.toLowerCase()
      for (let i = 0; i < DEPARTMENT_PIPELINES.length; i++) {
        const dept = DEPARTMENT_PIPELINES[i]
        if (pNameLower === dept.toLowerCase()) {
          return true
        }
      }
      return false
    })
    
    if (deptPipelines.length === 0) {
      return result
    }
    
    const deptPipelineIds = deptPipelines.map(p => p.id)
    
    // Get all trays for these service files
    const { data: allTrays } = await supabase
      .from('trays')
      .select('id, number, size, service_file_id')
      .in('service_file_id', serviceFileIds)
    
    if (!allTrays || allTrays.length === 0) {
      return result
    }
    
    const allTrayIds = (allTrays as Array<{ id: string }>).map(t => t.id)
    
    // Get all tray pipeline items from department pipelines (include pipeline_id for department mapping)
    const { data: allTrayPipelineItems } = await supabase
      .from('pipeline_items')
      .select('item_id, stage_id, pipeline_id')
      .eq('type', 'tray')
      .in('item_id', allTrayIds)
      .in('pipeline_id', deptPipelineIds)
    
    if (!allTrayPipelineItems || allTrayPipelineItems.length === 0) {
      return result
    }
    
    // Map trays to their stage types and departments
    const trayToStageType = new Map<string, 'in_lucru' | 'in_asteptare' | 'finalizare' | 'noua' | 'other'>()
    const trayToDepartment = new Map<string, string | null>()
    ;(allTrayPipelineItems as Array<{ item_id: string; stage_id: string; pipeline_id: string }>).forEach(item => {
      const stage = context.allStages.find(s => s.id === item.stage_id)
      if (stage) {
        if (matchesStagePattern(stage.name, 'IN_LUCRU')) {
          trayToStageType.set(item.item_id, 'in_lucru')
        } else if (matchesStagePattern(stage.name, 'IN_ASTEPTARE') || matchesStagePattern(stage.name, 'ASTEPT_PIESE')) {
          trayToStageType.set(item.item_id, 'in_asteptare')
        } else if (matchesStagePattern(stage.name, 'FINALIZARE')) {
          trayToStageType.set(item.item_id, 'finalizare')
        } else if (matchesStagePattern(stage.name, 'NOUA')) {
          trayToStageType.set(item.item_id, 'noua')
        } else {
          trayToStageType.set(item.item_id, 'other')
        }
      }
      
      // Map tray to department based on pipeline
      const pipeline = context.allPipelines.find(p => p.id === item.pipeline_id)
      if (pipeline) {
        trayToDepartment.set(item.item_id, pipeline.name)
      }
    })
    
    // Get tray items for technician extraction
    const { data: trayItems } = await fetchTrayItems(allTrayIds)
    const technicianMap = extractTechnicianMap(trayItems || [])
    
    // Group trays by service file and determine status
    // Include ALL trays that are in relevant stages (in_lucru, in_asteptare, finalizare, noua)
    ;(allTrays as Array<{ id: string; number: string | null; size: string | null; service_file_id: string | null }>).forEach(tray => {
      if (!tray.service_file_id) return
      
      // Check if this tray is in a relevant stage
      const stageType = trayToStageType.get(tray.id)
      if (!stageType || stageType === 'other') {
        // Skip trays that are not in relevant stages
        return
      }
      
      // Get technician for this tray (can be null if no technician assigned)
      const technician = technicianMap.has(tray.id) ? technicianMap.get(tray.id) || null : null
      
      if (!result.has(tray.service_file_id)) {
        result.set(tray.service_file_id, {
          trays: [],
          hasInLucru: false,
          hasInAsteptare: false,
          allFinalizare: false,
          hasNoua: false
        })
      }
      
      const info = result.get(tray.service_file_id)!
      
      // Get department for this tray
      const department = trayToDepartment.get(tray.id) || null
      
      // Add tray info (including trays without technician, their status, and department)
      info.trays.push({
        trayNumber: tray.number,
        traySize: tray.size,
        technician,
        status: stageType === 'in_lucru' || stageType === 'in_asteptare' || stageType === 'finalizare' || stageType === 'noua' ? stageType : null,
        department
      })
      
      // Check stage type for this tray
      if (stageType === 'in_lucru') {
        info.hasInLucru = true
      } else if (stageType === 'in_asteptare') {
        info.hasInAsteptare = true
      } else if (stageType === 'noua') {
        info.hasNoua = true
      }
    })
    
    // Determine if all trays are finalized for each service file
    result.forEach((info, sfId) => {
      const sfTrays = (allTrays as Array<{ id: string; service_file_id: string | null }>).filter(t => t.service_file_id === sfId)
      const sfTrayIds = sfTrays.map(t => t.id)
      
      // Get stage types for all trays in this service file
      const stageTypes = sfTrayIds
        .map(id => trayToStageType.get(id))
        .filter(Boolean) as string[]
      
      // All trays are finalized if all have stage type 'finalizare' and there are no other types
      info.allFinalizare = stageTypes.length > 0 && 
                           stageTypes.every(s => s === 'finalizare') &&
                           !info.hasInLucru &&
                           !info.hasInAsteptare
    })
    
    return result
  }
}

