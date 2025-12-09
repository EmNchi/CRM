'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { listServices, type Service } from '@/lib/supabase/serviceOperations';
import {
  listQuoteItems,
  type LeadQuoteItem,
  type LeadQuote,
  listQuotesForLead,
  updateQuote,
  createQuoteForLead,
} from '@/lib/supabase/quoteOperations';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus, Wrench } from 'lucide-react';
import { listTechnicians, type Technician } from '@/lib/supabase/technicianOperations'
import { listParts, type Part } from '@/lib/supabase/partOperations'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
const supabase = supabaseBrowser()
import { persistAndLogServiceSheet } from "@/lib/history/serviceSheet"
import { invalidateLeadTotalCache } from "@/lib/supabase/leadTotals"
import { listTags, toggleLeadTag } from '@/lib/supabase/tagOperations'
import { PrintView } from '@/components/print-view'
import type { Lead } from '@/app/page'

const URGENT_MARKUP_PCT = 30; // +30% per line if urgent

// Componenta pentru calcularea si afisarea datelor de print pentru toate tavitele
function PrintViewData({ 
  lead, 
  quotes, 
  allSheetsTotal, 
  urgentMarkupPct,
  hasSubscription,
  subscriptionDiscount
}: { 
  lead: Lead
  quotes: LeadQuote[]
  allSheetsTotal: number
  urgentMarkupPct: number
  hasSubscription: boolean
  subscriptionDiscount: string
}) {
  const [sheetsData, setSheetsData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAllSheetsData = async () => {
      if (!quotes.length) {
        setSheetsData([])
        setLoading(false)
        return
      }

      const sheets = await Promise.all(
        quotes.map(async (quote) => {
          const items = await listQuoteItems(quote.id)
          
          // Calculeaza totalurile pentru aceasta tavita
          const subtotal = items.reduce((acc, it) => acc + it.qty * it.unit_price_snapshot, 0)
          const totalDiscount = items.reduce(
            (acc, it) => acc + it.qty * it.unit_price_snapshot * (Math.min(100, Math.max(0, it.discount_pct)) / 100),
            0
          )
          const urgentAmount = items.reduce((acc, it) => {
            const afterDisc = it.qty * it.unit_price_snapshot * (1 - Math.min(100, Math.max(0, it.discount_pct)) / 100)
            return acc + (it.urgent ? afterDisc * (urgentMarkupPct / 100) : 0)
          }, 0)

          // Calculeaza discount-urile
          const subscriptionDiscountAmount = hasSubscription && subscriptionDiscount 
            ? (subtotal - totalDiscount + urgentAmount) * (Number(subscriptionDiscount) / 100)
            : 0

          const total = subtotal - totalDiscount + urgentAmount - subscriptionDiscountAmount

          return {
            quote,
            items,
            subtotal,
            totalDiscount,
            urgentAmount,
            total,
            hasSubscription: hasSubscription && subscriptionDiscount ? true : false,
            subscriptionDiscount: hasSubscription && subscriptionDiscount ? Number(subscriptionDiscount) : undefined,
            isCash: (quote as any).is_cash || false,
            isCard: (quote as any).is_card || false,
          }
        })
      )

      setSheetsData(sheets)
      setLoading(false)
    }

    loadAllSheetsData()
  }, [quotes, hasSubscription, subscriptionDiscount, urgentMarkupPct])

  if (loading) return null

  return (
    <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '210mm' }}>
      <PrintView
        lead={lead}
        sheets={sheetsData}
        allSheetsTotal={allSheetsTotal}
        urgentMarkupPct={urgentMarkupPct}
      />
    </div>
  )
}

export default function Preturi({ leadId, lead }: { leadId: string; lead?: Lead | null }) {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  // sheets (tavite)
  const [quotes, setQuotes] = useState<LeadQuote[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const selectedQuote = useMemo(
    () => quotes.find(q => q.id === selectedQuoteId) ?? null,
    [quotes, selectedQuoteId]
  );

  // Total across all sheets
  const [allSheetsTotal, setAllSheetsTotal] = useState<number>(0);  const [items, setItems] = useState<LeadQuoteItem[]>([]);

  const [pipelines, setPipelines] = useState<string[]>([])
  const [pipeLoading, setPipeLoading] = useState(true)

  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [parts, setParts] = useState<Part[]>([])

  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  
  // State pentru checkbox cash/card
  const [isCash, setIsCash] = useState(false)
  const [isCard, setIsCard] = useState(false)

  // State pentru Buy Back
  const [buyBack, setBuyBack] = useState(false)

  // State pentru abonament
  const [hasSubscription, setHasSubscription] = useState(false)
  const [subscriptionDiscount, setSubscriptionDiscount] = useState<'5' | '10' | ''>('')

  const tempId = () => `local_${Math.random().toString(36).slice(2, 10)}`

  // Add-service form state
  const [svc, setSvc] = useState({
    instrumentId: '',
    id: '',
    qty: '1',
    discount: '0',
    urgent: false,
    technicianId: '',
    department: '' 
  })

  // Extrage instrumentele unice din servicii
  const instruments = useMemo(() => {
    const instrumentSet = new Set<string>()
    services.forEach(s => {
      if (s.instrument && s.instrument.trim()) {
        instrumentSet.add(s.instrument.trim())
      }
    })
    return Array.from(instrumentSet).sort((a, b) => a.localeCompare(b, 'ro'))
  }, [services])

  // Add-part form state
  const [part, setPart] = useState({
    id: '',            
    overridePrice: '', 
    qty: '1',
    discount: '0',
    urgent: false,
    department:''
  })

  const lastSavedRef = useRef<any[]>([])
  const [urgentTagId, setUrgentTagId] = useState<string | null>(null)

  // gaseste tag-ul urgent la incarcare
  useEffect(() => {
    (async () => {
      const tags = await listTags()
      const urgentTag = tags.find(t => t.name.toLowerCase() === 'urgent')
      if (urgentTag) {
        setUrgentTagId(urgentTag.id)
      }
    })()
  }, [])

  // verifica si atribuie/elimina tag-ul urgent cand se schimba items-urile
  useEffect(() => {
    if (!urgentTagId || !items.length) return

    const hasUrgentItems = items.some(item => item.urgent === true)
    
    // verifica daca tag-ul urgent este deja atribuit
    const checkAndToggleUrgentTag = async () => {
      try {
        // verifica daca tag-ul este atribuit
        const { data: existing } = await supabase
          .from('lead_tags')
          .select('lead_id')
          .eq('lead_id', leadId)
          .eq('tag_id', urgentTagId)
          .maybeSingle()

        if (hasUrgentItems && !existing) {
          // exista items urgente dar tag-ul nu este atribuit - atribuie-l
          await toggleLeadTag(leadId, urgentTagId)
        } else if (!hasUrgentItems && existing) {
          // nu exista items urgente dar tag-ul este atribuit - elimina-l
          await toggleLeadTag(leadId, urgentTagId)
        }
      } catch (error) {
        console.error('Eroare la gestionarea tag-ului urgent:', error)
      }
    }

    checkAndToggleUrgentTag()
  }, [items, urgentTagId, leadId])

  async function refreshPipelines() {
    setPipeLoading(true)
    try {
      const { data, error } = await supabase
        .from('pipelines')
        .select('name,is_active,position')
        .eq('is_active', true)
        .order('position', { ascending: true })
      if (error) throw error
      setPipelines((data ?? []).map((r: any) => r.name))
    } finally { setPipeLoading(false) }
  }

  function computeItemsTotal(sheetItems: LeadQuoteItem[]) {
    const subtotal = sheetItems.reduce((acc, it) => acc + it.qty * it.unit_price_snapshot, 0);
    const totalDiscount = sheetItems.reduce(
      (acc, it) => acc + it.qty * it.unit_price_snapshot * (Math.min(100, Math.max(0, it.discount_pct)) / 100),
      0
    );
    const urgentAmount = sheetItems.reduce((acc, it) => {
      const afterDisc = it.qty * it.unit_price_snapshot * (1 - Math.min(100, Math.max(0, it.discount_pct)) / 100);
      return acc + (it.urgent ? afterDisc * (URGENT_MARKUP_PCT / 100) : 0);
    }, 0);
    return subtotal - totalDiscount + urgentAmount;
  }
  
  async function recalcAllSheetsTotal(forQuotes: LeadQuote[]) {
    if (!forQuotes.length) { setAllSheetsTotal(0); return; }
    const all = await Promise.all(forQuotes.map(q => listQuoteItems(q.id)));
    const sum = all.reduce((acc, sheet) => acc + computeItemsTotal(sheet ?? []), 0);
    setAllSheetsTotal(sum);
  }

  async function saveAllAndLog() {
    if (!selectedQuote) return
    setSaving(true)
    try {
      // salveaza cash/card in baza de date
      await updateQuote(selectedQuote.id, {
        is_cash: isCash,
        is_card: isCard,
      } as any)
      
      const { items: fresh, snapshot } = await persistAndLogServiceSheet({
        leadId,
        quoteId: selectedQuote.id,
        items,
        services,
        totals: { subtotal, totalDiscount, urgentAmount, total },
        prevSnapshot: lastSavedRef.current as any,
      })
      setItems(fresh)
      lastSavedRef.current = snapshot
      setIsDirty(false);
      await recalcAllSheetsTotal(quotes);
      
      // invalideaza cache-ul pentru totalul lead-ului
      // astfel lead-card va recalcula automat prin real-time subscription
      invalidateLeadTotalCache(leadId)
    } finally {
      setSaving(false)
    }
  }
  
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [svcList, techList, partList] = await Promise.all([
          listServices(),
          listTechnicians(),
          listParts(),
        ]);
        setServices(svcList);
        setTechnicians(techList);
        setParts(partList);
        await refreshPipelines();
      
        // Load or create first sheet
        let qs = await listQuotesForLead(leadId);
        if (!qs.length) {
          const created = await createQuoteForLead(leadId); // auto: "Tablita 1 {leadId}"
          qs = [created];
        }
        setQuotes(qs);
        const firstId = qs[0].id;
        setSelectedQuoteId(firstId);
        
        // Load cash/card values from quote
        const firstQuote = qs[0] as any
        if (firstQuote) {
          setIsCash(firstQuote.is_cash || false)
          setIsCard(firstQuote.is_card || false)
        }
      
        // Load items for selected sheet
        const qi = await listQuoteItems(firstId);
        setItems(qi ?? []);
        lastSavedRef.current = (qi ?? []).map((i: any) => ({
          id: i.id ?? `${i.name_snapshot}:${i.item_type}`,
          name: i.name_snapshot,
          qty: i.qty,
          price: i.unit_price_snapshot,
          type: i.item_type,
          urgent: !!i.urgent,
          department: i.department ?? null,
          technician: i.technician ?? null,
        }));

        // Pre-selectează instrumentul dacă există deja servicii în tăviță
        const serviceItems = (qi ?? []).filter((item: any) => item.item_type === 'service')
        if (serviceItems.length > 0 && serviceItems[0].service_id) {
          const firstServiceDef = svcList.find(s => s.id === serviceItems[0].service_id)
          if (firstServiceDef?.instrument) {
            setSvc(prev => ({ ...prev, instrumentId: firstServiceDef.instrument! }))
          }
        }
      
        // Compute global total
        await recalcAllSheetsTotal(qs);
      } finally {
        setLoading(false);
      }
    })();

    // Real-time subscription pentru actualizare automata a totalului
    // cand se modifica items-urile in orice tăviță a acestui lead
    const channel = supabase
      .channel(`preturi-total-${leadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_quote_items',
        },
        async (payload) => {
          // Verifica daca item-ul apartine unui quote al acestui lead
          const payloadNew = payload.new as any
          const payloadOld = payload.old as any
          const quoteId = payloadNew?.quote_id || payloadOld?.quote_id
          
          if (quoteId) {
            // Verifica daca quote-ul apartine acestui lead
            const { data: quote } = await supabase
              .from('lead_quotes')
              .select('lead_id')
              .eq('id', quoteId)
              .single()
            
            if (quote && (quote as any).lead_id === leadId) {
              // Recalculeaza totalul pentru toate tăvițele
              const currentQuotes = await listQuotesForLead(leadId)
              await recalcAllSheetsTotal(currentQuotes)
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_quotes',
          filter: `lead_id=eq.${leadId}`,
        },
        async (payload) => {
          // Cand se modifica un quote (is_cash, is_card, sau se adauga/sterge tăviță)
          const payloadNew = payload.new as any
          const payloadOld = payload.old as any
          const quoteId = payloadNew?.id || payloadOld?.id
          
          // Daca se modifica quote-ul curent, actualizeaza checkbox-urile
          if (quoteId === selectedQuoteId && payloadNew) {
            setIsCash(payloadNew.is_cash || false)
            setIsCard(payloadNew.is_card || false)
          }
          
          // Reincarca quotes-urile pentru a avea date actualizate
          const currentQuotes = await listQuotesForLead(leadId)
          setQuotes(currentQuotes)
          
          // Daca quote-ul curent s-a schimbat, actualizeaza checkbox-urile
          if (selectedQuoteId) {
            const updatedQuote = currentQuotes.find(q => q.id === selectedQuoteId) as any
            if (updatedQuote) {
              setIsCash(updatedQuote.is_cash || false)
              setIsCard(updatedQuote.is_card || false)
            }
          }
          
          // Recalculeaza totalul
          await recalcAllSheetsTotal(currentQuotes)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [leadId]);

  // ----- Totals (per-line discount & urgent only) -----
  const subtotal = useMemo(
    () => items.reduce((acc, it) => acc + it.qty * it.unit_price_snapshot, 0),
    [items]
  );
  const totalDiscount = useMemo(
    () =>
      items.reduce(
        (acc, it) => acc + it.qty * it.unit_price_snapshot * (Math.min(100, Math.max(0, it.discount_pct)) / 100),
        0
      ),
    [items]
  );
  const urgentAmount = useMemo(
    () =>
      items.reduce((acc, it) => {
        const afterDisc = it.qty * it.unit_price_snapshot * (1 - Math.min(100, Math.max(0, it.discount_pct)) / 100);
        return acc + (it.urgent ? afterDisc * (URGENT_MARKUP_PCT / 100) : 0);
      }, 0),
    [items]
  );
  // Calcul discount abonament
  const subscriptionDiscountAmount = useMemo(() => {
    if (!hasSubscription || !subscriptionDiscount) return 0
    const discountPct = Number(subscriptionDiscount)
    const baseForDiscount = subtotal - totalDiscount + urgentAmount
    return baseForDiscount * (discountPct / 100)
  }, [hasSubscription, subscriptionDiscount, subtotal, totalDiscount, urgentAmount])

  const total = useMemo(() => {
    const baseTotal = subtotal - totalDiscount + urgentAmount
    return baseTotal - subscriptionDiscountAmount
  }, [subtotal, totalDiscount, urgentAmount, subscriptionDiscountAmount]);

  // ----- Add rows -----
  function onAddService() {
    if (!selectedQuote || !svc.id) return
    const svcDef = services.find(s => s.id === svc.id)
    if (!svcDef) return
  
    const qty = Math.max(1, Number(svc.qty || 1))
    const discount = Math.min(100, Math.max(0, Number(svc.discount || 0)))
    const techName = svc.technicianId
      ? (technicians.find(t => t.id === svc.technicianId)?.name ?? '')
      : ''
  
    // ⬇️ push a local row (no DB write)
    setItems(prev => [
      ...prev,
      {
        id: tempId(),
        item_type: 'service',
        service_id: svcDef.id,
        name_snapshot: svcDef.name,
        unit_price_snapshot: Number(svcDef.base_price),
        qty,
        discount_pct: discount,
        urgent: !!svc.urgent,
        technician: techName || null,
        department: svc.department || null,
      } as unknown as LeadQuoteItem
    ])
    // Păstrăm instrumentul selectat pentru a adăuga mai multe servicii pentru același instrument
    setSvc(prev => ({ ...prev, id: '', qty: '1', discount: '0', urgent: false, technicianId: '', department: '' }))
    setIsDirty(true)
  }

  function onAddPart(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedQuote || !part.id) return
  
    const partDef = parts.find(p => p.id === part.id)
    if (!partDef) return
  
    const unit = part.overridePrice !== '' ? Number(part.overridePrice) : Number(partDef.base_price)
    if (isNaN(unit) || unit < 0) return
  
    const qty = Math.max(1, Number(part.qty || 1))
    const discount = Math.min(100, Math.max(0, Number(part.discount || 0)))
  
    // ⬇️ push a local row (no DB write)
    setItems(prev => [
      ...prev,
      {
        id: tempId(),
        item_type: 'part',
        name_snapshot: partDef.name,
        unit_price_snapshot: unit,
        qty,
        discount_pct: discount,
        urgent: !!part.urgent,
        department: part.department || null,
        technician: null,
      } as unknown as LeadQuoteItem
    ])
  
    setPart({ id: '', overridePrice: '', qty: '1', discount: '0', urgent: false, department:'' })
    setIsDirty(true)
  }

  // ----- Inline updates -----
  function onUpdateItem(id: string, patch: Partial<LeadQuoteItem>) {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } as any : it)))
    setIsDirty(true)
  }

  function onDelete(id: string) {
    setItems(prev => {
      const newItems = prev.filter(it => it.id !== id)
      // Resetează instrumentul dacă nu mai există servicii
      const remainingServices = newItems.filter(it => it.item_type === 'service')
      if (remainingServices.length === 0) {
        setSvc(p => ({ ...p, instrumentId: '' }))
      }
      return newItems
    })
    setIsDirty(true)
  }

  async function onChangeSheet(newId: string) {
    if (!newId || newId === selectedQuoteId) return;
    setLoading(true);
    try {
      // incarca valorile cash/card pentru noua tavita
      const newQuote = quotes.find(q => q.id === newId) as any
      if (newQuote) {
        setIsCash(newQuote.is_cash || false)
        setIsCard(newQuote.is_card || false)
      }
      setSelectedQuoteId(newId);
      const qi = await listQuoteItems(newId);
      setItems(qi ?? []);
      lastSavedRef.current = (qi ?? []).map((i: any) => ({
        id: i.id ?? `${i.name_snapshot}:${i.item_type}`,
        name: i.name_snapshot,
        qty: i.qty,
        price: i.unit_price_snapshot,
        type: i.item_type,
        urgent: !!i.urgent,
        department: i.department ?? null,
        technician: i.technician ?? null,
      }));

      // Pre-selectează instrumentul dacă există deja servicii în tăviță
      const serviceItems = (qi ?? []).filter((item: any) => item.item_type === 'service')
      if (serviceItems.length > 0 && serviceItems[0].service_id) {
        const firstServiceDef = services.find(s => s.id === serviceItems[0].service_id)
        if (firstServiceDef?.instrument) {
          setSvc(prev => ({ ...prev, instrumentId: firstServiceDef.instrument! }))
        } else {
          setSvc(prev => ({ ...prev, instrumentId: '' }))
        }
      } else {
        // Resetează instrumentul dacă nu există servicii
        setSvc(prev => ({ ...prev, instrumentId: '' }))
      }
    } finally {
      setLoading(false);
    }
  }
  
  async function onAddSheet() {
    setLoading(true);
    try {
      const created = await createQuoteForLead(leadId);
      const next = [...quotes, created].sort((a, b) => a.sheet_index - b.sheet_index);
      setQuotes(next);
      setSelectedQuoteId(created.id);
      setItems([]);
      lastSavedRef.current = [];
      await recalcAllSheetsTotal(next);
    } finally {
      setLoading(false);
    }
  }

  // Verifică dacă există servicii în tăvița curentă
  const hasServicesInSheet = items.some(it => it.item_type === 'service')

  if (loading || !selectedQuote) return <Card className="p-2">Se încarcă…</Card>;

  return (
    <Card className="p-0 space-y-4">
      <div className="flex items-center justify-between px-3 pt-3">
        <div className="flex flex-col items-start gap-2">
          <h3 className="font-medium text-sm">Fișa de serviciu</h3>
          <div className="flex gap-3 items-center">
            <Label className="text-sm text-muted-foreground">Tăviță</Label>
            <select
              className="h-9 rounded-md border px-2"
              value={selectedQuoteId ?? ''}
              onChange={e => onChangeSheet(e.target.value)}
            >
              {quotes.map(q => (
                <option key={q.id} value={q.id}>{`Tăviță ${q.sheet_index}`}</option>
              ))}
            </select>
            <Button size="sm" variant="secondary" onClick={onAddSheet}>
              <Plus className="h-4 w-4 mr-1" /> Nouă
            </Button>
          </div>
        </div>

        <Button className="cursor-pointer" size="sm" onClick={saveAllAndLog} disabled={loading || saving || !isDirty}>
          {saving ? "Se salvează…" : "Salvează în Istoric"}
        </Button>
      </div>
      {/* Add Service - Redesigned */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg border border-blue-200 dark:border-blue-800 mx-2 p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Adaugă Serviciu</span>
          </div>
          <Button size="sm" onClick={onAddService} disabled={!svc.id} className="h-7">
            <Plus className="h-3 w-3 mr-1" /> Adaugă
          </Button>
        </div>
        
        <div className="grid grid-cols-12 gap-3">
          {/* Instrument - 3 cols */}
          <div className="col-span-3">
            <Label className="text-xs text-muted-foreground mb-1 block">Instrument</Label>
            <select
              className="w-full h-8 text-sm rounded-md border px-2 bg-white dark:bg-background disabled:opacity-50 disabled:cursor-not-allowed"
              value={svc.instrumentId}
              onChange={e => setSvc(s => ({ ...s, instrumentId: e.target.value, id: '' }))}
              disabled={hasServicesInSheet}
              title={hasServicesInSheet ? "Instrumentul este blocat - există deja servicii în tăviță" : "Selectează instrument"}
            >
              <option value="">— selectează —</option>
              {instruments.map(inst => (
                <option key={inst} value={inst}>{inst}</option>
              ))}
            </select>
          </div>
          
          {/* Serviciu - 4 cols */}
          <div className="col-span-4">
            <Label className="text-xs text-muted-foreground mb-1 block">Serviciu</Label>
            <select
              className="w-full h-8 text-sm rounded-md border px-2 bg-white dark:bg-background"
              value={svc.id}
              onChange={e => setSvc(s => ({ ...s, id: e.target.value }))}
              disabled={!svc.instrumentId}
            >
              <option value="">— selectează —</option>
              {services
                .filter(s => s.instrument === svc.instrumentId)
                .map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.base_price.toFixed(2)} RON
                  </option>
                ))}
            </select>
          </div>

          {/* Cant - 1 col */}
          <div className="col-span-1">
            <Label className="text-xs text-muted-foreground mb-1 block">Cant.</Label>
            <Input
              className="h-8 text-sm text-center"
              inputMode="numeric"
              value={svc.qty}
              onChange={e => setSvc(s => ({ ...s, qty: e.target.value }))}
              placeholder="1"
            />
          </div>

          {/* Disc - 1 col */}
          <div className="col-span-1">
            <Label className="text-xs text-muted-foreground mb-1 block">Disc%</Label>
            <Input
              className="h-8 text-sm text-center"
              inputMode="decimal"
              value={svc.discount}
              onChange={e => setSvc(s => ({ ...s, discount: e.target.value }))}
              placeholder="0"
            />
          </div>

          {/* Urgent - 1 col */}
          <div className="col-span-1 flex flex-col justify-end">
            <div className="flex items-center gap-1 h-8">
              <Checkbox
                id="svc-urgent"
                checked={svc.urgent}
                onCheckedChange={(c: any) => setSvc(s => ({ ...s, urgent: !!c }))}
              />
              <Label htmlFor="svc-urgent" className="text-xs cursor-pointer">Urgent</Label>
            </div>
          </div>
        </div>

        {/* Second row - Departament și Tehnician */}
        <div className="grid grid-cols-12 gap-3 mt-2">
          <div className="col-span-4">
            <Label className="text-xs text-muted-foreground mb-1 block">Departament</Label>
            <select
              className="w-full h-8 text-sm rounded-md border px-2 bg-white dark:bg-background"
              value={svc.department}
              onChange={e => setSvc(s => ({ ...s, department: e.target.value }))}
              disabled={pipeLoading}
            >
              <option value="">— selectează —</option>
              {pipelines.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div className="col-span-4">
            <Label className="text-xs text-muted-foreground mb-1 block">Tehnician</Label>
            <select
              className="w-full h-8 text-sm rounded-md border px-2 bg-white dark:bg-background"
              value={svc.technicianId}
              onChange={e => setSvc(s => ({ ...s, technicianId: e.target.value }))}
            >
              <option value="">— selectează —</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Add Part - Redesigned */}
      <form onSubmit={onAddPart} className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border border-amber-200 dark:border-amber-800 mx-2 p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-900 dark:text-amber-100">Adaugă Piesă</span>
          </div>
          <Button type="submit" size="sm" className="h-7" disabled={!part.id}>
            <Plus className="h-3 w-3 mr-1" /> Adaugă
          </Button>
        </div>
        
        <div className="grid grid-cols-12 gap-3">
          {/* Piesă - 5 cols */}
          <div className="col-span-5">
            <Label className="text-xs text-muted-foreground mb-1 block">Piesă</Label>
            <select
              className="w-full h-8 text-sm rounded-md border px-2 bg-white dark:bg-background"
              value={part.id}
              onChange={e => setPart(p => ({ ...p, id: e.target.value, overridePrice: '' }))}
            >
              <option value="">— selectează —</option>
              {parts.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.base_price.toFixed(2)} RON
                </option>
              ))}
            </select>
          </div>
          
          {/* Preț - 2 cols */}
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground mb-1 block">Preț</Label>
            <Input
              className="h-8 text-sm"
              inputMode="decimal"
              value={part.overridePrice}
              onChange={e => setPart(p => ({ ...p, overridePrice: e.target.value }))}
              placeholder="catalog"
            />
          </div>

          {/* Cant - 1 col */}
          <div className="col-span-1">
            <Label className="text-xs text-muted-foreground mb-1 block">Cant.</Label>
            <Input
              className="h-8 text-sm text-center"
              inputMode="numeric"
              value={part.qty}
              onChange={e => setPart(p => ({ ...p, qty: e.target.value }))}
              placeholder="1"
            />
          </div>

          {/* Disc - 1 col */}
          <div className="col-span-1">
            <Label className="text-xs text-muted-foreground mb-1 block">Disc%</Label>
            <Input
              className="h-8 text-sm text-center"
              inputMode="decimal"
              value={part.discount}
              onChange={e => setPart(p => ({ ...p, discount: e.target.value }))}
              placeholder="0"
            />
          </div>

          {/* Urgent - 2 cols */}
          <div className="col-span-2 flex flex-col justify-end">
            <div className="flex items-center gap-1 h-8">
              <Checkbox
                id="part-urgent"
                checked={part.urgent}
                onCheckedChange={(c: any) => setPart(p => ({ ...p, urgent: !!c }))}
              />
              <Label htmlFor="part-urgent" className="text-xs cursor-pointer">Urgent (+{URGENT_MARKUP_PCT}%)</Label>
            </div>
          </div>
        </div>
      </form>

      {/* Items Table */}
      <Card className="p-0 mx-2 overflow-hidden">
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-24 text-xs font-semibold">Instrument</TableHead>
              <TableHead className="text-xs font-semibold">Serviciu</TableHead>
              <TableHead className="text-xs font-semibold">Piesă</TableHead>
              <TableHead className="w-16 text-xs font-semibold text-center">Cant.</TableHead>
              <TableHead className="w-24 text-xs font-semibold text-center">Preț</TableHead>
              <TableHead className="w-16 text-xs font-semibold text-center">Disc%</TableHead>
              <TableHead className="w-16 text-xs font-semibold text-center">Urgent</TableHead>
              <TableHead className="w-28 text-xs font-semibold">Departament</TableHead>
              <TableHead className="w-28 text-xs font-semibold">Tehnician</TableHead>
              <TableHead className="w-24 text-xs font-semibold text-right">Total</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(it => {
              const disc = Math.min(100, Math.max(0, it.discount_pct));
              const base = it.qty * it.unit_price_snapshot;
              const afterDisc = base * (1 - disc / 100);
              const lineTotal = it.urgent ? afterDisc * (1 + URGENT_MARKUP_PCT / 100) : afterDisc;

              // Găsește instrumentul pentru serviciu
              const itemInstrument = it.item_type === 'service' && it.service_id
                ? services.find(s => s.id === it.service_id)?.instrument || '—'
                : '—'

              // Determină ce să afișeze în coloanele Serviciu și Piesă
              const serviceName = it.item_type === 'service' ? it.name_snapshot : 'Schimb piesă'
              const partName = it.item_type === 'part' ? it.name_snapshot : null

              return (
                <TableRow key={it.id} className="hover:bg-muted/30">
                  <TableCell className="text-xs text-muted-foreground py-2">
                    {itemInstrument}
                  </TableCell>
                  <TableCell className="font-medium text-sm py-2">
                    {serviceName}
                  </TableCell>
                  <TableCell className="text-sm py-2">
                    {it.item_type === 'part' ? (
                      <Input
                        className="h-7 text-sm"
                        value={it.name_snapshot}
                        onChange={e => onUpdateItem(it.id, { name_snapshot: e.target.value })}
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="py-2">
                    <Input
                      className="h-7 text-sm text-center w-14"
                      inputMode="numeric"
                      value={String(it.qty)}
                      onChange={e => {
                        const v = Math.max(1, Number(e.target.value || 1));
                        onUpdateItem(it.id, { qty: v });
                      }}
                    />
                  </TableCell>

                  <TableCell className="py-2 text-center">
                    {it.item_type === 'service' ? (
                      <span className="text-sm">{it.unit_price_snapshot.toFixed(2)}</span>
                    ) : (
                      <Input
                        className="h-7 text-sm text-center w-20"
                        inputMode="decimal"
                        value={String(it.unit_price_snapshot)}
                        onChange={e => {
                          const v = Math.max(0, Number(e.target.value || 0));
                          onUpdateItem(it.id, { unit_price_snapshot: v });
                        }}
                      />
                    )}
                  </TableCell>

                  <TableCell className="py-2">
                    <Input
                      className="h-7 text-sm text-center w-12"
                      inputMode="decimal"
                      value={String(it.discount_pct)}
                      onChange={e => {
                        const v = Math.min(100, Math.max(0, Number(e.target.value || 0)));
                        onUpdateItem(it.id, { discount_pct: v });
                      }}
                    />
                  </TableCell>

                  <TableCell className="py-2 text-center">
                    <Checkbox
                      checked={!!it.urgent}
                      onCheckedChange={(c: any) => onUpdateItem(it.id, { urgent: !!c })}
                    />
                  </TableCell>

                  <TableCell className="py-2">
                    <select
                      className="w-full h-7 text-xs rounded border px-1 bg-white dark:bg-background"
                      value={it.department ?? ''}
                      onChange={e => onUpdateItem(it.id, { department: e.target.value || null })}
                      disabled={pipeLoading}
                    >
                      <option value="">—</option>
                      {pipelines.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </TableCell>

                  <TableCell className="py-2">
                    <select
                      className="w-full h-7 text-xs rounded border px-1 bg-white dark:bg-background"
                      value={technicians.find(t => t.name === (it.technician ?? ''))?.id ?? ''}
                      onChange={e => {
                        const tech = technicians.find(t => t.id === e.target.value)
                        onUpdateItem(it.id, { technician: tech ? tech.name : null })
                      }}
                    >
                      <option value="">—</option>
                      {technicians.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </TableCell>

                  <TableCell className="text-right font-medium text-sm py-2">{lineTotal.toFixed(2)}</TableCell>

                  <TableCell className="py-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(it.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}

            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-muted-foreground text-center py-6 text-sm">
                  Nu există poziții încă.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Totals */}
      <div className="flex justify-end px-2">
        <div className="w-full md:w-[320px] space-y-1 text-sm bg-muted/20 rounded-lg p-3">
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
          {hasSubscription && subscriptionDiscount && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Abonament (-{subscriptionDiscount}%)</span>
              <span className="text-green-600">-{subscriptionDiscountAmount.toFixed(2)} RON</span>
            </div>
          )}
          <div className="h-px bg-border my-2" />
          <div className="flex items-center justify-between font-semibold text-base">
            <span>Total</span>
            <span>{total.toFixed(2)} RON</span>
          </div>
          
          {/* Checkbox-uri pentru Abonament, Cash, Card, Buy back */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Checkbox
                id="subscription"
                checked={hasSubscription}
                onCheckedChange={(c: any) => {
                  setHasSubscription(!!c)
                  if (!c) setSubscriptionDiscount('')
                }}
              />
              <Label htmlFor="subscription" className="text-xs font-medium cursor-pointer">Abonament</Label>
              {hasSubscription && (
                <select
                  className="ml-auto h-6 rounded border px-1 text-xs"
                  value={subscriptionDiscount}
                  onChange={(e) => setSubscriptionDiscount(e.target.value as '5' | '10' | '')}
                >
                  <option value="">%</option>
                  <option value="5">-5%</option>
                  <option value="10">-10%</option>
                </select>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="payment-cash"
                  checked={isCash}
                  onCheckedChange={(c: any) => {
                    setIsCash(!!c)
                    if (!!c) setIsCard(false)
                    setIsDirty(true)
                  }}
                />
                <Label htmlFor="payment-cash" className="text-xs font-medium cursor-pointer">Cash</Label>
              </div>
              
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="payment-card"
                  checked={isCard}
                  onCheckedChange={(c: any) => {
                    setIsCard(!!c)
                    if (!!c) setIsCash(false)
                    setIsDirty(true)
                  }}
                />
                <Label htmlFor="payment-card" className="text-xs font-medium cursor-pointer">Card</Label>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Checkbox
                id="buy-back"
                checked={buyBack}
                onCheckedChange={(c: any) => setBuyBack(!!c)}
              />
              <Label htmlFor="buy-back" className="text-xs font-medium cursor-pointer">Buy back</Label>
            </div>
          </div>
          
          <div className="h-px bg-border my-2" />
          <div className="flex items-center justify-between font-medium text-primary">
            <span>Total toate tăvițele</span>
            <span className="font-bold">{allSheetsTotal.toFixed(2)} RON</span>
          </div>
        </div>
      </div>

      {/* PrintView - ascuns vizual, dar in DOM pentru print */}
      <div className="pb-2">
        {lead && <PrintViewData 
          lead={lead}
          quotes={quotes}
          allSheetsTotal={allSheetsTotal}
          urgentMarkupPct={URGENT_MARKUP_PCT}
          hasSubscription={hasSubscription}
          subscriptionDiscount={subscriptionDiscount}
        />}
      </div>
    </Card>
  );
}
