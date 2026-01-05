'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Wrench, Plus, X as XIcon } from 'lucide-react'
import type { Service } from '@/lib/supabase/serviceOperations'

interface AddServiceFormProps {
  svc: {
    id: string
    qty: string
    discount: string
    instrumentId: string
  }
  serviceSearchQuery: string
  serviceSearchFocused: boolean
  currentInstrumentId: string | null
  availableServices: Service[]
  onServiceSearchChange: (query: string) => void
  onServiceSearchFocus: () => void
  onServiceSearchBlur: () => void
  onServiceSelect: (serviceId: string, serviceName: string) => void
  onServiceDoubleClick: (serviceId: string, serviceName: string) => void
  onQtyChange: (qty: string) => void
  onDiscountChange: (discount: string) => void
  onAddService: () => void
}

export function AddServiceForm({
  svc,
  serviceSearchQuery,
  serviceSearchFocused,
  currentInstrumentId,
  availableServices,
  onServiceSearchChange,
  onServiceSearchFocus,
  onServiceSearchBlur,
  onServiceSelect,
  onServiceDoubleClick,
  onQtyChange,
  onDiscountChange,
  onAddService,
}: AddServiceFormProps) {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg border border-blue-200 dark:border-blue-800 mx-4 p-3">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Adaugă Serviciu</span>
        </div>
        <Button size="sm" onClick={onAddService} disabled={!svc.id} className="h-7">
          <Plus className="h-3 w-3 mr-1" /> Adaugă
        </Button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="relative col-span-1 sm:col-span-6">
          <Label className="text-xs text-muted-foreground mb-1 block">Serviciu</Label>
          <div className="relative">
            <Input
              className="h-8 text-sm pr-8"
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
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </div>
          {(serviceSearchFocused || serviceSearchQuery) && currentInstrumentId && (
            <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-background border rounded-md shadow-lg">
              {availableServices
                .filter(s => !serviceSearchQuery || s.name.toLowerCase().includes(serviceSearchQuery.toLowerCase()))
                .slice(0, serviceSearchQuery ? 10 : 20)
                .map(s => {
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onServiceSelect(s.id, s.name)}
                      onDoubleClick={() => onServiceDoubleClick(s.id, s.name)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center"
                      title="Click pentru selectare, Double-click pentru adăugare rapidă"
                    >
                      <span>{s.name}</span>
                      <span className="text-muted-foreground">{s.price.toFixed(2)} RON</span>
                    </button>
                  )
                })}
            </div>
          )}
        </div>
        
        <div className="col-span-1 sm:col-span-2">
          <Label className="text-xs text-muted-foreground mb-1 block">Cant.</Label>
          <Input
            className="h-8 text-sm text-center"
            inputMode="numeric"
            value={svc.qty}
            onChange={e => onQtyChange(e.target.value)}
            placeholder="1"
          />
        </div>
        
        <div className="col-span-1">
          <Label className="text-xs text-muted-foreground mb-1 block">Disc%</Label>
          <Input
            className="h-8 text-sm text-center"
            inputMode="decimal"
            value={svc.discount}
            onChange={e => onDiscountChange(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>
    </div>
  )
}

