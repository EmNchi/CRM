'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { listServices, type Service } from '@/lib/supabase/serviceOperations';
import { 
  listTraysForServiceFile,
  createTray,
  getTray,
  listTrayItemsForTray,
  createTrayItem,
  updateTrayItem,
  deleteTrayItem,
  updateTray,
  updateServiceFile,
  getServiceFile,
  createServiceFile,
  type Tray,
  type TrayItem,
  type ServiceFile
} from "@/lib/supabase/serviceFileOperations"
import { addServiceFileToPipeline, addTrayToPipeline } from "@/lib/supabase/pipelineOperations"
import { useRole } from "@/hooks/useRole"
import { useAuth } from "@/hooks/useAuth"

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

const createQuoteForLead = async (leadId: string, name?: string, fisaId?: string | null): Promise<LeadQuote> => {
  if (!fisaId) {
    throw new Error('fisaId is required for creating trays in new architecture')
  }
  
  // Creează o tavă nouă pentru fișa de serviciu
  const trayData = {
    number: name || '1',
    size: 'medium',
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
    
    return {
      ...item,
      item_type,
      price: price || 0, // Asigură-te că price este întotdeauna un număr
      discount_pct: notesData.discount_pct || 0,
      urgent: notesData.urgent || false,
      name_snapshot: notesData.name_snapshot || notesData.name || '',
      brand: notesData.brand || null,
      serial_number: notesData.serial_number || null,
      garantie: notesData.garantie || false,
      pipeline_id: notesData.pipeline_id || null,
      department, // Departament preluat din instruments.pipeline
      qty: item.qty || 1,
    } as LeadQuoteItem & { price: number; department?: string | null } // Forțează TypeScript să vadă price ca fiind întotdeauna definit
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
  
  // Salvează informații suplimentare în notes ca JSON
  const notesData = {
    name_snapshot: instrumentName,
    item_type: null, // null înseamnă doar instrument, fără serviciu
    brand: opts?.brand || null,
    serial_number: opts?.serial_number || null,
    garantie: opts?.garantie || false,
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
  })
  if (error) throw error
}
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus, Wrench, Send, Loader2, AlertTriangle } from 'lucide-react';
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
import { toast } from 'sonner';
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
import type { Lead } from '@/app/page'

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

      const sheets = await Promise.all(
        quotes.map(async (quote) => {
          const items = await listQuoteItems(quote.id, services, instruments, pipelinesWithIds)
          
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
      )

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

export default function Preturi({ leadId, lead, fisaId, initialQuoteId, pipelineSlug }: { leadId: string; lead?: Lead | null; fisaId?: string | null; initialQuoteId?: string | null; pipelineSlug?: string }) {
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
  const [allSheetsTotal, setAllSheetsTotal] = useState<number>(0);  const [items, setItems] = useState<LeadQuoteItem[]>([]);

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

  // State pentru urgent global (pentru toate serviciile)
  const [urgentAllServices, setUrgentAllServices] = useState(false)

  // State pentru trimiterea tăvițelor în pipeline-urile departamentelor
  const [sendingTrays, setSendingTrays] = useState(false)
  const [showSendConfirmation, setShowSendConfirmation] = useState(false)
  const [traysAlreadyInDepartments, setTraysAlreadyInDepartments] = useState(false)

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

  // Verifică dacă suntem în pipeline-ul Curier
  const isCurierPipeline = useMemo(() => {
    if (!pipelineSlug) return false
    return pipelineSlug.toLowerCase().includes('curier')
  }, [pipelineSlug])

  // State pentru a stoca cantitatea, brand, serial numbers și garantie pentru fiecare instrument
  // Notă: pipeline_id (pentru departament) este gestionat direct în items, nu în instrumentSettings
  const [instrumentSettings, setInstrumentSettings] = useState<Record<string, { 
    qty: string; 
    brand: string;
    serialNumbers: string[];
    garantie: boolean;
  }>>({})

  // Add-instrument form state
  const [instrumentForm, setInstrumentForm] = useState({
    instrument: '',
    brand: '',
    serialNumbers: [''] as string[],
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
    urgent: false
  })

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

  async function saveAllAndLog() {
    if (!selectedQuote) return
    setSaving(true)
    try {
      // Dacă există un instrument selectat și nu există items în quote, creează un item doar cu instrumentul
      const instrumentIdToUse = instrumentForm.instrument || svc.instrumentId
      if (instrumentIdToUse && items.length === 0) {
        // Obține numele instrumentului din lista de instrumente
        const instrument = instruments.find(i => i.id === instrumentIdToUse)
        if (!instrument || !instrument.name) {
          toast.error('Instrumentul selectat nu a fost găsit')
          setSaving(false)
          return
        }
        
        // Obține datele instrumentului
        const savedSettings = instrumentSettings[instrumentIdToUse] || {}
        const brand = instrumentForm.brand?.trim() || savedSettings.brand || null
        const serialNumber = instrumentForm.serialNumbers?.[0]?.trim() || savedSettings.serialNumbers?.[0] || null
        const garantie = instrumentForm.garantie || savedSettings.garantie || false
        const qty = Number(instrumentForm.qty || savedSettings.qty || 1)
        
        // Determină pipeline_id automat bazat pe department_id al instrumentului
        let autoPipelineId: string | null = null
        if (instrument.department_id) {
          // Verifică dacă department_id este UUID sau text direct
          const instrumentDept = departments.find(d => d.id === instrument.department_id)
          const deptName = instrumentDept?.name?.toLowerCase() || instrument.department_id?.toLowerCase()
          
          // Dacă departamentul este "reparatii", setează pipeline la "Reparatii"
          if (deptName === 'reparatii') {
            const reparatiiPipeline = pipelinesWithIds.find(p => p.name.toLowerCase() === 'reparatii')
            if (reparatiiPipeline) {
              autoPipelineId = reparatiiPipeline.id
              console.log('Pipeline setat automat la Reparatii pentru instrument salvat:', instrument.name)
            }
          }
        }
        
        // Verifică dacă instrumentul are department_id
        if (!instrument.department_id) {
          toast.error('Instrumentul selectat nu are departament setat. Te rog verifică setările instrumentului în baza de date.')
          setSaving(false)
          return
        }
        
        // Creează un item cu item_type: null pentru instrument (folosind numele instrumentului)
        await addInstrumentItem(
          selectedQuote.id,
          instrument.name, // Trimite numele instrumentului, nu ID-ul
          {
            instrument_id: instrument.id, // ID-ul instrumentului (UUID)
            department_id: instrument.department_id, // Department din instrument
            qty: qty,
            discount_pct: 0,
            urgent: false,
            technician_id: null,
            brand: brand,
            serial_number: serialNumber,
            garantie: garantie,
            pipeline_id: autoPipelineId // Pipeline setat automat dacă instrumentul e din departamentul "reparatii"
          }
        )
        
        // Reîncarcă items pentru quote
        const newItems = await listQuoteItems(selectedQuote.id, services, instruments, pipelinesWithIds)
        setItems(newItems)
        
        // Actualizează lastSavedRef cu snapshot-ul corect pentru ca la următoarea salvare să poată compara
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
        
        // Păstrează instrumentul selectat în formular
        // Asigură-te că instrumentul rămâne selectat în ambele state-uri
        if (instrumentIdToUse) {
          setSvc(prev => ({ ...prev, instrumentId: instrumentIdToUse }))
          setInstrumentForm(prev => ({ ...prev, instrument: instrumentIdToUse }))
        }
        
        // Recalculează totalurile
        await recalcAllSheetsTotal(quotes)
        
        toast.success('Instrumentul a fost salvat în istoric!')
        setIsDirty(false)
        setSaving(false)
        return
      }
      
      // Logica normală pentru salvare (dacă există items sau nu e doar instrument)
      // Pregătește datele pentru salvare
      const updateData: any = {
        is_cash: isCash,
        is_card: isCard,
      }
      
      // Adaugă subscription_type doar dacă este valid
      if (subscriptionType && ['services', 'parts', 'both'].includes(subscriptionType)) {
        updateData.subscription_type = subscriptionType
      } else {
        updateData.subscription_type = null
      }
      
      console.log('Salvare quote:', { quoteId: selectedQuote.id, updateData })
      
      // salveaza cash/card si abonament in baza de date
      // Notă: is_cash, is_card, subscription_type nu există în noua arhitectură
      // Acestea sunt ignorate pentru moment
      try {
        await updateQuote(selectedQuote.id, updateData)
        console.log('Quote actualizat cu succes')
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
      
      // Salvează checkbox-urile pentru livrare în service_file
      console.log('🔍 DEBUG - Checkpoint salvare curier:', {
        fisaId,
        officeDirect,
        curierTrimis,
        hasFisaId: !!fisaId
      })
      
      if (fisaId) {
        const { error: serviceFileError } = await updateServiceFile(fisaId, {
          office_direct: officeDirect,
          curier_trimis: curierTrimis,
        })
        
        if (serviceFileError) {
          console.error('Eroare la actualizarea service_file:', serviceFileError)
        } else {
          console.log('Service file actualizat cu office_direct:', officeDirect, 'curier_trimis:', curierTrimis)
          
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
              // Determină stage-ul bazat pe checkbox-ul bifat
              // Încearcă mai multe variante de nume (case-insensitive)
              const stageNameVariants = officeDirect 
                ? ['Office direct', 'OFFICE DIRECT', 'office direct']
                : ['Curier Trimis', 'CURIER TRIMIS', 'curier trimis', 'Curier trimis']
              
              // Obține toate stage-urile din pipeline-ul Curier pentru debug
              const { data: allStages, error: allStagesError } = await supabase
                .from('stages')
                .select('id, name')
                .eq('pipeline_id', curierPipeline.id) as { 
                  data: Array<{ id: string; name: string }> | null; 
                  error: any 
                }
              
              console.log('Stage-uri găsite în pipeline Curier:', {
                pipelineId: curierPipeline.id,
                stages: allStages,
                error: allStagesError
              })
              
              // Caută stage-ul (case-insensitive)
              let stageData: { id: string } | null = null
              let foundStageName: string | null = null
              
              if (allStages && !allStagesError) {
                for (const variant of stageNameVariants) {
                  const stage = allStages.find((s) => 
                    s.name?.toLowerCase() === variant.toLowerCase()
                  )
                  if (stage) {
                    stageData = { id: stage.id }
                    foundStageName = stage.name
                    break
                  }
                }
              }
              
              if (stageData?.id) {
                console.log('Stage găsit:', {
                  stageId: stageData.id,
                  stageName: foundStageName,
                  fisaId
                })
                
                // Folosește funcția addServiceFileToPipeline care gestionează automat insert/update
                const { data: pipelineItem, error: pipelineError } = await addServiceFileToPipeline(
                  fisaId,
                  curierPipeline.id,
                  stageData.id
                )
                
                if (pipelineError) {
                  console.error('Eroare la adăugarea fișei în pipeline:', {
                    error: pipelineError,
                    fisaId,
                    pipelineId: curierPipeline.id,
                    stageId: stageData.id
                  })
                  toast.error(`Eroare la adăugarea fișei în pipeline: ${pipelineError.message || 'Eroare necunoscută'}`)
                } else {
                  console.log('✅ Fișa adăugată/actualizată cu succes în pipeline Curier:', {
                    stageName: foundStageName,
                    pipelineItem,
                    fisaId
                  })
                }
              } else {
                console.warn('❌ Stage-ul nu a fost găsit:', {
                  searchedVariants: stageNameVariants,
                  availableStages: allStages?.map((s: any) => s.name),
                  pipelineId: curierPipeline.id
                })
                toast.error(`Stage-ul "${stageNameVariants[0]}" nu a fost găsit în pipeline-ul Curier`)
              }
            } else {
              console.warn('❌ Pipeline-ul "Curier" nu a fost găsit:', {
                availablePipelines: pipelinesWithIds.map(p => p.name)
              })
              toast.error('Pipeline-ul "Curier" nu a fost găsit')
            }
          } else {
            // Dacă niciun checkbox nu este bifat, șterge fișa din pipeline-ul Curier (dacă există)
            const curierPipeline = pipelinesWithIds.find(p => p.name.toLowerCase() === 'curier')
            if (curierPipeline) {
              const { error: deleteError } = await supabase
                .from('pipeline_items')
                .delete()
                .eq('item_id', fisaId)
                .eq('type', 'service_file')
                .eq('pipeline_id', curierPipeline.id)
              
              if (deleteError) {
                console.error('Eroare la ștergerea fișei din pipeline:', deleteError)
              } else {
                console.log('Fișa ștearsă din pipeline Curier (niciun checkbox bifat)')
              }
            }
          }
        }
      }
      
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
      setTraysAlreadyInDepartments(false)
      return
    }

    try {
      // Obține pipeline-urile departamentelor (Saloane, Horeca, Frizerii, Reparatii)
      const { data: deptPipelines } = await supabase
        .from('pipelines')
        .select('id')
        .in('name', ['Saloane', 'Horeca', 'Frizerii', 'Reparatii'])

      if (!deptPipelines || deptPipelines.length === 0) {
        setTraysAlreadyInDepartments(false)
        return
      }

      const deptPipelineIds = deptPipelines.map((p: any) => p.id)

      // Verifică dacă există pipeline_items pentru tăvițe în pipeline-urile departamentelor
      const { data: pipelineItems, error } = await supabase
        .from('pipeline_items')
        .select('item_id')
        .eq('type', 'tray')
        .in('item_id', trayIds)
        .in('pipeline_id', deptPipelineIds)

      if (error) {
        console.error('Eroare la verificarea tăvițelor în departamente:', error)
        setTraysAlreadyInDepartments(false)
        return
      }

      // Dacă există cel puțin un pipeline_item, tăvițele sunt deja în departamente
      const hasTraysInDepartments = pipelineItems && pipelineItems.length > 0
      setTraysAlreadyInDepartments(hasTraysInDepartments)

      console.log('🔍 Verificare tăvițe în departamente:', {
        trayIds,
        hasTraysInDepartments,
        count: pipelineItems?.length || 0
      })
    } catch (error) {
      console.error('Eroare la verificarea tăvițelor în departamente:', error)
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
  
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Încarcă toate datele în paralel, inclusiv pipelines și departments
        const [svcList, techList, partList, instList, pipelinesData, departmentsData] = await Promise.all([
          listServices(),
          // Obține membrii din app_members pentru tehnicieni (folosim user_id ca id și email ca nume)
          supabase
            .from('app_members')
            .select('user_id, email')
            .order('created_at', { ascending: true })
            .then(({ data, error }) => {
              if (error) {
                console.error('Error loading app_members:', error)
                return []
              }
              // Transformă în format compatibil cu Technician (id = user_id, name din email)
              const techs = (data ?? []).map((m: any) => {
                let name = 'Necunoscut'
                
                // Folosește email-ul ca nume (partea dinainte de @)
                if (m.email) {
                  name = m.email.split('@')[0]
                } else {
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
      
        // Load or create first sheet
        let qs: LeadQuote[];
        if (fisaId) {
          // Dacă avem fisaId, încarcă doar tăvițele din acea fișă
          qs = await listTraysForServiceSheet(fisaId);
          if (!qs.length) {
            // Dacă nu există tăvițe, creează prima tăviță pentru această fișă
            const created = await createQuoteForLead(leadId, undefined, fisaId);
            qs = [created];
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
          if (!qs.length) {
            const created = await createQuoteForLead(leadId, undefined, defaultFisaId)
            qs = [created]
          }
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
        
        // Încarcă checkbox-urile pentru livrare din service_file (în paralel)
        if (fisaId) {
          parallelTasks.push(
            getServiceFile(fisaId).then(({ data: serviceFileData }) => {
              if (serviceFileData) {
                setOfficeDirect(serviceFileData.office_direct || false)
                setCurierTrimis(serviceFileData.curier_trimis || false)
                console.log('Încărcare checkbox-uri livrare din service_file:', {
                  fisaId,
                  office_direct: serviceFileData.office_direct,
                  curier_trimis: serviceFileData.curier_trimis
                })
              }
            }).catch(err => {
              console.error('Eroare la încărcarea service_file:', err)
            })
          )
        }
        
        // Load items for selected sheet (în paralel)
        parallelTasks.push(
          listQuoteItems(firstId, svcList, instList, pipelinesData.withIds).then(qi => {
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

            // Pre-selectează instrumentul dacă există deja servicii în tăviță
            const serviceItems = (qi ?? []).filter((item: any) => item.item_type === 'service')
            if (serviceItems.length > 0 && serviceItems[0].service_id) {
              const firstServiceDef = svcList.find(s => s.id === serviceItems[0].service_id)
              if (firstServiceDef?.instrument_id) {
                const instrumentId = firstServiceDef.instrument_id!
                setSvc(prev => ({ ...prev, instrumentId }))
                // Populează formularul instrument cu datele salvate
                populateInstrumentFormFromItems(qi ?? [], instrumentId)
              }
            }
            return qi
          }).catch(err => {
            console.error('Eroare la încărcarea items-urilor:', err)
            return []
          })
        )
        
        // Load cash/card and subscription values from quote (după ce știm prima tăviță)
        const selectedQuoteForData = qs.find(q => q.id === firstId) || qs[0];
        const firstQuote = selectedQuoteForData as any
        if (firstQuote) {
          setIsCash(firstQuote.is_cash || false)
          setIsCard(firstQuote.is_card || false)
          const loadedSubscriptionType = firstQuote.subscription_type || ''
          console.log('Încărcare subscription_type din quote:', {
            quoteId: firstQuote.id,
            subscription_type: firstQuote.subscription_type,
            loadedSubscriptionType
          })
          setSubscriptionType(loadedSubscriptionType)
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
              // Daca se modifica tăvița curentă, actualizeaza checkbox-urile
              if (trayId === selectedQuoteId && payloadNew) {
                setIsCash(payloadNew.is_cash || false)
                setIsCard(payloadNew.is_card || false)
                if (payloadNew.subscription_type !== undefined) {
                  setSubscriptionType(payloadNew.subscription_type || '')
                }
              }
              
              // Reincarca tăvițele pentru a avea date actualizate
              const currentQuotes = fisaId 
                ? await listTraysForServiceSheet(fisaId)
                : await listQuotesForLead(leadId)
              setQuotes(currentQuotes)
              
              // Daca tăvița curentă s-a schimbat, actualizeaza checkbox-urile
              if (selectedQuoteId) {
                const updatedQuote = currentQuotes.find(q => q.id === selectedQuoteId) as any
                if (updatedQuote) {
                  setIsCash(updatedQuote.is_cash || false)
                  setIsCard(updatedQuote.is_card || false)
                  setSubscriptionType(updatedQuote.subscription_type || '')
                }
              }
              
              // Recalculeaza totalul
              await recalcAllSheetsTotal(currentQuotes)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [leadId, fisaId]);

  // Verifică dacă tăvițele sunt în departamente când se schimbă lista de tăvițe
  useEffect(() => {
    if (quotes.length > 0 && fisaId) {
      const trayIds = quotes.map(q => q.id)
      checkTraysInDepartments(trayIds)
    } else {
      setTraysAlreadyInDepartments(false)
    }
  }, [quotes.map(q => q.id).join(',')])

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
  function onAddSerialNumber() {
    setInstrumentForm(prev => ({
      ...prev,
      serialNumbers: [...prev.serialNumbers, '']
    }))
    setIsDirty(true)
  }

  function onRemoveSerialNumber(index: number) {
    setInstrumentForm(prev => ({
      ...prev,
      serialNumbers: prev.serialNumbers.filter((_, i) => i !== index)
    }))
    setIsDirty(true)
  }

  function onUpdateSerialNumber(index: number, value: string) {
    setInstrumentForm(prev => ({
      ...prev,
      serialNumbers: prev.serialNumbers.map((sn, i) => i === index ? value : sn)
    }))
    setIsDirty(true)
  }

  // Funcție helper pentru a popula formularul instrument cu datele salvate din items
  function populateInstrumentFormFromItems(items: LeadQuoteItem[], instrumentId: string | null) {
    if (!instrumentId) return
    
    // Găsește primul item care are brand, serial_number sau garantie pentru acest instrument
    // Cautăm în items-urile care sunt servicii și au service_id care corespunde unui serviciu cu acest instrument
    const serviceItems = items.filter(item => item.item_type === 'service' && item.service_id)
    
    // Găsește primul item care are date despre instrument (brand, serial_number sau garantie)
    const itemWithInstrumentData = serviceItems.find(item => {
      const serviceDef = services.find(s => s.id === item.service_id)
      return serviceDef?.instrument_id === instrumentId && (item.brand || item.serial_number || item.garantie)
    })
    
    if (itemWithInstrumentData) {
      // Populează formularul cu datele găsite doar dacă formularul este gol sau dacă datele diferă
      setInstrumentForm(prev => {
        // Dacă formularul are deja date și este pentru același instrument, nu le suprascriem
        if (prev.instrument === instrumentId && prev.brand) {
          return prev
        }
        
        return {
          ...prev,
          instrument: instrumentId,
          brand: itemWithInstrumentData.brand || '',
          serialNumbers: itemWithInstrumentData.serial_number ? [itemWithInstrumentData.serial_number] : [''],
          garantie: itemWithInstrumentData.garantie || false,
          qty: instrumentSettings[instrumentId]?.qty || prev.qty || '1'
        }
      })
      
      // Actualizează și instrumentSettings
      setInstrumentSettings(prev => ({
        ...prev,
        [instrumentId]: {
          qty: prev[instrumentId]?.qty || '1',
          brand: itemWithInstrumentData.brand || '',
          serialNumbers: itemWithInstrumentData.serial_number ? [itemWithInstrumentData.serial_number] : [],
          garantie: itemWithInstrumentData.garantie || false
        }
      }))
    }
  }

  // ----- Add rows -----
  function onAddService() {
    if (!selectedQuote || !svc.id) return
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
  
    const qty = Math.max(1, Number(instrumentForm.qty || svc.qty || 1))
    const discount = Math.min(100, Math.max(0, Number(svc.discount || 0)))
    
    // Obține datele instrumentului direct din instrumentForm
    const brand = (instrumentForm.brand && instrumentForm.brand.trim()) 
      ? instrumentForm.brand.trim() 
      : null
    const serialNumber = (instrumentForm.serialNumbers.length > 0 && instrumentForm.serialNumbers[0].trim()) 
      ? instrumentForm.serialNumbers[0].trim() 
      : null
    const garantie = instrumentForm.garantie || false
  
    console.log('onAddService - instrumentForm:', instrumentForm, 'svc.instrumentId:', svc.instrumentId, 'brand:', brand, 'serialNumber:', serialNumber, 'garantie:', garantie);
  
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
      qty: instrumentForm.qty || '1', 
      discount: '0', 
      urgent: false, 
      technicianId: '',
      pipelineId: '', // Resetează pipeline_id după adăugare
    }))
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
      } as unknown as LeadQuoteItem
    ])
  
    setPart({ id: '', overridePrice: '', qty: '1', discount: '0', urgent: false })
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
    setLoading(true);
    try {
      // incarca valorile cash/card si subscription pentru noua tavita
      const newQuote = quotes.find(q => q.id === newId) as any
      if (newQuote) {
        setIsCash(newQuote.is_cash || false)
        setIsCard(newQuote.is_card || false)
        const loadedSubscriptionType = newQuote.subscription_type || ''
        console.log('Schimbare tăviță - încărcare subscription_type:', {
          quoteId: newQuote.id,
          subscription_type: newQuote.subscription_type,
          loadedSubscriptionType
        })
        setSubscriptionType(loadedSubscriptionType)
      }
      setSelectedQuoteId(newId);
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
          // Populează formularul instrument cu datele salvate
          populateInstrumentFormFromItems(qi ?? [], instrumentId)
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
          // Populează formularul instrument cu datele salvate
          populateInstrumentFormFromItems(qi ?? [], instrumentId)
        }
      } else {
        // Resetează instrumentul doar dacă nu există nici servicii, nici items cu instrument
        // Și doar dacă nu există deja un instrument selectat în formular
        if (!currentInstrumentId) {
          setSvc(prev => ({ ...prev, instrumentId: '' }))
          setInstrumentForm(prev => ({ ...prev, instrument: '' }))
        }
      }
      
      // Actualizează urgentAllServices bazat pe serviciile și piesele din tăviță
      const partItems = (qi ?? []).filter((item: any) => item.item_type === 'part')
      const allServicesUrgent = serviceItems.length > 0 && serviceItems.every((item: any) => item.urgent)
      const allPartsUrgent = partItems.length > 0 && partItems.every((item: any) => item.urgent)
      const allItemsUrgent = (serviceItems.length > 0 && allServicesUrgent) || (partItems.length > 0 && allPartsUrgent)
      setUrgentAllServices(allItemsUrgent)
    } finally {
      setLoading(false);
    }
  }
  
  async function onAddSheet() {
    setLoading(true);
    try {
      // Pasează fisaId dacă este disponibil
      const created = await createQuoteForLead(leadId, undefined, fisaId || null);
      const next = [...quotes, created].sort((a, b) => a.sheet_index - b.sheet_index);
      setQuotes(next);
      setSelectedQuoteId(created.id);
      setItems([]);
      lastSavedRef.current = [];
      await recalcAllSheetsTotal(next);
    } finally {
      setLoading(false);
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

  // Filtrează serviciile disponibile: exclude serviciile deja folosite pentru instrumentul selectat
  const availableServices = useMemo(() => {
    const instrumentId = currentInstrumentId
    if (!instrumentId) return []
    
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
  }, [services, currentInstrumentId, items])

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

  // Populează formularul instrument cu datele salvate când se schimbă instrumentul sau items-urile
  useEffect(() => {
    const instrumentId = currentInstrumentId
    if (instrumentId && items.length > 0) {
      populateInstrumentFormFromItems(items, instrumentId)
    }
  }, [currentInstrumentId, items, services])

  if (loading || !selectedQuote) return <Card className="p-2">Se încarcă…</Card>;

  return (
    <Card className="p-0 space-y-4">
      <div className="flex items-center justify-between px-3 pt-3">
        <div className="flex flex-col items-start gap-2">
          <h3 className="font-medium text-sm">Fișa de serviciu</h3>
          <div className="flex gap-3 items-center">
            <Label className="text-sm text-muted-foreground">Tăviță</Label>
            <select
              className="h-9 rounded-md border px-2"
              value={selectedQuoteId ?? ''}
              onChange={e => onChangeSheet(e.target.value)}
            >
              {quotes.map((q, index) => (
                <option key={q.id} value={q.id}>{`Tăviță ${index + 1}`}</option>
              ))}
            </select>
            <Button size="sm" variant="secondary" onClick={onAddSheet}>
              <Plus className="h-4 w-4 mr-1" /> Nouă
            </Button>
            {/* Butonul "Trimite tăvițele" - doar pentru pipeline-ul Curier */}
            {isCurierPipeline && (
              <Button 
                size="sm" 
                variant="default"
                onClick={() => setShowSendConfirmation(true)}
                disabled={sendingTrays || quotes.length === 0 || traysAlreadyInDepartments}
                className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                title={traysAlreadyInDepartments ? "Tăvițele sunt deja trimise în departamente" : ""}
              >
                {sendingTrays ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Se trimit...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" /> Trimite tăvițele ({quotes.length})
                  </>
                )}
              </Button>
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
            <div className="flex items-center gap-4 ml-4">
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="urgent-all"
                  checked={urgentAllServices}
                  onCheckedChange={(c: any) => setUrgentAllServices(!!c)}
                />
                <Label htmlFor="urgent-all" className="text-xs font-medium cursor-pointer">Urgent</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <Label htmlFor="subscription" className="text-xs font-medium">Abonament</Label>
                <select
                  id="subscription"
                  className="h-7 text-xs rounded-md border px-2 bg-white dark:bg-background"
                  value={subscriptionType}
                  onChange={e => {
                    const newValue = e.target.value as 'services' | 'parts' | 'both' | ''
                    setSubscriptionType(newValue)
                    // Verifică dacă valoarea s-a schimbat față de cea salvată
                    const savedValue = selectedQuote?.subscription_type || ''
                    if (newValue !== savedValue) {
                      setIsDirty(true)
                    }
                  }}
                >
                  <option value="">—</option>
                  <option value="services">Servicii (-10%)</option>
                  <option value="parts">Piese (-5%)</option>
                  <option value="both">Ambele</option>
                </select>
              </div>
              {/* Checkbox-uri pentru livrare - Office Direct și Curier Trimis (doar în pipeline-ul Vânzări) */}
              {isVanzariPipeline && (
                <>
                  <div className="h-4 w-px bg-border mx-2" />
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="office-direct"
                      checked={officeDirect}
                      disabled={curierTrimis} // Disabled dacă Curier Trimis e bifat
                      onCheckedChange={(c: any) => {
                        const isChecked = !!c
                        setOfficeDirect(isChecked)
                        if (isChecked) {
                          setCurierTrimis(false) // Debifează Curier Trimis
                        }
                        setIsDirty(true)
                      }}
                    />
                    <Label htmlFor="office-direct" className="text-xs font-medium cursor-pointer text-blue-600">Office direct</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="curier-trimis"
                      checked={curierTrimis}
                      disabled={officeDirect} // Disabled dacă Office direct e bifat
                      onCheckedChange={(c: any) => {
                        const isChecked = !!c
                        setCurierTrimis(isChecked)
                        if (isChecked) {
                          setOfficeDirect(false) // Debifează Office direct
                        }
                        setIsDirty(true)
                      }}
                    />
                    <Label htmlFor="curier-trimis" className="text-xs font-medium cursor-pointer text-purple-600">Curier Trimis</Label>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <Button className="cursor-pointer" size="sm" onClick={saveAllAndLog} disabled={loading || saving || !isDirty}>
          {saving ? "Se salvează…" : "Salvează în Istoric"}
        </Button>
      </div>

      {/* Add Instrument - New Section */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg border border-green-200 dark:border-green-800 mx-2 p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-900 dark:text-green-100">Adaugă Instrument</span>
          </div>
        </div>
        
        <div className="grid grid-cols-12 gap-3">
          {/* Instrument - 8 cols */}
          <div className="col-span-8">
            <Label className="text-xs text-muted-foreground mb-1 block">Instrument</Label>
            <select
              className="w-full h-8 text-sm rounded-md border px-2 bg-white dark:bg-background disabled:opacity-50 disabled:cursor-not-allowed"
              value={instrumentForm.instrument}
              onChange={e => {
                const newInstrumentId = e.target.value
                // Sincronizează cu formularul de serviciu
                const savedSettings = instrumentSettings[newInstrumentId]
                const savedQty = savedSettings?.qty || '1'
                
                setInstrumentForm(prev => ({ ...prev, instrument: newInstrumentId, qty: savedQty }))
                setSvc(s => ({ 
                  ...s, 
                  instrumentId: newInstrumentId, 
                  id: '',
                  qty: savedQty
                }))
                
                // Activează butonul "Salvează în Istoric" când se selectează un instrument
                setIsDirty(true)
              }}
              disabled={hasServicesInSheet}
              title={
                hasServicesInSheet 
                  ? "Instrumentul este blocat - există deja servicii în tăviță" 
                  : "Selectează instrument"
              }
            >
              <option value="">— selectează —</option>
              {availableInstruments.map(inst => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
          </select>
          </div>

          {/* Cant - 4 cols */}
          <div className="col-span-4">
            <Label className="text-xs text-muted-foreground mb-1 block">Cant.</Label>
            <Input
              className="h-8 text-sm text-center disabled:opacity-50 disabled:cursor-not-allowed"
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
                      brand: prev[instrumentForm.instrument]?.brand || '',
                      serialNumbers: prev[instrumentForm.instrument]?.serialNumbers || [],
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
          <div className="grid grid-cols-12 gap-3 mt-3">
            {/* Brand - 2 cols */}
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Brand</Label>
            <Input
                className="h-8 text-sm"
                value={instrumentForm.brand}
                onChange={e => {
                  setInstrumentForm(prev => ({ ...prev, brand: e.target.value }))
                  setIsDirty(true)
                }}
                placeholder="Introduceți brand-ul"
              />
            </div>

            {/* Serial Numbers - 4 cols */}
            <div className="col-span-4">
              <Label className="text-xs text-muted-foreground mb-1 block">Serial Numbers</Label>
              <div className="space-y-1">
                {instrumentForm.serialNumbers.map((serialNumber, index) => (
                  <div key={index} className="flex gap-1 items-center">
                    <Input
                      className="h-7 text-sm flex-1"
                      value={serialNumber}
                      onChange={e => onUpdateSerialNumber(index, e.target.value)}
                      placeholder={`Serial ${index + 1}`}
                    />
                    {index === 0 && (
                      <Button 
                        type="button"
                        size="sm" 
                        variant="outline"
                        onClick={onAddSerialNumber}
                        className="h-7 text-xs px-2 flex-shrink-0"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Adaugă
                      </Button>
                    )}
                    {instrumentForm.serialNumbers.length > 1 && index > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onRemoveSerialNumber(index)}
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Garantie - 2 cols */}
            <div className="col-span-2 flex flex-col justify-end">
              <div className="flex items-center gap-1 h-8">
                <Checkbox
                  id="instrument-garantie"
                  checked={instrumentForm.garantie}
                  onCheckedChange={(c: any) => {
                    setInstrumentForm(prev => ({ ...prev, garantie: !!c }))
                    setIsDirty(true)
                  }}
                />
                <Label htmlFor="instrument-garantie" className="text-xs cursor-pointer">Garantie</Label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Service - Redesigned */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg border border-blue-200 dark:border-blue-800 mx-2 p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Adaugă Serviciu</span>
          </div>
          <Button size="sm" onClick={onAddService} disabled={!svc.id} className="h-7">
            <Plus className="h-3 w-3 mr-1" /> Adaugă
          </Button>
        </div>
        
        <div className="grid grid-cols-12 gap-3">
          {/* Serviciu - 8 cols */}
          <div className="col-span-8">
            <Label className="text-xs text-muted-foreground mb-1 block">Serviciu</Label>
            <select
              className="w-full h-8 text-sm rounded-md border px-2 bg-white dark:bg-background"
              value={svc.id}
              onChange={e => {
                const serviceId = e.target.value
                setSvc(s => ({ 
                  ...s, 
                  id: serviceId
                }))
              }}
              disabled={!currentInstrumentId}
            >
              <option value="">— selectează —</option>
              {availableServices.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.price.toFixed(2)} RON
                </option>
              ))}
            </select>
          </div>

          {/* Disc - 2 cols */}
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground mb-1 block">Disc%</Label>
          <Input
              className="h-8 text-sm text-center"
            inputMode="decimal"
            value={svc.discount}
            onChange={e => setSvc(s => ({ ...s, discount: e.target.value }))}
            placeholder="0"
          />
        </div>
        </div>
      </div>

      {/* Add Part - Redesigned (doar pentru pipeline-ul Reparații) */}
      {isReparatiiPipeline && (
        <form onSubmit={onAddPart} className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border border-amber-200 dark:border-amber-800 mx-2 p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-900 dark:text-amber-100">Adaugă Piesă</span>
          </div>
          <Button type="submit" size="sm" className="h-7" disabled={!part.id}>
            <Plus className="h-3 w-3 mr-1" /> Adaugă
          </Button>
      </div>

        <div className="grid grid-cols-12 gap-3">
          {/* Piesă - 5 cols */}
          <div className="col-span-5">
            <Label className="text-xs text-muted-foreground mb-1 block">Piesă</Label>
        <select
              className="w-full h-8 text-sm rounded-md border px-2 bg-white dark:bg-background"
          value={part.id}
          onChange={e => setPart(p => ({ ...p, id: e.target.value, overridePrice: '' }))}
        >
              <option value="">— selectează —</option>
          {parts.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.price.toFixed(2)} RON
            </option>
          ))}
        </select>
      </div>
          
          {/* Preț - 2 cols */}
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground mb-1 block">Preț</Label>
          <Input
              className="h-8 text-sm"
            inputMode="decimal"
            value={part.overridePrice}
            onChange={e => setPart(p => ({ ...p, overridePrice: e.target.value }))}
              placeholder="catalog"
          />
        </div>

          {/* Cant - 1 col */}
          <div className="col-span-1">
            <Label className="text-xs text-muted-foreground mb-1 block">Cant.</Label>
          <Input
              className="h-8 text-sm text-center"
            inputMode="numeric"
            value={part.qty}
            onChange={e => setPart(p => ({ ...p, qty: e.target.value }))}
            placeholder="1"
          />
        </div>

          {/* Disc - 2 cols */}
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground mb-1 block">Disc%</Label>
          <Input
              className="h-8 text-sm text-center"
            inputMode="decimal"
            value={part.discount}
            onChange={e => setPart(p => ({ ...p, discount: e.target.value }))}
            placeholder="0"
          />
        </div>
        </div>
      </form>
      )}

      {/* Items Table */}
      <Card className="p-0 mx-2 overflow-hidden">
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-24 text-xs font-semibold">Instrument</TableHead>
              <TableHead className="text-xs font-semibold">Serviciu</TableHead>
              <TableHead className="text-xs font-semibold">Piesă</TableHead>
              <TableHead className="w-16 text-xs font-semibold text-center">Cant.</TableHead>
              <TableHead className="w-24 text-xs font-semibold text-center">Preț</TableHead>
              <TableHead className="w-16 text-xs font-semibold text-center">Disc%</TableHead>
              <TableHead className="w-16 text-xs font-semibold text-center">Urgent</TableHead>
              <TableHead className="w-28 text-xs font-semibold">Departament</TableHead>
              <TableHead className="w-28 text-xs font-semibold">Tehnician</TableHead>
              <TableHead className="w-24 text-xs font-semibold text-right">Total</TableHead>
              <TableHead className="w-10"></TableHead>
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
                  <TableCell className="text-xs text-muted-foreground py-2">
                    {itemInstrument}
                  </TableCell>
                  <TableCell className="font-medium text-sm py-2">
                    {serviceName}
                  </TableCell>
                  <TableCell className="text-sm py-2">
                    {it.item_type === 'part' ? (
                      <Input
                        className="h-7 text-sm"
                        value={it.name_snapshot}
                        onChange={e => onUpdateItem(it.id, { name_snapshot: e.target.value })}
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="py-2">
                    <Input
                      className="h-7 text-sm text-center w-14 disabled:opacity-50 disabled:cursor-not-allowed"
                      inputMode="numeric"
                      value={String(it.qty)}
                      onChange={e => {
                        const v = Math.max(1, Number(e.target.value || 1));
                        onUpdateItem(it.id, { qty: v });
                      }}
                      disabled={it.item_type === 'service'}
                      title={it.item_type === 'service' ? "Cantitatea este blocată pentru servicii" : "Introduceți cantitatea"}
                    />
                  </TableCell>

                  <TableCell className="py-2 text-center">
                    {it.item_type === 'service' ? (
                      <span className="text-sm">{it.price.toFixed(2)}</span>
                    ) : (
                      <Input
                        className="h-7 text-sm text-center w-20"
                        inputMode="decimal"
                        value={String(it.price)}
                        onChange={e => {
                          const v = Math.max(0, Number(e.target.value || 0));
                          onUpdateItem(it.id, { price: v });
                        }}
                      />
                    )}
                  </TableCell>

                  <TableCell className="py-2">
                    <Input
                      className="h-7 text-sm text-center w-12"
                      inputMode="decimal"
                      value={String(it.discount_pct)}
                      onChange={e => {
                        const v = Math.min(100, Math.max(0, Number(e.target.value || 0)));
                        onUpdateItem(it.id, { discount_pct: v });
                      }}
                    />
                  </TableCell>

                  <TableCell className="py-2 text-center">
                      <Checkbox
                        checked={!!it.urgent}
                        onCheckedChange={(c: any) => onUpdateItem(it.id, { urgent: !!c })}
                      />
                  </TableCell>

                  <TableCell className="py-2">
                    <span className="text-xs text-muted-foreground">
                      {it.pipeline_id 
                        ? pipelinesWithIds.find(p => p.id === it.pipeline_id)?.name || '—'
                        : '—'
                      }
                    </span>
                  </TableCell>

                  <TableCell className="py-2">
                      <select
                      className="w-full h-7 text-xs rounded border px-1 bg-white dark:bg-background"
                      value={it.technician_id ?? ''}
                        onChange={e => {
                        onUpdateItem(it.id, { technician_id: e.target.value || null })
                        }}
                      >
                        <option value="">—</option>
                        {technicians.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                  </TableCell>

                  <TableCell className="text-right font-medium text-sm py-2">{lineTotal.toFixed(2)}</TableCell>

                  <TableCell className="py-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(it.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}

            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-muted-foreground text-center py-6 text-sm">
                  Nu există poziții încă.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Totals */}
      <div className="flex justify-end px-2">
        <div className="w-full md:w-[320px] space-y-1 text-sm bg-muted/20 rounded-lg p-3">
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
      {lead && <PrintViewData 
        lead={lead}
        quotes={quotes}
        allSheetsTotal={allSheetsTotal}
        urgentMarkupPct={URGENT_MARKUP_PCT}
        subscriptionType={subscriptionType}
        services={services}
        instruments={instruments}
        pipelinesWithIds={pipelinesWithIds}
      />}
      </div>
    </Card>
  );
}
