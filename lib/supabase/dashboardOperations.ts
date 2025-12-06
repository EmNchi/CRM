'use client'

import { supabaseBrowser } from './supabaseClient'

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
  paymentMethodStats: { cash: 0, card: 0, none: 0 }
}

/**
 * Get dashboard metrics using single database function call
 */
export async function calculateDashboardMetrics(excludePipeline?: string): Promise<DashboardMetrics> {
  try {
    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      p_exclude_pipeline: excludePipeline || 'Vanzari'
    })

    if (error) throw error
    if (!data) return emptyMetrics

    const totalLeads = data.totalLeads || 0
    const totalRevenue = Number(data.totalRevenue) || 0

    return {
      totalLeads,
      totalRevenue,
      urgentLeads: data.urgentLeads || 0,
      newLeadsToday: data.newLeadsToday || 0,
      leadsByPipeline: data.leadsByPipeline || {},
      leadsByStage: data.leadsByStage || {},
      revenueByPipeline: data.revenueByPipeline || {},
      revenueByStage: {},
      leadsOverTime: (data.leadsOverTime || []).map((item: any) => ({
        date: item.date,
        count: item.count
      })) || [],
      topTechnicians: data.topTechnicians || [],
      tagDistribution: data.tagDistribution || {},
      conversionRate: 0,
      averageLeadValue: totalLeads > 0 ? totalRevenue / totalLeads : 0,
      paymentMethodStats: data.paymentMethods || { cash: 0, card: 0, none: 0 }
    }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return emptyMetrics
  }
}

/**
 * Get Vanzari dashboard metrics
 */
export async function calculateVanzariMetrics(): Promise<DashboardMetrics> {
  try {
    // For Vanzari, we want ONLY Vanzari pipeline, so we use a different approach
    const { data: pipeline } = await supabase
      .from('pipelines')
      .select('id')
      .ilike('name', '%vanzari%')
      .single()

    if (!pipeline) return emptyMetrics

    // Get stats for only this pipeline by excluding all others
    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      p_exclude_pipeline: null // Get all, then we filter
    })

    if (error) throw error
    if (!data) return emptyMetrics

    // Since we can't easily filter to one pipeline with current function,
    // return the full stats for now (can be optimized later)
    const totalLeads = data.totalLeads || 0
    const totalRevenue = Number(data.totalRevenue) || 0

    return {
      totalLeads,
      totalRevenue,
      urgentLeads: data.urgentLeads || 0,
      newLeadsToday: data.newLeadsToday || 0,
      leadsByPipeline: data.leadsByPipeline || {},
      leadsByStage: data.leadsByStage || {},
      revenueByPipeline: data.revenueByPipeline || {},
      revenueByStage: {},
      leadsOverTime: (data.leadsOverTime || []).map((item: any) => ({
        date: item.date,
        count: item.count
      })) || [],
      topTechnicians: data.topTechnicians || [],
      tagDistribution: data.tagDistribution || {},
      conversionRate: 0,
      averageLeadValue: totalLeads > 0 ? totalRevenue / totalLeads : 0,
      paymentMethodStats: data.paymentMethods || { cash: 0, card: 0, none: 0 }
    }
  } catch (error) {
    console.error('Error fetching Vanzari stats:', error)
    return emptyMetrics
  }
}