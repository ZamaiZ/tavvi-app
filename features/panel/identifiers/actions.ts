"use server"

import type { IdentifierActionResult } from "./model"
import {
  identifierCreateSchema,
  identifierActiveSchema,
  identifierNfcBeginSchema,
  identifierNfcCompleteSchema,
  identifierNfcOperationSchema,
  identifierNfcWriteSchema,
  identifierNfcWriteClaimSchema,
  identifierNfcPhysicalStartedSchema,
  identifierNfcUncertainSchema,
  identifierUpdateSchema,
} from "./schema"
import {
  beginIdentifierNfc,
  cancelIdentifierNfc,
  completeIdentifierNfc,
  createIdentifier,
  markIdentifierNfcUncertain,
  markIdentifierNfcWriteStarted,
  markIdentifierNfcPhysicalStarted,
  cancelIdentifierNfcWriteClaim,
  updateIdentifier,
  setIdentifierActive,
} from "./server/write"

function invalidInput<T>(): Extract<IdentifierActionResult<T>, { ok: false }> {
  return { ok: false, code: "invalid_input" }
}

export async function createIdentifierAction(rawInput: unknown) {
  const parsed = identifierCreateSchema.safeParse(rawInput)
  return parsed.success ? createIdentifier(parsed.data) : invalidInput<{ id: string; publicUrl: string }>()
}

export async function updateIdentifierAction(rawInput: unknown) {
  const parsed = identifierUpdateSchema.safeParse(rawInput)
  return parsed.success ? updateIdentifier(parsed.data) : invalidInput<{ id: string }>()
}

export async function setIdentifierActiveAction(rawInput: unknown) {
  const parsed = identifierActiveSchema.safeParse(rawInput)
  return parsed.success ? setIdentifierActive(parsed.data) : invalidInput<{ id: string }>()
}

export async function beginIdentifierNfcAction(rawInput: unknown) {
  const parsed = identifierNfcBeginSchema.safeParse(rawInput)
  return parsed.success ? beginIdentifierNfc(parsed.data) : invalidInput<null>()
}

export async function markIdentifierNfcWriteStartedAction(rawInput: unknown) {
  const parsed = identifierNfcWriteSchema.safeParse(rawInput)
  return parsed.success ? markIdentifierNfcWriteStarted(parsed.data) : invalidInput<null>()
}

export async function markIdentifierNfcPhysicalStartedAction(rawInput: unknown) {
  const parsed = identifierNfcPhysicalStartedSchema.safeParse(rawInput)
  return parsed.success ? markIdentifierNfcPhysicalStarted(parsed.data) : invalidInput<null>()
}

export async function cancelIdentifierNfcWriteClaimAction(rawInput: unknown) {
  const parsed = identifierNfcWriteClaimSchema.safeParse(rawInput)
  return parsed.success ? cancelIdentifierNfcWriteClaim(parsed.data) : invalidInput<null>()
}

export async function cancelIdentifierNfcAction(rawInput: unknown) {
  const parsed = identifierNfcOperationSchema.safeParse(rawInput)
  return parsed.success ? cancelIdentifierNfc(parsed.data) : invalidInput<null>()
}

export async function markIdentifierNfcUncertainAction(rawInput: unknown) {
  const parsed = identifierNfcUncertainSchema.safeParse(rawInput)
  return parsed.success ? markIdentifierNfcUncertain(parsed.data) : invalidInput<null>()
}

export async function completeIdentifierNfcAction(rawInput: unknown) {
  const parsed = identifierNfcCompleteSchema.safeParse(rawInput)
  return parsed.success ? completeIdentifierNfc(parsed.data) : invalidInput<null>()
}

