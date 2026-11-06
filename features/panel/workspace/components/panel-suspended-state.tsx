import { LuCircleAlert, LuLogOut } from "react-icons/lu"
import { Button } from "@/components/ui/button"
import { signOutPanelAction } from "@/features/panel/auth/sign-out"

export function PanelSuspendedState({ name }: { name: string }) {
  return <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-10">
    <section className="w-full max-w-lg rounded-2xl border border-border/70 bg-card p-7 text-center shadow-sm sm:p-9">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><LuCircleAlert aria-hidden="true" className="size-6" /></span>
      <p className="mt-5 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Painel Tavvi</p>
      <h1 className="mt-2 text-xl font-semibold">Acesso temporariamente indisponível</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">O acesso de {name} está suspenso. Entre em contato com a equipe Tavvi para mais informações.</p>
      <form action={signOutPanelAction} className="mt-6"><Button type="submit" variant="outline"><LuLogOut data-icon="inline-start" aria-hidden="true" />Sair da conta</Button></form>
    </section>
  </main>
}
