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
 * Transformă un lead brut într-un KanbanItem pentru afișare în board-ul Kanban.
 * Această funcție convertește datele unui lead din formatul bazei de date în formatul
 * standardizat KanbanItem, care include informații despre lead, stage-ul curent, tag-uri
 * și totalul calculat. Funcția este folosită pentru a afișa lead-urile în interfața Kanban.
 * 
 * @param lead - Lead-ul brut din baza de date
 * @param pipelineItem - Item-ul din pipeline care conține informații despre stage și pipeline
 * @param tags - Array cu tag-urile asociate lead-ului (implicit array gol)
 * @param total - Totalul calculat pentru lead (suma tuturor fișelor și tăvițelor) - implicit 0
 * @returns KanbanItem formatat pentru afișare în board-ul Kanban
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
    city: lead.city || null,
    company_name: lead.company_name || null,
    company_address: lead.company_address || null,
    address: lead.address || null,
    address2: lead.address2 || null,
    zip: lead.zip || null,
  }
}

// ==================== SERVICE FILE TRANSFORMER ====================

/**
 * Transformă o fișă de serviciu brută într-un KanbanItem pentru afișare în board-ul Kanban.
 * Această funcție convertește datele unei fișe de serviciu din formatul bazei de date în
 * formatul standardizat KanbanItem. Fișa de serviciu este afișată cu informații despre lead-ul
 * asociat, numărul fișei, status și totalul calculat. Funcția suportă și flag-ul isReadOnly
 * pentru a indica dacă fișa poate fi modificată sau nu.
 * 
 * @param serviceFile - Fișa de serviciu brută din baza de date
 * @param pipelineItem - Item-ul din pipeline care conține informații despre stage și pipeline
 * @param tags - Array cu tag-urile asociate lead-ului (implicit array gol)
 * @param total - Totalul calculat pentru fișă (suma tuturor tăvițelor) - implicit 0
 * @param isReadOnly - Flag care indică dacă fișa este read-only (nu poate fi modificată) - implicit false
 * @returns KanbanItem formatat pentru afișare în board-ul Kanban
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
    city: lead?.city || null,
    company_name: lead?.company_name || null,
    company_address: lead?.company_address || null,
    address: lead?.address || null,
    address2: lead?.address2 || null,
    zip: lead?.zip || null,
  }
}

// ==================== TRAY TRANSFORMER ====================

/**
 * Transformă o tăviță brută într-un KanbanItem pentru afișare în board-ul Kanban.
 * Această funcție convertește datele unei tăvițe din formatul bazei de date în formatul
 * standardizat KanbanItem. Tăvița este afișată cu informații despre lead-ul asociat (prin
 * fișa de serviciu), numărul tăviței, mărime, status, tehnician atribuit și totalul calculat.
 * Funcția calculează automat câmpurile inLucruSince și inAsteptareSince bazate pe stage-ul curent.
 * 
 * @param tray - Tăvița brută din baza de date
 * @param pipelineItem - Item-ul din pipeline care conține informații despre stage și pipeline
 * @param tags - Array cu tag-urile asociate lead-ului (implicit array gol)
 * @param technician - Numele tehnicianului atribuit tăviței (implicit null)
 * @param total - Totalul calculat pentru tăviță (suma tuturor item-urilor) - implicit 0
 * @param isReadOnly - Flag care indică dacă tăvița este read-only (nu poate fi modificată) - implicit false
 * @returns KanbanItem formatat pentru afișare în board-ul Kanban
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
    city: lead?.city || null,
    company_name: lead?.company_name || null,
    company_address: lead?.company_address || null,
    address: lead?.address || null,
    address2: lead?.address2 || null,
    zip: lead?.zip || null,
  }
}

// ==================== TECHNICIAN EXTRACTION ====================

/**
 * Extrage maparea tehnicianilor din item-urile de tăviță.
 * Această funcție analizează item-urile de tăviță și creează o mapare între ID-ul tăviței
 * și numele tehnicianului atribuit. Dacă o tăviță are mai mulți item-uri cu tehniciani
 * diferiți, se folosește primul tehnician găsit. Funcția folosește cache-ul de tehniciani
 * pentru a obține numele tehnicianului din ID.
 * 
 * @param trayItems - Array cu item-urile de tăviță care conțin technician_id
 * @returns Map cu cheia tray_id și valoarea numele tehnicianului (sau string gol dacă nu există)
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
 * Calculează totalul pentru o singură tăviță.
 * Această funcție calculează prețul total al unei tăvițe bazându-se pe item-urile sale.
 * Funcția procesează item-urile vizibile (cele cu item_type în notes), aplică discount-uri,
 * markup-uri pentru urgent, și discount-uri pentru abonamente. Calculează separat totalurile
 * pentru servicii și piese pentru a aplica discount-uri diferite pentru abonamente.
 * 
 * @param trayId - ID-ul tăviței pentru care se calculează totalul
 * @param trayItems - Array cu toate item-urile de tăviță (se filtrează după tray_id)
 * @param servicePrices - Map cu prețurile serviciilor (service_id -> price)
 * @param subscriptionType - Tipul abonamentului ('services', 'parts', 'both' sau '') - implicit ''
 * @returns Totalul calculat pentru tăviță (subtotal - discount + urgent markup - subscription discount)
 */
export function calculateTrayTotal(
  trayId: string,
  trayItems: RawTrayItem[],
  servicePrices: Map<string, number>,
  subscriptionType: string = ''
): number {
  const trayItemsArray = Array.isArray(trayItems) ? trayItems : []
  const items = trayItemsArray.filter(ti => ti?.tray_id === trayId)
  
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
 * Calculează totalurile pentru mai multe tăvițe.
 * Această funcție este o variantă optimizată care calculează totalurile pentru mai multe
 * tăvițe într-un singur apel. Folosește calculateTrayTotal pentru fiecare tăviță și
 * returnează un Map cu rezultatele. Este folosită pentru a calcula totalurile tuturor
 * tăvițelor dintr-un pipeline într-o singură operație.
 * 
 * @param trayIds - Array cu ID-urile tăvițelor pentru care se calculează totalurile
 * @param trayItems - Array cu toate item-urile de tăviță (se filtrează pentru fiecare tray_id)
 * @param servicePrices - Map cu prețurile serviciilor (service_id -> price)
 * @returns Map cu cheia tray_id și valoarea totalul calculat pentru fiecare tăviță
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
 * Filtrează tăvițele pentru pipeline-urile de departament bazat pe atribuirea tehnicianului.
 * Această funcție implementă logica de filtrare pentru pipeline-urile de departament (Saloane,
 * Horeca, Frizerii, Reparatii), unde utilizatorii non-admin pot vedea doar tăvițele care
 * le sunt atribuite. Regulile de filtrare sunt:
 * - Utilizatorul poate vedea tăvițe unde are cel puțin un item atribuit
 * - Utilizatorul poate vedea tăvițe fără tehnician atribuit (vizibile pentru toți)
 * - Tăvițele în stage-ul "Noua" NU sunt vizibile pentru tehnicianul atribuit (excepție specială)
 * 
 * @param trayIds - Array cu ID-urile tăvițelor de filtrat
 * @param trayItems - Array cu toate item-urile de tăviță (pentru a identifica atribuirile)
 * @param pipelineItems - Array cu item-urile din pipeline (pentru a identifica stage-urile)
 * @param currentUserId - ID-ul utilizatorului curent pentru care se face filtrarea
 * @returns Array filtrat cu ID-urile tăvițelor vizibile pentru utilizator
 */
export function filterTraysForUser(
  trayIds: string[],
  trayItems: RawTrayItem[],
  pipelineItems: PipelineItemWithStage[],
  currentUserId: string
): string[] {
  // Build map of tray -> set of technician IDs
  const trayTechnicianMap = new Map<string, Set<string | null>>()
  
  const trayItemsArray = Array.isArray(trayItems) ? trayItems : []
  trayItemsArray.forEach(ti => {
    if (!ti?.tray_id) return
    if (!trayTechnicianMap.has(ti.tray_id)) {
      trayTechnicianMap.set(ti.tray_id, new Set())
    }
    trayTechnicianMap.get(ti.tray_id)!.add(ti.technician_id || null)
  })
  
  // Build map of tray -> stage name
  const trayStageMap = new Map<string, string>()
  const pipelineItemsArray = Array.isArray(pipelineItems) ? pipelineItems : []
  pipelineItemsArray.forEach(pi => {
    if (pi?.type === 'tray' && pi?.stage) {
      trayStageMap.set(pi.item_id, pi.stage.name?.toLowerCase() || '')
    }
  })
  
  const trayIdsArray = Array.isArray(trayIds) ? trayIds : []
  return trayIdsArray.filter(trayId => {
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
 * Grupează item-urile din pipeline după tip.
 * Această funcție separă item-urile din pipeline în trei categorii: leads, service files
 * și trays. De asemenea, creează un Map pentru acces rapid la item-uri după tip și ID.
 * Funcția este folosită pentru a organiza datele înainte de a le transforma în KanbanItems.
 * 
 * @param pipelineItems - Array cu toate item-urile din pipeline
 * @returns Obiect cu:
 *   - leads: Array cu ID-urile lead-urilor
 *   - serviceFiles: Array cu ID-urile fișelor de serviciu
 *   - trays: Array cu ID-urile tăvițelor
 *   - itemMap: Map cu cheia "type:id" și valoarea PipelineItemWithStage pentru acces rapid
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
 * Obține un item din pipeline din map-ul de item-uri.
 * Această funcție este un helper pentru a obține rapid un item din pipeline folosind
 * tipul și ID-ul item-ului. Folosește map-ul creat de groupPipelineItemsByType pentru
 * acces O(1) la item-uri.
 * 
 * @param itemMap - Map-ul de item-uri creat de groupPipelineItemsByType
 * @param type - Tipul item-ului: 'lead', 'service_file' sau 'tray'
 * @param itemId - ID-ul item-ului de obținut
 * @returns PipelineItemWithStage dacă există, sau undefined dacă nu există
 */
export function getPipelineItem(
  itemMap: Map<string, PipelineItemWithStage>,
  type: string,
  itemId: string
): PipelineItemWithStage | undefined {
  return itemMap.get(`${type}:${itemId}`)
}

