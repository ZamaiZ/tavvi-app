export type PublicServiceCallStatus = "pending" | "in_progress" | "resolved"

export type PublicServiceCallDTO = {
  callId: string
  tableNumber: number
  status: PublicServiceCallStatus
}

export type PublicServiceCallActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: "invalid_input" | "unavailable" | "hourly_limit" }

export type PublicServiceCallRequestDTO = PublicServiceCallDTO & { created: boolean }
