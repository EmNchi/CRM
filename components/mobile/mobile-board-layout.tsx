'use client'

import { useState, useMemo, useEffect } from 'react'
import { KanbanLead } from '@/lib/types/database'
import { StageTabs } from './stage-tabs'
import { LeadCardMobile } from './lead-card-mobile'
import { MobileBoardHeader } from './mobile-board-header'
import { LeadDetailsSheet } from './lead-details-sheet'
import { useSwipe } from '@/hooks/use-swipe'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface MobileBoardLayoutProps {
  leads: KanbanLead[]
  stages: string[]
  currentPipelineName: string
  pipelines: string[]
  onPipelineChange: (pipeline: string) => void
  onLeadMove: (leadId: string, newStage: string) => void
  onLeadClick?: (lead: KanbanLead) => void
  onAddLead?: () => void
  sidebarContent?: React.ReactNode
  onSearchClick?: () => void
  onFilterClick?: () => void
  onCustomizeClick?: () => void
}

export function MobileBoardLayout({
  leads,
  stages,
  currentPipelineName,
  pipelines,
  onPipelineChange,
  onLeadMove,
  onLeadClick,
  onAddLead,
  sidebarContent,
  onSearchClick,
  onFilterClick,
  onCustomizeClick,
}: MobileBoardLayoutProps) {
  const [currentStage, setCurrentStage] = useState(stages[0] || '')
  const [selectedLead, setSelectedLead] = useState<KanbanLead | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [moveSheetOpen, setMoveSheetOpen] = useState(false)
  const [leadToMove, setLeadToMove] = useState<KanbanLead | null>(null)

  // Actualizează stage-ul curent când se schimbă stages
  useEffect(() => {
    if (stages.length > 0 && !stages.includes(currentStage)) {
      setCurrentStage(stages[0])
    }
  }, [stages, currentStage])

  // Swipe gestures pentru schimbarea stage-urilor
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => {
      const currentIndex = stages.indexOf(currentStage)
      if (currentIndex < stages.length - 1) {
        setCurrentStage(stages[currentIndex + 1])
      }
    },
    onSwipeRight: () => {
      const currentIndex = stages.indexOf(currentStage)
      if (currentIndex > 0) {
        setCurrentStage(stages[currentIndex - 1])
      }
    },
    threshold: 50,
  })

  // Lead-uri pentru stage-ul curent
  const currentStageLeads = useMemo(() => {
    return leads.filter(lead => lead.stage === currentStage)
  }, [leads, currentStage])

  // Număr de lead-uri per stage
  const leadCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    stages.forEach(stage => {
      counts[stage] = leads.filter(lead => lead.stage === stage).length
    })
    return counts
  }, [leads, stages])

  const handleLeadClick = (lead: KanbanLead) => {
    setSelectedLead(lead)
    setDetailsOpen(true)
    onLeadClick?.(lead)
  }

  const handleMoveClick = (lead: KanbanLead) => {
    setLeadToMove(lead)
    setMoveSheetOpen(true)
  }

  const handleMoveToStage = (newStage: string) => {
    if (leadToMove) {
      onLeadMove(leadToMove.id, newStage)
      setMoveSheetOpen(false)
      setLeadToMove(null)
    }
  }

  return (
    <div className="flex flex-col h-screen md:hidden">
      {/* Header */}
      <MobileBoardHeader
        pipelineName={currentPipelineName}
        pipelines={pipelines}
        onPipelineChange={onPipelineChange}
        onSearchClick={onSearchClick || (() => {})}
        onFilterClick={onFilterClick || (() => {})}
        sidebarContent={sidebarContent}
        onCustomizeClick={onCustomizeClick}
      />

      {/* Stage tabs */}
      <StageTabs
        stages={stages}
        currentStage={currentStage}
        onStageChange={setCurrentStage}
        leadCounts={leadCounts}
      />

      {/* Leads list */}
      <div 
        className="flex-1 overflow-y-auto px-4 py-4"
        {...swipeHandlers}
      >
        {currentStageLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <p className="text-muted-foreground mb-2">Nu există lead-uri în acest stage</p>
            {onAddLead && (
              <Button onClick={onAddLead} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Adaugă lead
              </Button>
            )}
          </div>
        ) : (
          <div>
            {currentStageLeads.map((lead) => (
              <LeadCardMobile
                key={lead.id}
                lead={lead}
                onClick={() => handleLeadClick(lead)}
                onMove={() => handleMoveClick(lead)}
                onEdit={() => {
                  setDetailsOpen(false)
                  // Trigger edit action
                }}
                pipelineName={currentPipelineName}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lead details sheet */}
      <LeadDetailsSheet
        lead={selectedLead}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        pipelineSlug={currentPipelineName.toLowerCase().replace(/\s+/g, '-')}
        stages={stages}
        onStageChange={(leadId, newStage) => {
          onLeadMove(leadId, newStage)
          setDetailsOpen(false)
        }}
        onMove={() => {
          if (selectedLead) {
            setDetailsOpen(false)
            handleMoveClick(selectedLead)
          }
        }}
      />

      {/* Move to stage sheet */}
      <Sheet open={moveSheetOpen} onOpenChange={setMoveSheetOpen}>
        <SheetContent side="bottom" className="h-auto">
          <SheetHeader>
            <SheetTitle>Mută lead</SheetTitle>
            <SheetDescription>
              Selectează stage-ul în care vrei să muți "{leadToMove?.name}"
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {stages
              .filter(stage => stage !== leadToMove?.stage)
              .map((stage) => (
                <Button
                  key={stage}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleMoveToStage(stage)}
                >
                  {stage}
                </Button>
              ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Floating action button */}
      {onAddLead && (
        <div className="fixed bottom-6 right-6 z-30 md:hidden">
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg"
            onClick={onAddLead}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  )
}

