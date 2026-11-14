"use server"

import type { ServiceCallActionResult } from "./model"
import { panelCallMutationSchema, panelCallsContextSchema } from "./schema"
import {
  claimPanelServiceCall,
  getPanelPendingServiceCallsCountForAction,
  resolvePanelServiceCall,
} from "./server/write"

function invalidInput<T>(): ServiceCallActionResult<T> {
  return { ok: false, code: "invalid_input" }
}

export async function getPanelPendingServiceCallsCountAction(rawInput: unknown): Promise<ServiceCallActionResult<number>> {
  const parsed = panelCallsContextSchema.safeParse(rawInput)
  return parsed.success ? getPanelPendingServiceCallsCountForAction(parsed.data) : invalidInput()
}

export async function claimServiceCallAction(rawInput: unknown) {
  const parsed = panelCallMutationSchema.safeParse(rawInput)
  return parsed.success ? claimPanelServiceCall(parsed.data) : invalidInput<{ id: string }>()
}

export async function resolveServiceCallAction(rawInput: unknown) {
  const parsed = panelCallMutationSchema.safeParse(rawInput)
  return parsed.success ? resolvePanelServiceCall(parsed.data) : invalidInput<{ id: string }>()
}
