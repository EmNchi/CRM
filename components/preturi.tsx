'use client';

import { useEffect, useMemo, useState, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { listServices, type Service } from '@/lib/supabase/serviceOperations';
import { 
  listTraysForServiceFile,
  createTray,
  getTray,
  listTrayItemsForTray,
  createTrayItem,
  updateTrayItem,
  deleteTrayItem,
  deleteTray,
  updateTray,
  updateServiceFile,
  getServiceFile,
  createServiceFile,
  type Tray,
  type TrayItem,
  type ServiceFile
} from "@/lib/supabase/serviceFileOperations"
import { addServiceFileToPipeline, addTrayToPipeline } from "@/lib/supabase/pipelineOperations"
import { useRole, useAuth } from "@/lib/contexts/AuthContext"
import { uploadTrayImage, deleteTrayImage, listTrayImages, saveTrayImageReference, deleteTrayImageReference, type TrayImage } from "@/lib/supabase/imageOperations"
import { ImagePlus, X as XIcon, Image as ImageIcon, Loader2, Download, ChevronDown, ChevronUp, Package } from "lucide-react"
import { toast } from "sonner"

// Tipuri pentru UI (alias-uri pentru claritate)
type LeadQuoteItem = TrayItem & {
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
}
type LeadQuote = Tray & { 
  fisa_id?: string | null
  subscription_type?: 'services' | 'parts' | 'both' | null
  sheet_index?: number
  name?: string
  is_cash?: boolean
  is_card?: boolean
}

// Funcții wrapper pentru transformarea datelor
const listTraysForServiceSheet = async (fisaId: string): Promise<LeadQuote[]> => {
  const { data, error } = await listTraysForServiceFile(fisaId)
  if (error) {
    console.error('Error loading trays:', error)
    return []
  }
  return (data || []).map(tray => ({
    ...tray,
    fisa_id: fisaId,
  })) as LeadQuote[]
}

const listQuotesForLead = async (leadId: string): Promise<LeadQuote[]> => {
  // Obține toate tăvițele pentru lead prin toate fișele de serviciu
  const { data: serviceFiles } = await supabase
    .from('service_files')
    .select('id')
    .eq('lead_id', leadId)
  
  if (!serviceFiles || serviceFiles.length === 0) {
    return []
  }
  
  const serviceFileIds = serviceFiles.map((sf: any) => sf.id)
  const { data: trays } = await supabase
    .from('trays')
    .select('*')
    .in('service_file_id', serviceFileIds)
    .order('created_at', { ascending: true })
  
  return (trays || []) as LeadQuote[]
}

const createQuoteForLead = async (leadId: string, name?: string, fisaId?: string | null, size?: string): Promise<LeadQuote> => {
  if (!fisaId) {
    throw new Error('fisaId is required for creating trays in new architecture')
  }
  
  // Creează o tavă nouă pentru fișa de serviciu
  const trayData = {
    number: name || '1',
    size: size || 'medium',
    service_file_id: fisaId,
    status: 'in_receptie' as const,
  }
  
  const { data, error } = await createTray(trayData)
  if (error || !data) {
    console.error('Error creating tray:', error)
    throw error || new Error('Failed to create tray')
  }
  
  return {
    ...data,
    fisa_id: fisaId,
  } as LeadQuote
}

const updateQuote = async (quoteId: string, updates: Partial<LeadQuote>) => {
  // trays nu are is_cash, is_card, subscription_type
  // Aceste câmpuri nu sunt stocate în tabelul trays
  if (updates.is_cash !== undefined || updates.is_card !== undefined || updates.subscription_type !== undefined) {
    console.warn('is_cash, is_card, subscription_type nu pot fi actualizate - aceste câmpuri nu sunt stocate în trays')
    // Nu aruncăm eroare, doar ignorăm aceste câmpuri
  }
  
  // Actualizăm doar câmpurile care există în trays
  const trayUpdates: any = {}
  
  if (updates.number !== undefined) trayUpdates.number = updates.number
  if (updates.size !== undefined) trayUpdates.size = updates.size
  if (updates.status !== undefined) trayUpdates.status = updates.status
  if (updates.urgent !== undefined) trayUpdates.urgent = updates.urgent
  
  // Dacă există actualizări pentru tray, le aplicăm
  if (Object.keys(trayUpdates).length > 0) {
    const { data, error } = await updateTray(quoteId, trayUpdates)
    if (error) throw error
    return data
  }
  
  // Dacă nu există actualizări pentru tray (doar is_cash, is_card, subscription_type),
  // returnează tray-ul existent
  const { data } = await getTray(quoteId)
  return data
}

const listQuoteItems = async (
  quoteId: string, 
  services?: any[],
  instruments?: Array<{ id: string; name: string; weight: number; department_id: string | null; pipeline?: string | null }>,
  pipelines?: Array<{ id: string; name: string }>
): Promise<LeadQuoteItem[]> => {
  const { data, error } = await listTrayItemsForTray(quoteId)
  if (error) {
    console.error('Error loading tray items:', error)
    return []
  }
  
  // Creează map-uri pentru instrumente și pipeline-uri
  const instrumentPipelineMap = new Map<string, string | null>()
  const pipelineMap = new Map<string, string>()
  
  if (instruments) {
    instruments.forEach(inst => {
      if (inst.pipeline) {
        instrumentPipelineMap.set(inst.id, inst.pipeline)
      }
    })
  }
  
  if (pipelines) {
    pipelines.forEach(p => {
      pipelineMap.set(p.id, p.name)
    })
  }
  
  // Transformă TrayItem în LeadQuoteItem pentru UI
  return (data || []).map((item: TrayItem) => {
    // Parsează notes pentru a obține informații suplimentare
    let notesData: any = {}
    if (item.notes) {
      try {
        notesData = JSON.parse(item.notes)
      } catch (e) {
        // Notes nu este JSON, ignoră
      }
    }
    
    // Determină item_type
    let item_type: 'service' | 'part' | null = notesData.item_type || null
    if (!item_type) {
      if (item.service_id) {
        item_type = 'service'
      } else if (notesData.name || !item.instrument_id) {
        item_type = 'part'
      }
    }
    
    // Obține prețul
    let price = notesData.price || 0
    if (!price && item_type === 'service' && item.service_id && services) {
      const service = services.find((s: any) => s.id === item.service_id)
      price = service?.price || 0
    }
    
    // Obține departamentul din instruments.pipeline
    let department: string | null = null
    let instrumentId = item.instrument_id
    
    // Pentru servicii, obține instrument_id din serviciu dacă nu există direct pe item
    if (!instrumentId && item_type === 'service' && item.service_id && services) {
      const service = services.find((s: any) => s.id === item.service_id)
      if (service?.instrument_id) {
        instrumentId = service.instrument_id
      }
    }
    
    // Obține pipeline-ul din instrument și apoi numele departamentului
    if (instrumentId && instrumentPipelineMap.size > 0 && pipelineMap.size > 0) {
      const pipelineId = instrumentPipelineMap.get(instrumentId)
      if (pipelineId) {
        department = pipelineMap.get(pipelineId) || null
      }
    }
    
    // Obține brand-urile și serial numbers din noua structură: tray_item_brands -> tray_item_brand_serials
    const brands = (item as any).tray_item_brands || []
    
    // Transformă în formatul pentru UI: Array<{ brand, serialNumbers[], garantie }>
    const brandGroups = brands.map((b: any) => ({
      id: b.id,
      brand: b.brand || '',
      garantie: b.garantie || false,
      serialNumbers: (b.tray_item_brand_serials || []).map((s: any) => s.serial_number || '')
    }))
    
    // Pentru compatibilitate, primul brand
    const firstBrand = brands.length > 0 ? brands[0] : null
    const firstSerial = firstBrand?.tray_item_brand_serials?.[0]?.serial_number || null
    
    return {
      ...item,
      item_type,
      price: price || 0,
      discount_pct: notesData.discount_pct || 0,
      urgent: notesData.urgent || false,
      name_snapshot: notesData.name_snapshot || notesData.name || '',
      // Compatibilitate cu câmpurile vechi
      brand: firstBrand?.brand || item.brand || notesData.brand || null,
      serial_number: firstSerial || item.serial_number || notesData.serial_number || null,
      garantie: firstBrand?.garantie || notesData.garantie || false,
      // Include toate brand-urile cu serial numbers pentru popularea formularului
      brand_groups: brandGroups,
      pipeline_id: notesData.pipeline_id || null,
      department,
      qty: item.qty || 1,
    } as LeadQuoteItem & { price: number; department?: string | null; brand_groups?: Array<{ id: string; brand: string; serialNumbers: string[]; garantie: boolean }> }
  })
}

const addPartItem = async (quoteId: string, name: string, unitPrice: number, opts?: any) => {
  const { error } = await createTrayItem({
    tray_id: quoteId,
    name_snapshot: name,
    qty: opts?.qty || 1,
    notes: opts?.notes || null,
    department_id: opts?.department_id || null,
    technician_id: opts?.technician_id || null,
  } as any)
  if (error) throw error
}

const addInstrumentItem = async (quoteId: string, instrumentName: string, opts?: any) => {
  // Asigură-te că avem instrument_id și department_id
  if (!opts?.instrument_id) {
    throw new Error('instrument_id este obligatoriu pentru a salva un instrument')
  }
  if (!opts?.department_id) {
    throw new Error('department_id este obligatoriu pentru a salva un instrument')
  }
  
  // Salvează informații suplimentare în notes ca JSON (pentru compatibilitate)
  const notesData = {
    name_snapshot: instrumentName,
    item_type: null, // null înseamnă doar instrument, fără serviciu
    pipeline_id: opts?.pipeline_id || null,
  }
  
  const { error } = await createTrayItem({
    tray_id: quoteId,
    instrument_id: opts.instrument_id,
    department_id: opts.department_id,
    service_id: null, // Doar instrument, fără serviciu
    technician_id: opts?.technician_id || null,
    qty: opts?.qty || 1,
    notes: JSON.stringify(notesData),
    pipeline: opts?.pipeline_id || null,
    // Brand și serial_number se salvează acum în tabelul tray_item_brand_serials
    brandSerialGroups: opts?.brandSerialGroups || (opts?.brand || opts?.serial_number ? [{
      brand: opts?.brand || null,
      serialNumbers: opts?.serial_number ? [opts.serial_number] : [],
      garantie: opts?.garantie || false
    }] : undefined),
  })
  if (error) throw error
}
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus, Wrench, Send, AlertTriangle, Save } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
type Technician = {
  id: string // user_id din app_members
  name: string
}
import { listParts, type Part } from '@/lib/supabase/partOperations'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
const supabase = supabaseBrowser()
import { persistAndLogServiceSheet } from "@/lib/history/serviceSheet"
import { listTags, toggleLeadTag } from '@/lib/supabase/tagOperations'
import { PrintView } from '@/components/print-view'
import type { Lead } from '@/app/(crm)/dashboard/page'
import { Textarea } from "@/components/ui/textarea"

const URGENT_MARKUP_PCT = 30; // +30% per line if urgent

// Componenta pentru calcularea si afisarea datelor de print pentru toate tavitele
function PrintViewData({ 
  lead, 
  quotes, 
  allSheetsTotal, 
  urgentMarkupPct,
  subscriptionType,
  services,
  instruments,
  pipelinesWithIds
}: { 
  lead: Lead
  quotes: LeadQuote[]
  allSheetsTotal: number
  urgentMarkupPct: number
  subscriptionType: 'services' | 'parts' | 'both' | ''
  services: Service[]
  instruments: Array<{ id: string; name: string; weight: number; department_id: string | null; pipeline?: string | null }>
  pipelinesWithIds: Array<{ id: string; name: string }>
}) {
  const [sheetsData, setSheetsData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAllSheetsData = async () => {
      if (!quotes.length) {
        setSheetsData([])
        setLoading(false)
        return
      }

      // OPTIMIZARE: Încarcă toate tray_items-urile pentru toate tăvițele dintr-o dată
      const trayIds = quotes.map(q => q.id)
      const { data: allTrayItems, error: itemsError } = await supabase
        .from('tray_items')
        .select(`
          id, tray_id, instrument_id, service_id, part_id, department_id,
          technician_id, qty, notes, pipeline, created_at,
          tray_item_brands(id, brand, garantie, tray_item_brand_serials(id, serial_number))
        `)
        .in('tray_id', trayIds)
        .order('tray_id, id', { ascending: true })
      
      if (itemsError) {
        console.error('Error loading all tray items:', itemsError)
        setSheetsData([])
        setLoading(false)
        return
      }
      
      // Grupează items-urile pe tăviță
      const itemsByTray = new Map<string, TrayItem[]>()
      allTrayItems?.forEach((item: TrayItem) => {
        if (!itemsByTray.has(item.tray_id)) {
          itemsByTray.set(item.tray_id, [])
        }
        itemsByTray.get(item.tray_id)!.push(item)
      })

      // Creează map-uri pentru instrumente și pipeline-uri (o singură dată)
      const instrumentPipelineMap = new Map<string, string | null>()
      const pipelineMap = new Map<string, string>()
      
      if (instruments) {
        instruments.forEach(inst => {
          if (inst.pipeline) {
            instrumentPipelineMap.set(inst.id, inst.pipeline)
          }
        })
      }
      
      if (pipelinesWithIds) {
        pipelinesWithIds.forEach(p => {
          pipelineMap.set(p.id, p.name)
        })
      }

      // Procesează fiecare tăviță (fără query-uri suplimentare)
      const sheets = quotes.map((quote) => {
          const trayItems = itemsByTray.get(quote.id) || []
          
          // Transformă TrayItem în LeadQuoteItem (aceeași logică ca în listQuoteItems)
          const items = trayItems.map((item: TrayItem) => {
            let notesData: any = {}
            if (item.notes) {
              try {
                notesData = JSON.parse(item.notes)
              } catch (e) {}
            }
            
            let item_type: 'service' | 'part' | null = notesData.item_type || null
            if (!item_type) {
              if (item.service_id) {
                item_type = 'service'
              } else if (notesData.name || !item.instrument_id) {
                item_type = 'part'
              }
            }
            
            let price = notesData.price || 0
            if (!price && item_type === 'service' && item.service_id && services) {
              const service = services.find((s: any) => s.id === item.service_id)
              price = service?.price || 0
            }
            
            let department: string | null = null
            let instrumentId = item.instrument_id
            
            if (!instrumentId && item_type === 'service' && item.service_id && services) {
              const service = services.find((s: any) => s.id === item.service_id)
              if (service?.instrument_id) {
                instrumentId = service.instrument_id
              }
            }
            
            if (instrumentId && instrumentPipelineMap.size > 0 && pipelineMap.size > 0) {
              const pipelineId = instrumentPipelineMap.get(instrumentId)
              if (pipelineId) {
                department = pipelineMap.get(pipelineId) || null
              }
            }
            
            return {
              ...item,
              item_type,
              price: price || 0,
              discount_pct: notesData.discount_pct || 0,
              urgent: notesData.urgent || false,
              name_snapshot: notesData.name_snapshot || notesData.name || '',
              brand: notesData.brand || null,
              serial_number: notesData.serial_number || null,
              garantie: notesData.garantie || false,
              pipeline_id: notesData.pipeline_id || null,
              department,
              qty: item.qty || 1,
            } as LeadQuoteItem & { price: number; department?: string | null }
          })
          
          // Exclude items-urile cu item_type: null (doar instrument, fără serviciu) din calculele de totaluri
          const visibleItems = items.filter(it => it.item_type !== null)
          
          // Calculeaza totalurile pentru aceasta tavita
          const subtotal = visibleItems.reduce((acc, it) => acc + it.qty * it.price, 0)
          const totalDiscount = visibleItems.reduce(
            (acc, it) => acc + it.qty * it.price * (Math.min(100, Math.max(0, it.discount_pct)) / 100),
            0
          )
          const urgentAmount = visibleItems.reduce((acc, it) => {
            const afterDisc = it.qty * it.price * (1 - Math.min(100, Math.max(0, it.discount_pct)) / 100)
            return acc + (it.urgent ? afterDisc * (urgentMarkupPct / 100) : 0)
          }, 0)

          // Calculeaza discount-urile pentru abonament (10% servicii, 5% piese)
          const servicesTotal = items
            .filter(it => it.item_type === 'service')
            .reduce((acc, it) => {
              const base = it.qty * it.price
              const disc = base * (Math.min(100, Math.max(0, it.discount_pct)) / 100)
              const afterDisc = base - disc
              const urgent = it.urgent ? afterDisc * (URGENT_MARKUP_PCT / 100) : 0
              return acc + afterDisc + urgent
            }, 0)
          
          const partsTotal = items
            .filter(it => it.item_type === 'part')
            .reduce((acc, it) => {
              const base = it.qty * it.price
              const disc = base * (Math.min(100, Math.max(0, it.discount_pct)) / 100)
              return acc + base - disc
            }, 0)
          
          let subscriptionDiscountAmount = 0
          if (subscriptionType === 'services' || subscriptionType === 'both') {
            subscriptionDiscountAmount += servicesTotal * 0.10
          }
          if (subscriptionType === 'parts' || subscriptionType === 'both') {
            subscriptionDiscountAmount += partsTotal * 0.05
          }

          const total = subtotal - totalDiscount + urgentAmount - subscriptionDiscountAmount

          return {
            quote,
            items,
            subtotal,
            totalDiscount,
            urgentAmount,
            total,
            hasSubscription: subscriptionType !== '',
            subscriptionDiscountServices: (subscriptionType === 'services' || subscriptionType === 'both') ? 10 : undefined,
            subscriptionDiscountParts: (subscriptionType === 'parts' || subscriptionType === 'both') ? 5 : undefined,
            isCash: (quote as any).is_cash || false,
            isCard: (quote as any).is_card || false,
          }
        })

      setSheetsData(sheets)
      setLoading(false)
    }

    loadAllSheetsData()
  }, [quotes, subscriptionType, urgentMarkupPct, services, instruments, pipelinesWithIds])

  if (loading) return null

  return (
    <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '210mm' }}>
      <PrintView
        lead={lead}
        sheets={sheetsData}
        allSheetsTotal={allSheetsTotal}
        urgentMarkupPct={urgentMarkupPct}
      />
    </div>
  )
}

// Definiție pachete de mentenanță pentru instrumente
// Mapare: nume instrument -> pachet de mentenanță (nume + servicii incluse)
const MAINTENANCE_PACKAGES: Record<string, { name: string; serviceNames: string[] }> = {
  'FORFECUȚE CUTICULE DREAPTA': {
    name: 'Pachet Mentenanță - FORFECUȚE CUTICULE DREAPTA',
    serviceNames: ['Ascuțire', 'Curățare chimică instrumente', 'Reparație vârf', 'Polish']
  },
  'FORFECUȚE CUTICULE STÂNGA': {
    name: 'Pachet Mentenanță - FORFECUȚE CUTICULE STÂNGA',
    serviceNames: ['Ascuțire', 'Curățare chimică instrumente', 'Reparație vârf', 'Polish']
  },
  'FORFECUȚE UNGHII': {
    name: 'Pachet Mentenanță - FORFECUȚE UNGHII',
    serviceNames: ['Ascuțire', 'Curățare chimică instrumente', 'Reparație vârf', 'Polish']
  },
  'CLEȘTE CUTICULE': {
    name: 'Pachet Mentenanță - CLEȘTE CUTICULE',
    serviceNames: ['Ascuțire', 'Curățare chimică instrumente', 'Reparație vârf', 'Polish']
  },
  'CLEȘTE UNGHII': {
    name: 'Pachet Mentenanță - CLEȘTE UNGHII',
    serviceNames: ['Ascuțire', 'Curățare chimică instrumente', 'Reparație vârf', 'Polish']
  },
  'CAPĂT PUSHER (1 capăt)': {
    name: 'Pachet Mentenanță - CAPĂT PUSHER (1 capăt)',
    serviceNames: ['Ascuțire', 'Curățare chimică instrumente', 'Polish']
  },
  'CAPĂT CHIURETĂ (1 capăt)': {
    name: 'Pachet Mentenanță - CAPĂT CHIURETĂ (1 capăt)',
    serviceNames: ['Ascuțire', 'Curățare chimică instrumente', 'Polish']
  },
  'CAPĂT PUSHER/CHIURETĂ (2 capete)': {
    name: 'Pachet Mentenanță - CAPĂT PUSHER/CHIURETĂ (2 capete)',
    serviceNames: ['Ascuțire', 'Curățare chimică instrumente', 'Polish']
  },
  'PENSETĂ': {
    name: 'Pachet Mentenanță - PENSETĂ',
    serviceNames: ['Ascuțire', 'Curățare chimică instrumente', 'Polish']
  },
  'BRICI': {
    name: 'Pachet Mentenanță - BRICI',
    serviceNames: ['Ascuțire', 'Polish', 'Ascuțire/Recondiționare alte tipuri de lame']
  },
  'FOARFECA DE TUNS / FILAT CU LAMĂ CLASICĂ SAU CONVEXĂ': {
    name: 'Pachet Mentenanță - FOARFECA DE TUNS / FILAT CU LAMĂ CLASICĂ SAU CONVEXĂ',
    serviceNames: ['Ascuțire', 'Reparații', 'Polish', 'Ascuțire/Recondiționare alte tipuri de lame']
  }
}

// Tip special pentru pachetul de mentenanță în lista de servicii
type MaintenancePackageOption = {
  id: string // 'MAINTENANCE_PACKAGE'
  name: string
  isPackage: true
  serviceNames: string[]
  instrumentName: string
}

// Tip pentru ref-ul expus
export interface PreturiRef {
  save: () => Promise<void>
  getSelectedTrayId: () => string | null
}

interface PreturiProps {
  leadId: string
  lead?: Lead | null
  fisaId?: string | null
  initialQuoteId?: string | null
  pipelineSlug?: string
  isDepartmentPipeline?: boolean
}

const Preturi = forwardRef<PreturiRef, PreturiProps>(function Preturi({ leadId, lead, fisaId, initialQuoteId, pipelineSlug, isDepartmentPipeline = false }, ref) {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  // sheets (tavite)
  const [quotes, setQuotes] = useState<LeadQuote[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const selectedQuote = useMemo(
    () => quotes.find(q => q.id === selectedQuoteId) ?? null,
    [quotes, selectedQuoteId]
  );

  // Total across all sheets
  const [allSheetsTotal, setAllSheetsTotal] = useState<number>(0);
  const [items, setItems] = useState<LeadQuoteItem[]>([]);
  
  // State pentru imagini tăviță
  const [trayImages, setTrayImages] = useState<TrayImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isImagesExpanded, setIsImagesExpanded] = useState(false);

  // State pentru detalii tăviță (comentarii per tăviță, în Fișa de serviciu)
  const [trayDetailsMap, setTrayDetailsMap] = useState<Map<string, string>>(new Map())
  const [selectedTrayForDetails, setSelectedTrayForDetails] = useState<string | null>(null)
  const [trayDetails, setTrayDetails] = useState('')
  const [loadingTrayDetails, setLoadingTrayDetails] = useState(false)
  const [savingTrayDetails, setSavingTrayDetails] = useState(false)

  // ID-ul efectiv al tăviței pentru care edităm detaliile:
  // - dacă utilizatorul alege explicit din dropdown -> selectedTrayForDetails
  // - altfel -> tăvița selectată în tab-uri (selectedQuoteId)
  const activeTrayDetailsId = selectedTrayForDetails || selectedQuoteId || null

  const [pipelines, setPipelines] = useState<string[]>([])
  const [pipelinesWithIds, setPipelinesWithIds] = useState<Array<{ id: string; name: string }>>([])
  const [pipeLoading, setPipeLoading] = useState(true)
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([])

  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [parts, setParts] = useState<Part[]>([])
  const [instruments, setInstruments] = useState<Array<{ id: string; name: string; weight: number; department_id: string | null }>>([])

  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  
  // State pentru checkbox cash/card
  const [isCash, setIsCash] = useState(false)
  const [isCard, setIsCard] = useState(false)
  
  // State pentru checkbox-uri livrare (Office direct / Curier Trimis)
  const [officeDirect, setOfficeDirect] = useState(false)
  const [curierTrimis, setCurierTrimis] = useState(false)

  // State pentru "No Deal" la nivel de fișă (doar în Vânzări)
  const [noDeal, setNoDeal] = useState(false)

  // State pentru urgent global (pentru toate serviciile)
  const [urgentAllServices, setUrgentAllServices] = useState(false)

  // State pentru trimiterea tăvițelor în pipeline-urile departamentelor
  const [sendingTrays, setSendingTrays] = useState(false)
  const [showSendConfirmation, setShowSendConfirmation] = useState(false)
  const [traysAlreadyInDepartments, setTraysAlreadyInDepartments] = useState(false)

  // State pentru ștergerea tăvițelor
  const [showDeleteTrayConfirmation, setShowDeleteTrayConfirmation] = useState(false)
  const [trayToDelete, setTrayToDelete] = useState<string | null>(null)
  const [deletingTray, setDeletingTray] = useState(false)

  // State pentru dialog-ul de creare tăviță
  const [showCreateTrayDialog, setShowCreateTrayDialog] = useState(false)
  const [newTrayNumber, setNewTrayNumber] = useState('')
  const [newTraySize, setNewTraySize] = useState('medium')
  const [creatingTray, setCreatingTray] = useState(false)
  
  // State pentru dialog-ul de editare tăviță
  const [showEditTrayDialog, setShowEditTrayDialog] = useState(false)
  const [editingTrayNumber, setEditingTrayNumber] = useState('')
  const [editingTraySize, setEditingTraySize] = useState('medium')
  const [updatingTray, setUpdatingTray] = useState(false)

  // State pentru abonament: '' | 'services' | 'parts' | 'both'
  const [subscriptionType, setSubscriptionType] = useState<'services' | 'parts' | 'both' | ''>('')

  const tempId = () => `local_${Math.random().toString(36).slice(2, 10)}`

  // Verificări pentru restricții bazate pe rol și pipeline
  const { role, loading: roleLoading } = useRole()
  const { user } = useAuth()
  const [isTechnician, setIsTechnician] = useState(false)
  
  // Verifică dacă utilizatorul există în app_members
  useEffect(() => {
    async function checkTechnician() {
      if (!user?.id) {
        setIsTechnician(false)
        return
      }
      // Verifică dacă utilizatorul există în app_members
      const supabase = supabaseBrowser()
      const { data } = await supabase
        .from('app_members')
        .select('user_id')
        .eq('user_id', user.id)
        .single()
      setIsTechnician(!!data)
    }
    checkTechnician()
  }, [user])

  // Verifică dacă utilizatorul este vânzător (nu tehnician)
  const isVanzator = !isTechnician && (role === 'admin' || role === 'owner' || role === 'member')

  // Verifică dacă suntem în pipeline-ul Vânzări
  const isVanzariPipeline = useMemo(() => {
    if (!pipelineSlug) return false
    return pipelineSlug.toLowerCase().includes('vanzari') || pipelineSlug.toLowerCase().includes('sales')
  }, [pipelineSlug])

  // Verifică dacă suntem în pipeline-ul Reparații
  const isReparatiiPipeline = useMemo(() => {
    if (!pipelineSlug) return false
    return pipelineSlug.toLowerCase().includes('reparatii') || pipelineSlug.toLowerCase().includes('repair')
  }, [pipelineSlug])

  // Verifică dacă suntem în pipeline-ul Recepție
  const isReceptiePipeline = useMemo(() => {
    if (!pipelineSlug) return false
    return pipelineSlug.toLowerCase().includes('receptie') || pipelineSlug.toLowerCase().includes('reception')
  }, [pipelineSlug])

  // Verifică dacă suntem în pipeline-ul Curier
  // Verifică dacă pipeline-ul permite adăugarea de imagini (Saloane, Frizerii, Horeca, Reparatii)
  const canAddTrayImages = useMemo(() => {
    if (!pipelineSlug) return false
    const slug = pipelineSlug.toLowerCase()
    return slug.includes('saloane') || 
           slug.includes('frizerii') || 
           slug.includes('horeca') || 
           slug.includes('reparatii')
  }, [pipelineSlug])

  const isCurierPipeline = useMemo(() => {
    if (!pipelineSlug) return false
    return pipelineSlug.toLowerCase().includes('curier')
  }, [pipelineSlug])

  // Pipeline-uri comerciale unde vrem să afișăm detalii de tăviță în Fișa de serviciu
  const isCommercialPipeline = isVanzariPipeline || isReceptiePipeline || isCurierPipeline

  // Restricții pentru tehnicieni în pipeline-urile departament
  // Urgent și Abonament sunt disponibile doar în Recepție/Vânzări/Curier (NU pentru tehnicieni în departament)
  const canEditUrgentAndSubscription = useMemo(() => {
    // În pipeline departament, tehnicianul nu poate modifica Urgent sau Abonament
    if (isDepartmentPipeline) return false
    // În alte pipeline-uri (Recepție, Vânzări, Curier), toți pot modifica
    return true
  }, [isDepartmentPipeline])

  // Tehnicianul poate adăuga piese doar în Reparații
  const canAddParts = useMemo(() => {
    if (isDepartmentPipeline) {
      return isReparatiiPipeline
    }
    return true // În alte pipeline-uri se pot adăuga piese
  }, [isDepartmentPipeline, isReparatiiPipeline])

  // State pentru a stoca cantitatea, brand, serial numbers și garantie pentru fiecare instrument
  // Notă: pipeline_id (pentru departament) este gestionat direct în items, nu în instrumentSettings
  const [instrumentSettings, setInstrumentSettings] = useState<Record<string, {
    qty: string;
    brandSerialGroups: Array<{ brand: string; serialNumbers: string[] }>;
    garantie: boolean;
  }>>({})

  // Add-instrument form state
  // Structură: array de grupuri brand + serial numbers
  const [instrumentForm, setInstrumentForm] = useState({
    instrument: '',
    brandSerialGroups: [{ brand: '', serialNumbers: [''] }] as Array<{ brand: string; serialNumbers: string[] }>,
    garantie: false,
    qty: '1'
  })

  // Add-service form state
  const [svc, setSvc] = useState({
    instrumentId: '',
    id: '',
    qty: '1',
    discount: '0',
    urgent: false,
    technicianId: '',
    pipelineId: '', // pipeline_id pentru servicii (folosit pentru departament)
    serialNumberId: '', // ID-ul serial number-ului atribuit
  })

  // Afișează toate instrumentele disponibile din tabelul instruments
  const availableInstruments = useMemo(() => {
    return instruments.sort((a, b) => a.name.localeCompare(b.name, 'ro'))
  }, [instruments])

  // Add-part form state
  const [part, setPart] = useState({
    id: '',
    overridePrice: '',
    qty: '1',
    discount: '0',
    urgent: false,
    serialNumberId: '' // format: "brand::serialNumber"
  })

  // Search state pentru servicii și piese
  const [serviceSearchQuery, setServiceSearchQuery] = useState('')
  const [partSearchQuery, setPartSearchQuery] = useState('')
  
  // Focus state pentru a afișa dropdown-ul când input-ul este focusat
  const [serviceSearchFocused, setServiceSearchFocused] = useState(false)
  const [partSearchFocused, setPartSearchFocused] = useState(false)

  const lastSavedRef = useRef<any[]>([])
  const [urgentTagId, setUrgentTagId] = useState<string | null>(null)

  // gaseste tag-ul urgent la incarcare
  useEffect(() => {
    (async () => {
      const tags = await listTags()
      const urgentTag = tags.find(t => t.name.toLowerCase() === 'urgent')
      if (urgentTag) {
        setUrgentTagId(urgentTag.id)
      }
    })()
  }, [])

  // Sincronizează instrumentForm.instrument cu svc.instrumentId
  useEffect(() => {
    if (svc.instrumentId !== instrumentForm.instrument || svc.qty !== instrumentForm.qty) {
      const savedSettings = instrumentSettings[svc.instrumentId]
      setInstrumentForm(prev => ({ 
        ...prev, 
        instrument: svc.instrumentId,
        qty: savedSettings?.qty || svc.qty || '1'
      }))
    }
  }, [svc.instrumentId, svc.qty, instrumentSettings])

  // Aplică urgent tuturor serviciilor și pieselor când urgentAllServices e bifat
  useEffect(() => {
    setItems(prev => prev.map(it => 
      (it.item_type === 'service' || it.item_type === 'part') ? { ...it, urgent: urgentAllServices } : it
    ))
    if (urgentAllServices || items.some(it => (it.item_type === 'service' || it.item_type === 'part') && it.urgent !== urgentAllServices)) {
      setIsDirty(true)
    }
  }, [urgentAllServices])

  // verifica si atribuie/elimina tag-ul urgent cand se schimba items-urile
  useEffect(() => {
    if (!urgentTagId || !items.length) return

    const hasUrgentItems = items.some(item => item.urgent === true)
    
    // verifica daca tag-ul urgent este deja atribuit
    const checkAndToggleUrgentTag = async () => {
      try {
        // verifica daca tag-ul este atribuit
        const { data: existing } = await supabase
          .from('lead_tags')
          .select('lead_id')
          .eq('lead_id', leadId)
          .eq('tag_id', urgentTagId)
          .maybeSingle()

        if (hasUrgentItems && !existing) {
          // exista items urgente dar tag-ul nu este atribuit - atribuie-l
          await toggleLeadTag(leadId, urgentTagId)
        } else if (!hasUrgentItems && existing) {
          // nu exista items urgente dar tag-ul este atribuit - elimina-l
          await toggleLeadTag(leadId, urgentTagId)
        }
      } catch (error) {
        console.error('Eroare la gestionarea tag-ului urgent:', error)
      }
    }

    checkAndToggleUrgentTag()
  }, [items, urgentTagId, leadId])

  async function refreshPipelines() {
    setPipeLoading(true)
    try {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id,name,is_active,position')
        .eq('is_active', true)
        .order('position', { ascending: true })
      if (error) throw error
      setPipelines((data ?? []).map((r: any) => r.name))
      setPipelinesWithIds((data ?? []).map((r: any) => ({ id: r.id, name: r.name })))
    } finally { setPipeLoading(false) }
  }

  async function refreshDepartments() {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id,name')
        .order('name', { ascending: true })
      if (error) throw error
      setDepartments((data ?? []).map((r: any) => ({ id: r.id, name: r.name })))
    } catch (error) {
      console.error('Error loading departments:', error)
    }
  }

  // Încarcă detaliile pentru toate tăvițele disponibile (comentarii per tăviță)
  useEffect(() => {
    // Doar în pipeline-urile comerciale folosim această secțiune în Fișa de serviciu
    const loadTrayDetails = async () => {
      if (!isCommercialPipeline || !quotes.length) {
        setTrayDetailsMap(new Map())
        setSelectedTrayForDetails(null)
        setTrayDetails('')
        return
      }

      setLoadingTrayDetails(true)
      try {
        const trayIds = quotes.map(q => q.id)
        const { data, error } = await supabase
          .from('tray_items')
          .select('tray_id, details')
          .in('tray_id', trayIds)

        if (error) {
          console.error('Eroare la încărcarea detaliilor tăvițelor:', error)
          setTrayDetailsMap(new Map())
          return
        }

        const newMap = new Map<string, string>()
        ;(data || []).forEach((row: any) => {
          if (row.tray_id && row.details) {
            if (!newMap.has(row.tray_id)) {
              newMap.set(row.tray_id, row.details)
            }
          }
        })

        setTrayDetailsMap(newMap)
      } catch (err) {
        console.error('Eroare la încărcarea detaliilor tăvițelor:', err)
        setTrayDetailsMap(new Map())
        setTrayDetails('')
      } finally {
        setLoadingTrayDetails(false)
      }
    }

    loadTrayDetails()
  // quotes se schimbă când se schimbă tăvițele
  }, [isCommercialPipeline, quotes])

  // Când se schimbă tăvița activă pentru detalii, sincronizăm textul afișat
  useEffect(() => {
    if (!isCommercialPipeline || !activeTrayDetailsId) {
      setTrayDetails('')
      return
    }
    setTrayDetails(trayDetailsMap.get(activeTrayDetailsId) || '')
  }, [isCommercialPipeline, activeTrayDetailsId, trayDetailsMap])

  function computeItemsTotal(sheetItems: LeadQuoteItem[]) {
    // Exclude items-urile cu item_type: null (doar instrument, fără serviciu) din calculele de totaluri
    const visibleItems = sheetItems.filter(it => it.item_type !== null)
    
    // Optimizare: un singur reduce în loc de 3 separate
    const { subtotal, totalDiscount, urgentAmount } = visibleItems.reduce(
      (acc, it) => {
        const base = it.qty * it.price;
        const discPct = Math.min(100, Math.max(0, it.discount_pct)) / 100;
        const disc = base * discPct;
        const afterDisc = base - disc;
        const urgent = it.urgent ? afterDisc * (URGENT_MARKUP_PCT / 100) : 0;
        
        return {
          subtotal: acc.subtotal + base,
          totalDiscount: acc.totalDiscount + disc,
          urgentAmount: acc.urgentAmount + urgent,
        };
      },
      { subtotal: 0, totalDiscount: 0, urgentAmount: 0 }
    );
    
    return subtotal - totalDiscount + urgentAmount;
  }
  
  async function recalcAllSheetsTotal(forQuotes: LeadQuote[]) {
    if (!forQuotes.length) { setAllSheetsTotal(0); return; }
    
    try {
      // Încarcă items-urile pentru toate tăvițele
      const all = await Promise.all(forQuotes.map(q => listQuoteItems(q.id, services, instruments, pipelinesWithIds)));
      
      // Calculează totalul pentru fiecare tăviță (fără subscription discounts)
      let totalSum = 0
      let totalServicesSum = 0
      let totalPartsSum = 0
      
      all.forEach((sheetItems) => {
        // Calculează totalul pentru această tăviță
        const trayTotal = computeItemsTotal(sheetItems ?? [])
        totalSum += trayTotal
        
        // Calculează totalurile pentru servicii și piese (pentru subscription discounts)
        const visibleItems = (sheetItems ?? []).filter(it => it.item_type !== null)
        
        visibleItems.forEach((it) => {
          const base = it.qty * it.price
          const discPct = Math.min(100, Math.max(0, it.discount_pct || 0)) / 100
          const disc = base * discPct
          const afterDisc = base - disc
          const urgent = it.urgent ? afterDisc * (URGENT_MARKUP_PCT / 100) : 0
          const itemTotal = afterDisc + urgent
          
          if (it.item_type === 'service') {
            totalServicesSum += itemTotal
          } else if (it.item_type === 'part') {
            totalPartsSum += itemTotal
          }
        })
      })
      
      // Aplică subscription discounts
      let subscriptionDiscountAmount = 0
      if (subscriptionType === 'services' || subscriptionType === 'both') {
        subscriptionDiscountAmount += totalServicesSum * 0.10
      }
      if (subscriptionType === 'parts' || subscriptionType === 'both') {
        subscriptionDiscountAmount += totalPartsSum * 0.05
      }
      
      // Suma totală finală = suma tăvițelor - discount-uri abonament
      const finalTotal = totalSum - subscriptionDiscountAmount
      setAllSheetsTotal(finalTotal)
      
      console.log('💰 Calcul suma totală fișă:', {
        totalSum,
        totalServicesSum,
        totalPartsSum,
        subscriptionType,
        subscriptionDiscountAmount,
        finalTotal
      })
    } catch (error) {
      console.error('Eroare la calculul sumei totale:', error)
      setAllSheetsTotal(0)
    }
  }

  // Ref pentru funcția de salvare (folosit de useImperativeHandle)
  const saveRef = useRef<() => Promise<void>>(async () => {})

  async function saveAllAndLog() {
    setSaving(true)
    try {
      // Salvează checkbox-urile pentru livrare în service_file ÎNTOTDEAUNA (chiar și fără tăviță)
      console.log('🔍 DEBUG - Checkpoint salvare curier (începutul funcției):', {
        fisaId,
        officeDirect,
        curierTrimis,
        hasFisaId: !!fisaId,
        hasSelectedQuote: !!selectedQuote
      })
      
      if (fisaId) {
        const { error: serviceFileError, data: updatedServiceFile } = await updateServiceFile(fisaId, {
          office_direct: officeDirect,
          curier_trimis: curierTrimis,
          no_deal: noDeal,
        })
        
        if (serviceFileError) {
          console.error('❌ Eroare la actualizarea service_file:', serviceFileError)
          toast.error('Eroare la salvarea checkbox-urilor livrare')
        } else {
          console.log('✅ Service file actualizat cu office_direct:', officeDirect, 'curier_trimis:', curierTrimis, 'data:', updatedServiceFile)
          
          // Adaugă fișa în pipeline-ul "Curier" dacă unul din checkbox-uri este bifat
          if (officeDirect || curierTrimis) {
            const curierPipeline = pipelinesWithIds.find(p => p.name.toLowerCase() === 'curier')
            console.log('Căutare pipeline Curier:', {
              pipelinesWithIds: pipelinesWithIds.map(p => p.name),
              found: curierPipeline?.id,
              officeDirect,
              curierTrimis
            })
            
            if (curierPipeline) {
              const stageNameVariants = officeDirect 
                ? ['Office direct', 'OFFICE DIRECT', 'office direct']
                : ['Curier Trimis', 'CURIER TRIMIS', 'curier trimis', 'Curier trimis']
              
              const { data: allStages, error: allStagesError } = await supabase
                .from('stages')
                .select('id, name')
                .eq('pipeline_id', curierPipeline.id) as { 
                  data: Array<{ id: string; name: string }> | null; 
                  error: any 
                }
              
              let stageData: { id: string } | null = null
              if (allStages && !allStagesError) {
                for (const variant of stageNameVariants) {
                  const stage = allStages.find((s) => s.name?.toLowerCase() === variant.toLowerCase())
                  if (stage) {
                    stageData = { id: stage.id }
                    break
                  }
                }
              }
              
              if (stageData?.id) {
                const { error: pipelineError } = await addServiceFileToPipeline(fisaId, curierPipeline.id, stageData.id)
                if (pipelineError) {
                  console.error('Eroare la adăugarea fișei în pipeline Curier:', pipelineError)
                } else {
                  console.log('✅ Fișa adăugată în pipeline Curier')
                }
              }
            }
          } else {
            // Dacă niciun checkbox nu e bifat, șterge din pipeline Curier
            const curierPipeline = pipelinesWithIds.find(p => p.name.toLowerCase() === 'curier')
            if (curierPipeline) {
              await supabase
                .from('pipeline_items')
                .delete()
                .eq('item_id', fisaId)
                .eq('type', 'service_file')
                .eq('pipeline_id', curierPipeline.id)
            }
          }
        }
      }
      
      // Restul logicii necesită selectedQuote
      if (!selectedQuote) {
        setSaving(false)
        return
      }
      // Verifică dacă există date de brand/serial de salvat
      const instrumentIdToUse = instrumentForm.instrument || svc.instrumentId
      const groupsToSave = instrumentForm.brandSerialGroups.length > 0 
        ? instrumentForm.brandSerialGroups 
        : [{ brand: '', serialNumbers: [''] }]
      
      const hasValidBrandSerialData = groupsToSave.some(g => {
        const hasBrand = g.brand && g.brand.trim()
        const hasSerialNumbers = g.serialNumbers.some(sn => sn && sn.trim())
        return hasBrand || hasSerialNumbers
      })
      
      console.log('🔍 [saveAllAndLog] Checking brand/serial data:', {
        instrumentIdToUse,
        groupsToSave,
        hasValidBrandSerialData,
        itemsCount: items.length
      })
      
      // Dacă există un instrument selectat cu date de brand/serial
      if (instrumentIdToUse && hasValidBrandSerialData) {
        const instrument = instruments.find(i => i.id === instrumentIdToUse)
        if (!instrument || !instrument.name) {
          toast.error('Instrumentul selectat nu a fost găsit')
          setSaving(false)
          return
        }
        
        // Verifică dacă instrumentul are department_id
        if (!instrument.department_id) {
          toast.error('Instrumentul selectat nu are departament setat.')
          setSaving(false)
          return
        }
        
        const savedSettings = instrumentSettings[instrumentIdToUse] || {}
        const garantie = instrumentForm.garantie || savedSettings.garantie || false
        const qty = Number(instrumentForm.qty || savedSettings.qty || 1)
        
        // Determină pipeline_id automat bazat pe department_id al instrumentului
        let autoPipelineId: string | null = null
        if (instrument.department_id) {
          const instrumentDept = departments.find(d => d.id === instrument.department_id)
          const deptName = instrumentDept?.name?.toLowerCase() || instrument.department_id?.toLowerCase()
          if (deptName === 'reparatii') {
            const reparatiiPipeline = pipelinesWithIds.find(p => p.name.toLowerCase() === 'reparatii')
            if (reparatiiPipeline) {
              autoPipelineId = reparatiiPipeline.id
            }
          }
        }
        
        // Verifică dacă există deja un tray_item pentru acest instrument
        const existingItem = items.find((i: any) => i.instrument_id === instrumentIdToUse)
        
        const brandSerialGroupsToSend = groupsToSave.map(g => ({
          brand: g.brand?.trim() || null,
          serialNumbers: g.serialNumbers.filter(sn => sn && sn.trim()).map(sn => sn.trim()),
          garantie: garantie
        })).filter(g => g.brand || g.serialNumbers.length > 0)
        
        console.log('📤 [saveAllAndLog] Brand serial groups to send:', brandSerialGroupsToSend)
        
        try {
          if (existingItem) {
            // Actualizează brand-urile și serial numbers pentru item-ul existent
            console.log('📝 [saveAllAndLog] Updating existing item:', existingItem.id)
            
            const supabaseClient = supabaseBrowser()
            let useNewStructure = true
            
            // Încearcă să șteargă din noile tabele
            const { error: deleteError } = await supabaseClient
              .from('tray_item_brands' as any)
              .delete()
              .eq('tray_item_id', existingItem.id)
            
            if (deleteError) {
              // Dacă tabelul nu există, folosește câmpurile vechi
              if (deleteError.code === '42P01' || deleteError.message?.includes('does not exist')) {
                console.warn('⚠️ New tables not found, using legacy fields')
                useNewStructure = false
              } else {
                console.error('❌ Error deleting old brands:', deleteError)
              }
            }
            
            // Adaugă noile brand-uri și serial numbers
            if (brandSerialGroupsToSend.length > 0 && useNewStructure) {
              for (const group of brandSerialGroupsToSend) {
                const brandName = group.brand?.trim()
                if (!brandName) continue
                
                const groupGarantie = group.garantie || false
                const serialNumbers = group.serialNumbers.filter(sn => sn && sn.trim())
                
                console.log('💾 [saveAllAndLog] Creating brand:', brandName, 'with', serialNumbers.length, 'serials')
                
                // 1. Creează brand-ul
                const { data: brandResult, error: brandError } = await (supabaseClient
                  .from('tray_item_brands') as any)
                  .insert([{
                    tray_item_id: existingItem.id,
                    brand: brandName,
                    garantie: groupGarantie,
                  }])
                  .select()
                  .single()
                
                if (brandError) {
                  console.error('❌ Error creating brand:', brandError)
                  // Fallback la câmpurile vechi
                  useNewStructure = false
                  break
                }
                
                console.log('✅ Brand created:', (brandResult as any).id)
                
                // 2. Creează serial numbers pentru acest brand
                if (serialNumbers.length > 0) {
                  const serialsToInsert = serialNumbers.map(sn => ({
                    brand_id: (brandResult as any).id,
                    serial_number: sn.trim(),
                  }))
                  
                  const { error: serialsError } = await supabaseClient
                    .from('tray_item_brand_serials' as any)
                    .insert(serialsToInsert as any)
                  
                  if (serialsError) {
                    console.error('❌ Error creating serials:', serialsError)
                  } else {
                    console.log('✅ Serial numbers created:', serialNumbers.length)
                  }
                }
              }
            }
            
            // Notă: câmpurile brand și serial_number nu mai există în tray_items
            // Toate datele se salvează în tray_item_brands și tray_item_brand_serials
          } else {
            // Creează un nou tray_item cu brand-urile și serial numbers
            console.log('🆕 [saveAllAndLog] Creating new instrument item')
            
            await addInstrumentItem(
              selectedQuote.id,
              instrument.name,
              {
                instrument_id: instrument.id,
                department_id: instrument.department_id,
                qty: qty,
                discount_pct: 0,
                urgent: false,
                technician_id: null,
                pipeline_id: autoPipelineId,
                brandSerialGroups: brandSerialGroupsToSend
              }
            )
          }
          
          console.log('✅ [saveAllAndLog] Brand/serial data saved successfully')
          toast.success('Brand și serial numbers salvate cu succes!')
          
          // Reîncarcă items pentru quote
          const newItems = await listQuoteItems(selectedQuote.id, services, instruments, pipelinesWithIds)
          setItems(newItems)
          
          // Populează formularul cu datele noi încărcate
          populateInstrumentFormFromItems(newItems, instrumentIdToUse, true)
          
          // Actualizează lastSavedRef
          lastSavedRef.current = (newItems ?? []).map((i: any) => ({
            id: String(i.id),
            name: i.name_snapshot,
            qty: Number(i.qty ?? 1),
            price: Number(i.price ?? 0),
            type: i.item_type ?? null,
            urgent: !!i.urgent,
            department: i.department ?? null,
            technician_id: i.technician_id ?? null,
            pipeline_id: i.pipeline_id ?? null,
            brand: i.brand ?? null,
            serial_number: i.serial_number ?? null,
            garantie: !!i.garantie,
          }))
          
          // Păstrează instrumentul selectat
          if (instrumentIdToUse) {
            setSvc(prev => ({ ...prev, instrumentId: instrumentIdToUse }))
            setInstrumentForm(prev => ({ ...prev, instrument: instrumentIdToUse }))
          }
          
          // Dacă nu există alte items de salvat, finalizează aici
          if (items.length === 0 || (items.length === 1 && existingItem)) {
            await recalcAllSheetsTotal(quotes)
            toast.success('Instrumentul și datele brand/serial au fost salvate!')
            setIsDirty(false)
            setSaving(false)
            return
          }
          
        } catch (error: any) {
          console.error('❌ Error saving brand/serial data:', error)
          toast.error('Eroare la salvarea datelor brand/serial: ' + (error.message || 'Eroare necunoscută'))
          setSaving(false)
          return
        }
      }
      
      // Dacă doar instrument fără brand/serial și nu există items
      if (instrumentIdToUse && items.length === 0 && !hasValidBrandSerialData) {
        const instrument = instruments.find(i => i.id === instrumentIdToUse)
        if (instrument && instrument.department_id) {
          const savedSettings = instrumentSettings[instrumentIdToUse] || {}
          const garantie = instrumentForm.garantie || savedSettings.garantie || false
          const qty = Number(instrumentForm.qty || savedSettings.qty || 1)
          
          let autoPipelineId: string | null = null
          const instrumentDept = departments.find(d => d.id === instrument.department_id)
          const deptName = instrumentDept?.name?.toLowerCase() || instrument.department_id?.toLowerCase()
          if (deptName === 'reparatii') {
            const reparatiiPipeline = pipelinesWithIds.find(p => p.name.toLowerCase() === 'reparatii')
            if (reparatiiPipeline) autoPipelineId = reparatiiPipeline.id
          }
          
          try {
            await addInstrumentItem(selectedQuote.id, instrument.name, {
              instrument_id: instrument.id,
              department_id: instrument.department_id,
              qty: qty,
              pipeline_id: autoPipelineId,
            })
            
            const newItems = await listQuoteItems(selectedQuote.id, services, instruments, pipelinesWithIds)
            setItems(newItems)
            lastSavedRef.current = (newItems ?? []).map((i: any) => ({
              id: String(i.id), name: i.name_snapshot, qty: Number(i.qty ?? 1),
              price: Number(i.price ?? 0), type: i.item_type ?? null, urgent: !!i.urgent,
              department: i.department ?? null, technician_id: i.technician_id ?? null,
              pipeline_id: i.pipeline_id ?? null, brand: i.brand ?? null,
              serial_number: i.serial_number ?? null, garantie: !!i.garantie,
            }))
            
            await recalcAllSheetsTotal(quotes)
            toast.success('Instrumentul a fost salvat!')
            setIsDirty(false)
            setSaving(false)
            return
          } catch (error: any) {
            console.error('❌ Error saving instrument:', error)
            toast.error('Eroare: ' + (error.message || 'Eroare necunoscută'))
            setSaving(false)
            return
          }
        }
      }
      
      // Logica normală pentru salvare (dacă există items sau nu e doar instrument)
      // Pregătește datele pentru salvare
      const updateData: any = {
        is_cash: isCash,
        is_card: isCard,
        urgent: urgentAllServices, // Salvează starea urgentă pe tăviță
      }
      
      // Adaugă subscription_type doar dacă este valid
      if (subscriptionType && ['services', 'parts', 'both'].includes(subscriptionType)) {
        updateData.subscription_type = subscriptionType
      } else {
        updateData.subscription_type = null
      }
      
      console.log('Salvare quote:', { quoteId: selectedQuote.id, updateData })
      
      // salveaza cash/card, urgent si abonament in baza de date
      // Notă: is_cash, is_card, subscription_type nu există în noua arhitectură
      // Acestea sunt ignorate pentru moment, dar urgent se salvează pe tăviță
      try {
        await updateQuote(selectedQuote.id, updateData)
        console.log('Quote actualizat cu succes (inclusiv urgent:', urgentAllServices, ')')
      } catch (updateError: any) {
        // Dacă eroarea este PGRST116 (nu există rânduri), ignorăm pentru că
        // probabil nu există actualizări pentru câmpurile care există în trays
        if (updateError?.code === 'PGRST116') {
          console.warn('Nu există actualizări pentru tray (doar is_cash/is_card/subscription_type care nu există în noua arhitectură)')
        } else {
          throw updateError
        }
      }
      
      console.log('🔧 Pregătire salvare tăviță:', {
        leadId,
        quoteId: selectedQuote.id,
        itemsCount: items.length,
        items: items.map(it => ({ 
          id: it.id, 
          type: it.item_type, 
          name: it.name_snapshot,
          service_id: it.service_id,
          instrument_id: it.instrument_id,
          department_id: it.department_id
        })),
        prevSnapshotCount: (lastSavedRef.current as any)?.length || 0,
      })
      
      // Verifică să nu existe mai mult de 2 instrumente diferite pe tăvița curentă
      const instrumentIds = Array.from(
        new Set(
          items
            .filter(it => it.instrument_id)
            .map(it => String(it.instrument_id))
        )
      )
      if (instrumentIds.length > 2) {
        toast.error('Maxim 2 instrumente pot fi asociate aceleiași tăvițe.')
        return
      }

      const { items: fresh, snapshot } = await persistAndLogServiceSheet({
        leadId,
        quoteId: selectedQuote.id,
        items,
        services,
        instruments, // Trimite instrumentele pentru a obține department_id
        totals: { subtotal, totalDiscount, urgentAmount, total },
        prevSnapshot: lastSavedRef.current as any,
        pipelinesWithIds, // Trimite pipeline-urile cu ID-uri pentru a seta automat "Reparatii" pentru piese
      })
      console.log('Items salvați cu succes:', { freshCount: fresh.length })
      
      setItems(fresh)
      lastSavedRef.current = snapshot
      setIsDirty(false);
      
      // Recalculează totalurile
      await recalcAllSheetsTotal(quotes)
      
      toast.success('Fișa de serviciu a fost salvată cu succes!')
    } catch (error: any) {
      console.error('Eroare la salvare:', error)
      // Log detalii eroare mai complet
      console.error('Detalii eroare complete:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        name: error?.name,
        stack: error?.stack,
        stringified: JSON.stringify(error, Object.getOwnPropertyNames(error || {})),
      })
      
      // Încearcă să extragă un mesaj de eroare util
      let errorMsg = 'Eroare necunoscută la salvare'
      if (error instanceof Error) {
        errorMsg = error.message
      } else if (typeof error === 'string') {
        errorMsg = error
      } else if (error?.message) {
        errorMsg = error.message
      } else if (error?.error_description) {
        errorMsg = error.error_description
      } else if (error?.hint) {
        errorMsg = error.hint
      } else if (error?.details) {
        errorMsg = typeof error.details === 'string' ? error.details : JSON.stringify(error.details)
      }
      
      toast.error(`Eroare la salvare: ${errorMsg}`)
    } finally {
      setSaving(false)
    }
  }

  // Actualizează ref-ul pentru funcția de salvare
  saveRef.current = saveAllAndLog

  // Expune funcția de salvare și tray-ul selectat prin ref
  useImperativeHandle(
    ref,
    () => ({
      save: async () => {
        console.log('🔄 [Preturi] Save called via ref - brandSerialGroups:', instrumentForm.brandSerialGroups)
        await saveRef.current()
        console.log('✅ [Preturi] Save completed')
      },
      getSelectedTrayId: () => selectedQuoteId,
    }),
    [selectedQuoteId, instrumentForm.brandSerialGroups]
  )

  // Funcție pentru validarea tăvițelor înainte de expediere
  const validateTraysBeforeSend = async (): Promise<{ valid: boolean; errors: string[] }> => {
    const errors: string[] = []
    
    for (let i = 0; i < quotes.length; i++) {
      const tray = quotes[i]
      const trayItems = await listQuoteItems(tray.id, services, instruments, pipelinesWithIds)
      
      // Verifică dacă tăvița are items
      if (trayItems.length === 0) {
        errors.push(`Tăvița ${i + 1} este goală`)
        continue
      }
      
      // Verifică dacă tăvița are cel puțin un serviciu atașat
      const hasServices = trayItems.some((item: any) => item.item_type === 'service' || item.service_id)
      if (!hasServices) {
        errors.push(`Tăvița ${i + 1} nu are servicii atașate`)
      }
    }
    
    return { valid: errors.length === 0, errors }
  }

  // Funcție pentru verificarea dacă tăvițele sunt deja în departamente
  const checkTraysInDepartments = async (trayIds: string[]) => {
    if (trayIds.length === 0) {
      console.log('🔍 checkTraysInDepartments: Nu există tăvițe de verificat')
      setTraysAlreadyInDepartments(false)
      return
    }

    try {
      console.log('🔍 checkTraysInDepartments: Verificare pentru tăvițe:', trayIds)
      
      // Obține pipeline-urile departamentelor (Saloane, Horeca, Frizerii, Reparatii)
      const { data: deptPipelines, error: deptError } = await supabase
        .from('pipelines')
        .select('id, name')
        .in('name', ['Saloane', 'Horeca', 'Frizerii', 'Reparatii'])

      if (deptError) {
        console.error('❌ Eroare la obținerea pipeline-urilor departamentelor:', deptError)
        setTraysAlreadyInDepartments(false)
        return
      }

      if (!deptPipelines || deptPipelines.length === 0) {
        console.log('🔍 checkTraysInDepartments: Nu s-au găsit pipeline-uri pentru departamente')
        setTraysAlreadyInDepartments(false)
        return
      }

      const deptPipelineIds = deptPipelines.map((p: any) => p.id)
      console.log('🔍 checkTraysInDepartments: Pipeline-uri departamente:', {
        ids: deptPipelineIds,
        names: deptPipelines.map((p: any) => p.name)
      })

      // Verifică dacă există pipeline_items pentru tăvițe în pipeline-urile departamentelor
      const { data: pipelineItems, error } = await supabase
        .from('pipeline_items')
        .select('item_id, pipeline_id')
        .eq('type', 'tray')
        .in('item_id', trayIds)
        .in('pipeline_id', deptPipelineIds)

      if (error) {
        console.error('❌ Eroare la verificarea tăvițelor în departamente:', error)
        setTraysAlreadyInDepartments(false)
        return
      }

      // Dacă există cel puțin un pipeline_item, tăvițele sunt deja în departamente
      const hasTraysInDepartments = pipelineItems && pipelineItems.length > 0
      setTraysAlreadyInDepartments(hasTraysInDepartments)

      console.log('🔍 Verificare tăvițe în departamente:', {
        trayIds,
        deptPipelineIds,
        pipelineItemsFound: pipelineItems?.length || 0,
        pipelineItems: pipelineItems,
        hasTraysInDepartments,
        result: hasTraysInDepartments ? 'Tăvițele SUNT deja în departamente' : 'Tăvițele NU sunt în departamente'
      })
    } catch (error) {
      console.error('❌ Eroare la verificarea tăvițelor în departamente:', error)
      setTraysAlreadyInDepartments(false)
    }
  }

  // Funcție pentru trimiterea TUTUROR tăvițelor din fișă în pipeline-urile departamentelor
  const sendAllTraysToPipeline = async () => {
    console.log('🚀 sendAllTraysToPipeline - START:', {
      quotesCount: quotes.length,
      quotes: quotes.map(q => ({ id: q.id, number: q.number }))
    })
    
    if (quotes.length === 0) {
      toast.error('Nu există tăvițe în această fișă')
      return
    }

    // Validează tăvițele înainte de expediere
    setSendingTrays(true)
    const validation = await validateTraysBeforeSend()
    console.log('🔍 Validare tăvițe:', validation)
    
    if (!validation.valid) {
      setSendingTrays(false)
      setShowSendConfirmation(false)
      
      // Afișează erorile
      toast.error(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Nu se pot expedia tăvițele:</span>
          {validation.errors.map((err, idx) => (
            <span key={idx}>• {err}</span>
          ))}
        </div>,
        { duration: 5000 }
      )
      return
    }

    let successCount = 0
    let errorCount = 0
    const results: string[] = []

    try {
      // Procesează fiecare tăviță
      for (const tray of quotes) {
        // Încarcă items-urile pentru această tăviță
        const trayItems = await listQuoteItems(tray.id, services, instruments, pipelinesWithIds)
        
        if (trayItems.length === 0) {
          results.push(`Tăvița ${quotes.indexOf(tray) + 1}: Goală (sărit)`)
          continue
        }

        // Găsește pipeline-ul predominant din items (pe baza câmpului pipeline din instrumente)
        console.log('🔍 Tăvița', quotes.indexOf(tray) + 1, '- Items:', trayItems.map((item: any) => ({
          id: item.id,
          type: item.item_type,
          instrument_id: item.instrument_id,
          service_id: item.service_id
        })))
        
        // Colectează toate instrument_id-urile din items
        const instrumentIds = trayItems
          .map((item: any) => item.instrument_id)
          .filter((id: string | null) => id !== null) as string[]
        
        console.log('🎸 Instrument IDs:', instrumentIds)
        
        // Obține câmpul pipeline (UUID) pentru fiecare instrument și transformă în nume
        const pipelineCounts: Record<string, number> = {}
        
        if (instrumentIds.length > 0) {
          const { data: instrumentsData, error: instrumentsError } = await supabase
            .from('instruments')
            .select('id, pipeline')
            .in('id', instrumentIds)
          
          if (instrumentsError) {
            console.error('Eroare la încărcarea instrumentelor:', instrumentsError)
          } else if (instrumentsData) {
            // Creează un map pentru pipeline ID -> name
            const pipelineIdToName = new Map<string, string>()
            pipelinesWithIds.forEach(p => pipelineIdToName.set(p.id, p.name))
            
            for (const inst of instrumentsData as Array<{ id: string; pipeline: string | null }>) {
              const pipelineId = inst.pipeline
              if (pipelineId) {
                // Transformă UUID-ul pipeline-ului în nume
                const pipelineName = pipelineIdToName.get(pipelineId)
                if (pipelineName) {
                  pipelineCounts[pipelineName] = (pipelineCounts[pipelineName] || 0) + 1
                }
              }
            }
          }
        }
        
        console.log('🏢 Pipeline counts:', pipelineCounts)

        // Găsește pipeline-ul cu cele mai multe items
        let targetPipelineName: string | null = null
        let maxCount = 0
        for (const [pipelineName, count] of Object.entries(pipelineCounts)) {
          if (count > maxCount) {
            maxCount = count
            targetPipelineName = pipelineName
          }
        }
        
        console.log('🎯 Target pipeline name:', targetPipelineName)

        if (!targetPipelineName) {
          results.push(`Tăvița ${quotes.indexOf(tray) + 1}: Nu s-a determinat pipeline-ul (verifică câmpul "pipeline" în instrumente)`)
          errorCount++
          continue
        }

        // Găsește pipeline-ul în lista de pipelines
        const departmentPipeline = pipelinesWithIds.find(p => 
          p.name.toLowerCase() === targetPipelineName.toLowerCase()
        )

        if (!departmentPipeline) {
          results.push(`Tăvița ${quotes.indexOf(tray) + 1}: Pipeline "${targetPipelineName}" negăsit`)
          errorCount++
          continue
        }

        // Găsește stage-ul "Noua" în acest pipeline
        const { data: stages, error: stagesError } = await supabase
          .from('stages')
          .select('id, name, position')
          .eq('pipeline_id', departmentPipeline.id)
          .order('position', { ascending: true })

        if (stagesError || !stages || stages.length === 0) {
          results.push(`Tăvița ${quotes.indexOf(tray) + 1}: Stage-uri negăsite`)
          errorCount++
          continue
        }

        // Caută stage-ul "Noua" sau primul stage
        const stagesTyped = stages as Array<{ id: string; name: string; position: number }>
        const nouaStage = stagesTyped.find(s => s.name.toLowerCase() === 'noua') || stagesTyped[0]

        // Trimite tăvița în pipeline
        console.log('📤 Trimitere tăviță:', {
          trayId: tray.id,
          trayIndex: quotes.indexOf(tray) + 1,
          pipelineId: departmentPipeline.id,
          pipelineName: departmentPipeline.name,
          stageId: nouaStage.id,
          stageName: nouaStage.name
        })
        
        const { data: pipelineItemData, error } = await addTrayToPipeline(
          tray.id,
          departmentPipeline.id,
          nouaStage.id
        )

        console.log('📥 Rezultat trimitere:', { pipelineItemData, error })

        if (error) {
          results.push(`Tăvița ${quotes.indexOf(tray) + 1}: Eroare - ${error.message}`)
          errorCount++
        } else {
          results.push(`Tăvița ${quotes.indexOf(tray) + 1} → ${targetPipelineName}`)
          successCount++
        }
      }

      // Afișează rezultatul
      if (successCount > 0 && errorCount === 0) {
        toast.success(`${successCount} tăviț${successCount === 1 ? 'ă trimisă' : 'e trimise'} cu succes!`)
        // Actualizează verificarea - tăvițele sunt acum în departamente
        setTraysAlreadyInDepartments(true)
      } else if (successCount > 0 && errorCount > 0) {
        toast.warning(`${successCount} trimise, ${errorCount} erori`)
        // Dacă s-au trimis cu succes cel puțin câteva, actualizează verificarea
        const trayIds = quotes.map(q => q.id)
        await checkTraysInDepartments(trayIds)
      } else if (errorCount > 0) {
        toast.error(`Erori la trimitere: ${errorCount}`)
      }

      console.log('Rezultate trimitere tăvițe:', results)
    } catch (error: any) {
      console.error('Eroare la trimiterea tăvițelor:', error)
      toast.error(`Eroare: ${error?.message || 'Eroare necunoscută'}`)
    } finally {
      setSendingTrays(false)
      setShowSendConfirmation(false)
    }
  }

  // Funcție pentru ștergerea unei tăvițe
  const handleDeleteTray = async () => {
    if (!trayToDelete) return

    setDeletingTray(true)
    try {
      // Verifică dacă tăvița are items
      const trayItems = await listQuoteItems(trayToDelete, services, instruments, pipelinesWithIds)
      
      // Dacă tăvița are items, șterge-le mai întâi
      if (trayItems.length > 0) {
        for (const item of trayItems) {
          await deleteTrayItem(item.id)
        }
      }

      // Șterge tăvița
      const { success, error } = await deleteTray(trayToDelete)
      
      if (error || !success) {
        toast.error('Eroare la ștergerea tăviței')
        console.error('Error deleting tray:', error)
        return
      }

      toast.success('Tăvița a fost ștearsă')
      
      // Actualizează lista de tăvițe
      setQuotes(prev => prev.filter(q => q.id !== trayToDelete))
      
      // Dacă tăvița ștearsă era selectată, selectează prima tăviță rămasă
      if (selectedQuoteId === trayToDelete) {
        const remainingQuotes = quotes.filter(q => q.id !== trayToDelete)
        if (remainingQuotes.length > 0) {
          setSelectedQuoteId(remainingQuotes[0].id)
        } else {
          setSelectedQuoteId(null)
        }
      }
    } catch (error) {
      console.error('Error deleting tray:', error)
      toast.error('Eroare la ștergerea tăviței')
    } finally {
      setDeletingTray(false)
      setShowDeleteTrayConfirmation(false)
      setTrayToDelete(null)
    }
  }
  
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Încarcă toate datele în paralel, inclusiv pipelines și departments
        const [svcList, techList, partList, instList, pipelinesData, departmentsData] = await Promise.all([
          listServices(),
          // Obține membrii din app_members pentru tehnicieni (folosim user_id ca id și name ca nume)
          supabase
            .from('app_members')
            .select('user_id, name, email')
            .order('created_at', { ascending: true })
            .then(({ data, error }) => {
              if (error) {
                console.error('Error loading app_members:', error)
                return []
              }
              // Transformă în format compatibil cu Technician (id = user_id, name din câmpul name)
              const techs = (data ?? []).map((m: any) => {
                let name = 'Necunoscut'
                
                // Folosește câmpul name din app_members
                if (m.name) {
                  name = m.name
                } else if (m.email) {
                  // Fallback: folosește email-ul ca nume (partea dinainte de @)
                  name = m.email.split('@')[0]
                } else {
                  // Fallback final: folosește o parte din user_id
                  name = `User ${m.user_id.slice(0, 8)}`
                }
                
                return {
                  id: m.user_id,
                  name: name
                }
              })
              
              // Sortează după nume
              techs.sort((a, b) => a.name.localeCompare(b.name))
              return techs
            }),
          listParts(),
          supabase
            .from('instruments')
            .select('id,name,weight,department_id,pipeline')
            .order('name', { ascending: true })
            .then(({ data, error }) => {
              if (error) {
                console.error('Error loading instruments:', error)
                return []
              }
              return (data ?? []).map((i: any) => ({
                id: i.id,
                name: i.name,
                weight: Number(i.weight) || 0,
                department_id: i.department_id ?? null,
                pipeline: i.pipeline ?? null
              }))
            }),
          supabase
            .from('pipelines')
            .select('id,name,is_active,position')
            .eq('is_active', true)
            .order('position', { ascending: true })
            .then(({ data, error }) => {
              if (error) throw error;
              return {
                names: (data ?? []).map((r: any) => r.name),
                withIds: (data ?? []).map((r: any) => ({ id: r.id, name: r.name }))
              };
            }),
          supabase
            .from('departments')
            .select('id,name')
            .order('name', { ascending: true })
            .then(({ data, error }) => {
              if (error) {
                console.error('Error loading departments:', error)
                return []
              }
              return (data ?? []).map((r: any) => ({ id: r.id, name: r.name }))
            })
        ]);
        setServices(svcList);
        setTechnicians(techList);
        setParts(partList);
        setInstruments(instList);
        setPipelines(pipelinesData.names);
        setPipelinesWithIds(pipelinesData.withIds);
        setDepartments(departmentsData);
        setPipeLoading(false);
      
        // Load trays for service sheet (fără creare automată)
        let qs: LeadQuote[];
        if (fisaId) {
          // Dacă avem fisaId, încarcă doar tăvițele din acea fișă
          qs = await listTraysForServiceSheet(fisaId);
          // Nu creăm automat tăviță - utilizatorul va apăsa "Adaugă tăviță"
        } else {
          // Tăvițe standalone nu mai sunt suportate
          // Toate tăvițele trebuie să fie asociate cu o fișă de serviciu
          // Creăm automat o fișă de serviciu dacă nu există
          const { data: existingServiceFiles } = await supabase
            .from('service_files')
            .select('id')
            .eq('lead_id', leadId)
            .limit(1)
          
          let defaultFisaId: string | null = null
          if (!existingServiceFiles || existingServiceFiles.length === 0) {
            // Creează o fișă de serviciu implicită
            const { data: newServiceFile, error: sfError } = await createServiceFile({
              lead_id: leadId,
              number: `FISA-${Date.now()}`,
              date: new Date().toISOString().split('T')[0],
              status: 'noua'
            })
            
            if (sfError || !newServiceFile) {
              throw new Error('Nu s-a putut crea fișa de serviciu implicită')
            }
            defaultFisaId = (newServiceFile as any).id
          } else {
            defaultFisaId = existingServiceFiles[0].id
          }
          
          qs = await listTraysForServiceSheet(defaultFisaId!)
          // Nu creăm automat tăviță - utilizatorul va apăsa "Adaugă tăviță"
        }
        // În modul departament, filtrăm să afișăm doar tăvița curentă (initialQuoteId)
        if (isDepartmentPipeline && initialQuoteId) {
          const filteredQuotes = qs.filter(q => q.id === initialQuoteId)
          qs = filteredQuotes.length > 0 ? filteredQuotes : qs
        }
        
        setQuotes(qs);
        
        // Dacă avem initialQuoteId, folosim-l, altfel folosim primul quote
        const quoteIdToSelect = initialQuoteId && qs.find(q => q.id === initialQuoteId) 
          ? initialQuoteId 
          : qs[0]?.id || null;
        setSelectedQuoteId(quoteIdToSelect);
        const firstId = quoteIdToSelect || qs[0]?.id;
        
        if (!firstId) {
          setLoading(false);
          return;
        }
        
        // Încarcă în paralel: verificare tăvițe în departamente, service_file (dacă e cazul), items pentru prima tăviță
        const parallelTasks: Promise<any>[] = []
        
        // Verifică dacă tăvițele sunt deja în departamente (în paralel)
        if (qs.length > 0) {
          const trayIds = qs.map(q => q.id)
          parallelTasks.push(
            checkTraysInDepartments(trayIds).catch(err => {
              console.error('Eroare la verificarea tăvițelor în departamente:', err)
              setTraysAlreadyInDepartments(false)
            })
          )
        } else {
          setTraysAlreadyInDepartments(false)
        }
        
        // Încarcă checkbox-urile pentru livrare + No Deal din service_file (în paralel)
        if (fisaId) {
          parallelTasks.push(
            getServiceFile(fisaId).then(({ data: serviceFileData }) => {
              if (serviceFileData) {
                setOfficeDirect(serviceFileData.office_direct || false)
                setCurierTrimis(serviceFileData.curier_trimis || false)
                setNoDeal(serviceFileData.no_deal || false)
                console.log('Încărcare checkbox-uri livrare din service_file:', {
                  fisaId,
                  office_direct: serviceFileData.office_direct,
                  curier_trimis: serviceFileData.curier_trimis,
                  no_deal: serviceFileData.no_deal
                })
              }
            }).catch(err => {
              console.error('Eroare la încărcarea service_file:', err)
            })
          )
        }
        
        // OPTIMIZARE: Încarcă toate tray_items-urile pentru toate tăvițele dintr-o dată
        const allTrayIds = qs.map(q => q.id)
        const batchItemsPromise = supabase
          .from('tray_items')
          .select(`
            id, tray_id, instrument_id, service_id, part_id, department_id,
            technician_id, qty, notes, pipeline, created_at,
            tray_item_brands(id, brand, garantie, tray_item_brand_serials(id, serial_number))
          `)
          .in('tray_id', allTrayIds)
          .order('tray_id, id', { ascending: true })
          .then(({ data: allTrayItems, error: itemsError }) => {
            if (itemsError) {
              console.error('Error loading batch tray items:', itemsError)
              return new Map<string, TrayItem[]>()
            }
            
            // Grupează items-urile pe tăviță
            const itemsByTray = new Map<string, TrayItem[]>()
            allTrayItems?.forEach((item: TrayItem) => {
              if (!itemsByTray.has(item.tray_id)) {
                itemsByTray.set(item.tray_id, [])
              }
              itemsByTray.get(item.tray_id)!.push(item)
            })
            return itemsByTray
          })
        
        // Load items for selected sheet (folosind batch query)
        parallelTasks.push(
          Promise.resolve(batchItemsPromise).then((itemsByTray: Map<string, TrayItem[]>) => {
            const trayItems = itemsByTray.get(firstId) || []
            
            // Transformă TrayItem în LeadQuoteItem (aceeași logică ca în listQuoteItems)
            const qi = trayItems.map((item: TrayItem) => {
              let notesData: any = {}
              if (item.notes) {
                try {
                  notesData = JSON.parse(item.notes)
                } catch (e) {}
              }
              
              let item_type: 'service' | 'part' | null = notesData.item_type || null
              if (!item_type) {
                if (item.service_id) {
                  item_type = 'service'
                } else if (notesData.name || !item.instrument_id) {
                  item_type = 'part'
                }
              }
              
              let price = notesData.price || 0
              if (!price && item_type === 'service' && item.service_id && svcList) {
                const service = svcList.find((s: any) => s.id === item.service_id)
                price = service?.price || 0
              }
              
              let department: string | null = null
              let instrumentId = item.instrument_id
              
              if (!instrumentId && item_type === 'service' && item.service_id && svcList) {
                const service = svcList.find((s: any) => s.id === item.service_id)
                if (service?.instrument_id) {
                  instrumentId = service.instrument_id
                }
              }
              
              // Creează map-uri pentru instrumente și pipeline-uri
              const instrumentPipelineMap = new Map<string, string | null>()
              const pipelineMap = new Map<string, string>()
              
              if (instList) {
                instList.forEach(inst => {
                  if (inst.pipeline) {
                    instrumentPipelineMap.set(inst.id, inst.pipeline)
                  }
                })
              }
              
              if (pipelinesData.withIds) {
                pipelinesData.withIds.forEach(p => {
                  pipelineMap.set(p.id, p.name)
                })
              }
              
              if (instrumentId && instrumentPipelineMap.size > 0 && pipelineMap.size > 0) {
                const pipelineId = instrumentPipelineMap.get(instrumentId)
                if (pipelineId) {
                  department = pipelineMap.get(pipelineId) || null
                }
              }
              
              // Extrage brand_groups din tray_item_brands
              const brands = (item as any).tray_item_brands || []
              const brandGroups = brands.map((b: any) => ({
                id: b.id,
                brand: b.brand || '',
                garantie: b.garantie || false,
                serialNumbers: (b.tray_item_brand_serials || []).map((s: any) => s.serial_number || '')
              }))
              
              // Pentru compatibilitate, primul brand
              const firstBrand = brands.length > 0 ? brands[0] : null
              const firstSerial = firstBrand?.tray_item_brand_serials?.[0]?.serial_number || null
              
              return {
                ...item,
                item_type,
                price: price || 0,
                discount_pct: notesData.discount_pct || 0,
                urgent: notesData.urgent || false,
                name_snapshot: notesData.name_snapshot || notesData.name || '',
                // Folosește datele din noua structură, cu fallback la notesData
                brand: firstBrand?.brand || notesData.brand || null,
                serial_number: firstSerial || notesData.serial_number || null,
                garantie: firstBrand?.garantie || notesData.garantie || false,
                // Include toate brand-urile cu serial numbers
                brand_groups: brandGroups,
                pipeline_id: notesData.pipeline_id || null,
                department,
                qty: item.qty || 1,
              } as LeadQuoteItem & { price: number; department?: string | null; brand_groups?: Array<{ id: string; brand: string; serialNumbers: string[]; garantie: boolean }> }
            })
            
            // Set items și lastSavedRef
            setItems(qi ?? []);
            lastSavedRef.current = (qi ?? []).map((i: any) => ({
              id: i.id ?? `${i.name_snapshot}:${i.item_type}`,
              name: i.name_snapshot,
              qty: i.qty,
              price: i.price,
              type: i.item_type,
              urgent: !!i.urgent,
              department: i.department ?? null,
              technician_id: i.technician_id ?? null,
              brand: i.brand ?? null,
              serial_number: i.serial_number ?? null,
              garantie: !!i.garantie,
            }));
            setIsDirty(false); // Resetează isDirty la încărcarea inițială

            // Pre-selectează instrumentul dacă există deja items în tăviță
            // Mai întâi verifică dacă există items cu doar instrument (item_type: null)
            const instrumentOnlyItems = (qi ?? []).filter((item: any) => item.item_type === null && item.instrument_id)
            const serviceItems = (qi ?? []).filter((item: any) => item.item_type === 'service')
            
            let selectedInstrumentId: string | null = null
            
            // Prioritate 1: Item cu doar instrument
            if (instrumentOnlyItems.length > 0 && instrumentOnlyItems[0].instrument_id) {
              selectedInstrumentId = instrumentOnlyItems[0].instrument_id
              console.log('📦 [loadQuotes] Found instrument-only item, instrumentId:', selectedInstrumentId)
            }
            // Prioritate 2: Servicii existente
            else if (serviceItems.length > 0 && serviceItems[0].service_id) {
              const firstServiceDef = svcList.find(s => s.id === serviceItems[0].service_id)
              if (firstServiceDef?.instrument_id) {
                selectedInstrumentId = firstServiceDef.instrument_id
                console.log('📦 [loadQuotes] Found service item, instrumentId:', selectedInstrumentId)
              }
            }
            
            // Populează formularul dacă am găsit un instrument
            if (selectedInstrumentId) {
              setSvc(prev => ({ ...prev, instrumentId: selectedInstrumentId! }))
              setInstrumentForm(prev => ({ ...prev, instrument: selectedInstrumentId! }))
              // Populează formularul instrument cu datele salvate - forțează reîncărcarea la deschiderea tăviței
              console.log('📦 [loadQuotes] Populating form with instrumentId:', selectedInstrumentId)
              populateInstrumentFormFromItems(qi ?? [], selectedInstrumentId, true)
            }
            
            return qi
          }).catch((err: any) => {
            console.error('Eroare la încărcarea items-urilor:', err)
            setItems([])
            lastSavedRef.current = []
            return []
          })
        )
        
        // Load cash/card, urgent and subscription values from quote (după ce știm prima tăviță)
        const selectedQuoteForData = qs.find(q => q.id === firstId) || qs[0];
        const firstQuote = selectedQuoteForData as any
        if (firstQuote) {
          setIsCash(firstQuote.is_cash || false)
          setIsCard(firstQuote.is_card || false)
          const loadedSubscriptionType = firstQuote.subscription_type || ''
          const loadedUrgent = firstQuote.urgent || false
          console.log('Încărcare subscription_type și urgent din quote:', {
            quoteId: firstQuote.id,
            subscription_type: firstQuote.subscription_type,
            urgent: firstQuote.urgent,
            loadedSubscriptionType,
            loadedUrgent
          })
          setSubscriptionType(loadedSubscriptionType)
          setUrgentAllServices(loadedUrgent)
        }
        
        // Așteaptă toate task-urile în paralel
        await Promise.all(parallelTasks);
      
        // Compute global total (după ce toate datele sunt încărcate)
        await recalcAllSheetsTotal(qs);
      } finally {
        setLoading(false);
      }
    })();

    // Real-time subscription pentru actualizare automata a totalului
    // cand se modifica items-urile in orice tăviță din fișele de serviciu ale acestui lead
    const channel = supabase
      .channel(`preturi-total-${leadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tray_items',
        },
        async (payload) => {
          // Verifica daca item-ul apartine unei tăvițe dintr-o fișă de serviciu a acestui lead
          const payloadNew = payload.new as any
          const payloadOld = payload.old as any
          const trayId = payloadNew?.tray_id || payloadOld?.tray_id
          
          if (trayId) {
            // Verifica daca tăvița apartine unei fișe de serviciu a acestui lead
            const { data: tray } = await supabase
              .from('trays')
              .select('service_file_id, service_file:service_files!inner(lead_id)')
              .eq('id', trayId)
              .single()
            
            const trayData = tray as any
            if (trayData && trayData.service_file?.lead_id === leadId) {
              // Recalculeaza totalul pentru toate tăvițele
              const currentQuotes = fisaId 
                ? await listTraysForServiceSheet(fisaId)
                : await listQuotesForLead(leadId)
              await recalcAllSheetsTotal(currentQuotes)
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trays',
        },
        async (payload) => {
          // Cand se modifica o tăviță (is_cash, is_card, subscription_type, sau se adauga/sterge)
          const payloadNew = payload.new as any
          const payloadOld = payload.old as any
          const trayId = payloadNew?.id || payloadOld?.id
          
          // Verifica daca tăvița apartine unei fișe de serviciu a acestui lead
          if (trayId) {
            const { data: tray } = await supabase
              .from('trays')
              .select('service_file_id, service_file:service_files!inner(lead_id)')
              .eq('id', trayId)
              .single()
            
            const trayData = tray as any
            if (trayData && trayData.service_file?.lead_id === leadId) {
              // Verifică dacă s-a schimbat ceva relevant (evită reîncărcări inutile)
              const hasRelevantChange = payloadNew && (
                payloadNew.is_cash !== undefined ||
                payloadNew.is_card !== undefined ||
                payloadNew.subscription_type !== undefined ||
                payloadNew.urgent !== undefined ||
                payloadNew.number !== undefined ||
                payloadNew.size !== undefined ||
                payloadNew.status !== undefined ||
                payload.eventType === 'DELETE' ||
                payload.eventType === 'INSERT'
              )
              
              if (!hasRelevantChange && payload.eventType === 'UPDATE') {
                // Nu s-a schimbat nimic relevant, nu reîncărca
                return
              }
              
              // Daca se modifica tăvița curentă, actualizeaza checkbox-urile
              if (trayId === selectedQuoteId && payloadNew) {
                setIsCash(payloadNew.is_cash || false)
                setIsCard(payloadNew.is_card || false)
                if (payloadNew.subscription_type !== undefined) {
                  setSubscriptionType(payloadNew.subscription_type || '')
                }
                if (payloadNew.urgent !== undefined) {
                  setUrgentAllServices(payloadNew.urgent || false)
                }
              }
              
              // Reincarca tăvițele pentru a avea date actualizate
              const currentQuotes = fisaId 
                ? await listTraysForServiceSheet(fisaId)
                : await listQuotesForLead(leadId)
              
              // Verifică dacă quotes-urile s-au schimbat cu adevărat înainte de a actualiza
              const currentIds = currentQuotes.map(q => q.id).sort().join(',')
              const prevIds = quotes.map(q => q.id).sort().join(',')
              
              if (currentIds !== prevIds || payload.eventType === 'DELETE' || payload.eventType === 'INSERT') {
                setQuotes(currentQuotes)
              }
              
              // Daca tăvița curentă s-a schimbat, actualizeaza checkbox-urile
              if (selectedQuoteId) {
                const updatedQuote = currentQuotes.find(q => q.id === selectedQuoteId) as any
                if (updatedQuote) {
                  setIsCash(updatedQuote.is_cash || false)
                  setIsCard(updatedQuote.is_card || false)
                  setSubscriptionType(updatedQuote.subscription_type || '')
                  setUrgentAllServices(updatedQuote.urgent || false)
                }
              }
              
              // Recalculeaza totalul doar dacă este necesar
              if (hasRelevantChange) {
                await recalcAllSheetsTotal(currentQuotes)
              }
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [leadId, fisaId]);

  // Ref pentru a urmări ID-urile anterioare și a preveni verificări inutile
  const prevTrayIdsRef = useRef<string>('')
  
  // Verifică dacă tăvițele sunt în departamente când se schimbă lista de tăvițe
  useEffect(() => {
    const currentTrayIds = quotes.map(q => q.id).sort().join(',')
    
    // Verifică dacă ID-urile s-au schimbat cu adevărat
    if (prevTrayIdsRef.current === currentTrayIds) {
      return // Nu s-au schimbat, nu face nimic
    }
    
    prevTrayIdsRef.current = currentTrayIds
    
    if (quotes.length > 0) {
      const trayIds = quotes.map(q => q.id)
      console.log('🔍 useEffect: Verificare tăvițe în departamente:', { trayIds, fisaId, quotesCount: quotes.length })
      checkTraysInDepartments(trayIds)
    } else {
      console.log('🔍 useEffect: Nu există tăvițe, setăm traysAlreadyInDepartments = false')
      setTraysAlreadyInDepartments(false)
    }
  }, [quotes])

  // Resetează dialog-ul de creare tăviță când se accesează o tăviță existentă
  useEffect(() => {
    // Doar dacă există o tăviță selectată și dialog-ul este deschis, închide-l
    if (selectedQuoteId && quotes.length > 0) {
      setShowCreateTrayDialog(prev => {
        if (prev) {
          console.log('🔵 Resetare dialog creare tăviță - tăviță existentă accesată')
          setNewTrayNumber('')
          setNewTraySize('medium')
          return false
        }
        return prev
      })
    }
  }, [selectedQuoteId, quotes.length])

  // Încarcă imaginile pentru tăvița selectată
  useEffect(() => {
    if (!selectedQuoteId) {
      setTrayImages([])
      return
    }
    
    const loadImages = async () => {
      try {
        const loadedImages = await listTrayImages(selectedQuoteId)
        setTrayImages(loadedImages)
      } catch (error) {
        console.error('Error loading tray images:', error)
        setTrayImages([])
      }
    }
    
    loadImages()
  }, [selectedQuoteId])

  // Funcție pentru încărcarea unei imagini
  const handleTrayImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selectedQuoteId) return

    // Validare tip fișier
    if (!file.type.startsWith('image/')) {
      toast.error('Tip de fișier invalid', {
        description: 'Te rog selectează o imagine validă (JPG, PNG, etc.)'
      })
      return
    }

    // Validare dimensiune (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Fișier prea mare', {
        description: 'Dimensiunea maximă este 5MB'
      })
      return
    }

    setUploadingImage(true)
    const toastId = toast.loading('Se încarcă imaginea...')
    
    try {
      const { url, path } = await uploadTrayImage(selectedQuoteId, file)
      const savedImage = await saveTrayImageReference(selectedQuoteId, url, path, file.name)
      setTrayImages(prev => [savedImage, ...prev])
      toast.success('Imagine încărcată cu succes', { id: toastId })
    } catch (error: any) {
      console.error('Error uploading tray image:', error)
      
      // Mesaje de eroare mai descriptive
      let errorMessage = 'Te rog încearcă din nou'
      if (error?.message) {
        errorMessage = error.message
        // Verifică dacă eroarea este legată de bucket
        if (error.message.includes('Bucket not found') || error.message.includes('tray-images')) {
          errorMessage = 'Bucket-ul "tray-images" nu există. Te rog verifică configurația Storage în Supabase.'
        } else if (error.message.includes('permission denied') || error.message.includes('policy')) {
          errorMessage = 'Nu ai permisiuni pentru a încărca imagini. Te rog verifică Storage Policies.'
        } else if (error.message.includes('relation') && error.message.includes('tray_images')) {
          errorMessage = 'Tabelul "tray_images" nu există. Te rog rulează scriptul SQL de setup.'
        }
      }
      
      toast.error('Eroare la încărcarea imaginii', {
        id: toastId,
        description: errorMessage
      })
    } finally {
      setUploadingImage(false)
      event.target.value = ''
    }
  }

  // Funcție pentru descărcarea tuturor imaginilor
  const handleDownloadAllImages = async () => {
    if (trayImages.length === 0) {
      toast.error('Nu există imagini de descărcat')
      return
    }

    try {
      // Descarcă fiecare imagine individual
      for (const image of trayImages) {
        const link = document.createElement('a')
        link.href = image.url
        link.download = image.filename
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // Mic delay între descărcări pentru a evita blocarea browserului
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      toast.success(`S-au descărcat ${trayImages.length} imagini`)
    } catch (error: any) {
      console.error('Error downloading images:', error)
      toast.error('Eroare la descărcarea imaginilor', {
        description: error?.message || 'Te rog încearcă din nou'
      })
    }
  }

  // Funcție pentru ștergerea unei imagini
  const handleTrayImageDelete = async (imageId: string, filePath: string) => {
    if (!confirm('Ești sigur că vrei să ștergi această imagine?')) return

    try {
      await deleteTrayImage(filePath)
      await deleteTrayImageReference(imageId)
      setTrayImages(prev => prev.filter(img => img.id !== imageId))
      toast.success('Imagine ștearsă cu succes')
    } catch (error: any) {
      console.error('Error deleting tray image:', error)
      toast.error('Eroare la ștergerea imaginii', {
        description: error?.message || 'Te rog încearcă din nou'
      })
    }
  }

  // ----- Totals (per-line discount & urgent only) -----
  // Exclude items-urile cu item_type: null (doar instrument, fără serviciu) din calculele de totaluri
  const visibleItems = useMemo(() => items.filter(it => it.item_type !== null), [items])
  
  const subtotal = useMemo(
    () => visibleItems.reduce((acc, it) => acc + it.qty * it.price, 0),
    [visibleItems]
  );
  const totalDiscount = useMemo(
    () =>
      visibleItems.reduce(
        (acc, it) => acc + it.qty * it.price * (Math.min(100, Math.max(0, it.discount_pct)) / 100),
        0
      ),
    [visibleItems]
  );
  const urgentAmount = useMemo(
    () =>
      visibleItems.reduce((acc, it) => {
        const afterDisc = it.qty * it.price * (1 - Math.min(100, Math.max(0, it.discount_pct)) / 100);
        return acc + (it.urgent ? afterDisc * (URGENT_MARKUP_PCT / 100) : 0);
      }, 0),
    [visibleItems]
  );
  // Calcul discount abonament
  const subscriptionDiscountAmount = useMemo(() => {
    console.log('Calcul reducere abonament:', { subscriptionType, itemsCount: items.length })
    if (!subscriptionType) {
      console.log('Fără abonament, reducere = 0')
      return 0
    }
    
    // Optimizare: un singur reduce în loc de 2 separate
    const discount = items.reduce((acc, it) => {
      const base = it.qty * it.price
      const disc = base * (Math.min(100, Math.max(0, it.discount_pct)) / 100)
      const afterDisc = base - disc
      
      if (it.item_type === 'service' && (subscriptionType === 'services' || subscriptionType === 'both')) {
        const urgent = it.urgent ? afterDisc * (URGENT_MARKUP_PCT / 100) : 0
        return acc + (afterDisc + urgent) * 0.10
      } else if (it.item_type === 'part' && (subscriptionType === 'parts' || subscriptionType === 'both')) {
        return acc + afterDisc * 0.05
      }
      return acc
    }, 0)
    
    console.log('Reducere abonament calculată:', discount)
    return discount
  }, [subscriptionType, items])

  const total = useMemo(() => {
    const baseTotal = subtotal - totalDiscount + urgentAmount
    return baseTotal - subscriptionDiscountAmount
  }, [subtotal, totalDiscount, urgentAmount, subscriptionDiscountAmount]);

  // ----- Add instrument -----
  // Adaugă un nou grup brand + serial numbers
  function onAddBrandSerialGroup() {
    setInstrumentForm(prev => ({
      ...prev,
      brandSerialGroups: [...prev.brandSerialGroups, { brand: '', serialNumbers: [''] }]
    }))
    setIsDirty(true)
  }

  // Șterge un grup brand + serial numbers
  function onRemoveBrandSerialGroup(groupIndex: number) {
    setInstrumentForm(prev => ({
      ...prev,
      brandSerialGroups: prev.brandSerialGroups.filter((_, i) => i !== groupIndex)
    }))
    setIsDirty(true)
  }

  // Actualizează brand-ul pentru un grup
  function onUpdateBrand(groupIndex: number, value: string) {
    setInstrumentForm(prev => ({
      ...prev,
      brandSerialGroups: prev.brandSerialGroups.map((group, i) => 
        i === groupIndex ? { ...group, brand: value } : group
      )
    }))
    setIsDirty(true)
  }

  // Adaugă un serial number într-un grup
  function onAddSerialNumber(groupIndex: number) {
    setInstrumentForm(prev => ({
      ...prev,
      brandSerialGroups: prev.brandSerialGroups.map((group, i) => 
        i === groupIndex 
          ? { ...group, serialNumbers: [...group.serialNumbers, ''] }
          : group
      )
    }))
    setIsDirty(true)
  }

  // Șterge un serial number dintr-un grup
  function onRemoveSerialNumber(groupIndex: number, serialIndex: number) {
    setInstrumentForm(prev => ({
      ...prev,
      brandSerialGroups: prev.brandSerialGroups.map((group, i) => 
        i === groupIndex 
          ? { ...group, serialNumbers: group.serialNumbers.filter((_, si) => si !== serialIndex) }
          : group
      )
    }))
    setIsDirty(true)
  }

  // Actualizează un serial number dintr-un grup
  function onUpdateSerialNumber(groupIndex: number, serialIndex: number, value: string) {
    setInstrumentForm(prev => ({
      ...prev,
      brandSerialGroups: prev.brandSerialGroups.map((group, i) => 
        i === groupIndex 
          ? { ...group, serialNumbers: group.serialNumbers.map((sn, si) => si === serialIndex ? value : sn) }
          : group
      )
    }))
    setIsDirty(true)
  }

  // Funcție helper pentru a popula formularul instrument cu datele salvate din items
  function populateInstrumentFormFromItems(items: LeadQuoteItem[], instrumentId: string | null, forceReload: boolean = false) {
    if (!instrumentId) return
    
    // Găsește toate items-urile care sunt instrumente (item_type: null) sau servicii cu acest instrument
    const instrumentItems = items.filter(item => {
      // Items care sunt direct instrumente (item_type: null și au instrument_id)
      if (item.item_type === null && item.instrument_id === instrumentId) {
        return true
      }
      // Sau servicii care au acest instrument
      if (item.item_type === 'service' && item.service_id) {
        const serviceDef = services.find(s => s.id === item.service_id)
        return serviceDef?.instrument_id === instrumentId
      }
      return false
    })
    
    console.log('🔍 populateInstrumentFormFromItems - instrumentItems found:', instrumentItems.length, 'for instrumentId:', instrumentId, 'forceReload:', forceReload)
    
    // Găsește primul item care are brand_groups sau brand/serial_number
    const itemWithInstrumentData = instrumentItems.find(item => {
      const hasBrandGroups = (item as any).brand_groups && (item as any).brand_groups.length > 0
      const hasData = hasBrandGroups || item.brand || item.serial_number || item.garantie
      if (hasData) {
        console.log('✅ Found item with data:', {
          id: item.id,
          brand_groups: (item as any).brand_groups?.length || 0,
          brand: item.brand,
          serial_number: item.serial_number
        })
      }
      return hasData
    })
    
    // Chiar dacă nu găsim date, verificăm dacă există un item
    const itemWithPotentialData = instrumentItems.length > 0 ? instrumentItems[0] : null
    
    if (itemWithInstrumentData || itemWithPotentialData) {
      const targetItem = itemWithInstrumentData || itemWithPotentialData
      
      // Extrage brand-urile și serial numbers din noua structură brand_groups
      let brandSerialGroups: Array<{ brand: string; serialNumbers: string[]; garantie: boolean }> = []
      
      // Noua structură: brand_groups = Array<{ id, brand, serialNumbers[], garantie }>
      const brandGroups = (targetItem as any).brand_groups || []
      
      console.log('📦 Raw brand_groups from DB:', brandGroups)
      
      if (brandGroups.length > 0) {
        console.log('📦 Processing brand_groups:', brandGroups.length, 'brands')
        
        // Transformă direct din structura din DB
        brandSerialGroups = brandGroups.map((bg: any) => ({
          brand: bg.brand || '',
          serialNumbers: bg.serialNumbers && bg.serialNumbers.length > 0 ? bg.serialNumbers : [''],
          garantie: bg.garantie || false
        }))
        
        console.log('✅ Brand groups loaded:', brandSerialGroups)
      } else if (targetItem?.brand || targetItem?.serial_number) {
        console.log('⚠️ Using fallback brand/serial_number fields')
        // Fallback la câmpurile vechi pentru compatibilitate
        brandSerialGroups = [{
          brand: targetItem.brand || '',
          serialNumbers: targetItem.serial_number ? [targetItem.serial_number] : [''],
          garantie: targetItem.garantie || false
        }]
      } else {
        brandSerialGroups = [{ brand: '', serialNumbers: [''], garantie: false }]
      }
      
      const finalGroups = brandSerialGroups.length > 0 ? brandSerialGroups : [{ brand: '', serialNumbers: [''], garantie: false }]
      console.log('✅ Final brand serial groups to populate:', finalGroups)
      
      // Populează formularul - dacă forceReload este true, suprascrie întotdeauna
      setInstrumentForm(prev => {
        // Dacă forceReload este false și formularul are deja date pentru același instrument, nu le suprascriem
        if (!forceReload && prev.instrument === instrumentId && prev.brandSerialGroups.some(g => g.brand || g.serialNumbers.some(sn => sn && sn.trim()))) {
          console.log('⏭️ Skipping populate - form already has data for this instrument')
          return prev
        }
        
        console.log('✅ Populating form with brand serial groups:', finalGroups)
        
        return {
          ...prev,
          instrument: instrumentId,
          brandSerialGroups: finalGroups,
          garantie: brandSerialGroups.some(g => g.garantie) || targetItem?.garantie || false,
          qty: instrumentSettings[instrumentId]?.qty || prev.qty || '1'
        }
      })
      
      // Actualizează și instrumentSettings
      setInstrumentSettings(prev => ({
        ...prev,
        [instrumentId]: {
          qty: prev[instrumentId]?.qty || '1',
          brandSerialGroups: brandSerialGroups,
          garantie: brandSerialGroups.some(g => g.garantie) || targetItem?.garantie || false
        }
      }))
    }
  }

  // ----- Add rows -----
  function onAddService() {
    if (!selectedQuote || !svc.id) return
    
    // Verifică dacă este pachet de mentenanță
    if (svc.id === 'MAINTENANCE_PACKAGE') {
      const instrumentId = instrumentForm.instrument || svc.instrumentId
      if (!instrumentId) {
        toast.error('Te rog selectează un instrument înainte de a adăuga pachetul de mentenanță')
        return
      }
      
      const selectedInstrument = instruments.find(i => i.id === instrumentId)
      if (!selectedInstrument || !selectedInstrument.name) {
        toast.error('Instrumentul selectat nu a fost găsit')
        return
      }
      
      const maintenancePackage = MAINTENANCE_PACKAGES[selectedInstrument.name]
      if (!maintenancePackage) {
        toast.error('Pachet de mentenanță negăsit pentru acest instrument')
        return
      }
      
      // Găsește toate serviciile din pachet pentru instrumentul selectat
      const packageServices = maintenancePackage.serviceNames
        .map(serviceName => {
          // Caută serviciul după nume (case-insensitive) și instrument_id
          const service = services.find(s => {
            const nameMatch = s.name?.toLowerCase().trim() === serviceName.toLowerCase().trim()
            const instrumentMatch = s.instrument_id === instrumentId
            return nameMatch && instrumentMatch
          })
          if (!service) {
            console.warn(`Serviciu negăsit pentru pachet: "${serviceName}" pentru instrument "${selectedInstrument.name}"`)
          }
          return service
        })
        .filter((s): s is Service => s !== undefined)
      
      console.log('🔍 Pachet mentenanță - servicii găsite:', {
        instrumentName: selectedInstrument.name,
        packageServiceNames: maintenancePackage.serviceNames,
        foundServices: packageServices.map(s => ({ id: s.id, name: s.name, price: s.price })),
        totalServices: services.length,
        servicesForInstrument: services.filter(s => s.instrument_id === instrumentId).map(s => s.name)
      })
      
      if (packageServices.length === 0) {
        toast.error(`Nu s-au găsit servicii pentru pachetul de mentenanță. Verifică dacă serviciile există în baza de date pentru instrumentul "${selectedInstrument.name}".`)
        console.error('Servicii disponibile pentru instrument:', services.filter(s => s.instrument_id === instrumentId).map(s => s.name))
        return
      }
      
      // Adaugă toate serviciile din pachet
      const currentInstrumentForService = instruments.find(i => i.id === instrumentId)
      if (!currentInstrumentForService || !currentInstrumentForService.department_id) {
        toast.error('Instrumentul selectat nu are departament setat')
        return
      }
      
      const qty = Math.max(1, Number(instrumentForm.qty || svc.qty || 1))
      const discount = Math.min(100, Math.max(0, Number(svc.discount || 0)))
      
      // Obține datele instrumentului
      // Folosește primul grup pentru servicii (compatibilitate)
      const firstGroup = instrumentForm.brandSerialGroups[0] || { brand: '', serialNumbers: [''] }
      const brand = (firstGroup.brand && firstGroup.brand.trim()) 
        ? firstGroup.brand.trim() 
        : null
      const serialNumber = (firstGroup.serialNumbers.length > 0 && firstGroup.serialNumbers[0].trim()) 
        ? firstGroup.serialNumbers[0].trim() 
        : null
      const garantie = instrumentForm.garantie || false
      
      // Obține pipeline_id
      let pipelineId = svc.pipelineId || null
      if (currentInstrumentForService.department_id && !pipelineId) {
        const instrumentDept = departments.find(d => d.id === currentInstrumentForService.department_id)
        const deptName = instrumentDept?.name?.toLowerCase() || currentInstrumentForService.department_id?.toLowerCase()
        
        if (deptName === 'reparatii') {
          const reparatiiPipeline = pipelinesWithIds.find(p => p.name.toLowerCase() === 'reparatii')
          if (reparatiiPipeline) {
            pipelineId = reparatiiPipeline.id
          }
        }
      }
      
      // Verifică dacă există deja un item cu instrument (item_type: null)
      const existingInstrumentItem = items.find(it => it.item_type === null && it.instrument_id === instrumentId)
      
      console.log('📦 Adăugare pachet mentenanță:', {
        instrumentId,
        instrumentName: selectedInstrument.name,
        packageServicesCount: packageServices.length,
        existingInstrumentItem: existingInstrumentItem ? 'da' : 'nu',
        itemsCount: items.length
      })
      
      // Adaugă toate serviciile din pachet
      const newItems: LeadQuoteItem[] = []
      
      packageServices.forEach((serviceDef, index) => {
        const newItem: LeadQuoteItem = {
          id: index === 0 && existingInstrumentItem ? existingInstrumentItem.id : tempId(),
          item_type: 'service',
          service_id: serviceDef.id,
          instrument_id: currentInstrumentForService.id,
          department_id: currentInstrumentForService.department_id,
          name_snapshot: serviceDef.name || '',
          price: Number(serviceDef.price || 0),
          qty: qty,
          discount_pct: discount,
          urgent: urgentAllServices,
          technician_id: svc.technicianId || null,
          pipeline_id: pipelineId,
          brand: brand,
          serial_number: serialNumber,
          garantie: garantie,
        } as unknown as LeadQuoteItem
        
        newItems.push(newItem)
        console.log(`  ✅ Serviciu ${index + 1}/${packageServices.length}: ${serviceDef.name} (${serviceDef.price} RON)`)
      })
      
      console.log('📋 Items noi create:', newItems.length)
      
      // Actualizează items
      if (existingInstrumentItem && newItems.length > 0) {
        // Înlocuiește item-ul existent cu primul serviciu și adaugă restul
        console.log('🔄 Actualizare item existent și adăugare restul serviciilor')
        setItems(prev => {
          const filtered = prev.filter(it => it.id !== existingInstrumentItem.id)
          const updated = [...filtered, ...newItems]
          console.log('📊 Items după actualizare:', updated.length)
          return updated
        })
      } else {
        // Adaugă toate items-urile noi
        console.log('➕ Adăugare toate serviciile ca items noi')
        setItems(prev => {
          const updated = [...prev, ...newItems]
          console.log('📊 Items după adăugare:', updated.length)
          return updated
        })
      }
      
      // Resetează formularul
      setSvc(prev => ({ 
        ...prev, 
        id: '', 
        qty: instrumentForm.qty || '1', 
        discount: '0', 
        urgent: false, 
        technicianId: '',
        pipelineId: '',
      }))
      setIsDirty(true)
      
      toast.success(`Pachet de mentenanță adăugat: ${newItems.length} servicii`)
      return
    }
    
    // Logica normală pentru servicii individuale
    const svcDef = services.find(s => s.id === svc.id)
    if (!svcDef) return
    
    // Verifică dacă există un instrument selectat (obligatoriu)
    const currentInstrumentId = instrumentForm.instrument || svc.instrumentId
    if (!currentInstrumentId) {
      toast.error('Te rog selectează un instrument înainte de a adăuga un serviciu')
      return
    }
    
    const currentInstrumentForService = instruments.find(i => i.id === currentInstrumentId)
    if (!currentInstrumentForService) {
      toast.error('Instrumentul selectat nu a fost găsit')
      return
    }
    
    if (!currentInstrumentForService.department_id) {
      toast.error('Instrumentul selectat nu are departament setat. Verifică setările instrumentului.')
      return
    }
  
    const qty = Math.max(1, Number(svc.qty || instrumentForm.qty || 1))
    const discount = Math.min(100, Math.max(0, Number(svc.discount || 0)))
    
    // Obține datele instrumentului - folosește serial number-ul selectat sau primul din listă
    let brand: string | null = null
    let serialNumber: string | null = null
    
    // Verifică dacă a fost selectat un serial number specific
    if (svc.serialNumberId) {
      // Format: "brand::serialNumber"
      const parts = svc.serialNumberId.split('::')
      brand = parts[0] || null
      serialNumber = parts[1] || null
    } else {
      // Fallback: folosește primul grup pentru compatibilitate
      const firstGroup = instrumentForm.brandSerialGroups[0] || { brand: '', serialNumbers: [''] }
      brand = (firstGroup.brand && firstGroup.brand.trim()) 
        ? firstGroup.brand.trim() 
        : null
      serialNumber = (firstGroup.serialNumbers.length > 0 && firstGroup.serialNumbers[0].trim()) 
        ? firstGroup.serialNumbers[0].trim() 
        : null
    }
    
    const garantie = instrumentForm.garantie || false
  
    console.log('onAddService - qty:', qty, 'serialNumberId:', svc.serialNumberId, 'brand:', brand, 'serialNumber:', serialNumber, 'garantie:', garantie);
  
    // Verifică dacă există deja un item cu instrument (item_type: null)
    // Dacă există, actualizează-l cu detaliile serviciului în loc să creezi unul nou
    const existingInstrumentItem = items.find(it => it.item_type === null)
    
    // Obține pipeline_id din svc.pipelineId sau setare automată bazată pe department_id
    let pipelineId = svc.pipelineId || null
    
    // Dacă există un item cu instrument (item_type: null), folosește name_snapshot pentru a găsi instrumentul
    const existingInstrumentName = existingInstrumentItem?.name_snapshot
    
    // Găsește instrumentul fie după ID, fie după nume
    let currentInstrument = currentInstrumentId 
      ? instruments.find(i => i.id === currentInstrumentId)
      : null
    
    // Dacă nu am găsit instrumentul după ID, încearcă după nume (de la item-ul existent)
    if (!currentInstrument && existingInstrumentName) {
      currentInstrument = instruments.find(i => i.name === existingInstrumentName)
    }
    
    // Setează pipeline_id automat dacă instrumentul are department_id = "reparatii"
    if (currentInstrument?.department_id && !pipelineId) {
      // Verifică dacă department_id este UUID sau text direct
      const instrumentDept = departments.find(d => d.id === currentInstrument.department_id)
      const deptName = instrumentDept?.name?.toLowerCase() || currentInstrument.department_id?.toLowerCase()
      
      if (deptName === 'reparatii') {
        const reparatiiPipeline = pipelinesWithIds.find(p => p.name.toLowerCase() === 'reparatii')
        if (reparatiiPipeline) {
          pipelineId = reparatiiPipeline.id
          console.log('Pipeline setat automat la Reparatii pentru instrument:', currentInstrument.name)
        }
      }
    }
    
    // Dacă pipeline_id încă nu e setat, verifică și serviciul pentru department_id = "reparatii"
    if (svcDef.department_id && !pipelineId) {
      const department = departments.find(d => d.id === svcDef.department_id)
      const svcDeptName = department?.name?.toLowerCase() || svcDef.department_id?.toLowerCase()
      
      if (svcDeptName === 'reparatii') {
        const reparatiiPipeline = pipelinesWithIds.find(p => p.name.toLowerCase() === 'reparatii')
        if (reparatiiPipeline) {
          pipelineId = reparatiiPipeline.id
          console.log('Pipeline setat automat la Reparatii pentru serviciu:', svcDef.name)
        }
      }
    }
    
    console.log('onAddService - department detection:', {
      currentInstrumentId,
      existingInstrumentName,
      instrumentFound: currentInstrument?.name,
      instrumentDeptId: currentInstrument?.department_id,
      serviceDeptId: svcDef.department_id,
      finalPipelineId: pipelineId,
      pipelineName: pipelineId ? pipelinesWithIds.find(p => p.id === pipelineId)?.name : null
    })
    
    if (existingInstrumentItem) {
      // Actualizează item-ul existent cu detaliile serviciului
      setItems(prev => prev.map(it => 
        it.id === existingInstrumentItem.id 
          ? {
              ...it,
              item_type: 'service',
              service_id: svcDef.id,
              instrument_id: currentInstrumentForService.id, // OBLIGATORIU
              department_id: currentInstrumentForService.department_id, // OBLIGATORIU - din instrument
              name_snapshot: svcDef.name,
              price: Number(svcDef.price),
              qty,
              discount_pct: discount,
              urgent: urgentAllServices,
              technician_id: svc.technicianId || null,
              pipeline_id: pipelineId,
              brand: brand,
              serial_number: serialNumber,
              garantie: garantie,
            } as unknown as LeadQuoteItem
          : it
      ))
    } else {
      // Creează un item nou pentru serviciu
      const newItem = {
        id: tempId(),
        item_type: 'service',
        service_id: svcDef.id,
        instrument_id: currentInstrumentForService.id, // OBLIGATORIU
        department_id: currentInstrumentForService.department_id, // OBLIGATORIU - din instrument
        name_snapshot: svcDef.name,
        price: Number(svcDef.price),
        qty,
        discount_pct: discount,
        urgent: urgentAllServices,
        technician_id: svc.technicianId || null,
        pipeline_id: pipelineId,
        brand: brand,
        serial_number: serialNumber,
        garantie: garantie,
      } as unknown as LeadQuoteItem
      
      console.log('onAddService - newItem:', newItem);
      setItems(prev => [...prev, newItem])
    }
    
    // Păstrăm instrumentul selectat și setările pentru acest instrument
    setSvc(prev => ({ 
      ...prev, 
      id: '', 
      qty: '1', // Resetează cantitatea
      discount: '0', 
      urgent: false, 
      technicianId: '',
      pipelineId: '', // Resetează pipeline_id după adăugare
      serialNumberId: '', // Resetează serial number-ul selectat
    }))
    setServiceSearchQuery('') // Resetează căutarea serviciului
    setIsDirty(true)
  }

  function onAddPart(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedQuote || !part.id) return
  
    const partDef = parts.find(p => p.id === part.id)
    if (!partDef) return
    
    // Verifică dacă există un instrument selectat (obligatoriu)
    const currentInstrumentId = instrumentForm.instrument || svc.instrumentId
    if (!currentInstrumentId) {
      toast.error('Te rog selectează un instrument înainte de a adăuga o piesă')
      return
    }
    
    const currentInstrumentForPart = instruments.find(i => i.id === currentInstrumentId)
    if (!currentInstrumentForPart) {
      toast.error('Instrumentul selectat nu a fost găsit')
      return
    }
    
    if (!currentInstrumentForPart.department_id) {
      toast.error('Instrumentul selectat nu are departament setat. Verifică setările instrumentului.')
      return
    }
  
    const unit = part.overridePrice !== '' ? Number(part.overridePrice) : Number(partDef.price)
    if (isNaN(unit) || unit < 0) return
  
    const qty = Math.max(1, Number(part.qty || 1))
    const discount = Math.min(100, Math.max(0, Number(part.discount || 0)))
  
    // ⬇️ push a local row (no DB write)
    // Setează automat pipeline_id la "Reparatii" pentru piese
    const reparatiiPipeline = pipelinesWithIds.find(p => p.name === 'Reparatii')
    const pipelineIdForPart = reparatiiPipeline?.id || null
    
    // Extrage brand și serial number din selecție (format: "brand::serialNumber")
    let partBrand: string | null = null
    let partSerialNumber: string | null = null
    if (part.serialNumberId && part.serialNumberId.includes('::')) {
      const [b, sn] = part.serialNumberId.split('::')
      partBrand = b || null
      partSerialNumber = sn || null
    }
    
    setItems(prev => [
      ...prev,
      {
        id: tempId(),
        item_type: 'part',
        instrument_id: currentInstrumentForPart.id, // OBLIGATORIU
        department_id: currentInstrumentForPart.department_id, // OBLIGATORIU - din instrument
        name_snapshot: partDef.name,
        price: unit,
        qty,
        discount_pct: discount,
        urgent: urgentAllServices, // Folosește urgentAllServices pentru piese
        pipeline_id: pipelineIdForPart, // Setează automat pipeline-ul "Reparatii" pentru piese
        technician_id: null,
        brand: partBrand, // Brand-ul instrumentului căruia îi este destinată piesa
        serial_number: partSerialNumber, // Serial number-ul instrumentului
      } as unknown as LeadQuoteItem
    ])
  
    setPart({ id: '', overridePrice: '', qty: '1', discount: '0', urgent: false, serialNumberId: '' })
    setPartSearchQuery('') // Resetează căutarea piesei
    setIsDirty(true)
  }

  // ----- Inline updates -----
  function onUpdateItem(id: string, patch: Partial<LeadQuoteItem>) {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } as any : it)))
    setIsDirty(true)
  }

  function onDelete(id: string) {
    setItems(prev => {
      const itemToDelete = prev.find(it => it.id === id)
      const newItems = prev.filter(it => it.id !== id)
      
      // Dacă s-a șters un item cu instrument (item_type: null), resetează instrumentul
      if (itemToDelete?.item_type === null) {
        setSvc(p => ({ ...p, instrumentId: '' }))
        setInstrumentForm(prev => ({ ...prev, instrument: '' }))
      }
      
      // Resetează instrumentul dacă nu mai există servicii și nu mai există items cu instrument
      const remainingServices = newItems.filter(it => it.item_type === 'service')
      const remainingInstruments = newItems.filter(it => it.item_type === null)
      if (remainingServices.length === 0 && remainingInstruments.length === 0) {
        setSvc(p => ({ ...p, instrumentId: '' }))
        setInstrumentForm(prev => ({ ...prev, instrument: '' }))
      }
      
      return newItems
    })
    setIsDirty(true)
  }

  async function onChangeSheet(newId: string) {
    if (!newId || newId === selectedQuoteId) return;
    
    // Resetează dialog-ul de creare tăviță când se schimbă tăvița
    if (showCreateTrayDialog) {
      setShowCreateTrayDialog(false)
      setNewTrayNumber('')
      setNewTraySize('medium')
    }
    
    setLoading(true);
    try {
      // incarca valorile cash/card si subscription pentru noua tavita
      const newQuote = quotes.find(q => q.id === newId) as any
      if (newQuote) {
        setIsCash(newQuote.is_cash || false)
        setIsCard(newQuote.is_card || false)
        const loadedSubscriptionType = newQuote.subscription_type || ''
        const loadedUrgent = newQuote.urgent || false
        console.log('Schimbare tăviță - încărcare subscription_type și urgent:', {
          quoteId: newQuote.id,
          subscription_type: newQuote.subscription_type,
          urgent: newQuote.urgent,
          loadedSubscriptionType,
          loadedUrgent
        })
        setSubscriptionType(loadedSubscriptionType)
        setUrgentAllServices(loadedUrgent)
      }
      setSelectedQuoteId(newId);
      
      // OPTIMIZARE: Folosește batch query pentru items (dacă există deja în cache, altfel query direct)
      const qi = await listQuoteItems(newId, services, instruments, pipelinesWithIds);
      setItems(qi ?? []);
      lastSavedRef.current = (qi ?? []).map((i: any) => ({
        id: i.id ?? `${i.name_snapshot}:${i.item_type}`,
        name: i.name_snapshot,
        qty: i.qty,
        price: i.price,
        type: i.item_type ?? null,
        urgent: !!i.urgent,
        department: i.department ?? null,
        technician_id: i.technician_id ?? null,
        pipeline_id: i.pipeline_id ?? null,
        brand: i.brand ?? null,
        serial_number: i.serial_number ?? null,
        garantie: !!i.garantie,
      }));
      setIsDirty(false); // Resetează isDirty când se încarcă un quote nou

      // Pre-selectează instrumentul dacă există deja servicii sau items cu doar instrument în tăviță
      const serviceItems = (qi ?? []).filter((item: any) => item.item_type === 'service')
      const instrumentItems = (qi ?? []).filter((item: any) => item.item_type === null && item.instrument_id)
      
      // Verifică dacă există deja un instrument selectat în formular (pentru a nu-l reseta)
      const currentInstrumentId = instrumentForm.instrument || svc.instrumentId
      
      if (serviceItems.length > 0 && serviceItems[0].service_id) {
        // Dacă există servicii, folosește instrumentul de la primul serviciu
        const firstServiceDef = services.find(s => s.id === serviceItems[0].service_id)
        if (firstServiceDef?.instrument_id) {
          const instrumentId = firstServiceDef.instrument_id!
          setSvc(prev => ({ ...prev, instrumentId }))
          setInstrumentForm(prev => ({ ...prev, instrument: instrumentId }))
          // Populează formularul instrument cu datele salvate - forțează reîncărcarea
          populateInstrumentFormFromItems(qi ?? [], instrumentId, true)
        } else {
          // Doar dacă nu există instrument selectat deja, resetează
          if (!currentInstrumentId) {
            setSvc(prev => ({ ...prev, instrumentId: '' }))
            setInstrumentForm(prev => ({ ...prev, instrument: '' }))
          }
        }
      } else if (instrumentItems.length > 0 && instrumentItems[0].name_snapshot) {
        // Dacă există items cu doar instrument, identifică instrumentul după name_snapshot
        const instrumentName = instrumentItems[0].name_snapshot
        const instrument = instruments.find(i => i.name === instrumentName)
        if (instrument) {
          const instrumentId = instrument.id
          setSvc(prev => ({ ...prev, instrumentId }))
          setInstrumentForm(prev => ({ ...prev, instrument: instrumentId }))
          // Populează formularul instrument cu datele salvate - forțează reîncărcarea
          populateInstrumentFormFromItems(qi ?? [], instrumentId, true)
        }
      } else {
        // Resetează instrumentul doar dacă nu există nici servicii, nici items cu instrument
        // Și doar dacă nu există deja un instrument selectat în formular
        if (!currentInstrumentId) {
          setSvc(prev => ({ ...prev, instrumentId: '' }))
          setInstrumentForm(prev => ({ ...prev, instrument: '' }))
        }
      }
      
      // Actualizează urgentAllServices bazat pe tăviță și pe serviciile/piesele din tăviță
      // Prioritate: dacă tăvița are urgent setat, folosește-l; altfel verifică items-urile
      const trayUrgent = newQuote?.urgent || false
      const partItems = (qi ?? []).filter((item: any) => item.item_type === 'part')
      const allServicesUrgent = serviceItems.length > 0 && serviceItems.every((item: any) => item.urgent)
      const allPartsUrgent = partItems.length > 0 && partItems.every((item: any) => item.urgent)
      const allItemsUrgent = (serviceItems.length > 0 && allServicesUrgent) || (partItems.length > 0 && allPartsUrgent)
      // Folosește urgent de pe tăviță dacă este setat, altfel folosește urgent de pe items
      setUrgentAllServices(trayUrgent || allItemsUrgent)
    } finally {
      setLoading(false);
    }
  }
  
  async function onAddSheet() {
    console.log('🔵 onAddSheet apelat:', { fisaId, leadId })
    // Verifică dacă există fisaId
    if (!fisaId) {
      console.error('❌ Nu există fisaId, nu se poate crea tăviță')
      toast.error('Nu există fișă de serviciu selectată. Te rog selectează sau creează o fișă de serviciu.')
      return
    }
    // Deschide dialog-ul pentru introducerea numărului și mărimii
    setNewTrayNumber('')
    setNewTraySize('medium')
    setShowCreateTrayDialog(true)
    console.log('✅ Dialog deschis, showCreateTrayDialog:', true)
  }

  async function handleCreateTray() {
    if (!newTrayNumber.trim()) {
      toast.error('Introduceți numărul tăviței')
      return
    }

    setCreatingTray(true)
    setLoading(true)
    try {
      // Creează tăvița cu numărul și mărimea introduse
      const created = await createQuoteForLead(leadId, newTrayNumber.trim(), fisaId || null, newTraySize);
      const next = [...quotes, created].sort((a, b) => a.sheet_index - b.sheet_index);
      setQuotes(next);
      setSelectedQuoteId(created.id);
      setItems([]);
      lastSavedRef.current = [];
      await recalcAllSheetsTotal(next);
      setShowCreateTrayDialog(false)
      setNewTrayNumber('')
      setNewTraySize('medium')
      toast.success('Tăvița a fost creată cu succes')
    } catch (error: any) {
      console.error('Error creating tray:', error)
      toast.error('Eroare la crearea tăviței: ' + (error?.message || 'Eroare necunoscută'))
    } finally {
      setCreatingTray(false)
      setLoading(false);
    }
  }
  
  // Funcție pentru deschiderea dialog-ului de editare tăviță
  function onEditTray() {
    if (!selectedQuote) return
    
    setEditingTrayNumber(selectedQuote.number || '')
    setEditingTraySize(selectedQuote.size || 'medium')
    setShowEditTrayDialog(true)
  }
  
  // Funcție pentru salvarea editărilor tăviței
  async function handleUpdateTray() {
    if (!selectedQuote || !editingTrayNumber.trim()) {
      toast.error('Introduceți numărul tăviței')
      return
    }

    setUpdatingTray(true)
    setLoading(true)
    try {
      // Actualizează tăvița cu numărul și mărimea editate
      await updateQuote(selectedQuote.id, {
        number: editingTrayNumber.trim(),
        size: editingTraySize,
      })
      
      // Reîncarcă tăvițele pentru a avea date actualizate
      const updatedQuotes = fisaId 
        ? await listTraysForServiceSheet(fisaId)
        : await listQuotesForLead(leadId)
      
      setQuotes(updatedQuotes)
      
      // Păstrează selecția pe tăvița editată
      const updatedQuote = updatedQuotes.find(q => q.id === selectedQuote.id)
      if (updatedQuote) {
        setSelectedQuoteId(updatedQuote.id)
      }
      
      setShowEditTrayDialog(false)
      setEditingTrayNumber('')
      setEditingTraySize('medium')
      toast.success('Tăvița a fost actualizată cu succes')
    } catch (error: any) {
      console.error('Error updating tray:', error)
      toast.error('Eroare la actualizarea tăviței: ' + (error?.message || 'Eroare necunoscută'))
    } finally {
      setUpdatingTray(false)
      setLoading(false)
    }
  }

  // Verifică dacă există servicii în tăvița curentă (memoizat pentru performanță)
  const hasServicesInSheet = useMemo(
    () => items.some(it => it.item_type === 'service'),
    [items]
  )

  // Verifică dacă există deja un instrument salvat în tăviță (item cu item_type: null)
  // Identificăm instrumentul prin name_snapshot (numele instrumentului)
  const hasInstrumentInSheet = useMemo(
    () => items.some(it => it.item_type === null),
    [items]
  )

  // Obține instrumentul din items cu item_type: null (identificat prin name_snapshot)
  const instrumentFromSheet = useMemo(() => {
    const instrumentItem = items.find(it => it.item_type === null)
    if (instrumentItem?.name_snapshot) {
      // Caută instrumentul în lista de instrumente după nume
      return instruments.find(i => i.name === instrumentItem.name_snapshot)
    }
    return null
  }, [items, instruments])

  // Obține instrumentul curent: din svc.instrumentId sau din items cu instrument salvat
  const currentInstrumentId = useMemo(() => {
    if (svc.instrumentId) return svc.instrumentId
    // Dacă există un instrument salvat în tăviță, folosește-l
    return instrumentFromSheet?.id || ''
  }, [svc.instrumentId, instrumentFromSheet])

  // Verifică dacă instrumentul selectat aparține departamentului "Reparații"
  const isReparatiiInstrument = useMemo(() => {
    if (!currentInstrumentId) return false
    const instrument = instruments.find(i => i.id === currentInstrumentId)
    if (!instrument || !instrument.department_id) {
      console.log('isReparatiiInstrument: instrument not found or no department_id', { currentInstrumentId, instrument })
      return false
    }
    const department = departments.find(d => d.id === instrument.department_id)
    if (!department) {
      console.log('isReparatiiInstrument: department not found', { department_id: instrument.department_id, departments })
      return false
    }
    // Compară numele departamentului case-insensitive
    const deptNameLower = (department.name || '').toLowerCase()
    // Verifică dacă conține "reparat" (pentru a acoperi "Reparatii", "Reparații", etc.)
    const isReparatii = deptNameLower.includes('reparat')
    console.log('isReparatiiInstrument check:', { 
      instrumentName: instrument.name, 
      departmentId: instrument.department_id, 
      departmentName: department.name, 
      deptNameLower, 
      isReparatii 
    })
    return isReparatii
  }, [currentInstrumentId, instruments, departments])

  // Verifică dacă există servicii SAU instrument salvat (pentru blocarea câmpurilor)
  const hasServicesOrInstrumentInSheet = useMemo(
    () => hasServicesInSheet || hasInstrumentInSheet,
    [hasServicesInSheet, hasInstrumentInSheet]
  )

  // Instrumente distincte prezente în tăvița curentă (pentru afișare în UI)
  const distinctInstrumentsInTray = useMemo(() => {
    const ids = Array.from(
      new Set(
        items
          .filter(it => it.instrument_id)
          .map(it => String(it.instrument_id))
      )
    )
    return ids
      .map(id => instruments.find(i => i.id === id))
      .filter((i): i is { id: string; name: string; weight: number; department_id: string | null } => !!i)
  }, [items, instruments])

  // Filtrează serviciile disponibile: exclude serviciile deja folosite pentru instrumentul selectat
  // Include și pachetul de mentenanță dacă instrumentul are unul definit
  const availableServices = useMemo(() => {
    const instrumentId = currentInstrumentId
    if (!instrumentId) return []
    
    // Găsește instrumentul selectat
    const selectedInstrument = instruments.find(i => i.id === instrumentId)
    if (!selectedInstrument) return []
    
    // Găsește serviciile deja folosite pentru instrumentul selectat
    const usedServiceIds = new Set(
      items
        .filter(it => it.item_type === 'service' && it.service_id)
        .map(it => {
          const itemService = services.find(s => s.id === it.service_id)
          // Verifică dacă serviciul este pentru același instrument
          if (itemService?.instrument_id === instrumentId) {
            return it.service_id
          }
          return null
        })
        .filter((id): id is string => id !== null)
    )
    
    // Filtrează serviciile: doar pentru instrumentul selectat și care nu sunt deja folosite
    const regularServices = services.filter(s => s.instrument_id === instrumentId && !usedServiceIds.has(s.id))
    
    // Verifică dacă instrumentul are un pachet de mentenanță definit
    const maintenancePackage = selectedInstrument.name ? MAINTENANCE_PACKAGES[selectedInstrument.name] : null
    
    // Verifică dacă pachetul de mentenanță a fost deja adăugat (verifică dacă toate serviciile din pachet sunt deja în items)
    let isPackageAlreadyAdded = false
    if (maintenancePackage) {
      const packageServiceIds = maintenancePackage.serviceNames
        .map(serviceName => {
          const service = services.find(s => 
            s.name === serviceName && s.instrument_id === instrumentId
          )
          return service?.id
        })
        .filter((id): id is string => id !== null)
      
      // Verifică dacă toate serviciile din pachet sunt deja în items
      isPackageAlreadyAdded = packageServiceIds.length > 0 && 
        packageServiceIds.every(serviceId => usedServiceIds.has(serviceId))
    }
    
    // Dacă instrumentul are pachet de mentenanță și nu a fost deja adăugat, adaugă-l în listă
    if (maintenancePackage && !isPackageAlreadyAdded) {
      const packageOption: MaintenancePackageOption = {
        id: 'MAINTENANCE_PACKAGE',
        name: maintenancePackage.name,
        isPackage: true,
        serviceNames: maintenancePackage.serviceNames,
        instrumentName: selectedInstrument.name
      }
      return [packageOption as any, ...regularServices]
    }
    
    return regularServices
  }, [services, currentInstrumentId, items, instruments])

  // Sincronizează svc.instrumentId cu instrumentul din items când există un instrument salvat
  useEffect(() => {
    if (hasInstrumentInSheet && !svc.instrumentId && instrumentFromSheet) {
      const instrumentId = instrumentFromSheet.id
      if (instrumentId) {
        setSvc(prev => ({ ...prev, instrumentId: instrumentId }))
        setInstrumentForm(prev => ({ ...prev, instrument: instrumentId }))
      }
    }
  }, [hasInstrumentInSheet, svc.instrumentId, instrumentFromSheet])

  // Populează formularul instrument cu datele salvate când se schimbă items-urile (după salvare)
  // Folosește un ref pentru a detecta dacă items-urile s-au schimbat
  const prevItemsLengthRef = useRef(items.length)
  useEffect(() => {
    const instrumentId = currentInstrumentId
    if (instrumentId && items.length > 0) {
      // Forțează reîncărcarea dacă items-urile s-au schimbat (după salvare)
      const itemsChanged = prevItemsLengthRef.current !== items.length
      prevItemsLengthRef.current = items.length
      
      console.log('🔄 useEffect - items changed:', itemsChanged, 'instrumentId:', instrumentId, 'items.length:', items.length)
      
      // Întotdeauna populează cu forceReload pentru a asigura că datele din DB sunt afișate
      populateInstrumentFormFromItems(items, instrumentId, true)
    }
  }, [currentInstrumentId, items, services])

  if (loading) {
    return (
      <div className="p-2 border rounded-lg">Se încarcă…</div>
    );
  }
  
  // Dacă nu există tăvițe, afișează mesaj și buton pentru adăugare
  if (!selectedQuote || quotes.length === 0) {
    return (
      <>
        <div className="space-y-4 border rounded-xl bg-card shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-800/30 border-b">
            <div className="px-4 pt-4 pb-3">
              <h3 className="font-semibold text-base text-foreground">Fișa de serviciu</h3>
            </div>
          </div>
          <div className="p-6 text-center">
            <p className="text-muted-foreground mb-4">Nu există tăvițe în această fișă.</p>
            {/* Buton adaugă tăviță - ascuns pentru pipeline-urile departament */}
            {!isDepartmentPipeline && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('🔵 Buton "Adaugă tăviță" apăsat')
                  onAddSheet()
                }}
                className="flex items-center gap-2 px-4 py-2 mx-auto rounded-lg text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-all duration-200 border-2 border-dashed border-primary/30 hover:border-primary/50 cursor-pointer"
                type="button"
              >
                <Plus className="h-4 w-4" />
                <span>Adaugă tăviță</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Dialog pentru crearea unei tăvițe noi - inclus și aici pentru cazul când nu există tăvițe */}
        <Dialog open={showCreateTrayDialog} onOpenChange={setShowCreateTrayDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Creează tăviță nouă</DialogTitle>
              <DialogDescription>
                Introduceți numărul și mărimea tăviței. Aceste informații vor fi afișate în toate locurile unde apare tăvița.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="tray-number-empty">Număr tăviță</Label>
                <Input
                  id="tray-number-empty"
                  placeholder="ex: 1, 2, A, B..."
                  value={newTrayNumber}
                  onChange={(e) => setNewTrayNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !creatingTray) {
                      handleCreateTray()
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tray-size-empty">Mărime</Label>
                <Select value={newTraySize} onValueChange={setNewTraySize}>
                  <SelectTrigger id="tray-size-empty">
                    <SelectValue placeholder="Selectează mărimea" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Mică</SelectItem>
                    <SelectItem value="medium">Medie</SelectItem>
                    <SelectItem value="large">Mare</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateTrayDialog(false)
                  setNewTrayNumber('')
                  setNewTraySize('medium')
                }}
                disabled={creatingTray}
              >
                Anulează
              </Button>
              <Button
                onClick={handleCreateTray}
                disabled={creatingTray || !newTrayNumber.trim()}
              >
                {creatingTray ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Se creează...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Creează
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="space-y-2 sm:space-y-3 lg:space-y-4 border rounded-lg sm:rounded-xl bg-card shadow-sm overflow-hidden">
      {/* Header modern cu gradient */}
      <div className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-800/30 border-b">
        <div className="px-2 sm:px-3 lg:px-4 pt-2 sm:pt-3 lg:pt-4 pb-2 sm:pb-3 flex items-center justify-between gap-2">
          <h3 className="font-semibold text-sm sm:text-base text-foreground">Fișa de serviciu</h3>
          {/* În pipeline-urile tehnice (departamente), tehnicienii nu pot edita tăvița din acest UI */}
          {selectedQuote && !isDepartmentPipeline && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEditTray}
              className="flex items-center gap-2"
            >
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Editează tăviță</span>
            </Button>
          )}
        </div>
        
        {/* Tabs pentru tăvițe - design modern - ascuns în mod departament */}
        {!isDepartmentPipeline && (
        <div className="px-2 sm:px-3 lg:px-4 pb-2 sm:pb-3">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide">
            {quotes.map((q, index) => (
              <div key={q.id} className="relative group">
                <button
                  onClick={() => onChangeSheet(q.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap
                    ${selectedQuoteId === q.id 
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25' 
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }
                    ${(isVanzariPipeline || isReceptiePipeline) && quotes.length > 1 ? 'pr-8' : ''}`}
                >
                  <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold
                    ${selectedQuoteId === q.id 
                      ? 'bg-primary-foreground/20 text-primary-foreground' 
                      : 'bg-muted-foreground/20 text-muted-foreground'
                    }`}>
                    {q.number || index + 1}
                  </span>
                  <span>Tăviță {q.size && `(${q.size})`}</span>
                </button>
                {/* Buton de ștergere - doar pentru Vânzări și Recepție și când avem mai mult de o tăviță */}
                {(isVanzariPipeline || isReceptiePipeline) && quotes.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setTrayToDelete(q.id)
                      setShowDeleteTrayConfirmation(true)
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"
                    title="Șterge tăvița"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            
            {/* Buton adaugă tăviță nouă - ascuns pentru pipeline-urile departament */}
            {!isDepartmentPipeline && (
              <button
                onClick={onAddSheet}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-all duration-200 whitespace-nowrap border-2 border-dashed border-primary/30 hover:border-primary/50"
              >
                <Plus className="h-4 w-4" />
                <span>Nouă</span>
              </button>
            )}
            {/* Butonul "Trimite tăvițele" - pentru pipeline-ul Curier și Receptie */}
            {(isCurierPipeline || isReceptiePipeline) && (
              <button
                onClick={() => setShowSendConfirmation(true)}
                disabled={sendingTrays || quotes.length === 0 || traysAlreadyInDepartments}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                title={
                  sendingTrays 
                    ? "Se trimit tăvițele..." 
                    : quotes.length === 0 
                    ? "Nu există tăvițe de trimis" 
                    : traysAlreadyInDepartments 
                    ? "Tăvițele sunt deja trimise în departamente" 
                    : `Trimite ${quotes.length} tăviț${quotes.length === 1 ? 'ă' : 'e'} în departamente`
                }
              >
                {sendingTrays ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Se trimit...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Trimite ({quotes.length})
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Secțiune Informații Tăviță – mutată în Fișa de serviciu pentru pipeline-urile comerciale */}
      {isCommercialPipeline && quotes.length > 0 && (
        <div className="px-2 sm:px-3 lg:px-4 pt-2 sm:pt-3 lg:pt-4 pb-2 sm:pb-3 lg:pb-4 border-b bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/70 dark:from-amber-900/40 dark:via-amber-950/40 dark:to-orange-950/30">
          <div className="flex flex-col gap-2 sm:gap-3 lg:gap-4 rounded-lg sm:rounded-xl border border-amber-300/80 dark:border-amber-700/80 bg-white/70 dark:bg-slate-950/40 px-2 sm:px-3 lg:px-4 py-2 sm:py-3 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-700 dark:text-amber-200 flex-shrink-0">
                  <Package className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-xs sm:text-sm text-amber-900 dark:text-amber-100 tracking-wide">
                    Informații Tăviță
                  </span>
                  <span className="text-[10px] sm:text-xs text-amber-800/80 dark:text-amber-200/80">
                    Aici notezi exact ce a spus clientul pentru fiecare tăviță.
                  </span>
                </div>
              </div>
              {activeTrayDetailsId && (
                <span className="inline-flex items-center rounded-full border border-amber-400/80 bg-amber-50/90 dark:bg-amber-900/60 px-3 py-1 text-[11px] font-medium text-amber-900 dark:text-amber-50 shadow-xs">
                  Tăviță selectată: {
                    quotes.find(t => t.id === activeTrayDetailsId)?.number ||
                    quotes.find(t => t.id === activeTrayDetailsId)?.id?.slice(0, 6) ||
                    'N/A'
                  }
                </span>
              )}
            </div>

            {/* Dropdown pentru selectarea tăviței */}
            <div className="grid gap-1.5 sm:gap-2">
              <Label className="text-[10px] sm:text-[11px] font-semibold text-amber-900/90 dark:text-amber-100 uppercase tracking-wide">
                Selectează tăvița pentru care introduci detalii
              </Label>
              <Select
                value={activeTrayDetailsId || undefined}
                onValueChange={(value) => {
                  setSelectedTrayForDetails(value)
                }}
              >
                <SelectTrigger className="w-full h-8 sm:h-9 border-amber-300/80 bg-white/80 dark:bg-slate-950/60 hover:border-amber-400 focus:ring-amber-500/40 text-xs sm:text-sm">
                  <SelectValue placeholder="Selectează tăvița pentru a adăuga detalii..." />
                </SelectTrigger>
                <SelectContent>
                  {quotes.map((tray, index) => (
                    <SelectItem key={tray.id} value={tray.id}>
                      Tăviță #{tray.number || index + 1} - {tray.size}
                      {trayDetailsMap.has(tray.id) && ' ✓'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Textarea cu detalii pentru tăvița selectată */}
            {activeTrayDetailsId && (
              <div className="space-y-1 sm:space-y-1.5">
                <Label className="text-[10px] sm:text-[11px] font-semibold text-amber-900/90 dark:text-amber-100 uppercase tracking-wide">
                  Detalii comandă comunicate de client (vizibile pentru tehnicieni)
                </Label>
                {loadingTrayDetails ? (
                  <div className="flex items-center justify-center py-4 sm:py-6">
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <Textarea
                      value={trayDetails}
                      onChange={(e) => setTrayDetails(e.target.value)}
                      placeholder="Exemple: „Clienta dorește vârfurile foarte ascuțite, fără polish”, „Nu scurtați lama”, „Tăvița 23A – preferă retur prin curier”."
                      className="min-h-[80px] sm:min-h-[100px] lg:min-h-[110px] text-xs sm:text-sm resize-none border-amber-200/80 focus-visible:ring-amber-500/40 bg-white/90 dark:bg-slate-950/60"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-amber-900/80 dark:text-amber-100/80">
                        Aceste note se salvează pe tăvița selectată și sunt vizibile în departamente.
                      </span>
                      <Button
                        size="sm"
                        variant="default"
                        disabled={savingTrayDetails || !activeTrayDetailsId}
                        onClick={async () => {
                          if (!activeTrayDetailsId) {
                            toast.error('Selectează o tăviță')
                            return
                          }

                          setSavingTrayDetails(true)
                          try {
                            // Salvăm detaliile în tray_items.details pentru tăvița selectată
                            const { data, error } = await supabase
                              .from('tray_items')
                              .update({ details: trayDetails } as any)
                              .eq('tray_id', activeTrayDetailsId)
                              .select('tray_id')

                            console.log('[Detalii tavita] Răspuns salvare:', { data, error })

                            if (error && Object.keys(error as any).length > 0) {
                              console.error('Eroare la salvarea detaliilor tăviței:', error)
                              const message = (error as any).message || 'Eroare necunoscută la salvare'
                              toast.error('Eroare la salvarea detaliilor: ' + message)
                            } else {
                              const newMap = new Map(trayDetailsMap)
                              newMap.set(activeTrayDetailsId, trayDetails)
                              setTrayDetailsMap(newMap)
                              toast.success('Detaliile tăviței au fost salvate')
                            }
                          } catch (err: any) {
                            console.error('Eroare la salvarea detaliilor tăviței:', err)
                            toast.error('Eroare: ' + (err.message || 'Eroare necunoscută'))
                          } finally {
                            setSavingTrayDetails(false)
                          }
                        }}
                      >
                        {savingTrayDetails ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                            Salvare...
                          </>
                        ) : (
                          'Salvează detaliile'
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      
      {/* Dialog de confirmare pentru trimiterea tăvițelor */}
      <AlertDialog open={showSendConfirmation} onOpenChange={setShowSendConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmare trimitere
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Ești sigur că ai completat corect și datele comenzii sunt corecte?
              <br /><br />
              <span className="font-medium text-foreground">
                Se vor trimite {quotes.length} tăviț{quotes.length === 1 ? 'ă' : 'e'} în pipeline-urile departamentelor respective.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendingTrays}>Anulează</AlertDialogCancel>
            <AlertDialogAction 
              onClick={sendAllTraysToPipeline}
              disabled={sendingTrays}
              className="bg-green-600 hover:bg-green-700"
            >
              {sendingTrays ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Se trimit...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" /> Da, trimite
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmare pentru ștergerea tăviței */}
      <AlertDialog open={showDeleteTrayConfirmation} onOpenChange={setShowDeleteTrayConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Confirmare ștergere tăviță
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Ești sigur că vrei să ștergi această tăviță?
              <br /><br />
              <span className="font-medium text-red-600">
                Această acțiune nu poate fi anulată. Toate serviciile și piesele din tăviță vor fi șterse.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingTray} onClick={() => setTrayToDelete(null)}>
              Anulează
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteTray}
              disabled={deletingTray}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingTray ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Se șterge...
                </>
              ) : (
                <>
                  <XIcon className="h-4 w-4 mr-1" /> Da, șterge
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog pentru crearea unei tăvițe noi */}
      <Dialog open={showCreateTrayDialog} onOpenChange={setShowCreateTrayDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Creează tăviță nouă</DialogTitle>
            <DialogDescription>
              Introduceți numărul și mărimea tăviței. Aceste informații vor fi afișate în toate locurile unde apare tăvița.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="tray-number">Număr tăviță</Label>
              <Input
                id="tray-number"
                placeholder="ex: 1, 2, A, B..."
                value={newTrayNumber}
                onChange={(e) => setNewTrayNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !creatingTray) {
                    handleCreateTray()
                  }
                }}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tray-size">Mărime</Label>
              <Select value={newTraySize} onValueChange={setNewTraySize}>
                <SelectTrigger id="tray-size">
                  <SelectValue placeholder="Selectează mărimea" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Mică</SelectItem>
                  <SelectItem value="medium">Medie</SelectItem>
                  <SelectItem value="large">Mare</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateTrayDialog(false)
                setNewTrayNumber('')
                setNewTraySize('medium')
              }}
              disabled={creatingTray}
            >
              Anulează
            </Button>
            <Button
              onClick={handleCreateTray}
              disabled={creatingTray || !newTrayNumber.trim()}
            >
              {creatingTray ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Se creează...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Creează
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog pentru editarea unei tăvițe */}
      <Dialog open={showEditTrayDialog} onOpenChange={setShowEditTrayDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editează tăviță</DialogTitle>
            <DialogDescription>
              Modifică numărul și mărimea tăviței. Aceste informații vor fi actualizate în toate locurile unde apare tăvița.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-tray-number">Număr tăviță</Label>
              <Input
                id="edit-tray-number"
                placeholder="ex: 1, 2, A, B..."
                value={editingTrayNumber}
                onChange={(e) => setEditingTrayNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !updatingTray) {
                    handleUpdateTray()
                  }
                }}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-tray-size">Mărime</Label>
              <Select value={editingTraySize} onValueChange={setEditingTraySize}>
                <SelectTrigger id="edit-tray-size">
                  <SelectValue placeholder="Selectează mărimea" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Mică</SelectItem>
                  <SelectItem value="medium">Medie</SelectItem>
                  <SelectItem value="large">Mare</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditTrayDialog(false)
                setEditingTrayNumber('')
                setEditingTraySize('medium')
              }}
              disabled={updatingTray}
            >
              Anulează
            </Button>
            <Button
              onClick={handleUpdateTray}
              disabled={updatingTray || !editingTrayNumber.trim()}
            >
              {updatingTray ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Se actualizează...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvează
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        
        {/* Secțiune Imagini Tăviță - Modern Gallery UI */}
        {selectedQuoteId && canAddTrayImages && (
          <div className="mx-3 mb-4 rounded-xl border border-border/60 bg-gradient-to-br from-slate-50/50 to-white dark:from-slate-900/30 dark:to-slate-800/20 overflow-hidden shadow-sm">
            {/* Header cu gradient subtil */}
            <div className="px-4 py-3 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-b border-border/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <ImageIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">Galerie Imagini</h4>
                    <p className="text-[11px] text-muted-foreground">
                      {trayImages.length === 0 ? 'Nicio imagine încărcată' : 
                       trayImages.length === 1 ? '1 imagine' : `${trayImages.length} imagini`}
                    </p>
                  </div>
                </div>
                
                {/* Acțiuni */}
                <div className="flex items-center gap-2">
                  {trayImages.length > 0 && (
                    <button
                      onClick={handleDownloadAllImages}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Descarcă</span>
                    </button>
                  )}
                  
                  {/* Buton Minimizare/Maximizare */}
                  <button
                    onClick={() => setIsImagesExpanded(!isImagesExpanded)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                    title={isImagesExpanded ? 'Minimizează' : 'Maximizează'}
                  >
                    {isImagesExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            {/* Zona de conținut - Colapsabilă */}
            {isImagesExpanded && (
              <div className="p-4 animate-in slide-in-from-top-2 duration-200">
              {/* Upload Zone - Drag & Drop Style */}
              <label
                htmlFor="tray-image-upload"
                className={`relative flex flex-col items-center justify-center w-full py-6 px-4 mb-4 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer group
                  ${uploadingImage 
                    ? 'border-primary/40 bg-primary/5' 
                    : 'border-border/60 hover:border-primary/50 hover:bg-primary/5 bg-muted/20'
                  }`}
              >
                <input
                  type="file"
                  id="tray-image-upload"
                  accept="image/*"
                  onChange={handleTrayImageUpload}
                  className="hidden"
                  disabled={uploadingImage}
                  multiple
                />
                
                {uploadingImage ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-full bg-primary/10 animate-pulse">
                      <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    </div>
                    <span className="text-sm font-medium text-primary">Se încarcă imaginea...</span>
                  </div>
                ) : (
                  <>
                    <div className="p-3 rounded-full bg-muted/50 group-hover:bg-primary/10 transition-colors mb-2">
                      <ImagePlus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                      Click pentru a adăuga imagini
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      sau trage și plasează aici
                    </p>
                  </>
                )}
              </label>
              
              {/* Grid cu imaginile - masonry-like layout */}
              {trayImages.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {trayImages.map((image, idx) => (
                    <div 
                      key={image.id} 
                      className="group relative aspect-square rounded-xl overflow-hidden bg-muted/30 ring-1 ring-border/30 hover:ring-primary/40 transition-all duration-200 hover:shadow-lg"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <img
                        src={image.url}
                        alt={image.filename}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      
                      {/* Overlay gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      
                      {/* Buton ștergere */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleTrayImageDelete(image.id, image.file_path)
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 backdrop-blur-sm text-white/80 hover:text-white hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110"
                        title="Șterge imaginea"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                      
                      {/* Nume fișier */}
                      <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <p className="text-[11px] font-medium text-white truncate drop-shadow-md">
                          {image.filename}
                        </p>
                      </div>
                      
                      {/* Badge număr */}
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/30 backdrop-blur-sm text-[10px] font-medium text-white/90">
                        #{idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="p-4 rounded-full bg-muted/30 mb-3">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground">Nu există imagini încă</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Adaugă imagini pentru a documenta tăvița
                  </p>
                </div>
              )}
              </div>
            )}
          </div>
        )}
        
        {/* Opțiuni Urgent & Abonament - Compact Bar */}
        <div className="mx-1 sm:mx-2 lg:mx-3 mb-2 sm:mb-3 flex flex-wrap items-center justify-between gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-muted/30 border border-border/40">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4">
            {/* Urgent Toggle - ascuns pentru tehnicieni în pipeline departament */}
            {canEditUrgentAndSubscription && (
            <>
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${urgentAllServices ? 'bg-red-500' : 'bg-muted-foreground/20'}`}>
                <Checkbox
                  id="urgent-all"
                  checked={urgentAllServices}
                  onCheckedChange={(c: any) => setUrgentAllServices(!!c)}
                  className="sr-only"
                />
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${urgentAllServices ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className={`text-xs sm:text-sm font-medium transition-colors ${urgentAllServices ? 'text-red-600' : 'text-muted-foreground group-hover:text-foreground'}`}>
                Urgent
              </span>
              {urgentAllServices && (
                <span className="text-[10px] font-medium text-red-500 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded">
                  +30%
                </span>
              )}
            </label>
            
            {/* Divider */}
            <div className="h-5 w-px bg-border/60" />
            
            {/* Abonament */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Label htmlFor="subscription" className="text-xs sm:text-sm font-medium text-muted-foreground">Abonament</Label>
              <select
                id="subscription"
                className="h-7 sm:h-8 text-xs sm:text-sm rounded-md sm:rounded-lg border border-border/60 px-2 sm:px-3 bg-white dark:bg-background hover:border-primary/40 transition-colors cursor-pointer"
                value={subscriptionType}
                onChange={e => {
                  const newValue = e.target.value as 'services' | 'parts' | 'both' | ''
                  setSubscriptionType(newValue)
                  const savedValue = selectedQuote?.subscription_type || ''
                  if (newValue !== savedValue) {
                    setIsDirty(true)
                  }
                }}
              >
                <option value="">— Fără —</option>
                <option value="services">🏷️ Servicii (-10%)</option>
                <option value="parts">🔧 Piese (-5%)</option>
                <option value="both">✨ Ambele</option>
              </select>
            </div>
            </>
            )}
          
          {/* Checkbox-uri pentru livrare + No Deal - doar în pipeline-ul Vânzări */}
          {isVanzariPipeline && (
            <div className="flex items-center gap-3">
              <div className="h-5 w-px bg-border/60" />
              {/* No Deal la nivel de fișă */}
              <label className="flex items-center gap-2 cursor-pointer group">
                <Checkbox
                  id="no-deal-service-file"
                  checked={noDeal}
                  onCheckedChange={(c: any) => {
                    const isChecked = !!c
                    setNoDeal(isChecked)
                    setIsDirty(true)
                  }}
                  className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                />
                <span className={`text-xs sm:text-sm font-medium transition-colors ${noDeal ? 'text-red-600' : 'text-muted-foreground group-hover:text-foreground'}`}>
                  No Deal
                </span>
              </label>
              <div className="h-5 w-px bg-border/60" />
              <label className="flex items-center gap-2 cursor-pointer group">
                <Checkbox
                  id="office-direct"
                  checked={officeDirect}
                  disabled={curierTrimis}
                  onCheckedChange={(c: any) => {
                    const isChecked = !!c
                    setOfficeDirect(isChecked)
                    if (isChecked) setCurierTrimis(false)
                    setIsDirty(true)
                  }}
                  className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                />
                <span className={`text-xs sm:text-sm font-medium transition-colors ${officeDirect ? 'text-blue-600' : 'text-muted-foreground group-hover:text-foreground'}`}>
                  Office direct
                </span>
              </label>
              <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer group">
                <Checkbox
                  id="curier-trimis"
                  checked={curierTrimis}
                  disabled={officeDirect}
                  onCheckedChange={(c: any) => {
                    const isChecked = !!c
                    setCurierTrimis(isChecked)
                    if (isChecked) setOfficeDirect(false)
                    setIsDirty(true)
                  }}
                  className="data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                />
                <span className={`text-xs sm:text-sm font-medium transition-colors ${curierTrimis ? 'text-purple-600' : 'text-muted-foreground group-hover:text-foreground'}`}>
                  Curier Trimis
                </span>
              </label>
            </div>
          )}
          
          {/* Butoane acțiune fișă */}
          <div className="ml-auto flex items-center gap-2">
            {/* Buton Facturare - doar în pipeline-ul Recepție */}
            {isReceptiePipeline && (
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => {
                  try {
                    // Folosește PrintViewData deja prezent în DOM pentru layout de factură
                    window.print()
                  } catch (err) {
                    console.error('Eroare la pornirea printării/facturării:', err)
                    toast.error('Nu s-a putut deschide fereastra de facturare (print).')
                  }
                }}
                className="shadow-sm"
              >
                Facturează fișa
              </Button>
            )}

            {/* Buton Salvare */}
            <Button 
              size="sm" 
              onClick={saveAllAndLog} 
              disabled={loading || saving || !isDirty}
              className="shadow-sm"
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
          </div>
        </div>
      </div>

      {/* Add Instrument - New Section 
          Ascuns pentru tehnicieni în pipeline-urile departament (Saloane, Frizerii, Horeca, Reparatii) */}
      {!(isDepartmentPipeline && isTechnician) && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg border border-green-200 dark:border-green-800 mx-1 sm:mx-2 p-2 sm:p-3">
          <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Wrench className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
              <span className="text-xs sm:text-sm font-medium text-green-900 dark:text-green-100">Adaugă Instrument</span>
            </div>
            {distinctInstrumentsInTray.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground mr-1">Instrumente în tăviță:</span>
                {distinctInstrumentsInTray.map(inst => (
                  <span
                    key={inst.id}
                    className="inline-flex items-center rounded-full bg-emerald-100/80 dark:bg-emerald-900/40 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-100"
                  >
                    {inst.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3">
          {/* Instrument - 8 cols */}
          <div className="col-span-1 sm:col-span-8">
            <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Instrument</Label>
            <select
              className="w-full h-8 text-sm rounded-md border px-2 bg-white dark:bg-background disabled:opacity-50 disabled:cursor-not-allowed"
              value={instrumentForm.instrument}
              onChange={e => {
                const newInstrumentId = e.target.value

                // Dacă acest instrument ar fi al treilea distinct pe tăviță, nu permitem schimbarea
                if (
                  newInstrumentId &&
                  !distinctInstrumentsInTray.some(i => i.id === newInstrumentId)
                ) {
                  const currentDistinctIds = new Set(
                    items
                      .filter(it => it.instrument_id)
                      .map(it => String(it.instrument_id))
                  )
                  if (currentDistinctIds.size >= 2) {
                    toast.error('Poți avea maxim 2 instrumente pe aceeași tăviță.')
                    return
                  }
                }

                // Sincronizează cu formularul de serviciu și cu setările specifice instrumentului (brand / serial / garanție / qty)
                const savedSettings = instrumentSettings[newInstrumentId] || {}
                const savedQty = savedSettings.qty || '1'
                const savedBrandGroups = savedSettings.brandSerialGroups && savedSettings.brandSerialGroups.length > 0
                  ? savedSettings.brandSerialGroups
                  : [{ brand: '', serialNumbers: [''] }]
                const savedGarantie = savedSettings.garantie || false
                
                setInstrumentForm(prev => ({
                  ...prev,
                  instrument: newInstrumentId,
                  qty: savedQty,
                  brandSerialGroups: savedBrandGroups,
                  garantie: savedGarantie,
                }))
                setSvc(s => ({ 
                  ...s, 
                  instrumentId: newInstrumentId, 
                  id: '',
                  qty: savedQty
                }))
                
                // Activează butonul "Salvează în Istoric" când se selectează un instrument
                setIsDirty(true)
              }}
              title="Selectează instrument (poți avea până la 2 instrumente pe tăviță)"
            >
              <option value="">— selectează —</option>
              {availableInstruments.map(inst => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
          </select>
          </div>

          {/* Cant - 4 cols */}
          <div className="col-span-1 sm:col-span-4">
            <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Cant.</Label>
            <Input
              className="h-7 sm:h-8 text-xs sm:text-sm text-center disabled:opacity-50 disabled:cursor-not-allowed"
            inputMode="numeric"
              value={instrumentForm.qty}
              onChange={e => {
                const newQty = e.target.value
                setInstrumentForm(prev => ({ ...prev, qty: newQty }))
                // Salvează cantitatea pentru instrumentul curent
                if (instrumentForm.instrument) {
                  setInstrumentSettings(prev => ({
                    ...prev,
                    [instrumentForm.instrument]: {
                      qty: newQty,
                      brandSerialGroups: prev[instrumentForm.instrument]?.brandSerialGroups || [{ brand: '', serialNumbers: [''] }],
                      garantie: prev[instrumentForm.instrument]?.garantie || false
                    }
                  }))
                  // Sincronizează și cu formularul de serviciu
                  setSvc(s => ({ ...s, qty: newQty }))
                }
              }}
            placeholder="1"
              disabled={hasServicesOrInstrumentInSheet}
              title={hasServicesOrInstrumentInSheet ? "Cantitatea este blocată - există deja servicii sau instrument în tăviță" : "Introduceți cantitatea"}
          />
        </div>
        </div>

        {/* Brand, Serial Number și Garantie - doar pentru instrumente din departamentul Reparații */}
        {isReparatiiInstrument && (
          <div className="space-y-3 mt-3">
            {instrumentForm.brandSerialGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 p-2 sm:p-3 bg-muted/30 rounded-lg border">
                {/* Brand - 2 cols */}
                <div className="col-span-1 sm:col-span-2">
                  <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Brand</Label>
                  <Input
                    className="h-7 sm:h-8 text-xs sm:text-sm"
                    value={group.brand}
                    onChange={e => onUpdateBrand(groupIndex, e.target.value)}
                    placeholder="Introduceți brand-ul"
                  />
                </div>

                {/* Serial Numbers - 4 cols */}
                <div className="col-span-1 sm:col-span-4">
                  <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Serial Numbers</Label>
                  <div className="space-y-1">
                    {group.serialNumbers.map((serialNumber, serialIndex) => (
                      <div key={serialIndex} className="flex gap-1 items-center">
                        <Input
                          className="h-7 text-sm flex-1"
                          value={serialNumber}
                          onChange={e => onUpdateSerialNumber(groupIndex, serialIndex, e.target.value)}
                          placeholder={`Serial ${serialIndex + 1}`}
                        />
                        {serialIndex === 0 && group.serialNumbers.length === 1 && (
                          <Button 
                            type="button"
                            size="sm" 
                            variant="outline"
                            onClick={() => onAddSerialNumber(groupIndex)}
                            className="h-7 text-xs px-2 flex-shrink-0"
                          >
                            <Plus className="h-3 w-3 mr-1" /> Serial
                          </Button>
                        )}
                        {group.serialNumbers.length > 1 && serialIndex > 0 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => onRemoveSerialNumber(groupIndex, serialIndex)}
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {serialIndex === group.serialNumbers.length - 1 && group.serialNumbers.length > 1 && (
                          <Button 
                            type="button"
                            size="sm" 
                            variant="outline"
                            onClick={() => onAddSerialNumber(groupIndex)}
                            className="h-7 text-xs px-2 flex-shrink-0"
                          >
                            <Plus className="h-3 w-3 mr-1" /> Serial
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Garantie - 2 cols */}
                <div className="col-span-1 sm:col-span-2 flex flex-col justify-end">
                  <div className="flex items-center gap-1 h-7 sm:h-8">
                    <Checkbox
                      id={`instrument-garantie-${groupIndex}`}
                      checked={instrumentForm.garantie}
                      onCheckedChange={(c: any) => {
                        setInstrumentForm(prev => ({ ...prev, garantie: !!c }))
                        setIsDirty(true)
                      }}
                    />
                    <Label htmlFor={`instrument-garantie-${groupIndex}`} className="text-[10px] sm:text-xs cursor-pointer">Garantie</Label>
                  </div>
                </div>

                {/* Buton ștergere grup - 2 cols */}
                <div className="col-span-1 sm:col-span-2 flex flex-col justify-end">
                  {instrumentForm.brandSerialGroups.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemoveBrandSerialGroup(groupIndex)}
                      className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Șterge grup
                    </Button>
                  )}
                </div>

                {/* Buton adaugă grup nou - doar pentru primul grup */}
                {groupIndex === 0 && (
                  <div className="col-span-1 sm:col-span-2 flex flex-col justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={onAddBrandSerialGroup}
                      className="h-7 sm:h-8 text-xs sm:text-sm"
                    >
                      <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                      Adaugă brand
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Add Service - Redesigned */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg border border-blue-200 dark:border-blue-800 mx-1 sm:mx-2 p-2 sm:p-3">
        <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Wrench className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-100">Adaugă Serviciu</span>
          </div>
          <Button size="sm" onClick={onAddService} disabled={!svc.id} className="h-7">
            <Plus className="h-3 w-3 mr-1" /> Adaugă
          </Button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3">
          {/* Serviciu cu search - 6 cols */}
          <div className="relative col-span-1 sm:col-span-6">
            <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Serviciu</Label>
            <div className="relative">
              <Input
                className="h-7 sm:h-8 text-xs sm:text-sm pr-8"
                placeholder={currentInstrumentId ? "Caută serviciu sau click pentru lista completă..." : "Selectează mai întâi un instrument"}
                value={serviceSearchQuery}
                onChange={e => setServiceSearchQuery(e.target.value)}
                onFocus={() => setServiceSearchFocused(true)}
                onBlur={() => setTimeout(() => setServiceSearchFocused(false), 200)}
                disabled={!currentInstrumentId}
              />
              {serviceSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setServiceSearchQuery('')
                    setSvc(s => ({ ...s, id: '' }))
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              )}
            </div>
            {(serviceSearchFocused || serviceSearchQuery) && currentInstrumentId && (
              <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-background border rounded-md shadow-lg">
                {/* Header cu numărul de servicii disponibile */}
                {!serviceSearchQuery && (
                  <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-b sticky top-0">
                    {availableServices.length} servicii disponibile pentru acest instrument
                  </div>
                )}
                {availableServices
                  .filter(s => !serviceSearchQuery || s.name.toLowerCase().includes(serviceSearchQuery.toLowerCase()))
                  .slice(0, serviceSearchQuery ? 10 : 20)
                  .map(s => {
                    // Verifică dacă este pachet de mentenanță
                    if ((s as any).isPackage) {
                      const pkg = s as MaintenancePackageOption
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => {
                            setSvc(prev => ({ ...prev, id: pkg.id }))
                            setServiceSearchQuery(pkg.name)
                            setServiceSearchFocused(false)
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center bg-blue-50 dark:bg-blue-950/30"
                        >
                          <span>📦 {pkg.name}</span>
                        </button>
                      )
                    }
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSvc(prev => ({ ...prev, id: s.id }))
                          setServiceSearchQuery(s.name)
                          setServiceSearchFocused(false)
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center"
                      >
                        <span>{s.name}</span>
                        <span className="text-muted-foreground">{s.price.toFixed(2)} RON</span>
                      </button>
                    )
                  })}
                {serviceSearchQuery && availableServices.filter(s => s.name.toLowerCase().includes(serviceSearchQuery.toLowerCase())).length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Nu s-au găsit servicii</div>
                )}
                {!serviceSearchQuery && availableServices.length > 20 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-t">
                    Tastează pentru a căuta în toate cele {availableServices.length} servicii...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cantitate - 2 cols */}
          <div className="col-span-1 sm:col-span-2">
            <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Cant.</Label>
            <Input
              className="h-7 sm:h-8 text-xs sm:text-sm text-center"
              inputMode="numeric"
              value={svc.qty}
              onChange={e => setSvc(s => ({ ...s, qty: e.target.value }))}
              placeholder="1"
            />
          </div>

          {/* Serial Number - 3 cols */}
          <div className="col-span-1 sm:col-span-3">
            <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Serial Nr.</Label>
            <select
              className="w-full h-7 sm:h-8 text-xs sm:text-sm border rounded-md px-2 bg-background"
              value={svc.serialNumberId}
              onChange={e => setSvc(s => ({ ...s, serialNumberId: e.target.value }))}
            >
              <option value="">-- Fără atribuire --</option>
              {/* Afișează toate serial numbers din brand_groups */}
              {instrumentForm.brandSerialGroups.flatMap((group, gIdx) => 
                group.serialNumbers
                  .filter(sn => sn && sn.trim())
                  .map((sn, snIdx) => (
                    <option key={`${gIdx}-${snIdx}`} value={`${group.brand}::${sn}`}>
                      {group.brand ? `${group.brand} - ${sn}` : sn}
                    </option>
                  ))
              )}
            </select>
          </div>

          {/* Disc - 1 col - ascuns pentru tehnicieni în pipeline departament */}
          {canEditUrgentAndSubscription && (
          <div className="col-span-1">
            <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Disc%</Label>
            <Input
              className="h-7 sm:h-8 text-xs sm:text-sm text-center"
              inputMode="decimal"
              value={svc.discount}
              onChange={e => setSvc(s => ({ ...s, discount: e.target.value }))}
              placeholder="0"
            />
          </div>
          )}
        </div>
      </div>

      {/* Add Part - Redesigned (doar pentru pipeline-ul Reparații sau când canAddParts este true) */}
      {canAddParts && isReparatiiPipeline && (
        <form onSubmit={onAddPart} className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border border-amber-200 dark:border-amber-800 mx-1 sm:mx-2 p-2 sm:p-3">
        <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-100">Adaugă Piesă</span>
          </div>
          <Button type="submit" size="sm" className="h-7" disabled={!part.id}>
            <Plus className="h-3 w-3 mr-1" /> Adaugă
          </Button>
      </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3">
          {/* Piesă cu search - 6 cols */}
          <div className="relative col-span-1 sm:col-span-6">
            <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Piesă</Label>
            <div className="relative">
              <Input
                className="h-7 sm:h-8 text-xs sm:text-sm pr-8"
                placeholder="Caută piesă sau click pentru lista completă..."
                value={partSearchQuery}
                onChange={e => setPartSearchQuery(e.target.value)}
                onFocus={() => setPartSearchFocused(true)}
                onBlur={() => setTimeout(() => setPartSearchFocused(false), 200)}
              />
              {partSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setPartSearchQuery('')
                    setPart(p => ({ ...p, id: '' }))
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              )}
            </div>
            {(partSearchFocused || partSearchQuery) && (
              <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-background border rounded-md shadow-lg">
                {/* Header cu numărul de piese disponibile */}
                {!partSearchQuery && (
                  <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-b sticky top-0">
                    {parts.length} piese disponibile
                  </div>
                )}
                {parts
                  .filter(p => !partSearchQuery || p.name.toLowerCase().includes(partSearchQuery.toLowerCase()))
                  .slice(0, partSearchQuery ? 10 : 20)
                  .map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPart(prev => ({ ...prev, id: p.id, overridePrice: '' }))
                        setPartSearchQuery(p.name)
                        setPartSearchFocused(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center"
                    >
                      <span>{p.name}</span>
                      <span className="text-muted-foreground">{p.price.toFixed(2)} RON</span>
                    </button>
                  ))}
                {partSearchQuery && parts.filter(p => p.name.toLowerCase().includes(partSearchQuery.toLowerCase())).length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Nu s-au găsit piese</div>
                )}
                {!partSearchQuery && parts.length > 20 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-t">
                    Tastează pentru a căuta în toate cele {parts.length} piese...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Serial Number - 4 cols */}
          <div className="col-span-1 sm:col-span-4">
            <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Serial Nr. (instrument)</Label>
            <select
              className="w-full h-7 sm:h-8 text-xs sm:text-sm border rounded-md px-2 bg-background"
              value={part.serialNumberId}
              onChange={e => setPart(p => ({ ...p, serialNumberId: e.target.value }))}
            >
              <option value="">-- Selectează serial --</option>
              {instrumentForm.brandSerialGroups.flatMap((group, gIdx) =>
                group.serialNumbers
                  .filter(sn => sn && sn.trim())
                  .map((sn, snIdx) => (
                    <option key={`${gIdx}-${snIdx}`} value={`${group.brand}::${sn}`}>
                      {group.brand ? `${group.brand} - ${sn}` : sn}
                    </option>
                  ))
              )}
            </select>
          </div>

          {/* Cant - 2 cols */}
          <div className="col-span-1 sm:col-span-2">
            <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Cant.</Label>
            <Input
              className="h-7 sm:h-8 text-xs sm:text-sm text-center"
              inputMode="numeric"
              value={part.qty}
              onChange={e => setPart(p => ({ ...p, qty: e.target.value }))}
              placeholder="1"
            />
          </div>
        </div>
      </form>
      )}

      {/* Items Table */}
      <div className="p-0 mx-1 sm:mx-2 overflow-x-auto border rounded-lg bg-card">
        <Table className="text-xs sm:text-sm min-w-[800px]">
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-20 sm:w-24 text-[10px] sm:text-xs font-semibold">Instrument</TableHead>
              <TableHead className="text-[10px] sm:text-xs font-semibold min-w-[120px]">Serviciu</TableHead>
              <TableHead className="text-[10px] sm:text-xs font-semibold min-w-[100px]">Piesă</TableHead>
              <TableHead className="w-32 sm:w-40 text-[10px] sm:text-xs font-semibold">Brand / Serial</TableHead>
              <TableHead className="w-12 sm:w-16 text-[10px] sm:text-xs font-semibold text-center">Cant.</TableHead>
              <TableHead className="w-20 sm:w-24 text-[10px] sm:text-xs font-semibold text-center">Preț</TableHead>
              <TableHead className="w-12 sm:w-16 text-[10px] sm:text-xs font-semibold text-center">Disc%</TableHead>
              <TableHead className="w-12 sm:w-16 text-[10px] sm:text-xs font-semibold text-center">Urgent</TableHead>
              <TableHead className="w-24 sm:w-28 text-[10px] sm:text-xs font-semibold hidden md:table-cell">Departament</TableHead>
              <TableHead className="w-24 sm:w-28 text-[10px] sm:text-xs font-semibold hidden lg:table-cell">Tehnician</TableHead>
              <TableHead className="w-20 sm:w-24 text-[10px] sm:text-xs font-semibold text-right">Total</TableHead>
              <TableHead className="w-8 sm:w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.filter(it => it.item_type !== null).map(it => {
              const disc = Math.min(100, Math.max(0, it.discount_pct));
              const base = it.qty * it.price;
              const afterDisc = base * (1 - disc / 100);
              const lineTotal = it.urgent ? afterDisc * (1 + URGENT_MARKUP_PCT / 100) : afterDisc;

              // Găsește instrumentul pentru serviciu sau piesă și afișează numele în loc de ID
              let itemInstrument = '—'
              if (it.item_type === 'service' && it.service_id) {
                const serviceDef = services.find(s => s.id === it.service_id)
                if (serviceDef?.instrument_id) {
                  const instrument = instruments.find(i => i.id === serviceDef.instrument_id)
                  itemInstrument = instrument?.name || serviceDef.instrument_id || '—'
                }
              } else if (it.item_type === 'part') {
                // Pentru piese, folosește instrumentul de la primul serviciu din tăviță
                const firstService = items.find(i => i.item_type === 'service' && i.service_id)
                if (firstService?.service_id) {
                  const serviceDef = services.find(s => s.id === firstService.service_id)
                  if (serviceDef?.instrument_id) {
                    const instrument = instruments.find(i => i.id === serviceDef.instrument_id)
                    itemInstrument = instrument?.name || serviceDef.instrument_id || '—'
                  }
                }
              } else if (it.item_type === null) {
                // Pentru items cu doar instrument (item_type: null), identifică instrumentul după name_snapshot
                const instrument = instruments.find(i => i.name === it.name_snapshot)
                itemInstrument = instrument?.name || it.name_snapshot || '—'
              }

              // Determină ce să afișeze în coloanele Serviciu și Piesă
              // Pentru items cu doar instrument (item_type: null), nu afișăm nimic în coloana Serviciu
              const serviceName = it.item_type === 'service' 
                ? it.name_snapshot 
                : it.item_type === 'part' 
                  ? 'Schimb piesă' 
                  : '' // Pentru items cu doar instrument, lăsăm gol
              const partName = it.item_type === 'part' ? it.name_snapshot : null

              return (
                <TableRow key={it.id} className="hover:bg-muted/30">
                  <TableCell className="text-[10px] sm:text-xs text-muted-foreground py-1.5 sm:py-2">
                    {itemInstrument}
                  </TableCell>
                  <TableCell className="font-medium text-xs sm:text-sm py-1.5 sm:py-2">
                    {serviceName}
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm py-1.5 sm:py-2">
                    {it.item_type === 'part' ? (
                      <Input
                        className="h-6 sm:h-7 text-xs sm:text-sm"
                        value={it.name_snapshot}
                        onChange={e => onUpdateItem(it.id, { name_snapshot: e.target.value })}
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Brand / Serial - afișează toate brand-urile cu serial numbers */}
                  <TableCell className="py-1.5 sm:py-2">
                    {(() => {
                      const brandGroups = (it as any).brand_groups || []
                      if (brandGroups.length > 0) {
                        return (
                          <div className="space-y-1">
                            {brandGroups.map((bg: any, idx: number) => (
                              <div key={idx} className="text-[10px] sm:text-xs">
                                <span className="font-medium text-blue-600">{bg.brand || '—'}</span>
                                {bg.serialNumbers && bg.serialNumbers.length > 0 && bg.serialNumbers.some((sn: string) => sn && sn.trim()) && (
                                  <span className="text-muted-foreground ml-1">
                                    ({bg.serialNumbers.filter((sn: string) => sn && sn.trim()).join(', ')})
                                  </span>
                                )}
                                {bg.garantie && <span className="ml-1 text-green-600 text-[9px] sm:text-[10px]">✓G</span>}
                              </div>
                            ))}
                          </div>
                        )
                      } else if (it.brand || it.serial_number) {
                        // Fallback pentru structura veche
                        return (
                          <div className="text-[10px] sm:text-xs">
                            <span className="font-medium text-blue-600">{it.brand || '—'}</span>
                            {it.serial_number && (
                              <span className="text-muted-foreground ml-1">({it.serial_number})</span>
                            )}
                            {it.garantie && <span className="ml-1 text-green-600 text-[9px] sm:text-[10px]">✓G</span>}
                          </div>
                        )
                      }
                      return <span className="text-muted-foreground text-[10px] sm:text-xs">—</span>
                    })()}
                  </TableCell>

                  <TableCell className="py-1.5 sm:py-2">
                    <Input
                      className="h-6 sm:h-7 text-xs sm:text-sm text-center w-12 sm:w-14"
                      inputMode="numeric"
                      value={String(it.qty)}
                      onChange={e => {
                        const v = Math.max(1, Number(e.target.value || 1));
                        onUpdateItem(it.id, { qty: v });
                      }}
                      title="Introduceți cantitatea"
                    />
                  </TableCell>

                  <TableCell className="py-1.5 sm:py-2 text-center">
                    {it.item_type === 'service' ? (
                      <span className="text-xs sm:text-sm">{it.price.toFixed(2)}</span>
                    ) : (
                      <Input
                        className="h-6 sm:h-7 text-xs sm:text-sm text-center w-16 sm:w-20"
                        inputMode="decimal"
                        value={String(it.price)}
                        onChange={e => {
                          const v = Math.max(0, Number(e.target.value || 0));
                          onUpdateItem(it.id, { price: v });
                        }}
                      />
                    )}
                  </TableCell>

                  <TableCell className="py-1.5 sm:py-2">
                    {canEditUrgentAndSubscription ? (
                      <Input
                        className="h-6 sm:h-7 text-xs sm:text-sm text-center w-10 sm:w-12"
                        inputMode="decimal"
                        value={String(it.discount_pct)}
                        onChange={e => {
                          const v = Math.min(100, Math.max(0, Number(e.target.value || 0)));
                          onUpdateItem(it.id, { discount_pct: v });
                        }}
                      />
                    ) : (
                      <span className="text-[10px] sm:text-xs text-muted-foreground">{it.discount_pct}%</span>
                    )}
                  </TableCell>

                  <TableCell className="py-1.5 sm:py-2 text-center">
                    {canEditUrgentAndSubscription ? (
                      <Checkbox
                        checked={!!it.urgent}
                        onCheckedChange={(c: any) => onUpdateItem(it.id, { urgent: !!c })}
                      />
                    ) : (
                      <span className={`text-[10px] sm:text-xs ${it.urgent ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        {it.urgent ? 'Da' : '—'}
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="py-1.5 sm:py-2 hidden md:table-cell">
                    <span className="text-[10px] sm:text-xs text-muted-foreground">
                      {it.pipeline_id 
                        ? pipelinesWithIds.find(p => p.id === it.pipeline_id)?.name || '—'
                        : '—'
                      }
                    </span>
                  </TableCell>

                  <TableCell className="py-1.5 sm:py-2 hidden lg:table-cell">
                    <span className="text-[10px] sm:text-xs text-muted-foreground">
                      {it.technician_id 
                        ? (technicians.find(t => t.id === it.technician_id)?.name || it.technician_id)
                        : '—'
                      }
                    </span>
                  </TableCell>

                  <TableCell className="text-right font-medium text-xs sm:text-sm py-1.5 sm:py-2">{lineTotal.toFixed(2)}</TableCell>

                  <TableCell className="py-1.5 sm:py-2">
                    <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(it.id)}>
                      <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}

            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="text-muted-foreground text-center py-4 sm:py-6 text-xs sm:text-sm">
                  Nu există poziții încă.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Totals */}
      <div className="flex justify-end px-1 sm:px-2">
        <div className="w-full md:w-[280px] lg:w-[320px] space-y-0.5 sm:space-y-1 text-xs sm:text-sm bg-muted/20 rounded-lg p-2 sm:p-3">
        <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
          <span>{subtotal.toFixed(2)} RON</span>
        </div>
        <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span className="text-red-500">-{totalDiscount.toFixed(2)} RON</span>
        </div>
        <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Urgent (+{URGENT_MARKUP_PCT}%)</span>
            <span className="text-amber-600">+{urgentAmount.toFixed(2)} RON</span>
        </div>
          {subscriptionType && (
            <div className="flex flex-col gap-1">
              {(subscriptionType === 'services' || subscriptionType === 'both') && (
          <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Abonament servicii (-10%)</span>
                  <span className="text-green-600">
                    -{items
                      .filter(it => it.item_type === 'service')
                      .reduce((acc, it) => {
                        const base = it.qty * it.price
                        const disc = base * (Math.min(100, Math.max(0, it.discount_pct)) / 100)
                        const afterDisc = base - disc
                        const urgent = it.urgent ? afterDisc * (URGENT_MARKUP_PCT / 100) : 0
                        return acc + (afterDisc + urgent) * 0.10
                      }, 0).toFixed(2)} RON
                  </span>
          </div>
        )}
              {(subscriptionType === 'parts' || subscriptionType === 'both') && (
          <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Abonament piese (-5%)</span>
                  <span className="text-green-600">
                    -{items
                      .filter(it => it.item_type === 'part')
                      .reduce((acc, it) => {
                        const base = it.qty * it.price
                        const disc = base * (Math.min(100, Math.max(0, it.discount_pct)) / 100)
                        return acc + (base - disc) * 0.05
                      }, 0).toFixed(2)} RON
                  </span>
                </div>
              )}
          </div>
        )}
        <div className="h-px bg-border my-2" />
          <div className="flex items-center justify-between font-semibold text-base">
          <span>Total</span>
          <span>{total.toFixed(2)} RON</span>
      </div>
      {/* Greutate tăviță */}
      {(() => {
        // Calculează greutatea totală a instrumentelor din tăviță (inclusiv cantitatea)
        let totalWeight = 0
        
        // Parcurge toate items-urile și calculează greutatea pentru fiecare
        items.forEach(item => {
          let instrumentId: string | null = null
          let qty = item.qty || 1
          
          if (item.item_type === 'service' && item.service_id) {
            const serviceDef = services.find(s => s.id === item.service_id)
            if (serviceDef?.instrument_id) {
              instrumentId = serviceDef.instrument_id
            }
          } else if (item.item_type === null && item.instrument_id) {
            // Pentru items cu doar instrument
            instrumentId = item.instrument_id
          }
          
          // Calculează greutatea pentru acest item (greutate * cantitate)
          if (instrumentId) {
            const instrument = instruments.find(i => i.id === instrumentId)
            if (instrument && instrument.weight) {
              totalWeight += instrument.weight * qty
            }
          }
        })
        
        if (totalWeight > 0) {
          return (
            <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t">
              <span className="text-muted-foreground">Greutate tăviță</span>
              <span className="font-medium">{totalWeight.toFixed(2)} kg</span>
            </div>
          )
        }
        return null
      })()}
        </div>
      </div>

      {/* PrintView - ascuns vizual, dar in DOM pentru print */}
      <div className="pb-2">
        {lead && (
          <PrintViewData 
            lead={lead}
            quotes={quotes}
            allSheetsTotal={allSheetsTotal}
            urgentMarkupPct={URGENT_MARKUP_PCT}
            subscriptionType={subscriptionType}
            services={services}
            instruments={instruments}
            pipelinesWithIds={pipelinesWithIds}
          />
        )}
      </div>
    </div>
  );
})

export default Preturi
