'use client'

import React from 'react'
import { format } from 'date-fns'
import type { Lead } from '@/app/(crm)/dashboard/page'
// Tipuri pentru print view
type LeadQuoteItem = any
type LeadQuote = any
import type { Service } from '@/lib/supabase/serviceOperations'

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
  services?: Service[]
}

// Calculează totalul pentru un item
function calculateItemTotal(item: LeadQuoteItem, urgentMarkupPct: number): number {
  const disc = Math.min(100, Math.max(0, item.discount_pct))
  const base = item.qty * item.price
  const afterDisc = base * (1 - disc / 100)
  return item.urgent ? afterDisc * (1 + urgentMarkupPct / 100) : afterDisc
}

// Stil comun pentru celule
const cellStyle = {
  border: '1px solid #000',
  fontSize: '7px',
  paddingTop: '1px',
  paddingBottom: '1px',
  paddingLeft: '0.5px',
  paddingRight: '0.5px',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
}

// Header gri cu text negru
const headerStyle = {
  ...cellStyle,
  fontSize: '9px',
  backgroundColor: '#e0e0e0',
  color: '#000000',
  fontWeight: 'bold' as const,
  padding: '4px 2px',
}

// Stil pentru rândul instrumentului (gri)
const instrumentRowBg = '#d0d0d0'

export function PrintView({
  lead,
  sheets,
  allSheetsTotal,
  urgentMarkupPct,
  services = []
}: PrintViewProps) {
  // Calculează totaluri pe departamente
  const departmentTotals: Record<string, number> = {}
  sheets.forEach(sheet => {
    sheet.items.forEach(item => {
      const dept = item.department || 'Alte'
      const itemTotal = calculateItemTotal(item, urgentMarkupPct)
      departmentTotals[dept] = (departmentTotals[dept] || 0) + itemTotal
    })
  })

  // Calculează discount-urile totale
  const allSubtotal = sheets.reduce((acc, s) => acc + s.subtotal, 0)
  const allTotalDiscount = sheets.reduce((acc, s) => acc + s.totalDiscount, 0)
  const allUrgentAmount = sheets.reduce((acc, s) => acc + s.urgentAmount, 0)
  
  const firstSheet = sheets[0]
  const hasSubscription = firstSheet?.hasSubscription || false
  const subscriptionDiscount = firstSheet?.subscriptionDiscount || 0
  const hasSterilization = firstSheet?.hasSterilization || false
  
  const subscriptionDiscountAmount = hasSubscription && subscriptionDiscount
    ? (allSubtotal - allTotalDiscount + allUrgentAmount) * (subscriptionDiscount / 100)
    : 0
  
  const sterilizationDiscountAmount = hasSterilization
    ? (allSubtotal - allTotalDiscount + allUrgentAmount - subscriptionDiscountAmount) * 0.1
    : 0

  const finalTotal = allSheetsTotal

  return (
    <div id="print-section" className="p-1 bg-white text-black" style={{ fontFamily: 'Arial, sans-serif', fontSize: '7px' }}>
      {/* Header cu detalii client și furnizor */}
      <div style={{ marginBottom: '10px' }}>
        {/* Titlu și număr fișă */}
        <div style={{ display: 'flex', gap: '80px', marginBottom: '5px' }}>
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>FISA DE SERVICE</span>
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>NR. {lead.leadId?.slice(-1) || '1'}</span>
        </div>
        
        {/* Număr comandă */}
        <div style={{ fontSize: '11px', fontStyle: 'italic', marginBottom: '10px' }}>
          la comanda Nr.: {lead.leadId?.slice(-3) || '000'}
        </div>
        
        {/* Detalii client și furnizor - 2 coloane */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {/* Coloana stângă - Client */}
          <div style={{ fontSize: '10px', lineHeight: '1.8' }}>
            <div><strong>CLIENT:</strong>&emsp;&emsp;{lead.name?.toUpperCase() || '-'}</div>
            <div><strong>MOB:</strong>&emsp;&emsp;&emsp;{lead.phone || '-'}</div>
            <div><strong>EMAIL:</strong>&emsp;&emsp;{lead.email || '-'}</div>
          </div>
          
          {/* Coloana dreapta - Furnizor */}
          <div style={{ fontSize: '10px', lineHeight: '1.8', textAlign: 'left' }}>
            <div><strong>FURNIZOR:</strong>&emsp;ASCUTZIT.RO SRL</div>
            <div><strong>CUI:</strong>&emsp;&emsp;&emsp;&emsp;&nbsp;123456</div>
            <div><strong>REG:</strong>&emsp;&emsp;&emsp;&emsp;J12 / 1234 / 1235</div>
            <div><strong>ADRESA:</strong>&emsp;&nbsp;București, str.Bujorul Alb 49</div>
          </div>
        </div>
      </div>

      {/* Tabel principal - fără coloanele DISC% și URG */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
        <thead>
          <tr>
            <th style={headerStyle}>DENUMIRE</th>
            <th style={headerStyle}>CANT.</th>
            <th style={headerStyle}>SERVICIU</th>
            <th style={headerStyle}>PIESE</th>
            <th style={headerStyle}>QTY</th>
            <th style={headerStyle}>DEPT</th>
            <th style={headerStyle}>TECH</th>
            <th style={headerStyle}>PREȚ</th>
            <th style={headerStyle}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {sheets.map((sheet) => {
            // Separă serviciile și piesele
            const serviceItems = sheet.items.filter(item => item.item_type === 'service')
            const parts = sheet.items.filter(item => item.item_type === 'part')

            // Obține denumirea instrumentului din primul serviciu
            let instrumentName = sheet.quote.name
            const firstService = serviceItems[0]
            if (firstService?.service_id && services.length > 0) {
              const serviceDef = services.find((s: Service) => s.id === firstService.service_id)
              if (serviceDef?.instrument) {
                instrumentName = serviceDef.instrument
              }
            }

            return (
              <React.Fragment key={sheet.quote.id}>
                {/* Linia pentru instrument - background gri */}
                <tr style={{ backgroundColor: instrumentRowBg }}>
                  <td style={{ ...cellStyle, fontWeight: 'bold', backgroundColor: instrumentRowBg }}>{instrumentName}</td>
                  <td style={{ ...cellStyle, backgroundColor: instrumentRowBg }}>1</td>
                  <td style={{ ...cellStyle, backgroundColor: instrumentRowBg }}></td>
                  <td style={{ ...cellStyle, backgroundColor: instrumentRowBg }}></td>
                  <td style={{ ...cellStyle, backgroundColor: instrumentRowBg }}></td>
                  <td style={{ ...cellStyle, backgroundColor: instrumentRowBg }}></td>
                  <td style={{ ...cellStyle, backgroundColor: instrumentRowBg }}></td>
                  <td style={{ ...cellStyle, backgroundColor: instrumentRowBg }}></td>
                  <td style={{ ...cellStyle, backgroundColor: instrumentRowBg }}></td>
                </tr>

                {/* Servicii */}
                {serviceItems.map((item, idx) => {
                  const lineTotal = calculateItemTotal(item, urgentMarkupPct)
                  return (
                    <tr key={`svc-${item.id}-${idx}`}>
                      <td style={cellStyle}></td>
                      <td style={cellStyle}></td>
                      <td style={cellStyle}>{item.name_snapshot}</td>
                      <td style={cellStyle}></td>
                      <td style={cellStyle}>{item.qty}</td>
                      <td style={cellStyle}>{item.department || '-'}</td>
                      <td style={cellStyle}>{item.technician || '-'}</td>
                      <td style={cellStyle}>{item.price.toFixed(2)}</td>
                      <td style={{ ...cellStyle, fontWeight: 'bold' }}>{lineTotal.toFixed(2)}</td>
                    </tr>
                  )
                })}

                {/* Piese - afișează "Schimb piese" în coloana SERVICIU */}
                {parts.map((item, idx) => {
                  const lineTotal = calculateItemTotal(item, urgentMarkupPct)
                  return (
                    <tr key={`part-${item.id}-${idx}`}>
                      <td style={cellStyle}></td>
                      <td style={cellStyle}></td>
                      <td style={cellStyle}>Schimb piese</td>
                      <td style={cellStyle}>{item.name_snapshot}</td>
                      <td style={cellStyle}>{item.qty}</td>
                      <td style={cellStyle}>{item.department || '-'}</td>
                      <td style={cellStyle}>-</td>
                      <td style={cellStyle}>{item.price.toFixed(2)}</td>
                      <td style={{ ...cellStyle, fontWeight: 'bold' }}>{lineTotal.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>

      {/* Secțiune subtotaluri pe departamente - SUB TABEL */}
      <div style={{ marginTop: '10px', fontSize: '9px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>SUBTOTAL PE DEPARTAMENTE:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
          {Object.entries(departmentTotals).map(([dept, total]) => (
            <div key={dept} style={{ display: 'flex', gap: '10px' }}>
              <span style={{ fontWeight: 'bold' }}>{dept.toUpperCase()}:</span>
              <span>{total.toFixed(2)} RON</span>
            </div>
          ))}
        </div>
      </div>

      {/* Secțiune discount-uri și taxe */}
      <div style={{ marginTop: '10px', fontSize: '9px', borderTop: '1px solid #000', paddingTop: '5px' }}>
        {/* Subtotal brut */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span>Subtotal (toate instrumentele):</span>
          <span style={{ fontWeight: 'bold' }}>{allSubtotal.toFixed(2)} RON</span>
        </div>

        {/* Discount per linii (dacă există) */}
        {allTotalDiscount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>Discount linii:</span>
            <span>-{allTotalDiscount.toFixed(2)} RON</span>
          </div>
        )}

        {/* Taxe suplimentare (dacă există) */}
        {allUrgentAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>TAXELE SUPLIMENTARE, RON:</span>
            <span>+{allUrgentAmount.toFixed(2)} RON</span>
          </div>
        )}

        {/* Abonament (dacă există) */}
        {hasSubscription && subscriptionDiscount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>Abonament (-{subscriptionDiscount}%):</span>
            <span>-{subscriptionDiscountAmount.toFixed(2)} RON</span>
          </div>
        )}

        {/* Sterilizare (dacă există) */}
        {hasSterilization && sterilizationDiscountAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>Sterilizare (-10%):</span>
            <span>-{sterilizationDiscountAmount.toFixed(2)} RON</span>
          </div>
        )}

        {/* TOTAL FINAL */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', paddingTop: '5px', borderTop: '2px solid #000', fontSize: '11px' }}>
          <span style={{ fontWeight: 'bold' }}>TOTAL DE PLATĂ:</span>
          <span style={{ fontWeight: 'bold' }}>{finalTotal.toFixed(2)} RON</span>
        </div>

        {/* Metoda de plată (dacă e bifată) */}
        {(firstSheet?.isCash || firstSheet?.isCard) && (
          <div style={{ marginTop: '5px', textAlign: 'center' }}>
            <strong>Metodă plată:</strong> {firstSheet?.isCash ? 'Cash' : ''} {firstSheet?.isCard ? 'Card' : ''}
          </div>
        )}
      </div>

      {/* Comentarii */}
      <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
        <div style={{ flex: 1, border: '1px solid #000', padding: '5px', minHeight: '50px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '8px', marginBottom: '5px' }}>COMENTARII CLIENT:</div>
        </div>
        <div style={{ flex: 1, border: '1px solid #000', padding: '5px', minHeight: '50px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '8px', marginBottom: '5px' }}>COMENTARII TEHNICIAN:</div>
        </div>
      </div>
    </div>
  )
}
