'use client'

import { useMemo } from 'react'
import { URGENT_MARKUP_PCT } from '@/lib/types/preturi'
import type { LeadQuoteItem } from '@/lib/types/preturi'
import type { Service } from '@/lib/supabase/serviceOperations'

interface TotalsSectionProps {
  items: LeadQuoteItem[]
  subscriptionType: 'services' | 'parts' | 'both' | ''
  services: Service[]
  instruments: Array<{ id: string; weight: number }>
}

export function TotalsSection({
  items,
  subscriptionType,
  services,
  instruments,
}: TotalsSectionProps) {
  // Calculează totalurile
  const { subtotal, totalDiscount, urgentAmount, total, totalWeight } = useMemo(() => {
    let subtotal = 0
    let totalDiscount = 0
    let urgentAmount = 0
    let totalWeight = 0

    items.forEach(item => {
      const disc = Math.min(100, Math.max(0, item.discount_pct || 0))
      const base = (item.qty || 1) * item.price
      const discAmount = base * (disc / 100)
      const afterDisc = base - discAmount
      const urgent = item.urgent ? afterDisc * (URGENT_MARKUP_PCT / 100) : 0

      subtotal += base
      totalDiscount += discAmount
      urgentAmount += urgent

      // Calculează greutatea pentru acest item
      let instrumentId: string | null = null
      const qty = item.qty || 1

      if (item.item_type === 'service' && item.service_id) {
        const serviceDef = services.find(s => s.id === item.service_id)
        if (serviceDef?.instrument_id) {
          instrumentId = serviceDef.instrument_id
        }
      } else if (item.item_type === null && item.instrument_id) {
        instrumentId = item.instrument_id
      }

      if (instrumentId) {
        const instrument = instruments.find(i => i.id === instrumentId)
        if (instrument && instrument.weight) {
          totalWeight += instrument.weight * qty
        }
      }
    })

    // Aplică discount-urile de abonament
    let subscriptionDiscount = 0
    if (subscriptionType) {
      if (subscriptionType === 'services' || subscriptionType === 'both') {
        const servicesSubtotal = items
          .filter(it => it.item_type === 'service')
          .reduce((acc, it) => {
            const base = (it.qty || 1) * it.price
            const disc = base * (Math.min(100, Math.max(0, it.discount_pct || 0)) / 100)
            const afterDisc = base - disc
            const urgent = it.urgent ? afterDisc * (URGENT_MARKUP_PCT / 100) : 0
            return acc + (afterDisc + urgent) * 0.10
          }, 0)
        subscriptionDiscount += servicesSubtotal
      }

      if (subscriptionType === 'parts' || subscriptionType === 'both') {
        const partsSubtotal = items
          .filter(it => it.item_type === 'part')
          .reduce((acc, it) => {
            const base = (it.qty || 1) * it.price
            const disc = base * (Math.min(100, Math.max(0, it.discount_pct || 0)) / 100)
            return acc + (base - disc) * 0.05
          }, 0)
        subscriptionDiscount += partsSubtotal
      }
    }

    const total = subtotal - totalDiscount + urgentAmount - subscriptionDiscount

    return {
      subtotal,
      totalDiscount,
      urgentAmount,
      total,
      totalWeight,
      subscriptionDiscount,
    }
  }, [items, subscriptionType, services, instruments])

  return (
    <div className="flex justify-end px-1 sm:px-2">
      <div className="w-full md:w-[280px] lg:w-[320px] space-y-0.5 sm:space-y-1 text-xs sm:text-sm bg-muted/20 rounded-lg p-2 sm:p-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{subtotal.toFixed(2)} RON</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Discount</span>
          <span className="text-red-500">-{totalDiscount.toFixed(2)} RON</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Urgent (+{URGENT_MARKUP_PCT}%)</span>
          <span className="text-amber-600">+{urgentAmount.toFixed(2)} RON</span>
        </div>
        {subscriptionType && (
          <div className="flex flex-col gap-1">
            {(subscriptionType === 'services' || subscriptionType === 'both') && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Abonament servicii (-10%)</span>
                <span className="text-green-600">
                  -{items
                    .filter(it => it.item_type === 'service')
                    .reduce((acc, it) => {
                      const base = (it.qty || 1) * it.price
                      const disc = base * (Math.min(100, Math.max(0, it.discount_pct || 0)) / 100)
                      const afterDisc = base - disc
                      const urgent = it.urgent ? afterDisc * (URGENT_MARKUP_PCT / 100) : 0
                      return acc + (afterDisc + urgent) * 0.10
                    }, 0).toFixed(2)} RON
                </span>
              </div>
            )}
            {(subscriptionType === 'parts' || subscriptionType === 'both') && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Abonament piese (-5%)</span>
                <span className="text-green-600">
                  -{items
                    .filter(it => it.item_type === 'part')
                    .reduce((acc, it) => {
                      const base = (it.qty || 1) * it.price
                      const disc = base * (Math.min(100, Math.max(0, it.discount_pct || 0)) / 100)
                      return acc + (base - disc) * 0.05
                    }, 0).toFixed(2)} RON
                </span>
              </div>
            )}
          </div>
        )}
        <div className="h-px bg-border my-2" />
        <div className="flex items-center justify-between font-semibold text-base">
          <span>Total</span>
          <span>{total.toFixed(2)} RON</span>
        </div>
        {totalWeight > 0 && (
          <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t">
            <span className="text-muted-foreground">Greutate tăviță</span>
            <span className="font-medium">{totalWeight.toFixed(2)} kg</span>
          </div>
        )}
      </div>
    </div>
  )
}

