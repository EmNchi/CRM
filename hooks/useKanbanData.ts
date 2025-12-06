'use client'

import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getReceptieKanbanLeads, getKanbanLeads, moveLeadToStage, getSingleKanbanLead } from '@/lib/supabase/leadOperations'
import { usePipelinesCache } from './usePipelinesCache'
import type { KanbanLead } from '../lib/types/database'
import type { Tag } from '@/lib/supabase/tagOperations'

const supabase = supabaseBrowser()
const toSlug = (s: string) => String(s).toLowerCase().replace(/\s+/g, '-')

export function useKanbanData(pipelineSlug?: string) {
  const [leads, setLeads] = useState<KanbanLead[]>([])
  const [stages, setStages] = useState<string[]>([])
  const [pipelines, setPipelines] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentPipelineId, setCurrentPipelineId] = useState<string | null>(null)
  const { getPipelines, invalidateCache } = usePipelinesCache()
  
  // Debounce helper pentru refresh-uri
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      loadDataRef.current()
    }, 1000) // 1 secundă în loc de 200ms
  }, [])

  const patchLeadTags = useCallback((leadId: string, tags: Tag[]) => {
    setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, tags: tags as any } : l)))
  }, [])

  const handlePinToggle = useCallback((leadId: string, isPinned: boolean) => {
    // OPTIMISTIC UPDATE: Actualizează UI-ul imediat
    setLeads(prev => prev.map(l => {
      if (l.id !== leadId) return l
      
      // actualizeaza tag-urile: adauga sau elimina tag-ul PINNED
      const currentTags = l.tags || []
      const hasPinnedTag = currentTags.some(tag => tag.name === 'PINNED')
      
      if (isPinned && !hasPinnedTag) {
        // adauga tag-ul PINNED (va fi adaugat de server, dar actualizam local pentru UI instant)
        return { ...l, tags: [...currentTags, { id: 'temp-pinned', name: 'PINNED', color: 'blue' as any }] }
      } else if (!isPinned && hasPinnedTag) {
        // elimina tag-ul PINNED
        return { ...l, tags: currentTags.filter(tag => tag.name !== 'PINNED') }
      }
      
      return l
    }))
    
    // Real-time subscription pentru lead_tags va actualiza automat tag-urile
    // Nu mai e nevoie de refresh complet!
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      // Folosește cache pentru pipelines
      const pipelinesData = await getPipelines()
      if (!pipelinesData) throw new Error('Failed to load pipelines')

      setPipelines(pipelinesData.map((p: any) => p.name))

      const currentPipeline = pipelineSlug
        ? pipelinesData.find((p: any) => toSlug(p.name) === pipelineSlug)
        : pipelinesData?.[0]
        if (currentPipeline) {
          setCurrentPipelineId(currentPipeline.id)
          setStages(currentPipeline.stages.map((s: any) => s.name))
          
          const isReceptie = toSlug(currentPipeline.name) === 'receptie'
          let allLeads: KanbanLead[] = []
        
          if (isReceptie) {
            // Get stage IDs for mapping
            const confirmariStage = currentPipeline.stages.find((s: any) => 
              toSlug(s.name) === 'confirmari'
            )
            const inLucruStage = currentPipeline.stages.find((s: any) => {
              const stageName = toSlug(s.name)
              return stageName.includes('lucru') || stageName.includes('work') || stageName.includes('progress')
            })
            const asteptareStage = currentPipeline.stages.find((s: any) => {
              const stageName = toSlug(s.name)
              return stageName.includes('asteptare') || stageName.includes('waiting')
            })
        
            // Get source pipeline IDs
            const sourcePipelineNames = ['Saloane', 'Frizerii', 'Horeca', 'Reparatii']
            const sourcePipelineIds = sourcePipelineNames
              .map(name => pipelinesData.find((p: any) => toSlug(p.name) === toSlug(name)))
              .filter(Boolean)
              .map((p: any) => p.id)
        
            // Single database call for everything
            const { data: receptieLeads, error: receptieError } = await getReceptieKanbanLeads(
              currentPipeline.id,
              sourcePipelineIds,
              {
                confirmari: confirmariStage?.id || null,
                inLucru: inLucruStage?.id || null,
                asteptare: asteptareStage?.id || null,
              }
            )
        
            if (receptieError) throw receptieError
            allLeads = receptieLeads || []
          } else {
            // Normal pipeline loading
            const { data: leadsData, error: leadsError } = await getKanbanLeads(currentPipeline.id)
            if (leadsError) throw leadsError
            allLeads = leadsData || []
          }
        
        setLeads(allLeads)
      } else {
        setCurrentPipelineId(null)
        setStages([])
        setLeads([])
      }

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [pipelineSlug, getPipelines])

  // keep ref to latest load function for use inside effects/callbacks
  const loadDataRef = useRef(loadData)
  useEffect(() => { loadDataRef.current = loadData }, [loadData])

  useEffect(() => {
    loadDataRef.current()
  }, [loadData])

  useEffect(() => {
    if (!currentPipelineId) return

    const ch = supabase.channel('kanban-rt')

    // Pentru schimbări structurale (pipelines, stages) - invalidate cache și refresh
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pipelines' },
      () => {
        invalidateCache()
        loadDataRef.current()
      }
    )

    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'stages', filter: `pipeline_id=eq.${currentPipelineId}` },
      () => {
        invalidateCache()
        loadDataRef.current()
      }
    )

    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tags' },
      () => debouncedRefresh()
    )

    // INCREMENTAL UPDATES pentru lead_pipelines
    ch.on(
      'postgres_changes',
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'lead_pipelines',
        filter: `pipeline_id=eq.${currentPipelineId}`
      },
      async (payload) => {
        // Adaugă doar lead-ul nou
        try {
          const { data: newLead, error } = await getSingleKanbanLead(payload.new.lead_id, currentPipelineId)
          if (!error && newLead) {
            setLeads(prev => {
              // Verifică dacă lead-ul nu există deja
              if (prev.find(l => l.id === newLead.id)) return prev
              return [...prev, newLead]
            })
          }
        } catch (err) {
          console.error('Error fetching new lead:', err)
          debouncedRefresh()
        }
      }
    )

    ch.on(
      'postgres_changes',
      { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'lead_pipelines',
        filter: `pipeline_id=eq.${currentPipelineId}`
      },
      async (payload) => {
        // Actualizează doar lead-ul modificat
        try {
          const { data: updatedLead, error } = await getSingleKanbanLead(payload.new.lead_id, currentPipelineId)
          if (!error && updatedLead) {
            setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l))
          } else {
            // Dacă lead-ul nu mai e în pipeline-ul curent, îl eliminăm
            setLeads(prev => prev.filter(l => l.id !== payload.new.lead_id))
          }
        } catch (err) {
          console.error('Error fetching updated lead:', err)
          // Nu mai face refresh - doar loghează eroarea
        }
      }
    )

    ch.on(
      'postgres_changes',
      { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'lead_pipelines'
      },
      (payload) => {
        // Elimină doar lead-ul șters
        setLeads(prev => prev.filter(l => l.id !== payload.old.lead_id))
      }
    )

    // Pentru stage_history - actualizează stage-ul și stageMovedAt când se mută un lead
    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'stage_history' },
      async (payload) => {
        const payloadNew = payload.new as any
        if (!payloadNew?.to_stage_id || !currentPipelineId) return

        // Re-fetch lead-ul pentru a obține stage-ul actualizat
        try {
          const { data: updatedLead, error } = await getSingleKanbanLead(payloadNew.lead_id, currentPipelineId)
          if (!error && updatedLead) {
            // Actualizează lead-ul cu stage-ul nou și stageMovedAt
            setLeads(prev => {
              const exists = prev.find(l => l.id === updatedLead.id)
              if (!exists) return prev
              return prev.map(l => 
                l.id === updatedLead.id 
                  ? { ...l, stage: updatedLead.stage, stageId: updatedLead.stageId, stageMovedAt: payloadNew.moved_at }
                  : l
              )
            })
          }
        } catch (err) {
          console.error('Error fetching lead after stage move:', err)
        }
      }
    )

    // Pentru lead_tags - actualizează doar tag-urile
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'lead_tags' },
      async (payload) => {
        const payloadNew = payload.new as any
        const payloadOld = payload.old as any
        const leadId = payloadNew?.lead_id || payloadOld?.lead_id
        if (!leadId) return

        // Re-fetch tags pentru acest lead (nu verificăm dacă există, real-time va actualiza)
        try {
          const { data: tagRows } = await supabase
            .from('v_lead_tags')
            .select('lead_id,tags')
            .eq('lead_id', leadId)
            .maybeSingle()

          if (tagRows) {
            setLeads(prev => {
              const exists = prev.find(l => l.id === leadId)
              if (!exists) return prev
              return prev.map(l => 
                l.id === leadId ? { ...l, tags: (tagRows as any).tags as any } : l
              )
            })
          }
        } catch (err) {
          console.error('Error fetching tags:', err)
        }
      }
    )

    // Pentru modificări în leads table - actualizează doar lead-ul afectat
    ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'leads' },
      async (payload) => {
        const leadId = payload.new.id
        if (!currentPipelineId) return

        // Re-fetch lead-ul actualizat
        try {
          const { data: updatedLead, error } = await getSingleKanbanLead(leadId, currentPipelineId)
          if (!error && updatedLead) {
            setLeads(prev => {
              const exists = prev.find(l => l.id === updatedLead.id)
              if (!exists) return prev
              return prev.map(l => l.id === updatedLead.id ? updatedLead : l)
            })
          }
        } catch (err) {
          console.error('Error fetching updated lead:', err)
        }
      }
    )

    ch.subscribe()
    return () => { 
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      supabase.removeChannel(ch) 
    }
  }, [currentPipelineId, debouncedRefresh, invalidateCache])


  const handleLeadMove = useCallback(async (leadId: string, newStageName: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return
    
    const previousLead = { ...lead }

    // Folosește cache pentru pipelines
    const pipelinesDataToUse = await getPipelines()
    
    const leadAny = lead as any
    const isInReceptie = pipelineSlug === 'receptie'
    const hasOriginalPipeline = !!leadAny.originalPipelineId
    const currentStageName = lead.stage?.toLowerCase() || ''
    const newStageNameLower = newStageName.toLowerCase()
    
    // Dacă suntem în Receptie, lead-ul vine din alt departament, și se mută din "Confirmari" în "In Lucru"
    if (isInReceptie && hasOriginalPipeline && 
        currentStageName.includes('confirmari') && 
        (newStageNameLower.includes('lucru') || newStageNameLower.includes('work') || newStageNameLower.includes('progress'))) {
      
      // Mută lead-ul în pipeline-ul original în stage-ul "In Lucru"
      const originalPipelineId = leadAny.originalPipelineId
      const originalPipeline = pipelinesDataToUse.find((p: any) => p.id === originalPipelineId)
      
      if (originalPipeline) {
        // Găsește stage-ul "In Lucru" în pipeline-ul original
        const inLucruStage = originalPipeline.stages.find((s: any) => {
          const stageName = s.name.toLowerCase()
          return stageName.includes('lucru') || stageName.includes('work') || stageName.includes('progress')
        })
        
        if (inLucruStage) {
          // Mută lead-ul în pipeline-ul original în stage-ul "In Lucru"
          const { error: originalError } = await moveLeadToStage(lead.leadId, originalPipelineId, inLucruStage.id)
          if (originalError) {
            console.error('Eroare la mutarea lead-ului în pipeline-ul original:', originalError)
            // REVERT optimistic update
            setLeads(prev => prev.map(l => (l.id === leadId ? previousLead : l)))
            setError('Failed to move lead')
          }
          // Real-time subscription va actualiza automat când se salvează în baza de date
          // Nu mai e nevoie de refresh complet!
        }
      }
    }
    
    // Dacă lead-ul vine din alt pipeline (are originalPipelineId), folosește pipeline-ul original
    const targetPipelineId = leadAny.originalPipelineId || lead.pipelineId
    const targetPipeline = pipelinesDataToUse.find((p: any) => p.id === targetPipelineId)
    
    if (!targetPipeline) return
    
    const newStage = targetPipeline.stages.find((s: any) => s.name === newStageName)
    if (!newStage) return

    // OPTIMISTIC UPDATE: Actualizează UI-ul imediat pentru feedback vizual
    setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, stage: newStageName, stageId: newStage.id } : l)))
    
    try {
      const { error } = await moveLeadToStage(lead.leadId, targetPipelineId, newStage.id)
      if (error) {
        // REVERT dacă eșuează
        setLeads(prev => prev.map(l => (l.id === leadId ? previousLead : l)))
        setError('Failed to move lead')
        // Nu mai face refresh - real-time subscription va actualiza automat dacă reușește
      }
      // Dacă reușește, real-time subscription va actualiza automat când se salvează în baza de date
      // Nu mai e nevoie de refresh complet!
    } catch (err) {
      // REVERT dacă eșuează
      setLeads(prev => prev.map(l => (l.id === leadId ? previousLead : l)))
      setError('Failed to move lead')
      // Nu mai face refresh - real-time subscription va actualiza automat dacă reușește
    }
  }, [leads, pipelineSlug, getPipelines])

  return { leads, stages, pipelines, loading, error, handleLeadMove, patchLeadTags, handlePinToggle, refresh: loadData, reload: () => loadDataRef.current() }
}
