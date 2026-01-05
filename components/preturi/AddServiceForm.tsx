'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Wrench, Plus, X as XIcon } from 'lucide-react'
import type { Service } from '@/lib/supabase/serviceOperations'

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
  // Pentru selecție brand (Vânzări)
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
  // Callbacks pentru brand selection (opționale)
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
  onBrandToggle,
  onSerialNumberChange,
}: AddServiceFormProps) {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg border border-blue-200 dark:border-blue-800 mx-1 sm:mx-2 p-2 sm:p-3">
      <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Wrench className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-100">Adaugă Serviciu</span>
        </div>
        <div className="flex items-center gap-2">
          {(svc.id || serviceSearchQuery) && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => {
                onServiceSearchChange('')
                onServiceSelect('', '')
              }}
              className="h-7"
              title="Anulează selecția"
            >
              <XIcon className="h-3 w-3 mr-1" /> Anulează
            </Button>
          )}
          <Button size="sm" onClick={onAddService} disabled={!svc.id} className="h-7">
            <Plus className="h-3 w-3 mr-1" /> Adaugă
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3">
        {/* Serviciu cu search - 6 cols */}
        <div className="relative col-span-1 sm:col-span-6">
          <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Serviciu</Label>
          <div className="relative">
            <Input
              className="h-7 sm:h-8 text-xs sm:text-sm pr-8"
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
              {/* Header cu numărul de servicii disponibile */}
              {!serviceSearchQuery && (
                <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-b sticky top-0">
                  {availableServices.length} servicii disponibile pentru acest instrument
                </div>
              )}
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
              {serviceSearchQuery && availableServices.filter(s => s.name.toLowerCase().includes(serviceSearchQuery.toLowerCase())).length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">Nu s-au găsit servicii</div>
              )}
              {!serviceSearchQuery && availableServices.length > 20 && (
                <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-t">
                  Tastează pentru a căuta în toate cele {availableServices.length} servicii...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cantitate - 2 cols */}
        <div className="col-span-1 sm:col-span-2">
          <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Cant.</Label>
          <Input
            className="h-7 sm:h-8 text-xs sm:text-sm text-center"
            inputMode="numeric"
            value={svc.qty}
            onChange={e => onQtyChange(e.target.value)}
            placeholder="1"
          />
        </div>

        {/* Serial Number / Brand Selection - 3 cols */}
        <div className="col-span-1 sm:col-span-3">
          {isVanzariPipeline && instrumentForm?.brandSerialGroups ? (
            <>
              <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Brand-uri</Label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto border rounded-md p-2 bg-background">
                {instrumentForm.brandSerialGroups
                  .filter(group => group.brand && group.brand.trim())
                  .map((group, gIdx) => {
                    const brandName = group.brand.trim()
                    const isSelected = (svc.selectedBrands || []).includes(brandName)
                    return (
                      <div key={gIdx} className="flex items-center gap-2">
                        <Checkbox
                          id={`brand-${gIdx}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            if (onBrandToggle) {
                              onBrandToggle(brandName, !!checked)
                            }
                          }}
                        />
                        <Label 
                          htmlFor={`brand-${gIdx}`} 
                          className="text-xs cursor-pointer flex-1"
                        >
                          {brandName}
                        </Label>
                      </div>
                    )
                  })}
                {instrumentForm.brandSerialGroups.filter(group => group.brand && group.brand.trim()).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    Nu există brand-uri disponibile
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Serial Nr.</Label>
              <select
                className="w-full h-7 sm:h-8 text-xs sm:text-sm border rounded-md px-2 bg-background"
                value={svc.serialNumberId || ''}
                onChange={e => {
                  if (onSerialNumberChange) {
                    onSerialNumberChange(e.target.value)
                  }
                }}
              >
                <option value="">-- Fără atribuire --</option>
                {/* Afișează toate serial numbers din brand_groups */}
                {instrumentForm?.brandSerialGroups?.flatMap((group, gIdx) => 
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
            </>
          )}
        </div>

        {/* Disc - 1 col - ascuns pentru tehnicieni în pipeline departament */}
        {canEditUrgentAndSubscription && (
          <div className="col-span-1">
            <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Disc%</Label>
            <Input
              className="h-7 sm:h-8 text-xs sm:text-sm text-center"
              inputMode="decimal"
              value={svc.discount}
              onChange={e => onDiscountChange(e.target.value)}
              placeholder="0"
            />
          </div>
        )}
      </div>
    </div>
  )
}

