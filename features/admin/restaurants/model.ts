export type RestaurantStatus = "draft" | "active" | "suspended"

export type RestaurantFilter = "all" | RestaurantStatus

export type RestaurantAdmin = {
  id: string
  name: string
  slug: string
  status: RestaurantStatus
  statusBeforeSuspension: "draft" | "active" | null
  createdAt: string
  updatedAt: string
}

export type RestaurantCounts = Record<RestaurantFilter, number>

export type RestaurantListQuery = {
  search: string
  status: RestaurantFilter
  page: number
  pageSize: number
}

export type RestaurantListResult = {
  rows: RestaurantAdmin[]
  counts: RestaurantCounts
  totalRows: number
  page: number
  pageSize: number
}

export const restaurantStatusOptions: { value: RestaurantFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Rascunhos" },
  { value: "active", label: "Ativos" },
  { value: "suspended", label: "Suspensos" },
]

export const restaurantStatusLabels: Record<RestaurantStatus, string> = {
  draft: "Rascunho",
  active: "Ativo",
  suspended: "Suspenso",
}

export function restaurantInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toLocaleUpperCase("pt-BR"))
      .join("") || "R"
  )
}

export function formatRestaurantDate(value: string | null) {
  if (!value) return "—"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value))
}
