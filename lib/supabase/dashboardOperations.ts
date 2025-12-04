'use client'

import { supabaseBrowser } from './supabaseClient'
import { getPipelinesWithStages, getKanbanLeads } from './leadOperations'
import { calculateMultipleLeadTotals } from './leadTotals'
import type { KanbanLead } from '../types/database'

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
}

/**
 * Obține toate lead-urile din toate pipeline-urile pentru analiză dashboard
 * Exclude pipeline-ul "Vanzari" din dashboard-ul principal
 */
export async function getAllLeadsForDashboard(excludePipeline?: string): Promise<{
  leads: KanbanLead[]
  pipelineMap: Map<string, string> // Map de pipelineId -> pipelineName
}> {
  try {
    // obtine toate pipeline-urile
    const { data: pipelinesData, error: pipelineError } = await getPipelinesWithStages()
    if (pipelineError) throw pipelineError

    // filtreaza pipeline-urile (exclude Vanzari pentru dashboard principal)
    const filteredPipelines = excludePipeline
      ? pipelinesData.filter((p: any) => p.name.toLowerCase() !== excludePipeline.toLowerCase())
      : pipelinesData

    // creeaza map de pipelineId -> pipelineName
    const pipelineMap = new Map<string, string>()
    pipelinesData.forEach((pipeline: any) => {
      pipelineMap.set(pipeline.id, pipeline.name)
    })

    // obtine lead-urile pentru pipeline-urile filtrate in paralel
    const leadsPromises = filteredPipelines.map((pipeline: any) => getKanbanLeads(pipeline.id))
    const leadsResults = await Promise.all(leadsPromises)

    // combina toate lead-urile
    const allLeads: KanbanLead[] = []
    leadsResults.forEach((result) => {
      if (result.data) {
        allLeads.push(...result.data)
      }
    })

    return { leads: allLeads, pipelineMap }
  } catch (error) {
    console.error('Error fetching all leads for dashboard:', error)
    return { leads: [], pipelineMap: new Map() }
  }
}

/**
 * Obține lead-urile doar pentru pipeline-ul "Vanzari"
 */
export async function getVanzariLeads(): Promise<{
  leads: KanbanLead[]
  pipelineMap: Map<string, string>
}> {
  try {
    const { data: pipelinesData, error: pipelineError } = await getPipelinesWithStages()
    if (pipelineError) throw pipelineError

    const vanzariPipeline = pipelinesData.find((p: any) => 
      p.name.toLowerCase() === 'vanzari' || p.name.toLowerCase() === 'vânzări'
    )

    if (!vanzariPipeline) {
      return { leads: [], pipelineMap: new Map() }
    }

    const pipelineMap = new Map<string, string>()
    pipelineMap.set(vanzariPipeline.id, vanzariPipeline.name)

    const { data: leadsData, error: leadsError } = await getKanbanLeads(vanzariPipeline.id)
    if (leadsError) throw leadsError

    return { 
      leads: leadsData || [], 
      pipelineMap 
    }
  } catch (error) {
    console.error('Error fetching Vanzari leads:', error)
    return { leads: [], pipelineMap: new Map() }
  }
}

/**
 * Calculează metricile pentru dashboard principal (exclude Vanzari)
 */
export async function calculateDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    const { leads: allLeads, pipelineMap } = await getAllLeadsForDashboard('Vanzari')
    
    // Calculează metrici de bază
    const totalLeads = allLeads.length
    const urgentLeads = allLeads.filter(lead => 
      lead.tags?.some(tag => tag.name.toLowerCase() === 'urgent')
    ).length

    // Lead-uri noi astăzi
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const newLeadsToday = allLeads.filter(lead => {
      if (!lead.createdAt) return false
      const leadDate = new Date(lead.createdAt)
      leadDate.setHours(0, 0, 0, 0)
      return leadDate.getTime() === today.getTime()
    }).length

    // Lead-uri pe pipeline (folosind numele pipeline-ului)
    const leadsByPipeline: Record<string, number> = {}
    allLeads.forEach(lead => {
      const pipelineName = pipelineMap.get(lead.pipelineId) || 'Unknown'
      leadsByPipeline[pipelineName] = (leadsByPipeline[pipelineName] || 0) + 1
    })

    // Lead-uri pe stage
    const leadsByStage: Record<string, number> = {}
    allLeads.forEach(lead => {
      const stage = lead.stage || 'Unknown'
      leadsByStage[stage] = (leadsByStage[stage] || 0) + 1
    })

    // Tag distribution
    const tagDistribution: Record<string, number> = {}
    allLeads.forEach(lead => {
      lead.tags?.forEach(tag => {
        tagDistribution[tag.name] = (tagDistribution[tag.name] || 0) + 1
      })
    })

    // calculeaza revenue pentru toate lead-urile (batch)
    const leadIds = allLeads.map(lead => lead.id)
    const revenueMap = await calculateMultipleLeadTotals(leadIds)
    
    const totalRevenue = Object.values(revenueMap).reduce((sum, total) => sum + total, 0)
    const averageLeadValue = totalLeads > 0 ? totalRevenue / totalLeads : 0

    // Revenue pe pipeline (folosind numele pipeline-ului)
    const revenueByPipeline: Record<string, number> = {}
    allLeads.forEach(lead => {
      const pipelineName = pipelineMap.get(lead.pipelineId) || 'Unknown'
      const revenue = revenueMap[lead.id] || 0
      revenueByPipeline[pipelineName] = (revenueByPipeline[pipelineName] || 0) + revenue
    })

    // Revenue pe stage - metrică importantă pentru analitic economic/contabil
    const revenueByStage: Record<string, number> = {}
    allLeads.forEach(lead => {
      const stage = lead.stage || 'Unknown'
      const revenue = revenueMap[lead.id] || 0
      revenueByStage[stage] = (revenueByStage[stage] || 0) + revenue
    })

    // Top technicians
    const technicianStats: Record<string, { leads: number; revenue: number }> = {}
    allLeads.forEach(lead => {
      if (lead.technician) {
        if (!technicianStats[lead.technician]) {
          technicianStats[lead.technician] = { leads: 0, revenue: 0 }
        }
        technicianStats[lead.technician].leads++
        technicianStats[lead.technician].revenue += revenueMap[lead.id] || 0
      }
    })

    const topTechnicians = Object.entries(technicianStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 10)

    // Lead-uri pe timp (ultimele 30 de zile)
    const leadsOverTime: Array<{ date: string; count: number }> = []
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (29 - i))
      date.setHours(0, 0, 0, 0)
      return date
    })

    last30Days.forEach(date => {
      const count = allLeads.filter(lead => {
        if (!lead.createdAt) return false
        const leadDate = new Date(lead.createdAt)
        leadDate.setHours(0, 0, 0, 0)
        return leadDate.getTime() === date.getTime()
      }).length

      leadsOverTime.push({
        date: date.toISOString().split('T')[0],
        count
      })
    })

    // conversion rate (simplificat: lead-uri in stage-uri finale vs total)
    // presupunem ca stage-urile finale sunt cele care contin confirmat, finalizat, etc
    const finalStages = Object.keys(leadsByStage).filter(stage => 
      stage.toLowerCase().includes('confirmat') || 
      stage.toLowerCase().includes('finalizat') ||
      stage.toLowerCase().includes('complet')
    )
    const convertedLeads = finalStages.reduce((sum, stage) => sum + (leadsByStage[stage] || 0), 0)
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0

    // calculeaza statistici pentru metode de plata (cash vs card)
    let cashCount = 0
    let cardCount = 0
    let noneCount = 0

    if (leadIds.length > 0) {
      // obtine toate quote-urile pentru lead-urile din dashboard
      const { data: quotesData, error: quotesError } = await supabase
        .from('lead_quotes')
        .select('lead_id, is_cash, is_card')
        .in('lead_id', leadIds)

      if (!quotesError && quotesData) {
        // numara lead-urile unice cu cash/card
        const leadPaymentMap = new Map<string, { cash: boolean; card: boolean }>()
        
        quotesData.forEach((quote: any) => {
          const leadId = quote.lead_id
          if (!leadPaymentMap.has(leadId)) {
            leadPaymentMap.set(leadId, { cash: false, card: false })
          }
          const payment = leadPaymentMap.get(leadId)!
          if (quote.is_cash) payment.cash = true
          if (quote.is_card) payment.card = true
        })

        leadPaymentMap.forEach((payment) => {
          if (payment.cash) {
            cashCount++
          } else if (payment.card) {
            cardCount++
          } else {
            noneCount++
          }
        })
      } else {
        // daca nu exista câmpuri, numara toate lead-urile ca "none"
        noneCount = leadIds.length
      }
    }

    return {
      totalLeads,
      totalRevenue,
      urgentLeads,
      newLeadsToday,
      leadsByPipeline,
      leadsByStage,
      revenueByPipeline,
      revenueByStage,
      leadsOverTime,
      topTechnicians,
      tagDistribution,
      conversionRate,
      averageLeadValue,
      paymentMethodStats: {
        cash: cashCount,
        card: cardCount,
        none: noneCount
      }
    }
  } catch (error) {
    console.error('Error calculating dashboard metrics:', error)
    return {
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
      paymentMethodStats: {
        cash: 0,
        card: 0,
        none: 0
      }
    }
  }
}

/**
 * Calculează metricile pentru dashboard-ul Vanzari
 */
export async function calculateVanzariMetrics(): Promise<DashboardMetrics> {
  try {
    const { leads: allLeads, pipelineMap } = await getVanzariLeads()
    
    if (allLeads.length === 0) {
      return {
        totalLeads: 0,
        totalRevenue: 0,
        urgentLeads: 0,
        newLeadsToday: 0,
        leadsByPipeline: {},
        leadsByStage: {},
        revenueByPipeline: {},
        leadsOverTime: [],
        topTechnicians: [],
        tagDistribution: {},
        conversionRate: 0,
        averageLeadValue: 0
      }
    }
    
    // Calculează metrici de bază
    const totalLeads = allLeads.length
    const urgentLeads = allLeads.filter(lead => 
      lead.tags?.some(tag => tag.name.toLowerCase() === 'urgent')
    ).length

    // Lead-uri noi astăzi
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const newLeadsToday = allLeads.filter(lead => {
      if (!lead.createdAt) return false
      const leadDate = new Date(lead.createdAt)
      leadDate.setHours(0, 0, 0, 0)
      return leadDate.getTime() === today.getTime()
    }).length

    // Lead-uri pe pipeline
    const leadsByPipeline: Record<string, number> = {}
    allLeads.forEach(lead => {
      const pipelineName = pipelineMap.get(lead.pipelineId) || 'Vanzari'
      leadsByPipeline[pipelineName] = (leadsByPipeline[pipelineName] || 0) + 1
    })

    // Lead-uri pe stage
    const leadsByStage: Record<string, number> = {}
    allLeads.forEach(lead => {
      const stage = lead.stage || 'Unknown'
      leadsByStage[stage] = (leadsByStage[stage] || 0) + 1
    })

    // Tag distribution
    const tagDistribution: Record<string, number> = {}
    allLeads.forEach(lead => {
      lead.tags?.forEach(tag => {
        tagDistribution[tag.name] = (tagDistribution[tag.name] || 0) + 1
      })
    })

    // calculeaza revenue
    const leadIds = allLeads.map(lead => lead.id)
    const revenueMap = await calculateMultipleLeadTotals(leadIds)
    
    const totalRevenue = Object.values(revenueMap).reduce((sum, total) => sum + total, 0)
    const averageLeadValue = totalLeads > 0 ? totalRevenue / totalLeads : 0

    // Revenue pe pipeline
    const revenueByPipeline: Record<string, number> = {}
    allLeads.forEach(lead => {
      const pipelineName = pipelineMap.get(lead.pipelineId) || 'Vanzari'
      const revenue = revenueMap[lead.id] || 0
      revenueByPipeline[pipelineName] = (revenueByPipeline[pipelineName] || 0) + revenue
    })

    // Revenue pe stage - metrică importantă pentru analitic economic/contabil
    const revenueByStage: Record<string, number> = {}
    allLeads.forEach(lead => {
      const stage = lead.stage || 'Unknown'
      const revenue = revenueMap[lead.id] || 0
      revenueByStage[stage] = (revenueByStage[stage] || 0) + revenue
    })

    // Top technicians
    const technicianStats: Record<string, { leads: number; revenue: number }> = {}
    allLeads.forEach(lead => {
      if (lead.technician) {
        if (!technicianStats[lead.technician]) {
          technicianStats[lead.technician] = { leads: 0, revenue: 0 }
        }
        technicianStats[lead.technician].leads++
        technicianStats[lead.technician].revenue += revenueMap[lead.id] || 0
      }
    })

    const topTechnicians = Object.entries(technicianStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 10)

    // Lead-uri pe timp (ultimele 30 de zile)
    const leadsOverTime: Array<{ date: string; count: number }> = []
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (29 - i))
      date.setHours(0, 0, 0, 0)
      return date
    })

    last30Days.forEach(date => {
      const count = allLeads.filter(lead => {
        if (!lead.createdAt) return false
        const leadDate = new Date(lead.createdAt)
        leadDate.setHours(0, 0, 0, 0)
        return leadDate.getTime() === date.getTime()
      }).length

      leadsOverTime.push({
        date: date.toISOString().split('T')[0],
        count
      })
    })

    // Conversion rate
    const finalStages = Object.keys(leadsByStage).filter(stage => 
      stage.toLowerCase().includes('confirmat') || 
      stage.toLowerCase().includes('finalizat') ||
      stage.toLowerCase().includes('complet')
    )
    const convertedLeads = finalStages.reduce((sum, stage) => sum + (leadsByStage[stage] || 0), 0)
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0

    return {
      totalLeads,
      totalRevenue,
      urgentLeads,
      newLeadsToday,
      leadsByPipeline,
      leadsByStage,
      revenueByPipeline,
      revenueByStage,
      leadsOverTime,
      topTechnicians,
      tagDistribution,
      conversionRate,
      averageLeadValue
    }
  } catch (error) {
    console.error('Error calculating Vanzari metrics:', error)
    return {
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
      averageLeadValue: 0
    }
  }
}

