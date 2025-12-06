'use client'

import { supabaseBrowser } from './supabaseClient'
import { listQuotesForLead, listQuoteItems, type LeadQuoteItem } from './quoteOperations'

const supabase = supabaseBrowser()

const URGENT_MARKUP_PCT = 30 // +30% per line if urgent

// cache pentru totaluri (sa evitam recalculari inutile)
const totalsCache = new Map<string, { total: number; timestamp: number }>()
const CACHE_DURATION = 30000 // 30 secunde

/**
 * Invalideaza cache-ul pentru un lead specific sau pentru toate lead-urile unui client
 */
export function invalidateLeadTotalCache(leadId?: string, clientName?: string, clientEmail?: string) {
  if (leadId) {
    // invalideaza cache-ul pentru toate lead-urile aceluiasi client
    // (pentru ca calculateLeadTotal foloseste calculateClientTotal)
    // Vom invalida toate entry-urile care contin lead-ul
    const keysToDelete: string[] = []
    totalsCache.forEach((_, key) => {
      // Cache key este de forma "nume|email"
      // Trebuie sa invalidam daca lead-ul apartine aceluiasi client
      keysToDelete.push(key)
    })
    keysToDelete.forEach(key => totalsCache.delete(key))
  } else if (clientName && clientEmail) {
    const cacheKey = `${clientName}|${clientEmail}`.toLowerCase()
    totalsCache.delete(cacheKey)
  } else {
    // invalideaza tot cache-ul
    totalsCache.clear()
  }
}

/**
 * Calculează totalul pentru o listă de items din tăviță
 */
function computeItemsTotal(items: LeadQuoteItem[]): number {
  if (!items.length) return 0

  const subtotal = items.reduce((acc, it) => {
    const price = it.unit_price_snapshot || 0
    const qty = it.qty || 0
    return acc + (price * qty)
  }, 0)

  const totalDiscount = items.reduce((acc, it) => {
    const price = it.unit_price_snapshot || 0
    const qty = it.qty || 0
    const disc = Math.min(100, Math.max(0, it.discount_pct || 0))
    return acc + (price * qty * disc / 100)
  }, 0)

  const urgentAmount = items.reduce((acc, it) => {
    const price = it.unit_price_snapshot || 0
    const qty = it.qty || 0
    const disc = Math.min(100, Math.max(0, it.discount_pct || 0))
    const afterDisc = (price * qty) - (price * qty * disc / 100)
    return acc + (it.urgent ? afterDisc * (URGENT_MARKUP_PCT / 100) : 0)
  }, 0)

  return subtotal - totalDiscount + urgentAmount
}

/**
 * Calculează totalul tuturor tăvițelor pentru toate lead-urile unui client
 * Clientul este identificat prin combinația nume + email
 */
export async function calculateClientTotal(clientName: string, clientEmail: string): Promise<number> {
  try {
    // creeaza cheia cache pe baza clientului
    const cacheKey = `${clientName}|${clientEmail}`.toLowerCase()
    const cached = totalsCache.get(cacheKey)
    const now = Date.now()
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return cached.total
    }

    // gaseste toate lead-urile pentru acest client
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id')
      .ilike('full_name', clientName)
      .ilike('email', clientEmail) as { data: { id: string }[] | null, error: any }

    if (leadsError) throw leadsError
    if (!leads || leads.length === 0) {
      totalsCache.set(cacheKey, { total: 0, timestamp: now })
      return 0
    }

    // calculeaza totalul pentru toate lead-urile clientului
    let grandTotal = 0
    
    for (const lead of leads) {
      const quotes = await listQuotesForLead(lead.id)
      if (quotes && quotes.length > 0) {
        const leadTotals = await Promise.all(
          quotes.map(async (quote) => {
            const items = await listQuoteItems(quote.id)
            return computeItemsTotal(items || [])
          })
        )
        grandTotal += leadTotals.reduce((acc, total) => acc + total, 0)
      }
    }
    
    // salveaza in cache
    totalsCache.set(cacheKey, { total: grandTotal, timestamp: now })
    
    return grandTotal
  } catch (error) {
    console.error('Eroare la calcularea totalului pentru client:', clientName, clientEmail, error)
    return 0
  }
}

/**
 * Calculează totalul pentru un lead specific (wrapper pentru calculateClientTotal)
 */
export async function calculateLeadTotal(leadId: string): Promise<number> {
  try {
    // obtine informatiile despre lead
    const { data: lead, error } = await supabase
      .from('leads')
      .select('full_name, email')
      .eq('id', leadId)
      .single() as { data: { full_name: string | null, email: string | null } | null, error: any }

    if (error || !lead) {
      console.error('Lead nu a fost găsit:', leadId, error)
      return 0
    }

    // calculeaza totalul pentru client
    return await calculateClientTotal(lead.full_name || '', lead.email || '')
  } catch (error) {
    console.error('Eroare la calcularea totalului pentru lead:', leadId, error)
    return 0
  }
}

/**
 * Calculează totalurile pentru mai multe leads în paralel
 */
export async function calculateMultipleLeadTotals(leadIds: string[]): Promise<Record<string, number>> {
  try {
    const results = await Promise.all(
      leadIds.map(async (leadId) => {
        const total = await calculateLeadTotal(leadId)
        return { leadId, total }
      })
    )

    return results.reduce((acc, { leadId, total }) => {
      acc[leadId] = total
      return acc
    }, {} as Record<string, number>)
  } catch (error) {
    console.error('Eroare la calcularea totalurilor pentru leads:', error)
    return {}
  }
}

/**
 * Get totals for multiple leads in a single database call
 * This replaces calculateMultipleLeadTotals for performance
 */
 export async function getLeadTotalsBatch(leadIds: string[]): Promise<Record<string, number>> {
  if (leadIds.length === 0) return {}

  try {
    const { data, error } = await supabase.rpc('get_lead_totals_batch', {
      p_lead_ids: leadIds
    })

    if (error) throw error

    const result: Record<string, number> = {}
    ;(data || []).forEach((row: { lead_id: string; total: number }) => {
      result[row.lead_id] = Number(row.total) || 0
    })

    return result
  } catch (error) {
    console.error('Error fetching lead totals batch:', error)
    return {}
  }
}