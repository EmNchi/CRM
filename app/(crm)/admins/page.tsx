"use client"

import { useEffect, useState } from "react"
import { useRole } from "@/lib/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Crown, ChevronDown, ChevronUp, Save, Shield, UserPlus, Edit2, X, Check } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { grantPipelineAccess, revokePipelineAccess } from "@/lib/supabase/pipelinePermissions"
import { supabaseBrowser } from "@/lib/supabase/supabaseClient"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface AppMember {
  id: string
  user_id: string
  role: "owner" | "admin" | "member"
  created_at: string
  email?: string
  name?: string
}

const supabase = supabaseBrowser()
const DEFAULT_PASSWORD = "Welcome123"

export default function AdminsPage() {
  const { isOwner, loading: roleLoading } = useRole()
  const [members, setMembers] = useState<AppMember[]>([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState("")
  const [newName, setNewName] = useState("")
  const [newRole, setNewRole] = useState<"owner" | "admin" | "member">("admin")
  const [adding, setAdding] = useState(false)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState<AppMember | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [pipelines, setPipelines] = useState<Array<{ id: string; name: string }>>([])
  const [memberPermissions, setMemberPermissions] = useState<{ [userId: string]: string[] }>({})
  const [savingPermissions, setSavingPermissions] = useState(false)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editingNameValue, setEditingNameValue] = useState("")
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    loadMembers()
    loadPipelines()
  }, [])

  async function loadPipelines() {
    const { data } = await supabase
      .from('pipelines')
      .select('id, name')
      .eq('is_active', true)
      .order('position')
    setPipelines(data || [])
  }

  async function loadMembers() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/members")
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "Error")
      const loadedMembers = data.members || []
      setMembers(loadedMembers)
      
      await loadAllMemberPermissions(loadedMembers.map((m: AppMember) => m.user_id))
    } catch (error: any) {
      toast.error(error.message || "Eroare la încărcare")
    } finally {
      setLoading(false)
    }
  }

  async function loadAllMemberPermissions(userIds: string[]) {
    if (userIds.length === 0) return
    
    const { data } = await supabase
      .from('user_pipeline_permissions')
      .select('user_id, pipeline_id')
      .in('user_id', userIds)
    
    const permsMap: { [userId: string]: string[] } = {}
    userIds.forEach(id => {
      permsMap[id] = []
    })
    
    if (data) {
      data.forEach((p: any) => {
        if (!permsMap[p.user_id]) {
          permsMap[p.user_id] = []
        }
        permsMap[p.user_id].push(p.pipeline_id)
      })
    }
    
    setMemberPermissions(prev => ({ ...prev, ...permsMap }))
  }

  async function loadMemberPermissions(userId: string) {
    const { data } = await supabase
      .from('user_pipeline_permissions')
      .select('pipeline_id')
      .eq('user_id', userId)
    setMemberPermissions(prev => ({ ...prev, [userId]: (data || []).map((p: any) => p.pipeline_id) }))
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!newEmail || !newName) {
      toast.error("Completează toate câmpurile")
      return
    }
    setAdding(true)
    try {
      const res = await fetch("/api/admin/members/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, name: newName, password: DEFAULT_PASSWORD, role: newRole }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "Error")
      toast.success("Membru adăugat")
      setNewEmail("")
      setNewName("")
      setNewRole("admin")
      loadMembers()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setAdding(false)
    }
  }

  async function handleRoleChange(member: AppMember, newRole: "owner" | "admin" | "member") {
    if (member.role === newRole) return
    setUpdatingRole(member.user_id)
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.user_id, role: newRole }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "Error")
      toast.success(`Rol schimbat în ${newRole}`)
      setMembers(prev => prev.map(m => m.user_id === member.user_id ? { ...m, role: newRole } : m))
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setUpdatingRole(null)
    }
  }

  async function handleNameChange(member: AppMember) {
    if (!editingNameValue.trim()) {
      toast.error("Numele nu poate fi gol")
      return
    }
    setSavingName(true)
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.user_id, name: editingNameValue.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "Error")
      toast.success("Nume actualizat")
      setMembers(prev => prev.map(m => m.user_id === member.user_id ? { ...m, name: editingNameValue.trim() } : m))
      setEditingName(null)
      setEditingNameValue("")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSavingName(false)
    }
  }

  async function handleDeleteMember() {
    if (!memberToDelete) return
    setDeleting(true)
    try {
      const res = await fetch("/api/admin/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: memberToDelete.user_id }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "Error")
      toast.success("Membru șters")
      setMembers(prev => prev.filter(m => m.user_id !== memberToDelete.user_id))
      setDeleteDialogOpen(false)
      setMemberToDelete(null)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setDeleting(false)
    }
  }

  function toggleMemberExpanded(userId: string) {
    if (expandedMember === userId) {
      setExpandedMember(null)
    } else {
      setExpandedMember(userId)
      if (!memberPermissions[userId]) {
        loadMemberPermissions(userId)
      }
    }
  }

  function togglePermission(userId: string, pipelineId: string) {
    setMemberPermissions(prev => {
      const current = prev[userId] || []
      return {
        ...prev,
        [userId]: current.includes(pipelineId)
          ? current.filter(id => id !== pipelineId)
          : [...current, pipelineId]
      }
    })
  }

  async function saveMemberPermissions(userId: string) {
    setSavingPermissions(true)
    try {
      const newPerms = memberPermissions[userId] || []
      const { data: currentData } = await supabase
        .from('user_pipeline_permissions')
        .select('pipeline_id')
        .eq('user_id', userId)
      const currentPerms = (currentData || []).map((p: any) => p.pipeline_id)
      const toAdd = newPerms.filter(id => !currentPerms.includes(id))
      const toRemove = currentPerms.filter(id => !newPerms.includes(id))
      for (const pipelineId of toAdd) {
        await grantPipelineAccess(userId, pipelineId)
      }
      for (const pipelineId of toRemove) {
        await revokePipelineAccess(userId, pipelineId)
      }
      toast.success('Permisiuni actualizate')
      await loadMemberPermissions(userId)
    } catch (error: any) {
      toast.error(error.message || 'Eroare')
    } finally {
      setSavingPermissions(false)
    }
  }

  const owners = members.filter(m => m.role === "owner")
  const admins = members.filter(m => m.role === "admin")
  const regularMembers = members.filter(m => m.role === "member")

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Acces restricționat</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Doar proprietarii pot accesa această pagină.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  function MemberRow({ member }: { member: AppMember }) {
    const isExpanded = expandedMember === member.user_id
    const perms = memberPermissions[member.user_id] || []
    const permNames = pipelines.filter(p => perms.includes(p.id)).map(p => p.name)

    return (
      <div className="border rounded-lg overflow-hidden group">
        <div className="flex items-center gap-4 p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleMemberExpanded(member.user_id)}
            className="h-8 w-8 p-0 shrink-0"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{member.email || 'N/A'}</div>
            {editingName === member.user_id ? (
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={editingNameValue}
                  onChange={(e) => setEditingNameValue(e.target.value)}
                  className="h-7 text-xs"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNameChange(member)
                    if (e.key === 'Escape') {
                      setEditingName(null)
                      setEditingNameValue("")
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleNameChange(member)}
                  disabled={savingName}
                  className="h-7 w-7 p-0"
                >
                  {savingName ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingName(null)
                    setEditingNameValue("")
                  }}
                  className="h-7 w-7 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <div className="text-xs text-muted-foreground truncate flex-1">
                  {member.name || 'Fără nume'}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingName(member.user_id)
                    setEditingNameValue(member.name || "")
                  }}
                  className="h-6 w-6 p-0 shrink-0 opacity-60 hover:opacity-100"
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              </div>
            )}
            {perms.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {permNames.slice(0, 2).join(', ')}{permNames.length > 2 ? ` +${permNames.length - 2}` : ''}
              </div>
            )}
          </div>
          
          <div className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
            {perms.length} pipeline-uri
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {member.role !== "owner" && (
              <Select
                value={member.role}
                onValueChange={(v) => handleRoleChange(member, v as any)}
                disabled={updatingRole === member.user_id}
              >
                <SelectTrigger className="w-[110px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">member</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="owner">owner</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMemberToDelete(member)
                setDeleteDialogOpen(true)
              }}
              className="h-9"
            >
              Șterge
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 pt-0 space-y-4 border-t bg-muted/30">
            <div className="flex items-center gap-2 pt-4">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">Permisiuni Pipeline-uri</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pipelines.map(pipeline => (
                <div key={pipeline.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`${member.user_id}-${pipeline.id}`}
                    checked={perms.includes(pipeline.id)}
                    onCheckedChange={() => togglePermission(member.user_id, pipeline.id)}
                  />
                  <Label htmlFor={`${member.user_id}-${pipeline.id}`} className="text-sm cursor-pointer">
                    {pipeline.name}
                  </Label>
                </div>
              ))}
            </div>
            <Button
              onClick={() => saveMemberPermissions(member.user_id)}
              disabled={savingPermissions}
              size="sm"
              className="w-full"
            >
              {savingPermissions && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Salvează Permisiuni
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-xl">ADMINISTRARE ECHIPA</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Adaugă Membru Nou</h2>
            </div>
            
            <form onSubmit={handleAddMember} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input
                type="email"
                placeholder="Email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="h-10"
              />
              <Input
                type="text"
                placeholder="Nume"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-10"
              />
              <Select value={newRole} onValueChange={(v) => setNewRole(v as any)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">member</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="owner">owner</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={adding || !newEmail || !newName} className="h-10">
                {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Adaugă
              </Button>
            </form>
            
            <p className="text-sm text-muted-foreground">
              Parola inițială: <span className="font-mono font-medium">{DEFAULT_PASSWORD}</span>
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">OWNER</h3>
                </div>
                <div className="space-y-2">
                  {owners.map(m => <MemberRow key={m.user_id} member={m} />)}
                  {owners.length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-foreground border rounded-lg">
                      Niciun owner
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">ADMINI</h3>
                <div className="space-y-2">
                  {admins.map(m => <MemberRow key={m.user_id} member={m} />)}
                  {admins.length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-foreground border rounded-lg">
                      Niciun admin
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">MEMBRI</h3>
                <div className="space-y-2">
                  {regularMembers.map(m => <MemberRow key={m.user_id} member={m} />)}
                  {regularMembers.length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-foreground border rounded-lg">
                      Niciun membru
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Șterge membrul?</AlertDialogTitle>
            <AlertDialogDescription>
              Ești sigur că vrei să ștergi {memberToDelete?.email}? Această acțiune nu poate fi anulată.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMember} disabled={deleting}>
              {deleting ? "Se șterge..." : "Șterge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
