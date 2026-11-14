"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react"
import { LuCircleAlert, LuInbox, LuLoaderCircle, LuMessageSquareText, LuRefreshCw, LuSparkles } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { FeedbackActionFailureCode, FeedbackCursor, FeedbackDTO, FeedbackFilter, FeedbackPage } from "@/features/feedback/model"
import { deleteFeedbackAction, listFeedbackAction, markFeedbackReadAction } from "@/features/panel/feedback/actions"
import { FeedbackCard } from "./feedback-card"
import { FeedbackDetail } from "./feedback-detail"

const EASE = [0.23, 1, 0.32, 1] as const

function failureMessage(code: FeedbackActionFailureCode) {
  if (code === "context_changed") return "O restaurante ativo mudou. Atualize a página para continuar."
  if (code === "not_found") return "Este feedback não está mais disponível. Atualize a lista."
  return "Não foi possível concluir esta ação. Tente novamente."
}

function emptyCopy(filter: FeedbackFilter) {
  return filter === "unread"
    ? { title: "Tudo em dia", text: "Não há feedbacks novos para ler. Os próximos relatos aparecerão aqui." }
    : { title: "Seu próximo insight começa aqui", text: "Quando um cliente deixar um feedback pelo cardápio, você encontrará o relato e as mídias nesta caixa." }
}

export function FeedbackWorkspace({
  restaurantId,
  initialPage,
  initialUnreadCount,
}: {
  restaurantId: string
  initialPage: FeedbackPage
  initialUnreadCount: number
}) {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
  const reducedMotion = prefersReducedMotion === true
  const [feedbacks, setFeedbacks] = useState(initialPage.items)
  const [cursor, setCursor] = useState<FeedbackCursor | null>(initialPage.nextCursor)
  const [filter, setFilter] = useState<FeedbackFilter>("all")
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackDTO | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [busyFeedbackId, setBusyFeedbackId] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const skipInitialLoad = useRef(true)
  const previousInitialPage = useRef(initialPage)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)")
    const updateViewport = (event: MediaQueryList | MediaQueryListEvent) => setIsMobile(event.matches)
    updateViewport(mediaQuery)
    mediaQuery.addEventListener("change", updateViewport)
    return () => mediaQuery.removeEventListener("change", updateViewport)
  }, [])

  useEffect(() => {
    setUnreadCount(initialUnreadCount)
  }, [initialUnreadCount])

  useEffect(() => {
    if (skipInitialLoad.current) {
      skipInitialLoad.current = false
      return
    }
    let cancelled = false
    setLoading(true)
    setPageError(null)
    void listFeedbackAction({ expectedRestaurantId: restaurantId, filter }).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setPageError(failureMessage(result.code))
        return
      }
      setFeedbacks(result.data.items)
      setCursor(result.data.nextCursor)
    }).catch(() => {
      if (!cancelled) setPageError("A conexão falhou. Tente carregar os feedbacks novamente.")
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [filter, reloadKey, restaurantId])

  useEffect(() => {
    if (previousInitialPage.current === initialPage) return
    previousInitialPage.current = initialPage
    if (filter === "all") {
      setFeedbacks(initialPage.items)
      setCursor(initialPage.nextCursor)
    } else {
      setReloadKey((current) => current + 1)
    }
  }, [initialPage, filter])

  const sequence = {
    hidden: {},
    visible: { transition: { delayChildren: reducedMotion ? 0 : 0.025, staggerChildren: reducedMotion ? 0 : 0.045 } },
  }
  const item = {
    hidden: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: reducedMotion ? 0.12 : 0.2, ease: EASE } },
  }

  function changeFilter(value: string) {
    if (loading || loadingMore || busyFeedbackId) return
    if (value !== "all" && value !== "unread") return
    setFilter(value)
    setPageError(null)
  }

  async function loadMore() {
    if (!cursor || loadingMore || busyFeedbackId) return
    setLoadingMore(true)
    setPageError(null)
    try {
      const result = await listFeedbackAction({ expectedRestaurantId: restaurantId, filter, cursor })
      if (!result.ok) {
        setPageError(failureMessage(result.code))
        return
      }
      setFeedbacks((current) => {
        const seen = new Set(current.map((feedback) => feedback.id))
        return [...current, ...result.data.items.filter((feedback) => !seen.has(feedback.id))]
      })
      setCursor(result.data.nextCursor)
    } catch {
      setPageError("A conexão falhou. Tente carregar mais feedbacks novamente.")
    } finally {
      setLoadingMore(false)
    }
  }

  async function changeReadState(target: FeedbackDTO, read: boolean) {
    if (busyFeedbackId === target.id || Boolean(target.readAt) === read) return
    const previousItems = feedbacks
    const previousSelected = selectedFeedback
    const rollbackSelected = previousSelected?.id === target.id ? previousSelected : target
    const wasUnread = !target.readAt
    const optimisticReadAt = read ? new Date().toISOString() : null
    const optimistic = { ...target, readAt: optimisticReadAt }
    setBusyFeedbackId(target.id)
    setActionError(null)
    setFeedbacks((current) => filter === "unread" && read
      ? current.filter((feedback) => feedback.id !== target.id)
      : current.map((feedback) => feedback.id === target.id ? optimistic : feedback))
    setSelectedFeedback((current) => current?.id === target.id ? optimistic : current)
    if (wasUnread && read) setUnreadCount((current) => Math.max(0, current - 1))
    else if (!wasUnread && !read) setUnreadCount((current) => current + 1)

    try {
      const result = await markFeedbackReadAction({ expectedRestaurantId: restaurantId, feedbackId: target.id, read })
      if (!result.ok) {
        setFeedbacks(previousItems)
        setSelectedFeedback((current) => current?.id === target.id ? rollbackSelected : current)
        if (wasUnread && read) setUnreadCount((current) => current + 1)
        else if (!wasUnread && !read) setUnreadCount((current) => Math.max(0, current - 1))
        setActionError(failureMessage(result.code))
        return
      }
      const confirmed = { ...optimistic, readAt: result.data.readAt }
      setSelectedFeedback((current) => current?.id === target.id ? confirmed : current)
      router.refresh()
    } catch {
      setFeedbacks(previousItems)
      setSelectedFeedback((current) => current?.id === target.id ? rollbackSelected : current)
      if (wasUnread && read) setUnreadCount((current) => current + 1)
      else if (!wasUnread && !read) setUnreadCount((current) => Math.max(0, current - 1))
      setActionError("A conexão falhou. Seu estado anterior foi restaurado.")
    } finally {
      setBusyFeedbackId(null)
    }
  }

  function openFeedback(feedback: FeedbackDTO) {
    if (busyFeedbackId) return
    setSelectedFeedback(feedback)
    setDetailOpen(true)
    setActionError(null)
    if (!feedback.readAt) void changeReadState(feedback, true)
  }

  async function confirmDelete() {
    if (!selectedFeedback || busyFeedbackId) return
    const target = selectedFeedback
    setBusyFeedbackId(target.id)
    setActionError(null)
    try {
      const result = await deleteFeedbackAction({ expectedRestaurantId: restaurantId, feedbackId: target.id })
      if (!result.ok) {
        setActionError(failureMessage(result.code))
        return
      }
      setFeedbacks((current) => current.filter((feedback) => feedback.id !== target.id))
      if (!target.readAt) setUnreadCount((current) => Math.max(0, current - 1))
      setSelectedFeedback(null)
      setDetailOpen(false)
      router.refresh()
    } catch {
      setActionError("A conexão falhou. O feedback continua disponível para tentar excluir novamente.")
    } finally {
      setBusyFeedbackId(null)
    }
  }

  const selectedBusy = selectedFeedback ? busyFeedbackId === selectedFeedback.id : false
  const noResults = feedbacks.length === 0
  const empty = emptyCopy(filter)

  return (
    <MotionConfig reducedMotion="user">
      <main aria-label="Feedbacks dos clientes" className="min-h-svh">
        <motion.div initial={reducedMotion ? false : "hidden"} animate="visible" variants={sequence} className="mx-auto w-full max-w-[1320px] space-y-5 px-4 pb-28 sm:px-6 md:pb-10 lg:px-8">
          <motion.section variants={item} className="relative overflow-hidden rounded-[1.5rem] border border-primary/12 bg-gradient-to-br from-primary/[0.08] via-card to-card px-5 py-5 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-7 sm:py-6">
            <div className="pointer-events-none absolute -top-16 right-[-2rem] size-56 rounded-full bg-primary/[0.07] blur-3xl" aria-hidden="true" />
            <div className="relative min-w-0">
              <p className="mb-2 flex items-center gap-1.5 text-[0.65rem] font-semibold tracking-[0.14em] text-primary uppercase"><LuSparkles aria-hidden="true" className="size-3.5" />Voz dos clientes</p>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Feedbacks recentes</h2>
              <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted-foreground sm:text-sm">Relatos anônimos do cardápio, com fotos e vídeos enviados pelos clientes.</p>
            </div>
            <div className="relative mt-4 flex min-w-[10rem] items-center gap-3 rounded-2xl border border-border/60 bg-background/70 px-4 py-3 shadow-sm sm:mt-0">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><LuInbox aria-hidden="true" className="size-5" /></span>
              <div><p className="text-xl font-semibold leading-none tabular-nums">{unreadCount}</p><p className="mt-1 text-[0.68rem] text-muted-foreground">{unreadCount === 1 ? "não lido" : "não lidos"}</p></div>
            </div>
          </motion.section>

          <motion.section variants={item} aria-label="Filtrar feedbacks" className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={filter} onValueChange={changeFilter}>
              <TabsList className="h-11 rounded-xl border border-border/70 bg-muted/45 p-1">
                <TabsTrigger value="all" disabled={loading || loadingMore || Boolean(busyFeedbackId)} className="h-9 gap-2 rounded-lg px-3.5 data-active:bg-background data-active:shadow-sm">Todos</TabsTrigger>
                <TabsTrigger value="unread" disabled={loading || loadingMore || Boolean(busyFeedbackId)} className="h-9 gap-2 rounded-lg px-3.5 data-active:bg-background data-active:shadow-sm"><span>Não lidos</span><span className="min-w-5 rounded-full bg-foreground/[0.055] px-1.5 py-0.5 text-[0.62rem] tabular-nums">{unreadCount > 99 ? "99+" : unreadCount}</span></TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex min-h-10 items-center gap-2 text-[0.7rem] text-muted-foreground" aria-live="polite">
              {loading ? <><LuLoaderCircle aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" />Atualizando lista…</> : <><span className="size-1.5 rounded-full bg-emerald-500" />{feedbacks.length} {feedbacks.length === 1 ? "feedback carregado" : "feedbacks carregados"}</>}
            </div>
          </motion.section>

          <AnimatePresence initial={false}>
            {pageError ? (
              <motion.div key={pageError} initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/[0.045] px-4 py-3 text-xs text-destructive">
                <span className="flex items-start gap-2"><LuCircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{pageError}</span>
                <Button type="button" variant="outline" size="sm" className="min-h-9 border-destructive/20 bg-background/60 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setReloadKey((current) => current + 1)}><LuRefreshCw aria-hidden="true" />Tentar novamente</Button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {loading && noResults ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Carregando lista">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="space-y-4 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm sm:p-5">
                  <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><Skeleton className="size-9 rounded-xl" /><div className="space-y-1.5"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-2.5 w-36" /></div></div><Skeleton className="h-6 w-14 rounded-full" /></div>
                  <div className="space-y-2"><Skeleton className="h-3.5 w-full" /><Skeleton className="h-3.5 w-11/12" /><Skeleton className="h-3.5 w-2/3" /></div>
                  <div className="flex items-center justify-between border-t border-border/50 pt-3.5"><div className="flex gap-2"><Skeleton className="size-16 rounded-xl" /><Skeleton className="size-16 rounded-xl" /></div><Skeleton className="size-8 rounded-full" /></div>
                </div>
              ))}
            </div>
          ) : noResults && !pageError ? (
            <motion.div variants={item}>
              <Empty className="min-h-[23rem] rounded-[1.5rem] border border-dashed border-border/70 bg-card/45 px-5 py-12 shadow-sm">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="mb-1 size-12 rounded-2xl bg-primary/10 text-primary"><LuMessageSquareText aria-hidden="true" className="size-5" /></EmptyMedia>
                  <EmptyTitle className="text-base font-semibold tracking-tight">{empty.title}</EmptyTitle>
                  <p className="max-w-md text-xs leading-5 text-muted-foreground">{empty.text}</p>
                </EmptyHeader>
                <EmptyContent className="mt-1 flex-row justify-center">
                  {filter === "unread" ? <Button type="button" variant="outline" className="min-h-10 rounded-xl" onClick={() => changeFilter("all")}>Ver todos os feedbacks</Button> : <span className="inline-flex items-center gap-1.5 text-[0.68rem] text-muted-foreground"><LuSparkles aria-hidden="true" className="size-3.5 text-primary" />Novos relatos ficarão disponíveis por aqui.</span>}
                </EmptyContent>
              </Empty>
            </motion.div>
          ) : feedbacks.length ? (
            <motion.section key={filter} initial={reducedMotion ? false : "hidden"} animate="visible" variants={sequence} aria-label={filter === "all" ? "Todos os feedbacks" : "Feedbacks não lidos"} aria-busy={loading} className={`grid gap-3 md:grid-cols-2 xl:grid-cols-3 ${loading ? "opacity-60" : ""}`}>
              <AnimatePresence initial={false} mode="popLayout">
                {feedbacks.map((feedback) => <motion.div key={feedback.id} variants={item} initial={reducedMotion ? false : "hidden"} animate="visible" exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -5, transition: { duration: 0.14 } }}><FeedbackCard feedback={feedback} disabled={Boolean(busyFeedbackId)} onOpen={openFeedback} /></motion.div>)}
              </AnimatePresence>
            </motion.section>
          ) : null}

          {cursor && !loading ? <div className="flex justify-center pt-1"><Button type="button" variant="outline" className="min-h-11 min-w-44 rounded-xl" onClick={() => void loadMore()} disabled={loadingMore || Boolean(busyFeedbackId)}><span className="inline-flex items-center gap-2">{loadingMore ? <LuLoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : null}{loadingMore ? "Carregando…" : "Carregar mais"}</span></Button></div> : null}
        </motion.div>
      </main>

      <FeedbackDetail
        key={selectedFeedback?.id ?? "no-feedback"}
        feedback={selectedFeedback}
        open={detailOpen}
        isMobile={isMobile}
        busy={selectedBusy}
        error={actionError}
        onOpenChange={(next) => { setDetailOpen(next); if (!next) { setSelectedFeedback(null); setActionError(null) } }}
        onToggleRead={() => { if (selectedFeedback) void changeReadState(selectedFeedback, !selectedFeedback.readAt) }}
        onDelete={() => void confirmDelete()}
      />
    </MotionConfig>
  )
}
