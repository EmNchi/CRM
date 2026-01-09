'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Sparkles, Plus, X as XIcon, Search, Percent, Undo2 } from 'lucide-react'
import type { Service } from '@/lib/supabase/serviceOperations'
import { cn } from '@/lib/utils'

interface AddServiceFormProps {
  svc: {
    id: string
    qty: string
    discount: string
    instrumentId: string
    selectedBrands?: string[]
    serialNumberId?: string
  }
  serviceSearchQuery: string
  serviceSearchFocused: boolean
  currentInstrumentId: string | null
  availableServices: Service[]
  instrumentForm?: {
    brandSerialGroups?: Array<{ brand: string; serialNumbers: Array<{ serial: string; garantie: boolean }> | string[] }>
  }
  isVanzariPipeline?: boolean
  canEditUrgentAndSubscription?: boolean
  onServiceSearchChange: (query: string) => void
  onServiceSearchFocus: () => void
  onServiceSearchBlur: () => void
  onServiceSelect: (serviceId: string, serviceName: string) => void
  onServiceDoubleClick: (serviceId: string, serviceName: string) => void
  onQtyChange: (qty: string) => void
  onDiscountChange: (discount: string) => void
  onAddService: () => void
  onClearForm?: () => void
  onBrandToggle?: (brandName: string, checked: boolean) => void
  onSerialNumberChange?: (serialNumberId: string) => void
}

export function AddServiceForm({
  svc,
  serviceSearchQuery,
  serviceSearchFocused,
  currentInstrumentId,
  availableServices,
  instrumentForm,
  isVanzariPipeline = false,
  canEditUrgentAndSubscription = true,
  onServiceSearchChange,
  onServiceSearchFocus,
  onServiceSearchBlur,
  onServiceSelect,
  onServiceDoubleClick,
  onQtyChange,
  onDiscountChange,
  onAddService,
  onClearForm,
  onBrandToggle,
  onSerialNumberChange,
}: AddServiceFormProps) {
  return (
    <div className="mx-2 sm:mx-4">
      <div className="rounded-xl border-2 border-blue-200/80 dark:border-blue-700/50 bg-gradient-to-br from-blue-50 via-indigo-50/50 to-violet-50/30 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-violet-950/20 shadow-sm">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-blue-100/80 to-indigo-100/60 dark:from-blue-900/40 dark:to-indigo-900/30 border-b border-blue-200/60 dark:border-blue-700/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-sm">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                Adaugă Serviciu
              </h3>
              <p className="text-[11px] text-blue-700/80 dark:text-blue-300/70">
                Caută și adaugă servicii pentru instrument
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {svc.id && onClearForm && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={onClearForm}
                className="h-9 px-3 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-950/50"
              >
                <Undo2 className="h-4 w-4 mr-1.5" />
                Anulează
              </Button>
            )}
            <Button 
              size="sm" 
              onClick={onAddService} 
              disabled={!svc.id}
              className="h-9 px-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-sm"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Adaugă
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="grid grid-cols-12 gap-3">
            {/* Serviciu cu search */}
            <div className="relative col-span-12 sm:col-span-6 z-20">
              <Label className="text-[10px] font-bold text-blue-800/90 dark:text-blue-200 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Search className="h-3 w-3" /> Serviciu
              </Label>
              <div className="relative">
                <Input
                  className={cn(
                    "h-10 text-sm pr-8 border-2 transition-all",
                    currentInstrumentId 
                      ? "border-blue-200/80 dark:border-blue-700/50 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20" 
                      : "border-slate-200 bg-slate-50 cursor-not-allowed"
                  )}
                  placeholder={currentInstrumentId ? "Caută serviciu sau click pentru lista completă..." : "Selectează mai întâi un instrument"}
                  value={serviceSearchQuery}
                  onChange={e => onServiceSearchChange(e.target.value)}
                  onFocus={onServiceSearchFocus}
                  onBlur={onServiceSearchBlur}
                  disabled={!currentInstrumentId}
                />
                {serviceSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      onServiceSearchChange('')
                      onServiceSelect('', '')
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {/* Dropdown */}
              {(serviceSearchFocused || serviceSearchQuery) && currentInstrumentId && (
                <div className="absolute left-0 right-0 z-[100] mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border-2 border-blue-200/80 dark:border-blue-700/50 rounded-lg shadow-xl">
                  {!serviceSearchQuery && (
                    <div className="px-3 py-2 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30 border-b sticky top-0">
                      {availableServices.length} servicii disponibile
                    </div>
                  )}
                  {availableServices
                    .filter(s => !serviceSearchQuery || s.name.toLowerCase().includes(serviceSearchQuery.toLowerCase()))
                    .slice(0, serviceSearchQuery ? 10 : 20)
                    .map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onServiceSelect(s.id, s.name)}
                        onDoubleClick={() => onServiceDoubleClick(s.id, s.name)}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-950/30 flex justify-between items-center gap-3 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors"
                      >
                        <span className="font-medium min-w-0 flex-1 truncate">{s.name}</span>
                        <span className="text-blue-600 dark:text-blue-400 font-semibold flex-shrink-0">{s.price.toFixed(2)} RON</span>
                      </button>
                    ))}
                  {serviceSearchQuery && availableServices.filter(s => s.name.toLowerCase().includes(serviceSearchQuery.toLowerCase())).length === 0 && (
                    <div className="px-3 py-4 text-sm text-center text-muted-foreground">Nu s-au găsit servicii</div>
                  )}
                </div>
              )}
            </div>

            {/* Cantitate */}
            <div className="col-span-4 sm:col-span-2">
              <Label className="text-[10px] font-bold text-blue-800/90 dark:text-blue-200 uppercase tracking-wider mb-1.5 block">
                Cant.
              </Label>
              <Input
                className="h-10 text-sm text-center border-2 border-blue-200/80 dark:border-blue-700/50 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                inputMode="numeric"
                value={svc.qty}
                onChange={e => onQtyChange(e.target.value)}
                placeholder="1"
              />
            </div>

            {/* Serial Numbers cu Brand - Checkbox-uri multiple */}
            <div className="col-span-8 sm:col-span-3">
              <Label className="text-[10px] font-bold text-blue-800/90 dark:text-blue-200 uppercase tracking-wider mb-1.5 block">
                Serial / Brand
              </Label>
              <div className="max-h-28 overflow-y-auto border-2 border-blue-200/80 dark:border-blue-700/50 rounded-lg p-2 bg-white dark:bg-slate-900 space-y-1">
                {(Array.isArray(instrumentForm?.brandSerialGroups) ? instrumentForm.brandSerialGroups : []).flatMap((group, gIdx) => {
                  if (!group) return []
                  const brandName = group?.brand?.trim() || ''
                  const serialNumbers = Array.isArray(group?.serialNumbers) ? group.serialNumbers : []
                  
                  return serialNumbers.map((sn, snIdx) => {
                    const serial = typeof sn === 'string' ? sn : (sn && typeof sn === 'object' ? sn?.serial || '' : '')
                    const serialDisplay = serial && serial.trim() ? serial.trim() : `Serial ${snIdx + 1}`
                    const displayText = brandName ? `${brandName} — ${serialDisplay}` : serialDisplay
                    const valueKey = `${brandName}::${serial || `empty-${gIdx}-${snIdx}`}`
                    const selectedSerials = Array.isArray(svc?.selectedBrands) ? svc.selectedBrands : []
                    const isSelected = selectedSerials.includes(valueKey)
                    
                    return (
                      <label 
                        key={`${gIdx}-${snIdx}`} 
                        className="flex items-center gap-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded px-1 py-0.5 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            onBrandToggle?.(valueKey, !!checked)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                        />
                        <span className="text-xs font-medium truncate">{displayText}</span>
                      </label>
                    )
                  })
                })}
                {(Array.isArray(instrumentForm?.brandSerialGroups) ? instrumentForm.brandSerialGroups : []).length === 0 && (
                  <p className="text-[10px] text-muted-foreground text-center py-2">Nu există serial numbers</p>
                )}
              </div>
            </div>

            {/* Discount */}
            {canEditUrgentAndSubscription && (
              <div className="col-span-4 sm:col-span-1">
                <Label className="text-[10px] font-bold text-blue-800/90 dark:text-blue-200 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Percent className="h-3 w-3" /> Disc
                </Label>
                <Input
                  className="h-10 text-sm text-center border-2 border-blue-200/80 dark:border-blue-700/50 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                  inputMode="decimal"
                  value={svc.discount}
                  onChange={e => onDiscountChange(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
