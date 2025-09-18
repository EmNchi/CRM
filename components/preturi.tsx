'use client';

import { useEffect, useMemo, useState } from 'react';
import { listServices, type Service } from '@/lib/supabase/serviceOperations';
import {
  getOrCreateQuote,
  listQuoteItems,
  addServiceItem,
  addPartItem,
  updateItem,
  deleteItem,
  type LeadQuoteItem,
  type LeadQuote,
} from '@/lib/supabase/quoteOperations';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus, Wrench } from 'lucide-react';

const URGENT_MARKUP_PCT = 30; // +30% per line if urgent

export default function Preturi({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [quote, setQuote] = useState<LeadQuote | null>(null);
  const [items, setItems] = useState<LeadQuoteItem[]>([]);

  // Add-service form state
  const [svc, setSvc] = useState({
    id: '',
    qty: '1',
    discount: '0',
    urgent: false,
    department: '',
    technician: '',
  });

  // Add-part form state
  const [part, setPart] = useState({
    name: '',
    price: '',
    qty: '1',
    discount: '0',
    urgent: false,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [svcList, q] = await Promise.all([listServices(), getOrCreateQuote(leadId)]);
        setServices(svcList);
        setQuote(q);
        const rows = await listQuoteItems(q.id);
        setItems(rows);
      } finally {
        setLoading(false);
      }
    })();
  }, [leadId]);

  async function refreshItems() {
    if (!quote) return;
    setItems(await listQuoteItems(quote.id));
  }

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
  async function onAddService() {
    if (!quote || !svc.id) return;
    const svcDef = services.find(s => s.id === svc.id);
    if (!svcDef) return;

    const qty = Math.max(1, Number(svc.qty || 1));
    const discount = Math.min(100, Math.max(0, Number(svc.discount || 0)));
    await addServiceItem(quote.id, svcDef, {
      qty,
      discount_pct: discount,
      urgent: !!svc.urgent,
      department: svc.department?.trim() || null,
      technician: svc.technician?.trim() || null,
    });

    // reset service form (fresh defaults for next line)
    setSvc({ id: '', qty: '1', discount: '0', urgent: false, department: '', technician: '' });
    await refreshItems();
  }

  async function onAddPart(e: React.FormEvent) {
    e.preventDefault();
    if (!quote) return;

    const unit = Number(part.price);
    const qty = Math.max(1, Number(part.qty || 1));
    const discount = Math.min(100, Math.max(0, Number(part.discount || 0)));
    if (!part.name.trim() || isNaN(unit) || unit < 0) return;

    await addPartItem(quote.id, part.name.trim(), unit, {
      qty,
      discount_pct: discount,
      urgent: !!part.urgent,
    });

    setPart({ name: '', price: '', qty: '1', discount: '0', urgent: false });
    await refreshItems();
  }

  // ----- Inline updates -----
  async function onUpdateItem(id: string, patch: Partial<LeadQuoteItem>) {
    await updateItem(id, patch as any);
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } as any : it)));
  }

  async function onDelete(id: string) {
    await deleteItem(id);
    setItems(prev => prev.filter(it => it.id !== id));
  }

  if (loading || !quote) return <Card className="p-4">Se încarcă…</Card>;

  return (
    <Card className="p-4 space-y-5">
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
          <Input
            value={svc.department}
            onChange={e => setSvc(s => ({ ...s, department: e.target.value }))}
            placeholder="Ex: Reparații"
          />
        </div>
        <div className="md:col-span-3">
          <Label>Tehnician (opțional)</Label>
          <Input
            value={svc.technician}
            onChange={e => setSvc(s => ({ ...s, technician: e.target.value }))}
            placeholder="Nume tehnician"
          />
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
          <Label>Piesă — denumire</Label>
          <Input
            value={part.name}
            onChange={e => setPart(p => ({ ...p, name: e.target.value }))}
            placeholder="Ex: Garnitură"
          />
        </div>
        <div>
          <Label>Preț unitar (RON)</Label>
          <Input
            inputMode="decimal"
            value={part.price}
            onChange={e => setPart(p => ({ ...p, price: e.target.value }))}
            placeholder="50"
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
                    {it.item_type === 'service' ? (
                      <Input
                        value={it.department ?? ''}
                        onChange={e => onUpdateItem(it.id, { department: e.target.value })}
                        placeholder="—"
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell>
                    {it.item_type === 'service' ? (
                      <Input
                        value={it.technician ?? ''}
                        onChange={e => onUpdateItem(it.id, { technician: e.target.value })}
                        placeholder="—"
                      />
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
    </Card>
  );
}
