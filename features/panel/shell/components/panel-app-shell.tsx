"use client"

import Link from "next/link"
import type { CSSProperties, ReactNode } from "react"
import { useState } from "react"
import { MotionConfig, motion, useReducedMotion } from "motion/react"
import {
  LuChevronsUpDown,
  LuUtensils,
} from "react-icons/lu"

import { BrandImage } from "@/features/public-profile/components/brand-image"
import { restaurantInitials } from "@/features/panel/shell/lib/restaurant-initials"
import { PanelRestaurantSwitcher } from "@/features/panel/shell/components/panel-restaurant-switcher"
import { PanelAccountMenu } from "@/features/panel/shell/components/panel-account-menu"
import { PanelMobileDock } from "@/features/panel/shell/components/panel-mobile-dock"
import type { PanelRestaurantListItem } from "@/features/panel/workspace/server/restaurants"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar"
import { getPanelRestaurantsPath } from "@/features/panel/auth/navigation"

type PanelRestaurantIdentity = {
  id: string
  name: string
  slug: string
  hasLogo: boolean
}

type PanelAppShellProps = {
  children: ReactNode
  publicBasePath: "" | "/painel"
  restaurant: PanelRestaurantIdentity
  restaurants: PanelRestaurantListItem[]
}

const SHELL_EASE = [0.23, 1, 0.32, 1] as const

function RestaurantMark({ restaurant }: { restaurant: PanelRestaurantIdentity }) {
  const initials = restaurantInitials(restaurant.name)
  const fallback = (
    <span className="grid size-full place-items-center text-[0.625rem] font-bold tracking-wide text-primary">
      {initials}
    </span>
  )

  return (
    <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/70 bg-primary/[0.08]">
      {restaurant.hasLogo ? (
        <BrandImage
          slug={restaurant.slug}
          slot="logo"
          alt=""
          sizes="40px"
          className="object-contain p-1"
          fallback={fallback}
        />
      ) : fallback}
    </span>
  )
}

function PanelBrand({
  restaurant,
  restaurants,
  cardapioHref,
}: {
  restaurant: PanelRestaurantIdentity
  restaurants: PanelRestaurantListItem[]
  cardapioHref: string
}) {
  const { isMobile, state } = useSidebar()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const isCollapsed = !isMobile && state === "collapsed"
  const canSwitchRestaurants = restaurants.length > 1

  const brandContent = (
    <>
      <RestaurantMark key={`${restaurant.id}:${restaurant.slug}`} restaurant={restaurant} />
      <span className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
        <span className="block truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
          {restaurant.name}
        </span>
        <span className="block truncate text-[0.625rem] text-sidebar-foreground/65">
          Painel do restaurante
        </span>
      </span>
    </>
  )

  const triggerClass = `group flex min-h-12 w-full items-center gap-3 rounded-xl px-2 outline-none transition-[background-color,color] duration-150 hover:bg-sidebar-accent/70 focus-visible:ring-2 focus-visible:ring-sidebar-ring ${isCollapsed ? "justify-center px-0" : ""}`

  if (!canSwitchRestaurants) {
    return (
      <Link
        href={cardapioHref}
        aria-label={`Cardápio de ${restaurant.name}`}
        className={triggerClass}
      >
        {brandContent}
      </Link>
    )
  }

  return (
    <Popover open={switcherOpen} onOpenChange={setSwitcherOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            aria-label={`Trocar restaurante. Atual: ${restaurant.name}`}
            aria-haspopup="dialog"
            aria-expanded={switcherOpen}
            className={`${triggerClass} hover:text-sidebar-foreground`}
          />
        }
      >
        {brandContent}
        <LuChevronsUpDown
          aria-hidden="true"
          className="size-3.5 shrink-0 text-sidebar-foreground/65 group-data-[collapsible=icon]:hidden"
        />
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        className="w-[min(22rem,calc(100vw-1.5rem))] gap-2 rounded-2xl border-border/70 bg-background/95 p-3 shadow-2xl backdrop-blur-2xl motion-reduce:animate-none motion-reduce:transition-none"
      >
        <PanelRestaurantSwitcher
          restaurants={restaurants}
          currentRestaurantId={restaurant.id}
          onClose={() => setSwitcherOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}

export function PanelAppShell({
  children,
  publicBasePath,
  restaurant,
  restaurants,
}: PanelAppShellProps) {
  const prefersReducedMotion = useReducedMotion()
  const reducedMotion = prefersReducedMotion === true
  const cardapioHref = `${publicBasePath}/cardapio`
  const restaurantsHref = getPanelRestaurantsPath(publicBasePath)
  const canSwitchRestaurants = restaurants.length > 1

  const sequenceVariants = {
    hidden: {},
    visible: {
      transition: {
        delayChildren: reducedMotion ? 0 : 0.035,
        staggerChildren: reducedMotion ? 0 : 0.05,
      },
    },
  }
  const itemVariants = {
    hidden: reducedMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(7px)" },
    visible: {
      opacity: 1,
      transform: "translateY(0px)",
      transition: { duration: reducedMotion ? 0.12 : 0.19, ease: SHELL_EASE },
    },
  }

  return (
    <MotionConfig reducedMotion="user">
      <SidebarProvider
        defaultOpen
        disableMobileToggle
        data-panel-shell=""
        style={{ "--sidebar-width-icon": "4rem" } as CSSProperties}
      >
        <Sidebar collapsible="icon" variant="inset">
          <motion.div
            initial={reducedMotion ? false : "hidden"}
            animate="visible"
            variants={sequenceVariants}
            className="flex size-full flex-col"
          >
            <motion.div variants={itemVariants}>
              <SidebarHeader className="pb-4">
                <PanelBrand
                  restaurant={restaurant}
                  restaurants={restaurants}
                  cardapioHref={cardapioHref}
                />
              </SidebarHeader>
            </motion.div>

            <motion.div variants={itemVariants} className="flex min-h-0 flex-1 flex-col">
              <SidebarContent>
                <SidebarGroup>
                  <SidebarGroupLabel>Navegação</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          render={<Link href={cardapioHref} aria-current="page" />}
                          isActive
                          tooltip="Cardápio"
                          className="min-h-11 transition-colors duration-150 group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:justify-center!"
                        >
                          <LuUtensils aria-hidden="true" />
                          <span className="group-data-[collapsible=icon]:sr-only">Cardápio</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
            </motion.div>

            <motion.div variants={itemVariants}>
              <SidebarFooter>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <PanelAccountMenu
                      variant="sidebar"
                      restaurantsHref={restaurantsHref}
                      canSwitchRestaurants={canSwitchRestaurants}
                    />
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarFooter>
            </motion.div>
          </motion.div>
        </Sidebar>

        <SidebarInset className="min-w-0 bg-muted/30 pb-[calc(7rem_+_env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </SidebarInset>

        <PanelMobileDock
          cardapioHref={cardapioHref}
          restaurantsHref={restaurantsHref}
          canSwitchRestaurants={canSwitchRestaurants}
        />
      </SidebarProvider>
    </MotionConfig>
  )
}
