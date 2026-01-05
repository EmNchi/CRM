'use client'

import { ItemsTable } from './ItemsTable'
import { TotalsSection } from './TotalsSection'
import { TrayImagesSection } from './TrayImagesSection'
import type { LeadQuoteItem, LeadQuote } from '@/lib/types/preturi'
import type { Service } from '@/lib/supabase/serviceOperations'
import type { Technician } from '@/lib/types/preturi'
import type { TrayImage } from '@/lib/supabase/imageOperations'

interface ReceptieViewProps {
  // State
  items: LeadQuoteItem[]
  subscriptionType: 'services' | 'parts' | 'both' | ''
  trayImages: TrayImage[]
  uploadingImage: boolean
  isImagesExpanded: boolean
  selectedQuoteId: string | null
  
  // Data
  services: Service[]
  instruments: Array<{ id: string; name: string; weight: number }>
  technicians: Technician[]
  pipelinesWithIds: Array<{ id: string; name: string }>
  quotes: LeadQuote[]
  
  // Callbacks
  onUpdateItem: (id: string, patch: Partial<LeadQuoteItem>) => void
  onDelete: (id: string) => void
  onRowClick?: (item: LeadQuoteItem) => void
  onMoveInstrument?: (instrumentGroup: { instrument: { id: string; name: string }; items: LeadQuoteItem[] }) => void
  onToggleImagesExpanded: () => void
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  onDownloadAll: () => void
  onImageDelete: (imageId: string, filePath: string) => void
  
  // Pipeline flags
  canAddTrayImages: boolean
  canViewTrayImages: boolean
}

export function ReceptieView({
  items,
  subscriptionType,
  trayImages,
  uploadingImage,
  isImagesExpanded,
  selectedQuoteId,
  services,
  instruments,
  technicians,
  pipelinesWithIds,
  quotes,
  onUpdateItem,
  onDelete,
  onRowClick,
  onMoveInstrument,
  onToggleImagesExpanded,
  onImageUpload,
  onDownloadAll,
  onImageDelete,
  canAddTrayImages,
  canViewTrayImages,
}: ReceptieViewProps) {
  return (
    <div className="space-y-4">
      {/* Tray Images */}
      <TrayImagesSection
        trayImages={trayImages}
        uploadingImage={uploadingImage}
        isImagesExpanded={isImagesExpanded}
        canAddTrayImages={canAddTrayImages}
        canViewTrayImages={canViewTrayImages}
        selectedQuoteId={selectedQuoteId}
        onToggleExpanded={onToggleImagesExpanded}
        onImageUpload={onImageUpload}
        onDownloadAll={onDownloadAll}
        onImageDelete={onImageDelete}
      />
      
      {/* Items Table */}
      <ItemsTable
        items={items}
        services={services}
        instruments={instruments}
        technicians={technicians}
        pipelinesWithIds={pipelinesWithIds}
        isReceptiePipeline={true}
        canEditUrgentAndSubscription={false}
        onUpdateItem={onUpdateItem}
        onDelete={onDelete}
        onRowClick={onRowClick}
        onMoveInstrument={onMoveInstrument}
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

