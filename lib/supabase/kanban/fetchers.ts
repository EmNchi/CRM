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
 * Obține toate item-urile dintr-un pipeline cu informații despre stage-uri.
 * Această funcție este folosită pentru a încărca toate item-urile (leads, service files, trays)
 * dintr-un pipeline specificat, împreună cu informațiile despre stage-urile în care se află.
 * Rezultatul include ID-ul, tipul, item_id, pipeline_id, stage_id și detaliile stage-ului.
 * 
 * @param pipelineId - ID-ul pipeline-ului pentru care se încarcă item-urile
 * @returns Obiect cu array-ul de PipelineItemWithStage sau array gol și eroarea dacă există
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
 * Obține un singur item din pipeline după tip, item_id și pipeline_id.
 * Această funcție este folosită pentru a găsi un item specific într-un pipeline,
 * de exemplu când se verifică dacă un lead este deja într-un pipeline sau pentru
 * a obține informații despre poziția unui item în pipeline.
 * 
 * @param type - Tipul item-ului: 'lead', 'service_file' sau 'tray'
 * @param itemId - ID-ul item-ului de căutat
 * @param pipelineId - ID-ul pipeline-ului în care se caută
 * @returns Obiect cu PipelineItemWithStage sau null dacă nu există și eroarea dacă există
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
 * Obține lead-uri după ID-uri (batch fetch).
 * Această funcție este folosită pentru a încărca mai multe lead-uri simultan,
 * optimizând numărul de query-uri către baza de date. Returnează doar câmpurile
 * necesare pentru afișarea în Kanban: nume, email, telefon, date despre campanie/anunț/formular.
 * 
 * @param leadIds - Array cu ID-urile lead-urilor de încărcat
 * @returns Obiect cu array-ul de RawLead sau array gol dacă nu există lead-uri sau apare o eroare
 */
export async function fetchLeadsByIds(
  leadIds: string[]
): Promise<{ data: RawLead[]; error: any }> {
  if (leadIds.length === 0) return { data: [], error: null }
  
  const supabase = supabaseBrowser()
  
  const { data, error } = await supabase
    .from('leads')
    .select('id, full_name, email, phone_number, created_at, campaign_name, ad_name, form_name, tray_details, city, company_name, company_address, address, address2, zip')
    .in('id', leadIds)
  
  if (error) return { data: [], error }
  return { data: (data || []) as RawLead[], error: null }
}

// ==================== SERVICE FILES ====================

/**
 * Obține fișe de serviciu după ID-uri cu date despre lead-ul asociat.
 * Această funcție încarcă fișele de serviciu împreună cu informațiile despre lead-ul
 * asociat într-un singur query (folosind join). Este folosită pentru a afișa fișele
 * în board-ul Kanban cu toate detaliile necesare despre client.
 * 
 * @param serviceFileIds - Array cu ID-urile fișelor de serviciu de încărcat
 * @returns Obiect cu array-ul de RawServiceFile (cu lead inclus) sau array gol dacă nu există sau apare o eroare
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
      lead:leads(id, full_name, email, phone_number, created_at, campaign_name, ad_name, form_name, tray_details, city, company_name, company_address, address, address2, zip)
    `)
    .in('id', serviceFileIds)
  
  if (error) return { data: [], error }
  return { data: (data || []) as RawServiceFile[], error: null }
}

/**
 * Obține toate fișele de serviciu pentru lead-uri specificate.
 * Această funcție este folosită pentru a găsi toate fișele de serviciu asociate cu
 * un set de lead-uri. Este folosită în calcularea totalurilor pentru lead-uri,
 * unde trebuie să se găsească toate fișele unui lead pentru a calcula suma totală.
 * 
 * @param leadIds - Array cu ID-urile lead-urilor pentru care se caută fișele
 * @returns Obiect cu array-ul de obiecte {id, lead_id} sau array gol dacă nu există sau apare o eroare
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
 * Obține tăvițe după ID-uri cu date despre fișa de serviciu și lead-ul asociat.
 * Această funcție încarcă tăvițele împreună cu informațiile despre fișa de serviciu
 * și lead-ul asociat într-un singur query (folosind join-uri nested). Este folosită
 * pentru a afișa tăvițele în board-ul Kanban cu toate detaliile necesare despre client.
 * 
 * @param trayIds - Array cu ID-urile tăvițelor de încărcat
 * @returns Obiect cu array-ul de RawTray (cu service_file și lead incluși) sau array gol dacă nu există sau apare o eroare
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
 * Obține toate tăvițele pentru fișe de serviciu specificate.
 * Această funcție este folosită pentru a găsi toate tăvițele asociate cu un set de
 * fișe de serviciu. Este folosită în calcularea totalurilor, unde trebuie să se găsească
 * toate tăvițele unei fișe pentru a calcula suma totală.
 * 
 * @param serviceFileIds - Array cu ID-urile fișelor de serviciu pentru care se caută tăvițele
 * @returns Obiect cu array-ul de obiecte {id, service_file_id} sau array gol dacă nu există sau apare o eroare
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
 * Obține item-urile de tăviță pentru ID-uri de tăvițe specificate.
 * Această funcție încarcă toate item-urile (servicii, piese) dintr-un set de tăvițe.
 * Item-urile conțin informații despre tehnician, cantitate, serviciu și note (care pot
 * conține preț, discount, urgent, etc.). Este folosită pentru calcularea totalurilor
 * și pentru afișarea detaliilor tăvițelor.
 * 
 * @param trayIds - Array cu ID-urile tăvițelor pentru care se încarcă item-urile
 * @returns Obiect cu array-ul de RawTrayItem sau array gol dacă nu există sau apare o eroare
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
 * Obține item-urile de tăviță filtrate după departament.
 * Această funcție este folosită pentru pipeline-urile de departament pentru a găsi
 * toate tăvițele care au item-uri atribuite unui departament specific. Este folosită
 * în strategia DepartmentPipelineStrategy pentru a auto-crea pipeline_items pentru
 * tăvițe care aparțin departamentului dar nu au încă o înregistrare în pipeline_items.
 * 
 * @param departmentId - ID-ul departamentului (care corespunde cu pipeline_id pentru departamente)
 * @returns Obiect cu array-ul de obiecte {tray_id} sau array gol dacă nu există sau apare o eroare
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
 * Obține tag-urile pentru lead-uri specificate (batch fetch).
 * Această funcție folosește view-ul v_lead_tags pentru a obține toate tag-urile
 * asociate cu un set de lead-uri într-un singur query. Returnează un Map pentru
 * acces rapid la tag-urile unui lead după ID. Este folosită pentru a afișa tag-urile
 * pe card-urile Kanban.
 * 
 * @param leadIds - Array cu ID-urile lead-urilor pentru care se încarcă tag-urile
 * @returns Obiect cu Map-ul de tag-uri (lead_id -> KanbanTag[]) sau Map gol dacă nu există sau apare o eroare
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
 * Obține prețurile serviciilor după ID-uri (batch fetch).
 * Această funcție este folosită pentru a încărca prețurile serviciilor necesare
 * pentru calcularea totalurilor tăvițelor. Returnează un Map pentru acces rapid
 * la prețul unui serviciu după ID. Este folosită în calcularea totalurilor când
 * item-urile de tăviță nu au preț explicit în notes.
 * 
 * @param serviceIds - Array cu ID-urile serviciilor pentru care se încarcă prețurile
 * @returns Obiect cu Map-ul de prețuri (service_id -> price) sau Map gol dacă nu există sau apare o eroare
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
 * Obține toate stage-urile pentru un pipeline specificat.
 * Această funcție încarcă toate stage-urile (active și inactive) dintr-un pipeline.
 * Este folosită pentru a construi structura board-ului Kanban și pentru a valida
 * stage-urile în operațiile de mutare.
 * 
 * @param pipelineId - ID-ul pipeline-ului pentru care se încarcă stage-urile
 * @returns Obiect cu array-ul de stage-uri {id, name} sau array gol dacă nu există sau apare o eroare
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
 * Obține stage-uri după ID-uri (batch fetch).
 * Această funcție este folosită pentru a încărca mai multe stage-uri simultan,
 * optimizând numărul de query-uri către baza de date. Returnează ID-ul, numele
 * și pipeline_id pentru fiecare stage. Este folosită pentru validarea stage-urilor
 * și pentru construirea mapărilor stage_id -> stage name.
 * 
 * @param stageIds - Array cu ID-urile stage-urilor de încărcat
 * @returns Obiect cu array-ul de stage-uri {id, name, pipeline_id} sau array gol dacă nu există sau apare o eroare
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
 * Creează mai multe pipeline_items în bulk (operație batch).
 * Această funcție este folosită pentru a crea mai multe înregistrări în pipeline_items
 * într-un singur query, optimizând performanța. Este folosită în strategia DepartmentPipelineStrategy
 * pentru a auto-crea pipeline_items pentru tăvițe care aparțin unui departament dar nu au
 * încă o înregistrare în pipeline_items.
 * 
 * @param items - Array cu obiecte care conțin:
 *   - type: Tipul item-ului ('lead', 'service_file' sau 'tray')
 *   - item_id: ID-ul item-ului
 *   - pipeline_id: ID-ul pipeline-ului
 *   - stage_id: ID-ul stage-ului în care se plasează item-ul
 * @returns Obiect cu array-ul de pipeline_items create sau array gol și eroarea dacă există
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

