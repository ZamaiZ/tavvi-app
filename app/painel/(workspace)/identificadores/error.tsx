"use client"

import { LuCircleAlert, LuRefreshCw } from "react-icons/lu"

import { Button } from "@/components/ui/button"

export default function IdentifiersError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-[60svh] px-4 py-12 sm:px-6">
      <section className="mx-auto flex max-w-lg flex-col items-center rounded-3xl border border-border/70 bg-card px-6 py-10 text-center shadow-sm">
        <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive"><LuCircleAlert aria-hidden="true" className="size-5" /></span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight">Não foi possível carregar os identificadores</h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Os dados da mesa não chegaram. Tente carregar novamente.</p>
        <Button type="button" variant="outline" className="mt-6 min-h-11" onClick={reset}><LuRefreshCw aria-hidden="true" />Tentar novamente</Button>
      </section>
    </main>
  )
}

