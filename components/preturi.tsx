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
  getNextGlobalServiceFileNumber,
  type Tray,
  type TrayItem,
  type ServiceFile
} from "@/lib/supabase/serviceFileOperations"
import { addServiceFileToPipeline, addTrayToPipeline, moveItemToStage, moveServiceFileToPipeline, getPipelineItemForItem } from "@/lib/supabase/pipelineOperations"
import { listServiceFilesForLead, deleteServiceFile } from "@/lib/supabase/serviceFileOperations"
import { useRole, useAuth } from "@/lib/contexts/AuthContext"
import { getPipelinesWithStages } from "@/lib/supabase/leadOperations"
import { uploadTrayImage, deleteTrayImage, listTrayImages, saveTrayImageReference, deleteTrayImageReference, type TrayImage } from "@/lib/supabase/imageOperations"
import { ImagePlus, X as XIcon, Image as ImageIcon, Loader2, Download, ChevronDown, ChevronUp, Package, ArrowRight, Move } from "lucide-react"
import { toast } from "sonner"
import { supabaseBrowser } from "@/lib/supabase/supabaseClient"
// Componente refactorizate
import { CreateTrayDialog } from './preturi/CreateTrayDialog'
import { EditTrayDialog } from './preturi/EditTrayDialog'
import { MoveInstrumentDialog } from './preturi/MoveInstrumentDialog'
import { TotalsSection } from './preturi/TotalsSection'
import { TrayDetailsSection } from './preturi/TrayDetailsSection'
import { TrayImagesSection } from './preturi/TrayImagesSection'
import { ItemsTable } from './preturi/ItemsTable'
import { AddInstrumentForm } from './preturi/AddInstrumentForm'
import { AddServiceForm } from './preturi/AddServiceForm'
import { AddPartForm } from './preturi/AddPartForm'
import { VanzariView } from './preturi/VanzariView'
import { ReceptieView } from './preturi/ReceptieView'
import { DepartmentView } from './preturi/DepartmentView'
import { CurierView } from './preturi/CurierView'

const supabase = supabaseBrowser()

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
  // Pentru vânzători, numărul și mărimea pot fi goale (undefined)
  const trayData = {
    number: name || '',
    size: size || 'm',
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
  // urgent nu mai există în trays - este gestionat doar în service_files
  
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
    // IMPORTANT: Un item este "part" DOAR dacă are explicit part_id setat
    // Nu marcam automat ca "part" item-urile care nu au instrument_id, deoarece
    // acestea pot fi item-uri incomplete sau vechi din baza de date
    let item_type: 'service' | 'part' | null = notesData.item_type || null
    if (!item_type) {
      if (item.service_id) {
        item_type = 'service'
      } else if (item.part_id) {
        // Dacă are part_id, este clar un part
        item_type = 'part'
      }
      // Dacă nu are nici service_id nici part_id, rămâne null
      // (poate fi doar instrument sau item incomplet)
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
  // if (!opts?.instrument_id) {
  //   throw new Error('instrument_id este obligatoriu pentru a salva un instrument')
  // }
  // if (!opts?.department_id) {
  //   throw new Error('department_id este obligatoriu pentru a salva un instrument')
  // }
  
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

  // State pentru detalii fișă client (comentarii pentru fișa de serviciu, nu mai per tăviță)
  const [trayDetails, setTrayDetails] = useState('')
  const [loadingTrayDetails, setLoadingTrayDetails] = useState(false)
  const [savingTrayDetails, setSavingTrayDetails] = useState(false)

  const [pipelines, setPipelines] = useState<string[]>([])
  const [pipelinesWithIds, setPipelinesWithIds] = useState<Array<{ id: string; name: string }>>([])
  const [pipeLoading, setPipeLoading] = useState(true)
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([])

  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [parts, setParts] = useState<Part[]>([])
  const [instruments, setInstruments] = useState<Array<{ id: string; name: string; weight: number; department_id: string | null }>>([])

  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  
  // State pentru checkbox cash/card (pentru tăvițe - legacy)
  const [isCash, setIsCash] = useState(false)
  const [isCard, setIsCard] = useState(false)
  
  // State pentru payment cash/card la nivel de service file (pentru facturare)
  const [paymentCash, setPaymentCash] = useState(false)
  const [paymentCard, setPaymentCard] = useState(false)
  
  // State pentru checkbox-uri livrare (Office direct / Curier Trimis)
  const [officeDirect, setOfficeDirect] = useState(false)
  const [curierTrimis, setCurierTrimis] = useState(false)

  // State pentru "No Deal" (pentru Vânzări)
  const [noDeal, setNoDeal] = useState(false)
  const [nuRaspunde, setNuRaspunde] = useState(false)
  const [callBack, setCallBack] = useState(false)
  
  // State pentru stages (pentru mutarea lead-ului în stage-uri diferite)
  const [vanzariStages, setVanzariStages] = useState<Array<{ id: string; name: string }>>([])
  const [vanzariPipelineId, setVanzariPipelineId] = useState<string | null>(null)

 
 

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
  const [newTraySize, setNewTraySize] = useState('m')
  const [creatingTray, setCreatingTray] = useState(false)
  
  // State pentru dialog-ul de editare tăviță
  const [showEditTrayDialog, setShowEditTrayDialog] = useState(false)
  const [editingTrayNumber, setEditingTrayNumber] = useState('')
  const [editingTraySize, setEditingTraySize] = useState('m')
  const [updatingTray, setUpdatingTray] = useState(false)

  // State pentru abonament: '' | 'services' | 'parts' | 'both'
  const [subscriptionType, setSubscriptionType] = useState<'services' | 'parts' | 'both' | ''>('')

  // State pentru mutarea instrumentelor în recepție
  const [showMoveInstrumentDialog, setShowMoveInstrumentDialog] = useState(false)
  const [instrumentToMove, setInstrumentToMove] = useState<{ instrument: { id: string; name: string }; items: LeadQuoteItem[] } | null>(null)
  const [targetTrayId, setTargetTrayId] = useState<string>('')
  const [movingInstrument, setMovingInstrument] = useState(false)

  // Debug: Verifică când dialog-ul se deschide
  // useEffect(() => {
  //   if (showMoveInstrumentDialog) {
  //     console.log('🔵 [Dialog] Dialog opened, instrumentToMove:', instrumentToMove)
  //   }
  // }, [showMoveInstrumentDialog, instrumentToMove])

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
  // Receptie poate doar VIZUALIZA imagini, nu le poate adăuga
  const canAddTrayImages = useMemo(() => {
    if (!pipelineSlug) return false
    const slug = pipelineSlug.toLowerCase()
    return slug.includes('saloane') || 
           slug.includes('frizerii') || 
           slug.includes('horeca') || 
           slug.includes('reparatii')
  }, [pipelineSlug])
  
  // Verifică dacă pipeline-ul permite VIZUALIZAREA imaginilor (Receptie poate vedea, dar nu adăuga)
  const canViewTrayImages = useMemo(() => {
    if (!pipelineSlug) return false
    const slug = pipelineSlug.toLowerCase()
    return canAddTrayImages || slug.includes('receptie') || slug.includes('reception')
  }, [pipelineSlug, canAddTrayImages])

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
  // Structură: array de grupuri brand + serial numbers (cu garanție per serial) + cantitate per brand
  const [instrumentForm, setInstrumentForm] = useState({
    instrument: '',
    brandSerialGroups: [{ brand: '', serialNumbers: [{ serial: '', garantie: false }], qty: '1' }] as Array<{ brand: string; serialNumbers: Array<{ serial: string; garantie: boolean }>; qty: string }>,
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
    selectedBrands: [] as string[], // Pentru Vanzari: brand-urile selectate
  })

  // Afișează toate instrumentele disponibile din tabelul instruments
  // Filtrează instrumentele pentru a permite doar instrumente cu același departament ca cele existente în tăviță
  // EXCEPTIE: Pentru Vanzari în tăvița undefined, permite toate instrumentele
  const availableInstruments = useMemo(() => {
    // Verifică dacă suntem în Vanzari și în tăvița undefined
    const isUndefinedTray = selectedQuote && (!selectedQuote.number || selectedQuote.number === '')
    const allowAllInstruments = isVanzariPipeline && isUndefinedTray
    
    // Dacă suntem în Vanzari și în tăvița undefined, permite toate instrumentele
    if (allowAllInstruments) {
      return instruments.sort((a, b) => a.name.localeCompare(b.name, 'ro'))
    }
    
    // Obține departamentele existente în tăviță
    const existingDepartments = new Set<string | null>()
    items.forEach(item => {
      if (item.instrument_id) {
        const instrument = instruments.find(i => i.id === item.instrument_id)
        if (instrument && instrument.department_id) {
          existingDepartments.add(instrument.department_id)
        }
      }
    })
    
    // Dacă există deja instrumente în tăviță, filtrează doar instrumentele cu același departament
    if (existingDepartments.size > 0) {
      const allowedDepartment = Array.from(existingDepartments)[0] // Primul departament găsit
      return instruments
        .filter(inst => inst.department_id === allowedDepartment)
        .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
    }
    
    // Dacă nu există instrumente în tăviță, afișează toate instrumentele
    return instruments.sort((a, b) => a.name.localeCompare(b.name, 'ro'))
  }, [instruments, items, isVanzariPipeline, selectedQuote])

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
  
  // State pentru stage-ul curent al fișei în pipeline-ul Receptie
  const [currentServiceFileStage, setCurrentServiceFileStage] = useState<string | null>(null)

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

  // Actualizează automat cantitatea instrumentului în funcție de numărul de serial number-uri
  useEffect(() => {
    if (!instrumentForm.instrument) return
    
    // Calculează numărul total de serial number-uri din toate grupurile
    const totalSerialNumbers = instrumentForm.brandSerialGroups.reduce((total, group) => {
      // Numără doar serial number-urile care nu sunt goale
      const validSerials = group.serialNumbers.filter(sn => {
        const serial = typeof sn === 'string' ? sn : sn.serial || ''
        return serial && serial.trim()
      })
      return total + validSerials.length
    }, 0)
    
    // Dacă există serial number-uri, actualizează cantitatea
    if (totalSerialNumbers > 0) {
      const newQty = String(totalSerialNumbers)
      // Actualizează doar dacă cantitatea s-a schimbat
      if (instrumentForm.qty !== newQty) {
        setInstrumentForm(prev => ({ ...prev, qty: newQty }))
        // Actualizează și în instrumentSettings pentru a păstra setările
        if (instrumentForm.instrument) {
          setInstrumentSettings(prev => ({
            ...prev,
            [instrumentForm.instrument]: {
              ...prev[instrumentForm.instrument],
              qty: newQty,
              brandSerialGroups: instrumentForm.brandSerialGroups,
              garantie: instrumentForm.garantie
            }
          }))
        }
      }
    }
  }, [instrumentForm.brandSerialGroups, instrumentForm.instrument])

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
  // Tag-ul urgent NU trebuie să existe în pipeline-ul Vanzari, dar trebuie să fie vizibil în Receptie și Curier
  useEffect(() => {
    if (!urgentTagId || !items.length) return

    // Nu atribui tag-ul urgent în pipeline-ul Vanzari
    if (isVanzariPipeline) {
      // Elimină tag-ul urgent dacă există în Vanzari
      const removeUrgentTagFromVanzari = async () => {
        try {
          const { data: existing } = await supabase
            .from('lead_tags')
            .select('lead_id')
            .eq('lead_id', leadId)
            .eq('tag_id', urgentTagId)
            .maybeSingle()

          if (existing) {
            // Tag-ul există dar suntem în Vanzari - elimină-l
            await toggleLeadTag(leadId, urgentTagId)
            console.log('Tag urgent eliminat din Vanzari')
          }
        } catch (error) {
          console.error('Eroare la eliminarea tag-ului urgent din Vanzari:', error)
        }
      }
      removeUrgentTagFromVanzari()
      return
    }

    // Pentru Receptie și Curier, gestionează tag-ul normal
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
  }, [items, urgentTagId, leadId, isVanzariPipeline])

  // IMPORTANT: Reîncarcă urgent și subscription_type din service_file când se schimbă tăvița selectată
  useEffect(() => {
    if (!fisaId || !selectedQuoteId) return
    
    const reloadUrgentAndSubscription = async () => {
      try {
        const { data: serviceFileData } = await getServiceFile(fisaId)
        if (serviceFileData) {
          setUrgentAllServices(serviceFileData.urgent || false)
          setSubscriptionType(serviceFileData.subscription_type || '')
          console.log('Reîncărcare urgent și subscription din service_file la schimbarea tăviței:', {
            fisaId,
            selectedQuoteId,
            urgent: serviceFileData.urgent,
            subscription_type: serviceFileData.subscription_type
          })
        }
      } catch (error) {
        console.error('Eroare la reîncărcarea urgent și subscription:', error)
      }
    }
    
    reloadUrgentAndSubscription()
  }, [fisaId, selectedQuoteId])

  // Încarcă stage-ul curent al fișei în pipeline-ul Receptie pentru a verifica dacă butonul de facturare trebuie afișat
  useEffect(() => {
    if (!fisaId || !isReceptiePipeline || pipelinesWithIds.length === 0) {
      setCurrentServiceFileStage(null)
      return
    }

    const loadCurrentStage = async () => {
      try {
        // Găsește pipeline-ul Receptie
        const receptiePipeline = pipelinesWithIds.find(p => 
          p.name.toLowerCase().includes('receptie') || p.name.toLowerCase().includes('reception')
        )
        
        if (!receptiePipeline) {
          setCurrentServiceFileStage(null)
          return
        }

        // Obține pipeline_item-ul pentru service_file în pipeline-ul Receptie
        const { data: pipelineItem, error } = await getPipelineItemForItem(
          'service_file',
          fisaId,
          receptiePipeline.id
        )

        if (error || !pipelineItem) {
          console.log('Fișa nu este în pipeline-ul Receptie sau eroare:', error)
          setCurrentServiceFileStage(null)
          return
        }

        // Obține numele stage-ului
        if (pipelineItem.stage_id) {
          const { data: stageData, error: stageError } = await supabase
            .from('stages')
            .select('name')
            .eq('id', pipelineItem.stage_id)
            .single()

          if (!stageError && stageData) {
            setCurrentServiceFileStage(stageData.name)
            console.log('Stage curent al fișei în Receptie:', stageData.name)
          } else {
            setCurrentServiceFileStage(null)
          }
        } else {
          setCurrentServiceFileStage(null)
        }
      } catch (error) {
        console.error('Eroare la încărcarea stage-ului curent:', error)
        setCurrentServiceFileStage(null)
      }
    }

    loadCurrentStage()
  }, [fisaId, isReceptiePipeline, pipelinesWithIds])

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

  // Mută fișa în pipeline-ul corespunzător când se bifează checkbox-ul
  async function handleDeliveryCheckboxChange(isOfficeDirect: boolean) {
    if (!fisaId || pipelinesWithIds.length === 0) return

    try {
      // Actualizează checkbox-urile în baza de date
      const { error: updateError } = await updateServiceFile(fisaId, {
        office_direct: isOfficeDirect,
        curier_trimis: !isOfficeDirect,
      })
      
      if (updateError) {
        toast.error('Eroare la salvarea checkbox-urilor')
        return
      }

      const { data: pipelinesData } = await getPipelinesWithStages()
      
      // Normalizează numele stage-urilor pentru căutare (elimină spații, cratime, etc.)
      const normalizeStageName = (name: string) => {
        return name.toLowerCase().replace(/[\s\-_]/g, '')
      }

      // 1. Adaugă în pipeline-ul "Receptie" cu stage-ul corespunzător
      const receptiePipeline = pipelinesWithIds.find(p => p.name.toLowerCase().includes('receptie'))
      if (receptiePipeline) {
        const receptiePipelineData = pipelinesData?.find((p: any) => p.id === receptiePipeline.id)
        if (receptiePipelineData?.stages?.length) {
          const targetStageName = isOfficeDirect ? 'officedirect' : 'curiertrimis'
          
          let stage = receptiePipelineData.stages.find((s: any) => {
            if (s.is_active === false) return false
            const normalized = normalizeStageName(s.name)
            return normalized === targetStageName || normalized.includes(targetStageName)
          })

          // Dacă nu găsește exact, încearcă o căutare mai flexibilă
          if (!stage) {
            const searchTerms = isOfficeDirect ? ['office', 'direct'] : ['curier', 'trimis']
            stage = receptiePipelineData.stages.find((s: any) => {
              if (s.is_active === false) return false
              const normalized = normalizeStageName(s.name)
              return searchTerms.every(term => normalized.includes(term))
            })
          }
          
          if (stage) {
            const result = await moveServiceFileToPipeline(fisaId, receptiePipeline.id, stage.id)
            if (result.ok) {
              console.log(`✅ Fișa adăugată în Receptie - ${stage.name}`)
            } else {
              console.error(`❌ Eroare la adăugarea în Receptie: ${result.message}`)
            }
          }
        }
      }

      // 2. Dacă este "Curier Trimis", adaugă și în pipeline-ul "Curier"
      if (!isOfficeDirect) {
        const curierPipeline = pipelinesWithIds.find(p => p.name.toLowerCase().includes('curier'))
        if (curierPipeline) {
          const curierPipelineData = pipelinesData?.find((p: any) => p.id === curierPipeline.id)
          if (curierPipelineData?.stages?.length) {
            // Găsește primul stage activ sau un stage specific pentru "Curier Trimis"
            let stage = curierPipelineData.stages.find((s: any) => {
              if (s.is_active === false) return false
              const normalized = normalizeStageName(s.name)
              return normalized.includes('curier') && normalized.includes('trimis')
            })
            
            // Dacă nu găsește un stage specific, folosește primul stage activ
            if (!stage) {
              stage = curierPipelineData.stages.find((s: any) => s.is_active === true)
            }
            
            if (stage) {
              const result = await moveServiceFileToPipeline(fisaId, curierPipeline.id, stage.id)
              if (result.ok) {
                console.log(`✅ Fișa adăugată în Curier - ${stage.name}`)
                toast.success(`Fișa adăugată în Receptie și Curier`)
              } else {
                console.error(`❌ Eroare la adăugarea în Curier: ${result.message}`)
              }
            }
          }
        }
      } else {
        // Dacă este "Office Direct", nu adaugă în Curier, dar șterge din Curier dacă există
        const curierPipeline = pipelinesWithIds.find(p => p.name.toLowerCase().includes('curier'))
        if (curierPipeline) {
          await supabase
            .from('pipeline_items')
            .delete()
            .eq('item_id', fisaId)
            .eq('type', 'service_file')
            .eq('pipeline_id', curierPipeline.id)
        }
        toast.success(`Fișa adăugată în Receptie - OFFICE DIRECT`)
      }
    } catch (error: any) {
      toast.error('Eroare la mutarea fișei: ' + (error?.message || 'Eroare necunoscută'))
    }
  }

  // Încarcă detaliile pentru fișa de serviciu (nu mai per tăviță)
  useEffect(() => {
    // Doar în pipeline-urile comerciale folosim această secțiune în Fișa de serviciu
    const loadServiceFileDetails = async () => {
      if (!isCommercialPipeline || !fisaId) {
        setTrayDetails('')
        return
      }

      setLoadingTrayDetails(true)
      try {
        const { data, error } = await supabase
          .from('service_files')
          .select('details')
          .eq('id', fisaId)
          .single()

        if (error) {
          console.error('Eroare la încărcarea detaliilor fișei:', error)
          setTrayDetails('')
          return
        }

        const detailsValue = data?.details || ''
        
        // Încearcă să parseze ca JSON pentru a extrage payment info
        try {
          const parsedDetails = JSON.parse(detailsValue)
          if (typeof parsedDetails === 'object' && parsedDetails !== null) {
            // Dacă este JSON cu text și payment info
            setTrayDetails(parsedDetails.text || '')
            setPaymentCash(parsedDetails.paymentCash || false)
            setPaymentCard(parsedDetails.paymentCard || false)
          } else {
            // Dacă este doar text, păstrează-l
            setTrayDetails(detailsValue)
            setPaymentCash(false)
            setPaymentCard(false)
          }
        } catch {
          // Dacă nu este JSON, este doar text
          setTrayDetails(detailsValue)
          setPaymentCash(false)
          setPaymentCard(false)
        }
      } catch (err) {
        console.error('Eroare la încărcarea detaliilor fișei:', err)
        setTrayDetails('')
        setPaymentCash(false)
        setPaymentCard(false)
      } finally {
        setLoadingTrayDetails(false)
      }
    }

    loadServiceFileDetails()
  }, [isCommercialPipeline, fisaId])

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
  
  // Funcții pentru gestionarea checkbox-urilor NoDeal, NuRaspunde, CallBack (pentru vânzători)
  // Aceste checkbox-uri se salvează în tabelul leads, nu în service_files
  const handleNoDealChange = useCallback(async (checked: boolean) => {
    // Folosește leadId (prop obligatoriu) în loc de lead?.id (prop opțional)
    const targetLeadId = lead?.id || leadId
    
    if (!targetLeadId) {
      console.error('❌ Nu există leadId pentru salvarea no_deal')
      toast.error('Eroare: Nu s-a găsit ID-ul lead-ului')
      return
    }
    
    if (checked) {
      setNoDeal(true)
      setCallBack(false)
      setNuRaspunde(false)
      
      // Salvează imediat în baza de date în tabelul leads
      try {
        console.log('🔍 Începând salvarea no_deal=true pentru lead:', targetLeadId)
        const { data, error: leadError } = await supabase
          .from('leads')
          .update({ no_deal: true })
          .eq('id', targetLeadId)
          .select()
        
        if (leadError) {
          console.error('❌ Eroare la salvarea no_deal în leads:', leadError)
          console.error('❌ Detalii eroare:', JSON.stringify(leadError, null, 2))
          toast.error('Eroare la salvarea "No Deal": ' + (leadError.message || 'Eroare necunoscută'))
          setNoDeal(false) // Revert la starea anterioară dacă salvare eșuează
          return
        } else {
          console.log('✅ no_deal salvat cu succes în leads:', data)
          // Verifică dacă s-a salvat efectiv
          if (data && data.length > 0 && data[0].no_deal === true) {
            console.log('✅ Confirmare: no_deal este TRUE în DB')
            toast.success('"No Deal" salvat cu succes')
          } else {
            console.warn('⚠️ Atenție: no_deal nu pare să fie salvat corect:', data)
          }
        }
      } catch (err: any) {
        console.error('Error saving no_deal:', err)
        console.error('Error details:', JSON.stringify(err, null, 2))
        toast.error('Eroare la salvarea "No Deal": ' + (err.message || 'Eroare necunoscută'))
        setNoDeal(false) // Revert la starea anterioară dacă salvare eșuează
        return
      }
      
      // Mută lead-ul în stage-ul "No Deal" dacă este în pipeline-ul Vanzari
      if (isVanzariPipeline && isVanzator && vanzariPipelineId) {
        const noDealStage = vanzariStages.find(stage => 
          stage.name.toUpperCase() === 'NO DEAL' || 
          stage.name.toUpperCase() === 'NO-DEAL' ||
          stage.name.toUpperCase().includes('NO DEAL')
        )
        if (noDealStage && targetLeadId) {
          try {
            const { error } = await moveItemToStage('lead', targetLeadId, vanzariPipelineId, noDealStage.id)
            if (error) {
              console.error('Error moving lead to No Deal stage:', error)
              toast.error('Eroare la mutarea cardului')
            } else {
              toast.success('Card mutat în ' + noDealStage.name)
            }
          } catch (err: any) {
            console.error('Error:', err)
            toast.error('Eroare: ' + (err.message || 'Eroare necunoscută'))
          }
        }
      }
    } else {
      setNoDeal(false)
      
      // Salvează imediat în baza de date când este debifat
      try {
        console.log('🔍 Începând salvarea no_deal=false pentru lead:', targetLeadId)
        const { data, error: leadError } = await supabase
          .from('leads')
          .update({ no_deal: false })
          .eq('id', targetLeadId)
          .select()
        
        if (leadError) {
          console.error('❌ Eroare la salvarea no_deal în leads:', leadError)
          console.error('❌ Detalii eroare:', JSON.stringify(leadError, null, 2))
          toast.error('Eroare la salvarea "No Deal": ' + (leadError.message || 'Eroare necunoscută'))
          setNoDeal(true) // Revert la starea anterioară dacă salvare eșuează
        } else {
          console.log('✅ no_deal salvat cu succes în leads:', data)
          // Verifică dacă s-a salvat efectiv
          if (data && data.length > 0 && data[0].no_deal === false) {
            console.log('✅ Confirmare: no_deal este FALSE în DB')
            toast.success('"No Deal" eliminat cu succes')
          } else {
            console.warn('⚠️ Atenție: no_deal nu pare să fie salvat corect:', data)
          }
        }
      } catch (err: any) {
        console.error('Error saving no_deal:', err)
        console.error('Error details:', JSON.stringify(err, null, 2))
        toast.error('Eroare la salvarea "No Deal": ' + (err.message || 'Eroare necunoscută'))
        setNoDeal(true) // Revert la starea anterioară dacă salvare eșuează
      }
    }
  }, [isVanzariPipeline, isVanzator, vanzariPipelineId, vanzariStages, lead?.id, leadId])
  
  const handleNuRaspundeChange = useCallback(async (checked: boolean) => {
    // Folosește leadId (prop obligatoriu) în loc de lead?.id (prop opțional)
    const targetLeadId = lead?.id || leadId
    
    if (!targetLeadId) {
      console.error('❌ Nu există leadId pentru salvarea nu_raspunde')
      toast.error('Eroare: Nu s-a găsit ID-ul lead-ului')
      return
    }
    
    if (checked) {
      setNoDeal(false)
      setCallBack(false)
      setNuRaspunde(true)
      
      // Salvează imediat în baza de date în tabelul leads
      try {
        console.log('🔍 Începând salvarea nu_raspunde=true pentru lead:', targetLeadId)
        const { data, error: leadError } = await supabase
          .from('leads')
          .update({ nu_raspunde: true })
          .eq('id', targetLeadId)
          .select()
        
        if (leadError) {
          console.error('❌ Eroare la salvarea nu_raspunde în leads:', leadError)
          console.error('❌ Detalii eroare:', JSON.stringify(leadError, null, 2))
          toast.error('Eroare la salvarea "Nu Raspunde": ' + (leadError.message || 'Eroare necunoscută'))
          setNuRaspunde(false)
          return
        } else {
          console.log('✅ nu_raspunde salvat cu succes în leads:', data)
          if (data && data.length > 0 && data[0].nu_raspunde === true) {
            console.log('✅ Confirmare: nu_raspunde este TRUE în DB')
            toast.success('"Nu Raspunde" salvat cu succes')
          } else {
            console.warn('⚠️ Atenție: nu_raspunde nu pare să fie salvat corect:', data)
          }
        }
      } catch (err: any) {
        console.error('Error saving nu_raspunde:', err)
        console.error('Error details:', JSON.stringify(err, null, 2))
        toast.error('Eroare la salvarea "Nu Raspunde": ' + (err.message || 'Eroare necunoscută'))
        setNuRaspunde(false)
        return
      }
      
      // Mută lead-ul în stage-ul "Nu Raspunde" dacă este în pipeline-ul Vanzari
      if (isVanzariPipeline && isVanzator && vanzariPipelineId) {
        const nuRaspundeStage = vanzariStages.find(stage => 
          stage.name.toUpperCase() === 'NU RASPUNDE' || 
          stage.name.toUpperCase() === 'NU RASUNDE' ||
          stage.name.toUpperCase().includes('RASPUNDE')
        )
        if (nuRaspundeStage && targetLeadId) {
          try {
            const { error } = await moveItemToStage('lead', targetLeadId, vanzariPipelineId, nuRaspundeStage.id)
            if (error) {
              console.error('Error moving lead to Nu Raspunde stage:', error)
              toast.error('Eroare la mutarea cardului')
            } else {
              toast.success('Card mutat în ' + nuRaspundeStage.name)
            }
          } catch (err: any) {
            console.error('Error:', err)
            toast.error('Eroare: ' + (err.message || 'Eroare necunoscută'))
          }
        }
      }
    } else {
      setNuRaspunde(false)
      
      // Salvează imediat în baza de date când este debifat
      try {
        console.log('🔍 Începând salvarea nu_raspunde=false pentru lead:', targetLeadId)
        const { data, error: leadError } = await supabase
          .from('leads')
          .update({ nu_raspunde: false })
          .eq('id', targetLeadId)
          .select()
        
        if (leadError) {
          console.error('❌ Eroare la salvarea nu_raspunde în leads:', leadError)
          console.error('❌ Detalii eroare:', JSON.stringify(leadError, null, 2))
          toast.error('Eroare la salvarea "Nu Raspunde": ' + (leadError.message || 'Eroare necunoscută'))
          setNuRaspunde(true)
        } else {
          console.log('✅ nu_raspunde salvat cu succes în leads:', data)
          if (data && data.length > 0 && data[0].nu_raspunde === false) {
            console.log('✅ Confirmare: nu_raspunde este FALSE în DB')
            toast.success('"Nu Raspunde" eliminat cu succes')
          } else {
            console.warn('⚠️ Atenție: nu_raspunde nu pare să fie salvat corect:', data)
          }
        }
      } catch (err: any) {
        console.error('Error saving nu_raspunde:', err)
        console.error('Error details:', JSON.stringify(err, null, 2))
        toast.error('Eroare la salvarea "Nu Raspunde": ' + (err.message || 'Eroare necunoscută'))
        setNuRaspunde(true)
      }
    }
  }, [isVanzariPipeline, isVanzator, vanzariPipelineId, vanzariStages, lead?.id, leadId])
  
  const handleCallBackChange = useCallback(async (checked: boolean) => {
    // Folosește leadId (prop obligatoriu) în loc de lead?.id (prop opțional)
    const targetLeadId = lead?.id || leadId
    
    if (!targetLeadId) {
      console.error('❌ Nu există leadId pentru salvarea call_back')
      toast.error('Eroare: Nu s-a găsit ID-ul lead-ului')
      return
    }
    
    if (checked) {
      setNoDeal(false)
      setNuRaspunde(false)
      setCallBack(true)
      
      // Salvează imediat în baza de date în tabelul leads
      try {
        console.log('🔍 Începând salvarea call_back=true pentru lead:', targetLeadId)
        const { data, error: leadError } = await supabase
          .from('leads')
          .update({ call_back: true })
          .eq('id', targetLeadId)
          .select()
        
        if (leadError) {
          console.error('❌ Eroare la salvarea call_back în leads:', leadError)
          console.error('❌ Detalii eroare:', JSON.stringify(leadError, null, 2))
          toast.error('Eroare la salvarea "Call Back": ' + (leadError.message || 'Eroare necunoscută'))
          setCallBack(false)
          return
        } else {
          console.log('✅ call_back salvat cu succes în leads:', data)
          if (data && data.length > 0 && data[0].call_back === true) {
            console.log('✅ Confirmare: call_back este TRUE în DB')
            toast.success('"Call Back" salvat cu succes')
          } else {
            console.warn('⚠️ Atenție: call_back nu pare să fie salvat corect:', data)
          }
        }
      } catch (err: any) {
        console.error('Error saving call_back:', err)
        console.error('Error details:', JSON.stringify(err, null, 2))
        toast.error('Eroare la salvarea "Call Back": ' + (err.message || 'Eroare necunoscută'))
        setCallBack(false)
        return
      }
      
      // Mută lead-ul în stage-ul "Call Back" dacă este în pipeline-ul Vanzari
      if (isVanzariPipeline && isVanzator && vanzariPipelineId) {
        const callBackStage = vanzariStages.find(stage => 
          stage.name.toUpperCase() === 'CALLBACK' || 
          stage.name.toUpperCase() === 'CALL BACK' ||
          stage.name.toUpperCase() === 'CALL-BACK' ||
          stage.name.toUpperCase().includes('CALLBACK')
        )
        if (callBackStage && targetLeadId) {
          try {
            const { error } = await moveItemToStage('lead', targetLeadId, vanzariPipelineId, callBackStage.id)
            if (error) {
              console.error('Error moving lead to Call Back stage:', error)
              toast.error('Eroare la mutarea cardului')
            } else {
              toast.success('Card mutat în ' + callBackStage.name)
            }
          } catch (err: any) {
            console.error('Error:', err)
            toast.error('Eroare: ' + (err.message || 'Eroare necunoscută'))
          }
        }
      }
    } else {
      setCallBack(false)
      
      // Salvează imediat în baza de date când este debifat
      try {
        console.log('🔍 Începând salvarea call_back=false pentru lead:', targetLeadId)
        const { data, error: leadError } = await supabase
          .from('leads')
          .update({ call_back: false })
          .eq('id', targetLeadId)
          .select()
        
        if (leadError) {
          console.error('❌ Eroare la salvarea call_back în leads:', leadError)
          console.error('❌ Detalii eroare:', JSON.stringify(leadError, null, 2))
          toast.error('Eroare la salvarea "Call Back": ' + (leadError.message || 'Eroare necunoscută'))
          setCallBack(true)
        } else {
          console.log('✅ call_back salvat cu succes în leads:', data)
          if (data && data.length > 0 && data[0].call_back === false) {
            console.log('✅ Confirmare: call_back este FALSE în DB')
            toast.success('"Call Back" eliminat cu succes')
          } else {
            console.warn('⚠️ Atenție: call_back nu pare să fie salvat corect:', data)
          }
        }
      } catch (err: any) {
        console.error('Error saving call_back:', err)
        console.error('Error details:', JSON.stringify(err, null, 2))
        toast.error('Eroare la salvarea "Call Back": ' + (err.message || 'Eroare necunoscută'))
        setCallBack(true)
      }
    }
  }, [isVanzariPipeline, isVanzator, vanzariPipelineId, vanzariStages, lead?.id, leadId])

  async function saveAllAndLog() {
    setSaving(true)
    try {
      // Salvează detaliile fișei de serviciu dacă există
      if (fisaId && trayDetails !== undefined) {
        try {
          // Salvează detaliile ca JSON care include textul și payment info
          const detailsToSave = JSON.stringify({
            text: trayDetails,
            paymentCash: paymentCash,
            paymentCard: paymentCard
          })
          
          // Folosește updateServiceFile pentru a păstra toate câmpurile existente
          const { error: detailsError } = await updateServiceFile(fisaId, {
            details: detailsToSave
          })
          
          if (detailsError) {
            console.error('Eroare la salvarea detaliilor fișei:', detailsError)
          } else {
            console.log('✅ Detaliile fișei au fost salvate (cu payment info)')
          }
        } catch (err: any) {
          console.error('Eroare la salvarea detaliilor fișei:', err)
        }
      }
      
      // Salvează checkbox-urile pentru livrare în service_file ÎNTOTDEAUNA (chiar și fără tăviță)
      console.log('🔍 DEBUG - Checkpoint salvare curier (începutul funcției):', {
        fisaId,
        officeDirect,
        curierTrimis,
        hasFisaId: !!fisaId,
        hasSelectedQuote: !!selectedQuote
      })
      
      if (fisaId) {
        // Pentru Vanzari, checkbox-urile No Deal, Call Back, Nu Raspunde se salvează în leads, nu în service_files
        // Doar office_direct și curier_trimis se salvează în service_files
        const { error: serviceFileError, data: updatedServiceFile } = await updateServiceFile(fisaId, {
          office_direct: officeDirect,
          curier_trimis: curierTrimis,
          // no_deal nu se mai salvează aici, se salvează în leads prin handleNoDealChange
        })
        
        if (serviceFileError) {
          console.error('❌ Eroare la actualizarea service_file:', serviceFileError)
          toast.error('Eroare la salvarea checkbox-urilor livrare')
        } else {
          console.log('✅ Service file actualizat cu office_direct:', officeDirect, 'curier_trimis:', curierTrimis, 'data:', updatedServiceFile)
          
          // Adaugă fișa în pipeline-urile corespunzătoare dacă unul din checkbox-uri este bifat
          if (officeDirect || curierTrimis) {
            const { data: pipelinesData } = await getPipelinesWithStages()
            
            // Normalizează numele stage-urilor pentru căutare
            const normalizeStageName = (name: string) => {
              return name.toLowerCase().replace(/[\s\-_]/g, '')
            }
            
            // 1. Adaugă în pipeline-ul "Receptie"
            const receptiePipeline = pipelinesWithIds.find(p => p.name.toLowerCase().includes('receptie'))
            if (receptiePipeline) {
              const receptiePipelineData = pipelinesData?.find((p: any) => p.id === receptiePipeline.id)
              if (receptiePipelineData?.stages?.length) {
                const stageNameVariants = officeDirect 
                  ? ['Office direct', 'OFFICE DIRECT', 'office direct']
                  : ['Curier Trimis', 'CURIER TRIMIS', 'curier trimis', 'Curier trimis']
                
                let stageData: { id: string } | null = null
                for (const variant of stageNameVariants) {
                  const stage = receptiePipelineData.stages.find((s: any) => {
                    if (s.is_active === false) return false
                    return s.name?.toLowerCase() === variant.toLowerCase()
                  })
                  if (stage) {
                    stageData = { id: stage.id }
                    break
                  }
                }
                
                // Dacă nu găsește exact, încearcă o căutare mai flexibilă
                if (!stageData) {
                  const searchTerms = officeDirect ? ['office', 'direct'] : ['curier', 'trimis']
                  const stage = receptiePipelineData.stages.find((s: any) => {
                    if (s.is_active === false) return false
                    const normalized = normalizeStageName(s.name)
                    return searchTerms.every(term => normalized.includes(term))
                  })
                  if (stage) {
                    stageData = { id: stage.id }
                  }
                }
                
                if (stageData?.id) {
                  const { error: pipelineError } = await addServiceFileToPipeline(fisaId, receptiePipeline.id, stageData.id)
                  if (pipelineError) {
                    console.error('Eroare la adăugarea fișei în pipeline Receptie:', pipelineError)
                  } else {
                    console.log('✅ Fișa adăugată în pipeline Receptie')
                  }
                }
              }
            }
            
            // 2. Dacă este "Curier Trimis", adaugă și în pipeline-ul "Curier"
            if (curierTrimis) {
              const curierPipeline = pipelinesWithIds.find(p => p.name.toLowerCase().includes('curier'))
              if (curierPipeline) {
                const curierPipelineData = pipelinesData?.find((p: any) => p.id === curierPipeline.id)
                if (curierPipelineData?.stages?.length) {
                  // Găsește un stage specific pentru "Curier Trimis" sau primul stage activ
                  let stage = curierPipelineData.stages.find((s: any) => {
                    if (s.is_active === false) return false
                    const normalized = normalizeStageName(s.name)
                    return normalized.includes('curier') && normalized.includes('trimis')
                  })
                  
                  // Dacă nu găsește un stage specific, folosește primul stage activ
                  if (!stage) {
                    stage = curierPipelineData.stages.find((s: any) => s.is_active === true)
                  }
                  
                  if (stage) {
                    const { error: curierError } = await addServiceFileToPipeline(fisaId, curierPipeline.id, stage.id)
                    if (curierError) {
                      console.error('Eroare la adăugarea fișei în pipeline Curier:', curierError)
                    } else {
                      console.log('✅ Fișa adăugată în pipeline Curier')
                    }
                  }
                }
              }
            } else {
              // Dacă este "Office Direct", șterge din Curier dacă există
              const curierPipeline = pipelinesWithIds.find(p => p.name.toLowerCase().includes('curier'))
              if (curierPipeline) {
                await supabase
                  .from('pipeline_items')
                  .delete()
                  .eq('item_id', fisaId)
                  .eq('type', 'service_file')
                  .eq('pipeline_id', curierPipeline.id)
              }
            }
          } else {
            // Dacă niciun checkbox nu e bifat, șterge din ambele pipeline-uri
            const receptiePipeline = pipelinesWithIds.find(p => p.name.toLowerCase().includes('receptie'))
            if (receptiePipeline) {
              await supabase
                .from('pipeline_items')
                .delete()
                .eq('item_id', fisaId)
                .eq('type', 'service_file')
                .eq('pipeline_id', receptiePipeline.id)
            }
            
            const curierPipeline = pipelinesWithIds.find(p => p.name.toLowerCase().includes('curier'))
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
      
      // Pentru vânzători în pipeline-ul Vânzări, creează automat o tăviță dacă nu există
      let quoteToUse = selectedQuote
      if (isVanzariPipeline && isVanzator && !selectedQuote && fisaId) {
        try {
          // Creează o tăviță temporară fără număr și mărime (sau cu valori default)
          const created = await createQuoteForLead(leadId, '', fisaId || null, 'm')
          quoteToUse = created
          setQuotes([created])
          setSelectedQuoteId(created.id)
          setItems([])
          lastSavedRef.current = []
        } catch (error: any) {
          console.error('Error creating temporary tray for vanzator:', error)
          toast.error('Eroare la crearea tăviței temporare: ' + (error?.message || 'Eroare necunoscută'))
          setSaving(false)
          return
        }
      }
      
      // Restul logicii necesită selectedQuote
      if (!quoteToUse) {
        setSaving(false)
        return
      }
      // Verifică dacă există date de brand/serial de salvat
      const instrumentIdToUse = instrumentForm.instrument || svc.instrumentId
      const groupsToSave = instrumentForm.brandSerialGroups.length > 0 
        ? instrumentForm.brandSerialGroups 
        : [{ brand: '', serialNumbers: [{ serial: '', garantie: false }], qty: '1' }]
      
      const hasValidBrandSerialData = groupsToSave.some(g => {
        const hasBrand = g.brand && g.brand.trim()
        const hasSerialNumbers = g.serialNumbers.some(sn => {
          const serial = typeof sn === 'string' ? sn : sn.serial || ''
          return serial && serial.trim()
        })
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
        
        // Verifică dacă instrumentul este din departamentul "Ascutit" - nu permite brand/serial
        const instrumentDept = departments.find(d => d.id === instrument.department_id)
        const deptNameLower = instrumentDept?.name?.toLowerCase() || ''
        if (deptNameLower.includes('ascutit') || deptNameLower.includes('ascuțit')) {
          toast.error('Instrumentele din departamentul "Ascutit" nu pot avea brand sau serial number.')
          setSaving(false)
          return
        }
        
        // Verifică dacă instrumentul are același departament ca cele existente în tăviță (doar pentru tăvițe definite)
        const isUndefinedTray = selectedQuote && (!selectedQuote.number || selectedQuote.number === '')
        const allowAllInstruments = isVanzariPipeline && isUndefinedTray
        
        if (!allowAllInstruments && selectedQuote && selectedQuote.number && selectedQuote.number.trim() !== '') {
          // Tăviță definită - verifică departamentele
          const existingDepartments = new Set<string | null>()
          items.forEach(item => {
            if (item.instrument_id && item.instrument_id !== instrumentIdToUse) {
              let itemInstrumentId: string | null = null
              if (item.item_type === 'service' && item.service_id) {
                const serviceDef = services.find(s => s.id === item.service_id)
                itemInstrumentId = serviceDef?.instrument_id || null
              } else if (item.instrument_id) {
                itemInstrumentId = item.instrument_id
              }
              
              if (itemInstrumentId) {
                const existingInstrument = instruments.find(i => i.id === itemInstrumentId)
                if (existingInstrument && existingInstrument.department_id) {
                  existingDepartments.add(existingInstrument.department_id)
                }
              }
            }
          })
          
          if (existingDepartments.size > 0 && instrument.department_id) {
            const allowedDepartment = Array.from(existingDepartments)[0]
            if (instrument.department_id !== allowedDepartment) {
              const departmentName = departments.find(d => d.id === allowedDepartment)?.name || 'acest departament'
              const newDepartmentName = departments.find(d => d.id === instrument.department_id)?.name || 'alt departament'
              toast.error(`Nu poți adăuga instrumente cu departamente diferite în aceeași tăviță. Tăvița conține deja instrumente din ${departmentName}, iar instrumentul selectat este din ${newDepartmentName}.`)
              setSaving(false)
              return
            }
          }
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
        
        // IMPORTANT: Reîncarcă toate items-urile existente din DB înainte de a salva instrumentul nou
        // pentru a preveni ștergerea instrumentelor existente
        const allExistingItems = await listQuoteItems(quoteToUse.id, services, instruments, pipelinesWithIds)
        
        // Verifică dacă există deja un tray_item pentru acest instrument
        const existingItem = allExistingItems.find((i: any) => i.instrument_id === instrumentIdToUse && i.item_type === null)
        
        // Transformă structura pentru salvare: grupăm serial numbers-urile după garanție
        // Dacă avem serial numbers cu garanții diferite, creăm brand-uri separate
        const brandSerialGroupsToSend: Array<{ brand: string | null; serialNumbers: string[]; garantie: boolean }> = []
        
        for (const group of groupsToSave) {
          const brandName = group.brand?.trim()
          if (!brandName) continue
          
          // Grupează serial numbers-urile după garanție
          const serialsByGarantie = new Map<boolean, string[]>()
          
          group.serialNumbers.forEach((snData) => {
            const serial = typeof snData === 'string' ? snData : snData.serial || ''
            const snGarantie = typeof snData === 'object' ? (snData.garantie || false) : garantie
            
            if (serial && serial.trim()) {
              if (!serialsByGarantie.has(snGarantie)) {
                serialsByGarantie.set(snGarantie, [])
              }
              serialsByGarantie.get(snGarantie)!.push(serial.trim())
            }
          })
          
          // Creează un grup pentru fiecare nivel de garanție
          serialsByGarantie.forEach((serials, snGarantie) => {
            if (serials.length > 0) {
              brandSerialGroupsToSend.push({
                brand: brandName,
                serialNumbers: serials,
                garantie: snGarantie
              })
            }
          })
        }
        
        const filteredGroups = brandSerialGroupsToSend.filter(g => g.brand || g.serialNumbers.length > 0)
        
        console.log('📤 [saveAllAndLog] Brand serial groups to send:', filteredGroups)
        
        try {
          if (existingItem && existingItem.id) {
            // Actualizează cantitatea și brand-urile/serial numbers pentru item-ul existent
            console.log('📝 [saveAllAndLog] Updating existing item:', existingItem.id)
            
            const supabaseClient = supabaseBrowser()
            let useNewStructure = true
            
            // Actualizează cantitatea pentru instrumentul existent
            const { error: qtyUpdateError } = await supabaseClient
              .from('tray_items')
              .update({ qty: qty })
              .eq('id', existingItem.id)
            
            if (qtyUpdateError) {
              const errorMessage = qtyUpdateError.message || qtyUpdateError.code || JSON.stringify(qtyUpdateError)
              if (errorMessage && errorMessage !== '{}') {
                console.error('❌ Error updating quantity:', errorMessage)
              }
            } else {
              console.log('✅ Quantity updated to:', qty)
            }
            
            // Încearcă să șteargă din noile tabele
            const { error: deleteError } = await supabaseClient
              .from('tray_item_brands' as any)
              .delete()
              .eq('tray_item_id', existingItem.id)
            
            if (deleteError) {
              // Dacă tabelul nu există sau eroarea este validă, folosește câmpurile vechi
              const errorMessage = deleteError.message || deleteError.code || JSON.stringify(deleteError)
              if (deleteError.code === '42P01' || errorMessage.includes('does not exist') || errorMessage.includes('relation') || errorMessage.includes('not found')) {
                console.warn('⚠️ New tables not found, using legacy fields')
                useNewStructure = false
              } else if (errorMessage && errorMessage !== '{}') {
                console.error('❌ Error deleting old brands:', errorMessage)
              }
            }
            
            // Adaugă noile brand-uri și serial numbers
            if (filteredGroups.length > 0 && useNewStructure) {
              for (const group of filteredGroups) {
                const brandName = group.brand?.trim()
                if (!brandName) continue
                
                const groupGarantie = group.garantie || false
                const serialNumbers = group.serialNumbers
                  .map(sn => {
                    const serial = typeof sn === 'string' ? sn : sn.serial || ''
                    return serial.trim()
                  })
                  .filter(sn => sn)
                
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
                  const errorMessage = brandError.message || brandError.code || JSON.stringify(brandError)
                  if (errorMessage && errorMessage !== '{}') {
                    console.error('❌ Error creating brand:', errorMessage)
                  }
                  // Fallback la câmpurile vechi
                  useNewStructure = false
                  break
                }
                
                console.log('✅ Brand created:', (brandResult as any).id)
                
                // 2. Creează serial numbers pentru acest brand
                if (serialNumbers.length > 0 && brandResult) {
                  const serialsToInsert = serialNumbers.map(sn => ({
                    brand_id: (brandResult as any).id,
                    serial_number: sn.trim(),
                  }))
                  
                  const { error: serialsError } = await supabaseClient
                    .from('tray_item_brand_serials' as any)
                    .insert(serialsToInsert as any)
                  
                  if (serialsError) {
                    const errorMessage = serialsError.message || serialsError.code || JSON.stringify(serialsError)
                    if (errorMessage && errorMessage !== '{}') {
                      console.error('❌ Error creating serials:', errorMessage)
                    }
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
              quoteToUse.id,
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
          
          // IMPORTANT: Propagă brand-ul și serial number-ul la toate serviciile asociate cu acest instrument
          // Doar dacă există deja un item salvat (nu pentru item-uri noi care nu au fost încă salvate)
          if (filteredGroups.length > 0 && instrumentIdToUse && existingItem && existingItem.id) {
            console.log('🔄 [saveAllAndLog] Propagating brand/serial to all services for instrument:', instrumentIdToUse)
            
            const supabaseClientForPropagation = supabaseBrowser()
            
            // Găsește toate serviciile din tăviță care au același instrument_id și care au deja un ID valid
            // Folosește allExistingItems pentru a include toate serviciile existente din DB
            const servicesForInstrument = allExistingItems.filter((item: any) => {
              if (item.item_type !== 'service' || !item.service_id || !item.id) return false
              const serviceDef = services.find(s => s.id === item.service_id)
              return serviceDef?.instrument_id === instrumentIdToUse
            })
            
            console.log('📋 [saveAllAndLog] Found', servicesForInstrument.length, 'services for instrument:', instrumentIdToUse)
            
            // Atribuie brand-ul și serial number-ul la fiecare serviciu
            for (const serviceItem of servicesForInstrument) {
              if (!serviceItem.id) {
                console.warn('⚠️ Skipping service item without ID:', serviceItem)
                continue
              }
              
              console.log('💾 [saveAllAndLog] Updating service item:', serviceItem.id, 'with brand/serial')
              
              // Șterge brand-urile existente pentru acest serviciu
              const { error: deleteError } = await supabaseClientForPropagation
                .from('tray_item_brands' as any)
                .delete()
                .eq('tray_item_id', serviceItem.id)
              
              if (deleteError && deleteError.code !== '42P01') {
                const errorMessage = deleteError.message || deleteError.code || JSON.stringify(deleteError)
                if (errorMessage && errorMessage !== '{}') {
                  console.error('❌ Error deleting old brands for service:', errorMessage)
                }
              }
              
              // Adaugă noile brand-uri și serial numbers pentru serviciu
              for (const group of filteredGroups) {
                const brandName = group.brand?.trim()
                if (!brandName) continue
                
                const groupGarantie = group.garantie || false
                const serialNumbers = group.serialNumbers
                  .map(sn => {
                    const serial = typeof sn === 'string' ? sn : sn.serial || ''
                    return serial.trim()
                  })
                  .filter(sn => sn)
                
                // Creează brand-ul pentru serviciu
                const { data: brandResult, error: brandError } = await (supabaseClientForPropagation
                  .from('tray_item_brands') as any)
                  .insert([{
                    tray_item_id: serviceItem.id,
                    brand: brandName,
                    garantie: groupGarantie,
                  }])
                  .select()
                  .single()
                
                if (brandError) {
                  const errorMessage = brandError.message || brandError.code || JSON.stringify(brandError)
                  if (errorMessage && errorMessage !== '{}') {
                    console.error('❌ Error creating brand for service:', errorMessage)
                  }
                  continue
                }
                
                // Creează serial numbers pentru acest brand
                if (serialNumbers.length > 0 && brandResult) {
                  const serialsToInsert = serialNumbers.map(sn => ({
                    brand_id: (brandResult as any).id,
                    serial_number: sn.trim(),
                  }))
                  
                  const { error: serialsError } = await supabaseClientForPropagation
                    .from('tray_item_brand_serials' as any)
                    .insert(serialsToInsert as any)
                  
                  if (serialsError) {
                    const errorMessage = serialsError.message || serialsError.code || JSON.stringify(serialsError)
                    if (errorMessage && errorMessage !== '{}') {
                      console.error('❌ Error creating serials for service:', errorMessage)
                    }
                  } else {
                    console.log('✅ Brand/serial propagated to service:', serviceItem.id)
                  }
                }
              }
            }
            
            console.log('✅ [saveAllAndLog] Brand/serial propagated to all services')
          }
          
          toast.success('Brand și serial numbers salvate cu succes!')
          
          // Reîncarcă items pentru quote
          const newItems = await listQuoteItems(quoteToUse.id, services, instruments, pipelinesWithIds)
          setItems(newItems)
          
          // IMPORTANT: Păstrează datele din formular înainte de a popula din items
          // pentru a evita resetarea formularului dacă populateInstrumentFormFromItems nu găsește date
          const currentBrandSerialGroups = instrumentForm.brandSerialGroups
          const currentInstrument = instrumentForm.instrument
          const currentQty = instrumentForm.qty
          const currentGarantie = instrumentForm.garantie
          
          // Populează formularul cu datele noi încărcate
          populateInstrumentFormFromItems(newItems, instrumentIdToUse, true)
          
          // Verifică dacă populateInstrumentFormFromItems a găsit date în DB
          // Dacă nu, păstrează datele din formular care tocmai au fost salvate
          const directInstrumentItem = newItems.find(item => 
            item.item_type === null && item.instrument_id === instrumentIdToUse
          )
          
          const hasBrandDataInDB = directInstrumentItem && (
            ((directInstrumentItem as any).brand_groups && (directInstrumentItem as any).brand_groups.length > 0) ||
            directInstrumentItem.brand ||
            directInstrumentItem.serial_number
          )
          
          // Dacă nu există date în DB dar avem date în formular, păstrează-le
          if (!hasBrandDataInDB && currentBrandSerialGroups.some(g => 
            (g.brand && g.brand.trim()) || g.serialNumbers.some(sn => {
              const serial = typeof sn === 'string' ? sn : sn.serial || ''
              return serial && serial.trim()
            })
          )) {
            console.log('🔄 No brand data found in DB after save, keeping form data')
            // Folosim setTimeout pentru a permite populateInstrumentFormFromItems să se execute mai întâi
            setTimeout(() => {
              setInstrumentForm({
                instrument: currentInstrument,
                brandSerialGroups: currentBrandSerialGroups,
                garantie: currentGarantie,
                qty: currentQty
              })
            }, 50)
          }
          
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
          // IMPORTANT: Verifică dacă există alte items în DB, nu doar în items din UI
          const hasOtherItems = allExistingItems.some((item: any) => 
            item.id !== existingItem?.id && (
              item.item_type !== null || // Servicii sau piese
              (item.item_type === null && item.instrument_id !== instrumentIdToUse) // Alte instrumente
            )
          )
          
          if (!hasOtherItems && items.length <= 1) {
            await recalcAllSheetsTotal(quotes)
            toast.success('Instrumentul și datele brand/serial au fost salvate!')
            setIsDirty(false)
            setSaving(false)
            return
          }
          
          // IMPORTANT: Actualizează items cu allExistingItems pentru a include toate items-urile existente
          // înainte de a continua cu persistAndLogServiceSheet
          setItems(allExistingItems)
          
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
        if (instrument) {
          // Verifică dacă instrumentul are department_id
          if (!instrument.department_id) {
            toast.error('Instrumentul selectat nu are departament setat.')
            setSaving(false)
            return
          }
          
          // IMPORTANT: Reîncarcă toate items-urile existente din DB înainte de a salva instrumentul nou
          // pentru a preveni ștergerea instrumentelor existente
          const existingItems = await listQuoteItems(quoteToUse.id, services, instruments, pipelinesWithIds)
          
          // Verifică dacă instrumentul are același departament ca cele existente în tăviță (doar pentru tăvițe definite)
          // EXCEPTIE: Pentru Vanzari în tăvița undefined, permite toate instrumentele
          const isUndefinedTray = selectedQuote && (!selectedQuote.number || selectedQuote.number === '')
          const allowAllInstruments = isVanzariPipeline && isUndefinedTray
          
          if (!allowAllInstruments && selectedQuote && selectedQuote.number && selectedQuote.number.trim() !== '') {
            // Tăviță definită - verifică departamentele
            const existingDepartments = new Set<string | null>()
            existingItems.forEach(item => {
              if (item.instrument_id && item.instrument_id !== instrumentIdToUse) {
                let itemInstrumentId: string | null = null
                if (item.item_type === 'service' && item.service_id) {
                  const serviceDef = services.find(s => s.id === item.service_id)
                  itemInstrumentId = serviceDef?.instrument_id || null
                } else if (item.instrument_id) {
                  itemInstrumentId = item.instrument_id
                }
                
                if (itemInstrumentId) {
                  const existingInstrument = instruments.find(i => i.id === itemInstrumentId)
                  if (existingInstrument && existingInstrument.department_id) {
                    existingDepartments.add(existingInstrument.department_id)
                  }
                }
              }
            })
            
            if (existingDepartments.size > 0 && instrument.department_id) {
              const allowedDepartment = Array.from(existingDepartments)[0]
              if (instrument.department_id !== allowedDepartment) {
                const departmentName = departments.find(d => d.id === allowedDepartment)?.name || 'acest departament'
                const newDepartmentName = departments.find(d => d.id === instrument.department_id)?.name || 'alt departament'
                toast.error(`Nu poți adăuga instrumente cu departamente diferite în aceeași tăviță. Tăvița conține deja instrumente din ${departmentName}, iar instrumentul selectat este din ${newDepartmentName}.`)
                setSaving(false)
                return
              }
            }
          }
          
          if (instrument.department_id) {
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
            await addInstrumentItem(quoteToUse.id, instrument.name, {
              instrument_id: instrument.id,
              department_id: instrument.department_id,
              qty: qty,
              pipeline_id: autoPipelineId,
            })
            
            const newItems = await listQuoteItems(quoteToUse.id, services, instruments, pipelinesWithIds)
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
      }
      
      // Salvează urgent și subscription_type în service_file (pentru toate tăvițele din fișă)
      if (fisaId) {
        const serviceFileUpdates: any = {
          urgent: urgentAllServices,
        }
        
        // Adaugă subscription_type doar dacă este valid
        if (subscriptionType && ['services', 'parts', 'both'].includes(subscriptionType)) {
          serviceFileUpdates.subscription_type = subscriptionType
        } else {
          serviceFileUpdates.subscription_type = null
        }
        
        console.log('Salvare urgent și subscription_type în service_file:', { fisaId, serviceFileUpdates })
        
        try {
          await updateServiceFile(fisaId, serviceFileUpdates)
          console.log('Service file actualizat cu succes (urgent:', urgentAllServices, ', subscription:', subscriptionType, ')')
          
          // urgent nu mai există în trays - este gestionat doar în service_files
          // Actualizează urgent pentru toate items-urile din toate tăvițele din fișă
          const trayIds = quotes.map(q => q.id)
          if (trayIds.length > 0) {
            const { data: allTrayItems } = await supabase
              .from('tray_items')
              .select('id, notes')
              .in('tray_id', trayIds)
            
            if (allTrayItems && allTrayItems.length > 0) {
              for (const item of allTrayItems) {
                let notesData: any = {}
                if (item.notes) {
                  try {
                    notesData = JSON.parse(item.notes)
                  } catch (e) {
                    // Notes nu este JSON, ignoră
                  }
                }
                
                // Actualizează urgent doar pentru servicii și piese
                if (notesData.item_type === 'service' || notesData.item_type === 'part') {
                  notesData.urgent = urgentAllServices
                  await supabase
                    .from('tray_items')
                    .update({ notes: JSON.stringify(notesData) })
                    .eq('id', item.id)
                }
              }
            }
          }
        } catch (updateError: any) {
          console.error('Eroare la actualizarea service_file:', updateError)
          // Nu aruncăm eroare, continuăm cu salvarea normală
        }
      }
      
      // Logica normală pentru salvare (dacă există items sau nu e doar instrument)
      // Pregătește datele pentru salvare
      const updateData: any = {
        is_cash: isCash,
        is_card: isCard,
      }
      
      console.log('Salvare quote:', { quoteId: quoteToUse.id, updateData })
      
      // salveaza cash/card in baza de date (pentru compatibilitate)
      // Notă: is_cash, is_card nu există în noua arhitectură
      try {
        await updateQuote(quoteToUse.id, updateData)
      } catch (updateError: any) {
        // Dacă eroarea este PGRST116 (nu există rânduri), ignorăm pentru că
        // probabil nu există actualizări pentru câmpurile care există în trays
        if (updateError?.code === 'PGRST116') {
          console.warn('Nu există actualizări pentru tray (doar is_cash/is_card care nu există în noua arhitectură)')
        } else {
          throw updateError
        }
      }
      
      // IMPORTANT: Reîncarcă toate items-urile existente din DB înainte de a salva
      // pentru a preveni ștergerea instrumentelor existente
      const allExistingItems = await listQuoteItems(quoteToUse.id, services, instruments, pipelinesWithIds)
      
      // Helper pentru a verifica dacă un ID este local (temporar)
      const isLocalId = (id: string | number) => String(id).startsWith("local_") || String(id).startsWith("temp-") || String(id).includes("local-")
      
      // Combină items-urile existente cu cele noi din UI
      // Creează un map pentru items-urile existente (după ID)
      const existingItemsMap = new Map(allExistingItems.map(it => [String(it.id), it]))
      
      // Adaugă sau actualizează items-urile din UI
      const itemsToSave = [...allExistingItems]
      for (const uiItem of items) {
        if (isLocalId(uiItem.id)) {
          // Item nou din UI - va fi adăugat de persistAndLogServiceSheet
          itemsToSave.push(uiItem)
        } else {
          // Item existent - actualizează-l cu datele din UI
          const existingItem = existingItemsMap.get(String(uiItem.id))
          if (existingItem) {
            // Actualizează item-ul existent cu datele din UI
            const index = itemsToSave.findIndex(it => String(it.id) === String(uiItem.id))
            if (index !== -1) {
              itemsToSave[index] = { ...existingItem, ...uiItem }
            }
          }
        }
      }
      
      console.log('🔧 Pregătire salvare tăviță:', {
        leadId,
        quoteId: quoteToUse.id,
        itemsCount: itemsToSave.length,
        existingItemsCount: allExistingItems.length,
        uiItemsCount: items.length,
        items: itemsToSave.map(it => ({ 
          id: it.id, 
          type: it.item_type, 
          name: it.name_snapshot,
          service_id: it.service_id,
          instrument_id: it.instrument_id,
          department_id: it.department_id
        })),
        prevSnapshotCount: (lastSavedRef.current as any)?.length || 0,
      })
      
      // Verifică să nu existe mai mult de 2 instrumente diferite pe tăvița curentă (doar pentru pipeline-urile non-Vanzari și non-Curier)
      if (!isVanzariPipeline && !isCurierPipeline) {
        const instrumentIds = Array.from(
          new Set(
            itemsToSave
              .filter(it => it.instrument_id)
              .map(it => String(it.instrument_id))
          )
        )
        if (instrumentIds.length > 2) {
          toast.error('Maxim 2 instrumente pot fi asociate aceleiași tăvițe.')
          return
        }
      }

      const { items: fresh, snapshot } = await persistAndLogServiceSheet({
        leadId,
        quoteId: quoteToUse.id,
        items: itemsToSave,
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
      
      // Funcție helper pentru verificarea dacă o fișă are conținut (tăvițe cu items care au instrument_id sau service_id sau part_id)
      const checkServiceFileHasContent = async (serviceFileId: string): Promise<boolean> => {
        try {
          // Obține toate tăvițele pentru fișă
          const { data: trays } = await listTraysForServiceFile(serviceFileId)
          if (!trays || trays.length === 0) {
            return false // Nu are tăvițe = goală
          }
          
          // Verifică fiecare tăviță pentru items cu conținut
          for (const tray of trays) {
            const { data: trayItems } = await listTrayItemsForTray(tray.id)
            if (trayItems && trayItems.length > 0) {
              // Verifică dacă există cel puțin un item cu instrument_id, service_id sau part_id
              const hasContent = trayItems.some(item => 
                item.instrument_id || item.service_id || item.part_id
              )
              if (hasContent) {
                return true // Fișa are conținut
              }
            }
          }
          
          return false // Nu are conținut
        } catch (error) {
          console.error('Error checking service file content:', error)
          return false // În caz de eroare, considerăm că nu are conținut
        }
      }
      
      // Verifică dacă fișa curentă este goală și o șterge dacă este cazul
      if (fisaId) {
        const hasContent = await checkServiceFileHasContent(fisaId)
        if (!hasContent) {
          console.log('🗑️ Fișa este goală, se șterge automat:', fisaId)
          const { success, error: deleteError } = await deleteServiceFile(fisaId)
          if (success) {
            console.log('✅ Fișa goală a fost ștearsă automat')
            toast.info('Fișa goală a fost ștearsă automat')
            // Reîncarcă datele pentru a actualiza UI-ul
            window.location.reload()
            return
          } else {
            console.error('Eroare la ștergerea fișei goale:', deleteError)
          }
        }
      }
      
      // Verifică dacă lead-ul are cel puțin o fișă de serviciu CU CONȚINUT și mută-l în "Lead vechi" dacă este în Vanzari
      if (leadId && isVanzariPipeline && vanzariPipelineId && vanzariStages.length > 0) {
        try {
          const { data: serviceFiles } = await listServiceFilesForLead(leadId)
          if (serviceFiles && serviceFiles.length > 0) {
            // Verifică dacă există cel puțin o fișă cu conținut
            let hasAnyFileWithContent = false
            for (const serviceFile of serviceFiles) {
              const hasContent = await checkServiceFileHasContent(serviceFile.id)
              if (hasContent) {
                hasAnyFileWithContent = true
                break
              }
            }
            
            if (hasAnyFileWithContent) {
              // Caută stage-ul "Lead vechi" în pipeline-ul Vanzari
              const leadVechiStage = vanzariStages.find(stage => 
                stage.name.toUpperCase() === 'LEAD VECHI' || 
                stage.name.toUpperCase() === 'LEAD-VECHI' ||
                stage.name.toUpperCase().includes('LEAD') && stage.name.toUpperCase().includes('VECHI')
              )
              
              if (leadVechiStage && lead?.id) {
                // Verifică dacă lead-ul nu este deja în stage-ul "Lead vechi"
                const { data: currentPipelineItem } = await getPipelineItemForItem('lead', lead.id, vanzariPipelineId)
                if (currentPipelineItem?.stage_id !== leadVechiStage.id) {
                  const { error: moveError } = await moveItemToStage('lead', lead.id, vanzariPipelineId, leadVechiStage.id)
                  if (moveError) {
                    console.error('Error moving lead to Lead vechi stage:', moveError)
                  } else {
                    console.log('✅ Lead mutat automat în stage-ul "Lead vechi" (are fișe cu conținut)')
                  }
                }
              }
            }
          }
        } catch (err: any) {
          console.error('Error checking/moving lead to Lead vechi:', err)
          // Nu afișăm eroare utilizatorului, doar logăm
        }
      }
      
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

  // Actualizează ref-ul pentru funcția de salvare la fiecare render
  useEffect(() => {
    saveRef.current = saveAllAndLog;
  });

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
      quotes: quotes.map(q => ({ id: q.id, number: q.number })),
      fisaId
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

    // IMPORTANT: Încarcă urgent din service_file și propagă la toate tăvițele și items-urile
    let serviceFileUrgent = false
    if (fisaId) {
      const { data: serviceFileData } = await getServiceFile(fisaId)
      if (serviceFileData) {
        serviceFileUrgent = serviceFileData.urgent || false
        console.log('📋 Urgent din service_file:', serviceFileUrgent)
        
        // urgent nu mai există în trays - este gestionat doar în service_files
        const trayIds = quotes.map(q => q.id)
        if (trayIds.length > 0) {
          
          // Actualizează urgent pentru toate items-urile din toate tăvițele
          const { data: allTrayItems } = await supabase
            .from('tray_items')
            .select('id, notes')
            .in('tray_id', trayIds)
          
          if (allTrayItems && allTrayItems.length > 0) {
            for (const item of allTrayItems) {
              let notesData: any = {}
              if (item.notes) {
                try {
                  notesData = JSON.parse(item.notes)
                } catch (e) {
                  // Notes nu este JSON, ignoră
                }
              }
              
              // Actualizează urgent doar pentru servicii și piese
              if (notesData.item_type === 'service' || notesData.item_type === 'part') {
                notesData.urgent = serviceFileUrgent
                await supabase
                  .from('tray_items')
                  .update({ notes: JSON.stringify(notesData) })
                  .eq('id', item.id)
              }
            }
          }
          
          console.log('✅ Urgent propagat la toate tăvițele și items-urile')
        }
      }
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
            .select('user_id, name')
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
                } else if (m.user_id) {
                  // Fallback: folosește o parte din user_id
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
      
        // Load trays for service sheet
        let qs: LeadQuote[];
        if (fisaId) {
          // Dacă avem fisaId, încarcă doar tăvițele din acea fișă
          qs = await listTraysForServiceSheet(fisaId);
          
          // Pentru vânzători în pipeline-ul Vânzări, creează automat o tăviță undefined dacă nu există
          if (isVanzariPipeline && isVanzator && qs.length === 0) {
            try {
              const created = await createQuoteForLead(leadId, '', fisaId, 'm')
              qs = [created]
              console.log('✅ Tăviță undefined creată automat pentru vânzător:', created.id)
            } catch (error: any) {
              console.error('Eroare la crearea tăviței undefined pentru vânzător:', error)
              toast.error('Eroare la crearea tăviței: ' + (error?.message || 'Eroare necunoscută'))
            }
          }
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
            // Creează o fișă de serviciu implicită cu număr global
            const { data: nextGlobalNumber, error: numberError } = await getNextGlobalServiceFileNumber()
            
            if (numberError || nextGlobalNumber === null) {
              throw new Error('Nu s-a putut obține următorul număr global pentru fișă')
            }
            
            const { data: newServiceFile, error: sfError } = await createServiceFile({
              lead_id: leadId,
              number: `Fisa ${nextGlobalNumber}`,
              date: new Date().toISOString().split('T')[0],
              status: 'noua'
            })
            
            if (sfError || !newServiceFile) {
              throw new Error('Nu s-a putut crea fișa de serviciu implicită')
            }
            defaultFisaId = (newServiceFile as any).id
            
            // NOTĂ: Nu mutăm automat în "Lead vechi" la crearea fișei, ci doar după ce se adaugă conținut
            // Mutarea se face în funcția saveAllAndLog după ce se verifică că fișa are conținut
          } else {
            defaultFisaId = existingServiceFiles[0].id
          }
          
          qs = await listTraysForServiceSheet(defaultFisaId!)
          
          // Pentru vânzători în pipeline-ul Vânzări, creează automat o tăviță undefined dacă nu există (pentru orice fișă nouă)
          if (isVanzariPipeline && isVanzator && qs.length === 0) {
            try {
              const created = await createQuoteForLead(leadId, '', defaultFisaId!, 'm')
              qs = [created]
              console.log('✅ Tăviță undefined creată automat pentru vânzător (fișă nouă):', created.id)
            } catch (error: any) {
              console.error('Eroare la crearea tăviței undefined pentru vânzător:', error)
              toast.error('Eroare la crearea tăviței: ' + (error?.message || 'Eroare necunoscută'))
            }
          }
          
          // NOTĂ: Mutarea în "Lead vechi" se face în funcția saveAllAndLog după ce se verifică că fișa are conținut
          // Nu mutăm automat la încărcare, ci doar după salvare când se verifică conținutul real
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
        
        // Pentru vânzători, deschide automat detaliile tăviței (dacă există)
        if (isVanzariPipeline && isVanzator && firstId) {
          // Tăvița este deja selectată, detaliile se vor încărca automat
          console.log('✅ Tăviță selectată automat pentru vânzător:', firstId)
        }
        
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
        
        // Încarcă checkbox-urile pentru livrare din service_file (în paralel)
        // Pentru Vanzari, checkbox-urile No Deal, Call Back, Nu Raspunde se încarcă din leads
        if (fisaId) {
          parallelTasks.push(
            getServiceFile(fisaId).then(({ data: serviceFileData }) => {
              if (serviceFileData) {
                setOfficeDirect(serviceFileData.office_direct || false)
                setCurierTrimis(serviceFileData.curier_trimis || false)
                
                // Încarcă urgent și subscription_type din service_file
                setUrgentAllServices(serviceFileData.urgent || false)
                setSubscriptionType(serviceFileData.subscription_type || '')
                
                console.log('Încărcare checkbox-uri livrare, urgent și subscription din service_file:', {
                  fisaId,
                  office_direct: serviceFileData.office_direct,
                  curier_trimis: serviceFileData.curier_trimis,
                  urgent: serviceFileData.urgent,
                  subscription_type: serviceFileData.subscription_type,
                })
              }
            }).catch(err => {
              console.error('Eroare la încărcarea service_file:', err)
            })
          )
        }
        
        // Încarcă checkbox-urile No Deal, Call Back, Nu Raspunde din leads (pentru Vanzari)
        if (isVanzariPipeline && lead?.id) {
          parallelTasks.push(
            supabase
              .from('leads')
              .select('no_deal, call_back, nu_raspunde')
              .eq('id', lead.id)
              .single()
              .then(({ data: leadData, error: leadError }) => {
                if (!leadError && leadData) {
                  // Verifică multiple formate posibile pentru fiecare checkbox
                  const noDealValue = leadData.no_deal
                  const callBackValue = leadData.call_back
                  const nuRaspundeValue = leadData.nu_raspunde
                  
                  setNoDeal(
                    noDealValue === true || 
                    noDealValue === 'true' || 
                    noDealValue === 1 || 
                    noDealValue === '1' ||
                    (typeof noDealValue === 'string' && noDealValue.toLowerCase() === 'true')
                  )
                  
                  setCallBack(
                    callBackValue === true || 
                    callBackValue === 'true' || 
                    callBackValue === 1 || 
                    callBackValue === '1' ||
                    (typeof callBackValue === 'string' && callBackValue.toLowerCase() === 'true')
                  )
                  
                  setNuRaspunde(
                    nuRaspundeValue === true || 
                    nuRaspundeValue === 'true' || 
                    nuRaspundeValue === 1 || 
                    nuRaspundeValue === '1' ||
                    (typeof nuRaspundeValue === 'string' && nuRaspundeValue.toLowerCase() === 'true')
                  )
                  
                  console.log('Încărcare checkbox-uri Vanzari din leads:', {
                    leadId: lead.id,
                    no_deal: noDealValue,
                    call_back: callBackValue,
                    nu_raspunde: nuRaspundeValue
                  })
                }
              })
              .catch(err => {
                console.error('Eroare la încărcarea checkbox-urilor din leads:', err)
              })
          )
        }
        
        // Încarcă stage-urile pentru pipeline-ul Vânzări (pentru mutarea cardului)
        if (isVanzariPipeline && isVanzator) {
          parallelTasks.push(
            (async () => {
              try {
                const { data: pipelinesData } = await getPipelinesWithStages()
                const vanzariPipeline = pipelinesData?.find((p: any) => 
                  p.name.toLowerCase().includes('vanzari') || p.name.toLowerCase().includes('sales')
                )
                if (vanzariPipeline) {
                  setVanzariPipelineId(vanzariPipeline.id)
                  setVanzariStages(vanzariPipeline.stages || [])
                }
              } catch (err) {
                console.error('Eroare la încărcarea stage-urilor pentru Vânzări:', err)
              }
            })()
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
        
        // Load cash/card, urgent and subscription values from service_file (pentru toate tăvițele din fișă)
        if (fisaId) {
          const { data: serviceFileData } = await getServiceFile(fisaId)
          if (serviceFileData) {
            setIsCash((serviceFileData as any).is_cash || false)
            setIsCard((serviceFileData as any).is_card || false)
            const loadedSubscriptionType = serviceFileData.subscription_type || ''
            const loadedUrgent = serviceFileData.urgent || false
            console.log('Încărcare subscription_type și urgent din service_file:', {
              fisaId,
              subscription_type: serviceFileData.subscription_type,
              urgent: serviceFileData.urgent,
              loadedSubscriptionType,
              loadedUrgent
            })
            setSubscriptionType(loadedSubscriptionType)
            setUrgentAllServices(loadedUrgent)
            
            // Aplică urgent la toate items-urile din toate tăvițele din fișă
            if (qs.length > 0) {
              const trayIds = qs.map(q => q.id)
              const { data: allTrayItems } = await supabase
                .from('tray_items')
                .select('id, notes')
                .in('tray_id', trayIds)
              
              if (allTrayItems && allTrayItems.length > 0) {
                for (const item of allTrayItems) {
                  let notesData: any = {}
                  if (item.notes) {
                    try {
                      notesData = JSON.parse(item.notes)
                    } catch (e) {
                      // Notes nu este JSON, ignoră
                    }
                  }
                  
                  // Actualizează urgent doar pentru servicii și piese
                  if (notesData.item_type === 'service' || notesData.item_type === 'part') {
                    notesData.urgent = loadedUrgent
                    await supabase
                      .from('tray_items')
                      .update({ notes: JSON.stringify(notesData) })
                      .eq('id', item.id)
                  }
                }
              }
            }
          }
        } else {
          // Fallback la quote dacă nu există fisaId (doar pentru leads vechi, fără service_file)
          const selectedQuoteForData = qs.find(q => q.id === firstId) || qs[0];
          const firstQuote = selectedQuoteForData as any
          if (firstQuote) {
            setIsCash(firstQuote.is_cash || false)
            setIsCard(firstQuote.is_card || false)
            const loadedSubscriptionType = firstQuote.subscription_type || ''
            const loadedUrgent = firstQuote.urgent || false
            setSubscriptionType(loadedSubscriptionType)
            setUrgentAllServices(loadedUrgent)
          }
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
              
              // Daca se modifica tăvița curentă, actualizeaza checkbox-urile (doar cash/card, nu urgent/subscription)
              if (trayId === selectedQuoteId && payloadNew) {
                setIsCash(payloadNew.is_cash || false)
                setIsCard(payloadNew.is_card || false)
                // Nu actualizăm urgent și subscription din tăviță - acestea sunt la nivel de service_file
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
              
              // IMPORTANT: Încarcă urgent și subscription_type din service_file, nu din tăviță
              if (fisaId && selectedQuoteId) {
                const { data: serviceFileData } = await getServiceFile(fisaId)
                if (serviceFileData) {
                  setSubscriptionType(serviceFileData.subscription_type || '')
                  setUrgentAllServices(serviceFileData.urgent || false)
                }
              } else if (selectedQuoteId) {
                // Fallback la quote doar dacă nu există fisaId
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
          setNewTraySize('m')
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
      brandSerialGroups: [...prev.brandSerialGroups, { brand: '', serialNumbers: [{ serial: '', garantie: false }], qty: '1' }]
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

  // Funcție pentru resetarea formularului de serviciu
  // IMPORTANT: Nu resetează brand-urile din instrumentForm, care sunt asociate cu instrumentul, nu cu serviciul
  async function handleResetServiceForm() {
    // Păstrează instrumentId și restaurează brand-urile originale din instrumentSettings sau din DB
    const currentInstrumentId = svc.instrumentId || instrumentForm.instrument
    
    // Restaurează brand-urile originale din instrumentSettings
    const savedSettings = currentInstrumentId ? instrumentSettings[currentInstrumentId] : null
    
    setSvc({
      instrumentId: currentInstrumentId, // Păstrează instrumentId pentru a nu afecta brand-urile
      id: '',
      qty: savedSettings?.qty || instrumentForm.qty || '1', // Folosește cantitatea originală
      discount: '0',
      urgent: false,
      technicianId: '',
      pipelineId: '',
      serialNumberId: '',
      selectedBrands: [],
    })
    
    // Restaurează brand-urile originale din instrumentSettings sau reîncarcă din DB
    if (currentInstrumentId) {
      if (savedSettings?.brandSerialGroups && savedSettings.brandSerialGroups.length > 0) {
        // Restaurează din instrumentSettings
        setInstrumentForm(prev => ({
          ...prev,
          instrument: currentInstrumentId,
          brandSerialGroups: savedSettings.brandSerialGroups,
          qty: savedSettings.qty || prev.qty || '1'
        }))
      } else {
        // Dacă nu există în instrumentSettings, reîncarcă din DB
        // Folosește populateInstrumentFormFromItems pentru a reîncărca brand-urile din DB
        populateInstrumentFormFromItems(items, currentInstrumentId, false)
      }
    }
    
    setServiceSearchQuery('')
    setServiceSearchFocused(false)
  }

  // Funcție pentru resetarea formularului de piesă
  function handleResetPartForm() {
    setPart({
      id: '',
      serialNumberId: '',
      qty: '1',
      discount: '0',
      overridePrice: ''
    })
    setPartSearchQuery('')
    setPartSearchFocused(false)
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

  // Eliminat funcțiile onAddSerialNumber și onRemoveSerialNumber - procesul este automatizat bazat pe cantitatea brand-ului

  // Actualizează un serial number dintr-un grup
  function onUpdateSerialNumber(groupIndex: number, serialIndex: number, value: string) {
    setInstrumentForm(prev => ({
      ...prev,
      brandSerialGroups: prev.brandSerialGroups.map((group, i) => {
        if (i === groupIndex) {
          // Actualizează serial number-ul și asigură că array-ul are dimensiunea corectă
          const brandQty = Number(group.qty || 1)
          const updatedSerialNumbers = Array.from({ length: Math.max(1, brandQty) }, (_, idx) => {
            if (idx === serialIndex) {
              return { serial: value, garantie: group.serialNumbers[idx]?.garantie || false }
            }
            return group.serialNumbers[idx] || { serial: '', garantie: false }
          })
          return { ...group, serialNumbers: updatedSerialNumbers }
        }
        return group
      })
    }))
    setIsDirty(true)
  }
  
  // Actualizează garanția pentru un serial number specific
  function onUpdateSerialGarantie(groupIndex: number, serialIndex: number, garantie: boolean) {
    setInstrumentForm(prev => ({
      ...prev,
      brandSerialGroups: prev.brandSerialGroups.map((group, i) => {
        if (i === groupIndex) {
          const updatedSerialNumbers = group.serialNumbers.map((sn, idx) => 
            idx === serialIndex ? { ...sn, garantie } : sn
          )
          return { ...group, serialNumbers: updatedSerialNumbers }
        }
        return group
      })
    }))
    setIsDirty(true)
  }
  
  // Calculează cantitatea totală bazat pe cantitățile per brand
  const totalQtyFromBrands = useMemo(() => {
    return instrumentForm.brandSerialGroups.reduce((sum, group) => {
      return sum + Number(group.qty || 1)
    }, 0)
  }, [instrumentForm.brandSerialGroups])
  
  // Actualizează cantitatea totală când se modifică cantitățile per brand
  useEffect(() => {
    if (totalQtyFromBrands > 0 && instrumentForm.brandSerialGroups.length > 0) {
      const currentTotalQty = Number(instrumentForm.qty || 1)
      if (currentTotalQty !== totalQtyFromBrands) {
        setInstrumentForm(prev => ({ ...prev, qty: String(totalQtyFromBrands) }))
      }
    }
  }, [totalQtyFromBrands, instrumentForm.brandSerialGroups.length])

  // Funcție helper pentru a popula formularul instrument cu datele salvate din items
  function populateInstrumentFormFromItems(items: LeadQuoteItem[], instrumentId: string | null, forceReload: boolean = false) {
    if (!instrumentId) return
    
    // IMPORTANT: Caută mai întâi item-ul direct cu item_type === null (instrumentul direct)
    // Apoi caută în servicii doar dacă nu găsește date la instrumentul direct
    const directInstrumentItem = items.find(item => 
      item.item_type === null && item.instrument_id === instrumentId
    )
    
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
    console.log('🔍 Direct instrument item:', directInstrumentItem ? 'found' : 'not found')
    
    // Prioritizează item-ul direct cu instrument (item_type === null)
    let itemWithInstrumentData: LeadQuoteItem | null = null
    
    if (directInstrumentItem) {
      const hasBrandGroups = (directInstrumentItem as any).brand_groups && (directInstrumentItem as any).brand_groups.length > 0
      const hasData = hasBrandGroups || directInstrumentItem.brand || directInstrumentItem.serial_number || directInstrumentItem.garantie
      if (hasData) {
        itemWithInstrumentData = directInstrumentItem
        console.log('✅ Found direct instrument item with data:', {
          id: directInstrumentItem.id,
          brand_groups: (directInstrumentItem as any).brand_groups?.length || 0,
          brand: directInstrumentItem.brand,
          serial_number: directInstrumentItem.serial_number
        })
      }
    }
    
    // IMPORTANT: Colectează TOATE brand-urile din TOATE serviciile asociate cu instrumentul
    // Nu doar din primul serviciu găsit, ci din toate serviciile
    let allBrandGroupsFromServices: Array<{ id: string; brand: string; serialNumbers: string[]; garantie: boolean }> = []
    
    if (!itemWithInstrumentData) {
      // Colectează brand-urile din toate serviciile, nu doar din primul
      instrumentItems.forEach(item => {
        const itemBrandGroups = (item as any).brand_groups || []
        if (itemBrandGroups.length > 0) {
          allBrandGroupsFromServices.push(...itemBrandGroups)
        } else if (item.brand || item.serial_number) {
          // Fallback: folosește câmpurile vechi dacă nu există brand_groups
          allBrandGroupsFromServices.push({
            id: item.id || '',
            brand: item.brand || '',
            serialNumbers: item.serial_number ? [item.serial_number] : [],
            garantie: item.garantie || false
          })
        }
      })
      
      // Dacă am găsit brand-uri în servicii, le folosim
      if (allBrandGroupsFromServices.length > 0) {
        itemWithInstrumentData = instrumentItems[0] // Folosim primul item pentru alte date
        console.log('✅ Found brand groups in services:', allBrandGroupsFromServices.length, 'brands')
      } else {
        // Caută primul serviciu cu date pentru compatibilitate
        itemWithInstrumentData = instrumentItems.find(item => {
          const hasBrandGroups = (item as any).brand_groups && (item as any).brand_groups.length > 0
          const hasData = hasBrandGroups || item.brand || item.serial_number || item.garantie
          if (hasData) {
            console.log('✅ Found service item with data:', {
              id: item.id,
              brand_groups: (item as any).brand_groups?.length || 0,
              brand: item.brand,
              serial_number: item.serial_number
            })
          }
          return hasData
        }) || null
      }
    }
    
    // Chiar dacă nu găsim date, verificăm dacă există un item
    const itemWithPotentialData = directInstrumentItem || (instrumentItems.length > 0 ? instrumentItems[0] : null)
    
    // IMPORTANT: Verifică dacă există brand-uri în formular sau în instrumentSettings
    // chiar dacă nu mai există servicii în items
    const savedSettings = instrumentSettings[instrumentId]
    const hasSavedBrands = savedSettings && savedSettings.brandSerialGroups && savedSettings.brandSerialGroups.length > 0
    
    // Dacă nu există date în items dar există brand-uri salvate, le folosim
    if (!itemWithInstrumentData && !itemWithPotentialData && hasSavedBrands) {
      console.log('📦 No items found, but keeping saved brand groups from instrumentSettings')
      setInstrumentForm(prev => {
        // Verifică dacă formularul are deja brand-uri pentru același instrument
        const hasValidBrandsInForm = prev.instrument === instrumentId && prev.brandSerialGroups.some(g => {
          const hasBrand = g.brand && g.brand.trim()
          const hasSerialNumbers = g.serialNumbers.some(sn => {
            const serial = typeof sn === 'string' ? sn : sn.serial || ''
            return serial && serial.trim()
          })
          return hasBrand || hasSerialNumbers
        })
        
        // Dacă există brand-uri în formular, le păstrăm
        if (hasValidBrandsInForm) {
          console.log('⏭️ Keeping existing brand groups in form')
          return prev
        }
        
        // Altfel, folosim brand-urile din instrumentSettings
        console.log('✅ Restoring brand groups from instrumentSettings')
        return {
          ...prev,
          instrument: instrumentId,
          brandSerialGroups: savedSettings.brandSerialGroups,
          qty: savedSettings.qty || prev.qty || '1'
        }
      })
      return
    }
    
    if (itemWithInstrumentData || itemWithPotentialData) {
      const targetItem = itemWithInstrumentData || itemWithPotentialData
      
      // Extrage brand-urile și serial numbers din noua structură brand_groups
      let brandSerialGroups: Array<{ brand: string; serialNumbers: Array<{ serial: string; garantie: boolean }>; qty: string }> = []
      
      // Prioritizează brand-urile colectate din toate serviciile
      const brandGroupsToProcess = allBrandGroupsFromServices.length > 0 
        ? allBrandGroupsFromServices 
        : ((targetItem as any).brand_groups || [])
      
      console.log('📦 Raw brand_groups from DB:', brandGroupsToProcess, 'from all services:', allBrandGroupsFromServices.length > 0)
      
      if (brandGroupsToProcess.length > 0) {
        console.log('📦 Processing brand_groups:', brandGroupsToProcess.length, 'brands')
        
        // Grupează brand-urile după numele brand-ului pentru a evita duplicatele
        const brandGroupsMap = new Map<string, { brand: string; serialNumbers: Array<{ serial: string; garantie: boolean }> }>()
        
        brandGroupsToProcess.forEach((bg: any) => {
          const brandName = bg.brand?.trim() || ''
          if (!brandName) return
          
          if (!brandGroupsMap.has(brandName)) {
            brandGroupsMap.set(brandName, {
              brand: brandName,
              serialNumbers: []
            })
          }
          
          const brandGroup = brandGroupsMap.get(brandName)!
          
          // Adaugă serial numbers-urile din acest brand
          const serialNumbers = bg.serialNumbers || []
          serialNumbers.forEach((sn: string) => {
            if (sn && sn.trim()) {
              // Verifică dacă serial number-ul nu există deja
              if (!brandGroup.serialNumbers.some(s => s.serial === sn.trim())) {
                brandGroup.serialNumbers.push({
                  serial: sn.trim(),
                  garantie: bg.garantie || false
                })
              }
            }
          })
        })
        
        // Transformă map-ul în array
        brandSerialGroups = Array.from(brandGroupsMap.values()).map(bg => ({
          brand: bg.brand,
          serialNumbers: bg.serialNumbers.length > 0 ? bg.serialNumbers : [{ serial: '', garantie: false }],
          qty: String(bg.serialNumbers.length || 1)
        }))
        
        console.log('✅ Brand groups loaded from all services:', brandSerialGroups)
      } else if (targetItem?.brand || targetItem?.serial_number) {
        console.log('⚠️ Using fallback brand/serial_number fields')
        // Fallback la câmpurile vechi pentru compatibilitate
        const serialNumbers = targetItem.serial_number 
          ? [{ serial: targetItem.serial_number, garantie: targetItem.garantie || false }] 
          : [{ serial: '', garantie: false }]
        brandSerialGroups = [{
          brand: targetItem.brand || '',
          serialNumbers: serialNumbers,
          qty: String(serialNumbers.length || 1)
        }]
      } else {
        // Dacă nu există date în DB, verifică dacă există brand-uri în formular sau în instrumentSettings
        if (hasSavedBrands) {
          console.log('📦 No data in DB, using saved brand groups from instrumentSettings')
          brandSerialGroups = savedSettings.brandSerialGroups
        } else {
          brandSerialGroups = [{ brand: '', serialNumbers: [{ serial: '', garantie: false }], qty: '1' }]
        }
      }
      
      const finalGroups = brandSerialGroups.length > 0 ? brandSerialGroups : [{ brand: '', serialNumbers: [{ serial: '', garantie: false }], qty: '1' }]
      console.log('✅ Final brand serial groups to populate:', finalGroups)
      
      // Populează formularul - dacă forceReload este true, suprascrie întotdeauna
      setInstrumentForm(prev => {
        // IMPORTANT: Dacă formularul are deja brand-uri valide pentru același instrument,
        // le păstrăm chiar dacă forceReload este true (pentru a preveni resetarea după adăugarea serviciului)
        const hasValidBrandsInForm = prev.instrument === instrumentId && prev.brandSerialGroups.some(g => {
          const hasBrand = g.brand && g.brand.trim()
          const hasSerialNumbers = g.serialNumbers.some(sn => {
            const serial = typeof sn === 'string' ? sn : sn.serial || ''
            return serial && serial.trim()
          })
          return hasBrand || hasSerialNumbers
        })
        
        // Dacă există brand-uri valide în formular SAU în instrumentSettings, păstrează-le
        if (hasValidBrandsInForm || hasSavedBrands) {
          // Dacă nu există date valide în DB sau datele din DB sunt goale, păstrează brand-urile existente
          const hasValidDataInDB = finalGroups.some(g => {
            const hasBrand = g.brand && g.brand.trim()
            const hasSerialNumbers = g.serialNumbers.some(sn => {
              const serial = typeof sn === 'string' ? sn : sn.serial || ''
              return serial && serial.trim()
            })
            return hasBrand || hasSerialNumbers
          })
          
          if (!hasValidDataInDB) {
            // Folosește brand-urile din formular sau din instrumentSettings
            const brandsToKeep = hasValidBrandsInForm ? prev.brandSerialGroups : (savedSettings?.brandSerialGroups || [])
            if (brandsToKeep.length > 0) {
              console.log('⏭️ Keeping existing brand groups in form - no valid data in DB')
              return {
                ...prev,
                instrument: instrumentId,
                brandSerialGroups: brandsToKeep,
                qty: savedSettings?.qty || prev.qty || '1'
              }
            }
          }
        }
        
        // Dacă forceReload este false și formularul are deja date pentru același instrument, nu le suprascriem
        if (!forceReload && prev.instrument === instrumentId && prev.brandSerialGroups.some(g => g.brand || g.serialNumbers.some(sn => {
          const serial = typeof sn === 'string' ? sn : sn.serial || ''
          return serial && serial.trim()
        }))) {
          console.log('⏭️ Skipping populate - form already has data for this instrument')
          return prev
        }
        
        console.log('✅ Populating form with brand serial groups:', finalGroups)
        
        return {
          ...prev,
          instrument: instrumentId,
          brandSerialGroups: finalGroups,
          qty: instrumentSettings[instrumentId]?.qty || prev.qty || '1'
        }
      })
      
      // Actualizează și instrumentSettings doar dacă există date valide
      if (brandSerialGroups.some(g => {
        const hasBrand = g.brand && g.brand.trim()
        const hasSerialNumbers = g.serialNumbers.some(sn => {
          const serial = typeof sn === 'string' ? sn : sn.serial || ''
          return serial && serial.trim()
        })
        return hasBrand || hasSerialNumbers
      })) {
        setInstrumentSettings(prev => ({
          ...prev,
          [instrumentId]: {
            qty: prev[instrumentId]?.qty || '1',
            brandSerialGroups: brandSerialGroups
          }
        }))
      }
    } else {
      // Dacă nu există items dar există brand-uri în formular sau în instrumentSettings, le păstrăm
      console.log('⚠️ No items found for instrument, checking form and settings for brand groups')
      setInstrumentForm(prev => {
        const hasValidBrandsInForm = prev.instrument === instrumentId && prev.brandSerialGroups.some(g => {
          const hasBrand = g.brand && g.brand.trim()
          const hasSerialNumbers = g.serialNumbers.some(sn => {
            const serial = typeof sn === 'string' ? sn : sn.serial || ''
            return serial && serial.trim()
          })
          return hasBrand || hasSerialNumbers
        })
        
        if (hasValidBrandsInForm) {
          console.log('⏭️ Keeping existing brand groups in form - no items found')
          return prev
        }
        
        if (hasSavedBrands) {
          console.log('✅ Restoring brand groups from instrumentSettings - no items found')
          return {
            ...prev,
            instrument: instrumentId,
            brandSerialGroups: savedSettings.brandSerialGroups,
            qty: savedSettings.qty || prev.qty || '1'
          }
        }
        
        // Dacă nu există brand-uri nici în formular nici în settings, nu facem nimic
        return prev
      })
    }
  }

  // ----- Add rows -----
  async function onAddService() {
    if (!selectedQuote || !svc.id) return
    
    setIsDirty(true)
    
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

    // Verifică dacă instrumentul are același departament ca cele existente în tăviță (doar pentru tăvițe definite)
    const isUndefinedTray = selectedQuote && (!selectedQuote.number || selectedQuote.number === '')
    const allowAllInstruments = isVanzariPipeline && isUndefinedTray
    
    if (!allowAllInstruments && selectedQuote && selectedQuote.number && selectedQuote.number.trim() !== '') {
      // Tăviță definită - verifică departamentele
      const existingDepartments = new Set<string | null>()
      items.forEach(item => {
        if (item.instrument_id && item.instrument_id !== currentInstrumentId) {
          let itemInstrumentId: string | null = null
          if (item.item_type === 'service' && item.service_id) {
            const serviceDef = services.find(s => s.id === item.service_id)
            itemInstrumentId = serviceDef?.instrument_id || null
          } else if (item.instrument_id) {
            itemInstrumentId = item.instrument_id
          }
          
          if (itemInstrumentId) {
            const existingInstrument = instruments.find(i => i.id === itemInstrumentId)
            if (existingInstrument && existingInstrument.department_id) {
              existingDepartments.add(existingInstrument.department_id)
            }
          }
        }
      })
      
      if (existingDepartments.size > 0 && currentInstrumentForService.department_id) {
        const allowedDepartment = Array.from(existingDepartments)[0]
        if (currentInstrumentForService.department_id !== allowedDepartment) {
          const departmentName = departments.find(d => d.id === allowedDepartment)?.name || 'acest departament'
          const newDepartmentName = departments.find(d => d.id === currentInstrumentForService.department_id)?.name || 'alt departament'
          toast.error(`Nu poți adăuga instrumente cu departamente diferite în aceeași tăviță. Tăvița conține deja instrumente din ${departmentName}, iar instrumentul selectat este din ${newDepartmentName}.`)
          return
        }
      }
    }

    // Verifică dacă instrumentul este din departamentul "Ascutit" - nu permite brand/serial
    const instrumentDeptForService = departments.find(d => d.id === currentInstrumentForService.department_id)
    const deptNameForService = instrumentDeptForService?.name?.toLowerCase() || ''
    const isAscutitInstrument = deptNameForService.includes('ascutit') || deptNameForService.includes('ascuțit')
    
    // IMPORTANT: Salvează automat toate brand-urile și serial number-urile înainte de a adăuga serviciul
    // Verifică dacă există brand-uri și serial number-uri de salvat
    // EXCEPTIE: Nu salvează brand/serial pentru instrumente din departamentul "Ascutit"
    const groupsToSave = instrumentForm.brandSerialGroups.length > 0 
      ? instrumentForm.brandSerialGroups 
      : [{ brand: '', serialNumbers: [{ serial: '', garantie: false }], qty: '1' }]
    
    const hasValidBrandSerialData = !isAscutitInstrument && groupsToSave.some(g => {
      const hasBrand = g.brand && g.brand.trim()
      const hasSerialNumbers = g.serialNumbers.some(sn => {
        const serial = typeof sn === 'string' ? sn : sn.serial || ''
        return serial && serial.trim()
      })
      return hasBrand || hasSerialNumbers
    })

    // Dacă există date de brand/serial, salvează-le automat înainte de a adăuga serviciul
    // NU salva dacă instrumentul este din departamentul "Ascutit"
    if (hasValidBrandSerialData && selectedQuote && !isAscutitInstrument) {
      try {
        // Găsește item-ul existent pentru instrument sau creează unul nou
        const existingItem = items.find((i: any) => i.instrument_id === currentInstrumentId && i.item_type === null)
        
        const qty = Number(instrumentForm.qty || 1)
        
        // Transformă structura pentru salvare: grupăm serial numbers-urile după garanție
        // Dacă avem serial numbers cu garanții diferite, creăm brand-uri separate
        const brandSerialGroupsToSend: Array<{ brand: string | null; serialNumbers: string[]; garantie: boolean }> = []
        
        for (const group of groupsToSave) {
          const brandName = group.brand?.trim()
          if (!brandName) continue
          
          // Grupează serial numbers-urile după garanție
          const serialsByGarantie = new Map<boolean, string[]>()
          
          group.serialNumbers.forEach((snData) => {
            const serial = typeof snData === 'string' ? snData : snData.serial || ''
            const snGarantie = typeof snData === 'object' ? (snData.garantie || false) : false
            
            if (serial && serial.trim()) {
              if (!serialsByGarantie.has(snGarantie)) {
                serialsByGarantie.set(snGarantie, [])
              }
              serialsByGarantie.get(snGarantie)!.push(serial.trim())
            }
          })
          
          // Creează un grup pentru fiecare nivel de garanție
          serialsByGarantie.forEach((serials, snGarantie) => {
            if (serials.length > 0) {
              brandSerialGroupsToSend.push({
                brand: brandName,
                serialNumbers: serials,
                garantie: snGarantie
              })
            }
          })
        }
        
        const filteredGroups = brandSerialGroupsToSend.filter(g => g.brand || g.serialNumbers.length > 0)

        if (filteredGroups.length > 0) {
          if (existingItem && existingItem.id) {
            // Actualizează item-ul existent cu brand-urile și serial number-urile
            // Șterge brand-urile vechi
            const { error: deleteError } = await supabase
              .from('tray_item_brands')
              .delete()
              .eq('tray_item_id', existingItem.id)
            
            if (deleteError && deleteError.code !== '42P01') {
              console.error('Error deleting old brands:', deleteError)
            }
            
            // Adaugă noile brand-uri și serial numbers
            for (const group of filteredGroups) {
              const brandName = group.brand?.trim()
              if (!brandName) continue
              
              const serialNumbers = group.serialNumbers
                .map(sn => {
                  const serial = typeof sn === 'string' ? sn : sn.serial || ''
                  return serial.trim()
                })
                .filter(sn => sn)
              
              // Creează brand-ul
              const { data: brandResult, error: brandError } = await supabase
                .from('tray_item_brands')
                .insert([{
                  tray_item_id: existingItem.id,
                  brand: brandName,
                  garantie: group.garantie || false
                }])
                .select()
                .single()
              
              if (brandError) {
                console.error('Error creating brand:', brandError)
                continue
              }
              
              // Creează serial numbers pentru acest brand
              if (serialNumbers.length > 0 && brandResult) {
                const serialsToInsert = serialNumbers.map(sn => ({
                  brand_id: brandResult.id,
                  serial_number: sn.trim(),
                }))
                
                const { error: serialsError } = await supabase
                  .from('tray_item_brand_serials')
                  .insert(serialsToInsert)
                
                if (serialsError) {
                  console.error('Error creating serials:', serialsError)
                }
              }
            }
          } else {
            // Creează un item nou pentru instrument cu brand-urile și serial number-urile
            const instrument = instruments.find(i => i.id === currentInstrumentId)
            if (instrument) {
              let autoPipelineId: string | null = null
              const instrumentDept = departments.find(d => d.id === instrument.department_id)
              const deptName = instrumentDept?.name?.toLowerCase() || instrument.department_id?.toLowerCase()
              if (deptName === 'reparatii') {
                const reparatiiPipeline = pipelinesWithIds.find(p => p.name.toLowerCase() === 'reparatii')
                if (reparatiiPipeline) autoPipelineId = reparatiiPipeline.id
              }
              
              await addInstrumentItem(selectedQuote.id, instrument.name, {
                instrument_id: instrument.id,
                department_id: instrument.department_id,
                qty: qty,
                discount_pct: 0,
                urgent: false,
                technician_id: null,
                pipeline_id: autoPipelineId,
                brandSerialGroups: brandSerialGroupsToSend
              })
              
              // Reîncarcă items-urile
              const newItems = await listQuoteItems(selectedQuote.id, services, instruments, pipelinesWithIds)
              setItems(newItems)
            }
          }
        }
      } catch (error) {
        console.error('Error saving brand/serial data before adding service:', error)
        toast.error('Eroare la salvare date brand/serial. Te rog încearcă din nou.')
        return
      }
    }
  
    // IMPORTANT: Folosește întotdeauna cantitatea din instrumentForm.qty dacă există, altfel din svc.qty
    // Astfel, când se adaugă mai multe servicii, toate vor folosi aceeași cantitate din formularul instrumentului
    const qty = Math.max(1, Number(instrumentForm.qty || svc.qty || 1))
    const discount = Math.min(100, Math.max(0, Number(svc.discount || 0)))
    
    // Pentru Vanzari: procesează fiecare brand selectat separat
    // Pentru alte pipeline-uri: folosește logica existentă cu serial number
    const garantie = instrumentForm.garantie || false
    
    // Verifică dacă există deja un item cu instrument (item_type: null)
    const existingInstrumentItem = items.find(it => it.item_type === null)
    
    // Obține pipeline_id din svc.pipelineId sau setare automată bazată pe department_id
    let pipelineId = svc.pipelineId || null
    
    // Setează pipeline_id automat dacă instrumentul are department_id = "reparatii"
    if (currentInstrumentForService?.department_id && !pipelineId) {
      const instrumentDept = departments.find(d => d.id === currentInstrumentForService.department_id)
      const deptName = instrumentDept?.name?.toLowerCase() || currentInstrumentForService.department_id?.toLowerCase()
      
      if (deptName === 'reparatii') {
        const reparatiiPipeline = pipelinesWithIds.find(p => p.name.toLowerCase() === 'reparatii')
        if (reparatiiPipeline) {
          pipelineId = reparatiiPipeline.id
        }
      }
    }
    
    if (isVanzariPipeline && svc.selectedBrands && svc.selectedBrands.length > 0) {
      // În Vanzari, creăm un SINGUR serviciu cu TOATE brand-urile selectate
      const brandsToProcess = svc.selectedBrands
      
      // Calculează cantitatea totală bazat pe cantitățile brand-urilor selectate
      let totalQtyFromBrands = 0
      const brandSerialGroupsToSave: Array<{ brand: string | null; serialNumbers: string[]; garantie: boolean }> = []
      
      // Colectează toate brand-urile și serial numbers-urile asociate
      for (const selectedBrand of brandsToProcess) {
        const brandGroup = instrumentForm.brandSerialGroups.find(
          g => g.brand && g.brand.trim() === selectedBrand
        )
        
        if (!brandGroup) continue
        
        // Calculează cantitatea pentru acest brand
        const brandQty = Number(brandGroup.qty || 1)
        totalQtyFromBrands += brandQty
        
        // Colectează toate serial numbers-urile pentru acest brand
        const serialNumbers: string[] = []
        brandGroup.serialNumbers.forEach(snData => {
          const serial = typeof snData === 'string' ? snData : snData.serial || ''
          if (serial && serial.trim()) {
            serialNumbers.push(serial.trim())
          }
        })
        
        // Dacă nu există serial numbers, adaugă unul gol pentru a indica brand-ul
        if (serialNumbers.length === 0) {
          serialNumbers.push('')
        }
        
        // Adaugă brand-ul și serial numbers-urile la lista de salvare
        brandSerialGroupsToSave.push({
          brand: selectedBrand.trim(),
          serialNumbers: serialNumbers,
          garantie: garantie || false
        })
      }
      
      // Folosește cantitatea totală calculată
      const finalQty = totalQtyFromBrands > 0 ? totalQtyFromBrands : qty
      
      console.log('onAddService (Vanzari) - brands:', brandsToProcess, 'brandSerialGroupsToSave:', brandSerialGroupsToSave, 'totalQty:', totalQtyFromBrands, 'finalQty:', finalQty);
      
      // IMPORTANT: Creează un SINGUR serviciu cu TOATE brand-urile asociate
      try {
        // Pregătește notes JSON cu toate detaliile serviciului
        // Pentru compatibilitate, folosește primul brand ca brand principal
        const firstBrand = brandSerialGroupsToSave[0]
        const notesData = {
          item_type: 'service',
          name: svcDef.name,
          price: Number(svcDef.price),
          discount_pct: discount,
          urgent: urgentAllServices,
          brand: firstBrand?.brand || null,
          serial_number: firstBrand?.serialNumbers?.[0] || null,
          garantie: garantie || false,
        }
        
        // Creează serviciul în DB cu toate brand-urile
        const { data: createdItem, error: createError } = await createTrayItem({
          tray_id: selectedQuote.id,
          service_id: svcDef.id,
          instrument_id: currentInstrumentForService.id,
          department_id: currentInstrumentForService.department_id,
          technician_id: svc.technicianId || null,
          qty: finalQty,
          notes: JSON.stringify(notesData),
          pipeline: pipelineId ? pipelinesWithIds.find(p => p.id === pipelineId)?.name || null : null,
          brandSerialGroups: brandSerialGroupsToSave.length > 0 ? brandSerialGroupsToSave : undefined
        })
        
        if (createError) {
          console.error('Error creating service item:', createError)
          toast.error(`Eroare la salvare serviciu: ${createError.message}`)
          return
        }
        
        if (!createdItem) {
          console.error('No item created')
          toast.error('Eroare la crearea serviciului')
          return
        }
        
        // Transformă item-ul creat în LeadQuoteItem pentru afișare
        // Pentru afișare, folosim primul brand ca brand principal, dar toate brand-urile vor fi în brand_groups
        // Transformă brandSerialGroupsToSave în formatul pentru brand_groups
        const brandGroupsForDisplay = brandSerialGroupsToSave.map(bg => ({
          id: '', // Nu avem ID-ul încă, dar nu este necesar pentru afișare
          brand: bg.brand || '',
          serialNumbers: bg.serialNumbers || [],
          garantie: bg.garantie || false
        }))
        
        const serviceItem: LeadQuoteItem & { brand_groups?: Array<{ id: string; brand: string; serialNumbers: string[]; garantie: boolean }> } = {
          id: createdItem.id,
          item_type: 'service',
          service_id: svcDef.id,
          instrument_id: currentInstrumentForService.id,
          department_id: currentInstrumentForService.department_id,
          name_snapshot: svcDef.name,
          price: Number(svcDef.price),
          qty: finalQty,
          discount_pct: discount,
          urgent: urgentAllServices,
          technician_id: svc.technicianId || null,
          pipeline_id: pipelineId,
          brand: firstBrand?.brand || null,
          serial_number: firstBrand?.serialNumbers?.[0] || null,
          garantie: garantie,
          brand_groups: brandGroupsForDisplay,
        } as unknown as LeadQuoteItem & { brand_groups?: Array<{ id: string; brand: string; serialNumbers: string[]; garantie: boolean }> }
        
        // Adaugă serviciul creat în state
        setItems(prev => [...prev, serviceItem])
      } catch (error: any) {
        console.error('Error creating service item:', error)
        toast.error(`Eroare la salvare serviciu: ${error.message || error}`)
        return
      }
      
      // Actualizează cantitatea în formular cu cantitatea totală calculată
      if (totalQtyFromBrands > 0) {
        setInstrumentForm(prev => ({
          ...prev,
          qty: String(totalQtyFromBrands)
        }))
        setSvc(prev => ({
          ...prev,
          qty: String(totalQtyFromBrands)
        }))
      }
      
      // IMPORTANT: Păstrează brand-urile în formular și în instrumentSettings
      // pentru a preveni resetarea lor după reîncărcarea items-urilor
      const currentBrandGroups = [...instrumentForm.brandSerialGroups] // Creează o copie pentru a preveni mutații
      const currentQtyValue = String(totalQtyFromBrands > 0 ? totalQtyFromBrands : (instrumentForm.qty || '1'))
      
      // Salvează în instrumentSettings imediat
      setInstrumentSettings(prev => ({
        ...prev,
        [currentInstrumentId]: {
          qty: currentQtyValue,
          brandSerialGroups: currentBrandGroups
        }
      }))
      
      // De asemenea, actualizează formularul imediat pentru a preveni resetarea
      setInstrumentForm(prev => ({
        ...prev,
        instrument: currentInstrumentId,
        brandSerialGroups: currentBrandGroups,
        qty: currentQtyValue
      }))
      
      // Resetează doar câmpurile serviciului, dar PĂSTREAZĂ brand-urile în instrumentForm
      setSvc(prev => ({ 
        ...prev, 
        id: '', 
        qty: String(totalQtyFromBrands > 0 ? totalQtyFromBrands : (instrumentForm.qty || '1')),
        discount: '0', 
        urgent: false, 
        technicianId: '',
        pipelineId: '',
        serialNumberId: '',
        selectedBrands: [] as string[], // Resetează brand-urile selectate pentru serviciu
      }))
      setServiceSearchQuery('')
      setIsDirty(true)
      
      // IMPORTANT: Reîncarcă items-urile pentru a actualiza lista, dar păstrează brand-urile în formular
      // Folosim setTimeout pentru a preveni resetarea brand-urilor de către useEffect care se execută când items se schimbă
      setTimeout(async () => {
        try {
          const newItems = await listQuoteItems(selectedQuote.id, services, instruments, pipelinesWithIds)
          setItems(newItems)
          
          // IMPORTANT: Restaurează brand-urile imediat după reîncărcare pentru a preveni resetarea de către useEffect
          setTimeout(() => {
            // Verifică dacă brand-urile au fost resetate și le restaurează
            setInstrumentForm(prev => {
              // Dacă formularul încă are brand-urile valide, le păstrăm
              if (prev.instrument === currentInstrumentId && prev.brandSerialGroups.length > 0) {
                const hasValidBrands = prev.brandSerialGroups.some(g => {
                  const hasBrand = g.brand && g.brand.trim()
                  const hasSerialNumbers = g.serialNumbers.some(sn => {
                    const serial = typeof sn === 'string' ? sn : sn.serial || ''
                    return serial && serial.trim()
                  })
                  return hasBrand || hasSerialNumbers
                })
                
                if (hasValidBrands) {
                  console.log('✅ Keeping existing brand groups in form')
                  return prev
                }
              }
              
              // Restaurează din instrumentSettings (care a fost salvat înainte)
              const savedSettings = instrumentSettings[currentInstrumentId]
              if (savedSettings && savedSettings.brandSerialGroups && savedSettings.brandSerialGroups.length > 0) {
                console.log('🔄 Restoring brand groups from instrumentSettings after reload')
                return {
                  ...prev,
                  instrument: currentInstrumentId,
                  brandSerialGroups: savedSettings.brandSerialGroups,
                  qty: savedSettings.qty || prev.qty || '1'
                }
              }
              
              // Dacă nu există în instrumentSettings, folosește brand-urile salvate anterior
              if (currentBrandGroups && currentBrandGroups.length > 0) {
                console.log('🔄 Restoring brand groups from local variable')
                return {
                  ...prev,
                  instrument: currentInstrumentId,
                  brandSerialGroups: currentBrandGroups,
                  qty: currentQtyValue || prev.qty || '1'
                }
              }
              
              return prev
            })
          }, 200) // Mărim delay-ul pentru a permite useEffect-ului să se execute mai întâi
        } catch (error) {
          console.error('Error reloading items:', error)
        }
      }, 100)
      
      return // Iesim din functie pentru Vanzari
    }
    
    // Logica existentă pentru alte pipeline-uri (non-Vanzari)
    // Obține datele instrumentului - folosește serial number-ul selectat sau primul din listă
    // EXCEPTIE: Nu atribui brand/serial pentru instrumente din departamentul "Ascutit"
    let brand: string | null = null
    let serialNumber: string | null = null
    
    if (!isAscutitInstrument) {
      // Verifică dacă a fost selectat un serial number specific
      if (svc.serialNumberId) {
        // Format: "brand::serialNumber"
        const parts = svc.serialNumberId.split('::')
        brand = parts[0] || null
        serialNumber = parts[1] || null
      } else {
        // Folosește primul serial number disponibil din primul grup
        const firstGroup = instrumentForm.brandSerialGroups[0] || { brand: '', serialNumbers: [{ serial: '', garantie: false }] }
        brand = (firstGroup.brand && firstGroup.brand.trim()) 
          ? firstGroup.brand.trim() 
          : null
        // Folosește primul serial number valid din primul grup
        const firstValidSerial = firstGroup.serialNumbers.find(sn => {
          const serial = typeof sn === 'string' ? sn : sn.serial || ''
          return serial && serial.trim()
        })
        serialNumber = firstValidSerial ? (typeof firstValidSerial === 'string' ? firstValidSerial : firstValidSerial.serial || '').trim() : null
      }
    }
  
    console.log('onAddService - qty:', qty, 'serialNumberId:', svc.serialNumberId, 'brand:', brand, 'serialNumber:', serialNumber, 'garantie:', garantie);
    
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
    // IMPORTANT: Nu resetăm qty la '1' - păstrăm valoarea din instrumentForm.qty pentru următoarele servicii
    setSvc(prev => ({ 
      ...prev, 
      id: '', 
      qty: instrumentForm.qty || '1', // Păstrează cantitatea din formularul instrumentului
      discount: '0', 
      urgent: false, 
      technicianId: '',
      pipelineId: '', // Resetează pipeline_id după adăugare
      serialNumberId: '', // Resetează serial number-ul selectat
      selectedBrands: [], // Resetează brand-urile selectate (pentru Vanzari)
    }))
    setServiceSearchQuery('') // Resetează căutarea serviciului
    setIsDirty(true)
  }

  function onAddPart(e?: React.FormEvent) {
    if (e) e.preventDefault()
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
  
    // Verifică dacă instrumentul are același departament ca cele existente în tăviță (doar pentru tăvițe definite)
    const isUndefinedTray = selectedQuote && (!selectedQuote.number || selectedQuote.number === '')
    const allowAllInstruments = isVanzariPipeline && isUndefinedTray
    
    if (!allowAllInstruments && selectedQuote && selectedQuote.number && selectedQuote.number.trim() !== '') {
      // Tăviță definită - verifică departamentele
      const existingDepartments = new Set<string | null>()
      items.forEach(item => {
        if (item.instrument_id && item.instrument_id !== currentInstrumentId) {
          let itemInstrumentId: string | null = null
          if (item.item_type === 'service' && item.service_id) {
            const serviceDef = services.find(s => s.id === item.service_id)
            itemInstrumentId = serviceDef?.instrument_id || null
          } else if (item.instrument_id) {
            itemInstrumentId = item.instrument_id
          }
          
          if (itemInstrumentId) {
            const existingInstrument = instruments.find(i => i.id === itemInstrumentId)
            if (existingInstrument && existingInstrument.department_id) {
              existingDepartments.add(existingInstrument.department_id)
            }
          }
        }
      })
      
      if (existingDepartments.size > 0 && currentInstrumentForPart.department_id) {
        const allowedDepartment = Array.from(existingDepartments)[0]
        if (currentInstrumentForPart.department_id !== allowedDepartment) {
          const departmentName = departments.find(d => d.id === allowedDepartment)?.name || 'acest departament'
          const newDepartmentName = departments.find(d => d.id === currentInstrumentForPart.department_id)?.name || 'alt departament'
          toast.error(`Nu poți adăuga instrumente cu departamente diferite în aceeași tăviță. Tăvița conține deja instrumente din ${departmentName}, iar instrumentul selectat este din ${newDepartmentName}.`)
          return
        }
      }
    }
  
    // Verifică dacă instrumentul este din departamentul "Ascutit" - nu permite brand/serial
    const instrumentDeptForPart = departments.find(d => d.id === currentInstrumentForPart.department_id)
    const deptNameForPart = instrumentDeptForPart?.name?.toLowerCase() || ''
    const isAscutitInstrumentForPart = deptNameForPart.includes('ascutit') || deptNameForPart.includes('ascuțit')
    
    // Numără instrumentele unice din tavă
    const uniqueInstruments = new Set<string>()
    items.forEach(item => {
      if (item.item_type === null && item.instrument_id) {
        uniqueInstruments.add(item.instrument_id)
      } else if (item.item_type === 'service' && item.instrument_id) {
        uniqueInstruments.add(item.instrument_id)
      } else if (item.item_type === 'part' && item.instrument_id) {
        uniqueInstruments.add(item.instrument_id)
      }
    })
    
    // Dacă sunt 2+ instrumente, verifică dacă brand-ul și serial number-ul sunt selectate
    // EXCEPTIE: Nu cere brand/serial pentru instrumente din departamentul "Ascutit"
    const hasMultipleInstruments = uniqueInstruments.size > 1
    let partBrand: string | null = null
    let partSerialNumber: string | null = null
    
    if (!isAscutitInstrumentForPart) {
      if (hasMultipleInstruments) {
        // Câmpuri obligatorii pentru 2+ instrumente
        if (!part.serialNumberId || !part.serialNumberId.includes('::')) {
          toast.error('Te rog selectează brand-ul și serial number-ul instrumentului pentru această piesă')
          return
        }
        const [b, sn] = part.serialNumberId.split('::')
        partBrand = b || null
        partSerialNumber = sn || null
      } else {
        // Un singur instrument - atribuie automat brand-ul și serial number-ul
        if (instrumentForm.brandSerialGroups.length > 0) {
          const firstGroup = instrumentForm.brandSerialGroups[0]
          if (firstGroup.brand && firstGroup.serialNumbers.length > 0 && firstGroup.serialNumbers[0]) {
            partBrand = firstGroup.brand
            // Extrage serial number - poate fi string sau obiect {serial, garantie}
            const firstSerial = firstGroup.serialNumbers[0]
            partSerialNumber = typeof firstSerial === 'string' ? firstSerial : (firstSerial.serial || '')
          }
        }
      }
    }
  
    const unit = part.overridePrice !== '' ? Number(part.overridePrice) : Number(partDef.price)
    if (isNaN(unit) || unit < 0) return
  
    const qty = Math.max(1, Number(part.qty || 1))
    const discount = Math.min(100, Math.max(0, Number(part.discount || 0)))
  
    // ⬇️ push a local row (no DB write)
    // Setează automat pipeline_id la "Reparatii" pentru piese
    const reparatiiPipeline = pipelinesWithIds.find(p => p.name === 'Reparatii')
    const pipelineIdForPart = reparatiiPipeline?.id || null
    
    // Atribuie automat tehnicianul pentru piese (doar dacă NU suntem într-un pipeline departament)
    // Pentru pipeline-urile departament (Saloane, Frizerii, Horeca, Reparatii), NU se face atribuire automată
    const technicianIdForPart = isDepartmentPipeline ? null : (user?.id || null)
    console.log('🔧 [onAddPart] Technician assignment:', {
      isDepartmentPipeline,
      userId: user?.id,
      technicianIdForPart,
      pipelineSlug
    })
    
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
        technician_id: technicianIdForPart, // Atribuie automat tehnicianul dacă nu suntem în pipeline departament
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

  async function onDelete(id: string) {
    const itemToDelete = items.find(it => it.id === id)
    if (!itemToDelete) return
    
    // IMPORTANT: Salvează brand-urile în instrumentSettings înainte de a șterge serviciul
    // pentru a le putea restaura dacă nu mai există servicii în items
    const currentInstrumentId = instrumentForm.instrument || svc.instrumentId
    if (currentInstrumentId && itemToDelete.item_type === 'service') {
      const hasBrandsInForm = instrumentForm.brandSerialGroups.some(g => {
        const hasBrand = g.brand && g.brand.trim()
        const hasSerialNumbers = g.serialNumbers.some(sn => {
          const serial = typeof sn === 'string' ? sn : sn.serial || ''
          return serial && serial.trim()
        })
        return hasBrand || hasSerialNumbers
      })
      
      if (hasBrandsInForm) {
        // Salvează brand-urile în instrumentSettings înainte de ștergere
        setInstrumentSettings(prev => ({
          ...prev,
          [currentInstrumentId]: {
            qty: instrumentForm.qty || '1',
            brandSerialGroups: instrumentForm.brandSerialGroups
          }
        }))
        console.log('💾 Saved brand groups to instrumentSettings before service deletion')
      }
    }
    
    // Șterge din DB doar dacă item-ul are un ID real (nu este un ID temporar)
    // ID-urile temporare încep cu "temp-", "local-" sau "local_"
    const isLocalId = id.startsWith('temp-') || id.includes('local-') || id.startsWith('local_')
    
    if (!isLocalId) {
      // Șterge efectiv din DB
      try {
        const { success, error } = await deleteTrayItem(id)
        if (!success || error) {
          console.error('Error deleting tray item from DB:', error)
          toast.error('Eroare la ștergerea serviciului din baza de date')
          return
        }
        console.log('✅ Deleted item from DB:', id)
      } catch (error: any) {
        console.error('Error deleting tray item:', error)
        toast.error('Eroare la ștergerea serviciului')
        return
      }
    }
    
    // Șterge din state-ul local
    setItems(prev => {
      const newItems = prev.filter(it => it.id !== id)
      
      // Dacă s-a șters un item cu instrument (item_type: null), resetează instrumentul și brand-urile
      if (itemToDelete.item_type === null) {
        setSvc(p => ({ ...p, instrumentId: '' }))
        setInstrumentForm(prev => ({ 
          ...prev, 
          instrument: '',
          brandSerialGroups: [{ brand: '', serialNumbers: [{ serial: '', garantie: false }], qty: '1' }]
        }))
      } else if (itemToDelete.item_type === 'service') {
        // Dacă s-a șters un serviciu, verifică dacă mai există un item cu instrument (item_type: null)
        // care are brand-uri asociate, sau dacă mai există alte servicii cu același instrument
        const remainingServices = newItems.filter(it => it.item_type === 'service')
        const remainingInstruments = newItems.filter(it => it.item_type === null)
        
        // Dacă nu mai există servicii și nu mai există items cu instrument, resetează instrumentul
        if (remainingServices.length === 0 && remainingInstruments.length === 0) {
          setSvc(p => ({ ...p, instrumentId: '' }))
          setInstrumentForm(prev => ({ 
            ...prev, 
            instrument: '',
            brandSerialGroups: [{ brand: '', serialNumbers: [{ serial: '', garantie: false }], qty: '1' }]
          }))
        }
        // Dacă mai există servicii sau items cu instrument, brand-urile vor fi păstrate
        // prin instrumentSettings care a fost salvat mai sus
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
      // incarca valorile cash/card pentru noua tavita
      const newQuote = quotes.find(q => q.id === newId) as any
      if (newQuote) {
        setIsCash(newQuote.is_cash || false)
        setIsCard(newQuote.is_card || false)
        
        // IMPORTANT: Încarcă urgent și subscription_type din service_file, nu din tăviță
        if (fisaId) {
          const { data: serviceFileData } = await getServiceFile(fisaId)
          if (serviceFileData) {
            const loadedSubscriptionType = serviceFileData.subscription_type || ''
            const loadedUrgent = serviceFileData.urgent || false
            console.log('Schimbare tăviță - încărcare subscription_type și urgent din service_file:', {
              fisaId,
              quoteId: newQuote.id,
              subscription_type: serviceFileData.subscription_type,
              urgent: serviceFileData.urgent,
              loadedSubscriptionType,
              loadedUrgent
            })
            setSubscriptionType(loadedSubscriptionType)
            setUrgentAllServices(loadedUrgent)
          }
        } else {
          // Fallback la quote doar dacă nu există fisaId
          const loadedSubscriptionType = newQuote.subscription_type || ''
          const loadedUrgent = newQuote.urgent || false
          setSubscriptionType(loadedSubscriptionType)
          setUrgentAllServices(loadedUrgent)
        }
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
      
      // IMPORTANT: urgentAllServices este gestionat la nivel de service_file, nu de tăviță
      // Nu mai actualizăm urgentAllServices bazat pe tăviță sau items - se încarcă din service_file
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

    // Verifică dacă există deja o tăviță cu acest număr care conține instrumente dintr-o altă fișă
    try {
      const { data: existingTrays, error: checkError } = await supabase
        .from('trays')
        .select(`
          id,
          number,
          service_file_id,
          service_file:service_files!inner(id, number, lead_id)
        `)
        .eq('number', newTrayNumber.trim())
        .neq('service_file_id', fisaId || '') // Exclude tăvițele din fișa curentă
      
      if (checkError) {
        console.error('Error checking existing trays:', checkError)
      } else if (existingTrays && existingTrays.length > 0) {
        // Verifică dacă aceste tăvițe au instrumente
        const trayIds = existingTrays.map(t => t.id)
        const { data: trayItems, error: itemsError } = await supabase
          .from('tray_items')
          .select('tray_id, instrument_id')
          .in('tray_id', trayIds)
          .not('instrument_id', 'is', null)
          .limit(1)
        
        if (itemsError) {
          console.error('Error checking tray items:', itemsError)
        } else if (trayItems && trayItems.length > 0) {
          // Tăvița este ocupată de instrumente dintr-o altă fișă
          const occupiedTray = existingTrays.find(t => t.id === trayItems[0].tray_id)
          const serviceFileNumber = (occupiedTray as any)?.service_file?.number || 'necunoscută'
          toast.error(`Tăvița "${newTrayNumber.trim()}" este deja ocupată de instrumente din fișa "${serviceFileNumber}". Te rog alege alt număr.`)
          return
        }
      }
    } catch (err: any) {
      console.error('Error validating tray number:', err)
      // Continuă cu crearea dacă validarea eșuează (nu blocăm utilizatorul)
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
    setEditingTraySize(selectedQuote.size || 'm')
    setShowEditTrayDialog(true)
  }
  
  // Funcție pentru salvarea editărilor tăviței
  async function handleUpdateTray() {
    if (!selectedQuote || !editingTrayNumber.trim()) {
      toast.error('Introduceți numărul tăviței')
      return
    }

    // Verifică dacă numărul nou este diferit de cel curent
    if (editingTrayNumber.trim() !== (selectedQuote.number || '')) {
      // Verifică dacă există deja o tăviță cu acest număr care conține instrumente dintr-o altă fișă
      try {
        const { data: existingTrays, error: checkError } = await supabase
          .from('trays')
          .select(`
            id,
            number,
            service_file_id,
            service_file:service_files!inner(id, number, lead_id)
          `)
          .eq('number', editingTrayNumber.trim())
          .neq('id', selectedQuote.id) // Exclude tăvița curentă
          .neq('service_file_id', fisaId || '') // Exclude tăvițele din fișa curentă
        
        if (checkError) {
          console.error('Error checking existing trays:', checkError)
        } else if (existingTrays && existingTrays.length > 0) {
          // Verifică dacă aceste tăvițe au instrumente
          const trayIds = existingTrays.map(t => t.id)
          const { data: trayItems, error: itemsError } = await supabase
            .from('tray_items')
            .select('tray_id, instrument_id')
            .in('tray_id', trayIds)
            .not('instrument_id', 'is', null)
            .limit(1)
          
          if (itemsError) {
            console.error('Error checking tray items:', itemsError)
          } else if (trayItems && trayItems.length > 0) {
            // Tăvița este ocupată de instrumente dintr-o altă fișă
            const occupiedTray = existingTrays.find(t => t.id === trayItems[0].tray_id)
            const serviceFileNumber = (occupiedTray as any)?.service_file?.number || 'necunoscută'
            toast.error(`Tăvița "${editingTrayNumber.trim()}" este deja ocupată de instrumente din fișa "${serviceFileNumber}". Te rog alege alt număr.`)
            return
          }
        }
      } catch (err: any) {
        console.error('Error validating tray number:', err)
        // Continuă cu actualizarea dacă validarea eșuează (nu blocăm utilizatorul)
      }
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
      setEditingTraySize('m')
      toast.success('Tăvița a fost actualizată cu succes')
    } catch (error: any) {
      console.error('Error updating tray:', error)
      toast.error('Eroare la actualizarea tăviței: ' + (error?.message || 'Eroare necunoscută'))
    } finally {
      setUpdatingTray(false)
      setLoading(false)
    }
  }

  // Funcție pentru mutarea unui instrument cu serviciile lui într-o altă tăviță (pentru recepție)
  async function handleMoveInstrument(trayIdOverride?: string) {
    const actualTrayId = trayIdOverride || targetTrayId
    
    if (!instrumentToMove || !actualTrayId || actualTrayId === 'new') {
      toast.error('Selectează o tăviță țintă')
      return
    }

    setMovingInstrument(true)
    try {
      const itemIds = instrumentToMove.items.map(item => item.id)
      
      for (const itemId of itemIds) {
        const { error } = await supabase
          .from('tray_items')
          .update({ tray_id: actualTrayId })
          .eq('id', itemId)
        
        if (error) {
          const errorMsg = error.message || error.code || 'Eroare la actualizarea item-ului'
          throw new Error(`Item ${itemId}: ${errorMsg}`)
        }
      }

      toast.success(`Instrumentul "${instrumentToMove.instrument.name}" și serviciile lui au fost mutate cu succes`)
      
      if (selectedQuoteId) {
        const qi = await listQuoteItems(selectedQuoteId, services, instruments, pipelinesWithIds)
        setItems(qi ?? [])
      }
      
      if (fisaId) {
        const updatedQuotes = await listTraysForServiceSheet(fisaId)
        setQuotes(updatedQuotes)
        
        // Verifică dacă tăvița "undefined" mai are items și șterge-o dacă este goală
        if (isReceptiePipeline) {
          // Găsește tăvița "undefined" din lista actualizată
          const currentUndefinedTray = updatedQuotes.find(q => !q.number || q.number === '')
          
          if (currentUndefinedTray) {
            const undefinedTrayItems = await listQuoteItems(currentUndefinedTray.id, services, instruments, pipelinesWithIds)
            
            if (!undefinedTrayItems || undefinedTrayItems.length === 0) {
              // Tăvița "undefined" este goală, șterge-o
              try {
                const { success, error } = await deleteTray(currentUndefinedTray.id)
                if (success && !error) {
                  console.log('Tăvița "undefined" goală a fost ștearsă')
                  // Reîncarcă tăvițele după ștergere
                  const refreshedQuotes = await listTraysForServiceSheet(fisaId)
                  setQuotes(refreshedQuotes)
                  
                  // Dacă tăvița ștearsă era selectată, selectează prima tăviță rămasă
                  if (selectedQuoteId === currentUndefinedTray.id) {
                    if (refreshedQuotes.length > 0) {
                      setSelectedQuoteId(refreshedQuotes[0].id)
                    } else {
                      setSelectedQuoteId(null)
                    }
                  }
                } else {
                  console.error('Eroare la ștergerea tăviței undefined:', error)
                }
              } catch (deleteError) {
                console.error('Eroare la ștergerea tăviței undefined:', deleteError)
              }
            }
          }
        }
      }
      
      setShowMoveInstrumentDialog(false)
      setInstrumentToMove(null)
      setTargetTrayId('')
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Eroare necunoscută'
      console.error('Error moving instrument:', errorMessage, error)
      toast.error('Eroare la mutarea instrumentului: ' + errorMessage)
    } finally {
      setMovingInstrument(false)
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
    // Exclude departamentul "Ascutit" - nu are brand/serial number
    if (deptNameLower.includes('ascutit') || deptNameLower.includes('ascuțit')) {
      return false
    }
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
    return services.filter(s => s.instrument_id === instrumentId && !usedServiceIds.has(s.id))
  }, [currentInstrumentId, services, items, instruments])

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
      
      // Verifică dacă există brand-uri în formular sau în instrumentSettings pentru acest instrument
      const hasBrandsInForm = instrumentForm.instrument === instrumentId && instrumentForm.brandSerialGroups.some(g => {
        const hasBrand = g.brand && g.brand.trim()
        const hasSerialNumbers = g.serialNumbers.some(sn => {
          const serial = typeof sn === 'string' ? sn : sn.serial || ''
          return serial && serial.trim()
        })
        return hasBrand || hasSerialNumbers
      })
      
      const savedSettings = instrumentSettings[instrumentId]
      const hasBrandsInSettings = savedSettings && savedSettings.brandSerialGroups && savedSettings.brandSerialGroups.length > 0
      
      // Dacă există brand-uri în formular sau în settings, folosește forceReload: false pentru a le păstra
      // Altfel, folosește forceReload: true pentru a încărca datele din DB
      const shouldForceReload = !hasBrandsInForm && !hasBrandsInSettings
      
      console.log('🔄 populateInstrumentFormFromItems - shouldForceReload:', shouldForceReload, 'hasBrandsInForm:', hasBrandsInForm, 'hasBrandsInSettings:', hasBrandsInSettings)
      
      // Populează formularul, păstrând brand-urile existente dacă există
      populateInstrumentFormFromItems(items, instrumentId, shouldForceReload)
    }
  }, [currentInstrumentId, items, services])

  // Variantă simplificată pentru vânzători în pipeline-ul Vânzări
  const isVanzatorMode = isVanzariPipeline && isVanzator
  
  // Pentru recepție: identifică tray-ul "undefined" (cu number gol) și grupează instrumentele
  const undefinedTray = useMemo(() => {
    if (!isReceptiePipeline) return null
    return quotes.find(q => !q.number || q.number === '')
  }, [quotes, isReceptiePipeline])

  // Grupează items-urile din tray-ul undefined după instrument_id (pentru recepție)
  // Grupează instrumentele pentru mutare - disponibil pentru toate pipeline-urile și toate tăvițele
  const instrumentsGrouped = useMemo(() => {
    if (!items.length) return []
    
    const grouped = new Map<string, { instrument: { id: string; name: string }, items: LeadQuoteItem[] }>()
    
    items.forEach(item => {
      let instrumentId: string | null = null
      let instrumentName: string = ''
      
      // Dacă item-ul este un serviciu, obține instrument_id din serviciu
      if (item.item_type === 'service' && item.service_id) {
        const service = services.find(s => s.id === item.service_id)
        if (service?.instrument_id) {
          instrumentId = service.instrument_id
          const instrument = instruments.find(i => i.id === instrumentId)
          instrumentName = instrument?.name || 'Instrument necunoscut'
        }
      } else if (item.instrument_id) {
        // Dacă item-ul are direct instrument_id
        instrumentId = item.instrument_id
        const instrument = instruments.find(i => i.id === instrumentId)
        instrumentName = instrument?.name || 'Instrument necunoscut'
      }
      
      if (instrumentId) {
        if (!grouped.has(instrumentId)) {
          grouped.set(instrumentId, {
            instrument: { id: instrumentId, name: instrumentName },
            items: []
          })
        }
        grouped.get(instrumentId)!.items.push(item)
      }
    })
    
    return Array.from(grouped.values())
  }, [items, services, instruments])

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
            {/* Buton adaugă tăviță - ascuns pentru pipeline-urile departament și pentru vânzători */}
            {!isDepartmentPipeline && !isVanzatorMode && (
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
                  setNewTraySize('m')
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

  // Variantă simplificată pentru vânzători în pipeline-ul Vânzări
  if (isVanzatorMode) {
    return (
      <VanzariView
        instrumentForm={instrumentForm}
        svc={svc}
        serviceSearchQuery={serviceSearchQuery}
        serviceSearchFocused={serviceSearchFocused}
        items={items}
        subscriptionType={subscriptionType}
        trayDetails={trayDetails}
        loadingTrayDetails={loadingTrayDetails}
        urgentAllServices={urgentAllServices}
        officeDirect={officeDirect}
        curierTrimis={curierTrimis}
        noDeal={noDeal}
        nuRaspunde={nuRaspunde}
        callBack={callBack}
        loading={loading}
        saving={saving}
        isDirty={isDirty}
        availableInstruments={availableInstruments}
        availableServices={availableServices}
        services={services}
        instruments={instruments}
        lead={lead}
        onInstrumentChange={(newInstrumentId) => {
          const savedSettings = instrumentSettings[newInstrumentId] || {}
          setInstrumentForm(prev => ({
            ...prev,
            instrument: newInstrumentId,
            qty: savedSettings?.qty || prev.qty || '1'
          }))
          setSvc(s => ({ 
            ...s, 
            instrumentId: newInstrumentId, 
            id: '',
            qty: savedSettings?.qty || s.qty || '1'
          }))
          setIsDirty(true)
        }}
        onQtyChange={(newQty) => {
          setInstrumentForm(prev => ({ ...prev, qty: newQty }))
          if (instrumentForm.instrument) {
            setInstrumentSettings(prev => ({
              ...prev,
              [instrumentForm.instrument]: {
                qty: newQty,
                brandSerialGroups: prev[instrumentForm.instrument]?.brandSerialGroups || [{ brand: '', serialNumbers: [{ serial: '', garantie: false }] }],
                garantie: prev[instrumentForm.instrument]?.garantie || false
              }
            }))
            setSvc(s => ({ ...s, qty: newQty }))
          }
        }}
        onServiceSearchChange={setServiceSearchQuery}
        onServiceSearchFocus={() => setServiceSearchFocused(true)}
        onServiceSearchBlur={() => setTimeout(() => setServiceSearchFocused(false), 200)}
        onServiceSelect={(serviceId, serviceName) => {
          setSvc(prev => ({ ...prev, id: serviceId }))
          setServiceSearchQuery(serviceName)
          setServiceSearchFocused(false)
        }}
        onServiceDoubleClick={(serviceId, serviceName) => {
          setSvc(prev => ({ ...prev, id: serviceId }))
          setServiceSearchQuery(serviceName)
          setServiceSearchFocused(false)
          setTimeout(() => {
            onAddService()
          }, 50)
        }}
        onSvcQtyChange={(qty) => setSvc(s => ({ ...s, qty }))}
        onSvcDiscountChange={(discount) => setSvc(s => ({ ...s, discount }))}
        onAddService={onAddService}
        onUpdateItem={onUpdateItem}
        onDelete={onDelete}
        onDetailsChange={setTrayDetails}
        onOfficeDirectChange={async (isOfficeDirect) => {
          setOfficeDirect(isOfficeDirect)
          if (isOfficeDirect) setCurierTrimis(false)
          setIsDirty(true)
          await handleDeliveryCheckboxChange(isOfficeDirect)
        }}
        onNoDealChange={handleNoDealChange}
        onNuRaspundeChange={handleNuRaspundeChange}
        onCallBackChange={handleCallBackChange}
        onSave={saveAllAndLog}
        currentInstrumentId={currentInstrumentId}
        hasServicesOrInstrumentInSheet={hasServicesOrInstrumentInSheet}
        isTechnician={isTechnician}
        isDepartmentPipeline={isDepartmentPipeline}
        subtotal={subtotal}
        totalDiscount={totalDiscount}
        total={total}
        instrumentSettings={instrumentSettings}
      />
    )
  }

  // Interfață specială pentru recepție - afișează instrumentele din tray-ul undefined și permite mutarea lor
  // Disponibilă doar pentru pipeline-ul Receptie
  if (isReceptiePipeline && undefinedTray && instrumentsGrouped.length > 0) {
    return (
      <div className="space-y-4 border rounded-xl bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-b">
          <div className="px-4 pt-4 pb-3">
            <h3 className="font-semibold text-base text-foreground">Recepție - Distribuire Instrumente</h3>
            <p className="text-sm text-muted-foreground mt-1">Mută instrumentele cu serviciile lor în tăvițe</p>
          </div>
        </div>

        {/* Lista instrumentelor grupate */}
        <div className="px-4 pb-4 space-y-3">
          {instrumentsGrouped.map((group) => (
            <div
              key={group.instrument.id}
              className="border rounded-lg p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    {group.instrument.name}
                  </h4>
                  <div className="text-xs text-muted-foreground mb-2">
                    {group.items.length} {group.items.length === 1 ? 'serviciu' : 'servicii'}
                  </div>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const service = services.find(s => s.id === item.service_id)
                      return (
                        <div key={item.id} className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                          {service?.name || item.name_snapshot || 'Serviciu necunoscut'}
                          {item.qty && item.qty > 1 && ` (x${item.qty})`}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log('🔵 [Move Button] Clicked, setting instrument group:', group)
                    setInstrumentToMove(group)
                    setShowMoveInstrumentDialog(true)
                    console.log('🔵 [Move Button] Dialog should be open now')
                  }}
                  className="flex items-center gap-2"
                >
                  <Move className="h-4 w-4" />
                  Mută
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Dialog pentru mutarea instrumentului */}
        <Dialog open={showMoveInstrumentDialog} onOpenChange={setShowMoveInstrumentDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Mută Instrument</DialogTitle>
              <DialogDescription>
                Selectează tăvița în care vrei să muți instrumentul "{instrumentToMove?.instrument.name}" și serviciile lui.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="target-tray">Tăviță țintă</Label>
                <Select value={targetTrayId} onValueChange={setTargetTrayId}>
                  <SelectTrigger id="target-tray">
                    <SelectValue placeholder="Selectează o tăviță" />
                  </SelectTrigger>
                  <SelectContent>
                    {quotes
                      .filter(q => q.id !== selectedQuote?.id && (q.number || q.number !== ''))
                      .map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          Tăviță {q.number || 'N/A'} ({q.size || 'N/A'})
                        </SelectItem>
                      ))}
                    <SelectItem value="new">Creează tăviță nouă</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {targetTrayId === 'new' && (
                <div className="grid gap-2">
                  <Label htmlFor="new-tray-number">Număr tăviță</Label>
                  <Input
                    id="new-tray-number"
                    placeholder="ex: 1, 2, A, B..."
                    value={newTrayNumber}
                    onChange={(e) => setNewTrayNumber(e.target.value)}
                  />
                  <Label htmlFor="new-tray-size">Mărime</Label>
                  <Select value={newTraySize} onValueChange={setNewTraySize}>
                    <SelectTrigger id="new-tray-size">
                      <SelectValue placeholder="Selectează mărimea" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="s">S</SelectItem>
                      <SelectItem value="m">M</SelectItem>
                      <SelectItem value="l">L</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowMoveInstrumentDialog(false)
                  setInstrumentToMove(null)
                  setTargetTrayId('')
                  setNewTrayNumber('')
                  setNewTraySize('m')
                }}
                disabled={movingInstrument}
              >
                Anulează
              </Button>
              <Button
                onClick={async () => {
                  if (targetTrayId === 'new') {
                    // Creează tăviță nouă și mută instrumentul
                    if (!newTrayNumber.trim() || !fisaId) {
                      toast.error('Introduceți numărul tăviței')
                      return
                    }
                    try {
                      const created = await createQuoteForLead(leadId, newTrayNumber.trim(), fisaId, newTraySize)
                      // Folosește direct ID-ul creat, nu te baza pe state
                      await handleMoveInstrument(created.id)
                    } catch (error: any) {
                      console.error('Error creating tray:', error)
                      toast.error('Eroare la crearea tăviței: ' + (error?.message || 'Eroare necunoscută'))
                    }
                  } else {
                    await handleMoveInstrument()
                  }
                }}
                disabled={movingInstrument || (!targetTrayId || (targetTrayId === 'new' && !newTrayNumber.trim()))}
              >
                {movingInstrument ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Se mută...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Mută
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }
  
  return (
    <div className="space-y-2 sm:space-y-3 lg:space-y-4 border rounded-lg sm:rounded-xl bg-card shadow-sm overflow-hidden">
      {/* Header modern cu gradient */}
      <div className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-800/30 border-b">
        <div className="px-2 sm:px-3 lg:px-4 pt-2 sm:pt-3 lg:pt-4 pb-2 sm:pb-3 flex items-center justify-between gap-2">
          <h3 className="font-semibold text-sm sm:text-base text-foreground">Fișa de serviciu</h3>
          {/* În pipeline-urile tehnice (departamente), tehnicienii nu pot edita tăvița din acest UI */}
          {selectedQuote && !isDepartmentPipeline && !isVanzatorMode && (
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
        {!isDepartmentPipeline && !isVanzatorMode && (
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
            
            {/* Buton adaugă tăviță nouă - ascuns pentru pipeline-urile departament și pentru vânzători */}
            {!isDepartmentPipeline && !isVanzatorMode && (
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
        <CreateTrayDialog
          open={showCreateTrayDialog}
          onOpenChange={setShowCreateTrayDialog}
          newTrayNumber={newTrayNumber}
          newTraySize={newTraySize === 'small' ? 's' : newTraySize === 'medium' ? 'm' : newTraySize === 'large' ? 'l' : newTraySize}
          creatingTray={creatingTray}
          onNumberChange={setNewTrayNumber}
          onSizeChange={(value) => setNewTraySize(value === 's' ? 'small' : value === 'm' ? 'medium' : value === 'l' ? 'large' : value)}
          onCreate={handleCreateTray}
          onCancel={() => {
            setShowCreateTrayDialog(false)
            setNewTrayNumber('')
            setNewTraySize('medium')
          }}
        />
      
      {/* Dialog pentru editarea unei tăvițe */}
      <EditTrayDialog
        open={showEditTrayDialog}
        onOpenChange={setShowEditTrayDialog}
        editingTrayNumber={editingTrayNumber}
        editingTraySize={editingTraySize}
        updatingTray={updatingTray}
        onNumberChange={setEditingTrayNumber}
        onSizeChange={setEditingTraySize}
        onUpdate={handleUpdateTray}
        onCancel={() => {
          setShowEditTrayDialog(false)
          setEditingTrayNumber('')
          setEditingTraySize('m')
        }}
      />
        
        {/* View-uri pipeline specifice */}
        {isReceptiePipeline && selectedQuote && !undefinedTray ? (
          <ReceptieView
            items={items}
            subscriptionType={subscriptionType}
            trayImages={trayImages}
            uploadingImage={uploadingImage}
            isImagesExpanded={isImagesExpanded}
            selectedQuoteId={selectedQuoteId}
            services={services}
            instruments={instruments}
            technicians={technicians}
            pipelinesWithIds={pipelinesWithIds}
            quotes={quotes}
            onUpdateItem={onUpdateItem}
            onDelete={onDelete}
            onRowClick={(item) => {
              // Dacă este un serviciu, populează formularul de serviciu
              if (item.item_type === 'service' && item.service_id) {
                const serviceDef = services.find(s => s.id === item.service_id)
                if (serviceDef) {
                  setSvc({
                    instrumentId: serviceDef.instrument_id || '',
                    id: item.service_id,
                    qty: String(item.qty || 1),
                    discount: String(item.discount_pct || 0),
                    urgent: false,
                    technicianId: '',
                    pipelineId: '',
                    serialNumberId: '',
                    selectedBrands: [],
                  })
                  setServiceSearchQuery(serviceDef.name)
                }
              }
            }}
            onMoveInstrument={(instrumentGroup) => {
              setInstrumentToMove(instrumentGroup)
              setShowMoveInstrumentDialog(true)
            }}
            onToggleImagesExpanded={() => setIsImagesExpanded(!isImagesExpanded)}
            onImageUpload={handleTrayImageUpload}
            onDownloadAll={handleDownloadAllImages}
            onImageDelete={handleTrayImageDelete}
            canAddTrayImages={canAddTrayImages}
            canViewTrayImages={canViewTrayImages}
          />
        ) : isCurierPipeline && selectedQuote ? (
          <CurierView
            items={items}
            subscriptionType={subscriptionType}
            services={services}
            instruments={instruments}
            technicians={technicians}
            pipelinesWithIds={pipelinesWithIds}
            onUpdateItem={onUpdateItem}
            onDelete={onDelete}
            onRowClick={(item) => {
              // Dacă este un serviciu, populează formularul de serviciu
              if (item.item_type === 'service' && item.service_id) {
                const serviceDef = services.find(s => s.id === item.service_id)
                if (serviceDef) {
                  setSvc({
                    instrumentId: serviceDef.instrument_id || '',
                    id: item.service_id,
                    qty: String(item.qty || 1),
                    discount: String(item.discount_pct || 0),
                    urgent: false,
                    technicianId: '',
                    pipelineId: '',
                    serialNumberId: '',
                    selectedBrands: [],
                  })
                  setServiceSearchQuery(serviceDef.name)
                }
              }
            }}
          />
        ) : isDepartmentPipeline && selectedQuote ? (
          <DepartmentView
            instrumentForm={instrumentForm}
            svc={svc}
            part={part}
            serviceSearchQuery={serviceSearchQuery}
            serviceSearchFocused={serviceSearchFocused}
            partSearchQuery={partSearchQuery}
            partSearchFocused={partSearchFocused}
            items={items}
            subscriptionType={subscriptionType}
            availableInstruments={availableInstruments}
            availableServices={availableServices}
            services={services}
            parts={parts}
            instruments={instruments}
            technicians={technicians}
            pipelinesWithIds={pipelinesWithIds}
            onInstrumentChange={(newInstrumentId) => {
              const savedSettings = instrumentSettings[newInstrumentId] || {}
              const savedQty = savedSettings.qty || '1'
              const savedBrandGroups = savedSettings.brandSerialGroups && savedSettings.brandSerialGroups.length > 0
                ? savedSettings.brandSerialGroups.map(g => ({
                    ...g,
                    qty: g.qty || String(g.serialNumbers?.length || 1),
                    serialNumbers: g.serialNumbers.map((sn: any) => 
                      typeof sn === 'string' ? { serial: sn, garantie: false } : sn
                    )
                  }))
                : [{ brand: '', serialNumbers: [{ serial: '', garantie: false }], qty: '1' }]
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
              setIsDirty(true)
            }}
            onQtyChange={(newQty) => {
              setInstrumentForm(prev => ({ ...prev, qty: newQty }))
              if (instrumentForm.instrument) {
                setInstrumentSettings(prev => ({
                  ...prev,
                  [instrumentForm.instrument]: {
                    qty: newQty,
                    brandSerialGroups: prev[instrumentForm.instrument]?.brandSerialGroups || [{ brand: '', serialNumbers: [{ serial: '', garantie: false }] }],
                    garantie: prev[instrumentForm.instrument]?.garantie || false
                  }
                }))
                setSvc(s => ({ ...s, qty: newQty }))
              }
            }}
            onServiceSearchChange={setServiceSearchQuery}
            onServiceSearchFocus={() => setServiceSearchFocused(true)}
            onServiceSearchBlur={() => setTimeout(() => setServiceSearchFocused(false), 200)}
            onServiceSelect={(serviceId, serviceName) => {
              setSvc(prev => ({ ...prev, id: serviceId }))
              setServiceSearchQuery(serviceName)
              setServiceSearchFocused(false)
            }}
            onServiceDoubleClick={(serviceId, serviceName) => {
              setSvc(prev => ({ ...prev, id: serviceId }))
              setServiceSearchQuery(serviceName)
              setServiceSearchFocused(false)
              setTimeout(() => {
                onAddService()
              }, 50)
            }}
            onSvcQtyChange={(qty) => setSvc(s => ({ ...s, qty }))}
            onSvcDiscountChange={(discount) => setSvc(s => ({ ...s, discount }))}
            onAddService={onAddService}
            onPartSearchChange={setPartSearchQuery}
            onPartSearchFocus={() => setPartSearchFocused(true)}
            onPartSearchBlur={() => setTimeout(() => setPartSearchFocused(false), 200)}
            onPartSelect={(partId, partName) => {
              setPart(prev => ({ ...prev, id: partId, overridePrice: '' }))
              setPartSearchQuery(partName)
              setPartSearchFocused(false)
            }}
            onPartDoubleClick={(partId, partName) => {
              setPart(prev => ({ ...prev, id: partId, overridePrice: '' }))
              setPartSearchQuery(partName)
              setPartSearchFocused(false)
              setTimeout(() => {
                onAddPart()
              }, 50)
            }}
            onPartQtyChange={(qty) => setPart(p => ({ ...p, qty }))}
            onSerialNumberChange={(serialNumberId) => setPart(p => ({ ...p, serialNumberId }))}
            onAddPart={onAddPart}
            onUpdateItem={onUpdateItem}
            onDelete={onDelete}
            onRowClick={(item) => {
              // Dacă este un serviciu, populează formularul de serviciu
              if (item.item_type === 'service' && item.service_id) {
                const serviceDef = services.find(s => s.id === item.service_id)
                if (serviceDef) {
                  setSvc({
                    instrumentId: serviceDef.instrument_id || '',
                    id: item.service_id,
                    qty: String(item.qty || 1),
                    discount: String(item.discount_pct || 0),
                    urgent: false,
                    technicianId: '',
                    pipelineId: '',
                    serialNumberId: '',
                    selectedBrands: [],
                  })
                  setServiceSearchQuery(serviceDef.name)
                }
              } else if (item.item_type === 'part') {
                // Pentru piese, populează formularul de piese
                setPart({
                  id: item.part_id || '',
                  serialNumberId: item.serial_number || '',
                  qty: String(item.qty || 1),
                  discount: String(item.discount_pct || 0),
                  urgent: false,
                  overridePrice: '',
                })
                const partDef = parts.find(p => p.id === item.part_id)
                if (partDef) {
                  setPartSearchQuery(partDef.name)
                }
              }
            }}
            currentInstrumentId={currentInstrumentId}
            hasServicesOrInstrumentInSheet={hasServicesOrInstrumentInSheet}
            isTechnician={isTechnician}
            isDepartmentPipeline={isDepartmentPipeline}
            isReparatiiPipeline={isReparatiiPipeline}
            canAddParts={canAddParts}
            canEditUrgentAndSubscription={canEditUrgentAndSubscription}
          />
        ) : (
          <>
            {/* Secțiune Imagini Tăviță */}
            <TrayImagesSection
              trayImages={trayImages}
              uploadingImage={uploadingImage}
              isImagesExpanded={isImagesExpanded}
              canAddTrayImages={canAddTrayImages}
              canViewTrayImages={canViewTrayImages}
              selectedQuoteId={selectedQuoteId}
              onToggleExpanded={() => setIsImagesExpanded(!isImagesExpanded)}
              onImageUpload={handleTrayImageUpload}
              onDownloadAll={handleDownloadAllImages}
              onImageDelete={handleTrayImageDelete}
            />
          </>
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
                  onCheckedChange={async (c: any) => {
                    const newValue = !!c
                    setUrgentAllServices(newValue)
                    
                    // IMPORTANT: Salvează imediat în service_file când se schimbă toggle-ul
                    if (fisaId) {
                      try {
                        const { error } = await updateServiceFile(fisaId, {
                          urgent: newValue
                        })
                        
                        if (error) {
                          console.error('Eroare la salvarea urgent în service_file:', error)
                          toast.error('Eroare la salvarea urgent')
                          // Revert UI dacă salvare eșuează
                          setUrgentAllServices(!newValue)
                        } else {
                          console.log('✅ Urgent salvat în service_file:', newValue)
                          
                          // urgent nu mai există în trays - este gestionat doar în service_files
                          const trayIds = quotes.map(q => q.id)
                          if (trayIds.length > 0) {
                            // Actualizează urgent pentru toate items-urile din toate tăvițele
                            const { data: allTrayItems } = await supabase
                              .from('tray_items')
                              .select('id, notes')
                              .in('tray_id', trayIds)
                            
                            if (allTrayItems && allTrayItems.length > 0) {
                              for (const item of allTrayItems) {
                                let notesData: any = {}
                                if (item.notes) {
                                  try {
                                    notesData = JSON.parse(item.notes)
                                  } catch (e) {
                                    // Notes nu este JSON, ignoră
                                  }
                                }
                                
                                // Actualizează urgent doar pentru servicii și piese
                                if (notesData.item_type === 'service' || notesData.item_type === 'part') {
                                  notesData.urgent = newValue
                                  await supabase
                                    .from('tray_items')
                                    .update({ notes: JSON.stringify(notesData) })
                                    .eq('id', item.id)
                                }
                              }
                            }
                          }
                        }
                      } catch (error: any) {
                        console.error('Eroare la salvarea urgent:', error)
                        toast.error('Eroare la salvarea urgent: ' + (error?.message || 'Eroare necunoscută'))
                        // Revert UI dacă salvare eșuează
                        setUrgentAllServices(!newValue)
                      }
                    }
                  }}
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
          
          {/* Checkbox-uri pentru livrare  - doar în pipeline-ul Vânzări */}
          {isVanzariPipeline && (
            <div className="flex items-center gap-3">
              <div className="h-5 w-px bg-border/60" />
              
              
              <div className="h-5 w-px bg-border/60" />
              <label className="flex items-center gap-2 cursor-pointer group">
                <Checkbox
                  id="office-direct"
                  checked={officeDirect}
                  disabled={curierTrimis}
                  onCheckedChange={async (c: any) => {
                    const isChecked = !!c
                    setOfficeDirect(isChecked)
                    if (isChecked) setCurierTrimis(false)
                    setIsDirty(true)
                    if (isChecked) await handleDeliveryCheckboxChange(true)
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
                  onCheckedChange={async (c: any) => {
                    const isChecked = !!c
                    setCurierTrimis(isChecked)
                    if (isChecked) setOfficeDirect(false)
                    setIsDirty(true)
                    if (isChecked) await handleDeliveryCheckboxChange(false)
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
            {/* Buton Facturare și checkbox-uri Cash/Card - doar în pipeline-ul Recepție și doar când fișa este în stage-ul "Facturat" */}
            {isReceptiePipeline && currentServiceFileStage && (
              (() => {
                const normalizedStage = currentServiceFileStage.toLowerCase().trim()
                const isFacturatStage = normalizedStage === 'facturat' || 
                                       normalizedStage === 'facturată' ||
                                       normalizedStage.includes('facturat')
                return isFacturatStage ? (
                  <div className="flex items-center gap-3">
                    {/* Checkbox-uri Cash și Card - mutual exclusive (doar unul poate fi selectat) */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Checkbox
                          id="payment-cash"
                          checked={paymentCash}
                          onCheckedChange={(checked) => {
                            const isChecked = !!checked
                            setPaymentCash(isChecked)
                            // Dacă se bifează Cash, debifează Card
                            if (isChecked) {
                              setPaymentCard(false)
                            }
                            // Salvează imediat la schimbare
                            if (fisaId) {
                              const detailsToSave = JSON.stringify({
                                text: trayDetails || '',
                                paymentCash: isChecked,
                                paymentCard: false // Card este întotdeauna false când Cash este bifat
                              })
                              updateServiceFile(fisaId, { details: detailsToSave })
                                .then(() => console.log('✅ Payment cash salvat'))
                                .catch(err => console.error('Eroare la salvarea payment cash:', err))
                            }
                          }}
                        />
                        <label
                          htmlFor="payment-cash"
                          className="text-xs font-medium cursor-pointer"
                        >
                          Cash
                        </label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Checkbox
                          id="payment-card"
                          checked={paymentCard}
                          onCheckedChange={(checked) => {
                            const isChecked = !!checked
                            setPaymentCard(isChecked)
                            // Dacă se bifează Card, debifează Cash
                            if (isChecked) {
                              setPaymentCash(false)
                            }
                            // Salvează imediat la schimbare
                            if (fisaId) {
                              const detailsToSave = JSON.stringify({
                                text: trayDetails || '',
                                paymentCash: false, // Cash este întotdeauna false când Card este bifat
                                paymentCard: isChecked
                              })
                              updateServiceFile(fisaId, { details: detailsToSave })
                                .then(() => console.log('✅ Payment card salvat'))
                                .catch(err => console.error('Eroare la salvarea payment card:', err))
                            }
                          }}
                        />
                        <label
                          htmlFor="payment-card"
                          className="text-xs font-medium cursor-pointer"
                        >
                          Card
                        </label>
                      </div>
                    </div>
                    
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
                  </div>
                ) : null
              })()
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
          Afișat pentru toate pipeline-urile, inclusiv Reparații */}
      {(
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

                // Verifică dacă instrumentul selectat are un departament diferit de cele existente în tăviță
                // EXCEPTIE: Pentru Vanzari în tăvița undefined, permite toate instrumentele
                const isUndefinedTray = selectedQuote && (!selectedQuote.number || selectedQuote.number === '')
                const allowAllInstruments = isVanzariPipeline && isUndefinedTray
                
                if (newInstrumentId && !allowAllInstruments && selectedQuote && selectedQuote.number && selectedQuote.number.trim() !== '') {
                  // Tăviță definită - verifică departamentele
                  const newInstrument = instruments.find(i => i.id === newInstrumentId)
                  if (newInstrument) {
                    // Obține departamentele existente în tăviță (inclusiv din servicii și piese)
                    const existingDepartments = new Set<string | null>()
                    items.forEach(item => {
                      let itemInstrumentId: string | null = null
                      if (item.item_type === 'service' && item.service_id) {
                        const serviceDef = services.find(s => s.id === item.service_id)
                        itemInstrumentId = serviceDef?.instrument_id || null
                      } else if (item.instrument_id) {
                        itemInstrumentId = item.instrument_id
                      }
                      
                      if (itemInstrumentId) {
                        const existingInstrument = instruments.find(i => i.id === itemInstrumentId)
                        if (existingInstrument && existingInstrument.department_id) {
                          existingDepartments.add(existingInstrument.department_id)
                        }
                      }
                    })
                    
                    // Dacă există deja instrumente cu departamente diferite, verifică dacă noul instrument are același departament
                    if (existingDepartments.size > 0 && newInstrument.department_id) {
                      const allowedDepartment = Array.from(existingDepartments)[0]
                      if (newInstrument.department_id !== allowedDepartment) {
                        const departmentName = departments.find(d => d.id === allowedDepartment)?.name || 'acest departament'
                        const newDepartmentName = departments.find(d => d.id === newInstrument.department_id)?.name || 'alt departament'
                        toast.error(`Nu poți adăuga instrumente cu departamente diferite în aceeași tăviță. Tăvița conține deja instrumente din ${departmentName}, iar instrumentul selectat este din ${newDepartmentName}.`)
                        // Resetează selecția la valoarea anterioară
                        e.target.value = instrumentForm.instrument || ''
                        return
                      }
                    }
                  }
                }

                // Dacă acest instrument ar fi al treilea distinct pe tăviță, nu permitem schimbarea
                if (
                  newInstrumentId &&
                  !distinctInstrumentsInTray.some(i => i.id === newInstrumentId)
                ) {
                  // Verifică limita de 2 instrumente doar pentru pipeline-urile non-Vanzari și non-Curier
                  if (!isVanzariPipeline && !isCurierPipeline) {
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
                }

                // Sincronizează cu formularul de serviciu și cu setările specifice instrumentului (brand / serial / garanție / qty)
                const savedSettings = instrumentSettings[newInstrumentId] || {}
                const savedQty = savedSettings.qty || '1'
                const savedBrandGroups = savedSettings.brandSerialGroups && savedSettings.brandSerialGroups.length > 0
                  ? savedSettings.brandSerialGroups.map(g => ({
                      ...g,
                      qty: g.qty || String(g.serialNumbers?.length || 1), // Asigură că qty există
                      serialNumbers: g.serialNumbers.map((sn: any) => 
                        typeof sn === 'string' ? { serial: sn, garantie: false } : sn
                      )
                    }))
                  : [{ brand: '', serialNumbers: [{ serial: '', garantie: false }], qty: '1' }]
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
              title={(isVanzariPipeline || isCurierPipeline) ? "Selectează instrument" : "Selectează instrument (poți avea până la 2 instrumente pe tăviță)"}
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
              disabled={hasServicesOrInstrumentInSheet && !isVanzariPipeline && !isCurierPipeline}
              title={hasServicesOrInstrumentInSheet && !isVanzariPipeline && !isCurierPipeline ? "Cantitatea este blocată - există deja servicii sau instrument în tăviță" : "Introduceți cantitatea instrumentului"}
          />
        </div>
        </div>

        {/* Brand, Serial Number și Garantie - doar pentru instrumente din departamentul Reparații */}
        {isReparatiiInstrument && (
          <div className="space-y-3 mt-3">
            {instrumentForm.brandSerialGroups.map((group, groupIndex) => {
              // Calculează cantitatea pentru acest brand (din qty sau default 1)
              const brandQty = Number(group.qty || 1)
              // Generează automat casetele de serial number bazat pe cantitatea brand-ului
              const serialNumbersArray = Array.from({ length: Math.max(1, brandQty) }, (_, i) => 
                group.serialNumbers[i] || { serial: '', garantie: false }
              )
              
              return (
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

                {/* Cantitate Brand - 1 col */}
                <div className="col-span-1 sm:col-span-1">
                  <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Cant.</Label>
                  <Input
                    className="h-7 sm:h-8 text-xs sm:text-sm text-center"
                    type="number"
                    min="1"
                    value={group.qty || '1'}
                    onChange={e => {
                      const newQty = e.target.value
                      const qtyNum = Math.max(1, Number(newQty) || 1)
                      setInstrumentForm(prev => ({
                        ...prev,
                        brandSerialGroups: prev.brandSerialGroups.map((g, i) => 
                          i === groupIndex 
                            ? { 
                                ...g, 
                                qty: String(qtyNum),
                                // Actualizează automat numărul de casete de serial number
                                serialNumbers: Array.from({ length: qtyNum }, (_, idx) => 
                                  g.serialNumbers[idx] || { serial: '', garantie: false }
                                )
                              }
                            : g
                        )
                      }))
                      setIsDirty(true)
                    }}
                    placeholder="1"
                  />
                </div>

                {/* Serial Numbers cu Garanție - 5 cols */}
                <div className="col-span-1 sm:col-span-5">
                  <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">
                    Serial Numbers ({brandQty} {brandQty === 1 ? 'caseta' : 'casete'})
                  </Label>
                  <div className="space-y-1">
                    {serialNumbersArray.map((serialData, serialIndex) => (
                      <div key={serialIndex} className="flex gap-2 items-center">
                        <Input
                          className="h-7 text-sm flex-1"
                          value={serialData.serial || ''}
                          onChange={e => onUpdateSerialNumber(groupIndex, serialIndex, e.target.value)}
                          placeholder={`Serial ${serialIndex + 1}`}
                        />
                        <div className="flex items-center gap-1">
                          <Checkbox
                            id={`serial-garantie-${groupIndex}-${serialIndex}`}
                            checked={serialData.garantie || false}
                            onCheckedChange={(c: any) => {
                              onUpdateSerialGarantie(groupIndex, serialIndex, !!c)
                            }}
                          />
                          <Label htmlFor={`serial-garantie-${groupIndex}-${serialIndex}`} className="text-[10px] sm:text-xs cursor-pointer whitespace-nowrap">
                            G
                          </Label>
                        </div>
                      </div>
                    ))}
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
              )
            })}
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
          <div className="flex items-center gap-2">
            {(svc.id || serviceSearchQuery) && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleResetServiceForm} 
                className="h-7"
                title="Anulează selecția"
              >
                <XIcon className="h-3 w-3 mr-1" /> Anulează
              </Button>
            )}
            <Button size="sm" onClick={onAddService} disabled={!svc.id} className="h-7">
              <Plus className="h-3 w-3 mr-1" /> Adaugă
            </Button>
          </div>
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
                  .filter((s: any) => !serviceSearchQuery || s.name.toLowerCase().includes(serviceSearchQuery.toLowerCase()))
                  .slice(0, serviceSearchQuery ? 10 : 20)
                  .map((s: any) => {
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSvc(prev => ({ ...prev, id: s.id }))
                          setServiceSearchQuery(s.name)
                          setServiceSearchFocused(false)
                        }}
                        onDoubleClick={() => {
                          setSvc(prev => ({ ...prev, id: s.id }))
                          setServiceSearchQuery(s.name)
                          setServiceSearchFocused(false)
                          setTimeout(() => {
                            onAddService()
                          }, 50)
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center"
                        title="Click pentru selectare, Double-click pentru adăugare rapidă"
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

          {/* Serial Number / Brand Selection - 3 cols */}
          <div className="col-span-1 sm:col-span-3">
            {isVanzariPipeline ? (
              <>
                <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Brand-uri</Label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto border rounded-md p-2 bg-background">
                  {instrumentForm.brandSerialGroups
                    .filter(group => group.brand && group.brand.trim())
                    .map((group, gIdx) => {
                      const brandName = group.brand.trim()
                      const isSelected = (svc.selectedBrands || []).includes(brandName)
                      return (
                        <div key={gIdx} className="flex items-center gap-2">
                          <Checkbox
                            id={`brand-${gIdx}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSvc(s => ({ 
                                  ...s, 
                                  selectedBrands: [...(s.selectedBrands || []), brandName]
                                }))
                              } else {
                                setSvc(s => ({ 
                                  ...s, 
                                  selectedBrands: (s.selectedBrands || []).filter(b => b !== brandName)
                                }))
                              }
                            }}
                          />
                          <Label 
                            htmlFor={`brand-${gIdx}`} 
                            className="text-xs cursor-pointer flex-1"
                          >
                            {brandName}
                          </Label>
                        </div>
                      )
                    })}
                  {instrumentForm.brandSerialGroups.filter(group => group.brand && group.brand.trim()).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-1">
                      Nu există brand-uri disponibile
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
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
                      .map(sn => {
                        const serial = typeof sn === 'string' ? sn : sn.serial || ''
                        return serial.trim()
                      })
                      .filter(sn => sn)
                      .map((sn, snIdx) => (
                        <option key={`${gIdx}-${snIdx}`} value={`${group.brand}::${sn}`}>
                          {group.brand ? `${group.brand} - ${sn}` : sn}
                        </option>
                      ))
                  )}
                </select>
              </>
            )}
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
        <AddPartForm
          part={part}
          partSearchQuery={partSearchQuery}
          partSearchFocused={partSearchFocused}
          parts={parts}
          items={items}
          instrumentForm={instrumentForm}
          canAddParts={canAddParts}
          onPartSearchChange={setPartSearchQuery}
          onPartSearchFocus={() => setPartSearchFocused(true)}
          onPartSearchBlur={() => setTimeout(() => setPartSearchFocused(false), 200)}
          onPartSelect={(partId, partName) => {
            setPart(prev => ({ ...prev, id: partId, overridePrice: '' }))
            setPartSearchQuery(partName)
            setPartSearchFocused(false)
          }}
          onPartDoubleClick={(partId, partName) => {
            setPart(prev => ({ ...prev, id: partId, overridePrice: '' }))
            setPartSearchQuery(partName)
            setPartSearchFocused(false)
            setTimeout(() => {
              onAddPart()
            }, 50)
          }}
          onQtyChange={(qty) => setPart(p => ({ ...p, qty }))}
          onSerialNumberChange={(serialNumberId) => setPart(p => ({ ...p, serialNumberId }))}
          onAddPart={onAddPart}
        />
      )}

      {/* Items Table și Totals - doar pentru pipeline-urile non-specifice */}
      {!isReceptiePipeline && !isCurierPipeline && !isDepartmentPipeline && (
        <>
          <ItemsTable
            items={items}
            services={services}
            instruments={instruments}
            technicians={technicians}
            pipelinesWithIds={pipelinesWithIds}
            isReceptiePipeline={isReceptiePipeline}
            canEditUrgentAndSubscription={canEditUrgentAndSubscription}
            onUpdateItem={onUpdateItem}
            onDelete={onDelete}
            onRowClick={(item) => {
              // Dacă este un serviciu, populează formularul de serviciu
              if (item.item_type === 'service' && item.service_id) {
                const serviceDef = services.find(s => s.id === item.service_id)
                if (serviceDef) {
                  setSvc({
                    instrumentId: serviceDef.instrument_id || '',
                    id: item.service_id,
                    qty: String(item.qty || 1),
                    discount: String(item.discount_pct || 0),
                    urgent: false,
                    technicianId: '',
                    pipelineId: '',
                    serialNumberId: '',
                    selectedBrands: [],
                  })
                  setServiceSearchQuery(serviceDef.name)
                  
                  // Populează și formularul de instrument dacă există instrument
                  if (serviceDef.instrument_id) {
                    const instrument = instruments.find(i => i.id === serviceDef.instrument_id)
                    if (instrument) {
                      setInstrumentForm(prev => ({
                        ...prev,
                        instrument: serviceDef.instrument_id || '',
                        qty: String(item.qty || 1),
                      }))
                      
                      // Populează brand și serial number dacă există
                      const brandGroups = (item as any).brand_groups || []
                      if (brandGroups.length > 0) {
                        const brandSerialGroups = brandGroups.map((bg: any) => ({
                          brand: bg.brand || '',
                          serialNumbers: bg.serialNumbers && bg.serialNumbers.length > 0 
                            ? bg.serialNumbers 
                            : [{ serial: '', garantie: false }],
                          garantie: bg.garantie || false
                        }))
                        setInstrumentForm(prev => ({
                          ...prev,
                          brandSerialGroups,
                          garantie: brandGroups[0]?.garantie || false
                        }))
                      } else if (item.brand || item.serial_number) {
                        // Fallback pentru structura veche
                        setInstrumentForm(prev => ({
                          ...prev,
                          brandSerialGroups: [{
                            brand: item.brand || '',
                            serialNumbers: item.serial_number ? [{ serial: item.serial_number, garantie: false }] : [{ serial: '', garantie: false }],
                            garantie: item.garantie || false
                          }],
                          garantie: item.garantie || false
                        }))
                      }
                    }
                  }
                }
              } else if (item.item_type === 'part') {
                // Pentru piese, populează formularul de piese
                setPart({
                  id: item.part_id || '',
                  serialNumberId: item.serial_number || '',
                  qty: String(item.qty || 1),
                  discount: String(item.discount_pct || 0),
                  urgent: false,
                  overridePrice: '',
                })
                const partDef = parts.find(p => p.id === item.part_id)
                if (partDef) {
                  setPartSearchQuery(partDef.name)
                }
              }
            }}
            onMoveInstrument={(instrumentGroup) => {
              setInstrumentToMove(instrumentGroup)
              setShowMoveInstrumentDialog(true)
            }}
          />

          {/* Totals */}
          <TotalsSection
            items={items}
            subscriptionType={subscriptionType}
            services={services}
            instruments={instruments}
          />
        </>
      )}

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

      {/* Secțiune Informații Tăviță – mutată în Fișa de serviciu pentru pipeline-urile comerciale */}
      {isCommercialPipeline && quotes.length > 0 && (
        <TrayDetailsSection
          trayDetails={trayDetails}
          loadingTrayDetails={loadingTrayDetails}
          isCommercialPipeline={isCommercialPipeline}
          onDetailsChange={setTrayDetails}
        />
      )}

      {/* Dialog pentru mutarea instrumentului - disponibil pentru toate pipeline-urile */}
      <MoveInstrumentDialog
        open={showMoveInstrumentDialog}
        onOpenChange={setShowMoveInstrumentDialog}
        instrumentToMove={instrumentToMove}
        quotes={quotes}
        selectedQuoteId={selectedQuoteId}
        targetTrayId={targetTrayId}
        newTrayNumber={newTrayNumber}
        newTraySize={newTraySize === 'small' ? 's' : newTraySize === 'medium' ? 'm' : newTraySize === 'large' ? 'l' : newTraySize}
        movingInstrument={movingInstrument}
        onTargetTrayChange={setTargetTrayId}
        onNewTrayNumberChange={setNewTrayNumber}
        onNewTraySizeChange={(value) => setNewTraySize(value === 's' ? 'small' : value === 'm' ? 'medium' : value === 'l' ? 'large' : value)}
        onMove={async () => {
          if (targetTrayId === 'new') {
            if (!newTrayNumber.trim() || !fisaId) {
              toast.error('Introduceți numărul tăviței')
              return
            }
            try {
              const created = await createQuoteForLead(leadId, newTrayNumber.trim(), fisaId, newTraySize)
              await handleMoveInstrument(created.id)
            } catch (error: any) {
              console.error('Error creating tray:', error)
              toast.error('Eroare la crearea tăviței: ' + (error?.message || 'Eroare necunoscută'))
            }
          } else {
            await handleMoveInstrument()
          }
        }}
        onCancel={() => {
          setShowMoveInstrumentDialog(false)
          setInstrumentToMove(null)
          setTargetTrayId('')
          setNewTrayNumber('')
          setNewTraySize('medium')
        }}
      />
    </div>
  );
})

export default Preturi
