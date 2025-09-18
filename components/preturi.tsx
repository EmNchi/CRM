'use client';

import { useEffect, useMemo, useState } from 'react';
import { listServices, type Service } from '@/lib/supabase/serviceOperations';
import { getOrCreateQuote, updateQuote, listQuoteItems, addServiceItem, addPartItem, updateItem, deleteItem, type LeadQuoteItem, type LeadQuote } from '@/lib/supabase/quoteOperations';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus, Wrench } from 'lucide-react';
import { useRole } from '@/hooks/useRole';

const URGENT_MARKUP_PCT = 30; // +30%

export default function Preturi({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [quote, setQuote] = useState<LeadQuote | null>(null);
  const [items, setItems] = useState<LeadQuoteItem[]>([]);
  const { role } = useRole();
  const canDelete = role === 'owner' || role === 'admin';

  const [newPart, setNewPart] = useState({ name: '', price: '' });
  const [serviceToAdd, setServiceToAdd] = useState<string>(''); // service id

  // init
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [svc, q] = await Promise.all([listServices(), getOrCreateQuote(leadId)]);
        setServices(svc);
        setQuote(q);
        setItems(await listQuoteItems(q.id));
      } finally {
        setLoading(false);
      }
    })();
  }, [leadId]);

  async function refreshItems() {
    if (!quote) return;
    setItems(await listQuoteItems(quote.id));
  }

  // totals
  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => {
      const line = it.qty * it.unit_price_snapshot * (1 - it.discount_pct / 100);
      return acc + line;
    }, 0);
  }, [items]);

  const quoteDiscountAmt = useMemo(() => subtotal * (Number(quote?.discount_pct || 0) / 100), [subtotal, quote?.discount_pct]);
  const urgentAmt = useMemo(() => (quote?.urgent ? (subtotal - quoteDiscountAmt) * (URGENT_MARKUP_PCT / 100) : 0), [quote?.urgent, subtotal, quoteDiscountAmt]);
  const total = useMemo(() => subtotal - quoteDiscountAmt + urgentAmt, [subtotal, quoteDiscountAmt, urgentAmt]);

  async function onAddService() {
    if (!quote || !serviceToAdd) return;
    const svc = services.find(s => s.id === serviceToAdd);
    if (!svc) return;
    await addServiceItem(quote.id, svc);
    setServiceToAdd('');
    await refreshItems();
  }

  async function onAddPart(e: React.FormEvent) {
    e.preventDefault();
    if (!quote) return;
    const price = Number(newPart.price);
    if (!newPart.name.trim() || isNaN(price) || price < 0) return;
    await addPartItem(quote.id, newPart.name, price);
    setNewPart({ name: '', price: '' });
    await refreshItems();
  }

  async function onUpdateItem(id: string, patch: Partial<LeadQuoteItem>) {
    await updateItem(id, patch as any);
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } as any : it)));
  }

  async function onDeleteItem(id: string) {
    await deleteItem(id);
    setItems(prev => prev.filter(it => it.id !== id));
  }

  if (loading || !quote) {
    return <Card className="p-4">Se încarcă…</Card>;
  }

  return (
    <Card className="p-4 space-y-4">
      {/* Header controls */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <Label>Departament</Label>
          <Input
            value={quote.department ?? ''}
            onChange={async e => {
              const v = e.target.value;
              setQuote(q => q ? { ...q, department: v } : q);
              await updateQuote(quote.id, { department: v });
            }}
            placeholder="Ex: Reparații"
          />
        </div>
        <div>
          <Label>Tehnician</Label>
          <Input
            value={quote.technician ?? ''}
            onChange={async e => {
              const v = e.target.value;
              setQuote(q => q ? { ...q, technician: v } : q);
              await updateQuote(quote.id, { technician: v });
            }}
            placeholder="Nume tehnician"
          />
        </div>
        <div>
          <Label>Discount (%) — pe ofertă</Label>
          <Input
            inputMode="decimal"
            value={String(quote.discount_pct ?? 0)}
            onChange={async e => {
              const v = Math.max(0, Math.min(100, Number(e.target.value || 0)));
              setQuote(q => q ? { ...q, discount_pct: v } : q);
              await updateQuote(quote.id, { discount_pct: v });
            }}
            placeholder="0"
          />
        </div>
        <div className="flex items-end gap-2">
          <Checkbox
            id="urgent"
            checked={!!quote.urgent}
            onCheckedChange={async (c: boolean) => {
              setQuote(q => q ? { ...q, urgent: !!c } : q);
              await updateQuote(quote.id, { urgent: !!c });
            }}
          />
          <Label htmlFor="urgent">Urgent (+{URGENT_MARKUP_PCT}%)</Label>
        </div>
      </div>

      {/* Add service */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px]">
          <Label>Adaugă serviciu</Label>
          <select
            className="w-full h-9 rounded-md border px-2"
            value={serviceToAdd}
            onChange={e => setServiceToAdd(e.target.value)}
          >
            <option value="">— selectează —</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.base_price.toFixed(2)} RON
              </option>
            ))}
          </select>
        </div>
        <Button onClick={onAddService} disabled={!serviceToAdd}>
          <Wrench className="h-4 w-4 mr-2" /> Adaugă serviciu
        </Button>

        {/* Add part */}
        <form className="flex flex-wrap items-end gap-2" onSubmit={onAddPart}>
          <div>
            <Label>Piesă (nume)</Label>
            <Input value={newPart.name} onChange={e => setNewPart(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Garnitură" />
          </div>
          <div>
            <Label>Preț unitar (RON)</Label>
            <Input inputMode="decimal" value={newPart.price} onChange={e => setNewPart(p => ({ ...p, price: e.target.value }))} placeholder="50" />
          </div>
          <Button type="submit"><Plus className="h-4 w-4 mr-2" /> Adaugă piesă</Button>
        </form>
      </div>

      {/* Items table */}
      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serviciu / Piesă</TableHead>
              <TableHead className="w-28">Cant.</TableHead>
              <TableHead className="w-36">Preț unitar</TableHead>
              <TableHead className="w-32">Discount %</TableHead>
              <TableHead className="w-36 text-right">Total linie</TableHead>
              <TableHead className="w-12 text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(it => {
              const line = it.qty * it.unit_price_snapshot * (1 - it.discount_pct / 100);
              return (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">
                    {it.item_type === 'service' ? it.name_snapshot : (
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
                        const v = Math.max(0, Math.min(100, Number(e.target.value || 0)));
                        onUpdateItem(it.id, { discount_pct: v });
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">{line.toFixed(2)} RON</TableCell>
                  <TableCell className="text-right">
                    {canDelete && (
                      <Button variant="destructive" size="icon" onClick={() => onDeleteItem(it.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-muted-foreground">Nu există poziții încă.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Totals */}
      <div className="ml-auto w-full md:w-[420px] space-y-1">
        <div className="flex items-center justify-between">
          <span>Subtotal</span>
          <span>{subtotal.toFixed(2)} RON</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Discount ofertă ({quote.discount_pct}%)</span>
          <span>-{quoteDiscountAmt.toFixed(2)} RON</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Urgent {quote.urgent ? `(+${URGENT_MARKUP_PCT}%)` : ''}</span>
          <span>{urgentAmt.toFixed(2)} RON</span>
        </div>
        <div className="h-px bg-border my-2" />
        <div className="flex items-center justify-between text-lg font-semibold">
          <span>Total</span>
          <span>{total.toFixed(2)} RON</span>
        </div>
      </div>
    </Card>
  );
}
