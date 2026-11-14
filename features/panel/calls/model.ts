export type ServiceCallStatus = "pending" | "in_progress" | "resolved"

export type PanelServiceCallDTO = {
  id: string
  restaurantId: string
  tagId: string
  tableNumber: number
  status: ServiceCallStatus
  createdAt: string
  claimedAt: string | null
  claimedBy: string | null
  resolvedAt: string | null
}

export type PanelServiceCallCursor = {
  resolvedAt: string
  id: string
}

export type PanelResolvedCallsPage = {
  calls: PanelServiceCallDTO[]
  nextCursor: PanelServiceCallCursor | null
}

export type ServiceCallFailureCode =
  | "invalid_input"
  | "session_expired"
  | "context_changed"
  | "unavailable"
  | "database_error"
  | "forbidden"
  | "not_found"
  | "claim_conflict"
  | "resolve_conflict"

export type ServiceCallActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ServiceCallFailureCode }
