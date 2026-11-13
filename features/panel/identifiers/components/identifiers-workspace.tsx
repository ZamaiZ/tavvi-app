"use client"

import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  LuCircleAlert,
  LuCircleDashed,
  LuNfc,
  LuPlus,
  LuSearch,
  LuShieldCheck,
  LuX,
} from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  IdentifierDTO,
  IdentifierActionFailureCode,
  PanelIdentifiersDTO,
} from "../model"
import { setIdentifierActiveAction } from "../actions"
import { IdentifierDetailsDialog } from "./identifier-details-dialog"
import { IdentifierEditorDialog } from "./identifier-editor-dialog"
import { IdentifiersDataTable } from "./identifiers-data-table"
import { IdentifierListItem } from "./identifier-list-item"

type Filter = "all" | "pending" | "protected" | "inactive"

const EASE = [0.23, 1, 0.32, 1] as const

function toggleFailureMessage(code: IdentifierActionFailureCode) {
  if (code === "table_conflict") return "Outra mesa já usa esse número."
  if (code === "session_expired") return "Sua sessão expirou. Entre novamente."
  if (code === "context_changed")
    return "O restaurante ativo mudou. Atualize a página."
  return "Não foi possível atualizar o identificador. Tente novamente."
}

function EmptyState({
  isInitial,
  onCreate,
  onClear,
}: {
  isInitial: boolean
  onCreate: () => void
  onClear: () => void
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border/80 bg-card/55 px-5 py-12 text-center sm:px-8">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/[0.08] text-primary">
        <LuNfc aria-hidden="true" className="size-5" />
      </span>
      <h2 className="mt-4 text-base font-semibold tracking-tight">
        {isInitial ? "Nenhuma mesa cadastrada" : "Nenhum resultado encontrado"}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        {isInitial
          ? "Crie o primeiro identificador para preparar o acesso por link ou etiqueta NFC."
          : "Tente outro número de mesa ou limpe os filtros para ver os identificadores cadastrados."}
      </p>
      <Button
        type="button"
        variant={isInitial ? "default" : "outline"}
        onClick={isInitial ? onCreate : onClear}
        className="mt-5 min-h-11 rounded-xl"
      >
        {isInitial ? (
          <>
            <LuPlus aria-hidden="true" />
            Nova mesa
          </>
        ) : (
          <>
            <LuX aria-hidden="true" />
            Limpar filtros
          </>
        )}
      </Button>
    </div>
  )
}

export function IdentifiersWorkspace({
  initialData,
}: {
  initialData: PanelIdentifiersDTO
}) {
  const router = useRouter()
  const reducedMotion = useReducedMotion() === true
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorIdentifierId, setEditorIdentifierId] = useState<string | null>(
    null
  )
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedIdentifierId, setSelectedIdentifierId] = useState<
    string | null
  >(null)
  const [busyIdentifierId, setBusyIdentifierId] = useState<string | null>(null)
  const [copiedIdentifierId, setCopiedIdentifierId] = useState<string | null>(
    null
  )
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const copyFeedbackTimeoutRef = useRef<number | null>(null)

  const selectedIdentifier =
    initialData.identifiers.find(
      (entry) => entry.id === selectedIdentifierId
    ) ?? null
  const editorIdentifier =
    initialData.identifiers.find((entry) => entry.id === editorIdentifierId) ??
    null
  const filterOptions = [
    {
      id: "all" as const,
      label: "Todas",
      count: initialData.counts.all,
      icon: null,
    },
    {
      id: "pending" as const,
      label: "NFC pendente",
      count: initialData.counts.pending,
      icon: <LuCircleDashed aria-hidden="true" className="size-3.5" />,
    },
    {
      id: "protected" as const,
      label: "Protegidas",
      count: initialData.counts.protected,
      icon: <LuShieldCheck aria-hidden="true" className="size-3.5" />,
    },
    {
      id: "inactive" as const,
      label: "Desativadas",
      count: initialData.counts.inactive,
      icon: null,
    },
  ]

  const filteredIdentifiers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR")
    return initialData.identifiers.filter((identifier) => {
      const matchesQuery =
        !normalizedQuery ||
        String(identifier.tableNumber).includes(normalizedQuery) ||
        `mesa ${identifier.tableNumber}`.includes(normalizedQuery)
      const matchesFilter =
        filter === "all" ||
        (filter === "pending" &&
          identifier.isActive &&
          identifier.nfcStatus !== "protected") ||
        (filter === "protected" &&
          identifier.isActive &&
          identifier.nfcStatus === "protected") ||
        (filter === "inactive" && !identifier.isActive)
      return matchesQuery && matchesFilter
    })
  }, [filter, initialData.identifiers, query])

  const sequenceVariants = {
    hidden: {},
    visible: {
      transition: {
        delayChildren: reducedMotion ? 0 : 0.025,
        staggerChildren: reducedMotion ? 0 : 0.045,
      },
    },
  }
  const itemVariants = {
    hidden: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: reducedMotion ? 0.12 : 0.22, ease: EASE },
    },
  }

  const openDetails = useCallback((identifier: IdentifierDTO) => {
    setSelectedIdentifierId(identifier.id)
    setDetailsOpen(true)
  }, [])

  const editIdentifier = useCallback((identifier: IdentifierDTO) => {
    setDetailsOpen(false)
    setEditorIdentifierId(identifier.id)
    setEditorOpen(true)
  }, [])

  function createIdentifier() {
    setEditorIdentifierId(null)
    setEditorOpen(true)
  }

  const toggleActive = useCallback(
    async (identifier: IdentifierDTO) => {
      setBusyIdentifierId(identifier.id)
      setActionMessage(null)
      try {
        const result = await setIdentifierActiveAction({
          expectedRestaurantId: initialData.restaurantId,
          id: identifier.id,
          isActive: !identifier.isActive,
        })
        if (!result.ok) {
          setActionMessage(toggleFailureMessage(result.code))
          return
        }
        router.refresh()
      } catch {
        setActionMessage(
          "Não foi possível conectar ao servidor. Tente novamente."
        )
      } finally {
        setBusyIdentifierId(null)
      }
    },
    [initialData.restaurantId, router]
  )

  const copyIdentifierLink = useCallback(async (identifier: IdentifierDTO) => {
    setActionMessage(null)
    try {
      await navigator.clipboard.writeText(identifier.publicUrl)
      setCopiedIdentifierId(identifier.id)
      if (copyFeedbackTimeoutRef.current !== null)
        window.clearTimeout(copyFeedbackTimeoutRef.current)
      copyFeedbackTimeoutRef.current = window.setTimeout(() => {
        setCopiedIdentifierId((current) =>
          current === identifier.id ? null : current
        )
        copyFeedbackTimeoutRef.current = null
      }, 1800)
    } catch {
      setActionMessage(
        "Não foi possível copiar o link. Abra os detalhes da mesa e tente novamente."
      )
    }
  }, [])

  useEffect(
    () => () => {
      if (copyFeedbackTimeoutRef.current !== null)
        window.clearTimeout(copyFeedbackTimeoutRef.current)
    },
    []
  )

  function clearFilters() {
    setQuery("")
    setFilter("all")
  }

  const isInitialEmpty = initialData.identifiers.length === 0
  const showFilteredEmpty = filteredIdentifiers.length === 0 && !isInitialEmpty

  return (
    <MotionConfig reducedMotion="user">
      <main aria-label="Identificadores do restaurante" className="min-h-svh">
        <motion.div
          initial={reducedMotion ? false : "hidden"}
          animate="visible"
          variants={sequenceVariants}
          className="mx-auto w-full max-w-[1320px] space-y-5 px-4 pb-28 sm:px-6 md:pb-10 lg:px-8"
        >
          <motion.div
            variants={itemVariants}
            className="flex items-center justify-between gap-3"
          >
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {initialData.counts.all}
              </span>{" "}
              {initialData.counts.all === 1
                ? "identificador cadastrado"
                : "identificadores cadastrados"}
            </p>
            <Button
              type="button"
              onClick={createIdentifier}
              className="min-h-11 shrink-0 rounded-xl px-4"
            >
              <LuPlus aria-hidden="true" />
              Nova mesa
            </Button>
          </motion.div>

          <motion.div variants={itemVariants} className="relative">
            <LuSearch
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar pelo número da mesa"
              aria-label="Buscar pelo número da mesa"
              className="h-12 rounded-2xl border-border/70 bg-card pr-11 pl-11 shadow-sm placeholder:text-muted-foreground/75"
            />
            {query ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Limpar busca"
                onClick={() => setQuery("")}
                className="absolute top-1/2 right-2 size-8 -translate-y-1/2 rounded-lg text-muted-foreground"
              >
                <LuX aria-hidden="true" className="size-4" />
              </Button>
            ) : null}
          </motion.div>

          <motion.div variants={itemVariants}>
            <Tabs
              value={filter}
              onValueChange={(value) => setFilter(value as Filter)}
              aria-label="Filtrar identificadores"
              className="gap-3"
            >
              <div className="-mx-1 [scrollbar-width:none] overflow-x-auto overscroll-x-contain px-1 pb-1 [&::-webkit-scrollbar]:hidden">
                <TabsList className="h-10 w-max min-w-full justify-start gap-1 rounded-xl bg-muted/55 p-1 sm:min-w-0">
                  {filterOptions.map((option) => (
                    <TabsTrigger
                      key={option.id}
                      value={option.id}
                      className="group/tabs-trigger h-8 flex-none gap-2 rounded-lg px-3.5 text-xs text-muted-foreground transition-colors motion-reduce:transition-none data-active:bg-background data-active:text-foreground data-active:shadow-sm"
                    >
                      {option.icon}
                      <span>{option.label}</span>
                      <span className="rounded-full bg-foreground/5 px-1.5 py-0.5 text-[0.625rem] text-muted-foreground tabular-nums group-data-[active]/tabs-trigger:bg-primary/10 group-data-[active]/tabs-trigger:text-primary">
                        {option.count}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <TabsContent value={filter} className="mt-0 space-y-5">
                {actionMessage ? (
                  <motion.div
                    variants={itemVariants}
                    role="status"
                    className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.045] px-4 py-3 text-sm text-destructive"
                  >
                    <LuCircleAlert
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0"
                    />
                    <p>{actionMessage}</p>
                  </motion.div>
                ) : null}

                {isInitialEmpty || showFilteredEmpty ? (
                  <motion.div variants={itemVariants}>
                    <EmptyState
                      isInitial={isInitialEmpty}
                      onCreate={createIdentifier}
                      onClear={clearFilters}
                    />
                  </motion.div>
                ) : (
                  <motion.section
                    variants={itemVariants}
                    aria-label="Lista de identificadores"
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between px-1">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {filteredIdentifiers.length}
                        </span>{" "}
                        {filteredIdentifiers.length === 1 ? "mesa" : "mesas"}
                      </p>
                      <p className="hidden text-[0.65rem] text-muted-foreground sm:block">
                        Um identificador ativo por número de mesa
                      </p>
                    </div>
                    <div className="hidden md:block">
                      <IdentifiersDataTable
                        rows={filteredIdentifiers}
                        busyIdentifierId={busyIdentifierId}
                        copiedIdentifierId={copiedIdentifierId}
                        onOpen={openDetails}
                        onToggleActive={toggleActive}
                        onEdit={editIdentifier}
                        onCopyLink={copyIdentifierLink}
                      />
                    </div>
                    <div className="grid gap-3 md:hidden">
                      <AnimatePresence initial={false} mode="sync">
                        {filteredIdentifiers.map((identifier, index) => (
                          <motion.div
                            key={identifier.id}
                            role="presentation"
                            initial={
                              reducedMotion
                                ? { opacity: 0 }
                                : { opacity: 0, y: 6 }
                            }
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{
                              duration: reducedMotion ? 0.1 : 0.18,
                              delay: reducedMotion ? 0 : index * 0.025,
                              ease: EASE,
                            }}
                          >
                            <IdentifierListItem
                              identifier={identifier}
                              busy={busyIdentifierId === identifier.id}
                              copied={copiedIdentifierId === identifier.id}
                              onOpen={() => openDetails(identifier)}
                              onToggleActive={() =>
                                void toggleActive(identifier)
                              }
                              onCopyLink={() => copyIdentifierLink(identifier)}
                              onEdit={() => editIdentifier(identifier)}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </motion.section>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        </motion.div>

        <IdentifierEditorDialog
          open={editorOpen}
          identifier={editorIdentifier}
          restaurantId={initialData.restaurantId}
          onOpenChange={setEditorOpen}
          onSaved={() => router.refresh()}
        />
        <IdentifierDetailsDialog
          open={detailsOpen}
          identifier={selectedIdentifier}
          restaurantId={initialData.restaurantId}
          onOpenChange={(open) => {
            setDetailsOpen(open)
            if (!open) setSelectedIdentifierId(null)
          }}
          onEdit={editIdentifier}
          onSaved={() => router.refresh()}
        />
      </main>
    </MotionConfig>
  )
}
