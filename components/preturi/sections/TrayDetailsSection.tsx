'use client'

import { useState, useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Loader2, MessageSquare, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { useRole } from '@/lib/contexts/AuthContext'

interface TrayDetailsSectionProps {
  trayDetails: string
  loadingTrayDetails: boolean
  isCommercialPipeline: boolean
  onDetailsChange: (details: string) => void
  setIsDirty?: (dirty: boolean) => void
  isExpanded?: boolean
  onToggleExpanded?: () => void
  isVanzariPipeline?: boolean
  isReceptiePipeline?: boolean
}

export function TrayDetailsSection({
  trayDetails,
  loadingTrayDetails,
  isCommercialPipeline,
  onDetailsChange,
  setIsDirty,
  isExpanded: externalIsExpanded,
  onToggleExpanded: externalOnToggleExpanded,
  isVanzariPipeline = false,
  isReceptiePipeline = false,
}: TrayDetailsSectionProps) {
  const { isAdmin } = useRole()
  
  // Determină dacă utilizatorul poate edita - vânzători (Vânzări + Recepție) și admin
  const canEdit = useMemo(() => {
    return isAdmin || isVanzariPipeline || isReceptiePipeline
  }, [isAdmin, isVanzariPipeline, isReceptiePipeline])
  
  // State local dacă nu este controlat extern
  const [internalIsExpanded, setInternalIsExpanded] = useState(true)
  const isExpanded = externalIsExpanded !== undefined ? externalIsExpanded : internalIsExpanded
  const toggleExpanded = externalOnToggleExpanded || (() => setInternalIsExpanded(prev => !prev))

  if (!isCommercialPipeline) {
    return null
  }

  return (
    <div className="mx-2 sm:mx-4">
      <div className="rounded-xl border-2 border-amber-200/80 dark:border-amber-700/50 bg-gradient-to-br from-amber-50 via-orange-50/50 to-yellow-50/30 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-yellow-950/20 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-amber-100/80 to-orange-100/60 dark:from-amber-900/40 dark:to-orange-900/30 border-b border-amber-200/60 dark:border-amber-700/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                <MessageSquare className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-amber-900 dark:text-amber-100">
                  Informații Fișă Client
                </h3>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-300/70">
                  Notează exact ce a spus clientul • Vizibil pentru toate tăvițele
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleExpanded}
              className="h-7 w-7 p-0"
              title={isExpanded ? 'Minimizează' : 'Maximizează'}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="p-4 space-y-3">
          <Label className="text-[10px] font-bold text-amber-800/90 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
            <Info className="h-3 w-3" />
            Detalii comandă comunicate de client
          </Label>
          
          {loadingTrayDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
            </div>
          ) : (
            <Textarea
              value={trayDetails}
              onChange={(e) => {
                onDetailsChange(e.target.value)
                if (setIsDirty) setIsDirty(true)
              }}
              placeholder={canEdit ? 'Exemple: "Clienta dorește vârfurile foarte ascuțite, fără polish", "Nu scurtați lama", "Preferă retur prin curier".' : 'Numai vânzători și recepție pot edita aceste informații.'}
              className="min-h-[100px] text-sm resize-none border-amber-200/80 dark:border-amber-700/50 focus-visible:ring-amber-400/50 focus-visible:border-amber-400 bg-white/90 dark:bg-slate-950/60 placeholder:text-amber-600/40 dark:placeholder:text-amber-400/30"
              disabled={!canEdit}
            />
          )}

          <p className="text-[10px] text-amber-700/70 dark:text-amber-300/50 flex items-center gap-1">
            <span className="inline-block h-1 w-1 rounded-full bg-amber-400" />
            {canEdit 
              ? "Salvare automată la închiderea panoului • Vizibil în toate departamentele" 
              : "Vizualizare protejată • Vizibil în toate departamentele"}
          </p>
        </div>
        )}
      </div>
    </div>
  )
}
