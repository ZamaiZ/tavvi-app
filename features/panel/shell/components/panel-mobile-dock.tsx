"use client"

import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react"
import Link, { useLinkStatus } from "next/link"
import { useEffect, useState, type ReactNode } from "react"
import {
  LuCheck,
  LuContactRound,
  LuHouse,
  LuIdCard,
  LuLoaderCircle,
  LuMenu,
  LuUtensils,
  LuX,
} from "react-icons/lu"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { PanelAccountMenu } from "@/features/panel/shell/components/panel-account-menu"

const DOCK_EASE = [0.23, 1, 0.32, 1] as const
const PANEL_NAV_ID = "panel-mobile-navigation"

function PanelMobileNavItem({
  href,
  label,
  section,
  activeSection,
  icon,
  onNavigate,
}: {
  href: string
  label: string
  section: "menu" | "identity" | "contact"
  activeSection: "menu" | "identity" | "contact"
  icon: ReactNode
  onNavigate: () => void
}) {
  const active = activeSection === section
  return (
    <Link href={href} aria-current={active ? "page" : undefined} onClick={onNavigate} className={`group flex min-h-16 items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-foreground outline-none shadow-sm transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.99] motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none ${active ? "border-primary/20 bg-primary/[0.07] shadow-primary/5" : "border-border/70 bg-background/60 hover:bg-muted/60"}`}>
      <span className={`grid size-11 shrink-0 place-items-center rounded-[0.9rem] shadow-sm ${active ? "bg-primary text-primary-foreground shadow-primary/20" : "bg-muted text-muted-foreground"}`}>{icon}</span>
      <span className="min-w-0 flex-1 text-sm font-semibold tracking-tight">{label}</span>
      {active ? <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary"><LuCheck aria-hidden="true" className="size-3.5" /></span> : null}
    </Link>
  )
}

function HomeLinkFeedback({ reducedMotion }: { reducedMotion: boolean }) {
  const { pending } = useLinkStatus()

  return (
    <span className="grid size-full place-items-center">
      <AnimatePresence mode="wait" initial={false}>
        {pending ? (
          <motion.span
            key="pending"
            aria-hidden="true"
            initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.12 : 0.16, ease: DOCK_EASE }}
          >
            <LuLoaderCircle className={`size-[1.35rem] ${reducedMotion ? "" : "animate-spin motion-reduce:animate-none"}`} />
          </motion.span>
        ) : (
          <motion.span
            key="arrow"
            aria-hidden="true"
            initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.92 }}
            transition={{ duration: reducedMotion ? 0.12 : 0.16, ease: DOCK_EASE }}
          >
            <LuHouse aria-hidden="true" className="size-[1.35rem]" />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

export function PanelMobileDock({
  cardapioHref,
  identityHref,
  contactHref,
  activeSection,
  restaurantsHref,
  canSwitchRestaurants,
}: {
  cardapioHref: string
  identityHref: string
  contactHref: string
  activeSection: "menu" | "identity" | "contact"
  restaurantsHref: string
  canSwitchRestaurants: boolean
}) {
  const prefersReducedMotion = useReducedMotion()
  const reducedMotion = prefersReducedMotion === true
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  useEffect(() => {
    const desktopBreakpoint = window.matchMedia("(min-width: 768px)")
    const closeMobileOverlays = (event: MediaQueryListEvent | MediaQueryList) => {
      if (!event.matches) return
      setNavigationOpen(false)
      setAccountOpen(false)
    }

    closeMobileOverlays(desktopBreakpoint)
    desktopBreakpoint.addEventListener("change", closeMobileOverlays)
    return () => desktopBreakpoint.removeEventListener("change", closeMobileOverlays)
  }, [])

  const sheetVariants = {
    hidden: {},
    visible: {
      transition: {
        delayChildren: reducedMotion ? 0 : 0.02,
        staggerChildren: reducedMotion ? 0 : 0.04,
      },
    },
  }
  const itemVariants = {
    hidden: reducedMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(8px)" },
    visible: {
      opacity: 1,
      transform: "translateY(0px)",
      transition: { duration: reducedMotion ? 0.12 : 0.18, ease: DOCK_EASE },
    },
  }

  return (
    <MotionConfig reducedMotion="user">
      <Sheet
        open={navigationOpen}
        onOpenChange={(open) => {
          setNavigationOpen(open)
          if (open) setAccountOpen(false)
        }}
      >
        <motion.nav
          aria-label="Navegação do Painel"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(16px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          transition={reducedMotion ? { duration: 0.12, ease: DOCK_EASE } : { type: "spring", duration: 0.26, bounce: 0.12 }}
          className="fixed right-3 left-3 z-40 md:hidden"
          style={{ bottom: "calc(0.875rem + env(safe-area-inset-bottom))" }}
        >
          <div className="grid h-[4.75rem] grid-cols-3 items-center rounded-[1.65rem] border border-border/70 bg-background/80 p-1.5 shadow-xl shadow-foreground/10 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/65">
            <div className="flex h-full items-center justify-center">
              <PanelAccountMenu
                variant="dock"
                restaurantsHref={restaurantsHref}
                canSwitchRestaurants={canSwitchRestaurants}
                open={accountOpen}
                onOpenChange={(open) => {
                  setAccountOpen(open)
                  if (open) setNavigationOpen(false)
                }}
              />
            </div>

            <Link
              href={cardapioHref}
              aria-label="Início — Cardápio"
              aria-current={activeSection === "menu" ? "page" : undefined}
              onClick={() => {
                setAccountOpen(false)
                setNavigationOpen(false)
              }}
              className="group relative grid h-full place-items-center rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="block">
                <motion.span
                  whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                  transition={{ duration: 0.14, ease: DOCK_EASE }}
                  className="grid size-[3.25rem] place-items-center rounded-[1.2rem] border border-primary/15 bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-colors duration-200"
                >
                  <HomeLinkFeedback reducedMotion={reducedMotion} />
                </motion.span>
              </span>
            </Link>

            <div className="flex h-full items-center justify-center">
              <SheetTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={navigationOpen ? "Fechar navegação" : "Abrir navegação"}
                    aria-haspopup="dialog"
                    aria-expanded={navigationOpen}
                    aria-controls={PANEL_NAV_ID}
                    className={`h-14 w-full flex-col gap-1 rounded-2xl px-2 transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96] motion-reduce:active:scale-100 motion-reduce:transition-none ${
                      navigationOpen
                        ? "bg-primary/10 text-primary hover:bg-primary/15"
                        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                    }`}
                    onClick={() => setAccountOpen(false)}
                  />
                }
              >
                <LuMenu aria-hidden="true" className="size-5" />
                <span className="text-[0.625rem] font-medium leading-none">Navegar</span>
              </SheetTrigger>
            </div>
          </div>
        </motion.nav>

        <SheetContent
          id={PANEL_NAV_ID}
          side="bottom"
          showCloseButton={false}
          overlayClassName="bg-black/25 dark:bg-black/45 motion-reduce:transition-none motion-reduce:duration-0"
          className="max-h-[min(72dvh,34rem)] overflow-y-auto rounded-t-[1.75rem] border-border/70 bg-background/90 px-4 pt-3 pb-[calc(1rem_+_env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-2xl ease-[cubic-bezier(0.32,0.72,0,1)] transition-[transform,opacity] motion-reduce:transition-none motion-reduce:duration-0 sm:max-w-none"
          style={reducedMotion ? { transitionDuration: "0ms" } : undefined}
        >
          <SheetHeader className="px-1 pt-2 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <SheetTitle className="text-lg font-semibold tracking-tight">Navegação</SheetTitle>
                <SheetDescription className="text-xs">Acesse as áreas do seu restaurante.</SheetDescription>
              </div>
              <SheetClose
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Fechar navegação"
                    className="size-11 -mt-1 -mr-1 rounded-full text-muted-foreground hover:text-foreground motion-reduce:active:translate-y-0! motion-reduce:transition-none"
                  />
                }
              >
                <LuX aria-hidden="true" className="size-4" />
              </SheetClose>
            </div>
          </SheetHeader>

          <motion.nav id={`${PANEL_NAV_ID}-links`} aria-label="Áreas do Painel" variants={sheetVariants} initial={reducedMotion ? false : "hidden"} animate={navigationOpen ? "visible" : "hidden"} className="grid gap-4">
            <motion.div variants={itemVariants} className="space-y-2">
              <p className="px-1 text-[0.65rem] font-semibold tracking-[0.13em] text-muted-foreground uppercase">Operação</p>
              <PanelMobileNavItem href={cardapioHref} label="Cardápio" section="menu" activeSection={activeSection} icon={<LuUtensils aria-hidden="true" className="size-[1.2rem]" />} onNavigate={() => setNavigationOpen(false)} />
            </motion.div>
            <motion.div variants={itemVariants} className="space-y-2">
              <p className="px-1 text-[0.65rem] font-semibold tracking-[0.13em] text-muted-foreground uppercase">Perfil público</p>
              <div className="grid gap-2">
                <PanelMobileNavItem href={identityHref} label="Identidade" section="identity" activeSection={activeSection} icon={<LuIdCard aria-hidden="true" className="size-[1.2rem]" />} onNavigate={() => setNavigationOpen(false)} />
                <PanelMobileNavItem href={contactHref} label="Contato" section="contact" activeSection={activeSection} icon={<LuContactRound aria-hidden="true" className="size-[1.2rem]" />} onNavigate={() => setNavigationOpen(false)} />
              </div>
            </motion.div>
          </motion.nav>
        </SheetContent>
      </Sheet>
    </MotionConfig>
  )
}
