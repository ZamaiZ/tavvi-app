"use client"

import type { ReactNode } from "react"
import { LuSearch, LuX } from "react-icons/lu"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  inviteStatusOptions,
  type InviteFilter,
  type InviteCounts,
} from "@/features/admin/invites/model"

type InvitesTableToolbarProps = {
  children: ReactNode
  counts: InviteCounts
  query: string
  onQueryChange: (query: string) => void
  selectedFilter: InviteFilter
  onFilterChange: (filter: InviteFilter) => void
  isPending: boolean
}

export function InvitesTableToolbar({
  children,
  counts,
  query,
  onQueryChange,
  selectedFilter,
  onFilterChange,
  isPending,
}: InvitesTableToolbarProps) {
  return (
    <Tabs
      value={selectedFilter}
      onValueChange={(value) => onFilterChange(value as InviteFilter)}
      className="gap-3"
    >
      <div className="flex flex-col gap-3">
        <InputGroup className="h-9 max-w-md rounded-xl bg-background">
          <InputGroupAddon align="inline-start">
            <InputGroupText>
              <LuSearch aria-hidden="true" />
            </InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Buscar convites por e-mail"
            autoComplete="off"
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            placeholder="Buscar por e-mail..."
            value={query}
            className="h-9"
          />
          {isPending && (
            <InputGroupAddon align="inline-end">
              <Spinner
                aria-label="Atualizando convites"
                className="motion-reduce:animate-none"
              />
            </InputGroupAddon>
          )}
          {query && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label="Limpar busca"
                onClick={() => onQueryChange("")}
                size="icon-sm"
              >
                <LuX aria-hidden="true" />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>

        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="h-9 w-max min-w-full justify-start gap-1 rounded-xl bg-muted/65 p-1 sm:min-w-0">
            {inviteStatusOptions.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className="group/tabs-trigger h-7 flex-none gap-2 rounded-lg px-3 text-xs transition-all motion-reduce:transition-none data-active:shadow-sm"
              >
                {option.label}
                <span className="rounded-full bg-foreground/5 px-1.5 py-0.5 text-[0.625rem] text-muted-foreground tabular-nums group-data-[active=true]/tabs-trigger:bg-primary/10 group-data-[active=true]/tabs-trigger:text-primary">
                  {counts[option.value]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>

      <TabsContent value={selectedFilter} className="mt-0">
        {children}
      </TabsContent>
    </Tabs>
  )
}
