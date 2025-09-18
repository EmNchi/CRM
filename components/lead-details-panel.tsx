"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import type { Lead } from "@/app/page" 
import Preturi from '@/components/preturi';

type Maybe<T> = T | null

interface LeadDetailsPanelProps {
  lead: Maybe<Lead>
  onClose: () => void
  onStageChange: (leadId: string, newStage: string) => void
  stages: string[]

  // keep these optional so current callers compile even if unused
  pipelines?: string[]
  pipelineSlug?: string
  onMoveToPipeline?: (leadId: string, targetName: string) => Promise<void>
  pipelineOptions?: { name: string; activeStages: number }[]
}

export function LeadDetailsPanel({
  lead,
  onClose,
  onStageChange,
  stages,
}: LeadDetailsPanelProps) {
  if (!lead) return null

  const handleStageChange = (newStage: string) => {
    onStageChange(lead.id, newStage)
  }

  return (
    <section className="mt-6 rounded-lg border bg-card">
      <header className="flex items-center justify-between border-b p-4">
        <h2 className="text-lg font-semibold">{lead.name}</h2>
        <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)_360px] gap-4 items-start p-4">
        {/* LEFT column — identity & meta */}
        <div className="space-y-4">
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

          {lead.notes && (
            <div>
              <label className="font-medium text-foreground">Notes</label>
              <p className="text-muted-foreground text-sm mt-1">{lead.notes}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            {lead?.createdAt && (
              <div>
                <label className="font-medium text-foreground">Created At</label>
                <p className="text-muted-foreground">{format(lead.createdAt, "MMM dd, yyyy")}</p>
              </div>
            )}
            {lead?.lastActivity && (
              <div>
                <label className="font-medium text-foreground">Last Activity</label>
                <p className="text-muted-foreground">{format(lead.lastActivity, "MMM dd, yyyy")}</p>
              </div>
            )}
          </div>

          <div>
            <label className="font-medium text-foreground mb-2 block">Move to Stage</label>
            <Select value={lead.stage} onValueChange={handleStageChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* MIDDLE column — Preturi (full-height center) */}
        <div className="min-w-0 space-y-4">
          <Preturi leadId={lead.id} />
        </div>

        {/* RIGHT column — actions & notes */}
        <div className="space-y-4">

        </div>
      </div>
    </section>
  )
}
