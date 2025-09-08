"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Lead } from "@/app/page"

interface SidebarProps {
  leads: Lead[]
  onLeadSelect: (leadId: string) => void
  pipelines: String[]
}

export function Sidebar({ leads, onLeadSelect, pipelines }: SidebarProps) {
  // const [isExpanded, setIsExpanded] = useState(true)
  // const vanzariLeads = leads.filter((lead) => lead.pipeline === "vanzari")
  console.log(pipelines);

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-sidebar-foreground" />
          <h2 className="font-semibold text-sidebar-foreground">ascutzit.ro – CRM (Leads)</h2>
        </div>

        <div className="space-y-2">
          {/* <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent",
              isExpanded && "bg-sidebar-accent",
            )}
            onClick={() => setIsExpanded(!isExpanded)}
          > */}
            {/* {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} */}
            <ul>
              {pipelines.map((str, i) => (
                <li key={`${str}-${i}`} className="cursor-pointer hover:text-blue-500">{str}</li>
              ))}
            </ul>
          {/* </Button> */}

          {/* {isExpanded && (
            <div className="ml-6 space-y-1">
              {vanzariLeads.map((lead) => (
                <Button
                  key={lead.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs text-sidebar-foreground hover:bg-sidebar-accent"
                  onClick={() => onLeadSelect(lead.id)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="truncate">{lead.name}</span>
                    <span className="text-xs bg-sidebar-accent px-1 py-0.5 rounded text-sidebar-accent-foreground">
                      {lead.stage.split(" ")[0]}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          )} */}
        </div>
      </div>
    </aside>
  )
}
