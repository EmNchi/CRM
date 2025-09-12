"use client"

import { useMemo, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { KanbanBoard } from "@/components/kanban-board"
import { LeadModal } from "@/components/lead-modal"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { useKanbanData } from "@/hooks/useKanbanData"
import type { KanbanLead } from '../lib/types/database'
import { useParams, usePathname } from "next/navigation"

const toSlug = (s: string) => String(s).toLowerCase().replace(/\s+/g, "-")

export default function CRMPage() {
  const params = useParams<{ pipeline?: string }>()
  const pathname = usePathname()
  const pipelineSlug =
    params?.pipeline ??
    pathname.match(/^\/leads\/([^\/?#]+)/)?.[1] ??
    undefined
    
  const [selectedLead, setSelectedLead] = useState<KanbanLead | null>(null)

  const { leads, stages, pipelines, loading, error, handleLeadMove } = useKanbanData(pipelineSlug)

  const activePipelineName =
    useMemo(() =>
      pipelines.find(p => toSlug(String(p)) === pipelineSlug)?.toString() ?? pipelineSlug,
      [pipelines, pipelineSlug]
    )

  const { toast } = useToast()

  const handleCloseModal = () => setSelectedLead(null)

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-lg">Loading...</div></div>
  if (error)   return <div className="flex items-center justify-center h-screen"><div className="text-red-500">Error: {error}</div></div>

  const handleMove = (leadId: string, newStage: string) => {
    handleLeadMove(leadId, newStage)
    toast({ title: "Lead moved", description: `Moved to ${newStage}`, duration: 2000 })
  }

  const handleLeadClick = (lead: KanbanLead) => setSelectedLead(lead)
  const handleLeadSelect = (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId)
    if (lead) handleLeadClick(lead)
  }

  return (
    <div className="flex min-h-dvh bg-background overflow-hidden">
      <Sidebar leads={leads} onLeadSelect={handleLeadSelect} pipelines={pipelines} />

      <main className="flex-1 min-w-0 min-h-0 flex flex-col">
        <header className="border-b border-border p-4">
          <h1 className="text-2xl font-semibold text-foreground">{activePipelineName}</h1>
          <p className="text-sm text-muted-foreground">Kanban board for Leads</p>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          <KanbanBoard leads={leads} stages={stages} onLeadMove={handleMove} onLeadClick={handleLeadClick} />
        </div>
      </main>

      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          isOpen={!!selectedLead}
          onClose={handleCloseModal}
          onStageChange={handleMove}
          stages={stages}
        />
      )}

      <Toaster />
    </div>
  )
}
