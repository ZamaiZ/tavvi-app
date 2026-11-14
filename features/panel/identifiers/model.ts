export type IdentifierNfcStatus = "pending" | "protected" | "uncertain"
export type IdentifierNfcOperationStatus = "ready" | "authorizing" | "writing" | "uncertain" | "failed" | "protected"

export type IdentifierDTO = {
  id: string
  publicToken: string
  publicUrl: string
  tableNumber: number
  isActive: boolean
  nfcSerial: string | null
  nfcProtectedAt: string | null
  nfcStatus: IdentifierNfcStatus
  nfcOperationId: string | null
  nfcOperationStatus: IdentifierNfcOperationStatus | null
}

export type PanelIdentifiersDTO = {
  restaurantId: string
  restaurantName: string
  slug: string
  identifiers: IdentifierDTO[]
  counts: {
    all: number
    pending: number
    protected: number
    inactive: number
  }
}

export type IdentifierActionFailureCode =
  | "invalid_input"
  | "session_expired"
  | "context_changed"
  | "unavailable"
  | "database_error"
  | "forbidden"
  | "not_found"
  | "table_conflict"
  | "active_call"
  | "serial_in_use"
  | "token_conflict"
  | "inactive"
  | "already_protected"
  | "operation_exists"
  | "operation_not_found"
  | "operation_state"
  | "serial_mismatch"

export type IdentifierActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: IdentifierActionFailureCode }

export type IdentifierCreateResult = { id: string; publicUrl: string }
export type IdentifierUpdateResult = { id: string }
export type IdentifierNfcCancellationResult = { serialReservation: "released" | "retained" }

