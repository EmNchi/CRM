'use client'

// Utils
import { ClientDetails } from '../utils/ClientDetails'
import { PrintViewData } from '../utils/PrintViewData'

// Sections
import { TrayActions } from '../sections/TrayActions'
import { TrayImagesSection } from '../sections/TrayImagesSection'
import { TrayDetailsSection } from '../sections/TrayDetailsSection'
import { ItemsTable } from '../sections/ItemsTable'
import { TotalsSection } from '../sections/TotalsSection'

// Forms
import { AddInstrumentForm } from '../forms/AddInstrumentForm'
import { AddServiceForm } from '../forms/AddServiceForm'
import { AddPartForm } from '../forms/AddPartForm'

// Views
import { VanzariView } from '../views/VanzariView'
import { ReceptieView } from '../views/ReceptieView'

// Dialogs
import { CreateTrayDialog } from '../dialogs/CreateTrayDialog'
import { EditTrayDialog } from '../dialogs/EditTrayDialog'
import { MoveInstrumentDialog } from '../dialogs/MoveInstrumentDialog'
import { SendConfirmationDialog } from '../dialogs/SendConfirmationDialog'
import type { LeadQuote, LeadQuoteItem } from '@/lib/types/preturi'
import type { Lead } from '@/app/(crm)/dashboard/page'
import type { Service } from '@/lib/supabase/serviceOperations'
import type { Part } from '@/lib/supabase/partOperations'
import type { TrayImage } from '@/lib/supabase/imageOperations'
import { URGENT_MARKUP_PCT } from '@/lib/types/preturi'
import { createTrayItem } from '@/lib/supabase/serviceFileOperations'
import { toast } from 'sonner'

interface PreturiOrchestratorProps {
  // Pipeline checks
  isVanzariPipeline: boolean
  isReceptiePipeline: boolean
  isDepartmentPipeline: boolean
  isVanzatorMode: boolean
  isCommercialPipeline: boolean
  
  // Data
  leadId?: string | null
  lead: Lead | null
  quotes: LeadQuote[]
  selectedQuoteId: string | null
  selectedQuote: LeadQuote | null
  items: LeadQuoteItem[]
  fisaId?: string | null
  services: Service[]
  parts: Part[]
  instruments: Array<{ id: string; name: string; weight: number; department_id: string | null; pipeline?: string | null }>
  departments: Array<{ id: string; name: string }>
  technicians: Array<{ id: string; name: string }>
  pipelinesWithIds: Array<{ id: string; name: string }>
  trayImages: TrayImage[]
  
  // State
  loading: boolean
  saving: boolean
  isDirty: boolean
  urgentAllServices: boolean
  subscriptionType: 'services' | 'parts' | 'both' | ''
  trayDetails: string
  loadingTrayDetails: boolean
  officeDirect: boolean
  curierTrimis: boolean
  paymentCash: boolean
  paymentCard: boolean
  noDeal: boolean
  nuRaspunde: boolean
  callBack: boolean
  allSheetsTotal: number
  
  // Form states
  instrumentForm: any
  svc: any
  part: any
  serviceSearchQuery: string
  serviceSearchFocused: boolean
  partSearchQuery: string
  partSearchFocused: boolean
  instrumentSettings: Record<string, any>
  
  // UI states
  showCreateTrayDialog: boolean
  showEditTrayDialog: boolean
  showMoveInstrumentDialog: boolean
  showDeleteTrayConfirmation: boolean
  showSendConfirmation: boolean
  creatingTray: boolean
  updatingTray: boolean
  movingInstrument: boolean
  deletingTray: boolean
  sendingTrays: boolean
  uploadingImage: boolean
  isImagesExpanded: boolean
  newTrayNumber: string
  newTraySize: string
  editingTrayNumber: string
  editingTraySize: string
  trayToDelete: string | null
  instrumentToMove: { instrument: { id: string; name: string }; items: LeadQuoteItem[] } | null
  targetTrayId: string
  currentServiceFileStage: string | null
  traysAlreadyInDepartments: boolean
  
  // Computed
  availableInstruments: Array<{ id: string; name: string }>
  availableServices: Service[]
  currentInstrumentId: string | null
  hasServicesOrInstrumentInSheet: boolean
  isTechnician: boolean
  isReparatiiPipeline: boolean
  canAddParts: boolean
  canEditUrgentAndSubscription: boolean
  canAddTrayImages: boolean
  canViewTrayImages: boolean
  undefinedTray: LeadQuote | null
  instrumentsGrouped: Array<{ instrument: { id: string; name: string }; items: LeadQuoteItem[] }>
  distinctInstrumentsInTray: Array<{ id: string; name: string }>
  
  // Totals
  subtotal: number
  totalDiscount: number
  total: number
  
  // Callbacks
  onTraySelect: (trayId: string) => void
  onAddTray: () => void
  onDeleteTray: (trayId: string) => void
  onEditTray: () => void
  onSendTrays: () => void
  onUrgentChange: (checked: boolean) => Promise<void>
  onSubscriptionChange: (value: 'services' | 'parts' | 'both' | '') => void
  onOfficeDirectChange: (checked: boolean) => Promise<void>
  onCurierTrimisChange?: (checked: boolean) => Promise<void>
  onPaymentCashChange: (checked: boolean) => void
  onPaymentCardChange: (checked: boolean) => void
  onNoDealChange: (checked: boolean) => void
  onNuRaspundeChange: (checked: boolean) => void
  onCallBackChange: (checked: boolean) => void
  onSave: () => void
  onPrint?: () => void
  onInstrumentChange: (instrumentId: string) => void
  onQtyChange: (qty: string) => void
  onServiceSearchChange: (query: string) => void
  onServiceSearchFocus: () => void
  onServiceSearchBlur: () => void
  onServiceSelect: (serviceId: string, serviceName: string) => void
  onServiceDoubleClick: (serviceId: string, serviceName: string) => void
  onSvcQtyChange: (qty: string) => void
  onSvcDiscountChange: (discount: string) => void
  onAddService: () => void
  onPartSearchChange: (query: string) => void
  onPartSearchFocus: () => void
  onPartSearchBlur: () => void
  onPartSelect: (partId: string, partName: string) => void
  onPartDoubleClick: (partId: string, partName: string) => void
  onPartQtyChange: (qty: string) => void
  onSerialNumberChange: (serialNumberId: string) => void
  onAddPart: () => void
  onUpdateItem: (id: string, patch: Partial<LeadQuoteItem>) => void
  onDelete: (id: string) => void
  onDetailsChange: (details: string) => void
  onImageUpload: (file: File) => Promise<void>
  onImageDelete: (imageId: string) => Promise<void>
  onDownloadAllImages: () => Promise<void>
  onToggleImagesExpanded: () => void
  onMoveInstrument: (instrumentGroup: { instrument: { id: string; name: string }; items: LeadQuoteItem[] }) => void
  
  // Quick actions for department view
  onMarkInProgress?: () => void
  onMarkComplete?: () => void
  onMarkWaiting?: () => void
  onSaveToHistory?: () => void
  onAddBrandSerialGroup: () => void
  onRemoveBrandSerialGroup: (index: number) => void
  onUpdateBrand: (groupIndex: number, brand: string) => void
  onUpdateBrandQty: (groupIndex: number, qty: string) => void
  onUpdateSerialNumber: (groupIndex: number, serialIndex: number, serial: string) => void
  onAddSerialNumber?: (groupIndex: number) => void
  onRemoveSerialNumber?: (groupIndex: number, serialIndex: number) => void
  onUpdateSerialGarantie: (groupIndex: number, serialIndex: number, garantie: boolean) => void
  setIsDirty?: (dirty: boolean) => void
  onCreateTray: () => Promise<void>
  onUpdateTray: () => Promise<void>
  onMoveInstrumentConfirm: () => Promise<void>
  onNewTrayNumberChange: (value: string) => void
  onNewTraySizeChange: (value: string) => void
  onEditingTrayNumberChange: (value: string) => void
  onEditingTraySizeChange: (value: string) => void
  onTargetTrayChange: (value: string) => void
  onCancelCreateTray: () => void
  onCancelEditTray: () => void
  onCancelMoveInstrument: () => void
  onConfirmDeleteTray: () => Promise<void>
  onCancelDeleteTray: () => void
  onConfirmSendTrays: () => Promise<void>
  onCancelSendTrays: () => void
  onRowClick?: (item: LeadQuoteItem) => void
  onClearForm?: () => void
// -------------------------------------------------- COD PENTRU POPULARE CASETE -----------------------------------------------------
  onUndo?: () => void
  previousFormState?: any // Pentru a arăta dacă există stare de Undo
// -----------------------------------------------------------------------------------------------------------------------------------
  onRefreshItems?: () => void
  onBrandToggle?: (brandName: string, checked: boolean) => void
}

/**
 * Orchestrator principal care conectează componentele independente
 * SIMPLIFICAT: Afișează MEREU VanzariView pentru toți utilizatorii, indiferent de pipeline
 */
export function PreturiOrchestrator(props: PreturiOrchestratorProps) {
  const {
    isVanzariPipeline,
    isReceptiePipeline,
    isDepartmentPipeline,
    isVanzatorMode,
    isCommercialPipeline,
    lead,
    quotes,
    selectedQuoteId,
    selectedQuote,
    items,
    fisaId,
    undefinedTray,
    instrumentsGrouped,
    onClearForm,
    onRefreshItems,
  } = props

  // Normalizează array-urile pentru a evita erorile de tip "Cannot read properties of undefined"
  const quotesArray = Array.isArray(quotes) ? quotes : []

  // Dacă nu există tăvițe, afișează mesaj și buton pentru adăugare
  if (!selectedQuote || quotesArray.length === 0) {
    return (
      <div className="space-y-4 border rounded-xl bg-card shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-800/30 border-b">
          <div className="px-4 pt-4 pb-3">
            <h3 className="font-semibold text-base text-foreground">Fișa de serviciu</h3>
          </div>
        </div>
        <div className="p-6 text-center">
          <p className="text-muted-foreground mb-4">Nu există tăvițe în această fișă.</p>
          {!isDepartmentPipeline && !isVanzatorMode && (
            <button
              onClick={props.onAddTray}
              className="flex items-center gap-2 px-4 py-2 mx-auto rounded-lg text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-all duration-200 border-2 border-dashed border-primary/30 hover:border-primary/50 cursor-pointer"
              type="button"
            >
              <span>Adaugă tăviță</span>
            </button>
          )}
        </div>
        <CreateTrayDialog
          open={props.showCreateTrayDialog}
          onOpenChange={(open) => { if (!open) props.onCancelCreateTray() }}
          newTrayNumber={props.newTrayNumber}
          newTraySize={props.newTraySize}
          creatingTray={props.creatingTray}
          onNumberChange={props.onNewTrayNumberChange}
          onSizeChange={props.onNewTraySizeChange}
          onCreate={props.onCreateTray}
          onCancel={props.onCancelCreateTray}
        />
      </div>
    )
  }

  // View pentru TOȚI utilizatorii - dar diferențiat pe pipeline
  // - Recepție: ReceptieView (VanzariView + dialoguri Recepție)
  // - Altele: VanzariView
  
  if (isReceptiePipeline) {
    // ReceptieView pentru Recepție (extinde VanzariView + dialoguri)
    return (
      <ReceptieView
        {...props}  // Treci toți props-urile direct
        // Dialog props
        showCreateTrayDialog={props.showCreateTrayDialog}
        onCancelCreateTray={props.onCancelCreateTray}
        onCreateTray={props.onCreateTray}
        newTrayNumber={props.newTrayNumber}
        newTraySize={props.newTraySize}
        creatingTray={props.creatingTray}
        onNewTrayNumberChange={props.onNewTrayNumberChange}
        onNewTraySizeChange={props.onNewTraySizeChange}
        showMoveInstrumentDialog={props.showMoveInstrumentDialog}
        instrumentToMove={props.instrumentToMove}
        targetTrayId={props.targetTrayId}
        movingInstrument={props.movingInstrument}
        onCancelMoveInstrument={props.onCancelMoveInstrument}
        onMoveInstrumentConfirm={props.onMoveInstrumentConfirm}
        onTargetTrayChange={props.onTargetTrayChange}
        showSendConfirmation={props.showSendConfirmation}
        onConfirmSendTrays={props.onConfirmSendTrays}
        onCancelSendTrays={props.onCancelSendTrays}
      />
    )
  }
  
  // VanzariView pentru Vânzări și alte pipelines
  return (
    <>
      <VanzariView
        instrumentForm={props.instrumentForm}
        svc={props.svc}
        serviceSearchQuery={props.serviceSearchQuery}
        serviceSearchFocused={props.serviceSearchFocused}
        items={props.items}
        subscriptionType={props.subscriptionType}
        trayDetails={props.trayDetails}
        loadingTrayDetails={props.loadingTrayDetails}
        urgentAllServices={props.urgentAllServices}
        officeDirect={props.officeDirect}
        curierTrimis={props.curierTrimis}
        noDeal={props.noDeal}
        nuRaspunde={props.nuRaspunde}
        callBack={props.callBack}
        loading={props.loading}
        saving={props.saving}
        isDirty={props.isDirty}
        availableInstruments={props.availableInstruments}
        availableServices={props.availableServices}
        services={props.services}
        instruments={props.instruments}
        departments={props.departments}
        lead={lead}
        fisaId={fisaId}
        selectedQuoteId={selectedQuoteId}
        onInstrumentChange={props.onInstrumentChange}
        onQtyChange={props.onQtyChange}
        onServiceSearchChange={props.onServiceSearchChange}
        onServiceSearchFocus={props.onServiceSearchFocus}
        onServiceSearchBlur={props.onServiceSearchBlur}
        onServiceSelect={props.onServiceSelect}
        onServiceDoubleClick={props.onServiceDoubleClick}
        onSvcQtyChange={props.onSvcQtyChange}
        onSvcDiscountChange={props.onSvcDiscountChange}
        onAddService={props.onAddService}
        onUpdateItem={props.onUpdateItem}
        onDelete={props.onDelete}
        onDetailsChange={props.onDetailsChange}
        onOfficeDirectChange={props.onOfficeDirectChange}
        onCurierTrimisChange={props.onCurierTrimisChange}
        onUrgentChange={props.onUrgentChange}
        onSubscriptionChange={props.onSubscriptionChange}
        onNoDealChange={() => props.onNoDealChange(true)}
        onNuRaspundeChange={() => props.onNuRaspundeChange(true)}
        onCallBackChange={() => props.onCallBackChange(true)}
        onSave={props.onSave}
        onBrandToggle={props.onBrandToggle}
        onSerialNumberChange={props.onSerialNumberChange}
        onAddBrandSerialGroup={props.onAddBrandSerialGroup}
        onRemoveBrandSerialGroup={props.onRemoveBrandSerialGroup}
        onUpdateBrand={props.onUpdateBrand}
        onUpdateBrandQty={props.onUpdateBrandQty}
        onUpdateSerialNumber={props.onUpdateSerialNumber}
        onAddSerialNumber={props.onAddSerialNumber}
        onRemoveSerialNumber={props.onRemoveSerialNumber}
        onUpdateSerialGarantie={props.onUpdateSerialGarantie}
        setIsDirty={props.setIsDirty}
        currentInstrumentId={props.currentInstrumentId}
        hasServicesOrInstrumentInSheet={props.hasServicesOrInstrumentInSheet}
        isTechnician={props.isTechnician}
        isDepartmentPipeline={props.isDepartmentPipeline}
        subtotal={props.subtotal}
        totalDiscount={props.totalDiscount}
        total={props.total}
        instrumentSettings={props.instrumentSettings}
        canEditUrgentAndSubscription={props.canEditUrgentAndSubscription}
        quotes={quotesArray}
        onTraySelect={props.onTraySelect}
        onAddTray={props.onAddTray}
        onDeleteTray={props.onDeleteTray}
        sendingTrays={props.sendingTrays}
        traysAlreadyInDepartments={props.traysAlreadyInDepartments}
        onSendTrays={props.onSendTrays}
        instrumentsGrouped={props.instrumentsGrouped}
        onMoveInstrument={props.onMoveInstrument}
        trayImages={props.trayImages}
        uploadingImage={props.uploadingImage}
        isImagesExpanded={props.isImagesExpanded}
        canAddTrayImages={props.canAddTrayImages}
        canViewTrayImages={props.canViewTrayImages}
        onToggleImagesExpanded={props.onToggleImagesExpanded}
        onImageUpload={props.onImageUpload}
        onDownloadAllImages={props.onDownloadAllImages}
        onImageDelete={props.onImageDelete}
        isVanzariPipeline={props.isVanzariPipeline}
        isReceptiePipeline={props.isReceptiePipeline}
        onRowClick={props.onRowClick}
        onClearForm={props.onClearForm}
/* -------------------------------------------------- COD PENTRU POPULARE CASETE ----------------------------------------------------- */
        onUndo={props.onUndo}
        previousFormState={props.previousFormState}
/* ----------------------------------------------------------------------------------------------------------------------------------- */
        onAddInstrumentDirect={async (instrumentId, qty, brand) => {
          try {
            if (!selectedQuote) {
              toast.error('Nu există o tăviță selectată')
              return
            }

            // Găsește instrumentul pentru a obține department_id
            const instrument = props.instruments?.find(i => i.id === instrumentId)
            if (!instrument) {
              toast.error('Instrumentul selectat nu a fost găsit')
              return
            }

            // Construiește brandSerialGroups dacă brand e furnizat
            const brandSerialGroups = brand && brand.trim() 
              ? [{
                  brand: brand.trim(),
                  serialNumbers: [],
                  garantie: false
                }]
              : undefined

            // Creează item-ul instrument-only (fără serviciu)
            const { data: newItem, error } = await createTrayItem({
              tray_id: selectedQuote.id,
              instrument_id: instrumentId,
              department_id: instrument.department_id || undefined,
              pipeline: instrument.pipeline || undefined,
              qty: qty,
              brandSerialGroups: brandSerialGroups,
            })

            if (error) {
              toast.error('Eroare la adăugare instrument: ' + (error?.message || 'Necunoscut'))
              return
            }

            if (newItem) {
              console.log('[PreturiOrchestrator] Instrument creat:', newItem)
              toast.success(`Instrument adăugat cu succes (Cant: ${qty})`)
              props.setIsDirty?.(true)
              // Delay mic pentru a permite DB să se sincronizeze, apoi refresh items
              setTimeout(() => {
                console.log('[PreturiOrchestrator] Triggering refresh...')
                onRefreshItems?.()
              }, 500)
            }
          } catch (err: any) {
            toast.error('Eroare: ' + (err?.message || 'Necunoscut'))
          }
        }}
      />
      <CreateTrayDialog
        open={props.showCreateTrayDialog}
        onOpenChange={(open) => { if (!open) props.onCancelCreateTray() }}
        newTrayNumber={props.newTrayNumber}
        newTraySize={props.newTraySize}
        creatingTray={props.creatingTray}
        onNumberChange={props.onNewTrayNumberChange}
        onSizeChange={props.onNewTraySizeChange}
        onCreate={props.onCreateTray}
        onCancel={props.onCancelCreateTray}
      />
      <EditTrayDialog
        open={props.showEditTrayDialog}
        onOpenChange={(open) => { if (!open) props.onCancelEditTray() }}
        editingTrayNumber={props.editingTrayNumber}
        editingTraySize={props.editingTraySize}
        updatingTray={props.updatingTray}
        onNumberChange={props.onEditingTrayNumberChange}
        onSizeChange={props.onEditingTraySizeChange}
        onUpdate={props.onUpdateTray}
        onCancel={props.onCancelEditTray}
      />
      <MoveInstrumentDialog
        open={props.showMoveInstrumentDialog}
        onOpenChange={(open) => { if (!open) props.onCancelMoveInstrument() }}
        instrumentToMove={props.instrumentToMove}
        quotes={quotesArray}
        selectedQuoteId={selectedQuoteId}
        targetTrayId={props.targetTrayId}
        newTrayNumber={props.newTrayNumber}
        newTraySize={props.newTraySize}
        movingInstrument={props.movingInstrument}
        onTargetTrayChange={props.onTargetTrayChange}
        onNewTrayNumberChange={props.onNewTrayNumberChange}
        onNewTraySizeChange={props.onNewTraySizeChange}
        onMove={props.onMoveInstrumentConfirm}
        onCancel={props.onCancelMoveInstrument}
      />
      <SendConfirmationDialog
        open={props.showSendConfirmation}
        onOpenChange={(open) => { if (!open) props.onCancelSendTrays() }}
        traysCount={quotesArray.length}
        sending={props.sendingTrays}
        onConfirm={props.onConfirmSendTrays}
        onCancel={props.onCancelSendTrays}
      />
    </>
  )
}
