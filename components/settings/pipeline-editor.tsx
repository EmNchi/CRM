"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { GripVertical, Pencil, Check, X } from "lucide-react"

type StageItem = { id: string; name: string }

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  pipelineName: string
  stages: StageItem[]
  onSubmit: (payload: { pipelineName: string; stages: StageItem[] }) => void | Promise<void>
}

export default function PipelineEditor({
  open,
  onOpenChange,
  pipelineName,
  stages,
  onSubmit,
}: Props) {
  const [name, setName] = useState(pipelineName)
  const [items, setItems] = useState<StageItem[]>(stages)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState("")

  useEffect(() => {
    if (open) {
      setName(pipelineName)
      setItems(stages)
      setEditingId(null)
    }
  }, [open, pipelineName, stages])

  const hasChanges = useMemo(() => {
    if (name.trim() !== pipelineName.trim()) return true
    if (items.length !== stages.length) return true
    for (let i = 0; i < items.length; i++) {
      if (items[i].id !== stages[i].id) return true
      if (items[i].name.trim() !== stages[i].name.trim()) return true
    }
    return false
  }, [name, pipelineName, items, stages])

  // ---------- drag handlers (native HTML5, zero deps) ----------
  const onDragStart = (index: number) => () => setDragIndex(index)
  const onDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    setItems((prev) => {
      const arr = [...prev]
      const [moved] = arr.splice(dragIndex, 1)
      arr.splice(index, 0, moved)
      return arr
    })
    setDragIndex(index)
  }
  const onDragEnd = () => setDragIndex(null)

  // ---------- inline rename ----------
  const startEdit = (id: string, current: string) => {
    setEditingId(id)
    setEditingValue(current)
  }
  const cancelEdit = () => {
    setEditingId(null)
    setEditingValue("")
  }
  const commitEdit = () => {
    if (!editingId) return
    setItems((prev) => prev.map((it) => (it.id === editingId ? { ...it, name: editingValue.trim() || it.name } : it)))
    cancelEdit()
  }

  const handleSave = async () => {
    await onSubmit({ pipelineName: name.trim(), stages: items })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit board</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1 block">Pipeline name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <Label className="mb-2 block">Stages (drag to reorder)</Label>

            <ul className="space-y-2">
              {items.map((s, idx) => {
                const isEditing = editingId === s.id
                return (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 rounded border px-2 py-1 bg-background"
                    draggable
                    onDragStart={onDragStart(idx)}
                    onDragOver={onDragOver(idx)}
                    onDragEnd={onDragEnd}
                  >
                    <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground cursor-grab" />
                    <div className="flex-1">
                      {isEditing ? (
                        <Input
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit()
                            if (e.key === "Escape") cancelEdit()
                          }}
                          autoFocus
                        />
                      ) : (
                        <span>{s.name}</span>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={commitEdit} aria-label="Save name">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit} aria-label="Cancel edit">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => startEdit(s.id, s.name)}
                        aria-label="Rename stage"
                        title="Rename stage"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <Button onClick={handleSave} disabled={!hasChanges}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
