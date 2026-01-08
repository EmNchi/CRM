/**
 * Hook pentru logica de business a componentei Preturi
 * 
 * Acest hook combină toate hook-urile specializate pentru operațiile cu Preturi
 */

import { useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { deleteTrayItem } from '@/lib/supabase/serviceFileOperations'
import { createQuoteForLead } from '@/lib/utils/preturi-helpers'
import type { LeadQuote, LeadQuoteItem } from '@/lib/types/preturi'
import type { Service } from '@/lib/supabase/serviceOperations'
import type { Part } from '@/lib/supabase/partOperations'
import type { Lead } from '@/lib/types/database'

// Importă hook-urile specializate
import { usePreturiTrayOperations } from './preturi/usePreturiTrayOperations'
import { usePreturiItemOperations } from './preturi/usePreturiItemOperations'
import { usePreturiImageOperations } from './preturi/usePreturiImageOperations'
import { usePreturiFormOperations } from './preturi/usePreturiFormOperations'
import { usePreturiSaveOperations } from './preturi/usePreturiSaveOperations'
import { usePreturiCalculations } from './preturi/usePreturiCalculations'
import { usePreturiDeliveryOperations } from './preturi/usePreturiDeliveryOperations'

const supabase = supabaseBrowser()

interface UsePreturiBusinessProps {
  leadId: string
  fisaId?: string | null
  selectedQuoteId: string | null
  selectedQuote: LeadQuote | null
  quotes: LeadQuote[]
  items: LeadQuoteItem[]
  services: Service[]
  parts: Part[]
  instruments: Array<{ id: string; name: string; weight: number; department_id: string | null }>
  departments: Array<{ id: string; name: string }>
  pipelinesWithIds: Array<{ id: string; name: string }>
  user: { id: string } | null
  isDepartmentPipeline: boolean
  isVanzariPipeline: boolean
  isReceptiePipeline: boolean
  subscriptionType: 'services' | 'parts' | 'both' | ''
  trayImages: any[]
  instrumentForm: any
  svc: any
  part: any
  instrumentSettings: any
  urgentAllServices: boolean
  
  // Additional state for save operations
  trayDetails?: string
  paymentCash: boolean
  paymentCard: boolean
  officeDirect: boolean
  curierTrimis: boolean
  isVanzator: boolean
  isCurierPipeline: boolean
  vanzariPipelineId: string | null
  vanzariStages: Array<{ id: string; name: string }>
  lead: Lead | null
  isCash: boolean
  isCard: boolean
  subtotal: number
  totalDiscount: number
  urgentAmount: number
  total: number
  
  // State setters
  setItems: React.Dispatch<React.SetStateAction<LeadQuoteItem[]>>
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>
  setSvc: React.Dispatch<React.SetStateAction<any>>
  setInstrumentForm: React.Dispatch<React.SetStateAction<any>>
  setPart: React.Dispatch<React.SetStateAction<any>>
  setServiceSearchQuery: React.Dispatch<React.SetStateAction<string>>
  setServiceSearchFocused: React.Dispatch<React.SetStateAction<boolean>>
  setPartSearchQuery: React.Dispatch<React.SetStateAction<string>>
  setPartSearchFocused: React.Dispatch<React.SetStateAction<boolean>>
  setInstrumentSettings: React.Dispatch<React.SetStateAction<any>>
  setTrayImages: React.Dispatch<React.SetStateAction<any[]>>
  setUploadingImage: React.Dispatch<React.SetStateAction<boolean>>
  setAllSheetsTotal: React.Dispatch<React.SetStateAction<number>>
  setUrgentAllServices: React.Dispatch<React.SetStateAction<boolean>>
  setPipelines: React.Dispatch<React.SetStateAction<string[]>>
  setPipelinesWithIds: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string }>>>
  setDepartments: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string }>>>
  setPipeLoading: React.Dispatch<React.SetStateAction<boolean>>
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
  setQuotes: React.Dispatch<React.SetStateAction<LeadQuote[]>>
  setSelectedQuoteId: React.Dispatch<React.SetStateAction<string | null>>
  setCreatingTray: React.Dispatch<React.SetStateAction<boolean>>
  setUpdatingTray: React.Dispatch<React.SetStateAction<boolean>>
  setDeletingTray: React.Dispatch<React.SetStateAction<boolean>>
  setMovingInstrument: React.Dispatch<React.SetStateAction<boolean>>
  setSendingTrays: React.Dispatch<React.SetStateAction<boolean>>
  setShowCreateTrayDialog: React.Dispatch<React.SetStateAction<boolean>>
  setShowEditTrayDialog: React.Dispatch<React.SetStateAction<boolean>>
  setShowMoveInstrumentDialog: React.Dispatch<React.SetStateAction<boolean>>
  setShowSendConfirmation: React.Dispatch<React.SetStateAction<boolean>>
  setShowDeleteTrayConfirmation: React.Dispatch<React.SetStateAction<boolean>>
  setTrayToDelete: React.Dispatch<React.SetStateAction<string | null>>
  setTraysAlreadyInDepartments: React.Dispatch<React.SetStateAction<boolean>>
  setNewTrayNumber: React.Dispatch<React.SetStateAction<string>>
  setNewTraySize: React.Dispatch<React.SetStateAction<string>>
  setEditingTrayNumber: React.Dispatch<React.SetStateAction<string>>
  setEditingTraySize: React.Dispatch<React.SetStateAction<string>>
  setInstrumentToMove: React.Dispatch<React.SetStateAction<{ 
    instrument: { id: string; name: string }
    items: LeadQuoteItem[] 
  } | null>>
  setTargetTrayId: React.Dispatch<React.SetStateAction<string>>
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
  setOfficeDirect: React.Dispatch<React.SetStateAction<boolean>>
  setCurierTrimis: React.Dispatch<React.SetStateAction<boolean>>
  
  // State values
  newTrayNumber: string
  newTraySize: string
  editingTrayNumber: string
  editingTraySize: string
  trayToDelete: string | null
  instrumentToMove: { 
    instrument: { id: string; name: string }
    items: LeadQuoteItem[] 
  } | null
  targetTrayId: string
  
  // Callbacks
  recalcAllSheetsTotal: (quotes: LeadQuote[]) => Promise<void>
  populateInstrumentFormFromItems: (items: LeadQuoteItem[], instrumentId: string | null, forceReload: boolean) => void
}

export function usePreturiBusiness({
  leadId,
  fisaId,
  selectedQuoteId,
  selectedQuote,
  quotes,
  items,
  services,
  parts,
  instruments,
  departments,
  pipelinesWithIds,
  user,
  isDepartmentPipeline,
  isVanzariPipeline,
  isReceptiePipeline,
  subscriptionType,
  trayImages,
  instrumentForm,
  svc,
  part,
  instrumentSettings,
  urgentAllServices,
  trayDetails,
  paymentCash,
  paymentCard,
  officeDirect,
  curierTrimis,
  isVanzator,
  isCurierPipeline,
  vanzariPipelineId,
  vanzariStages,
  lead,
  isCash,
  isCard,
  subtotal,
  totalDiscount,
  urgentAmount,
  total,
  setItems,
  setIsDirty,
  setSvc,
  setInstrumentForm,
  setPart,
  setServiceSearchQuery,
  setServiceSearchFocused,
  setPartSearchQuery,
  setPartSearchFocused,
  setInstrumentSettings,
  setTrayImages,
  setUploadingImage,
  setAllSheetsTotal,
  setUrgentAllServices,
  setPipelines,
  setPipelinesWithIds,
  setDepartments,
  setPipeLoading,
  setLoading,
  setQuotes,
  setSelectedQuoteId,
  setCreatingTray,
  setUpdatingTray,
  setDeletingTray,
  setMovingInstrument,
  setSendingTrays,
  setShowCreateTrayDialog,
  setShowEditTrayDialog,
  setShowMoveInstrumentDialog,
  setShowSendConfirmation,
  setShowDeleteTrayConfirmation,
  setTrayToDelete,
  setTraysAlreadyInDepartments,
  setNewTrayNumber,
  setNewTraySize,
  setEditingTrayNumber,
  setEditingTraySize,
  setInstrumentToMove,
  setTargetTrayId,
  setOfficeDirect,
  setCurierTrimis,
  newTrayNumber,
  newTraySize,
  editingTrayNumber,
  editingTraySize,
  trayToDelete,
  instrumentToMove,
  targetTrayId,
  recalcAllSheetsTotal,
  populateInstrumentFormFromItems,
  setSaving,
}: UsePreturiBusinessProps) {
  
  // Combină hook-urile specializate
  const calculations = usePreturiCalculations({
    services,
    instruments,
    pipelinesWithIds,
    subscriptionType,
    setAllSheetsTotal,
  })
  
  const imageOperations = usePreturiImageOperations({
    selectedQuoteId,
    trayImages,
    setTrayImages,
    setUploadingImage,
  })
  
  const formOperations = usePreturiFormOperations({
    instrumentForm,
    svc,
    part,
    items,
    instrumentSettings,
    services,
    instruments,
    departments,
    setInstrumentForm,
    setSvc,
    setPart,
    setServiceSearchQuery,
    setServiceSearchFocused,
    setPartSearchQuery,
    setPartSearchFocused,
    setIsDirty,
    setInstrumentSettings,
  })
  
  const deliveryOperations = usePreturiDeliveryOperations({
    fisaId,
    pipelinesWithIds,
    setPipelines,
    setPipelinesWithIds,
    setDepartments,
    setPipeLoading,
    setIsDirty,
    setOfficeDirect,
    setCurierTrimis,
  })
  
  // Creează o funcție de inițializare snapshot care va fi folosită de itemOperations
  // Această funcție va fi actualizată când saveOperations este creat
  const initializeSnapshotRef = useRef<((items: LeadQuoteItem[]) => void) | null>(null)
  
  const itemOperations = usePreturiItemOperations({
    selectedQuote,
    svc,
    part,
    services,
    parts,
    instruments,
    departments,
    pipelinesWithIds,
    items,
    instrumentForm,
    instrumentSettings,
    urgentAllServices,
    isVanzariPipeline,
    isDepartmentPipeline,
    user,
    setItems,
    setIsDirty,
    setSvc,
    setPart,
    setInstrumentForm,
    setInstrumentSettings,
    setServiceSearchQuery,
    setPartSearchQuery,
    // tempId eliminat - items-urile se salvează direct în DB, nu mai folosim temp IDs
    initializeSnapshot: (items) => {
      if (initializeSnapshotRef.current) {
        initializeSnapshotRef.current(items)
      }
    },
  })
  
  const saveOperations = usePreturiSaveOperations({
    fisaId,
    trayDetails,
    paymentCash,
    paymentCard,
    officeDirect,
    curierTrimis,
    selectedQuote,
    isVanzariPipeline,
    isVanzator,
    leadId,
    instrumentForm,
    svc,
    items,
    instrumentSettings,
    urgentAllServices,
    subscriptionType,
    isCash,
    isCard,
    quotes,
    isCurierPipeline,
    vanzariPipelineId,
    vanzariStages,
    lead,
    services,
    instruments,
    departments,
    pipelinesWithIds,
    subtotal,
    totalDiscount,
    urgentAmount,
    total,
    setSaving,
    setQuotes,
    setSelectedQuoteId,
    setItems,
    setIsDirty,
    setSvc,
    setInstrumentForm,
    recalcAllSheetsTotal,
    populateInstrumentFormFromItems: formOperations.populateInstrumentFormFromItems,
  })
  
  // Actualizează ref-ul cu funcția de inițializare snapshot
  initializeSnapshotRef.current = saveOperations.initializeSnapshot
  
  const trayOperations = usePreturiTrayOperations({
    leadId,
    fisaId,
    selectedQuoteId,
    selectedQuote,
    quotes,
    services,
    instruments,
    pipelinesWithIds,
    isReceptiePipeline,
    setQuotes,
    setSelectedQuoteId,
    setItems,
    setLoading,
    setCreatingTray,
    setUpdatingTray,
    setDeletingTray,
    setMovingInstrument,
    setSendingTrays,
    setShowCreateTrayDialog,
    setShowEditTrayDialog,
    setShowMoveInstrumentDialog,
    setShowSendConfirmation,
    setShowDeleteTrayConfirmation,
    setTrayToDelete,
    setTraysAlreadyInDepartments,
    setNewTrayNumber,
    setNewTraySize,
    setEditingTrayNumber,
    setEditingTraySize,
    setInstrumentToMove,
    setTargetTrayId,
    newTrayNumber,
    newTraySize,
    editingTrayNumber,
    editingTraySize,
    trayToDelete,
    instrumentToMove,
    targetTrayId,
    recalcAllSheetsTotal,
  })
  // tempId eliminat - items-urile se salvează direct în DB, nu mai folosim temp IDs

  // Funcție pentru actualizarea unui item
  const onUpdateItem = useCallback((id: string, patch: Partial<LeadQuoteItem>) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } as any : it)))
    setIsDirty(true)
  }, [setItems, setIsDirty])

  // Funcție pentru ștergerea unui item
  const onDelete = useCallback(async (id: string) => {
    const itemToDelete = items.find(it => it.id === id)
    if (!itemToDelete) return
    
    const currentInstrumentId = instrumentForm?.instrument || svc?.instrumentId
    if (currentInstrumentId && itemToDelete.item_type === 'service') {
      const brandSerialGroups = Array.isArray(instrumentForm.brandSerialGroups) ? instrumentForm.brandSerialGroups : []
      
      // FOLOSIM FOR LOOP ÎN LOC DE .some() - MAI SIGUR
      let hasBrandsInForm = false
      if (Array.isArray(brandSerialGroups)) {
        for (let i = 0; i < brandSerialGroups.length; i++) {
          const g = brandSerialGroups[i]
          if (!g) continue
          const hasBrand = g.brand && g.brand.trim()
          const serialNumbers = Array.isArray(g.serialNumbers) ? g.serialNumbers : []
          
          // Verifică serial numbers cu for loop în loc de .some()
          let hasSerialNumbers = false
          for (let j = 0; j < serialNumbers.length; j++) {
            const sn = serialNumbers[j]
            const serial = typeof sn === 'string' ? sn : (sn && typeof sn === 'object' ? sn?.serial || '' : '')
            if (serial && serial.trim()) {
              hasSerialNumbers = true
              break
            }
          }
          
          if (hasBrand || hasSerialNumbers) {
            hasBrandsInForm = true
            break
          }
        }
      }
      
      if (hasBrandsInForm) {
        setInstrumentSettings((prev: any) => ({
          ...prev,
          [currentInstrumentId]: {
            qty: instrumentForm.qty || '1',
            brandSerialGroups: instrumentForm.brandSerialGroups
          }
        }))
      }
    }
    
    // ELIMINAT: Verificările pentru temp IDs - items-urile se salvează direct în DB, nu mai există temp IDs
    // Toate items-urile au ID-uri reale din DB
    if (id && !String(id).startsWith('temp-') && !String(id).startsWith('local_')) {
      try {
        const { success, error } = await deleteTrayItem(id)
        if (!success || error) {
          console.error('Error deleting tray item from DB:', error)
          toast.error('Eroare la ștergerea serviciului din baza de date')
          return
        }
      } catch (error: any) {
        console.error('Error deleting tray item:', error)
        toast.error('Eroare la ștergerea serviciului')
        return
      }
    }
    
    setItems(prev => {
      const newItems = prev.filter(it => it.id !== id)
      
      if (itemToDelete.item_type === null) {
        setSvc((p: any) => ({ ...p, instrumentId: '' }))
        setInstrumentForm((prev: any) => ({ 
          ...prev, 
          instrument: '',
          brandSerialGroups: [{ brand: '', serialNumbers: [{ serial: '', garantie: false }], qty: '1' }]
        }))
      }
      
      return newItems
    })
    
    setIsDirty(true)
  }, [items, instrumentForm, svc, setItems, setIsDirty, setSvc, setInstrumentForm, setInstrumentSettings])

  // Funcție pentru mutarea unui instrument între tăvițe
  const handleMoveInstrument = useCallback(async (targetTrayId: string, instrumentGroup: { instrument: { id: string; name: string }; items: LeadQuoteItem[] }, newTrayNumber?: string, newTraySize?: string) => {
    if (!fisaId) {
      toast.error('Fișa de serviciu nu este setată')
      return
    }

    let finalTrayId = targetTrayId

    if (targetTrayId === 'new' && newTrayNumber) {
      try {
        const created = await createQuoteForLead(leadId, newTrayNumber.trim(), fisaId, newTraySize || 'm')
        finalTrayId = created.id
      } catch (error: any) {
        console.error('Error creating tray:', error)
        toast.error('Eroare la crearea tăviței: ' + (error?.message || 'Eroare necunoscută'))
        return
      }
    }

    toast.success(`Instrumentul "${instrumentGroup.instrument.name}" a fost mutat cu succes`)
  }, [leadId, fisaId])

  // Funcții pentru actualizarea checkbox-urilor lead
  const handleNoDealChange = useCallback(async (checked: boolean) => {
    try {
      const { error } = await (supabase
        .from('leads') as any)
        .update({ no_deal: checked })
        .eq('id', leadId)

      if (error) throw error
    } catch (error: any) {
      console.error('Error updating no_deal:', error)
      toast.error('Eroare la actualizarea câmpului No Deal')
    }
  }, [leadId])

  const handleNuRaspundeChange = useCallback(async (checked: boolean) => {
    try {
      const { error } = await (supabase
        .from('leads') as any)
        .update({ nu_raspunde: checked })
        .eq('id', leadId)

      if (error) throw error
    } catch (error: any) {
      console.error('Error updating nu_raspunde:', error)
      toast.error('Eroare la actualizarea câmpului Nu Raspunde')
    }
  }, [leadId])

  const handleCallBackChange = useCallback(async (checked: boolean) => {
    try {
      const { error } = await (supabase
        .from('leads') as any)
        .update({ call_back: checked })
        .eq('id', leadId)

      if (error) throw error
    } catch (error: any) {
      console.error('Error updating call_back:', error)
      toast.error('Eroare la actualizarea câmpului Call Back')
    }
  }, [leadId])

  // TODO: Adaugă aici toate celelalte funcții din PreturiContainer.tsx:
  // - saveAllAndLog
  // - handleCreateTray
  // - handleUpdateTray
  // - handleDeleteTray
  // - onAddService
  // - onAddPart
  // - handleDeliveryCheckboxChange
  // - handleTrayImageUpload
  // - handleTrayImageDelete
  // - handleDownloadAllImages
  // - sendAllTraysToPipeline
  // - onAddBrandSerialGroup
  // - onRemoveBrandSerialGroup
  // - onUpdateBrand
  // - onUpdateSerialNumber
  // - onUpdateSerialGarantie
  // - handleResetServiceForm
  // - handleResetPartForm
  // - populateInstrumentFormFromItems
  // - recalcAllSheetsTotal
  // - checkServiceFileHasContent
  // - onEditTray
  // - onChangeSheet
  // - onAddSheet
  // - computeItemsTotal
  // - validateTraysBeforeSend
  // - checkTraysInDepartments
  // - onRowClick
  // - onBrandToggle
  // - onInstrumentChange
  // - onQtyChange
  // - onServiceSelect
  // - onServiceDoubleClick
  // - onPartSelect
  // - onPartDoubleClick
  // - handleUrgentChange
  // etc.

  // Wrapper pentru handleTrayImageUpload (adaptează semnătura pentru PreturiOrchestrator)
  const handleTrayImageUploadWrapper = useCallback(async (file: File) => {
    // Creează un event sintetic pentru handleTrayImageUpload
    const syntheticEvent = {
      target: {
        files: [file],
        value: '',
      },
    } as unknown as React.ChangeEvent<HTMLInputElement>
    await imageOperations.handleTrayImageUpload(syntheticEvent)
  }, [imageOperations.handleTrayImageUpload])
  
  // Wrapper pentru handleTrayImageDelete (adaptează semnătura pentru PreturiOrchestrator)
  const handleTrayImageDeleteWrapper = useCallback(async (imageId: string) => {
    // TODO: Obține filePath din trayImages sau din DB
    const image = trayImages.find(img => img.id === imageId)
    if (image) {
      await imageOperations.handleTrayImageDelete(imageId, image.path || '')
    }
  }, [imageOperations.handleTrayImageDelete, trayImages])
  
  
  const onAddService = useCallback(async () => {
    toast.info('Funcția onAddService va fi implementată')
  }, [])
  
  const onAddPart = useCallback(async () => {
    toast.info('Funcția onAddPart va fi implementată')
  }, [])
  
  const handleCreateTray = useCallback(async () => {
    toast.info('Funcția handleCreateTray va fi implementată')
  }, [])
  
  const handleUpdateTray = useCallback(async () => {
    toast.info('Funcția handleUpdateTray va fi implementată')
  }, [])
  
  const handleDeleteTray = useCallback(async () => {
    toast.info('Funcția handleDeleteTray va fi implementată')
  }, [])
  
  const sendAllTraysToPipeline = useCallback(async () => {
    toast.info('Funcția sendAllTraysToPipeline va fi implementată')
  }, [])
  
  const handleUrgentChange = useCallback(async (checked: boolean) => {
    setUrgentAllServices(checked)
    setIsDirty(true)
  }, [setUrgentAllServices, setIsDirty])
  
  const onInstrumentChange = useCallback((instrumentId: string) => {
    // IMPORTANT: Setează mai întâi instrumentId în formular pentru a activa logica isReparatiiInstrument
    setInstrumentForm((prev: any) => ({
      ...prev,
      instrument: instrumentId,
      // Pentru instrumente noi din Reparații, inițializează un grup brand/serial gol
      brandSerialGroups: prev?.instrument !== instrumentId 
        ? [{ brand: '', serialNumbers: [{ serial: '', garantie: false }], qty: '1' }]
        : prev?.brandSerialGroups || []
    }))
    
    // Populează brand-urile din items existente (dacă există)
    formOperations.populateInstrumentFormFromItems(items, instrumentId, false)
    
    // Actualizează și svc.instrumentId pentru sincronizare
    setSvc((prev: any) => ({ ...prev, instrumentId }))
    setIsDirty(true)
  }, [items, formOperations.populateInstrumentFormFromItems, setSvc, setIsDirty, setInstrumentForm])
  
  const onQtyChange = useCallback((qty: string) => {
    setInstrumentForm((prev: any) => ({ ...prev, qty }))
    // Actualizează și în instrumentSettings
    const currentInstrumentId = instrumentForm.instrument
    if (currentInstrumentId) {
      setInstrumentSettings((prev: any) => ({
        ...prev,
        [currentInstrumentId]: {
          ...prev[currentInstrumentId],
          qty,
        }
      }))
    }
    setIsDirty(true)
  }, [instrumentForm.instrument, setInstrumentForm, setInstrumentSettings, setIsDirty])
  
  const onServiceSelect = useCallback((serviceId: string, serviceName: string) => {
    if (!serviceId) {
      setSvc((prev: any) => ({ ...prev, id: '', name: '' }))
      setServiceSearchQuery('')
      return
    }
    
    const service = services.find(s => s.id === serviceId)
    if (!service) return
    
    setSvc((prev: any) => ({
      ...prev,
      id: serviceId,
      name: serviceName,
      price: service.price,
      qty: prev.qty || '1',
      discount: prev.discount || '0',
    }))
    setServiceSearchQuery(serviceName)
    setServiceSearchFocused(false)
  }, [services, setSvc, setServiceSearchQuery, setServiceSearchFocused])
  
  const onServiceDoubleClick = useCallback((serviceId: string, serviceName: string) => {
    // Selectează serviciul și apoi adaugă-l direct
    onServiceSelect(serviceId, serviceName)
    // Apelează onAddService după un mic delay pentru a permite state-ului să se actualizeze
    setTimeout(() => {
      itemOperations.onAddService()
    }, 50)
  }, [onServiceSelect, itemOperations.onAddService])
  
  const onPartSelect = useCallback((partId: string, partName: string) => {
    if (!partId) {
      setPart((prev: any) => ({ ...prev, id: '', name: '' }))
      setPartSearchQuery('')
      return
    }
    
    const partDef = parts.find(p => p.id === partId)
    if (!partDef) return
    
    setPart((prev: any) => ({
      ...prev,
      id: partId,
      name: partName,
      price: partDef.price,
      qty: prev.qty || '1',
      discount: prev.discount || '0',
    }))
    setPartSearchQuery(partName)
    setPartSearchFocused(false)
  }, [parts, setPart, setPartSearchQuery, setPartSearchFocused])
  
  const onPartDoubleClick = useCallback((partId: string, partName: string) => {
    // Selectează piesa și apoi adaugă-o direct
    onPartSelect(partId, partName)
    // Apelează onAddPart după un mic delay pentru a permite state-ului să se actualizeze
    setTimeout(() => {
      itemOperations.onAddPart()
    }, 50)
  }, [onPartSelect, itemOperations.onAddPart])
  
  const onRowClick = useCallback((itemId: string) => {
    // Găsește item-ul după id
    const item = items.find(i => i.id === itemId)
    if (!item) return
    
    // Găsește serviciul pentru a obține instrument_id
    const serviceDef = services.find(s => s.id === item.service_id)
    const instrumentId = serviceDef?.instrument_id || item.instrument_id || ''
    
    // Transformă brand_groups din format DB în format formular
    let brandSerialGroups: Array<{ brand: string; serialNumbers: Array<{ serial: string; garantie: boolean }>; qty: string }> = []
    
    if (item.brand_groups && Array.isArray(item.brand_groups) && item.brand_groups.length > 0) {
      brandSerialGroups = item.brand_groups.map((bg: any) => {
        // Transformă serialNumbers din string[] în Array<{ serial: string, garantie: boolean }>
        let serialNumbersArray: Array<{ serial: string; garantie: boolean }> = []
        
        if (Array.isArray(bg.serialNumbers)) {
          serialNumbersArray = bg.serialNumbers.map((sn: any) => {
            // Dacă este deja un obiect cu serial și garantie
            if (typeof sn === 'object' && sn !== null && 'serial' in sn) {
              return {
                serial: sn.serial || '',
                garantie: Boolean(sn.garantie)
              }
            }
            // Dacă este doar un string
            return {
              serial: typeof sn === 'string' ? sn : String(sn || ''),
              garantie: Boolean(bg.garantie || false)
            }
          })
        } else if (bg.serialNumbers) {
          // Fallback pentru cazul în care serialNumbers nu este array
          serialNumbersArray = [{
            serial: String(bg.serialNumbers || ''),
            garantie: Boolean(bg.garantie || false)
          }]
        }
        
        // Dacă nu există serial numbers, creează unul gol
        if (serialNumbersArray.length === 0) {
          serialNumbersArray = [{ serial: '', garantie: Boolean(bg.garantie || false) }]
        }
        
        return {
          brand: bg.brand || '',
          serialNumbers: serialNumbersArray,
          qty: String(bg.qty || serialNumbersArray.length || 1)
        }
      })
    } else if (item.brand || item.serial_number) {
      // Fallback pentru cazul în care există brand/serial direct pe item (format vechi)
      brandSerialGroups = [{
        brand: item.brand || '',
        serialNumbers: [{
          serial: item.serial_number || '',
          garantie: Boolean(item.garantie || false)
        }],
        qty: '1'
      }]
    }
    
    // Populează formularul de instrument
    if (instrumentId) {
      setInstrumentForm({
        instrument: instrumentId,
        qty: String(item.qty || 1),
        garantie: item.garantie || false,
        brandSerialGroups: brandSerialGroups.length > 0 ? brandSerialGroups : [{ brand: '', serialNumbers: [{ serial: '', garantie: false }], qty: '1' }]
      })
    }
    
    // Populează formularul de serviciu
    if (item.item_type === 'service' && item.service_id) {
      // Construiește selectedBrands din brand_groups pentru checkbox-uri
      const selectedBrands: string[] = []
      if (item.brand_groups && Array.isArray(item.brand_groups)) {
        item.brand_groups.forEach((bg: any, bgIdx: number) => {
          const brandName = bg.brand || ''
          const serialNumbers = Array.isArray(bg.serialNumbers) ? bg.serialNumbers : []
          
          serialNumbers.forEach((sn: any, snIdx: number) => {
            const serial = typeof sn === 'string' ? sn : (sn && typeof sn === 'object' ? sn?.serial || '' : '')
            const serialValue = serial && serial.trim() ? serial.trim() : `empty-${bgIdx}-${snIdx}`
            const brandKey = `${brandName}::${serialValue}`
            selectedBrands.push(brandKey)
          })
        })
      }
      
      // Selectează serviciul în dropdown
      onServiceSelect(item.service_id, item.name_snapshot || '')
      
      // Actualizează svc cu datele complete
      setSvc((prev: any) => ({
        ...prev,
        qty: String(item.qty || 1),
        discount: String(item.discount_pct || 0),
        instrumentId: instrumentId,
        selectedBrands: selectedBrands
      }))
    }
    
    // Populează formularul de piesă (dacă este piesă)
    if (item.item_type === 'part' && item.part_id) {
      // Selectează piesa în dropdown
      onPartSelect(item.part_id, item.name_snapshot || '')
      
      // Actualizează part cu datele complete
      setPart((prev: any) => ({
        ...prev,
        qty: String(item.qty || 1),
        serialNumberId: ''
      }))
    }
    
    toast.info('Datele au fost încărcate în formulare pentru editare')
  }, [items, services, setInstrumentForm, setSvc, setServiceSearchQuery, setPart, setPartSearchQuery, onServiceSelect, onPartSelect])
  
  const onBrandToggle = useCallback((brandKey: string, checked: boolean) => {
    setSvc((prev: any) => {
      const currentBrands = Array.isArray(prev?.selectedBrands) ? prev.selectedBrands : []
      let newBrands: string[]
      
      if (checked) {
        // Adaugă brand-ul dacă nu există deja
        newBrands = currentBrands.includes(brandKey) ? currentBrands : [...currentBrands, brandKey]
      } else {
        // Elimină brand-ul
        newBrands = currentBrands.filter((b: string) => b !== brandKey)
      }
      
      return { ...prev, selectedBrands: newBrands }
    })
    setIsDirty(true)
  }, [setSvc, setIsDirty])
  
  // Wrapper pentru handleMoveInstrument (adaptează semnătura pentru PreturiOrchestrator)
  const handleMoveInstrumentWrapper = useCallback(async () => {
    toast.info('Funcția handleMoveInstrument va fi implementată')
  }, [])

  return {
    // Funcții existente (păstrate pentru compatibilitate)
    onUpdateItem,
    onDelete,
    handleMoveInstrument: handleMoveInstrumentWrapper,
    handleNoDealChange,
    handleNuRaspundeChange,
    handleCallBackChange,
    // tempId eliminat - items-urile se salvează direct în DB
    
    // Hook-uri combinate - Calculations
    computeItemsTotal: calculations.computeItemsTotal,
    recalcAllSheetsTotal: calculations.recalcAllSheetsTotal,
    
    // Hook-uri combinate - Image Operations (cu wrapper-uri pentru compatibilitate)
    handleTrayImageUpload: handleTrayImageUploadWrapper,
    handleDownloadAllImages: imageOperations.handleDownloadAllImages,
    handleTrayImageDelete: handleTrayImageDeleteWrapper,
    
    // Hook-uri combinate - Form Operations
    onAddBrandSerialGroup: formOperations.onAddBrandSerialGroup,
    onRemoveBrandSerialGroup: formOperations.onRemoveBrandSerialGroup,
    onUpdateBrand: formOperations.onUpdateBrand,
    onUpdateBrandQty: formOperations.onUpdateBrandQty,
    onUpdateSerialNumber: formOperations.onUpdateSerialNumber,
    onAddSerialNumber: formOperations.onAddSerialNumber,
    onRemoveSerialNumber: formOperations.onRemoveSerialNumber,
    onUpdateSerialGarantie: formOperations.onUpdateSerialGarantie,
    handleResetServiceForm: formOperations.handleResetServiceForm,
    handleResetPartForm: formOperations.handleResetPartForm,
    populateInstrumentFormFromItems: formOperations.populateInstrumentFormFromItems,
    
    // Hook-uri combinate - Delivery Operations
    refreshPipelines: deliveryOperations.refreshPipelines,
    refreshDepartments: deliveryOperations.refreshDepartments,
    handleDeliveryCheckboxChange: deliveryOperations.handleDeliveryCheckboxChange,
    handleCurierTrimisChange: deliveryOperations.handleCurierTrimisChange,
    
    // Hook-uri combinate - Tray Operations
    onAddSheet: (trayOperations as any).onAddSheet,
    handleCreateTray: (trayOperations as any).handleCreateTray,
    onEditTray: (trayOperations as any).onEditTray,
    handleUpdateTray: (trayOperations as any).handleUpdateTray,
    handleDeleteTray: (trayOperations as any).handleDeleteTray,
    handleMoveInstrumentToTray: (trayOperations as any).handleMoveInstrument,
    validateTraysBeforeSend: (trayOperations as any).validateTraysBeforeSend,
    checkTraysInDepartments: (trayOperations as any).checkTraysInDepartments,
    sendAllTraysToPipeline: (trayOperations as any).sendAllTraysToPipeline,
    
    // Hook-uri combinate - Item Operations
    onAddService: itemOperations.onAddService,
    onAddPart: itemOperations.onAddPart,
    
    // Hook-uri combinate - Save Operations
    saveAllAndLog: saveOperations.saveAllAndLog,
    checkServiceFileHasContent: saveOperations.checkServiceFileHasContent,
    initializeSnapshot: saveOperations.initializeSnapshot,
    handleUrgentChange,
    onInstrumentChange,
    onQtyChange,
    onServiceSelect,
    onServiceDoubleClick,
    onPartSelect,
    onPartDoubleClick,
    onRowClick,
    onBrandToggle,
    
    // TrayTabs callbacks
    onTraySelect: (trayId: string) => {
      setSelectedQuoteId(trayId)
    },
    onAddTray: (trayOperations as any).onAddSheet,
    onDeleteTray: (trayOperations as any).handleDeleteTray,
    onSendTrays: (trayOperations as any).sendAllTraysToPipeline,
  }
}
