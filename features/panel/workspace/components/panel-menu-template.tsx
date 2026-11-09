import { LuCircleCheck, LuClock3, LuStore } from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function PanelMenuTemplate({ name, slug }: { name: string; slug: string }) {
  return (
    <div className="min-h-svh bg-muted/30 px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger
              aria-label="Recolher ou expandir navegação"
              title="Recolher ou expandir navegação"
              className="hidden size-11 shrink-0 rounded-lg border border-border/70 bg-background shadow-sm transition-colors duration-150 motion-reduce:active:translate-y-0! motion-reduce:transition-none md:inline-flex"
            />
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Painel Tavvi
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">Cardápio</h1>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
              <LuCircleCheck aria-hidden="true" className="size-3.5" />
              Restaurante ativo
            </Badge>
          </div>
        </header>

        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm sm:rounded-3xl">
          <div className="bg-gradient-to-br from-primary/[0.08] via-card to-card p-6 sm:p-9">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <LuStore aria-hidden="true" className="size-6" />
            </div>
            <h2 className="mt-5 text-xl font-semibold">{name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Endereço do cardápio: /{slug}</p>

            <div className="mt-8 rounded-2xl border border-border/70 bg-background/80 p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <LuClock3 aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-semibold">Seu cardápio está sendo preparado</h3>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                    O restaurante já está ativo. A montagem do cardápio digital será a próxima etapa e estará disponível aqui em breve.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
