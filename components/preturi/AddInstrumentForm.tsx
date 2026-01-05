'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Wrench } from 'lucide-react'

interface AddInstrumentFormProps {
  instrumentForm: {
    instrument: string
    qty: string
  }
  availableInstruments: Array<{ id: string; name: string }>
  instrumentSettings: Record<string, any>
  hasServicesOrInstrumentInSheet: boolean
  isVanzariPipeline: boolean
  isDepartmentPipeline: boolean
  isTechnician: boolean
  onInstrumentChange: (instrumentId: string) => void
  onQtyChange: (qty: string) => void
}

export function AddInstrumentForm({
  instrumentForm,
  availableInstruments,
  instrumentSettings,
  hasServicesOrInstrumentInSheet,
  isVanzariPipeline,
  isDepartmentPipeline,
  isTechnician,
  onInstrumentChange,
  onQtyChange,
}: AddInstrumentFormProps) {
  // Nu afișa formularul pentru tehnicieni în pipeline-uri departament
  if (isDepartmentPipeline && isTechnician) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg border border-green-200 dark:border-green-800 mx-4 p-3">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-900 dark:text-green-100">Adaugă Instrument</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="col-span-1 sm:col-span-8">
          <Label className="text-xs text-muted-foreground mb-1 block">Instrument</Label>
          <select
            className="w-full h-8 text-sm rounded-md border px-2 bg-white dark:bg-background disabled:opacity-50 disabled:cursor-not-allowed"
            value={instrumentForm.instrument}
            onChange={e => {
              const newInstrumentId = e.target.value
              const savedSettings = instrumentSettings[newInstrumentId] || {}
              onInstrumentChange(newInstrumentId)
            }}
          >
            <option value="">— selectează —</option>
            {availableInstruments.map(inst => (
              <option key={inst.id} value={inst.id}>{inst.name}</option>
            ))}
          </select>
        </div>
        
        <div className="col-span-1 sm:col-span-4">
          <Label className="text-xs text-muted-foreground mb-1 block">Cant.</Label>
          <Input
            className="h-8 text-sm text-center disabled:opacity-50 disabled:cursor-not-allowed"
            inputMode="numeric"
            value={instrumentForm.qty}
            onChange={e => {
              const newQty = e.target.value
              onQtyChange(newQty)
            }}
            placeholder="1"
            disabled={hasServicesOrInstrumentInSheet && !isVanzariPipeline}
            title={hasServicesOrInstrumentInSheet && !isVanzariPipeline ? "Cantitatea este blocată - există deja servicii sau instrument în tăviță" : "Introduceți cantitatea instrumentului"}
          />
        </div>
      </div>
    </div>
  )
}

