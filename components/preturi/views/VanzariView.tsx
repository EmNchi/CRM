'use client'

import { useEffect } from 'react'
import { AddInstrumentForm } from '../forms/AddInstrumentForm'
import { AddServiceForm } from '../forms/AddServiceForm'
import { ItemsTable } from '../sections/ItemsTable'
import { TotalsSection } from '../sections/TotalsSection'
import { TrayDetailsSection } from '../sections/TrayDetailsSection'
import { TrayTabs } from '../sections/TrayTabs'
import { TrayImagesSection } from '../sections/TrayImagesSection'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Trash2, Move } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { URGENT_MARKUP_PCT } from '@/lib/types/preturi'
import type { LeadQuoteItem, LeadQuote } from '@/lib/types/preturi'
import type { Service } from '@/lib/supabase/serviceOperations'
import type { Lead } from '@/app/(crm)/dashboard/page'

export interface VanzariViewProps {
  // State
  instrumentForm: { 
    instrument: string
    qty: string
    brandSerialGroups?: Array<{ brand: string; serialNumbers: Array<{ serial: string; garantie: boolean }> | string[]; qty?: string }>
  }
  svc: { 
    id: string
    qty: string
    discount: string
    instrumentId: string
    selectedBrands?: string[]
    serialNumberId?: string
  }
  serviceSearchQuery: string
  serviceSearchFocused: boolean
  items: LeadQuoteItem[]
  subscriptionType: 'services' | 'parts' | 'both' | ''
  trayDetails: string
  loadingTrayDetails: boolean
  urgentAllServices: boolean
  officeDirect: boolean
  curierTrimis: boolean
  noDeal: boolean
  nuRaspunde: boolean
  callBack: boolean
  loading: boolean
  saving: boolean
  isDirty: boolean
  
  // Data
  availableInstruments: Array<{ id: string; name: string }>
  availableServices: Service[]
  services: Service[]
  instruments: Array<{ id: string; name: string; weight: number; department_id?: string | null; pipeline?: string | null }>
  departments?: Array<{ id: string; name: string }>
  lead: Lead | null
  fisaId?: string | null
  selectedQuoteId: string | null
  
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
  onUpdateItem: (id: string, patch: Partial<LeadQuoteItem>) => void
  onDelete: (id: string) => void
  onDetailsChange: (details: string) => void
  onOfficeDirectChange: (isOfficeDirect: boolean) => Promise<void>
  onCurierTrimisChange?: (checked: boolean) => Promise<void>
  onUrgentChange: (checked: boolean) => Promise<void>
  onSubscriptionChange: (value: 'services' | 'parts' | 'both' | '') => void
  onNoDealChange: (checked: boolean) => void
  onNuRaspundeChange: (checked: boolean) => void
  onCallBackChange: (checked: boolean) => void
  onSave: () => void
  // Callbacks pentru brand selection (opționale)
  onBrandToggle?: (brandName: string, checked: boolean) => void
  onSerialNumberChange?: (serialNumberId: string) => void
  // Callbacks pentru brand/serial groups (opționale)
  onAddBrandSerialGroup?: () => void
  onRemoveBrandSerialGroup?: (groupIndex: number) => void
  onUpdateBrand?: (groupIndex: number, value: string) => void
  onUpdateBrandQty?: (groupIndex: number, qty: string) => void
  onUpdateSerialNumber?: (groupIndex: number, serialIndex: number, value: string) => void
  onAddSerialNumber?: (groupIndex: number) => void
  onRemoveSerialNumber?: (groupIndex: number, serialIndex: number) => void
  onUpdateSerialGarantie?: (groupIndex: number, serialIndex: number, garantie: boolean) => void
  setIsDirty?: (dirty: boolean) => void
  
  // Flags pentru permisiuni
  isVanzariPipeline?: boolean
  isReceptiePipeline?: boolean
  
  // Callbacks pentru adăugare instrument direct
  onAddInstrumentDirect?: (instrumentId: string, qty: number, brand?: string) => void
  
  // Callback pentru click pe rând (editare)
  onRowClick?: (item: LeadQuoteItem) => void
  
  // Callback pentru resetare formulare (undo)
  onClearForm?: () => void
// -------------------------------------------------- COD PENTRU POPULARE CASETE -----------------------------------------------------
  onUndo?: () => void
  previousFormState?: any
// -----------------------------------------------------------------------------------------------------------------------------------
  
  // Computed
  currentInstrumentId: string | null
  hasServicesOrInstrumentInSheet: boolean
  isTechnician: boolean
  isDepartmentPipeline: boolean
  subtotal: number
  totalDiscount: number
  total: number
  instrumentSettings: Record<string, any>
  canEditUrgentAndSubscription?: boolean
  
  // Tray management
  quotes?: LeadQuote[]
  onTraySelect?: (trayId: string) => void
  onAddTray?: () => void
  onDeleteTray?: (trayId: string) => void
  sendingTrays?: boolean
  traysAlreadyInDepartments?: boolean
  onSendTrays?: () => void
  
  // Instrument distribution
  instrumentsGrouped?: Array<{ instrument: { id: string; name: string }; items: LeadQuoteItem[] }>
  onMoveInstrument?: (instrumentGroup: { instrument: { id: string; name: string }; items: LeadQuoteItem[] }) => void
  
  // Tray images
  trayImages?: Array<{ id: string; file_path: string; filename?: string }>
  uploadingImage?: boolean
  isImagesExpanded?: boolean
  canAddTrayImages?: boolean
  canViewTrayImages?: boolean
  onToggleImagesExpanded?: () => void
  onImageUpload?: (file: File) => void
  onDownloadAllImages?: () => void
  onImageDelete?: (imageId: string, filePath: string) => void
}

export function VanzariView({
  instrumentForm,
  svc,
  serviceSearchQuery,
  serviceSearchFocused,
  items,
  subscriptionType,
  trayDetails,
  loadingTrayDetails,
  urgentAllServices,
  officeDirect,
  curierTrimis,
  noDeal,
  nuRaspunde,
  callBack,
  loading,
  saving,
  isDirty,
  availableInstruments,
  availableServices,
  services,
  instruments,
  departments = [],
  lead,
  fisaId,
  selectedQuoteId,
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
  onUpdateItem,
  onDelete,
  onDetailsChange,
  onOfficeDirectChange,
  onCurierTrimisChange,
  onUrgentChange,
  onSubscriptionChange,
  onNoDealChange,
  onNuRaspundeChange,
  onCallBackChange,
  onSave,
  onBrandToggle,
  onSerialNumberChange,
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
  subtotal,
  totalDiscount,
  total,
  instrumentSettings,
  canEditUrgentAndSubscription = true,
  quotes = [],
  onTraySelect,
  onAddTray,
  onDeleteTray,
  sendingTrays = false,
  traysAlreadyInDepartments = false,
  onSendTrays,
  instrumentsGrouped = [],
  onMoveInstrument,
  trayImages = [],
  uploadingImage = false,
  isImagesExpanded = false,
  canAddTrayImages = false,
  canViewTrayImages = false,
  onToggleImagesExpanded,
  onImageUpload,
  onDownloadAllImages,
  onImageDelete,
  isVanzariPipeline = false,
  isReceptiePipeline = false,
  onAddInstrumentDirect,
  onRowClick,
  onClearForm,
// -------------------------------------------------- COD PENTRU POPULARE CASETE -----------------------------------------------------
  onUndo,
  previousFormState,
// -----------------------------------------------------------------------------------------------------------------------------------
}: VanzariViewProps) {
  // VERIFICARE: Fișa este LOCKED dacă a fost deja trimisă (office_direct sau curier_trimis este true)
  // Odată trimisă, fișa devine read-only și nu mai poate fi modificată
  // EXCEPȚIE: Pentru Recepție și Department, fișa NU se blochează niciodată
  const isServiceFileLocked = (officeDirect || curierTrimis) && !isReceptiePipeline && !isDepartmentPipeline
  
  // Validări pentru checkbox-urile Office Direct și Curier Trimis
  // Permitem selecția chiar și fără items, dar salvăm doar când există items
  const canSelectDelivery = !!(fisaId && selectedQuoteId) && !isServiceFileLocked
  const canSaveDelivery = !!(fisaId && selectedQuoteId && items.length > 0)
  
  // Debug logging pentru a identifica de ce checkbox-urile sunt disabled
  useEffect(() => {
    // console.log('[VanzariView] Delivery checkbox debug:', {
    //   canSelectDelivery,
    //   fisaId: fisaId || 'LIPSEȘTE',
    //   selectedQuoteId: selectedQuoteId || 'LIPSEȘTE',
    //   itemsLength: items.length,
    //   officeDirect,
    //   curierTrimis,
    //   loading,
    //   saving,
    //   officeDirectDisabled: !canSelectDelivery || curierTrimis || loading || saving,
    //   curierTrimisDisabled: !canSelectDelivery || officeDirect || loading || saving,
    //   reasons: {
    //     noFisaId: !fisaId,
    //     noSelectedQuoteId: !selectedQuoteId,
    //     noItems: items.length === 0,
    //     otherChecked: officeDirect || curierTrimis,
    //     isLoading: loading,
    //     isSaving: saving
    //   },
    //   canSaveDelivery
    // })
  }, [canSelectDelivery, fisaId, selectedQuoteId, items.length, officeDirect, curierTrimis, loading, saving])

  return (
    <div className="space-y-4 border rounded-xl bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`border-b px-4 py-3 ${isServiceFileLocked 
        ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20' 
        : 'bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-800/30'}`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            {isServiceFileLocked ? (
              <>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-base text-amber-700 dark:text-amber-400">Fișă Finalizată</h3>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                    {officeDirect ? 'Office Direct' : 'Curier Trimis'}
                  </span>
                </div>
                <p className="text-sm text-amber-600/80 dark:text-amber-400/70 mt-0.5">
                  Această fișă a fost trimisă și nu mai poate fi modificată. Pentru date noi, creează o fișă nouă.
                </p>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-base text-foreground">Comandă Nouă</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Adaugă instrumente și servicii pentru această comandă</p>
              </>
            )}
          </div>
          {!isServiceFileLocked && (
            <Button 
              size="sm"
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSave()
              }} 
              disabled={loading || saving || !isDirty}
              className="shadow-sm flex-shrink-0"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Se salvează…
                </>
              ) : (
                "Salvează în Istoric"
              )}
            </Button>
          )}
        </div>
      </div>

      {/* TrayTabs - Navigare între tăvițe, Adaugă tăviță, Trimite */}
      {quotes && quotes.length > 0 && (
        <div className="px-4">
          <TrayTabs
            quotes={quotes}
            selectedQuoteId={selectedQuoteId}
            isVanzariPipeline={isVanzariPipeline ?? false}
            isReceptiePipeline={isReceptiePipeline ?? false}
            isDepartmentPipeline={isDepartmentPipeline}
            isVanzatorMode={false}
            sendingTrays={sendingTrays ?? false}
            traysAlreadyInDepartments={traysAlreadyInDepartments ?? false}
            officeDirect={officeDirect}
            curierTrimis={curierTrimis}
            onTraySelect={onTraySelect || (() => {})}
            onAddTray={onAddTray || (() => {})}
            onDeleteTray={onDeleteTray || (() => {})}
            onSendTrays={onSendTrays || (() => {})}
          />
        </div>
      )}

      {/* Urgent și Abonament - AFIȘAT PENTRU TOȚI utilizatorii, indiferent de rol */}
      {(true) && (
        <div className={`mx-4 px-3 py-2 rounded-lg border ${isServiceFileLocked ? 'bg-muted/50 opacity-75' : 'bg-muted/30'}`}>
          <div className="flex flex-wrap items-center gap-4">
            <label className={`flex items-center gap-2.5 group ${isServiceFileLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${urgentAllServices ? 'bg-red-500' : 'bg-muted-foreground/20'} ${isServiceFileLocked ? 'opacity-60' : ''}`}>
                <Checkbox
                  id="urgent-all-vanzator"
                  checked={urgentAllServices}
                  onCheckedChange={isServiceFileLocked ? undefined : onUrgentChange}
                  disabled={isServiceFileLocked}
                  className="sr-only"
                />
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${urgentAllServices ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className={`text-sm font-medium transition-colors ${urgentAllServices ? 'text-red-600' : 'text-muted-foreground group-hover:text-foreground'}`}>
                Urgent
              </span>
              {urgentAllServices && (
                <span className="text-[10px] font-medium text-red-500 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded">
                  +30%
                </span>
              )}
            </label>
            
            <div className="h-5 w-px bg-border/60" />
            
            <div className="flex items-center gap-2">
              <Label htmlFor="subscription-vanzator" className="text-sm font-medium text-muted-foreground">Abonament</Label>
              <select
                id="subscription-vanzator"
                className={`h-8 text-sm rounded-lg border border-border/60 px-3 bg-white dark:bg-background transition-colors ${isServiceFileLocked ? 'cursor-not-allowed opacity-60' : 'hover:border-primary/40 cursor-pointer'}`}
                value={subscriptionType}
                onChange={e => !isServiceFileLocked && onSubscriptionChange(e.target.value as 'services' | 'parts' | 'both' | '')}
                disabled={isServiceFileLocked}
              >
                <option value="">Fără abonament</option>
                <option value="services">Servicii</option>
                <option value="parts">Piese</option>
                <option value="both">Ambele</option>
              </select>
            </div>
            
            {/* Checkbox-uri livrare - afișate ca read-only când fișa este locked */}
            <label 
              className={`flex items-center gap-2 group select-none ${
                isServiceFileLocked ? 'cursor-not-allowed' : (!canSelectDelivery || loading || saving ? 'cursor-not-allowed' : 'cursor-pointer')
              }`}
            >
              <Checkbox
                id="office-direct-vanzator"
                checked={officeDirect}
                disabled={isServiceFileLocked || !canSelectDelivery || loading || saving}
                onCheckedChange={async (c: any) => {
                  if (isServiceFileLocked || !canSelectDelivery) {
                    return
                  }
                  await onOfficeDirectChange(!!c)
                }}
                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <span className={`text-sm font-medium transition-colors ${officeDirect ? 'text-blue-600' : 'text-muted-foreground group-hover:text-foreground'}`}>
                Office direct
              </span>
            </label>
            <label 
              className={`flex items-center gap-2 group select-none ${
                isServiceFileLocked ? 'cursor-not-allowed' : (!canSelectDelivery || loading || saving ? 'cursor-not-allowed' : 'cursor-pointer')
              }`}
            >
              <Checkbox
                id="curier-trimis-vanzator"
                checked={curierTrimis}
                disabled={isServiceFileLocked || !canSelectDelivery || loading || saving}
                onCheckedChange={async (c: any) => {
                  if (isServiceFileLocked || !canSelectDelivery) {
                    return
                  }
                  if (onCurierTrimisChange) await onCurierTrimisChange(!!c)
                }}
                className="data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
              />
              <span className={`text-sm font-medium transition-colors ${curierTrimis ? 'text-purple-600' : 'text-muted-foreground group-hover:text-foreground'}`}>
                Curier Trimis
              </span>
            </label>
          </div>
        </div>
      )}

     
      
        {canViewTrayImages && selectedQuoteId && !isServiceFileLocked && (
        <TrayImagesSection
          trayImages={trayImages}
          uploadingImage={uploadingImage}
          isImagesExpanded={isImagesExpanded}
          canAddTrayImages={canAddTrayImages && !isServiceFileLocked}
          canViewTrayImages={canViewTrayImages}
          selectedQuoteId={selectedQuoteId}
          onToggleExpanded={onToggleImagesExpanded || (() => {})}
          onImageUpload={isServiceFileLocked ? (() => {}) : (event) => {
            const file = event.target.files?.[0]
            if (file && onImageUpload) {
              onImageUpload(file)
            }
          }}
          onDownloadAll={onDownloadAllImages || (() => {})}
          onImageDelete={isServiceFileLocked ? (() => {}) : (onImageDelete || (() => {}))}
        />
      )}
      {/* Detalii comandă - read-only când fișa este locked */}
      <TrayDetailsSection
        trayDetails={trayDetails}
        loadingTrayDetails={loadingTrayDetails}
        isCommercialPipeline={true}
        onDetailsChange={isServiceFileLocked ? undefined : onDetailsChange}
        setIsDirty={isServiceFileLocked ? undefined : setIsDirty}
        isVanzariPipeline={isVanzariPipeline}
        isReceptiePipeline={isReceptiePipeline}
      />
      
      {/* Formulare de editare - ASCUNSE când fișa este locked */}
      {!isServiceFileLocked && (
        <>
          {/* Add Instrument - disponibil pentru TOATE pipeline-urile */}
          {(true) && (
            <AddInstrumentForm
              instrumentForm={instrumentForm as any}
              availableInstruments={availableInstruments}
              instruments={instruments.map(i => ({ id: i.id, name: i.name, department_id: i.department_id ?? null, pipeline: (i as any).pipeline ?? null }))}
              departments={departments}
              instrumentSettings={instrumentSettings}
              hasServicesOrInstrumentInSheet={hasServicesOrInstrumentInSheet}
              isVanzariPipeline={true}
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
              onAddInstrumentDirect={onAddInstrumentDirect}
              onClearForm={onClearForm}
/* -------------------------------------------------- COD PENTRU POPULARE CASETE ----------------------------------------------------- */
              onUndo={onUndo}
              previousFormState={previousFormState}
/* ----------------------------------------------------------------------------------------------------------------------------------- */
            />
          )}
          
          {/* Add Service */}
          <AddServiceForm
            svc={svc}
            serviceSearchQuery={serviceSearchQuery}
            serviceSearchFocused={serviceSearchFocused}
            currentInstrumentId={currentInstrumentId}
            availableServices={availableServices}
            instrumentForm={instrumentForm as any}
            isVanzariPipeline={true}
            canEditUrgentAndSubscription={canEditUrgentAndSubscription !== false}
            onServiceSearchChange={onServiceSearchChange}
            onServiceSearchFocus={onServiceSearchFocus}
            onServiceSearchBlur={onServiceSearchBlur}
            onServiceSelect={onServiceSelect}
            onServiceDoubleClick={onServiceDoubleClick}
            onQtyChange={onSvcQtyChange}
            onDiscountChange={onSvcDiscountChange}
            onAddService={onAddService}
            onBrandToggle={onBrandToggle}
            onSerialNumberChange={onSerialNumberChange}
          />
        </>
      )}
      
      {/* Items Table - simplificat */}
      <div className="p-0 mx-4 overflow-x-auto border rounded-lg bg-card">
        <Table className="text-sm min-w-[600px]">
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs font-semibold">Instrument</TableHead>
              <TableHead className="text-xs font-semibold">Brand / Serial</TableHead>
              <TableHead className="text-xs font-semibold">Serviciu</TableHead>
              <TableHead className="text-xs font-semibold text-center">Cant.</TableHead>
              <TableHead className="text-xs font-semibold text-center">Preț</TableHead>
              <TableHead className="text-xs font-semibold text-center">Disc%</TableHead>
              <TableHead className="text-xs font-semibold text-right">Total</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Include items cu item_type null dacă au instrument_id (instrument fără serviciu) */}
            {items.filter(it => it.item_type !== null || it.instrument_id).map((it, index, filteredItems) => {
              // Verifică dacă acest item este primul pentru instrumentul său (pentru butonul de mutare)
              const currentInstrumentId = it.instrument_id || (it.item_type === 'service' && it.service_id 
                ? availableServices.find(s => s.id === it.service_id)?.instrument_id 
                : null)
              
              const isFirstItemOfInstrument = currentInstrumentId && filteredItems.findIndex(item => {
                const itemInstrId = item.instrument_id || (item.item_type === 'service' && item.service_id
                  ? availableServices.find(s => s.id === item.service_id)?.instrument_id
                  : null)
                return itemInstrId === currentInstrumentId
              }) === index
              
              // Construiește grupul de instrumente pentru mutare
              const buildInstrumentGroupForMove = () => {
                if (!currentInstrumentId) return null
                const instrument = instruments.find(i => i.id === currentInstrumentId)
                const instrumentItems = filteredItems.filter(item => {
                  const itemInstrId = item.instrument_id || (item.item_type === 'service' && item.service_id
                    ? availableServices.find(s => s.id === item.service_id)?.instrument_id
                    : null)
                  return itemInstrId === currentInstrumentId
                })
                return {
                  instrument: { id: currentInstrumentId, name: instrument?.name || 'Instrument' },
                  items: instrumentItems
                }
              }
              const disc = Math.min(100, Math.max(0, it.discount_pct || 0));
              const base = (it.qty || 0) * (it.price || 0);
              const afterDisc = base * (1 - disc / 100);
              const lineTotal = it.urgent ? afterDisc * (1 + URGENT_MARKUP_PCT / 100) : afterDisc;
              
              // Obține numele instrumentului
              const instrumentName = it.instrument_id 
                ? instruments.find(i => i.id === it.instrument_id)?.name || '—'
                : '—'
              
              // Obține brand-ul și serial number-ul (din brand direct sau din brand_groups)
              let brandName = '—'
              let serialNumbers: string[] = []
              
              if (it.brand) {
                brandName = it.brand
                if (it.serial_number) {
                  serialNumbers = [it.serial_number]
                }
              } else if ((it as any).brand_groups && Array.isArray((it as any).brand_groups) && (it as any).brand_groups.length > 0) {
                const firstGroup = (it as any).brand_groups[0]
                if (firstGroup.brand) {
                  brandName = firstGroup.brand
                }
                if (Array.isArray(firstGroup.serialNumbers)) {
                  serialNumbers = firstGroup.serialNumbers
                    .map((sn: any) => typeof sn === 'string' ? sn : (sn.serial || sn))
                    .filter((sn: string) => sn && sn.trim())
                }
              } else if (it.serial_number) {
                serialNumbers = [it.serial_number]
              }
              
              return (
                <TableRow 
                  key={it.id} 
                  className="hover:bg-muted/30 cursor-pointer"
                  onClick={() => onRowClick?.(it)}
                >
                  <TableCell className="text-xs text-muted-foreground py-2">
                    <div className="flex flex-col">
                      <span className="font-medium">{instrumentName}</span>
                      <span className="text-[10px] text-primary/70 cursor-pointer hover:underline">Click pentru editare</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground py-2">
                    <div className="flex flex-col gap-0.5">
                      {isServiceFileLocked ? (
                        <>
                          <span className="font-medium">{brandName}</span>
                          {serialNumbers.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {serialNumbers.join(', ')}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <Input
                            className="h-6 text-[10px] w-24"
                            placeholder="Brand..."
                            value={it.brand || ''}
                            onChange={e => {
                              onUpdateItem(it.id, { brand: e.target.value || null });
                            }}
                          />
                          <Input
                            className="h-6 text-[10px] w-28"
                            placeholder="Serial..."
                            value={it.serial_number || ''}
                            onChange={e => {
                              onUpdateItem(it.id, { serial_number: e.target.value || null });
                            }}
                          />
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-sm py-2">
                    {it.name_snapshot}
                  </TableCell>
                  <TableCell className="py-2">
                    {isServiceFileLocked ? (
                      <span className="text-sm text-center">{it.qty}</span>
                    ) : (
                      <Input
                        className="h-7 text-sm text-center w-14"
                        inputMode="numeric"
                        value={String(it.qty)}
                        onChange={e => {
                          const v = Math.max(1, Number(e.target.value || 1));
                          onUpdateItem(it.id, { qty: v });
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm py-2">
                    {it.price.toFixed(2)}
                  </TableCell>
                  <TableCell className="py-2">
                    {isServiceFileLocked ? (
                      <span className="text-sm text-center">{it.discount_pct || 0}%</span>
                    ) : (
                      <Input
                        className="h-7 text-sm text-center w-12"
                        inputMode="decimal"
                        value={String(it.discount_pct)}
                        onChange={e => {
                          const v = Math.min(100, Math.max(0, Number(e.target.value || 0)));
                          onUpdateItem(it.id, { discount_pct: v });
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium text-sm py-2">{lineTotal?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-1 justify-end">
                      {/* Buton mutare instrument - afișat pentru primul item al fiecărui instrument */}
                      {!isServiceFileLocked && isFirstItemOfInstrument && onMoveInstrument && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30" 
                          onClick={(e) => {
                            e.stopPropagation()
                            const group = buildInstrumentGroupForMove()
                            if (group) {
                              onMoveInstrument(group)
                            }
                          }}
                          title={`Mută instrumentul în altă tăviță`}
                        >
                          <Move className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {/* Buton ștergere */}
                      {!isServiceFileLocked && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" 
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(it.id)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground text-center py-6 text-sm">
                  Nu există poziții încă.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
     

      {/* Totals - stilizat ca în Recepție și Department */}
      <TotalsSection
        items={items}
        subscriptionType={subscriptionType}
        services={services}
        instruments={instruments.map(i => ({ id: i.id, weight: i.weight || 0 }))}
      />
      
      
      
    </div>
  )
}

