"use client"

import { useEffect, useMemo, useState } from "react"
import { KanbanBoard } from "@/components/kanban-board"
import { LeadDetailsPanel } from "@/components/lead-details-panel"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { useKanbanData } from "@/hooks/useKanbanData"
import type { KanbanLead } from '../lib/types/database'
import { useParams, useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, Settings2 } from "lucide-react"
import { useRole } from '@/hooks/useRole'
import { moveLeadToPipelineByName, getPipelineOptions, getPipelinesWithStages, updatePipelineAndStages } from "@/lib/supabase/leadOperations"
import PipelineEditor from "@/components/pipeline-editor"

const toSlug = (s: string) => String(s).toLowerCase().replace(/\s+/g, "-")

export default function CRMPage() {
  const params = useParams<{ pipeline?: string }>()
  const pathname = usePathname()
  const pipelineSlug =
    params?.pipeline ??
    pathname.match(/^\/leads\/([^\/?#]+)/)?.[1] ??
    undefined

  const { toast } = useToast()
  const router = useRouter()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorData, setEditorData] = useState<{
    pipelineId: string
    pipelineName: string
    stages: { id: string; name: string }[]
  } | null>(null)

  const { isOwner} = useRole()
  const [createStageOpen, setCreateStageOpen] = useState(false)
  const [stageName, setStageName] = useState("")
  const [creatingStage, setCreatingStage] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<KanbanLead | null>(null)
  const [pipelineOptions, setPipelineOptions] = useState<{ name: string; activeStages: number }[]>([])

  const { leads, stages, pipelines, loading, error, handleLeadMove, refresh } = useKanbanData(pipelineSlug)

  async function openEditor() {
    const { data } = await getPipelinesWithStages()
    // find current pipeline by slug
    const current = data?.find((p: any) => toSlug(p.name) === pipelineSlug) // you already have toSlug+pipelineSlug
    if (!current) return
    setEditorData({
      pipelineId: current.id,
      pipelineName: current.name,
      stages: current.stages.map((s: any) => ({ id: s.id, name: s.name })),
    })
    setEditorOpen(true)
  }

  async function handleDeleteStage(stageName: string) {
    const res = await fetch("/api/stages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipelineSlug, stageName }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || "Failed to delete stage")

    toast({ title: "Stage deleted", description: `“${stageName}” and its leads were removed.` })
    await refresh()
  }
  
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const rows = await getPipelineOptions()
        const byName = new Map(rows.map(r => [r.name, r.active_stages]))
        const opts = pipelines.map(name => ({ name, activeStages: byName.get(name) ?? 0 }))
        if (alive) setPipelineOptions(opts)
      } catch {
        // graceful fallback
        if (alive) setPipelineOptions(pipelines.map(name => ({ name, activeStages: 0 })))
      }
    })()
    return () => { alive = false }
  }, [pipelines])

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

  async function handleMoveToPipeline(leadId: string, targetName: string) {
    const res = await moveLeadToPipelineByName(leadId, targetName, "UI move from modal")
    if (!res.ok) {
      if (res.code === "TARGET_PIPELINE_NO_ACTIVE_STAGES") {
        toast({
          title: "Cannot move lead",
          description: "Selected pipeline has no stages. Add one and try again.",
          variant: "destructive",
        })
        return
      }
      if (res.code === "TARGET_PIPELINE_NOT_ACTIVE") {
        toast({
          title: "Pipeline inactive or missing",
          description: "Please pick an active pipeline.",
          variant: "destructive",
        })
        return
      }
      toast({ title: "Move failed", description: res.message ?? "Unexpected error", variant: "destructive" })
      return
    }

    setSelectedLead(null)
    toast({ title: "Lead moved", description: `Sent to ${targetName} (default stage).` })
    router.refresh?.() 
  }

  const handleLeadClick = (lead: KanbanLead) => setSelectedLead(lead)

  return (
    <div className="flex min-h-dvh bg-background overflow-hidden">

      <main className="flex-1 min-w-0 min-h-0 flex flex-col">
        <header className="border-b border-border p-4">
          <h1 className="text-2xl font-semibold text-foreground">{activePipelineName}</h1>

          {isOwner && (
            <div className="mt-2 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateStageOpen(true)}
                className="h-8 gap-2"
              >
                <Plus className="h-4 w-4" />
                Add a new stage
              </Button>

              <Button variant="outline" size="sm" onClick={openEditor} className="h-8 gap-2" aria-label="Edit board">
                <Settings2 className="h-4 w-4" />
                Edit board
              </Button>
            </div>
          )}
        </header>

        {editorData && (
          <PipelineEditor
            open={editorOpen}
            onOpenChange={setEditorOpen}
            pipelineName={editorData.pipelineName}
            stages={editorData.stages}
            onSubmit={async ({ pipelineName, stages }) => {
              const { error } = await updatePipelineAndStages(editorData!.pipelineId, pipelineName, stages)
              if (error) { toast({ variant: "destructive", title: "Save failed", description: String(error.message ?? error) }); return }
              await refresh?.()                                   // ensure UI reflects new order/name
              const newSlug = toSlug(pipelineName);               // if your URL uses slug
              if (newSlug !== pipelineSlug) router.replace(`/leads/${newSlug}`)
              setEditorOpen(false)
              toast({ title: "Board updated" })
              if (typeof window !== "undefined") window.dispatchEvent(new Event("pipelines:updated"))

            }}
          />
        )}

        <div className="flex-1 p-6 overflow-auto">
          <KanbanBoard leads={leads} stages={stages} onLeadMove={handleMove} onLeadClick={handleLeadClick} onDeleteStage={handleDeleteStage} />
          <LeadDetailsPanel
            lead={selectedLead}
            onClose={handleCloseModal}
            onStageChange={handleMove}
            stages={stages}
            pipelines={pipelines}
            pipelineSlug={pipelineSlug}
            onMoveToPipeline={handleMoveToPipeline}
            pipelineOptions={pipelineOptions}
          />
        </div>
      </main>

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
                await refresh()
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
