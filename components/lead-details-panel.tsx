"use client"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import type { Lead } from "@/app/page" 
import Preturi from '@/components/preturi';
import LeadHistory from "@/components/lead-history"
import { useEffect, useState } from "react"
import DeConfirmat from "@/components/de-confirmat"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"
import { ChevronsUpDown } from "lucide-react"
import { listTags, toggleLeadTag, type Tag, type TagColor } from "@/lib/supabase/tagOperations"
import { supabaseBrowser } from "@/lib/supabase/supabaseClient"

type Maybe<T> = T | null

interface LeadDetailsPanelProps {
  lead: Maybe<Lead>
  onClose: () => void
  onStageChange: (leadId: string, newStage: string) => void
  stages: string[]
  pipelines: string[]
  pipelineSlug?: string
  onMoveToPipeline?: (leadId: string, targetName: string) => Promise<void>
  pipelineOptions?: { name: string; activeStages: number }[]
  onTagsChange?: (leadId: string, tags: Tag[]) => void
  onBulkMoveToPipelines?: (leadId: string, pipelineNames: string[]) => Promise<void>
}

export function LeadDetailsPanel({
  lead,
  onClose,
  onStageChange,
  onTagsChange,
  onMoveToPipeline,
  onBulkMoveToPipelines,
  pipelines,
  stages,
}: LeadDetailsPanelProps) {
  if (!lead) return null

  const supabase = supabaseBrowser()
  const [section, setSection] = useState<"fisa" | "deconfirmat" | "istoric">("fisa")
  const [stage, setStage] = useState(lead.stage)

  const tagClass = (c: TagColor) =>
    c === "green" ? "bg-emerald-100 text-emerald-800"
  : c === "yellow" ? "bg-amber-100  text-amber-800"
  :                  "bg-rose-100   text-rose-800"

  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

  const [selectedPipes, setSelectedPipes] = useState<string[]>([])
  const [movingPipes, setMovingPipes] = useState(false)

  const allPipeNames = pipelines ?? []

  const togglePipe = (name: string) =>
    setSelectedPipes(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name])

  const pickAll = () => setSelectedPipes(allPipeNames)
  const clearAll = () => setSelectedPipes([])

  useEffect(() => {
    const ch = supabase
      .channel('rt-tags-lead-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' },
        () => listTags().then(setAllTags).catch(console.error)
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { listTags().then(setAllTags).catch(console.error) }, [])

  useEffect(() => {
    if (!lead) return
    setSelectedTagIds((lead.tags ?? []).map(t => t.id))
  }, [lead?.id])

  useEffect(() => {
    setStage(lead.stage)
  }, [lead.id, lead.stage])

  async function handleToggleTag(tagId: string) {
    if (!lead) return
  
    // 1) server change
    await toggleLeadTag(lead.id, tagId)
  
    // 2) compute next selection based on current state
    const nextIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter(id => id !== tagId)
      : [...selectedTagIds, tagId]
  
    // 3) local update
    setSelectedTagIds(nextIds)
  
    // 4) notify parent AFTER local setState (outside render)
    const nextTags = allTags.filter(t => nextIds.includes(t.id))
    onTagsChange?.(lead.id, nextTags)
  }
  
  const handleStageChange = (newStage: string) => {
    setStage(newStage)                
  
    onStageChange(lead.id, newStage)
  }
  
  return (
    <section className="mt-6 rounded-lg border bg-card">
      <header className="border-b p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{lead.name}</h2>

            <div className="mt-2 flex items-center gap-2">
              {/* Add tags button + multi-select */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 px-2">
                    Add tags
                    <ChevronsUpDown className="ml-1 h-4 w-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[260px]">
                  {allTags.map(tag => (
                    <DropdownMenuCheckboxItem
                      key={tag.id}
                      checked={selectedTagIds.includes(tag.id)}
                      onCheckedChange={() => handleToggleTag(tag.id)}
                      onSelect={(e) => e.preventDefault()} // ← keep menu open
                    >
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[11px] leading-5 ${tagClass(tag.color)}`}>
                        {tag.name}
                      </span>
                    </DropdownMenuCheckboxItem>
                  ))}
                  {allTags.length === 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                      No tags defined yet.
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Selected chips — inline, small radius, wrap at max width */}
              <div className="flex flex-wrap gap-1 max-w-[60%] md:max-w-[520px]">
                {allTags
                  .filter(t => selectedTagIds.includes(t.id))
                  .map(tag => (
                    <span
                      key={tag.id}
                      className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[11px] leading-5 ${tagClass(tag.color)}`}
                    >
                      {tag.name}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
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
          {/* Move to pipeline(s) */}
          <div className="mt-4">
            <label className="font-medium text-foreground mb-2 block">
              Move to pipeline(s)
            </label>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    {selectedPipes.length > 0 ? `Selected: ${selectedPipes.length}` : "Choose pipelines"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="w-[260px] max-h-[280px] overflow-y-auto">
                  {/* Pick all / Clear all */}
                  <DropdownMenuCheckboxItem
                    checked={selectedPipes.length === allPipeNames.length && allPipeNames.length > 0}
                    onCheckedChange={(v) => (v ? pickAll() : clearAll())}
                    onSelect={(e) => e.preventDefault()} // keep menu open
                  >
                    Pick all
                  </DropdownMenuCheckboxItem>

                  <div className="my-1 h-px bg-border" />

                  {/* Pipelines list */}
                  {allPipeNames.map(name => (
                    <DropdownMenuCheckboxItem
                      key={name}
                      checked={selectedPipes.includes(name)}
                      onCheckedChange={() => togglePipe(name)}
                      onSelect={(e) => e.preventDefault()} // keep menu open
                    >
                      <span className="truncate">{name}</span>
                    </DropdownMenuCheckboxItem>
                  ))}

                  {allPipeNames.length === 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                      No pipelines available.
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Action button – will do real work in Step 2 */}
              <Button
                size="sm"
                disabled={movingPipes || selectedPipes.length === 0}
                onClick={async () => {
                  if (!lead?.id) return
                  setMovingPipes(true)
                  try {
                    if (onBulkMoveToPipelines) {
                      await onBulkMoveToPipelines(lead.id, selectedPipes)
                    } else if (onMoveToPipeline) {
                      for (const name of selectedPipes) {
                        await onMoveToPipeline(lead.id, name)
                      }
                    }
                    setSelectedPipes([])
                  } finally {
                    setMovingPipes(false)
                  }
                }}
              >
                {movingPipes ? "Moving…" : "Move"}
              </Button>
            </div>
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
