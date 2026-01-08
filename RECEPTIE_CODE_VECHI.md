# Cod Receptie din Proiectul Vechi

## 1. Componenta Preturi (components/preturi.tsx)

Această componentă este folosită pentru toate pipeline-urile, inclusiv Receptie. Nu există un component separat pentru Receptie.

```typescript
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
  deleteQuote,
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
import { extractInstrumentsFromServices, type Instrument } from '@/lib/supabase/instrumentOperations'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
const supabase = supabaseBrowser()
import { persistAndLogServiceSheet } from "@/lib/history/serviceSheet"
import { invalidateLeadTotalCache } from "@/lib/supabase/leadTotals"
import { listTags, toggleLeadTag } from '@/lib/supabase/tagOperations'
import { PrintView } from '@/components/print-view'
import type { Lead } from '@/app/page'

const URGENT_MARKUP_PCT = 30; // +30% per line if urgent

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
  const [allSheetsTotal, setAllSheetsTotal] = useState<number>(0);
  const [items, setItems] = useState<LeadQuoteItem[]>([]);

  const [pipelines, setPipelines] = useState<string[]>([])
  const [pipeLoading, setPipeLoading] = useState(true)

  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [parts, setParts] = useState<Part[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])

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
    instrumentId: '',
    id: '',
    price: '',
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
    
    // IMPORTANT: Salvează instrumentul selectat înainte de orice operațiune
    // pentru a-l restaura după salvare
    const instrumentBeforeSave = svc.instrumentId
    
    try {
      // salveaza cash/card in baza de date DOAR pentru tăvița selectată
      // Asigură-te că se salvează doar pentru tăvița curentă, nu pentru toate
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
      
      // Reîncarcă quotes-urile pentru a avea datele actualizate pentru print
      const updatedQuotes = await listQuotesForLead(leadId)
      setQuotes(updatedQuotes)
      
      await recalcAllSheetsTotal(updatedQuotes);
      
      // invalideaza cache-ul pentru totalul lead-ului
      // astfel lead-card va recalcula automat prin real-time subscription
      invalidateLeadTotalCache(leadId)
      
      // IMPORTANT: Restaurează instrumentul selectat după salvare
      // Aceasta previne resetarea instrumentului de către re-render sau real-time subscriptions
      if (instrumentBeforeSave) {
        setSvc(prev => ({ ...prev, instrumentId: instrumentBeforeSave }))
      }
    } finally {
      setSaving(false)
    }
  }
  
  // Ref pentru a accesa selectedQuoteId în real-time callbacks fără a declanșa re-renderuri
  const selectedQuoteIdRef = useRef<string | null>(null);
  
  // Actualizează ref-ul când selectedQuoteId se schimbă
  useEffect(() => {
    selectedQuoteIdRef.current = selectedQuoteId;
  }, [selectedQuoteId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // OPTIMIZARE: Încarcă serviciile o singură dată și extrage instrumentele din ele
        const [svcList, techList, partList] = await Promise.all([
          listServices(),
          listTechnicians(),
          listParts(),
        ]);
        setServices(svcList);
        setTechnicians(techList);
        setParts(partList);
        // Extrage instrumentele din serviciile deja încărcate (evită query redundant)
        setInstruments(extractInstrumentsFromServices(svcList));
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
          discount_pct: i.discount_pct ?? 0,  // ADĂUGAT: salvează discount-ul
          type: i.item_type,
          urgent: !!i.urgent,
          department: i.department ?? null,
          technician: i.technician ?? null,
        }));
        
        // Pre-selectează instrumentul dacă există servicii în tăviță
        const loadedItems = qi ?? []
        const serviceItems = loadedItems.filter((item: any) => item.item_type === 'service')
        
        if (serviceItems.length > 0) {
          // Folosește primul serviciu (cel mai recent după sortare DESC)
          const firstService = serviceItems[0]
          if (firstService.service_id) {
            const firstServiceDef = svcList.find(s => s.id === firstService.service_id)
            if (firstServiceDef?.instrument && firstServiceDef.instrument.trim()) {
              // Pre-selectează instrumentul din serviciul existent
              setSvc(prev => ({ ...prev, instrumentId: firstServiceDef.instrument!.trim() }))
            }
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
            // Folosim un query direct pentru a evita dependențe circulare
            const { data: quote } = await supabase
              .from('lead_quotes')
              .select('lead_id')
              .eq('id', quoteId)
              .single()
            
            if (quote && (quote as any).lead_id === leadId) {
              // Recalculeaza totalul pentru toate tăvițele
              // Folosim setQuotes cu callback pentru a accesa valoarea curentă
              setQuotes(prevQuotes => {
                recalcAllSheetsTotal(prevQuotes).catch(console.error)
                return prevQuotes
              })
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
          const eventType = payload.eventType
          
          // Pentru DELETE, doar recalculează totalul fără a reîncărca toate quotes-urile
          if (eventType === 'DELETE') {
            setQuotes(prevQuotes => {
              const currentQuotes = prevQuotes.filter(q => q.id !== quoteId)
              recalcAllSheetsTotal(currentQuotes).catch(console.error)
              return currentQuotes
            })
            return
          }
          
          // Pentru INSERT sau UPDATE, reîncarcă quotes-urile
          const currentQuotes = await listQuotesForLead(leadId)
          setQuotes(currentQuotes)
          
          // Actualizeaza checkbox-urile DOAR pentru tăvița curent selectată
          // Folosim ref pentru a accesa valoarea curentă fără a declanșa re-render
          const currentSelectedQuoteId = selectedQuoteIdRef.current
          if (currentSelectedQuoteId && quoteId === currentSelectedQuoteId) {
            const updatedQuote = currentQuotes.find(q => q.id === currentSelectedQuoteId) as any
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
  }, [leadId]); // IMPORTANT: Doar leadId - NU selectedQuoteId pentru a evita re-încărcarea completă

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
  async function onAddService() {
    // Dacă nu există tăviță, creează una automat
    if (!selectedQuote) {
      await onAddSheet()
      // După crearea tăviței, continuă cu adăugarea serviciului
      if (!selectedQuoteId) return
    }
    
    if (!selectedQuote || !svc.id) return
    const svcDef = services.find(s => s.id === svc.id)
    if (!svcDef) return

    // Verifică instrumentul serviciului selectat
    // IMPORTANT: Folosește instrumentul din serviciu dacă există, altfel folosește instrumentul selectat manual
    const serviceInstrument = svcDef.instrument ? svcDef.instrument.trim() : (svc.instrumentId ? svc.instrumentId.trim() : '')
    
    // Verifică dacă există deja servicii în tăvița curentă
    const currentQuoteItems = items.filter(item => item.item_type === 'service')
    const hasExistingServices = currentQuoteItems.length > 0
    
    // Dacă există servicii, verifică instrumentul primului serviciu
    if (hasExistingServices) {
      const firstService = currentQuoteItems[0]
      const firstServiceDef = services.find(s => s.id === firstService.service_id)
      const firstServiceInstrument = firstServiceDef?.instrument || ''
      
      // Dacă instrumentul este diferit, creează o nouă tăviță
      if (firstServiceInstrument && serviceInstrument && firstServiceInstrument !== serviceInstrument) {
        await onAddSheet()
        // După crearea noii tăvițe, continuă cu adăugarea serviciului
        if (!selectedQuoteId) return
      }
    } else {
      // Dacă nu există servicii (toate au fost șterse), permite schimbarea instrumentului
      // Nu mai fixa instrumentul, permite utilizatorului să selecteze unul nou
    }
  
    const qty = Math.max(1, Number(svc.qty || 1))
    const discount = Math.min(100, Math.max(0, Number(svc.discount || 0)))
    // Folosește prețul din dropdown sau base_price dacă nu e setat
    const price = svc.price ? Number(svc.price) : svcDef.base_price
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
        unit_price_snapshot: price,
        qty,
        discount_pct: discount,
        urgent: !!svc.urgent,
        technician: techName || null,
        department: svc.department || null,
      } as unknown as LeadQuoteItem
    ])
    
    // După adăugarea serviciului, fixează instrumentul pentru această tăviță dacă este primul serviciu
    const itemsAfterAdd = [...items, {
      id: tempId(),
      item_type: 'service',
      service_id: svcDef.id,
      name_snapshot: svcDef.name,
      unit_price_snapshot: price,
      qty,
      discount_pct: discount,
      urgent: !!svc.urgent,
      technician: techName || null,
      department: svc.department || null,
    } as unknown as LeadQuoteItem]
    
    const servicesAfterAdd = itemsAfterAdd.filter(item => item.item_type === 'service')
    const isFirstService = servicesAfterAdd.length === 1
    
    // Reține instrumentul pentru a-l fixa după primul serviciu
    const instrumentToLock = serviceInstrument || svc.instrumentId
    
    setSvc({ 
      instrumentId: isFirstService ? instrumentToLock : svc.instrumentId, 
      id: '', 
      price: '', 
      qty: '1', 
      discount: '0', 
      urgent: false, 
      technicianId: '', 
      department:'' 
    })
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
  
    // Adaugă piesa
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
      // Dacă s-a șters ultimul serviciu, resetează instrumentul pentru a permite schimbarea
      const remainingServices = newItems.filter(item => item.item_type === 'service')
      if (remainingServices.length === 0) {
        setSvc(prev => ({ ...prev, instrumentId: '' }))
      }
      return newItems
    })
    setIsDirty(true)
  }

  async function onChangeSheet(newId: string) {
    if (!newId || newId === selectedQuoteId) return;
    
    // Reține ID-ul tăviței anterioare pentru a reveni în caz de eroare
    const previousQuoteId = selectedQuoteId;
    
    setLoading(true);
    try {
      // incarca valorile cash/card pentru noua tavita
      const newQuote = quotes.find(q => q.id === newId) as any
      if (!newQuote) {
        console.error('Tăvița nu a fost găsită:', newId);
        return;
      }
      
      setIsCash(newQuote.is_cash || false)
      setIsCard(newQuote.is_card || false)
      
      // Încarcă items-urile înainte de a seta selectedQuoteId
      const qi = await listQuoteItems(newId);
      
      // Doar după ce items-urile sunt încărcate cu succes, setăm selectedQuoteId
      setSelectedQuoteId(newId);
      setItems(qi ?? []);
      lastSavedRef.current = (qi ?? []).map((i: any) => ({
        id: i.id ?? `${i.name_snapshot}:${i.item_type}`,
        name: i.name_snapshot,
        qty: i.qty,
        price: i.unit_price_snapshot,
        discount_pct: i.discount_pct ?? 0,  // ADĂUGAT: salvează discount-ul
        type: i.item_type,
        urgent: !!i.urgent,
        department: i.department ?? null,
        technician: i.technician ?? null,
      }));

      // După încărcarea items-urilor, fixează instrumentul dacă există deja servicii
      // IMPORTANT: Folosește primul serviciu din listă (care este cel mai recent după sortarea noastră DESC)
      const loadedItems = qi ?? []
      const serviceItems = loadedItems.filter((item: any) => item.item_type === 'service')
      
      if (serviceItems.length > 0) {
        // Folosește primul serviciu (cel mai recent - primul din listă după sortarea DESC)
        const firstService = serviceItems[0]
        if (firstService.service_id) {
          const firstServiceDef = services.find(s => s.id === firstService.service_id)
          if (firstServiceDef?.instrument && firstServiceDef.instrument.trim()) {
            // IMPORTANT: Folosește câmpul instrument din serviciu, NU numele serviciului
            const instrumentToSet = firstServiceDef.instrument.trim()
            setSvc(prev => ({ ...prev, instrumentId: instrumentToSet }))
          } else {
            // Dacă serviciul nu are instrument, resetează
            setSvc(prev => ({ ...prev, instrumentId: '' }))
          }
        }
      } else {
        // Dacă nu există servicii, resetează instrumentul
        setSvc(prev => ({ ...prev, instrumentId: '' }))
      }
    } catch (error) {
      console.error('Eroare la încărcarea tăviței:', error);
      // Revenim la tăvița anterioară în caz de eroare
      if (previousQuoteId) {
        setSelectedQuoteId(previousQuoteId);
      }
      // Afișăm un mesaj de eroare utilizatorului
      alert('Nu s-a putut încărca tăvița. Te rugăm să încerci din nou.');
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

  async function onDeleteSheet() {
    if (!selectedQuote || quotes.length <= 1) {
      // Nu permite ștergerea dacă este ultima tăviță
      alert('Nu poți șterge ultima tăviță. Trebuie să existe cel puțin o tăviță.');
      return;
    }

    if (!confirm(`Ești sigur că vrei să ștergi Tăvița ${selectedQuote.sheet_index}? Această acțiune nu poate fi anulată.`)) {
      return;
    }

    setLoading(true);
    try {
      const deletedIndex = selectedQuote.sheet_index;
      await deleteQuote(selectedQuote.id);
      
      // Reîncarcă lista de tăvițe
      let updatedQuotes = await listQuotesForLead(leadId);
      
      // Reindexează tăvițele care au index mai mare decât cea ștearsă
      const quotesToReindex = updatedQuotes.filter(q => q.sheet_index > deletedIndex);
      for (const quote of quotesToReindex) {
        const newIndex = quote.sheet_index - 1;
        await updateQuote(quote.id, { sheet_index: newIndex } as any);
      }
      
      // Reîncarcă din nou lista pentru a avea indexurile actualizate
      updatedQuotes = await listQuotesForLead(leadId);
      setQuotes(updatedQuotes);
      
      // Selectează prima tăviță disponibilă sau creează una nouă dacă nu mai există
      if (updatedQuotes.length > 0) {
        const firstQuote = updatedQuotes[0];
        setSelectedQuoteId(firstQuote.id);
        
        // Încarcă items-urile pentru noua tăviță selectată
        const qi = await listQuoteItems(firstQuote.id);
        setItems(qi ?? []);
        
        // Încarcă valorile cash/card
        const quote = updatedQuotes.find(q => q.id === firstQuote.id) as any
        if (quote) {
          setIsCash(quote.is_cash || false)
          setIsCard(quote.is_card || false)
        }
      } else {
        // Dacă nu mai există tăvițe, creează una nouă
        const created = await createQuoteForLead(leadId);
        setQuotes([created]);
        setSelectedQuoteId(created.id);
        setItems([]);
      }
      
      lastSavedRef.current = [];
      await recalcAllSheetsTotal(updatedQuotes.length > 0 ? updatedQuotes : []);
    } catch (error) {
      console.error('Eroare la ștergerea tăviței:', error);
      alert('A apărut o eroare la ștergerea tăviței.');
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
            {quotes.length > 1 && (
              <Button 
                size="sm" 
                variant="destructive" 
                onClick={onDeleteSheet}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Șterge
              </Button>
            )}
          </div>
        </div>

        <Button className="cursor-pointer" size="sm" onClick={saveAllAndLog} disabled={loading || saving || !isDirty}>
          {saving ? "Se salvează…" : "Salvează în Istoric"}
        </Button>
      </div>
      {/* Add Service */}
      <div className="mb-3">
        <Button onClick={onAddService} disabled={!svc.id} className="w-auto">
          <Wrench className="h-4 w-4 mr-2" /> Adaugă serviciu
        </Button>
      </div>
      <div className="space-y-3">
        {/* Primul rând */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-2">
            <Label>Instrument</Label>
            <select
              className="w-full h-9 rounded-md border px-2 cursor-pointer"
              value={svc.instrumentId}
              onChange={e => {
                setSvc(s => ({ ...s, instrumentId: e.target.value, id: '' }))
              }}
              disabled={(() => {
                // Dezactivează dropdown-ul dacă există deja servicii în tăvița curentă
                const currentServices = items.filter(item => item.item_type === 'service')
                return currentServices.length > 0
              })()}
            >
              <option value="">— selectează —</option>
              {instruments.map((inst, index) => (
                <option key={index} value={inst.name}>
                  {inst.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <Label>Serviciu</Label>
            <select
              className="w-full h-9 rounded-md border px-2 cursor-pointer"
              value={svc.id}
              onChange={e => {
                const selectedService = services.find(s => s.id === e.target.value)
                setSvc(s => ({ 
                  ...s, 
                  id: e.target.value,
                  // Completează automat prețul dacă serviciul are preț fix
                  price: selectedService ? selectedService.base_price.toFixed(2) : ''
                }))
              }}
              disabled={!svc.instrumentId}
            >
              <option value="">— selectează —</option>
              {services
                .filter(s => {
                  // Filtrează serviciile după instrument
                  if (!svc.instrumentId) return false
                  return s.instrument === svc.instrumentId
                })
                .map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.base_price.toFixed(2)} RON
                  </option>
                ))}
            </select>
          </div>

          <div className="md:col-span-1">
            <Label>Preț (RON)</Label>
            <Input
              inputMode="decimal"
              value={svc.price}
              onChange={e => setSvc(s => ({ ...s, price: e.target.value }))}
              placeholder="0.00"
              disabled={!svc.id}
              className="w-full"
            />
          </div>

          <div className="md:col-span-1">
            <Label>Cant.</Label>
            <Input
              inputMode="numeric"
              value={svc.qty}
              onChange={e => setSvc(s => ({ ...s, qty: e.target.value }))}
              placeholder="1"
              className="w-full"
            />
          </div>

          <div className="md:col-span-1">
            <Label>Discount %</Label>
            <Input
              inputMode="decimal"
              value={svc.discount}
              onChange={e => setSvc(s => ({ ...s, discount: e.target.value }))}
              placeholder="0"
              className="w-full"
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
        </div>

        {/* Al doilea rând - Departament și Tehnician */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <Label>Departament (opțional)</Label>
            <select
              className="w-full h-9 rounded-md border px-2 cursor-pointer"
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
              className="w-full h-9 rounded-md border px-2 cursor-pointer"
              value={svc.technicianId}
              onChange={e => setSvc(s => ({ ...s, technicianId: e.target.value }))}
            >
              <option value="">— selectează tehnician —</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Add Part */}
      <div className="mb-3">
        <Button 
          onClick={(e) => {
            e.preventDefault()
            onAddPart(e as any)
          }} 
          className="w-auto"
        >
          <Plus className="h-4 w-4 mr-2" /> Adaugă piesă
        </Button>
      </div>
      <form className="grid grid-cols-1 md:grid-cols-12 gap-3" onSubmit={onAddPart}>
        <div className="md:col-span-4">
          <Label>Piesă</Label>
          <select
            className="w-full h-9 rounded-md border px-2 cursor-pointer"
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
        <div className="md:col-span-2">
          <Label>Preț unitar</Label>
          <Input
            inputMode="decimal"
            value={part.overridePrice}
            onChange={e => setPart(p => ({ ...p, overridePrice: e.target.value }))}
            placeholder="lasă gol pt. preț catalog"
            className="w-full"
          />
        </div>
        <div className="md:col-span-1">
          <Label>Cant.</Label>
          <Input
            inputMode="numeric"
            value={part.qty}
            onChange={e => setPart(p => ({ ...p, qty: e.target.value }))}
            placeholder="1"
            className="w-full"
          />
        </div>
        <div className="md:col-span-1">
          <Label>Discount %</Label>
          <Input
            inputMode="decimal"
            value={part.discount}
            onChange={e => setPart(p => ({ ...p, discount: e.target.value }))}
            placeholder="0"
            className="w-full"
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
                      (() => {
                        // Găsește instrumentul pentru acest serviciu
                        const serviceDef = services.find(s => s.id === it.service_id)
                        const instrument = serviceDef?.instrument
                        return instrument ? `${instrument} - ${it.name_snapshot}` : it.name_snapshot
                      })()
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
        services={services}
      />}
    </Card>
  );
}
```

## 2. Checkbox-uri pentru Receptie (components/lead-details-panel.tsx)

În `lead-details-panel.tsx`, există checkbox-uri care sunt afișate doar în pipeline-urile Receptie, Vanzari și Curier:

```typescript
// verifica daca suntem in unul dintre pipeline-urile care arata checkbox-urile
const showActionCheckboxes = useMemo(() => {
  if (!pipelineSlug) return false
  const slug = pipelineSlug.toLowerCase()
  return slug.includes('receptie') || slug.includes('vanzari') || slug.includes('curier')
}, [pipelineSlug])

// verifica daca suntem in pipeline-ul Curier
const isCurierPipeline = useMemo(() => {
  if (!pipelineSlug) return false
  return pipelineSlug.toLowerCase().includes('curier')
}, [pipelineSlug])

// În render:
{/* checkbox-uri cu butoane - vizibile doar in Receptie, Vanzari, Curier */}
{showActionCheckboxes && (
  <div className="flex flex-wrap gap-2">
    {/* Checkbox-uri pentru Curier */}
    {isCurierPipeline ? (
      <>
        {/* Checkbox-uri specifice Curier */}
      </>
    ) : (
      <>
        {/* Checkbox-uri pentru Receptie si Vanzari (fara Call back in Curier) */}
        {!isCurierPipeline && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="call-back"
              checked={callBack}
              onCheckedChange={(c: any) => setCallBack(!!c)}
            />
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => setCallBack(!callBack)}
            >
              Call back
            </Button>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <Checkbox
            id="nu-raspunde"
            checked={nuRaspunde}
            onCheckedChange={(c: any) => setNuRaspunde(!!c)}
          />
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => setNuRaspunde(!nuRaspunde)}
          >
            Nu raspunde
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Checkbox
            id="no-deal"
            checked={noDeal}
            onCheckedChange={(c: any) => setNoDeal(!!c)}
          />
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => setNoDeal(!noDeal)}
          >
            No deal
          </Button>
        </div>
      </>
    )}
  </div>
)}
```

## 3. Sortare în Kanban Board pentru Receptie (components/kanban-board.tsx)

În `kanban-board.tsx`, există logică specială de sortare pentru pipeline-ul Receptie:

```typescript
// sorteaza lead-urile pentru fiecare stage
const isReceptie = currentPipelineName?.toLowerCase().includes('receptie') || false

Object.keys(grouped).forEach(stage => {
  const stageLower = stage.toLowerCase()
  const isDeConfirmat = stageLower.includes('confirmat') && !stageLower.includes('confirmari')
  const isInAsteptare = stageLower.includes('asteptare')
  
  // pentru pipeline-ul Receptie, stage-urile "De confirmat" si "In asteptare" se sorteaza dupa timpul in stage
  const shouldSortByTimeInStage = isReceptie && (isDeConfirmat || isInAsteptare)
  
  grouped[stage].sort((a, b) => {
    // prioritate maxima pentru pinned leads
    const aIsPinned = a.tags?.some(tag => tag.name === 'PINNED') || false
    const bIsPinned = b.tags?.some(tag => tag.name === 'PINNED') || false
    
    if (aIsPinned && !bIsPinned) return -1
    if (!aIsPinned && bIsPinned) return 1
    
    // prioritate pentru urgent tags
    const aHasUrgent = a.tags?.some(tag => tag.name.toLowerCase() === 'urgent') || false
    const bHasUrgent = b.tags?.some(tag => tag.name.toLowerCase() === 'urgent') || false
    
    if (aHasUrgent && !bHasUrgent) return -1
    if (!aHasUrgent && bHasUrgent) return 1
    
    // daca suntem in Receptie si stage-ul este "De confirmat" sau "In asteptare", sortam dupa timpul in stage
    if (shouldSortByTimeInStage) {
      const aMovedAt = a.stageMovedAt ? new Date(a.stageMovedAt).getTime() : 0
      const bMovedAt = b.stageMovedAt ? new Date(b.stageMovedAt).getTime() : 0
      
      // sortare crescatoare: cele care au fost mutate mai devreme in stage vor fi primele
      if (aMovedAt !== bMovedAt) {
        return aMovedAt - bMovedAt
      }
    }
    
    // fallback: sortare dupa data crearii
    const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0
    
    return aDate - bDate
  })
})
```

## 4. Mesagerie între Receptie și Tehnician (components/lead-messenger.tsx)

Există o componentă de mesagerie între Receptie și Tehnician:

```typescript
// verifica daca utilizatorul este receptie sau tehnician
const isReception = userRole === 'admin' || userRole === 'owner' || userRole === 'member'
const isTechnician = userRole === 'technician'
```

## Observații importante:

1. **NU există un component separat pentru Receptie** - totul este în `preturi.tsx` care este folosit pentru toate pipeline-urile
2. **NU există funcționalitate de distribuire instrumente la tăvițe** - în proiectul vechi nu există această funcționalitate
3. **NU există dialog pentru atribuirea instrumentelor** - în proiectul vechi nu există această funcționalitate
4. **Checkbox-urile pentru Receptie** sunt afișate în `lead-details-panel.tsx` (Call back, Nu raspunde, No deal)
5. **Sortarea specială** pentru Receptie este în `kanban-board.tsx` pentru stage-urile "De confirmat" și "In asteptare"

## Concluzie:

În proiectul vechi, Receptie folosește același UI ca și celelalte pipeline-uri (componenta `Preturi`). Nu există un UI special pentru distribuirea instrumentelor la tăvițe sau pentru atribuirea instrumentelor când se accesează o fișă nouă cu "Office direct" sau "Curier trimis".








