'use client';

import { supabaseBrowser } from '@/lib/supabase/supabaseClient';
const supabase = supabaseBrowser();

export type LeadQuote = {
  id: string;
  lead_id: string;
  name: string;
  sheet_index: number;
  fisa_id: string | null; // ID-ul fișei de serviciu (null = tăviță standalone)
  created_at: string;
  created_by: string;
  is_cash?: boolean;
  is_card?: boolean;
};

// Tip pentru fișa de serviciu (grup de tăvițe)
export type ServiceSheet = {
  id: string;
  lead_id: string;
  name: string; // Numele fișei (ex: "Reparație urgentă", "Servicii de bază")
  fisa_index: number; // Index-ul fișei (1, 2, 3, etc.)
  created_at: string;
  created_by: string;
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
      .select('id, lead_id, name, sheet_index, fisa_id, created_at, created_by, is_cash, is_card')
      .eq('lead_id', leadId)
      .order('sheet_index', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(normalizeQuote);
  }

  // Obține toate fișele de serviciu pentru un lead (grupate după fisa_id)
  export async function listServiceSheetsForLead(leadId: string): Promise<ServiceSheet[]> {
    const { data, error } = await supabase
      .from('lead_quotes')
      .select('fisa_id, name, created_at, created_by')
      .eq('lead_id', leadId)
      .not('fisa_id', 'is', null);
    
    if (error) throw error;
    
    // Grupează după fisa_id și creează ServiceSheet pentru fiecare grup
    const fisaMap = new Map<string, any>();
    (data ?? []).forEach((row: any) => {
      if (row.fisa_id && !fisaMap.has(row.fisa_id)) {
        fisaMap.set(row.fisa_id, {
          id: row.fisa_id,
          lead_id: leadId,
          name: row.name || `Fișă ${row.fisa_id.slice(0, 8)}`,
          fisa_index: fisaMap.size + 1,
          created_at: row.created_at,
          created_by: row.created_by,
        });
      }
    });
    
    return Array.from(fisaMap.values());
  }

  // Obține toate tăvițele pentru o fișă de serviciu
  export async function listTraysForServiceSheet(fisaId: string): Promise<LeadQuote[]> {
    const { data, error } = await supabase
      .from('lead_quotes')
      .select('id, lead_id, name, sheet_index, fisa_id, created_at, created_by, is_cash, is_card')
      .eq('fisa_id', fisaId)
      .order('sheet_index', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(normalizeQuote);
  }

  // Funcție helper pentru generarea UUID-ului
  function generateUUID(): string {
    // Folosește crypto.randomUUID() dacă este disponibil, altfel generează un UUID v4 manual
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback pentru browsere mai vechi
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Creează o fișă de serviciu nouă (returnează fisa_id)
  export async function createServiceSheet(leadId: string, name?: string): Promise<string> {
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user?.id) {
      throw userErr ?? new Error('No user');
    }

    try {
      // Generează un UUID pentru fisa_id
      const fisaId = generateUUID();
      
      // Calculează următorul sheet_index disponibil pentru acest lead
      // (trebuie să fie unic pentru lead_id, indiferent de fisa_id)
      const { data: idxRows, error: idxErr } = await supabase
        .from('lead_quotes')
        .select('sheet_index')
        .eq('lead_id', leadId);
      
      if (idxErr) throw idxErr;
      
      // Găsește următorul index disponibil (global pentru lead)
      const existingIndexes = (idxRows || []).map(r => r.sheet_index || 0);
      const nextIndex = existingIndexes.length > 0 
        ? Math.max(...existingIndexes) + 1 
        : 1;
      
      // Calculează numărul fișei (câte fișe există deja pentru acest lead)
      const { data: fisaRows } = await supabase
        .from('lead_quotes')
        .select('fisa_id')
        .eq('lead_id', leadId)
        .not('fisa_id', 'is', null);
      
      // Obține fișe unice (fisa_id distinct)
      const uniqueFisas = new Set((fisaRows || []).map((r: any) => r.fisa_id).filter((id: any) => id !== null));
      const fisaNumber = uniqueFisas.size + 1;
      
      // Creează prima tăviță pentru această fișă cu numele "Fisa {număr}"
      const finalName = (name && name.trim()) || `Fisa ${fisaNumber}`;
      
      const { data, error } = await supabase
        .from('lead_quotes')
        .insert({
          lead_id: leadId,
          name: finalName,
          sheet_index: nextIndex,
          fisa_id: fisaId,
          created_by: userRes.user.id,
        })
        .select('id, fisa_id')
        .single();
      
      if (error) {
        // Verifică dacă eroarea este legată de coloana lipsă
        if (error.message?.includes('column') && error.message?.includes('fisa_id')) {
          throw new Error('Coloana fisa_id nu există în baza de date. Te rog adaugă coloana fisa_id (UUID, nullable) în tabelul lead_quotes.');
        }
        throw error;
      }
      
      // Returnează fisaId generat (nu din data, pentru că știm deja valoarea)
      if (!data) {
        throw new Error('Nu s-a putut crea fișa de serviciu');
      }
      
      return fisaId;
    } catch (error: any) {
      // Re-throw cu un mesaj mai clar
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Eroare la crearea fișei: ${error?.message || 'Eroare necunoscută'}`);
    }
  }
  
  export async function createQuoteForLead(leadId: string, name?: string, fisaId?: string | null): Promise<LeadQuote> {
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user?.id) throw userErr ?? new Error('No user');
  
    // Calculează next index GLOBAL pentru toate tăvițele lead-ului
    // (constrângerea de unicitate este pe lead_id + sheet_index, nu pe lead_id + fisa_id + sheet_index)
    const { data: idxRows, error: idxErr } = await supabase
      .from('lead_quotes')
      .select('sheet_index')
      .eq('lead_id', leadId);
    if (idxErr) throw idxErr;
    const next = (idxRows?.reduce((m, r) => Math.max(m, r.sheet_index || 0), 0) || 0) + 1;
  
    // Pentru nume, dacă avem fisaId, calculăm un index relativ la fișă pentru afișare
    let displayName: string;
    if (fisaId && name) {
      displayName = name;
    } else if (fisaId) {
      // Calculează câte tăvițe există deja în această fișă pentru nume
      const { data: fisaRows } = await supabase
        .from('lead_quotes')
        .select('sheet_index')
        .eq('lead_id', leadId)
        .eq('fisa_id', fisaId);
      const fisaIndex = (fisaRows?.length || 0) + 1;
      displayName = `Tăbliță ${fisaIndex}`;
    } else {
      displayName = (name && name.trim()) || `Tăbliță ${next}`;
    }
  
    const finalName = displayName;
  
    const { data, error } = await supabase
      .from('lead_quotes')
      .insert({
        lead_id: leadId,
        name: finalName,
        sheet_index: next,
        fisa_id: fisaId || null,
        created_by: userRes.user.id,
      })
      .select('id, lead_id, name, sheet_index, fisa_id, created_at, created_by')
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
      department: opts?.department ? String(opts.department).trim() : null,
      technician: opts?.technician ? String(opts.technician).trim() : null,
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
      technician: opts?.technician ? String(opts.technician).trim() : null,
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
    if (patch.department !== undefined) body.department = patch.department ? String(patch.department).trim() : null;
    if (patch.technician !== undefined) body.technician = patch.technician ? String(patch.technician).trim() : null;
  
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
    fisa_id: q.fisa_id ?? null,
    created_at: q.created_at,
    created_by: q.created_by,
    is_cash: q.is_cash ?? undefined,
    is_card: q.is_card ?? undefined,
  };
}
