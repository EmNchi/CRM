'use client';

import { supabaseBrowser } from '@/lib/supabase/supabaseClient';

export type Service = {
  id: string;
  name: string;
  base_price: number;      
  department: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

const supabase = supabaseBrowser();

export async function listServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('id,name,base_price,department,active,created_at,updated_at')
    .order('name', { ascending: true });

  if (error) throw error;

  // base_price is numeric in PG and may come as string; cast to number for UI
  return (data ?? []).map((s: any) => ({
    ...s,
    base_price: Number(s.base_price),
  }));
}

export async function createService(input: {
  name: string;
  base_price: number;
  department?: string;
}) {
  // created_by has no default in your SQL; include it
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) throw userErr ?? new Error('No user');

  const { error } = await supabase.from('services').insert({
    name: input.name.trim(),
    base_price: input.base_price,
    department: input.department?.trim() || null,
    created_by: userRes.user.id,
  });
  if (error) throw error;
}

export async function deleteService(id: string) {
  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) throw error;
}
