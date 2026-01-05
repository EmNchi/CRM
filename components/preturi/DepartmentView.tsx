'use client'

import { AddInstrumentForm } from './AddInstrumentForm'
import { AddServiceForm } from './AddServiceForm'
import { AddPartForm } from './AddPartForm'
import { ItemsTable } from './ItemsTable'
import { TotalsSection } from './TotalsSection'
import type { LeadQuoteItem } from '@/lib/types/preturi'
import type { Service } from '@/lib/supabase/serviceOperations'
import type { Part } from '@/lib/supabase/partOperations'
import type { Technician } from '@/lib/types/preturi'

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
  instruments: Array<{ id: string; name: string; weight: number; department_id: string | null }>
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
  onUpdateSerialGarantie,
  setIsDirty,
  currentInstrumentId,
  hasServicesOrInstrumentInSheet,
  isTechnician,
  isDepartmentPipeline,
  isReparatiiPipeline,
  canAddParts,
  canEditUrgentAndSubscription,
}: DepartmentViewProps) {
  return (
    <div className="space-y-4">
      {/* Add Instrument */}
      {!(isDepartmentPipeline && isTechnician) && (
        <AddInstrumentForm
          instrumentForm={instrumentForm}
          availableInstruments={availableInstruments}
          instruments={instruments}
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
          onUpdateSerialGarantie={onUpdateSerialGarantie}
          setIsDirty={setIsDirty}
        />
      )}
      
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
          instrumentForm={instrumentForm}
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

