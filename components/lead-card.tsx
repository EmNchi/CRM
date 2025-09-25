"use client"

import type React from "react"

import { useState } from "react"
import { MoreHorizontal, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { Lead } from "@/app/page"
import type { Tag, TagColor } from "@/lib/supabase/tagOperations"

interface LeadCardProps {
  lead: Lead
  onMove: (leadId: string, newStage: string) => void
  onClick: () => void
  onDragStart: () => void
  onDragEnd: () => void
  isDragging: boolean
  stages: string[]
}

export function LeadCard({ lead, onMove, onClick, onDragStart, onDragEnd, isDragging, stages }: LeadCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const tagClass = (c: TagColor) =>
    c === "green" ? "rounded-sm bg-emerald-100 text-emerald-800"
  : c === "yellow" ? "rounded-sm bg-amber-100  text-amber-800"
  :                  "rounded-sm bg-rose-100   text-rose-800"

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger onClick if clicking on the menu or drag handle
    if ((e.target as HTMLElement).closest("[data-menu]") || (e.target as HTMLElement).closest("[data-drag-handle]")) {
      return
    }
    onClick()
  }

  const handleStageSelect = (newStage: string) => {
    onMove(lead.id, newStage)
    setIsMenuOpen(false)
  }

  return (
    <div
      className={cn(
        "bg-background border border-border rounded-lg p-3 shadow-sm cursor-pointer transition-all hover:shadow-md",
        isDragging && "opacity-50 rotate-2 scale-105",
      )}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-foreground truncate">{lead.name}</h4>
          {lead.company && <p className="text-xs text-muted-foreground truncate mt-1">{lead.company}</p>}
          {(lead.tags?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap gap-1 max-h-10 overflow-y-auto">
              {lead.tags!.map(tag => (
                <Badge key={tag.id} variant="outline" className={tagClass(tag.color)}>
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <div data-drag-handle className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded">
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </div>

          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" data-menu>
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {stages.map((stage) => (
                <DropdownMenuItem key={stage} onClick={() => handleStageSelect(stage)} disabled={stage === lead.stage}>
                  Move to {stage}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
