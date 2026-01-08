'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2, Move, Package, Wrench, Tag, AlertTriangle } from 'lucide-react'
import { URGENT_MARKUP_PCT } from '@/lib/types/preturi'
import type { LeadQuoteItem } from '@/lib/types/preturi'
import type { Service } from '@/lib/supabase/serviceOperations'
import type { Technician } from '@/lib/types/preturi'
import { cn } from '@/lib/utils'

interface ItemsTableProps {
  items: LeadQuoteItem[]
  services: Service[]
  instruments: Array<{ id: string; name: string }>
  technicians: Technician[]
  pipelinesWithIds: Array<{ id: string; name: string }>
  isReceptiePipeline: boolean
  canEditUrgentAndSubscription: boolean
  onUpdateItem: (id: string, patch: Partial<LeadQuoteItem>) => void
  onDelete: (id: string) => void
  onRowClick?: (item: LeadQuoteItem) => void
  onMoveInstrument?: (instrumentGroup: { instrument: { id: string; name: string }; items: LeadQuoteItem[] }) => void
}

export function ItemsTable({
  items,
  services,
  instruments,
  technicians,
  pipelinesWithIds,
  isReceptiePipeline,
  canEditUrgentAndSubscription,
  onUpdateItem,
  onDelete,
  onRowClick,
  onMoveInstrument,
}: ItemsTableProps) {
  // Normalizează props-urile pentru a evita erorile
  const safeItems = Array.isArray(items) ? items : []
  const safeServices = Array.isArray(services) ? services : []
  const safeInstruments = Array.isArray(instruments) ? instruments : []
  const safeTechnicians = Array.isArray(technicians) ? technicians : []
  const safePipelinesWithIds = Array.isArray(pipelinesWithIds) ? pipelinesWithIds : []
  
  // Grupează items-urile pe servicii cu același nume și service_id, combinând brand-urile
  const groupedItems = useMemo(() => {
    const itemsMap = new Map<string, LeadQuoteItem[]>()
    
    if (!safeItems || safeItems.length === 0) {
      return []
    }
    
    safeItems.forEach(item => {
      if (!item || item.item_type === null) return
      
      if (item.item_type === 'service' && item.service_id) {
        const key = `${item.service_id}_${item.name_snapshot || ''}`
        if (!itemsMap.has(key)) {
          itemsMap.set(key, [])
        }
        const existingGroup = itemsMap.get(key)
        if (existingGroup) {
          existingGroup.push(item)
        }
      } else {
        itemsMap.set(item.id, [item])
      }
    })
    
    const result: LeadQuoteItem[] = []
    itemsMap.forEach((groupItems, key) => {
      if (groupItems.length === 1) {
        result.push(groupItems[0])
      } else {
        const firstItem = groupItems[0]
        const brandGroupsMap = new Map<string, any>()
        
        groupItems.forEach(item => {
          if (!item) return
          const itemBrandGroups = item && typeof item === 'object' && Array.isArray((item as any)?.brand_groups) ? (item as any).brand_groups : []
          if (itemBrandGroups.length > 0) {
            itemBrandGroups.forEach((bg: any) => {
              if (!bg || typeof bg !== 'object') return
              const brandKey = bg?.brand || ''
              if (!brandGroupsMap.has(brandKey)) {
                brandGroupsMap.set(brandKey, {
                  brand: bg?.brand || '',
                  serialNumbers: [],
                  garantie: bg?.garantie || false
                })
              }
              const existingBg = brandGroupsMap.get(brandKey)
              if (!existingBg) return
              let serialNumbers: any[] = []
              if (bg && typeof bg === 'object' && 'serialNumbers' in bg) {
                const bgSerialNumbers = (bg as any).serialNumbers
                if (Array.isArray(bgSerialNumbers)) {
                  serialNumbers = bgSerialNumbers
                }
              }
              if (Array.isArray(serialNumbers) && serialNumbers.length > 0) {
                if (!Array.isArray(existingBg.serialNumbers)) {
                  existingBg.serialNumbers = []
                }
                existingBg.serialNumbers.push(...serialNumbers)
              }
            })
          } else if (item?.brand) {
            const brandKey = item.brand
            if (!brandGroupsMap.has(brandKey)) {
              brandGroupsMap.set(brandKey, {
                brand: item.brand || '',
                serialNumbers: item?.serial_number ? [item.serial_number] : [],
                garantie: item?.garantie || false
              })
            } else {
              const existingBg = brandGroupsMap.get(brandKey)
              if (existingBg && item?.serial_number) {
                if (!Array.isArray(existingBg.serialNumbers)) {
                  existingBg.serialNumbers = []
                }
                existingBg.serialNumbers.push(item.serial_number)
              }
            }
          }
        })
        
        const combinedItem: LeadQuoteItem = {
          ...firstItem,
          brand_groups: Array.from(brandGroupsMap.values()),
          qty: groupItems.reduce((sum, item) => sum + (item.qty || 1), 0)
        }
        result.push(combinedItem)
      }
    })
    
    return result
  }, [safeItems])
  
  const visibleItems = useMemo(() => groupedItems.filter(it => it.item_type !== null), [groupedItems])

  const getInstrumentName = (item: LeadQuoteItem): string => {
    try {
      if (item.item_type === 'service' && item.service_id) {
        const serviceDef = safeServices.find(s => s && s.id === item.service_id)
        if (serviceDef?.instrument_id) {
          const instrument = safeInstruments.find(i => i && i.id === serviceDef.instrument_id)
          return instrument?.name || serviceDef.instrument_id || '—'
        }
      } else if (item.item_type === 'part') {
        const firstService = safeItems.find(i => i && i.item_type === 'service' && i.service_id)
        if (firstService?.service_id) {
          const serviceDef = safeServices.find(s => s && s.id === firstService.service_id)
          if (serviceDef?.instrument_id) {
            const instrument = safeInstruments.find(i => i && i.id === serviceDef.instrument_id)
            return instrument?.name || serviceDef.instrument_id || '—'
          }
        }
      }
    } catch (error: any) {
      console.error('[ItemsTable] Error in getInstrumentName:', error?.message || 'Unknown error')
    }
    return '—'
  }

  const isFirstItemOfInstrument = (item: LeadQuoteItem, allItems: LeadQuoteItem[]): boolean => {
    try {
      const safeAllItems = Array.isArray(allItems) ? allItems : []
      
      let currentInstrumentId: string | null = null
      if (item.item_type === 'service' && item.service_id) {
        const serviceDef = safeServices.find(s => s && s.id === item.service_id)
        currentInstrumentId = serviceDef?.instrument_id || null
      } else if (item.instrument_id) {
        currentInstrumentId = item.instrument_id
      }

      if (!currentInstrumentId) return false

      const instrumentItems = safeAllItems.filter(i => {
        if (!i) return false
        if (i.item_type === 'service' && i.service_id) {
          const svc = safeServices.find(s => s && s.id === i.service_id)
          return svc?.instrument_id === currentInstrumentId
        }
        return i.instrument_id === currentInstrumentId
      })

      return instrumentItems.length > 0 && instrumentItems[0]?.id === item.id
    } catch (error: any) {
      console.error('[ItemsTable] Error in isFirstItemOfInstrument:', error?.message || 'Unknown error')
      return false
    }
  }

  const buildInstrumentGroup = (item: LeadQuoteItem) => {
    try {
      let currentInstrumentId: string | null = null
      if (item.item_type === 'service' && item.service_id) {
        const serviceDef = safeServices.find(s => s && s.id === item.service_id)
        currentInstrumentId = serviceDef?.instrument_id || null
      } else if (item.instrument_id) {
        currentInstrumentId = item.instrument_id
      }

      if (!currentInstrumentId) return null

      const instrumentItems = safeItems.filter(i => {
        if (!i) return false
        if (i.item_type === 'service' && i.service_id) {
          const svc = safeServices.find(s => s && s.id === i.service_id)
          return svc?.instrument_id === currentInstrumentId
        }
        return i.instrument_id === currentInstrumentId
      })
      
      const instrument = safeInstruments.find(i => i && i.id === currentInstrumentId)
      
      const cleanedItems = instrumentItems.map(it => {
        let safeBrandGroups: Array<{ id: string; brand: string; serialNumbers: string[]; garantie: boolean }> = []
        if (Array.isArray(it.brand_groups)) {
          safeBrandGroups = it.brand_groups.map((bg: any) => ({
            id: typeof bg?.id === 'string' ? bg.id : String(bg?.id || ''),
            brand: typeof bg?.brand === 'string' ? bg.brand : String(bg?.brand || ''),
            serialNumbers: Array.isArray(bg?.serialNumbers) 
              ? bg.serialNumbers.map((sn: any) => typeof sn === 'string' ? sn : String(sn || ''))
              : [],
            garantie: Boolean(bg?.garantie)
          }))
        }
        
        return {
          id: typeof it.id === 'string' ? it.id : String(it.id || ''),
          tray_id: typeof it.tray_id === 'string' ? it.tray_id : String(it.tray_id || ''),
          item_type: it.item_type || null,
          service_id: it.service_id || null,
          part_id: it.part_id || null,
          instrument_id: it.instrument_id || null,
          technician_id: it.technician_id || null,
          qty: typeof it.qty === 'number' ? it.qty : 1,
          price: typeof it.price === 'number' ? it.price : 0,
          name_snapshot: typeof it.name_snapshot === 'string' ? it.name_snapshot : '',
          urgent: Boolean(it.urgent),
          brand_groups: safeBrandGroups,
        } as LeadQuoteItem
      })
      
      return {
        instrument: { id: currentInstrumentId, name: instrument?.name || 'Instrument necunoscut' },
        items: cleanedItems
      }
    } catch (error: any) {
      // console.log('[ItemsTable] Error building instrumentGroup:', error?.message || 'Unknown error')
      return null
    }
  }

  const renderBrandSerial = (item: LeadQuoteItem) => {
    try {
      const brandGroups = item && typeof item === 'object' && Array.isArray((item as any)?.brand_groups) ? (item as any).brand_groups : []
      // console.log(`[ItemsTable] Rendering brand/serial for item ${item.id}:`, brandGroups)
      
      if (brandGroups.length > 0) {
        return (
          <div className="flex flex-col gap-1">
            {brandGroups.flatMap((bg: any, bgIdx: number) => {
              if (!bg || typeof bg !== 'object') return []
              
              let serialNumbers: any[] = []
              if (bg && typeof bg === 'object' && 'serialNumbers' in bg && Array.isArray(bg.serialNumbers)) {
                serialNumbers = bg.serialNumbers
              }
              
              const brandName = bg.brand || '—'
              
              // IMPORTANT: Creează un badge separat pentru fiecare serial number, afișat vertical pentru claritate
              return serialNumbers.map((sn: any, snIdx: number) => {
                const serial = typeof sn === 'string' ? sn : (sn && typeof sn === 'object' ? sn?.serial || '' : '')
                const serialDisplay = serial && serial.trim() ? serial.trim() : `Serial ${snIdx + 1}`
                const garantie = typeof sn === 'object' ? (sn?.garantie || false) : (bg.garantie || false)
                
                return (
                  <div 
                    key={`${bgIdx}-${snIdx}`}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium min-w-0",
                      garantie 
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700"
                        : "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    )}
                  >
                    <Tag className="h-3 w-3 flex-shrink-0" />
                    <span className="font-semibold text-[11px]">{brandName}</span>
                    <span className="text-slate-400 dark:text-slate-500">—</span>
                    <span className="truncate">{serialDisplay}</span>
                    {garantie && (
                      <span className="text-emerald-600 dark:text-emerald-400 flex-shrink-0">✓</span>
                    )}
                  </div>
                )
              })
            })}
          </div>
        )
      } else if (item.brand || item.serial_number) {
        return (
          <span className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
            item.garantie 
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          )}>
            <Tag className="h-2.5 w-2.5" />
            {item.brand || '—'}
            {item.serial_number && (
              <span className="text-[9px] opacity-70">({item.serial_number})</span>
            )}
            {item.garantie && (
              <span className="text-emerald-600">✓</span>
            )}
          </span>
        )
      }
      return <span className="text-muted-foreground text-xs">—</span>
    } catch (error) {
      console.error('❌ [ItemsTable] Error in brand/serial rendering:', error)
      return <span className="text-muted-foreground text-xs">—</span>
    }
  }

  if (visibleItems.length === 0) {
    return (
      <div className="mx-2 sm:mx-4 p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
            <Package className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Nu există poziții încă</p>
          <p className="text-xs text-muted-foreground mt-1">Adaugă un instrument și servicii pentru a începe</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-2 sm:mx-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Header modern */}
      <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100/80 dark:from-slate-800 dark:to-slate-800/50 border-b border-slate-200 dark:border-slate-700">
        <div className="col-span-2 flex items-center gap-1.5">
          <Wrench className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Instrument</span>
        </div>
        <div className="col-span-2">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Brand / Serial</span>
        </div>
        <div className="col-span-3">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Serviciu</span>
        </div>
        <div className="col-span-1 text-center">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Cant.</span>
        </div>
        <div className="col-span-1 text-center">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Preț</span>
        </div>
        <div className="col-span-1 text-center">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Disc%</span>
        </div>
        <div className="col-span-1 text-right">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Total</span>
        </div>
        <div className="col-span-1"></div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {visibleItems.map((item, index) => {
          const disc = Math.min(100, Math.max(0, item.discount_pct || 0))
          const base = (item.qty || 1) * item.price
          const afterDisc = base * (1 - disc / 100)
          const lineTotal = item.urgent ? afterDisc * (1 + URGENT_MARKUP_PCT / 100) : afterDisc

          const itemInstrument = getInstrumentName(item)
          const serviceName = item.item_type === 'service' 
            ? item.name_snapshot 
            : item.item_type === 'part' 
              ? 'Schimb piesă' 
              : ''

          const isFirstItem = isReceptiePipeline && onMoveInstrument 
            ? isFirstItemOfInstrument(item, safeItems)
            : false
          
          const instrumentGroup = isFirstItem ? buildInstrumentGroup(item) : null

          return (
            <div 
              key={item.id}
              className={cn(
                "grid grid-cols-12 gap-2 px-4 py-3 items-center transition-all cursor-pointer",
                "hover:bg-slate-50 dark:hover:bg-slate-800/50",
                item.urgent && "bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30",
                index % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/30 dark:bg-slate-800/20"
              )}
              onClick={() => onRowClick?.(item)}
            >
              {/* Instrument */}
              <div className="col-span-2">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    item.urgent 
                      ? "bg-red-100 dark:bg-red-900/40" 
                      : "bg-slate-100 dark:bg-slate-800"
                  )}>
                    <Wrench className={cn(
                      "h-4 w-4",
                      item.urgent ? "text-red-600 dark:text-red-400" : "text-slate-500"
                    )} />
                  </div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {itemInstrument}
                  </span>
                </div>
              </div>

              {/* Brand / Serial */}
              <div className="col-span-2">
                {renderBrandSerial(item)}
              </div>

              {/* Serviciu */}
              <div className="col-span-3">
                <div className="flex items-center gap-2">
                  {item.urgent && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-[9px] font-bold uppercase">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Urgent
                    </span>
                  )}
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {serviceName}
                  </span>
                </div>
                {item.item_type === 'part' && (
                  <Input
                    className="mt-1 h-7 text-xs"
                    value={item.name_snapshot || ''}
                    onChange={e => onUpdateItem(item.id, { name_snapshot: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Nume piesă"
                  />
                )}
              </div>

              {/* Cantitate */}
              <div className="col-span-1 flex justify-center">
                <Input
                  className="h-8 w-14 text-xs text-center font-medium bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  inputMode="numeric"
                  value={String(item.qty || 1)}
                  onChange={e => {
                    const v = Math.max(1, Number(e.target.value || 1))
                    onUpdateItem(item.id, { qty: v })
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Preț */}
              <div className="col-span-1 flex justify-center">
                {item.item_type === 'service' ? (
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {item.price.toFixed(2)}
                  </span>
                ) : (
                  <Input
                    className="h-8 w-16 text-xs text-center font-medium bg-slate-50 dark:bg-slate-800"
                    inputMode="decimal"
                    value={String(item.price)}
                    onChange={e => {
                      const v = Math.max(0, Number(e.target.value || 0))
                      onUpdateItem(item.id, { price: v })
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </div>

              {/* Discount */}
              <div className="col-span-1 flex justify-center">
                {canEditUrgentAndSubscription ? (
                  <Input
                    className="h-8 w-12 text-xs text-center font-medium bg-slate-50 dark:bg-slate-800"
                    inputMode="decimal"
                    value={String(item.discount_pct || 0)}
                    onChange={e => {
                      const v = Math.min(100, Math.max(0, Number(e.target.value || 0)))
                      onUpdateItem(item.id, { discount_pct: v })
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">{item.discount_pct || 0}%</span>
                )}
              </div>

              {/* Total */}
              <div className="col-span-1 text-right">
                <span className={cn(
                  "text-sm font-bold",
                  item.urgent 
                    ? "text-red-600 dark:text-red-400" 
                    : "text-slate-900 dark:text-slate-100"
                )}>
                  {lineTotal.toFixed(2)}
                </span>
              </div>

              {/* Actions */}
              <div className="col-span-1 flex justify-end gap-1">
                {isReceptiePipeline && isFirstItem && instrumentGroup && onMoveInstrument && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg" 
                    onClick={(e) => {
                      e.stopPropagation()
                      onMoveInstrument(instrumentGroup)
                    }}
                    title={`Mută instrumentul "${instrumentGroup.instrument.name}"`}
                  >
                    <Move className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg" 
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(item.id)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
