"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Plus, Settings2, Filter, X, Search } from "lucide-react"
import { useRole } from '@/hooks/useRole'
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

  const { isOwner, role } = useRole()
  const [isTechnician, setIsTechnician] = useState(false)
  
  // Verifică dacă utilizatorul este tehnician
  useEffect(() => {
    async function checkTechnician() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) {
        setIsTechnician(false)
        return
      }
      // Verifică dacă utilizatorul există în app_members
      const { data } = await supabase
        .from('app_members')
        .select('user_id, role')
        .eq('user_id', user.id)
        .single()
      
      // Dacă există în app_members și nu este owner/admin, considerăm că este tehnician
      setIsTechnician(!!data && data.role !== 'owner' && data.role !== 'admin')
    }
    checkTechnician()
  }, [])
  
  const [createStageOpen, setCreateStageOpen] = useState(false)
  const [stageName, setStageName] = useState("")
  const [creatingStage, setCreatingStage] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)
  
  // State pentru dialog-ul de creare lead nou
  const [createLeadOpen, setCreateLeadOpen] = useState(false)
  const [newLeadData, setNewLeadData] = useState({
    full_name: '',
    email: '',
    phone_number: ''
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

  // State pentru lista de tehnicieni
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loadingTechnicians, setLoadingTechnicians] = useState(false)

  const { leads, stages, pipelines: allPipelines, loading, error, handleLeadMove, refresh, patchLeadTags, handlePinToggle } = useKanbanData(pipelineSlug)
  
  // Filtrează pipeline-urile pentru tehnicieni
  const pipelines = useMemo(() => {
    if (!isTechnician) return allPipelines
    
    const departmentPipelines = ['Saloane', 'Frizerii', 'Horeca', 'Reparatii']
    return allPipelines.filter(p => 
      departmentPipelines.some(dept => 
        p.toLowerCase() === dept.toLowerCase()
      )
    )
  }, [allPipelines, isTechnician])
  
  // Redirectează tehnicienii dacă încearcă să acceseze un pipeline nepermis
  useEffect(() => {
    if (isTechnician && pipelineSlug) {
      const departmentSlugs = ['saloane', 'frizerii', 'horeca', 'reparatii']
      const currentSlug = pipelineSlug.toLowerCase()
      
      if (!departmentSlugs.includes(currentSlug)) {
        // Redirectează la primul pipeline permis
        router.replace('/leads/saloane')
      }
    }
  }, [isTechnician, pipelineSlug, router])

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
      result = result.filter(lead => {
        const leadAny = lead as any
        
        // Caută în câmpurile de bază
        if (lead.name?.toLowerCase().includes(query)) return true
        if (lead.email?.toLowerCase().includes(query)) return true
        if (lead.phone?.toLowerCase().includes(query)) return true
        
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

  // Încarcă lista de tehnicieni din app_members
  useEffect(() => {
    const loadTechnicians = async () => {
      setLoadingTechnicians(true)
      try {
        // ✅ Selectăm direct name și email din app_members
        const { data: membersData, error } = await supabase
          .from('app_members')
          .select('user_id, name, email')
          .order('name', { ascending: true })
        
        if (error) {
          console.error('Error loading app_members:', error)
          setTechnicians([])
          return
        }
        
        if (!membersData || membersData.length === 0) {
          setTechnicians([])
          return
        }
        
        // ✅ Folosim datele direct din app_members (fără apeluri la auth API)
        const techs: Technician[] = membersData.map((member: any) => ({
          id: member.user_id,
          name: member.name || member.email?.split('@')[0] || `User ${member.user_id.slice(0, 8)}`
        }))
        
        // Sortează după nume
        techs.sort((a, b) => a.name.localeCompare(b.name))
        setTechnicians(techs)
      } catch (error) {
        console.error('Error loading technicians:', error)
        setTechnicians([])
      } finally {
        setLoadingTechnicians(false)
      }
    }
    loadTechnicians()
  }, [])

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
      toast({ description: `Moved to ${res.length} pipeline${res.length === 1 ? "" : "s"}` })
      router.refresh() // re-render board, details, and history in one shot
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
    const res = await fetch("/api/stages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipelineSlug, stageName }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || "Failed to delete stage")

    toast({ title: "Stage deleted", description: `“${stageName}” and its leads were removed.` })
    await refresh()
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
              stages={stages}
              currentPipelineName={activePipelineName}
              pipelines={pipelines}
              onPipelineChange={(pipelineName) => {
                const slug = toSlug(pipelineName)
                router.push(`/leads/${slug}`)
              }}
              onLeadMove={handleMove}
              onLeadClick={handleLeadClick}
              onAddLead={() => setCreateLeadOpen(true)}
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
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateLeadOpen(false)
                  setNewLeadData({ full_name: '', email: '', phone_number: '' })
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
                    setNewLeadData({ full_name: '', email: '', phone_number: '' })
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
    </div>
  )
}
