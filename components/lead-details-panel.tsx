"use client"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Textarea } from "@/components/ui/textarea"
import { format } from "date-fns"
import type { Lead } from "@/app/(crm)/dashboard/page" 
import Preturi, { type PreturiRef } from '@/components/preturi';
import LeadHistory from "@/components/lead-history"
import { PrintView } from '@/components/print-view'
import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { debounce } from "@/lib/utils"
import LeadMessenger from "@/components/lead-messenger"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"
import { ChevronsUpDown, Printer, Mail, Phone, Copy, Check, Loader2, FileText, History, MessageSquare, X as XIcon, ChevronDown, ChevronRight, User, Building, Info, MapPin, CheckCircle, Clock, Wrench, Package } from "lucide-react"
import { listTags, toggleLeadTag, type Tag, type TagColor } from "@/lib/supabase/tagOperations"
import { supabaseBrowser } from "@/lib/supabase/supabaseClient"
import { useRole, useAuth } from "@/lib/contexts/AuthContext"
import { 
  listServiceFilesForLead, 
  createServiceFile, 
  listTraysForServiceFile,
  listTrayItemsForTray,
  getNextGlobalServiceFileNumber,
  type ServiceFile,
  type TrayItem,
  type Tray
} from "@/lib/supabase/serviceFileOperations"
import { moveItemToStage } from "@/lib/supabase/pipelineOperations"
import { logItemEvent } from "@/lib/supabase/leadOperations"

// Tipuri pentru UI (alias-uri pentru claritate)
type ServiceSheet = ServiceFile & { fisa_index?: number }
type LeadQuote = Tray
type LeadQuoteItem = TrayItem

// Funcții wrapper pentru transformarea datelor
const listServiceSheetsForLead = async (leadId: string): Promise<ServiceSheet[]> => {
  const { data, error } = await listServiceFilesForLead(leadId)
  if (error) {
    console.error('Error loading service files:', error)
    return []
  }
  // Transformă ServiceFile în ServiceSheet (adaugă fisa_index)
  return (data || []).map((sf, index) => ({
    ...sf,
    fisa_index: index + 1,
    id: sf.id,
  })) as ServiceSheet[]
}

const createServiceSheet = async (leadId: string, name?: string): Promise<string> => {
  // Generează un număr global pentru fișă (nu local pentru lead)
  const { data: nextGlobalNumber, error: numberError } = await getNextGlobalServiceFileNumber()
  
  if (numberError || nextGlobalNumber === null) {
    console.error('Error getting next global service file number:', numberError)
    throw numberError || new Error('Failed to get next global service file number')
  }
  
  const serviceFileData = {
    lead_id: leadId,
    number: name || `Fisa ${nextGlobalNumber}`,
    date: new Date().toISOString().split('T')[0],
    status: 'noua' as const,
    notes: null,
  }
  
  const { data, error } = await createServiceFile(serviceFileData)
  if (error || !data) {
    console.error('Error creating service file:', error)
    throw error || new Error('Failed to create service file')
  }
  
  return data.id // Returnează fisa_id
}

const listTraysForServiceSheet = async (fisaId: string) => {
  const { data, error } = await listTraysForServiceFile(fisaId)
  if (error) {
    console.error('Error loading trays:', error)
    return []
  }
  return (data || []) as any[]
}

const listQuotesForLead = async (leadId: string) => {
  // Trebuie să obținem toate fișele și apoi toate tăvițele
  const serviceSheets = await listServiceSheetsForLead(leadId)
  const allTrays: any[] = []
  
  for (const sheet of serviceSheets) {
    const trays = await listTraysForServiceSheet(sheet.id)
    allTrays.push(...trays)
  }
  
  return allTrays
}

// Funcție simplificată - încarcă items cu servicii din array
const listQuoteItems = async (
  trayId: string, 
  services?: any[], 
  instrumentPipelineMap?: Map<string, string | null>,
  pipelineMap?: Map<string, string>,
  instrumentsMap?: Map<string, { id: string; name: string }>
): Promise<any[]> => {
  const supabaseClient = supabaseBrowser()
  
  // Query simplu fără join-uri (pentru a evita probleme RLS)
  const { data, error } = await supabaseClient
    .from('tray_items')
    .select(`
      id,
      tray_id,
      instrument_id,
      service_id,
      part_id,
      department_id,
      technician_id,
      qty,
      notes,
      created_at,
      tray_item_brands(id, brand, garantie, tray_item_brand_serials(id, serial_number))
    `)
    .eq('tray_id', trayId)
    .order('created_at')

  if (error) {
    console.error('[listQuoteItems] Error:', error)
    return []
  }

  // Procesează fiecare item - folosește services array pentru a găsi numele
  return (data || []).map((item: any) => {
    // Parsează notes
    let notesData: any = {}
    if (item.notes) {
      try {
        notesData = JSON.parse(item.notes)
      } catch (e) {}
    }
    
    // Determină item_type
    let item_type: 'service' | 'part' | null = notesData.item_type || null
    if (!item_type) {
      if (item.service_id) {
        item_type = 'service'
        console.log('[listQuoteItems] Item type inferred as service from service_id:', item.service_id)
      } else if (item.part_id) {
        item_type = 'part'
        console.log('[listQuoteItems] Item type inferred as part from part_id:', item.part_id)
      } else if (notesData.name) {
        item_type = 'part'
        console.log('[listQuoteItems] Item type inferred as part from notesData.name:', notesData.name)
      }
    }
    
    // Găsește serviciul în array-ul services
    let serviceName = ''
    let servicePrice = 0
    if (item.service_id && services && services.length > 0) {
      const foundService = services.find((s: any) => s.id === item.service_id)
      if (foundService) {
        serviceName = foundService.name || ''
        servicePrice = foundService.price || 0
      } else {
        console.warn('[listQuoteItems] Service not found for service_id:', item.service_id)
      }
    }
    
    // Obține numele - prioritate: service din array > notes
    let displayName = ''
    let price = notesData.price || 0
    
    if (serviceName) {
      displayName = serviceName
      price = servicePrice || price
    } else if (notesData.name) {
      displayName = notesData.name
    }
    
    // Obține numele instrumentului din map
    let instrumentName: string | null = null
    if (item.instrument_id && instrumentsMap) {
      const instr = instrumentsMap.get(item.instrument_id)
      instrumentName = instr?.name || null
    }
    
    // Obține departamentul
    let department: string | null = null
    if (item.instrument_id && instrumentPipelineMap && pipelineMap) {
      const pipelineId = instrumentPipelineMap.get(item.instrument_id)
      if (pipelineId) {
        department = pipelineMap.get(pipelineId) || null
      }
    }

    return {
      id: item.id,
      tray_id: item.tray_id,
      instrument_id: item.instrument_id,
      service_id: item.service_id,
      part_id: item.part_id,
      department_id: item.department_id,
      technician_id: item.technician_id,
      qty: item.qty || 1,
      notes: item.notes,
      created_at: item.created_at,
      // Câmpuri calculate
      item_type,
      name_snapshot: displayName,
      price: price || 0,
      discount_pct: notesData.discount_pct || 0,
      urgent: notesData.urgent || false,
      // Folosește brand și serial_number din câmpurile directe (pentru compatibilitate)
      // sau din primul brand din tray_item_brands dacă există
      brand: item.brand || (item.tray_item_brands && item.tray_item_brands.length > 0 
        ? item.tray_item_brands[0].brand 
        : null) || notesData.brand || null,
      serial_number: item.serial_number || (item.tray_item_brands && item.tray_item_brands.length > 0 
        && item.tray_item_brands[0].tray_item_brand_serials?.length > 0
        ? item.tray_item_brands[0].tray_item_brand_serials[0].serial_number 
        : null) || notesData.serial_number || null,
      garantie: (item.tray_item_brands && item.tray_item_brands.length > 0 
        ? item.tray_item_brands[0].garantie 
        : false) || notesData.garantie || false,
      // Include toate brand-urile cu serial numbers pentru afișare (noua structură)
      brand_groups: (item.tray_item_brands || []).map((b: any) => ({
        id: b.id,
        brand: b.brand,
        garantie: b.garantie,
        serialNumbers: (b.tray_item_brand_serials || []).map((s: any) => s.serial_number)
      })),
      department,
      instrument_name: instrumentName,
    }
  })
}
type Technician = {
  id: string // user_id din app_members
  name: string
}
import { listServices } from "@/lib/supabase/serviceOperations"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type Maybe<T> = T | null

interface LeadDetailsPanelProps {
  lead: Maybe<Lead>
  onClose: () => void
  onStageChange: (leadId: string, newStage: string) => void
  stages: string[]
  pipelines: string[]
  pipelineSlug?: string
  onMoveToPipeline?: (leadId: string, targetName: string) => Promise<void>
  pipelineOptions?: { name: string; activeStages: number }[]
  onTagsChange?: (leadId: string, tags: Tag[]) => void
  onBulkMoveToPipelines?: (leadId: string, pipelineNames: string[]) => Promise<void>
}

export function LeadDetailsPanel({
  lead,
  onClose,
  onStageChange,
  onTagsChange,
  onMoveToPipeline,
  onBulkMoveToPipelines,
  pipelines,
  stages,
  pipelineSlug,
}: LeadDetailsPanelProps) {
  const supabase = supabaseBrowser()
  if (!lead) return null

  // verifica daca suntem in unul dintre pipeline-urile care arata checkbox-urile
  const showActionCheckboxes = useMemo(() => {
    if (!pipelineSlug) return false
    const slug = pipelineSlug.toLowerCase()
    return slug.includes('receptie') || slug.includes('vanzari') || slug.includes('curier')
  }, [pipelineSlug])

  // verifica daca suntem in pipeline-ul Curier
  const isCurierPipeline = useMemo(() => {
    if (!pipelineSlug) return false
    return pipelineSlug.toLowerCase().includes('curier')
  }, [pipelineSlug])

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

  const isReceptiePipeline = useMemo(() => {
    if (!pipelineSlug) return false
    return pipelineSlug.toLowerCase().includes('receptie') || pipelineSlug.toLowerCase().includes('reception')
  }, [pipelineSlug])

  // Verifică dacă suntem într-un pipeline departament (Saloane, Frizerii, Horeca, Reparatii)
  const isDepartmentPipeline = useMemo(() => {
    if (!pipelineSlug) return false
    const slug = pipelineSlug.toLowerCase()
    return slug.includes('saloane') || 
           slug.includes('frizerii') || 
           slug.includes('horeca') || 
           slug.includes('reparatii')
  }, [pipelineSlug])

  // Verifică dacă suntem în pipeline Saloane/Frizerii/Horeca (nu Reparatii)
  const isSaloaneHorecaFrizeriiPipeline = useMemo(() => {
    if (!pipelineSlug) return false
    const slug = pipelineSlug.toLowerCase()
    return slug.includes('saloane') || 
           slug.includes('frizerii') || 
           slug.includes('horeca')
  }, [pipelineSlug])

  // Obține rolul utilizatorului curent
  const { role, loading: roleLoading } = useRole()
  const { user } = useAuth()
  const [isTechnician, setIsTechnician] = useState(false)
  
  // Ref pentru componenta Preturi - pentru a apela salvarea la Close
  const preturiRef = useRef<PreturiRef>(null)
  
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

  // Verifică dacă utilizatorul poate muta în pipeline (doar owner și admin)
  const canMovePipeline = role === 'owner' || role === 'admin'

  const [section, setSection] = useState<"fisa" | "istoric">("fisa")
  const [stage, setStage] = useState(lead.stage)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  
  // State pentru fișe de serviciu
  const [serviceSheets, setServiceSheets] = useState<ServiceSheet[]>([])
  const [selectedFisaId, setSelectedFisaId] = useState<string | null>(null)
  const [loadingSheets, setLoadingSheets] = useState(false)
  
  // State pentru tăvițe în pipeline-urile departament
  const [allTrays, setAllTrays] = useState<Array<{ id: string; number: string; size: string; service_file_id: string }>>([])
  const [selectedTrayId, setSelectedTrayId] = useState<string | null>(null)
  const [loadingTrays, setLoadingTrays] = useState(false)
  
  // State pentru modalul de detalii fișă
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [traysDetails, setTraysDetails] = useState<Array<{
    tray: LeadQuote
    items: LeadQuoteItem[]
    subtotal: number
    discount: number
    urgent: number
    subscriptionDiscount: number
    subscriptionDiscountServices: number
    subscriptionDiscountParts: number
    subscriptionType: string | null
    total: number
  }>>([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [totalFisaSum, setTotalFisaSum] = useState<number | null>(null)
  const [loadingTotalSum, setLoadingTotalSum] = useState(false)

  // memoizeaza functiile ca sa nu le recreez la fiecare render
  const tagClass = useCallback((c: TagColor) =>
    c === "green" ? "bg-emerald-100 text-emerald-800"
    : c === "yellow" ? "bg-amber-100  text-amber-800"
    : c === "orange" ? "bg-orange-100 text-orange-800"
    : c === "blue" ? "bg-blue-100 text-blue-800"
    :                  "bg-rose-100   text-rose-800"
  , [])

  const isDepartmentTag = useCallback((tagName: string) => {
    const departmentTags = ['Horeca', 'Saloane', 'Frizerii', 'Reparatii']
    return departmentTags.includes(tagName)
  }, [])

  const getDepartmentBadgeStyle = useCallback((tagName: string) => {
    const styles: Record<string, string> = {
      'Horeca': 'bg-gradient-to-r from-orange-500 to-orange-600 border-orange-300',
      'Saloane': 'bg-gradient-to-r from-emerald-500 to-emerald-600 border-emerald-300',
      'Frizerii': 'bg-gradient-to-r from-amber-500 to-amber-600 border-amber-300',
      'Reparatii': 'bg-gradient-to-r from-blue-500 to-blue-600 border-blue-300',
    }
    return styles[tagName] || 'bg-gradient-to-r from-gray-500 to-gray-600 border-gray-300'
  }, [])

  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

  const [selectedPipes, setSelectedPipes] = useState<string[]>([])
  const [movingPipes, setMovingPipes] = useState(false)
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>('')
  const [passingTray, setPassingTray] = useState(false)

  // State pentru checkbox-uri generale
  const [callBack, setCallBack] = useState(false)
  const [nuRaspunde, setNuRaspunde] = useState(false)
  const [noDeal, setNoDeal] = useState(false)

  // State pentru checkbox-uri Curier
  const [curierTrimis, setCurierTrimis] = useState(false)
  const [coletAjuns, setColetAjuns] = useState(false)
  const [curierRetur, setCurierRetur] = useState(false)
  const [coletTrimis, setColetTrimis] = useState(false)
  const [asteptRidicarea, setAsteptRidicarea] = useState(false)
  const [ridicPersonal, setRidicPersonal] = useState(false)

  // State pentru collapsible sections
  const [isContactOpen, setIsContactOpen] = useState(true)
  const [isTrayInfoOpen, setIsTrayInfoOpen] = useState(true)
  const [isMessengerOpen, setIsMessengerOpen] = useState(false)
  
  // State pentru informații tavita - per tăviță
  const [selectedTrayForDetails, setSelectedTrayForDetails] = useState<string>('')
  const [trayDetailsMap, setTrayDetailsMap] = useState<Map<string, string>>(new Map())
  const [trayDetails, setTrayDetails] = useState<string>('')
  const [savingTrayDetails, setSavingTrayDetails] = useState(false)
  const [loadingTrayDetails, setLoadingTrayDetails] = useState(false)

  const allPipeNames = pipelines ?? []

  // Helper pentru a obține leadId corect 
  // Pentru service_files și quotes/trays, folosim leadId din relație
  // Pentru leads normale, folosim id
  const getLeadId = useCallback(() => {
    const leadAny = lead as any
    // Verifică dacă este service_file sau tray (au leadId din relație)
    if (leadAny?.type === 'service_file' || leadAny?.type === 'tray') {
      return leadAny.leadId || lead.id
    }
    // Pentru tray items (isQuote indică că este un tray)
    if (leadAny?.isQuote && leadAny?.leadId) {
      return leadAny.leadId
    }
    return lead.id
  }, [lead])
  
  // Helper pentru a obține fisaId-ul corect pentru service_files
  // Acum detaliile sunt stocate la nivel de service_file, nu la nivel de tray
  const getServiceFileId = useCallback(async () => {
    const leadAny = lead as any
    if (leadAny?.type === 'service_file') {
      return lead.id // Pentru service_file, id-ul cardului este fisaId
    }
    // Dacă este tray, obținem service_file_id din tray
    if (leadAny?.type === 'tray' || leadAny?.isQuote) {
      const trayId = leadAny?.type === 'tray' ? lead.id : (leadAny?.quoteId || leadAny?.id)
      if (trayId) {
        const { data: tray } = await supabase
          .from('trays')
          .select('service_file_id')
          .eq('id', trayId)
          .single()
        return tray?.service_file_id || null
      }
    }
    // Dacă este lead, folosim prima fișă de serviciu
    const leadId = getLeadId()
    if (leadId) {
      const sheets = await listServiceSheetsForLead(leadId)
      return sheets.length > 0 ? sheets[0].id : null
    }
    return null
  }, [lead, getLeadId])
  
  // Helper pentru a obține trayId-ul corect pentru trays
  const getTrayId = useCallback(() => {
    const leadAny = lead as any
    if (leadAny?.type === 'tray') {
      return lead.id // Pentru tray, id-ul cardului este trayId
    }
    return null
  }, [lead])
  
  // Funcție pentru salvarea detaliilor
  const saveServiceFileDetails = useCallback(async (details: string) => {
    try {
      const serviceFileId = await getServiceFileId()
      if (!serviceFileId) {
        console.warn('Cannot save details: service file not found')
        return
      }
      
      const { error } = await supabase
        .from('service_files')
        .update({ details } as any)
        .eq('id', serviceFileId)
      
      if (error) {
        console.error('Error saving service file details:', error)
        toast.error('Eroare la salvarea automată: ' + error.message)
      } else {
        console.log('Details auto-saved successfully')
      }
    } catch (err: any) {
      console.error('Error saving details:', err)
    }
  }, [getServiceFileId])

  // Funcție debounced pentru auto-save
  const debouncedSaveDetails = useMemo(
    () => debounce((details: string) => {
      saveServiceFileDetails(details)
    }, 1000), // 1 secundă delay
    [saveServiceFileDetails]
  )

  // Handler pentru Close care salvează înainte de a închide
  const handleCloseWithSave = useCallback(async () => {
    try {
      // Salvează detaliile înainte de a închide
      const serviceFileId = await getServiceFileId()
      if (serviceFileId && trayDetails !== undefined) {
        await saveServiceFileDetails(trayDetails)
      }
      
      // Salvează în istoric înainte de a închide
      if (preturiRef.current) {
        await preturiRef.current.save()
      }
    } catch (error) {
      console.error('Eroare la salvare automată:', error)
    }
    // Închide panoul
    onClose()
  }, [onClose, trayDetails, saveServiceFileDetails, getServiceFileId])

  // Încarcă detaliile pentru fișa de serviciu (nu mai la nivel de lead)
  // Această funcție este folosită pentru pipeline-urile Vânzări/Recepție/Curier
  useEffect(() => {
    const loadServiceFileDetails = async () => {
      const serviceFileId = await getServiceFileId()
      if (!serviceFileId) {
        setTrayDetails('')
        return
      }

      try {
        const { data, error } = await supabase
          .from('service_files')
          .select('details')
          .eq('id', serviceFileId)
          .single()

        if (!error && data) {
          setTrayDetails((data as any)?.details || '')
        } else {
          setTrayDetails('')
        }
      } catch (err) {
        console.error('Error loading service file details:', err)
        setTrayDetails('')
      }
    }

    // Încarcă detaliile pentru toate pipeline-urile (nu doar pentru departamente)
    loadServiceFileDetails()
  }, [lead.id, getServiceFileId, supabase])

  const togglePipe = (name: string) =>
    setSelectedPipes(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name])

  const pickAll = () => setSelectedPipes(allPipeNames)
  const clearAll = () => setSelectedPipes([])

  useEffect(() => {
    const ch = supabase
      .channel('rt-tags-lead-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' },
        () => listTags().then(setAllTags).catch(console.error)
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { listTags().then(setAllTags).catch(console.error) }, [])

  useEffect(() => {
    if (!lead) return
    setSelectedTagIds((lead.tags ?? []).map(t => t.id))
  }, [lead?.id])

  useEffect(() => {
    setStage(lead.stage)
    
    // Setează starea checkbox-urilor pe baza stage-ului curent (doar în Vânzări)
    if (isVanzariPipeline) {
      const currentStage = lead.stage?.toUpperCase() || ''
      
      // Verifică dacă stage-ul curent corespunde unuia dintre checkbox-uri
      if (currentStage.includes('NO DEAL') || currentStage.includes('NO-DEAL')) {
        setNoDeal(true)
        setCallBack(false)
        setNuRaspunde(false)
      } else if (currentStage.includes('CALLBACK') || currentStage.includes('CALL BACK') || currentStage.includes('CALL-BACK')) {
        setNoDeal(false)
        setCallBack(true)
        setNuRaspunde(false)
      } else if (currentStage.includes('RASPUNDE') || currentStage.includes('RASUNDE')) {
        setNoDeal(false)
        setCallBack(false)
        setNuRaspunde(true)
      } else {
        // Dacă stage-ul nu corespunde niciunui checkbox, dezactivează toate
        setNoDeal(false)
        setCallBack(false)
        setNuRaspunde(false)
      }
    }
  }, [getLeadId(), lead.stage, isVanzariPipeline])

  // Funcție helper pentru încărcarea fișelor (folosită atât la inițializare cât și după creare)
  const loadServiceSheets = useCallback(async (leadId: string) => {
    try {
      // Folosește direct listServiceSheetsForLead care returnează fișele
      const sheets = await listServiceSheetsForLead(leadId)
      console.log('Loaded service sheets:', sheets)
      return sheets
    } catch (error) {
      console.error('Error loading service sheets:', error)
      throw error
    }
  }, [])

  // Încarcă fișele de serviciu pentru lead
  useEffect(() => {
    // Pentru quotes, folosim leadId în loc de id
    const leadIdToUse = getLeadId()
    if (!leadIdToUse) return
    
    const loadData = async () => {
      setLoadingSheets(true)
      try {
        const sheets = await loadServiceSheets(leadIdToUse)
        setServiceSheets(sheets)
        
        // Dacă este un service_file (vine din pipeline Curier), selectează fișa direct
        const serviceFileId = await getServiceFileId()
        const trayId = getTrayId()
        
        if (serviceFileId) {
          // Cardului service_file - selectează fișa corespunzătoare
          const fisaFromCard = sheets.find(s => s.id === serviceFileId)
          if (fisaFromCard) {
            setSelectedFisaId(fisaFromCard.id)
          } else if (sheets.length > 0) {
            setSelectedFisaId(sheets[0].id)
          }
        } else if (trayId) {
          // Dacă este un tray (vine din pipeline departament), găsește fișa care conține tăvița
          // Caută în toate fișele pentru a găsi tăvița
          for (const sheet of sheets) {
            const trays = await listTraysForServiceSheet(sheet.id)
            const foundTray = trays.find((t: any) => t.id === trayId)
            if (foundTray) {
              setSelectedFisaId(sheet.id)
              break
            }
          }
          // Dacă nu s-a găsit, selectează prima fișă
          if (!selectedFisaId && sheets.length > 0) {
            setSelectedFisaId(sheets[0].id)
          }
        } else if ((lead as any)?.isQuote && (lead as any)?.quoteId) {
          // Dacă este un tray, găsește fișa care conține tăvița
          const quoteId = (lead as any).quoteId
          const allQuotes = await listQuotesForLead(leadIdToUse)
          const quote = allQuotes.find(q => q.id === quoteId)
          if (quote?.fisa_id) {
            const fisaWithQuote = sheets.find(s => s.id === quote.fisa_id)
            if (fisaWithQuote) {
              setSelectedFisaId(fisaWithQuote.id)
            } else if (sheets.length > 0) {
              setSelectedFisaId(sheets[0].id)
            }
          } else if (sheets.length > 0) {
            setSelectedFisaId(sheets[0].id)
          }
        } else {
          // Selectează prima fișă dacă există și nu avem deja una selectată
          if (sheets.length > 0 && !selectedFisaId) {
            setSelectedFisaId(sheets[0].id)
          }
        }
      } catch (error) {
        console.error('Error loading service sheets:', error)
        toast.error('Eroare la încărcarea fișelor')
      } finally {
        setLoadingSheets(false)
      }
    }
    
    loadData()
  }, [getLeadId, getServiceFileId, getTrayId, (lead as any)?.isQuote, (lead as any)?.quoteId, (lead as any)?.type, loadServiceSheets, selectedFisaId])

  // Încarcă toate tăvițele pentru lead în pipeline-urile departament
  useEffect(() => {
    if (!isDepartmentPipeline) return
    
    const leadIdToUse = getLeadId()
    if (!leadIdToUse) return
    
    const loadTrays = async () => {
      setLoadingTrays(true)
      try {
        // Încarcă toate service_files pentru lead
        const sheets = await loadServiceSheets(leadIdToUse)
        
        // Încarcă toate tăvițele din toate service_files
        const allTraysList: Array<{ id: string; number: string; size: string; service_file_id: string }> = []
        for (const sheet of sheets) {
          const trays = await listTraysForServiceSheet(sheet.id)
          allTraysList.push(...trays.map((t: any) => ({
            id: t.id,
            number: t.number,
            size: t.size,
            service_file_id: sheet.id
          })))
        }
        
        setAllTrays(allTraysList)
        
        // Dacă este un tray (vine din pipeline departament), selectează-l direct
        const trayId = getTrayId()
        if (trayId) {
          const foundTray = allTraysList.find(t => t.id === trayId)
          if (foundTray) {
            setSelectedTrayId(trayId)
            // Setează și service_file_id pentru Preturi
            setSelectedFisaId(foundTray.service_file_id)
          } else if (allTraysList.length > 0) {
            // Selectează prima tăviță
            setSelectedTrayId(allTraysList[0].id)
            setSelectedFisaId(allTraysList[0].service_file_id)
          }
        } else if (allTraysList.length > 0 && !selectedTrayId) {
          // Selectează prima tăviță dacă nu avem deja una selectată
          setSelectedTrayId(allTraysList[0].id)
          setSelectedFisaId(allTraysList[0].service_file_id)
        }
      } catch (error) {
        console.error('Error loading trays:', error)
        toast.error('Eroare la încărcarea tăvițelor')
      } finally {
        setLoadingTrays(false)
      }
    }
    
    loadTrays()
  }, [isDepartmentPipeline, getLeadId, getTrayId, loadServiceSheets, selectedTrayId])

  // Încarcă detaliile pentru fișa de serviciu (nu mai per tăviță)
  useEffect(() => {
    const loadServiceFileDetails = async () => {
      setLoadingTrayDetails(true)
      try {
        const serviceFileId = await getServiceFileId()
        if (!serviceFileId) {
          setTrayDetails('')
          return
        }
        
        const supabaseClient = supabaseBrowser()
        // Citim detaliile din service_files.details
        const { data: serviceFile, error } = await supabaseClient
          .from('service_files')
          .select('details')
          .eq('id', serviceFileId)
          .single()
        
        if (error) {
          console.error('Error loading service file details:', error)
          setTrayDetails('')
          return
        }
        
        setTrayDetails(serviceFile?.details || '')
      } catch (err) {
        console.error('Error loading service file details:', err)
        setTrayDetails('')
      } finally {
        setLoadingTrayDetails(false)
      }
    }
    
    loadServiceFileDetails()
  }, [getServiceFileId])

  // Încarcă tehnicienii
  useEffect(() => {
    const loadTechnicians = async () => {
      try {
        // Obține membrii din app_members pentru tehnicieni (folosim câmpul name)
        const supabaseClient = supabaseBrowser()
        const { data: membersData, error } = await supabaseClient
          .from('app_members')
          .select('user_id, name')
          .order('created_at', { ascending: true })
        
        if (error) {
          console.error('Error loading app_members:', error)
          setTechnicians([])
          return
        }
        
        if (!membersData || membersData.length === 0) {
          setTechnicians([])
          return
        }
        
        // Transformă membrii în tehnicieni folosind câmpul name
        const techs: Technician[] = (membersData || []).map((m: any) => {
          // Folosește câmpul name, cu fallback la user_id
          let name = m.name || m.Name || null
          if (!name && m.user_id) {
            name = `User ${m.user_id.slice(0, 8)}`
          }
          if (!name) {
            name = 'Necunoscut'
          }
          
          return {
            id: m.user_id,
            name: name
          }
        })
        
        // Sortează după nume
        techs.sort((a, b) => a.name.localeCompare(b.name))
        setTechnicians(techs)
      } catch (error) {
        console.error('Error loading technicians:', error)
      }
    }
    loadTechnicians()
  }, [])

  async function handleToggleTag(tagId: string) {
    if (!lead) return

    // Previne eliminarea tag-urilor de departament
    const tag = allTags.find(t => t.id === tagId)
    if (tag && isDepartmentTag(tag.name)) {
      // Tag-urile de departament nu pot fi eliminate manual
      return
    }
  
    // 1) server change
    await toggleLeadTag(lead.id, tagId)
  
    // 2) compute next selection based on current state
    const nextIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter(id => id !== tagId)
      : [...selectedTagIds, tagId]
  
    // 3) local update
    setSelectedTagIds(nextIds)
  
    // 4) notify parent AFTER local setState (outside render)
    const nextTags = allTags.filter(t => nextIds.includes(t.id))
    onTagsChange?.(lead.id, nextTags)
  }
  
  const handleStageChange = (newStage: string) => {
    setStage(newStage)                
  
    onStageChange(getLeadId(), newStage)
  }

  // Funcție pentru gestionarea checkbox-ului "Nu raspunde"
  const handleNuRaspundeChange = (checked: boolean) => {
    // Dacă se bifează, dezactivează celelalte checkbox-uri
    if (checked) {
      setNoDeal(false)
      setCallBack(false)
      setNuRaspunde(true)
      
      // Dacă suntem în pipeline-ul Vânzări, mută lead-ul în stage-ul corespunzător
      if (isVanzariPipeline) {
        const nuRaspundeStage = stages.find(stage => 
          stage.toUpperCase() === 'NU RASPUNDE' || 
          stage.toUpperCase() === 'NU RASUNDE' ||
          stage.toUpperCase().includes('RASPUNDE')
        )
        if (nuRaspundeStage) {
          handleStageChange(nuRaspundeStage)
          toast.success('Card mutat în ' + nuRaspundeStage)
        }
      }
    } else {
      setNuRaspunde(false)
    }
  }

  // Funcție pentru gestionarea checkbox-ului "No Deal"
  const handleNoDealChange = (checked: boolean) => {
    // Dacă se bifează, dezactivează celelalte checkbox-uri
    if (checked) {
      setNuRaspunde(false)
      setCallBack(false)
      setNoDeal(true)
      
      // Dacă suntem în pipeline-ul Vânzări, mută lead-ul în stage-ul corespunzător
      if (isVanzariPipeline) {
        const noDealStage = stages.find(stage => 
          stage.toUpperCase() === 'NO DEAL' || 
          stage.toUpperCase() === 'NO-DEAL' ||
          stage.toUpperCase().includes('NO DEAL')
        )
        if (noDealStage) {
          handleStageChange(noDealStage)
          toast.success('Card mutat în ' + noDealStage)
        }
      }
    } else {
      setNoDeal(false)
    }
  }

  // Funcție pentru gestionarea checkbox-ului "Call Back"
  const handleCallBackChange = (checked: boolean) => {
    // Dacă se bifează, dezactivează celelalte checkbox-uri
    if (checked) {
      setNoDeal(false)
      setNuRaspunde(false)
      setCallBack(true)
      
      // Dacă suntem în pipeline-ul Vânzări, mută lead-ul în stage-ul corespunzător
      if (isVanzariPipeline) {
        const callBackStage = stages.find(stage => 
          stage.toUpperCase() === 'CALLBACK' || 
          stage.toUpperCase() === 'CALL BACK' ||
          stage.toUpperCase() === 'CALL-BACK' ||
          stage.toUpperCase().includes('CALLBACK')
        )
        if (callBackStage) {
          handleStageChange(callBackStage)
          toast.success('Card mutat în ' + callBackStage)
        }
      }
    } else {
      setCallBack(false)
    }
  }


  // functii pentru contacte
  const handleCopy = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast.success('Copiat în clipboard', {
        description: `${field} a fost copiat`
      })
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      toast.error('Eroare la copiere')
    }
  }, [])

  const handlePhoneClick = useCallback((phone: string) => {
    window.location.href = `tel:${phone}`
  }, [])

  const handleEmailClick = useCallback((email: string) => {
    const subject = encodeURIComponent(`Comanda Ascutzit.ro`)
    const body = encodeURIComponent(`Va contactez in legatura cu comanda dvs facuta la Ascutzit.ro`)
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`, '_blank')
  }, [])

  // Handler pentru butonul "Finalizare" (mută în stage-ul Finalizare)
  const handleFinalizare = useCallback(async () => {
    const leadAny = lead as any
    
    // Caută stage-ul "FINALIZARE" exact (case insensitive)
    const finalizareStage = stages.find(s => 
      s.toUpperCase() === 'FINALIZATA'
    )
    
    if (!finalizareStage) {
      toast.error('Stage-ul FINALIZATA nu există în acest pipeline')
      return
    }

    // Pentru tray-uri din pipeline departament, folosim moveItemToStage
    if (isDepartmentPipeline && leadAny?.type === 'tray' && leadAny?.pipelineId) {
      try {
        // Obține stage_id din baza de date
        const { data: stageData, error: stageError } = await supabase
          .from('stages')
          .select('id')
          .eq('pipeline_id', leadAny.pipelineId)
          .eq('name', finalizareStage)
          .single()
        
        if (stageError || !stageData) {
          console.error('Error finding stage:', stageError, 'Looking for:', finalizareStage)
          toast.error('Nu s-a putut găsi stage-ul în baza de date')
          return
        }

        const { error } = await moveItemToStage(
          'tray',
          leadAny.id,
          leadAny.pipelineId,
          (stageData as any).id,
          leadAny.stageId
        )
        
        if (error) {
          toast.error('Eroare la mutarea cardului')
          console.error('Error moving to Finalizare:', error)
          return
        }
        
        toast.success('Card mutat în FINALIZATA')
        // Actualizează UI-ul local
        setStage(finalizareStage)
      } catch (error) {
        console.error('Error moving to Finalizare:', error)
        toast.error('Eroare la mutarea cardului')
      }
    } else {
      // Pentru lead-uri normale, folosim handleStageChange
      handleStageChange(finalizareStage)
      toast.success('Card mutat în Finalizare')
    }
  }, [lead, stages, isDepartmentPipeline, handleStageChange, supabase])

  // Handler pentru butonul "Aștept piese" (pentru Reparații)
  const handleAsteptPiese = useCallback(async () => {
    const leadAny = lead as any
    
    // Caută stage-ul "ASTEPT PIESE" exact (case insensitive)
    const asteptPieseStage = stages.find(s => 
      s.toUpperCase() === 'ASTEPT PIESE'
    )
    
    if (!asteptPieseStage) {
      toast.error('Stage-ul ASTEPT PIESE nu există în acest pipeline')
      return
    }

    // Pentru tray-uri din pipeline departament, folosim moveItemToStage
    if (isDepartmentPipeline && leadAny?.type === 'tray' && leadAny?.pipelineId) {
      try {
        // Obține stage_id din baza de date
        const { data: stageData, error: stageError } = await supabase
          .from('stages')
          .select('id')
          .eq('pipeline_id', leadAny.pipelineId)
          .eq('name', asteptPieseStage)
          .single()
        
        if (stageError || !stageData) {
          console.error('Error finding stage:', stageError, 'Looking for:', asteptPieseStage)
          toast.error('Nu s-a putut găsi stage-ul în baza de date')
          return
        }

        const { error } = await moveItemToStage(
          'tray',
          leadAny.id,
          leadAny.pipelineId,
          (stageData as any).id,
          leadAny.stageId
        )
        
        if (error) {
          toast.error('Eroare la mutarea cardului')
          console.error('Error moving to Astept piese:', error)
          return
        }
        
        toast.success('Card mutat în ASTEPT PIESE')
        // Actualizează UI-ul local
        setStage(asteptPieseStage)
      } catch (error) {
        console.error('Error moving to Astept piese:', error)
        toast.error('Eroare la mutarea cardului')
      }
    } else {
      // Pentru lead-uri normale, folosim handleStageChange
      handleStageChange(asteptPieseStage)
      toast.success('Card mutat în Aștept piese')
    }
  }, [lead, stages, isDepartmentPipeline, handleStageChange, supabase])

  // Handler pentru butonul "În așteptare" (pentru Saloane/Horeca/Frizerii)
  const handleInAsteptare = useCallback(async () => {
    const leadAny = lead as any
    
    // Caută stage-ul "IN ASTEPTARE" exact (case insensitive)
    const inAsteptareStage = stages.find(s => 
      s.toUpperCase() === 'IN ASTEPTARE'
    )
    
    if (!inAsteptareStage) {
      toast.error('Stage-ul IN ASTEPTARE nu există în acest pipeline')
      return
    }

    // Pentru tray-uri din pipeline departament, folosim moveItemToStage
    if (isDepartmentPipeline && leadAny?.type === 'tray' && leadAny?.pipelineId) {
      try {
        // Obține stage_id din baza de date
        const { data: stageData, error: stageError } = await supabase
          .from('stages')
          .select('id')
          .eq('pipeline_id', leadAny.pipelineId)
          .eq('name', inAsteptareStage)
          .single()
        
        if (stageError || !stageData) {
          console.error('Error finding stage:', stageError, 'Looking for:', inAsteptareStage)
          toast.error('Nu s-a putut găsi stage-ul în baza de date')
          return
        }

        const { error } = await moveItemToStage(
          'tray',
          leadAny.id,
          leadAny.pipelineId,
          (stageData as any).id,
          leadAny.stageId
        )
        
        if (error) {
          toast.error('Eroare la mutarea cardului')
          console.error('Error moving to In asteptare:', error)
          return
        }
        
        toast.success('Card mutat în IN ASTEPTARE')
        // Actualizează UI-ul local
        setStage(inAsteptareStage)
      } catch (error) {
        console.error('Error moving to In asteptare:', error)
        toast.error('Eroare la mutarea cardului')
      }
    } else {
      // Pentru lead-uri normale, folosim handleStageChange
      handleStageChange(inAsteptareStage)
      toast.success('Card mutat în În așteptare')
    }
  }, [lead, stages, isDepartmentPipeline, handleStageChange, supabase])

  // Handler pentru butonul "În lucru" (atribuie tăvița utilizatorului curent)
  const handleInLucru = useCallback(async () => {
    const leadAny = lead as any
    
    // Caută stage-ul "IN LUCRU" exact (case insensitive)
    const inLucruStage = stages.find(s => 
      s.toUpperCase() === 'IN LUCRU'
    )
    
    if (!inLucruStage) {
      toast.error('Stage-ul IN LUCRU nu există în acest pipeline')
      return
    }

    // Pentru tray-uri din pipeline departament, folosim moveItemToStage
    if (isDepartmentPipeline && leadAny?.type === 'tray' && leadAny?.pipelineId) {
      try {
        // Obține user_id curent
        if (!user?.id) {
          toast.error('Utilizatorul nu este autentificat')
          return
        }

        // Obține stage_id din baza de date
        const { data: stageData, error: stageError } = await supabase
          .from('stages')
          .select('id')
          .eq('pipeline_id', leadAny.pipelineId)
          .eq('name', inLucruStage)
          .single()
        
        if (stageError || !stageData) {
          console.error('Error finding stage:', stageError, 'Looking for:', inLucruStage)
          toast.error('Nu s-a putut găsi stage-ul în baza de date')
          return
        }

        // Mută cardul în stage-ul "IN LUCRU"
        const { error: moveError } = await moveItemToStage(
          'tray',
          leadAny.id,
          leadAny.pipelineId,
          (stageData as any).id,
          leadAny.stageId
        )
        
        if (moveError) {
          toast.error('Eroare la mutarea cardului')
          console.error('Error moving to In lucru:', moveError)
          return
        }

        // Atribuie toate tray_items din tăviță utilizatorului curent
        const { error: updateError } = await supabase
          .from('tray_items')
          .update({ technician_id: user.id } as any)
          .eq('tray_id', leadAny.id)
        
        if (updateError) {
          console.error('Error assigning tray to user:', updateError)
          toast.error('Eroare la atribuirea tăviței')
          return
        }
        
        toast.success('Tăvița a fost atribuită și mutată în IN LUCRU')
        // Actualizează UI-ul local
        setStage(inLucruStage)
      } catch (error) {
        console.error('Error moving to In lucru:', error)
        toast.error('Eroare la mutarea cardului')
      }
    } else {
      // Pentru lead-uri normale, folosim handleStageChange
      handleStageChange(inLucruStage)
      toast.success('Card mutat în IN LUCRU')
    }
  }, [lead, stages, isDepartmentPipeline, handleStageChange, supabase, user])

  // Funcție pentru crearea unei fișe noi
  const handleCreateServiceSheet = useCallback(async () => {
    if (!lead?.id) {
      console.warn('Cannot create service sheet: no lead ID')
      return
    }
    
    try {
      setLoadingSheets(true)
      console.log('Creating service sheet for lead:', getLeadId())
      
      const fisaId = await createServiceSheet(getLeadId())
      console.log('Service sheet created with fisaId:', fisaId)
      
      // Reîncarcă fișele folosind funcția helper
      const sheets = await loadServiceSheets(getLeadId())
      console.log('Loaded service sheets:', sheets)
      
      setServiceSheets(sheets)
      setSelectedFisaId(fisaId)
      
      // Verifică dacă fișa a fost adăugată în listă
      const createdSheet = sheets.find(s => s.id === fisaId)
      if (!createdSheet) {
        console.warn('Created sheet not found in loaded sheets')
      }
      
      toast.success('Fișă de serviciu creată cu succes')
    } catch (error: any) {
      console.error('Error creating service sheet:', error)
      const errorMessage = error?.message || 'Te rog încearcă din nou'
      
      // Verifică dacă eroarea este legată de coloana lipsă
      if (errorMessage.includes('fisa_id') || errorMessage.includes('column')) {
        toast.error('Coloana fisa_id lipsește', {
          description: 'Te rog adaugă coloana fisa_id (UUID, nullable) în tabelul service_files din Supabase'
        })
      } else {
        toast.error('Eroare la crearea fișei', {
          description: errorMessage
        })
      }
    } finally {
      setLoadingSheets(false)
    }
  }, [getLeadId, loadServiceSheets])

  // Funcție pentru încărcarea detaliilor tăvițelor din fișă
  const loadTraysDetails = useCallback(async (fisaId: string) => {
    if (!fisaId) return
    
    setLoadingDetails(true)
    try {
      // Încarcă serviciile, instrumentele și pipeline-urile pentru a obține prețurile și departamentele
      const supabaseClient = supabaseBrowser()
      const [servicesResult, instrumentsResult, pipelinesResult] = await Promise.all([
        listServices().then(s => {
          console.log('[loadTraysDetails] Loaded services:', s.length, 'first 5:', s.slice(0, 5).map(x => ({ id: x.id, name: x.name })))
          return s
        }),
        supabaseClient.from('instruments').select('id,name,pipeline').then(({ data, error }) => {
          if (error) {
            console.error('Error loading instruments:', error)
            return []
          }
          return data || []
        }),
        supabaseClient.from('pipelines').select('id,name').then(({ data, error }) => {
          if (error) {
            console.error('Error loading pipelines:', error)
            return []
          }
          return data || []
        })
      ])
      
      // Creează un map pentru pipeline-uri (id -> name)
      const pipelineMap = new Map(pipelinesResult.map((p: any) => [p.id, p.name]))
      
      // Creează un map pentru instrumente (id -> pipeline_id)
      const instrumentPipelineMap = new Map(instrumentsResult.map((i: any) => [i.id, i.pipeline]))
      
      // Creează un map pentru instrumente (id -> { id, name })
      const instrumentsMap = new Map(instrumentsResult.map((i: any) => [i.id, { id: i.id, name: i.name }]))
      
      // Încarcă toate tăvițele din fișă
      const trays = await listTraysForServiceSheet(fisaId)
      
      const services = servicesResult
      console.log('[loadTraysDetails] Using services array with', services.length, 'items')
      
      // Pentru fiecare tăviță, încarcă items-urile și calculează totalurile
      // Folosim exact aceeași logică ca în preturi.tsx
      const details = await Promise.all(
        trays.map(async (tray) => {
          const items = await listQuoteItems(tray.id, services, instrumentPipelineMap, pipelineMap, instrumentsMap)
          
          // Exclude items-urile cu item_type: null (doar instrument, fără serviciu) din calculele de totaluri
          const visibleItems = items.filter(it => it.item_type !== null)
          
          // Calculează totalurile folosind aceeași logică ca în preturi.tsx
          const subtotal = visibleItems.reduce((acc, it) => acc + it.qty * it.price, 0)
          
          const totalDiscount = visibleItems.reduce(
            (acc, it) => acc + it.qty * it.price * (Math.min(100, Math.max(0, it.discount_pct)) / 100),
            0
          )
          
          // Urgent se preia de pe tăviță, nu de pe fiecare item
          const isUrgent = tray.urgent || false
          const urgentAmount = isUrgent ? visibleItems.reduce((acc, it) => {
            const afterDisc = it.qty * it.price * (1 - Math.min(100, Math.max(0, it.discount_pct)) / 100)
            return acc + afterDisc * (30 / 100) // 30% markup pentru urgent
          }, 0) : 0
          
          // Calculează reducerile pentru abonament (10% servicii, 5% piese) - exact ca în preturi.tsx PrintViewData
          const subscriptionType = tray.subscription_type || null
          
          // Calculează totalul pentru servicii (afterDisc + urgent)
          const servicesTotal = visibleItems
            .filter(it => it.item_type === 'service')
            .reduce((acc, it) => {
              const base = it.qty * it.price
              const disc = base * (Math.min(100, Math.max(0, it.discount_pct)) / 100)
              const afterDisc = base - disc
              const urgent = isUrgent ? afterDisc * (30 / 100) : 0
              return acc + afterDisc + urgent
            }, 0)
          
          // Calculează totalul pentru piese (afterDisc)
          const partsTotal = visibleItems
            .filter(it => it.item_type === 'part')
            .reduce((acc, it) => {
              const base = it.qty * it.price
              const disc = base * (Math.min(100, Math.max(0, it.discount_pct)) / 100)
              return acc + base - disc
            }, 0)
          
          // Aplică reducerile pentru abonament
          let subscriptionDiscount = 0
          let subscriptionDiscountServices = 0
          let subscriptionDiscountParts = 0
          
          if (subscriptionType === 'services' || subscriptionType === 'both') {
            subscriptionDiscountServices = servicesTotal * 0.10
            subscriptionDiscount += subscriptionDiscountServices
          }
          if (subscriptionType === 'parts' || subscriptionType === 'both') {
            subscriptionDiscountParts = partsTotal * 0.05
            subscriptionDiscount += subscriptionDiscountParts
          }
          
          // Total folosind aceeași formulă ca în preturi.tsx: baseTotal - subscriptionDiscountAmount
          const baseTotal = subtotal - totalDiscount + urgentAmount
          const total = baseTotal - subscriptionDiscount
          
          return {
            tray,
            items,
            subtotal,
            discount: totalDiscount,
            urgent: urgentAmount,
            subscriptionDiscount,
            subscriptionDiscountServices,
            subscriptionDiscountParts,
            subscriptionType,
            total
          }
        })
      )
      
      setTraysDetails(details)
    } catch (error) {
      console.error('Error loading trays details:', error)
      toast.error('Eroare la încărcarea detaliilor')
    } finally {
      setLoadingDetails(false)
    }
  }, [])

  // Funcție pentru calcularea sumei totale a tuturor tăvițelor din fișă
  const calculateTotalFisaSum = useCallback(async (fisaId: string) => {
    if (!fisaId) {
      setTotalFisaSum(null)
      return
    }
    
    setLoadingTotalSum(true)
    try {
      // Încarcă serviciile, instrumentele și pipeline-urile
      const supabaseClient = supabaseBrowser()
      const [services, instrumentsResult, pipelinesResult] = await Promise.all([
        listServices(),
        supabaseClient.from('instruments').select('id,name,pipeline').then(({ data, error }) => {
          if (error) {
            console.error('Error loading instruments:', error)
            return []
          }
          return data || []
        }),
        supabaseClient.from('pipelines').select('id,name').then(({ data, error }) => {
          if (error) {
            console.error('Error loading pipelines:', error)
            return []
          }
          return data || []
        })
      ])
      
      // Creează un map pentru pipeline-uri (id -> name)
      const pipelineMap = new Map(pipelinesResult.map((p: any) => [p.id, p.name]))
      
      // Creează un map pentru instrumente (id -> pipeline_id)
      const instrumentPipelineMap = new Map(instrumentsResult.map((i: any) => [i.id, i.pipeline]))
      
      // Creează un map pentru instrumente (id -> { id, name })
      const instrumentsMap = new Map(instrumentsResult.map((i: any) => [i.id, { id: i.id, name: i.name }]))
      
      const trays = await listTraysForServiceSheet(fisaId)
      
      let totalSum = 0
      
      for (const tray of trays) {
        const items = await listQuoteItems(tray.id, services, instrumentPipelineMap, pipelineMap, instrumentsMap)
        
        // Exclude items-urile cu item_type: null (doar instrument, fără serviciu) din calculele de totaluri
        const visibleItems = items.filter(it => it.item_type !== null)
        
        // Calculează totalurile folosind aceeași logică ca în loadTraysDetails
        const subtotal = visibleItems.reduce((acc, it) => acc + it.qty * it.price, 0)
        
        const totalDiscount = visibleItems.reduce(
          (acc, it) => acc + it.qty * it.price * (Math.min(100, Math.max(0, it.discount_pct)) / 100),
          0
        )
        
        // Urgent se preia de pe tăviță
        const isUrgent = tray.urgent || false
        const urgentAmount = isUrgent ? visibleItems.reduce((acc, it) => {
          const afterDisc = it.qty * it.price * (1 - Math.min(100, Math.max(0, it.discount_pct)) / 100)
          return acc + afterDisc * (30 / 100)
        }, 0) : 0
        
        const subscriptionType = tray.subscription_type || null
        
        const servicesTotal = visibleItems
          .filter(it => it.item_type === 'service')
          .reduce((acc, it) => {
            const base = it.qty * it.price
            const disc = base * (Math.min(100, Math.max(0, it.discount_pct)) / 100)
            const afterDisc = base - disc
            const urgent = isUrgent ? afterDisc * (30 / 100) : 0
            return acc + afterDisc + urgent
          }, 0)
        
        const partsTotal = visibleItems
          .filter(it => it.item_type === 'part')
          .reduce((acc, it) => {
            const base = it.qty * it.price
            const disc = base * (Math.min(100, Math.max(0, it.discount_pct)) / 100)
            return acc + base - disc
          }, 0)
        
        let subscriptionDiscount = 0
        
        if (subscriptionType === 'services' || subscriptionType === 'both') {
          subscriptionDiscount += servicesTotal * 0.10
        }
        if (subscriptionType === 'parts' || subscriptionType === 'both') {
          subscriptionDiscount += partsTotal * 0.05
        }
        
        const baseTotal = subtotal - totalDiscount + urgentAmount
        const total = baseTotal - subscriptionDiscount
        
        totalSum += total
      }
      
      setTotalFisaSum(totalSum)
    } catch (error) {
      console.error('Error calculating total fisa sum:', error)
      setTotalFisaSum(null)
    } finally {
      setLoadingTotalSum(false)
    }
  }, [])

  // Calculează suma totală când se schimbă fișa selectată
  useEffect(() => {
    if (selectedFisaId) {
      calculateTotalFisaSum(selectedFisaId)
    } else {
      setTotalFisaSum(null)
    }
  }, [selectedFisaId, calculateTotalFisaSum])

  // Blochează scroll-ul pe body când panelul este deschis
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    const originalPaddingRight = document.body.style.paddingRight
    
    // Calculează lățimea scrollbar-ului pentru a preveni jump-ul layout-ului
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
    
    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.paddingRight = originalPaddingRight
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseWithSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleCloseWithSave])
  
  return (
    <section ref={panelRef} className="h-full flex flex-col bg-card">
      <header className="border-b p-2 sm:p-3 lg:p-4">
        <div className="flex items-start justify-between gap-2 sm:gap-3 lg:gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold truncate">{lead.name}</h2>

            <div className="mt-1.5 sm:mt-2 flex items-center gap-1.5 sm:gap-2">
              {/* Add tags button + multi-select */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs sm:text-sm">
                    <span className="hidden sm:inline">Add tags</span>
                    <span className="sm:hidden">Tags</span>
                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[260px]">
                  {allTags
                    .filter(tag => !isDepartmentTag(tag.name)) // Ascunde tag-urile de departament din dropdown
                    .map(tag => (
                      <DropdownMenuCheckboxItem
                        key={tag.id}
                        checked={selectedTagIds.includes(tag.id)}
                        onCheckedChange={() => handleToggleTag(tag.id)}
                        onSelect={(e) => e.preventDefault()} // ← keep menu open
                      >
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[11px] leading-5 ${tagClass(tag.color)}`}>
                          {tag.name}
                        </span>
                      </DropdownMenuCheckboxItem>
                    ))}
                  {allTags.filter(tag => !isDepartmentTag(tag.name)).length === 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                      No tags defined yet.
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Selected chips — inline, small radius, wrap at max width */}
              <div className="flex flex-wrap gap-1 max-w-[60%] md:max-w-[520px]">
                {allTags
                  .filter(t => selectedTagIds.includes(t.id))
                  .map(tag => {
                    const isUrgent = tag.name.toLowerCase() === 'urgent'
                    const isRetur = tag.name === 'RETUR'
                    const isUrgentOrRetur = isUrgent || isRetur
                    
                    // Nu afișa tag-ul urgent în pipeline-ul Vanzari
                    if (isUrgent && isVanzariPipeline) {
                      return null
                    }
                    
                    if (isDepartmentTag(tag.name)) {
                      return (
                        <span
                          key={tag.id}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${getDepartmentBadgeStyle(tag.name)} text-white shadow-sm border ${isUrgentOrRetur ? 'animate-border-strobe' : ''}`}
                        >
                          {tag.name}
                        </span>
                      )
                    }
                    // tag-uri speciale pentru urgent si RETUR cu background rosu si text alb
                    if (isUrgentOrRetur) {
                      return (
                        <span
                          key={tag.id}
                          className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[11px] leading-5 bg-red-600 text-white font-medium animate-border-strobe`}
                        >
                          {tag.name}
                        </span>
                      )
                    }
                    return (
                      <span
                        key={tag.id}
                        className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[11px] leading-5 ${tagClass(tag.color)}`}
                      >
                        {tag.name}
                      </span>
                    )
                  })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:gap-3 items-end">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Butoane Print și Email - ascunse pentru tehnicieni în pipeline departament */}
              {!isDepartmentPipeline && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      window.print()
                    }}
                    className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                  >
                    <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Print</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      if (lead.email) {
                        handleEmailClick(lead.email)
                      } else {
                        toast.error('Email indisponibil', {
                          description: 'Lead-ul nu are adresă de email'
                        })
                      }
                    }}
                    disabled={!lead.email}
                    title={lead.email ? `Trimite email la ${lead.email}` : 'Email indisponibil'}
                    className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                  >
                    <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Email</span>
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={handleCloseWithSave} className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3">Close</Button>
            </div>

            {/* checkbox-uri cu butoane - vizibile doar in Receptie, Vanzari, Curier */}
            {showActionCheckboxes && (
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {/* Checkbox-uri pentru Curier */}
                {isCurierPipeline ? (
                  <>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Checkbox
                        id="curier-trimis"
                        checked={curierTrimis}
                        onCheckedChange={(c: any) => setCurierTrimis(!!c)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurierTrimis(!curierTrimis)}
                        className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                      >
                        Curier trimis
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="colet-ajuns"
                        checked={coletAjuns}
                        onCheckedChange={(c: any) => setColetAjuns(!!c)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setColetAjuns(!coletAjuns)}
                      >
                        Colet ajuns
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="curier-retur"
                        checked={curierRetur}
                        onCheckedChange={(c: any) => setCurierRetur(!!c)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurierRetur(!curierRetur)}
                      >
                        Curier retur
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="colet-trimis"
                        checked={coletTrimis}
                        onCheckedChange={(c: any) => setColetTrimis(!!c)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setColetTrimis(!coletTrimis)}
                      >
                        Colet trimis
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="astept-ridicarea"
                        checked={asteptRidicarea}
                        onCheckedChange={(c: any) => setAsteptRidicarea(!!c)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAsteptRidicarea(!asteptRidicarea)}
                      >
                        Astept ridicarea
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="ridic-personal"
                        checked={ridicPersonal}
                        onCheckedChange={(c: any) => setRidicPersonal(!!c)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRidicPersonal(!ridicPersonal)}
                      >
                        Ridic personal
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Checkbox-uri pentru Receptie si Vanzari (fara Call back in Curier) */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      {!isCurierPipeline && (
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Checkbox
                            id="no-deal"
                            checked={noDeal}
                            onCheckedChange={(c: any) => handleNoDealChange(!!c)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleNoDealChange(!noDeal)}
                            className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                          >
                            No Deal
                          </Button>
                        </div>
                      )}
                      {!isCurierPipeline && (
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Checkbox
                            id="call-back"
                            checked={callBack}
                            onCheckedChange={(c: any) => handleCallBackChange(!!c)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCallBackChange(!callBack)}
                            className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                          >
                            Call back
                          </Button>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Checkbox
                          id="nu-raspunde"
                          checked={nuRaspunde}
                          onCheckedChange={(c: any) => handleNuRaspundeChange(!!c)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleNuRaspundeChange(!nuRaspunde)}
                          className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                        >
                          Nu raspunde
                        </Button>
                      </div>
                      
                     
                      
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)] gap-3 lg:gap-4 items-start p-2 sm:p-3 lg:p-4">
        {/* LEFT column — identity & meta */}
        <div className="space-y-2 sm:space-y-3">
          {/* Contact Info - Collapsible */}
          <Collapsible open={isContactOpen} onOpenChange={setIsContactOpen}>
            <div className="rounded-lg border bg-muted/30">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 sm:p-3 hover:bg-muted/50 transition-colors rounded-t-lg">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                  <span className="font-medium text-xs sm:text-sm">Informații Contact</span>
                </div>
                {isContactOpen ? <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              </CollapsibleTrigger>
              
              <CollapsibleContent className="px-2 sm:px-3 pb-2 sm:pb-3 space-y-2 sm:space-y-3">
          <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">Nume</label>
                  <p className="text-sm font-medium">{lead.name}</p>
          </div>


          {lead.phone && (
            <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase">Telefon</label>
                    <div className="flex items-center gap-2 group mt-1">
                <a
                  href={`tel:${lead.phone}`}
                  onClick={(e) => {
                    e.preventDefault()
                    handlePhoneClick(lead.phone!)
                  }}
                        className="flex-1 flex items-center gap-2 text-sm hover:text-primary transition-colors bg-background rounded px-2 py-1.5 border"
                >
                        <Phone className="h-3.5 w-3.5" />
                  <span className="truncate">{lead.phone}</span>
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleCopy(lead.phone!, 'Telefon')}
                  title="Copiază telefon"
                >
                  {copiedField === 'Telefon' ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {lead.email && (
            <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase">Email</label>
                    <div className="flex items-center gap-2 group mt-1">
                <a
                  href={`mailto:${lead.email}`}
                  onClick={(e) => {
                    e.preventDefault()
                    handleEmailClick(lead.email!)
                  }}
                        className="flex-1 flex items-center gap-2 text-sm hover:text-primary transition-colors bg-background rounded px-2 py-1.5 border truncate"
                >
                        <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  onClick={() => handleCopy(lead.email!, 'Email')}
                  title="Copiază email"
                >
                  {copiedField === 'Email' ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )}

{lead.company_name && (
  <div>
    <label className="text-xs font-medium text-muted-foreground uppercase">
      Companie
    </label>
    <p className="text-sm">{lead.company_name}</p>
  </div>
)}

{(lead as any).company_address && (
  <div>
    <label className="text-xs font-medium text-muted-foreground uppercase">
      Companie - adresă
    </label>
    <p className="text-sm">{(lead as any).company_address}</p>
  </div>
)}

{(lead as any).address && (
  <div>
    <label className="text-xs font-medium text-muted-foreground uppercase">
      Adresă
    </label>
    <div className="flex items-center gap-2 group mt-1">
      <div className="flex-1 flex items-center gap-2 text-sm bg-background rounded px-2 py-1.5 border">
        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">{(lead as any).address}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={() => handleCopy((lead as any).address, 'Adresă')}
        title="Copiază adresă"
      >
        {copiedField === 'Adresă' ? (
          <Check className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  </div>
)}

{(lead as any).address2 && (
  <div>
    <label className="text-xs font-medium text-muted-foreground uppercase">
      Adresă 2
    </label>
    <p className="text-sm">{(lead as any).address2}</p>
  </div>
)}

{(lead as any).city && (
  <div>
    <label className="text-xs font-medium text-muted-foreground uppercase">
      Oraș
    </label>
    <p className="text-sm">{(lead as any).city}</p>
  </div>
)}

{(lead as any).zip && (
  <div>
    <label className="text-xs font-medium text-muted-foreground uppercase">
      Cod poștal
    </label>
    <p className="text-sm">{(lead as any).zip}</p>
  </div>
)}


          {lead.technician && (
            <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase">Tehnician</label>
                    <p className="text-sm">{lead.technician}</p>
            </div>
          )}

          {lead.notes && (
            <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase">Notițe</label>
                    <p className="text-sm text-muted-foreground mt-1">{lead.notes}</p>
            </div>
          )}

                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  {lead?.createdAt && (
          <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase">Creat</label>
                      <p className="text-xs">{format(lead.createdAt, "dd MMM yyyy")}</p>
                    </div>
                  )}
                  {lead?.lastActivity && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase">Ultima activitate</label>
                      <p className="text-xs">{format(lead.lastActivity, "dd MMM yyyy")}</p>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Informații Tavita - Collapsible */}
          {/* Vizibil pentru:
              - Pipeline-urile tehnice (departamente)
              - Tehnicieni, dar doar pe card de tăviță
              
             NOTĂ:
             Pentru Vânzări / Recepție / Curier, detaliile de tăviță sunt mutate în componenta `Preturi`
             (în fișa de serviciu), pentru a fi introduse direct pe fiecare tăviță. */}
          {(isDepartmentPipeline || (isTechnician && getTrayId())) && (
          <Collapsible open={isTrayInfoOpen} onOpenChange={setIsTrayInfoOpen}>
            <div className="rounded-lg border bg-muted/30">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 sm:p-3 hover:bg-muted/50 transition-colors rounded-t-lg">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                  <span className="font-medium text-xs sm:text-sm">Informații Tavita</span>
                </div>
                {isTrayInfoOpen ? <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              </CollapsibleTrigger>
              
              <CollapsibleContent className="px-2 sm:px-3 pb-2 sm:pb-3 space-y-2 sm:space-y-3">
                {/* VARIANTA 1: Pipeline-uri departament (Saloane, Frizerii, Horeca, Reparatii) - detalii per tăviță */}
                {isDepartmentPipeline ? (
                  <>
                {/* Pentru tehnician, afișează doar tăvița curentă */}
                {isTechnician && getTrayId() && (
                  <div className="text-sm text-muted-foreground mb-2">
                    <span className="font-medium">Tăviță curentă: </span>
                    {allTrays.find(t => t.id === getTrayId())?.number || 'N/A'}
                  </div>
                )}

                {/* Afișează detaliile pentru fișa de serviciu (nu mai per tăviță) */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase mb-2 block">
                    Detalii comandă comunicate de client
                  </label>
                  {loadingTrayDetails ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <Textarea
                        value={trayDetails}
                        onChange={(e) => {
                          if (!isTechnician) {
                            setTrayDetails(e.target.value)
                          }
                        }}
                        placeholder="Introduceți detaliile comenzii comunicate de client pentru această fișă..."
                        className="min-h-[80px] sm:min-h-[100px] lg:min-h-[120px] text-xs sm:text-sm resize-none"
                        readOnly={isTechnician}
                      />
                      {/* Buton salvare doar pentru vânzători */}
                    </>
                  )}
                </div>
                
                {/* Mesaj dacă nu sunt tăvițe */}
                {isVanzator && allTrays.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Nu există tăvițe pentru acest lead. Creează mai întâi o fișă de serviciu cu tăvițe.
                  </div>
                )}
                  </>
                ) : (
                  <>
                    {/* VARIANTA 2: Alte pipeline-uri (Vânzări, Recepție, Curier, etc.) - detalii la nivel de service_file */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase mb-2 block">
                        Detalii comandă comunicate de client
                      </label>
                      <Textarea
                        value={trayDetails}
                        onChange={(e) => {
                          const newValue = e.target.value
                          setTrayDetails(newValue)
                          // Auto-save cu debounce
                          debouncedSaveDetails(newValue)
                        }}
                        placeholder="Introduceți detaliile comenzii comunicate de client pentru această fișă..."
                        className="min-h-[80px] sm:min-h-[100px] lg:min-h-[120px] text-xs sm:text-sm resize-none"
                      />
                    </div>
                  </>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>
          )}

          {/* Acțiuni - Stage & Pipeline */}
          {!isVanzariPipeline && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <div>
              <label className="text-xs font-medium text-muted-foreground uppercase mb-2 block">Schimbă Etapa</label>
            <Select value={stage} onValueChange={handleStageChange}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

            {/* Mută în Pipeline - doar pentru owner și admin */}
            {canMovePipeline && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase mb-2 block">
                Mută în Pipeline
              </label>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                      {selectedPipes.length > 0 ? `Selectate: ${selectedPipes.length}` : "Alege"}
                      <ChevronsUpDown className="ml-1 h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>

                  <DropdownMenuContent align="start" className="w-[220px] max-h-[280px] overflow-y-auto">
                  <DropdownMenuCheckboxItem
                    checked={selectedPipes.length === allPipeNames.length && allPipeNames.length > 0}
                    onCheckedChange={(v) => (v ? pickAll() : clearAll())}
                      onSelect={(e) => e.preventDefault()}
                  >
                      Selectează toate
                  </DropdownMenuCheckboxItem>

                  <div className="my-1 h-px bg-border" />

                  {allPipeNames.map(name => (
                    <DropdownMenuCheckboxItem
                      key={name}
                      checked={selectedPipes.includes(name)}
                      onCheckedChange={() => togglePipe(name)}
                        onSelect={(e) => e.preventDefault()}
                    >
                        <span className="truncate text-xs">{name}</span>
                    </DropdownMenuCheckboxItem>
                  ))}

                  {allPipeNames.length === 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                        Nu există pipeline-uri.
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                size="sm"
                  className="h-8 text-xs"
                disabled={movingPipes || selectedPipes.length === 0}
                onClick={async () => {
                  if (!lead?.id) return
                  setMovingPipes(true)
                  try {
                    if (onBulkMoveToPipelines) {
                      await onBulkMoveToPipelines(getLeadId(), selectedPipes)
                    } else if (onMoveToPipeline) {
                      for (const name of selectedPipes) {
                        await onMoveToPipeline(getLeadId(), name)
                      }
                    }
                    setSelectedPipes([])
                  } finally {
                    setMovingPipes(false)
                  }
                }}
              >
                  {movingPipes ? "Se mută…" : "Mută"}
              </Button>
              </div>
            </div>
            )}
          </div>
          )}

            {/* Pasare tăviță - pentru tăvițe din pipeline departament */}
            {((lead as any)?.type === 'tray' || isDepartmentPipeline) && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase mb-2 block">
                  Pasare Tăviță
                </label>
                <div className="flex items-center gap-2">
                  <Select 
                    value={selectedTechnicianId} 
                    onValueChange={setSelectedTechnicianId}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Alege tehnician" />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.map((tech) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    disabled={passingTray || !selectedTechnicianId}
                    onClick={async () => {
                      const leadAny = lead as any
                      const trayId = getTrayId()
                      
                      if (!trayId) {
                        toast.error('Tăvița nu a fost găsită')
                        return
                      }

                      if (!selectedTechnicianId) {
                        toast.error('Selectează un tehnician')
                        return
                      }

                      setPassingTray(true)
                      try {
                        // Obține tehnicianul vechi (dacă există)
                        const { data: prevTechRow, error: prevError } = await supabase
                          .from('tray_items')
                          .select('technician_id')
                          .eq('tray_id', trayId)
                          .not('technician_id', 'is', null)
                          .limit(1)
                          .single()

                        if (prevError && prevError.code !== 'PGRST116') {
                          console.error('Error loading previous technician for tray:', prevError)
                        }

                        const previousTechnicianId = (prevTechRow as any)?.technician_id || null

                        // Actualizează technician_id pentru toate tray_items din tăviță
                        const { error: updateError } = await supabase
                          .from('tray_items')
                          .update({ technician_id: selectedTechnicianId } as any)
                          .eq('tray_id', trayId)
                        
                        if (updateError) {
                          console.error('Error passing tray to technician:', updateError)
                          toast.error('Eroare la pasarea tăviței')
                          return
                        }

                        // Găsește numele tehnicienilor pentru mesaj
                        const newTech = technicians.find(t => t.id === selectedTechnicianId)
                        const newTechName = newTech?.name || 'tehnician necunoscut'
                        const prevTech = previousTechnicianId
                          ? technicians.find(t => t.id === previousTechnicianId)
                          : undefined
                        const prevTechName = previousTechnicianId
                          ? (prevTech?.name || 'tehnician necunoscut')
                          : 'Fără atribuire'

                        // Loghează evenimentul în istoricul tăviței și al lead-ului
                        try {
                          await logItemEvent(
                            'tray',
                            trayId,
                            `Tăvița a fost pasată de la "${prevTechName}" la "${newTechName}"`,
                            'tray_passed',
                            {
                              from_technician_id: previousTechnicianId,
                              to_technician_id: selectedTechnicianId,
                              tray_id: trayId,
                              lead_id: getLeadId(),
                            }
                          )
                        } catch (logError) {
                          console.error('Error logging tray pass event:', logError)
                        }

                        toast.success('Tăvița a fost atribuită cu succes')
                        setSelectedTechnicianId('')
                        
                        // Reîncarcă datele pentru a reflecta modificările (dacă este deschis modalul de detalii)
                        if (selectedFisaId && detailsModalOpen) {
                          loadTraysDetails(selectedFisaId)
                        }
                      } catch (error) {
                        console.error('Error passing tray:', error)
                        toast.error('Eroare la pasarea tăviței')
                      } finally {
                        setPassingTray(false)
                      }
                    }}
                  >
                    {passingTray ? "Se atribuie…" : "Pasare"}
                  </Button>
                </div>
              </div>
            )}

          {/* Mesagerie - Collapsible */}
          <Collapsible open={isMessengerOpen} onOpenChange={setIsMessengerOpen}>
            <div className="rounded-lg border bg-muted/30">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors rounded-t-lg">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Mesagerie</span>
                </div>
                {isMessengerOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              
              <CollapsibleContent className="px-3 pb-3">
          <LeadMessenger leadId={getLeadId()} leadTechnician={lead.technician} />
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>


          {/* RIGHT — switchable content cu tabs */}
          <div className="min-w-0">
            <Tabs value={section} onValueChange={(v) => setSection(v as "fisa" | "de-confirmat" | "istoric")} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="fisa" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Fișa de serviciu</span>
                  <span className="sm:hidden">Fișă</span>
                </TabsTrigger>
                <TabsTrigger value="de-confirmat" className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  <span>De Confirmat</span>
                </TabsTrigger>
                <TabsTrigger value="istoric" className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  <span>Istoric</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="fisa" className="mt-0">
                {/* Butoane de acțiune pentru pipeline departament */}
                {isDepartmentPipeline && (
                  <div className="mb-4 flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium text-muted-foreground">Acțiuni rapide:</span>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleInLucru}
                      className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
                    >
                      <Wrench className="h-4 w-4" />
                      În lucru
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleFinalizare}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Finalizare
                    </Button>
                    {isReparatiiPipeline && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAsteptPiese}
                        className="flex items-center gap-2 border-amber-500 text-amber-600 hover:bg-amber-50"
                      >
                        <Clock className="h-4 w-4" />
                        Aștept piese
                      </Button>
                    )}
                    {isSaloaneHorecaFrizeriiPipeline && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleInAsteptare}
                        className="flex items-center gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
                      >
                        <Clock className="h-4 w-4" />
                        În așteptare
                      </Button>
                    )}
                  </div>
                )}

                {/* Selector de tăvițe pentru pipeline-urile departament, selector de fișe pentru restul */}
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex-1">
                    {isDepartmentPipeline ? (
                      <>
                        {/* Pentru vânzători / admin / owner: selector de tăviță */}
                        {!isTechnician ? (
                          <>
                            <label className="text-sm font-medium text-muted-foreground mb-2 block">
                              Selectează tăvița
                            </label>
                            <div className="flex items-center gap-2">
                              <Select
                                value={selectedTrayId || ''}
                                onValueChange={(value) => {
                                  const tray = allTrays.find(t => t.id === value)
                                  if (tray) {
                                    setSelectedTrayId(tray.id)
                                    setSelectedFisaId(tray.service_file_id)
                                  }
                                }}
                                disabled={loadingTrays}
                              >
                                <SelectTrigger className="w-full max-w-md">
                                  <SelectValue placeholder={loadingTrays ? "Se încarcă..." : "Selectează o tăviță"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {allTrays.map((tray) => {
                                    const displayText = `Tăviță #${tray.number} - ${tray.size}`
                                    return (
                                      <SelectItem key={tray.id} value={tray.id}>
                                        {displayText}
                                      </SelectItem>
                                    );
                                  })}
                                  {allTrays.length === 0 && !loadingTrays && (
                                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                      Nu există tăvițe
                                    </div>
                                  )}
                                </SelectContent>
                              </Select>
                              {/* Buton "Fișă nouă" - pentru pipeline-urile departament (doar vânzători / admin / owner, nu tehnicieni) */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCreateServiceSheet}
                                className="flex items-center gap-2"
                              >
                                <Plus className="h-4 w-4" />
                                Adaugă Fișă Serviciu
                              </Button>
                            </div>
                          </>
                        ) : (
                          /* Pentru tehnicieni: afișează doar tăvița curentă, fără dropdown */
                          <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">
                              Tăviță curentă
                            </label>
                            <p className="text-sm font-medium">
                              {allTrays.find(t => t.id === selectedTrayId)?.number
                                ? `Tăviță #${allTrays.find(t => t.id === selectedTrayId)!.number} - ${allTrays.find(t => t.id === selectedTrayId)!.size}`
                                : 'N/A'}
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <label className="text-sm font-medium text-muted-foreground mb-2 block">
                          Selectează fișa de serviciu
                        </label>
                        <div className="flex items-center gap-2">
                          <Select
                            value={selectedFisaId || ''}
                            onValueChange={(value) => setSelectedFisaId(value)}
                            disabled={loadingSheets}
                          >
                            <SelectTrigger className="w-full max-w-md">
                              <SelectValue placeholder={loadingSheets ? "Se încarcă..." : "Selectează o fișă"} />
                            </SelectTrigger>
                            <SelectContent>
                              {serviceSheets.map((sheet) => {
                                const createdDate = sheet.created_at 
                                  ? format(new Date(sheet.created_at), 'dd MMM yyyy')
                                  : '';
                                const displayText = createdDate 
                                  ? `${sheet.number} - ${createdDate}`
                                  : sheet.number;
                                return (
                                  <SelectItem key={sheet.id} value={sheet.id}>
                                    {displayText}
                                  </SelectItem>
                                );
                              })}
                              {serviceSheets.length === 0 && !loadingSheets && (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  Nu există fișe de serviciu
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                          {/* Buton "Fișă nouă" - pentru pipeline-ul Vânzări (toți utilizatorii) 
                              și pentru Receptie (doar vânzători / admin / owner) */}
                          {(
                            isVanzariPipeline ||               // în Vânzări: întotdeauna vizibil
                            (isReceptiePipeline && isVanzator) // în Receptie: doar pentru vânzători/admin/owner
                          ) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCreateServiceSheet}
                              className="flex items-center gap-2"
                            >
                              <Plus className="h-4 w-4" />
                              Adaugă Fișă Serviciu
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  {selectedFisaId && !isDepartmentPipeline && (
                    <div className="flex items-center gap-3">
                      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setDetailsModalOpen(true)
                              loadTraysDetails(selectedFisaId)
                            }}
                            className="flex items-center gap-2"
                          >
                            <Info className="h-5 w-5" />
                            Detalii Fisa
                          </Button>
                        </DialogTrigger>
                        <DialogContent 
                            className="overflow-y-auto"
                            style={{ 
                              width: '95vw', 
                              maxWidth: '3200px',
                              height: '95vh',
                              maxHeight: '95vh'
                            }}
                          >
                            <DialogTitle className="sr-only">Detalii Fișă</DialogTitle>
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold">Detalii Fișă</h2>
                              </div>
                              
                              {loadingDetails ? (
                                <div className="flex items-center justify-center py-8">
                                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                  <span className="ml-2 text-sm text-muted-foreground">Se încarcă...</span>
                                </div>
                              ) : traysDetails.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                  Nu există tăvițe în această fișă
                                </div>
                              ) : (
                                <div className="space-y-6">
                                  {traysDetails.map((detail, index) => {
                                    // Filtrează items-urile vizibile (exclude item_type: null)
                                    const visibleItems = detail.items.filter(item => item.item_type !== null)
                                    
                                    return (
                                      <div key={detail.tray.id} className="border rounded-lg p-4">
                                        <h3 className="font-medium mb-3 flex items-center gap-2">
                                          Tăviță {index + 1}: {detail.tray.name}
                                          {detail.tray.urgent && (
                                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">
                                              URGENT (+30%)
                                            </span>
                                          )}
                                        </h3>
                                        
                                        {visibleItems.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Nu există poziții în această tăviță</p>
                                      ) : (
                                        <>
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-sm border-collapse min-w-full">
                                              <thead>
                                                <tr className="border-b bg-muted/50">
                                                  <th className="text-left p-2 font-medium w-20">Tip</th>
                                                  <th className="text-left p-2 font-medium min-w-[200px]">Serviciu/Piesă</th>
                                                  <th className="text-left p-2 font-medium min-w-[150px]">Instrument</th>
                                                  <th className="text-center p-2 font-medium w-16">Cant.</th>
                                                  <th className="text-right p-2 font-medium w-24">Preț unitar</th>
                                                  <th className="text-center p-2 font-medium w-16">Disc%</th>
                                                  <th className="text-left p-2 font-medium w-28">Departament</th>
                                                  <th className="text-left p-2 font-medium min-w-[120px]">Tehnician</th>
                                                  <th className="text-left p-2 font-medium w-24">Brand</th>
                                                  <th className="text-left p-2 font-medium w-32">Serial Number</th>
                                                  <th className="text-center p-2 font-medium w-20">Garanție</th>
                                                  <th className="text-right p-2 font-medium w-24">Total</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {visibleItems.map((item) => {
                                                  const base = item.qty * item.price
                                                  const disc = base * (Math.min(100, Math.max(0, item.discount_pct)) / 100)
                                                  const afterDisc = base - disc
                                                  // Urgent se preia de pe tăviță
                                                  const urgent = detail.tray.urgent ? afterDisc * 0.30 : 0
                                                  const lineTotal = afterDisc + urgent
                                                  
                                                  return (
                                                    <tr key={item.id} className="border-b">
                                                      <td className="p-2">
                                                        <span className={`px-2 py-1 rounded text-xs ${
                                                          item.item_type === 'service' 
                                                            ? 'bg-blue-100 text-blue-800' 
                                                            : 'bg-amber-100 text-amber-800'
                                                        }`}>
                                                          {item.item_type === 'service' ? 'Serviciu' : 'Piesă'}
                                                        </span>
                                                      </td>
                                                      <td className="p-2 font-medium">{item.name_snapshot || '—'}</td>
                                                      <td className="p-2">{item.instrument_name || '—'}</td>
                                                      <td className="p-2 text-center">{item.qty}</td>
                                                      <td className="p-2 text-right">{item.price.toFixed(2)}</td>
                                                      <td className="p-2 text-center">{item.discount_pct.toFixed(0)}%</td>
                                                      <td className="p-2">{item.department || '—'}</td>
                                                      <td className="p-2">
                                                        {item.technician_id 
                                                          ? technicians.find(t => t.id === item.technician_id)?.name || '—'
                                                          : '—'
                                                        }
                                                      </td>
                                                      <td className="p-2">{item.brand || '—'}</td>
                                                      <td className="p-2">{item.serial_number || '—'}</td>
                                                      <td className="p-2 text-center">
                                                        {item.garantie ? (
                                                          <span className="text-green-600 font-medium">Da</span>
                                                        ) : (
                                                          <span className="text-muted-foreground">—</span>
                                                        )}
                                                      </td>
                                                      <td className="p-2 text-right font-medium">{lineTotal.toFixed(2)}</td>
                                                    </tr>
                                                  )
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                          
                                          <div className="mt-4 pt-4 border-t">
                                            <div className="flex justify-end space-x-6 text-sm">
                                              <div>
                                                <span className="text-muted-foreground">Subtotal: </span>
                                                <span className="font-medium">{detail.subtotal.toFixed(2)} RON</span>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground">Discount: </span>
                                                <span className="font-medium text-red-500">-{detail.discount.toFixed(2)} RON</span>
                                              </div>
                                              {detail.urgent > 0 && (
                                                <div>
                                                  <span className="text-muted-foreground">Urgent (+30%): </span>
                                                  <span className="font-medium text-amber-600">+{detail.urgent.toFixed(2)} RON</span>
                                                </div>
                                              )}
                                              {detail.subscriptionDiscount > 0 && (
                                                <div className="flex flex-col items-end gap-1">
                                                  {detail.subscriptionDiscountServices > 0 && (
                                                    <div>
                                                      <span className="text-muted-foreground">Abonament servicii (-10%): </span>
                                                      <span className="font-medium text-green-600">-{detail.subscriptionDiscountServices.toFixed(2)} RON</span>
                                                    </div>
                                                  )}
                                                  {detail.subscriptionDiscountParts > 0 && (
                                                    <div>
                                                      <span className="text-muted-foreground">Abonament piese (-5%): </span>
                                                      <span className="font-medium text-green-600">-{detail.subscriptionDiscountParts.toFixed(2)} RON</span>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                              <div>
                                                <span className="text-muted-foreground">Total: </span>
                                                <span className="font-semibold text-lg">{detail.total.toFixed(2)} RON</span>
                                              </div>
                                            </div>
                                          </div>
                                        </>
                                      )}
                                      </div>
                                    )
                                  })}
                                  
                                  {/* Total general pentru toate tăvițele */}
                                  {traysDetails.length > 0 && (
                                    <div className="mt-6 pt-4 border-t">
                                      <div className="flex justify-end">
                                        <div className="text-right space-y-1">
                                          <div className="text-sm text-muted-foreground mb-2">Total toate tăvițele:</div>
                                          {(() => {
                                            // Calculează totalurile generale manual pentru a include corect reducerile pentru abonamente
                                            const generalSubtotal = traysDetails.reduce((acc, d) => acc + d.subtotal, 0)
                                            const generalDiscount = traysDetails.reduce((acc, d) => acc + d.discount, 0)
                                            const generalUrgent = traysDetails.reduce((acc, d) => acc + d.urgent, 0)
                                            const generalSubscriptionDiscountServices = traysDetails.reduce((acc, d) => acc + (d.subscriptionDiscountServices || 0), 0)
                                            const generalSubscriptionDiscountParts = traysDetails.reduce((acc, d) => acc + (d.subscriptionDiscountParts || 0), 0)
                                            const generalSubscriptionDiscount = generalSubscriptionDiscountServices + generalSubscriptionDiscountParts
                                            
                                            // Calculează totalul general: subtotal - discount + urgent - subscriptionDiscount
                                            const generalTotal = generalSubtotal - generalDiscount + generalUrgent - generalSubscriptionDiscount
                                            
                                            return (
                                              <div className="flex justify-end space-x-6 text-sm">
                                                <div>
                                                  <span className="text-muted-foreground">Subtotal: </span>
                                                  <span className="font-medium">{generalSubtotal.toFixed(2)} RON</span>
                                                </div>
                                                <div>
                                                  <span className="text-muted-foreground">Discount: </span>
                                                  <span className="font-medium text-red-500">-{generalDiscount.toFixed(2)} RON</span>
                                                </div>
                                                {generalUrgent > 0 && (
                                                  <div>
                                                    <span className="text-muted-foreground">Urgent (+30%): </span>
                                                    <span className="font-medium text-amber-600">+{generalUrgent.toFixed(2)} RON</span>
                                                  </div>
                                                )}
                                                {generalSubscriptionDiscount > 0 && (
                                                  <div className="flex flex-col items-end gap-1">
                                                    {generalSubscriptionDiscountServices > 0 && (
                                                      <div>
                                                        <span className="text-muted-foreground">Abonament servicii (-10%): </span>
                                                        <span className="font-medium text-green-600">-{generalSubscriptionDiscountServices.toFixed(2)} RON</span>
                                                      </div>
                                                    )}
                                                    {generalSubscriptionDiscountParts > 0 && (
                                                      <div>
                                                        <span className="text-muted-foreground">Abonament piese (-5%): </span>
                                                        <span className="font-medium text-green-600">-{generalSubscriptionDiscountParts.toFixed(2)} RON</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                                <div>
                                                  <span className="text-muted-foreground">Total: </span>
                                                  <span className="font-semibold text-lg">{generalTotal.toFixed(2)} RON</span>
                                                </div>
                                              </div>
                                            )
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                        {loadingTotalSum ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Se calculează...</span>
                          </div>
                        ) : totalFisaSum !== null ? (
                          <div className="text-sm font-semibold">
                            <span className="text-muted-foreground">Suma totală: </span>
                            <span className="text-lg">{totalFisaSum.toFixed(2)} RON</span>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                
                {/* Componenta Preturi cu fisaId selectată */}
                {(selectedFisaId || (isDepartmentPipeline && selectedTrayId)) ? (
                  <Preturi
                    ref={preturiRef}
                    leadId={getLeadId()}
                    lead={lead}
                    fisaId={selectedFisaId || undefined}
                    initialQuoteId={isDepartmentPipeline && selectedTrayId ? selectedTrayId : ((lead as any)?.isQuote ? (lead as any)?.quoteId : getTrayId() || undefined)}
                    pipelineSlug={pipelineSlug}
                    isDepartmentPipeline={isDepartmentPipeline}
                  />
                ) : (serviceSheets.length === 0 && !isDepartmentPipeline) || (isDepartmentPipeline && allTrays.length === 0) ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-sm font-medium text-foreground mb-2">Nu există fișe de serviciu</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Creează o fișă nouă pentru a începe să adaugi servicii și piese
                    </p>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleCreateServiceSheet}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Creează prima fișă
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-sm text-muted-foreground">
                      {isDepartmentPipeline ? 'Selectează o tăviță' : 'Selectează o fișă de serviciu'}
                    </p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="istoric" className="mt-0">
                <LeadHistory leadId={getLeadId()} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </section>
  )
}
