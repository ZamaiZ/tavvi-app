export type PanelFinanceDailyPoint = {
  day: string
  salesCents: number
  receivedCents: number
  expensesCents: number
}

export type PanelFinanceBreakdown = {
  label: string
  amountCents: number
}

export type PanelFinanceDashboardDTO = {
  from: string
  to: string
  timeZone: string
  salesCents: number
  receivedCents: number
  cashReceivedCents: number
  expensesCents: number
  cashInCents: number
  cashOutCents: number
  cashClosingSessionsCount: number
  cashOpenSessionsCount: number
  cashClosingExpectedCents: number
  cashClosingCountedCents: number
  cashClosingDifferenceCents: number
  cashDifferenceSessionsCount: number
  pendingCents: number
  daily: PanelFinanceDailyPoint[]
  expensesByCategory: Array<PanelFinanceBreakdown & { category: string }>
  expensesByMethod: Array<PanelFinanceBreakdown & { method: string }>
  receivedByMethod: Array<PanelFinanceBreakdown & { method: string }>
}
