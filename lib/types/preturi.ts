import type { TrayItem, Tray } from '@/lib/supabase/serviceFileOperations'
import type { Lead } from '@/app/(crm)/dashboard/page'

/**
 * Tipuri pentru componenta Preturi
 */

// Tip pentru ref-ul expus de componenta Preturi
export interface PreturiRef {
  save: () => Promise<void>
  getSelectedTrayId: () => string | null
}

// Props pentru componenta Preturi
export interface PreturiProps {
  leadId: string
  lead?: Lead | null
  fisaId?: string | null
  initialQuoteId?: string | null
  pipelineSlug?: string
  isDepartmentPipeline?: boolean
}

// Tip pentru item-uri în UI (extins din TrayItem)
export type LeadQuoteItem = TrayItem & {
  item_type?: 'service' | 'part' | null
  price: number // Obligatoriu - întotdeauna definit
  discount_pct?: number
  urgent?: boolean
  name_snapshot?: string
  brand?: string | null
  serial_number?: string | null
  garantie?: boolean
  pipeline_id?: string | null
  service_id?: string | null
  instrument_id?: string | null // OBLIGATORIU în DB
  department_id?: string | null // OBLIGATORIU în DB - se preia din instrument
  qty?: number
  department?: string | null // Numele departamentului (derivat din pipeline)
  brand_groups?: Array<{ 
    id: string
    brand: string
    serialNumbers: string[]
    garantie: boolean 
  }>
}

// Tip pentru tăvițe în UI (extins din Tray)
export type LeadQuote = Tray & { 
  fisa_id?: string | null
  subscription_type?: 'services' | 'parts' | 'both' | null
  sheet_index?: number
  name?: string
  is_cash?: boolean
  is_card?: boolean
}

// Tip pentru tehnician
export type Technician = {
  id: string // user_id din app_members
  name: string
}

// Constante
export const URGENT_MARKUP_PCT = 30 // +30% per line if urgent

