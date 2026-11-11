"use client"

import { LuBookOpenCheck, LuRefreshCw } from "react-icons/lu"

import { Button } from "@/components/ui/button"

export default function MenuPageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-svh place-items-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-border/70 bg-card p-7 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <LuBookOpenCheck aria-hidden="true" className="size-6" />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight">Não foi possível carregar o cardápio</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Seus dados continuam salvos. Tente carregar esta página novamente.</p>
        <Button type="button" className="mt-5" onClick={reset}><LuRefreshCw aria-hidden="true" />Tentar novamente</Button>
      </section>
    </div>
  )
}
