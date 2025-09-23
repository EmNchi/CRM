"use client"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import type { Lead } from "@/app/page" 
import Preturi from '@/components/preturi';
import LeadHistory from "@/components/lead-history"
import { useEffect, useState } from "react"
import DeConfirmat from "@/components/de-confirmat"

type Maybe<T> = T | null

interface LeadDetailsPanelProps {
  lead: Maybe<Lead>
  onClose: () => void
  onStageChange: (leadId: string, newStage: string) => void
  stages: string[]
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

  const [section, setSection] = useState<"fisa" | "deconfirmat" | "istoric">("fisa")
  const [stage, setStage] = useState(lead.stage)

  useEffect(() => {
    setStage(lead.stage)
  }, [lead.id, lead.stage])

  const handleStageChange = (newStage: string) => {
    const prevStage = stage            // use local stage as previous
    setStage(newStage)                 // optimistic UI update
  
    onStageChange(lead.id, newStage)   // keep your existing behavior
  }
  
  return (
    <section className="mt-6 rounded-lg border bg-card">
      <header className="flex items-center justify-between border-b p-4">
        <h2 className="text-lg font-semibold">{lead.name}</h2>
        <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4 items-start p-4">
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
            <Select value={stage} onValueChange={handleStageChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* RIGHT — switchable content */}
        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Secțiune</div>
            <Select value={section} onValueChange={(v: any) => setSection(v as "fisa" | "istoric")}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Alege secțiunea" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fisa">Fișa de serviciu</SelectItem>
                <SelectItem value="deconfirmat">De confirmat la client</SelectItem>
                <SelectItem value="istoric">Istoric</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {section === "fisa" && <Preturi leadId={lead.id} />}
          {section === "deconfirmat" && (
            <DeConfirmat
              leadId={lead.id}
              onMoveStage={(s) => onStageChange(lead.id, s)}
            />
          )}
          {section === "istoric" && <LeadHistory leadId={lead.id} />}
        </div>
      </div>
    </section>
  )
}
