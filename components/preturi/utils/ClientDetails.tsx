'use client'

import { Checkbox } from '@/components/ui/checkbox'
import type { Lead } from '@/app/(crm)/dashboard/page'

interface ClientDetailsProps {
  lead: Lead | null
  noDeal: boolean
  nuRaspunde: boolean
  callBack: boolean
  onNoDealChange: (checked: boolean) => void
  onNuRaspundeChange: (checked: boolean) => void
  onCallBackChange: (checked: boolean) => void
  showCheckboxes?: boolean
}

/**
 * Componentă independentă pentru afișarea și gestionarea detaliilor clientului
 * Include informațiile de contact și checkboxes-urile pentru acțiuni lead
 */
export function ClientDetails({
  lead,
  noDeal,
  nuRaspunde,
  callBack,
  onNoDealChange,
  onNuRaspundeChange,
  onCallBackChange,
  showCheckboxes = true,
}: ClientDetailsProps) {
  if (!lead) return null

  return (
    <div className="space-y-4">
      {/* Informații Contact */}
      <div className="px-4 py-3 bg-muted/30 border rounded-lg">
        <h3 className="font-medium text-sm mb-2">Informații Contact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Nume: </span>
            <span className="font-medium">{lead.name || '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Email: </span>
            <span className="font-medium">{lead.email || '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Telefon: </span>
            <span className="font-medium">{lead.phone || '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Oraș: </span>
            <span className="font-medium">{lead.city || '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Adresa: </span>
            <span className="font-medium">{lead.address || '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Adresa 2: </span>
            <span className="font-medium">{lead.address2 || '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Cod postal: </span>
            <span className="font-medium">{lead.zip || '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Denumirea Companiei: </span>
            <span className="font-medium">{lead.company_name || '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Adresa companiei: </span>
            <span className="font-medium">{lead.company_address || '—'}</span>
          </div>
        </div>
      </div>

      {/* Checkboxes pentru acțiuni lead - accesibile pentru toți utilizatorii */}
      {showCheckboxes && (
        <div className="px-4 py-3 bg-muted/30 border rounded-lg">
          <h4 className="font-medium text-sm mb-3">Acțiuni Lead</h4>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={noDeal}
                onCheckedChange={onNoDealChange}
                className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
              />
              <span className={`text-sm font-medium ${noDeal ? 'text-red-600' : 'text-muted-foreground'}`}>
                No Deal
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={callBack}
                onCheckedChange={onCallBackChange}
                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <span className={`text-sm font-medium ${callBack ? 'text-blue-600' : 'text-muted-foreground'}`}>
                Call Back
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={nuRaspunde}
                onCheckedChange={onNuRaspundeChange}
                className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
              />
              <span className={`text-sm font-medium ${nuRaspunde ? 'text-orange-600' : 'text-muted-foreground'}`}>
                Nu Răspunde
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}



