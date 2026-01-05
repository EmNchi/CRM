'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Wrench, Plus, Trash2 } from 'lucide-react'
import { useMemo } from 'react'

interface AddInstrumentFormProps {
  instrumentForm: {
    instrument: string
    qty: string
    brandSerialGroups?: Array<{ brand: string; serialNumbers: Array<{ serial: string; garantie: boolean }>; qty: string }>
    garantie?: boolean
  }
  availableInstruments: Array<{ id: string; name: string; department_id?: string | null }>
  instruments?: Array<{ id: string; name: string; department_id: string | null }>
  departments?: Array<{ id: string; name: string }>
  instrumentSettings: Record<string, any>
  hasServicesOrInstrumentInSheet: boolean
  isVanzariPipeline: boolean
  isDepartmentPipeline: boolean
  isTechnician: boolean
  onInstrumentChange: (instrumentId: string) => void
  onQtyChange: (qty: string) => void
  // Callbacks pentru brandSerialGroups (opționale)
  onAddBrandSerialGroup?: () => void
  onRemoveBrandSerialGroup?: (groupIndex: number) => void
  onUpdateBrand?: (groupIndex: number, value: string) => void
  onUpdateBrandQty?: (groupIndex: number, qty: string) => void
  onUpdateSerialNumber?: (groupIndex: number, serialIndex: number, value: string) => void
  onUpdateSerialGarantie?: (groupIndex: number, serialIndex: number, garantie: boolean) => void
  setIsDirty?: (dirty: boolean) => void
}

export function AddInstrumentForm({
  instrumentForm,
  availableInstruments,
  instruments = [],
  departments = [],
  instrumentSettings,
  hasServicesOrInstrumentInSheet,
  isVanzariPipeline,
  isDepartmentPipeline,
  isTechnician,
  onInstrumentChange,
  onQtyChange,
  onAddBrandSerialGroup,
  onRemoveBrandSerialGroup,
  onUpdateBrand,
  onUpdateBrandQty,
  onUpdateSerialNumber,
  onUpdateSerialGarantie,
  setIsDirty,
}: AddInstrumentFormProps) {
  // Nu afișa formularul pentru tehnicieni în pipeline-uri departament
  if (isDepartmentPipeline && isTechnician) {
    return null
  }

  // Verifică dacă instrumentul selectat aparține departamentului "Reparații"
  const isReparatiiInstrument = useMemo(() => {
    if (!instrumentForm.instrument) return false
    const instrument = instruments.find(i => i.id === instrumentForm.instrument)
    if (!instrument || !instrument.department_id) return false
    const department = departments.find(d => d.id === instrument.department_id)
    const deptName = department?.name?.toLowerCase() || ''
    return deptName.includes('reparatii') || deptName.includes('reparații')
  }, [instrumentForm.instrument, instruments, departments])

  // Verifică dacă trebuie să afișăm brandSerialGroups
  const showBrandSerialGroups = isReparatiiInstrument && 
    instrumentForm.brandSerialGroups && 
    instrumentForm.brandSerialGroups.length > 0 &&
    onAddBrandSerialGroup &&
    onRemoveBrandSerialGroup &&
    onUpdateBrand &&
    onUpdateBrandQty &&
    onUpdateSerialNumber &&
    onUpdateSerialGarantie

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg border border-green-200 dark:border-green-800 mx-1 sm:mx-2 p-2 sm:p-3">
      <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Wrench className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
          <span className="text-xs sm:text-sm font-medium text-green-900 dark:text-green-100">Adaugă Instrument</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3">
        <div className="col-span-1 sm:col-span-8">
          <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Instrument</Label>
          <select
            className="w-full h-7 sm:h-8 text-xs sm:text-sm rounded-md border px-2 bg-white dark:bg-background disabled:opacity-50 disabled:cursor-not-allowed"
            value={instrumentForm.instrument}
            onChange={e => {
              const newInstrumentId = e.target.value
              onInstrumentChange(newInstrumentId)
            }}
            title={(isVanzariPipeline || isDepartmentPipeline) ? "Selectează instrument" : "Selectează instrument (poți avea până la 2 instrumente pe tăviță)"}
          >
            <option value="">— selectează —</option>
            {availableInstruments.map(inst => (
              <option key={inst.id} value={inst.id}>{inst.name}</option>
            ))}
          </select>
        </div>
        
        <div className="col-span-1 sm:col-span-4">
          <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Cant.</Label>
          <Input
            className="h-7 sm:h-8 text-xs sm:text-sm text-center disabled:opacity-50 disabled:cursor-not-allowed"
            inputMode="numeric"
            value={instrumentForm.qty}
            onChange={e => {
              const newQty = e.target.value
              onQtyChange(newQty)
            }}
            placeholder="1"
            disabled={hasServicesOrInstrumentInSheet && !isVanzariPipeline && !isDepartmentPipeline}
            title={hasServicesOrInstrumentInSheet && !isVanzariPipeline && !isDepartmentPipeline ? "Cantitatea este blocată - există deja servicii sau instrument în tăviță" : "Introduceți cantitatea instrumentului"}
          />
        </div>
      </div>

      {/* Brand, Serial Number și Garantie - doar pentru instrumente din departamentul Reparații */}
      {showBrandSerialGroups && (
        <div className="space-y-3 mt-3">
          {instrumentForm.brandSerialGroups!.map((group, groupIndex) => {
            // Calculează cantitatea pentru acest brand (din qty sau default 1)
            const brandQty = Number(group.qty || 1)
            // Generează automat casetele de serial number bazat pe cantitatea brand-ului
            const serialNumbersArray = Array.from({ length: Math.max(1, brandQty) }, (_, i) => 
              group.serialNumbers[i] || { serial: '', garantie: false }
            )
            
            return (
              <div key={groupIndex} className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 p-2 sm:p-3 bg-muted/30 rounded-lg border">
                {/* Brand - 2 cols */}
                <div className="col-span-1 sm:col-span-2">
                  <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Brand</Label>
                  <Input
                    className="h-7 sm:h-8 text-xs sm:text-sm"
                    value={group.brand}
                    onChange={e => onUpdateBrand!(groupIndex, e.target.value)}
                    placeholder="Introduceți brand-ul"
                  />
                </div>

                {/* Cantitate Brand - 1 col */}
                <div className="col-span-1 sm:col-span-1">
                  <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">Cant.</Label>
                  <Input
                    className="h-7 sm:h-8 text-xs sm:text-sm text-center"
                    type="number"
                    min="1"
                    value={group.qty || '1'}
                    onChange={e => {
                      const newQty = e.target.value
                      const qtyNum = Math.max(1, Number(newQty) || 1)
                      onUpdateBrandQty!(groupIndex, String(qtyNum))
                      if (setIsDirty) setIsDirty(true)
                    }}
                    placeholder="1"
                  />
                </div>

                {/* Serial Numbers cu Garanție - 5 cols */}
                <div className="col-span-1 sm:col-span-5">
                  <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">
                    Serial Numbers ({brandQty} {brandQty === 1 ? 'caseta' : 'casete'})
                  </Label>
                  <div className="space-y-1">
                    {serialNumbersArray.map((serialData, serialIndex) => (
                      <div key={serialIndex} className="flex gap-2 items-center">
                        <Input
                          className="h-7 text-sm flex-1"
                          value={serialData.serial || ''}
                          onChange={e => onUpdateSerialNumber!(groupIndex, serialIndex, e.target.value)}
                          placeholder={`Serial ${serialIndex + 1}`}
                        />
                        <div className="flex items-center gap-1">
                          <Checkbox
                            id={`serial-garantie-${groupIndex}-${serialIndex}`}
                            checked={serialData.garantie || false}
                            onCheckedChange={(c: any) => {
                              onUpdateSerialGarantie!(groupIndex, serialIndex, !!c)
                            }}
                          />
                          <Label htmlFor={`serial-garantie-${groupIndex}-${serialIndex}`} className="text-[10px] sm:text-xs cursor-pointer whitespace-nowrap">
                            G
                          </Label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Buton ștergere grup - 2 cols */}
                <div className="col-span-1 sm:col-span-2 flex flex-col justify-end">
                  {instrumentForm.brandSerialGroups!.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemoveBrandSerialGroup!(groupIndex)}
                      className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Șterge grup
                    </Button>
                  )}
                </div>

                {/* Buton adaugă grup nou - doar pentru primul grup */}
                {groupIndex === 0 && (
                  <div className="col-span-1 sm:col-span-2 flex flex-col justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={onAddBrandSerialGroup}
                      className="h-7 sm:h-8 text-xs sm:text-sm"
                    >
                      <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                      Adaugă brand
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

