export type CashMovementKind = "cash_in" | "cash_out" | "expense"
export type CashExpenseCategory = "supplies" | "utilities" | "maintenance" | "transport" | "payroll" | "fees" | "other"

export const CASH_EXPENSE_CATEGORIES: Array<{ value: CashExpenseCategory; label: string }> = [
  { value: "supplies", label: "Compras e insumos" },
  { value: "utilities", label: "Contas e serviços" },
  { value: "maintenance", label: "Manutenção" },
  { value: "transport", label: "Transporte" },
  { value: "payroll", label: "Equipe" },
  { value: "fees", label: "Taxas" },
  { value: "other", label: "Outros" },
]

export type PanelCashSessionDTO = {
  id: string
  status: "open" | "closed"
  businessDate: string
  timeZone: string
  openedAt: string
  openedByName: string
  openingAmountCents: number
  expectedAmountCents: number
  closedAt: string | null
  closedByName: string | null
  countedAmountCents: number | null
  differenceCents: number | null
  forcedClose: boolean
  closingReason: string | null
}

export type PanelCashMovementDTO = {
  id: string
  kind: CashMovementKind | "payment"
  amountCents: number
  category: CashExpenseCategory | null
  paymentMethodLabel: string | null
  description: string
  createdAt: string
  createdByName: string
}

export type PanelCashStateDTO = {
  session: PanelCashSessionDTO | null
  movements: PanelCashMovementDTO[]
}

export type PanelCashFailureCode =
  | "invalid_input"
  | "session_expired"
  | "context_changed"
  | "unavailable"
  | "database_error"
  | "forbidden"
  | "not_found"
  | "request_conflict"
  | "session_already_open"
  | "session_already_closed_today"
  | "cash_session_required"
  | "cash_session_closed"
  | "cash_session_not_found"
  | "open_comandas"
  | "reason_required"
  | "difference_reason_required"
  | "payment_method_disabled"
  | "amount_overflow"

export type PanelCashActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: PanelCashFailureCode; openComandas?: number; expectedCents?: number; differenceCents?: number }

export type OpenPanelCashSessionInput = {
  expectedRestaurantId: string
  requestId: string
  openingAmountCents: number
}

export type RecordPanelFinancialMovementInput = {
  expectedRestaurantId: string
  sessionId: string | null
  requestId: string
  kind: CashMovementKind
  amountCents: number
  expenseCategory: CashExpenseCategory | null
  paymentMethod: string | null
  description: string
}

export type ClosePanelCashSessionInput = {
  expectedRestaurantId: string
  sessionId: string
  requestId: string
  countedAmountCents: number
  reason: string
  force: boolean
}
