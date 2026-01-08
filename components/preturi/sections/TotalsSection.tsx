'use client'

import { useMemo } from 'react'
import { URGENT_MARKUP_PCT } from '@/lib/types/preturi'
import type { LeadQuoteItem } from '@/lib/types/preturi'
import type { Service } from '@/lib/supabase/serviceOperations'

interface TotalsSectionProps {
  items: LeadQuoteItem[]
  subscriptionType: 'services' | 'parts' | 'both' | '' | null
  services: Service[]
  instruments: Array<{ id: string; weight: number }>
}

export function TotalsSection({
  items = [],
  subscriptionType,
  services = [],
  instruments = [],
}: TotalsSectionProps) {
  // Calculează totalurile
  const { subtotal, totalDiscount, urgentAmount, total, totalWeight } = useMemo(() => {
    let subtotal = 0
    let totalDiscount = 0
    let urgentAmount = 0
    let totalWeight = 0

    if (!Array.isArray(items)) {
      return {
        subtotal: 0,
        totalDiscount: 0,
        urgentAmount: 0,
        total: 0,
        totalWeight: 0,
        subscriptionDiscount: 0,
      }
    }

    items.forEach(item => {
      if (!item) return
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

      const safeServices = Array.isArray(services) ? services : []
      const safeInstruments = Array.isArray(instruments) ? instruments : []
      
      if (item.item_type === 'service' && item.service_id) {
        const serviceDef = safeServices.find(s => s && s.id === item.service_id)
        if (serviceDef?.instrument_id) {
          instrumentId = serviceDef.instrument_id
        }
      } else if (item.item_type === null && item.instrument_id) {
        instrumentId = item.instrument_id
      }

      if (instrumentId) {
        const instrument = safeInstruments.find(i => i && i.id === instrumentId)
        if (instrument && instrument.weight) {
          totalWeight += instrument.weight * qty
        }
      }
    })

    // Aplică discount-urile de abonament
    let subscriptionDiscount = 0
    if (subscriptionType && subscriptionType !== '' && subscriptionType !== null) {
      if (subscriptionType === 'services' || subscriptionType === 'both') {
        const servicesSubtotal = Array.isArray(items) ? items
          .filter(it => it && it.item_type === 'service')
          .reduce((acc, it) => {
            if (!it) return acc
            const base = (it.qty || 1) * it.price
            const disc = base * (Math.min(100, Math.max(0, it.discount_pct || 0)) / 100)
            const afterDisc = base - disc
            const urgent = it.urgent ? afterDisc * (URGENT_MARKUP_PCT / 100) : 0
            return acc + (afterDisc + urgent) * 0.10
          }, 0) : 0
        subscriptionDiscount += servicesSubtotal
      }

      if (subscriptionType === 'parts' || subscriptionType === 'both') {
        const partsSubtotal = Array.isArray(items) ? items
          .filter(it => it && it.item_type === 'part')
          .reduce((acc, it) => {
            if (!it) return acc
            const base = (it.qty || 1) * it.price
            const disc = base * (Math.min(100, Math.max(0, it.discount_pct || 0)) / 100)
            return acc + (base - disc) * 0.05
          }, 0) : 0
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
    <div className="px-1 sm:px-2">
      <div className="w-full text-xs sm:text-sm bg-muted/20 rounded-lg p-2 sm:p-3">
        {/* Rând cu 4 coloane: Subtotal, Discount, Urgent, Total */}
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          {/* Coloana 1: Subtotal */}
          <div className="flex flex-col">
            <span className="text-muted-foreground text-[10px] sm:text-xs mb-1">Subtotal</span>
            <span className="font-medium text-sm sm:text-base">{subtotal.toFixed(2)} RON</span>
          </div>
          
          {/* Coloana 2: Discount */}
          <div className="flex flex-col">
            <span className="text-muted-foreground text-[10px] sm:text-xs mb-1">Discount</span>
            <span className="font-medium text-sm sm:text-base text-red-500">-{totalDiscount.toFixed(2)} RON</span>
          </div>
          
          {/* Coloana 3: Urgent */}
          <div className="flex flex-col">
            <span className="text-muted-foreground text-[10px] sm:text-xs mb-1">Urgent (+{URGENT_MARKUP_PCT}%)</span>
            <span className="font-medium text-sm sm:text-base text-amber-600">+{urgentAmount.toFixed(2)} RON</span>
          </div>
          
          {/* Coloana 4: Total */}
          <div className="flex flex-col">
            <span className="text-muted-foreground text-[10px] sm:text-xs mb-1">Total</span>
            <span className="font-semibold text-base sm:text-lg">{total.toFixed(2)} RON</span>
          </div>
        </div>
        
        {/* Discount-uri abonament (dacă există) */}
        {subscriptionType && subscriptionType !== '' && subscriptionType !== null && (
          <div className="mt-3 pt-3 border-t border-border/40">
            <div className="flex flex-col gap-1">
              {(subscriptionType === 'services' || subscriptionType === 'both') && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Abonament servicii (-10%)</span>
                  <span className="text-green-600">
                    -{(Array.isArray(items) ? items
                      .filter(it => it && it.item_type === 'service')
                      .reduce((acc, it) => {
                        if (!it) return acc
                        const base = (it.qty || 1) * it.price
                        const disc = base * (Math.min(100, Math.max(0, it.discount_pct || 0)) / 100)
                        const afterDisc = base - disc
                        const urgent = it.urgent ? afterDisc * (URGENT_MARKUP_PCT / 100) : 0
                        return acc + (afterDisc + urgent) * 0.10
                      }, 0) : 0).toFixed(2)} RON
                  </span>
                </div>
              )}
              {(subscriptionType === 'parts' || subscriptionType === 'both') && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Abonament piese (-5%)</span>
                  <span className="text-green-600">
                    -{(Array.isArray(items) ? items
                      .filter(it => it && it.item_type === 'part')
                      .reduce((acc, it) => {
                        if (!it) return acc
                        const base = (it.qty || 1) * it.price
                        const disc = base * (Math.min(100, Math.max(0, it.discount_pct || 0)) / 100)
                        return acc + (base - disc) * 0.05
                      }, 0) : 0).toFixed(2)} RON
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Greutate tăviță (dacă există) */}
        {totalWeight > 0 && (
          <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-border/40">
            <span className="text-muted-foreground">Greutate tăviță</span>
            <span className="font-medium">{totalWeight.toFixed(2)} kg</span>
          </div>
        )}
      </div>
    </div>
  )
}



