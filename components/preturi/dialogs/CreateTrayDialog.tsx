'use client'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface CreateTrayDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  newTrayNumber: string
  newTraySize: string
  creatingTray: boolean
  onNumberChange: (value: string) => void
  onSizeChange: (value: string) => void
  onCreate: () => void
  onCancel: () => void
}

export function CreateTrayDialog({
  open,
  onOpenChange,
  newTrayNumber,
  newTraySize,
  creatingTray,
  onNumberChange,
  onSizeChange,
  onCreate,
  onCancel,
}: CreateTrayDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Creează Tăviță Nouă</DialogTitle>
          <DialogDescription>
            Adaugă o nouă tăviță pentru acest lead.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="tray-number">Număr tăviță</Label>
            <Input
              id="tray-number"
              placeholder="ex: 1, 2, A, B..."
              value={newTrayNumber}
              onChange={(e) => onNumberChange(e.target.value)}
              disabled={creatingTray}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tray-size">Mărime</Label>
            <Select value={newTraySize} onValueChange={onSizeChange} disabled={creatingTray}>
              <SelectTrigger id="tray-size">
                <SelectValue placeholder="Selectează mărimea" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="s">S</SelectItem>
                <SelectItem value="m">M</SelectItem>
                <SelectItem value="l">L</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={creatingTray}
          >
            Anulează
          </Button>
          <Button
            onClick={onCreate}
            disabled={creatingTray || !newTrayNumber.trim()}
          >
            {creatingTray ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Se creează...
              </>
            ) : (
              'Creează'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}



