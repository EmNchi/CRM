'use client'

import { Sidebar } from '@/components/sidebar'
import { useKanbanData } from '@/hooks/useKanbanData'

export default function CrmShell({ children }: { children: React.ReactNode }) {
  const { leads, pipelines } = useKanbanData()

  return (
    <div className="min-h-screen flex">
      <Sidebar leads={leads} onLeadSelect={() => {}} pipelines={pipelines} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
