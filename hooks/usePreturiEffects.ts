/**
 * Hook pentru gestionarea efectelor (useEffect) în componenta Preturi
 */

import { useEffect, useRef } from 'react'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { getServiceFile } from '@/lib/supabase/serviceFileOperations'
import { getPipelineItemForItem } from '@/lib/supabase/pipelineOperations'
import { listTags, toggleLeadTag } from '@/lib/supabase/tagOperations'
import type { LeadQuoteItem } from '@/lib/types/preturi'

const supabase = supabaseBrowser()

interface UsePreturiEffectsProps {
  leadId: string
  fisaId?: string | null
  selectedQuoteId: string | null
  isVanzariPipeline: boolean
  isReceptiePipeline: boolean
  pipelinesWithIds: Array<{ id: string; name: string }>
  isCommercialPipeline: boolean
  
  setUrgentTagId: (id: string | null) => void
  setInstrumentForm: React.Dispatch<React.SetStateAction<any>>
  setInstrumentSettings: React.Dispatch<React.SetStateAction<any>>
  setUrgentAllServices: (urgent: boolean) => void
  setSubscriptionType: (type: 'services' | 'parts' | 'both' | '') => void
  setCurrentServiceFileStage: (stage: string | null) => void
  setTrayDetails: (details: string) => void
  setLoadingTrayDetails: (loading: boolean) => void
  setItems: React.Dispatch<React.SetStateAction<LeadQuoteItem[]>>
  setTrayImages: React.Dispatch<React.SetStateAction<any[]>>
  setIsDirty: (dirty: boolean) => void
  setOfficeDirect: (value: boolean) => void
  setCurierTrimis: (value: boolean) => void
  
  svc: any
  instrumentForm: any
  instrumentSettings: any
  urgentAllServices: boolean
  items: LeadQuoteItem[]
  urgentTagId: string | null
}

export function usePreturiEffects({
  leadId,
  fisaId,
  selectedQuoteId,
  isVanzariPipeline,
  isReceptiePipeline,
  pipelinesWithIds,
  isCommercialPipeline,
  setUrgentTagId,
  setInstrumentForm,
  setInstrumentSettings,
  setUrgentAllServices,
  setSubscriptionType,
  setCurrentServiceFileStage,
  setTrayDetails,
  setLoadingTrayDetails,
  setItems,
  setTrayImages,
  setIsDirty,
  setOfficeDirect,
  setCurierTrimis,
  svc,
  instrumentForm,
  instrumentSettings,
  urgentAllServices,
  items,
  urgentTagId,
}: UsePreturiEffectsProps) {
  // Găsește tag-ul urgent la încărcare
  useEffect(() => {
    (async () => {
      const tags = await listTags()
      const urgentTag = tags.find(t => t.name.toLowerCase() === 'urgent')
      if (urgentTag) {
        setUrgentTagId(urgentTag.id)
      }
    })()
  }, [setUrgentTagId])

  // Încarcă imaginile pentru tăvița selectată
  useEffect(() => {
    if (!selectedQuoteId) {
      setTrayImages([])
      return
    }

    const loadImages = async () => {
      try {
        const { listTrayImages } = await import('@/lib/supabase/imageOperations')
        const images = await listTrayImages(selectedQuoteId)
        setTrayImages(images)
      } catch (error) {
        console.error('Error loading tray images:', error)
        setTrayImages([])
      }
    }

    loadImages()
  }, [selectedQuoteId, setTrayImages])

  // Sincronizează instrumentForm.instrument cu svc.instrumentId
  useEffect(() => {
    if (svc.instrumentId !== instrumentForm.instrument || svc.qty !== instrumentForm.qty) {
      const savedSettings = instrumentSettings[svc.instrumentId]
      setInstrumentForm((prev: any) => ({ 
        ...prev, 
        instrument: svc.instrumentId,
        qty: savedSettings?.qty || svc.qty || '1'
      }))
    }
  }, [svc.instrumentId, svc.qty, instrumentSettings, instrumentForm.instrument, setInstrumentForm])

  // Actualizează automat cantitatea instrumentului în funcție de numărul de serial number-uri
  useEffect(() => {
    if (!instrumentForm.instrument) return
    
    const totalSerialNumbers = instrumentForm.brandSerialGroups.reduce((total: number, group: any) => {
      const validSerials = group.serialNumbers.filter((sn: any) => {
        const serial = typeof sn === 'string' ? sn : sn.serial || ''
        return serial && serial.trim()
      })
      return total + validSerials.length
    }, 0)
    
    if (totalSerialNumbers > 0) {
      const newQty = String(totalSerialNumbers)
      if (instrumentForm.qty !== newQty) {
        setInstrumentForm((prev: any) => ({ ...prev, qty: newQty }))
        if (instrumentForm.instrument) {
          setInstrumentSettings((prev: any) => ({
            ...prev,
            [instrumentForm.instrument]: {
              ...prev[instrumentForm.instrument],
              qty: newQty,
              brandSerialGroups: instrumentForm.brandSerialGroups,
              garantie: instrumentForm.garantie
            }
          }))
        }
      }
    }
  }, [instrumentForm.brandSerialGroups, instrumentForm.instrument, instrumentForm.qty, setInstrumentForm, setInstrumentSettings])

  // Aplică urgent tuturor serviciilor și pieselor când urgentAllServices e bifat
  useEffect(() => {
    setItems(prev => {
      // Verifică dacă există iteme care trebuie actualizate
      const itemsArray = Array.isArray(prev) ? prev : []
      
      // Dacă prev nu este un array, returnează un array gol
      if (!Array.isArray(prev)) {
        return []
      }
      
      if (!Array.isArray(itemsArray)) {
        console.error('❌ [usePreturiEffects] ERROR: itemsArray is NOT an array!', itemsArray)
        return []
      }
      
      // FOLOSIM FOR LOOP ÎN LOC DE .some() - MAI SIGUR
      let needsUpdate = false
      for (let i = 0; i < itemsArray.length; i++) {
        const it = itemsArray[i]
        if (it && (it.item_type === 'service' || it.item_type === 'part') && it.urgent !== urgentAllServices) {
          needsUpdate = true
          break // Oprim loop-ul când găsim primul item care necesită update
        }
      }
      
      if (!needsUpdate) {
        return prev // Nu face update dacă nu e necesar
      }
      
      // Actualizează itemele și marchează ca dirty
      const updated = prev.map(it => {
        if (!it) return it
        return (it.item_type === 'service' || it.item_type === 'part') ? { ...it, urgent: urgentAllServices } : it
      })
      setIsDirty(true)
      return updated
    })
  }, [urgentAllServices, setItems, setIsDirty])

  // Verifică și atribuie/elimină tag-ul urgent când se schimbă items-urile
  useEffect(() => {
    const itemsArray = Array.isArray(items) ? items : []
    if (!urgentTagId || !itemsArray.length) return

    if (isVanzariPipeline) {
      const removeUrgentTagFromVanzari = async () => {
        try {
          const { data: existing } = await supabase
            .from('lead_tags')
            .select('lead_id')
            .eq('lead_id', leadId)
            .eq('tag_id', urgentTagId)
            .maybeSingle()

          if (existing) {
            await toggleLeadTag(leadId, urgentTagId)
          }
        } catch (error) {
          console.error('Eroare la eliminarea tag-ului urgent din Vanzari:', error)
        }
      }
      removeUrgentTagFromVanzari()
      return
    }
    
    if (!Array.isArray(itemsArray)) {
      console.error('❌ [usePreturiEffects] ERROR: itemsArray is NOT an array for urgent check!', itemsArray)
      return
    }
    
    // FOLOSIM FOR LOOP ÎN LOC DE .some() - MAI SIGUR
    let hasUrgentItems = false
    for (let i = 0; i < itemsArray.length; i++) {
      const item = itemsArray[i]
      if (item && item.urgent === true) {
        hasUrgentItems = true
        break // Oprim loop-ul când găsim primul item urgent
      }
    }
    
    const checkAndToggleUrgentTag = async () => {
      try {
        const { data: existing } = await supabase
          .from('lead_tags')
          .select('lead_id')
          .eq('lead_id', leadId)
          .eq('tag_id', urgentTagId)
          .maybeSingle()

        if (hasUrgentItems && !existing) {
          await toggleLeadTag(leadId, urgentTagId)
        } else if (!hasUrgentItems && existing) {
          await toggleLeadTag(leadId, urgentTagId)
        }
      } catch (error) {
        console.error('Eroare la gestionarea tag-ului urgent:', error)
      }
    }

    checkAndToggleUrgentTag()
  }, [items, urgentTagId, leadId, isVanzariPipeline])

  // Reîncarcă urgent și subscription_type din service_file când se schimbă tăvița selectată
  useEffect(() => {
    if (!fisaId || !selectedQuoteId) return
    
    const reloadUrgentAndSubscription = async () => {
      try {
        const { data: serviceFileData } = await getServiceFile(fisaId)
        if (serviceFileData) {
          setUrgentAllServices(serviceFileData.urgent || false)
          setSubscriptionType(serviceFileData.subscription_type || '')
        }
      } catch (error) {
        console.error('Eroare la reîncărcarea urgent și subscription:', error)
      }
    }
    
    reloadUrgentAndSubscription()
  }, [fisaId, selectedQuoteId, setUrgentAllServices, setSubscriptionType])

  // Încarcă stage-ul curent al fișei în pipeline-ul Receptie
  useEffect(() => {
    if (!fisaId || !isReceptiePipeline || pipelinesWithIds.length === 0) {
      setCurrentServiceFileStage(null)
      return
    }

    const loadCurrentStage = async () => {
      try {
        const receptiePipeline = pipelinesWithIds.find(p => 
          p.name.toLowerCase().includes('receptie') || p.name.toLowerCase().includes('reception')
        )
        
        if (!receptiePipeline) {
          setCurrentServiceFileStage(null)
          return
        }

        const { data: pipelineItem, error } = await getPipelineItemForItem(
          'service_file',
          fisaId,
          receptiePipeline.id
        )

        if (error || !pipelineItem) {
          setCurrentServiceFileStage(null)
          return
        }

        if (pipelineItem.stage_id) {
          const { data: stageData, error: stageError } = await supabase
            .from('stages')
            .select('name')
            .eq('id', pipelineItem.stage_id)
            .single()

          if (!stageError && stageData) {
            setCurrentServiceFileStage((stageData as any).name)
          } else {
            setCurrentServiceFileStage(null)
          }
        } else {
          setCurrentServiceFileStage(null)
        }
      } catch (error) {
        console.error('Eroare la încărcarea stage-ului curent:', error)
        setCurrentServiceFileStage(null)
      }
    }

    loadCurrentStage()
  }, [fisaId, isReceptiePipeline, pipelinesWithIds, setCurrentServiceFileStage])

  // Încarcă office_direct și curier_trimis din service file (pentru Receptie și Vânzări)
  useEffect(() => {
    if (!fisaId) {
      setOfficeDirect(false)
      setCurierTrimis(false)
      return
    }

    const loadDeliveryFlags = async () => {
      try {
        const { data: serviceFileData } = await getServiceFile(fisaId)
        if (serviceFileData) {
          setOfficeDirect(serviceFileData.office_direct || false)
          setCurierTrimis(serviceFileData.curier_trimis || false)
        }
      } catch (error) {
        console.error('Eroare la încărcarea flag-urilor de delivery:', error)
        setOfficeDirect(false)
        setCurierTrimis(false)
      }
    }

    loadDeliveryFlags()
  }, [fisaId, setOfficeDirect, setCurierTrimis])

  // Încarcă detaliile pentru fișa de serviciu
  // IMPORTANT: Folosim useRef pentru a urmări fisaId-ul pentru care am încărcat deja detaliile
  // pentru a evita reîncărcarea și suprascrierea datelor când utilizatorul editează
  const lastLoadedFisaIdRef = useRef<string | null | undefined>(null)
  
  useEffect(() => {
    const loadServiceFileDetails = async () => {
      if (!isCommercialPipeline || !fisaId) {
        // Doar resetează dacă fisaId s-a schimbat sau a devenit null
        if (lastLoadedFisaIdRef.current !== fisaId) {
          setTrayDetails('')
          lastLoadedFisaIdRef.current = fisaId
        }
        return
      }

      // IMPORTANT: Nu reîncarcă dacă fisaId este același și avem deja date încărcate
      // Acest lucru previne pierderea datelor când utilizatorul editează și se reîncarcă items-urile
      if (lastLoadedFisaIdRef.current === fisaId) {
        return
      }

      setLoadingTrayDetails(true)
      try {
        const { data: serviceFileData } = await getServiceFile(fisaId)
        // console.log('[DEBUG] Loaded from DB:', { fisaId, details: serviceFileData?.details })
        if (serviceFileData?.details) {
          try {
            const detailsObj = typeof serviceFileData.details === 'string' 
              ? JSON.parse(serviceFileData.details) 
              : serviceFileData.details
            // console.log('[DEBUG] Parsed details object:', detailsObj)
            // Caută text, comments sau trayDetails în obiectul JSON
            const detailsText = detailsObj.text || detailsObj.comments || detailsObj.trayDetails || ''
            // console.log('[DEBUG] Extracted detailsText:', detailsText)
            setTrayDetails(detailsText)
            lastLoadedFisaIdRef.current = fisaId
          } catch {
            // Dacă nu este JSON valid, folosește direct valoarea
            const detailsValue = typeof serviceFileData.details === 'string' 
              ? serviceFileData.details 
              : ''
            setTrayDetails(detailsValue)
            lastLoadedFisaIdRef.current = fisaId
          }
        } else {
          setTrayDetails('')
          lastLoadedFisaIdRef.current = fisaId
        }
      } catch (error) {
        console.error('Eroare la încărcarea detaliilor fișei:', error)
        // Nu reseta la '' dacă există deja date în state și fisaId nu s-a schimbat
        if (lastLoadedFisaIdRef.current !== fisaId) {
          setTrayDetails('')
          lastLoadedFisaIdRef.current = fisaId
        }
      } finally {
        setLoadingTrayDetails(false)
      }
    }

    loadServiceFileDetails()
  }, [fisaId, isCommercialPipeline, setTrayDetails, setLoadingTrayDetails])
}
