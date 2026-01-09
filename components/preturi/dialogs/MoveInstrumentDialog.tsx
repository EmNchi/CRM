'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowRight, Move, Plus, Package } from 'lucide-react'
import type { LeadQuote } from '@/lib/types/preturi'

interface MoveInstrumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instrumentToMove: { instrument: { id: string; name: string }; items: any[] } | null
  quotes: LeadQuote[]
  selectedQuoteId: string | null
  targetTrayId: string
  newTrayNumber: string
  newTraySize: string
  movingInstrument: boolean
  onTargetTrayChange: (value: string) => void
  onNewTrayNumberChange: (value: string) => void
  onNewTraySizeChange: (value: string) => void
  onMove: () => void
  onCancel: () => void
}

export function MoveInstrumentDialog({
  open,
  onOpenChange,
  instrumentToMove,
  quotes,
  selectedQuoteId,
  targetTrayId,
  newTrayNumber,
  newTraySize,
  movingInstrument,
  onTargetTrayChange,
  onNewTrayNumberChange,
  onNewTraySizeChange,
  onMove,
  onCancel,
}: MoveInstrumentDialogProps) {
  const availableTrays = (quotes || []).filter(q => {
    // Exclude tăvița curentă (selectedQuoteId) și tăvițele undefined (fără număr)
    return q.id !== selectedQuoteId && q.number && q.number.trim() !== ''
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-0 shadow-2xl">
        {/* Header cu gradient */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Move className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Mută Instrument în Tăviță</h2>
              <p className="text-indigo-100 text-sm">
                {instrumentToMove?.instrument.name}
                <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-xs">
                  {instrumentToMove?.items.length || 0} items
                </span>
              </p>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Info despre instrument */}
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-500 flex items-center justify-center shadow">
                <span className="text-white font-bold">{instrumentToMove?.items.length || 0}</span>
              </div>
              <div>
                <p className="font-medium text-indigo-900 dark:text-indigo-100">{instrumentToMove?.instrument.name}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    {instrumentToMove?.items.filter(i => i.item_type === 'service').length || 0} servicii
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {instrumentToMove?.items.filter(i => i.item_type === null).length || 0} fără serviciu
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Selectează tăviță */}
          <div className="space-y-2">
            <Label htmlFor="target-tray" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Selectează tăvița țintă
            </Label>
            <Select value={targetTrayId} onValueChange={onTargetTrayChange} disabled={movingInstrument}>
              <SelectTrigger 
                id="target-tray" 
                className="h-12 text-lg border-2 focus:border-indigo-500 focus:ring-indigo-500/20"
              >
                <SelectValue placeholder="Alege unde să muți..." />
              </SelectTrigger>
              <SelectContent>
                {availableTrays.map((q) => (
                  <SelectItem key={q.id} value={q.id} className="py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 flex items-center justify-center font-bold">
                        {q.number}
                      </span>
                      <div>
                        <span className="font-medium">Tăviță {q.number}</span>
                        <span className="ml-2 text-xs text-muted-foreground">({q.size?.toUpperCase() || 'M'})</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="new" className="py-3">
                  <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                    <span className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                      <Plus className="h-4 w-4" />
                    </span>
                    <span className="font-medium">Creează tăviță nouă</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Formularul pentru tăviță nouă */}
          {targetTrayId === 'new' && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-4 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
                <Package className="h-4 w-4" />
                Detalii tăviță nouă
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-tray-number" className="text-xs text-emerald-700 dark:text-emerald-400">
                    Număr
                  </Label>
                  <Input
                    id="new-tray-number"
                    placeholder="1, 2, A..."
                    value={newTrayNumber}
                    onChange={(e) => onNewTrayNumberChange(e.target.value)}
                    disabled={movingInstrument}
                    className="h-10 font-semibold border-2 border-emerald-200 focus:border-emerald-500"
                    autoFocus
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="new-tray-size" className="text-xs text-emerald-700 dark:text-emerald-400">
                    Mărime
                  </Label>
                  <Select value={newTraySize} onValueChange={onNewTraySizeChange} disabled={movingInstrument}>
                    <SelectTrigger id="new-tray-size" className="h-10 border-2 border-emerald-200 focus:border-emerald-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="s">S - Mică</SelectItem>
                      <SelectItem value="m">M - Medie</SelectItem>
                      <SelectItem value="l">L - Mare</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50 dark:bg-slate-800/50 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={movingInstrument}
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400"
          >
            Anulează
          </Button>
          <Button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onMove()
            }}
            disabled={movingInstrument || (!targetTrayId || (targetTrayId === 'new' && !newTrayNumber.trim()))}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 px-6 shadow-lg"
          >
            {movingInstrument ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Se mută...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4" />
                Mută Instrumentul
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
