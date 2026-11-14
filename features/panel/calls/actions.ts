"use server"

import type { PanelResolvedCallsPage, ServiceCallActionResult } from "./model"
import { panelCallMutationSchema, panelCallsContextSchema, panelResolvedCallsSchema } from "./schema"
import {
  claimPanelServiceCall,
  getPanelPendingServiceCallsCountForAction,
  getPanelResolvedServiceCallsForAction,
  resolvePanelServiceCall,
} from "./server/write"

function invalidInput<T>(): ServiceCallActionResult<T> {
  return { ok: false, code: "invalid_input" }
}

export async function getPanelPendingServiceCallsCountAction(rawInput: unknown): Promise<ServiceCallActionResult<number>> {
  const parsed = panelCallsContextSchema.safeParse(rawInput)
  return parsed.success ? getPanelPendingServiceCallsCountForAction(parsed.data) : invalidInput()
}

export async function getResolvedServiceCallsAction(rawInput: unknown): Promise<ServiceCallActionResult<PanelResolvedCallsPage>> {
  const parsed = panelResolvedCallsSchema.safeParse(rawInput)
  return parsed.success ? getPanelResolvedServiceCallsForAction(parsed.data) : invalidInput<PanelResolvedCallsPage>()
}

export async function claimServiceCallAction(rawInput: unknown) {
  const parsed = panelCallMutationSchema.safeParse(rawInput)
  return parsed.success ? claimPanelServiceCall(parsed.data) : invalidInput<{ id: string }>()
}

export async function resolveServiceCallAction(rawInput: unknown) {
  const parsed = panelCallMutationSchema.safeParse(rawInput)
  return parsed.success ? resolvePanelServiceCall(parsed.data) : invalidInput<{ id: string }>()
}
