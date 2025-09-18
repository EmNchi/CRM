'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRole } from '@/hooks/useRole'
import { listServices, createService, deleteService, type Service } from '@/lib/supabase/serviceOperations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function ServiciiPage() {
  const { role } = useRole()
  const canManage = role === 'owner' || role === 'admin'

  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ name: '', base_price: '', department: '' })

  async function refresh() {
    setLoading(true)
    try { setServices(await listServices()) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  async function onAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage) return
    const price = Number(form.base_price)
    if (!form.name.trim() || isNaN(price) || price < 0) return
    setSubmitting(true)
    try {
      await createService({ name: form.name, base_price: price, department: form.department || undefined })
      setForm({ name: '', base_price: '', department: '' })
      await refresh()
    } finally { setSubmitting(false) }
  }

  async function onDelete(id: string) {
    if (!canManage) return
    await deleteService(id)
    await refresh()
  }

  const totalActive = useMemo(() => services.filter(s => s.active).length, [services])

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between p-6 border-b">
        <h1 className="text-2xl font-semibold">Servicii</h1>
        <div className="text-sm text-muted-foreground">
          {loading ? 'Se încarcă…' : `${totalActive} active • ${services.length} total`}
        </div>
      </header>

      <div className="p-6 space-y-6">
        {canManage && (
          <Card className="p-4">
            <form onSubmit={onAdd} className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <Label htmlFor="name">Denumire</Label>
                <Input id="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Curățare mandrină" required />
              </div>
              <div>
                <Label htmlFor="price">Preț (RON)</Label>
                <Input id="price" inputMode="decimal" value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))} placeholder="250" required />
              </div>
              <div>
                <Label htmlFor="dept">Departament</Label>
                <Input id="dept" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Reparații / Horeca" />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={submitting}>Adaugă</Button>
              </div>
            </form>
          </Card>
        )}

        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Denumire</TableHead>
                <TableHead className="w-40">Preț (RON)</TableHead>
                <TableHead className="w-48">Departament</TableHead>
                {canManage && <TableHead className="w-28 text-right">Acțiuni</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.base_price.toFixed(2)}</TableCell>
                  <TableCell>{s.department ?? '—'}</TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Button variant="destructive" size="sm" onClick={() => onDelete(s.id)}>Șterge</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!loading && services.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 4 : 3} className="text-muted-foreground">
                    Nu există servicii încă.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
