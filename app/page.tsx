"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { KanbanBoard } from "@/components/kanban-board"
import { LeadModal } from "@/components/lead-modal"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

export interface Lead {
  id: string
  name: string
  company?: string
  phone?: string
  email?: string
  notes?: string
  pipeline: string
  stage: string
  createdAt: Date
  lastActivity: Date
}

// Seed data for the Vanzari pipeline
const initialLeads: Lead[] = [
  {
    id: "1",
    name: "Ion Popescu",
    company: "Tech Solutions SRL",
    phone: "+40 721 123 456",
    email: "ion.popescu@techsolutions.ro",
    notes: "Interesat de solutii ERP",
    pipeline: "vanzari",
    stage: "LEAD VECHI",
    createdAt: new Date("2024-01-15"),
    lastActivity: new Date("2024-01-20"),
  },
  {
    id: "2",
    name: "Maria Ionescu",
    company: "Digital Marketing Pro",
    phone: "+40 722 234 567",
    email: "maria@digitalmarketing.ro",
    notes: "Cauta servicii de consultanta",
    pipeline: "vanzari",
    stage: "LEAD NOU",
    createdAt: new Date("2024-01-18"),
    lastActivity: new Date("2024-01-18"),
  },
  {
    id: "3",
    name: "Alexandru Gheorghe",
    company: "StartUp Innovations",
    phone: "+40 723 345 678",
    email: "alex@startup.ro",
    notes: "Startup in cautare de finantare",
    pipeline: "vanzari",
    stage: "LEAD NOU",
    createdAt: new Date("2024-01-19"),
    lastActivity: new Date("2024-01-19"),
  },
  {
    id: "4",
    name: "Elena Radu",
    company: "Fashion Boutique",
    phone: "+40 724 456 789",
    email: "elena@fashion.ro",
    notes: "Interesat de sistem POS",
    pipeline: "vanzari",
    stage: "MESSAGES",
    createdAt: new Date("2024-01-16"),
    lastActivity: new Date("2024-01-21"),
  },
  {
    id: "5",
    name: "Mihai Stoica",
    company: "Construction Plus",
    phone: "+40 725 567 890",
    email: "mihai@construction.ro",
    notes: "Proiect management software",
    pipeline: "vanzari",
    stage: "MESSAGES",
    createdAt: new Date("2024-01-17"),
    lastActivity: new Date("2024-01-22"),
  },
  {
    id: "6",
    name: "Ana Dumitrescu",
    company: "Legal Services",
    phone: "+40 726 678 901",
    email: "ana@legal.ro",
    notes: "Software pentru cabinet avocat",
    pipeline: "vanzari",
    stage: "NU RASPUNDE",
    createdAt: new Date("2024-01-10"),
    lastActivity: new Date("2024-01-15"),
  },
  {
    id: "7",
    name: "Cristian Marin",
    company: "Auto Service",
    phone: "+40 727 789 012",
    email: "cristian@autoservice.ro",
    notes: "Management service auto",
    pipeline: "vanzari",
    stage: "NU RASPUNDE",
    createdAt: new Date("2024-01-12"),
    lastActivity: new Date("2024-01-17"),
  },
  {
    id: "8",
    name: "Daniela Popa",
    company: "Beauty Salon",
    phone: "+40 728 890 123",
    email: "daniela@beauty.ro",
    notes: "Sistem programari online",
    pipeline: "vanzari",
    stage: "NO DEAL",
    createdAt: new Date("2024-01-08"),
    lastActivity: new Date("2024-01-14"),
  },
  {
    id: "9",
    name: "Florin Vasile",
    company: "Restaurant Chain",
    phone: "+40 729 901 234",
    email: "florin@restaurant.ro",
    notes: "Software gestiune restaurant",
    pipeline: "vanzari",
    stage: "CURIER TRIMIS",
    createdAt: new Date("2024-01-05"),
    lastActivity: new Date("2024-01-23"),
  },
  {
    id: "10",
    name: "Gabriela Nicu",
    company: "Medical Clinic",
    phone: "+40 730 012 345",
    email: "gabriela@medical.ro",
    notes: "Sistem management pacienti",
    pipeline: "vanzari",
    stage: "CURIER TRIMIS",
    createdAt: new Date("2024-01-06"),
    lastActivity: new Date("2024-01-24"),
  },
]

const stages = ["LEAD VECHI", "LEAD NOU", "MESSAGES", "NU RASPUNDE", "NO DEAL", "CURIER TRIMIS"]

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { toast } = useToast()

  const handleLeadMove = (leadId: string, newStage: string) => {
    setLeads((prevLeads) =>
      prevLeads.map((lead) => (lead.id === leadId ? { ...lead, stage: newStage, lastActivity: new Date() } : lead)),
    )

    toast({
      title: "Lead moved",
      description: `Moved to ${newStage}`,
      duration: 2000,
    })
  }

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead)
    setIsModalOpen(true)
  }

  const handleLeadSelect = (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId)
    if (lead) {
      handleLeadClick(lead)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar leads={leads} onLeadSelect={handleLeadSelect} />

      <main className="flex-1 flex flex-col">
        <header className="border-b border-border p-4">
          <h1 className="text-2xl font-semibold text-foreground">Vanzari</h1>
          <p className="text-sm text-muted-foreground">Kanban board for Leads</p>
        </header>

        <div className="flex-1 p-6">
          <KanbanBoard leads={leads} stages={stages} onLeadMove={handleLeadMove} onLeadClick={handleLeadClick} />
        </div>
      </main>

      <LeadModal
        lead={selectedLead}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onStageChange={handleLeadMove}
        stages={stages}
      />

      <Toaster />
    </div>
  )
}
