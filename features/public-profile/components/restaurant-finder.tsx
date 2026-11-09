"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Combobox as BaseCombobox } from "@base-ui/react"
import {
  LuLoaderCircle,
  LuMapPin,
  LuRotateCw,
  LuSearch,
  LuSearchX,
  LuUtensils,
  LuX,
} from "react-icons/lu"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { BrandImage } from "@/features/public-profile/components/brand-image"
import styles from "./restaurant-finder-empty-state.module.css"
import {
  parsePublicRestaurantSearchPage,
  type PublicRestaurantAddress,
  type PublicRestaurantSearchResult,
} from "@/features/public-profile/model"

type SearchStatus = "idle" | "loading" | "loading-more" | "error"

function compactAddress(address: PublicRestaurantAddress | null) {
  if (!address) return null

  const street = [address.street, address.number, address.complement]
    .filter(Boolean)
    .join(", ")
  const locality = [address.city, address.state].filter(Boolean).join(" / ")
  const parts = [street, address.district, locality].filter(Boolean)

  return parts.length ? parts.join(" · ") : null
}

function restaurantInitial(name: string) {
  return name.trim().charAt(0).toLocaleUpperCase("pt-BR") || "R"
}

function RestaurantRow({ restaurant }: { restaurant: PublicRestaurantSearchResult }) {
  const address = compactAddress(restaurant.address)
  const accessibleLabel = [restaurant.name, restaurant.segment, address]
    .filter(Boolean)
    .join(", ")

  return (
    <ComboboxItem
      value={restaurant.slug}
      aria-label={accessibleLabel}
      className="group/restaurant-option min-h-[76px] cursor-pointer gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-accent/65 data-highlighted:bg-accent/70 motion-reduce:transition-none"
    >
      <span
        aria-hidden="true"
        className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-muted/70 text-base font-semibold text-muted-foreground shadow-sm"
      >
        {restaurant.hasLogo ? (
          <BrandImage
            slug={restaurant.slug}
            slot="logo"
            alt=""
            sizes="48px"
            className="object-contain p-1"
            fallback={restaurantInitial(restaurant.name)}
          />
        ) : (
          restaurantInitial(restaurant.name)
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <span className="truncate text-sm font-semibold leading-5 text-foreground">
          {restaurant.name}
        </span>
        {restaurant.segment ? (
          <span className="flex min-w-0 items-center gap-1.5 text-xs leading-4 text-muted-foreground">
            <LuUtensils aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{restaurant.segment}</span>
          </span>
        ) : null}
        {address ? (
          <span className="flex min-w-0 items-center gap-1.5 text-xs leading-4 text-muted-foreground/85">
            <LuMapPin aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{address}</span>
          </span>
        ) : null}
      </span>
    </ComboboxItem>
  )
}

function LoadingRows() {
  return (
    <div className="space-y-1 p-1" role="status" aria-label="Carregando restaurantes">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex min-h-[76px] items-center gap-3 rounded-xl px-3 py-2.5">
          <Skeleton className="size-12 shrink-0 rounded-xl motion-reduce:animate-none" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5 rounded-full motion-reduce:animate-none" />
            <Skeleton className="h-3 w-3/5 rounded-full motion-reduce:animate-none" />
            <Skeleton className="h-3 w-4/5 rounded-full motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function RestaurantFinder() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const requestSequenceRef = useRef(0)
  const panelOpenRef = useRef(false)
  const navigatingRef = useRef(false)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [restaurants, setRestaurants] = useState<PublicRestaurantSearchResult[]>([])
  const [status, setStatus] = useState<SearchStatus>("idle")
  const [hasMore, setHasMore] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [navigating, setNavigating] = useState(false)

  const items = useMemo(
    () => BaseCombobox.createItems(restaurants, {
      getValue: (restaurant) => restaurant.slug,
      getLabel: (restaurant) => restaurant.name,
    }),
    [restaurants],
  )

  const cancelPendingSearch = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    controllerRef.current?.abort()
    controllerRef.current = null
    requestSequenceRef.current += 1
  }, [])

  const loadPage = useCallback(async (
    search: string,
    page: number,
    append: boolean,
    requestSequence: number,
  ) => {
    const controller = new AbortController()
    controllerRef.current = controller

    try {
      const params = new URLSearchParams({ q: search, page: String(page) })
      const response = await fetch(`/api/public/restaurants?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      })
      if (!response.ok) throw new Error("public_restaurant_search_failed")

      const parsedPage = parsePublicRestaurantSearchPage(await response.json())
      if (!parsedPage) throw new Error("public_restaurant_search_invalid_response")
      if (requestSequence !== requestSequenceRef.current) return

      setRestaurants((current) => {
        if (!append) return parsedPage.rows
        const currentSlugs = new Set(current.map((restaurant) => restaurant.slug))
        return [
          ...current,
          ...parsedPage.rows.filter((restaurant) => !currentSlugs.has(restaurant.slug)),
        ]
      })
      setCurrentPage(page)
      setHasMore(parsedPage.hasMore)
      setStatus("idle")
    } catch {
      if (controller.signal.aborted || requestSequence !== requestSequenceRef.current) return
      setStatus("error")
    }
  }, [])

  const scheduleSearch = useCallback((value: string, delay: number) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    controllerRef.current?.abort()
    controllerRef.current = null
    const requestSequence = ++requestSequenceRef.current

    setRestaurants([])
    setCurrentPage(0)
    setHasMore(false)
    setStatus("loading")

    timerRef.current = setTimeout(() => {
      timerRef.current = null
      void loadPage(value.trim(), 1, false, requestSequence)
    }, delay)
  }, [loadPage])

  const changePanelOpen = useCallback((nextOpen: boolean) => {
    if (panelOpenRef.current === nextOpen) return
    panelOpenRef.current = nextOpen
    setOpen(nextOpen)

    if (nextOpen) {
      scheduleSearch(query, 0)
      return
    }

    cancelPendingSearch()
    setStatus("idle")
  }, [cancelPendingSearch, query, scheduleSearch])

  const updateQuery = useCallback((value: string) => {
    setQuery(value)
    if (navigatingRef.current) return
    if (!panelOpenRef.current) {
      panelOpenRef.current = true
      setOpen(true)
    }
    scheduleSearch(value, value.trim() ? 250 : 0)
  }, [scheduleSearch])

  const loadMore = useCallback(() => {
    if (!hasMore || status === "loading-more" || currentPage < 1) return
    controllerRef.current?.abort()
    setStatus("loading-more")
    void loadPage(query.trim(), currentPage + 1, true, requestSequenceRef.current)
  }, [currentPage, hasMore, loadPage, query, status])

  const retry = useCallback(() => {
    if (restaurants.length > 0 && hasMore && currentPage > 0) {
      loadMore()
      return
    }
    scheduleSearch(query, 0)
  }, [currentPage, hasMore, loadMore, query, restaurants.length, scheduleSearch])

  const selectRestaurant = useCallback((value: string | null) => {
    if (!value) return
    const restaurant = restaurants.find((candidate) => candidate.slug === value)
    if (!restaurant) return

    navigatingRef.current = true
    setNavigating(true)
    changePanelOpen(false)
    router.push(`/${restaurant.slug}`)
  }, [changePanelOpen, restaurants, router])

  const isLoading = status === "loading" || status === "loading-more" || navigating
  const showEmptyState = status === "idle" && restaurants.length === 0
  const liveMessage = status === "loading"
    ? query.trim() ? "Buscando restaurantes." : "Carregando restaurantes ativos."
    : status === "error"
      ? "Não foi possível carregar os restaurantes."
      : open && status === "idle" && restaurants.length > 0
        ? restaurants.length === 1
          ? "1 restaurante encontrado."
          : `${restaurants.length} restaurantes encontrados.`
        : ""

  return (
    <div className="relative z-20 mx-auto mt-8 w-full max-w-xl text-left">
      <label htmlFor="restaurant-finder-input" className="sr-only">
        Buscar restaurantes por nome, cozinha ou endereço
      </label>

      <Combobox
        open={open}
        onOpenChange={changePanelOpen}
        value={null}
        inputValue={query}
        onInputValueChange={(value, eventDetails) => {
          if (eventDetails.reason !== "input-change") return
          updateQuery(value)
        }}
        inputRef={inputRef}
        items={items}
        filter={null}
        openOnInputClick
        loopFocus
        onValueChange={selectRestaurant}
      >
        <ComboboxInput
          id="restaurant-finder-input"
          placeholder="Restaurante, cozinha ou endereço"
          maxLength={120}
          autoComplete="off"
          showTrigger={false}
          showClear={false}
          startAdornment={<LuSearch aria-hidden="true" className="size-5 text-primary" />}
          onFocus={() => changePanelOpen(true)}
          aria-describedby="restaurant-finder-hint"
          className="h-14 rounded-2xl border-border/75 bg-card/85 px-1 text-base shadow-lg shadow-black/5 backdrop-blur-xl transition-all duration-200 focus-within:border-primary/45 focus-within:ring-4 focus-within:ring-primary/10 motion-reduce:transition-none"
        >
          <InputGroupAddon align="inline-end" className="gap-1 pr-2">
            {isLoading ? (
              <LuLoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary motion-reduce:animate-none" />
            ) : null}
            {query ? (
              <InputGroupButton
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Limpar busca"
                className="size-11 rounded-xl text-muted-foreground hover:text-foreground"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  updateQuery("")
                  inputRef.current?.focus()
                }}
              >
                <LuX aria-hidden="true" className="size-4" />
              </InputGroupButton>
            ) : null}
          </InputGroupAddon>
        </ComboboxInput>
        <ComboboxContent
          sideOffset={10}
          align="center"
          className="flex max-h-[min(28rem,var(--available-height))] flex-col rounded-2xl border border-border/70 bg-popover/95 p-1.5 shadow-2xl shadow-black/10 backdrop-blur-2xl transition-[opacity,transform] duration-150 data-open:scale-100 data-open:opacity-100 data-closed:scale-[0.98] data-closed:opacity-0 motion-reduce:transition-none"
        >
          <ComboboxEmpty
            className={showEmptyState
              ? "min-h-16 justify-start gap-3 rounded-xl px-3 py-2 text-left text-xs text-muted-foreground"
              : "block sr-only"}
          >
            {showEmptyState ? (
              <>
                <span aria-hidden="true" className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/8 text-primary shadow-sm shadow-primary/5">
                  <LuSearchX className={`size-5 ${styles.emptyIcon}`} />
                  <span className={`absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-border/75 bg-popover text-muted-foreground shadow-sm ${styles.emptyUtensils}`}>
                    <LuUtensils className="size-3" />
                  </span>
                  <span className={`absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border border-border/75 bg-popover text-muted-foreground shadow-sm ${styles.emptyPin}`}>
                    <LuMapPin className="size-3" />
                  </span>
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold leading-5 text-foreground">
                    {query.trim()
                      ? <>Sem resultados para “{query.trim()}”</>
                      : "Ainda não há restaurantes ativos."}
                  </span>
                  <span className="text-xs leading-4 text-muted-foreground">
                    {query.trim()
                      ? "Tente outro termo para sua pesquisa."
                      : "Os restaurantes ativos aparecerão aqui."}
                  </span>
                </span>
              </>
            ) : null}
          </ComboboxEmpty>

          {status === "loading" ? (
            <LoadingRows />
          ) : status === "error" && restaurants.length === 0 ? (
            <div className="flex min-h-36 flex-col items-center justify-center gap-3 px-5 py-6 text-center" role="alert">
              <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <LuRotateCw aria-hidden="true" className="size-5" />
              </span>
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar os restaurantes.
              </p>
              <button
                type="button"
                className="min-h-11 rounded-xl px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                onMouseDown={(event) => event.preventDefault()}
                onClick={retry}
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              <ComboboxList className="min-h-0 max-h-none flex-1 space-y-1 overflow-y-auto p-1">
                {restaurants.map((restaurant) => (
                  <RestaurantRow key={restaurant.slug} restaurant={restaurant} />
                ))}
              </ComboboxList>

              {status === "loading-more" ? (
                <div role="status" className="flex min-h-11 shrink-0 items-center justify-center gap-2 text-xs text-muted-foreground">
                  <LuLoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
                  Carregando mais restaurantes…
                </div>
              ) : status === "error" ? (
                <div className="flex shrink-0 items-center justify-between gap-3 px-3 py-2" role="alert">
                  <span className="text-xs text-muted-foreground">Não foi possível carregar mais resultados.</span>
                  <button
                    type="button"
                    className="min-h-11 shrink-0 rounded-lg px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={retry}
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : hasMore ? (
                <button
                  type="button"
                  className="flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={loadMore}
                >
                  Ver mais restaurantes
                </button>
              ) : null}
            </>
          )}
        </ComboboxContent>
      </Combobox>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>
    </div>
  )
}
