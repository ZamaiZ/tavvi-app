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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  inviteStatusOptions,
  type InviteFilter,
} from "@/features/admin/invites/data"

type InvitesTableToolbarProps = {
  children: ReactNode
  counts: Record<InviteFilter, number>
  query: string
  onQueryChange: (query: string) => void
  selectedFilter: InviteFilter
  onFilterChange: (filter: InviteFilter) => void
}

export function InvitesTableToolbar({
  children,
  counts,
  query,
  onQueryChange,
  selectedFilter,
  onFilterChange,
}: InvitesTableToolbarProps) {
  return (
    <Tabs
      value={selectedFilter}
      onValueChange={(value) => onFilterChange(value as InviteFilter)}
      className="gap-4"
    >
      <div className="flex flex-col gap-4">
        <InputGroup className="h-10 max-w-md rounded-xl bg-background">
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
            className="h-10"
          />
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
          <TabsList className="h-10 w-max min-w-full justify-start gap-1 rounded-xl bg-muted/65 p-1 sm:min-w-0">
            {inviteStatusOptions.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className="h-8 flex-none gap-2 rounded-lg px-3 text-xs transition-all motion-reduce:transition-none data-active:shadow-sm"
              >
                {option.label}
                <span className="rounded-full bg-foreground/5 px-1.5 py-0.5 text-[0.625rem] text-muted-foreground tabular-nums data-[active=true]:bg-primary/10 data-[active=true]:text-primary">
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
