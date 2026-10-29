"use client"

import Image from "next/image"
import { motion } from "motion/react"
import { LuArrowUpRight, LuShieldCheck } from "react-icons/lu"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"

type AdminAuthShellProps = {
  children: React.ReactNode
  title: string
  description: string
}

export function AdminAuthShell({
  children,
  title,
  description,
}: AdminAuthShellProps) {
  return (
    <main className="min-h-svh bg-muted/30 p-3 sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100svh-1.5rem)] max-w-6xl overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm sm:min-h-[calc(100svh-3rem)] lg:min-h-[calc(100svh-4rem)] md:grid-cols-[minmax(0,1fr)_minmax(390px,0.9fr)]">
        <aside className="relative hidden overflow-hidden bg-foreground p-8 text-background md:flex md:flex-col md:justify-between lg:p-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/25 via-transparent to-background/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 top-1/4 size-72 rounded-full border border-background/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 top-[31%] size-48 rounded-full border border-background/10"
          />

          <div className="relative">
            <Image
              src="/brand/tavvi-lockup-horizontal-gold-on-dark.png"
              alt="Tavvi"
              width={240}
              height={94}
              priority
              className="h-auto w-40 object-contain lg:w-48"
            />
          </div>

          <div className="relative max-w-lg space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-background/15 bg-background/5 px-3 py-1.5 text-[0.6875rem] font-medium tracking-[0.16em] text-background/75">
              <span className="size-1.5 rounded-full bg-primary" />
              GESTÃO DA PLATAFORMA
            </div>
            <div className="space-y-4">
              <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight text-background lg:text-4xl">
                Uma operação mais clara começa por aqui.
              </h2>
              <p className="max-w-md text-sm leading-6 text-background/65 lg:text-base">
                Acesse as ferramentas administrativas da Tavvi com um único
                ponto de entrada, protegido e preparado para crescer.
              </p>
            </div>
          </div>

          <div className="relative flex items-center gap-3 rounded-xl border border-background/15 bg-background/5 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background/10 text-background">
              <LuShieldCheck aria-hidden="true" className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-background">
                Acesso administrativo
              </p>
              <p className="mt-1 text-xs leading-5 text-background/60">
                Sessão independente do painel dos restaurantes.
              </p>
            </div>
            <LuArrowUpRight
              aria-hidden="true"
              className="ml-auto size-4 shrink-0 text-background/50"
            />
          </div>
        </aside>

        <section className="flex items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
            className="w-full max-w-md"
          >
            <div className="mb-8 flex items-center justify-between gap-4 md:hidden">
              <Image
                src="/brand/tavvi-lockup-horizontal-gold-on-light.png"
                alt="Tavvi"
                width={240}
                height={94}
                priority
                className="h-auto w-32 object-contain dark:hidden"
              />
              <Image
                src="/brand/tavvi-lockup-horizontal-gold-on-dark.png"
                alt="Tavvi"
                width={240}
                height={94}
                priority
                className="hidden h-auto w-32 object-contain dark:block"
              />
              <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-[0.625rem] font-medium tracking-[0.14em] text-muted-foreground">
                ADMIN
              </span>
            </div>

            <div className="mb-6 hidden items-center justify-between md:flex">
              <div className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-muted-foreground">
                <LuShieldCheck aria-hidden="true" className="size-4" />
                ÁREA ADMINISTRATIVA
              </div>
              <span className="text-xs text-muted-foreground">Tavvi</span>
            </div>

            <Card className="gap-0 border-0 bg-transparent py-0 ring-0 shadow-none">
              <CardHeader className="gap-2 px-0 pb-6">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {title}
                </h1>
                <CardDescription className="max-w-sm text-sm leading-6">
                  {description}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">{children}</CardContent>
            </Card>

            <p className="mt-8 text-center text-xs text-muted-foreground">
              Tavvi · Acesso restrito à administração da plataforma
            </p>
          </motion.div>
        </section>
      </div>
    </main>
  )
}
