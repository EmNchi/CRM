'use client'

import { forwardRef, useImperativeHandle, useMemo, useEffect, useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useRole, useAuth } from '@/lib/contexts/AuthContext'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { usePreturiState } from '@/hooks/usePreturiState'
import { usePreturiPipeline } from '@/hooks/usePreturiPipeline'
import { usePreturiDataLoader } from '@/hooks/usePreturiDataLoader'
import { usePreturiBusiness } from '@/hooks/usePreturiBusiness'
import { usePreturiEffects } from '@/hooks/usePreturiEffects'
import { usePreturiCalculations } from '@/hooks/preturi/usePreturiCalculations'
import { usePreturiFormOperations } from '@/hooks/preturi/usePreturiFormOperations'
import { listQuoteItems } from '@/lib/utils/preturi-helpers'
import { PreturiOrchestrator } from './PreturiOrchestrator'
import { BillingDialog } from '../dialogs/BillingDialog'
import type { PreturiRef, PreturiProps } from '@/lib/types/preturi'
import type { LeadQuoteItem } from '@/lib/types/preturi'
import type { Lead } from '@/lib/types/database'
import { URGENT_MARKUP_PCT } from '@/lib/types/preturi'

/**
 * Componentă principală simplă care folosește hook-urile și orchestratorul
 * Nu conține logică de business - doar conectează hook-urile cu orchestratorul
 */
const PreturiMain = forwardRef<PreturiRef, PreturiProps>(function PreturiMain({ 
  leadId, 
  lead: leadProp, 
  fisaId, 
  initialQuoteId, 
  pipelineSlug, 
  isDepartmentPipeline = false 
}, ref) {
  // Normalizează lead-ul pentru a evita conflicte de tipuri
  const lead = leadProp as any
  // Hook-uri pentru state management
  const state = usePreturiState(initialQuoteId)
  
  // State pentru dialog-ul de facturare
  const [showBillingDialog, setShowBillingDialog] = useState(false)
  
  // Hook-uri pentru pipeline checks
  const pipeline = usePreturiPipeline(pipelineSlug, isDepartmentPipeline)
  
  // Hook-uri pentru auth
  const { role, loading: roleLoading } = useRole()
  const { user } = useAuth()
  
  // Check technician status - un tehnician este orice membru care NU este owner sau admin
  useEffect(() => {
    async function checkTechnician() {
      if (!user?.id) {
        state.setIsTechnician(false)
        return
      }
      const { data } = await supabaseBrowser()
        .from('app_members')
        .select('user_id, role')
        .eq('user_id', user.id)
        .single()
      // Un tehnician este un membru care există DAR nu este owner sau admin
      const isTech = !!data && (data as any).role !== 'owner' && (data as any).role !== 'admin'
      state.setIsTechnician(isTech)
    }
    checkTechnician()
  }, [user, state.setIsTechnician])
  
  // Computed values
  const isVanzatorMode = useMemo(() => {
    // Verifică dacă utilizatorul este vânzător (nu tehnician)
    return !state.isTechnician && (role === 'admin' || role === 'owner' || role === 'member')
  }, [state.isTechnician, role])
  
  const availableInstruments = useMemo(() => {
    // Verifică dacă suntem în Vanzari și în tăvița undefined
    const isUndefinedTray = state.selectedQuote && (!state.selectedQuote.number || state.selectedQuote.number === '')
    const allowAllInstruments = pipeline.isVanzariPipeline && isUndefinedTray
    
    // Dacă suntem în Vanzari și în tăvița undefined, permite toate instrumentele
    if (allowAllInstruments) {
      return state.instruments.sort((a, b) => a.name.localeCompare(b.name, 'ro'))
    }
    
    // Obține departamentele existente în tăviță
    const existingDepartments = new Set<string | null>()
    const itemsArray = Array.isArray(state.items) ? state.items : []
    itemsArray.forEach(item => {
      if (item && item.instrument_id) {
        const instrument = state.instruments.find(i => i.id === item.instrument_id)
        if (instrument && instrument.department_id) {
          existingDepartments.add(instrument.department_id)
        }
      }
    })
    
    // Dacă există deja instrumente în tăviță, filtrează doar instrumentele cu același departament
    if (existingDepartments.size > 0) {
      const allowedDepartment = Array.from(existingDepartments)[0]
      return state.instruments
        .filter(inst => inst.department_id === allowedDepartment)
        .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
    }
    
    // Dacă nu există instrumente în tăviță, afișează toate instrumentele
    return state.instruments.sort((a, b) => a.name.localeCompare(b.name, 'ro'))
  }, [pipeline.isVanzariPipeline, state.selectedQuote, state.items, state.instruments])
  
  const currentInstrumentId = useMemo(() => {
    return state.instrumentForm.instrument || state.svc.instrumentId || null
  }, [state.instrumentForm.instrument, state.svc.instrumentId])

  // Calculăm totals (trebuie să fie înainte de usePreturiBusiness)
  const subscriptionDiscountAmount = useMemo(() => {
    if (!state.subscriptionType) return 0
    
    const itemsArray = Array.isArray(state.items) ? state.items : []
    return itemsArray.reduce((acc, it) => {
      if (!it) return acc
      const base = (it.qty || 0) * (it.price || 0)
      const disc = base * (Math.min(100, Math.max(0, it.discount_pct || 0)) / 100)
      const afterDisc = base - disc
      
      if (it.item_type === 'service' && (state.subscriptionType === 'services' || state.subscriptionType === 'both')) {
        const urgent = it.urgent ? afterDisc * 0.20 : 0
        return acc + (afterDisc + urgent) * 0.10
      } else if (it.item_type === 'part' && (state.subscriptionType === 'parts' || state.subscriptionType === 'both')) {
        return acc + afterDisc * 0.05
      }
      return acc
    }, 0)
  }, [state.subscriptionType, state.items])
  
  const { subtotal, totalDiscount, urgentAmount, total } = useMemo(() => {
    // Exclude items-urile cu item_type: null (doar instrument, fără serviciu) din calculele de totaluri
    const itemsArray = Array.isArray(state.items) ? state.items : []
    const visibleItems = itemsArray.filter(it => it && it.item_type !== null)
    
    const subtotal = visibleItems.reduce((acc, it) => {
      if (!it) return acc
      return acc + (it.qty || 0) * (it.price || 0)
    }, 0)
    const totalDiscount = visibleItems.reduce(
      (acc, it) => {
        if (!it) return acc
        return acc + (it.qty || 0) * (it.price || 0) * (Math.min(100, Math.max(0, it.discount_pct || 0)) / 100)
      },
      0
    )
    const urgentAmount = visibleItems.reduce((acc, it) => {
      if (!it) return acc
      const afterDisc = (it.qty || 0) * (it.price || 0) * (1 - Math.min(100, Math.max(0, it.discount_pct || 0)) / 100)
      return acc + (it.urgent ? afterDisc * 0.20 : 0) // URGENT_MARKUP_PCT = 20%
    }, 0)
    
    const baseTotal = subtotal - totalDiscount + urgentAmount
    const total = baseTotal - subscriptionDiscountAmount
    return { subtotal, totalDiscount, urgentAmount, total }
  }, [state.items, subscriptionDiscountAmount])

  const availableServices = useMemo(() => {
    if (!currentInstrumentId) return []
    // Filtrează serviciile care corespund instrumentului selectat
    const servicesForInstrument = Array.isArray(state.services) ? state.services.filter(s => s.instrument_id === currentInstrumentId) : []
    
    // Obține serviciile care sunt deja atribuite acestui instrument în tăviță
    const itemsArray = Array.isArray(state.items) ? state.items : []
    const assignedServiceIds = new Set(
      itemsArray
        .filter(item => 
          item.instrument_id === currentInstrumentId && 
          item.item_type === 'service' && 
          item.service_id
        )
        .map(item => item.service_id)
    )
    
    // Exclude serviciile care sunt deja atribuite
    return servicesForInstrument.filter(s => !assignedServiceIds.has(s.id))
  }, [currentInstrumentId, state.services, state.items])
  
  const hasServicesOrInstrumentInSheet = useMemo(() => {
    if (!Array.isArray(state.items) || state.items.length === 0) {
      return false
    }
    
    // FOLOSIM FOR LOOP ÎN LOC DE .some() - MAI SIGUR
    const itemsArray = Array.isArray(state.items) ? state.items : []
    let result = false
    for (let i = 0; i < itemsArray.length; i++) {
      const it = itemsArray[i]
      if (it && (it.item_type === 'service' || it.item_type === null)) {
        result = true
        break // Oprim loop-ul când găsim primul item valid
      }
    }
    
    return result
  }, [state.items])
  
  const undefinedTray = useMemo(() => {
    return state.quotes.find(q => !q.number || q.number === '') || null
  }, [state.quotes])
  
  const instrumentsGrouped = useMemo(() => {
    // Calculează instrumentsGrouped doar pentru tăvița undefined
    const isUndefinedTray = state.selectedQuote && (!state.selectedQuote.number || state.selectedQuote.number === '')
    if (!isUndefinedTray) return []
    
    const grouped = new Map<string, { instrument: { id: string; name: string }; items: typeof state.items }>()
    if (!Array.isArray(state.items)) return []
    
    state.items.forEach(item => {
      let instrumentId: string | null = null
      
      // Dacă item-ul are instrument_id direct
      if (item.instrument_id) {
        instrumentId = item.instrument_id
      } 
      // Dacă item-ul este un serviciu, găsește instrument_id din serviciu
      else if (item.item_type === 'service' && item.service_id) {
        const service = state.services.find(s => s.id === item.service_id)
        instrumentId = service?.instrument_id || null
      }
      
      if (instrumentId) {
        const instrument = state.instruments.find(i => i.id === instrumentId)
        if (instrument) {
          if (!grouped.has(instrument.id)) {
            grouped.set(instrument.id, {
              instrument: { id: instrument.id, name: instrument.name },
              items: []
            })
          }
          grouped.get(instrument.id)!.items.push(item)
        }
      }
    })
    return Array.from(grouped.values())
  }, [state.items, state.instruments, state.services, state.selectedQuote])
  
  const distinctInstrumentsInTray = useMemo(() => {
    const instrumentIds = new Set<string>()
    const result: Array<{ id: string; name: string }> = []
    const itemsArray = Array.isArray(state.items) ? state.items : []
    itemsArray.forEach(item => {
      if (item && item.instrument_id && !instrumentIds.has(item.instrument_id)) {
        instrumentIds.add(item.instrument_id)
        const instrument = state.instruments.find(i => i.id === item.instrument_id)
        if (instrument) {
          result.push({ id: instrument.id, name: instrument.name })
        }
      }
    })
    return result
  }, [state.items, state.instruments])
  
  const isReparatiiInstrument = useMemo(() => {
    if (!state.instrumentForm.instrument) return false
    const instrument = state.instruments.find(i => i.id === state.instrumentForm.instrument)
    if (!instrument || !instrument.department_id) return false
    const department = state.departments.find(d => d.id === instrument.department_id)
    return department?.name.toLowerCase().includes('reparatii') || false
  }, [state.instrumentForm.instrument, state.instruments, state.departments])
  
  // Hook-uri pentru data loading
  usePreturiDataLoader({
    leadId,
    fisaId,
    initialQuoteId,
    setLoading: state.setLoading,
    setServices: state.setServices,
    setParts: state.setParts,
    setInstruments: state.setInstruments,
    setQuotes: state.setQuotes,
    setSelectedQuoteId: state.setSelectedQuoteId,
    setPipelines: state.setPipelines,
    setPipelinesWithIds: state.setPipelinesWithIds,
    setPipeLoading: state.setPipeLoading,
    setDepartments: state.setDepartments,
    setTechnicians: state.setTechnicians,
  })
  
  // Hook-uri pentru calculations (pentru recalcAllSheetsTotal)
  const calculations = usePreturiCalculations({
    services: state.services,
    instruments: state.instruments,
    pipelinesWithIds: state.pipelinesWithIds,
    subscriptionType: state.subscriptionType,
    setAllSheetsTotal: state.setAllSheetsTotal,
  })
  
  // Hook-uri pentru form operations (pentru populateInstrumentFormFromItems)
  const formOperations = usePreturiFormOperations({
    instrumentForm: state.instrumentForm,
    svc: state.svc,
    part: state.part,
    items: state.items,
    instrumentSettings: state.instrumentSettings,
    services: state.services,
    instruments: state.instruments,
    departments: state.departments,
    setInstrumentForm: state.setInstrumentForm,
    setSvc: state.setSvc,
    setPart: state.setPart,
    setServiceSearchQuery: state.setServiceSearchQuery,
    setServiceSearchFocused: state.setServiceSearchFocused,
    setPartSearchQuery: state.setPartSearchQuery,
    setPartSearchFocused: state.setPartSearchFocused,
    setIsDirty: state.setIsDirty,
    setInstrumentSettings: state.setInstrumentSettings,
  })
  
  // Hook-uri pentru business logic
  const business = usePreturiBusiness({
    leadId,
    fisaId,
    selectedQuoteId: state.selectedQuoteId,
    selectedQuote: state.selectedQuote,
    quotes: state.quotes,
    items: state.items,
    services: state.services,
    parts: state.parts,
    instruments: state.instruments,
    departments: state.departments,
    pipelinesWithIds: state.pipelinesWithIds,
    user,
    isDepartmentPipeline,
    isVanzariPipeline: pipeline.isVanzariPipeline,
    isReceptiePipeline: pipeline.isReceptiePipeline,
    isCurierPipeline: pipelineSlug?.toLowerCase().includes('curier') || false,
    subscriptionType: state.subscriptionType,
    trayImages: state.trayImages,
    instrumentForm: state.instrumentForm,
    svc: state.svc,
    part: state.part,
    instrumentSettings: state.instrumentSettings,
    urgentAllServices: state.urgentAllServices,
    trayDetails: state.trayDetails,
    paymentCash: state.paymentCash,
    paymentCard: state.paymentCard,
    officeDirect: state.officeDirect,
    curierTrimis: state.curierTrimis,
    isVanzator: isVanzatorMode,
    vanzariPipelineId: state.vanzariPipelineId,
    vanzariStages: state.vanzariStages,
    lead: (leadProp as any) || null,
    isCash: state.isCash,
    isCard: state.isCard,
    subtotal: subtotal,
    totalDiscount: totalDiscount,
    urgentAmount: urgentAmount,
    total: total,
    setItems: state.setItems,
    setIsDirty: state.setIsDirty,
    setSvc: state.setSvc,
    setInstrumentForm: state.setInstrumentForm,
    setPart: state.setPart,
    setServiceSearchQuery: state.setServiceSearchQuery,
    setServiceSearchFocused: state.setServiceSearchFocused,
    setPartSearchQuery: state.setPartSearchQuery,
    setPartSearchFocused: state.setPartSearchFocused,
    setInstrumentSettings: state.setInstrumentSettings,
    setTrayImages: state.setTrayImages,
    setUploadingImage: state.setUploadingImage,
    setAllSheetsTotal: state.setAllSheetsTotal,
    setUrgentAllServices: state.setUrgentAllServices,
    setPipelines: state.setPipelines,
    setPipelinesWithIds: state.setPipelinesWithIds,
    setDepartments: state.setDepartments,
    setPipeLoading: state.setPipeLoading,
    setLoading: state.setLoading,
    setQuotes: state.setQuotes,
    setSelectedQuoteId: state.setSelectedQuoteId,
    setCreatingTray: state.setCreatingTray,
    setUpdatingTray: state.setUpdatingTray,
    setDeletingTray: state.setDeletingTray,
    setMovingInstrument: state.setMovingInstrument,
    setSendingTrays: state.setSendingTrays,
    setShowCreateTrayDialog: state.setShowCreateTrayDialog,
    setShowEditTrayDialog: state.setShowEditTrayDialog,
    setShowMoveInstrumentDialog: state.setShowMoveInstrumentDialog,
    setShowSendConfirmation: state.setShowSendConfirmation,
    setShowDeleteTrayConfirmation: state.setShowDeleteTrayConfirmation,
    setTrayToDelete: state.setTrayToDelete,
    setTraysAlreadyInDepartments: state.setTraysAlreadyInDepartments,
    setNewTrayNumber: state.setNewTrayNumber,
    setNewTraySize: state.setNewTraySize,
    setEditingTrayNumber: state.setEditingTrayNumber,
    setEditingTraySize: state.setEditingTraySize,
    setInstrumentToMove: state.setInstrumentToMove,
    setTargetTrayId: state.setTargetTrayId,
    setOfficeDirect: state.setOfficeDirect,
    setCurierTrimis: state.setCurierTrimis,
    newTrayNumber: state.newTrayNumber,
    newTraySize: state.newTraySize,
    editingTrayNumber: state.editingTrayNumber,
    editingTraySize: state.editingTraySize,
    trayToDelete: state.trayToDelete,
    instrumentToMove: state.instrumentToMove,
    targetTrayId: state.targetTrayId,
    recalcAllSheetsTotal: calculations.recalcAllSheetsTotal,
    populateInstrumentFormFromItems: formOperations.populateInstrumentFormFromItems,
    setSaving: state.setSaving,
  })
  
  // Încarcă items-urile când se selectează o tăviță
  useEffect(() => {
    if (!state.selectedQuoteId || state.loading) return
    
    let isMounted = true
    
    const loadItems = async () => {
      try {
        const loadedItems = await listQuoteItems(
          state.selectedQuoteId!,
          state.services,
          state.instruments,
          state.pipelinesWithIds
        )
        
        if (!isMounted) return
        
        // Actualizează items-urile doar dacă s-au schimbat
        state.setItems(prevItems => {
          if (prevItems.length === loadedItems.length && 
              prevItems.every((item, idx) => item.id === loadedItems[idx]?.id)) {
            return prevItems // Nu face update dacă items-urile sunt aceleași
          }
          return loadedItems
        })
        
        // IMPORTANT: Inițializează snapshot-ul când se încarcă items-urile pentru prima dată
        // Asta previne ștergerea items-urilor existente când se salvează
        // Folosim setTimeout pentru a ne asigura că business este disponibil
        setTimeout(() => {
          if (loadedItems.length > 0 && business?.initializeSnapshot) {
            business.initializeSnapshot(loadedItems)
          }
        }, 0)
      } catch (error) {
        console.error('Error loading items for tray:', error)
        if (isMounted) {
          state.setItems([])
        }
      }
    }
    
    loadItems()
    
    return () => {
      isMounted = false
    }
  }, [state.selectedQuoteId, state.services, state.instruments, state.pipelinesWithIds, state.loading, state.setItems])
  
  // Hook-uri pentru effects
  usePreturiEffects({
    leadId,
    fisaId,
    selectedQuoteId: state.selectedQuoteId,
    isVanzariPipeline: pipeline.isVanzariPipeline,
    isReceptiePipeline: pipeline.isReceptiePipeline,
    pipelinesWithIds: state.pipelinesWithIds,
    isCommercialPipeline: pipeline.isCommercialPipeline,
    setUrgentTagId: state.setUrgentTagId,
    setInstrumentForm: state.setInstrumentForm,
    setInstrumentSettings: state.setInstrumentSettings,
    setUrgentAllServices: state.setUrgentAllServices,
    setSubscriptionType: state.setSubscriptionType,
    setCurrentServiceFileStage: state.setCurrentServiceFileStage,
    setTrayDetails: state.setTrayDetails,
    setLoadingTrayDetails: state.setLoadingTrayDetails,
    setItems: state.setItems,
    setTrayImages: state.setTrayImages,
    setIsDirty: state.setIsDirty,
    setOfficeDirect: state.setOfficeDirect,
    setCurierTrimis: state.setCurierTrimis,
    svc: state.svc,
    instrumentForm: state.instrumentForm,
    instrumentSettings: state.instrumentSettings,
    urgentAllServices: state.urgentAllServices,
    items: state.items,
    urgentTagId: state.urgentTagId,
  })
  
  // Expose ref methods
  useImperativeHandle(ref, () => ({
    save: async () => {
      await business.saveAllAndLog()
    },
    getSelectedTrayId: () => state.selectedQuoteId,
    getQuotes: () => state.quotes,
    getSelectedQuoteId: () => state.selectedQuoteId,
    getIsVanzatorMode: () => isVanzatorMode,
    getSendingTrays: () => state.sendingTrays,
    getTraysAlreadyInDepartments: () => state.traysAlreadyInDepartments,
    getOnTraySelect: () => business.onTraySelect,
    getOnAddTray: () => business.onAddTray,
    getOnDeleteTray: () => business.onDeleteTray,
    getOnSendTrays: () => business.onSendTrays,
  }), [business.saveAllAndLog, state.selectedQuoteId, state.quotes, isVanzatorMode, state.sendingTrays, state.traysAlreadyInDepartments, business.onTraySelect, business.onAddTray, business.onDeleteTray, business.onSendTrays])
  
  return (
    <>
    <PreturiOrchestrator
      // Pipeline checks
      isVanzariPipeline={pipeline.isVanzariPipeline}
      isReceptiePipeline={pipeline.isReceptiePipeline}
      isDepartmentPipeline={isDepartmentPipeline}
      isVanzatorMode={isVanzatorMode}
      isCommercialPipeline={pipeline.isCommercialPipeline}
      
      // Data
      leadId={leadId}
      lead={leadProp || null}
      quotes={state.quotes}
      selectedQuoteId={state.selectedQuoteId}
      selectedQuote={state.selectedQuote}
      items={state.items}
      fisaId={fisaId}
      services={state.services}
      parts={state.parts}
      instruments={state.instruments}
      departments={state.departments}
      technicians={state.technicians}
      pipelinesWithIds={state.pipelinesWithIds}
      trayImages={state.trayImages}
      
      // State
      loading={state.loading}
      saving={state.saving}
      isDirty={state.isDirty}
      urgentAllServices={state.urgentAllServices}
      subscriptionType={state.subscriptionType}
      trayDetails={state.trayDetails}
      loadingTrayDetails={state.loadingTrayDetails}
      officeDirect={state.officeDirect}
      curierTrimis={state.curierTrimis}
      paymentCash={state.paymentCash}
      paymentCard={state.paymentCard}
      noDeal={state.noDeal}
      nuRaspunde={state.nuRaspunde}
      callBack={state.callBack}
      allSheetsTotal={state.allSheetsTotal}
      
      // Form states
      instrumentForm={state.instrumentForm}
      svc={state.svc}
      part={state.part}
      serviceSearchQuery={state.serviceSearchQuery}
      serviceSearchFocused={state.serviceSearchFocused}
      partSearchQuery={state.partSearchQuery}
      partSearchFocused={state.partSearchFocused}
      instrumentSettings={state.instrumentSettings}
      
      // UI states
      showCreateTrayDialog={state.showCreateTrayDialog}
      showEditTrayDialog={state.showEditTrayDialog}
      showMoveInstrumentDialog={state.showMoveInstrumentDialog}
      showDeleteTrayConfirmation={state.showDeleteTrayConfirmation}
      showSendConfirmation={state.showSendConfirmation}
      creatingTray={state.creatingTray}
      updatingTray={state.updatingTray}
      movingInstrument={state.movingInstrument}
      deletingTray={state.deletingTray}
      sendingTrays={state.sendingTrays}
      uploadingImage={state.uploadingImage}
      isImagesExpanded={state.isImagesExpanded}
      newTrayNumber={state.newTrayNumber}
      newTraySize={state.newTraySize}
      editingTrayNumber={state.editingTrayNumber}
      editingTraySize={state.editingTraySize}
      trayToDelete={state.trayToDelete}
      instrumentToMove={state.instrumentToMove}
      targetTrayId={state.targetTrayId}
      currentServiceFileStage={state.currentServiceFileStage}
      traysAlreadyInDepartments={state.traysAlreadyInDepartments}
      
      // Computed
      availableInstruments={availableInstruments}
      availableServices={availableServices}
      currentInstrumentId={currentInstrumentId}
      hasServicesOrInstrumentInSheet={hasServicesOrInstrumentInSheet}
      isTechnician={state.isTechnician}
      isReparatiiPipeline={pipeline.isReparatiiPipeline}
      canAddParts={pipeline.canAddParts}
      canEditUrgentAndSubscription={pipeline.canEditUrgentAndSubscription}
      canAddTrayImages={pipeline.canAddTrayImages}
      canViewTrayImages={pipeline.canViewTrayImages}
      undefinedTray={undefinedTray}
      instrumentsGrouped={instrumentsGrouped}
      distinctInstrumentsInTray={distinctInstrumentsInTray}
      
      // Totals
      subtotal={subtotal}
      totalDiscount={totalDiscount}
      total={total}
      
      // Callbacks
      onTraySelect={state.setSelectedQuoteId}
      onAddTray={business.onAddSheet}
      onDeleteTray={(trayId) => {
        state.setTrayToDelete(trayId)
        state.setShowDeleteTrayConfirmation(true)
      }}
      onEditTray={business.onEditTray}
      onSendTrays={() => state.setShowSendConfirmation(true)}
      onUrgentChange={async (checked: boolean) => business.handleUrgentChange(checked)}
      onSubscriptionChange={state.setSubscriptionType}
      onOfficeDirectChange={business.handleDeliveryCheckboxChange}
      onCurierTrimisChange={business.handleCurierTrimisChange}
      onPaymentCashChange={state.setPaymentCash}
      onPaymentCardChange={state.setPaymentCard}
      onNoDealChange={business.handleNoDealChange}
      onNuRaspundeChange={business.handleNuRaspundeChange}
      onCallBackChange={business.handleCallBackChange}
      onSave={business.saveAllAndLog}
      onPrint={() => setShowBillingDialog(true)}
      onInstrumentChange={business.onInstrumentChange}
      onQtyChange={business.onQtyChange}
      onServiceSearchChange={state.setServiceSearchQuery}
      onServiceSearchFocus={() => state.setServiceSearchFocused(true)}
      onServiceSearchBlur={() => setTimeout(() => state.setServiceSearchFocused(false), 200)}
      onServiceSelect={business.onServiceSelect}
      onServiceDoubleClick={business.onServiceDoubleClick}
      onSvcQtyChange={(qty) => state.setSvc(s => ({ ...s, qty }))}
      onSvcDiscountChange={(discount) => state.setSvc(s => ({ ...s, discount }))}
      onAddService={business.onAddService}
      onPartSearchChange={state.setPartSearchQuery}
      onPartSearchFocus={() => state.setPartSearchFocused(true)}
      onPartSearchBlur={() => setTimeout(() => state.setPartSearchFocused(false), 200)}
      onPartSelect={business.onPartSelect}
      onPartDoubleClick={business.onPartDoubleClick}
      onPartQtyChange={(qty) => state.setPart(p => ({ ...p, qty }))}
      onSerialNumberChange={(serialNumberId) => state.setPart(p => ({ ...p, serialNumberId }))}
      onAddPart={business.onAddPart}
      onUpdateItem={business.onUpdateItem}
      onDelete={business.onDelete}
      onDetailsChange={state.setTrayDetails}
      onImageUpload={business.handleTrayImageUpload}
      onImageDelete={business.handleTrayImageDelete}
      onDownloadAllImages={business.handleDownloadAllImages}
      onToggleImagesExpanded={() => state.setIsImagesExpanded(!state.isImagesExpanded)}
      onMoveInstrument={(instrumentGroup) => {
        // IMPORTANT: Curățăm obiectul pentru a evita referințe circulare
        // Extragem doar datele primitive necesare
        try {
          const cleanedGroup = {
            instrument: {
              id: typeof instrumentGroup.instrument?.id === 'string' ? instrumentGroup.instrument.id : String(instrumentGroup.instrument?.id || ''),
              name: typeof instrumentGroup.instrument?.name === 'string' ? instrumentGroup.instrument.name : String(instrumentGroup.instrument?.name || '')
            },
            items: Array.isArray(instrumentGroup.items) ? instrumentGroup.items.map((item: any) => {
              // Extragem doar proprietățile primitive din fiecare item
              const cleanedItem: any = {
                id: typeof item.id === 'string' ? item.id : String(item.id || ''),
                tray_id: typeof item.tray_id === 'string' ? item.tray_id : String(item.tray_id || ''),
                item_type: item.item_type || null,
                service_id: item.service_id || null,
                part_id: item.part_id || null,
                instrument_id: item.instrument_id || null,
                technician_id: item.technician_id || null,
                qty: typeof item.qty === 'number' ? item.qty : (typeof item.qty === 'string' ? parseFloat(item.qty) : 1),
                price: typeof item.price === 'number' ? item.price : (typeof item.price === 'string' ? parseFloat(item.price) : 0),
                name_snapshot: typeof item.name_snapshot === 'string' ? item.name_snapshot : '',
                urgent: Boolean(item.urgent),
              }
              
              // Curățăm brand_groups dacă există
              if (Array.isArray(item.brand_groups)) {
                cleanedItem.brand_groups = item.brand_groups.map((bg: any) => ({
                  id: typeof bg.id === 'string' ? bg.id : String(bg.id || ''),
                  brand: typeof bg.brand === 'string' ? bg.brand : String(bg.brand || ''),
                  serialNumbers: Array.isArray(bg.serialNumbers) 
                    ? bg.serialNumbers.map((sn: any) => typeof sn === 'string' ? sn : String(sn || ''))
                    : [],
                  garantie: Boolean(bg.garantie)
                }))
              } else {
                cleanedItem.brand_groups = []
              }
              
              return cleanedItem
            }) : []
          }
          
          state.setInstrumentToMove(cleanedGroup)
          state.setShowMoveInstrumentDialog(true)
        } catch (err) {
          console.error('Eroare la curățarea instrumentGroup:', err)
          toast.error('Eroare la pregătirea mutării instrumentului')
          // Dacă curățarea eșuează, încercăm să setăm doar structura minimă și să deschidem dialogul
          state.setInstrumentToMove({
            instrument: { 
              id: instrumentGroup.instrument?.id || '', 
              name: instrumentGroup.instrument?.name || 'Instrument' 
            },
            items: []
          })
          state.setShowMoveInstrumentDialog(true)
        }
      }}
      onAddBrandSerialGroup={business.onAddBrandSerialGroup}
      onRemoveBrandSerialGroup={business.onRemoveBrandSerialGroup}
      onUpdateBrand={business.onUpdateBrand}
      onUpdateBrandQty={business.onUpdateBrandQty}
      onUpdateSerialNumber={business.onUpdateSerialNumber}
      onAddSerialNumber={business.onAddSerialNumber}
      onRemoveSerialNumber={business.onRemoveSerialNumber}
      onUpdateSerialGarantie={business.onUpdateSerialGarantie}
      setIsDirty={state.setIsDirty}
      onCreateTray={business.handleCreateTray}
      onUpdateTray={business.handleUpdateTray}
      onMoveInstrumentConfirm={business.handleMoveInstrumentToTray}
      onNewTrayNumberChange={state.setNewTrayNumber}
      onNewTraySizeChange={state.setNewTraySize}
      onEditingTrayNumberChange={state.setEditingTrayNumber}
      onEditingTraySizeChange={state.setEditingTraySize}
      onTargetTrayChange={state.setTargetTrayId}
      onCancelCreateTray={() => {
        state.setShowCreateTrayDialog(false)
        state.setNewTrayNumber('')
        state.setNewTraySize('m')
      }}
      onCancelEditTray={() => {
        state.setShowEditTrayDialog(false)
        state.setEditingTrayNumber('')
        state.setEditingTraySize('m')
      }}
      onCancelMoveInstrument={() => {
        state.setShowMoveInstrumentDialog(false)
        state.setInstrumentToMove(null)
        state.setTargetTrayId('')
        state.setNewTrayNumber('')
        state.setNewTraySize('m')
      }}
      onConfirmDeleteTray={business.handleDeleteTray}
      onCancelDeleteTray={() => {
        state.setShowDeleteTrayConfirmation(false)
        state.setTrayToDelete(null)
      }}
      onConfirmSendTrays={business.sendAllTraysToPipeline}
      onCancelSendTrays={() => state.setShowSendConfirmation(false)}
      onRowClick={(item: LeadQuoteItem) => business.onRowClick(item.id)}
      onBrandToggle={business.onBrandToggle}
      
      // Quick actions for department view
      onMarkInProgress={() => {
        // TODO: Implementare logică pentru "În lucru"
        // console.log('Marcat ca În lucru')
      }}
      onMarkComplete={() => {
        // TODO: Implementare logică pentru "Finalizare"
        // console.log('Marcat ca Finalizat')
      }}
      onMarkWaiting={() => {
        // TODO: Implementare logică pentru "În așteptare"
        // console.log('Marcat ca În așteptare')
      }}
      onSaveToHistory={async () => {
        // Salvează în istoric folosind funcția existentă
        await business.saveAllAndLog()
      }}
    />

    {/* Dialog pentru facturare */}
    {lead && (
      <BillingDialog
        open={showBillingDialog}
        onOpenChange={setShowBillingDialog}
        lead={lead as Lead}
        quotes={state.quotes}
        allSheetsTotal={state.allSheetsTotal}
        urgentMarkupPct={URGENT_MARKUP_PCT}
        subscriptionType={state.subscriptionType}
        services={state.services}
        instruments={state.instruments}
        pipelinesWithIds={state.pipelinesWithIds}
        onSave={() => {
          // Refresh lead data after save if needed
        }}
      />
    )}
    </>
  )
})

export default PreturiMain

