"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { debounce, normalizePhoneNumber, matchesPhoneNumber } from "@/lib/utils"
import { KanbanBoard } from "@/components/kanban-board"
import { MobileBoardLayout } from "@/components/mobile/mobile-board-layout"
import dynamic from "next/dynamic"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { useKanbanData } from "@/hooks/useKanbanData"
import type { KanbanLead } from '@/lib/types/database'
import { useParams, useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, Settings2, Filter, X, Search, GripVertical, ArrowUp, ArrowDown } from "lucide-react"
import { useRole, useAuthContext } from '@/lib/contexts/AuthContext'
import { Sidebar } from '@/components/sidebar'
import { moveLeadToPipelineByName, getPipelineOptions, getPipelinesWithStages, updatePipelineAndStages, logLeadEvent } from "@/lib/supabase/leadOperations"
import PipelineEditor from "@/components/pipeline-editor"
import { Tag } from "@/lib/supabase/tagOperations"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createLeadWithPipeline } from "@/lib/supabase/leadOperations"
import { supabaseBrowser } from "@/lib/supabase/supabaseClient"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useUserPreferences } from "@/hooks/useUserPreferences"
import { useTechnicians } from "@/hooks/queries/use-technicians"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"

type Technician = {
  id: string // user_id din app_members
  name: string
}

const supabase = supabaseBrowser()

const toSlug = (s: string) => String(s).toLowerCase().replace(/\s+/g, "-")

const LeadDetailsPanel = dynamic(
  () => import("@/components/lead-details-panel").then(m => m.LeadDetailsPanel),
  { ssr: false }
)

export default function CRMPage() {
  const params = useParams<{ pipeline?: string }>()
  const pathname = usePathname()
  const pipelineSlug =
    params?.pipeline ??
    pathname.match(/^\/leads\/([^\/?#]+)/)?.[1] ??
    undefined

  const { toast } = useToast()
  const router = useRouter()
  
  // Detectare dimensiune ecran pentru layout responsive
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768) // md breakpoint
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorData, setEditorData] = useState<{
    pipelineId: string
    pipelineName: string
    stages: { id: string; name: string }[]
  } | null>(null)

  // State pentru dialog-ul de customizare mobil
  const [customizeOpen, setCustomizeOpen] = useState(false)

  const { isOwner, role } = useRole()
  const { hasAccess, isMember, loading: authLoading } = useAuthContext()
  
  const [createStageOpen, setCreateStageOpen] = useState(false)
  const [stageName, setStageName] = useState("")
  const [creatingStage, setCreatingStage] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)
  
  // State pentru dialog-ul de creare lead nou
  const [createLeadOpen, setCreateLeadOpen] = useState(false)
  const [newLeadData, setNewLeadData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    city: '',
    company_name: '',
    company_address: '',
    address: '',
    address2: '',
    zip: '',
    country: ''
  
  })
  const [creatingLead, setCreatingLead] = useState(false)
  const [selectedLead, setSelectedLead] = useState<KanbanLead | null>(null)
  const [leadPosition, setLeadPosition] = useState<{ x: number; y: number; side: 'left' | 'right' } | null>(null)
  const [pipelineOptions, setPipelineOptions] = useState<{ name: string; activeStages: number }[]>([])

  // Filtru pentru dată, căutare și tehnician
  const [filters, setFilters] = useState<{
    dateFilter: {
      startDate: string | null
      endDate: string | null
      enabled: boolean
    }
    searchQuery: string
    technicianId: string | null
  }>({
    dateFilter: {
      startDate: null,
      endDate: null,
      enabled: false
    },
    searchQuery: '',
    technicianId: null
  })

  // Tehnicieni - folosim hook cu cache (30 min) pentru a evita API calls pe fiecare navigare
  const { data: techniciansData, isLoading: loadingTechnicians } = useTechnicians()
  
  // Transformăm datele pentru a menține compatibilitatea cu restul componentei
  const technicians: Technician[] = useMemo(() => {
    if (!techniciansData) return []
    return techniciansData.map(member => ({
      id: member.user_id,
      name: member.name || member.email?.split('@')[0] || `User ${member.user_id.slice(0, 8)}`
    })).sort((a, b) => a.name.localeCompare(b.name))
  }, [techniciansData])

  const { leads, stages, pipelines: allPipelines, loading, error, handleLeadMove, refresh, patchLeadTags, handlePinToggle } = useKanbanData(pipelineSlug)
  
  // Preferințe utilizator pentru customizare
  const { getStageOrder, setStageOrder } = useUserPreferences()
  
  // Ordinea customizată a stage-urilor
  const orderedStages = useMemo(() => {
    if (!pipelineSlug) return stages
    return getStageOrder(pipelineSlug, stages)
  }, [pipelineSlug, stages, getStageOrder])
  
  // State pentru pipeline-uri cu ID-uri (pentru verificarea permisiunilor)
  const [pipelinesWithIds, setPipelinesWithIds] = useState<Array<{ id: string; name: string }>>([])
  
  // Încarcă pipeline-urile cu ID-uri pentru verificarea permisiunilor
  useEffect(() => {
    async function loadPipelinesWithIds() {
      if (authLoading) return
      
      const { data, error } = await getPipelinesWithStages()
      if (!error && data) {
        setPipelinesWithIds(data.map((p: any) => ({ id: p.id, name: p.name })))
      }
    }
    loadPipelinesWithIds()
  }, [authLoading])
  
  // Filtrează pipeline-urile bazat pe permisiuni reale
  const pipelines = useMemo(() => {
    if (!isMember()) return allPipelines
    
    // Pentru membri, filtrează doar pipeline-urile pentru care au permisiune
    return allPipelines.filter(p => {
      const pipelineWithId = pipelinesWithIds.find(pid => pid.name === p)
      return pipelineWithId ? hasAccess(pipelineWithId.id) : false
    })
  }, [allPipelines, pipelinesWithIds, hasAccess, isMember])
  
  // Redirectează membrii dacă încearcă să acceseze un pipeline nepermis
  useEffect(() => {
    if (authLoading || !isMember() || !pipelineSlug || pipelinesWithIds.length === 0) return
    
    const currentPipeline = pipelinesWithIds.find(p => toSlug(p.name) === pipelineSlug.toLowerCase())
    
    if (currentPipeline && !hasAccess(currentPipeline.id)) {
      // Găsește primul pipeline permis
      const firstAllowed = pipelinesWithIds.find(p => hasAccess(p.id))
      if (firstAllowed) {
        router.replace(`/leads/${toSlug(firstAllowed.name)}`)
      } else {
        // Dacă nu are niciun pipeline permis, redirectează la dashboard
        router.replace('/dashboard')
      }
    }
  }, [isMember, pipelineSlug, pipelinesWithIds, hasAccess, authLoading, router])

  // Filtrează lead-urile
  const filteredLeads = useMemo(() => {
    let result = [...leads]

    // Filtrare după dată
    if (filters.dateFilter.enabled && (filters.dateFilter.startDate || filters.dateFilter.endDate)) {
      result = result.filter(lead => {
        if (!lead.createdAt) return true // Păstrează lead-urile fără dată

        const leadDate = new Date(lead.createdAt)
        const startDate = filters.dateFilter.startDate ? new Date(filters.dateFilter.startDate) : null
        const endDate = filters.dateFilter.endDate ? new Date(filters.dateFilter.endDate + 'T23:59:59') : null

        if (startDate && leadDate < startDate) return false
        if (endDate && leadDate > endDate) return false

        return true
      })
    }

    // Căutare universală - caută în toate câmpurile disponibile
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase().trim()
      const normalizedQuery = normalizePhoneNumber(query)
      
      result = result.filter(lead => {
        const leadAny = lead as any
        
        // Caută în câmpurile de bază
        if (lead.name?.toLowerCase().includes(query)) return true
        if (lead.email?.toLowerCase().includes(query)) return true
        
        // Căutare normalizată pentru număr de telefon (suportă +40, 40, 0721, etc.)
        if (normalizedQuery && matchesPhoneNumber(query, lead.phone)) return true
        // Fallback la căutare normală dacă nu este un număr
        if (!normalizedQuery && lead.phone?.toLowerCase().includes(query)) return true
        
        // Caută în câmpurile de campanie/ad/form
        if (lead.campaignName?.toLowerCase().includes(query)) return true
        if (lead.adName?.toLowerCase().includes(query)) return true
        if (lead.formName?.toLowerCase().includes(query)) return true
        
        // Caută în tag-uri
        if (lead.tags && lead.tags.some((tag: any) => tag.name?.toLowerCase().includes(query))) return true
        
        // Caută în tehnician
        if (lead.technician?.toLowerCase().includes(query)) return true
        
        // Caută în stage
        if (lead.stage?.toLowerCase().includes(query)) return true
        
        // Pentru service files
        if (leadAny.serviceFileNumber?.toLowerCase().includes(query)) return true
        if (leadAny.serviceFileStatus?.toLowerCase().includes(query)) return true
        
        // Pentru trays/quotes
        if (leadAny.trayNumber?.toLowerCase().includes(query)) return true
        if (leadAny.traySize?.toLowerCase().includes(query)) return true
        if (leadAny.trayStatus?.toLowerCase().includes(query)) return true
        if (leadAny.leadName?.toLowerCase().includes(query)) return true
        if (leadAny.department?.toLowerCase().includes(query)) return true
        
        // Caută în total (convertit la string)
        if (leadAny.total !== undefined && String(leadAny.total).includes(query)) return true
        
        // Caută în ID-uri (dacă utilizatorul caută după ID)
        if (lead.id?.toLowerCase().includes(query)) return true
        if (lead.leadId?.toLowerCase().includes(query)) return true
        
        return false
      })
    }

    // Filtrare după tehnician
    if (filters.technicianId) {
      const selectedTechnician = technicians.find(t => t.id === filters.technicianId)
      if (selectedTechnician) {
        result = result.filter(lead => {
          if (!lead.technician) return false
          return lead.technician === selectedTechnician.name
        })
      }
    }

    return result
  }, [leads, filters, technicians])

  useEffect(() => {
    const setupSaloaneStages = async () => {
      if (loading || !pipelines.length) return
      
      if (pipelineSlug !== 'saloane') return
      
      const saloaneExists = pipelines.some(p => toSlug(p) === 'saloane')
      
      if (!saloaneExists && isOwner) {
        console.log('Creez pipeline-ul Saloane...')
        
        try {
          const pipelineRes = await fetch('/api/pipelines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Saloane' })
          })
          
          if (!pipelineRes.ok) {
            const error = await pipelineRes.json()
            throw new Error(error.error || 'Failed to create pipeline')
          }
          
          console.log('Pipeline Saloane creat cu succes')
          
          const saloaneStages = [
            'Noua', 
            'Retur',
            'In Lucru',
            'De Confirmat',
            'In Asteptare',
            'Finalizata'
          ]
          
          for (const stageName of saloaneStages) {
            const stageRes = await fetch('/api/stages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pipelineSlug: 'saloane', name: stageName })
            })
            
            if (!stageRes.ok) {
              console.error(`Eroare la crearea stage-ului ${stageName}`)
            } else {
              console.log(`Stage "${stageName}" creat cu succes`)
            }
          }
          
          await refresh()
          toast({ 
            title: 'Pipeline Saloane creat!', 
            description: `Pipeline-ul "Saloane" a fost creat cu ${saloaneStages.length} stage-uri.`
          })
          
        } catch (error: any) {
          console.error('Eroare la crearea pipeline-ului Saloane:', error)
          toast({ 
            variant: 'destructive', 
            title: 'Eroare', 
            description: error.message || 'Nu s-a putut crea pipeline-ul Saloane' 
          })
        }
      }
    }
    
    setupSaloaneStages()
  }, [loading, pipelines, pipelineSlug, isOwner, refresh, toast])

  const handleBulkMoveToPipelines = async (leadId: string, pipelineNames: string[]) => {
    try {
      // Mutarea în mai multe pipeline-uri trebuie implementată folosind pipeline_items
      // Pentru moment, funcționalitatea nu este disponibilă
      throw new Error('Bulk move to multiple pipelines is not yet implemented')
    } catch (e: any) {
      toast({ variant: "destructive", description: e?.message ?? "Move failed" })
    }
  }

  async function openEditor() {
    const { data } = await getPipelinesWithStages()
    // find current pipeline by slug
    const current = data?.find((p: any) => toSlug(p.name) === pipelineSlug) // you already have toSlug+pipelineSlug
    if (!current) return
    setEditorData({
      pipelineId: current.id,
      pipelineName: current.name,
      stages: current.stages.map((s: any) => ({ id: s.id, name: s.name })),
    })
    setEditorOpen(true)
  }

  async function handleDeleteStage(stageName: string) {
    try {
      const res = await fetch("/api/stages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineSlug, stageName }),
      })
      
      if (!res.ok) {
        const text = await res.text()
        let json
        try {
          json = JSON.parse(text)
        } catch {
          throw new Error(text || "Failed to delete stage")
        }
        throw new Error(json.error || "Failed to delete stage")
      }
      
      const json = await res.json()
      toast({ title: "Stage deleted", description: `"${stageName}" and its leads were removed.` })
      await refresh()
    } catch (err: any) {
      console.error('Error deleting stage:', err)
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: err.message || "Failed to delete stage" 
      })
      throw err
    }
  }
  
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const rows = await getPipelineOptions()
        const byName = new Map(rows.map(r => [r.name, r.active_stages]))
        const opts = pipelines.map(name => ({ name, activeStages: byName.get(name) ?? 0 }))
        if (alive) setPipelineOptions(opts)
      } catch {
        // graceful fallback
        if (alive) setPipelineOptions(pipelines.map(name => ({ name, activeStages: 0 })))
      }
    })()
    return () => { alive = false }
  }, [pipelines])

  const activePipelineName =
    useMemo(() =>
      pipelines.find(p => toSlug(String(p)) === pipelineSlug)?.toString() ?? pipelineSlug,
      [pipelines, pipelineSlug]
    )

  const handleCloseModal = () => {
    setSelectedLead(null)
    setLeadPosition(null)
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-lg">Loading...</div></div>
  if (error)   return <div className="flex items-center justify-center h-screen"><div className="text-red-500">Error: {error}</div></div>

  const handleMove = (leadId: string, newStage: string) => {
    const prevStage = leads.find(l => l.id === leadId)?.stage ?? "—"
  
    // move in kanban data (your existing behavior)
    handleLeadMove(leadId, newStage)
  
    // update the left details panel immediately if this lead is open
    setSelectedLead((sl: any) => (sl?.id === leadId ? { ...sl, stage: newStage } : sl))
  
    // single, centralized history log (works for DnD AND for dropdown)
    logLeadEvent(
      leadId,
      `Stadiu schimbat: ${prevStage} → ${newStage}`,
      "stage_change",
      { from: prevStage, to: newStage }
    )
  
    toast({ title: "Lead moved", description: `Moved to ${newStage}`, duration: 2000 })
  }

  async function handleMoveToPipeline(leadId: string, targetName: string) {
    const res = await moveLeadToPipelineByName(leadId, targetName, "UI move from modal")
    if (!res.ok) {
      if (res.code === "TARGET_PIPELINE_NO_ACTIVE_STAGES") {
        toast({
          title: "Cannot move lead",
          description: "Selected pipeline has no stages. Add one and try again.",
          variant: "destructive",
        })
        return
      }
      if (res.code === "TARGET_PIPELINE_NOT_ACTIVE") {
        toast({
          title: "Pipeline inactive or missing",
          description: "Please pick an active pipeline.",
          variant: "destructive",
        })
        return
      }
      toast({ title: "Move failed", description: res.message ?? "Unexpected error", variant: "destructive" })
      return
    }

    setSelectedLead(null)
    toast({ title: "Lead moved", description: `Sent to ${targetName} (default stage).` })
    router.refresh?.() 
  }

  // functie pentru mutarea in batch in stage
  const handleBulkMoveToStage = async (leadIds: string[], newStage: string) => {
    try {
      // obtine pipeline-ul curent si stage-ul
      const { data: pipelinesData } = await getPipelinesWithStages()
      const currentPipeline = pipelinesData?.find((p: any) => toSlug(p.name) === pipelineSlug) || pipelinesData?.[0]
      
      if (!currentPipeline) {
        toast({ title: "Eroare", description: "Pipeline-ul curent nu a fost gasit", variant: "destructive" })
        return
      }

      const targetStage = currentPipeline.stages.find((s: any) => s.name === newStage)
      if (!targetStage) {
        toast({ title: "Eroare", description: "Stage-ul nu a fost gasit", variant: "destructive" })
        return
      }

      // muta fiecare lead
      const movePromises = leadIds.map(async (leadId) => {
        const lead = leads.find(l => l.id === leadId)
        if (!lead) return

        const prevStage = lead.stage ?? "—"
        
        // foloseste handleLeadMove pentru a muta lead-ul
        await handleLeadMove(leadId, newStage)
        
        // log event
        logLeadEvent(
          leadId,
          `Stadiu schimbat: ${prevStage} → ${newStage}`,
          "stage_change",
          { from: prevStage, to: newStage }
        )
      })

      await Promise.all(movePromises)
      
      toast({ 
        title: "Lead-uri mutate", 
        description: `${leadIds.length} lead${leadIds.length === 1 ? '' : '-uri'} mutat${leadIds.length === 1 ? '' : 'e'} în ${newStage}`,
        duration: 3000
      })
      
      await refresh()
    } catch (error) {
      console.error('Eroare la mutarea lead-urilor:', error)
      toast({ 
        title: "Eroare", 
        description: "Nu s-au putut muta toate lead-urile", 
        variant: "destructive" 
      })
    }
  }

  // functie pentru mutarea in batch in pipeline
  const handleBulkMoveToPipeline = async (leadIds: string[], pipelineName: string) => {
    try {
      const movePromises = leadIds.map(async (leadId) => {
        const res = await moveLeadToPipelineByName(leadId, pipelineName, "Bulk move")
        if (!res.ok) {
          console.error(`Eroare la mutarea lead-ului ${leadId}:`, res.message)
        }
        return res
      })

      const results = await Promise.all(movePromises)
      const successCount = results.filter(r => r.ok).length
      const failCount = results.length - successCount

      if (failCount > 0) {
        toast({
          title: "Mutare partiala",
          description: `${successCount} mutat${successCount === 1 ? '' : 'e'} cu succes, ${failCount} esuat${failCount === 1 ? '' : 'e'}`,
          variant: failCount === results.length ? "destructive" : "default"
        })
      } else {
        toast({
          title: "Lead-uri mutate",
          description: `${successCount} lead${successCount === 1 ? '' : '-uri'} mutat${successCount === 1 ? '' : 'e'} în ${pipelineName}`,
          duration: 3000
        })
      }

      await refresh()
      router.refresh?.()
    } catch (error) {
      console.error('Eroare la mutarea lead-urilor:', error)
      toast({
        title: "Eroare",
        description: "Nu s-au putut muta toate lead-urile",
        variant: "destructive"
      })
    }
  }

  const handleLeadClick = async (lead: KanbanLead, event?: React.MouseEvent) => {
    // Pentru quotes, folosim direct datele disponibile
    // LeadDetailsPanel va gestiona obținerea datelor necesare folosind leadId și quoteId
    setSelectedLead(lead as any)
    
    if (event && event.currentTarget) {
      // Calculează poziția lead-ului pe ecran
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const leadCenterX = rect.left + rect.width / 2
      
      // Determină partea ecranului (stânga sau dreapta)
      const side = leadCenterX < viewportWidth / 2 ? 'left' : 'right'
      
      setLeadPosition({
        x: rect.left,
        y: rect.top,
        side
      })
    }
  }

  return (
    <div className="flex min-h-dvh bg-background overflow-hidden">

      <main className="flex-1 min-w-0 min-h-0 flex flex-col">
        {/* Header desktop - ascuns pe mobil */}
        <header className="hidden md:block border-b border-border p-4">
          <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">{activePipelineName}</h1>
            
            {/* Filtre și căutare */}
            <div className="flex items-center gap-2">
              {/* Căutare */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Caută după nume sau email..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                  className="pl-8 h-8 w-64"
                />
              </div>

              <Button
                variant={filters.dateFilter.enabled ? "default" : "outline"}
                size="sm"
                onClick={() => setFilters(prev => ({ 
                  ...prev, 
                  dateFilter: { ...prev.dateFilter, enabled: !prev.dateFilter.enabled }
                }))}
                className="h-8 gap-2"
              >
                <Filter className="h-4 w-4" />
                Filtru dată
              </Button>

              {/* Filtru după tehnician */}
              <Select
                value={filters.technicianId || undefined}
                onValueChange={(value) => setFilters(prev => ({ ...prev, technicianId: value || null }))}
                disabled={loadingTechnicians}
              >
                <SelectTrigger className="w-[200px] h-8">
                  <SelectValue placeholder={loadingTechnicians ? "Se încarcă..." : "Filtrează după tehnician"} />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.name}
                    </SelectItem>
                  ))}
                  {technicians.length === 0 && !loadingTechnicians && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Nu există tehnicieni
                    </div>
                  )}
                </SelectContent>
              </Select>
              
              {(filters.dateFilter.enabled || filters.searchQuery || filters.technicianId) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters({
                    dateFilter: { startDate: null, endDate: null, enabled: false },
                    searchQuery: '',
                    technicianId: null
                  })}
                  className="h-8 gap-1"
                >
                  <X className="h-3 w-3" />
                  Resetează
                </Button>
              )}
            </div>
          </div>

          {/* Controale pentru filtru de dată */}
          {filters.dateFilter.enabled && (
            <div className="mt-3 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="start-date" className="text-sm">De la:</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={filters.dateFilter.startDate || ''}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      dateFilter: { ...prev.dateFilter, startDate: e.target.value || null }
                    }))}
                    className="w-auto"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="end-date" className="text-sm">Până la:</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={filters.dateFilter.endDate || ''}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      dateFilter: { ...prev.dateFilter, endDate: e.target.value || null }
                    }))}
                    className="w-auto"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  {filteredLeads.length} din {leads.length} lead-uri
                </div>
              </div>
            </div>
          )}

          {/* Afișare statistici filtre active */}
          {(filters.searchQuery || filters.technicianId || (filters.dateFilter.enabled && (filters.dateFilter.startDate || filters.dateFilter.endDate))) && (
            <div className="mt-2 text-sm text-muted-foreground">
              {filteredLeads.length} din {leads.length} lead-uri
              {filters.searchQuery && ` • Căutare: "${filters.searchQuery}"`}
              {filters.technicianId && (
                <>
                  {' • '}
                  Tehnician: {technicians.find(t => t.id === filters.technicianId)?.name || 'Necunoscut'}
                </>
              )}
            </div>
          )}

          <div className="mt-2 flex items-center gap-2">
            {/* Buton Adauga Vanzari - doar pentru pipeline-ul Vanzari */}
            {pipelineSlug?.toLowerCase() === 'vanzari' && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setCreateLeadOpen(true)}
                className="h-8 gap-2"
              >
                <Plus className="h-4 w-4" />
                Adauga Vanzari
              </Button>
            )}

            {isOwner && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateStageOpen(true)}
                  className="h-8 gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add a new stage
                </Button>

                <Button variant="outline" size="sm" onClick={openEditor} className="h-8 gap-2" aria-label="Edit board">
                  <Settings2 className="h-4 w-4" />
                  Edit board
                </Button>
              </>
            )}
          </div>
        </header>

        {editorData && (
          <PipelineEditor
            open={editorOpen}
            onOpenChange={setEditorOpen}
            pipelineName={editorData.pipelineName}
            stages={editorData.stages}
            onSubmit={async ({ pipelineName, stages }) => {
              const { error } = await updatePipelineAndStages(editorData!.pipelineId, pipelineName, stages)
              if (error) { toast({ variant: "destructive", title: "Save failed", description: String(error.message ?? error) }); return }
              await refresh?.()                                   // ensure UI reflects new order/name
              const newSlug = toSlug(pipelineName);               // if your URL uses slug
              if (newSlug !== pipelineSlug) router.replace(`/leads/${newSlug}`)
              setEditorOpen(false)
              toast({ title: "Board updated" })
              if (typeof window !== "undefined") window.dispatchEvent(new Event("pipelines:updated"))

            }}
          />
        )}

        {/* Layout mobil */}
        {isMobile ? (
          <div className="flex-1 overflow-hidden">
            <MobileBoardLayout
              leads={filteredLeads}
              stages={orderedStages}
              currentPipelineName={activePipelineName || ''}
              pipelines={pipelines}
              onPipelineChange={(pipelineName) => {
                const slug = toSlug(pipelineName)
                router.push(`/leads/${slug}`)
              }}
              onLeadMove={handleMove}
              onLeadClick={handleLeadClick}
              onAddLead={pipelineSlug?.toLowerCase() === 'vanzari' ? () => setCreateLeadOpen(true) : undefined}
              onSearchClick={() => {
                // Implementare căutare mobil - poate deschide un dialog
                const searchQuery = prompt('Caută lead...')
                if (searchQuery) {
                  setFilters(prev => ({ ...prev, searchQuery }))
                }
              }}
              onFilterClick={() => {
                // Implementare filtre mobil - poate deschide un bottom sheet
                // Pentru moment, doar logăm
                console.log('Filtre mobil')
              }}
              onCustomizeClick={() => setCustomizeOpen(true)}
              sidebarContent={
                <div className="p-4">
                  {/* Sidebar content pentru mobil */}
                  <Sidebar canManagePipelines={isOwner} />
                </div>
              }
            />
          </div>
        ) : (
          <div className="flex-1 p-6 overflow-auto">
            {stages.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="text-lg font-medium text-muted-foreground mb-2">
                  Pipeline-ul se configurează...
                </div>
                <div className="text-sm text-muted-foreground mb-4">
                  {pipelineSlug === 'saloane' 
                    ? 'Se creează stage-urile pentru pipeline-ul Saloane...'
                    : `Pipeline-ul "${activePipelineName}" nu are stage-uri configurate.`
                  }
                </div>
                {isOwner && pipelineSlug !== 'saloane' && (
                  <Button
                    variant="outline"
                    onClick={() => setCreateStageOpen(true)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Adaugă primul stage
                  </Button>
                )}
              </div>
            ) : (
              <div className="relative">
                <KanbanBoard 
                  leads={filteredLeads} 
                  stages={stages} 
                  onLeadMove={handleMove} 
                  onLeadClick={handleLeadClick} 
                  onDeleteStage={handleDeleteStage}
                  currentPipelineName={activePipelineName}
                  onPinToggle={handlePinToggle}
                  pipelines={pipelines}
                  onBulkMoveToStage={handleBulkMoveToStage}
                  onBulkMoveToPipeline={handleBulkMoveToPipeline}
                />
                
                {/* Panel de detalii cu poziționare dinamică */}
                {selectedLead && leadPosition && (
                  <>
                    {/* Backdrop pentru închidere - transparent */}
                    <div 
                      className="fixed inset-0 bg-transparent z-40"
                      onClick={handleCloseModal}
                    />
                    
                    {/* Panel de detalii - ocupă tot spațiul vertical de sus până jos */}
                    <div 
                      className="fixed right-0 top-0 bottom-0 z-50 bg-white border-l border-gray-200 shadow-xl overflow-hidden"
                      style={{
                        left: '200px'  // w-50 = 200px (50 * 4px)
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="h-full overflow-y-auto">
              <LeadDetailsPanel
                key={selectedLead.id}              
                lead={selectedLead}
                onClose={handleCloseModal}
                onStageChange={handleMove}
                stages={stages}
                pipelines={pipelines}
                pipelineSlug={pipelineSlug}
                onMoveToPipeline={handleMoveToPipeline}
                onBulkMoveToPipelines={handleBulkMoveToPipelines}
                pipelineOptions={pipelineOptions}
                onTagsChange={(leadId: string, tags: Tag[]) => patchLeadTags(leadId, tags)}
              />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <Toaster />

      <Dialog open={createStageOpen} onOpenChange={setCreateStageOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create a new stage</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setCreateErr(null)
              setCreatingStage(true)
              try {
                const res = await fetch("/api/stages", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ pipelineSlug, name: stageName }),
                })
                const json = await res.json()
                if (!res.ok) throw new Error(json.error || "Failed to create stage")

                // close + clear + refresh local data
                setCreateStageOpen(false)
                setStageName("")
                await refresh()
              } catch (err: any) {
                setCreateErr(err.message || "Failed to create stage")
              } finally {
                setCreatingStage(false)
              }
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-xs text-foreground/70 mb-1">Stage name</label>
              <input
                autoFocus
                required
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                className="border rounded px-2 py-1 w-full bg-background"
                placeholder="e.g. LEAD NOU"
              />
            </div>

            {createErr && <p className="text-xs text-red-500">{createErr}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateStageOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creatingStage}>
                {creatingStage ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog pentru creare lead nou in Vanzari */}
      <Dialog open={createLeadOpen} onOpenChange={setCreateLeadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adauga Comanda Noua</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="lead-name">Nume complet *</Label>
              <Input
                id="lead-name"
                value={newLeadData.full_name}
                onChange={(e) => setNewLeadData(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="Nume complet"
              />
            </div>
            <div>
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                value={newLeadData.email}
                onChange={(e) => setNewLeadData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <Label htmlFor="lead-phone">Telefon</Label>
              <Input
                id="lead-phone"
                type="tel"
                value={newLeadData.phone_number}
                onChange={(e) => setNewLeadData(prev => ({ ...prev, phone_number: e.target.value }))}
                placeholder="+40 123 456 789"
              />
            </div>
            <div>
              <Label htmlFor="lead-city">Oraș</Label>
              <Input
                id="lead-city"
                value={newLeadData.city}
                onChange={(e) =>
                  setNewLeadData(prev => ({ ...prev, city: e.target.value }))
                }
                placeholder="București"
              />
            </div>
              
            <div>
              <Label htmlFor="lead-company-name">Nume companie</Label>
              <Input
                id="lead-company-name"
                value={newLeadData.company_name}
                onChange={(e) =>
                  setNewLeadData(prev => ({ ...prev, company_name: e.target.value }))
                }
                placeholder="Companie 1"
              />
            </div>
              
            <div>
              <Label htmlFor="lead-company-address">Compania și adresa</Label>
              <Input
                id="lead-company-address"
                value={newLeadData.company_address}
                onChange={(e) =>
                  setNewLeadData(prev => ({ ...prev, company_address: e.target.value }))
                }
                placeholder="Compania și adresa"
              />
            </div>
              
            <div>
              <Label htmlFor="lead-address">Adresă</Label>
              <Input
                id="lead-address"
                value={newLeadData.address}
                onChange={(e) =>
                  setNewLeadData(prev => ({ ...prev, address: e.target.value }))
                }
                placeholder="Obor"
              />
            </div>
              
            <div>
              <Label htmlFor="lead-address2">Adresă 2</Label>
              <Input
                id="lead-address2"
                value={newLeadData.address2}
                onChange={(e) =>
                  setNewLeadData(prev => ({ ...prev, address2: e.target.value }))
                }
                placeholder="ap., etaj etc."
              />
            </div>
              
            <div>
              <Label htmlFor="lead-zip">Cod poștal</Label>
              <Input
                id="lead-zip"
                value={newLeadData.zip}
                onChange={(e) =>
                  setNewLeadData(prev => ({ ...prev, zip: e.target.value }))
                }
                placeholder="123333"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateLeadOpen(false)
                  setNewLeadData({ 
                    full_name: '', 
                    email: '', 
                    phone_number: '',
                    city: '',
                    company_name: '',
                    company_address: '',
                    address: '',
                    address2: '',
                    zip: '',
                    country: ''
                  })
                }}
              >
                Anuleaza
              </Button>
              <Button
                onClick={async () => {
                  if (!newLeadData.full_name.trim()) {
                    toast({
                      title: "Eroare",
                      description: "Numele este obligatoriu",
                      variant: "destructive"
                    })
                    return
                  }

                  // Previne dublarea comenzii
                  if (creatingLead) {
                    return
                  }

                  setCreatingLead(true)
                  try {
                    // Gaseste pipeline-ul Vanzari si primul stage
                    const { data: pipelinesData } = await getPipelinesWithStages()
                    const vanzariPipeline = pipelinesData?.find((p: any) => toSlug(p.name) === 'vanzari')
                    
                    if (!vanzariPipeline) {
                      throw new Error('Pipeline-ul Vanzari nu a fost gasit')
                    }

                    const firstStage = vanzariPipeline.stages?.[0]
                    if (!firstStage) {
                      throw new Error('Pipeline-ul Vanzari nu are stage-uri')
                    }

                    // Creeaza lead-ul
                    const { data, error } = await createLeadWithPipeline(
                      {
                        full_name: newLeadData.full_name.trim(),
                        email: newLeadData.email.trim() || null,
                        phone_number: newLeadData.phone_number.trim() || null,
                        city: newLeadData.city.trim() || null,
                        company_name: newLeadData.company_name.trim() || null,
                        company_address: newLeadData.company_address.trim() || null,
                        address: newLeadData.address.trim() || null,
                        address2: newLeadData.address2.trim() || null,
                        zip: newLeadData.zip.trim() || null,
                        platform: 'manual',
                        created_at: new Date().toISOString()
                      },
                      vanzariPipeline.id,
                      firstStage.id
                    )

                    if (error) {
                      throw error
                    }

                    toast({
                      title: "Lead creat",
                      description: `Lead-ul "${newLeadData.full_name}" a fost adaugat in Vanzari`,
                    })

                    setCreateLeadOpen(false)
                    setNewLeadData({ 
                      full_name: '', 
                      email: '', 
                      phone_number: '',
                      city: '',
                      company_name: '',
                      company_address: '',
                      address: '',
                      address2: '',
                      zip: '',
                      country: ''
                    })
                    await refresh()
                    router.refresh?.()
                  } catch (error: any) {
                    console.error('Eroare la crearea lead-ului:', error)
                    toast({
                      title: "Eroare",
                      description: error?.message || "Nu s-a putut crea lead-ul",
                      variant: "destructive"
                    })
                  } finally {
                    setCreatingLead(false)
                  }
                }}
                disabled={creatingLead || !newLeadData.full_name.trim()}
              >
                {creatingLead ? 'Se creeaza...' : 'Creeaza'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog pentru customizare mobil - poziții stage-uri */}
      <Sheet open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh] overflow-y-auto">
          <SheetTitle className="sr-only">Customizare Layout</SheetTitle>
          <SheetHeader>
            <SheetTitle className="text-lg font-semibold">Customizare Layout</SheetTitle>
            <SheetDescription>
              Reordonează pozițiile stage-urilor pentru {activePipelineName}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Ordinea stage-urilor</Label>
              <p className="text-xs text-muted-foreground">
                Apasă pe săgeți pentru a muta stage-urile sus/jos
              </p>
              <div className="space-y-2">
                {orderedStages.map((stage, index) => (
                  <div
                    key={stage}
                    className="flex items-center justify-between p-3 border rounded-lg bg-background"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{stage}</span>
                      <Badge variant="outline" className="text-xs">
                        {leads.filter(l => l.stage === stage).length} lead-uri
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          if (index > 0) {
                            const newOrder = [...orderedStages]
                            const temp = newOrder[index]
                            newOrder[index] = newOrder[index - 1]
                            newOrder[index - 1] = temp
                            if (pipelineSlug) {
                              setStageOrder(pipelineSlug, newOrder)
                            }
                          }
                        }}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          if (index < orderedStages.length - 1) {
                            const newOrder = [...orderedStages]
                            const temp = newOrder[index]
                            newOrder[index] = newOrder[index + 1]
                            newOrder[index + 1] = temp
                            if (pipelineSlug) {
                              setStageOrder(pipelineSlug, newOrder)
                            }
                          }
                        }}
                        disabled={index === orderedStages.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  if (pipelineSlug) {
                    setStageOrder(pipelineSlug, stages) // Resetează la ordinea default
                  }
                }}
              >
                Resetează
              </Button>
              <Button
                className="flex-1"
                onClick={() => setCustomizeOpen(false)}
              >
                Salvează
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
