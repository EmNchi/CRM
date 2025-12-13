"use client"

import type React from "react"

import { useState, useEffect, useMemo, useCallback } from "react"
import { LeadCard } from "@/components/lead-card"
import { cn } from "@/lib/utils"
import type { KanbanLead } from "../lib/types/database"
import { Trash2, Loader2, TrendingUp, Inbox, Move, X } from "lucide-react"
import { useRole } from "@/hooks/useRole"
import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogFooter
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

interface KanbanBoardProps {
  leads: KanbanLead[]
  stages: string[]
  onLeadMove: (leadId: string, newStage: string) => void
  onLeadClick: (lead: KanbanLead, event?: React.MouseEvent) => void
  onDeleteStage?: (stageName: string) => Promise<void>
  currentPipelineName?: string
  onPinToggle?: (leadId: string, isPinned: boolean) => void
  pipelines?: string[]
  onBulkMoveToStage?: (leadIds: string[], newStage: string) => Promise<void>
  onBulkMoveToPipeline?: (leadIds: string[], pipelineName: string) => Promise<void>
}

export function KanbanBoard({ 
  leads, 
  stages, 
  onLeadMove, 
  onLeadClick, 
  onDeleteStage, 
  currentPipelineName, 
  onPinToggle,
  pipelines = [],
  onBulkMoveToStage,
  onBulkMoveToPipeline
}: KanbanBoardProps) {
  const [draggedLead, setDraggedLead] = useState<string | null>(null)
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [stageTotals, setStageTotals] = useState<Record<string, number>>({})
  const [loadingTotals, setLoadingTotals] = useState<Record<string, boolean>>({})
  const [leadTotals, setLeadTotals] = useState<Record<string, number>>({})

  const { isOwner } = useRole()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [targetStage, setTargetStage] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteErr, setDeleteErr] = useState<string | null>(null)
  
  // dialog pentru mutarea in batch
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [moveType, setMoveType] = useState<'stage' | 'pipeline' | null>(null)
  const [selectedTargetStage, setSelectedTargetStage] = useState<string>('')
  const [selectedTargetPipeline, setSelectedTargetPipeline] = useState<string>('')
  const [isMoving, setIsMoving] = useState(false)

  async function handleConfirmDelete() {
    if (!targetStage) return
    setDeleteErr(null)
    setDeleting(true)
    try {
      if (typeof onDeleteStage === "function") {
        await onDeleteStage(targetStage)
      }
      setConfirmOpen(false)
      setTargetStage(null)
    } catch (e: any) {
      setDeleteErr(e?.message ?? "Failed to delete stage")
    } finally {
      setDeleting(false)
    }
  }

  // memoizeaza lead-urile grupate pe stage pentru performanta
  const leadsByStage = useMemo(() => {
    const grouped: Record<string, KanbanLead[]> = {}
    
    stages.forEach(stage => {
      grouped[stage] = []
    })
    
    leads.forEach(lead => {
      if (lead.stage && grouped[lead.stage]) {
        grouped[lead.stage].push(lead)
      }
    })
    
    // sorteaza lead-urile pentru fiecare stage
    const isReceptie = currentPipelineName?.toLowerCase().includes('receptie') || false
    
    Object.keys(grouped).forEach(stage => {
      const stageLower = stage.toLowerCase()
      const isDeConfirmat = stageLower.includes('confirmat') && !stageLower.includes('confirmari')
      const isInAsteptare = stageLower.includes('asteptare')
      
      // pentru pipeline-ul Receptie, stage-urile "De confirmat" si "In asteptare" se sorteaza dupa timpul in stage
      const shouldSortByTimeInStage = isReceptie && (isDeConfirmat || isInAsteptare)
      
      grouped[stage].sort((a, b) => {
        // prioritate maxima pentru pinned leads
        const aIsPinned = a.tags?.some(tag => tag.name === 'PINNED') || false
        const bIsPinned = b.tags?.some(tag => tag.name === 'PINNED') || false
        
        if (aIsPinned && !bIsPinned) return -1
        if (!aIsPinned && bIsPinned) return 1
        
        // prioritate pentru urgent tags
        const aHasUrgent = a.tags?.some(tag => tag.name.toLowerCase() === 'urgent') || false
        const bHasUrgent = b.tags?.some(tag => tag.name.toLowerCase() === 'urgent') || false
        
        if (aHasUrgent && !bHasUrgent) return -1
        if (!aHasUrgent && bHasUrgent) return 1
        
        // daca suntem in Receptie si stage-ul este "De confirmat" sau "In asteptare", sortam dupa timpul in stage
        if (shouldSortByTimeInStage) {
          const aMovedAt = a.stageMovedAt ? new Date(a.stageMovedAt).getTime() : 0
          const bMovedAt = b.stageMovedAt ? new Date(b.stageMovedAt).getTime() : 0
          
          // sortare crescatoare: cele care au fost mutate mai devreme in stage vor fi primele
          if (aMovedAt !== bMovedAt) {
            return aMovedAt - bMovedAt
          }
        }
        
        // fallback: sortare dupa data crearii
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0
        
        return aDate - bDate
      })
    })
    
    return grouped
  }, [leads, stages])

  const getLeadsByStage = useCallback((stage: string) => {
    return leadsByStage[stage] || []
  }, [leadsByStage])

  // calculeaza totalurile pentru fiecare stage (optimizat cu batch requests)
  useEffect(() => {
    let cancelled = false

    const calculateStageTotals = async () => {
      // Verifică dacă suntem în pipeline-ul Vanzari - dacă da, nu calculăm totaluri
      const isVanzariPipeline = currentPipelineName?.toLowerCase().includes('vanzari') || false
      
      // Stage-uri de exclus din Receptie
      const excludedReceptieStages = ['messages', 'de trimis', 'ridic personal', 'de confirmat'].map(s => s.toLowerCase())
      const isReceptiePipeline = currentPipelineName?.toLowerCase().includes('receptie') || false
      
      const newTotals: Record<string, number> = {}
      const newLoadingStates: Record<string, boolean> = {}

      // Dacă suntem în Vanzari, nu calculăm totaluri
      if (isVanzariPipeline) {
        stages.forEach(stage => {
          newTotals[stage] = 0
          newLoadingStates[stage] = false
        })
        setStageTotals(newTotals)
        setLoadingTotals(newLoadingStates)
        setLeadTotals({})
        return
      }

      // colecteaza toate lead-urile pentru batch request
      const stageLeadMap: Record<string, string[]> = {}
      let hasAnyLeads = false
      
      for (const stage of stages) {
        // Exclude stage-urile specificate din Receptie
        if (isReceptiePipeline && excludedReceptieStages.includes(stage.toLowerCase())) {
          newTotals[stage] = 0
          newLoadingStates[stage] = false
          continue
        }
        
        const stageLeads = getLeadsByStage(stage)
        if (stageLeads.length === 0) {
          newTotals[stage] = 0
          newLoadingStates[stage] = false
          continue
        }

        hasAnyLeads = true
        newLoadingStates[stage] = true
        // Folosim leadId pentru leads normale, sau id pentru quotes
        // Trebuie să folosim același ID atât pentru stageLeadMap, cât și pentru totalsMap
        const leadIds = stageLeads.map(lead => {
          if (lead.isQuote && lead.quoteId) {
            return lead.id // Pentru quotes, folosim lead.id
          }
          return lead.leadId || lead.id // Pentru leads normale, folosim leadId (sau id dacă leadId nu există)
        })
        stageLeadMap[stage] = leadIds
      }

      if (!hasAnyLeads) {
        setStageTotals(newTotals)
        setLoadingTotals(newLoadingStates)
        setLeadTotals({})
        return
      }

      try {
        // Calculează totalurile pe stage folosind câmpul 'total' din leads (pentru toate tipurile: lead, service_file, tray)
        const totalsMap: Record<string, number> = {}
        
        for (const stage of stages) {
          // Exclude stage-urile specificate din Receptie
          if (isReceptiePipeline && excludedReceptieStages.includes(stage.toLowerCase())) {
            continue
          }
          
          const stageLeads = getLeadsByStage(stage)
          let stageTotal = 0
          
          stageLeads.forEach(lead => {
            const leadAny = lead as any
            // Pentru toate tipurile (lead, service_file, tray), folosim câmpul 'total' care vine de la getKanbanItems
            if (leadAny.total) {
              stageTotal += leadAny.total
              totalsMap[lead.id] = leadAny.total
            }
          })
          
          newTotals[stage] = stageTotal
          newLoadingStates[stage] = false
        }
        
        if (cancelled) return

        if (!cancelled) {
          setStageTotals(newTotals)
          setLoadingTotals(newLoadingStates)
          setLeadTotals(totalsMap)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Eroare la calcularea totalurilor:', error)
          // seteaza toate totalurile la 0 in caz de eroare
          stages.forEach(stage => {
            if (isReceptiePipeline && excludedReceptieStages.includes(stage.toLowerCase())) {
              newTotals[stage] = 0
            } else {
              newTotals[stage] = 0
            }
            newLoadingStates[stage] = false
          })
          setStageTotals(newTotals)
          setLoadingTotals(newLoadingStates)
        }
      }
    }

    if (leads.length > 0 && stages.length > 0) {
      calculateStageTotals()
    }

    return () => {
      cancelled = true
    }
  }, [leadsByStage, stages, getLeadsByStage, currentPipelineName])

  const handleDragStart = (leadId: string) => {
    setDraggedLead(leadId)
  }

  const handleDragEnd = () => {
    setDraggedLead(null)
    setDragOverStage(null)
  }

  const handleDragOver = useCallback((e: React.DragEvent, stage: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverStage(stage)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // verifica daca parasmi cu adevarat containerul (nu doar un child)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverStage(null)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, stage: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    // daca sunt lead-uri selectate, muta-le pe toate
    if (selectedLeads.size > 0) {
      const leadIds = Array.from(selectedLeads)
      if (onBulkMoveToStage) {
        onBulkMoveToStage(leadIds, stage).then(() => {
          setSelectedLeads(new Set())
        })
      }
    } else if (draggedLead) {
      // muta lead-ul draguit
      onLeadMove(draggedLead, stage)
    }
    
    setDraggedLead(null)
    setDragOverStage(null)
  }, [draggedLead, onLeadMove, selectedLeads, onBulkMoveToStage])

  const handleLeadSelect = useCallback((leadId: string, isSelected: boolean) => {
    setSelectedLeads(prev => {
      const next = new Set(prev)
      if (isSelected) {
        next.add(leadId)
      } else {
        next.delete(leadId)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set())
    } else {
      setSelectedLeads(new Set(leads.map(l => l.id)))
    }
  }, [leads, selectedLeads.size])

  const handleOpenMoveDialog = useCallback((type: 'stage' | 'pipeline') => {
    setMoveType(type)
    setSelectedTargetStage('')
    setSelectedTargetPipeline('')
    setMoveDialogOpen(true)
  }, [])

  const handleBulkMove = useCallback(async () => {
    if (selectedLeads.size === 0) return
    
    const leadIds = Array.from(selectedLeads)
    setIsMoving(true)
    
    try {
      if (moveType === 'stage' && selectedTargetStage && onBulkMoveToStage) {
        await onBulkMoveToStage(leadIds, selectedTargetStage)
      } else if (moveType === 'pipeline' && selectedTargetPipeline && onBulkMoveToPipeline) {
        await onBulkMoveToPipeline(leadIds, selectedTargetPipeline)
      }
      
      setMoveDialogOpen(false)
      setSelectedLeads(new Set())
      setMoveType(null)
      setSelectedTargetStage('')
      setSelectedTargetPipeline('')
    } catch (error) {
      console.error('Eroare la mutarea lead-urilor:', error)
    } finally {
      setIsMoving(false)
    }
  }, [selectedLeads, moveType, selectedTargetStage, selectedTargetPipeline, onBulkMoveToStage, onBulkMoveToPipeline])

  return (
    <>
      {/* Toolbar pentru selectie multipla */}
      {selectedLeads.size > 0 && (
        <div className="sticky top-0 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-lg mb-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <span className="font-semibold">
              {selectedLeads.size} lead{selectedLeads.size === 1 ? '' : '-uri'} selectat{selectedLeads.size === 1 ? '' : 'e'}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedLeads(new Set())}
            >
              <X className="h-4 w-4 mr-1" />
              Anuleaza
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleOpenMoveDialog('stage')}
            >
              <Move className="h-4 w-4 mr-1" />
              Mută în Stage
            </Button>
            {pipelines.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleOpenMoveDialog('pipeline')}
              >
                <Move className="h-4 w-4 mr-1" />
                Mută în Pipeline
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2 scroll-smooth">
        {stages.map((stage) => {
        const stageLeads = getLeadsByStage(stage)
        const isDragOver = dragOverStage === stage
        const total = stageTotals[stage] || 0
        const isLoading = loadingTotals[stage]

        return (
          <div
            key={stage}
            className={cn(
              "flex-shrink-0 w-80 bg-card rounded-lg border border-border transition-all duration-200",
              isDragOver && "ring-2 ring-primary ring-offset-2 bg-accent/50 scale-[1.02] shadow-lg",
            )}
            onDragOver={(e) => handleDragOver(e, stage)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage)}
          >
            
            <div className="p-4 border-b border-border bg-muted/30 group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-card-foreground truncate">{stage}</h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Inbox className="h-3.5 w-3.5" />
                      {stageLeads.length} {stageLeads.length === 1 ? "lead" : "leads"}
                    </span>
                  </div>
                </div>

                {/* suma totala a stage-ului - ascunsă pentru Vânzări și stage-urile excluse din Receptie */}
                {(() => {
                  const isVanzariPipeline = currentPipelineName?.toLowerCase().includes('vanzari') || false
                  const isReceptiePipeline = currentPipelineName?.toLowerCase().includes('receptie') || false
                  const excludedReceptieStages = ['messages', 'de trimis', 'ridic personal', 'de confirmat'].map(s => s.toLowerCase())
                  const isExcludedStage = isReceptiePipeline && excludedReceptieStages.includes(stage.toLowerCase())
                  
                  if (isVanzariPipeline || isExcludedStage) {
                    return null
                  }
                  
                  return (
                    <div className="text-right flex-shrink-0">
                      {isLoading ? (
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                      ) : (
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1 text-sm font-semibold text-emerald-600 dark:text-emerald-500">
                            <TrendingUp className="h-3.5 w-3.5" />
                            {total.toFixed(2)} RON
                          </div>
                          {total > 0 && (
                            <span className="text-[10px] text-muted-foreground">Total</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => { setTargetStage(stage); setConfirmOpen(true) }}
                    aria-label={`Delete stage ${stage}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* content area cu emty state */}
            <div className="p-4 space-y-3 h-[calc(100vh-280px)] min-h-[400px] overflow-y-auto scroll-smooth">
              {stageLeads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                  <div className="rounded-full bg-muted p-4 mb-3">
                    <Inbox className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">Nu există lead-uri</p>
                  <p className="text-xs text-muted-foreground">
                    Trage un lead aici pentru a-l muta în acest stage
                  </p>
                  {isDragOver && (
                    <div className="mt-4 px-3 py-2 rounded-md bg-primary/10 text-primary text-xs font-medium animate-in fade-in">
                      Eliberează pentru a muta
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {stageLeads.map((lead, index) => (
                    <div
                      key={lead.id}
                      className={cn(
                        "animate-in fade-in slide-in-from-bottom-2",
                        `duration-300 delay-[${index * 50}ms]`
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onMove={onLeadMove}
                      onClick={(e) => onLeadClick(lead, e)}
                      onDragStart={() => handleDragStart(lead.id)}
                      onDragEnd={handleDragEnd}
                      isDragging={draggedLead === lead.id}
                      stages={stages}
                      onPinToggle={onPinToggle}
                      isSelected={selectedLeads.has(lead.id)}
                      onSelectChange={(selected) => handleLeadSelect(lead.id, selected)}
                      leadTotal={leadTotals[lead.id] || 0}
                      pipelineName={currentPipelineName}
                    />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
      </div>
      
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to delete “{targetStage}” and all its leads?
            </AlertDialogTitle>
          </AlertDialogHeader>

          {deleteErr && (
            <p className="text-sm text-red-500">{deleteErr}</p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={handleConfirmDelete}
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog pentru mutarea in batch */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mută {selectedLeads.size} lead{selectedLeads.size === 1 ? '' : '-uri'} {moveType === 'stage' ? 'în Stage' : 'în Pipeline'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {moveType === 'stage' && (
              <div className="space-y-2">
                <Label>Selectează Stage</Label>
                <Select value={selectedTargetStage} onValueChange={setSelectedTargetStage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alege un stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {stage}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {moveType === 'pipeline' && (
              <div className="space-y-2">
                <Label>Selectează Pipeline</Label>
                <Select value={selectedTargetPipeline} onValueChange={setSelectedTargetPipeline}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alege un pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map((pipeline) => (
                      <SelectItem key={pipeline} value={pipeline}>
                        {pipeline}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMoveDialogOpen(false)}
              disabled={isMoving}
            >
              Anulează
            </Button>
            <Button
              onClick={handleBulkMove}
              disabled={isMoving || (moveType === 'stage' && !selectedTargetStage) || (moveType === 'pipeline' && !selectedTargetPipeline)}
            >
              {isMoving ? 'Mutare...' : 'Mută'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
