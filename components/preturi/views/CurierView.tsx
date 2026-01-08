'use client'

import { ItemsTable } from '../sections/ItemsTable'
import { TotalsSection } from '../sections/TotalsSection'
import type { LeadQuoteItem } from '@/lib/types/preturi'
import type { Service } from '@/lib/supabase/serviceOperations'
import type { Technician } from '@/lib/types/preturi'

interface CurierViewProps {
  // State
  items: LeadQuoteItem[]
  subscriptionType: 'services' | 'parts' | 'both' | ''
  
  // Data
  services: Service[]
  instruments: Array<{ id: string; name: string; weight: number }>
  technicians: Technician[]
  pipelinesWithIds: Array<{ id: string; name: string }>
  
  // Callbacks
  onUpdateItem: (id: string, patch: Partial<LeadQuoteItem>) => void
  onDelete: (id: string) => void
  onRowClick?: (item: LeadQuoteItem) => void
}

export function CurierView({
  items,
  subscriptionType,
  services,
  instruments,
  technicians,
  pipelinesWithIds,
  onUpdateItem,
  onDelete,
  onRowClick,
}: CurierViewProps) {
  return (
    <div className="space-y-4">
      {/* Items Table */}
      <ItemsTable
        items={items}
        services={services}
        instruments={instruments}
        technicians={technicians}
        pipelinesWithIds={pipelinesWithIds}
        isReceptiePipeline={false}
        canEditUrgentAndSubscription={false}
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



