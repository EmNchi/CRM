'use client'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowRight } from 'lucide-react'
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Mută Instrument</DialogTitle>
          <DialogDescription>
            Selectează tăvița în care vrei să muți instrumentul "{instrumentToMove?.instrument.name}" și serviciile lui.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="target-tray">Tăviță țintă</Label>
            <Select value={targetTrayId} onValueChange={onTargetTrayChange} disabled={movingInstrument}>
              <SelectTrigger id="target-tray">
                <SelectValue placeholder="Selectează o tăviță" />
              </SelectTrigger>
              <SelectContent>
                {quotes
                  .filter(q => q.id !== selectedQuoteId && (q.number || q.number !== ''))
                  .map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      Tăviță {q.number || 'N/A'} ({q.size || 'N/A'})
                    </SelectItem>
                  ))}
                <SelectItem value="new">Creează tăviță nouă</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {targetTrayId === 'new' && (
            <div className="grid gap-2">
              <Label htmlFor="new-tray-number">Număr tăviță</Label>
              <Input
                id="new-tray-number"
                placeholder="ex: 1, 2, A, B..."
                value={newTrayNumber}
                onChange={(e) => onNewTrayNumberChange(e.target.value)}
                disabled={movingInstrument}
              />
              <Label htmlFor="new-tray-size">Mărime</Label>
              <Select value={newTraySize} onValueChange={onNewTraySizeChange} disabled={movingInstrument}>
                <SelectTrigger id="new-tray-size">
                  <SelectValue placeholder="Selectează mărimea" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="s">S</SelectItem>
                  <SelectItem value="m">M</SelectItem>
                  <SelectItem value="l">L</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={movingInstrument}
          >
            Anulează
          </Button>
          <Button
            onClick={onMove}
            disabled={movingInstrument || (!targetTrayId || (targetTrayId === 'new' && !newTrayNumber.trim()))}
          >
            {movingInstrument ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Se mută...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                Mută
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

