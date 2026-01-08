'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Move } from 'lucide-react';
import type { LeadQuoteItem, LeadQuote } from '@/lib/types/preturi';
import { AddInstrumentForm } from '../forms/AddInstrumentForm';
import { AddServiceForm } from '../forms/AddServiceForm';
import { ItemsTable } from '../sections/ItemsTable';
import { TotalsSection } from '../sections/TotalsSection';
import { TrayActions } from '../sections/TrayActions';
import { TrayTabs } from '../sections/TrayTabs';
import { TrayImagesSection } from '../sections/TrayImagesSection';
import type { Service } from '@/lib/supabase/serviceOperations';
import type { Part } from '@/lib/supabase/partOperations';
import type { Technician } from '@/lib/types/preturi';
import { TrayDetailsSection } from '../sections/TrayDetailsSection';

// ============================================================================
// TYPES
// ============================================================================

interface ReceptieViewProps {
  items: LeadQuoteItem[] | null | undefined
  services: Service[] | null | undefined
  parts: Part[] | null | undefined
  instruments: Array<{ id: string; name: string; weight: number; department_id: string | null; pipeline?: string | null }> | null | undefined
  technicians: Technician[] | null | undefined
  pipelinesWithIds: Array<{ id: string; name: string }> | null | undefined
  quotes: LeadQuote[] | null | undefined
  selectedQuoteId: string | null | undefined
  
  subscriptionType: 'services' | 'parts' | 'both' | '' | null | undefined
  
  onUpdateItem: ((id: string, patch: Partial<LeadQuoteItem>) => void) | null | undefined
  onDelete: ((id: string) => void) | null | undefined
  onAddService: (() => void) | null | undefined
  onAddPart: (() => void) | null | undefined
  onTraySelect: ((trayId: string) => void) | null | undefined
  onAddTray: (() => void) | null | undefined
  onDeleteTray: ((trayId: string) => void) | null | undefined
  onSave: (() => void) | null | undefined
  onMoveInstrument?: ((instrumentGroup: { instrument: { id: string; name: string }; items: LeadQuoteItem[] }) => void) | null | undefined
  
  // Form states from orchestrator
  svc: any
  part: any
  instrumentForm: any
  serviceSearchQuery?: string
  serviceSearchFocused?: boolean
  partSearchQuery?: string
  partSearchFocused?: boolean
  
  // Callbacks for form changes
  onInstrumentChange?: ((instrumentId: string) => void) | null | undefined
  onQtyChange?: ((qty: string) => void) | null | undefined
  onServiceSearchChange?: ((query: string) => void) | null | undefined
  onServiceSearchFocus?: (() => void) | null | undefined
  onServiceSearchBlur?: (() => void) | null | undefined
  onServiceSelect?: ((serviceId: string, serviceName: string) => void) | null | undefined
  onServiceDoubleClick?: ((serviceId: string, serviceName: string) => void) | null | undefined
  onSvcQtyChange?: ((qty: string) => void) | null | undefined
  onSvcDiscountChange?: ((discount: string) => void) | null | undefined
  onPartSearchChange?: ((query: string) => void) | null | undefined
  onPartSearchFocus?: (() => void) | null | undefined
  onPartSearchBlur?: (() => void) | null | undefined
  onPartSelect?: ((partId: string, partName: string) => void) | null | undefined
  onPartDoubleClick?: ((partId: string, partName: string) => void) | null | undefined
  onPartQtyChange?: ((qty: string) => void) | null | undefined
  onSerialNumberChange?: ((serialNumberId: string) => void) | null | undefined
  
  // Brand/Serial callbacks pentru instrumente Reparații
  onAddBrandSerialGroup?: (() => void) | null | undefined
  onRemoveBrandSerialGroup?: ((groupIndex: number) => void) | null | undefined
  onUpdateBrand?: ((groupIndex: number, value: string) => void) | null | undefined
  onUpdateBrandQty?: ((groupIndex: number, qty: string) => void) | null | undefined
  onUpdateSerialNumber?: ((groupIndex: number, serialIndex: number, value: string) => void) | null | undefined
  onAddSerialNumber?: ((groupIndex: number) => void) | null | undefined
  onRemoveSerialNumber?: ((groupIndex: number, serialIndex: number) => void) | null | undefined
  onUpdateSerialGarantie?: ((groupIndex: number, serialIndex: number, garantie: boolean) => void) | null | undefined
  setIsDirty?: ((dirty: boolean) => void) | null | undefined
  
  // State
  loading?: boolean | null | undefined
  saving?: boolean | null | undefined
  isDirty?: boolean | null | undefined
  
  // Payment states
  paymentCash?: boolean | null | undefined
  paymentCard?: boolean | null | undefined
  onPaymentCashChange?: ((checked: boolean) => void) | null | undefined
  onPaymentCardChange?: ((checked: boolean) => void) | null | undefined
  
  // Subscription states
  urgentAllServices?: boolean | null | undefined
  onUrgentChange?: ((checked: boolean) => Promise<void>) | null | undefined
  onSubscriptionChange?: ((value: 'services' | 'parts' | 'both' | '') => void) | null | undefined
  
  // Other props
  availableInstruments?: Array<{ id: string; name: string }> | null | undefined
  availableServices?: Service[] | null | undefined
  currentInstrumentId?: string | null | undefined
  hasServicesOrInstrumentInSheet?: boolean | null | undefined
  instrumentSettings?: Record<string, any> | null | undefined
  departments?: Array<{ id: string; name: string }> | null | undefined
  canEditUrgentAndSubscription?: boolean | null | undefined
  
  // Totals
  subtotal?: number | null | undefined
  totalDiscount?: number | null | undefined
  urgentAmount?: number | null | undefined
  total?: number | null | undefined
  allSheetsTotal?: number | null | undefined
  
  // For instrument distribution section
  instrumentsGrouped?: Array<{ instrument: { id: string; name: string }; items: LeadQuoteItem[] }> | null | undefined
  fisaId?: string | null | undefined
  officeDirect?: boolean | null | undefined
  curierTrimis?: boolean | null | undefined
  currentServiceFileStage?: string | null | undefined
  onOfficeDirectChange?: ((checked: boolean) => Promise<void>) | null | undefined
  onCurierTrimisChange?: ((checked: boolean) => Promise<void>) | null | undefined
  
  // For TrayTabs
  sendingTrays?: boolean | null | undefined
  traysAlreadyInDepartments?: boolean | null | undefined
  onSendTrays?: (() => void) | null | undefined
  onEditTray?: (() => void) | null | undefined
  
  // For TrayImagesSection
  trayImages?: any[] | null | undefined
  uploadingImage?: boolean | null | undefined
  isImagesExpanded?: boolean | null | undefined
  canAddTrayImages?: boolean | null | undefined
  canViewTrayImages?: boolean | null | undefined
  onToggleImagesExpanded?: (() => void) | null | undefined
  onImageUpload?: ((event: React.ChangeEvent<HTMLInputElement>) => void) | null | undefined
  onDownloadAllImages?: (() => void) | null | undefined
  onImageDelete?: ((imageId: string, filePath: string) => void) | null | undefined
  
  // For TrayDetailsSection
  trayDetails?: string | null | undefined
  loadingTrayDetails?: boolean | null | undefined
  isCommercialPipeline?: boolean | null | undefined
  onDetailsChange?: ((details: string) => void) | null | undefined
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ReceptieView(props: ReceptieViewProps) {
  // Normalize props
  const items = Array.isArray(props.items) ? props.items : []
  const services = Array.isArray(props.services) ? props.services : []
  const parts = Array.isArray(props.parts) ? props.parts : []
  const instruments = Array.isArray(props.instruments) ? props.instruments : []
  const technicians = Array.isArray(props.technicians) ? props.technicians : []
  const pipelinesWithIds = Array.isArray(props.pipelinesWithIds) ? props.pipelinesWithIds : []
  const quotes = Array.isArray(props.quotes) ? props.quotes : []
  const availableInstruments = Array.isArray(props.availableInstruments) ? props.availableInstruments : []
  const availableServices = Array.isArray(props.availableServices) ? props.availableServices : []
  const departments = Array.isArray(props.departments) ? props.departments : []
  
  const selectedQuote = quotes.find(q => q.id === props.selectedQuoteId) ?? null
  const loading = props.loading ?? false
  const saving = props.saving ?? false
  const isDirty = props.isDirty ?? false
  
  // Normalize TrayDetailsSection props
  const trayDetails = props.trayDetails ?? ''
  const loadingTrayDetails = props.loadingTrayDetails ?? false
  const isCommercialPipeline = props.isCommercialPipeline ?? true
  const onDetailsChange = props.onDetailsChange ?? (() => {})
  
  // State pentru expanded/collapsed pentru TrayDetailsSection (minimizat by default în Receptie)
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false)
  
  // Găsește tăvița undefined (fără număr)
  const undefinedTray = quotes.find(q => !q.number || q.number === '') || null
  
  // Verifică dacă suntem în tăvița undefined
  const isUndefinedTray = selectedQuote && (!selectedQuote.number || selectedQuote.number === '')
  
  // Calculează instrumentele grupate din tăvița undefined
  // IMPORTANT: Trebuie să calculăm items-urile din tăvița undefined, chiar dacă nu suntem în ea selectați
  const instrumentsGroupedFromUndefinedTray = useMemo(() => {
    // Găsește tăvița undefined
    const undefinedTrayForItems = undefinedTray || quotes.find(q => !q.number || q.number === '')
    
    // Dacă nu există tăvița undefined sau nu suntem în ea selectați, folosim items-urile curente doar dacă suntem în tăvița undefined
    if (!undefinedTrayForItems) {
      return []
    }
    
    // Dacă suntem în tăvița undefined selectată, folosim items-urile curente
    // Altfel, trebuie să încărcăm items-urile din tăvița undefined (dar asta ar necesita un async call)
    // Pentru moment, folosim items-urile curente doar dacă suntem în tăvița undefined
    if (!isUndefinedTray || !Array.isArray(items) || items.length === 0) {
      return []
    }
    
    const grouped = new Map<string, { instrument: { id: string; name: string }; items: LeadQuoteItem[] }>()
    
    items.forEach(item => {
      let instrumentId: string | null = null
      
      // Dacă item-ul are instrument_id direct
      if (item.instrument_id) {
        instrumentId = item.instrument_id
      } 
      // Dacă item-ul este un serviciu, găsește instrument_id din serviciu
      else if (item.item_type === 'service' && item.service_id) {
        const service = services.find(s => s.id === item.service_id)
        instrumentId = service?.instrument_id || null
      }
      
      if (instrumentId) {
        const instrument = instruments.find(i => i.id === instrumentId)
        if (instrument) {
          if (!grouped.has(instrument.id)) {
            grouped.set(instrument.id, {
              instrument: { id: instrument.id, name: instrument.name },
              items: []
            })
          }
          // IMPORTANT: Extragem doar datele necesare din item pentru a evita referințe circulare
          // Extragem doar proprietățile primitive necesare, inclusiv brand_groups într-un mod sigur
          try {
            // Extragem brand_groups într-un mod sigur, doar cu date primitive
            let safeBrandGroups: Array<{ id: string; brand: string; serialNumbers: string[]; garantie: boolean }> = []
            if (Array.isArray(item.brand_groups)) {
              safeBrandGroups = item.brand_groups.map((bg: any) => {
                // Extragem doar proprietățile primitive din fiecare brand group
                return {
                  id: typeof bg.id === 'string' ? bg.id : String(bg.id || ''),
                  brand: typeof bg.brand === 'string' ? bg.brand : String(bg.brand || ''),
                  serialNumbers: Array.isArray(bg.serialNumbers) 
                    ? bg.serialNumbers.map((sn: any) => typeof sn === 'string' ? sn : String(sn || ''))
                    : [],
                  garantie: Boolean(bg.garantie)
                }
              })
            }
            
            // Extragem doar proprietățile primitive necesare pentru mutarea items-urilor
            const safeItem: Partial<LeadQuoteItem> = {
              id: typeof item.id === 'string' ? item.id : String(item.id),
              tray_id: typeof item.tray_id === 'string' ? item.tray_id : (item as any).tray_id || '',
              item_type: item.item_type || null,
              service_id: item.service_id || null,
              part_id: item.part_id || null,
              instrument_id: item.instrument_id || null,
              technician_id: item.technician_id || null,
              qty: typeof item.qty === 'number' ? item.qty : (typeof item.qty === 'string' ? parseFloat(item.qty) : 1),
              price: typeof item.price === 'number' ? item.price : (typeof (item as any).price === 'string' ? parseFloat((item as any).price) : 0),
              name_snapshot: typeof item.name_snapshot === 'string' ? item.name_snapshot : '',
              urgent: Boolean(item.urgent),
              brand_groups: safeBrandGroups,
            }
            grouped.get(instrument.id)!.items.push(safeItem as LeadQuoteItem)
          } catch (err) {
            // Dacă extragerea eșuează, ignorăm item-ul
            // console.log('Eroare la extragerea item-ului pentru mutare:', err)
          }
        }
      }
    })
    
    return Array.from(grouped.values())
  }, [isUndefinedTray, items, services, instruments, undefinedTray, quotes])
  
  // Verifică dacă cardul este la stage "Curier Trimis" sau "Office Direct"
  // IMPORTANT: Verificăm atât stage-ul din currentServiceFileStage, cât și flag-urile directe din props
  const currentStage = props.currentServiceFileStage?.toLowerCase() || ''
  const isCurierTrimisStage = currentStage.includes('curier') && currentStage.includes('trimis')
  const isOfficeDirectStage = currentStage.includes('office') && currentStage.includes('direct')
  
  // IMPORTANT: Dacă curierTrimis sau officeDirect sunt true în props, considerăm că suntem în stage-ul de distribuire
  // chiar dacă currentServiceFileStage este null (poate că nu s-a încărcat încă)
  const isInDistributionStage = isCurierTrimisStage || 
                                isOfficeDirectStage || 
                                props.curierTrimis === true || 
                                props.officeDirect === true
  
  // DECIZIE: Afișăm secțiunea de distribuire DOAR dacă:
  // 1. Suntem în tăvița undefined
  // 2. Tăvița undefined are items (instrumente grupate)
  // 3. Cardul este la stage "Curier Trimis" sau "Office Direct"
  const showDistributionSection = isUndefinedTray && 
                                  instrumentsGroupedFromUndefinedTray.length > 0 && 
                                  isInDistributionStage
  
  
  if (loading || !selectedQuote) {
    return <Card className="p-4">Se încarcă…</Card>
  }
  
  const onMoveInstrument = props.onMoveInstrument || (() => {})
  const onEditTray = props.onEditTray || (() => {})
  const onSendTrays = props.onSendTrays || (() => {})
  
  // Dacă trebuie să afișăm secțiunea de distribuire, afișăm DOAR acea secțiune
  if (showDistributionSection) {
    return (
      <div className="space-y-4">
        {/* TrayTabs - butoanele pentru tăviță (doar pentru vizualizare, nu pentru editare) */}
        <TrayTabs
          quotes={quotes}
          selectedQuoteId={props.selectedQuoteId ?? null}
          isVanzariPipeline={false}
          isReceptiePipeline={true}
          isDepartmentPipeline={false}
          isVanzatorMode={false}
          sendingTrays={props.sendingTrays ?? false}
          traysAlreadyInDepartments={props.traysAlreadyInDepartments ?? false}
          onTraySelect={props.onTraySelect || (() => {})}
          onAddTray={props.onAddTray || (() => {})}
          onDeleteTray={props.onDeleteTray || (() => {})}
          onSendTrays={onSendTrays}
        />
        
        {/* Secțiunea "Recepţie - Distribuire Instrumente" */}
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold mb-1">Recepţie - Distribuire Instrumente</h3>
              <p className="text-sm text-muted-foreground">
                Mută instrumentele cu serviciile lor în tăviţe
              </p>
            </div>
            
            <div className="space-y-3">
              {instrumentsGroupedFromUndefinedTray.map((group, index) => {
                const serviceCount = group.items.filter(item => item.item_type === 'service').length
                const firstService = group.items.find(item => item.item_type === 'service')
                const serviceName = firstService?.name_snapshot || ''
                
                return (
                  <div 
                    key={group.instrument.id || index}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (onMoveInstrument) {
                        onMoveInstrument(group)
                      }
                    }}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer bg-white dark:bg-background"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-base mb-1">
                        {group.instrument.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {serviceCount} {serviceCount === 1 ? 'serviciu' : 'servicii'}
                      </div>
                      {serviceName && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {serviceName}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (onMoveInstrument) {
                          onMoveInstrument(group)
                        }
                      }}
                      className="ml-4"
                    >
                      <Move className="h-4 w-4 mr-1" />
                      Mută
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      </div>
    )
  }
  
  // Dacă NU trebuie să afișăm secțiunea de distribuire, afișăm UI-ul normal
  return (
    <div className="space-y-4">
      {/* TrayTabs - butoanele pentru tăviță */}
      <TrayTabs
        quotes={quotes}
        selectedQuoteId={props.selectedQuoteId ?? null}
        isVanzariPipeline={false}
        isReceptiePipeline={true}
        isDepartmentPipeline={false}
        isVanzatorMode={false}
        sendingTrays={props.sendingTrays ?? false}
        traysAlreadyInDepartments={props.traysAlreadyInDepartments ?? false}
        onTraySelect={props.onTraySelect || (() => {})}
        onAddTray={props.onAddTray || (() => {})}
        onDeleteTray={props.onDeleteTray || (() => {})}
        onSendTrays={onSendTrays}
      />
      {/* Detalii client / comandă */}
      <TrayDetailsSection
        trayDetails={trayDetails}
        loadingTrayDetails={loadingTrayDetails}
        isCommercialPipeline={isCommercialPipeline}
        onDetailsChange={onDetailsChange}
        isExpanded={isDetailsExpanded}
        onToggleExpanded={() => setIsDetailsExpanded(prev => !prev)}
        setIsDirty={props.setIsDirty || undefined}
      /> 
      {/* TrayImagesSection - Galerie Imagini */}
      {props.canViewTrayImages && (
        <TrayImagesSection
          trayImages={props.trayImages || []}
          uploadingImage={props.uploadingImage ?? false}
          isImagesExpanded={props.isImagesExpanded ?? false}
          canAddTrayImages={props.canAddTrayImages ?? true}
          canViewTrayImages={props.canViewTrayImages ?? false}
          selectedQuoteId={props.selectedQuoteId ?? null}
          onToggleExpanded={props.onToggleImagesExpanded || (() => {})}
          onImageUpload={(event) => {
            const file = event.target.files?.[0]
            if (file && props.onImageUpload) {
              props.onImageUpload(file as any)
            }
          }}
          onDownloadAll={props.onDownloadAllImages || (() => {})}
          onImageDelete={props.onImageDelete || (() => {})}
        />
      )}
      
      
      {/* TrayActions - toggle-uri pentru urgent, abonament, etc. */}
      <TrayActions
        urgentAllServices={props.urgentAllServices ?? false}
        subscriptionType={props.subscriptionType || ''}
        officeDirect={props.officeDirect ?? false}
        curierTrimis={props.curierTrimis ?? false}
        paymentCash={props.paymentCash ?? false}
        paymentCard={props.paymentCard ?? false}
        loading={loading}
        saving={saving}
        isDirty={isDirty}
        isVanzariPipeline={false}
        isReceptiePipeline={true}
        currentServiceFileStage={props.currentServiceFileStage ?? null}
        canEditUrgentAndSubscription={props.canEditUrgentAndSubscription ?? true}
        fisaId={props.fisaId}
        selectedQuoteId={props.selectedQuoteId ?? null}
        items={items}
        onUrgentChange={props.onUrgentChange || (async () => {})}
        onSubscriptionChange={props.onSubscriptionChange || (() => {})}
        onOfficeDirectChange={props.onOfficeDirectChange || (async () => {})}
        onCurierTrimisChange={props.onCurierTrimisChange || (async () => {})}
        onPaymentCashChange={props.onPaymentCashChange || (() => {})}
        onPaymentCardChange={props.onPaymentCardChange || (() => {})}
        onSave={props.onSave || (() => {})}
      />
      
      {/* Secțiunea "Adaugă Instrument" - cu background verde */}
      <AddInstrumentForm
        instrumentForm={props.instrumentForm || { instrument: '', qty: '1' }}
        availableInstruments={availableInstruments}
        instruments={instruments.map(i => ({ id: i.id, name: i.name, department_id: i.department_id ?? null, pipeline: i.pipeline ?? null }))}
        departments={departments}
        instrumentSettings={props.instrumentSettings || {}}
        hasServicesOrInstrumentInSheet={props.hasServicesOrInstrumentInSheet ?? false}
        isVanzariPipeline={false}
        isDepartmentPipeline={false}
        isTechnician={false}
        onInstrumentChange={props.onInstrumentChange || (() => {})}
        onQtyChange={props.onQtyChange || (() => {})}
        onAddBrandSerialGroup={props.onAddBrandSerialGroup || undefined}
        onRemoveBrandSerialGroup={props.onRemoveBrandSerialGroup || undefined}
        onUpdateBrand={props.onUpdateBrand || undefined}
        onUpdateBrandQty={props.onUpdateBrandQty || undefined}
        onUpdateSerialNumber={props.onUpdateSerialNumber || undefined}
        onAddSerialNumber={props.onAddSerialNumber || undefined}
        onRemoveSerialNumber={props.onRemoveSerialNumber || undefined}
        onUpdateSerialGarantie={props.onUpdateSerialGarantie || undefined}
        setIsDirty={props.setIsDirty || undefined}
      />
      
      {/* Secțiunea "Adaugă Serviciu" - cu background albastru */}
      <AddServiceForm
        svc={props.svc || { id: '', qty: '1', discount: '0', instrumentId: '', serialNumberId: '' }}
        serviceSearchQuery={props.serviceSearchQuery || ''}
        serviceSearchFocused={props.serviceSearchFocused || false}
        currentInstrumentId={(props.currentInstrumentId !== undefined && props.currentInstrumentId !== null) ? props.currentInstrumentId : null}
        availableServices={availableServices}
        instrumentForm={props.instrumentForm}
        isVanzariPipeline={false}
        canEditUrgentAndSubscription={props.canEditUrgentAndSubscription ?? true}
        onServiceSearchChange={props.onServiceSearchChange || (() => {})}
        onServiceSearchFocus={props.onServiceSearchFocus || (() => {})}
        onServiceSearchBlur={props.onServiceSearchBlur || (() => {})}
        onServiceSelect={props.onServiceSelect || (() => {})}
        onServiceDoubleClick={props.onServiceDoubleClick || (() => {})}
        onQtyChange={props.onSvcQtyChange || (() => {})}
        onDiscountChange={props.onSvcDiscountChange || (() => {})}
        onAddService={props.onAddService || (() => {})}
        onSerialNumberChange={props.onSerialNumberChange || (() => {})}
      />
      
      {/* Tabelul cu items */}
      <ItemsTable
        items={items}
        services={services}
        instruments={instruments.map(i => ({ id: i.id, name: i.name, weight: i.weight || 0 }))}
        technicians={technicians}
        pipelinesWithIds={pipelinesWithIds}
        isReceptiePipeline={true}
        canEditUrgentAndSubscription={props.canEditUrgentAndSubscription ?? true}
        onUpdateItem={props.onUpdateItem || (() => {})}
        onDelete={props.onDelete || (() => {})}
        onMoveInstrument={onMoveInstrument}
      />
      
      {/* Secțiunea Totaluri */}
      <TotalsSection
        items={items}
        subscriptionType={props.subscriptionType || ''}
        services={services}
        instruments={instruments.map(i => ({ id: i.id, name: i.name, weight: i.weight || 0 }))}
      />
      
      
    </div>
    
  
  );
}
