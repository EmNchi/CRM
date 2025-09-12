'use client'

import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getPipelinesWithStages, getKanbanLeads, moveLeadToStage } from '@/lib/supabase/leadOperations'
import type { KanbanLead } from '../lib/types/database'

const supabase = supabaseBrowser()
const toSlug = (s: string) => String(s).toLowerCase().replace(/\s+/g, '-')

export function useKanbanData(pipelineSlug?: string) {
  const [leads, setLeads] = useState<KanbanLead[]>([])
  const [stages, setStages] = useState<string[]>([])
  const [pipelines, setPipelines] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      const { data: pipelinesData, error: pipelineError } = await getPipelinesWithStages()
      if (pipelineError) throw pipelineError

      setPipelines(pipelinesData.map((p: any) => p.name))

      const currentPipeline = pipelineSlug
        ? pipelinesData.find((p: any) => toSlug(p.name) === pipelineSlug)
        : pipelinesData?.[0]

      if (currentPipeline) {
        setStages(currentPipeline.stages.map((s: any) => s.name))
        const { data: leadsData, error: leadsError } = await getKanbanLeads(currentPipeline.id)
        if (leadsError) throw leadsError
        setLeads(leadsData || [])
      } else {
        setStages([])
        setLeads([])
      }

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [pipelineSlug])

  const loadDataRef = useRef(loadData)
  useEffect(() => { loadDataRef.current = loadData }, [loadData])

  useEffect(() => {
    loadData()
  }, [loadData, reloadKey])

  useEffect(() => {
    const channel = supabase
      .channel('kanban-pipelines')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pipelines' },
        () => loadDataRef.current()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (!pipelineSlug) return

    const channel = supabase
      .channel(`kanban-changes-${pipelineSlug}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lead_pipelines' },
        () => loadDataRef.current()
      )
      // also refresh on stage create/delete
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stages' },
        () => loadDataRef.current()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [pipelineSlug])

  const reload = () => setReloadKey(k => k + 1)

  const handleLeadMove = useCallback(async (leadId: string, newStageName: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return

    const { data: pipelinesData } = await getPipelinesWithStages()
    const currentPipeline = pipelinesData?.find((p: any) => p.id === lead.pipelineId)
    const newStage = currentPipeline?.stages.find((s: any) => s.name === newStageName)
    if (!newStage) return

    setLeads(prev =>
      prev.map(l => (l.id === leadId ? { ...l, stage: newStageName, stageId: newStage.id } : l))
    )

    const { error } = await moveLeadToStage(lead.leadId, lead.pipelineId, newStage.id)
    if (error) {
      setError('Failed to move lead')
      loadDataRef.current()
    }
  }, [leads])

  return { leads, stages, pipelines, loading, error, handleLeadMove, refresh: loadData, reload }
}
