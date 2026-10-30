"use client"

import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { useTheme } from "next-themes"
import {
  LuEllipsis,
  LuLogOut,
  LuMailPlus,
  LuMonitor,
  LuMoon,
  LuPalette,
  LuSun,
  LuUtensils,
  LuUserRound,
} from "react-icons/lu"

import { logoutAdminAction } from "@/app/admin/(auth)/actions"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { getAdminHomePath } from "@/features/admin/auth/navigation"

type AdminAppShellProps = {
  children: ReactNode
  publicBasePath: "" | "/admin"
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

function AdminProfileMenu() {
  const { isMobile } = useSidebar()
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            title="Perfil"
            className="h-12 w-full justify-start gap-2 rounded-lg px-2 text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center! group-data-[collapsible=icon]:p-0!"
          />
        }
        aria-label="Abrir menu do perfil"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
          <LuUserRound aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
          <span className="block truncate font-medium">Administrador</span>
          <span className="block truncate text-[0.625rem] text-sidebar-foreground/65">
            Conta de gestão
          </span>
        </span>
        <LuEllipsis
          aria-hidden="true"
          className="ml-auto text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={isMobile ? "bottom" : "right"}
        align="end"
        sideOffset={8}
        className="w-52"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>Preferências</DropdownMenuLabel>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <LuPalette aria-hidden="true" />
              Aparência
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent side={isMobile ? "bottom" : "right"}>
              <DropdownMenuRadioGroup
                value={theme ?? "system"}
                onValueChange={(value) => setTheme(value)}
              >
                <DropdownMenuRadioItem value="light">
                  <LuSun aria-hidden="true" />
                  Claro
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <LuMoon aria-hidden="true" />
                  Escuro
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  <LuMonitor aria-hidden="true" />
                  Sistema
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <form action={logoutAdminAction}>
          <DropdownMenuItem
            nativeButton
            variant="destructive"
            render={<button type="submit" className="w-full" />}
          >
            <LuLogOut aria-hidden="true" />
            Sair
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AdminAppShell({
  children,
  publicBasePath,
}: AdminAppShellProps) {
  const invitesHref = getAdminHomePath(publicBasePath)

  return (
    <SidebarProvider defaultOpen>
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
                    isActive
                    tooltip="Convites"
                    className="transition-colors duration-150"
                  >
                    <LuMailPlus aria-hidden="true" />
                    <span>Convites</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    disabled
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
              <AdminProfileMenu />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 bg-muted/30">
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
