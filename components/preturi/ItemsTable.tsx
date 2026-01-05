'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Trash2, Move } from 'lucide-react'
import { URGENT_MARKUP_PCT } from '@/lib/types/preturi'
import type { LeadQuoteItem } from '@/lib/types/preturi'
import type { Service } from '@/lib/supabase/serviceOperations'
import type { Technician } from '@/lib/types/preturi'

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
  // Filtrează items-urile care nu sunt null (exclude doar instrumente fără servicii)
  const visibleItems = useMemo(() => items.filter(it => it.item_type !== null), [items])

  // Funcție helper pentru a găsi numele instrumentului pentru un item
  const getInstrumentName = (item: LeadQuoteItem): string => {
    if (item.item_type === 'service' && item.service_id) {
      const serviceDef = services.find(s => s.id === item.service_id)
      if (serviceDef?.instrument_id) {
        const instrument = instruments.find(i => i.id === serviceDef.instrument_id)
        return instrument?.name || serviceDef.instrument_id || '—'
      }
    } else if (item.item_type === 'part') {
      // Pentru piese, folosește instrumentul de la primul serviciu din tăviță
      const firstService = items.find(i => i.item_type === 'service' && i.service_id)
      if (firstService?.service_id) {
        const serviceDef = services.find(s => s.id === firstService.service_id)
        if (serviceDef?.instrument_id) {
          const instrument = instruments.find(i => i.id === serviceDef.instrument_id)
          return instrument?.name || serviceDef.instrument_id || '—'
        }
      }
    }
    return '—'
  }

  // Funcție helper pentru a verifica dacă un item este primul item al unui instrument
  const isFirstItemOfInstrument = (item: LeadQuoteItem, allItems: LeadQuoteItem[]): boolean => {
    let currentInstrumentId: string | null = null
    if (item.item_type === 'service' && item.service_id) {
      const serviceDef = services.find(s => s.id === item.service_id)
      currentInstrumentId = serviceDef?.instrument_id || null
    } else if (item.instrument_id) {
      currentInstrumentId = item.instrument_id
    }

    if (!currentInstrumentId) return false

    const instrumentItems = allItems.filter(i => {
      if (i.item_type === 'service' && i.service_id) {
        const svc = services.find(s => s.id === i.service_id)
        return svc?.instrument_id === currentInstrumentId
      }
      return i.instrument_id === currentInstrumentId
    })

    return instrumentItems.length > 0 && instrumentItems[0].id === item.id
  }

  return (
    <div className="p-0 mx-1 sm:mx-2 overflow-x-auto border rounded-lg bg-card">
      <Table className="text-xs sm:text-sm min-w-[800px]">
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-20 sm:w-24 text-[10px] sm:text-xs font-semibold">Instrument</TableHead>
            <TableHead className="text-[10px] sm:text-xs font-semibold min-w-[120px]">Serviciu</TableHead>
            <TableHead className="text-[10px] sm:text-xs font-semibold min-w-[100px]">Piesă</TableHead>
            <TableHead className="w-32 sm:w-40 text-[10px] sm:text-xs font-semibold">Brand / Serial</TableHead>
            <TableHead className="w-12 sm:w-16 text-[10px] sm:text-xs font-semibold text-center">Cant.</TableHead>
            <TableHead className="w-20 sm:w-24 text-[10px] sm:text-xs font-semibold text-center">Preț</TableHead>
            <TableHead className="w-12 sm:w-16 text-[10px] sm:text-xs font-semibold text-center">Disc%</TableHead>
            <TableHead className="w-12 sm:w-16 text-[10px] sm:text-xs font-semibold text-center">Urgent</TableHead>
            <TableHead className="w-24 sm:w-28 text-[10px] sm:text-xs font-semibold hidden md:table-cell">Departament</TableHead>
            <TableHead className="w-24 sm:w-28 text-[10px] sm:text-xs font-semibold hidden lg:table-cell">Tehnician</TableHead>
            <TableHead className="w-20 sm:w-24 text-[10px] sm:text-xs font-semibold text-right">Total</TableHead>
            {isReceptiePipeline && <TableHead className="w-8 sm:w-10"></TableHead>}
            <TableHead className="w-8 sm:w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleItems.map(item => {
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
            const partName = item.item_type === 'part' ? item.name_snapshot : null

            // Verifică dacă este primul item al instrumentului (pentru butonul Move)
            const isFirstItem = isReceptiePipeline && onMoveInstrument 
              ? isFirstItemOfInstrument(item, items)
              : false

            // Găsește instrumentul pentru butonul Move
            let instrumentGroup: { instrument: { id: string; name: string }; items: LeadQuoteItem[] } | null = null
            if (isFirstItem && onMoveInstrument) {
              let currentInstrumentId: string | null = null
              if (item.item_type === 'service' && item.service_id) {
                const serviceDef = services.find(s => s.id === item.service_id)
                currentInstrumentId = serviceDef?.instrument_id || null
              } else if (item.instrument_id) {
                currentInstrumentId = item.instrument_id
              }

              if (currentInstrumentId) {
                const instrumentItems = items.filter(i => {
                  if (i.item_type === 'service' && i.service_id) {
                    const svc = services.find(s => s.id === i.service_id)
                    return svc?.instrument_id === currentInstrumentId
                  }
                  return i.instrument_id === currentInstrumentId
                })
                const instrument = instruments.find(i => i.id === currentInstrumentId)
                instrumentGroup = {
                  instrument: { id: currentInstrumentId, name: instrument?.name || 'Instrument necunoscut' },
                  items: instrumentItems
                }
              }
            }

            return (
              <TableRow 
                key={item.id} 
                className="hover:bg-muted/30 cursor-pointer"
                onClick={() => onRowClick?.(item)}
              >
                <TableCell className="text-[10px] sm:text-xs text-muted-foreground py-1.5 sm:py-2">
                  {itemInstrument}
                </TableCell>
                <TableCell className="font-medium text-xs sm:text-sm py-1.5 sm:py-2">
                  {serviceName}
                </TableCell>
                <TableCell className="text-xs sm:text-sm py-1.5 sm:py-2">
                  {item.item_type === 'part' ? (
                    <Input
                      className="h-6 sm:h-7 text-xs sm:text-sm"
                      value={item.name_snapshot || ''}
                      onChange={e => onUpdateItem(item.id, { name_snapshot: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Brand / Serial */}
                <TableCell className="py-1.5 sm:py-2">
                  {(() => {
                    const brandGroups = (item as any).brand_groups || []
                    if (brandGroups.length > 0) {
                      return (
                        <div className="space-y-1">
                          {brandGroups.map((bg: any, idx: number) => (
                            <div key={idx} className="text-[10px] sm:text-xs">
                              <span className="font-medium text-blue-600">{bg.brand || '—'}</span>
                              {bg.serialNumbers && bg.serialNumbers.length > 0 && bg.serialNumbers.some((sn: any) => {
                                const serial = typeof sn === 'string' ? sn : sn.serial || ''
                                return serial && serial.trim()
                              }) && (
                                <span className="text-muted-foreground ml-1">
                                  ({bg.serialNumbers
                                    .map((sn: any) => {
                                      const serial = typeof sn === 'string' ? sn : sn.serial || ''
                                      return serial.trim()
                                    })
                                    .filter((s: string) => s)
                                    .join(', ')})
                                </span>
                              )}
                              {bg.garantie && <span className="ml-1 text-green-600 text-[9px] sm:text-[10px]">✓G</span>}
                            </div>
                          ))}
                        </div>
                      )
                    } else if (item.brand || item.serial_number) {
                      return (
                        <div className="text-[10px] sm:text-xs">
                          <span className="font-medium text-blue-600">{item.brand || '—'}</span>
                          {item.serial_number && (
                            <span className="text-muted-foreground ml-1">({item.serial_number})</span>
                          )}
                          {item.garantie && <span className="ml-1 text-green-600 text-[9px] sm:text-[10px]">✓G</span>}
                        </div>
                      )
                    }
                    return <span className="text-muted-foreground text-[10px] sm:text-xs">—</span>
                  })()}
                </TableCell>

                <TableCell className="py-1.5 sm:py-2">
                  <Input
                    className="h-6 sm:h-7 text-xs sm:text-sm text-center w-12 sm:w-14"
                    inputMode="numeric"
                    value={String(item.qty || 1)}
                    onChange={e => {
                      const v = Math.max(1, Number(e.target.value || 1))
                      onUpdateItem(item.id, { qty: v })
                    }}
                    onClick={(e) => e.stopPropagation()}
                    title="Introduceți cantitatea"
                  />
                </TableCell>

                <TableCell className="py-1.5 sm:py-2 text-center">
                  {item.item_type === 'service' ? (
                    <span className="text-xs sm:text-sm">{item.price.toFixed(2)}</span>
                  ) : (
                    <Input
                      className="h-6 sm:h-7 text-xs sm:text-sm text-center w-16 sm:w-20"
                      inputMode="decimal"
                      value={String(item.price)}
                      onChange={e => {
                        const v = Math.max(0, Number(e.target.value || 0))
                        onUpdateItem(item.id, { price: v })
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </TableCell>

                <TableCell className="py-1.5 sm:py-2">
                  {canEditUrgentAndSubscription ? (
                    <Input
                      className="h-6 sm:h-7 text-xs sm:text-sm text-center w-10 sm:w-12"
                      inputMode="decimal"
                      value={String(item.discount_pct || 0)}
                      onChange={e => {
                        const v = Math.min(100, Math.max(0, Number(e.target.value || 0)))
                        onUpdateItem(item.id, { discount_pct: v })
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="text-[10px] sm:text-xs text-muted-foreground">{item.discount_pct || 0}%</span>
                  )}
                </TableCell>

                <TableCell className="py-1.5 sm:py-2 text-center">
                  {canEditUrgentAndSubscription ? (
                    <Checkbox
                      checked={!!item.urgent}
                      onCheckedChange={(c: any) => {
                        onUpdateItem(item.id, { urgent: !!c })
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className={`text-[10px] sm:text-xs ${item.urgent ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                      {item.urgent ? 'Da' : '—'}
                    </span>
                  )}
                </TableCell>

                <TableCell className="py-1.5 sm:py-2 hidden md:table-cell">
                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                    {item.pipeline_id 
                      ? pipelinesWithIds.find(p => p.id === item.pipeline_id)?.name || '—'
                      : '—'
                    }
                  </span>
                </TableCell>

                <TableCell className="py-1.5 sm:py-2 hidden lg:table-cell">
                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                    {item.technician_id 
                      ? (technicians.find(t => t.id === item.technician_id)?.name || item.technician_id)
                      : '—'
                    }
                  </span>
                </TableCell>

                <TableCell className="text-right font-medium text-xs sm:text-sm py-1.5 sm:py-2">
                  {lineTotal.toFixed(2)}
                </TableCell>

                {/* Buton pentru mutarea instrumentului - disponibil doar pentru Receptie */}
                {isReceptiePipeline && (
                  <TableCell className="py-1.5 sm:py-2">
                    {isFirstItem && instrumentGroup && onMoveInstrument && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50" 
                        onClick={(e) => {
                          e.stopPropagation()
                          onMoveInstrument(instrumentGroup)
                        }}
                        title={`Mută instrumentul "${instrumentGroup.instrument.name}" și serviciile lui`}
                      >
                        <Move className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                )}

                <TableCell className="py-1.5 sm:py-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 sm:h-7 sm:w-7 text-destructive hover:text-destructive hover:bg-destructive/10" 
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(item.id)
                    }}
                  >
                    <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}

          {visibleItems.length === 0 && (
            <TableRow>
              <TableCell colSpan={isReceptiePipeline ? 13 : 12} className="text-muted-foreground text-center py-4 sm:py-6 text-xs sm:text-sm">
                Nu există poziții încă.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

