'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Wrench, Plus, Trash2, Tag, Hash } from 'lucide-react'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface AddInstrumentFormProps {
  instrumentForm: {
    instrument: string
    qty: string
    brandSerialGroups?: Array<{ brand: string; serialNumbers: Array<{ serial: string; garantie: boolean }>; qty: string }>
    garantie?: boolean
  }
  availableInstruments: Array<{ id: string; name: string; department_id?: string | null }>
  instruments?: Array<{ id: string; name: string; department_id: string | null; pipeline?: string | null }>
  departments?: Array<{ id: string; name: string }>
  instrumentSettings: Record<string, any>
  hasServicesOrInstrumentInSheet: boolean
  isVanzariPipeline: boolean
  isDepartmentPipeline: boolean
  isTechnician: boolean
  onInstrumentChange: (instrumentId: string) => void
  onQtyChange: (qty: string) => void
  onAddBrandSerialGroup?: () => void
  onRemoveBrandSerialGroup?: (groupIndex: number) => void
  onUpdateBrand?: (groupIndex: number, value: string) => void
  onUpdateBrandQty?: (groupIndex: number, qty: string) => void
  onUpdateSerialNumber?: (groupIndex: number, serialIndex: number, value: string) => void
  onAddSerialNumber?: (groupIndex: number) => void
  onRemoveSerialNumber?: (groupIndex: number, serialIndex: number) => void
  onUpdateSerialGarantie?: (groupIndex: number, serialIndex: number, garantie: boolean) => void
  setIsDirty?: (dirty: boolean) => void
  isAddInstrumentDisabled?: boolean // Flag pentru a dezactiva adăugarea de instrumente
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
  onAddSerialNumber,
  onRemoveSerialNumber,
  onUpdateSerialGarantie,
  setIsDirty,
  isAddInstrumentDisabled = false,
}: AddInstrumentFormProps) {
  const isReparatiiInstrument = useMemo(() => {
    if (!instrumentForm.instrument) return false
    const instrument = instruments.find(i => i.id === instrumentForm.instrument)
    if (!instrument) return false
    
    const deptId = instrument.department_id?.toLowerCase() || ''
    if (deptId.includes('reparatii') || deptId.includes('reparații')) return true
    
    if (instrument.department_id) {
      const department = departments.find(d => d.id === instrument.department_id)
      const deptName = department?.name?.toLowerCase() || ''
      if (deptName.includes('reparatii') || deptName.includes('reparații')) return true
    }
    
    const instrumentAny = instrument as any
    const pipeline = instrumentAny?.pipeline?.toLowerCase() || ''
    if (pipeline.includes('reparatii') || pipeline.includes('reparații')) return true
    
    return false
  }, [instrumentForm.instrument, instruments, departments])

  const showBrandSerialGroups = isReparatiiInstrument && 
    onAddBrandSerialGroup &&
    onRemoveBrandSerialGroup &&
    onUpdateBrand &&
    onUpdateBrandQty &&
    onUpdateSerialNumber &&
    onAddSerialNumber &&
    onUpdateSerialGarantie

  return (
    <div className="mx-2 sm:mx-4">
      <div className="rounded-xl border-2 border-emerald-200/80 dark:border-emerald-700/50 bg-gradient-to-br from-emerald-50 via-green-50/50 to-teal-50/30 dark:from-emerald-950/40 dark:via-green-950/30 dark:to-teal-950/20 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-emerald-100/80 to-green-100/60 dark:from-emerald-900/40 dark:to-green-900/30 border-b border-emerald-200/60 dark:border-emerald-700/40">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-sm">
              <Wrench className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-emerald-900 dark:text-emerald-100">
                Adaugă Instrument
              </h3>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/70">
                Selectează instrumentul pentru servicii
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="grid grid-cols-12 gap-3">
            {/* Instrument Select */}
            <div className="col-span-12 sm:col-span-9">
              <Label className="text-[10px] font-bold text-emerald-800/90 dark:text-emerald-200 uppercase tracking-wider mb-1.5 block">
                Instrument
              </Label>
              <select
                className="w-full h-10 text-sm rounded-lg border-2 border-emerald-200/80 dark:border-emerald-700/50 px-3 bg-white dark:bg-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                value={instrumentForm.instrument}
                onChange={e => onInstrumentChange(e.target.value)}
                disabled={isAddInstrumentDisabled}
              >
                <option value="">— selectează —</option>
                {availableInstruments.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
            </div>
            
            {/* Cantitate */}
            <div className="col-span-12 sm:col-span-3">
              <Label className="text-[10px] font-bold text-emerald-800/90 dark:text-emerald-200 uppercase tracking-wider mb-1.5 block">
                Cantitate
              </Label>
              <Input
                className="h-10 text-sm text-center border-2 border-emerald-200/80 dark:border-emerald-700/50 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-50"
                inputMode="numeric"
                value={instrumentForm.qty}
                onChange={e => onQtyChange(e.target.value)}
                placeholder="1"
                disabled={isAddInstrumentDisabled || (hasServicesOrInstrumentInSheet && !isVanzariPipeline && !isDepartmentPipeline)}
              />
            </div>
          </div>

          {/* Brand/Serial Groups */}
          {showBrandSerialGroups && (
            <div className="mt-4 space-y-3">
              {(() => {
                const brandSerialGroupsArray = Array.isArray(instrumentForm.brandSerialGroups) ? instrumentForm.brandSerialGroups : []
                const groupsToRender = brandSerialGroupsArray.length > 0 
                  ? brandSerialGroupsArray 
                  : [{ brand: '', serialNumbers: [{ serial: '', garantie: false }], qty: '1' }]
                return groupsToRender
              })().map((group, groupIndex) => {
                if (!group) return null
                const serialNumbers = Array.isArray(group?.serialNumbers) ? group.serialNumbers : []
                const serialNumbersArray = serialNumbers.length > 0 ? serialNumbers : [{ serial: '', garantie: false }]
                
                return (
                  <div key={groupIndex} className="rounded-lg border border-emerald-200/60 dark:border-emerald-700/40 bg-white/60 dark:bg-slate-900/40 p-3 space-y-2">
                    {/* Fiecare serial number pe un rând separat, cu toate elementele aliniate */}
                    {serialNumbersArray.map((serialData, serialIndex) => (
                      <div key={serialIndex} className="flex items-center gap-2">
                        {/* Brand - doar la primul serial */}
                        <div className="w-[180px] flex-shrink-0">
                          {serialIndex === 0 ? (
                            <div>
                              <Label className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                                <Tag className="h-3 w-3" /> Brand
                              </Label>
                              <Input
                                className="h-9 text-sm"
                                value={group?.brand || ''}
                                onChange={e => onUpdateBrand!(groupIndex, e.target.value)}
                                placeholder="Brand"
                              />
                            </div>
                          ) : (
                            <div className="h-9 mt-[18px]" />
                          )}
                        </div>

                        {/* Cantitate - doar la primul serial */}
                        <div className="w-[70px] flex-shrink-0">
                          {serialIndex === 0 ? (
                            <div>
                              <Label className="text-[10px] text-muted-foreground mb-1 block">Cant.</Label>
                              <Input
                                className="h-9 text-sm text-center"
                                type="number"
                                min="1"
                                value={group.qty || '1'}
                                onChange={e => {
                                  const qtyNum = Math.max(1, Number(e.target.value) || 1)
                                  onUpdateBrandQty!(groupIndex, String(qtyNum))
                                  if (setIsDirty) setIsDirty(true)
                                }}
                              />
                            </div>
                          ) : (
                            <div className="h-9 mt-[18px]" />
                          )}
                        </div>

                        {/* Serial Number */}
                        <div className="flex-1">
                          <Label className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                            <Hash className="h-3 w-3" /> Serial ({serialIndex + 1})
                          </Label>
                          <Input
                            className="h-9 text-sm"
                            value={serialData.serial || ''}
                            onChange={e => onUpdateSerialNumber!(groupIndex, serialIndex, e.target.value)}
                            placeholder={`Serial ${serialIndex + 1}`}
                          />
                        </div>

                        {/* Garanție Checkbox */}
                        <div className="flex items-center gap-1.5 px-3 h-9 mt-[18px] rounded-md border border-emerald-200/60 dark:border-emerald-700/40 bg-emerald-50/50 dark:bg-emerald-900/20">
                          <Checkbox
                            id={`serial-garantie-${groupIndex}-${serialIndex}`}
                            checked={serialData.garantie || false}
                            onCheckedChange={(c: any) => onUpdateSerialGarantie!(groupIndex, serialIndex, !!c)}
                            className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                          />
                          <Label htmlFor={`serial-garantie-${groupIndex}-${serialIndex}`} className="text-[11px] cursor-pointer font-medium text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                            Garanție
                          </Label>
                        </div>

                        {/* Butoane Acțiuni - aliniate cu inputurile */}
                        <div className="flex items-center gap-1 mt-[18px]">
                          {/* Adaugă Serial */}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => onAddSerialNumber!(groupIndex)}
                            className="h-9 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100/50"
                            title="Adaugă serial"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>

                          {/* Șterge Serial */}
                          {onRemoveSerialNumber && serialNumbersArray.length > 1 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => onRemoveSerialNumber(groupIndex, serialIndex)}
                              className="h-9 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                              title="Șterge serial"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Adaugă Brand Nou - doar la primul serial */}
                          {serialIndex === 0 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={onAddBrandSerialGroup}
                              className="h-9 px-3 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 whitespace-nowrap"
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Brand
                            </Button>
                          )}

                          {/* Șterge Brand Group - doar la primul serial și dacă avem mai mult de un grup */}
                          {serialIndex === 0 && instrumentForm.brandSerialGroups && instrumentForm.brandSerialGroups.length > 1 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => onRemoveBrandSerialGroup!(groupIndex)}
                              className="h-9 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                              title="Șterge acest brand"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
