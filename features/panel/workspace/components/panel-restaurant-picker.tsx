"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react"
import { LuArrowRight, LuCircleAlert, LuCircleCheck, LuStore } from "react-icons/lu"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { PanelRestaurantListItem } from "@/features/panel/workspace/server/restaurants"
import { selectPanelRestaurantAction } from "@/features/panel/workspace/actions"
import { authItemVariants, authStaggerVariants } from "@/features/admin/auth/components/auth-motion"

type PickerItem = PanelRestaurantListItem

function statusLabel(status: PickerItem["status"]) {
  return status === "draft" ? "Rascunho" : status === "active" ? "Ativo" : "Suspenso"
}

export function PanelRestaurantPicker({
  restaurants,
  publicBasePath,
}: {
  restaurants: PickerItem[]
  publicBasePath: "" | "/painel"
}) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function choose(id: string) {
    setError("")
    setPendingId(id)
    startTransition(async () => {
      const result = await selectPanelRestaurantAction(id)
      if (!result.ok) {
        setError("Não foi possível abrir este restaurante. Atualize a página e tente novamente.")
        setPendingId(null)
        return
      }
      router.replace(result.destination)
    })
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.main
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        variants={authStaggerVariants}
        className="min-h-svh bg-muted/30 px-4 py-10 sm:px-6"
      >
        <div className="mx-auto w-full max-w-2xl">
          <motion.header variants={authItemVariants} className="mb-7 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><LuStore aria-hidden="true" className="size-6" /></span>
            <p className="mt-4 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Painel Tavvi</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Escolha um restaurante</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Selecione o espaço que deseja acessar.</p>
          </motion.header>

          <AnimatePresence initial={false}>
            {error ? (
              <motion.div initial={reduceMotion ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4">
                <Alert variant="destructive"><LuCircleAlert aria-hidden="true" /><AlertTitle>Não foi possível continuar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {restaurants.length ? (
            <motion.div variants={authStaggerVariants} className="space-y-3">
              {restaurants.map((restaurant) => (
                <motion.div key={restaurant.id} variants={authItemVariants} whileHover={pending ? undefined : { y: -1 }} transition={{ duration: 0.16 }}>
                  <Card className="gap-0 border-border/70 py-0 shadow-sm transition-shadow hover:shadow-md">
                    <CardHeader className="flex flex-row items-center gap-3 px-4 py-4 sm:px-5">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><LuStore aria-hidden="true" className="size-5" /></span>
                      <div className="min-w-0 flex-1 gap-1">
                        <CardTitle className="truncate text-base">{restaurant.name}</CardTitle>
                        <CardDescription className="truncate">/{restaurant.slug}</CardDescription>
                      </div>
                      <Badge variant={restaurant.status === "active" ? "default" : "secondary"} className="shrink-0 gap-1.5">
                        {restaurant.status === "active" ? <LuCircleCheck aria-hidden="true" /> : null}
                        {statusLabel(restaurant.status)}
                      </Badge>
                    </CardHeader>
                    <CardContent className="flex justify-end border-t border-border/60 px-4 py-3 sm:px-5">
                      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => choose(restaurant.id)}>
                        {pending && pendingId === restaurant.id ? "Abrindo…" : "Acessar"}
                        <LuArrowRight data-icon="inline-end" aria-hidden="true" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div variants={authItemVariants}>
              <Card className="border-border/70 text-center shadow-sm">
                <CardContent className="space-y-3 p-6">
                  <p className="font-medium">Nenhum restaurante disponível</p>
                  <p className="text-sm leading-6 text-muted-foreground">O acesso ao Painel começa por um convite da Tavvi.</p>
                  <Button nativeButton={false} render={<a href={publicBasePath + "/criar-conta"}>Como receber um convite</a>} variant="outline" />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </motion.main>
    </MotionConfig>
  )
}
