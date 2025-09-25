'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRole } from '@/hooks/useRole'
import { listServices, createService, deleteService, type Service } from '@/lib/supabase/serviceOperations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { listTechnicians, createTechnician, deleteTechnician, type Technician } from '@/lib/supabase/technicianOperations'
import { listParts, createPart, deletePart, type Part } from '@/lib/supabase/partOperations'
import { listTags, createTag, deleteTag, type Tag, type TagColor, updateTag } from '@/lib/supabase/tagOperations'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

const supabase = supabaseBrowser()

export default function ServiciiPage() {
  const { role } = useRole()
  const canManage = role === 'owner' || role === 'admin'

  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ name: '', base_price: ''})

    // technicians
  const [techs, setTechs] = useState<Technician[]>([])
  const [techLoading, setTechLoading] = useState(true)
  const [techSubmitting, setTechSubmitting] = useState(false)
  const [techName, setTechName] = useState('')

  // parts
  const [parts, setParts] = useState<Part[]>([])
  const [partLoading, setPartLoading] = useState(true)
  const [partSubmitting, setPartSubmitting] = useState(false)
  const [partForm, setPartForm] = useState({ name: '', base_price: '' })

  //tags
  const [tags, setTags] = useState<Tag[]>([])
  const [tagLoading, setTagLoading] = useState(true)
  const [tagSubmitting, setTagSubmitting] = useState(false)
  const [tagForm, setTagForm] = useState<{ name: string; color: TagColor }>({ name: '', color: 'green' })

  useEffect(() => {
    const ch = supabase
      .channel('rt-tags-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' },
        () => refreshTags()
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function refreshTags() {
    setTagLoading(true)
    try { setTags(await listTags()) } finally { setTagLoading(false) }
  }
  
  async function onAddTag(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage) return
    if (!tagForm.name.trim()) return
    setTagSubmitting(true)
    try {
      await createTag(tagForm.name.trim(), tagForm.color)
      setTagForm({ name: '', color: 'green' })
      await refreshTags()
    } finally { setTagSubmitting(false) }
  }
  
  async function onDeleteTag(id: string) {
    if (!canManage) return
    await deleteTag(id)
    await refreshTags()
  }
                    
  async function refreshTechs() {
    setTechLoading(true)
    try { setTechs(await listTechnicians()) } finally { setTechLoading(false) }
  }
  
  async function refreshParts() {
    setPartLoading(true)
    try { setParts(await listParts()) } finally { setPartLoading(false) }
  }
  
  useEffect(() => {
    refresh()           
    refreshTechs()
    refreshParts()
    refreshTags()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function refresh() {
    setLoading(true)
    try { setServices(await listServices()) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  async function onAddTechnician(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage) return
    if (!techName.trim()) return
    setTechSubmitting(true)
    try {
      await createTechnician(techName)
      setTechName('')
      await refreshTechs()
    } finally { setTechSubmitting(false) }
  }
  
  async function onDeleteTechnician(id: string) {
    if (!canManage) return
    await deleteTechnician(id)
    await refreshTechs()
  }
  
  async function onAddPart(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage) return
    const price = Number(partForm.base_price)
    if (!partForm.name.trim() || isNaN(price) || price < 0) return
    setPartSubmitting(true)
    try {
      await createPart({ name: partForm.name, base_price: price })
      setPartForm({ name: '', base_price: '' })
      await refreshParts()
    } finally { setPartSubmitting(false) }
  }
  
  async function onDeletePart(id: string) {
    if (!canManage) return
    await deletePart(id)
    await refreshParts()
  }  

  async function onAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage) return
    const price = Number(form.base_price)
    if (!form.name.trim() || isNaN(price) || price < 0) return
    setSubmitting(true)
    try {
      await createService({ name: form.name, base_price: price})
      setForm({ name: '', base_price: ''})
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
                {canManage && <TableHead className="w-28 text-right">Acțiuni</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.base_price.toFixed(2)}</TableCell>
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

      {/* ===== Tehnicieni ===== */}
      <header className="flex items-center justify-between p-6 border-b">
        <h1 className="text-2xl font-semibold">Tehnicieni</h1>
        <div className="text-sm text-muted-foreground">
          {techLoading ? 'Se încarcă…' : `${techs.length} înregistrări`}
        </div>
      </header>

      <div className="p-6 space-y-6">
        {canManage && (
          <Card className="p-4">
            <form onSubmit={onAddTechnician} className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-3">
                <Label htmlFor="tech-name">Nume</Label>
                <Input id="tech-name" value={techName} onChange={e => setTechName(e.target.value)} placeholder="Alex Popescu" required />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={techSubmitting}>Adaugă</Button>
              </div>
            </form>
          </Card>
        )}

        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nume</TableHead>
                {canManage && <TableHead className="w-28 text-right">Acțiuni</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {techs.map(t => (
                <TableRow key={t.id}>
                  <TableCell
                    className="font-medium cursor-pointer"
                    title="Dublu-click pentru redenumire"
                    onDoubleClick={async () => {
                      const v = prompt('Nume nou', t.name)
                      if (v && v.trim() && v.trim() !== t.name) {
                        await updateTag(t.id, { name: v.trim() })
                        await refreshTags()
                      }
                    }}
                  >
                    {t.name}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Button variant="destructive" size="sm" onClick={() => onDeleteTechnician(t.id)}>Șterge</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!techLoading && techs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 2 : 1} className="text-muted-foreground">
                    Nu există tehnicieni încă.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* ===== Piese ===== */}
      <header className="flex items-center justify-between p-6 border-b">
        <h1 className="text-2xl font-semibold">Piese</h1>
        <div className="text-sm text-muted-foreground">
          {partLoading ? 'Se încarcă…' : `${parts.length} înregistrări`}
        </div>
      </header>

      <div className="p-6 space-y-6">
        {canManage && (
          <Card className="p-4">
            <form onSubmit={onAddPart} className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <Label htmlFor="part-name">Denumire</Label>
                <Input id="part-name" value={partForm.name} onChange={e => setPartForm(f => ({ ...f, name: e.target.value }))} placeholder="Garnitură" required />
              </div>
              <div>
                <Label htmlFor="part-price">Preț (RON)</Label>
                <Input id="part-price" inputMode="decimal" value={partForm.base_price} onChange={e => setPartForm(f => ({ ...f, base_price: e.target.value }))} placeholder="50" required />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={partSubmitting}>Adaugă</Button>
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
                {canManage && <TableHead className="w-28 text-right">Acțiuni</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {parts.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.base_price.toFixed(2)}</TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Button variant="destructive" size="sm" onClick={() => onDeletePart(p.id)}>Șterge</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!partLoading && parts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 3 : 2} className="text-muted-foreground">
                    Nu există piese încă.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* ===== Tag-uri ===== */}
      <header className="flex items-center justify-between p-6 border-b">
        <h1 className="text-2xl font-semibold">Tag-uri</h1>
        <div className="text-sm text-muted-foreground">
          {tagLoading ? 'Se încarcă…' : `${tags.length} înregistrări`}
        </div>
      </header>

      <div className="p-6 space-y-6">
        {canManage && (
          <Card className="p-4">
            <form onSubmit={onAddTag} className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <Label htmlFor="tag-name">Denumire</Label>
                <Input
                  id="tag-name"
                  value={tagForm.name}
                  onChange={e => setTagForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ex. VIP, URGENT, NU"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="tag-color">Culoare</Label>
                <Select value={tagForm.color} onValueChange={(v) => setTagForm(f => ({ ...f, color: v as TagColor }))}>
                  <SelectTrigger id="tag-color">
                    <SelectValue placeholder="Alege culoarea" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="green">Verde</SelectItem>
                    <SelectItem value="yellow">Galben</SelectItem>
                    <SelectItem value="red">Roșu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={tagSubmitting}>Adaugă</Button>
              </div>
            </form>
          </Card>
        )}

        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nume</TableHead>
                <TableHead className="w-40">Culoare</TableHead>
                {canManage && <TableHead className="w-28 text-right">Acțiuni</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="w-48">
                    <Select
                      value={t.color}
                      onValueChange={async (v) => {
                        if (v !== t.color) {
                          await updateTag(t.id, { color: v as TagColor })
                          await refreshTags()
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="green">Verde</SelectItem>
                        <SelectItem value="yellow">Galben</SelectItem>
                        <SelectItem value="red">Roșu</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Button variant="destructive" size="sm" onClick={() => onDeleteTag(t.id)}>Șterge</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!tagLoading && tags.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 3 : 2} className="text-muted-foreground">
                    Nu există tag-uri încă.
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
