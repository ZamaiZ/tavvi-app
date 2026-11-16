"use client"

import { LuReceiptText } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { PanelPageHeading } from "@/features/panel/workspace/components/panel-page-heading"

export default function PanelCashError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-svh">
      <header className="mx-auto w-full max-w-[1320px] px-4 py-7 sm:px-6 md:py-5 lg:px-8">
        <PanelPageHeading title="Caixa" icon={<LuReceiptText aria-hidden="true" className="size-4" />} />
      </header>
      <main className="mx-auto w-full max-w-[1320px] px-4 pb-32 sm:px-6 md:pb-10 lg:px-8">
        <div role="alert" className="mx-auto max-w-xl rounded-2xl border border-destructive/20 bg-destructive/[0.045] px-5 py-8 text-center">
          <h2 className="text-base font-semibold">Não foi possível carregar as comandas</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Confira a conexão com o servidor e tente novamente.</p>
          <Button type="button" variant="outline" onClick={reset} className="mt-4 min-h-10 rounded-xl">Tentar novamente</Button>
        </div>
      </main>
    </div>
  )
}
