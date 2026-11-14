"use client"

import { LuCircleAlert, LuRotateCw } from "react-icons/lu"

import { Button } from "@/components/ui/button"

export default function PanelTeamError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="flex min-h-[24rem] flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border/70 bg-card/70 px-6 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <LuCircleAlert aria-hidden="true" className="size-5" />
        </span>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Não foi possível carregar a equipe</h1>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">A lista não está disponível agora. Tente novamente em instantes.</p>
        </div>
        <Button type="button" variant="outline" onClick={reset} className="rounded-xl">
          <LuRotateCw aria-hidden="true" />
          Tentar novamente
        </Button>
      </section>
    </main>
  )
}
