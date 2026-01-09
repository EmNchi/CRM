'use client'

import { Plus, XIcon, Send, Loader2 } from 'lucide-react'
import type { LeadQuote } from '@/lib/types/preturi'

interface TrayTabsProps {
  quotes: LeadQuote[]
  selectedQuoteId: string | null
  isVanzariPipeline: boolean
  isReceptiePipeline: boolean
  isDepartmentPipeline: boolean
  isVanzatorMode: boolean
  sendingTrays: boolean
  traysAlreadyInDepartments: boolean
  currentServiceFileStage?: string | null
  officeDirect?: boolean  // Checkbox "Office Direct" bifat
  curierTrimis?: boolean  // Checkbox "Curier Trimis" bifat
  onTraySelect: (trayId: string) => void
  onAddTray: () => void
  onDeleteTray: (trayId: string) => void
  onSendTrays: () => void
  inline?: boolean // Dacă este true, elimină padding-ul pentru integrare inline
}

/**
 * Componentă independentă pentru gestionarea tabs-urilor tăvițelor
 * Include funcționalități de selecție, creare, ștergere și trimitere
 */
export function TrayTabs({
  quotes,
  selectedQuoteId,
  isVanzariPipeline,
  isReceptiePipeline,
  isDepartmentPipeline,
  isVanzatorMode,
  sendingTrays,
  traysAlreadyInDepartments,
  currentServiceFileStage = null,
  officeDirect = false,
  curierTrimis = false,
  onTraySelect,
  onAddTray,
  onDeleteTray,
  onSendTrays,
  inline = false,
}: TrayTabsProps) {
  // În Recepție: verifică checkbox-urile Office Direct sau Curier Trimis
  // În alte pipeline-uri: verifică stage-ul fișei
  const stageLC = currentServiceFileStage?.toLowerCase() || ''
  const isOfficeDirectStage = stageLC.includes('office') && stageLC.includes('direct')
  const isCurierTrimisStage = stageLC.includes('curier') && stageLC.includes('trimis')
  
  // canSendInThisStage e true dacă:
  // - În Recepție: unul dintre checkbox-uri e bifat
  // - Altfel: stage-ul fișei e Office Direct sau Curier Trimis
  const canSendInThisStage = isReceptiePipeline 
    ? (officeDirect || curierTrimis)
    : (isOfficeDirectStage || isCurierTrimisStage)
  // Nu afișa tabs în mod departament
  // Permite afișarea în VanzariView (isVanzariPipeline) și ReceptieView (isReceptiePipeline)
  if (isDepartmentPipeline) {
    return null
  }

  return (
    <div className={inline ? "" : "px-2 sm:px-3 lg:px-4 pb-2 sm:pb-3"}>
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide">
        {quotes.map((q, index) => {
          const isUnassigned = !q.number || q.number.trim() === ''
          return (
          <div key={q.id} className="relative group">
            <button
              onClick={() => onTraySelect(q.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap
                ${selectedQuoteId === q.id 
                  ? isUnassigned 
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25'
                    : 'bg-primary text-primary-foreground shadow-md shadow-primary/25' 
                  : isUnassigned
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }
                ${(isVanzariPipeline || isReceptiePipeline) && quotes.length > 1 ? 'pr-8' : ''}`}
            >
              <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold
                ${selectedQuoteId === q.id 
                  ? 'bg-primary-foreground/20 text-primary-foreground' 
                  : isUnassigned
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                    : 'bg-muted-foreground/20 text-muted-foreground'
                }`}>
                {isUnassigned ? '?' : (q.number || index + 1)}
              </span>
              <span>{isUnassigned ? 'Nerepartizat' : `Tăviță ${q.size && `(${q.size})`}`}</span>
            </button>
            {/* Buton de ștergere - doar pentru Vânzări și Recepție și când avem mai mult de o tăviță */}
            {(isVanzariPipeline || isReceptiePipeline) && quotes.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteTray(q.id)
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"
                title="Șterge tăvița"
              >
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </div>
        )})}
        
        {/* Buton adaugă tăviță nouă */}
        <button
          onClick={onAddTray}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-all duration-200 whitespace-nowrap border-2 border-dashed border-primary/30 hover:border-primary/50"
        >
          <Plus className="h-4 w-4" />
          <span>Nouă</span>
        </button>
        
        {/* Butonul "Trimite tăvițele" - pentru pipeline-ul Receptie */}
        {isReceptiePipeline && (
          <button
            onClick={onSendTrays}
            disabled={sendingTrays || quotes.length === 0 || traysAlreadyInDepartments || !canSendInThisStage}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            title={
              sendingTrays 
                ? "Se trimit tăvițele..." 
                : quotes.length === 0 
                ? "Nu există tăvițe de trimis" 
                : traysAlreadyInDepartments 
                ? "Tăvițele sunt deja trimise în departamente"
                : !canSendInThisStage
                ? isReceptiePipeline
                  ? "Bifează 'Office Direct' sau 'Curier Trimis' pentru a putea trimite"
                  : `Mutează fișa în 'Office Direct' sau 'Curier Trimis' pentru a putea trimite`
                : `Trimite ${quotes.filter(q => q.number && q.number.trim() !== '').length} tăviț${quotes.filter(q => q.number && q.number.trim() !== '').length === 1 ? 'ă' : 'e'} în departamente`
            }
          >
            {sendingTrays ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Se trimit...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Trimite ({quotes.length})
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}



