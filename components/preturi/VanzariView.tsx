'use client'

import { AddInstrumentForm } from './AddInstrumentForm'
import { AddServiceForm } from './AddServiceForm'
import { ItemsTable } from './ItemsTable'
import { TotalsSection } from './TotalsSection'
import { TrayDetailsSection } from './TrayDetailsSection'
import type { LeadQuoteItem, LeadQuote } from '@/lib/types/preturi'
import type { Service } from '@/lib/supabase/serviceOperations'
import type { Part } from '@/lib/supabase/partOperations'
import type { Technician } from '@/lib/types/preturi'
import type { Lead } from '@/app/(crm)/dashboard/page'

interface VanzariViewProps {
  // State
  instrumentForm: { instrument: string; qty: string }
  svc: { id: string; qty: string; discount: string; instrumentId: string }
  serviceSearchQuery: string
  serviceSearchFocused: boolean
  items: LeadQuoteItem[]
  subscriptionType: 'services' | 'parts' | 'both' | ''
  trayDetails: string
  loadingTrayDetails: boolean
  urgentAllServices: boolean
  
  // Data
  availableInstruments: Array<{ id: string; name: string }>
  availableServices: Service[]
  services: Service[]
  instruments: Array<{ id: string; name: string; weight: number }>
  technicians: Technician[]
  pipelinesWithIds: Array<{ id: string; name: string }>
  lead: Lead | null
  
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
  onRowClick?: (item: LeadQuoteItem) => void
  onDetailsChange: (details: string) => void
  onUrgentAllChange: (urgent: boolean) => void
  
  // Computed
  currentInstrumentId: string | null
  hasServicesOrInstrumentInSheet: boolean
  isTechnician: boolean
  isDepartmentPipeline: boolean
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
  availableInstruments,
  availableServices,
  services,
  instruments,
  technicians,
  pipelinesWithIds,
  lead,
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
  onRowClick,
  onDetailsChange,
  onUrgentAllChange,
  currentInstrumentId,
  hasServicesOrInstrumentInSheet,
  isTechnician,
  isDepartmentPipeline,
}: VanzariViewProps) {
  return (
    <div className="space-y-4 border rounded-xl bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-800/30 border-b">
        <div className="px-4 pt-4 pb-3">
          <h3 className="font-semibold text-base text-foreground">Comandă Nouă</h3>
          <p className="text-sm text-muted-foreground mt-1">Adaugă instrumente și servicii pentru această comandă</p>
        </div>
      </div>
      
      {/* Informații Contact */}
      {lead && (
        <div className="px-4 py-3 bg-muted/30 border-b">
          <h4 className="font-medium text-sm mb-2">Informații Contact</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Nume: </span>
              <span className="font-medium">{lead.name || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Email: </span>
              <span className="font-medium">{lead.email || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Telefon: </span>
              <span className="font-medium">{lead.phone || '—'}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Instrument */}
      {!(isDepartmentPipeline && isTechnician) && (
        <AddInstrumentForm
          instrumentForm={instrumentForm}
          availableInstruments={availableInstruments}
          instrumentSettings={{}}
          hasServicesOrInstrumentInSheet={hasServicesOrInstrumentInSheet}
          isVanzariPipeline={true}
          isDepartmentPipeline={isDepartmentPipeline}
          isTechnician={isTechnician}
          onInstrumentChange={onInstrumentChange}
          onQtyChange={onQtyChange}
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
      
      {/* Items Table */}
      <ItemsTable
        items={items}
        services={services}
        instruments={instruments}
        technicians={technicians}
        pipelinesWithIds={pipelinesWithIds}
        isReceptiePipeline={false}
        canEditUrgentAndSubscription={true}
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
      
      {/* Tray Details */}
      <TrayDetailsSection
        trayDetails={trayDetails}
        loadingTrayDetails={loadingTrayDetails}
        isCommercialPipeline={true}
        onDetailsChange={onDetailsChange}
      />
    </div>
  )
}

