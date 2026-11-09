"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import {
  LuArrowLeftRight,
  LuEllipsis,
  LuLogOut,
  LuMonitor,
  LuMoon,
  LuPalette,
  LuSun,
  LuUserRound,
} from "react-icons/lu"

import { signOutPanelAction } from "@/features/panel/auth/sign-out"
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

type PanelAccountMenuProps = {
  variant: "sidebar" | "dock"
  restaurantsHref: string
  canSwitchRestaurants: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function PanelAccountMenu({
  variant,
  restaurantsHref,
  canSwitchRestaurants,
  open,
  onOpenChange,
}: PanelAccountMenuProps) {
  const { theme, setTheme } = useTheme()
  const isDock = variant === "dock"

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            title={isDock ? "Conta" : "Preferências da conta"}
            className={
              isDock
                ? "h-14 w-full flex-col gap-1 rounded-2xl px-2 text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-foreground/5 hover:text-foreground active:scale-[0.96] motion-reduce:active:scale-100 motion-reduce:transition-none"
                : "h-12 w-full justify-start gap-2 rounded-lg px-2 text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center! group-data-[collapsible=icon]:p-0!"
            }
          />
        }
        aria-label={
          isDock
            ? canSwitchRestaurants
              ? "Abrir conta, aparência, troca de restaurante e saída"
              : "Abrir conta, aparência e saída"
            : "Abrir preferências da conta"
        }
      >
        {isDock ? (
          <>
            <LuUserRound aria-hidden="true" className="size-5" />
            <span className="text-[0.625rem] font-medium leading-none">Conta</span>
          </>
        ) : (
          <>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
              <LuUserRound aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
              <span className="block truncate font-medium">Conta do restaurante</span>
              <span className="block truncate text-[0.625rem] text-sidebar-foreground/65">
                Preferências do Painel
              </span>
            </span>
            <LuEllipsis
              aria-hidden="true"
              className="ml-auto text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden"
            />
          </>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side={isDock ? "top" : "right"}
        align={isDock ? "start" : "end"}
        sideOffset={isDock ? 12 : 8}
        className={
          isDock
            ? "w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl p-1.5 shadow-2xl motion-reduce:animate-none motion-reduce:transition-none"
            : "w-52"
        }
      >
        {canSwitchRestaurants ? (
          <>
            <DropdownMenuGroup>
              <DropdownMenuItem
                render={<Link href={restaurantsHref} />}
                className={isDock ? "min-h-11 rounded-xl px-3 text-sm" : undefined}
              >
                <LuArrowLeftRight aria-hidden="true" />
                Trocar restaurante
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className={isDock ? "my-1.5" : undefined} />
          </>
        ) : null}

        <DropdownMenuGroup>
          {isDock ? (
            <DropdownMenuLabel>
              <span className="flex items-center gap-2 px-1 py-1 text-[0.6875rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                <LuPalette aria-hidden="true" className="size-3.5" />
                Aparência
              </span>
            </DropdownMenuLabel>
          ) : (
            <DropdownMenuLabel>Preferências</DropdownMenuLabel>
          )}

          {isDock ? (
            <DropdownMenuRadioGroup
              value={theme ?? "system"}
              onValueChange={(value) => setTheme(value)}
            >
              <DropdownMenuRadioItem value="light" className="min-h-11 rounded-xl px-3 text-sm">
                <LuSun aria-hidden="true" />
                Claro
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark" className="min-h-11 rounded-xl px-3 text-sm">
                <LuMoon aria-hidden="true" />
                Escuro
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system" className="min-h-11 rounded-xl px-3 text-sm">
                <LuMonitor aria-hidden="true" />
                Sistema
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          ) : (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <LuPalette aria-hidden="true" />
                Aparência
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent side="right">
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
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator className={isDock ? "my-1.5" : undefined} />
        <form action={signOutPanelAction}>
          <DropdownMenuItem
            nativeButton
            variant="destructive"
            render={<button type="submit" className="w-full" />}
            className={isDock ? "min-h-11 rounded-xl px-3 text-sm" : undefined}
          >
            <LuLogOut aria-hidden="true" />
            Sair
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
