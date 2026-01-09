"use client"

import { useRef, useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { LeadCard } from "./lead-card"
import type React from "react"
import type { KanbanLead } from "../lib/types/database"

interface LazyLeadCardProps {
  lead: KanbanLead
  onMove: (leadId: string, newStage: string) => void
  onClick: (event?: React.MouseEvent) => void
  onDragStart: () => void
  onDragEnd: () => void
  isDragging: boolean
  stages: string[]
  onPinToggle?: (leadId: string, isPinned: boolean) => void
  isSelected?: boolean
  onSelectChange?: (isSelected: boolean) => void
  leadTotal?: number
  pipelineName?: string
}

/**
 * Componentă care renderizează lazy cardurile din kanban
 * Se renderizează doar când este vizibilă în viewport
 * După ce este vizibilă, rămâne renderizată (nu se demontează)
 */
export function LazyLeadCard({
  lead,
  onMove,
  onClick,
  onDragStart,
  onDragEnd,
  isDragging,
  stages,
  onPinToggle,
  isSelected,
  onSelectChange,
  leadTotal,
  pipelineName,
}: LazyLeadCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isVisible) {
      // Dacă e deja vizibil, nu mai urmări cu observer
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting) {
          setIsVisible(true)
          // Oprim observerul după ce devino vizibil
          observer.unobserve(entry.target)
        }
      },
      {
        // Preîncarcă cardurile când sunt la 300px distanță de viewport
        rootMargin: "300px",
        threshold: 0,
      }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => {
      observer.disconnect()
    }
  }, [isVisible])

  return (
    <div ref={ref}>
      {isVisible ? (
        <LeadCard
          lead={lead}
          onMove={onMove}
          onClick={onClick}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          isDragging={isDragging}
          stages={stages}
          onPinToggle={onPinToggle}
          isSelected={isSelected}
          onSelectChange={onSelectChange}
          leadTotal={leadTotal}
          pipelineName={pipelineName}
        />
      ) : (
        // Skeleton loader care imită dimensiunile LeadCard
        <div className="space-y-2 p-3 bg-card border rounded-lg">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      )}
    </div>
  )
}

