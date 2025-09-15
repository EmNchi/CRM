"use client"

import { useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import type { Lead } from "@/app/page"

interface LeadModalProps {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
  onStageChange: (leadId: string, newStageName: string) => void
  stages: string[]                                 
  pipelines: string[]                               
  pipelineSlug?: string                             
  onMoveToPipeline: (leadId: string, targetPipelineName: string) => void
  pipelineOptions?: { name: string; activeStages: number }[] 
}

export function LeadModal({
  lead,
  isOpen,
  onClose,
  onStageChange,
  stages,
  pipelines,
  pipelineSlug,
  onMoveToPipeline,
  pipelineOptions
}: LeadModalProps) {

  const toSlug = (s: string) => String(s).toLowerCase().replace(/\s+/g, "-")

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    if (isOpen) document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose])

  if (!lead) return null

  const handleStageChange = (newStageName: string) => {
    onStageChange(lead.id, newStageName)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{lead.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="font-medium text-foreground">Name</label>
              <p className="text-muted-foreground">{lead.name}</p>
            </div>

            {lead.company && (
              <div>
                <label className="font-medium text-foreground">Company</label>
                <p className="text-muted-foreground">{lead.company}</p>
              </div>
            )}

            {lead.phone && (
              <div>
                <label className="font-medium text-foreground">Phone</label>
                <p className="text-muted-foreground">{lead.phone}</p>
              </div>
            )}

            {lead.email && (
              <div>
                <label className="font-medium text-foreground">Email</label>
                <p className="text-muted-foreground">{lead.email}</p>
              </div>
            )}
          </div>

          <div>
            <label className="font-medium text-foreground">Current Stage</label>
            <div className="mt-1">
              <Badge variant="secondary">{lead.stage}</Badge>
            </div>
          </div>

          {lead.notes && (
            <div>
              <label className="font-medium text-foreground">Notes</label>
              <p className="text-muted-foreground text-sm mt-1">{lead.notes}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            { lead?.createdAt ?
              <div>
                <label className="font-medium text-foreground">Created At</label>
                <p className="text-muted-foreground">{format(lead?.createdAt, "MMM dd, yyyy")}</p>
              </div>
            : null }

            {lead?.lastActivity ?
              <div>
                <label className="font-medium text-foreground">Last Activity</label>
                <p className="text-muted-foreground">{format(lead?.lastActivity, "MMM dd, yyyy")}</p>
              </div>
            : null }       
          </div>

          <div>
            <label className="font-medium text-foreground mb-2 block">Move to Stage</label>
            <Select value={lead.stage} onValueChange={handleStageChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {stages.map((stageName) => (
                  <SelectItem key={stageName} value={stageName}>
                    {stageName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4">
            <label className="font-medium text-foreground mb-2 block">Move to another Pipeline</label>
            <Select
              onValueChange={(targetName: any) => {
                if (!lead) return
                if (targetName === pipelineSlug) return
                onMoveToPipeline(lead.id, targetName)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select pipeline" />
              </SelectTrigger>
              <SelectContent>
                {(pipelineOptions ?? pipelines.map((name) => ({ name, activeStages: 0 })))
                  .map(({ name, activeStages }) => (
                    <SelectItem
                      key={name}
                      value={name}
                      disabled={toSlug(name) === pipelineSlug || activeStages === 0}
                    >
                      {name}{activeStages === 0 ? " (no stages)" : ""}
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
