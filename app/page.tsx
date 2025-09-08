"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { KanbanBoard } from "@/components/kanban-board"
import { LeadModal } from "@/components/lead-modal"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { useKanbanData } from "@/hooks/useKanbanData"
import type { KanbanLead } from '../lib/types/database'

export default function CRMPage() {
  const [selectedLead, setSelectedLead] = useState<KanbanLead | null>(null)
  const { leads, stages, pipelines, loading, error, handleLeadMove } = useKanbanData()
  const { toast } = useToast()

  const handleCloseModal = () => {
    setSelectedLead(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-500">Error: {error}</div>
      </div>
    )
  }


  const handleMove = (leadId: string, newStage: string) => {
    handleLeadMove(leadId, newStage);

    toast({
      title: "Lead moved",
      description: `Moved to ${newStage}`,
      duration: 2000,
    })
  }

  const handleLeadClick = (lead: KanbanLead) => {
    setSelectedLead(lead)
  }

  const handleLeadSelect = (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId)
    if (lead) {
      handleLeadClick(lead)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar leads={leads} onLeadSelect={handleLeadSelect} pipelines={pipelines}/>

      <main className="flex-1 flex flex-col">
        <header className="border-b border-border p-4">
          <h1 className="text-2xl font-semibold text-foreground">Vanzari</h1>
          <p className="text-sm text-muted-foreground">Kanban board for Leads</p>
        </header>

        <div className="flex-1 p-6">
          <KanbanBoard
            leads={leads}
            stages={stages}
            onLeadMove={handleMove}
            onLeadClick={handleLeadClick}
          />
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