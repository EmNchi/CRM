import { useState, useEffect } from 'react'
import { getPipelinesWithStages, getKanbanLeads, moveLeadToStage } from '@/lib/supabase/leadOperations'
import { supabase } from '@/lib/supabase/supabaseClient'
import type { KanbanLead, Stage } from '../lib/types/database'

export function useKanbanData(pipelineId?: string) {
  const [leads, setLeads] = useState<KanbanLead[]>([])
  const [stages, setStages] = useState<string[]>([])
  const [pipelines, setPipelines] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
    
    const channel = supabase
      .channel('kanban-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_pipelines' }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [pipelineId])

  async function loadData() {
    try {
      setLoading(true)
      
      const { data: pipelines, error: pipelineError } = await getPipelinesWithStages()
      if (pipelineError) throw pipelineError

      setPipelines(pipelines.map(p => p.name))

      const currentPipeline = pipelineId 
        ? pipelines?.find(p => p.id === pipelineId)
        : pipelines?.[0]

      if (currentPipeline) {
        setStages(currentPipeline.stages.map(s => s.name))
        
        const { data: leadsData, error: leadsError } = await getKanbanLeads(currentPipeline.id)
        if (leadsError) throw leadsError
        
        setLeads(leadsData || [])
      }
      
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  async function handleLeadMove(leadId: string, newStageName: string) {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return

    const { data: pipelines } = await getPipelinesWithStages()
    const currentPipeline = pipelines?.find((p: { id: string }) => p.id === lead.pipelineId)
    const newStage = currentPipeline?.stages.find((s: { name: string }) => s.name === newStageName)
    
    if (!newStage) return

    setLeads(prev => prev.map(l => 
      l.id === leadId ? { ...l, stage: newStageName, stageId: newStage.id } : l
    ))

    const { error } = await moveLeadToStage(lead.leadId, lead.pipelineId, newStage.id)
    
    if (error) {
      setError('Failed to move lead')
      loadData()
    }
  }

  return {
    leads,
    stages,
    pipelines,
    loading,
    error,
    handleLeadMove,
    refresh: loadData
  }
}