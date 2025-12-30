"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { MoreHorizontal, GripVertical, Mail, Calendar, Clock, User, Phone, Pin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { Lead } from "@/app/(crm)/dashboard/page"
import type { TagColor } from "@/lib/supabase/tagOperations"
import { getOrCreatePinnedTag, toggleLeadTag } from "@/lib/supabase/tagOperations"
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns"
import { ro } from "date-fns/locale"
import { useToast } from "@/hooks/use-toast"

interface LeadCardProps {
  lead: Lead
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

export function LeadCard({ lead, onMove, onClick, onDragStart, onDragEnd, isDragging, stages, onPinToggle, isSelected = false, onSelectChange, leadTotal = 0, pipelineName }: LeadCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isPinning, setIsPinning] = useState(false)
  const { toast } = useToast()
  
  // verifica daca lead-ul este pinned
  const isPinned = useMemo(() => {
    return lead.tags?.some(tag => tag.name === 'PINNED') || false
  }, [lead.tags])

  // functie pentru formatarea inteligenta a datei
  const formatSmartDate = (date: Date) => {
    if (isToday(date)) {
      return `Astăzi, ${format(date, "HH:mm", { locale: ro })}`
    } else if (isYesterday(date)) {
      return `Ieri, ${format(date, "HH:mm", { locale: ro })}`
    } else {
      return format(date, "dd MMM yyyy, HH:mm", { locale: ro })
    }
  }

  // verifica daca lead-ul este nou (max 1 zi) si calculeaza timpul
  const leadAge = useMemo(() => {
    if (!lead.createdAt) return null
    
    const createdDate = new Date(lead.createdAt)
    const now = new Date()
    const diffInHours = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60)
    const diffInMinutes = (now.getTime() - createdDate.getTime()) / (1000 * 60)
    
    const isNew = diffInHours <= 24
    
    let timeText = ''
    if (diffInMinutes < 60) {
      timeText = `${Math.floor(diffInMinutes)} minute`
    } else if (diffInHours < 24) {
      timeText = `${Math.floor(diffInHours)} ore`
    } else {
      timeText = `${Math.floor(diffInHours / 24)} zile`
    }
    
    return { isNew, timeText }
  }, [lead.createdAt])

  // actualizeaza timpul curent periodic pentru actualizare in timp real
  useEffect(() => {
    const stageName = lead.stage?.toLowerCase() || ''
    const isAsteptare = stageName.includes('asteptare')
    const isDeConfirmat = stageName.includes('confirmat') && !stageName.includes('confirmari')
    const isConfirmari = stageName.includes('confirmari')
    
    // doar daca lead-ul este in unul dintre stage-urile relevante, actualizeaza timpul
    if ((isAsteptare || isDeConfirmat || isConfirmari) && lead.stageMovedAt) {
      // actualizeaza la fiecare 30 de secunde pentru precizie
      const interval = setInterval(() => {
        setCurrentTime(new Date())
      }, 30000) // 30 secunde
      
      return () => clearInterval(interval)
    }
  }, [lead.stage, lead.stageMovedAt])

  // calculeaza timpul petrecut in stage-ul curent (pentru Asteptare, De Confirmat sau Confirmari)
  const timeInStage = useMemo(() => {
    const stageName = lead.stage?.toLowerCase() || ''
    const isAsteptare = stageName.includes('asteptare')
    const isDeConfirmat = stageName.includes('confirmat') && !stageName.includes('confirmari')
    const isConfirmari = stageName.includes('confirmari')
    
    if (!isAsteptare && !isDeConfirmat && !isConfirmari) return null
    
    if (!lead.stageMovedAt) return null
    
    const movedDate = new Date(lead.stageMovedAt)
    const now = currentTime // foloseste currentTime in loc de new Date() pentru actualizare in timp real
    const diffInMs = now.getTime() - movedDate.getTime()
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
    
    let timeText = ''
    if (diffInMinutes < 60) {
      timeText = `${diffInMinutes} minute`
    } else if (diffInHours < 24) {
      timeText = `${diffInHours} ore`
    } else {
      timeText = `${diffInDays} zile`
    }
    
    let label = ''
    if (isAsteptare) {
      label = 'În așteptare'
    } else if (isConfirmari) {
      label = 'Confirmări'
    } else {
      label = 'De confirmat'
    }
    
    return {
      timeText,
      label
    }
  }, [lead.stage, lead.stageMovedAt, currentTime])

  const tagClass = (c: TagColor) =>
    c === "green" ? "bg-emerald-100 text-emerald-800"
  : c === "yellow" ? "bg-amber-100 text-amber-800"
  : c === "orange" ? "bg-orange-100 text-orange-800"
  : c === "blue" ? "bg-blue-100 text-blue-800"
  :                  "bg-rose-100 text-rose-800"

  // verifica daca un tag este un tag de departament
  const isDepartmentTag = (tagName: string) => {
    const departmentTags = ['Horeca', 'Saloane', 'Frizerii', 'Reparatii']
    return departmentTags.includes(tagName)
  }

  // returneaza stilul pentru insigne de departament
  const getDepartmentBadgeStyle = (tagName: string) => {
    const styles: Record<string, string> = {
      'Horeca': 'bg-gradient-to-r from-orange-500 to-orange-600 border-orange-300',
      'Saloane': 'bg-gradient-to-r from-emerald-500 to-emerald-600 border-emerald-300',
      'Frizerii': 'bg-gradient-to-r from-amber-500 to-amber-600 border-amber-300',
      'Reparatii': 'bg-gradient-to-r from-blue-500 to-blue-600 border-blue-300',
    }
    return styles[tagName] || 'bg-gradient-to-r from-gray-500 to-gray-600 border-gray-300'
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // daca se da click pe checkbox sau butoane, nu deschide detalii
    if (
      (e.target as HTMLElement).closest("[data-menu]") || 
      (e.target as HTMLElement).closest("[data-drag-handle]") ||
      (e.target as HTMLElement).closest("[data-checkbox]") ||
      (e.target as HTMLElement).closest("button")
    ) {
      return
    }
    
    // Ctrl+Click sau Cmd+Click pentru selectie multipla
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      e.stopPropagation()
      onSelectChange?.(!isSelected)
      return
    }
    
    onClick(e)
  }

  const handleCheckboxChange = (checked: boolean) => {
    onSelectChange?.(checked)
  }

  const handleStageSelect = (newStage: string) => {
    onMove(lead.id, newStage)
    setIsMenuOpen(false)
  }

  const handlePinToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isPinning) return
    
    setIsPinning(true)
    try {
      // gaseste sau creeaza tag-ul PINNED
      const pinnedTag = await getOrCreatePinnedTag()
      
      // toggle tag-ul
      await toggleLeadTag(lead.id, pinnedTag.id)
      
      // notifica parintele
      const newIsPinned = !isPinned
      onPinToggle?.(lead.id, newIsPinned)
      
      toast({
        title: newIsPinned ? "Lead pinned" : "Lead unpinned",
        description: newIsPinned ? "Lead-ul va aparea primul in stage" : "Lead-ul a fost unpinned",
      })
    } catch (error) {
      console.error('Eroare la toggle pin:', error)
      toast({
        title: "Eroare",
        description: "Nu s-a putut actualiza starea de pin",
        variant: "destructive",
      })
    } finally {
      setIsPinning(false)
    }
  }

  const isTrayOrServiceFile = (lead as any).type === 'tray' || (lead as any).type === 'service_file' || lead.isQuote
  const isReadOnly = (lead as any).isReadOnly || false
  
  return (
    <div
      className={cn(
        "bg-background border rounded-lg shadow-sm transition-all hover:shadow-md",
        isTrayOrServiceFile ? "p-2" : "p-3", // Padding mai mic pentru tăvițe
        isDragging && !isReadOnly && "opacity-50 rotate-2 scale-105",
        isSelected && "border-primary border-2 bg-primary/5",
        isReadOnly && "opacity-75 cursor-not-allowed",
      )}
      draggable={!isReadOnly}
      onDragStart={!isReadOnly ? onDragStart : undefined}
      onDragEnd={!isReadOnly ? onDragEnd : undefined}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {(lead.isQuote || (lead as any).type === 'tray') ? (
            // Afișare minimalistă pentru tăviță (tray)
            <>
              {/* Header: Client (fără suma în header) */}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm text-foreground truncate">{lead.name}</h4>
                {((lead as any).trayNumber || (lead as any).traySize) && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {(lead as any).trayNumber && (
                      <span className="text-xs text-muted-foreground">#{((lead as any).trayNumber)}</span>
                    )}
                    {(lead as any).traySize && (
                      <span className="text-xs text-muted-foreground">{(lead as any).traySize}</span>
                    )}
                  </div>
                )}
              </div>
              
              {/* Info row: Tehnician (simplificat) */}
              {lead.technician && (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-muted-foreground truncate">{lead.technician}</span>
                </div>
              )}
              
              {/* Timp în stage-ul "IN LUCRU" sau "IN ASTEPTARE" (minimalist) */}
              {((lead as any).inLucruSince || (lead as any).inAsteptareSince) && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  {(lead as any).inLucruSince && (
                    <span>În lucru: {formatDistanceToNow(new Date((lead as any).inLucruSince), { addSuffix: false, locale: ro })}</span>
                  )}
                  {(lead as any).inAsteptareSince && (
                    <span>În așteptare: {formatDistanceToNow(new Date((lead as any).inAsteptareSince), { addSuffix: false, locale: ro })}</span>
                  )}
                </div>
              )}
            </>
          ) : (lead as any).type === 'service_file' ? (
            // Afișare minimalistă pentru fișă de serviciu
            <>
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-medium text-foreground truncate text-sm">{lead.name}</h4>
                {(lead as any).serviceFileNumber && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    #{(lead as any).serviceFileNumber}
                  </span>
                )}
              </div>
              
              {lead.phone && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <span className="truncate">{lead.phone}</span>
                </div>
              )}
            </>
          ) : (
            // Afișare pentru lead (comportament normal)
            <>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-foreground truncate">{lead.name}</h4>
                {leadAge?.isNew && (
                  <span 
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-sm animate-pulse border border-red-300 cursor-help"
                    title={`Lead creat acum ${leadAge.timeText}`}
                  >
                    NOU
                  </span>
                )}
              </div>
              
              {lead.email && (
                <div className="flex items-center gap-1 mt-1">
                  <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                </div>
              )}
              
              {lead.phone && (
                <div className="flex items-center gap-1 mt-1">
                  <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-muted-foreground truncate">{lead.phone}</p>
                </div>
              )}
              
              {lead.technician && (
                <div className="flex items-center gap-1 mt-1">
                  <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-muted-foreground truncate">Tehnician: {lead.technician}</p>
                </div>
              )}
            </>
          )}
          
          {lead.createdAt && (
            <div className="mt-1.5 space-y-0.5">
              <p className="text-xs text-muted-foreground truncate">
                {formatSmartDate(new Date(lead.createdAt))}
              </p>
              
              {timeInStage && (
                <p className="text-xs text-orange-600 font-medium truncate">
                  {timeInStage.label}: {timeInStage.timeText}
                </p>
              )}
            </div>
          )}
          
          {(lead.tags?.length ?? 0) > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {lead.tags!.map(tag => {
                const isUrgent = tag.name.toLowerCase() === 'urgent'
                const isRetur = tag.name === 'RETUR'
                const isUrgentOrRetur = isUrgent || isRetur
                
                // Nu afișa tag-ul urgent în pipeline-ul Vanzari
                if (isUrgent && pipelineName && pipelineName.toLowerCase().includes('vanzari')) {
                  return null
                }
                
                if (isDepartmentTag(tag.name)) {
                  return (
                    <span
                      key={tag.id}
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${getDepartmentBadgeStyle(tag.name)} text-white ${isUrgentOrRetur ? 'animate-border-strobe' : ''}`}
                    >
                      {tag.name}
                    </span>
                  )
                }
                if (isUrgentOrRetur) {
                  return (
                    <Badge 
                      key={tag.id} 
                      variant="outline" 
                      className="bg-red-600 text-white border-red-600 text-[10px] px-1.5 py-0.5 animate-border-strobe"
                    >
                      {tag.name}
                    </Badge>
                  )
                }
                return (
                  <Badge 
                    key={tag.id} 
                    variant="outline" 
                    className={`${tagClass(tag.color)} text-[10px] px-1.5 py-0.5`}
                  >
                    {tag.name}
                  </Badge>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Checkbox pentru selectie multipla */}
          {onSelectChange && (
            <div className="flex-shrink-0" data-checkbox onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={handleCheckboxChange}
                data-checkbox
              />
            </div>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 w-6 p-0",
              isPinned && "text-blue-600 dark:text-blue-400"
            )}
            onClick={handlePinToggle}
            disabled={isPinning}
            title={isPinned ? "Unpin lead" : "Pin lead"}
            data-menu
          >
            <Pin className={cn("h-3 w-3", isPinned && "fill-current")} />
          </Button>
          
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
      
      {pipelineName && !pipelineName.toLowerCase().includes('vanzari') && (
      <div className="flex justify-end mt-2">
      <div className="text-xs font-medium text-muted-foreground">
          {leadTotal > 0 ? (
            <span className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-semibold" title="Total toate tăvițele clientului">
              Total: {leadTotal.toFixed(2)} RON
            </span>
          ) : (
            <span className="text-gray-400" title="Clientul nu are tăvițe">
              Total: 0.00 RON
            </span>
          )}
        </div>
      </div>
      )}
    </div>
  )
}
