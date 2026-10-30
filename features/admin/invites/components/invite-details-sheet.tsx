"use client"

import { motion, useReducedMotion } from "motion/react"
import {
  LuAtSign,
  LuCalendarClock,
  LuClock3,
  LuExternalLink,
  LuMailPlus,
  LuUsers,
  LuX,
} from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  formatInviteDate,
  getInviteRecipient,
  inviteStatusLabels,
  type PlatformInvite,
} from "@/features/admin/invites/data"

type InviteDetailsSheetProps = {
  invite: PlatformInvite | null
  onOpenChange: (open: boolean) => void
  onCreateFromInvite: (invite: PlatformInvite) => void
}

export function InviteDetailsSheet({
  invite,
  onOpenChange,
  onCreateFromInvite,
}: InviteDetailsSheetProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <Sheet open={Boolean(invite)} onOpenChange={(open) => onOpenChange(open)}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 p-0 motion-reduce:animate-none motion-reduce:transition-none motion-reduce:duration-0 sm:max-w-lg"
      >
        {invite && (
          <motion.div
            key={invite.id}
            initial={shouldReduceMotion ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.26, ease: "easeOut" }}
            className="flex h-full flex-col"
          >
            <SheetHeader className="gap-3 border-b border-border/70 px-6 pt-7 pb-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <LuExternalLink aria-hidden="true" className="size-5" />
                  </span>
                  <div className="space-y-1">
                    <p className="text-[0.625rem] font-semibold tracking-[0.13em] text-muted-foreground uppercase">
                      Detalhes do convite
                    </p>
                    <SheetTitle className="text-lg font-semibold tracking-tight">
                      Acesso da plataforma
                    </SheetTitle>
                  </div>
                </div>
                <SheetClose
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Fechar detalhes do convite"
                    />
                  }
                >
                  <LuX aria-hidden="true" />
                </SheetClose>
              </div>
              <SheetDescription className="max-w-sm text-sm leading-6">
                Confira o destinatário e o prazo deste convite demonstrativo.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6">
              <section className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground shadow-sm ring-1 ring-border/70">
                    {invite.email ? (
                      <LuAtSign aria-hidden="true" className="size-4" />
                    ) : (
                      <LuUsers aria-hidden="true" className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      Destinatário
                    </p>
                    <p className="mt-1 text-sm font-medium break-all">
                      {getInviteRecipient(invite)}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {inviteStatusLabels[invite.status]}
                  </Badge>
                </div>
              </section>

              <section className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Prazo e atividade</h3>
                  <p className="text-xs text-muted-foreground">
                    Datas referentes à demonstração local da interface.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/70 p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <LuClock3 aria-hidden="true" className="size-4" />
                      <span className="text-xs">Criado em</span>
                    </div>
                    <p className="mt-3 text-sm font-medium">
                      {formatInviteDate(invite.createdAt)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <LuCalendarClock aria-hidden="true" className="size-4" />
                      <span className="text-xs">Válido até</span>
                    </div>
                    <p className="mt-3 text-sm font-medium">
                      {formatInviteDate(invite.expiresAt)}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-dashed border-border bg-muted/20 p-4">
                <p className="text-xs font-medium">Próxima etapa</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  A geração e a revogação reais serão conectadas aos serviços de
                  convite depois da aprovação desta interface.
                </p>
              </section>
            </div>

            <SheetFooter className="border-t border-border/70 px-6 py-5">
              <motion.div
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="w-full"
              >
                <Button
                  className="h-10 w-full rounded-xl"
                  onClick={() => onCreateFromInvite(invite)}
                >
                  <LuMailPlus aria-hidden="true" />
                  Gerar novo convite
                </Button>
              </motion.div>
            </SheetFooter>
          </motion.div>
        )}
      </SheetContent>
    </Sheet>
  )
}
