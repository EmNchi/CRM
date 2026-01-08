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
import PreturiMain from '../preturi/core/PreturiMain';
import type { PreturiRef } from '@/lib/types/preturi';
import LeadHistory from "./lead-history"
import { PrintView } from '@/components/print'
import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { debounce } from "@/lib/utils"
import LeadMessenger from "./lead-messenger"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"
import { ChevronsUpDown, Printer, Mail, Phone, Copy, Check, Loader2, FileText, History, MessageSquare, X as XIcon, ChevronDown, ChevronRight, User, Building, Info, MapPin, CheckCircle, Clock, Wrench, Package } from "lucide-react"
// Import componente refactorizate din lead-details
import { LeadDetailsHeader, LeadDetailsTabs } from '../lead-details/header'
import { 
  LeadContactInfo, 
  LeadTrayInfo, 
  LeadTagsSection, 
  LeadPipelinesSection, 
  LeadMessengerSection, 
  LeadServiceFilesSelector 
} from '../lead-details/sections'
import { LeadDepartmentActions } from '../lead-details/actions'
// Import hook-uri refactorizate
import { useLeadDetailsBusiness } from '@/hooks/leadDetails/useLeadDetailsBusiness'
import { listTags, toggleLeadTag, type Tag, type TagColor } from "@/lib/supabase/tagOperations"
import { supabaseBrowser } from "@/lib/supabase/supabaseClient"
import { useRole, useAuth } from "@/lib/contexts/AuthContext"
import { deleteLead } from "@/lib/supabase/leadOperations"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Trash2 } from "lucide-react"
import { 
  listServiceFilesForLead, 
  createServiceFile,
  createTray,
  listTraysForServiceFile,
  listTrayItemsForTray,
  getNextGlobalServiceFileNumber,
  getServiceFile,
  type ServiceFile,
  type TrayItem,
  type Tray
} from "@/lib/supabase/serviceFileOperations"
import { 
  listServiceSheetsForLead, 
  listTraysForServiceSheet, 
  listQuotesForLead, 
  listQuoteItems 
} from "@/hooks/leadDetails/useLeadDetailsDataLoader"
import { createServiceSheet } from "@/hooks/leadDetails/useLeadDetailsServiceFiles"
import { moveItemToStage } from "@/lib/supabase/pipelineOperations"
import { logItemEvent } from "@/lib/supabase/leadOperations"

// Tipuri pentru UI (alias-uri pentru claritate)
type ServiceSheet = ServiceFile & { fisa_index?: number }
type LeadQuote = Tray
type LeadQuoteItem = TrayItem

// Funcții wrapper pentru transformarea datelor
// NOTĂ: Funcțiile helper (listServiceSheetsForLead, createServiceSheet, listTraysForServiceSheet, listQuotesForLead, listQuoteItems) 
// sunt importate din hook-uri

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
  lead: initialLead,
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
  
  // State local pentru lead - permite actualizarea după salvarea informațiilor de contact
  const [lead, setLead] = useState<Maybe<Lead>>(initialLead)
  
  // Sincronizează cu prop-ul când lead-ul extern se schimbă
  useEffect(() => {
    setLead(initialLead)
  }, [initialLead])
  
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
  // NOTĂ: showDeleteDialog și isDeleting sunt gestionate în business.state
  const isOwner = role === 'owner'
  
  // Ref pentru componenta Preturi - pentru a apela salvarea la Close
  const preturiRef = useRef<PreturiRef>(null)
  
  // State pentru datele TrayTabs
  const [trayTabsData, setTrayTabsData] = useState<{
    quotes?: LeadQuote[]
    selectedQuoteId?: string | null
    isVanzatorMode?: boolean
    sendingTrays?: boolean
    traysAlreadyInDepartments?: boolean
    onTraySelect?: (trayId: string) => void
    onAddTray?: () => void
    onDeleteTray?: (trayId: string) => void
    onSendTrays?: () => void
  }>({})
  
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

  // Folosește hook-ul principal de business pentru a obține state-urile și funcțiile
  const business = useLeadDetailsBusiness({
    lead,
    pipelineSlug,
    pipelines,
    stages,
    isVanzariPipeline,
    isReceptiePipeline,
    isCurierPipeline,
    isDepartmentPipeline,
    isReparatiiPipeline,
    isSaloaneHorecaFrizeriiPipeline,
    onStageChange,
    onTagsChange,
    onMoveToPipeline,
    onBulkMoveToPipelines,
    onClose,
    user,
  })

  // NOTĂ: Toate state-urile sunt gestionate în useLeadDetailsBusiness hook
  // Folosim business.state.* pentru toate state-urile
  
  // Obține datele din preturiRef după ce componenta este montată
  useEffect(() => {
    const updateTrayTabsData = () => {
      if (preturiRef.current) {
        setTrayTabsData({
          quotes: preturiRef.current.getQuotes(),
          selectedQuoteId: preturiRef.current.getSelectedQuoteId(),
          isVanzatorMode: preturiRef.current.getIsVanzatorMode(),
          sendingTrays: preturiRef.current.getSendingTrays(),
          traysAlreadyInDepartments: preturiRef.current.getTraysAlreadyInDepartments(),
          onTraySelect: preturiRef.current.getOnTraySelect(),
          onAddTray: preturiRef.current.getOnAddTray(),
          onDeleteTray: preturiRef.current.getOnDeleteTray(),
          onSendTrays: preturiRef.current.getOnSendTrays(),
        })
      }
    }
    
    // Actualizează datele imediat
    updateTrayTabsData()
    
    // Actualizează datele periodic (pentru a captura schimbările)
    const interval = setInterval(updateTrayTabsData, 500)
    
    return () => clearInterval(interval)
  }, [business.state.selectedFisaId]) // Re-actualizează când se schimbă fișa selectată
  
  const allPipeNames = pipelines ?? []

  // NOTĂ: getLeadId, getServiceFileId, getTrayId sunt deja în business.*
  // NOTĂ: saveServiceFileDetails și handleCloseWithSave sunt deja în business.trayDetails și business.handleCloseWithSave

  // Încarcă detaliile pentru fișa de serviciu (nu mai la nivel de lead)
  // Această funcție este folosită pentru pipeline-urile Vânzări/Recepție/Curier
  useEffect(() => {
    const loadServiceFileDetails = async () => {
      const serviceFileId = await business.getServiceFileId()
      if (!serviceFileId) {
        business.state.setTrayDetails('')
        return
      }

      try {
        const { data, error } = await supabase
          .from('service_files')
          .select('details')
          .eq('id', serviceFileId)
          .single()

        if (!error && data) {
          const detailsValue = (data as any)?.details || ''
          
          // Încearcă să parseze ca JSON pentru a extrage doar textul
          try {
            const parsedDetails = JSON.parse(detailsValue)
            if (typeof parsedDetails === 'object' && parsedDetails !== null && parsedDetails.text !== undefined) {
              // Dacă este JSON cu text și payment info, extrage doar textul
              business.state.setTrayDetails(parsedDetails.text || '')
            } else {
              // Dacă este doar text, păstrează-l
              business.state.setTrayDetails(detailsValue)
            }
          } catch {
            // Dacă nu este JSON, este doar text
            business.state.setTrayDetails(detailsValue)
          }
        } else {
          business.state.setTrayDetails('')
        }
      } catch (err) {
        console.error('Error loading service file details:', err)
        business.state.setTrayDetails('')
      }
    }

    // Încarcă detaliile pentru toate pipeline-urile (nu doar pentru departamente)
    loadServiceFileDetails()
  }, [lead.id, business.getServiceFileId, supabase])

  const togglePipe = (name: string) =>
    business.state.setSelectedPipes(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name])

  const pickAll = () => business.state.setSelectedPipes(allPipeNames)
  const clearAll = () => business.state.setSelectedPipes([])

  useEffect(() => {
    const ch = supabase
      .channel('rt-tags-lead-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' },
        () => listTags().then(business.state.setAllTags).catch(console.error)
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { listTags().then(business.state.setAllTags).catch(console.error) }, [])

  useEffect(() => {
    if (!lead) return
    business.state.setSelectedTagIds((lead.tags ?? []).map(t => t.id))
  }, [lead?.id])

  useEffect(() => {
    business.state.setStage(lead.stage)
    
    // Setează starea checkbox-urilor pe baza stage-ului curent (doar în Vânzări)
    if (isVanzariPipeline) {
      const currentStage = lead.stage?.toUpperCase() || ''
      
      // Verifică dacă stage-ul curent corespunde unuia dintre checkbox-uri
      if (currentStage.includes('NO DEAL') || currentStage.includes('NO-DEAL')) {
        business.state.setNoDeal(true)
        business.state.setCallBack(false)
        business.state.setNuRaspunde(false)
      } else if (currentStage.includes('CALLBACK') || currentStage.includes('CALL BACK') || currentStage.includes('CALL-BACK')) {
        business.state.setNoDeal(false)
        business.state.setCallBack(true)
        business.state.setNuRaspunde(false)
      } else if (currentStage.includes('RASPUNDE') || currentStage.includes('RASUNDE')) {
        business.state.setNoDeal(false)
        business.state.setCallBack(false)
        business.state.setNuRaspunde(true)
      } else {
        // Dacă stage-ul nu corespunde niciunui checkbox, dezactivează toate
        business.state.setNoDeal(false)
        business.state.setCallBack(false)
        business.state.setNuRaspunde(false)
      }
    }
  }, [business.getLeadId(), lead.stage, isVanzariPipeline])

  // NOTĂ: Logica de încărcare a service sheets este deja în business.dataLoader.*
  // Hook-ul useLeadDetailsDataLoader gestionează totul, nu mai este nevoie de duplicate aici

  // Încarcă toate tăvițele pentru lead în pipeline-urile departament
  useEffect(() => {
    if (!isDepartmentPipeline) return
    
    const leadIdToUse = business.getLeadId()
    if (!leadIdToUse) return
    
    let isMounted = true
    
    const loadTrays = async () => {
      business.state.setLoadingTrays(true)
      try {
        // Folosește funcția din hook pentru a evita duplicate calls
        const sheets = await business.dataLoader.loadServiceSheets(leadIdToUse)
        if (!isMounted) return
        
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
        
        if (!isMounted) return
        
        business.state.setAllTrays(allTraysList)
        
        // Dacă este un tray (vine din pipeline departament), selectează-l direct
        const trayId = business.getTrayId()
        if (trayId) {
          const foundTray = allTraysList.find(t => t.id === trayId)
          if (foundTray) {
            business.state.setSelectedTrayId(trayId)
            // Setează și service_file_id pentru Preturi
            business.state.setSelectedFisaId(foundTray.service_file_id)
          } else if (allTraysList.length > 0) {
            // Selectează prima tăviță
            business.state.setSelectedTrayId(allTraysList[0].id)
            business.state.setSelectedFisaId(allTraysList[0].service_file_id)
          }
        } else if (allTraysList.length > 0 && !business.state.selectedTrayId) {
          // Selectează prima tăviță dacă nu avem deja una selectată
          business.state.setSelectedTrayId(allTraysList[0].id)
          business.state.setSelectedFisaId(allTraysList[0].service_file_id)
        }
      } catch (error) {
        if (!isMounted) return
        console.error('Error loading trays:', error)
        toast.error('Eroare la încărcarea tăvițelor')
      } finally {
        if (isMounted) {
          business.state.setLoadingTrays(false)
        }
      }
    }
    
    loadTrays()
    
    return () => {
      isMounted = false
    }
  }, [isDepartmentPipeline, business.getLeadId(), business.getTrayId(), business.dataLoader.loadServiceSheets])

  // Încarcă detaliile pentru fișa de serviciu (nu mai per tăviță)
  useEffect(() => {
    const loadServiceFileDetails = async () => {
      business.state.setLoadingTrayDetails(true)
      try {
        const serviceFileId = await business.getServiceFileId()
        if (!serviceFileId) {
          business.state.setTrayDetails('')
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
          business.state.setTrayDetails('')
          return
        }
        
        const detailsValue = serviceFile?.details || ''
        
        // Încearcă să parseze ca JSON pentru a extrage doar textul
        try {
          const parsedDetails = JSON.parse(detailsValue)
          if (typeof parsedDetails === 'object' && parsedDetails !== null && parsedDetails.text !== undefined) {
            // Dacă este JSON cu text și payment info, extrage doar textul
            business.state.setTrayDetails(parsedDetails.text || '')
          } else {
            // Dacă este doar text, păstrează-l
            business.state.setTrayDetails(detailsValue)
          }
        } catch {
          // Dacă nu este JSON, este doar text
          business.state.setTrayDetails(detailsValue)
        }
      } catch (err) {
        console.error('Error loading service file details:', err)
        business.state.setTrayDetails('')
      } finally {
        business.state.setLoadingTrayDetails(false)
      }
    }
    
    loadServiceFileDetails()
  }, [business.getServiceFileId])

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
          business.state.setTechnicians([])
          return
        }
        
        if (!membersData || membersData.length === 0) {
          business.state.setTechnicians([])
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
        business.state.setTechnicians(techs)
      } catch (error) {
        console.error('Error loading technicians:', error)
      }
    }
    loadTechnicians()
  }, [])

  // NOTĂ: handleToggleTag este deja în business.tags.handleToggleTag
  // NOTĂ: handleStageChange este deja în business.handleStageChange
  // NOTĂ: handleNuRaspundeChange, handleNoDealChange, handleCallBackChange sunt deja în business.checkboxes.*


  // functii pentru contacte
  const handleCopy = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      business.state.setCopiedField(field)
      toast.success('Copiat în clipboard', {
        description: `${field} a fost copiat`
      })
      setTimeout(() => business.state.setCopiedField(null), 2000)
    } catch (error) {
      toast.error('Eroare la copiere')
    }
  }, [business.state.setCopiedField])

  const handlePhoneClick = useCallback((phone: string) => {
    window.location.href = `tel:${phone}`
  }, [])

  const handleEmailClick = useCallback((email: string) => {
    const subject = encodeURIComponent(`Comanda Ascutzit.ro`)
    const body = encodeURIComponent(`Va contactez in legatura cu comanda dvs facuta la Ascutzit.ro`)
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`, '_blank')
  }, [])

  // NOTĂ: handleFinalizare, handleAsteptPiese, handleInAsteptare, handleInLucru sunt deja în business.departmentActions.*

  // NOTĂ: handleCreateServiceSheet este deja în business.serviceFiles.handleCreateServiceSheet

  // NOTĂ: loadTraysDetails și calculateTotalFisaSum sunt deja în business.dataLoader.*
  
  // Calculează suma totală când se schimbă fișa selectată
  useEffect(() => {
    if (business.state.selectedFisaId) {
      business.dataLoader.calculateTotalFisaSum(business.state.selectedFisaId)
    } else {
      business.state.setTotalFisaSum(null)
    }
  }, [business.state.selectedFisaId, business.dataLoader.calculateTotalFisaSum])

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
        business.handleCloseWithSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [business.handleCloseWithSave])
  
  return (
    <section ref={business.state.panelRef} className="h-full flex flex-col bg-card">
      {/* Header refactorizat */}
      <LeadDetailsHeader
        leadName={lead.name}
        leadEmail={lead.email}
        leadPhone={lead.phone}
        isOwner={isOwner}
        isAdmin={role === 'admin' || role === 'owner'}
        isDepartmentPipeline={isDepartmentPipeline}
        showActionCheckboxes={showActionCheckboxes}
        isCurierPipeline={isCurierPipeline}
        isReceptiePipeline={isReceptiePipeline}
        isVanzariPipeline={isVanzariPipeline}
        allTags={business.state.allTags}
        selectedTagIds={business.state.selectedTagIds}
        onToggleTag={business.tags.handleToggleTag}
        tagClass={business.tags.tagClass}
        isDepartmentTag={business.tags.isDepartmentTag}
        getDepartmentBadgeStyle={business.tags.getDepartmentBadgeStyle}
        callBack={business.state.callBack}
        nuRaspunde={business.state.nuRaspunde}
        noDeal={business.state.noDeal}
        onCallBackChange={business.checkboxes.handleCallBackChange}
        onNuRaspundeChange={business.checkboxes.handleNuRaspundeChange}
        onNoDealChange={business.checkboxes.handleNoDealChange}
        coletAjuns={business.checkboxes.coletAjuns}
        curierRetur={business.checkboxes.curierRetur}
        coletTrimis={business.checkboxes.coletTrimis}
        asteptRidicarea={business.checkboxes.asteptRidicarea}
        ridicPersonal={business.checkboxes.ridicPersonal}
        onColetAjunsChange={business.checkboxes.setColetAjuns}
        onCurierReturChange={business.checkboxes.setCurierRetur}
        onColetTrimisChange={business.checkboxes.setColetTrimis}
        onAsteptRidicareaChange={business.checkboxes.setAsteptRidicarea}
        onRidicPersonalChange={business.checkboxes.setRidicPersonal}
        onEmailClick={handleEmailClick}
        onPhoneClick={handlePhoneClick}
        onDeleteClick={() => business.state.setShowDeleteDialog(true)}
        onClose={business.handleCloseWithSave}
      />

      <div className="flex-1 overflow-y-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)] gap-3 lg:gap-4 items-start p-2 sm:p-3 lg:p-4">
        {/* LEFT column — identity & meta */}
        <div className="space-y-2 sm:space-y-3">
          {/* Contact Info - Refactorizat */}
          <LeadContactInfo
            lead={lead}
            isContactOpen={business.state.isContactOpen}
            setIsContactOpen={business.state.setIsContactOpen}
            copiedField={business.state.copiedField}
            onCopy={handleCopy}
            onPhoneClick={handlePhoneClick}
            onEmailClick={handleEmailClick}
            onLeadUpdate={(updatedLead) => {
              // Actualizează lead-ul local
              setLead(prev => prev ? { ...prev, ...updatedLead } : prev)
            }}
          />

          {/* Informații Tavita - Refactorizat */}
          {/* NOTĂ: Pentru Vânzări / Recepție / Curier, detaliile de tăviță sunt mutate în componenta `Preturi` */}
          <LeadTrayInfo
            isTrayInfoOpen={business.state.isTrayInfoOpen}
            setIsTrayInfoOpen={business.state.setIsTrayInfoOpen}
            isDepartmentPipeline={isDepartmentPipeline}
            isTechnician={isTechnician}
            isVanzator={isVanzator}
            allTrays={business.state.allTrays}
            selectedTrayId={business.state.selectedTrayId}
            getTrayId={business.getTrayId}
            trayDetails={business.state.trayDetails}
            setTrayDetails={business.state.setTrayDetails}
            loadingTrayDetails={business.state.loadingTrayDetails}
          />

          {/* Acțiuni - Stage & Pipeline */}
          {!isVanzariPipeline && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <div>
              <label className="text-xs font-medium text-muted-foreground uppercase mb-2 block">Schimbă Etapa</label>
            <Select value={business.state.stage} onValueChange={business.handleStageChange}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

            {/* Mută în Pipeline - doar pentru owner și admin - Refactorizat */}
            {canMovePipeline && (
              <LeadPipelinesSection
                allPipeNames={business.pipelines.allPipeNames}
                selectedPipes={business.state.selectedPipes}
                movingPipes={business.state.movingPipes}
                onTogglePipe={business.pipelines.togglePipe}
                onPickAll={business.pipelines.pickAll}
                onClearAll={business.pipelines.clearAll}
                onBulkMove={business.pipelines.handleBulkMoveToPipelines}
                onMoveToPipeline={business.pipelines.handleMoveToPipeline}
              />
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
                    value={business.state.selectedTechnicianId} 
                    onValueChange={business.state.setSelectedTechnicianId}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Alege tehnician" />
                    </SelectTrigger>
                    <SelectContent>
                      {business.state.technicians.map((tech) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    disabled={business.state.passingTray || !business.state.selectedTechnicianId}
                    onClick={async () => {
                      const leadAny = lead as any
                      const trayId = business.getTrayId()
                      
                      if (!trayId) {
                        toast.error('Tăvița nu a fost găsită')
                        return
                      }

                      if (!business.state.selectedTechnicianId) {
                        toast.error('Selectează un tehnician')
                        return
                      }

                      business.state.setPassingTray(true)
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
                          .update({ technician_id: business.state.selectedTechnicianId } as any)
                          .eq('tray_id', trayId)
                        
                        if (updateError) {
                          console.error('Error passing tray to technician:', updateError)
                          toast.error('Eroare la pasarea tăviței')
                          return
                        }

                        // Găsește numele tehnicienilor pentru mesaj
                        const newTech = business.state.technicians.find(t => t.id === business.state.selectedTechnicianId)
                        const newTechName = newTech?.name || 'tehnician necunoscut'
                        const prevTech = previousTechnicianId
                          ? business.state.technicians.find(t => t.id === previousTechnicianId)
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
                              to_technician_id: business.state.selectedTechnicianId,
                              tray_id: trayId,
                              lead_id: business.getLeadId(),
                            }
                          )
                        } catch (logError) {
                          console.error('Error logging tray pass event:', logError)
                        }

                        toast.success('Tăvița a fost atribuită cu succes')
                        business.state.setSelectedTechnicianId('')
                        
                        // Reîncarcă datele pentru a reflecta modificările (dacă este deschis modalul de detalii)
                        if (business.state.selectedFisaId && business.state.detailsModalOpen) {
                          business.dataLoader.loadTraysDetails(business.state.selectedFisaId)
                        }
                      } catch (error) {
                        console.error('Error passing tray:', error)
                        toast.error('Eroare la pasarea tăviței')
                      } finally {
                        business.state.setPassingTray(false)
                      }
                    }}
                  >
                    {business.state.passingTray ? "Se atribuie…" : "Pasare"}
                  </Button>
                </div>
              </div>
            )}

          
        </div>


          {/* RIGHT — switchable content cu tabs - Refactorizat */}
          <div className="min-w-0">
            <LeadDetailsTabs
              section={business.state.section}
              onSectionChange={(s) => business.state.setSection(s)}
              fisaContent={
                <>
                  {/* Department Actions - Refactorizat */}
                  <LeadDepartmentActions
                    isDepartmentPipeline={isDepartmentPipeline}
                    isReparatiiPipeline={isReparatiiPipeline}
                    isSaloaneHorecaFrizeriiPipeline={isSaloaneHorecaFrizeriiPipeline}
                    onInLucru={business.departmentActions.handleInLucru}
                    onFinalizare={business.departmentActions.handleFinalizare}
                    onAsteptPiese={business.departmentActions.handleAsteptPiese}
                    onInAsteptare={business.departmentActions.handleInAsteptare}
                  />

                  {/* Service Files Selector - Refactorizat */}
                  <LeadServiceFilesSelector
                    isDepartmentPipeline={isDepartmentPipeline}
                    isTechnician={isTechnician}
                    isVanzariPipeline={isVanzariPipeline}
                    isReceptiePipeline={isReceptiePipeline}
                    isVanzator={isVanzator}
                    serviceSheets={business.state.serviceSheets}
                    selectedFisaId={business.state.selectedFisaId}
                    loadingSheets={business.state.loadingSheets}
                    onFisaIdChange={(fisaId) => {
                      business.state.setSelectedFisaId(fisaId)
                      if (fisaId) {
                        business.dataLoader.calculateTotalFisaSum(fisaId)
                      }
                    }}
                    onCreateServiceSheet={business.serviceFiles.handleCreateServiceSheet}
                    allTrays={business.state.allTrays}
                    selectedTrayId={business.state.selectedTrayId}
                    loadingTrays={business.state.loadingTrays}
                    onTrayIdChange={(trayId, fisaId) => {
                      business.state.setSelectedTrayId(trayId)
                      business.state.setSelectedFisaId(fisaId)
                      if (fisaId) {
                        business.dataLoader.calculateTotalFisaSum(fisaId)
                      }
                    }}
                    detailsModalOpen={business.state.detailsModalOpen}
                    setDetailsModalOpen={business.state.setDetailsModalOpen}
                    onLoadTraysDetails={business.dataLoader.loadTraysDetails}
                    loadingDetails={business.state.loadingDetails}
                    traysDetails={business.state.traysDetails}
                    quotes={trayTabsData.quotes}
                    selectedQuoteId={trayTabsData.selectedQuoteId}
                    isVanzatorMode={trayTabsData.isVanzatorMode}
                    sendingTrays={trayTabsData.sendingTrays}
                    traysAlreadyInDepartments={trayTabsData.traysAlreadyInDepartments}
                    onTraySelect={trayTabsData.onTraySelect}
                    onAddTray={trayTabsData.onAddTray}
                    onDeleteTray={trayTabsData.onDeleteTray}
                    onSendTrays={trayTabsData.onSendTrays}
                  />
                  
                  {/* Total fișă - afișat doar pentru pipeline-uri non-departament */}
                  {business.state.selectedFisaId && !isDepartmentPipeline && (
                    <div className="flex items-center gap-3 mb-4">
                      {business.state.loadingTotalSum ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Se calculează...</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                  
                  {/* Componenta Preturi cu fisaId selectată */}
                  {(business.state.selectedFisaId || (isDepartmentPipeline && business.state.selectedTrayId)) ? (
                    <PreturiMain
                      ref={preturiRef}
                      leadId={business.getLeadId()}
                      lead={lead}
                      fisaId={business.state.selectedFisaId || undefined}
                      initialQuoteId={isDepartmentPipeline && business.state.selectedTrayId ? business.state.selectedTrayId : ((lead as any)?.isQuote ? (lead as any)?.quoteId : business.getTrayId() || undefined)}
                      pipelineSlug={pipelineSlug}
                      isDepartmentPipeline={isDepartmentPipeline}
                    />
                  ) : (business.state.serviceSheets.length === 0 && !isDepartmentPipeline) || (isDepartmentPipeline && business.state.allTrays.length === 0) ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-sm font-medium text-foreground mb-2">Nu există fișe de serviciu</p>
                      <p className="text-xs text-muted-foreground mb-4">
                        Creează o fișă nouă pentru a începe să adaugi servicii și piese
                      </p>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={business.serviceFiles.handleCreateServiceSheet}
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
                </>
              }
              deConfirmatContent={
                lead?.id ? (
                  <LeadMessengerSection
                    isMessengerOpen={business.state.isMessengerOpen}
                    setIsMessengerOpen={business.state.setIsMessengerOpen}
                    leadId={lead.id}
                    leadTechnician={lead.technician}
                    quotes={trayTabsData.quotes}
                    selectedQuoteId={trayTabsData.selectedQuoteId}
                    isDepartmentPipeline={isDepartmentPipeline}
                  />
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-sm text-muted-foreground">Nu este disponibil</p>
                  </div>
                )
              }
              istoricContent={
                <LeadHistory leadId={business.getLeadId()} />
              }
            />
          </div>
        </div>
      </div>

      {/* Dialog de confirmare pentru ștergere */}
      <AlertDialog open={business.state.showDeleteDialog} onOpenChange={business.state.setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ești sigur că vrei să ștergi acest lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Această acțiune va șterge permanent lead-ul "{lead?.name}" și toate datele asociate:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Toate fișele de serviciu</li>
                <li>Toate tăvițele și item-urile</li>
                <li>Toate tag-urile și istoricul</li>
              </ul>
              <strong className="text-red-600">Această acțiune este ireversibilă!</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={business.state.isDeleting}>Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!lead?.id) return
                business.state.setIsDeleting(true)
                try {
                  const { success, error } = await deleteLead(lead.id)
                  if (success) {
                    toast.success(`Lead-ul "${lead.name}" a fost șters cu succes.`)
                    business.state.setShowDeleteDialog(false)
                    onClose()
                    // Reîmprospătează pagina pentru a reflecta ștergerea
                    window.location.reload()
                  } else {
                    throw error || new Error('Eroare la ștergerea lead-ului')
                  }
                } catch (error: any) {
                  console.error('Eroare la ștergerea lead-ului:', error)
                  toast.error(error?.message || "A apărut o eroare la ștergerea lead-ului.")
                } finally {
                  business.state.setIsDeleting(false)
                }
              }}
              disabled={business.state.isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {business.state.isDeleting ? "Se șterge..." : "Șterge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
