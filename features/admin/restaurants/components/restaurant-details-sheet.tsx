"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  LuCalendarDays,
  LuClock3,
  LuPencilLine,
  LuPause,
  LuRotateCcw,
  LuStore,
  LuX,
} from "react-icons/lu"
import { motion, MotionConfig, useReducedMotion } from "motion/react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { toast } from "@/components/ui/toast"
import {
  restorePlatformRestaurantAction,
  suspendPlatformRestaurantAction,
  updatePlatformRestaurantSlugAction,
} from "@/features/admin/restaurants/actions"
import {
  formatRestaurantDate,
  restaurantInitials,
  restaurantStatusLabels,
  type RestaurantAdmin,
} from "@/features/admin/restaurants/model"
import { restaurantSlugSchema } from "@/features/admin/restaurants/schema"
import { RestaurantStatusBadge } from "@/features/admin/restaurants/components/restaurant-status-badge"

type RestaurantDetailsSheetProps = {
  restaurant: RestaurantAdmin | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function failureMessage(code: string) {
  const messages: Record<string, string> = {
    invalid_input: "Confira os dados informados e tente novamente.",
    unauthorized: "Sua sessão de gestão expirou. Entre novamente.",
    service_unavailable: "Não foi possível atualizar o restaurante agora.",
    not_found: "Este restaurante não está mais disponível.",
    slug_unavailable: "Este endereço já está em uso.",
  }
  return messages[code] ?? "Não foi possível atualizar o restaurante agora."
}

export function RestaurantDetailsSheet({
  restaurant,
  open,
  onOpenChange,
}: RestaurantDetailsSheetProps) {
  const router = useRouter()
  const shouldReduceMotion = useReducedMotion()
  const [isPending, startTransition] = useTransition()
  const [slug, setSlug] = useState(restaurant?.slug ?? "")
  const [slugError, setSlugError] = useState("")
  const [isEditingSlug, setIsEditingSlug] = useState(false)
  const [suspendConfirmationOpen, setSuspendConfirmationOpen] = useState(false)

  useEffect(() => {
    if (!restaurant) return
    setSlug(restaurant.slug)
    setSlugError("")
    setIsEditingSlug(false)
    setSuspendConfirmationOpen(false)
  }, [restaurant?.id, restaurant?.slug])

  function requestClose(nextOpen: boolean) {
    if (!nextOpen && isPending) return
    onOpenChange(nextOpen)
  }

  function setSlugInput(value: string) {
    setSlug(value.toLowerCase().replace(/\s+/g, "-"))
    setSlugError("")
  }

  function handleSlugSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurant) return

    const parsedSlug = restaurantSlugSchema.safeParse(slug)
    if (!parsedSlug.success) {
      setSlugError(parsedSlug.error.issues[0]?.message ?? "Endereço inválido.")
      return
    }
    if (parsedSlug.data === restaurant.slug) {
      setIsEditingSlug(false)
      setSlugError("")
      return
    }

    setSlugError("")
    startTransition(async () => {
      try {
        const result = await updatePlatformRestaurantSlugAction({
          restaurantId: restaurant.id,
          slug: parsedSlug.data,
        })
        if (!result.ok) {
          setSlugError(
            result.code === "slug_unavailable"
              ? "Este endereço já está em uso."
              : failureMessage(result.code)
          )
          return
        }

        setSlug(result.slug)
        setIsEditingSlug(false)
        toast.add({ title: "Endereço atualizado", type: "success" })
        router.refresh()
      } catch {
        setSlugError("Não foi possível atualizar o endereço agora.")
      }
    })
  }

  function handleSuspend() {
    if (!restaurant) return
    setSuspendConfirmationOpen(false)

    startTransition(async () => {
      try {
        const result = await suspendPlatformRestaurantAction(restaurant.id)
        if (!result.ok) {
          toast.add({ title: failureMessage(result.code), type: "error" })
          return
        }

        toast.add({ title: "Restaurante suspenso", type: "success" })
        router.refresh()
      } catch {
        toast.add({
          title: "Não foi possível suspender o restaurante.",
          type: "error",
        })
      }
    })
  }

  function handleRestore() {
    if (!restaurant) return

    startTransition(async () => {
      try {
        const result = await restorePlatformRestaurantAction(restaurant.id)
        if (!result.ok) {
          toast.add({ title: failureMessage(result.code), type: "error" })
          return
        }

        toast.add({ title: "Situação restaurada", type: "success" })
        router.refresh()
      } catch {
        toast.add({
          title: "Não foi possível restaurar a situação.",
          type: "error",
        })
      }
    })
  }

  const returnStatus = restaurant?.statusBeforeSuspension ?? "draft"

  return (
    <>
      <MotionConfig reducedMotion="user">
        <Sheet open={open} onOpenChange={requestClose}>
          <SheetContent
            side="right"
            showCloseButton={false}
            className="data-[side=right]:w-full! data-[side=right]:sm:max-w-lg! gap-0 p-0 motion-reduce:animate-none motion-reduce:transition-none motion-reduce:duration-0"
          >
            {restaurant && (
              <motion.div
                key={restaurant.id}
                initial={shouldReduceMotion ? false : { opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.26, ease: "easeOut" }}
                className="flex h-full flex-col"
              >
                <SheetHeader className="gap-3 border-b border-border/70 px-6 pt-7 pb-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
                        {restaurantInitials(restaurant.name)}
                      </span>
                      <div className="min-w-0 space-y-1">
                        <p className="text-[0.625rem] font-semibold tracking-[0.13em] text-muted-foreground uppercase">
                          Detalhes do restaurante
                        </p>
                        <SheetTitle className="truncate text-lg font-semibold tracking-tight">
                          {restaurant.name}
                        </SheetTitle>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Fechar detalhes do restaurante"
                      disabled={isPending}
                      onClick={() => requestClose(false)}
                    >
                      <LuX aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <RestaurantStatusBadge status={restaurant.status} />
                  </div>
                </SheetHeader>

                <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                  <motion.section
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 7 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="rounded-2xl border border-border/70 bg-muted/25 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground shadow-sm ring-1 ring-border/70">
                        <LuStore aria-hidden="true" className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">Situação</p>
                        <p className="mt-1 text-sm font-medium">
                          {restaurantStatusLabels[restaurant.status]}
                        </p>
                        {restaurant.status === "suspended" && (
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Ao restaurar, o restaurante voltará para {restaurantStatusLabels[returnStatus].toLowerCase()}.
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.section>

                  <section className="space-y-3">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold">Endereço</h3>
                      <p className="text-xs text-muted-foreground">
                        O identificador usado para reconhecer este restaurante.
                      </p>
                    </div>
                    <form onSubmit={handleSlugSubmit} className="space-y-3">
                      <Field data-invalid={Boolean(slugError) || undefined}>
                        <FieldLabel htmlFor="restaurant-slug">
                          Endereço do restaurante
                        </FieldLabel>
                        <div className="flex h-11 items-center overflow-hidden rounded-xl border border-input bg-background focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
                          <span className="pl-3 font-mono text-sm text-muted-foreground">
                            /
                          </span>
                          <Input
                            id="restaurant-slug"
                            value={slug}
                            onChange={(event) => setSlugInput(event.currentTarget.value)}
                            disabled={!isEditingSlug || isPending}
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            aria-invalid={Boolean(slugError) || undefined}
                            aria-describedby={slugError ? "restaurant-slug-error" : "restaurant-slug-help"}
                            className="h-10 min-w-0 rounded-none border-0 bg-transparent font-mono shadow-none focus-visible:ring-0"
                          />
                        </div>
                        <FieldDescription id="restaurant-slug-help">
                          Use letras minúsculas, números e hífens; até 80 caracteres.
                        </FieldDescription>
                        {slugError && (
                          <p id="restaurant-slug-error" role="alert" className="text-xs text-destructive">
                            {slugError}
                          </p>
                        )}
                      </Field>

                      {isEditingSlug ? (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 flex-1 rounded-xl"
                            disabled={isPending}
                            onClick={() => {
                              setSlug(restaurant.slug)
                              setSlugError("")
                              setIsEditingSlug(false)
                            }}
                          >
                            Cancelar
                          </Button>
                          <motion.div
                            whileHover={shouldReduceMotion ? undefined : { y: -1 }}
                            whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
                            transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
                            className="flex-1"
                          >
                            <Button
                              type="submit"
                              className="h-10 w-full rounded-xl"
                              disabled={isPending || slug === restaurant.slug}
                            >
                              {isPending ? "Salvando…" : "Salvar endereço"}
                            </Button>
                          </motion.div>
                        </div>
                      ) : (
                        <motion.div
                          whileHover={shouldReduceMotion ? undefined : { y: -1 }}
                          whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
                          transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
                        >
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 w-full rounded-xl"
                            disabled={isPending}
                            onClick={() => setIsEditingSlug(true)}
                          >
                            <LuPencilLine aria-hidden="true" />
                            Alterar endereço
                          </Button>
                        </motion.div>
                      )}
                    </form>
                  </section>

                  <section className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/70 p-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <LuCalendarDays aria-hidden="true" className="size-4" />
                        <span className="text-xs">Criado em</span>
                      </div>
                      <p className="mt-3 text-sm font-medium">
                        {formatRestaurantDate(restaurant.createdAt)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 p-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <LuClock3 aria-hidden="true" className="size-4" />
                        <span className="text-xs">Atualizado em</span>
                      </div>
                      <p className="mt-3 text-sm font-medium">
                        {formatRestaurantDate(restaurant.updatedAt)}
                      </p>
                    </div>
                  </section>

                  <p className="rounded-xl bg-muted/45 px-4 py-3 text-xs leading-5 text-muted-foreground">
                    Suspender controla a publicação e mantém o acesso administrativo da equipe ao Painel.
                  </p>
                </div>

                <SheetFooter className="border-t border-border/70 px-6 py-5">
                  {restaurant.status === "suspended" ? (
                    <motion.div
                      whileHover={shouldReduceMotion ? undefined : { y: -1 }}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
                      className="w-full"
                    >
                      <Button
                        type="button"
                        className="h-10 w-full rounded-xl"
                        disabled={isPending}
                        onClick={handleRestore}
                      >
                        {isPending ? (
                          <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none" />
                        ) : (
                          <LuRotateCcw aria-hidden="true" />
                        )}
                        {isPending ? "Restaurando…" : "Restaurar situação"}
                      </Button>
                    </motion.div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 w-full rounded-xl text-destructive hover:text-destructive"
                      disabled={isPending}
                      onClick={() => setSuspendConfirmationOpen(true)}
                    >
                      <LuPause aria-hidden="true" />
                      Suspender restaurante
                    </Button>
                  )}
                </SheetFooter>
              </motion.div>
            )}
          </SheetContent>
        </Sheet>
      </MotionConfig>

      <AlertDialog
        open={suspendConfirmationOpen}
        onOpenChange={setSuspendConfirmationOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspender este restaurante?</AlertDialogTitle>
            <AlertDialogDescription>
              A publicação será desativada. A equipe continuará com acesso ao Painel, e o restaurante poderá voltar para {restaurant?.status === "active" ? "ativo" : "rascunho"} quando for restaurado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={handleSuspend}
            >
              {isPending ? "Suspendendo…" : "Suspender restaurante"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
