"use client"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { format } from "date-fns"
import type { Lead } from "@/app/(crm)/dashboard/page" 
import Preturi from '@/components/preturi';
import LeadHistory from "@/components/lead-history"
import { PrintView } from '@/components/print-view'
import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import LeadMessenger from "@/components/lead-messenger"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"
import { ChevronsUpDown, Printer, Mail, Phone, Copy, Check, Loader2, FileText, History, MessageSquare, X as XIcon, ChevronDown, ChevronRight, User, Building, Info, MapPin } from "lucide-react"
import { listTags, toggleLeadTag, type Tag, type TagColor } from "@/lib/supabase/tagOperations"
import { supabaseBrowser } from "@/lib/supabase/supabaseClient"
import { useRole } from "@/hooks/useRole"
import { useAuth } from "@/hooks/useAuth"
import { 
  listServiceFilesForLead, 
  createServiceFile, 
  listTraysForServiceFile,
  listTrayItemsForTray,
  type ServiceFile,
  type TrayItem,
  type Tray
} from "@/lib/supabase/serviceFileOperations"

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
  // Generează un număr pentru fișă
  const { data: existing } = await listServiceFilesForLead(leadId)
  const nextNumber = `${(existing?.length || 0) + 1}`
  
  const serviceFileData = {
    lead_id: leadId,
    number: name || `Fisa ${nextNumber}`,
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

const listQuoteItems = async (
  quoteId: string, 
  services?: any[], 
  instrumentPipelineMap?: Map<string, string | null>,
  pipelineMap?: Map<string, string>
): Promise<any[]> => {
  const { data, error } = await listTrayItemsForTray(quoteId)
  if (error) {
    console.error('Error loading tray items:', error)
    return []
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
    if (instrumentId && instrumentPipelineMap && pipelineMap) {
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
      department, // Departament preluat din instruments.pipeline
      qty: item.qty || 1,
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

  // Obține rolul utilizatorului curent
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

  const [section, setSection] = useState<"fisa" | "istoric">("fisa")
  const [stage, setStage] = useState(lead.stage)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  
  // State pentru fișe de serviciu
  const [serviceSheets, setServiceSheets] = useState<ServiceSheet[]>([])
  const [selectedFisaId, setSelectedFisaId] = useState<string | null>(null)
  const [loadingSheets, setLoadingSheets] = useState(false)
  
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
  const [isMessengerOpen, setIsMessengerOpen] = useState(false)

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
  const getServiceFileId = useCallback(() => {
    const leadAny = lead as any
    if (leadAny?.type === 'service_file') {
      return lead.id // Pentru service_file, id-ul cardului este fisaId
    }
    return null
  }, [lead])
  
  // Helper pentru a obține trayId-ul corect pentru trays
  const getTrayId = useCallback(() => {
    const leadAny = lead as any
    if (leadAny?.type === 'tray') {
      return lead.id // Pentru tray, id-ul cardului este trayId
    }
    return null
  }, [lead])

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
  }, [getLeadId(), lead.stage])

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
        const serviceFileId = getServiceFileId()
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

  // Încarcă tehnicienii
  useEffect(() => {
    const loadTechnicians = async () => {
      try {
        // Obține membrii din app_members pentru tehnicieni (folosim câmpul name)
        const supabaseClient = supabaseBrowser()
        const { data: membersData, error } = await supabaseClient
          .from('app_members')
          .select('user_id, name, email')
          .order('created_at', { ascending: true })
        
        if (error) {
          console.error('Error loading app_members:', error)
          // Încearcă să încarce doar user_id și email dacă name nu există
          try {
            const { data: fallbackData, error: fallbackError } = await supabaseClient
              .from('app_members')
              .select('user_id, email')
              .order('created_at', { ascending: true })
            
            if (fallbackError) {
              console.error('Error loading app_members with fallback:', fallbackError)
              setTechnicians([])
              return
            }
            
            if (fallbackData && fallbackData.length > 0) {
              const techs: Technician[] = fallbackData.map((m: any) => {
                let name = 'Necunoscut'
                if (m.email) {
                  name = m.email.split('@')[0]
                } else if (m.user_id) {
                  name = `User ${m.user_id.slice(0, 8)}`
                }
                return {
                  id: m.user_id,
                  name: name
                }
              })
              techs.sort((a, b) => a.name.localeCompare(b.name))
              setTechnicians(techs)
              return
            }
          } catch (fallbackError) {
            console.error('Error loading app_members with fallback:', fallbackError)
          }
          setTechnicians([])
          return
        }
        
        if (!membersData || membersData.length === 0) {
          setTechnicians([])
          return
        }
        
        // Transformă membrii în tehnicieni folosind câmpul name
        const techs: Technician[] = (membersData || []).map((m: any) => {
          // Folosește câmpul name, cu fallback la email sau user_id
          let name = m.name || m.Name || null
          if (!name && m.email) {
            name = m.email.split('@')[0]
          }
          if (!name && m.user_id) {
            name = `User ${m.user_id.slice(0, 8)}`
          }
          if (!name) {
            name = 'Necunoscut'
          }
          
          if (name === 'Necunoscut' && m.email) {
            name = m.email.split('@')[0]
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
    setNuRaspunde(checked)
    
    // Dacă checkbox-ul este activat și suntem în pipeline-ul Vânzări
    if (checked && isVanzariPipeline) {
      // Verifică dacă stage-ul "NU RASPUNDE" există în lista de stages
      const nuRaspundeStage = stages.find(stage => stage === 'NU RASPUNDE')
      if (nuRaspundeStage) {
        handleStageChange('NU RASPUNDE')
      }
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
      const [services, instrumentsResult, pipelinesResult] = await Promise.all([
        listServices(),
        supabaseClient.from('instruments').select('id,pipeline').then(({ data, error }) => {
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
      
      // Încarcă toate tăvițele din fișă
      const trays = await listTraysForServiceSheet(fisaId)
      
      // Pentru fiecare tăviță, încarcă items-urile și calculează totalurile
      // Folosim exact aceeași logică ca în preturi.tsx
      const details = await Promise.all(
        trays.map(async (tray) => {
          const items = await listQuoteItems(tray.id, services, instrumentPipelineMap, pipelineMap)
          
          // Exclude items-urile cu item_type: null (doar instrument, fără serviciu) din calculele de totaluri
          const visibleItems = items.filter(it => it.item_type !== null)
          
          // Calculează totalurile folosind aceeași logică ca în preturi.tsx
          const subtotal = visibleItems.reduce((acc, it) => acc + it.qty * it.price, 0)
          
          const totalDiscount = visibleItems.reduce(
            (acc, it) => acc + it.qty * it.price * (Math.min(100, Math.max(0, it.discount_pct)) / 100),
            0
          )
          
          const urgentAmount = visibleItems.reduce((acc, it) => {
            const afterDisc = it.qty * it.price * (1 - Math.min(100, Math.max(0, it.discount_pct)) / 100)
            return acc + (it.urgent ? afterDisc * (30 / 100) : 0) // 30% markup pentru urgent (URGENT_MARKUP_PCT)
          }, 0)
          
          // Calculează reducerile pentru abonament (10% servicii, 5% piese) - exact ca în preturi.tsx PrintViewData
          const subscriptionType = tray.subscription_type || null
          
          // Calculează totalul pentru servicii (afterDisc + urgent)
          const servicesTotal = visibleItems
            .filter(it => it.item_type === 'service')
            .reduce((acc, it) => {
              const base = it.qty * it.price
              const disc = base * (Math.min(100, Math.max(0, it.discount_pct)) / 100)
              const afterDisc = base - disc
              const urgent = it.urgent ? afterDisc * (30 / 100) : 0
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
        supabaseClient.from('instruments').select('id,pipeline').then(({ data, error }) => {
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
      
      const trays = await listTraysForServiceSheet(fisaId)
      
      let totalSum = 0
      
      for (const tray of trays) {
        const items = await listQuoteItems(tray.id, services, instrumentPipelineMap, pipelineMap)
        
        // Exclude items-urile cu item_type: null (doar instrument, fără serviciu) din calculele de totaluri
        const visibleItems = items.filter(it => it.item_type !== null)
        
        // Calculează totalurile folosind aceeași logică ca în loadTraysDetails
        const subtotal = visibleItems.reduce((acc, it) => acc + it.qty * it.price, 0)
        
        const totalDiscount = visibleItems.reduce(
          (acc, it) => acc + it.qty * it.price * (Math.min(100, Math.max(0, it.discount_pct)) / 100),
          0
        )
        
        const urgentAmount = visibleItems.reduce((acc, it) => {
          const afterDisc = it.qty * it.price * (1 - Math.min(100, Math.max(0, it.discount_pct)) / 100)
          return acc + (it.urgent ? afterDisc * (30 / 100) : 0)
        }, 0)
        
        const subscriptionType = tray.subscription_type || null
        
        const servicesTotal = visibleItems
          .filter(it => it.item_type === 'service')
          .reduce((acc, it) => {
            const base = it.qty * it.price
            const disc = base * (Math.min(100, Math.max(0, it.discount_pct)) / 100)
            const afterDisc = base - disc
            const urgent = it.urgent ? afterDisc * (30 / 100) : 0
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
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])
  
  return (
    <section ref={panelRef} className="h-full flex flex-col bg-card">
      <header className="border-b p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{lead.name}</h2>

            <div className="mt-2 flex items-center gap-2">
              {/* Add tags button + multi-select */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 px-2">
                    Add tags
                    <ChevronsUpDown className="ml-1 h-4 w-4 opacity-60" />
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
                    const isUrgentOrRetur = tag.name.toLowerCase() === 'urgent' || tag.name === 'RETUR'
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

          <div className="flex flex-col gap-3 items-end">
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  window.print()
                }}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
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
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            </div>

            {/* checkbox-uri cu butoane - vizibile doar in Receptie, Vanzari, Curier */}
            {showActionCheckboxes && (
              <div className="flex flex-wrap gap-2">
                {/* Checkbox-uri pentru Curier */}
                {isCurierPipeline ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="curier-trimis"
                        checked={curierTrimis}
                        onCheckedChange={(c: any) => setCurierTrimis(!!c)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurierTrimis(!curierTrimis)}
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
                    {!isCurierPipeline && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="call-back"
                          checked={callBack}
                          onCheckedChange={(c: any) => setCallBack(!!c)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCallBack(!callBack)}
                        >
                          Call back
                        </Button>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="nu-raspunde"
                        checked={nuRaspunde}
                        onCheckedChange={(c: any) => handleNuRaspundeChange(!!c)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleNuRaspundeChange(!nuRaspunde)}
                      >
                        Nu raspunde
                      </Button>
                    </div>
                    
                    {/* "No deal" - doar pentru vânzători în pipeline-ul Vânzări */}
                    {isVanzator && isVanzariPipeline && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="no-deal"
                          checked={noDeal}
                          onCheckedChange={(c: any) => setNoDeal(!!c)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setNoDeal(!noDeal)}
                        >
                          No deal
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4 items-start p-4">
        {/* LEFT column — identity & meta */}
        <div className="space-y-3">
          {/* Contact Info - Collapsible */}
          <Collapsible open={isContactOpen} onOpenChange={setIsContactOpen}>
            <div className="rounded-lg border bg-muted/30">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors rounded-t-lg">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Informații Contact</span>
                </div>
                {isContactOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              
              <CollapsibleContent className="px-3 pb-3 space-y-3">
          <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">Nume</label>
                  <p className="text-sm font-medium">{lead.name}</p>
          </div>

          {lead.company && (
            <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase">Companie</label>
                    <p className="text-sm">{lead.company}</p>
            </div>
          )}

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

          {(lead as any).address && (
            <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase">Adresă</label>
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

          {/* Acțiuni - Stage & Pipeline */}
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
          </div>

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
            <Tabs value={section} onValueChange={(v) => setSection(v as "fisa" | "istoric")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="fisa" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Fișa de serviciu</span>
                  <span className="sm:hidden">Fișă</span>
                </TabsTrigger>
                <TabsTrigger value="istoric" className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  <span>Istoric</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="fisa" className="mt-0">
                {/* Selector de fișe de serviciu */}
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex-1">
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
                      {/* Buton "Fișă nouă" - pentru pipeline-urile Vânzări și Receptie */}
                      {(isVanzariPipeline || isReceptiePipeline) && (
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
                      {selectedFisaId && (
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
                                        <h3 className="font-medium mb-3">Tăviță {index + 1}: {detail.tray.name}</h3>
                                        
                                        {visibleItems.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Nu există poziții în această tăviță</p>
                                      ) : (
                                        <>
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-sm border-collapse min-w-full">
                                              <thead>
                                                <tr className="border-b bg-muted/50">
                                                  <th className="text-left p-2 font-medium w-20">Tip</th>
                                                  <th className="text-left p-2 font-medium min-w-[200px]">Nume</th>
                                                  <th className="text-center p-2 font-medium w-16">Cant.</th>
                                                  <th className="text-right p-2 font-medium w-24">Preț unitar</th>
                                                  <th className="text-center p-2 font-medium w-16">Disc%</th>
                                                  <th className="text-center p-2 font-medium w-20">Urgent</th>
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
                                                  const urgent = item.urgent ? afterDisc * 0.30 : 0
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
                                                      <td className="p-2">{item.name_snapshot}</td>
                                                      <td className="p-2 text-center">{item.qty}</td>
                                                      <td className="p-2 text-right">{item.price.toFixed(2)}</td>
                                                      <td className="p-2 text-center">{item.discount_pct.toFixed(0)}%</td>
                                                      <td className="p-2 text-center">
                                                        {item.urgent ? (
                                                          <span className="text-amber-600 font-medium">Da</span>
                                                        ) : (
                                                          <span className="text-muted-foreground">—</span>
                                                        )}
                                                      </td>
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
                  </div>
                </div>
                
                {/* Componenta Preturi cu fisaId selectată */}
                {selectedFisaId ? (
                  <Preturi 
                    leadId={getLeadId()} 
                    lead={lead} 
                    fisaId={selectedFisaId}
                    initialQuoteId={(lead as any)?.isQuote ? (lead as any)?.quoteId : getTrayId() || undefined}
                    pipelineSlug={pipelineSlug}
                  />
                ) : serviceSheets.length === 0 ? (
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
                    <p className="text-sm text-muted-foreground">Selectează o fișă de serviciu</p>
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
