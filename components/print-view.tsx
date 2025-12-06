'use client'

import { format } from 'date-fns'
import type { Lead } from '@/app/page'
import type { LeadQuoteItem, LeadQuote } from '@/lib/supabase/quoteOperations'

interface SheetData {
  quote: LeadQuote
  items: LeadQuoteItem[]
  subtotal: number
  totalDiscount: number
  urgentAmount: number
  total: number
  hasSubscription?: boolean
  subscriptionDiscount?: number
  hasSterilization?: boolean
  sterilizationDiscountAmount?: number
  isCash?: boolean
  isCard?: boolean
}

interface PrintViewProps {
  lead: Lead
  sheets: SheetData[]
  allSheetsTotal: number
  urgentMarkupPct: number
}

export function PrintView({
  lead,
  sheets,
  allSheetsTotal,
  urgentMarkupPct
}: PrintViewProps) {
  return (
    <div id="print-section" className="p-8 bg-white text-black">
      {/* Header cu datele clientului */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Fișă de Serviciu</h1>
        <div>
          <h2 className="font-semibold mb-2">Date Client</h2>
          <p><strong>Nume:</strong> {lead.name}</p>
          {lead.email && <p><strong>Email:</strong> {lead.email}</p>}
          {lead.phone && <p><strong>Telefon:</strong> {lead.phone}</p>}
        </div>
      </div>

      {/* Toate tăvițele */}
      {sheets.map((sheet, sheetIndex) => {
        const { quote, items, subtotal, totalDiscount, urgentAmount, total, hasSubscription, subscriptionDiscount, hasSterilization, sterilizationDiscountAmount, isCash, isCard } = sheet
        
        return (
          <div key={quote.id} className={sheetIndex > 0 ? "mt-8 page-break-before" : "mb-6"}>
            {/* Titlul tăviței */}
            <h2 className="text-xl font-semibold mb-3">{quote.name}</h2>

            {/* Tabel cu items */}
            <div className="mb-4">
              <table className="w-full border-collapse border border-gray-800">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-800 px-3 py-2 text-left">Poziție</th>
                    <th className="border border-gray-800 px-3 py-2 text-center">Cant.</th>
                    <th className="border border-gray-800 px-3 py-2 text-right">Preț unitar</th>
                    <th className="border border-gray-800 px-3 py-2 text-right">Disc %</th>
                    <th className="border border-gray-800 px-3 py-2 text-center">Urgent</th>
                    <th className="border border-gray-800 px-3 py-2 text-right">Total linie</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const disc = Math.min(100, Math.max(0, item.discount_pct))
                    const base = item.qty * item.unit_price_snapshot
                    const afterDisc = base * (1 - disc / 100)
                    const lineTotal = item.urgent ? afterDisc * (1 + urgentMarkupPct / 100) : afterDisc

                    return (
                      <tr key={item.id || index}>
                        <td className="border border-gray-800 px-3 py-2">{item.name_snapshot}</td>
                        <td className="border border-gray-800 px-3 py-2 text-center">{item.qty}</td>
                        <td className="border border-gray-800 px-3 py-2 text-right">
                          {item.unit_price_snapshot.toFixed(2)} RON
                        </td>
                        <td className="border border-gray-800 px-3 py-2 text-right">
                          {disc > 0 ? `${disc.toFixed(0)}%` : '-'}
                        </td>
                        <td className="border border-gray-800 px-3 py-2 text-center">
                          {item.urgent ? '✓' : '-'}
                        </td>
                        <td className="border border-gray-800 px-3 py-2 text-right font-medium">
                          {lineTotal.toFixed(2)} RON
                        </td>
                      </tr>
                    )
                  })}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="border border-gray-800 px-3 py-2 text-center text-gray-500">
                        Nu există poziții
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totaluri pentru această tăviță */}
            <div className="mb-4">
              <div className="max-w-md ml-auto">
                <div className="flex justify-between py-2 border-b">
                  <span>Subtotal</span>
                  <span className="font-medium">{subtotal.toFixed(2)} RON</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span>Discount total</span>
                  <span className="font-medium">-{totalDiscount.toFixed(2)} RON</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span>Urgent (+{urgentMarkupPct}% pe linii marcate)</span>
                  <span className="font-medium">{urgentAmount.toFixed(2)} RON</span>
                </div>
                {hasSubscription && subscriptionDiscount && (
                  <div className="flex justify-between py-2 border-b">
                    <span>Abonament (-{subscriptionDiscount}%)</span>
                    <span className="font-medium text-green-600">-{((subtotal - totalDiscount + urgentAmount) * (subscriptionDiscount / 100)).toFixed(2)} RON</span>
                  </div>
                )}
                {hasSterilization && sterilizationDiscountAmount !== undefined && (
                  <div className="flex justify-between py-2 border-b">
                    <span>Sterilizare (-10%)</span>
                    <span className="font-medium text-green-600">-{sterilizationDiscountAmount.toFixed(2)} RON</span>
                  </div>
                )}
                <div className="flex justify-between py-3 border-t-2 border-gray-800 font-bold text-lg">
                  <span>Total {quote.name}</span>
                  <span>{total.toFixed(2)} RON</span>
                </div>
                {(isCash || isCard) && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-sm">
                      <strong>Metodă de plată:</strong> {isCash ? 'Cash' : 'Card'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* Total general toate tăvițele */}
      {sheets.length > 1 && (
        <div className="mt-6 pt-4 border-t-2 border-gray-800">
          <div className="max-w-md ml-auto">
            <div className="flex justify-between py-2 font-bold text-lg">
              <span>Total toate tăvițele</span>
              <span>{allSheetsTotal.toFixed(2)} RON</span>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

