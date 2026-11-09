"use client"

import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { LuMailPlus, LuUtensils } from "react-icons/lu"

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
import { AdminAccountMenu } from "@/features/admin/shell/components/admin-account-menu"
import { AdminMobileDock } from "@/features/admin/shell/components/admin-mobile-dock"
import {
  getAdminHomePath,
  getAdminRestaurantsPath,
} from "@/features/admin/auth/navigation"

type AdminNavigationItem = "invites" | "restaurants"

type AdminAppShellProps = {
  children: ReactNode
  publicBasePath: "" | "/admin"
  activeItem: AdminNavigationItem
}

function AdminBrand({ href }: { href: string }) {
  const { isMobile, state } = useSidebar()
  const isCollapsed = !isMobile && state === "collapsed"

  return (
    <Link
      href={href}
      aria-label="Tavvi — Gestão"
      className={`flex min-h-10 items-center transition-opacity duration-150 hover:opacity-90 ${isCollapsed ? "justify-center" : "px-2"}`}
    >
      {isCollapsed ? (
        <>
          <Image
            src="/brand/tavvi-brandmark-light.png"
            alt=""
            aria-hidden="true"
            width={36}
            height={36}
            priority
            className="size-8 object-contain dark:hidden"
          />
          <Image
            src="/brand/tavvi-brandmark-dark.png"
            alt=""
            aria-hidden="true"
            width={36}
            height={36}
            priority
            className="hidden size-8 object-contain dark:block"
          />
        </>
      ) : (
        <>
          <Image
            src="/brand/tavvi-lockup-horizontal-light.png"
            alt=""
            aria-hidden="true"
            width={180}
            height={70}
            priority
            className="h-auto w-36 object-contain dark:hidden"
          />
          <Image
            src="/brand/tavvi-lockup-horizontal-dark.png"
            alt=""
            aria-hidden="true"
            width={180}
            height={70}
            priority
            className="hidden h-auto w-36 object-contain dark:block"
          />
        </>
      )}
    </Link>
  )
}

export function AdminAppShell({
  children,
  publicBasePath,
  activeItem,
}: AdminAppShellProps) {
  const invitesHref = getAdminHomePath(publicBasePath)
  const restaurantsHref = getAdminRestaurantsPath(publicBasePath)

  return (
    <SidebarProvider defaultOpen disableMobileToggle>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <AdminBrand href={invitesHref} />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navegação</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href={invitesHref} />}
                    isActive={activeItem === "invites"}
                    tooltip="Convites"
                    className="transition-colors duration-150"
                  >
                    <LuMailPlus aria-hidden="true" />
                    <span>Convites</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href={restaurantsHref} />}
                    isActive={activeItem === "restaurants"}
                    tooltip="Restaurantes"
                    className="transition-colors duration-150"
                  >
                    <LuUtensils aria-hidden="true" />
                    <span>Restaurantes</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <AdminAccountMenu variant="sidebar" />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 bg-muted/30 pb-[calc(7rem_+_env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </SidebarInset>
      <AdminMobileDock
        invitesHref={invitesHref}
        restaurantsHref={restaurantsHref}
        activeItem={activeItem}
      />
    </SidebarProvider>
  )
}
