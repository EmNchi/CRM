'use client';

import { supabaseBrowser } from '@/lib/supabase/supabaseClient';
const supabase = supabaseBrowser();

export type LeadQuote = {
  id: string;
  lead_id: string;
  department: string | null;
  technician: string | null;
  urgent: boolean;
  discount_pct: number;
};

export type LeadQuoteItem = {
  id: string;
  quote_id: string;
  item_type: 'service' | 'part';
  service_id: string | null;
  name_snapshot: string;
  unit_price_snapshot: number;
  qty: number;
  discount_pct: number;
  position: number;
};

export async function getOrCreateQuote(leadId: string): Promise<LeadQuote> {
  const { data: found, error: selErr } = await supabase
    .from('lead_quotes')
    .select('*')
    .eq('lead_id', leadId)
    .limit(1)
    .maybeSingle();
  if (selErr && selErr.code !== 'PGRST116') throw selErr; // ignore "no rows" code

  if (found) return normalizeQuote(found as any);

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) throw userErr ?? new Error('No user');

  const { data, error } = await supabase
    .from('lead_quotes')
    .insert({ lead_id: leadId, created_by: userRes.user.id })
    .select('*')
    .single();
  if (error) throw error;
  return normalizeQuote(data as any);
}

export async function updateQuote(quoteId: string, patch: Partial<LeadQuote>) {
  const { error } = await supabase.from('lead_quotes').update(patch).eq('id', quoteId);
  if (error) throw error;
}

export async function listQuoteItems(quoteId: string): Promise<LeadQuoteItem[]> {
  const { data, error } = await supabase
    .from('lead_quote_items')
    .select('*')
    .eq('quote_id', quoteId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizeItem as any);
}

export async function addServiceItem(quoteId: string, service: { id: string; name: string; base_price: number }) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) throw userErr ?? new Error('No user');

  const { error } = await supabase.from('lead_quote_items').insert({
    quote_id: quoteId,
    item_type: 'service',
    service_id: service.id,
    name_snapshot: service.name,
    unit_price_snapshot: service.base_price,
    qty: 1,
    discount_pct: 0,
    created_by: userRes.user.id,
  });
  if (error) throw error;
}

export async function addPartItem(quoteId: string, name: string, unitPrice: number) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) throw userErr ?? new Error('No user');

  const { error } = await supabase.from('lead_quote_items').insert({
    quote_id: quoteId,
    item_type: 'part',
    service_id: null,
    name_snapshot: name.trim(),
    unit_price_snapshot: unitPrice,
    qty: 1,
    discount_pct: 0,
    created_by: userRes.user.id,
  });
  if (error) throw error;
}

export async function updateItem(itemId: string, patch: Partial<Pick<LeadQuoteItem, 'qty' | 'discount_pct' | 'name_snapshot' | 'unit_price_snapshot'>>) {
  const { error } = await supabase.from('lead_quote_items').update(patch).eq('id', itemId);
  if (error) throw error;
}

export async function deleteItem(itemId: string) {
  const { error } = await supabase.from('lead_quote_items').delete().eq('id', itemId);
  if (error) throw error;
}

function normalizeQuote(q: any): LeadQuote {
  return {
    ...q,
    discount_pct: Number(q.discount_pct ?? 0),
    urgent: !!q.urgent,
  };
}
function normalizeItem(r: any): LeadQuoteItem {
  return {
    ...r,
    unit_price_snapshot: Number(r.unit_price_snapshot),
    qty: Number(r.qty),
    discount_pct: Number(r.discount_pct ?? 0),
  };
}
