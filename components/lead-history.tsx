"use client"

import { useEffect, useState } from "react"
import { supabaseBrowser } from "@/lib/supabase/supabaseClient"

type LeadEvent = {
  id: string
  lead_id: string
  actor_id: string | null
  actor_name: string | null
  event_type: string
  message: string
  payload: Record<string, unknown>
  created_at: string
}

function ItemTag({ type }: { type?: string }) {
  const t = (type || "").toLowerCase()
  return <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">{t === "service" ? "Service" : "Piesă"}</span>
}

function renderServiceSheetDetails(payload: any) {
  const diff = payload?.diff
  if (!diff) return null

  const Block = ({ title, items }: { title: string; items?: any[] }) =>
    items && items.length ? (
      <div className="mt-2">
        <div className="text-xs font-medium">{title}</div>
        <ul className="mt-1 space-y-1 text-sm">
          {items.map((x, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <ItemTag type={x.type} />
              <span className="font-medium">{x.name}: </span>
              <span className="text-muted-foreground">
                Departament: {x.department ?? "—"}; Tehnician: {x.technician ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    ) : null

  return (
    <div className="mt-1">
      <Block title="Adăugate" items={diff.added} />
      <Block title="Actualizate" items={diff.updated} />
      <Block title="Șterse" items={diff.removed} />
    </div>
  )
}

function ConfirmBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    confirm_request: { label: "DE CONFIRMAT", cls: "bg-yellow-100 text-yellow-900" },
    confirm_reply:   { label: "RĂSPUNS CLIENT", cls: "bg-blue-100 text-blue-900" },
    confirm_done:    { label: "CONFIRMAT", cls: "bg-emerald-100 text-emerald-900" },
    confirm_auto_move:{ label: "AUTO MOVE", cls: "bg-slate-100 text-slate-900" },
  }
  const meta = map[type]
  if (!meta) return null
  return (
    <span className={`ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.cls} border border-black/5`}>
      {meta.label}
    </span>
  )
}

const supabase = supabaseBrowser()

export default function LeadHistory({ leadId }: { leadId: string }) {
  const [items, setItems] = useState<LeadEvent[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    // initial fetch - folosește items_events polimorf
    supabase
      .from("items_events")
      .select("*")
      .eq("type", "lead")
      .eq("item_id", leadId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }: any) => {
        if (cancelled) return
        if (error) {
          setError(error.message)
          setItems([])
        } else {
          // Transformă items_events în format LeadEvent pentru UI
          setItems((data ?? []).map((item: any) => ({
            ...item,
            lead_id: item.item_id, // Mapare pentru LeadEvent type
          })))
          setError(null)
        }
        setLoading(false)
      })

    // realtime updates (append new at top)
    const channel = supabase
      .channel(`lead_events_${leadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "items_events", filter: `type=eq.lead&item_id=eq.${leadId}` },
        (payload: any) => {
          // Transformă pentru UI
          const event = {
            ...payload.new,
            lead_id: payload.new.item_id,
          } as LeadEvent
          setItems((prev) => [event, ...(prev ?? [])])
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [leadId])

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Se încarcă istoricul…</div>
  if (error) return <div className="p-4 text-sm text-destructive">{error}</div>
  if (!items || items.length === 0) return <div className="p-4 text-sm text-muted-foreground">Nu există evenimente încă.</div>

  return (
    <div className="space-y-3 max-h-160 overflow-y-auto">
      {items.map((ev) => (
        <div key={ev.id} className="rounded-lg border p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center">
              <span>{new Date(ev.created_at).toLocaleString()}</span>
              <ConfirmBadge type={ev.event_type} />
            </div>
            <span>{ev.actor_name || (ev.actor_id ? ev.actor_id.slice(0, 8) : "—")}</span>
          </div>
          <div className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{ev.message}</div>
            {ev.event_type === "service_sheet_save" ? renderServiceSheetDetails(ev.payload as any) : null}
        </div>
      ))}
    </div>
  )
}
