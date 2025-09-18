"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { Plus, Users, UserPlus, LayoutDashboard, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { Lead } from "@/app/page"
import { useRouter } from "next/navigation"
import { useRole } from '@/hooks/useRole'
import { Wrench } from "lucide-react";

interface SidebarProps {
  leads: Lead[]
  onLeadSelect: (leadId: string) => void
  pipelines: string[]                 
  canManagePipelines?: boolean
  onRefresh?: () => Promise<void> | void  
}

const toSlug = (s: string) => String(s).toLowerCase().replace(/\s+/g, "-")

export function Sidebar({ pipelines, canManagePipelines, onRefresh }: SidebarProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"admin" | "owner" | "member">("admin")
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const params = useParams<{ pipeline?: string }>()
  const pipelineSlug =
    params?.pipeline ??
    pathname.match(/^\/leads\/([^\/?#]+)/)?.[1] ??
    undefined

  const { isOwner, loading: roleLoading } = useRole()

  const [createOpen, setCreateOpen] = useState(false)       
  const [pipelineName, setPipelineName] = useState("")      
  const [creating, setCreating] = useState(false)           
  const [createError, setCreateError] = useState<string|null>(null) 

  const canManage = (typeof canManagePipelines === 'boolean') ? canManagePipelines : isOwner

  async function handleCreatePipeline(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: pipelineName }),
      })
  
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to create pipeline")
  
      // close + clear
      setCreateOpen(false)
      setPipelineName("")
  
      try {
        router.refresh?.()
      } catch {
      }

      await onRefresh?.()
  
    } catch (err: any) {
      setCreateError(err.message || "Failed")
    } finally {
      setCreating(false)
    }
  }

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTargetName, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  function openDelete(p: string, e?: React.MouseEvent) {
    e?.preventDefault()
    e?.stopPropagation()
    setDeleteTarget(p)
    setDeleteOpen(true)
  }

  async function handleConfirmDelete() {
    if (!deleteTargetName) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/pipelines?name=${encodeURIComponent(deleteTargetName)}`, { method: "DELETE" })
      const ct = res.headers.get("content-type") || ""
      const payload = ct.includes("application/json") ? await res.json() : { error: await res.text() }
      if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`)

      setDeleteOpen(false)
      const removed = deleteTargetName
      setDeleteTarget(null)

      await onRefresh?.() 
  
      const removedPath = `/leads/${toSlug(removed)}`
      if (pathname === removedPath) {
        router.push("/dashboard")
      }
  
      router.refresh()
    } catch (e: any) {
      setDeleting(false)
      alert(e.message ?? "Delete failed")
      return
    }
    setDeleting(false)
  }

  async function onAddMember(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setMsg(null)
    try {
      const res = await fetch("/api/admin/members/add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      })
      const j = await res.json()
      if (!res.ok || !j.ok) throw new Error(j.error || "Failed")
      setMsg("Member added ✅")
      setEmail("")
      setPassword("")
      setRole("admin")
    } catch (err: any) {
      setMsg(`Error: ${err.message || "failed"}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-sidebar-foreground" />
          <h2 className="font-semibold text-sidebar-foreground">ascutzit.ro – CRM</h2>
        </div>

        {/* Main nav */}
        <nav className="space-y-2 mb-6">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-sidebar-accent",
              pathname === "/" && "bg-sidebar-accent"
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>

          <div className="mt-4">
          <div className="flex items-center justify-between px-2 text-xs uppercase tracking-wide text-muted-foreground mb-2">
            <span>Pipelines</span>
            {canManage && (
              <button
                type="button"
                aria-label="Add pipeline"
                onClick={() => setCreateOpen(true)}
                className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-sidebar-accent"
                title="Add pipeline"
              >
                <Plus className="h-3 w-3" />
              </button>
            )}
          </div>
            <ul className="space-y-1">
              {pipelines.map((p, i) => {
                const href = `/leads/${toSlug(p)}`
                const active = pathname === href
                return (
                  <li key={`${p}-${i}`}>
                    <div
                      className={cn(
                        "group flex items-center justify-between px-2 py-1.5 rounded hover:bg-sidebar-accent",
                        active && "bg-sidebar-accent"
                      )}
                    >
                      <Link href={href} className="min-w-0 flex-1 truncate">
                        {p}
                      </Link>

                      {canManage && (
                        <button
                          type="button"
                          onClick={(e) => openDelete(p, e)}
                          className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded hover:bg-background/50 opacity-80 hover:opacity-100"
                          aria-label={`Delete ${p}`}
                          title="Delete pipeline"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>New pipeline</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleCreatePipeline} className="space-y-3">
                  <div>
                    <label className="block text-xs text-sidebar-foreground/70 mb-1">Pipeline name</label>
                    <input
                      autoFocus
                      required
                      value={pipelineName}
                      onChange={(e) => setPipelineName(e.target.value)}
                      className="border rounded px-2 py-1 w-full bg-background"
                      placeholder="e.g. Vânzări"
                    />
                  </div>

                  {createError && <p className="text-xs text-red-500">{createError}</p>}

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={creating}>{creating ? "Creating…" : "Create"}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Delete pipeline?</DialogTitle>
                </DialogHeader>

                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete “{deleteTargetName}”? This will remove the pipeline,
                  <b> all its stages</b> and <b>all leads</b>. This action cannot be undone.
                </p>

                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
                    {deleting ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div aria-hidden className="mx-auto h-px w-50 rounded-full bg-gradient-to-r from-transparent via-neutral-300 to-transparent" />

          <Link
              href="/servicii"
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted",
                pathname === "/servicii" && "bg-muted"
              )}
            >
              <Wrench className="h-4 w-4" />
              <span>Servicii</span>
          </Link>
        </nav>

        {/* Add members */}
        <div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent px-0 p-0"
            onClick={() => setAddOpen(v => !v)}
          >
            <span>Add members</span>
            <UserPlus className="h-4 w-4" />
          </Button>

          {addOpen && (
            <form onSubmit={onAddMember} className="space-y-2">
              <div className="space-y-1">
                <label className="block text-xs text-sidebar-foreground/70">Email</label>
                <input
                  className="border rounded px-2 py-1 w-full bg-background"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-sidebar-foreground/70">Temp password</label>
                <input
                  className="border rounded px-2 py-1 w-full bg-background"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <p className="text-[10px] text-muted-foreground">They can change it after first login.</p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-sidebar-foreground/70">Role</label>
                <select
                  className="border rounded px-2 py-1 w-full bg-background"
                  value={role}
                  onChange={e => setRole(e.target.value as any)}
                >
                  <option value="admin">admin</option>
                  <option value="owner">owner</option>
                  <option value="member">member</option>
                </select>
              </div>

              <Button className="w-full" disabled={submitting}>
                {submitting ? "Adding…" : "Add member"}
              </Button>

              {msg && <p className="text-xs">{msg}</p>}
            </form>
          )}
        </div>
      </div>
    </aside>
  )
}
