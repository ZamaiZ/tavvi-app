import { LuCircleCheck, LuClock3, LuStore, LuUtensils } from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function PanelMenuTemplate({ name, slug }: { name: string; slug: string }) {
  return (
    <div className="min-h-svh">
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-10 sm:px-6 md:py-4 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-0 md:gap-6 md:py-2">
          <header className="mb-8 flex flex-wrap items-center justify-between gap-4 md:mb-0 md:flex-row md:items-end md:gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <SidebarTrigger
                aria-label="Alternar navegação lateral"
                title="Alternar navegação lateral"
                className="mt-0.5 hidden shrink-0 rounded-lg border border-border/70 bg-background shadow-sm transition-colors duration-150 md:inline-flex"
              />
              <div className="min-w-0">
                <Breadcrumb>
                  <BreadcrumbList className="gap-2">
                    <BreadcrumbItem>
                      <BreadcrumbPage className="inline-flex items-center gap-2 text-[0.5625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <LuUtensils aria-hidden="true" className="size-3.5" />
                        </span>
                        Cardápio
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
                <h1 className="sr-only">Cardápio</h1>
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
    </div>
  )
}
