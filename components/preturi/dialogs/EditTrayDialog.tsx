'use client'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface EditTrayDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingTrayNumber: string
  editingTraySize: string
  updatingTray: boolean
  onNumberChange: (value: string) => void
  onSizeChange: (value: string) => void
  onUpdate: () => void
  onCancel: () => void
}

export function EditTrayDialog({
  open,
  onOpenChange,
  editingTrayNumber,
  editingTraySize,
  updatingTray,
  onNumberChange,
  onSizeChange,
  onUpdate,
  onCancel,
}: EditTrayDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editează Tăviță</DialogTitle>
          <DialogDescription>
            Modifică detaliile tăviței.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-tray-number">Număr tăviță</Label>
            <Input
              id="edit-tray-number"
              placeholder="ex: 1, 2, A, B..."
              value={editingTrayNumber}
              onChange={(e) => onNumberChange(e.target.value)}
              disabled={updatingTray}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-tray-size">Mărime</Label>
            <Select value={editingTraySize} onValueChange={onSizeChange} disabled={updatingTray}>
              <SelectTrigger id="edit-tray-size">
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
            disabled={updatingTray}
          >
            Anulează
          </Button>
          <Button
            onClick={onUpdate}
            disabled={updatingTray || !editingTrayNumber.trim()}
          >
            {updatingTray ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Se actualizează...
              </>
            ) : (
              'Salvează'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}



