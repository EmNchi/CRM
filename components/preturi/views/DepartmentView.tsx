'use client'

import { Card, CardContent } from '@/components/ui/card'
import { AddInstrumentForm } from '../forms/AddInstrumentForm'
import { AddServiceForm } from '../forms/AddServiceForm'
import { AddPartForm } from '../forms/AddPartForm'
import { ItemsTable } from '../sections/ItemsTable'
import { TotalsSection } from '../sections/TotalsSection'
import { TrayImagesSection } from '../sections/TrayImagesSection'
import { TrayTabs } from '../sections/TrayTabs'
import { TrayActions } from '../sections/TrayActions'
import { TrayDetailsSection } from '../sections/TrayDetailsSection'
import type { LeadQuoteItem, LeadQuote } from '@/lib/types/preturi'
import type { Service } from '@/lib/supabase/serviceOperations'
import type { Part } from '@/lib/supabase/partOperations'
import type { Technician } from '@/lib/types/preturi'
import type { TrayImage } from '@/lib/supabase/imageOperations'

interface DepartmentViewProps {
  // State
  instrumentForm: { 
    instrument: string
    qty: string
    brandSerialGroups?: Array<{ brand: string; serialNumbers: Array<{ serial: string; garantie: boolean }>; qty: string }>
    garantie?: boolean
  }
  instrumentSettings?: Record<string, any>
  svc: { id: string; qty: string; discount: string; instrumentId: string }
  part: { id: string; qty: string; serialNumberId: string }
  serviceSearchQuery: string
  serviceSearchFocused: boolean
  partSearchQuery: string
  partSearchFocused: boolean
  items: LeadQuoteItem[]
  subscriptionType: 'services' | 'parts' | 'both' | ''
  
  // Data
  availableInstruments: Array<{ id: string; name: string; department_id?: string | null }>
  availableServices: Service[]
  services: Service[]
  parts: Part[]
  instruments: Array<{ id: string; name: string; weight: number; department_id: string | null; pipeline?: string | null }>
  departments?: Array<{ id: string; name: string }>
  technicians: Technician[]
  pipelinesWithIds: Array<{ id: string; name: string }>
  
  // Callbacks
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
  onRowClick?: (item: LeadQuoteItem) => void
  
  // Callbacks pentru brandSerialGroups (opționale)
  onAddBrandSerialGroup?: () => void
  onRemoveBrandSerialGroup?: (groupIndex: number) => void
  onUpdateBrand?: (groupIndex: number, value: string) => void
  onUpdateBrandQty?: (groupIndex: number, qty: string) => void
  onUpdateSerialNumber?: (groupIndex: number, serialIndex: number, value: string) => void
  onAddSerialNumber?: (groupIndex: number) => void
  onRemoveSerialNumber?: (groupIndex: number, serialIndex: number) => void
  onUpdateSerialGarantie?: (groupIndex: number, serialIndex: number, garantie: boolean) => void
  setIsDirty?: (dirty: boolean) => void
  
  // Pipeline flags
  currentInstrumentId: string | null
  hasServicesOrInstrumentInSheet: boolean
  isTechnician: boolean
  isDepartmentPipeline: boolean
  isReparatiiPipeline: boolean
  canAddParts: boolean
  canEditUrgentAndSubscription: boolean
  
  // Tray images
  selectedQuoteId?: string | null
  trayImages?: TrayImage[]
  uploadingImage?: boolean
  isImagesExpanded?: boolean
  canAddTrayImages?: boolean
  canViewTrayImages?: boolean
  onToggleImagesExpanded?: () => void
  onImageUpload?: (event: React.ChangeEvent<HTMLInputElement>) => void
  onDownloadAllImages?: () => void
  onImageDelete?: (imageId: string, filePath: string) => void
  
  // Save
  onSaveToHistory?: () => void
  saving?: boolean
  
  // Tray tabs
  quotes?: LeadQuote[]
  onTraySelect?: (trayId: string) => void
  onAddTray?: () => void
  onDeleteTray?: (trayId: string) => void
  sendingTrays?: boolean
  traysAlreadyInDepartments?: boolean
  onSendTrays?: () => void
  
  // Tray actions
  urgentAllServices?: boolean
  paymentCash?: boolean
  paymentCard?: boolean
  officeDirect?: boolean
  curierTrimis?: boolean
  loading?: boolean
  isDirty?: boolean
  fisaId?: string | null
  currentServiceFileStage?: string | null
  onUrgentChange?: (checked: boolean) => Promise<void>
  onSubscriptionChange?: (value: 'services' | 'parts' | 'both' | '') => void
  onOfficeDirectChange?: (checked: boolean) => Promise<void>
  onCurierTrimisChange?: (checked: boolean) => Promise<void>
  onPaymentCashChange?: (checked: boolean) => void
  onPaymentCardChange?: (checked: boolean) => void
  onSave?: () => void
  
  // Tray details
  trayDetails?: string
  loadingTrayDetails?: boolean
  isCommercialPipeline?: boolean
  onDetailsChange?: (details: string) => void
}

export function DepartmentView({
  instrumentForm,
  instrumentSettings = {},
  svc,
  part,
  serviceSearchQuery,
  serviceSearchFocused,
  partSearchQuery,
  partSearchFocused,
  items,
  subscriptionType,
  availableInstruments,
  availableServices,
  services,
  parts,
  instruments,
  departments = [],
  technicians,
  pipelinesWithIds,
  onInstrumentChange,
  onQtyChange,
  onServiceSearchChange,
  onServiceSearchFocus,
  onServiceSearchBlur,
  onServiceSelect,
  onServiceDoubleClick,
  onSvcQtyChange,
  onSvcDiscountChange,
  onAddService,
  onPartSearchChange,
  onPartSearchFocus,
  onPartSearchBlur,
  onPartSelect,
  onPartDoubleClick,
  onPartQtyChange,
  onSerialNumberChange,
  onAddPart,
  onUpdateItem,
  onDelete,
  onRowClick,
  onAddBrandSerialGroup,
  onRemoveBrandSerialGroup,
  onUpdateBrand,
  onUpdateBrandQty,
  onUpdateSerialNumber,
  onAddSerialNumber,
  onRemoveSerialNumber,
  onUpdateSerialGarantie,
  setIsDirty,
  currentInstrumentId,
  hasServicesOrInstrumentInSheet,
  isTechnician,
  isDepartmentPipeline,
  isReparatiiPipeline,
  canAddParts,
  canEditUrgentAndSubscription,
  selectedQuoteId,
  trayImages = [],
  uploadingImage = false,
  isImagesExpanded = false,
  canAddTrayImages = false,
  canViewTrayImages = true,
  onToggleImagesExpanded,
  onImageUpload,
  onDownloadAllImages,
  onImageDelete,
  onSaveToHistory,
  saving = false,
  // Tray tabs
  quotes = [],
  onTraySelect,
  onAddTray,
  onDeleteTray,
  sendingTrays = false,
  traysAlreadyInDepartments = false,
  onSendTrays,
  // Tray actions
  urgentAllServices = false,
  paymentCash = false,
  paymentCard = false,
  officeDirect = false,
  curierTrimis = false,
  loading = false,
  isDirty = false,
  fisaId,
  currentServiceFileStage,
  onUrgentChange,
  onSubscriptionChange,
  onOfficeDirectChange,
  onCurierTrimisChange,
  onPaymentCashChange,
  onPaymentCardChange,
  onSave,
  // Tray details
  trayDetails = '',
  loadingTrayDetails = false,
  isCommercialPipeline = false,
  onDetailsChange,
}: DepartmentViewProps) {
  return (
    <div className="space-y-4">
      {/* TrayTabs - butoanele pentru tăviță */}
      {quotes.length > 0 && (
        <TrayTabs
          quotes={quotes}
          selectedQuoteId={selectedQuoteId ?? null}
          isVanzariPipeline={false}
          isReceptiePipeline={false}
          isDepartmentPipeline={isDepartmentPipeline}
          isVanzatorMode={false}
          sendingTrays={sendingTrays}
          traysAlreadyInDepartments={traysAlreadyInDepartments}
          onTraySelect={onTraySelect || (() => {})}
          onAddTray={onAddTray || (() => {})}
          onDeleteTray={onDeleteTray || (() => {})}
          onSendTrays={onSendTrays || (() => {})}
        />
      )}
      
      {/* Indicator de urgentare și abonament - vizibil (read-only) */}
      <div className="mx-1 sm:mx-2 px-3 py-2 rounded-lg bg-muted/30 border">
        <div className="flex flex-wrap items-center gap-4">
          {/* Urgent toggle - read-only */}
          <div className="flex items-center gap-2.5 opacity-70">
            <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 cursor-not-allowed ${urgentAllServices ? 'bg-red-500' : 'bg-muted-foreground/20'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${urgentAllServices ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className={`text-sm font-medium ${urgentAllServices ? 'text-red-600' : 'text-muted-foreground'}`}>
              Urgent
            </span>
            {urgentAllServices && (
              <span className="text-[10px] font-medium text-red-500 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded animate-pulse">
                +30%
              </span>
            )}
          </div>
          
          {/* Divider */}
          <div className="h-5 w-px bg-border/60" />
          
          {/* Abonament - read-only */}
          <div className="flex items-center gap-1.5 opacity-70">
            <span className="text-sm text-muted-foreground">Abonament:</span>
            <span className="text-sm font-medium">
              {subscriptionType === 'services' ? 'Servicii (-10%)' : 
               subscriptionType === 'parts' ? 'Piese (-5%)' : 
               subscriptionType === 'both' ? 'Servicii + Piese' : 
               'Fără abonament'}
            </span>
          </div>
        </div>
      </div>
      
      
      {/* TrayActions - butoane salvare */}
      <div className="mx-1 sm:mx-2 flex justify-end">
        <button
          onClick={onSaveToHistory}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Se salvează...' : '💾 Salvează în istoric'}
        </button>
      </div>
      
      {/* Fișa de serviciu - header cu imagini și salvare */}
      <Card className="">
        <CardContent className="pt-0 space-y-4">
          {/* Galerie Imagini */}
          {canViewTrayImages && selectedQuoteId && (
            <TrayImagesSection
              trayImages={trayImages}
              uploadingImage={uploadingImage}
              isImagesExpanded={isImagesExpanded}
              canAddTrayImages={canAddTrayImages}
              canViewTrayImages={canViewTrayImages}
              selectedQuoteId={selectedQuoteId}
              onToggleExpanded={onToggleImagesExpanded || (() => {})}
              onImageUpload={onImageUpload || (() => {})}
              onDownloadAll={onDownloadAllImages || (() => {})}
              onImageDelete={onImageDelete || (() => {})}
            />
          )}
          
        </CardContent>
      </Card>

      {/* Add Instrument - afișat pentru toți utilizatorii din departament */}
      <AddInstrumentForm
          instrumentForm={instrumentForm}
          availableInstruments={availableInstruments}
          instruments={instruments.map(i => ({ id: i.id, name: i.name, department_id: i.department_id ?? null, pipeline: i.pipeline ?? null }))}
          departments={departments}
          instrumentSettings={instrumentSettings}
          hasServicesOrInstrumentInSheet={hasServicesOrInstrumentInSheet}
          isVanzariPipeline={false}
          isDepartmentPipeline={isDepartmentPipeline}
          isTechnician={isTechnician}
          onInstrumentChange={onInstrumentChange}
          onQtyChange={onQtyChange}
          onAddBrandSerialGroup={onAddBrandSerialGroup}
          onRemoveBrandSerialGroup={onRemoveBrandSerialGroup}
          onUpdateBrand={onUpdateBrand}
          onUpdateBrandQty={onUpdateBrandQty}
          onUpdateSerialNumber={onUpdateSerialNumber}
          onAddSerialNumber={onAddSerialNumber}
          onRemoveSerialNumber={onRemoveSerialNumber}
          onUpdateSerialGarantie={onUpdateSerialGarantie}
          setIsDirty={setIsDirty}
        />
      
      {/* Add Service */}
      <AddServiceForm
        svc={svc}
        serviceSearchQuery={serviceSearchQuery}
        serviceSearchFocused={serviceSearchFocused}
        currentInstrumentId={currentInstrumentId}
        availableServices={availableServices}
        onServiceSearchChange={onServiceSearchChange}
        onServiceSearchFocus={onServiceSearchFocus}
        onServiceSearchBlur={onServiceSearchBlur}
        onServiceSelect={onServiceSelect}
        onServiceDoubleClick={onServiceDoubleClick}
        onQtyChange={onSvcQtyChange}
        onDiscountChange={onSvcDiscountChange}
        onAddService={onAddService}
      />
      
      {/* Add Part - only for Reparatii */}
      {isReparatiiPipeline && canAddParts && (
        <AddPartForm
          part={part}
          partSearchQuery={partSearchQuery}
          partSearchFocused={partSearchFocused}
          parts={parts}
          items={items}
          instrumentForm={{ ...instrumentForm, brandSerialGroups: instrumentForm.brandSerialGroups || [] }}
          canAddParts={canAddParts}
          onPartSearchChange={onPartSearchChange}
          onPartSearchFocus={onPartSearchFocus}
          onPartSearchBlur={onPartSearchBlur}
          onPartSelect={onPartSelect}
          onPartDoubleClick={onPartDoubleClick}
          onQtyChange={onPartQtyChange}
          onSerialNumberChange={onSerialNumberChange}
          onAddPart={onAddPart}
        />
      )}
      
      {/* Items Table */}
      <ItemsTable
        items={items}
        services={services}
        instruments={instruments}
        technicians={technicians}
        pipelinesWithIds={pipelinesWithIds}
        isReceptiePipeline={false}
        canEditUrgentAndSubscription={canEditUrgentAndSubscription}
        onUpdateItem={onUpdateItem}
        onDelete={onDelete}
        onRowClick={onRowClick}
      />
      
      {/* Totals */}
      <TotalsSection
        items={items}
        subscriptionType={subscriptionType}
        services={services}
        instruments={instruments}
      />
      
      
    </div>
  )
}

