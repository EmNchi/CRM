"use client"

import { useEffect, useState } from "react"
import { useRole } from "@/hooks/useRole"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Trash2, Shield, UserPlus, Loader2, Crown } from "lucide-react"
import { toast } from "sonner"
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
}

// Helper pentru a obține key-ul unic
const getMemberKey = (m: AppMember) => m.id || m.user_id

const DEFAULT_PASSWORD = "Welcome123!"

export default function AdminsPage() {
  const { isOwner, loading: roleLoading } = useRole()
  const [members, setMembers] = useState<AppMember[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState<AppMember | null>(null)
  const [deleting, setDeleting] = useState(false)
  
  // Add member inline
  const [newEmail, setNewEmail] = useState("")
  const [newRole, setNewRole] = useState<"owner" | "admin" | "member">("admin")
  const [adding, setAdding] = useState(false)

  // Role update
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)

  useEffect(() => {
    loadMembers()
  }, [])

  async function loadMembers() {
    setLoading(true)
    try {
      // Folosește API-ul care obține și email-urile din auth
      const res = await fetch("/api/admin/members")
      const data = await res.json()
      
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Eroare la încărcare")
      }

      setMembers(data.members || [])
    } catch (error) {
      console.error("Error loading members:", error)
      toast.error("Eroare la încărcarea membrilor")
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteMember() {
    if (!memberToDelete) return
    
    const memberKey = getMemberKey(memberToDelete)
    setDeleting(true)
    try {
      // Folosim user_id pentru identificare
      const res = await fetch("/api/admin/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: memberToDelete.user_id }),
      })
      
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Eroare la ștergere")
      }

      toast.success("Membrul a fost șters")
      setMembers(prev => prev.filter(m => getMemberKey(m) !== memberKey))
      setDeleteDialogOpen(false)
      setMemberToDelete(null)
    } catch (error: any) {
      console.error("Error deleting member:", error)
      toast.error(`Eroare la ștergere: ${error.message}`)
    } finally {
      setDeleting(false)
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    
    if (!newEmail) {
      toast.error("Introdu adresa de email")
      return
    }

    setAdding(true)
    try {
      const res = await fetch("/api/admin/members/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          password: DEFAULT_PASSWORD,
          role: newRole,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Eroare la adăugare")
      }

      toast.success("Membrul a fost adăugat")
      setNewEmail("")
      setNewRole("admin")
      loadMembers()
    } catch (error: any) {
      console.error("Error adding member:", error)
      toast.error(`Eroare: ${error.message}`)
    } finally {
      setAdding(false)
    }
  }

  async function handleRoleChange(member: AppMember, newRoleValue: "owner" | "admin" | "member") {
    if (member.role === newRoleValue) return
    
    const memberKey = getMemberKey(member)
    setUpdatingRole(memberKey)
    try {
      // Folosim user_id pentru identificare (este cheia primară în app_members)
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.user_id, role: newRoleValue }),
      })
      
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Eroare la actualizare")
      }

      toast.success(`Rolul a fost schimbat în ${newRoleValue}`)
      setMembers(prev => prev.map(m => 
        getMemberKey(m) === memberKey ? { ...m, role: newRoleValue } : m
      ))
    } catch (error: any) {
      console.error("Error updating role:", error)
      toast.error(`Eroare: ${error.message}`)
    } finally {
      setUpdatingRole(null)
    }
  }

  // Grupează membrii pe roluri
  const owners = members.filter(m => m.role === "owner")
  const admins = members.filter(m => m.role === "admin")
  const regularMembers = members.filter(m => m.role === "member")

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />
              Acces restricționat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Nu ai permisiunea de a accesa această pagină. Doar proprietarii pot gestiona membrii.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-lg font-medium tracking-wide">
            ADMINISTRARE ECHIPA
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-8">
          
          {/* Adaugă membru - inline form */}
          <div className="space-y-2">
            <form onSubmit={handleAddMember} className="flex items-center gap-2 p-3 border rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium">
                <UserPlus className="h-4 w-4" />
                <span>+ Adauga membru</span>
              </div>
              <Input
                type="email"
                placeholder="[Email]"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="max-w-[200px] h-8"
              />
              <Select value={newRole} onValueChange={(v) => setNewRole(v as any)}>
                <SelectTrigger className="w-[120px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">member</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="owner">owner</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" variant="outline" size="sm" disabled={adding || !newEmail}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "[Adauga]"}
              </Button>
            </form>
            <p className="text-sm text-muted-foreground px-1">
              Parola initiala: <span className="font-mono font-medium">{DEFAULT_PASSWORD}</span> (utilizatorul o va schimba la login)
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* OWNER section */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">OWNER</h3>
                <div className="border rounded-lg divide-y">
                  {owners.map((member) => (
                    <div key={getMemberKey(member)} className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-yellow-500" />
                        <span className="font-mono text-sm">{member.email}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">owner</span>
                    </div>
                  ))}
                  {owners.length === 0 && (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      Niciun owner
                    </div>
                  )}
                </div>
              </div>

              {/* ADMINI section */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">ADMINI</h3>
                <div className="border rounded-lg divide-y">
                  {admins.map((member) => (
                    <div key={getMemberKey(member)} className="flex items-center justify-between p-3">
                      <span className="font-mono text-sm">{member.email}</span>
                      <div className="flex items-center gap-2">
                        <Select 
                          value={member.role} 
                          onValueChange={(v) => handleRoleChange(member, v as any)}
                          disabled={updatingRole === getMemberKey(member)}
                        >
                          <SelectTrigger className="w-[100px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">member</SelectItem>
                            <SelectItem value="admin">admin</SelectItem>
                            <SelectItem value="owner">owner</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setMemberToDelete(member)
                            setDeleteDialogOpen(true)
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          [Sterge]
                        </Button>
                      </div>
                    </div>
                  ))}
                  {admins.length === 0 && (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      Niciun admin
                    </div>
                  )}
                </div>
              </div>

              {/* MEMBRI section */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">MEMBRI</h3>
                <div className="border rounded-lg divide-y">
                  {regularMembers.map((member) => (
                    <div key={getMemberKey(member)} className="flex items-center justify-between p-3">
                      <span className="font-mono text-sm">{member.email}</span>
                      <div className="flex items-center gap-2">
                        <Select 
                          value={member.role} 
                          onValueChange={(v) => handleRoleChange(member, v as any)}
                          disabled={updatingRole === getMemberKey(member)}
                        >
                          <SelectTrigger className="w-[100px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">member</SelectItem>
                            <SelectItem value="admin">admin</SelectItem>
                            <SelectItem value="owner">owner</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setMemberToDelete(member)
                            setDeleteDialogOpen(true)
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          [Sterge]
                        </Button>
                      </div>
                    </div>
                  ))}
                  {regularMembers.length === 0 && (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      Niciun membru
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
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
            <AlertDialogAction
              onClick={handleDeleteMember}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Se șterge..." : "Șterge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
