'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Package } from 'lucide-react'

interface TrayDetailsSectionProps {
  trayDetails: string
  loadingTrayDetails: boolean
  isCommercialPipeline: boolean
  onDetailsChange: (details: string) => void
}

export function TrayDetailsSection({
  trayDetails,
  loadingTrayDetails,
  isCommercialPipeline,
  onDetailsChange,
}: TrayDetailsSectionProps) {
  if (!isCommercialPipeline) {
    return null
  }

  return (
    <div className="px-2 sm:px-3 lg:px-4 pt-2 sm:pt-3 lg:pt-4 pb-2 sm:pb-3 lg:pb-4 border-b bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/70 dark:from-amber-900/40 dark:via-amber-950/40 dark:to-orange-950/30">
      <div className="flex flex-col gap-2 sm:gap-3 lg:gap-4 rounded-lg sm:rounded-xl border border-amber-300/80 dark:border-amber-700/80 bg-white/70 dark:bg-slate-950/40 px-2 sm:px-3 lg:px-4 py-2 sm:py-3 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-700 dark:text-amber-200 flex-shrink-0">
              <Package className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-xs sm:text-sm text-amber-900 dark:text-amber-100 tracking-wide">
                Informații Fișă Client
              </span>
              <span className="text-[10px] sm:text-xs text-amber-800/80 dark:text-amber-200/80">
                Aici notezi exact ce a spus clientul pentru această fișă. Detaliile sunt vizibile pentru toate tăvițele din fișă.
              </span>
            </div>
          </div>
        </div>

        {/* Textarea cu detalii pentru fișa de serviciu */}
        <div className="space-y-1 sm:space-y-1.5">
          <Label className="text-[10px] sm:text-[11px] font-semibold text-amber-900/90 dark:text-amber-100 uppercase tracking-wide">
            Detalii comandă comunicate de client (vizibile pentru tehnicieni)
          </Label>
          {loadingTrayDetails ? (
            <div className="flex items-center justify-center py-4 sm:py-6">
              <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Textarea
                value={trayDetails}
                onChange={(e) => onDetailsChange(e.target.value)}
                placeholder="Exemple: „Clienta dorește vârfurile foarte ascuțite, fără polish”, „Nu scurtați lama”, „Preferă retur prin curier”."
                className="min-h-[80px] sm:min-h-[100px] lg:min-h-[110px] text-xs sm:text-sm resize-none border-amber-200/80 focus-visible:ring-amber-500/40 bg-white/90 dark:bg-slate-950/60"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-amber-900/80 dark:text-amber-100/80">
                  Aceste note se salvează automat când închizi panoul și sunt vizibile pentru toate tăvițele din fișă în departamente.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

