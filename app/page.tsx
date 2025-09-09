"use client"

import { Sidebar } from "@/components/sidebar"
import { Toaster } from "@/components/ui/toaster"
import { useKanbanData } from "@/hooks/useKanbanData"

export type { KanbanLead as Lead } from "../lib/types/database"

export default function DashboardPage() {
  const { leads, pipelines, loading, error } = useKanbanData()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-500">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar leads={leads} onLeadSelect={() => {}} pipelines={pipelines} />

      <main className="flex-1 min-w-0 min-h-0 flex flex-col">
        <header className="border-b border-border p-4">
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview & widgets (coming soon)</p>
        </header>

        <div className="flex-1 p-6">
          {/* Put cards / charts here later */}
          <div className="text-muted-foreground">Select a pipeline from the left to view its board.</div>
        </div>
      </main>

      <Toaster />
    </div>
  )
}
