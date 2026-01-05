import { useEffect } from 'react'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { getServiceFile } from '@/lib/supabase/serviceFileOperations'
import { getPipelineItemForItem } from '@/lib/supabase/pipelineOperations'
import { listTags, toggleLeadTag } from '@/lib/supabase/tagOperations'
import type { LeadQuoteItem } from '@/lib/types/preturi'

const supabase = supabaseBrowser()

/**
 * Hook pentru gestionarea efectelor (useEffect) în componenta Preturi
 */
export function usePreturiEffects({
  // Dependencies
  leadId,
  fisaId,
  selectedQuoteId,
  isVanzariPipeline,
  isReceptiePipeline,
  pipelinesWithIds,
  isCommercialPipeline,
  
  // State setters
  setUrgentTagId,
  setInstrumentForm,
  setInstrumentSettings,
  setUrgentAllServices,
  setSubscriptionType,
  setCurrentServiceFileStage,
  setTrayDetails,
  setLoadingTrayDetails,
  setItems,
  setIsDirty,
  
  // State values
  svc,
  instrumentForm,
  instrumentSettings,
  urgentAllServices,
  items,
  urgentTagId,
}: {
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
  setIsDirty: (dirty: boolean) => void
  
  svc: any
  instrumentForm: any
  instrumentSettings: any
  urgentAllServices: boolean
  items: LeadQuoteItem[]
  urgentTagId: string | null
}) {
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

  // Sincronizează instrumentForm.instrument cu svc.instrumentId
  useEffect(() => {
    if (svc.instrumentId !== instrumentForm.instrument || svc.qty !== instrumentForm.qty) {
      const savedSettings = instrumentSettings[svc.instrumentId]
      setInstrumentForm(prev => ({ 
        ...prev, 
        instrument: svc.instrumentId,
        qty: savedSettings?.qty || svc.qty || '1'
      }))
    }
  }, [svc.instrumentId, svc.qty, instrumentSettings, instrumentForm.instrument, setInstrumentForm])

  // Actualizează automat cantitatea instrumentului în funcție de numărul de serial number-uri
  useEffect(() => {
    if (!instrumentForm.instrument) return
    
    // Calculează numărul total de serial number-uri din toate grupurile
    const totalSerialNumbers = instrumentForm.brandSerialGroups.reduce((total: number, group: any) => {
      // Numără doar serial number-urile care nu sunt goale
      const validSerials = group.serialNumbers.filter((sn: any) => {
        const serial = typeof sn === 'string' ? sn : sn.serial || ''
        return serial && serial.trim()
      })
      return total + validSerials.length
    }, 0)
    
    // Dacă există serial number-uri, actualizează cantitatea
    if (totalSerialNumbers > 0) {
      const newQty = String(totalSerialNumbers)
      // Actualizează doar dacă cantitatea s-a schimbat
      if (instrumentForm.qty !== newQty) {
        setInstrumentForm(prev => ({ ...prev, qty: newQty }))
        // Actualizează și în instrumentSettings pentru a păstra setările
        if (instrumentForm.instrument) {
          setInstrumentSettings(prev => ({
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
    setItems(prev => prev.map(it => 
      (it.item_type === 'service' || it.item_type === 'part') ? { ...it, urgent: urgentAllServices } : it
    ))
    if (urgentAllServices || items.some(it => (it.item_type === 'service' || it.item_type === 'part') && it.urgent !== urgentAllServices)) {
      setIsDirty(true)
    }
  }, [urgentAllServices, setItems, setIsDirty, items])

  // Verifică și atribuie/elimină tag-ul urgent când se schimbă items-urile
  // Tag-ul urgent NU trebuie să existe în pipeline-ul Vanzari, dar trebuie să fie vizibil în Receptie și Curier
  useEffect(() => {
    if (!urgentTagId || !items.length) return

    // Nu atribui tag-ul urgent în pipeline-ul Vanzari
    if (isVanzariPipeline) {
      // Elimină tag-ul urgent dacă există în Vanzari
      const removeUrgentTagFromVanzari = async () => {
        try {
          const { data: existing } = await supabase
            .from('lead_tags')
            .select('lead_id')
            .eq('lead_id', leadId)
            .eq('tag_id', urgentTagId)
            .maybeSingle()

          if (existing) {
            // Tag-ul există dar suntem în Vanzari - elimină-l
            await toggleLeadTag(leadId, urgentTagId)
            console.log('Tag urgent eliminat din Vanzari')
          }
        } catch (error) {
          console.error('Eroare la eliminarea tag-ului urgent din Vanzari:', error)
        }
      }
      removeUrgentTagFromVanzari()
      return
    }

    // Pentru Receptie și Curier, gestionează tag-ul normal
    const hasUrgentItems = items.some(item => item.urgent === true)
    
    // Verifică dacă tag-ul urgent este deja atribuit
    const checkAndToggleUrgentTag = async () => {
      try {
        // Verifică dacă tag-ul este atribuit
        const { data: existing } = await supabase
          .from('lead_tags')
          .select('lead_id')
          .eq('lead_id', leadId)
          .eq('tag_id', urgentTagId)
          .maybeSingle()

        if (hasUrgentItems && !existing) {
          // Există items urgente dar tag-ul nu este atribuit - atribuie-l
          await toggleLeadTag(leadId, urgentTagId)
        } else if (!hasUrgentItems && existing) {
          // Nu există items urgente dar tag-ul este atribuit - elimină-l
          await toggleLeadTag(leadId, urgentTagId)
        }
      } catch (error) {
        console.error('Eroare la gestionarea tag-ului urgent:', error)
      }
    }

    checkAndToggleUrgentTag()
  }, [items, urgentTagId, leadId, isVanzariPipeline])

  // IMPORTANT: Reîncarcă urgent și subscription_type din service_file când se schimbă tăvița selectată
  useEffect(() => {
    if (!fisaId || !selectedQuoteId) return
    
    const reloadUrgentAndSubscription = async () => {
      try {
        const { data: serviceFileData } = await getServiceFile(fisaId)
        if (serviceFileData) {
          setUrgentAllServices(serviceFileData.urgent || false)
          setSubscriptionType(serviceFileData.subscription_type || '')
          console.log('Reîncărcare urgent și subscription din service_file la schimbarea tăviței:', {
            fisaId,
            selectedQuoteId,
            urgent: serviceFileData.urgent,
            subscription_type: serviceFileData.subscription_type
          })
        }
      } catch (error) {
        console.error('Eroare la reîncărcarea urgent și subscription:', error)
      }
    }
    
    reloadUrgentAndSubscription()
  }, [fisaId, selectedQuoteId, setUrgentAllServices, setSubscriptionType])

  // Încarcă stage-ul curent al fișei în pipeline-ul Receptie pentru a verifica dacă butonul de facturare trebuie afișat
  useEffect(() => {
    if (!fisaId || !isReceptiePipeline || pipelinesWithIds.length === 0) {
      setCurrentServiceFileStage(null)
      return
    }

    const loadCurrentStage = async () => {
      try {
        // Găsește pipeline-ul Receptie
        const receptiePipeline = pipelinesWithIds.find(p => 
          p.name.toLowerCase().includes('receptie') || p.name.toLowerCase().includes('reception')
        )
        
        if (!receptiePipeline) {
          setCurrentServiceFileStage(null)
          return
        }

        // Obține pipeline_item-ul pentru service_file în pipeline-ul Receptie
        const { data: pipelineItem, error } = await getPipelineItemForItem(
          'service_file',
          fisaId,
          receptiePipeline.id
        )

        if (error || !pipelineItem) {
          console.log('Fișa nu este în pipeline-ul Receptie sau eroare:', error)
          setCurrentServiceFileStage(null)
          return
        }

        // Obține numele stage-ului
        if (pipelineItem.stage_id) {
          const { data: stageData, error: stageError } = await supabase
            .from('stages')
            .select('name')
            .eq('id', pipelineItem.stage_id)
            .single()

          if (!stageError && stageData) {
            setCurrentServiceFileStage(stageData.name)
            console.log('Stage curent al fișei în Receptie:', stageData.name)
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

  // Încarcă detaliile pentru fișa de serviciu (nu mai per tăviță)
  useEffect(() => {
    // Doar în pipeline-urile comerciale folosim această secțiune în Fișa de serviciu
    const loadServiceFileDetails = async () => {
      if (!isCommercialPipeline || !fisaId) {
        setTrayDetails('')
        return
      }

      setLoadingTrayDetails(true)
      try {
        const { data: serviceFileData } = await getServiceFile(fisaId)
        if (serviceFileData?.details) {
          try {
            const detailsObj = typeof serviceFileData.details === 'string' 
              ? JSON.parse(serviceFileData.details) 
              : serviceFileData.details
            setTrayDetails(detailsObj.comments || detailsObj.trayDetails || '')
          } catch {
            // Dacă nu este JSON valid, folosește direct valoarea
            setTrayDetails(serviceFileData.details || '')
          }
        } else {
          setTrayDetails('')
        }
      } catch (error) {
        console.error('Eroare la încărcarea detaliilor fișei:', error)
        setTrayDetails('')
      } finally {
        setLoadingTrayDetails(false)
      }
    }

    loadServiceFileDetails()
  }, [fisaId, isCommercialPipeline, setTrayDetails, setLoadingTrayDetails])
}

