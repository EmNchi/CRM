"use client"

import type React from "react"

import { useState } from "react"
import { LeadCard } from "@/components/lead-card"
import { cn } from "@/lib/utils"
import type { KanbanLead } from "../lib/types/database"

interface KanbanBoardProps {
  leads: KanbanLead[]
  stages: string[]
  onLeadMove: (leadId: string, newStage: string) => void
  onLeadClick: (lead: KanbanLead) => void
}

export function KanbanBoard({ leads, stages, onLeadMove, onLeadClick }: KanbanBoardProps) {
  const [draggedLead, setDraggedLead] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)

  const getLeadsByStage = (stage: string) => {
    return leads.filter((lead) => lead.stage === stage)
  }

  const handleDragStart = (leadId: string) => {
    setDraggedLead(leadId)
  }

  const handleDragEnd = () => {
    setDraggedLead(null)
    setDragOverStage(null)
  }

  const handleDragOver = (e: React.DragEvent, stage: string) => {
    e.preventDefault()
    setDragOverStage(stage)
  }

  const handleDragLeave = () => {
    setDragOverStage(null)
  }

  const handleDrop = (e: React.DragEvent, stage: string) => {
    e.preventDefault()
    if (draggedLead) {
      onLeadMove(draggedLead, stage)
    }
    setDraggedLead(null)
    setDragOverStage(null)
  }

  return (
    <div className="flex gap-6 h-full overflow-x-auto">
      {stages.map((stage) => {
        const stageLeads = getLeadsByStage(stage)
        const isDragOver = dragOverStage === stage

        return (
          <div
            key={stage}
            className={cn(
              "flex-shrink-0 w-80 bg-card rounded-lg border border-border",
              isDragOver && "ring-2 ring-primary ring-opacity-50 bg-accent",
            )}
            onDragOver={(e) => handleDragOver(e, stage)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage)}
          >
            <div className="p-4 border-b border-border">
              <h3 className="font-medium text-card-foreground">{stage}</h3>
              <span className="text-sm text-muted-foreground">
                {stageLeads.length} {stageLeads.length === 1 ? "lead" : "leads"}
              </span>
            </div>

            <div className="p-4 space-y-3 h-full overflow-y-auto">
              {stageLeads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No leads here yet</div>
              ) : (
                stageLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onMove={onLeadMove}
                    onClick={() => onLeadClick(lead)}
                    onDragStart={() => handleDragStart(lead.id)}
                    onDragEnd={handleDragEnd}
                    isDragging={draggedLead === lead.id}
                    stages={stages}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
