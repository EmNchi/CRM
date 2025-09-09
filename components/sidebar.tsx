"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, ChevronRight, Users, UserPlus, LayoutDashboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Lead } from "@/app/page"

interface SidebarProps {
  leads: Lead[]
  onLeadSelect: (leadId: string) => void
  pipelines: String[]
}

const toSlug = (s: string) => String(s).toLowerCase().replace(/\s+/g, "-")

export function Sidebar({ pipelines }: SidebarProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"admin" | "owner" | "member">("admin")
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const pathname = usePathname()

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
            <div className="px-2 text-xs uppercase tracking-wide text-muted-foreground mb-2">Pipelines</div>
            <ul className="space-y-1">
              {pipelines.map((name, i) => {
                const href = `/leads/${toSlug(name)}`
                const active = pathname === href
                return (
                  <li key={`${name}-${i}`}>
                    <Link
                      href={href}
                      className={cn(
                        "block px-2 py-1.5 rounded hover:bg-sidebar-accent",
                        active && "bg-sidebar-accent"
                      )}
                    >
                      {String(name)}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
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
