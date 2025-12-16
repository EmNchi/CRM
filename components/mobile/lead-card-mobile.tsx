'use client'

import { KanbanLead } from '@/lib/types/database'
import { Mail, Phone, Clock, MoreVertical, Tag, Move, Wrench } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ro } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { useState, useEffect } from 'react'

const supabase = supabaseBrowser()

interface LeadCardMobileProps {
  lead: KanbanLead
  onClick: () => void
  onMove?: () => void
  onEdit?: () => void
  onArchive?: () => void
}

export function LeadCardMobile({ 
  lead, 
  onClick, 
  onMove, 
  onEdit, 
  onArchive 
}: LeadCardMobileProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [isTechnician, setIsTechnician] = useState(false)
  
  // Verifică dacă utilizatorul este tehnician
  useEffect(() => {
    async function checkTechnician() {
      if (!user?.id) {
        setIsTechnician(false)
        return
      }
      const { data } = await supabase
        .from('app_members')
        .select('user_id, role')
        .eq('user_id', user.id)
        .single()
      
      setIsTechnician(!!data && data.role !== 'owner' && data.role !== 'admin')
    }
    checkTechnician()
  }, [user])
  
  // Verifică dacă lead-ul este o tăviță
  const leadAny = lead as any
  const isTray = leadAny.type === 'tray' || leadAny.isQuote || leadAny.quoteId
  const trayId = isTray ? lead.id : null
  
  const handleOpenTray = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (trayId) {
      router.push(`/tehnician/tray/${trayId}`)
    }
  }
  
  const getTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return formatDistanceToNow(date, { addSuffix: true, locale: ro })
    } catch {
      return 'Data necunoscută'
    }
  }

  const getStageTime = () => {
    if (lead.stageMovedAt) {
      return getTimeAgo(lead.stageMovedAt)
    }
    if (lead.createdAt) {
      return getTimeAgo(lead.createdAt)
    }
    return 'Data necunoscută'
  }

  const getTagColor = (color?: string) => {
    switch (color) {
      case 'green': return 'bg-green-100 text-green-800 border-green-200'
      case 'yellow': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'red': return 'bg-red-100 text-red-800 border-red-200'
      case 'blue': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'orange': return 'bg-orange-100 text-orange-800 border-orange-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Limitează tag-urile la primele 3
  const displayTags = lead.tags?.slice(0, 3) || []
  const hasMoreTags = (lead.tags?.length || 0) > 3

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card border rounded-lg p-4 mb-3 cursor-pointer",
        "active:bg-accent transition-colors",
        "min-h-[120px] touch-manipulation", // Minimum touch target
        "shadow-sm hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Conținut principal */}
        <div className="flex-1 min-w-0">
          {/* Nume lead */}
          <h3 className="font-semibold text-base mb-2 truncate">
            {lead.name || 'Fără nume'}
          </h3>

          {/* Email și telefon */}
          <div className="space-y-1.5 mb-3">
            {lead.email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{lead.email}</span>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{lead.phone}</span>
              </div>
            )}
          </div>

          {/* Vârstă lead */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <Clock className="h-3 w-3" />
            <span>{getStageTime()}</span>
          </div>

          {/* Tag-uri */}
          {displayTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {displayTags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className={cn(
                    "text-xs px-2 py-0.5 border",
                    getTagColor(tag.color)
                  )}
                >
                  {tag.name}
                </Badge>
              ))}
              {hasMoreTags && (
                <Badge variant="outline" className="text-xs px-2 py-0.5">
                  +{(lead.tags?.length || 0) - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Info suplimentare pentru tăvițe/fișe */}
          {(lead.isQuote || lead.isFisa) && (
            <div className="mt-2 space-y-2">
              <div className="text-xs text-muted-foreground">
                {lead.isQuote && lead.trayNumber && (
                  <span>Tăviță #{lead.trayNumber}</span>
                )}
                {lead.isFisa && lead.fisaId && (
                  <span>Fișă #{lead.fisaId}</span>
                )}
                {lead.total !== undefined && (
                  <span className="ml-2 font-medium">
                    {lead.total.toFixed(2)} RON
                  </span>
                )}
              </div>
              
              {/* Buton pentru deschidere tăviță */}
              {isTray && trayId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={handleOpenTray}
                >
                  <Wrench className="h-3.5 w-3.5 mr-2" />
                  Deschide tăvița
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Menu kebab */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation()
              }}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {onMove && (
              <DropdownMenuItem onClick={onMove}>
                <Move className="h-4 w-4 mr-2" />
                Mută lead
              </DropdownMenuItem>
            )}
            {onEdit && (
              <DropdownMenuItem onClick={onEdit}>
                Editează
              </DropdownMenuItem>
            )}
            {onArchive && (
              <DropdownMenuItem onClick={onArchive} className="text-destructive">
                Arhivează
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

