'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { listServices, type Service } from '@/lib/supabase/serviceOperations';
import {
  listQuoteItems,
  type LeadQuoteItem,
  type LeadQuote,
  listQuotesForLead,
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
import { persistAndLogServiceSheet } from "@/lib/history/serviceSheet"

const supabase = supabaseBrowser()

const URGENT_MARKUP_PCT = 30; // +30% per line if urgent

export default function Preturi({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  // Sheets (Tăblițe)
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
          const created = await createQuoteForLead(leadId); // auto: "Tăbliță 1 {leadId}"
          qs = [created];
        }
        setQuotes(qs);
        const firstId = qs[0].id;
        setSelectedQuoteId(firstId);
      
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
  const total = useMemo(() => subtotal - totalDiscount + urgentAmount, [subtotal, totalDiscount, urgentAmount]);

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
          <div className="flex gap-3">
            <Label className="text-sm text-muted-foreground">Tăbliță</Label>
            <select
              className="h-9 rounded-md border px-2"
              value={selectedQuoteId ?? ''}
              onChange={e => onChangeSheet(e.target.value)}
            >
              {quotes.map(q => (
                <option key={q.id} value={q.id}>{`Tăbliță ${q.sheet_index}`}</option>
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
        <div className="h-px bg-border my-2" />
        <div className="flex items-center justify-between text-lg font-semibold">
          <span>Total</span>
          <span>{total.toFixed(2)} RON</span>
        </div>
      </div>

      <div className="ml-auto w-full md:w-[480px] mt-3 p-3 rounded-md border flex items-center justify-between">
        <span className="font-medium">Total toate tăblițele</span>
        <span className="font-semibold">{allSheetsTotal.toFixed(2)} RON</span>
      </div>
    </Card>
  );
}
