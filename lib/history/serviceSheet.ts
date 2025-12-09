// lib/history/serviceSheet.ts
import { logLeadEvent } from "@/lib/supabase/leadOperations"
import {
  addServiceItem,
  addPartItem,
  updateItem,
  deleteItem,
  listQuoteItems,
  type LeadQuoteItem,
} from "@/lib/supabase/quoteOperations"
import type { Service } from "@/lib/supabase/serviceOperations"

type SnapshotItem = {
  id: string
  name: string
  qty: number
  price: number
  type: string
  urgent: boolean
  department?: string | null
  technician?: string | null
}

type Totals = {
  subtotal: number
  totalDiscount: number
  urgentAmount: number
  total: number
}

const isLocalId = (id: string | number) => String(id).startsWith("local_")

const toSnap = (i: any): SnapshotItem => ({
  id: String(i.id ?? `${i.name_snapshot}:${i.item_type}`),
  name: i.name_snapshot,
  qty: Number(i.qty ?? 1),
  price: Number(i.unit_price_snapshot ?? 0),
  type: String(i.item_type ?? "service"),
  urgent: !!i.urgent,
  department: i.department ?? null,
  technician: i.technician ?? null,
})

function toMap(arr: SnapshotItem[]) {
  return Object.fromEntries(arr.map(x => [String(x.id), x]))
}

function diffSnapshots(prev: SnapshotItem[], next: SnapshotItem[]) {
  const pm = toMap(prev)
  const nm = toMap(next)
  const added = next.filter(x => !pm[x.id])
  const removed = prev.filter(x => !nm[x.id])
  const updated = next.filter(x => {
    const p = pm[x.id]
    return p && (p.qty !== x.qty || p.price !== x.price || p.urgent !== x.urgent || p.department !== x.department || p.technician !== x.technician || p.name !== x.name)
  })
  return { added, removed, updated, prevMap: pm }
}

function composeMessage(next: SnapshotItem[], d: ReturnType<typeof diffSnapshots>, totals: Totals) {
  const servicesCount = next.filter(i => i.type === "service").length
  const partsCount = next.length - servicesCount
  const urgentCount = next.filter(i => i.urgent).length

  const chunks: string[] = []
  if (d.added.length)   chunks.push(`adăugate: ${d.added.slice(0,3).map(x=>x.name).join(", ")}${d.added.length>3?"…":""}`)
  if (d.removed.length) chunks.push(`șterse: ${d.removed.slice(0,3).map(x=>x.name).join(", ")}${d.removed.length>3?"…":""}`)
  if (d.updated.length) chunks.push(`actualizate: ${d.updated.slice(0,3).map(x=>x.name).join(", ")}${d.updated.length>3?"…":""}`)

  const headline = chunks.length ? `Fișa de serviciu salvată (${chunks.join(" · ")})` : "Fișa de serviciu salvată"
  const message =
    `${headline}. ` +
    `servicii=${servicesCount}, piese=${partsCount}, linii_urgente=${urgentCount}, total=${totals.total.toFixed(2)} RON.`

  const payload = (diff: ReturnType<typeof diffSnapshots>) => ({
    totals: {
      subtotal: totals.subtotal,
      total_discount: totals.totalDiscount,
      urgent_amount: totals.urgentAmount,
      total: totals.total,
    },
    counts: { services: servicesCount, parts: partsCount, urgent_lines: urgentCount },
    diff: {
      added: diff.added.map(x => ({
        id: x.id, name: x.name, type: x.type,
        department: x.department ?? null, technician: x.technician ?? null,
      })),
      removed: diff.removed.map(x => ({
        id: x.id, name: x.name, type: x.type,
        department: x.department ?? null, technician: x.technician ?? null,
      })),
      updated: diff.updated.map(x => ({
        id: x.id, name: x.name, type: x.type,
        department: x.department ?? null, technician: x.technician ?? null,
      })),
    },
  })

  return { message, payload: payload }
}

export async function persistAndLogServiceSheet(params: {
  leadId: string
  quoteId: string
  items: LeadQuoteItem[]
  services: Service[]           // for mapping service name → service def when adding new rows
  totals: Totals
  prevSnapshot: SnapshotItem[]  // what DB had on last save/load (use toSnap on DB items)
}) {
  const { leadId, quoteId, items, services, totals, prevSnapshot } = params

  // === 1) APPLY CHANGES TO DB (delete, update, add) ===

  // Deletes: anything that existed before (real DB id) but not anymore in current items
  const currentDbIds = new Set(items.filter(it => !isLocalId(it.id)).map(it => String(it.id)))
  for (const prev of prevSnapshot) {
    const wasDbId = !isLocalId(prev.id)
    if (wasDbId && !currentDbIds.has(String(prev.id))) {
      await deleteItem(String(prev.id))
    }
  }

  // Updates: rows that still exist and changed
  const beforeMap = new Map(prevSnapshot.map(b => [String(b.id), b]))
  for (const it of items) {
    if (isLocalId(it.id)) continue
    const prev = beforeMap.get(String(it.id))
    if (!prev) continue

    const patch: any = {}
    if (Number(it.qty) !== Number(prev.qty)) patch.qty = Number(it.qty)
    if (Number(it.unit_price_snapshot) !== Number(prev.price)) patch.unit_price_snapshot = Number(it.unit_price_snapshot)
    if (Number(it.discount_pct) !== Number((it as any).discount_pct ?? 0)) patch.discount_pct = Number(it.discount_pct ?? 0)
    if (Boolean(it.urgent) !== Boolean(prev.urgent)) patch.urgent = !!it.urgent
    if ((it.department ?? null) !== prev.department) patch.department = it.department ?? null
    if ((it.technician ?? null) !== prev.technician) patch.technician = it.technician ?? null
    // For parts, name can be edited:
    if (it.item_type === "part" && (it.name_snapshot ?? "") !== (prev.name ?? "")) {
      patch.name_snapshot = it.name_snapshot ?? prev.name
    }

    if (Object.keys(patch).length) {
      await updateItem(String(it.id), patch)
    }
  }

  // Adds: local rows (id starts with local_)
  for (const it of items) {
    if (!isLocalId(it.id)) continue

    if (it.item_type === "service") {
      // match by service_id first, then fallback to name
      const svcDef = it.service_id 
        ? services.find(s => s.id === it.service_id)
        : services.find(s => s.name === it.name_snapshot)
      if (!svcDef) continue
      await addServiceItem(quoteId, svcDef, {
        qty: Number(it.qty ?? 1),
        discount_pct: Number(it.discount_pct ?? 0),
        urgent: !!it.urgent,
        technician: it.technician ?? null,
        department: it.department ?? null,
      })
    } else {
      // part
      await addPartItem(quoteId, it.name_snapshot as string, Number(it.unit_price_snapshot ?? 0), {
        qty: Number(it.qty ?? 1),
        discount_pct: Number(it.discount_pct ?? 0),
        urgent: !!it.urgent,
        department: it.department ?? null,
        technician: it.technician ?? null,
      })
    }
  }

  // === 2) Reload canonical DB rows ===
  const fresh = await listQuoteItems(quoteId)
  const freshSnap = (fresh ?? []).map(toSnap)

  // === 3) Compose message + payload and log ===
  const d = diffSnapshots(prevSnapshot, freshSnap)
  const { message, payload } = composeMessage(freshSnap, d, totals)
  await logLeadEvent(leadId, message, "service_sheet_save", payload(d))

  // === 4) Return new items + snapshot for the caller to update UI flags ===
  return { items: fresh ?? [], snapshot: freshSnap }
}
