import type { ReactNode } from "react"

import { SidebarTrigger } from "@/components/ui/sidebar"

export function PanelPageHeading({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center gap-3">
      <SidebarTrigger aria-label="Alternar navegação lateral" title="Alternar navegação lateral" className="hidden shrink-0 rounded-lg border border-border/70 bg-background shadow-sm transition-colors duration-150 md:inline-flex" />
      <h1 className="flex min-w-0 items-center gap-2.5 text-lg font-semibold tracking-tight sm:text-xl">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <span className="truncate">{title}</span>
      </h1>
    </div>
  )
}
