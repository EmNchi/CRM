'use client'

import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getKanbanItems, getSingleKanbanItem, moveItemToStage, addTrayToPipeline, getPipelineItemForItem } from '@/lib/supabase/pipelineOperations'
import type { PipelineItemType } from '@/lib/supabase/pipelineOperations'
import { usePipelinesCache } from './usePipelinesCache'
import type { KanbanLead } from '../lib/types/database'
import type { Tag } from '@/lib/supabase/tagOperations'
import { useRole, useAuth } from '@/lib/contexts/AuthContext'

const supabase = supabaseBrowser()
const toSlug = (s: string) => String(s).toLowerCase().replace(/\s+/g, '-')

// Helper pentru a determina tipul item-ului pe baza proprietăților lead-ului
function getItemType(lead: KanbanLead): PipelineItemType {
  const leadAny = lead as any
  if (leadAny.type) return leadAny.type as PipelineItemType
  if (leadAny.isFisa || leadAny.fisaId) return 'service_file'
  if (leadAny.isQuote || leadAny.quoteId) return 'tray'
  return 'lead'
}

// Helper pentru a obține item_id-ul corect
function getItemId(lead: KanbanLead): string {
  const leadAny = lead as any
  // Pentru service_file sau tray, item_id este id-ul propriu-zis (lead.id)
  // Pentru lead, item_id este leadId (sau id dacă leadId nu există)
  if (leadAny.type === 'service_file' || leadAny.type === 'tray') {
    return lead.id // Pentru service_file/tray, folosim id-ul cardului
  }
  if (leadAny.isFisa) return lead.id // service_file id
  if (leadAny.isQuote) return lead.id // tray id
  return lead.leadId || lead.id
}

export function useKanbanData(pipelineSlug?: string) {
  const [leads, setLeads] = useState<KanbanLead[]>([])
  const [stages, setStages] = useState<string[]>([])
  const [pipelines, setPipelines] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isDepartmentPipelineState, setIsDepartmentPipelineState] = useState(false)

  const [currentPipelineId, setCurrentPipelineId] = useState<string | null>(null)
  const { getPipelines, invalidateCache } = usePipelinesCache()
  const { role } = useRole()
  const { user } = useAuth()
  
  // Obține ID-ul utilizatorului curent pentru filtrarea tăvițelor în pipeline-urile departament
  useEffect(() => {
    if (user?.id) {
      setCurrentUserId(user.id)
      console.log('👤 Current user ID set:', user.id)
    } else {
      setCurrentUserId(null)
      console.log('⚠️ No current user ID available')
    }
  }, [user])
  
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
      
      console.log('🔍 useKanbanData - Pipeline loading:', {
        pipelineSlug,
        allPipelines: pipelinesData.map((p: any) => ({ name: p.name, slug: toSlug(p.name), id: p.id })),
        currentPipeline: currentPipeline ? { name: currentPipeline.name, id: currentPipeline.id } : null
      })
      
        if (currentPipeline) {
          setCurrentPipelineId(currentPipeline.id)
          setStages(currentPipeline.stages.map((s: any) => s.name))
          
          const isReceptie = toSlug(currentPipeline.name) === 'receptie'
          const departmentPipelines = ['Saloane', 'Horeca', 'Frizerii', 'Reparatii']
          const isDepartmentPipeline = departmentPipelines.some(dept => 
            toSlug(currentPipeline.name) === toSlug(dept)
          )
          const isAdminOrOwner = role === 'admin' || role === 'owner'
          setIsDepartmentPipelineState(isDepartmentPipeline)
          let allLeads: KanbanLead[] = []
        
          // Toate pipeline-urile folosesc acum getKanbanItems care suportă leads, service_files și trays
          // Pipeline-uri departament (Saloane, Horeca, Frizerii, Reparatii) - afișează trays
          // Pipeline Receptie - afișează service_files
          // Pipeline Curier - afișează service_files
          // Alte pipeline-uri (Vanzari etc) - afișează leads
          // Pentru pipeline-urile departament, pasăm currentUserId pentru filtrarea tăvițelor
          // DAR NU pentru admin / owner care trebuie să vadă toate tăvițele
          const { data: itemsData, error: itemsError } = await getKanbanItems(
            currentPipeline.id, 
            isDepartmentPipeline ? currentUserId || undefined : undefined,
            isAdminOrOwner
          )
          if (itemsError) throw itemsError
          allLeads = (itemsData || []) as any[]
        
          if (isDepartmentPipeline) {
            console.log('📦 Department pipeline - loaded trays:', allLeads.length, '(filtered for user:', currentUserId, ')')
          } else if (isReceptie) {
            console.log('📋 Receptie pipeline - loaded items:', allLeads.length)
          }
        
        console.log('🔍 useKanbanData - Items încărcate:', {
          count: allLeads.length,
          items: allLeads.map((l: any) => ({ id: l.id, type: l.type, name: l.name, stage: l.stage }))
        })
        
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
  }, [pipelineSlug, getPipelines, currentUserId, role])

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

    // INCREMENTAL UPDATES pentru pipeline_items (noua arhitectură)
    ch.on(
      'postgres_changes',
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'pipeline_items',
        filter: `pipeline_id=eq.${currentPipelineId}`
      },
      async (payload) => {
        // Adaugă item-ul nou (lead, service_file sau tray)
        try {
          const newItem = payload.new as any
          const itemType = newItem.type as PipelineItemType
          const { data: newKanbanItem, error } = await getSingleKanbanItem(itemType, newItem.item_id, currentPipelineId)
          if (!error && newKanbanItem) {
            setLeads(prev => {
              // Verifică dacă item-ul nu există deja
              if (prev.find(l => l.id === newKanbanItem.id)) return prev
              return [...prev, newKanbanItem as any]
            })
          }
        } catch (err) {
          console.error('Error fetching new pipeline item:', err)
          debouncedRefresh()
        }
      }
    )

    ch.on(
      'postgres_changes',
      { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'pipeline_items',
        filter: `pipeline_id=eq.${currentPipelineId}`
      },
      async (payload) => {
        // Actualizează item-ul modificat
        try {
          const updatedItem = payload.new as any
          const itemType = updatedItem.type as PipelineItemType
          const { data: updatedKanbanItem, error } = await getSingleKanbanItem(itemType, updatedItem.item_id, currentPipelineId)
          if (!error && updatedKanbanItem) {
            setLeads(prev => prev.map(l => l.id === updatedKanbanItem.id ? (updatedKanbanItem as any) : l))
          } else {
            // Dacă item-ul nu mai e în pipeline-ul curent, îl eliminăm
            setLeads(prev => prev.filter(l => l.id !== updatedItem.item_id))
          }
        } catch (err) {
          console.error('Error fetching updated pipeline item:', err)
        }
      }
    )

    ch.on(
      'postgres_changes',
      { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'pipeline_items'
      },
      (payload) => {
        // Elimină item-ul șters
        const deletedItem = payload.old as any
        setLeads(prev => prev.filter(l => l.id !== deletedItem.item_id))
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
          // TODO: Trebuie determinat tipul item-ului și item_id corect
          const { data: updatedLead, error } = await getSingleKanbanItem('lead', payloadNew.lead_id, currentPipelineId)
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

    // Pentru tray_items - când se schimbă technician_id sau alte detalii,
    // reîncarcă datele pentru a reflecta schimbările de vizibilitate ale tăvițelor
    if (isDepartmentPipelineState) {
      ch.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tray_items',
        },
        () => {
          // Nu avem nevoie de invalidateCache aici, doar refresh de date
          debouncedRefresh()
        }
      )
    }

    // Pentru modificări în leads table - actualizează doar lead-ul afectat
    ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'leads' },
      async (payload) => {
        const leadId = payload.new.id
        if (!currentPipelineId) return

        // Re-fetch lead-ul actualizat
        try {
          // TODO: Trebuie determinat tipul item-ului pe baza lead-ului existent
          // Pentru moment, căutăm lead-ul în lista curentă pentru a determina tipul
          const existingLead = leads.find(l => l.id === leadId)
          const itemType = existingLead ? getItemType(existingLead) : 'lead'
          const itemId = existingLead ? getItemId(existingLead) : leadId
          const { data: updatedLead, error } = await getSingleKanbanItem(itemType, itemId, currentPipelineId)
          if (!error && updatedLead) {
            setLeads(prev => {
              const exists = prev.find(l => l.id === updatedLead.id)
              if (!exists) return prev
              return prev.map(l => l.id === updatedLead.id ? (updatedLead as any) : l)
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
  }, [currentPipelineId, debouncedRefresh, invalidateCache, isDepartmentPipelineState])


  const handleLeadMove = useCallback(async (leadId: string, newStageName: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return
    
    const previousLead = { ...lead }
    const previousStageName = previousLead.stage?.toLowerCase() || '' // Folosește previousLead, nu lead!

    // Folosește cache pentru pipelines
    const pipelinesDataToUse = await getPipelines()
    
    const leadAny = lead as any
    const isInReceptie = pipelineSlug === 'receptie'
    const hasOriginalPipeline = !!leadAny.originalPipelineId
    const newStageNameLower = newStageName.toLowerCase()
    
    // Blochează mutarea în stage-urile restricționate în Receptie
    if (isInReceptie) {
      const restrictedStages = ['facturat', 'facturată', 'in asteptare', 'în așteptare', 'in lucru', 'în lucru']
      const isRestricted = restrictedStages.some(restricted => newStageNameLower.includes(restricted))
      if (isRestricted) {
        console.log('🚫 Mutare blocată în stage restricționat:', newStageName)
        return // Nu permite mutarea în stage-uri restricționate
      }
    }
    
    // Pentru carduri de tip tray sau service_file
    if (leadAny.isQuote || leadAny.isFisa) {
      // Găsește pipeline-ul curent
      const currentPipeline = pipelinesDataToUse.find((p: any) => p.id === lead.pipelineId)
      if (!currentPipeline) return
      
      const newStage = currentPipeline.stages.find((s: any) => s.name === newStageName)
      if (!newStage) return

      // Verifică dacă este o tăviță în pipeline-urile departamentelor
      const isTrayInDeptPipeline = leadAny.type === 'tray' && 
        ['Saloane', 'Frizerii', 'Horeca', 'Reparatii'].includes(currentPipeline.name)
      
      // Verifică dacă se mută din "Noua" în "In Lucru"
      // IMPORTANT: Folosește previousStageName care a fost setat la începutul funcției, înainte de optimistic update
      const isMovingFromNoua = previousStageName.includes('noua') || previousStageName.includes('nouă') || previousStageName.includes('new')
      const isMovingToInLucru = newStageNameLower.includes('lucru') || newStageNameLower.includes('work') || newStageNameLower.includes('progress')
      const shouldAssignTechnician = isTrayInDeptPipeline && isMovingFromNoua && isMovingToInLucru
      
      console.log('🔍 Verificare atribuire tehnician (ÎNAINTE de optimistic update):', {
        isTrayInDeptPipeline,
        previousStageName,
        previousLeadStage: previousLead.stage,
        currentLeadStage: lead.stage,
        isMovingFromNoua,
        newStageNameLower,
        isMovingToInLucru,
        shouldAssignTechnician,
        currentUserId,
        currentPipelineName: currentPipeline.name
      })
      
      // Dacă este tăviță în pipeline-urile departamentelor, permite mutarea efectivă
      if (isTrayInDeptPipeline) {
        // OPTIMISTIC UPDATE: Actualizează UI-ul imediat pentru feedback vizual
        // IMPORTANT: Acest update se face DUPĂ ce am calculat previousStageName
        setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, stage: newStageName, stageId: newStage.id } : l)))
        
        try {
          const itemType = getItemType(lead)
          const itemId = getItemId(lead)
          
          console.log('🔄 Mutare tăviță în pipeline departament:', {
            leadId,
            newStageName,
            itemType,
            itemId,
            pipelineId: lead.pipelineId,
            newStageId: newStage.id,
            shouldAssignTechnician,
            currentUserId
          })
          
          // Verifică dacă există deja un pipeline_item în pipeline-ul curent
          const { data: existingPipelineItem } = await getPipelineItemForItem(itemType, itemId, lead.pipelineId)
          
          if (!existingPipelineItem) {
            // Dacă nu există, creează un pipeline_item nou în pipeline-ul curent
            console.log('📝 Creare pipeline_item pentru tăviță în pipeline-ul curent')
            const { data: newPipelineItem, error: addError } = await addTrayToPipeline(itemId, lead.pipelineId, newStage.id)
            if (addError) {
              throw addError
            }
            console.log('✅ Pipeline_item creat:', newPipelineItem)
          } else {
            // Dacă există, actualizează stage-ul
            const { error } = await moveItemToStage(itemType, itemId, lead.pipelineId, newStage.id)
            if (error) {
              throw error
            }
          }
          
          // Dacă se mută din "Noua" în "In Lucru", atribuie automat tehnicianul curent
          if (shouldAssignTechnician) {
            // Obține user ID (folosește currentUserId sau încearcă din auth)
            let userIdToAssign = currentUserId
            if (!userIdToAssign) {
              console.warn('⚠️ currentUserId este null, încercare obținere din auth...')
              const { data: { user: authUser } } = await supabase.auth.getUser()
              if (authUser?.id) {
                userIdToAssign = authUser.id
                console.log('✅ User ID obținut din auth:', userIdToAssign)
                setCurrentUserId(userIdToAssign)
              } else {
                console.error('❌ Nu s-a putut obține user ID pentru atribuirea tehnicianului')
                // Nu returnăm aici - mutarea cardului trebuie să continue chiar dacă nu putem atribui tehnicianul
              }
            }
            
            // Continuă doar dacă avem user ID
            if (userIdToAssign) {
            
            console.log('👤 Atribuire automată tehnician pentru tăviță:', {
              trayId: itemId,
              technicianId: userIdToAssign,
              previousStage: previousStageName,
              newStage: newStageNameLower
            })
            
            // Verifică mai întâi dacă există tray_items pentru această tăviță
            const { data: existingItems, error: checkError } = await supabase
              .from('tray_items')
              .select('id')
              .eq('tray_id', itemId)
              .limit(1)
            
            if (checkError) {
              console.error('⚠️ Eroare la verificarea tray_items:', checkError)
            } else if (!existingItems || existingItems.length === 0) {
              console.warn('⚠️ Nu există tray_items pentru această tăviță:', itemId)
            } else {
              // Actualizează technician_id pentru toate tray_items din tăviță
              const { error: updateError, data: updateData } = await supabase
                .from('tray_items')
                .update({ technician_id: userIdToAssign })
                .eq('tray_id', itemId)
                .select('id')
              
              if (updateError) {
                console.error('⚠️ Eroare la atribuirea automată a tehnicianului:', updateError)
              } else {
                console.log('✅ Tehnician atribuit automat pentru tăviță. Items actualizate:', updateData?.length || 0)
              }
            }
            } else {
              console.warn('⚠️ Nu se poate atribui tehnician: user ID indisponibil')
            }
          } else {
            console.log('ℹ️ Nu se atribuie tehnician:', {
              shouldAssignTechnician,
              isTrayInDeptPipeline,
              isMovingFromNoua,
              isMovingToInLucru,
              previousStageName,
              newStageNameLower
            })
          }
          
          // Real-time subscription va actualiza automat când se salvează în baza de date
        } catch (err) {
          // REVERT dacă eșuează
          setLeads(prev => prev.map(l => (l.id === leadId ? previousLead : l)))
          setError('Failed to move tray')
          console.error('Eroare la mutarea tăviței:', err)
        }
        return
      }
      
      // Pentru alte cazuri (service_files sau tăvițe în alte pipeline-uri), doar update vizual
      // OPTIMISTIC UPDATE: Actualizează UI-ul imediat pentru feedback vizual
      setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, stage: newStageName, stageId: newStage.id } : l)))
      
      // Pentru tăvițe/service_files în alte pipeline-uri, mutarea este doar vizuală
      console.log('Quote/Fisa card moved locally (no DB update):', leadId, newStageName)
      return
    }
    
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
          const itemType = getItemType(lead)
          const itemId = getItemId(lead)
          const { error: originalError } = await moveItemToStage(itemType, itemId, originalPipelineId, inLucruStage.id)
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
      const itemType = getItemType(lead)
      const itemId = getItemId(lead)
      
      console.log('🔄 handleLeadMove:', {
        leadId,
        newStageName,
        itemType,
        itemId,
        targetPipelineId,
        newStageId: newStage.id,
        leadData: { id: lead.id, type: leadAny.type, pipelineId: lead.pipelineId }
      })
      
      const { error } = await moveItemToStage(itemType, itemId, targetPipelineId, newStage.id)
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
  }, [leads, pipelineSlug, getPipelines, currentUserId])

  return { leads, stages, pipelines, loading, error, handleLeadMove, patchLeadTags, handlePinToggle, refresh: loadData, reload: () => loadDataRef.current() }
}
