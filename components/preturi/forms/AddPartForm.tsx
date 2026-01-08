'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Package, Plus, X as XIcon, Search } from 'lucide-react'
import type { Part } from '@/lib/supabase/partOperations'
import type { LeadQuoteItem } from '@/lib/types/preturi'
import { cn } from '@/lib/utils'

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
    <div className="mx-2 sm:mx-4">
      <div className="rounded-xl border-2 border-amber-200/80 dark:border-amber-700/50 bg-gradient-to-br from-amber-50 via-orange-50/50 to-rose-50/30 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-rose-950/20 shadow-sm">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-amber-100/80 to-orange-100/60 dark:from-amber-900/40 dark:to-orange-900/30 border-b border-amber-200/60 dark:border-amber-700/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
              <Package className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-amber-900 dark:text-amber-100">
                Adaugă Piesă
              </h3>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-300/70">
                Caută și adaugă piese pentru reparații
              </p>
            </div>
          </div>
          <Button 
            type="submit"
            size="sm" 
            onClick={onAddPart} 
            disabled={!part.id}
            className="h-9 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Adaugă
          </Button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="grid grid-cols-12 gap-3">
            {/* Piesă cu search */}
            <div className="relative col-span-12 sm:col-span-6 z-20">
              <Label className="text-[10px] font-bold text-amber-800/90 dark:text-amber-200 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Search className="h-3 w-3" /> Piesă
              </Label>
              <div className="relative">
                <Input
                  className={cn(
                    "h-10 text-sm pr-8 border-2 transition-all",
                    "border-amber-200/80 dark:border-amber-700/50 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  )}
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
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {/* Dropdown */}
              {(partSearchFocused || partSearchQuery) && (
                <div className="absolute left-0 right-0 z-[100] mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border-2 border-amber-200/80 dark:border-amber-700/50 rounded-lg shadow-xl">
                  {!partSearchQuery && (
                    <div className="px-3 py-2 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30 border-b sticky top-0">
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
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-amber-50 dark:hover:bg-amber-950/30 flex justify-between items-center border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors"
                        title="Click pentru selectare, Double-click pentru adăugare rapidă"
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">{p.price.toFixed(2)} RON</span>
                      </button>
                    ))}
                  {partSearchQuery && parts.filter(p => p.name.toLowerCase().includes(partSearchQuery.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-500">Nu s-au găsit piese</div>
                  )}
                  {!partSearchQuery && parts.length > 20 && (
                    <div className="px-3 py-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/30 border-t">
                      Tastează pentru a căuta în toate cele {parts.length} piese...
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Serial Number */}
            <div className="col-span-12 sm:col-span-4">
              <Label className="text-[10px] font-bold text-amber-800/90 dark:text-amber-200 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                Serial / Brand
                {hasMultipleInstruments && <span className="text-red-500">*</span>}
              </Label>
              <select
                className="w-full h-10 text-sm border-2 border-amber-200/80 dark:border-amber-700/50 rounded-lg px-3 bg-white dark:bg-slate-900 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                value={part.serialNumberId}
                onChange={e => onSerialNumberChange(e.target.value)}
                required={hasMultipleInstruments}
              >
                <option value="">-- Selectează serial --</option>
                {(Array.isArray(instrumentForm?.brandSerialGroups) ? instrumentForm.brandSerialGroups : []).flatMap((group, gIdx) => {
                  if (!group) return []
                  const serialNumbers = Array.isArray(group?.serialNumbers) ? group.serialNumbers : []
                  return serialNumbers
                    .map(sn => {
                      const serial = typeof sn === 'string' ? sn : sn?.serial || ''
                      return serial.trim()
                    })
                    .filter(sn => sn)
                    .map((sn, snIdx) => (
                      <option key={`${gIdx}-${snIdx}`} value={`${group?.brand || ''}::${sn}`}>
                        {group?.brand ? `${group.brand} — ${sn}` : sn}
                      </option>
                    ))
                })}
              </select>
            </div>

            {/* Cant */}
            <div className="col-span-12 sm:col-span-2">
              <Label className="text-[10px] font-bold text-amber-800/90 dark:text-amber-200 uppercase tracking-wider mb-1.5">
                Cant.
              </Label>
              <Input
                className="h-10 text-sm text-center border-2 border-amber-200/80 dark:border-amber-700/50 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                inputMode="numeric"
                value={part.qty}
                onChange={e => onQtyChange(e.target.value)}
                placeholder="1"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



