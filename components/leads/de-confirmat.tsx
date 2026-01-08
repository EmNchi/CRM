"use client"

import { Button } from "@/components/ui/button"
import { supabaseBrowser } from "@/lib/supabase/supabaseClient"
import { logLeadEvent } from "@/lib/supabase/leadOperations"
import { useToast } from "@/hooks/use-toast"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

const supabase = supabaseBrowser()

type Props = {
  leadId: string
  onMoveStage: (newStage: string) => void
}

type Ev = {
  id: string
  actor_name: string | null
  event_type: string
  message: string
  created_at: string
}

export default function DeConfirmat({ leadId, onMoveStage }: Props) {
  const [req, setReq] = useState("")
  const [reply, setReply] = useState("")
  const [items, setItems] = useState<Ev[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()

  function pushUnique(list: Ev[], entry: Ev) {
    const next = [entry, ...list]
    const seen = new Set<string>()
    return next.filter(e => (seen.has(e.id) ? false : (seen.add(e.id), true)))
  }

  async function moveEverywhere(fromName: string, toName: string) {
    const { data, error } = await supabase.rpc("auto_move_lead_confirm", {
      p_lead_id: leadId,
      p_from_name: fromName,
      p_to_name: toName,
    })
    if (error) throw error
    return (data ?? []) as Array<any>
  }

  // Load only the confirmation conversation from items_events
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    supabase
      .from("items_events")
      .select("id,actor_name,event_type,message,created_at")
      .eq("type", "lead")
      .eq("item_id", leadId)
      .in("event_type", ["confirm_request", "confirm_reply", "confirm_done"])
      .order("created_at", { ascending: false })
      .then(({ data }: any) => {
        if (!cancelled) {
          const seen = new Set<string>()
          const unique = (data ?? []).filter((e: any) => !seen.has(e.id) && seen.add(e.id))
          setItems(unique)
        }
        setLoading(false)
      })

    const ch = supabase
      .channel(`lead_conf_${leadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "items_events", filter: `type=eq.lead&item_id=eq.${leadId}` },
        (p: any) => {
          if (!["confirm_request", "confirm_reply", "confirm_done"].includes(p.new.event_type)) return
          setItems(prev => pushUnique(prev, p.new as Ev))
        }
      )
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [leadId])

  // Technician → send for confirmation: log event + move IN LUCRU → DE CONFIRMAT
  async function sendRequest() {
    if (!req.trim()) return
    const ev = await logLeadEvent(leadId, req.trim(), "confirm_request", {})
    setItems(prev => pushUnique(prev, ev))
    try {
      const res = await moveEverywhere("IN LUCRU", "DE CONFIRMAT")
      toast({ title: `Mutat în "DE CONFIRMAT" pe ${res.length} pipeline-uri.` })
      onMoveStage?.("DE CONFIRMAT")
      router.refresh()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Eroare la mutare", description: e?.message ?? "Move failed" })
    }
    setReq("")
  }

  async function sendReply() {
    if (!reply.trim()) return
    const ev = await logLeadEvent(leadId, reply.trim(), "confirm_reply", {})
    setItems(prev => pushUnique(prev, ev))
    setReply("")
  }

  // Operator → mark confirmed: log event + move DE CONFIRMAT → IN LUCRU
  async function markConfirmed() {
    const ev = await logLeadEvent(
      leadId,
      "Confirmarea clientului a fost primită. Trimitem la tehnician pentru verificare.",
      "confirm_done",
      {}
    )
    setItems(prev => pushUnique(prev, ev))
    try {
      const res = await moveEverywhere("DE CONFIRMAT", "IN LUCRU")
      toast({ title: `Mutat în "IN LUCRU" pe ${res.length} pipeline-uri.` })
      onMoveStage?.("IN LUCRU")
      router.refresh()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Eroare la mutare", description: e?.message ?? "Move failed" })
    }
  }

  const renderItems = useMemo(() => {
    const seen = new Set<string>()
    const arr: Ev[] = []
    for (const e of items) {
      if (!seen.has(e.id)) {
        seen.add(e.id)
        arr.push(e)
      }
    }
    return arr
  }, [items])

  return (
    <div className="space-y-6">
      <h3 className="font-medium text-lg">De confirmat la client</h3>

      {/* Technician block */}
      <div className="rounded border p-3 bg-muted/30">
        <div className="text-sm font-medium mb-2">Ce trebuie confirmat</div>
        <textarea
          className="w-full h-24 rounded-md border p-2 bg-background"
          placeholder="[scrie in detaliu ce trebuie confirmat cu client si ce s-a facut pana acum cu comanda]."
          value={req}
          onChange={(e) => setReq(e.target.value)}
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={sendRequest} disabled={!req.trim()}>
            Trimite la confirmare &rarr; DE CONFIRMAT
          </Button>
        </div>
      </div>

      {/* Operator block */}
      <div className="rounded border p-3 bg-muted/30">
        <div className="text-sm font-medium mb-2">Răspunsul clientului / notițe operator</div>
        <textarea
          className="w-full h-20 rounded-md border p-2 bg-background"
          placeholder="[scrie in detaliu raspunsul clientului sau intrebarile noi]"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
        />
        <div className="mt-2 flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={sendReply} disabled={!reply.trim()}>Trimite mesaj</Button>
          <Button size="sm" onClick={markConfirmed}>Marchează confirmat &rarr; IN LUCRU</Button>
        </div>
      </div>

      {/* Mini thread (only confirmation-related) */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        <div className="text-sm text-muted-foreground">Istoric “De confirmat”</div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Se încarcă…</div>
        ) : renderItems.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nu există mesaje încă.</div>
        ) : (
          renderItems.map((ev) => (
            <div key={ev.id} className="rounded border p-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{new Date(ev.created_at).toLocaleString()}</span>
                <span>{ev.actor_name ?? "—"}</span>
              </div>
              <div className="mt-1 text-sm whitespace-pre-wrap">{ev.message}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
