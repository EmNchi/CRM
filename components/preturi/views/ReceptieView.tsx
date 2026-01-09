'use client'

import type { LeadQuoteItem, LeadQuote } from '@/lib/types/preturi'
import type { VanzariViewProps } from './VanzariView'
import { VanzariView } from './VanzariView'
import { CreateTrayDialog } from '../dialogs/CreateTrayDialog'
import { MoveInstrumentDialog } from '../dialogs/MoveInstrumentDialog'
import { SendConfirmationDialog } from '../dialogs/SendConfirmationDialog'
import { Button } from '@/components/ui/button'
import { Move, Package, ChevronRight } from 'lucide-react'

// ============================================================================
// TYPES - ReceptieView EXTINDE VanzariView cu props specifice Recepție
// ============================================================================

interface ReceptieViewProps extends VanzariViewProps {
  // Dialog props specifice pentru Recepție
  showCreateTrayDialog?: boolean | null | undefined
  onCancelCreateTray?: (() => void) | null | undefined
  onCreateTray?: ((number: string, size: string) => void) | null | undefined
  newTrayNumber?: string | null | undefined
  newTraySize?: string | null | undefined
  creatingTray?: boolean | null | undefined
  onNewTrayNumberChange?: ((number: string) => void) | null | undefined
  onNewTraySizeChange?: ((size: string) => void) | null | undefined
  
  // Move instrument dialog
  showMoveInstrumentDialog?: boolean | null | undefined
  instrumentToMove?: { instrument: { id: string; name: string }; items: LeadQuoteItem[] } | null | undefined
  targetTrayId?: string | null | undefined
  movingInstrument?: boolean | null | undefined
  onCancelMoveInstrument?: (() => void) | null | undefined
  onMoveInstrumentConfirm?: (() => void) | null | undefined
  onTargetTrayChange?: ((trayId: string) => void) | null | undefined
  
  // Send trays confirmation dialog
  showSendConfirmation?: boolean | null | undefined
  onConfirmSendTrays?: (() => Promise<void>) | null | undefined
  onCancelSendTrays?: (() => void) | null | undefined
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * ReceptieView
 * 
 * STRUCTURE:
 * - Extinde VanzariView (are TOATĂ funcționalitatea din VanzariView)
 * - Adaugă 3 dialoguri specifice pentru Recepție:
 *   1. CreateTrayDialog - crearea unei tăvițe noi
 *   2. MoveInstrumentDialog - mutarea instrumentelor între tăvițe
 *   3. SendConfirmationDialog - confirmarea trimiterii tăvițelor
 * 
 * FLOW:
 * ReceptieView = VanzariView + Dialoguri Recepție
 */
export function ReceptieView(props: ReceptieViewProps) {
  const quotes = Array.isArray(props.quotes) ? props.quotes : []
  const instrumentsGrouped = props.instrumentsGrouped || []
  
  // Verifică dacă există instrumente de distribuit (în tăvița unassigned)
  const hasInstrumentsToDistribute = instrumentsGrouped.length > 0

  return (
    <>
      {/* Overlay FORȚAT pentru Distribuție - BLOCHEAZĂ accesul până la repartizare */}
      {hasInstrumentsToDistribute && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop - NU se poate închide prin click */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          
          {/* Modal Content */}
          <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <Package className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Distribuie Instrumentele Mai Întâi</h2>
                  <p className="text-amber-100 text-sm">Trebuie să repartizezi instrumentele în tăvițe cu număr înainte de a continua</p>
                </div>
              </div>
            </div>
            
            {/* Body */}
            <div className="p-6 max-h-[50vh] overflow-y-auto">
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  ⚠️ Există <strong>{instrumentsGrouped.length} instrument{instrumentsGrouped.length !== 1 ? 'e' : ''}</strong> care trebuie distribuit{instrumentsGrouped.length !== 1 ? 'e' : ''} în tăvițe cu număr.
                </p>
              </div>
              
              <div className="space-y-3">
                {instrumentsGrouped.map((group) => (
                  <div 
                    key={group.instrument.id}
                    className="group flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-orange-300 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 transition-all duration-200"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                        <span className="text-lg font-bold text-white">{group.items.length}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{group.instrument.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            {group.items.filter(i => i.item_type === 'service').length} servicii
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            {group.items.filter(i => i.item_type === null).length} fără serviciu
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {props.onMoveInstrument && (
                      <Button
                        onClick={() => props.onMoveInstrument?.(group)}
                        className="bg-orange-600 hover:bg-orange-700 text-white gap-2 shadow-lg"
                      >
                        <Move className="h-4 w-4" />
                        Distribuie
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Footer */}
            <div className="border-t px-6 py-4 bg-slate-50 dark:bg-slate-800/50">
              <p className="text-sm text-muted-foreground text-center">
                Distribuie toate instrumentele pentru a putea accesa fișa de serviciu
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Core - VanzariView cu tot ce are */}
      <VanzariView {...props} />

      {/* Dialog - Creare tăviță nouă */}
      {props.showCreateTrayDialog && (
        <CreateTrayDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) props.onCancelCreateTray?.()
          }}
          newTrayNumber={props.newTrayNumber || ''}
          newTraySize={props.newTraySize || 'm'}
          creatingTray={props.creatingTray ?? false}
          onNumberChange={props.onNewTrayNumberChange || (() => {})}
          onSizeChange={props.onNewTraySizeChange || (() => {})}
          onCreate={() => {
            props.onCreateTray?.(props.newTrayNumber || '', props.newTraySize || 'm')
          }}
          onCancel={() => props.onCancelCreateTray?.()}
        />
      )}

      {/* Dialog - Mutare instrument între tăvițe */}
      {props.showMoveInstrumentDialog && props.instrumentToMove && (
        <MoveInstrumentDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) props.onCancelMoveInstrument?.()
          }}
          instrumentToMove={props.instrumentToMove}
          quotes={quotes}
          selectedQuoteId={props.selectedQuoteId}
          targetTrayId={props.targetTrayId || ''}
          newTrayNumber={props.newTrayNumber || ''}
          newTraySize={props.newTraySize || 'm'}
          movingInstrument={props.movingInstrument ?? false}
          onTargetTrayChange={props.onTargetTrayChange || (() => {})}
          onNewTrayNumberChange={props.onNewTrayNumberChange || (() => {})}
          onNewTraySizeChange={props.onNewTraySizeChange || (() => {})}
          onMove={() => props.onMoveInstrumentConfirm?.()}
          onCancel={() => props.onCancelMoveInstrument?.()}
        />
      )}

      {/* Dialog - Confirmare trimitere tăvițe */}
      {props.showSendConfirmation && (
        <SendConfirmationDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) props.onCancelSendTrays?.()
          }}
          traysCount={quotes.filter(q => q.number && q.number.trim() !== '').length}
          sending={props.sendingTrays ?? false}
          onConfirm={async () => {
            await props.onConfirmSendTrays?.()
          }}
          onCancel={() => props.onCancelSendTrays?.()}
        />
      )}
    </>
  )
}
