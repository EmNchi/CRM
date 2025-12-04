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
  subscriptionDiscount,
  hasSterilization
}: { 
  lead: Lead
  quotes: LeadQuote[]
  allSheetsTotal: number
  urgentMarkupPct: number
  hasSubscription: boolean
  subscriptionDiscount: string
  hasSterilization: boolean
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
          
          const sterilizationDiscountAmount = hasSterilization
            ? (subtotal - totalDiscount + urgentAmount - subscriptionDiscountAmount) * 0.1
            : 0

          const total = subtotal - totalDiscount + urgentAmount - subscriptionDiscountAmount - sterilizationDiscountAmount

          return {
            quote,
            items,
            subtotal,
            totalDiscount,
            urgentAmount,
            total,
            hasSubscription: hasSubscription && subscriptionDiscount ? true : false,
            subscriptionDiscount: hasSubscription && subscriptionDiscount ? Number(subscriptionDiscount) : undefined,
            hasSterilization,
            sterilizationDiscountAmount: hasSterilization ? sterilizationDiscountAmount : undefined,
            isCash: (quote as any).is_cash || false,
            isCard: (quote as any).is_card || false,
          }
        })
      )

      setSheetsData(sheets)
      setLoading(false)
    }

    loadAllSheetsData()
  }, [quotes, hasSubscription, subscriptionDiscount, hasSterilization, urgentMarkupPct])

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

  // State pentru Sterilizare
  const [hasSterilization, setHasSterilization] = useState(false)

  // State pentru abonament
  const [hasSubscription, setHasSubscription] = useState(false)
  const [subscriptionDiscount, setSubscriptionDiscount] = useState<'5' | '10' | ''>('')

  const tempId = () => `local_${Math.random().toString(36).slice(2, 10)}`

  // Add-service form state
  const [svc, setSvc] = useState({
    id: '',
    qty: '1',
    discount: '0',
    urgent: false,
    technicianId: '',
    department: '' 
  })

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

  // Calcul discount sterilizare (10%)
  const sterilizationDiscountAmount = useMemo(() => {
    if (!hasSterilization) return 0
    const baseForDiscount = subtotal - totalDiscount + urgentAmount - subscriptionDiscountAmount
    return baseForDiscount * 0.1 // 10%
  }, [hasSterilization, subtotal, totalDiscount, urgentAmount, subscriptionDiscountAmount])

  const total = useMemo(() => {
    const baseTotal = subtotal - totalDiscount + urgentAmount
    return baseTotal - subscriptionDiscountAmount - sterilizationDiscountAmount
  }, [subtotal, totalDiscount, urgentAmount, subscriptionDiscountAmount, sterilizationDiscountAmount]);

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
        name_snapshot: svcDef.name,
        unit_price_snapshot: Number(svcDef.base_price),
        qty,
        discount_pct: discount,
        urgent: !!svc.urgent,
        technician: techName || null,
        department: svc.department || null,
      } as unknown as LeadQuoteItem
    ])
    setSvc({ id: '', qty: '1', discount: '0', urgent: false, technicianId: '', department:'' })
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
    setItems(prev => prev.filter(it => it.id !== id))
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

  if (loading || !selectedQuote) return <Card className="p-4">Se încarcă…</Card>;

  return (
    <Card className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col items-start gap-3">
          <h3 className="font-medium">Fișa de serviciu</h3>
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
      {/* Add Service */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <div className="md:col-span-2">
          <Label>Serviciu</Label>
          <select
            className="w-full h-9 rounded-md border px-2"
            value={svc.id}
            onChange={e => setSvc(s => ({ ...s, id: e.target.value }))}
          >
            <option value="">— selectează —</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.base_price.toFixed(2)} RON
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>Cant.</Label>
          <Input
            inputMode="numeric"
            value={svc.qty}
            onChange={e => setSvc(s => ({ ...s, qty: e.target.value }))}
            placeholder="1"
          />
        </div>

        <div>
          <Label>Discount %</Label>
          <Input
            inputMode="decimal"
            value={svc.discount}
            onChange={e => setSvc(s => ({ ...s, discount: e.target.value }))}
            placeholder="0"
          />
        </div>

        <div className="flex items-end gap-2">
          <Checkbox
            id="svc-urgent"
            checked={svc.urgent}
            onCheckedChange={(c: any) => setSvc(s => ({ ...s, urgent: !!c }))}
          />
          <Label htmlFor="svc-urgent">Urgent (+{URGENT_MARKUP_PCT}%)</Label>
        </div>

        {/* Dept & Tech (service-only meta at add time) */}
        <div className="md:col-span-3">
          <Label>Departament (opțional)</Label>
          <select
            className="w-full h-9 rounded-md border px-2"
            value={svc.department}
            onChange={e => setSvc(s => ({ ...s, department: e.target.value }))}
            disabled={pipeLoading}
          >
            <option value="">— selectează —</option>
            {pipelines.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div className="md:col-span-3">
          <Label>Tehnician (opțional)</Label>
          <select
            className="w-full h-9 rounded-md border px-2"
            value={svc.technicianId}
            onChange={e => setSvc(s => ({ ...s, technicianId: e.target.value }))}
          >
            <option value="">— selectează tehnician —</option>
            {technicians.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <Button onClick={onAddService} disabled={!svc.id}>
            <Wrench className="h-4 w-4 mr-2" /> Adaugă serviciu
          </Button>
        </div>
      </div>

      {/* Add Part */}
      <form className="grid grid-cols-1 md:grid-cols-6 gap-3" onSubmit={onAddPart}>
      <div className="md:col-span-2">
        <Label>Piesă</Label>
        <select
          className="w-full h-9 rounded-md border px-2"
          value={part.id}
          onChange={e => setPart(p => ({ ...p, id: e.target.value, overridePrice: '' }))}
        >
          <option value="">— selectează piesă —</option>
          {parts.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.base_price.toFixed(2)} RON
            </option>
          ))}
        </select>
      </div>
      <div>
          <Label>Preț unitar</Label>
          <Input
            inputMode="decimal"
            value={part.overridePrice}
            onChange={e => setPart(p => ({ ...p, overridePrice: e.target.value }))}
            placeholder="lasă gol pt. preț catalog"
          />
        </div>
        <div>
          <Label>Cant.</Label>
          <Input
            inputMode="numeric"
            value={part.qty}
            onChange={e => setPart(p => ({ ...p, qty: e.target.value }))}
            placeholder="1"
          />
        </div>
        <div>
          <Label>Discount %</Label>
          <Input
            inputMode="decimal"
            value={part.discount}
            onChange={e => setPart(p => ({ ...p, discount: e.target.value }))}
            placeholder="0"
          />
        </div>
        <div className="flex items-end gap-2">
          <Checkbox
            id="part-urgent"
            checked={part.urgent}
            onCheckedChange={(c: any) => setPart(p => ({ ...p, urgent: !!c }))}
          />
          <Label htmlFor="part-urgent">Urgent (+{URGENT_MARKUP_PCT}%)</Label>
        </div>
        <div className="flex items-end">
          <Button type="submit">
            <Plus className="h-4 w-4 mr-2" /> Adaugă piesă
          </Button>
        </div>
      </form>

      {/* Items Table */}
      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Poziție</TableHead>
              <TableHead className="w-28">Cant.</TableHead>
              <TableHead className="w-36">Preț unitar</TableHead>
              <TableHead className="w-28">Disc %</TableHead>
              <TableHead className="w-24">Urgent</TableHead>
              <TableHead className="w-40">Departament</TableHead>
              <TableHead className="w-40">Technician</TableHead>
              <TableHead className="w-36 text-right">Total linie</TableHead>
              <TableHead className="w-12 text-right"></TableHead>
            </TableRow>
            <TableRow>
              <TableHead colSpan={9} className="bg-muted/50">
                <div className="flex items-center gap-4 py-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="subscription"
                      checked={hasSubscription}
                      onCheckedChange={(c: any) => {
                        setHasSubscription(!!c)
                        if (!c) setSubscriptionDiscount('')
                      }}
                    />
                    <Label htmlFor="subscription" className="text-sm font-medium cursor-pointer">
                      Abonament
                    </Label>
                    {hasSubscription && (
                      <select
                        className="ml-2 h-8 rounded-md border px-2 text-sm"
                        value={subscriptionDiscount}
                        onChange={(e) => setSubscriptionDiscount(e.target.value as '5' | '10' | '')}
                      >
                        <option value="">Selectează discount</option>
                        <option value="5">-5%</option>
                        <option value="10">-10%</option>
                      </select>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="payment-cash"
                      checked={isCash}
                      onCheckedChange={(c: any) => {
                        setIsCash(!!c)
                        if (!!c) setIsCard(false)
                        setIsDirty(true) // activeaza butonul de salvare
                      }}
                    />
                    <Label htmlFor="payment-cash" className="text-sm font-medium cursor-pointer">
                      Cash
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="payment-card"
                      checked={isCard}
                      onCheckedChange={(c: any) => {
                        setIsCard(!!c)
                        if (!!c) setIsCash(false)
                        setIsDirty(true) // activeaza butonul de salvare
                      }}
                    />
                    <Label htmlFor="payment-card" className="text-sm font-medium cursor-pointer">
                      Card
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="buy-back"
                      checked={buyBack}
                      onCheckedChange={(c: any) => setBuyBack(!!c)}
                    />
                    <Label htmlFor="buy-back" className="text-sm font-medium cursor-pointer">
                      Buy back
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="sterilization"
                      checked={hasSterilization}
                      onCheckedChange={(c: any) => setHasSterilization(!!c)}
                    />
                    <Label htmlFor="sterilization" className="text-sm font-medium cursor-pointer">
                      Sterilizare (-10%)
                    </Label>
                  </div>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(it => {
              const disc = Math.min(100, Math.max(0, it.discount_pct));
              const base = it.qty * it.unit_price_snapshot;
              const afterDisc = base * (1 - disc / 100);
              const lineTotal = it.urgent ? afterDisc * (1 + URGENT_MARKUP_PCT / 100) : afterDisc;

              return (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">
                    {it.item_type === 'service' ? (
                      it.name_snapshot
                    ) : (
                      <Input
                        value={it.name_snapshot}
                        onChange={e => onUpdateItem(it.id, { name_snapshot: e.target.value })}
                      />
                    )}
                  </TableCell>

                  <TableCell>
                    <Input
                      inputMode="numeric"
                      value={String(it.qty)}
                      onChange={e => {
                        const v = Math.max(1, Number(e.target.value || 1));
                        onUpdateItem(it.id, { qty: v });
                      }}
                    />
                  </TableCell>

                  <TableCell>
                    {it.item_type === 'service' ? (
                      <span>{it.unit_price_snapshot.toFixed(2)}</span>
                    ) : (
                      <Input
                        inputMode="decimal"
                        value={String(it.unit_price_snapshot)}
                        onChange={e => {
                          const v = Math.max(0, Number(e.target.value || 0));
                          onUpdateItem(it.id, { unit_price_snapshot: v });
                        }}
                      />
                    )}
                  </TableCell>

                  <TableCell>
                    <Input
                      inputMode="decimal"
                      value={String(it.discount_pct)}
                      onChange={e => {
                        const v = Math.min(100, Math.max(0, Number(e.target.value || 0)));
                        onUpdateItem(it.id, { discount_pct: v });
                      }}
                    />
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={!!it.urgent}
                        onCheckedChange={(c: any) => onUpdateItem(it.id, { urgent: !!c })}
                      />
                      <span className="text-xs text-muted-foreground">+{URGENT_MARKUP_PCT}%</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <select
                      className="w-full h-9 rounded-md border px-2"
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

                  <TableCell>
                    {it.item_type === 'service' ? (
                      <select
                        className="w-full h-9 rounded-md border px-2"
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
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right font-medium">{lineTotal.toFixed(2)} RON</TableCell>

                  <TableCell className="text-right">
                    <Button variant="destructive" size="icon" onClick={() => onDelete(it.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}

            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground">
                  Nu există poziții încă.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Totals */}
      <div className="ml-auto w-full md:w-[480px] space-y-1">
        <div className="flex items-center justify-between">
          <span>Subtotal</span>
          <span>{subtotal.toFixed(2)} RON</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Discount total</span>
          <span>-{totalDiscount.toFixed(2)} RON</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Urgent (+{URGENT_MARKUP_PCT}% pe linii marcate)</span>
          <span>{urgentAmount.toFixed(2)} RON</span>
        </div>
        {hasSubscription && subscriptionDiscount && (
          <div className="flex items-center justify-between">
            <span>Abonament (-{subscriptionDiscount}%)</span>
            <span className="text-green-600">-{subscriptionDiscountAmount.toFixed(2)} RON</span>
          </div>
        )}
        {hasSterilization && (
          <div className="flex items-center justify-between">
            <span>Sterilizare (-10%)</span>
            <span className="text-green-600">-{sterilizationDiscountAmount.toFixed(2)} RON</span>
          </div>
        )}
        <div className="h-px bg-border my-2" />
        <div className="flex items-center justify-between text-lg font-semibold">
          <span>Total</span>
          <span>{total.toFixed(2)} RON</span>
        </div>
      </div>

      <div className="ml-auto w-full md:w-[480px] mt-3 p-3 rounded-md border flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 ml-auto">
          <span className="font-medium">Total toate tăvițele</span>
          <span className="font-semibold">{allSheetsTotal.toFixed(2)} RON</span>
        </div>
      </div>

      {/* PrintView - ascuns vizual, dar in DOM pentru print */}
      {lead && <PrintViewData 
        lead={lead}
        quotes={quotes}
        allSheetsTotal={allSheetsTotal}
        urgentMarkupPct={URGENT_MARKUP_PCT}
        hasSubscription={hasSubscription}
        subscriptionDiscount={subscriptionDiscount}
        hasSterilization={hasSterilization}
      />}
    </Card>
  );
}
