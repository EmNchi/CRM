'use client';

import { supabaseBrowser } from '@/lib/supabase/supabaseClient';
const supabase = supabaseBrowser();

export type LeadQuote = {
  id: string;
  lead_id: string;
  name: string;
  sheet_index: number;
  created_at: string;
  created_by: string;
  is_cash?: boolean;
  is_card?: boolean;
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
  urgent: boolean; 
  department: string | null;
  technician: string | null;
  position: number;
};

export async function getOrCreateQuote(leadId: string): Promise<LeadQuote> {
  const list = await listQuotesForLead(leadId);
  if (list.length) return list[0];
  return await createQuoteForLead(leadId);
}


export async function updateQuote(quoteId: string, patch: Partial<LeadQuote>) {
  const { error } = await supabase.from('lead_quotes').update(patch).eq('id', quoteId);
  if (error) throw error;
}

export async function listQuoteItems(quoteId: string): Promise<LeadQuoteItem[]> {
    const { data, error } = await supabase
      .from('lead_quote_items')
      .select('id,quote_id,item_type,service_id,name_snapshot,unit_price_snapshot,qty,discount_pct,urgent,department,technician,position,created_at,updated_at')
      .eq('quote_id', quoteId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
  
    if (error) throw error;
  
    return (data ?? []).map((r: any) => ({
      id: r.id,
      quote_id: r.quote_id,
      item_type: r.item_type,
      service_id: r.service_id ?? null,
      name_snapshot: r.name_snapshot,
      unit_price_snapshot: Number(r.unit_price_snapshot),
      qty: Number(r.qty),
      discount_pct: Number(r.discount_pct ?? 0),
      urgent: !!r.urgent,
      department: r.department ?? null,
      technician: r.technician ?? null,
      position: Number(r.position ?? 0),
    }));
  }

  export async function listQuotesForLead(leadId: string): Promise<LeadQuote[]> {
    const { data, error } = await supabase
      .from('lead_quotes')
      .select('id, lead_id, name, sheet_index, created_at, created_by, is_cash, is_card')
      .eq('lead_id', leadId)
      .order('sheet_index', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(normalizeQuote);
  }
  
  export async function createQuoteForLead(leadId: string, name?: string): Promise<LeadQuote> {
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user?.id) throw userErr ?? new Error('No user');
  
    // compute next index
    const { data: idxRows, error: idxErr } = await supabase
      .from('lead_quotes')
      .select('sheet_index')
      .eq('lead_id', leadId);
    if (idxErr) throw idxErr;
    const next = (idxRows?.reduce((m, r) => Math.max(m, r.sheet_index || 0), 0) || 0) + 1;
  
    const finalName = (name && name.trim()) || `Tăbliță ${next}`;
  
    const { data, error } = await supabase
      .from('lead_quotes')
      .insert({
        lead_id: leadId,
        name: finalName,
        sheet_index: next,
        created_by: userRes.user.id,
      })
      .select('id, lead_id, name, sheet_index, created_at, created_by')
      .single();
    if (error) throw error;
    return normalizeQuote(data as any);
  }

  export async function addServiceItem(
    quoteId: string,
    service: { id: string; name: string; base_price: number },
    opts?: {
      qty?: number;
      discount_pct?: number;
      urgent?: boolean;
      department?: string | null;
      technician?: string | null;
    }
  ) {
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) throw userErr ?? new Error('No user');
  
    const qty = Math.max(1, Number(opts?.qty ?? 1));
    const discount_pct = Math.min(100, Math.max(0, Number(opts?.discount_pct ?? 0)));
    const urgent = !!opts?.urgent;
  
    const payload: any = {
      quote_id: quoteId,
      item_type: 'service',
      service_id: service.id,
      name_snapshot: service.name,
      unit_price_snapshot: service.base_price,
      qty,
      discount_pct,
      urgent,
      department: (opts?.department ?? null)?.toString().trim() || null,
      technician: (opts?.technician ?? null)?.toString().trim() || null,
      created_by: userRes.user.id,
    };
  
    const { error } = await supabase.from('lead_quote_items').insert(payload);
    if (error) throw error;
  }
  

  export async function addPartItem(
    quoteId: string,
    name: string,
    unitPrice: number,
    opts?: {
      qty?: number;
      discount_pct?: number;
      urgent?: boolean;
      department?: string | null;
      technician?: string | null;
    }
  ) {
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) throw userErr ?? new Error('No user');
  
    const qty = Math.max(1, Number(opts?.qty ?? 1));
    const discount_pct = Math.min(100, Math.max(0, Number(opts?.discount_pct ?? 0)));
    const urgent = !!opts?.urgent;
  
    const { error } = await supabase.from('lead_quote_items').insert({
      quote_id: quoteId,
      item_type: 'part',
      service_id: null,
      name_snapshot: name.trim(),
      unit_price_snapshot: Number(unitPrice),
      qty,
      discount_pct,
      urgent,
      department: (opts?.department ?? null) || null,
      technician: (opts?.technician ?? null)?.toString().trim() || null,
      created_by: userRes.user.id,
    });
    if (error) throw error;
  }
  

export async function updateItem(
    itemId: string,
    patch: Partial<
      Pick<
        LeadQuoteItem,
        | 'qty'
        | 'discount_pct'
        | 'name_snapshot'
        | 'unit_price_snapshot'
        | 'urgent'
        | 'department'
        | 'technician'
      >
    >
  ) {
    const body: any = {};
  
    if (patch.qty !== undefined) body.qty = Math.max(1, Number(patch.qty));
    if (patch.discount_pct !== undefined) body.discount_pct = Math.min(100, Math.max(0, Number(patch.discount_pct)));
    if (patch.name_snapshot !== undefined) body.name_snapshot = String(patch.name_snapshot);
    if (patch.unit_price_snapshot !== undefined) body.unit_price_snapshot = Math.max(0, Number(patch.unit_price_snapshot));
    if (patch.urgent !== undefined) body.urgent = !!patch.urgent;
  
    // Department and technician are now valid for both services and parts
    if (patch.department !== undefined) body.department = (patch.department ?? null)?.toString().trim() || null;
    if (patch.technician !== undefined) body.technician = (patch.technician ?? null)?.toString().trim() || null;
  
    const { error } = await supabase.from('lead_quote_items').update(body).eq('id', itemId);
    if (error) throw error;
}

export async function deleteItem(itemId: string) {
  const { error } = await supabase.from('lead_quote_items').delete().eq('id', itemId);
  if (error) throw error;
}

function normalizeQuote(q: any): LeadQuote {
  return {
    id: q.id,
    lead_id: q.lead_id,
    name: q.name,
    sheet_index: Number(q.sheet_index),
    created_at: q.created_at,
    created_by: q.created_by,
    is_cash: q.is_cash ?? undefined,
    is_card: q.is_card ?? undefined,
  };
}
