'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Package, Plus, X as XIcon } from 'lucide-react'
import type { Part } from '@/lib/supabase/partOperations'
import type { LeadQuoteItem } from '@/lib/types/preturi'

interface AddPartFormProps {
  part: {
    id: string
    qty: string
    serialNumberId: string
  }
  partSearchQuery: string
  partSearchFocused: boolean
  parts: Part[]
  items: LeadQuoteItem[]
  instrumentForm: {
    brandSerialGroups: Array<{ brand: string; serialNumbers: Array<{ serial: string; garantie: boolean }> }>
  }
  canAddParts: boolean
  onPartSearchChange: (query: string) => void
  onPartSearchFocus: () => void
  onPartSearchBlur: () => void
  onPartSelect: (partId: string, partName: string) => void
  onPartDoubleClick: (partId: string, partName: string) => void
  onQtyChange: (qty: string) => void
  onSerialNumberChange: (serialNumberId: string) => void
  onAddPart: () => void
}

export function AddPartForm({
  part,
  partSearchQuery,
  partSearchFocused,
  parts,
  items,
  instrumentForm,
  canAddParts,
  onPartSearchChange,
  onPartSearchFocus,
  onPartSearchBlur,
  onPartSelect,
  onPartDoubleClick,
  onQtyChange,
  onSerialNumberChange,
  onAddPart,
}: AddPartFormProps) {
  if (!canAddParts) {
    return null
  }

  // Verifică dacă există mai multe instrumente unice
  const uniqueInstruments = new Set<string>()
  items.forEach(item => {
    if (item.item_type === null && item.instrument_id) {
      uniqueInstruments.add(item.instrument_id)
    } else if (item.item_type === 'service' && item.instrument_id) {
      uniqueInstruments.add(item.instrument_id)
    } else if (item.item_type === 'part' && item.instrument_id) {
      uniqueInstruments.add(item.instrument_id)
    }
  })
  const hasMultipleInstruments = uniqueInstruments.size > 1

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        onAddPart()
      }}
      className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-lg border border-purple-200 dark:border-purple-800 mx-1 sm:mx-2 p-2 sm:p-3"
    >
      <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
          <span className="text-xs sm:text-sm font-medium text-purple-900 dark:text-purple-100">Adaugă Piesă</span>
        </div>
        <Button size="sm" type="submit" disabled={!part.id} className="h-6 sm:h-7 text-xs sm:text-sm">
          <Plus className="h-3 w-3 mr-1" /> Adaugă
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3">
        {/* Piesă - 6 cols */}
        <div className="relative col-span-1 sm:col-span-6">
          <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Piesă</Label>
          <div className="relative">
            <Input
              className="h-7 sm:h-8 text-xs sm:text-sm pr-8"
              placeholder="Caută piesă sau click pentru lista completă..."
              value={partSearchQuery}
              onChange={e => onPartSearchChange(e.target.value)}
              onFocus={onPartSearchFocus}
              onBlur={onPartSearchBlur}
            />
            {partSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  onPartSearchChange('')
                  onPartSelect('', '')
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </div>
          {(partSearchFocused || partSearchQuery) && (
            <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-background border rounded-md shadow-lg">
              {!partSearchQuery && (
                <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-b sticky top-0">
                  {parts.length} piese disponibile
                </div>
              )}
              {parts
                .filter(p => !partSearchQuery || p.name.toLowerCase().includes(partSearchQuery.toLowerCase()))
                .slice(0, partSearchQuery ? 10 : 20)
                .map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onPartSelect(p.id, p.name)}
                    onDoubleClick={() => onPartDoubleClick(p.id, p.name)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center"
                    title="Click pentru selectare, Double-click pentru adăugare rapidă"
                  >
                    <span>{p.name}</span>
                    <span className="text-muted-foreground">{p.price.toFixed(2)} RON</span>
                  </button>
                ))}
              {partSearchQuery && parts.filter(p => p.name.toLowerCase().includes(partSearchQuery.toLowerCase())).length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">Nu s-au găsit piese</div>
              )}
              {!partSearchQuery && parts.length > 20 && (
                <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-t">
                  Tastează pentru a căuta în toate cele {parts.length} piese...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Serial Number - 4 cols */}
        <div className="col-span-1 sm:col-span-4">
          <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">
            Serial Nr. (instrument)
            {hasMultipleInstruments && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <select
            className="w-full h-7 sm:h-8 text-xs sm:text-sm border rounded-md px-2 bg-background"
            value={part.serialNumberId}
            onChange={e => onSerialNumberChange(e.target.value)}
            required={hasMultipleInstruments}
          >
            <option value="">-- Selectează serial --</option>
            {instrumentForm.brandSerialGroups.flatMap((group, gIdx) =>
              group.serialNumbers
                .map(sn => {
                  const serial = typeof sn === 'string' ? sn : sn.serial || ''
                  return serial.trim()
                })
                .filter(sn => sn)
                .map((sn, snIdx) => (
                  <option key={`${gIdx}-${snIdx}`} value={`${group.brand}::${sn}`}>
                    {group.brand ? `${group.brand} - ${sn}` : sn}
                  </option>
                ))
            )}
          </select>
        </div>

        {/* Cant - 2 cols */}
        <div className="col-span-1 sm:col-span-2">
          <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Cant.</Label>
          <Input
            className="h-7 sm:h-8 text-xs sm:text-sm text-center"
            inputMode="numeric"
            value={part.qty}
            onChange={e => onQtyChange(e.target.value)}
            placeholder="1"
          />
        </div>
      </div>
    </form>
  )
}

