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
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus } from "lucide-react"
import { useRole } from '@/hooks/useRole'

const toSlug = (s: string) => String(s).toLowerCase().replace(/\s+/g, "-")

export default function CRMPage() {
  const params = useParams<{ pipeline?: string }>()
  const pathname = usePathname()
  const pipelineSlug =
    params?.pipeline ??
    pathname.match(/^\/leads\/([^\/?#]+)/)?.[1] ??
    undefined

  const { reload } = useKanbanData(pipelineSlug)
  const { toast } = useToast()

  const { isOwner} = useRole()
  const [createStageOpen, setCreateStageOpen] = useState(false)
  const [stageName, setStageName] = useState("")
  const [creatingStage, setCreatingStage] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<KanbanLead | null>(null)

  const { leads, stages, pipelines, loading, error, handleLeadMove } = useKanbanData(pipelineSlug)


  async function handleDeleteStage(stageName: string) {
    const res = await fetch("/api/stages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipelineSlug, stageName }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || "Failed to delete stage")

    toast({ title: "Stage deleted", description: `“${stageName}” and its leads were removed.` })
    reload()
  }

  const activePipelineName =
    useMemo(() =>
      pipelines.find(p => toSlug(String(p)) === pipelineSlug)?.toString() ?? pipelineSlug,
      [pipelines, pipelineSlug]
    )

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

          {isOwner && (
            <div className="mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateStageOpen(true)}
                className="h-8 gap-2"
              >
                <Plus className="h-4 w-4" />
                Add a new stage
              </Button>
            </div>
          )}
        </header>

        <div className="flex-1 p-6 overflow-auto">
          <KanbanBoard leads={leads} stages={stages} onLeadMove={handleMove} onLeadClick={handleLeadClick} onDeleteStage={handleDeleteStage}/>
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
                reload()
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
    </div>
  )
}
