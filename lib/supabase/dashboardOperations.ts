'use client'

import { supabaseBrowser } from './supabaseClient'
import { 
  fetchTraysForServiceFiles, 
  fetchTrayItems, 
  fetchServicePrices,
  fetchServiceFilesForLeads
} from './kanban/fetchers'
import { calculateTrayTotal } from './kanban/transformers'
import { DEPARTMENT_PIPELINES, STAGE_PATTERNS } from './kanban/constants'

const supabase = supabaseBrowser()

export interface DashboardMetrics {
  totalLeads: number
  totalRevenue: number
  urgentLeads: number
  newLeadsToday: number
  leadsByPipeline: Record<string, number>
  leadsByStage: Record<string, number>
  revenueByPipeline: Record<string, number>
  revenueByStage: Record<string, number>
  leadsOverTime: Array<{ date: string; count: number }>
  topTechnicians: Array<{ name: string; leads: number; revenue: number }>
  tagDistribution: Record<string, number>
  conversionRate: number
  averageLeadValue: number
  paymentMethodStats: {
    cash: number
    card: number
    none: number
  }
  totalInLucru: number // Suma totală a fișelor de serviciu care au minim o tăviță în lucru
  noDealLeads: number // Numărul de leads cu "no deal"
}

const emptyMetrics: DashboardMetrics = {
  totalLeads: 0,
  totalRevenue: 0,
  urgentLeads: 0,
  newLeadsToday: 0,
  leadsByPipeline: {},
  leadsByStage: {},
  revenueByPipeline: {},
  revenueByStage: {},
  leadsOverTime: [],
  topTechnicians: [],
  tagDistribution: {},
  conversionRate: 0,
  averageLeadValue: 0,
  paymentMethodStats: { cash: 0, card: 0, none: 0 },
  totalInLucru: 0,
  noDealLeads: 0
}

/**
 * Calculează suma totală a fișelor de serviciu care au minim o tăviță în lucru
 */
async function calculateTotalInLucru(): Promise<number> {
  try {
    // Găsește pipeline-urile departamentelor
    const { data: pipelines, error: pipelinesError } = await supabase
      .from('pipelines')
      .select('id, name')
      .in('name', DEPARTMENT_PIPELINES)

    if (pipelinesError) throw pipelinesError
    if (!pipelines || pipelines.length === 0) return 0

    const deptPipelineIds = pipelines.map(p => p.id)

    // Găsește stage-urile "In Lucru" din pipeline-urile departamentelor
    const { data: stages, error: stagesError } = await supabase
      .from('stages')
      .select('id, name')
      .in('pipeline_id', deptPipelineIds)

    if (stagesError) throw stagesError
    if (!stages || stages.length === 0) return 0

    // Filtrează stage-urile care corespund pattern-ului "In Lucru"
    const inLucruStages = stages.filter(s => {
      const stageName = s.name.toLowerCase().trim()
      return STAGE_PATTERNS.IN_LUCRU.some(pattern => stageName.includes(pattern.toLowerCase()))
    })

    if (inLucruStages.length === 0) return 0

    const inLucruStageIds = inLucruStages.map(s => s.id)

    // Găsește tăvițele care sunt în stage-urile "In Lucru"
    const { data: trayPipelineItems, error: trayItemsError } = await supabase
      .from('pipeline_items')
      .select('item_id')
      .eq('type', 'tray')
      .in('stage_id', inLucruStageIds)

    if (trayItemsError) throw trayItemsError
    if (!trayPipelineItems || trayPipelineItems.length === 0) return 0

    const trayIds = trayPipelineItems.map(item => item.item_id as string)

    // Găsește service_files asociate cu aceste tăvițe
    const { data: trays, error: traysError } = await supabase
      .from('trays')
      .select('id, service_file_id')
      .in('id', trayIds)

    if (traysError) throw traysError
    if (!trays || trays.length === 0) return 0

    // Obține service_file IDs unice (o fișă poate avea mai multe tăvițe în lucru)
    const serviceFileIds = [...new Set(trays.map(t => t.service_file_id))]

    // Pentru fiecare service_file, calculează totalul tuturor tăvițelor sale
    const { data: allTrays, error: allTraysError } = await fetchTraysForServiceFiles(serviceFileIds)
    if (allTraysError) throw allTraysError
    if (!allTrays || allTrays.length === 0) return 0

    const allTrayIds = allTrays.map(t => t.id)

    // Obține toate item-urile pentru toate tăvițele din aceste fișe
    const { data: trayItems, error: itemsError } = await fetchTrayItems(allTrayIds)
    if (itemsError) throw itemsError
    if (!trayItems || trayItems.length === 0) return 0

    // Obține prețurile serviciilor
    const serviceIds = [...new Set(trayItems.map(ti => ti.service_id).filter(Boolean))] as string[]
    if (serviceIds.length === 0) return 0
    
    const { data: servicePrices, error: pricesError } = await fetchServicePrices(serviceIds)
    if (pricesError) throw pricesError
    if (!servicePrices) return 0

    // Obține subscription_type pentru fiecare service_file (dacă coloana există)
    // Dacă coloana nu există, folosim valoarea implicită ''
    const subscriptionMap = new Map<string, string>()
    
    try {
      const { data: serviceFiles, error: sfError } = await supabase
        .from('service_files')
        .select('id, subscription_type')
        .in('id', serviceFileIds)

      if (!sfError && serviceFiles) {
        serviceFiles.forEach((sf: any) => {
          subscriptionMap.set(sf.id, sf.subscription_type || '')
        })
      }
    } catch (err) {
      // Dacă coloana nu există, folosim valoarea implicită pentru toate
      serviceFileIds.forEach(sfId => {
        subscriptionMap.set(sfId, '')
      })
    }

    // Calculează totalul pentru fiecare service_file
    const serviceFileTotals = new Map<string, number>()
    
    allTrays.forEach(tray => {
      const subscriptionType = subscriptionMap.get(tray.service_file_id) || ''
      const trayTotal = calculateTrayTotal(tray.id, trayItems, servicePrices, subscriptionType)
      const currentTotal = serviceFileTotals.get(tray.service_file_id) || 0
      serviceFileTotals.set(tray.service_file_id, currentTotal + trayTotal)
    })

    // Sumă totală pentru toate fișele care au minim o tăviță în lucru
    let total = 0
    serviceFileIds.forEach(sfId => {
      total += serviceFileTotals.get(sfId) || 0
    })

    return total
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : (error && typeof error === 'object' && 'message' in error)
        ? String((error as any).message)
        : (error && typeof error === 'object' && 'code' in error)
          ? `Error code: ${(error as any).code}`
          : JSON.stringify(error)
    console.error('Error calculating total in lucru:', errorMessage, error)
    return 0
  }
}

/**
 * Calculează totalul pentru toate leads-urile (suma tuturor service files și trays)
 */
async function calculateTotalRevenue(): Promise<number> {
  try {
    // Obține data de astăzi (începutul zilei și sfârșitul zilei în UTC)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStart = today.toISOString()
    
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)
    const todayEndISO = todayEnd.toISOString()

    // Obține toate leads-urile din pipeline_items
    const { data: leadPipelineItems, error: leadError } = await supabase
      .from('pipeline_items')
      .select('item_id')
      .eq('type', 'lead')

    if (leadError) throw leadError
    if (!leadPipelineItems || leadPipelineItems.length === 0) return 0

    const leadIds = [...new Set(leadPipelineItems.map(item => item.item_id as string))]

    // Obține toate service files pentru aceste leads, filtrate doar pentru ziua curentă
    const { data: serviceFiles, error: sfError } = await supabase
      .from('service_files')
      .select('id, lead_id, created_at')
      .in('lead_id', leadIds)
      .gte('created_at', todayStart)
      .lt('created_at', todayEndISO)

    if (sfError) throw sfError
    if (!serviceFiles || serviceFiles.length === 0) return 0

    const serviceFileIds = serviceFiles.map(sf => sf.id)

    // Obține toate tăvițele pentru aceste service files
    const { data: trays, error: traysError } = await fetchTraysForServiceFiles(serviceFileIds)
    if (traysError) throw traysError
    if (!trays || trays.length === 0) return 0

    const trayIds = trays.map(t => t.id)

    // Obține toate item-urile pentru toate tăvițele
    const { data: trayItems, error: itemsError } = await fetchTrayItems(trayIds)
    if (itemsError) throw itemsError
    if (!trayItems || trayItems.length === 0) return 0

    // Obține prețurile serviciilor
    const serviceIds = [...new Set(trayItems.map(ti => ti.service_id).filter(Boolean))] as string[]
    if (serviceIds.length === 0) return 0
    
    const { data: servicePrices, error: pricesError } = await fetchServicePrices(serviceIds)
    if (pricesError) throw pricesError
    if (!servicePrices) return 0

    // Obține subscription_type pentru fiecare service_file (dacă coloana există)
    // Dacă coloana nu există, folosim valoarea implicită ''
    const subscriptionMap = new Map<string, string>()
    
    try {
      const { data: sfData, error: subscriptionError } = await supabase
        .from('service_files')
        .select('id, subscription_type')
        .in('id', serviceFileIds)

      if (!subscriptionError && sfData) {
        sfData.forEach((sf: any) => {
          subscriptionMap.set(sf.id, sf.subscription_type || '')
        })
      }
    } catch (err) {
      // Dacă coloana nu există, folosim valoarea implicită pentru toate
      serviceFileIds.forEach(sfId => {
        subscriptionMap.set(sfId, '')
      })
    }

    // Calculează totalul pentru fiecare tăviță
    let totalRevenue = 0
    trays.forEach(tray => {
      const subscriptionType = subscriptionMap.get(tray.service_file_id) || ''
      const trayTotal = calculateTrayTotal(tray.id, trayItems, servicePrices, subscriptionType)
      totalRevenue += trayTotal
    })

    return totalRevenue
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : (error && typeof error === 'object' && 'message' in error)
        ? String((error as any).message)
        : (error && typeof error === 'object' && 'code' in error)
          ? `Error code: ${(error as any).code}`
          : JSON.stringify(error)
    console.error('Error calculating total revenue:', errorMessage, error)
    return 0
  }
}

/**
 * Calculează numărul de leads-uri urgente (leads cu cel puțin o fișă de serviciu urgentă)
 */
async function calculateUrgentLeads(): Promise<number> {
  try {
    // Obține toate service files urgente
    const { data: urgentServiceFiles, error: sfError } = await supabase
      .from('service_files')
      .select('lead_id')
      .eq('urgent', true)

    if (sfError) throw sfError
    if (!urgentServiceFiles || urgentServiceFiles.length === 0) return 0

    // Numără leads-urile unice care au cel puțin o fișă urgentă
    const urgentLeadIds = [...new Set(urgentServiceFiles.map(sf => sf.lead_id))]
    return urgentLeadIds.length
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : (error && typeof error === 'object' && 'message' in error)
        ? String((error as any).message)
        : JSON.stringify(error)
    console.error('Error calculating urgent leads:', errorMessage, error)
    return 0
  }
}

/**
 * Calculează numărul de leads-uri noi create astăzi
 */
async function calculateNewLeadsToday(): Promise<number> {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStart = today.toISOString()

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStart = tomorrow.toISOString()

    const { data: leads, error } = await supabase
      .from('leads')
      .select('id')
      .gte('created_at', todayStart)
      .lt('created_at', tomorrowStart)

    if (error) throw error
    return leads?.length || 0
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : (error && typeof error === 'object' && 'message' in error)
        ? String((error as any).message)
        : JSON.stringify(error)
    console.error('Error calculating new leads today:', errorMessage, error)
    return 0
  }
}

/**
 * Calculează distribuția leads-urilor pe pipeline-uri
 */
async function calculateLeadsByPipeline(): Promise<Record<string, number>> {
  try {
    const { data: pipelines, error: pipelinesError } = await supabase
      .from('pipelines')
      .select('id, name')

    if (pipelinesError) throw pipelinesError
    if (!pipelines || pipelines.length === 0) return {}

    const result: Record<string, number> = {}

    for (const pipeline of pipelines) {
      const { count, error } = await supabase
        .from('pipeline_items')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'lead')
        .eq('pipeline_id', pipeline.id)

      if (!error) {
        result[pipeline.name] = count || 0
      }
    }

    return result
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : (error && typeof error === 'object' && 'message' in error)
        ? String((error as any).message)
        : JSON.stringify(error)
    console.error('Error calculating leads by pipeline:', errorMessage, error)
    return {}
  }
}

/**
 * Calculează distribuția leads-urilor pe stage-uri
 */
async function calculateLeadsByStage(): Promise<Record<string, number>> {
  try {
    const { data: stages, error: stagesError } = await supabase
      .from('stages')
      .select('id, name, pipeline_id')

    if (stagesError) throw stagesError
    if (!stages || stages.length === 0) return {}

    const result: Record<string, number> = {}

    for (const stage of stages) {
      const { count, error } = await supabase
        .from('pipeline_items')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'lead')
        .eq('stage_id', stage.id)

      if (!error) {
        result[stage.name] = count || 0
      }
    }

    return result
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : (error && typeof error === 'object' && 'message' in error)
        ? String((error as any).message)
        : JSON.stringify(error)
    console.error('Error calculating leads by stage:', errorMessage, error)
    return {}
  }
}

/**
 * Calculează revenue-ul pe pipeline-uri
 */
async function calculateRevenueByPipeline(): Promise<Record<string, number>> {
  try {
    const { data: pipelines, error: pipelinesError } = await supabase
      .from('pipelines')
      .select('id, name')

    if (pipelinesError) throw pipelinesError
    if (!pipelines || pipelines.length === 0) return {}

    const result: Record<string, number> = {}

    for (const pipeline of pipelines) {
      // Obține leads-urile din acest pipeline
      const { data: leadItems, error: leadError } = await supabase
        .from('pipeline_items')
        .select('item_id')
        .eq('type', 'lead')
        .eq('pipeline_id', pipeline.id)

      if (leadError || !leadItems || leadItems.length === 0) {
        result[pipeline.name] = 0
        continue
      }

      const leadIds = [...new Set(leadItems.map(item => item.item_id as string))]

      // Obține service files pentru aceste leads
      const { data: serviceFiles, error: sfError } = await fetchServiceFilesForLeads(leadIds)
      if (sfError || !serviceFiles || serviceFiles.length === 0) {
        result[pipeline.name] = 0
        continue
      }

      const serviceFileIds = serviceFiles.map(sf => sf.id)

      // Obține tăvițele
      const { data: trays, error: traysError } = await fetchTraysForServiceFiles(serviceFileIds)
      if (traysError || !trays || trays.length === 0) {
        result[pipeline.name] = 0
        continue
      }

      const trayIds = trays.map(t => t.id)

      // Obține item-urile
      const { data: trayItems, error: itemsError } = await fetchTrayItems(trayIds)
      if (itemsError || !trayItems || trayItems.length === 0) {
        result[pipeline.name] = 0
        continue
      }

      // Obține prețurile
      const serviceIds = [...new Set(trayItems.map(ti => ti.service_id).filter(Boolean))] as string[]
      if (serviceIds.length === 0) {
        result[pipeline.name] = 0
        continue
      }
      
      const { data: servicePrices, error: pricesError } = await fetchServicePrices(serviceIds)
      if (pricesError || !servicePrices) {
        result[pipeline.name] = 0
        continue
      }

      // Obține subscription_type (dacă coloana există)
      const subscriptionMap = new Map<string, string>()
      
      try {
        const { data: sfData } = await supabase
          .from('service_files')
          .select('id, subscription_type')
          .in('id', serviceFileIds)

        if (sfData) {
          sfData.forEach((sf: any) => {
            subscriptionMap.set(sf.id, sf.subscription_type || '')
          })
        }
      } catch (err) {
        // Dacă coloana nu există, folosim valoarea implicită pentru toate
        serviceFileIds.forEach(sfId => {
          subscriptionMap.set(sfId, '')
        })
      }

      // Calculează totalul
      let pipelineRevenue = 0
      trays.forEach(tray => {
        const subscriptionType = subscriptionMap.get(tray.service_file_id) || ''
        const trayTotal = calculateTrayTotal(tray.id, trayItems, servicePrices, subscriptionType)
        pipelineRevenue += trayTotal
      })

      result[pipeline.name] = pipelineRevenue
    }

    return result
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : (error && typeof error === 'object' && 'message' in error)
        ? String((error as any).message)
        : JSON.stringify(error)
    console.error('Error calculating revenue by pipeline:', errorMessage, error)
    return {}
  }
}

/**
 * Calculează statisticile pentru payment methods (cash/card)
 */
async function calculatePaymentMethodStats(): Promise<{ cash: number; card: number; none: number }> {
  try {
    // Obține toate service files care sunt în stage-ul "Facturat" din pipeline-ul "Receptie"
    const { data: receptiePipeline } = await supabase
      .from('pipelines')
      .select('id')
      .ilike('name', '%receptie%')
      .single()

    if (!receptiePipeline) return { cash: 0, card: 0, none: 0 }

    const { data: facturatStages } = await supabase
      .from('stages')
      .select('id')
      .eq('pipeline_id', receptiePipeline.id)
      .or('name.ilike.%facturat%,name.ilike.%facturată%')

    if (!facturatStages || facturatStages.length === 0) return { cash: 0, card: 0, none: 0 }

    const facturatStageIds = facturatStages.map(s => s.id)

    const { data: serviceFileItems } = await supabase
      .from('pipeline_items')
      .select('item_id')
      .eq('type', 'service_file')
      .in('stage_id', facturatStageIds)

    if (!serviceFileItems || serviceFileItems.length === 0) return { cash: 0, card: 0, none: 0 }

    const serviceFileIds = serviceFileItems.map(item => item.item_id as string)

    const { data: serviceFiles } = await supabase
      .from('service_files')
      .select('details')
      .in('id', serviceFileIds)

    if (!serviceFiles) return { cash: 0, card: 0, none: 0 }

    let cashCount = 0
    let cardCount = 0
    let noneCount = 0

    serviceFiles.forEach(sf => {
      if (!sf.details) {
        noneCount++
        return
      }

      try {
        const details = JSON.parse(sf.details)
        if (details.paymentCash === true) {
          cashCount++
        } else if (details.paymentCard === true) {
          cardCount++
        } else {
          noneCount++
        }
      } catch {
        noneCount++
      }
    })

    return { cash: cashCount, card: cardCount, none: noneCount }
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : (error && typeof error === 'object' && 'message' in error)
        ? String((error as any).message)
        : JSON.stringify(error)
    console.error('Error calculating payment method stats:', errorMessage, error)
    return { cash: 0, card: 0, none: 0 }
  }
}

/**
 * Calculează numărul total de leads din tabelul leads
 */
async function calculateTotalLeads(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })

    if (error) throw error
    return count || 0
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : (error && typeof error === 'object' && 'message' in error)
        ? String((error as any).message)
        : JSON.stringify(error)
    console.error('Error calculating total leads:', errorMessage, error)
    return 0
  }
}

/**
 * Calculează numărul de leads cu "no deal"
 * Acum no_deal este salvat în tabelul leads, nu în service_files
 */
async function calculateNoDealLeads(): Promise<number> {
  try {
    // Obține toate leads-urile cu no_deal = true sau 'true' sau 1
    const { data: allLeads, error: leadsError } = await supabase
      .from('leads')
      .select('id, no_deal')

    if (leadsError) throw leadsError
    if (!allLeads || allLeads.length === 0) return 0

    // Filtrează leads-urile cu no_deal activ (true, 'true', 1, '1', etc.)
    const noDealLeads = allLeads.filter(lead => {
      const noDealValue = lead.no_deal
      // Verifică multiple formate posibile
      return noDealValue === true || 
             noDealValue === 'true' || 
             noDealValue === 1 || 
             noDealValue === '1' ||
             (typeof noDealValue === 'string' && noDealValue.toLowerCase() === 'true')
    })

    return noDealLeads.length
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : (error && typeof error === 'object' && 'message' in error)
        ? String((error as any).message)
        : JSON.stringify(error)
    console.error('Error calculating no deal leads:', errorMessage, error)
    return 0
  }
}

/**
 * Calculează toate metricile pentru dashboard
 */
export async function calculateDashboardMetrics(excludePipeline?: string): Promise<DashboardMetrics> {
  try {
    // Calculează toate metricile în paralel pentru performanță
    const [
      totalLeadsResult,
      totalRevenue,
      urgentLeads,
      newLeadsToday,
      leadsByPipeline,
      leadsByStage,
      revenueByPipeline,
      paymentMethodStats,
      totalInLucru,
      noDealLeads
    ] = await Promise.all([
      calculateTotalLeads(),
      calculateTotalRevenue(),
      calculateUrgentLeads(),
      calculateNewLeadsToday(),
      calculateLeadsByPipeline(),
      calculateLeadsByStage(),
      calculateRevenueByPipeline(),
      calculatePaymentMethodStats(),
      calculateTotalInLucru(),
      calculateNoDealLeads()
    ])

    const totalLeads = totalLeadsResult || 0

    return {
      totalLeads,
      totalRevenue,
      urgentLeads,
      newLeadsToday,
      leadsByPipeline,
      leadsByStage,
      revenueByPipeline,
      revenueByStage: {}, // Poate fi implementat similar cu revenueByPipeline
      leadsOverTime: [], // Poate fi implementat cu agregări pe date
      topTechnicians: [], // Poate fi implementat cu agregări pe technician_id
      tagDistribution: {}, // Poate fi implementat cu lead_tags
      conversionRate: 0,
      averageLeadValue: totalLeads > 0 ? totalRevenue / totalLeads : 0,
      paymentMethodStats,
      totalInLucru,
      noDealLeads
    }
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : (error && typeof error === 'object' && 'message' in error)
        ? String((error as any).message)
        : JSON.stringify(error)
    console.error('Error calculating dashboard metrics:', errorMessage, error)
    return emptyMetrics
  }
}

/**
 * Get Vanzari dashboard metrics
 */
export async function calculateVanzariMetrics(): Promise<DashboardMetrics> {
  try {
    // Pentru Vanzari, calculăm doar leads-urile din pipeline-ul Vanzari
    const { data: vanzariPipeline } = await supabase
      .from('pipelines')
      .select('id')
      .ilike('name', '%vanzari%')
      .single()

    if (!vanzariPipeline) return emptyMetrics

    // Obține leads-urile din pipeline-ul Vanzari
    const { data: leadItems, error: leadError } = await supabase
      .from('pipeline_items')
      .select('item_id')
      .eq('type', 'lead')
      .eq('pipeline_id', vanzariPipeline.id)

    if (leadError || !leadItems || leadItems.length === 0) {
      return { ...emptyMetrics, totalLeads: 0 }
    }

    const leadIds = [...new Set(leadItems.map(item => item.item_id as string))]

    // Calculează revenue-ul pentru aceste leads
    const { data: serviceFiles, error: sfError } = await fetchServiceFilesForLeads(leadIds)
    let totalRevenue = 0

    if (!sfError && serviceFiles && serviceFiles.length > 0) {
      const serviceFileIds = serviceFiles.map(sf => sf.id)
      const { data: trays, error: traysError } = await fetchTraysForServiceFiles(serviceFileIds)

      if (!traysError && trays && trays.length > 0) {
        const trayIds = trays.map(t => t.id)
        const { data: trayItems, error: itemsError } = await fetchTrayItems(trayIds)

        if (!itemsError && trayItems && trayItems.length > 0) {
          const serviceIds = [...new Set(trayItems.map(ti => ti.service_id).filter(Boolean))] as string[]
          
          if (serviceIds.length > 0) {
            const { data: servicePrices, error: pricesError } = await fetchServicePrices(serviceIds)

            if (!pricesError && servicePrices) {
              const subscriptionMap = new Map<string, string>()
              
              try {
                const { data: sfData } = await supabase
                  .from('service_files')
                  .select('id, subscription_type')
                  .in('id', serviceFileIds)

                if (sfData) {
                  sfData.forEach((sf: any) => {
                    subscriptionMap.set(sf.id, sf.subscription_type || '')
                  })
                }
              } catch (err) {
                // Dacă coloana nu există, folosim valoarea implicită pentru toate
                serviceFileIds.forEach(sfId => {
                  subscriptionMap.set(sfId, '')
                })
              }

              trays.forEach(tray => {
                const subscriptionType = subscriptionMap.get(tray.service_file_id) || ''
                const trayTotal = calculateTrayTotal(tray.id, trayItems, servicePrices, subscriptionType)
                totalRevenue += trayTotal
              })
            }
          }
        }
      }
    }

    // Calculează celelalte metrici
    const urgentLeads = await calculateUrgentLeads()
    const newLeadsToday = await calculateNewLeadsToday()
    const paymentMethodStats = await calculatePaymentMethodStats()
    const totalInLucru = await calculateTotalInLucru()

    return {
      totalLeads: leadIds.length,
      totalRevenue,
      urgentLeads,
      newLeadsToday,
      leadsByPipeline: { 'Vanzari': leadIds.length },
      leadsByStage: {},
      revenueByPipeline: { 'Vanzari': totalRevenue },
      revenueByStage: {},
      leadsOverTime: [],
      topTechnicians: [],
      tagDistribution: {},
      conversionRate: 0,
      averageLeadValue: leadIds.length > 0 ? totalRevenue / leadIds.length : 0,
      paymentMethodStats,
      totalInLucru,
      noDealLeads: await calculateNoDealLeads()
    }
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : (error && typeof error === 'object' && 'message' in error)
        ? String((error as any).message)
        : JSON.stringify(error)
    console.error('Error calculating Vanzari metrics:', errorMessage, error)
    return emptyMetrics
  }
}
