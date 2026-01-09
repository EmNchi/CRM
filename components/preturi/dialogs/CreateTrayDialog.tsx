'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, Package } from 'lucide-react'

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
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 shadow-2xl">
        {/* Header cu gradient */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Creează Tăviță Nouă</h2>
              <p className="text-emerald-100 text-sm">Adaugă o tăviță pentru acest client</p>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Număr tăviță */}
          <div className="space-y-2">
            <Label htmlFor="tray-number" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Număr tăviță
            </Label>
            <Input
              id="tray-number"
              placeholder="ex: 1, 2, A, B..."
              value={newTrayNumber}
              onChange={(e) => onNumberChange(e.target.value)}
              disabled={creatingTray}
              className="h-12 text-lg font-semibold border-2 focus:border-emerald-500 focus:ring-emerald-500/20"
              autoFocus
            />
          </div>
          
          {/* Mărime tăviță */}
          <div className="space-y-2">
            <Label htmlFor="tray-size" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Mărime
            </Label>
            <Select value={newTraySize} onValueChange={onSizeChange} disabled={creatingTray}>
              <SelectTrigger 
                id="tray-size" 
                className="h-12 text-lg border-2 focus:border-emerald-500 focus:ring-emerald-500/20"
              >
                <SelectValue placeholder="Selectează mărimea" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="s" className="py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">S</span>
                    <span>Small - pentru puține instrumente</span>
                  </div>
                </SelectItem>
                <SelectItem value="m" className="py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">M</span>
                    <span>Medium - dimensiune standard</span>
                  </div>
                </SelectItem>
                <SelectItem value="l" className="py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">L</span>
                    <span>Large - pentru multe instrumente</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50 dark:bg-slate-800/50 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={creatingTray}
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400"
          >
            Anulează
          </Button>
          <Button
            onClick={onCreate}
            disabled={creatingTray || !newTrayNumber.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-6 shadow-lg"
          >
            {creatingTray ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Se creează...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Creează Tăvița
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
