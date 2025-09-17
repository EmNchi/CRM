"use client"

import type React from "react"

import { useState } from "react"
import { LeadCard } from "@/components/lead-card"
import { cn } from "@/lib/utils"
import type { KanbanLead } from "../lib/types/database"
import { Trash2 } from "lucide-react"
import { useRole } from "@/hooks/useRole"
import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogFooter
} from "@/components/ui/alert-dialog"

interface KanbanBoardProps {
  leads: KanbanLead[]
  stages: string[]
  onLeadMove: (leadId: string, newStage: string) => void
  onLeadClick: (lead: KanbanLead) => void
  onDeleteStage?: (stageName: string) => Promise<void>
}

export function KanbanBoard({ leads, stages, onLeadMove, onLeadClick, onDeleteStage }: KanbanBoardProps) {
  const [draggedLead, setDraggedLead] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)

  const { isOwner } = useRole()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [targetStage, setTargetStage] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteErr, setDeleteErr] = useState<string | null>(null)

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
    <div className="flex gap-6 overflow-x-auto overflow-y-hidden">
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
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-card-foreground">{stage}</h3>
                  <span className="text-sm text-muted-foreground">
                    {stageLeads.length} {stageLeads.length === 1 ? "lead" : "leads"}
                  </span>
                </div>

                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => { setTargetStage(stage); setConfirmOpen(true) }}
                    aria-label={`Delete stage ${stage}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
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
    </div>
  )
}
